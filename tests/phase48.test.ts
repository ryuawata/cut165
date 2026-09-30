import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {createSerializedSaveQueue,incrementMetricValue} from '../lib/daily-metrics.ts'
import {
 completeCustomWorkout,createCustomWorkoutTemplate,customWorkoutCode,deleteCustomWorkoutTemplate,
 getCustomWorkoutTemplates,snapshotCustomWorkout,updateCustomWorkoutTemplate,validateCustomWorkout,
 type CustomWorkoutTemplate
} from '../lib/custom-workouts.ts'
import {
 createNutritionEntry,normalizeManualNutritionValues,normalizeMealSlot
} from '../lib/nutrition.ts'
import {
 canNavigateToPeriod,chartPositions,completeNutritionDays,monthBoundsForDate,summarizePeriod,targetForDate,
 weekBoundsForDate,type PeriodProgress
} from '../lib/progress.ts'
import {
 actualWeightChange,calendarDateInTimezone,formatWeightValue
} from '../lib/targets.ts'

const template=(overrides:Partial<CustomWorkoutTemplate>={}):CustomWorkoutTemplate=>({
 id:'template-1',user_id:'user-1',name:'Video strength',format:'guided',category:'strength',
 description:null,external_url:'https://example.com/workout',duration_minutes:30,exercises:[],sort_order:0,
 created_at:'2026-09-29T00:00:00Z',updated_at:'2026-09-29T00:00:00Z',...overrides
})

test('actual weight direction and decimal formatting use the measured change',()=>{
 assert.deepEqual(actualWeightChange(180,176.4),{change:-3.5999999999999943,magnitude:3.5999999999999943,direction:'down'})
 assert.equal(actualWeightChange(180,181.2).direction,'up')
 assert.equal(actualWeightChange(180,180).direction,'unchanged')
 assert.equal(formatWeightValue(176.4),'176.4')
 assert.equal(formatWeightValue(80.01),'80.01')
})

test('drink is a valid meal slot while existing slots remain valid',()=>{
 for(const slot of ['breakfast','lunch','dinner','snack','drink'] as const)assert.equal(normalizeMealSlot(slot),slot)
 assert.throws(()=>normalizeMealSlot('brunch'),/Unsupported meal slot/)
})

test('new manual blanks normalize to zero and an all-blank entry is rejected',()=>{
 assert.deepEqual(normalizeManualNutritionValues({calories:520}),{
  calories:520,protein_g:0,carbs_g:0,fat_g:0,alcohol_servings:0
 })
 assert.throws(()=>normalizeManualNutritionValues({}),/at least one nutrition value/i)
})

test('manual inserts normalize blanks while imported historical unknowns stay null',async()=>{
 const inserted:Array<Record<string,unknown>>=[]
 const client={from(table:string){
  assert.equal(table,'nutrition_entries')
  return {insert(values:Record<string,unknown>){
   inserted.push(values)
   return {select(){return this},async single(){return {data:{
    id:`entry-${inserted.length}`,created_at:'now',updated_at:'now',consumed_at:null,source_ref:null,...values
   },error:null}}}
  }}
 }} as unknown as Parameters<typeof createNutritionEntry>[0]
 await createNutritionEntry(client,{
  userId:'user-1',logDate:'2026-09-28',entryType:'food',description:'Sandwich',source:'manual',calories:520
 })
 await createNutritionEntry(client,{
  userId:'user-1',logDate:'2026-09-27',entryType:'legacy',description:'Historical meal',source:'legacy',calories:520
 })
 assert.deepEqual(
  [inserted[0].calories,inserted[0].protein_g,inserted[0].carbs_g,inserted[0].fat_g,inserted[0].alcohol_servings],
  [520,0,0,0,0]
 )
 assert.deepEqual(
  [inserted[1].calories,inserted[1].protein_g,inserted[1].carbs_g,inserted[1].fat_g,inserted[1].alcohol_servings],
  [520,null,null,null,null]
 )
})

test('one serialized Water queue preserves manual edits and rapid increments',async()=>{
 async function run(initial:number|null,actions:Array<{type:'edit';value:number}|{type:'add';value:number}>){
  const queue=createSerializedSaveQueue()
  const writes:number[]=[]
  const pending:Promise<void>[]=[]
  let logical=initial
  for(const action of actions){
   logical=action.type==='edit'?action.value:incrementMetricValue(logical,action.value)
   const value=logical
   pending.push(queue.enqueue(async()=>{writes.push(value)}))
  }
  await Promise.all(pending)
  return {logical,persisted:writes.at(-1)??initial,writes}
 }
 assert.equal((await run(null,[{type:'add',value:8}])).persisted,8)
 assert.equal((await run(40,[{type:'add',value:8}])).persisted,48)
 assert.deepEqual(await run(null,[{type:'edit',value:40},{type:'add',value:8}]),{
  logical:48,persisted:48,writes:[40,48]
 })
 assert.equal((await run(null,[{type:'add',value:8},{type:'add',value:12},{type:'add',value:16}])).persisted,36)
 const serial=createSerializedSaveQueue()
 const started:number[]=[]
 let releaseFirst:()=>void=()=>undefined
 const first=serial.enqueue(()=>new Promise<void>(resolve=>{started.push(40);releaseFirst=resolve}))
 const second=serial.enqueue(async()=>{started.push(48)})
 await Promise.resolve()
 assert.deepEqual(started,[40])
 releaseFirst()
 await Promise.all([first,second])
 assert.deepEqual(started,[40,48])
 assert.throws(()=>incrementMetricValue(40,-8),/greater than zero/)
})

test('calendar periods use Monday boundaries, month boundaries, and block future periods',()=>{
 assert.deepEqual(weekBoundsForDate('2026-09-28'),{start:'2026-09-28',endExclusive:'2026-10-05'})
 assert.deepEqual(weekBoundsForDate('2026-10-04'),{start:'2026-09-28',endExclusive:'2026-10-05'})
 assert.deepEqual(monthBoundsForDate('2026-02-20'),{start:'2026-02-01',endExclusive:'2026-03-01'})
 assert.equal(canNavigateToPeriod('week','2026-10-05','2026-09-28'),false)
 assert.equal(canNavigateToPeriod('month','2026-10-01','2026-09-28'),false)
 assert.equal(calendarDateInTimezone('America/Chicago',new Date('2026-09-29T03:30:00Z')),'2026-09-28')
})

test('period summaries exclude only the affected partial metric and average fully covered targets',()=>{
 const targets=[
  {effective_from:'2026-09-01',effective_to:'2026-09-16',calorie_target_min:1600,calorie_target_max:1800,protein_target_g:140},
  {effective_from:'2026-09-16',effective_to:null,calorie_target_min:1800,calorie_target_max:2000,protein_target_g:150}
 ]
 const progress={
  bounds:{start:'2026-09-14',endExclusive:'2026-09-21'},weights:[],
  nutrition:[
   {log_date:'2026-09-15',entry_count:1,calories:100,protein_g:20,calories_unknown_count:0,protein_unknown_count:1},
   {log_date:'2026-09-16',entry_count:1,calories:200,protein_g:40,calories_unknown_count:1,protein_unknown_count:0},
   {log_date:'2026-09-17',entry_count:1,calories:300,protein_g:60,calories_unknown_count:0,protein_unknown_count:0}
  ],
  metrics:[{log_date:'2026-09-15',steps:0},{log_date:'2026-09-16',steps:null}],
  workouts:[
   {scheduled_date:'2026-09-15',status:'completed',workout_code:'custom_strength'},
   {scheduled_date:'2026-09-16',status:'completed',workout_code:'custom_cardio'}
  ],targets
 } as unknown as PeriodProgress
 const summary=summarizePeriod(progress)
 assert.equal(summary.averageCalories,200)
 assert.equal(summary.averageProtein,50)
 assert.equal(summary.nutritionLoggedDays,3)
 assert.equal(summary.completeCalorieDays,2)
 assert.equal(summary.completeProteinDays,2)
 assert.deepEqual(completeNutritionDays(progress.nutrition,'calories').map(day=>day.log_date),['2026-09-15','2026-09-17'])
 assert.deepEqual(completeNutritionDays(progress.nutrition,'protein_g').map(day=>day.log_date),['2026-09-16','2026-09-17'])
 assert.equal(summary.averageSteps,0)
 assert.equal(summary.stepsLoggedDays,1)
 assert.equal(summary.completedWorkouts,2)
 assert.equal(summary.completedStrength,1)
 assert.equal(summary.averageCalorieTarget,1800)
 assert.equal(summary.averageProteinTarget,150)
 assert.equal(targetForDate(progress.targets,'2026-09-15')?.protein_target_g,140)
 assert.equal(targetForDate(progress.targets,'2026-09-16')?.protein_target_g,150)
})

test('period target averages are unavailable when any complete metric day lacks a target',()=>{
 const progress={
  bounds:{start:'2026-09-14',endExclusive:'2026-09-21'},weights:[],
  nutrition:[
   {log_date:'2026-09-15',entry_count:1,calories:100,protein_g:20,calories_unknown_count:0,protein_unknown_count:0},
   {log_date:'2026-09-16',entry_count:1,calories:300,protein_g:60,calories_unknown_count:0,protein_unknown_count:0}
  ],
  metrics:[],workouts:[],
  targets:[
   {effective_from:'2026-09-15',effective_to:'2026-09-16',calorie_target_min:1600,calorie_target_max:1800,protein_target_g:140}
  ]
 } as unknown as PeriodProgress
 const summary=summarizePeriod(progress)
 assert.equal(summary.averageCalories,200)
 assert.equal(summary.averageProtein,40)
 assert.equal(summary.completeCalorieDays,2)
 assert.equal(summary.completeProteinDays,2)
 assert.equal(summary.averageCalorieTarget,null)
 assert.equal(summary.averageProteinTarget,null)
})

test('a complete logged zero remains a valid nutrition sample',()=>{
 const zeroDay={
  log_date:'2026-09-18',entry_count:1,calories:0,protein_g:0,
  calories_unknown_count:0,protein_unknown_count:0
 } as PeriodProgress['nutrition'][number]
 assert.deepEqual(completeNutritionDays([zeroDay],'calories'),[zeroDay])
 assert.deepEqual(completeNutritionDays([zeroDay],'protein_g'),[zeroDay])
})

test('chart geometry uses real calendar spacing and remains safe for empty and one-point data',()=>{
 const september={start:'2026-09-01',endExclusive:'2026-10-01'}
 assert.deepEqual(chartPositions([],september),[])
 const one=chartPositions([{date:'2026-09-15',value:175}],september,100,60,10)
 assert.equal(one[0].y,30)
 assert.ok(one[0].x>45&&one[0].x<52)
 const adjacent=chartPositions([
  {date:'2026-09-01',value:10},{date:'2026-09-02',value:30}
 ],september,100,60,10)
 assert.ok(adjacent[1].x-adjacent[0].x<3)
 const monthSpan=chartPositions([
  {date:'2026-09-01',value:10},{date:'2026-09-30',value:30}
 ],september,100,60,10)
 assert.deepEqual(monthSpan.map(point=>point.x),[10,90])
 const sparseWeek=chartPositions([
  {date:'2026-09-28',value:10},{date:'2026-10-02',value:30}
 ],{start:'2026-09-28',endExclusive:'2026-10-05'},100,60,10)
 assert.deepEqual(sparseWeek.map(point=>Math.round(point.x)),[10,63])
})

test('custom workout validation supports both formats and all categories safely',()=>{
 for(const category of ['strength','cardio','mobility','other'] as const){
  assert.equal(validateCustomWorkout({...template({category}),sort_order:0}).category,category)
  assert.equal(customWorkoutCode(category),`custom_${category}`)
 }
 assert.throws(()=>validateCustomWorkout({...template(),format:'structured',exercises:[]}),/at least one exercise/)
 assert.equal(validateCustomWorkout({...template(),format:'structured',exercises:[{name:'Squat',sets:'3',reps:'8'}]}).exercises.length,1)
 assert.throws(()=>validateCustomWorkout({...template(),external_url:'javascript:alert(1)'}),/http or https/)
 assert.throws(()=>validateCustomWorkout({...template(),category:'dance' as 'other'}),/valid workout category/)
})

test('custom workout snapshots are immutable copies of completed template data',()=>{
 const workout=template({name:'Original',exercises:[{name:'Row',sets:'3',reps:'10'}],format:'structured'})
 const snapshot=snapshotCustomWorkout(workout)
 workout.name='Later edit'
 workout.exercises[0].name='Changed row'
 assert.equal(snapshot.name,'Original')
 assert.equal(snapshot.exercises[0].name,'Row')
 assert.equal(snapshot.type,'custom')
})

test('custom template CRUD is explicitly scoped to the authenticated user',async()=>{
 const readFilters:Array<[string,unknown]>=[]
 class ReadQuery implements PromiseLike<{data:[];error:null}>{
  select(){return this}
  eq(column:string,value:unknown){readFilters.push([column,value]);return this}
  order(){return this}
  then<TResult1={data:[];error:null},TResult2=never>(onfulfilled?:((value:{data:[];error:null})=>TResult1|PromiseLike<TResult1>)|null):PromiseLike<TResult1|TResult2>{
   return Promise.resolve({data:[] as [],error:null}).then(onfulfilled)
  }
 }
 await getCustomWorkoutTemplates({from(){return new ReadQuery()}} as unknown as Parameters<typeof getCustomWorkoutTemplates>[0],'user-1')
 assert.deepEqual(readFilters,[['user_id','user-1']])

 let created:Record<string,unknown>|null=null
 let updateFilters:Array<[string,unknown]>=[]
 let deleteFilters:Array<[string,unknown]>=[]
 const saved=template()
 const singleChain={select(){return this},async single(){return {data:saved,error:null}}}
 const createClient={from(){return {insert(values:Record<string,unknown>){created=values;return singleChain}}}} as unknown as Parameters<typeof createCustomWorkoutTemplate>[0]
 await createCustomWorkoutTemplate(createClient,'user-1',saved)
 assert.equal(created?.user_id,'user-1')

 const updateChain={
  eq(column:string,value:unknown){updateFilters.push([column,value]);return this},select(){return this},
  async single(){return {data:saved,error:null}}
 }
 const updateClient={from(){return {update(){return updateChain}}}} as unknown as Parameters<typeof updateCustomWorkoutTemplate>[0]
 await updateCustomWorkoutTemplate(updateClient,'user-1','template-1',saved)
 assert.deepEqual(updateFilters,[['id','template-1'],['user_id','user-1']])

 const deleteChain={
  eq(column:string,value:unknown){deleteFilters.push([column,value]);return this},select(){return this},
  async maybeSingle(){return {data:{id:'template-1'},error:null}}
 }
 const deleteClient={from(){return {delete(){return deleteChain}}}} as unknown as Parameters<typeof deleteCustomWorkoutTemplate>[0]
 await deleteCustomWorkoutTemplate(deleteClient,'user-1','template-1')
 assert.deepEqual(deleteFilters,[['id','template-1'],['user_id','user-1']])
})

test('custom completion is user/date scoped, idempotent, and allows different templates on one date',async()=>{
 const rows:Array<Record<string,unknown>>=[]
 class Query{
  filters:Record<string,unknown>={}
  select(){return this}
  eq(column:string,value:unknown){this.filters[column]=value;return this}
  async maybeSingle(){
   const data=rows.find(row=>Object.entries(this.filters).every(([key,value])=>row[key]===value))??null
   return {data,error:null}
  }
  async single(){
   const data=rows.find(row=>Object.entries(this.filters).every(([key,value])=>row[key]===value))??null
   return {data,error:data?null:{message:'not found'}}
  }
 }
 const client={from(table:string){
  assert.equal(table,'workout_sessions')
  return {
   select(){return new Query()},
   insert(values:Record<string,unknown>){
    const row={id:`session-${rows.length+1}`,created_at:'now',updated_at:'now',completed_at:null,notes:null,...values}
    rows.push(row)
    return {select(){return this},async single(){return {data:row,error:null}}}
   }
  }
 }} as unknown as Parameters<typeof completeCustomWorkout>[0]
 const first=template()
 const second=template({id:'template-2',name:'Mobility',category:'mobility'})
 await completeCustomWorkout(client,{userId:'user-1',logDate:'2026-09-28',template:first,isToday:false})
 await completeCustomWorkout(client,{userId:'user-1',logDate:'2026-09-28',template:first,isToday:false})
 await completeCustomWorkout(client,{userId:'user-1',logDate:'2026-09-28',template:second,isToday:false})
 assert.equal(rows.length,2)
 assert.deepEqual(rows.map(row=>row.source_ref),[
  'cut365:2026-09-28:custom:template-1','cut365:2026-09-28:custom:template-2'
 ])
 assert.ok(rows.every(row=>row.user_id==='user-1'&&row.scheduled_date==='2026-09-28'))
 assert.equal(rows[0].workout_code,'custom_strength')
 assert.equal(rows[1].workout_code,'custom_mobility')
 assert.equal((rows[0].workout_snapshot as {name:string}).name,'Video strength')
})

test('Phase 4.8 UI exposes units, entry parity, one shared form, and water controls',()=>{
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8')
 const presets=readFileSync(new URL('../app/nutrition-presets.tsx',import.meta.url),'utf8')
 for(const label of ['Calories (kcal)','Protein (g)','Carbs (g)','Fat (g)','Alcohol (servings)']){
  assert.match(page,new RegExp(label.replace(/[()]/g,'\\$&')))
  assert.match(presets,new RegExp(label.replace(/[()]/g,'\\$&')))
 }
 assert.match(page,/\+ Add food/)
 assert.equal(page.match(/id="one-off-entry"/g)?.length,1)
 for(const amount of [8,12,16,24])assert.match(page,new RegExp(`\\+\\{amount\\} oz|\\+${amount} oz`))
})

test('Water input and Quick Adds share one queue, and Goal Settings refreshes visible periods',()=>{
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8')
 assert.match(page,/function queueWaterSave\(logDate:string,value:number\|null\)/)
 assert.match(page,/onBlur=\{\(\)=>queueWaterSave\(selectedDate,metrics\.water_oz\)\}/)
 assert.match(page,/function incrementWater[\s\S]*queueWaterSave\(logDate,next\)/)
 assert.doesNotMatch(page,/autosaveMetric\('water_oz'/)
 assert.match(page,/const refreshPeriod=useCallback/)
 assert.match(page,/function finishGoalSettings[\s\S]*periodVisible[\s\S]*refreshPeriod\(activePeriodView,periodAnchor,session\.user\.id,nextGoal\.id\)/)
 assert.equal(page.match(/getPeriodProgress\(supabase/g)?.length,1)
})

test('Phase 4.8 migration is additive, preserves history, and secures custom templates',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260929015041_phase48_tracking_custom_workouts.sql',import.meta.url),'utf8')
 assert.match(sql,/meal_slot in \('breakfast', 'lunch', 'dinner', 'snack', 'drink'\)/)
 assert.match(sql,/create table public\.custom_workout_templates/)
 assert.match(sql,/foreign key \(custom_workout_template_id, user_id\)[\s\S]*references public\.custom_workout_templates\(id, user_id\)[\s\S]*on delete set null \(custom_workout_template_id\)/)
 assert.match(sql,/custom_workout_templates_manage_own/)
 assert.match(sql,/external_url is null or btrim\(external_url\) ~\* '\^https\?:\/\/'/)
 assert.match(sql,/using \(\(select auth\.uid\(\)\) = user_id\)/)
 assert.match(sql,/with check \(\(select auth\.uid\(\)\) = user_id\)/)
 assert.match(sql,/custom_strength[\s\S]*custom_cardio[\s\S]*custom_mobility[\s\S]*custom_other/)
 assert.doesNotMatch(sql,/update public\.|delete from public\.|insert into public\.workout_sessions/i)
})

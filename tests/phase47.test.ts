import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {dailyMetricPatch,saveDailyMetricField} from '../lib/daily-metrics.ts'
import {saveBodyWeight} from '../lib/body-measurements.ts'
import {
 calculateNutritionCorrection,createNutritionEntry,emptyDailyNutritionTotals,replaceNutritionTotal
} from '../lib/nutrition.ts'
import {
 createNutritionPreset,deleteNutritionPreset,logNutritionPreset,updateNutritionPreset,validateNutritionPreset,
 type NutritionPreset
} from '../lib/nutrition-presets.ts'
import {primaryCalorieTarget} from '../lib/targets.ts'
import {
 defaultWorkoutTemplate,getWorkoutTemplates,resolveWorkoutTemplate,snapshotWorkout,validateWorkoutTemplate
} from '../lib/workout-templates.ts'
import {setWorkoutCompletion} from '../lib/workouts.ts'

test('consumer calorie goal uses the rounded persisted-range midpoint',()=>{
 assert.equal(primaryCalorieTarget(1650,1850),1750)
 assert.equal(primaryCalorieTarget(1640,1830),1740)
})

test('workout templates fall back to starters and preserve completed snapshots',()=>{
 const starter=resolveWorkoutTemplate({code:'full_body_a',completed:false,snapshot:null,templates:[]})
 assert.equal(starter.name,'Full Body A')
 const override={...defaultWorkoutTemplate('full_body_a'),id:'override',user_id:'user-1',name:'My A'}
 assert.equal(resolveWorkoutTemplate({code:'full_body_a',completed:false,snapshot:null,templates:[override]}).name,'My A')
 const snapshot=snapshotWorkout(override)
 const edited={...override,name:'Later edit'}
 assert.equal(resolveWorkoutTemplate({code:'full_body_a',completed:true,snapshot,templates:[edited]}).name,'My A')
 assert.throws(()=>validateWorkoutTemplate({...starter,exercises:[]}),/between 1 and 20/)
})

test('workout template reads are explicitly user scoped',async()=>{
 const filters:Array<[string,unknown]>=[]
 class Query implements PromiseLike<{data:[];error:null}>{
  select(){return this}
  eq(column:string,value:unknown){filters.push([column,value]);return this}
  order(){return this}
  then<TResult1={data:[];error:null},TResult2=never>(onfulfilled?:((value:{data:[];error:null})=>TResult1|PromiseLike<TResult1>)|null):PromiseLike<TResult1|TResult2>{
   return Promise.resolve({data:[] as [],error:null}).then(onfulfilled)
  }
 }
 const client={from(table:string){assert.equal(table,'workout_templates');return new Query()}} as unknown as Parameters<typeof getWorkoutTemplates>[0]
 const templates=await getWorkoutTemplates(client,'user-1')
 assert.equal(templates.length,2)
 assert.deepEqual(filters,[['user_id','user-1']])
})

test('completing a modern workout writes the effective template snapshot',async()=>{
 let inserted:Record<string,unknown>|null=null
 const template=defaultWorkoutTemplate('full_body_a')
 const snapshot=snapshotWorkout(template)
 const row=()=>({
  id:'session-1',created_at:'2026-09-22T00:00:00Z',updated_at:'2026-09-22T00:00:00Z',
  completed_at:'2026-09-22T00:00:00Z',duration_minutes:null,notes:null,scheduled_date:'2026-09-22',
  source:'manual',source_ref:'cut365:2026-09-22:full_body_a',status:'completed',user_id:'user-1',
  workout_code:'full_body_a',workout_snapshot:snapshot
 })
 const read={eq(){return this},async maybeSingle(){return {data:null,error:null}}}
 const write={select(){return this},async single(){return {data:row(),error:null}}}
 const client={from(table:string){
  assert.equal(table,'workout_sessions')
  return {select(){return read},insert(values:Record<string,unknown>){inserted=values;return write}}
 }} as unknown as Parameters<typeof setWorkoutCompletion>[0]
 await setWorkoutCompletion(client,{
  userId:'user-1',logDate:'2026-09-22',code:'full_body_a',completed:true,
  session:null,isToday:true,workoutSnapshot:snapshot
 })
 assert.deepEqual(inserted?.workout_snapshot,snapshot)
})

test('nutrition presets accept multiple macros and optional alcohol',()=>{
 const preset=validateNutritionPreset({
  name:'Dinner',meal_slot:'dinner',calories:580,protein_g:18,carbs_g:45,
  fat_g:null,alcohol_servings:1,sort_order:0
 })
 assert.equal(preset.calories,580)
 assert.equal(preset.protein_g,18)
 assert.equal(preset.alcohol_servings,1)
})

test('preset update, delete, and logging remain user scoped and snapshot values',async()=>{
 const filters:Array<[string,unknown]>=[]
 let logged:Record<string,unknown>|null=null
 let insertedPreset:Record<string,unknown>|null=null
 const preset: NutritionPreset={
  id:'preset-1',user_id:'user-1',name:'Shake',meal_slot:'snack',calories:160,protein_g:30,
  carbs_g:5,fat_g:null,alcohol_servings:null,sort_order:0,created_at:'now',updated_at:'now'
 }
 const row={...preset}
 const chain={
  eq(column:string,value:unknown){filters.push([column,value]);return this},select(){return this},
  async single(){return {data:row,error:null}},async maybeSingle(){return {data:{id:'preset-1'},error:null}}
 }
 const client={from(table:string){
  if(table==='nutrition_presets')return {insert(values:Record<string,unknown>){insertedPreset=values;return chain},update(){return chain},delete(){return chain}}
  assert.equal(table,'nutrition_entries')
  return {insert(values:Record<string,unknown>){logged={...values};return {select(){return this},async single(){return {data:{...values,id:'entry-1',created_at:'now',updated_at:'now'},error:null}}}}}
 }} as unknown as Parameters<typeof updateNutritionPreset>[0]
 await createNutritionPreset(client,'user-1',{
  name:'Shake',meal_slot:'snack',calories:160,protein_g:30,carbs_g:5,fat_g:null,alcohol_servings:null,sort_order:0
 })
 await updateNutritionPreset(client,'user-1','preset-1',{
  name:'Shake',meal_slot:'snack',calories:170,protein_g:31,carbs_g:5,fat_g:null,alcohol_servings:null,sort_order:0
 })
 await deleteNutritionPreset(client,'user-1','preset-1')
 await logNutritionPreset(client,'user-1','2026-09-22',preset)
 preset.calories=999
 assert.equal(insertedPreset?.user_id,'user-1')
 assert.equal(logged?.calories,160)
 assert.equal(filters.filter(([column,value])=>column==='user_id'&&value==='user-1').length,2)
})

test('nutrition corrections replace totals without stacking',()=>{
 assert.equal(calculateNutritionCorrection(1200,null,1500),300)
 assert.equal(calculateNutritionCorrection(1500,300,1300),100)
 assert.equal(calculateNutritionCorrection(1700,300,1500),100)
 assert.equal(calculateNutritionCorrection(1500,300,1200),0)
 assert.equal(calculateNutritionCorrection(1200,null,1000),-200)
})

test('partial totals block replacement and normal entries reject negatives',async()=>{
 const totals={...emptyDailyNutritionTotals('2026-09-22'),calories:700,calories_unknown_count:1}
 const client={from(){throw new Error('Database should not be called')}} as unknown as Parameters<typeof replaceNutritionTotal>[0]
 await assert.rejects(replaceNutritionTotal(client,{
  userId:'user-1',logDate:'2026-09-22',metric:'calories',desiredTotal:800,totals
 }),/Complete the partial entries/)
 await assert.rejects(createNutritionEntry(client,{
  userId:'user-1',logDate:'2026-09-22',entryType:'food',description:'Invalid',source:'manual',calories:-1
 }),/non-negative/)
})

test('daily total replacement updates or deletes one deterministic owned correction',async()=>{
 type Row=Record<string,unknown>
 let existing:Row|null={
  id:'correction-1',user_id:'user-1',log_date:'2026-09-22',consumed_at:null,
  entry_type:'adjustment',meal_slot:null,description:'Daily calorie correction',calories:300,
  protein_g:null,carbs_g:null,fat_g:null,alcohol_servings:null,source:'manual',
  source_ref:'daily-total-correction:calories:2026-09-22',created_at:'now',updated_at:'now'
 }
 const filters:Array<[string,unknown]> = []
 let updatePayload:Row|null=null
 let deleted=false
 const query={
  eq(column:string,value:unknown){filters.push([column,value]);return this},
  select(){return this},
  async maybeSingle(){return {data:existing,error:null}},
  async single(){return {data:{...existing,...updatePayload},error:null}}
 }
 const client={from(table:string){
  assert.equal(table,'nutrition_entries')
  return {
   select(){return query},
   update(values:Row){updatePayload=values;return query},
   delete(){deleted=true;return query}
  }
 }} as unknown as Parameters<typeof replaceNutritionTotal>[0]
 const totals={...emptyDailyNutritionTotals('2026-09-22'),calories:1500}
 await replaceNutritionTotal(client,{userId:'user-1',logDate:'2026-09-22',metric:'calories',desiredTotal:1300,totals})
 assert.equal(updatePayload?.calories,100)
 assert.ok(filters.some(([column,value])=>column==='source_ref'&&value==='daily-total-correction:calories:2026-09-22'))
 filters.length=0
 await replaceNutritionTotal(client,{userId:'user-1',logDate:'2026-09-22',metric:'calories',desiredTotal:1200,totals})
 assert.equal(deleted,true)
 assert.ok(filters.some(([column,value])=>column==='user_id'&&value==='user-1'))
 assert.ok(filters.some(([column,value])=>column==='log_date'&&value==='2026-09-22'))
})

test('daily metric patches update only the requested field',async()=>{
 assert.deepEqual(dailyMetricPatch('steps',5000),{steps:5000})
 assert.deepEqual(dailyMetricPatch('water_oz',64),{water_oz:64})
 assert.deepEqual(dailyMetricPatch('notes','  useful note  '),{notes:'useful note'})
 let payload:Record<string,unknown>|null=null
 const result={id:'metric-1',log_date:'2026-09-22',steps:5000,water_oz:80,cardio_minutes:30,notes:'keep'}
 const chain={select(){return this},async single(){return {data:result,error:null}}}
 const client={from(table:string){assert.equal(table,'daily_metrics');return {upsert(values:Record<string,unknown>){payload=values;return chain}}}} as unknown as Parameters<typeof saveDailyMetricField>[0]
 await saveDailyMetricField(client,'user-1','2026-09-22','steps',5000)
 assert.deepEqual(payload,{user_id:'user-1',log_date:'2026-09-22',steps:5000})
 assert.equal(Object.hasOwn(payload??{},'notes'),false)
})

test('weight autosave remains scoped to measurement id, user, and date',async()=>{
 const filters:Array<[string,unknown]> = []
 const existing={
  id:'weight-1',user_id:'user-1',log_date:'2026-09-22',weight_lbs:180,body_fat_pct:null,
  lean_mass_lbs:null,measured_at:null,source:'manual',source_ref:null,created_at:'now',updated_at:'now'
 }
 const chain={
  eq(column:string,value:unknown){filters.push([column,value]);return this},select(){return this},
  async single(){return {data:{...existing,weight_lbs:179},error:null}}
 }
 const client={from(table:string){assert.equal(table,'body_measurements');return {update(){return chain}}}} as unknown as Parameters<typeof saveBodyWeight>[0]
 await saveBodyWeight(client,{userId:'user-1',logDate:'2026-09-22',weightLbs:179,existing,isToday:true})
 assert.deepEqual(filters,[['id','weight-1'],['user_id','user-1'],['log_date','2026-09-22']])
})

test('onboarding consumer copy uses Gender once, keeps current weight in step one, and hides calorie range',()=>{
 const source=readFileSync(new URL('../app/onboarding.tsx',import.meta.url),'utf8')
 assert.match(source,/>Gender<select/)
 assert.doesNotMatch(source,/Energy estimate<select/)
 assert.equal(source.match(/>Current weight /g)?.length,1)
 assert.doesNotMatch(source,/>Range \{/)
})

test('mobile forms keep accessible zoom and 16px interactive text',()=>{
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8')
 const styles=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8')
 assert.match(layout,/width:'device-width',initialScale:1/)
 assert.doesNotMatch(layout,/maximumScale|userScalable/)
 assert.match(styles,/\.app input,.app select,.app textarea,.loginPage input,.onboardingPage input,.onboardingPage select,.settingsPanel input,.settingsPanel select\{font-size:16px!important\}/)
})

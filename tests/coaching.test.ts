import assert from 'node:assert/strict'
import test from 'node:test'
import {
 calendarWeekBounds,nextProgramWorkout,recommendedWeeklyWorkouts,strengthRecommendation
} from '../lib/coaching.ts'
import {
 getTodayWorkoutCoachingFacts,getWorkoutCoachingFacts,getWorkoutPlan,nextStructuredWorkout,setWorkoutCompletion
} from '../lib/workouts.ts'
import {PRODUCT_NAME,SITE_URL} from '../lib/site.ts'

test('exercise frequency maps to a weekly training recommendation',()=>{
 assert.equal(recommendedWeeklyWorkouts('none'),2)
 assert.equal(recommendedWeeklyWorkouts('one_to_two'),2)
 assert.equal(recommendedWeeklyWorkouts('three_to_four'),3)
 assert.equal(recommendedWeeklyWorkouts('five_plus'),3)
})

test('strength cadence separates the next workout from a recommendation for today',()=>{
 assert.equal(strengthRecommendation({logDate:'2026-09-22',weeklyTarget:2,completedThisWeek:1,lastCompletedDate:'2026-09-21'}),false)
 assert.equal(strengthRecommendation({logDate:'2026-09-23',weeklyTarget:2,completedThisWeek:1,lastCompletedDate:'2026-09-21'}),false)
 assert.equal(strengthRecommendation({logDate:'2026-09-24',weeklyTarget:2,completedThisWeek:1,lastCompletedDate:'2026-09-21'}),true)
 assert.equal(strengthRecommendation({logDate:'2026-09-22',weeklyTarget:3,completedThisWeek:1,lastCompletedDate:'2026-09-21'}),false)
 assert.equal(strengthRecommendation({logDate:'2026-09-23',weeklyTarget:3,completedThisWeek:1,lastCompletedDate:'2026-09-21'}),true)
 assert.equal(strengthRecommendation({logDate:'2026-09-24',weeklyTarget:3,completedThisWeek:3,lastCompletedDate:'2026-09-21'}),false)
})

test('completed A/B/C history determines the next workout',()=>{
 assert.equal(nextProgramWorkout(null),'full_body_a')
 assert.equal(nextProgramWorkout('full_body_a'),'full_body_b')
 assert.equal(nextProgramWorkout('full_body_b'),'full_body_c')
 assert.equal(nextProgramWorkout('full_body_c'),'full_body_a')
})

test('legacy strength history remains distinct and does not advance the A/B/C rotation',()=>{
 assert.equal(nextStructuredWorkout('legacy_strength'),'full_body_a')
 assert.equal(nextStructuredWorkout('recovery'),'full_body_a')
})

test('A/B/C rotation continues across weeks without resetting',()=>{
 const weekOne=['full_body_a',nextProgramWorkout('full_body_a')] as const
 const weekTwo=[nextProgramWorkout(weekOne[1]),nextProgramWorkout('full_body_c')] as const
 assert.deepEqual(weekOne,['full_body_a','full_body_b'])
 assert.deepEqual(weekTwo,['full_body_c','full_body_a'])
})

test('two and three session examples preserve sequence continuity',()=>{
 assert.equal(nextProgramWorkout('full_body_b'),'full_body_c')
 assert.equal(nextProgramWorkout('full_body_c'),'full_body_a')
})

test('getWorkoutPlan reads a historical legacy strength session safely',async()=>{
 const legacySession={
  id:'legacy-session',user_id:'user-123',scheduled_date:'2026-08-25',
  workout_code:'legacy_strength',status:'completed',source:'legacy',
  source_ref:'daily_logs:legacy:strength',completed_at:null,duration_minutes:null,
  notes:null,created_at:'2026-09-10T00:00:00Z',updated_at:'2026-09-10T00:00:00Z'
 }
 let queryIndex=0
 class QueryMock{
  readonly result:typeof legacySession|null
  constructor(result:typeof legacySession|null){this.result=result}
  select(){return this}
  eq(){return this}
  in(){return this}
  lt(){return this}
  order(){return this}
  limit(){return this}
  async maybeSingle(){return {data:this.result,error:null}}
 }
 const client={
  from(table:string){
   assert.equal(table,'workout_sessions')
   return new QueryMock(queryIndex++===0?legacySession:null)
  }
 } as unknown as Parameters<typeof getWorkoutPlan>[0]
 const plan=await getWorkoutPlan(client,'user-123','2026-08-25')
 assert.equal(plan.code,'legacy_strength')
 assert.equal(plan.session?.workout_code,'legacy_strength')
 assert.equal(plan.completed,true)
 assert.equal(plan.strengthOpportunity,true)
})

test('normal workout creation rejects the historical legacy code',async()=>{
 const client={from(){throw new Error('Database should not be called')}} as unknown as Parameters<typeof setWorkoutCompletion>[0]
 await assert.rejects(setWorkoutCompletion(client,{
  userId:'user-123',logDate:'2026-09-21',code:'legacy_strength',completed:true,
  session:null,isToday:true,workoutSnapshot:null
 }),/read-only/)
})

test('calendar weeks use local Monday through Sunday boundaries',()=>{
 const instant=new Date('2026-09-21T03:30:00Z')
 assert.deepEqual(calendarWeekBounds('America/Chicago',instant),{
  start:'2026-09-14',endExclusive:'2026-09-21'
 })
 assert.deepEqual(calendarWeekBounds('UTC',instant),{
  start:'2026-09-21',endExclusive:'2026-09-28'
 })
})

function coachingClient(options:{sequenceCode:'full_body_a'|'full_body_b'|'full_body_c'|null;strengthCode:'full_body_a'|'full_body_b'|'full_body_c'|'legacy_strength'|null;strengthDate:string|null;weekCount:number}){
 const filters:Array<[number,string,string,unknown]>=[]
 let queryIndex=0
 type QueryResult={data:Array<{id:string}>;error:null}
 class QueryMock implements PromiseLike<QueryResult>{
  readonly index:number
  constructor(index:number){this.index=index}
  select(){return this}
  eq(column:string,value:unknown){filters.push([this.index,'eq',column,value]);return this}
  in(column:string,value:unknown){filters.push([this.index,'in',column,value]);return this}
  lte(column:string,value:unknown){filters.push([this.index,'lte',column,value]);return this}
  gte(column:string,value:unknown){filters.push([this.index,'gte',column,value]);return this}
  lt(column:string,value:unknown){filters.push([this.index,'lt',column,value]);return this}
  order(){return this}
  limit(){return this}
  async maybeSingle(){
   if(this.index===0)return {data:options.sequenceCode?{workout_code:options.sequenceCode,scheduled_date:'2026-09-18'}:null,error:null}
   return {data:options.strengthCode&&options.strengthDate?{workout_code:options.strengthCode,scheduled_date:options.strengthDate}:null,error:null}
  }
  then<TResult1=QueryResult,TResult2=never>(
   onfulfilled?:((value:QueryResult)=>TResult1|PromiseLike<TResult1>)|null,
   _onrejected?:((reason:unknown)=>TResult2|PromiseLike<TResult2>)|null
  ):PromiseLike<TResult1|TResult2>{
   const data=Array.from({length:options.weekCount},(_,index)=>({id:`completed-${index}`}))
   return Promise.resolve({data,error:null}).then(onfulfilled)
  }
 }
 const client={
  from(table:string){
   assert.equal(table,'workout_sessions')
   return new QueryMock(queryIndex++)
  }
 } as unknown as Parameters<typeof getWorkoutCoachingFacts>[0]
 return {client,filters}
}

test('recovery, planned, and skipped records cannot advance sequence or weekly completion',async()=>{
 const {client,filters}=coachingClient({sequenceCode:null,strengthCode:null,strengthDate:null,weekCount:0})
 const facts=await getWorkoutCoachingFacts(client,'user-123','2026-09-21','2026-09-28','2026-09-24',2)
 assert.equal(nextStructuredWorkout('recovery'),'full_body_a')
 assert.equal(facts.lastCompleted,null)
 assert.equal(facts.completedThisWeek,0)
 assert.equal(filters.filter(([,operator,column,value])=>operator==='eq'&&column==='status'&&value==='completed').length,3)
 assert.equal(filters.some(([,operator,column,value])=>operator==='in'&&column==='workout_code'&&Array.isArray(value)&&value.includes('recovery')),false)
})

test('workout coaching separates A/B/C sequence from all-strength cadence history',async()=>{
 const {client,filters}=coachingClient({
  sequenceCode:'full_body_a',strengthCode:'full_body_c',strengthDate:'2026-09-19',weekCount:2
 })
 const facts=await getWorkoutCoachingFacts(client,'user-123','2026-09-14','2026-09-21','2026-09-20',2)
 assert.deepEqual(facts,{lastCompleted:'full_body_a',lastCompletedDate:'2026-09-19',completedThisWeek:2,strengthRecommended:false})
 assert.equal(nextProgramWorkout(facts.lastCompleted),'full_body_b')
 assert.equal(filters.filter(([, ,column,value])=>column==='user_id'&&value==='user-123').length,3)
 assert.equal(filters.filter(([, ,column,value])=>column==='status'&&value==='completed').length,3)
 assert.deepEqual(
  filters.filter(([,operator,column])=>operator==='in'&&column==='workout_code').map(([, , ,value])=>value),
  [
   ['full_body_a','full_body_b','full_body_c'],
   ['full_body_a','full_body_b','full_body_c','legacy_strength'],
   ['full_body_a','full_body_b','full_body_c','legacy_strength']
  ]
 )
 assert.ok(filters.some(([,operator,column,value])=>operator==='gte'&&column==='scheduled_date'&&value==='2026-09-14'))
 assert.ok(filters.some(([,operator,column,value])=>operator==='lt'&&column==='scheduled_date'&&value==='2026-09-21'))
 assert.equal(filters.filter(([,operator,column,value])=>operator==='lte'&&column==='scheduled_date'&&value==='2026-09-20').length,3)
})

test('completed Full Body C advances sequence and blocks next-day strength',async()=>{
 const {client}=coachingClient({sequenceCode:'full_body_c',strengthCode:'full_body_c',strengthDate:'2026-09-21',weekCount:1})
 const facts=await getWorkoutCoachingFacts(client,'user-123','2026-09-21','2026-09-28','2026-09-22',3)
 assert.equal(facts.lastCompleted,'full_body_c')
 assert.equal(nextProgramWorkout(facts.lastCompleted),'full_body_a')
 assert.equal(facts.lastCompletedDate,'2026-09-21')
 assert.equal(facts.strengthRecommended,false)
})

test('completed legacy strength blocks next-day strength without advancing A/B/C',async()=>{
  const {client}=coachingClient({sequenceCode:'full_body_a',strengthCode:'legacy_strength',strengthDate:'2026-09-21',weekCount:1})
  const facts=await getWorkoutCoachingFacts(client,'user-123','2026-09-21','2026-09-28','2026-09-22',3)
  assert.equal(facts.lastCompleted,'full_body_a')
  assert.equal(nextProgramWorkout(facts.lastCompleted),'full_body_b')
  assert.equal(facts.lastCompletedDate,'2026-09-21')
  assert.equal(facts.strengthRecommended,false)
})

test('weekly strength count includes completed non-A/B strength sessions',async()=>{
 const {client}=coachingClient({sequenceCode:'full_body_b',strengthCode:'legacy_strength',strengthDate:'2026-09-19',weekCount:3})
 const facts=await getWorkoutCoachingFacts(client,'user-123','2026-09-14','2026-09-21','2026-09-20',3)
 assert.equal(facts.completedThisWeek,3)
 assert.equal(facts.strengthRecommended,false)
 assert.equal(nextProgramWorkout(facts.lastCompleted),'full_body_c')
})

test('a saved profile frequency can recompute today without reloading the dashboard',async()=>{
 const now=new Date('2026-09-24T12:00:00Z')
 const twoClient=coachingClient({sequenceCode:'full_body_a',strengthCode:'full_body_a',strengthDate:'2026-09-21',weekCount:2}).client
 const threeClient=coachingClient({sequenceCode:'full_body_a',strengthCode:'full_body_a',strengthDate:'2026-09-21',weekCount:2}).client
 const two=await getTodayWorkoutCoachingFacts(twoClient,'user-123',{timezone:'UTC',exercise_frequency:'one_to_two'},now)
 const three=await getTodayWorkoutCoachingFacts(threeClient,'user-123',{timezone:'UTC',exercise_frequency:'three_to_four'},now)
 assert.equal(two.strengthRecommended,false)
 assert.equal(three.strengthRecommended,true)
 assert.equal(three.logDate,'2026-09-24')
})

test('CUT365 is canonical while dynamic goal identities remain separate',()=>{
 assert.equal(PRODUCT_NAME,'CUT365')
 assert.equal(SITE_URL,'https://cut365.app')
})

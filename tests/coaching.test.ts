import assert from 'node:assert/strict'
import test from 'node:test'
import {
 calendarWeekBounds,nextBetaWorkout,proteinGuidance,recommendedWeeklyWorkouts,
 stepsGuidance,weeklyTrainingGuidance
} from '../lib/coaching.ts'
import {getWorkoutCoachingFacts} from '../lib/workouts.ts'
import {PRODUCT_NAME,SITE_URL} from '../lib/site.ts'

test('exercise frequency maps to a weekly training recommendation',()=>{
 assert.equal(recommendedWeeklyWorkouts('none'),2)
 assert.equal(recommendedWeeklyWorkouts('one_to_two'),2)
 assert.equal(recommendedWeeklyWorkouts('three_to_four'),3)
 assert.equal(recommendedWeeklyWorkouts('five_plus'),4)
})

test('completed A/B history determines the next workout',()=>{
 assert.equal(nextBetaWorkout(null),'full_body_a')
 assert.equal(nextBetaWorkout('full_body_a'),'full_body_b')
 assert.equal(nextBetaWorkout('full_body_b'),'full_body_a')
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

test('daily step and protein guidance respects reached and incomplete states',()=>{
 assert.equal(stepsGuidance(4200,5000),"800 steps to reach today's target")
 assert.equal(stepsGuidance(5400,5000),'Step target reached')
 assert.equal(proteinGuidance({
  knownProteinG:110,proteinTargetG:145,unknownProteinEntryCount:0
 }),'35g protein remaining')
 assert.equal(proteinGuidance({
  knownProteinG:110,proteinTargetG:145,unknownProteinEntryCount:1
 }),'Protein total is incomplete today')
})

test('weekly completion uses neutral target language',()=>{
 assert.equal(weeklyTrainingGuidance(1,2),'1 of 2 workouts this week')
 assert.equal(weeklyTrainingGuidance(2,2),'Weekly training target complete')
})

test('workout coaching counts the current week and excludes incomplete sessions',async()=>{
 const filters:Array<[string,string,unknown]>=[]
 type QueryResult={data:Array<{id:string}>;error:null}
 class QueryMock implements PromiseLike<QueryResult>{
  select(){return this}
  eq(column:string,value:unknown){filters.push(['eq',column,value]);return this}
  in(column:string,value:unknown){filters.push(['in',column,value]);return this}
  lte(column:string,value:unknown){filters.push(['lte',column,value]);return this}
  gte(column:string,value:unknown){filters.push(['gte',column,value]);return this}
  lt(column:string,value:unknown){filters.push(['lt',column,value]);return this}
  order(){return this}
  limit(){return this}
  async maybeSingle(){return {data:{workout_code:'full_body_a'},error:null}}
  then<TResult1=QueryResult,TResult2=never>(
   onfulfilled?:((value:QueryResult)=>TResult1|PromiseLike<TResult1>)|null,
   _onrejected?:((reason:unknown)=>TResult2|PromiseLike<TResult2>)|null
  ):PromiseLike<TResult1|TResult2>{
   return Promise.resolve({data:[{id:'completed-session'}],error:null}).then(onfulfilled)
  }
 }
 const client={
  from(table:string){
   assert.equal(table,'workout_sessions')
   return new QueryMock()
  }
 } as unknown as Parameters<typeof getWorkoutCoachingFacts>[0]
 const facts=await getWorkoutCoachingFacts(client,'user-123','2026-09-14','2026-09-21','2026-09-20')
 assert.deepEqual(facts,{lastCompleted:'full_body_a',completedThisWeek:1})
 assert.equal(filters.filter(([,column,value])=>column==='user_id'&&value==='user-123').length,2)
 assert.equal(filters.filter(([,column,value])=>column==='status'&&value==='completed').length,2)
 assert.ok(filters.some(([operator,column,value])=>operator==='gte'&&column==='scheduled_date'&&value==='2026-09-14'))
 assert.ok(filters.some(([operator,column,value])=>operator==='lt'&&column==='scheduled_date'&&value==='2026-09-21'))
 assert.equal(filters.filter(([operator,column,value])=>operator==='lte'&&column==='scheduled_date'&&value==='2026-09-20').length,2)
})

test('CUT365 is canonical while dynamic goal identities remain separate',()=>{
 assert.equal(PRODUCT_NAME,'CUT365')
 assert.equal(SITE_URL,'https://cut365.app')
})

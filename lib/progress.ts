import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getBodyMeasurementsRange,type BodyMeasurement} from './body-measurements.ts'
import {getDailyMetricsRange,type DailyMetrics} from './daily-metrics.ts'
import {getGoalTargetsForRange,type GoalTarget} from './goals.ts'
import {getNutritionTotalsRange,type DailyNutritionTotals} from './nutrition.ts'
import {primaryCalorieTarget,shiftCalendarDate} from './targets.ts'
import {getWorkoutSessionsRange,type WorkoutSession} from './workouts.ts'

type TypedSupabaseClient=SupabaseClient<Database>
export type TrackingView='day'|'week'|'month'
export type PeriodBounds={start:string;endExclusive:string}
export type ChartPoint={date:string;value:number}
export type PeriodProgress={
 bounds:PeriodBounds
 weights:BodyMeasurement[]
 nutrition:DailyNutritionTotals[]
 metrics:DailyMetrics[]
 workouts:WorkoutSession[]
 targets:GoalTarget[]
}

const dateParts=(iso:string)=>iso.split('-').map(Number) as [number,number,number]
const utcISO=(year:number,month:number,day:number)=>new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)

export function weekBoundsForDate(logDate:string):PeriodBounds{
 const [year,month,day]=dateParts(logDate)
 const weekday=new Date(Date.UTC(year,month-1,day)).getUTCDay()
 const start=shiftCalendarDate(logDate,-((weekday+6)%7))
 return {start,endExclusive:shiftCalendarDate(start,7)}
}

export function monthBoundsForDate(logDate:string):PeriodBounds{
 const [year,month]=dateParts(logDate)
 return {start:utcISO(year,month,1),endExclusive:utcISO(year,month+1,1)}
}

export function periodBounds(view:Exclude<TrackingView,'day'>,anchorDate:string){
 return view==='week'?weekBoundsForDate(anchorDate):monthBoundsForDate(anchorDate)
}

export function shiftPeriodAnchor(view:Exclude<TrackingView,'day'>,anchorDate:string,amount:number){
 if(view==='week')return shiftCalendarDate(anchorDate,amount*7)
 const [year,month]=dateParts(anchorDate)
 return utcISO(year,month+amount,1)
}

export function canNavigateToPeriod(view:Exclude<TrackingView,'day'>,anchorDate:string,today:string){
 return periodBounds(view,anchorDate).start<=periodBounds(view,today).start
}

export function targetForDate(targets:GoalTarget[],logDate:string){
 return [...targets].reverse().find(target=>
  target.effective_from<=logDate&&(target.effective_to===null||logDate<target.effective_to)
 )??null
}

const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null

export function chartPositions(points:ChartPoint[],width=320,height=92,padding=10){
 if(points.length===0)return []
 const values=points.map(point=>point.value)
 const minimum=Math.min(...values),maximum=Math.max(...values)
 const span=maximum-minimum||1
 return points.map((point,index)=>({
  ...point,
  x:points.length===1?width/2:padding+index*(width-padding*2)/(points.length-1),
  y:height-padding-(point.value-minimum)*(height-padding*2)/span
 }))
}

export function summarizePeriod(progress:PeriodProgress){
 const weights=[...progress.weights].sort((a,b)=>a.log_date.localeCompare(b.log_date))
 const nutrition=progress.nutrition.filter(day=>day.entry_count>0)
 const steps=progress.metrics.filter(day=>day.steps!==null)
 const completed=progress.workouts.filter(workout=>workout.status==='completed')
 const strengthCodes=new Set(['full_body_a','full_body_b','full_body_c','legacy_strength','custom_strength'])
 const targetComparisons=nutrition.map(day=>{
  const target=targetForDate(progress.targets,day.log_date)
  return {
   logDate:day.log_date,
   calorieTarget:target?primaryCalorieTarget(target.calorie_target_min,target.calorie_target_max):null,
   proteinTarget:target?.protein_target_g??null
  }
 })
 return {
  firstWeight:weights[0]?.weight_lbs??null,
  latestWeight:weights.at(-1)?.weight_lbs??null,
  weightChange:weights.length>=2?weights.at(-1)!.weight_lbs-weights[0].weight_lbs:null,
  weightSampleCount:weights.length,
  averageCalories:average(nutrition.flatMap(day=>day.calories===null?[]:[day.calories])),
  averageProtein:average(nutrition.flatMap(day=>day.protein_g===null?[]:[day.protein_g])),
  nutritionLoggedDays:nutrition.length,
  averageSteps:average(steps.map(day=>day.steps!)),
  stepsLoggedDays:steps.length,
  completedWorkouts:completed.length,
  completedStrength:completed.filter(workout=>strengthCodes.has(workout.workout_code)).length,
  averageCalorieTarget:average(targetComparisons.flatMap(day=>day.calorieTarget===null?[]:[day.calorieTarget])),
  averageProteinTarget:average(targetComparisons.flatMap(day=>day.proteinTarget===null?[]:[day.proteinTarget]))
 }
}

export async function getPeriodProgress(client:TypedSupabaseClient,input:{
 userId:string;goalId:string;view:Exclude<TrackingView,'day'>;anchorDate:string
}):Promise<PeriodProgress>{
 const bounds=periodBounds(input.view,input.anchorDate)
 const [weights,nutrition,metrics,workouts,targets]=await Promise.all([
  getBodyMeasurementsRange(client,input.userId,bounds.start,bounds.endExclusive),
  getNutritionTotalsRange(client,input.userId,bounds.start,bounds.endExclusive),
  getDailyMetricsRange(client,input.userId,bounds.start,bounds.endExclusive),
  getWorkoutSessionsRange(client,input.userId,bounds.start,bounds.endExclusive),
  getGoalTargetsForRange(client,input.userId,input.goalId,bounds.start,bounds.endExclusive)
 ])
 return {bounds,weights,nutrition,metrics,workouts,targets}
}

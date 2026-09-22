import type {ExerciseFrequency} from './profile.ts'
import type {StructuredWorkoutCode} from './workouts.ts'
import {calendarDateInTimezone,shiftCalendarDate} from './targets.ts'

export type BetaWorkoutCode=Extract<StructuredWorkoutCode,'full_body_a'|'full_body_b'>

export function recommendedWeeklyWorkouts(frequency:ExerciseFrequency){
 if(frequency==='three_to_four')return 3
 if(frequency==='five_plus')return 4
 return 2
}

export function nextBetaWorkout(lastCompleted:BetaWorkoutCode|null):BetaWorkoutCode{
 return lastCompleted==='full_body_a'?'full_body_b':'full_body_a'
}

export function calendarWeekBounds(timezone:string,date=new Date()){
 const today=calendarDateInTimezone(timezone,date)
 const [year,month,day]=today.split('-').map(Number)
 const weekday=new Date(Date.UTC(year,month-1,day)).getUTCDay()
 const mondayOffset=(weekday+6)%7
 const start=shiftCalendarDate(today,-mondayOffset)
 return {start,endExclusive:shiftCalendarDate(start,7)}
}

export function stepsGuidance(steps:number|null,target:number){
 const remaining=Math.max(target-(steps??0),0)
 return remaining===0?'Step target reached':`${remaining.toLocaleString()} steps to reach today's target`
}

export function proteinGuidance(input:{
 knownProteinG:number|null
 proteinTargetG:number
 unknownProteinEntryCount:number
}){
 if(input.unknownProteinEntryCount>0)return 'Protein total is incomplete today'
 const remaining=Math.max(input.proteinTargetG-(input.knownProteinG??0),0)
 return remaining===0?'Protein target reached':`${remaining.toLocaleString()}g protein remaining`
}

export function weeklyTrainingGuidance(completed:number,target:number){
 return completed>=target
  ?'Weekly training target complete'
  :`${completed} of ${target} workouts this week`
}

export function workoutName(code:BetaWorkoutCode){
 return code==='full_body_a'?'Full Body A':'Full Body B'
}

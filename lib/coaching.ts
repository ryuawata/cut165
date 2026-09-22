import type {ExerciseFrequency} from './profile.ts'
import type {StructuredWorkoutCode} from './workouts.ts'
import {calendarDateInTimezone,shiftCalendarDate} from './targets.ts'

export type BetaWorkoutCode=Extract<StructuredWorkoutCode,'full_body_a'|'full_body_b'>

export function recommendedWeeklyWorkouts(frequency:ExerciseFrequency){
 if(frequency==='three_to_four')return 3
 if(frequency==='five_plus')return 3
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

function calendarDayDistance(from:string,to:string){
 const parse=(value:string)=>{
  const [year,month,day]=value.split('-').map(Number)
  return Date.UTC(year,month-1,day)
 }
 return Math.floor((parse(to)-parse(from))/86400000)
}

export function strengthRecommendation(input:{
 logDate:string
 weeklyTarget:number
 completedThisWeek:number
 lastCompletedDate:string|null
}){
 if(input.completedThisWeek>=input.weeklyTarget)return false
 if(!input.lastCompletedDate)return true
 const minimumCalendarGap=input.weeklyTarget<=2?3:2
 return calendarDayDistance(input.lastCompletedDate,input.logDate)>=minimumCalendarGap
}

export function workoutName(code:BetaWorkoutCode){
 return code==='full_body_a'?'Full Body A':'Full Body B'
}

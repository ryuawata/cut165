import type {Goal,GoalTarget,GoalTargetSource} from './goals'

export type GoalTargetRequest={
 goalId:string
 effectiveFrom:string
 targetWeightLbs:number
 targetDate:string|null
 stepsTarget:number
 source:Extract<GoalTargetSource,'onboarding'|'manual'>
}

type GoalTargetResponse={goal:Goal;target:GoalTarget}

export async function createGoalTargetVersion(
 accessToken:string,input:GoalTargetRequest
):Promise<GoalTargetResponse>{
 const response=await fetch('/api/goal-targets',{
  method:'POST',
  headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},
  body:JSON.stringify(input)
 })
 const body:unknown=await response.json().catch(()=>null)
 if(!response.ok){
  const message=body&&typeof body==='object'&&'error' in body&&typeof body.error==='string'
   ?body.error
   :'Could not update goal targets.'
  throw new Error(message)
 }
 if(!body||typeof body!=='object'||!('goal' in body)||!('target' in body)){
  throw new Error('Goal-target response was incomplete.')
 }
 return body as GoalTargetResponse
}

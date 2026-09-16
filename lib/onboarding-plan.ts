import type {GoalType,GoalTargetSource} from './goals'

export type GoalChoice='cut'|'maintain'|'build'

export function goalTypeForChoice(choice:GoalChoice):GoalType{
 return choice==='build'?'bulk':choice
}

export function onboardingTargetValues(input:{
 goalType:GoalType
 currentWeightLbs:number
 targetWeightLbs:number
 targetDate:string|null
}){
 return input.goalType==='maintain'
  ?{targetWeightLbs:input.currentWeightLbs,targetDate:null}
  :{targetWeightLbs:input.targetWeightLbs,targetDate:input.targetDate}
}

export function reuseOnboardingTarget(source:GoalTargetSource|null){
 return source==='onboarding'
}

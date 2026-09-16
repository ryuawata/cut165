import type {GoalType,Goal,GoalTarget} from './goals'
import type {CalculatedTargets} from './targets'

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

export function matchesOnboardingPlan(input:{
 goal:Goal
 target:GoalTarget|null
 goalType:GoalType
 startWeightLbs:number
 targetWeightLbs:number
 startDate:string
 targetDate:string|null
 plan:CalculatedTargets
}){
 const {goal,target,goalType,startWeightLbs,targetWeightLbs,startDate,targetDate,plan}=input
 const sameWeight=(actual:number,expected:number)=>Math.abs(actual-expected)<.011
 return goal.goal_type===goalType
  &&sameWeight(goal.start_weight_lbs,startWeightLbs)
  &&sameWeight(goal.target_weight_lbs,targetWeightLbs)
  &&goal.start_date===startDate
  &&goal.target_date===targetDate
  &&(!target||(
   target.source==='onboarding'
   &&target.effective_from===startDate
   &&target.effective_to===null
   &&target.calorie_target_min===plan.calorieTargetMin
   &&target.calorie_target_max===plan.calorieTargetMax
   &&target.protein_target_g===plan.proteinTargetG
   &&target.carb_target_g===plan.carbTargetG
   &&target.steps_target===plan.stepsTarget
   &&target.water_target_oz===plan.waterTargetOz
   &&target.weekly_weight_change_target_lbs===plan.weeklyWeightChangeTargetLbs
  ))
}

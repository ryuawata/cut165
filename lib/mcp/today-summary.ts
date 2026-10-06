import {getProfile} from '../profile.ts'
import {getActiveGoal,getEffectiveGoalTarget} from '../goals.ts'
import {getDailyMetrics} from '../daily-metrics.ts'
import {getBodyMeasurement} from '../body-measurements.ts'
import {getDailyNutritionTotals} from '../nutrition.ts'
import {getWorkoutPlan,getTodayWorkoutCoachingFacts,resolveWorkoutDisplayState} from '../workouts.ts'
import {calendarDateInTimezone,primaryCalorieTarget} from '../targets.ts'
import type {McpContext} from './context.ts'

// Composition only: date, targets, totals and cadence remain owned by domain services.
export async function getTodaySummary({client,userId}:McpContext,now=new Date()){
 const profile=await getProfile(client,userId)
 if(!profile)return {status:'profile_required',date:null}
 const date=calendarDateInTimezone(profile.timezone,now)
 const [goal,metrics,weight,nutrition,plan,facts]=await Promise.all([
  getActiveGoal(client,userId),getDailyMetrics(client,userId,date),
  getBodyMeasurement(client,userId,date),getDailyNutritionTotals(client,userId,date),
  getWorkoutPlan(client,userId,date),getTodayWorkoutCoachingFacts(client,userId,profile,now)
 ])
 const target=goal?await getEffectiveGoalTarget(client,userId,goal.id,date):null
 const {user_id: _userId,...totals}=nutrition
 return {
  status:'ok',date,timezone:profile.timezone,
  goal:goal?{type:goal.goal_type,target_weight_lbs:goal.target_weight_lbs,target_date:goal.target_date}:null,
  targets:target?{
   calories:primaryCalorieTarget(target.calorie_target_min,target.calorie_target_max),
   calorie_min:target.calorie_target_min,calorie_max:target.calorie_target_max,
   protein_g:target.protein_target_g,carbs_g:target.carb_target_g,
   steps:target.steps_target,water_oz:target.water_target_oz
  }:null,
  nutrition:totals,
  steps:metrics.steps,water_oz:metrics.water_oz,weight_lbs:weight?.weight_lbs??null,
  training:{display:resolveWorkoutDisplayState(plan,facts),code:plan.code,completed:plan.completed,
   strength_recommended:facts.strengthRecommended,completed_strength_this_week:facts.completedThisWeek}
 }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import {goalTypeForChoice,onboardingTargetValues,matchesOnboardingPlan} from '../lib/onboarding-plan.ts'
import {calculateInitialTargets,recommendedSteps,resolveSafeTargetDate} from '../lib/targets.ts'
import {decideAccountBootstrap} from '../lib/account-bootstrap.ts'

const base={
 birthYear:1985,sex:'male' as const,heightInches:70,
 currentWeightLbs:180,targetWeightLbs:165,
 goalType:'cut' as const,activityLevel:'light' as const,
 stepsTarget:7000,targetDate:null,effectiveDate:'2026-09-16'
}

test('Cut onboarding calculates a usable primary target and a secondary range',()=>{
 const targets=calculateInitialTargets(base)
 assert.ok(targets.primaryCalorieTarget>=targets.calorieTargetMin)
 assert.ok(targets.primaryCalorieTarget<=targets.calorieTargetMax)
 assert.ok(targets.maintenanceCalories>targets.primaryCalorieTarget)
 assert.ok(targets.proteinTargetG>0)
})

test('Maintain ignores target weight and date, while Build maps to bulk',()=>{
 assert.equal(goalTypeForChoice('build'),'bulk')
 const values=onboardingTargetValues({
  goalType:'maintain',currentWeightLbs:180,targetWeightLbs:130,targetDate:'2026-09-20'
 })
 assert.deepEqual(values,{targetWeightLbs:180,targetDate:null})
 const targets=calculateInitialTargets({...base,...values,goalType:'maintain'})
 assert.equal(targets.weeklyWeightChangeTargetLbs,0)
 const build=calculateInitialTargets({...base,goalType:goalTypeForChoice('build'),targetWeightLbs:195})
 assert.ok(build.weeklyWeightChangeTargetLbs>0)
})

test('exercise frequency is excluded from calorie estimation',()=>{
 const none={...base,exerciseFrequency:'none'}
 const frequent={...base,exerciseFrequency:'five_plus'}
 assert.deepEqual(calculateInitialTargets(none),calculateInitialTargets(frequent))
})

test('activity levels have deterministic step recommendations',()=>{
 assert.equal(recommendedSteps('sedentary'),5000)
 assert.equal(recommendedSteps('light'),7000)
 assert.equal(recommendedSteps('moderate'),8000)
 assert.equal(recommendedSteps('very_active'),10000)
})

test('edited water and steps are retained in the calculated onboarding plan',()=>{
 const targets=calculateInitialTargets({...base,stepsTarget:9300,waterTargetOz:95})
 assert.equal(targets.stepsTarget,9300)
 assert.equal(targets.waterTargetOz,95)
})

test('aggressive target dates move to the fastest safe recommendation',()=>{
 const pace=resolveSafeTargetDate({...base,targetDate:'2026-09-20'})
 assert.equal(pace.paceWarning,true)
 assert.ok(pace.targetDate&&pace.targetDate>'2026-09-20')
 const targets=calculateInitialTargets({...base,targetDate:pace.targetDate})
 assert.ok(Math.abs(targets.weeklyWeightChangeTargetLbs)<=1.5)
})

test('an interrupted onboarding reuses only the plan shown in the preview',()=>{
 const plan=calculateInitialTargets(base)
 const goal={
  goal_type:'cut',start_weight_lbs:180,target_weight_lbs:165,
  start_date:base.effectiveDate,target_date:null
 } as Parameters<typeof matchesOnboardingPlan>[0]['goal']
 const target={
  source:'onboarding',effective_from:base.effectiveDate,effective_to:null,
  calorie_target_min:plan.calorieTargetMin,calorie_target_max:plan.calorieTargetMax,
  protein_target_g:plan.proteinTargetG,carb_target_g:plan.carbTargetG,
  steps_target:plan.stepsTarget,water_target_oz:plan.waterTargetOz,
  weekly_weight_change_target_lbs:plan.weeklyWeightChangeTargetLbs
 } as Parameters<typeof matchesOnboardingPlan>[0]['target']
 const input={goal,target,goalType:'cut' as const,startWeightLbs:180,
  targetWeightLbs:165,startDate:base.effectiveDate,targetDate:null,plan}
 assert.equal(matchesOnboardingPlan(input),true)
 assert.equal(matchesOnboardingPlan({...input,target:null}),true)
 assert.equal(matchesOnboardingPlan({...input,goalType:'bulk'}),false)
 assert.equal(matchesOnboardingPlan({...input,startWeightLbs:185}),false)
 assert.equal(matchesOnboardingPlan({...input,targetDate:'2026-12-01'}),false)
 assert.equal(matchesOnboardingPlan({...input,plan:{...plan,stepsTarget:9300}}),false)
 assert.equal(matchesOnboardingPlan({...input,plan:{...plan,waterTargetOz:95}}),false)
 assert.equal(matchesOnboardingPlan({...input,target:{...target!,source:'legacy'}}),false)
})

test('legacy CUT165 compatibility still bypasses new-user onboarding',()=>{
 assert.equal(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,currentTargetIsLegacy:true,
  onboardingComplete:false,hasCalculationProfile:false
 }).status,'dashboard')
})

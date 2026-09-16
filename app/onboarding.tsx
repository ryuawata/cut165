'use client'
import {FormEvent,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../lib/supabase'
import {getBodyMeasurement,saveBodyWeight} from '../lib/body-measurements'
import {createInitialGoal,getEffectiveGoalTarget,type Goal,type GoalTarget} from '../lib/goals'
import {createGoalTargetVersion} from '../lib/goal-target-api'
import {completeProfileOnboarding,saveProfile,type ActivityLevel,type EnergyEstimationSex,type ExerciseFrequency,type Profile,type WeightUnit} from '../lib/profile'
import {calculateInitialTargets,calendarDateInTimezone,kilogramsToPounds,recommendedSteps,recommendedWaterOz,resolveSafeTargetDate} from '../lib/targets'
import {goalTypeForChoice,onboardingTargetValues,reuseOnboardingTarget,type GoalChoice} from '../lib/onboarding-plan'

export type AccountSetup={profile:Profile;goal:Goal;target:GoalTarget}
const detectedTimezone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'
const errorText=(error:unknown)=>error instanceof Error?error.message:'Could not complete onboarding.'

export default function Onboarding({session,onComplete}:{session:Session;onComplete:(setup:AccountSetup)=>void}){
 const [step,setStep]=useState(1)
 const [displayName,setDisplayName]=useState('')
 const [birthYear,setBirthYear]=useState('')
 const [sex,setSex]=useState<''|EnergyEstimationSex>('')
 const [height,setHeight]=useState('')
 const [timezone,setTimezone]=useState(detectedTimezone)
 const [weightUnit,setWeightUnit]=useState<WeightUnit>('lb')
 const [currentWeight,setCurrentWeight]=useState('')
 const [goalChoice,setGoalChoice]=useState<GoalChoice>('cut')
 const goalType=goalTypeForChoice(goalChoice)
 const [targetWeight,setTargetWeight]=useState('')
 const [targetDate,setTargetDate]=useState('')
 const [activityLevel,setActivityLevel]=useState<ActivityLevel>('light')
 const [exerciseFrequency,setExerciseFrequency]=useState<ExerciseFrequency>('none')
 const [stepsTarget,setStepsTarget]=useState(String(recommendedSteps('light')))
 const [stepsCustomized,setStepsCustomized]=useState(false)
 const [waterTarget,setWaterTarget]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const unitLabel=weightUnit==='lb'?'lb':'kg'
 const parsed=useMemo(()=>{
  const current=Number(currentWeight)
  const target=goalType==='maintain'?current:Number(targetWeight)
  return {
   birthYear:Number(birthYear),heightInches:Number(height),
   currentWeightLbs:weightUnit==='kg'?kilogramsToPounds(current):current,
   targetWeightLbs:weightUnit==='kg'?kilogramsToPounds(target):target,
   stepsTarget:Number(stepsTarget),
   waterTargetOz:waterTarget.trim()===''?undefined:Number(waterTarget)
  }
 },[birthYear,height,currentWeight,targetWeight,stepsTarget,waterTarget,weightUnit,goalType])
 const preview=useMemo(()=>{
  if(!sex||!currentWeight||!birthYear||!height||(goalType!=='maintain'&&!targetWeight))return null
  try{
   const goalValues=onboardingTargetValues({
    goalType,currentWeightLbs:parsed.currentWeightLbs,
    targetWeightLbs:parsed.targetWeightLbs,targetDate:targetDate||null
   })
   const input={...parsed,...goalValues,sex,goalType,activityLevel,
    targetDate:goalValues.targetDate,
    effectiveDate:calendarDateInTimezone(timezone)}
   const pace=resolveSafeTargetDate(input)
   return {pace,targets:calculateInitialTargets({...input,targetDate:pace.targetDate})}
  }catch{return null}
 },[parsed,sex,goalType,activityLevel,targetDate,timezone,currentWeight,birthYear,height,targetWeight])

 function next(event:FormEvent){
  event.preventDefault()
  setError('')
  try{
   if(step===1){
    if(!sex)throw new Error('Choose the option used for energy estimation.')
    const currentYear=new Date().getFullYear()
    if(!Number.isInteger(parsed.birthYear)||parsed.birthYear<1900||parsed.birthYear>currentYear-18)throw new Error('Enter a valid adult birth year.')
    if(!Number.isFinite(parsed.heightInches)||parsed.heightInches<48||parsed.heightInches>96)throw new Error('Height must be between 48 and 96 inches.')
    if(!Number.isFinite(parsed.currentWeightLbs)||parsed.currentWeightLbs<75||parsed.currentWeightLbs>700)throw new Error('Current weight must be between 75 and 700 lb.')
    new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format()
   }
   if(step===2&&!preview)throw new Error('Enter a valid goal and target weight to see your starting plan.')
   setStep(current=>Math.min(3,current+1))
  }catch(nextError){setError(errorText(nextError))}
 }

 async function finish(event:FormEvent){
  event.preventDefault()
  if(busy||!sex)return
  setBusy(true)
  setError('')
  try{
   const effectiveDate=calendarDateInTimezone(timezone)
   const goalValues=onboardingTargetValues({
    goalType,currentWeightLbs:parsed.currentWeightLbs,
    targetWeightLbs:parsed.targetWeightLbs,targetDate:targetDate||null
   })
   const input={...parsed,...goalValues,sex,goalType,activityLevel,effectiveDate}
   const pace=resolveSafeTargetDate(input)
   const plan=calculateInitialTargets({...input,targetDate:pace.targetDate})
   await saveProfile(supabase,session.user.id,{
    displayName:displayName||null,birthYear:parsed.birthYear,energyEstimationSex:sex,
    heightInches:parsed.heightInches,timezone,weightUnit,activityLevel,
    exerciseFrequency,onboardingComplete:false
   })
   const existingMeasurement=await getBodyMeasurement(supabase,session.user.id,effectiveDate)
   await saveBodyWeight(supabase,{
    userId:session.user.id,logDate:effectiveDate,weightLbs:parsed.currentWeightLbs,
    existing:existingMeasurement,isToday:true
   })
   const goal=await createInitialGoal(supabase,{
    userId:session.user.id,goalType,startWeightLbs:parsed.currentWeightLbs,
    targetWeightLbs:parsed.targetWeightLbs,startDate:effectiveDate,targetDate:pace.targetDate
   })
   const existingTarget=await getEffectiveGoalTarget(supabase,session.user.id,goal.id,effectiveDate)
   const result=reuseOnboardingTarget(existingTarget?.source??null)&&existingTarget
    ?{goal,target:existingTarget}
    :await createGoalTargetVersion(session.access_token,{
     goalId:goal.id,effectiveFrom:effectiveDate,targetWeightLbs:parsed.targetWeightLbs,
     targetDate:pace.targetDate,stepsTarget:plan.stepsTarget,
     waterTargetOz:plan.waterTargetOz,source:'onboarding'
    })
   const completedProfile=await completeProfileOnboarding(supabase,session.user.id)
   onComplete({profile:completedProfile,goal:result.goal,target:result.target})
  }catch(finishError){setError(errorText(finishError))}
  finally{setBusy(false)}
 }

 return <main className="onboardingPage">
  <header><div className="masterBrand">CUT365</div><span>STEP {step} OF 3</span></header>
  <section className="onboardingCard">
   <p className="eyebrow">PERSONAL SETUP</p>
   {step===1&&<form onSubmit={next}>
    <h1>About you</h1><p>Just enough context to estimate a practical starting range.</p>
    <div className="formGrid">
     <label className="wide">Name <small>optional</small><input value={displayName} onChange={event=>setDisplayName(event.target.value)} placeholder="First name"/></label>
     <label>Birth year<input type="number" min="1900" max={new Date().getFullYear()-18} value={birthYear} onChange={event=>setBirthYear(event.target.value)} required/></label>
     <label>Energy estimate<select value={sex} onChange={event=>setSex(event.target.value as ''|EnergyEstimationSex)} required><option value="">Choose</option><option value="female">Female</option><option value="male">Male</option></select></label>
     <label>Height <small>inches</small><input type="number" min="48" max="96" step=".1" value={height} onChange={event=>setHeight(event.target.value)} required/></label>
     <label>Weight unit<select value={weightUnit} onChange={event=>setWeightUnit(event.target.value as WeightUnit)}><option value="lb">Pounds</option><option value="kg">Kilograms</option></select></label>
     <label>Current weight <small>{unitLabel}</small><input type="number" min="1" step=".1" value={currentWeight} onChange={event=>setCurrentWeight(event.target.value)} required/></label>
     <label className="wide">Timezone<input value={timezone} onChange={event=>setTimezone(event.target.value)} required/></label>
    </div>
    <button className="primaryAction">Continue <b>→</b></button>
   </form>}
   {step===2&&<form onSubmit={next}>
    <h1>Your goal</h1><p>This can change later without erasing your history.</p>
    <div className="formGrid">
     <label>Current weight <small>{unitLabel}</small><input type="number" min="1" step=".1" value={currentWeight} onChange={event=>setCurrentWeight(event.target.value)} required/></label>
     <label>Goal type<select value={goalChoice} onChange={event=>setGoalChoice(event.target.value as GoalChoice)}><option value="cut">Cut</option><option value="maintain">Maintain</option><option value="build">Build</option></select></label>
     {goalType!=='maintain'&&<><label>Target weight <small>{unitLabel}</small><input type="number" min="1" step=".1" value={targetWeight} onChange={event=>setTargetWeight(event.target.value)} required/></label>
     <label>Target date <small>optional</small><input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)}/></label></>}
    </div>
    {preview?.pace.paceWarning&&<p className="paceWarning" role="status">That date asks for a faster pace than recommended. We’ll use the fastest safe recommendation: {preview.pace.targetDate}.</p>}
    <div className="formActions"><button type="button" className="quietAction" onClick={()=>setStep(1)}>Back</button><button className="primaryAction">Continue <b>→</b></button></div>
   </form>}
   {step===3&&<form onSubmit={finish}>
    <h1>Lifestyle</h1><p>Choose an honest baseline. You can adjust these starting targets.</p>
    <div className="formGrid">
     <label className="wide">Usual activity<select value={activityLevel} onChange={event=>{const level=event.target.value as ActivityLevel;setActivityLevel(level);if(!stepsCustomized)setStepsTarget(String(recommendedSteps(level)))}}><option value="sedentary">Mostly seated</option><option value="light">Lightly active</option><option value="moderate">Moderately active</option><option value="very_active">Very active</option></select></label>
     <label className="wide">Exercise frequency<select value={exerciseFrequency} onChange={event=>setExerciseFrequency(event.target.value as ExerciseFrequency)}><option value="none">None</option><option value="one_to_two">1–2 days/week</option><option value="three_to_four">3–4 days/week</option><option value="five_plus">5+ days/week</option></select></label>
     <label>Daily step target <small>Recommended {recommendedSteps(activityLevel).toLocaleString()}</small><input type="number" min="1000" max="100000" step="1" value={stepsTarget} onChange={event=>{setStepsTarget(event.target.value);setStepsCustomized(true)}} required/></label>
     <label>Daily water target <small>oz · recommended {currentWeight?recommendedWaterOz(parsed.currentWeightLbs):'—'}</small><input type="number" min="1" max="500" step="1" placeholder={currentWeight?String(recommendedWaterOz(parsed.currentWeightLbs)):''} value={waterTarget} onChange={event=>setWaterTarget(event.target.value)}/></label>
    </div>
    {preview?.pace.paceWarning&&<p className="paceWarning" role="status">Your requested date is faster than recommended. This plan uses {preview.pace.targetDate}, the fastest date within the safe pace.</p>}
    {preview&&<div className="onboardingPreview"><p className="eyebrow">YOUR STARTING PLAN</p><strong>{preview.targets.primaryCalorieTarget.toLocaleString()} <small>kcal/day</small></strong><p>Range {preview.targets.calorieTargetMin.toLocaleString()}–{preview.targets.calorieTargetMax.toLocaleString()} kcal · {preview.targets.proteinTargetG}g protein</p><p>{preview.targets.stepsTarget.toLocaleString()} steps · {preview.targets.waterTargetOz} oz water</p><p>Estimated maintenance: {preview.targets.maintenanceCalories.toLocaleString()} kcal/day</p><details><summary>How we calculated this</summary><p>Maintenance is estimated from your age, height, weight, and activity. Calorie and protein targets are adjusted for your goal. Exercise frequency is saved for future training guidance, not included in this calorie estimate.</p></details></div>}
    <p className="onboardingDisclaimer">CUT365 offers fitness-coach-style guidance based on what you enter. It is not medical advice or a replacement for a qualified healthcare professional.</p>
    <div className="formActions"><button type="button" className="quietAction" onClick={()=>setStep(2)} disabled={busy}>Back</button><button className="primaryAction" disabled={busy}>{busy?'Building your plan…':'Start CUT365'} <b>→</b></button></div>
   </form>}
   {error&&<p className="formError" role="alert">{error}</p>}
  </section>
 </main>
}

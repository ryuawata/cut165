'use client'
import {FormEvent,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../lib/supabase'
import {getBodyMeasurement,saveBodyWeight} from '../lib/body-measurements'
import {createInitialGoal,type Goal,type GoalTarget,type GoalType} from '../lib/goals'
import {createGoalTargetVersion} from '../lib/goal-target-api'
import {completeProfileOnboarding,saveProfile,type ActivityLevel,type EnergyEstimationSex,type Profile,type WeightUnit} from '../lib/profile'
import {calculateInitialTargets,calendarDateInTimezone,kilogramsToPounds} from '../lib/targets'

export type AccountSetup={profile:Profile;goal:Goal;target:GoalTarget}

const detectedTimezone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'
const errorText=(error:unknown)=>error instanceof Error?error.message:'Could not complete onboarding.'

export default function Onboarding({session,onComplete}:{
 session:Session
 onComplete:(setup:AccountSetup)=>void
}){
 const [step,setStep]=useState(1)
 const [displayName,setDisplayName]=useState('')
 const [birthYear,setBirthYear]=useState('')
 const [sex,setSex]=useState<''|EnergyEstimationSex>('')
 const [height,setHeight]=useState('')
 const [timezone,setTimezone]=useState(detectedTimezone)
 const [weightUnit,setWeightUnit]=useState<WeightUnit>('lb')
 const [currentWeight,setCurrentWeight]=useState('')
 const [goalType,setGoalType]=useState<GoalType>('cut')
 const [targetWeight,setTargetWeight]=useState('')
 const [targetDate,setTargetDate]=useState('')
 const [activityLevel,setActivityLevel]=useState<ActivityLevel>('light')
 const [stepsTarget,setStepsTarget]=useState('7000')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')

 const unitLabel=weightUnit==='lb'?'lb':'kg'
 const parsed=useMemo(()=>{
  const current=Number(currentWeight)
  const target=Number(targetWeight)
  return {
   birthYear:Number(birthYear),
   heightInches:Number(height),
   currentWeightLbs:weightUnit==='kg'?kilogramsToPounds(current):current,
   targetWeightLbs:weightUnit==='kg'?kilogramsToPounds(target):target,
   stepsTarget:Number(stepsTarget)
  }
 },[birthYear,height,currentWeight,targetWeight,stepsTarget,weightUnit])

 function next(event:FormEvent){
  event.preventDefault()
  setError('')
  try{
   if(step===1){
    if(!sex)throw new Error('Choose the option used for energy estimation.')
    const currentYear=new Date().getFullYear()
    if(!Number.isInteger(parsed.birthYear)||parsed.birthYear<1900||parsed.birthYear>currentYear-18)throw new Error('Enter a valid adult birth year.')
    if(!Number.isFinite(parsed.heightInches)||parsed.heightInches<48||parsed.heightInches>96)throw new Error('Height must be between 48 and 96 inches.')
    new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format()
   }
   if(step===2&&sex){
    calculateInitialTargets({
     ...parsed,sex,goalType,activityLevel,
     targetDate:targetDate||null,effectiveDate:calendarDateInTimezone(timezone)
    })
   }
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
   calculateInitialTargets({
    ...parsed,sex,goalType,activityLevel,
    targetDate:targetDate||null,effectiveDate
   })
   const profile=await saveProfile(supabase,session.user.id,{
    displayName:displayName||null,
    birthYear:parsed.birthYear,
    energyEstimationSex:sex,
    heightInches:parsed.heightInches,
    timezone,
    weightUnit,
    activityLevel,
    onboardingComplete:false
   })
   const existingMeasurement=await getBodyMeasurement(supabase,session.user.id,effectiveDate)
   await saveBodyWeight(supabase,{
    userId:session.user.id,logDate:effectiveDate,weightLbs:parsed.currentWeightLbs,
    existing:existingMeasurement,isToday:true
   })
   const goal=await createInitialGoal(supabase,{
    userId:session.user.id,
    goalType,
    startWeightLbs:parsed.currentWeightLbs,
    targetWeightLbs:parsed.targetWeightLbs,
    startDate:effectiveDate,
    targetDate:targetDate||null
   })
   const result=await createGoalTargetVersion(session.access_token,{
    goalId:goal.id,
    effectiveFrom:effectiveDate,
    targetWeightLbs:parsed.targetWeightLbs,
    targetDate:targetDate||null,
    stepsTarget:parsed.stepsTarget,
    source:'onboarding'
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
     <label className="wide">Timezone<input value={timezone} onChange={event=>setTimezone(event.target.value)} required/></label>
    </div>
    <button className="primaryAction">Continue <b>→</b></button>
   </form>}
   {step===2&&<form onSubmit={next}>
    <h1>Your goal</h1><p>This can change later without erasing your history.</p>
    <div className="formGrid">
     <label>Current weight <small>{unitLabel}</small><input type="number" min="1" step=".1" value={currentWeight} onChange={event=>setCurrentWeight(event.target.value)} required/></label>
     <label>Goal type<select value={goalType} onChange={event=>setGoalType(event.target.value as GoalType)}><option value="cut">Cut</option><option value="maintain">Maintain</option><option value="bulk">Build</option></select></label>
     <label>Target weight <small>{unitLabel}</small><input type="number" min="1" step=".1" value={targetWeight} onChange={event=>setTargetWeight(event.target.value)} required/></label>
     <label>Target date <small>optional</small><input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)}/></label>
    </div>
    <div className="formActions"><button type="button" className="quietAction" onClick={()=>setStep(1)}>Back</button><button className="primaryAction">Continue <b>→</b></button></div>
   </form>}
   {step===3&&<form onSubmit={finish}>
    <h1>Lifestyle</h1><p>Choose an honest baseline. These are starting targets, not medical advice.</p>
    <div className="formGrid">
     <label className="wide">Usual activity<select value={activityLevel} onChange={event=>setActivityLevel(event.target.value as ActivityLevel)}><option value="sedentary">Mostly seated</option><option value="light">Lightly active</option><option value="moderate">Moderately active</option><option value="very_active">Very active</option></select></label>
     <label className="wide">Daily step target<input type="number" min="1000" max="100000" step="500" value={stepsTarget} onChange={event=>setStepsTarget(event.target.value)} required/></label>
    </div>
    <div className="formActions"><button type="button" className="quietAction" onClick={()=>setStep(2)} disabled={busy}>Back</button><button className="primaryAction" disabled={busy}>{busy?'Building your plan…':'Start CUT365'} <b>→</b></button></div>
   </form>}
   {error&&<p className="formError" role="alert">{error}</p>}
  </section>
 </main>
}

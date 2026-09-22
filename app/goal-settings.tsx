'use client'
import {FormEvent,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import type {Goal,GoalTarget} from '../lib/goals'
import {createGoalTargetVersion} from '../lib/goal-target-api'
import {supabase} from '../lib/supabase'
import {
 hasCompleteCalculationProfile,saveProfile,
 type ActivityLevel,type EnergyEstimationSex,type Profile,type WeightUnit
} from '../lib/profile'
import {calculateInitialTargets,calendarDateInTimezone,kilogramsToPounds,poundsToKilograms,shiftCalendarDate} from '../lib/targets'
import {recommendedWeeklyWorkouts} from '../lib/coaching'

const errorText=(error:unknown)=>error instanceof Error?error.message:'Could not update the goal.'
const displayedWeight=(pounds:number,unit:Profile['weight_unit'])=>unit==='kg'?poundsToKilograms(pounds):pounds

export default function GoalSettings({session,profile,goal,target,currentWeightLbs,onClose,onGoalSaved,onProfileSaved}:{
 session:Session
 profile:Profile
 goal:Goal
 target:GoalTarget
 currentWeightLbs:number
 onClose:()=>void
 onGoalSaved:(goal:Goal,target:GoalTarget)=>void
 onProfileSaved:(profile:Profile)=>void
}){
 const initialProfileReady=hasCompleteCalculationProfile(profile)
 const [section,setSection]=useState<'goal'|'profile'>(initialProfileReady?'goal':'profile')
 const today=calendarDateInTimezone(profile.timezone)
 const effectiveFrom=target.effective_from===today?shiftCalendarDate(today,1):today
 const [targetWeight,setTargetWeight]=useState(displayedWeight(goal.target_weight_lbs,profile.weight_unit).toFixed(1))
 const [targetDate,setTargetDate]=useState(goal.target_date||'')
 const [stepsTarget,setStepsTarget]=useState(String(target.steps_target))
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [birthYear,setBirthYear]=useState(profile.birth_year?.toString()||'')
 const [sex,setSex]=useState<''|EnergyEstimationSex>(profile.energy_estimation_sex||'')
 const [height,setHeight]=useState(profile.height_inches?.toString()||'')
 const [timezone,setTimezone]=useState(profile.timezone)
 const [weightUnit,setWeightUnit]=useState<WeightUnit>(profile.weight_unit)
 const [activityLevel,setActivityLevel]=useState<ActivityLevel>(profile.activity_level)
 const [exerciseFrequency,setExerciseFrequency]=useState(profile.exercise_frequency)
 const [profileBusy,setProfileBusy]=useState(false)
 const [profileError,setProfileError]=useState('')
 const [profileNotice,setProfileNotice]=useState('')
 const calculationProfileReady=hasCompleteCalculationProfile(profile)
 const targetWeightLbs=useMemo(()=>{
  const value=Number(targetWeight)
  return profile.weight_unit==='kg'?kilogramsToPounds(value):value
 },[targetWeight,profile.weight_unit])

 async function save(event:FormEvent){
  event.preventDefault()
  if(busy)return
  setBusy(true)
  setError('')
  try{
   if(profile.birth_year===null||profile.height_inches===null||!profile.energy_estimation_sex){
    throw new Error('Complete your profile before recalculating targets.')
   }
   calculateInitialTargets({
    birthYear:profile.birth_year,
    sex:profile.energy_estimation_sex,
    heightInches:profile.height_inches,
    currentWeightLbs,
    targetWeightLbs,
    goalType:goal.goal_type,
    activityLevel:profile.activity_level,
    stepsTarget:Number(stepsTarget),
    targetDate:targetDate||null,
    effectiveDate:effectiveFrom
   })
   const result=await createGoalTargetVersion(session.access_token,{
    goalId:goal.id,
    effectiveFrom,
    targetWeightLbs,
    targetDate:targetDate||null,
    stepsTarget:Number(stepsTarget),
    source:'manual'
   })
   onGoalSaved(result.goal,result.target)
  }catch(saveError){setError(errorText(saveError))}
  finally{setBusy(false)}
 }

 async function saveProfileDetails(event:FormEvent){
  event.preventDefault()
  if(profileBusy)return
  setProfileBusy(true)
  setProfileError('')
  setProfileNotice('')
  try{
   if(!sex)throw new Error('Choose a gender.')
   const nextProfile=await saveProfile(supabase,session.user.id,{
    displayName:profile.display_name,
    birthYear:Number(birthYear),
    energyEstimationSex:sex,
    heightInches:Number(height),
    timezone,
    weightUnit,
    activityLevel,
    exerciseFrequency,
    onboardingComplete:true
   })
   onProfileSaved(nextProfile)
   setTargetWeight(displayedWeight(goal.target_weight_lbs,nextProfile.weight_unit).toFixed(1))
   setProfileNotice('Profile saved. Your existing targets were not changed.')
   setSection('goal')
  }catch(saveError){setProfileError(errorText(saveError))}
  finally{setProfileBusy(false)}
 }

 return <div className="settingsShade" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section className="settingsPanel" role="dialog" aria-modal="true" aria-labelledby="goal-settings-title">
   <div className="settingsHead"><div><p className="eyebrow">CUT365</p><h2 id="goal-settings-title">Settings</h2></div><button onClick={onClose} aria-label="Close settings">×</button></div>
   <div className="settingsTabs" role="tablist" aria-label="Settings section">
    <button type="button" role="tab" aria-selected={section==='goal'} className={section==='goal'?'active':''} onClick={()=>setSection('goal')}>Goal</button>
    <button type="button" role="tab" aria-selected={section==='profile'} className={section==='profile'?'active':''} onClick={()=>setSection('profile')}>Profile</button>
   </div>
   {section==='profile'?<form onSubmit={saveProfileDetails}>
    <p className="settingsIntro">These details improve your target estimate. Saving them does not change your current plan.</p>
    <label>Birth year<input type="number" min="1900" max={new Date().getFullYear()-18} value={birthYear} onChange={event=>setBirthYear(event.target.value)} required/></label>
    <label>Gender<select value={sex} onChange={event=>setSex(event.target.value as ''|EnergyEstimationSex)} required><option value="">Choose</option><option value="female">Female</option><option value="male">Male</option></select></label>
    <label>Height <small>inches</small><input type="number" min="48" max="96" step=".1" value={height} onChange={event=>setHeight(event.target.value)} required/></label>
    <label>Timezone<input value={timezone} onChange={event=>setTimezone(event.target.value)} required/></label>
    <label>Weight unit<select value={weightUnit} onChange={event=>setWeightUnit(event.target.value as WeightUnit)}><option value="lb">Pounds</option><option value="kg">Kilograms</option></select></label>
    <label>Usual activity<select value={activityLevel} onChange={event=>setActivityLevel(event.target.value as ActivityLevel)}><option value="sedentary">Mostly seated</option><option value="light">Lightly active</option><option value="moderate">Moderately active</option><option value="very_active">Very active</option></select></label>
    <label>Strength training frequency <small>{recommendedWeeklyWorkouts(exerciseFrequency)} workouts/week</small><select value={exerciseFrequency} onChange={event=>setExerciseFrequency(event.target.value as Profile['exercise_frequency'])}><option value="none">None</option><option value="one_to_two">1–2 days/week</option><option value="three_to_four">3–4 days/week</option><option value="five_plus">5+ days/week</option></select></label>
    {profileError&&<p className="formError" role="alert">{profileError}</p>}
    <button className="primaryAction" disabled={profileBusy}>{profileBusy?'Saving…':'Save profile'} <b>→</b></button>
   </form>:<form onSubmit={save}>
    {profileNotice&&<p className="settingsSuccess" role="status">{profileNotice}</p>}
    {!calculationProfileReady&&<div className="settingsCompatibility" role="status"><p>Your historical CUT165 plan remains active. Complete your profile before recalculating its targets.</p><button type="button" onClick={()=>setSection('profile')}>Complete profile</button></div>}
    <label>Target weight <small>{profile.weight_unit}</small><input type="number" min="1" step=".1" value={targetWeight} onChange={event=>setTargetWeight(event.target.value)} required disabled={!calculationProfileReady}/></label>
    <label>Target date <small>optional</small><input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)} disabled={!calculationProfileReady}/></label>
    <label>Daily step target<input type="number" min="1000" max="100000" step="500" value={stepsTarget} onChange={event=>setStepsTarget(event.target.value)} required disabled={!calculationProfileReady}/></label>
    {calculationProfileReady&&<p className="settingsNote">Your current target history stays intact. This version begins {effectiveFrom===today?'today':'tomorrow'}.</p>}
    {error&&<p className="formError" role="alert">{error}</p>}
    <button className="primaryAction" disabled={busy||!calculationProfileReady}>{busy?'Saving…':'Save goal'} <b>→</b></button>
   </form>}
  </section>
 </div>
}

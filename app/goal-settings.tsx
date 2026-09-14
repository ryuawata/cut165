'use client'
import {FormEvent,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import type {Goal,GoalTarget} from '../lib/goals'
import {createGoalTargetVersion} from '../lib/goal-target-api'
import {hasCompleteCalculationProfile,type Profile} from '../lib/profile'
import {calculateInitialTargets,calendarDateInTimezone,kilogramsToPounds,poundsToKilograms,shiftCalendarDate} from '../lib/targets'

const errorText=(error:unknown)=>error instanceof Error?error.message:'Could not update the goal.'
const displayedWeight=(pounds:number,unit:Profile['weight_unit'])=>unit==='kg'?poundsToKilograms(pounds):pounds

export default function GoalSettings({session,profile,goal,target,currentWeightLbs,onClose,onSaved}:{
 session:Session
 profile:Profile
 goal:Goal
 target:GoalTarget
 currentWeightLbs:number
 onClose:()=>void
 onSaved:(goal:Goal,target:GoalTarget)=>void
}){
 const today=calendarDateInTimezone(profile.timezone)
 const effectiveFrom=target.effective_from===today?shiftCalendarDate(today,1):today
 const [targetWeight,setTargetWeight]=useState(displayedWeight(goal.target_weight_lbs,profile.weight_unit).toFixed(1))
 const [targetDate,setTargetDate]=useState(goal.target_date||'')
 const [stepsTarget,setStepsTarget]=useState(String(target.steps_target))
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
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
   onSaved(result.goal,result.target)
  }catch(saveError){setError(errorText(saveError))}
  finally{setBusy(false)}
 }

 return <div className="settingsShade" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section className="settingsPanel" role="dialog" aria-modal="true" aria-labelledby="goal-settings-title">
   <div className="settingsHead"><div><p className="eyebrow">SETTINGS</p><h2 id="goal-settings-title">Your goal</h2></div><button onClick={onClose} aria-label="Close settings">×</button></div>
   <form onSubmit={save}>
    {!calculationProfileReady&&<p className="settingsCompatibility" role="status">Your historical CUT165 plan remains active. Complete birth year, energy-estimation sex, and height in your profile before recalculating its targets.</p>}
    <label>Target weight <small>{profile.weight_unit}</small><input type="number" min="1" step=".1" value={targetWeight} onChange={event=>setTargetWeight(event.target.value)} required disabled={!calculationProfileReady}/></label>
    <label>Target date <small>optional</small><input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)} disabled={!calculationProfileReady}/></label>
    <label>Daily step target<input type="number" min="1000" max="100000" step="500" value={stepsTarget} onChange={event=>setStepsTarget(event.target.value)} required disabled={!calculationProfileReady}/></label>
    {calculationProfileReady&&<p className="settingsNote">Your current target history stays intact. This version begins {effectiveFrom===today?'today':'tomorrow'}.</p>}
    {error&&<p className="formError" role="alert">{error}</p>}
    <button className="primaryAction" disabled={busy||!calculationProfileReady}>{busy?'Saving…':'Save goal'} <b>→</b></button>
   </form>
  </section>
 </div>
}

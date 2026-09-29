'use client'
import {useState} from 'react'
import {completeCustomWorkout,type CustomWorkoutTemplate} from '../lib/custom-workouts'
import {supabase} from '../lib/supabase'

const errorText=(error:unknown)=>error instanceof Error?error.message:'Could not complete the workout.'

export default function CustomWorkoutLauncher({userId,logDate,isToday,templates,completedIds,onCompleted,onManage}:{
 userId:string
 logDate:string
 isToday:boolean
 templates:CustomWorkoutTemplate[]
 completedIds:Set<string>
 onCompleted:(templateId:string)=>Promise<void>
 onManage:()=>void
}){
 const [busy,setBusy]=useState<string|null>(null)
 const [message,setMessage]=useState('')

 async function complete(template:CustomWorkoutTemplate){
  if(busy)return
  setBusy(template.id);setMessage('')
  try{
   await completeCustomWorkout(supabase,{userId,logDate,template,isToday})
   await onCompleted(template.id)
   setMessage(`${template.name} completed`)
  }catch(error){setMessage(errorText(error))}finally{setBusy(null)}
 }

 return <section className="myWorkouts workoutLauncher">
  <div className="myWorkoutsHead"><div><p className="eyebrow">SAVED WORKOUTS</p><h3>Routines</h3></div><button type="button" onClick={onManage}>Manage routines</button></div>
  {templates.length===0&&<p className="workoutEmpty">No saved routines yet. <button type="button" onClick={onManage}>Create one in Settings</button></p>}
  <div className="customWorkoutGrid">{templates.map(template=><article className="customWorkoutCard" key={template.id}>
   <div><span>{template.category}</span><h4>{template.name}</h4>{template.description&&<p>{template.description}</p>}<small>{template.duration_minutes?`${template.duration_minutes} min · `:''}{template.format}</small></div>
   {template.external_url&&<a href={template.external_url} target="_blank" rel="noopener noreferrer">Start routine ↗</a>}
   {template.format==='structured'&&<div className="launcherExercises"><strong>{template.exercises.length} exercises</strong><ul>{template.exercises.map(exercise=><li key={`${exercise.name}-${exercise.sets}-${exercise.reps}`}>{exercise.name} · {exercise.sets} × {exercise.reps}</li>)}</ul></div>}
   <div className="customWorkoutActions"><button type="button" className="completeCustom" onClick={()=>complete(template)} disabled={busy!==null||completedIds.has(template.id)}>{completedIds.has(template.id)?'Workout complete ✓':busy===template.id?'Saving…':'Mark workout complete'}</button></div>
  </article>)}</div>
  {message&&<p className="inlineSaveState" role="status">{message}</p>}
 </section>
}

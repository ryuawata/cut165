'use client'
import {FormEvent,useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {
 completeCustomWorkout,createCustomWorkoutTemplate,deleteCustomWorkoutTemplate,
 getCompletedCustomWorkoutsForDate,getCustomWorkoutTemplates,updateCustomWorkoutTemplate,
 type CustomWorkoutCategory,type CustomWorkoutFormat,type CustomWorkoutInput,type CustomWorkoutTemplate
} from '../lib/custom-workouts'
import type {WorkoutExercise} from '../lib/workout-templates'

type Draft={
 name:string;format:CustomWorkoutFormat;category:CustomWorkoutCategory;description:string
 external_url:string;duration_minutes:string;exercises:WorkoutExercise[]
}
const blank=():Draft=>({name:'',format:'guided',category:'strength',description:'',external_url:'',duration_minutes:'',exercises:[]})
const errorText=(error:unknown)=>error instanceof Error?error.message:'Could not update My Workouts.'

export default function CustomWorkouts({userId,logDate,isToday,onCompleted}:{
 userId:string;logDate:string;isToday:boolean;onCompleted:()=>Promise<void>
}){
 const [templates,setTemplates]=useState<CustomWorkoutTemplate[]>([])
 const [completedIds,setCompletedIds]=useState<Set<string>>(new Set())
 const [open,setOpen]=useState(false)
 const [editing,setEditing]=useState<CustomWorkoutTemplate|null>(null)
 const [draft,setDraft]=useState<Draft>(blank)
 const [busy,setBusy]=useState<string|null>(null)
 const [message,setMessage]=useState('')

 useEffect(()=>{
  let active=true
  Promise.all([
   getCustomWorkoutTemplates(supabase,userId),
   getCompletedCustomWorkoutsForDate(supabase,userId,logDate)
  ]).then(([nextTemplates,sessions])=>{
   if(!active)return
   setTemplates(nextTemplates)
   setCompletedIds(new Set(sessions.flatMap(session=>session.custom_workout_template_id?[session.custom_workout_template_id]:[])))
  }).catch(error=>{if(active)setMessage(errorText(error))})
  return()=>{active=false}
 },[userId,logDate])

 const input=():CustomWorkoutInput=>({
  name:draft.name,format:draft.format,category:draft.category,
  description:draft.description||null,external_url:draft.external_url||null,
  duration_minutes:draft.duration_minutes===''?null:Number(draft.duration_minutes),
  exercises:draft.format==='structured'?draft.exercises:[],
  sort_order:editing?.sort_order??templates.length
 })

 function startEdit(template:CustomWorkoutTemplate){
  setEditing(template)
  setDraft({
   name:template.name,format:template.format,category:template.category,
   description:template.description??'',external_url:template.external_url??'',
   duration_minutes:template.duration_minutes?.toString()??'',
   exercises:template.exercises.map(exercise=>({...exercise}))
  })
  setOpen(true);setMessage('')
 }

 async function save(event:FormEvent){
  event.preventDefault();if(busy)return
  setBusy('save');setMessage('')
  try{
   const saved=editing
    ?await updateCustomWorkoutTemplate(supabase,userId,editing.id,input())
    :await createCustomWorkoutTemplate(supabase,userId,input())
   setTemplates(current=>editing?current.map(item=>item.id===saved.id?saved:item):[...current,saved])
   setEditing(null);setDraft(blank());setOpen(false);setMessage('Workout saved')
  }catch(error){setMessage(errorText(error))}finally{setBusy(null)}
 }

 async function remove(template:CustomWorkoutTemplate){
  if(busy||!window.confirm(`Delete “${template.name}”? Completed workout history will stay unchanged.`))return
  setBusy(`delete:${template.id}`);setMessage('')
  try{
   await deleteCustomWorkoutTemplate(supabase,userId,template.id)
   setTemplates(current=>current.filter(item=>item.id!==template.id))
  }catch(error){setMessage(errorText(error))}finally{setBusy(null)}
 }

 async function complete(template:CustomWorkoutTemplate){
  if(busy)return
  setBusy(`complete:${template.id}`);setMessage('')
  try{
   await completeCustomWorkout(supabase,{userId,logDate,template,isToday})
   setCompletedIds(current=>new Set(current).add(template.id))
   await onCompleted()
   setMessage(`${template.name} completed`)
  }catch(error){setMessage(errorText(error))}finally{setBusy(null)}
 }

 const updateExercise=(index:number,patch:Partial<WorkoutExercise>)=>setDraft(current=>({
  ...current,exercises:current.exercises.map((exercise,position)=>position===index?{...exercise,...patch}:exercise)
 }))
 const move=(index:number,direction:-1|1)=>setDraft(current=>{
  const destination=index+direction
  if(destination<0||destination>=current.exercises.length)return current
  const exercises=[...current.exercises]
  ;[exercises[index],exercises[destination]]=[exercises[destination],exercises[index]]
  return {...current,exercises}
 })

 return <section className="myWorkouts">
  <div className="myWorkoutsHead"><div><p className="eyebrow">MY WORKOUTS</p><h3>Reusable routines</h3></div><button type="button" onClick={()=>{setEditing(null);setDraft(blank());setOpen(value=>!value);setMessage('')}}>{open?'Close':'+ New workout'}</button></div>
  {templates.length===0&&!open&&<p className="workoutEmpty">Save a structured routine or an external guided workout.</p>}
  <div className="customWorkoutGrid">{templates.map(template=><article className="customWorkoutCard" key={template.id}>
   <div><span>{template.category}</span><h4>{template.name}</h4>{template.description&&<p>{template.description}</p>}<small>{template.duration_minutes?`${template.duration_minutes} min · `:''}{template.format}</small></div>
   {template.external_url&&<a href={template.external_url} target="_blank" rel="noopener noreferrer">Open workout ↗</a>}
   {template.format==='structured'&&<details><summary>{template.exercises.length} exercises</summary><ul>{template.exercises.map(exercise=><li key={`${exercise.name}-${exercise.sets}-${exercise.reps}`}>{exercise.name} · {exercise.sets} × {exercise.reps}</li>)}</ul></details>}
   <div className="customWorkoutActions"><button type="button" className="completeCustom" onClick={()=>complete(template)} disabled={busy!==null||completedIds.has(template.id)}>{completedIds.has(template.id)?'Complete ✓':busy===`complete:${template.id}`?'Saving…':'Mark complete'}</button><button type="button" onClick={()=>startEdit(template)} disabled={busy!==null}>Edit</button><button type="button" onClick={()=>remove(template)} disabled={busy!==null}>Delete</button></div>
  </article>)}</div>
  {open&&<form className="customWorkoutForm" onSubmit={save}>
   <label className="wide">Name<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} placeholder="30-Min Full Body Workout" required/></label>
   <label>Style<select value={draft.format} onChange={event=>setDraft({...draft,format:event.target.value as CustomWorkoutFormat})}><option value="guided">Guided / simple</option><option value="structured">Structured</option></select></label>
   <label>Category<select value={draft.category} onChange={event=>setDraft({...draft,category:event.target.value as CustomWorkoutCategory})}><option value="strength">Strength</option><option value="cardio">Cardio</option><option value="mobility">Mobility</option><option value="other">Other</option></select></label>
   <label className="wide">Description <small>optional</small><input value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
   <label className="wide">External URL <small>optional</small><input type="url" value={draft.external_url} onChange={event=>setDraft({...draft,external_url:event.target.value})} placeholder="https://youtube.com/…"/></label>
   <label>Duration (min) <small>optional</small><input type="number" min="1" max="1440" value={draft.duration_minutes} onChange={event=>setDraft({...draft,duration_minutes:event.target.value})}/></label>
   {draft.format==='structured'&&<div className="customExercises wide"><div><strong>Exercises</strong><button type="button" onClick={()=>setDraft(current=>({...current,exercises:[...current.exercises,{name:'',sets:'',reps:''}]}))}>+ Add exercise</button></div>{draft.exercises.map((exercise,index)=><div className="customExercise" key={`${index}-${editing?.id??'new'}`}><input aria-label={`Exercise ${index+1} name`} placeholder="Exercise" value={exercise.name} onChange={event=>updateExercise(index,{name:event.target.value})}/><input aria-label={`Exercise ${index+1} sets`} placeholder="Sets" value={exercise.sets} onChange={event=>updateExercise(index,{sets:event.target.value})}/><input aria-label={`Exercise ${index+1} reps`} placeholder="Reps" value={exercise.reps} onChange={event=>updateExercise(index,{reps:event.target.value})}/><div><button type="button" onClick={()=>move(index,-1)} disabled={index===0} aria-label="Move exercise up">↑</button><button type="button" onClick={()=>move(index,1)} disabled={index===draft.exercises.length-1} aria-label="Move exercise down">↓</button><button type="button" onClick={()=>setDraft(current=>({...current,exercises:current.exercises.filter((_,position)=>position!==index)}))} aria-label="Remove exercise">×</button></div></div>)}</div>}
   <div className="customFormActions wide"><button type="button" onClick={()=>{setOpen(false);setEditing(null)}}>Cancel</button><button disabled={busy!==null}>{busy==='save'?'Saving…':editing?'Save changes':'Create workout'}</button></div>
  </form>}
  {message&&<p className="inlineSaveState" role="status">{message}</p>}
 </section>
}

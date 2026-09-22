'use client'
import {FormEvent,useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {
 defaultWorkoutTemplate,deleteWorkoutTemplate,saveWorkoutTemplate,
 type BetaWorkoutCode,type WorkoutExercise,type WorkoutTemplate
} from '../lib/workout-templates'

const clone=(template:WorkoutTemplate):WorkoutTemplate=>({...template,exercises:template.exercises.map(exercise=>({...exercise}))})
const errorText=(error:unknown)=>error instanceof Error?error.message:'Could not save the workout.'

export default function WorkoutTemplateEditor({userId,templates,onChange}:{
 userId:string
 templates:WorkoutTemplate[]
 onChange:(templates:WorkoutTemplate[])=>void
}){
 const [open,setOpen]=useState(false)
 const [code,setCode]=useState<BetaWorkoutCode>('full_body_a')
 const active=templates.find(template=>template.workout_code===code)??defaultWorkoutTemplate(code)
 const [draft,setDraft]=useState(()=>clone(active))
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 useEffect(()=>setDraft(clone(active)),[active.id,code])

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

 async function save(event:FormEvent){
  event.preventDefault()
  if(busy)return
  setBusy(true);setMessage('')
  try{
   const saved=await saveWorkoutTemplate(supabase,userId,draft)
   onChange(templates.map(template=>template.workout_code===code?saved:template))
   setMessage('Saved')
  }catch(error){setMessage(errorText(error))}
  finally{setBusy(false)}
 }

 async function reset(){
  if(busy||!window.confirm(`Reset ${active.name} to the CUT365 starter template?`))return
  setBusy(true);setMessage('')
  try{
   const starter=await deleteWorkoutTemplate(supabase,userId,code)
   onChange(templates.map(template=>template.workout_code===code?starter:template))
   setDraft(clone(starter));setMessage('Starter restored')
  }catch(error){setMessage(errorText(error))}
  finally{setBusy(false)}
 }

 return <div className="templateEditor">
  <button type="button" className="textAction" onClick={()=>setOpen(value=>!value)}>{open?'Close workout editor':'Edit A / B workouts'}</button>
  {open&&<form onSubmit={save} className="templateForm">
   <div className="templateTabs">
    <button type="button" className={code==='full_body_a'?'active':''} onClick={()=>setCode('full_body_a')}>Full Body A</button>
    <button type="button" className={code==='full_body_b'?'active':''} onClick={()=>setCode('full_body_b')}>Full Body B</button>
   </div>
   <label>Name<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} required/></label>
   <label>Focus <small>optional</small><input value={draft.focus} onChange={event=>setDraft({...draft,focus:event.target.value})}/></label>
   <div className="templateExerciseHead"><strong>Exercises</strong><button type="button" onClick={()=>setDraft(current=>({...current,exercises:[...current.exercises,{name:'',sets:'',reps:''}]}))}>+ Add exercise</button></div>
   {draft.exercises.map((exercise,index)=><div className="templateExercise" key={`${index}-${code}`}>
    <input aria-label={`Exercise ${index+1} name`} placeholder="Exercise" value={exercise.name} onChange={event=>updateExercise(index,{name:event.target.value})}/>
    <input aria-label={`Exercise ${index+1} sets`} placeholder="Sets" value={exercise.sets} onChange={event=>updateExercise(index,{sets:event.target.value})}/>
    <input aria-label={`Exercise ${index+1} reps`} placeholder="Reps" value={exercise.reps} onChange={event=>updateExercise(index,{reps:event.target.value})}/>
    <div><button type="button" aria-label="Move exercise up" onClick={()=>move(index,-1)} disabled={index===0}>↑</button><button type="button" aria-label="Move exercise down" onClick={()=>move(index,1)} disabled={index===draft.exercises.length-1}>↓</button><button type="button" aria-label="Remove exercise" onClick={()=>setDraft(current=>({...current,exercises:current.exercises.filter((_,position)=>position!==index)}))}>×</button></div>
   </div>)}
   {message&&<p className="inlineSaveState" role="status">{message}</p>}
   <div className="templateActions"><button type="button" className="quiet" onClick={reset} disabled={busy||active.id===null}>Reset starter</button><button disabled={busy}>{busy?'Saving…':'Save workout'}</button></div>
  </form>}
 </div>
}

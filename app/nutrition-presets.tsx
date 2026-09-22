'use client'
import {FormEvent,useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {
 createNutritionPreset,deleteNutritionPreset,getNutritionPresets,logNutritionPreset,
 updateNutritionPreset,type NutritionPreset,type NutritionPresetInput
} from '../lib/nutrition-presets'
import type {MealSlot} from '../lib/nutrition'

type Draft={name:string;meal_slot:''|MealSlot;calories:string;protein_g:string;carbs_g:string;fat_g:string;alcohol_servings:string}
const blank=():Draft=>({name:'',meal_slot:'',calories:'',protein_g:'',carbs_g:'',fat_g:'',alcohol_servings:''})
const text=(error:unknown)=>error instanceof Error?error.message:'Could not update Quick Add.'
const value=(input:string)=>input.trim()===''?null:Number(input)
const summary=(preset:NutritionPreset)=>[
 preset.calories===null?null:`${preset.calories.toLocaleString()} kcal`,
 preset.protein_g===null?null:`${preset.protein_g.toLocaleString()}g protein`,
 preset.carbs_g===null?null:`${preset.carbs_g.toLocaleString()}g carbs`,
 preset.alcohol_servings===null||preset.alcohol_servings<=0?null:`${preset.alcohol_servings.toLocaleString()} ${preset.alcohol_servings===1?'drink':'drinks'}`
].filter(Boolean).join(' · ')

export default function NutritionPresets({userId,logDate,dateLabel,onLogged}:{
 userId:string
 logDate:string
 dateLabel:string
 onLogged:()=>Promise<void>
}){
 const [presets,setPresets]=useState<NutritionPreset[]>([])
 const [open,setOpen]=useState(false)
 const [editing,setEditing]=useState<NutritionPreset|null>(null)
 const [draft,setDraft]=useState<Draft>(blank)
 const [busy,setBusy]=useState<string|null>(null)
 const [message,setMessage]=useState('')

 useEffect(()=>{
  let active=true
  getNutritionPresets(supabase,userId).then(data=>{if(active)setPresets(data)}).catch(error=>{if(active)setMessage(text(error))})
  return()=>{active=false}
 },[userId])

 const input=():NutritionPresetInput=>({
  name:draft.name,meal_slot:draft.meal_slot||null,calories:value(draft.calories),
  protein_g:value(draft.protein_g),carbs_g:value(draft.carbs_g),fat_g:value(draft.fat_g),
  alcohol_servings:value(draft.alcohol_servings),sort_order:editing?.sort_order??presets.length
 })

 async function save(event:FormEvent){
  event.preventDefault();if(busy)return
  setBusy('save');setMessage('')
  try{
   const saved=editing
    ?await updateNutritionPreset(supabase,userId,editing.id,input())
    :await createNutritionPreset(supabase,userId,input())
   setPresets(current=>editing?current.map(item=>item.id===saved.id?saved:item):[...current,saved])
   setDraft(blank());setEditing(null);setOpen(false);setMessage('Quick Add saved')
  }catch(error){setMessage(text(error))}
  finally{setBusy(null)}
 }

 const edit=(preset:NutritionPreset)=>{
  setEditing(preset);setDraft({
   name:preset.name,meal_slot:preset.meal_slot??'',calories:preset.calories?.toString()??'',
   protein_g:preset.protein_g?.toString()??'',carbs_g:preset.carbs_g?.toString()??'',
   fat_g:preset.fat_g?.toString()??'',alcohol_servings:preset.alcohol_servings?.toString()??''
  });setOpen(true);setMessage('')
 }

 const remove=async(preset:NutritionPreset)=>{
  if(busy||!window.confirm(`Delete “${preset.name}”? Logged entries will stay unchanged.`))return
  setBusy(preset.id);setMessage('')
  try{await deleteNutritionPreset(supabase,userId,preset.id);setPresets(current=>current.filter(item=>item.id!==preset.id))}
  catch(error){setMessage(text(error))}finally{setBusy(null)}
 }

 const log=async(preset:NutritionPreset)=>{
  if(busy)return
  setBusy(`log:${preset.id}`);setMessage('')
  try{await logNutritionPreset(supabase,userId,logDate,preset);await onLogged();setMessage(`${preset.name} added to ${dateLabel}`)}
  catch(error){setMessage(text(error))}finally{setBusy(null)}
 }

 return <section className="presetQuickAdd">
  <div className="presetHead"><div><p className="eyebrow">QUICK ADD</p><h3>Saved items</h3></div><button type="button" onClick={()=>{setEditing(null);setDraft(blank());setOpen(value=>!value);setMessage('')}}>{open?'Close':'+ New Quick Add'}</button></div>
  {presets.length>0?<div className="presetRail">{presets.map(preset=><article className="presetCard" key={preset.id}>
   <button type="button" className="presetLog" onClick={()=>log(preset)} disabled={busy!==null}><strong>{preset.name}</strong><small>{summary(preset)}</small><span>{busy===`log:${preset.id}`?'Adding…':`Add to ${dateLabel}`}</span></button>
   <div><button type="button" onClick={()=>edit(preset)}>Edit</button><button type="button" onClick={()=>remove(preset)} disabled={busy!==null}>Delete</button></div>
  </article>)}</div>:<p className="presetEmpty">Save frequent foods or meals for one-tap logging.</p>}
  {open&&<form className="presetForm" onSubmit={save}>
   <label className="wide">Name<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} placeholder="Protein shake" required/></label>
   <label>Meal<select value={draft.meal_slot} onChange={event=>setDraft({...draft,meal_slot:event.target.value as ''|MealSlot})}><option value="">Optional</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label>
   {(['calories','protein_g','carbs_g','fat_g','alcohol_servings'] as const).map(metric=><label key={metric}>{metric==='protein_g'?'Protein':metric==='carbs_g'?'Carbs':metric==='fat_g'?'Fat':metric==='alcohol_servings'?'Alcohol servings':'Calories'}<input type="number" min="0" step="any" value={draft[metric]} onChange={event=>setDraft({...draft,[metric]:event.target.value})} placeholder="—"/></label>)}
   <div className="presetActions"><button type="button" className="quiet" onClick={()=>{setOpen(false);setEditing(null)}}>Cancel</button><button disabled={busy!==null}>{busy==='save'?'Saving…':editing?'Save changes':'Create Quick Add'}</button></div>
  </form>}
  {message&&<p className="inlineSaveState" role="status">{message}</p>}
 </section>
}

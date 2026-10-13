'use client'
import {useState,type FormEvent} from 'react'
import {supabase} from '../lib/supabase'
import type {CanonicalFood,FoodSearchResult} from '../lib/nutrition-provider/types'
import type {ParsedItem} from '../lib/nutrition-provider/resolve'

type Choice={item:ParsedItem;candidates:FoodSearchResult[];food:CanonicalFood|null;foodId:string;servingId:string;quantity:string;unit:'g'|'oz'|'piece'|'serving'}
type Preview={food:{name:string;brand:string|null};serving:string;calories:number|null;protein_g:number|null;carbs_g:number|null;fat_g:number|null}
export default function NutritionChat({logDate,onSaved,onClose}:{logDate:string;onSaved:()=>Promise<void>|void;onClose:()=>void}){
 const [message,setMessage]=useState('')
 const [choices,setChoices]=useState<Choice[]>([])
 const [preview,setPreview]=useState<Preview[]>([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID())
 async function call(body:object){
  const {data:{session}}=await supabase.auth.getSession()
  if(!session)throw new Error('Sign in to log food.')
  const response=await fetch('/api/nutrition-chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)})
  const data=await response.json()
  if(!response.ok)throw new Error(data.error??'Food lookup failed.')
  return data
 }
 async function parse(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setPreview([])
  try{
   const data=await call({action:'resolve',message}) as {items:{item:ParsedItem;candidates:FoodSearchResult[]}[]}
   setRequestId(crypto.randomUUID());setChoices(data.items.map(({item,candidates})=>({item,candidates,food:null,foodId:'',servingId:'',quantity:item.quantity?.toString()??'',unit:item.unit??'serving'})))
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not parse the meal.')}
  finally{setBusy(false)}
 }
 async function choose(index:number,id:string){
  setBusy(true);setError('');setPreview([])
  try{
   const {food}=await call({action:'food',foodId:id}) as {food:CanonicalFood}
   setChoices(current=>current.map((choice,i)=>i===index?{...choice,food,foodId:id,servingId:food.servings[0]?.id??''}:choice))
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not load the food.')}
  finally{setBusy(false)}
 }
 function update(index:number,patch:Partial<Choice>){setPreview([]);setChoices(current=>current.map((choice,i)=>i===index?{...choice,...patch}:choice))}
 function selections(){
  if(choices.some(choice=>!choice.foodId||!choice.servingId||!choice.quantity||Number(choice.quantity)<=0))throw new Error('Choose a food, serving, and quantity for each item.')
  return choices.map(choice=>({foodId:choice.foodId,servingId:choice.servingId,quantity:Number(choice.quantity),unit:choice.unit}))
 }
 async function review(){
  setBusy(true);setError('')
  try{const data=await call({action:'preview',items:selections()}) as {items:Preview[]};setPreview(data.items)}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not calculate nutrition.')}
  finally{setBusy(false)}
 }
 async function save(){
  setBusy(true);setError('')
  try{await call({action:'save',items:selections(),logDate,requestId});await onSaved();onClose()}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not save the meal. Retry to finish.')}
  finally{setBusy(false)}
 }
 return <section className="nutritionChat" aria-label="Chat food log">
  <div className="nutritionChatHead"><h3>Chat food log</h3><button type="button" onClick={onClose}>Close</button></div>
  <form onSubmit={parse}><label htmlFor="nutrition-chat-message">What did you eat?</label><textarea id="nutrition-chat-message" value={message} onChange={event=>{setMessage(event.target.value);setChoices([]);setPreview([])}} placeholder="I ate 3 Bibigo beef soup dumplings and 200g grilled chicken breast" rows={3}/><button disabled={busy||!message.trim()}>Find foods</button></form>
  {choices.map((choice,index)=><div className="nutritionChatChoice" key={index}>
   <strong>{choice.item.query}</strong>
   {!choice.candidates.length&&<p>No verified food found. Try a more specific name.</p>}
   <label>Food match<select value={choice.foodId} onChange={event=>void choose(index,event.target.value)} disabled={busy}><option value="">Choose a food</option>{choice.candidates.map(food=><option key={food.id} value={food.id}>{food.brand?`${food.brand} · `:''}{food.name}</option>)}</select></label>
   {choice.food&&<><label>Serving<select value={choice.servingId} onChange={event=>update(index,{servingId:event.target.value})}>{choice.food.servings.map(serving=><option key={serving.id} value={serving.id}>{serving.description}</option>)}</select></label>
   <div className="nutritionChatQuantity"><label>Quantity<input type="number" min="0.01" step="any" value={choice.quantity} onChange={event=>update(index,{quantity:event.target.value})}/></label><label>Unit<select value={choice.unit} onChange={event=>update(index,{unit:event.target.value as Choice['unit']})}><option value="piece">Pieces</option><option value="serving">Servings</option><option value="g">Grams</option><option value="oz">Ounces</option></select></label></div></>}
  </div>)}
  {choices.length>0&&<button type="button" disabled={busy} onClick={()=>void review()}>Review nutrition</button>}
  {preview.length>0&&<div className="nutritionChatPreview"><h4>Review before adding</h4>{preview.map((item,index)=><p key={index}>{item.food.brand?`${item.food.brand} `:''}{item.food.name} · {item.serving}<br/>{item.calories??'Unknown'} kcal · {item.protein_g??'Unknown'}g protein · {item.carbs_g??'Unknown'}g carbs · {item.fat_g??'Unknown'}g fat</p>)}<strong>Total: {preview.some(item=>item.calories===null)?'Incomplete':`${preview.reduce((sum,item)=>sum+(item.calories??0),0)} kcal`}</strong><button type="button" disabled={busy} onClick={()=>void save()}>Add to {logDate}</button></div>}
  {error&&<p role="alert">{error}</p>}
 </section>
}

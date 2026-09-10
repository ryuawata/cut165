'use client'
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../lib/supabase'
import {
 emptyDailyMetrics,getDailyMetrics,incrementDailyMetric,saveDailyMetrics,
 type DailyMetricDeltaKey,type DailyMetrics
} from '../lib/daily-metrics'
import {
 getBodyMeasurement,getRecentWeights,saveBodyWeight,
 type BodyMeasurement,type WeightHistory
} from '../lib/body-measurements'
import {
 getWorkoutPlan,isStrengthOpportunity,setWorkoutCompletion,
 type StructuredWorkoutCode,type WorkoutPlan
} from '../lib/workouts'
import {
 createNutritionEntry,deleteNutritionEntry,emptyDailyNutritionTotals,
 getDailyNutritionTotals,getNutritionEntries,updateNutritionEntry,
 type DailyNutritionTotals,type MealSlot,type NutritionEntry
} from '../lib/nutrition'

type MetricKey='calories'|'protein_g'|'carbs_g'|DailyMetricDeltaKey
type MealDraft={description:string;mealSlot:''|MealSlot;calories:string;protein_g:string;carbs_g:string}
type EditDraft={description:string;mealSlot:''|MealSlot;calories:string;protein_g:string;carbs_g:string}

const localISO=(date=new Date())=>{
 const year=date.getFullYear()
 const month=String(date.getMonth()+1).padStart(2,'0')
 const day=String(date.getDate()).padStart(2,'0')
 return `${year}-${month}-${day}`
}
const localDate=(iso:string)=>{
 const [year,month,day]=iso.split('-').map(Number)
 return new Date(year,month-1,day,12)
}
const shiftDate=(iso:string,days:number)=>{
 const date=localDate(iso)
 date.setDate(date.getDate()+days)
 return localISO(date)
}
const blankMeal=():MealDraft=>({description:'',mealSlot:'',calories:'',protein_g:'',carbs_g:''})

const workouts:Record<StructuredWorkoutCode,{name:string;focus:string;exercises:readonly (readonly [string,string,string])[]}>= {
 full_body_a:{name:'Full Body A',focus:'Squat + horizontal push/pull',exercises:[
  ['Goblet squat','3','8–12'],['Dumbbell Romanian deadlift','3','8–12'],
  ['Dumbbell bench/floor press','3','8–12'],['One-arm dumbbell row','3','10–12/side'],
  ['Dumbbell lateral raise','2','12–15'],['Kettlebell swings','3','15'],['Plank','2','30–60 sec']
 ]},
 full_body_b:{name:'Full Body B',focus:'Single-leg + shoulders/back',exercises:[
  ['Dumbbell reverse lunge','3','8–10/leg'],['Kettlebell sumo deadlift','3','10–12'],
  ['Dumbbell overhead press','3','8–12'],['Lat pulldown','3','8–12'],
  ['Incline dumbbell press','2','10–12'],['Dumbbell curls','2','10–15'],['Dead bug','2','8–12/side']
 ]},
 full_body_c:{name:'Full Body C',focus:'Athletic/metabolic full body',exercises:[
  ['Dumbbell split squat','3','8–10/leg'],['Dumbbell hip thrust/glute bridge','3','10–15'],
  ['Push-ups','3','8–15'],['Seated cable row or dumbbell row','3','10–12'],
  ['Dumbbell shoulder press','2','8–12'],['Kettlebell swings','3','15–20'],['Farmer carry','3','30–45 sec']
 ]}
}

function emptyWorkoutPlan(logDate:string):WorkoutPlan{
 const strengthOpportunity=isStrengthOpportunity(logDate)
 return {code:strengthOpportunity?'full_body_a':'recovery',completed:false,session:null,strengthOpportunity}
}

function getTraining(iso:string,plan:WorkoutPlan){
 const date=localDate(iso)
 const dayLabel=date.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()
 if(plan.code==='recovery')return {name:'Recovery + Movement',type:'Recovery',dayLabel,duration:'At your pace',kind:'recovery' as const}
 return {...workouts[plan.code],type:'Strength',dayLabel,duration:'25–35 min',kind:'strength' as const}
}

const metricLabels:Record<MetricKey,string>={
 calories:'Calories',protein_g:'Protein',carbs_g:'Carbs',steps:'Steps',water_oz:'Water'
}
const errorText=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Please try again.'
const parseMetric=(value:string,label:string)=>{
 if(value.trim()==='')return null
 const parsed=Number(value)
 if(!Number.isFinite(parsed)||parsed<0)throw new Error(`${label} must be a valid non-negative number.`)
 return parsed
}
const formatNumber=(value:number|null,digits=1)=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:digits})
const displayDescription=(entry:NutritionEntry)=>entry.source==='legacy'?'Imported daily total':entry.description
const entrySummary=(entry:NutritionEntry)=>{
 const values=[]
 if(entry.calories!==null)values.push(`${formatNumber(entry.calories)} kcal`)
 if(entry.protein_g!==null)values.push(`${formatNumber(entry.protein_g)}g protein`)
 if(entry.carbs_g!==null)values.push(`${formatNumber(entry.carbs_g)}g carbs`)
 if(entry.fat_g!==null)values.push(`${formatNumber(entry.fat_g)}g fat`)
 if(entry.alcohol_servings!==null&&entry.alcohol_servings>0)values.push(`${formatNumber(entry.alcohol_servings,2)} ${entry.alcohol_servings===1?'drink':'drinks'}`)
 return values.join(' · ')
}

export default function Page(){
 const [session,setSession]=useState<Session|null>(null)
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [msg,setMsg]=useState('')
 const [selectedDate,setSelectedDate]=useState(localISO())
 const selectedDateRef=useRef(selectedDate)
 const loadSequence=useRef(0)
 const [metrics,setMetrics]=useState<DailyMetrics>(()=>emptyDailyMetrics(localISO()))
 const [measurement,setMeasurement]=useState<BodyMeasurement|null>(null)
 const [weightLbs,setWeightLbs]=useState<number|null>(null)
 const [weightHistory,setWeightHistory]=useState<WeightHistory[]>([])
 const [workoutPlan,setWorkoutPlan]=useState<WorkoutPlan>(()=>emptyWorkoutPlan(localISO()))
 const [workoutBusy,setWorkoutBusy]=useState(false)
 const [entries,setEntries]=useState<NutritionEntry[]>([])
 const [totals,setTotals]=useState<DailyNutritionTotals>(()=>emptyDailyNutritionTotals(localISO()))
 const [nutritionLoading,setNutritionLoading]=useState(false)
 const [nutritionBusy,setNutritionBusy]=useState<string|null>(null)
 const [nutritionError,setNutritionError]=useState('')
 const [nutritionNotice,setNutritionNotice]=useState<{text:string;entryId:string|null;logDate:string}|null>(null)
 const [quickMetric,setQuickMetric]=useState<MetricKey>('calories')
 const [quickValue,setQuickValue]=useState('')
 const [meal,setMeal]=useState<MealDraft>(blankMeal)
 const [mealOpen,setMealOpen]=useState(false)
 const [editingId,setEditingId]=useState<string|null>(null)
 const [editDraft,setEditDraft]=useState<EditDraft|null>(null)
 const training=getTraining(selectedDate,workoutPlan)
 const today=localISO()
 const isToday=selectedDate===today
 const selectedLabel=localDate(selectedDate).toLocaleDateString(undefined,{month:'short',day:'numeric'})

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSession(data.session))
  const {data}=supabase.auth.onAuthStateChange((_,nextSession)=>setSession(nextSession))
  return()=>data.subscription.unsubscribe()
 },[])

 useEffect(()=>{
  selectedDateRef.current=selectedDate
  setNutritionError('')
  setNutritionNotice(null)
  setEditingId(null)
  setEditDraft(null)
  if(session)void loadSelected(selectedDate)
 },[session,selectedDate])
 useEffect(()=>{
  if(session)void loadWeightHistory().catch(error=>setMsg(errorText(error)))
 },[session])

 async function loadWeightHistory(){
  if(!session)return
  setWeightHistory(await getRecentWeights(supabase,session.user.id))
 }

 async function loadSelected(logDate:string,clearMessage=true){
  if(!session)return
  if(selectedDateRef.current!==logDate)return
  const sequence=++loadSequence.current
  if(clearMessage)setMsg('')
  setMetrics(emptyDailyMetrics(logDate))
  setMeasurement(null)
  setWeightLbs(null)
  setWorkoutPlan(emptyWorkoutPlan(logDate))
  setEntries([])
  setTotals(emptyDailyNutritionTotals(logDate))
  setNutritionLoading(true)
  const results=await Promise.allSettled([
   getDailyMetrics(supabase,session.user.id,logDate),
   getBodyMeasurement(supabase,session.user.id,logDate),
   getNutritionEntries(supabase,session.user.id,logDate),
   getDailyNutritionTotals(supabase,session.user.id,logDate),
   getWorkoutPlan(supabase,session.user.id,logDate)
  ])
  if(sequence!==loadSequence.current||selectedDateRef.current!==logDate)return
  const [metricsResult,measurementResult,entriesResult,totalsResult,workoutResult]=results
  if(metricsResult.status==='fulfilled')setMetrics(metricsResult.value)
  else setMsg(errorText(metricsResult.reason))
  if(measurementResult.status==='fulfilled'){
   setMeasurement(measurementResult.value)
   setWeightLbs(measurementResult.value?.weight_lbs??null)
  }else setMsg(errorText(measurementResult.reason))
  if(entriesResult.status==='fulfilled')setEntries(entriesResult.value)
  else setNutritionError(errorText(entriesResult.reason))
  if(totalsResult.status==='fulfilled')setTotals(totalsResult.value)
  else setNutritionError(errorText(totalsResult.reason))
  if(workoutResult.status==='fulfilled')setWorkoutPlan(workoutResult.value)
  else setMsg(errorText(workoutResult.reason))
  setNutritionLoading(false)
 }

 async function refreshNutrition(logDate:string){
  if(!session)return
  const [nextEntries,nextTotals]=await Promise.all([
   getNutritionEntries(supabase,session.user.id,logDate),
   getDailyNutritionTotals(supabase,session.user.id,logDate)
  ])
  if(selectedDateRef.current===logDate){
   setEntries(nextEntries)
   setTotals(nextTotals)
  }
 }

 async function auth(event:FormEvent){
  event.preventDefault()
  setMsg('')
  const signed=await supabase.auth.signInWithPassword({email,password})
  if(!signed.error)return
  const created=await supabase.auth.signUp({email,password})
  setMsg(created.error?.message||'Account created. Check your inbox if confirmation is enabled.')
 }

 async function persist(
  nextMetrics:DailyMetrics,nextWeight:number|null,nextMeasurement:BodyMeasurement|null,successMessage='Saved'
 ){
  if(!session)return false
  const logDate=nextMetrics.log_date
  setMsg('Saving')
  const [metricsResult,weightResult]=await Promise.allSettled([
   saveDailyMetrics(supabase,session.user.id,nextMetrics),
   saveBodyWeight(supabase,{
    userId:session.user.id,logDate,weightLbs:nextWeight,
    existing:nextMeasurement,isToday:logDate===localISO()
   })
  ])
  if(weightResult.status==='fulfilled'){
   try{await loadWeightHistory()}catch(error){
    if(selectedDateRef.current===logDate)setMsg(errorText(error))
   }
  }
  if(selectedDateRef.current!==logDate)return metricsResult.status==='fulfilled'&&weightResult.status==='fulfilled'
  if(metricsResult.status==='fulfilled')setMetrics(metricsResult.value)
  if(weightResult.status==='fulfilled'){
   setMeasurement(weightResult.value)
   setWeightLbs(weightResult.value?.weight_lbs??null)
  }
  const errors=[]
  if(metricsResult.status==='rejected')errors.push(errorText(metricsResult.reason))
  if(weightResult.status==='rejected')errors.push(errorText(weightResult.reason))
  if(errors.length){setMsg(errors.join(' '));return false}
  setMsg(successMessage)
  return true
 }

 async function save(){await persist(metrics,weightLbs,measurement)}

 const latest=weightHistory[0]?.weight_lbs??180
 const lost=Math.max(0,180-latest)
 const progress=Math.max(0,Math.min(100,lost/15*100))
 const status=useMemo(()=>{
  if(totals.entry_count===0)return ['Open','open']
  if(totals.calories_unknown_count>0||totals.protein_unknown_count>0)return ['Partial','warn']
  const calories=Number(totals.calories||0)
  if(calories<=1800&&Number(totals.protein_g||0)>=140)return ['On pace','good']
  if(calories<=1950)return ['Close','warn']
  return ['Over target','bad']
 },[totals])

 const metricNumber=(key:'steps'|'water_oz',value:string)=>{
  setMetrics(current=>({...current,[key]:value===''?null:Number(value)}))
 }
 const changeDate=(days:number)=>{
  const next=shiftDate(selectedDate,days)
  if(next<=today){
   selectedDateRef.current=next
   setMetrics(emptyDailyMetrics(next))
   setMeasurement(null)
   setWeightLbs(null)
   setWorkoutPlan(emptyWorkoutPlan(next))
   setEntries([])
   setTotals(emptyDailyNutritionTotals(next))
   setNutritionLoading(true)
   setSelectedDate(next)
  }
 }

 async function addQuick(event:FormEvent){
  event.preventDefault()
  if(!session||nutritionBusy)return
  const amount=Number(quickValue)
  if(!Number.isFinite(amount)||amount<=0){setNutritionError('Enter a value greater than zero.');return}
  const logDate=selectedDate
  setNutritionBusy('quick')
  setNutritionError('')
  try{
   if(quickMetric==='steps'||quickMetric==='water_oz'){
    const nextMetrics=await incrementDailyMetric(
     supabase,session.user.id,logDate,quickMetric,amount
    )
    if(selectedDateRef.current===logDate){
     setQuickValue('')
     setMetrics(current=>({
      ...current,
      id:nextMetrics.id,
      [quickMetric]:nextMetrics[quickMetric]
     }))
     setNutritionNotice({text:`Added ${metricLabels[quickMetric].toLowerCase()} ✓`,entryId:null,logDate})
    }
    return
   }
   const values:{calories:number|null;protein_g:number|null;carbs_g:number|null}={calories:null,protein_g:null,carbs_g:null}
   values[quickMetric]=amount
   const entry=await createNutritionEntry(supabase,{
    userId:session.user.id,logDate,entryType:'quick_add',description:`Quick add: ${metricLabels[quickMetric]}`,
    source:'quick_add',...values
   })
   if(selectedDateRef.current===logDate){
    setQuickValue('')
    setNutritionNotice({text:`Added ${metricLabels[quickMetric].toLowerCase()} ✓`,entryId:entry.id,logDate})
   }
   try{await refreshNutrition(logDate)}catch{
    if(selectedDateRef.current===logDate)setNutritionError('Added successfully, but totals could not refresh. Reload to see the latest values.')
   }
  }catch(error){if(selectedDateRef.current===logDate)setNutritionError(errorText(error))}
  finally{setNutritionBusy(null)}
 }

 async function addMeal(event:FormEvent){
  event.preventDefault()
  if(!session||nutritionBusy)return
  const logDate=selectedDate
  setNutritionBusy('meal')
  setNutritionError('')
  try{
   const calories=parseMetric(meal.calories,'Calories')
   const protein_g=parseMetric(meal.protein_g,'Protein')
   const carbs_g=parseMetric(meal.carbs_g,'Carbs')
   const entry=await createNutritionEntry(supabase,{
    userId:session.user.id,logDate,entryType:'food',description:meal.description,
    mealSlot:meal.mealSlot||null,source:'manual',calories,protein_g,carbs_g
   })
   setMeal(blankMeal())
   setMealOpen(false)
   if(selectedDateRef.current===logDate)setNutritionNotice({text:'Meal added ✓',entryId:entry.id,logDate})
   try{await refreshNutrition(logDate)}catch{
    if(selectedDateRef.current===logDate)setNutritionError('Meal saved, but totals could not refresh. Reload to see the latest values.')
   }
  }catch(error){if(selectedDateRef.current===logDate)setNutritionError(errorText(error))}
  finally{setNutritionBusy(null)}
 }

 async function addDrink(description:string){
  if(!session||nutritionBusy)return
  const logDate=selectedDate
  setNutritionBusy(`drink:${description}`)
  setNutritionError('')
  try{
   const entry=await createNutritionEntry(supabase,{
    userId:session.user.id,logDate,entryType:'drink',description,source:'quick_add',calories:100,alcohol_servings:1
   })
   if(selectedDateRef.current===logDate)setNutritionNotice({text:`${description} added ✓`,entryId:entry.id,logDate})
   try{await refreshNutrition(logDate)}catch{
    if(selectedDateRef.current===logDate)setNutritionError(`${description} saved, but totals could not refresh. Reload to see the latest values.`)
   }
  }catch(error){if(selectedDateRef.current===logDate)setNutritionError(errorText(error))}
  finally{setNutritionBusy(null)}
 }

 async function undoLastAdd(){
  if(!session||!nutritionNotice?.entryId||nutritionBusy)return
  const notice=nutritionNotice
  setNutritionBusy('undo')
  setNutritionError('')
  try{
   await deleteNutritionEntry(supabase,session.user.id,notice.logDate,notice.entryId)
   await refreshNutrition(notice.logDate)
   if(selectedDateRef.current===notice.logDate)setNutritionNotice(null)
  }catch(error){if(selectedDateRef.current===notice.logDate)setNutritionError(errorText(error))}
  finally{setNutritionBusy(null)}
 }

 async function toggleWorkout(){
  if(!session||workoutBusy)return
  const logDate=selectedDate
  const plan=workoutPlan
  setWorkoutBusy(true)
  setMsg('')
  try{
   await setWorkoutCompletion(supabase,{
    userId:session.user.id,
    logDate,
    code:plan.code,
    completed:!plan.completed,
    session:plan.session,
    isToday:logDate===localISO()
   })
   const refreshed=await getWorkoutPlan(supabase,session.user.id,logDate)
   if(selectedDateRef.current===logDate)setWorkoutPlan(refreshed)
  }catch(error){
   if(selectedDateRef.current===logDate)setMsg(errorText(error))
  }finally{
   setWorkoutBusy(false)
  }
 }

 function beginEdit(entry:NutritionEntry){
  setNutritionError('')
  setEditingId(entry.id)
  setEditDraft({
   description:entry.description,mealSlot:entry.meal_slot||'',calories:entry.calories?.toString()||'',
   protein_g:entry.protein_g?.toString()||'',carbs_g:entry.carbs_g?.toString()||''
  })
 }

 async function saveEntryEdit(event:FormEvent,entry:NutritionEntry){
  event.preventDefault()
  if(!session||!editDraft||nutritionBusy)return
  const logDate=selectedDate
  setNutritionBusy(`edit:${entry.id}`)
  setNutritionError('')
  try{
   await updateNutritionEntry(supabase,session.user.id,logDate,entry.id,{
    description:editDraft.description,mealSlot:editDraft.mealSlot||null,
    calories:parseMetric(editDraft.calories,'Calories'),protein_g:parseMetric(editDraft.protein_g,'Protein'),
    carbs_g:parseMetric(editDraft.carbs_g,'Carbs')
   })
   await refreshNutrition(logDate)
   if(selectedDateRef.current===logDate){
    setEditingId(null)
    setEditDraft(null)
    setNutritionNotice(null)
   }
  }catch(error){if(selectedDateRef.current===logDate)setNutritionError(errorText(error))}
  finally{setNutritionBusy(null)}
 }

 async function removeEntry(entry:NutritionEntry){
  if(!session||nutritionBusy)return
  const warning=entry.source==='legacy'
   ?'Delete this imported daily total? This removes the historical nutrition baseline for the entire day and cannot be undone.'
   :`Delete “${displayDescription(entry)}”?`
  if(!window.confirm(warning))return
  const logDate=selectedDate
  setNutritionBusy(`delete:${entry.id}`)
  setNutritionError('')
  try{
   await deleteNutritionEntry(supabase,session.user.id,logDate,entry.id)
   await refreshNutrition(logDate)
   if(selectedDateRef.current===logDate){
    if(editingId===entry.id){setEditingId(null);setEditDraft(null)}
    if(nutritionNotice?.entryId===entry.id)setNutritionNotice(null)
   }
  }catch(error){if(selectedDateRef.current===logDate)setNutritionError(errorText(error))}
  finally{setNutritionBusy(null)}
 }

 if(!session)return <main className="loginPage">
  <div className="brand">cut<span>165</span></div>
  <section className="loginCopy">
   <p className="eyebrow">PERSONAL CUT · 11.11.26</p>
   <h1>Build the habits.<br/>Keep the life.</h1>
   <p className="lede">A quiet daily dashboard for reaching 165 without making food, drinks, or fitness your entire personality.</p>
  </section>
  <form onSubmit={auth} className="loginForm">
   <input type="email" placeholder="Email" value={email} onChange={event=>setEmail(event.target.value)} required/>
   <input type="password" placeholder="Password" value={password} onChange={event=>setPassword(event.target.value)} required/>
   <button>Enter</button>
   <small>{msg||'Sign in, or use a new email to create your account.'}</small>
  </form>
 </main>

 return <main className="app">
  <nav>
   <div className="brand">cut<span>165</span></div>
   <div className="navRight"><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
  </nav>

  <div className="dateNav" aria-label="Select log date">
   <button onClick={()=>changeDate(-1)} aria-label="Previous day">‹</button>
   <strong>{localDate(selectedDate).toLocaleDateString(undefined,{month:'short',day:'numeric'}).toUpperCase()} <i>·</i> {training.dayLabel}</strong>
   <button onClick={()=>changeDate(1)} disabled={isToday} aria-label="Next day">›</button>
  </div>
  {isToday&&new Date().getHours()<4&&<button className="yesterdayShortcut" onClick={()=>changeDate(-1)}>Still logging yesterday?</button>}

  <section className="trainingWrap">
   <p className="eyebrow">{isToday?"TODAY'S TRAINING":"PRESCRIBED TRAINING"}</p>
   <details className="trainingCard">
    <summary>
     <span className="trainingTitle"><strong>{training.name}</strong><small>{training.type} <i>·</i> {training.duration}</small></span>
     <span className="trainingToggle" aria-hidden="true">+</span>
    </summary>
    <div className="trainingBody">
     {training.kind==='strength'&&<div className="exerciseList">
      <p className="trainingFocus">{training.focus}</p>
      <div className="exerciseHead"><span>Exercise</span><span>Sets</span><span>Reps</span></div>
      {training.exercises.map(([exercise,sets,reps])=><div className="exerciseRow" key={exercise}>
       <strong>{exercise}</strong><span>{sets}</span><span>{reps}</span>
      </div>)}
     </div>}
     {training.kind==='recovery'&&<div className="trainingNote"><strong>Goal: 5,000+ steps</strong><p>Optional easy cardio / mobility</p></div>}
     <button className={`completeWorkout ${workoutPlan.completed?'done':''}`} onClick={toggleWorkout} disabled={workoutBusy}>
      <span>{workoutBusy?'Updating…':workoutPlan.completed?'Workout complete':'Mark workout complete'}</span><b>{workoutPlan.completed?'✓':'○'}</b>
     </button>
    </div>
   </details>
  </section>

  <section className={`goalCard p${Math.min(4,Math.floor(progress/25)+1)}`}>
   <div><p className="eyebrow">PROGRESS TO YOUR GOAL</p><div className="weightLine"><strong>{latest}</strong><span>lb</span><i>→</i><b>165</b><span>lb</span></div></div>
   <div className="goalMeta"><strong>{lost.toFixed(1)} lb</strong><span>down</span><strong>{progress.toFixed(0)}%</strong><span>complete</span></div>
   <div className="bar"><i style={{width:`${progress}%`}}/></div>
  </section>

  <div className="sectionHead">
   <div><p className="eyebrow">DAILY SIGNALS</p><h2>{isToday?'Today':selectedLabel}</h2></div>
   <span className={`signal ${status[1]}`}>● {status[0]}</span>
  </div>

  <section className="quickAdd">
   <form className="quickAddBar" onSubmit={addQuick}>
    <span className="eyebrow">QUICK ADD</span>
    <select value={quickMetric} onChange={event=>setQuickMetric(event.target.value as MetricKey)} aria-label="Metric to add">
     <option value="calories">Calories</option><option value="protein_g">Protein</option><option value="carbs_g">Carbs</option><option value="water_oz">Water</option><option value="steps">Steps</option>
    </select>
    <input type="number" min="0" step={quickMetric==='steps'?'1':'any'} inputMode="decimal" placeholder="0" value={quickValue} onChange={event=>setQuickValue(event.target.value)} aria-label="Amount to add"/>
    <button disabled={Number(quickValue)<=0||nutritionBusy!==null}>{nutritionBusy==='quick'?'Adding…':'+ Add'}</button>
   </form>
   <details className="addMeal" open={mealOpen} onToggle={event=>setMealOpen(event.currentTarget.open)}>
    <summary>Add meal</summary>
    <form className="mealFields" onSubmit={addMeal}>
     <label className="mealDescription"><span>Description</span><input type="text" placeholder="Dinner" value={meal.description} onChange={event=>setMeal({...meal,description:event.target.value})} required/></label>
     <label><span>Meal</span><select value={meal.mealSlot} onChange={event=>setMeal({...meal,mealSlot:event.target.value as ''|MealSlot})}><option value="">Optional</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label>
     <label><span>Calories</span><input type="number" min="0" step="any" inputMode="decimal" placeholder="—" value={meal.calories} onChange={event=>setMeal({...meal,calories:event.target.value})}/></label>
     <label><span>Protein</span><input type="number" min="0" step="any" inputMode="decimal" placeholder="— g" value={meal.protein_g} onChange={event=>setMeal({...meal,protein_g:event.target.value})}/></label>
     <label><span>Carbs</span><input type="number" min="0" step="any" inputMode="decimal" placeholder="— g" value={meal.carbs_g} onChange={event=>setMeal({...meal,carbs_g:event.target.value})}/></label>
     <button disabled={nutritionBusy!==null}>{nutritionBusy==='meal'?'Adding…':`Add to ${isToday?'today':selectedLabel}`}</button>
    </form>
   </details>
   {(nutritionError||nutritionNotice)&&<div className={`nutritionFeedback ${nutritionError?'error':''}`} role="status">
    <span>{nutritionError||nutritionNotice?.text}</span>
    {!nutritionError&&nutritionNotice?.entryId&&<button type="button" onClick={undoLastAdd} disabled={nutritionBusy!==null}>Undo</button>}
   </div>}
  </section>

  <section className="metrics">
   <NutritionMetric kind="calories" icon="◒" label="Calories" value={totals.calories} unit="kcal" target="Goal · 1,650–1,800" partial={totals.calories_unknown_count>0} loading={nutritionLoading}/>
   <NutritionMetric kind="protein" icon="◆" label="Protein" value={totals.protein_g} unit="g" target="Goal · 140–150+" partial={totals.protein_unknown_count>0} loading={nutritionLoading}/>
   <Metric kind="steps" icon="↗" label="Steps" value={metrics.steps} unit="" target="Goal · 5,000+" onChange={value=>metricNumber('steps',value)}/>
   <Metric kind="weight" icon="●" label="Weight" value={weightLbs} unit="lb" target="Destination · 165 lb" step=".1" onChange={value=>setWeightLbs(value===''?null:Number(value))}/>
  </section>

  <section className="softGrid">
   <label className="softCard"><span>Water <small>Goal · 80 oz/day</small></span><div><input type="number" value={metrics.water_oz??''} placeholder="0" onChange={event=>metricNumber('water_oz',event.target.value)}/><b>/ 80 oz</b></div></label>
   <article className="softCard nutritionSoft"><span>Carbs <small>Flexible · 100–150g</small></span><div><strong>{nutritionLoading?'—':formatNumber(totals.carbs_g)}</strong><b>g</b>{totals.carbs_unknown_count>0&&<em>partial</em>}</div></article>
  </section>

  <section className="drinkCard">
   <div><p className="eyebrow">DRINKS</p><h2>{nutritionLoading?'—':formatNumber(totals.alcohol_servings,2)} <span>{isToday?'drinks today':`drinks · ${selectedLabel}`}</span></h2><p>Quick adds include estimated alcohol calories in the daily total.</p></div>
   <div className="drinkBtns">
    <button onClick={()=>addDrink('Highball')} disabled={nutritionBusy!==null}>+ Highball <small>100 kcal</small></button>
    <button onClick={()=>addDrink('Tequila soda')} disabled={nutritionBusy!==null}>+ Tequila soda <small>100 kcal</small></button>
   </div>
  </section>

  <section className="nutritionEntries" aria-busy={nutritionLoading}>
   <div className="nutritionEntriesHead"><div><p className="eyebrow">NUTRITION ENTRIES</p><h3>{isToday?'Today':selectedLabel}</h3></div><span>{entries.length} {entries.length===1?'entry':'entries'}</span></div>
   {nutritionLoading&&<p className="entryEmpty">Loading nutrition…</p>}
   {!nutritionLoading&&!entries.length&&<p className="entryEmpty">No nutrition logged for this day yet.</p>}
   {!nutritionLoading&&entries.map(entry=>editingId===entry.id&&editDraft?
    <form className="entryEdit" key={entry.id} onSubmit={event=>saveEntryEdit(event,entry)}>
     <div className="entryEditTop"><input type="text" value={editDraft.description} onChange={event=>setEditDraft({...editDraft,description:event.target.value})} aria-label="Description" required/><select value={editDraft.mealSlot} onChange={event=>setEditDraft({...editDraft,mealSlot:event.target.value as ''|MealSlot})} aria-label="Meal slot"><option value="">No meal slot</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></div>
     <div className="entryEditMetrics"><label>Calories<input type="number" min="0" step="any" value={editDraft.calories} onChange={event=>setEditDraft({...editDraft,calories:event.target.value})}/></label><label>Protein<input type="number" min="0" step="any" value={editDraft.protein_g} onChange={event=>setEditDraft({...editDraft,protein_g:event.target.value})}/></label><label>Carbs<input type="number" min="0" step="any" value={editDraft.carbs_g} onChange={event=>setEditDraft({...editDraft,carbs_g:event.target.value})}/></label></div>
     {entry.alcohol_servings!==null&&<small>Alcohol servings remain {formatNumber(entry.alcohol_servings,2)}.</small>}
     <div className="entryActions"><button disabled={nutritionBusy!==null}>{nutritionBusy===`edit:${entry.id}`?'Saving…':'Save entry'}</button><button type="button" className="quiet" onClick={()=>{setEditingId(null);setEditDraft(null)}} disabled={nutritionBusy!==null}>Cancel</button><button type="button" className="delete" onClick={()=>removeEntry(entry)} disabled={nutritionBusy!==null}>Delete</button></div>
    </form>
    :<article className="entryRow" key={entry.id}>
     <div><span className="entryLabel">{entry.meal_slot||entry.entry_type.replace('_',' ')}</span><strong>{displayDescription(entry)}</strong><small>{entrySummary(entry)}</small></div>
     <div className="entryRowActions"><button onClick={()=>beginEdit(entry)} disabled={nutritionBusy!==null}>Edit</button><button onClick={()=>removeEntry(entry)} disabled={nutritionBusy!==null}>Delete</button></div>
    </article>)}
  </section>

  <section className="movement"><button className={metrics.cardio_minutes?'done':''} onClick={()=>setMetrics(current=>({...current,cardio_minutes:current.cardio_minutes?null:30}))}><span>Optional Cardio</span><b>{metrics.cardio_minutes?`${metrics.cardio_minutes} min ✓`:'Add 30 min'}</b></button></section>

  <label className="notes"><span>Notes</span><textarea placeholder="Dinner out, wine tasting, hunger, workout, anything useful..." value={metrics.notes||''} onChange={event=>setMetrics(current=>({...current,notes:event.target.value}))}/></label>

  <button className="save" onClick={save}><span>{msg==='Saved'?'Saved ✓':msg==='Saving'?'Saving...':`Save ${isToday?'today':selectedLabel}`}</span><b>↗</b></button>
 </main>
}

function NutritionMetric({kind,icon,label,value,unit,target,partial,loading}:{
 kind:string;icon:string;label:string;value:number|null;unit:string;target:string;partial:boolean;loading:boolean
}){
 return <article className={`metric ${kind} nutritionMetric`}>
  <div className="metricTop"><i>{icon}</i><span>{label}</span>{partial&&<em>partial</em>}</div>
  <div className="metricValue"><strong>{loading?'—':formatNumber(value)}</strong><b>{unit}</b></div>
  <small>{target}</small>
 </article>
}

function Metric({kind,icon,label,value,unit,target,onChange,step='1'}:{
 kind:string;icon:string;label:string;value:number|null;unit:string;target:string;onChange:(value:string)=>void;step?:string
}){
 return <label className={`metric ${kind}`}>
  <div className="metricTop"><i>{icon}</i><span>{label}</span></div>
  <div className="metricValue"><input type="number" step={step} value={value??''} placeholder="—" onChange={event=>onChange(event.target.value)}/><b>{unit}</b></div>
  <small>{target}</small>
 </label>
}

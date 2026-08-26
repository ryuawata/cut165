'use client'
import {FormEvent,useEffect,useMemo,useState} from 'react'
import {supabase} from '../lib/supabase'

type Log={
 log_date:string
 weight_lbs:number|null
 calories:number|null
 protein_g:number|null
 carbs_g:number|null
 steps:number|null
 water_oz:number|null
 strength:boolean
 cardio_minutes:number
 alcohol_drinks:number
 notes:string|null
}

const today=()=>new Date().toLocaleDateString('en-CA')
const blank=():Log=>({
 log_date:today(),weight_lbs:null,calories:null,protein_g:null,carbs_g:null,
 steps:null,water_oz:null,strength:false,cardio_minutes:0,alcohol_drinks:0,notes:''
})

const workouts={
 1:{name:'Full Body A',focus:'Squat + horizontal push/pull',exercises:[
  ['Goblet squat','3','8–12'],['Dumbbell Romanian deadlift','3','8–12'],
  ['Dumbbell bench/floor press','3','8–12'],['One-arm dumbbell row','3','10–12/side'],
  ['Dumbbell lateral raise','2','12–15'],['Kettlebell swings','3','15'],['Plank','2','30–60 sec']
 ]},
 3:{name:'Full Body B',focus:'Single-leg + shoulders/back',exercises:[
  ['Dumbbell reverse lunge','3','8–10/leg'],['Kettlebell sumo deadlift','3','10–12'],
  ['Dumbbell overhead press','3','8–12'],['Lat pulldown at HOA gym','3','8–12'],
  ['Incline dumbbell press','2','10–12'],['Dumbbell curls','2','10–15'],['Dead bug','2','8–12/side']
 ]},
 5:{name:'Full Body C',focus:'Athletic/metabolic full body',exercises:[
  ['Dumbbell split squat','3','8–10/leg'],['Dumbbell hip thrust/glute bridge','3','10–15'],
  ['Push-ups','3','8–15'],['Seated cable row or dumbbell row','3','10–12'],
  ['Dumbbell shoulder press','2','8–12'],['Kettlebell swings','3','15–20'],['Farmer carry','3','30–45 sec']
 ]}
} as const

function getTraining(){
 const day=new Date().getDay()
 const dayLabel=['SUN','MON','TUE','WED','THU','FRI','SAT'][day]
 if(day===1||day===3||day===5)return {...workouts[day],dayLabel,duration:'25–35 min',kind:'strength' as const}
 if(day===2||day===4)return {name:'Recovery + movement',dayLabel,duration:'5,000+ steps',kind:'movement' as const}
 if(day===6)return {name:'Optional cardio, swim, or gym',dayLabel,duration:'Your pace',kind:'optional' as const}
 return {name:'Recovery',dayLabel,duration:'5,000+ steps',kind:'recovery' as const}
}

export default function Page(){
 const [session,setSession]=useState<any>(null)
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [msg,setMsg]=useState('')
 const [log,setLog]=useState<Log>(blank())
 const [history,setHistory]=useState<Log[]>([])
 const training=getTraining()

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSession(data.session))
  const {data}=supabase.auth.onAuthStateChange((_,s)=>setSession(s))
  return()=>data.subscription.unsubscribe()
 },[])

 useEffect(()=>{if(session)load()},[session])

 async function load(){
  const {data}=await supabase.from('daily_logs').select('*').order('log_date',{ascending:false}).limit(45)
  const rows=(data||[]) as Log[]
  setHistory(rows)
  setLog(rows.find(x=>x.log_date===today())||blank())
 }

 async function auth(e:FormEvent){
  e.preventDefault()
  setMsg('')
  const signed=await supabase.auth.signInWithPassword({email,password})
  if(!signed.error)return
  const created=await supabase.auth.signUp({email,password})
  setMsg(created.error?.message||'Account created. Check your inbox if confirmation is enabled.')
 }

 async function save(){
  setMsg('Saving')
  const {error}=await supabase.from('daily_logs').upsert(
   {...log,user_id:session.user.id,updated_at:new Date().toISOString()},
   {onConflict:'user_id,log_date'}
  )
  setMsg(error?error.message:'Saved')
  if(!error)load()
 }

 const latest=history.find(x=>x.weight_lbs!=null)?.weight_lbs??180
 const lost=Math.max(0,180-latest)
 const progress=Math.max(0,Math.min(100,lost/15*100))
 const status=useMemo(()=>{
  if(log.calories==null)return ['Open','open']
  if(log.calories<=1800&&Number(log.protein_g||0)>=140)return ['On pace','good']
  if(log.calories<=1950)return ['Close','warn']
  return ['Over target','bad']
 },[log.calories,log.protein_g])

 const number=(key:keyof Log,value:string)=>setLog({...log,[key]:value===''?null:Number(value)})
 const addDrink=(calories:number)=>setLog({
  ...log,
  alcohol_drinks:Number(log.alcohol_drinks||0)+1,
  calories:Number(log.calories||0)+calories
 })

 if(!session)return <main className="loginPage">
  <div className="brand">cut<span>165</span></div>
  <section className="loginCopy">
   <p className="eyebrow">PERSONAL CUT · 11.11.26</p>
   <h1>Build the habits.<br/>Keep the life.</h1>
   <p className="lede">A quiet daily dashboard for reaching 165 without making food, drinks, or fitness your entire personality.</p>
  </section>
  <form onSubmit={auth} className="loginForm">
   <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
   <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>
   <button>Enter</button>
   <small>{msg||'Sign in, or use a new email to create your account.'}</small>
  </form>
 </main>

 return <main className="app">
  <nav>
   <div className="brand">cut<span>165</span></div>
   <div className="navRight">
    <span>{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>
    <button onClick={()=>supabase.auth.signOut()}>Sign out</button>
   </div>
  </nav>

  <section className="trainingWrap">
   <p className="eyebrow">TODAY'S TRAINING</p>
   <details className="trainingCard">
    <summary>
     <span className="trainingTitle"><strong><i>{training.dayLabel}</i> · {training.name}</strong><small>{training.duration}</small></span>
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
     {(training.kind==='movement'||training.kind==='recovery')&&<div className="trainingNote">
      <strong>Keep the body moving.</strong>
      <p>Reach 5,000+ steps and add optional easy cardio if it feels good.</p>
     </div>}
     {training.kind==='optional'&&<div className="trainingNote">
      <strong>Choose what supports the week.</strong>
      <p>Take an easy cardio or swimming session, or head to the gym—everything is optional today.</p>
     </div>}
     <button className={`completeWorkout ${log.strength?'done':''}`} onClick={()=>setLog({...log,strength:!log.strength})}>
      <span>{log.strength?'Workout complete':'Mark workout complete'}</span><b>{log.strength?'✓':'○'}</b>
     </button>
    </div>
   </details>
  </section>

  <section className={`goalCard p${Math.min(4,Math.floor(progress/25)+1)}`}>
   <div>
    <p className="eyebrow">PROGRESS TO YOUR GOAL</p>
    <div className="weightLine"><strong>{latest}</strong><span>lb</span><i>→</i><b>165</b><span>lb</span></div>
   </div>
   <div className="goalMeta">
    <strong>{lost.toFixed(1)} lb</strong><span>down</span>
    <strong>{progress.toFixed(0)}%</strong><span>complete</span>
   </div>
   <div className="bar"><i style={{width:`${progress}%`}}/></div>
  </section>

  <div className="sectionHead">
   <div><p className="eyebrow">DAILY SIGNALS</p><h2>Today</h2></div>
   <span className={`signal ${status[1]}`}>● {status[0]}</span>
  </div>

  <section className="metrics">
   <Metric kind="calories" icon="◒" label="Calories" value={log.calories} unit="kcal" target="Goal · 1,650–1,800" onChange={v=>number('calories',v)}/>
   <Metric kind="protein" icon="◆" label="Protein" value={log.protein_g} unit="g" target="Goal · 140–150+" onChange={v=>number('protein_g',v)}/>
   <Metric kind="steps" icon="↗" label="Steps" value={log.steps} unit="" target="Goal · 5,000+" onChange={v=>number('steps',v)}/>
   <Metric kind="weight" icon="●" label="Weight" value={log.weight_lbs} unit="lb" target="Destination · 165 lb" step=".1" onChange={v=>number('weight_lbs',v)}/>
  </section>

  <section className="softGrid">
   <label className="softCard">
    <span>Water <small>Goal · 80 oz/day</small></span>
    <div><input type="number" value={log.water_oz??''} placeholder="0" onChange={e=>number('water_oz',e.target.value)}/><b>/ 80 oz</b></div>
   </label>
   <label className="softCard">
    <span>Carbs <small>Flexible · 100–150g</small></span>
    <div><input type="number" value={log.carbs_g??''} placeholder="0" onChange={e=>number('carbs_g',e.target.value)}/><b>g</b></div>
   </label>
  </section>

  <section className="drinkCard">
   <div>
    <p className="eyebrow">KEEP THE DRINKS VISIBLE</p>
    <h2>{log.alcohol_drinks||0} <span>drinks today</span></h2>
    <p>Quick adds include estimated alcohol calories in your daily calorie total.</p>
   </div>
   <div className="drinkBtns">
    <button onClick={()=>addDrink(100)}>+ Highball <small>100 kcal</small></button>
    <button onClick={()=>addDrink(100)}>+ Tequila soda <small>100 kcal</small></button>
   </div>
  </section>

  <section className="movement">
   <button className={log.cardio_minutes?'done':''} onClick={()=>setLog({...log,cardio_minutes:log.cardio_minutes?0:30})}><span>Optional Cardio</span><b>{log.cardio_minutes?'30 min ✓':'Add 30 min'}</b></button>
  </section>

  <label className="notes">
   <span>Notes</span>
   <textarea placeholder="Dinner out, wine tasting, hunger, workout, anything useful..." value={log.notes||''} onChange={e=>setLog({...log,notes:e.target.value})}/>
  </label>

  <button className="save" onClick={save}><span>{msg==='Saved'?'Saved ✓':msg==='Saving'?'Saving...':'Save today'}</span><b>↗</b></button>
 </main>
}

function Metric({kind,icon,label,value,unit,target,onChange,step='1'}:{
 kind:string;icon:string;label:string;value:number|null;unit:string;target:string;onChange:(v:string)=>void;step?:string
}){
 return <label className={`metric ${kind}`}>
  <div className="metricTop"><i>{icon}</i><span>{label}</span></div>
  <div className="metricValue"><input type="number" step={step} value={value??''} placeholder="—" onChange={e=>onChange(e.target.value)}/><b>{unit}</b></div>
  <small>{target}</small>
 </label>
}

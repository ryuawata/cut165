'use client'
import {FormEvent,useEffect,useMemo,useState} from 'react'
import {supabase} from '../lib/supabase'

type Log={log_date:string;weight_lbs:number|null;calories:number|null;protein_g:number|null;steps:number|null;water_oz:number|null;strength:boolean;cardio_minutes:number;alcohol_drinks:number;notes:string|null}
const date=()=>new Date().toLocaleDateString('en-CA')
const blank=():Log=>({log_date:date(),weight_lbs:null,calories:null,protein_g:null,steps:null,water_oz:null,strength:false,cardio_minutes:0,alcohol_drinks:0,notes:''})

export default function Page(){
 const [session,setSession]=useState<any>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[msg,setMsg]=useState('')
 const [log,setLog]=useState<Log>(blank()),[history,setHistory]=useState<Log[]>([])
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[])
 useEffect(()=>{if(session)load()},[session])
 async function load(){const {data}=await supabase.from('daily_logs').select('*').order('log_date',{ascending:false}).limit(45);const rows=(data||[]) as Log[];setHistory(rows);setLog(rows.find(x=>x.log_date===date())||blank())}
 async function auth(e:FormEvent){e.preventDefault();setMsg('');const a=await supabase.auth.signInWithPassword({email,password});if(!a.error)return;const b=await supabase.auth.signUp({email,password});setMsg(b.error?.message||'Account created. Check your inbox if confirmation is enabled.')}
 async function save(){setMsg('Saving');const {error}=await supabase.from('daily_logs').upsert({...log,user_id:session.user.id,updated_at:new Date().toISOString()},{onConflict:'user_id,log_date'});setMsg(error?error.message:'Saved');if(!error)load()}
 const latest=history.find(x=>x.weight_lbs!=null)?.weight_lbs
 const lost=latest?180-latest:0, progress=Math.max(0,Math.min(100,lost/15*100))
 const status=useMemo(()=>log.calories==null?['OPEN','open']:log.calories<=1800&&Number(log.protein_g||0)>=140?['ON PACE','good']:log.calories<=1950?['CLOSE','warn']:['OVER','bad'],[log])
 const n=(k:keyof Log,v:string)=>setLog({...log,[k]:v===''?null:Number(v)})
 if(!session)return <main className="loginPage"><div className="brand">CUT<span>/</span>165</div><section className="loginCopy"><p>11.11.26</p><h1>Less noise.<br/>More signal.</h1><div className="rule"/><p className="lede">A private daily system for getting from 180 to 165 without putting your life on hold.</p></section><form onSubmit={auth} className="loginForm"><input type="email" placeholder="EMAIL" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="PASSWORD" value={password} onChange={e=>setPassword(e.target.value)} required/><button>ENTER <span>↗</span></button><small>{msg||'New here? Enter your email and password to create an account.'}</small></form></main>
 return <main className="app">
  <nav><div className="brand">CUT<span>/</span>165</div><div className="navRight"><span>{log.log_date.replaceAll('-','.')}</span><button onClick={()=>supabase.auth.signOut()}>EXIT</button></div></nav>
  <section className="mast"><div><p className="kicker">CURRENT CUT</p><h1>{latest??'180'}<sup>LB</sup></h1></div><div className="goalText"><p>DESTINATION</p><strong>165</strong><span>LB</span></div></section>
  <section className="progress"><div className="progressLine"><i style={{width:`${progress}%`}}/></div><div><span>{lost>0?lost.toFixed(1):'0'} LB DOWN</span><span>{progress.toFixed(0)}%</span><span>15 LB TOTAL</span></div></section>
  <div className="sectionHead"><h2>Today</h2><div className={`signal ${status[1]}`}><i/>{status[0]}</div></div>
  <section className="metrics">
   <Metric index="01" label="Calories" value={log.calories} unit="KCAL" target="1,650 — 1,800" onChange={v=>n('calories',v)}/>
   <Metric index="02" label="Protein" value={log.protein_g} unit="G" target="140 — 150+" onChange={v=>n('protein_g',v)}/>
   <Metric index="03" label="Steps" value={log.steps} unit="" target="5,000+ / DAY" onChange={v=>n('steps',v)}/>
   <Metric index="04" label="Weight" value={log.weight_lbs} unit="LB" target="165 DESTINATION" step=".1" onChange={v=>n('weight_lbs',v)}/>
  </section>
  <section className="actions">
   <button className={log.strength?'active':''} onClick={()=>setLog({...log,strength:!log.strength})}><span>STRENGTH</span><b>{log.strength?'DONE':'ADD'}</b></button>
   <button className={log.cardio_minutes>0?'active':''} onClick={()=>setLog({...log,cardio_minutes:log.cardio_minutes?0:30})}><span>CARDIO</span><b>{log.cardio_minutes?`${log.cardio_minutes} MIN`:'ADD'}</b></button>
   <Quick label="HIGHBALL" value={log.alcohol_drinks} onClick={()=>setLog({...log,alcohol_drinks:Number(log.alcohol_drinks||0)+1})}/>
  </section>
  <section className="secondary"><label><span>WATER / OZ</span><input type="number" value={log.water_oz??''} onChange={e=>n('water_oz',e.target.value)}/></label><label><span>DRINKS</span><input type="number" step=".5" value={log.alcohol_drinks??0} onChange={e=>n('alcohol_drinks',e.target.value)}/></label></section>
  <textarea placeholder="WHAT HAPPENED TODAY?" value={log.notes||''} onChange={e=>setLog({...log,notes:e.target.value})}/>
  <button className="save" onClick={save}><span>{msg==='Saved'?'SAVED':'SAVE DAY'}</span><b>↗</b></button>
  <section className="recent"><div className="sectionHead"><h2>Recent</h2><span>WEIGHT / 07 DAYS</span></div>{history.filter(x=>x.weight_lbs!=null).slice(0,7).map((x,i)=><div className="row" key={x.log_date}><span>0{i+1}</span><p>{new Date(x.log_date+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}).toUpperCase()}</p><strong>{x.weight_lbs}<small> LB</small></strong></div>)}</section>
 </main>
}
function Metric({index,label,value,unit,target,onChange,step='1'}:{index:string;label:string;value:number|null;unit:string;target:string;onChange:(v:string)=>void;step?:string}){return <label className="metric"><span className="num">{index}</span><p>{label}</p><div><input type="number" step={step} value={value??''} placeholder="—" onChange={e=>onChange(e.target.value)}/><b>{unit}</b></div><small>{target}</small></label>}
function Quick({label,value,onClick}:{label:string;value:number;onClick:()=>void}){return <button onClick={onClick}><span>{label}</span><b>+1</b><small>{value||0} TODAY</small></button>}

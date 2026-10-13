'use client'
import {useEffect,useMemo,useState} from 'react'
import './lite.css'
type Entry={id:string;date:string;name:string;calories:number;protein:number;created:number}
type Favorite={name:string;calories:number;protein:number}
type Store={entries:Entry[];favorites:Favorite[];calorieGoal:number;proteinGoal:number}
const initial:Store={entries:[],favorites:[],calorieGoal:1800,proteinGoal:150}
const key='cut365-lite-web-v1'
const iso=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
const dateFrom=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)}
const move=(s:string,days:number)=>{const d=dateFrom(s);d.setDate(d.getDate()+days);return iso(d)}
const valid=(v:string)=>/^\d+(\.\d{1,2})?$/.test(v.trim())&&Number(v)>=0&&Number(v)<=100000
const format=(n:number)=>Number(n.toFixed(1)).toLocaleString()
export default function LitePage(){
 const [store,setStore]=useState<Store>(initial)
 const [ready,setReady]=useState(false)
 const [tab,setTab]=useState<'today'|'saved'|'goals'>('today')
 const [day,setDay]=useState(iso(new Date()))
 const [form,setForm]=useState(false)
 const [editing,setEditing]=useState<string|null>(null)
 const [name,setName]=useState('')
 const [cal,setCal]=useState('')
 const [protein,setProtein]=useState('')
 const [goalCal,setGoalCal]=useState('1800')
 const [goalProtein,setGoalProtein]=useState('150')
 const [error,setError]=useState('')
 useEffect(()=>{try{const raw=localStorage.getItem(key);if(raw){const d=JSON.parse(raw) as Store;if(Array.isArray(d.entries)&&Array.isArray(d.favorites)&&Number.isFinite(d.calorieGoal)&&Number.isFinite(d.proteinGoal)){setStore(d);setGoalCal(String(d.calorieGoal));setGoalProtein(String(d.proteinGoal))}}}catch{setError('Saved data could not be loaded. New changes will not be saved until storage is available.')}setReady(true)},[])
 const update=(next:Store)=>{try{localStorage.setItem(key,JSON.stringify(next));setStore(next);setError('')}catch{setError('Could not save changes. Check your browser storage and try again.')}}
 const items=useMemo(()=>store.entries.filter(e=>e.date===day).sort((a,b)=>b.created-a.created),[store.entries,day])
 const calories=items.reduce((n,e)=>n+e.calories,0),grams=items.reduce((n,e)=>n+e.protein,0)
 const start=()=>{setEditing(null);setName('');setCal('');setProtein('');setForm(true)}
 const edit=(e:Entry)=>{setEditing(e.id);setName(e.name);setCal(String(e.calories));setProtein(String(e.protein));setForm(true)}
 const save=()=>{if(!valid(cal)||!valid(protein)){setError('Enter valid, nonnegative calories and protein (up to 100,000).');return}const old=store.entries.find(e=>e.id===editing);const entry:Entry={id:old?.id??crypto.randomUUID(),date:old?.date??day,name:name.trim().slice(0,80)||'Food entry',calories:Number(cal),protein:Number(protein),created:old?.created??Date.now()};update({...store,entries:old?store.entries.map(e=>e.id===entry.id?entry:e):[...store.entries,entry]});setForm(false)}
 const nav=(t:'today'|'saved'|'goals')=>{setTab(t);setForm(false);setError('')}
 const today=iso(new Date())
 return <div className="liteShell">
  <header className="liteHeader"><div><div className="liteKicker">CUT365 <span>LITE</span></div><h1>{tab==='today'?'Today':tab==='saved'?'Saved foods':'Your goals'}</h1><p>Just calories and protein. Nothing extra.</p></div><div className="liteMark">◌</div></header>
  {error&&<p role="alert" className="liteError">{error}</p>}
  {!ready?<p className="liteEmpty">Loading your log…</p>:<>
   {tab==='today'&&<>
    <div className="liteDate"><button aria-label="Previous day" onClick={()=>{setDay(move(day,-1));setForm(false)}}>‹</button><strong>{dateFrom(day).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</strong><button aria-label="Next day" onClick={()=>{setDay(move(day,1));setForm(false)}}>›</button></div>
    {day!==today&&<button className="liteToday" onClick={()=>setDay(today)}>Jump to today</button>}
    <div className="liteMetrics">
     <section className="liteMetric orange"><span>◉ &nbsp; CALORIES</span><div><strong>{format(calories)}</strong><small>kcal</small></div><div className="liteTrack"><i style={{width:`${Math.min(100,calories/store.calorieGoal*100)}%`}}/></div><p>of {format(store.calorieGoal)} kcal goal</p></section>
     <section className="liteMetric blue"><span>◆ &nbsp; PROTEIN</span><div><strong>{format(grams)}</strong><small>g</small></div><div className="liteTrack"><i style={{width:`${Math.min(100,grams/store.proteinGoal*100)}%`}}/></div><p>of {format(store.proteinGoal)}g goal</p></section>
    </div>
    <div className="liteSectionHead"><h2>Food log</h2><small>{items.length} {items.length===1?'entry':'entries'}</small></div>
    <div className="liteList">{items.length?items.map(e=><div className="liteEntry" key={e.id}><button className="liteEntryMain" onClick={()=>edit(e)}><strong>{e.name}</strong><small>{format(e.calories)} kcal · {format(e.protein)}g protein</small></button><button title="Save favorite" aria-label={'Save '+e.name+' as a favorite'} onClick={()=>update({...store,favorites:[{name:e.name,calories:e.calories,protein:e.protein},...store.favorites.filter(f=>f.name.toLowerCase()!==e.name.toLowerCase())]})}>☆</button><button title="Delete entry" aria-label={'Delete '+e.name} onClick={()=>{if(window.confirm('Delete this food entry?'))update({...store,entries:store.entries.filter(item=>item.id!==e.id)})}}>×</button></div>):<div className="liteEmpty">No entries on this day. Start with a quick log.</div>}</div>
    {form?<div className="liteForm"><h2>{editing?'Edit food':'Add food'}</h2><label>Food name (optional)<input maxLength={80} placeholder="e.g. Greek yogurt" value={name} onChange={e=>setName(e.target.value)}/></label><div className="liteFields"><label>Calories<input inputMode="decimal" placeholder="140" value={cal} onChange={e=>setCal(e.target.value)}/></label><label>Protein (g)<input inputMode="decimal" placeholder="20" value={protein} onChange={e=>setProtein(e.target.value)}/></label></div><button className="litePrimary" onClick={save}>Save entry</button><button className="liteSecondary" onClick={()=>setForm(false)}>Cancel</button></div>:<button className="litePrimary" onClick={start}>＋ Add food</button>}
    <p className="liteHint">Tap a food to edit it. Save with ☆ to quickly log it again.</p>
   </>}
   {tab==='saved'&&<><p className="liteIntro">Your usual foods, ready to log in a single tap. Foods are added to {dateFrom(day).toLocaleDateString(undefined,{month:'short',day:'numeric'})}.</p><div className="liteList">{store.favorites.length?store.favorites.map((f,i)=><div className="liteEntry" key={i}><div className="liteEntryMain"><strong>{f.name}</strong><small>{format(f.calories)} kcal · {format(f.protein)}g protein</small></div><button aria-label={'Add '+f.name} onClick={()=>{update({...store,entries:[...store.entries,{...f,id:crypto.randomUUID(),date:day,created:Date.now()}]});nav('today')}}>＋</button><button aria-label={'Remove '+f.name} onClick={()=>{if(window.confirm('Remove saved food?'))update({...store,favorites:store.favorites.filter((_,index)=>index!==i)})}}>×</button></div>):<div className="liteEmpty">No saved foods yet. Tap ☆ next to an entry on Today.</div>}</div></>}
   {tab==='goals'&&<div className="liteForm"><p className="liteIntro">Set your personal daily targets.</p><label>Daily calories<input inputMode="decimal" value={goalCal} onChange={e=>setGoalCal(e.target.value)}/></label><label>Daily protein (g)<input inputMode="decimal" value={goalProtein} onChange={e=>setGoalProtein(e.target.value)}/></label><button className="litePrimary" onClick={()=>{if(!valid(goalCal)||!valid(goalProtein)||Number(goalCal)===0||Number(goalProtein)===0){setError('Goals must be positive, valid numbers.');return}update({...store,calorieGoal:Number(goalCal),proteinGoal:Number(goalProtein)});nav('today')}}>Save goals</button><p className="liteHint">Your log is stored on this browser only. Clearing browser data can erase it. Your web log does not sync with the iOS app.</p></div>}
  </>}
  <nav className="liteNav" aria-label="Main navigation"><button className={tab==='today'?'active':''} onClick={()=>nav('today')}><span>◫</span>Today</button><button className={tab==='saved'?'active':''} onClick={()=>nav('saved')}><span>☆</span>Saved</button><button className={tab==='goals'?'active':''} onClick={()=>nav('goals')}><span>◎</span>Goals</button></nav>
 </div>
}

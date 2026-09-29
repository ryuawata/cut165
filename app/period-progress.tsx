'use client'
import {useMemo} from 'react'
import type {ChartPoint,PeriodProgress,TrackingView} from '../lib/progress'
import {chartPositions,completeNutritionDays,summarizePeriod} from '../lib/progress'
import {poundsToKilograms} from '../lib/targets'

const number=(value:number|null,digits=0)=>value===null?'—':value.toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits})

function MiniChart({label,points,bounds,color,onDate}:{label:string;points:ChartPoint[];bounds:PeriodProgress['bounds'];color:string;onDate:(date:string)=>void}){
 const width=320,height=92
 const positions=chartPositions(points,bounds,width,height)
 const path=positions.map((point,index)=>`${index?'L':'M'} ${point.x} ${point.y}`).join(' ')
 return <article className="progressChart">
  <div><strong>{label}</strong><span>{points.length} {points.length===1?'logged day':'logged days'}</span></div>
  {points.length===0?<p>No data logged in this period.</p>:<>
   <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} trend with ${points.length} logged ${points.length===1?'day':'days'}`}>
    {points.length>1&&<path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
    {positions.map(point=><circle key={point.date} cx={point.x} cy={point.y} r="4" fill={color}/>) }
   </svg>
   <div className="chartDates">{positions.map(point=><button type="button" key={point.date} style={{left:`${point.x/width*100}%`}} onClick={()=>onDate(point.date)} title={`${point.date}: ${point.value}`}>{Number(point.date.slice(-2))}</button>)}</div>
  </>}
 </article>
}

export default function PeriodProgressView({view,data,weightUnit,onDate}:{
 view:Exclude<TrackingView,'day'>;data:PeriodProgress;weightUnit:'lb'|'kg';onDate:(date:string)=>void
}){
 const summary=useMemo(()=>summarizePeriod(data),[data])
 const weight=(pounds:number)=>weightUnit==='kg'?poundsToKilograms(pounds):pounds
 const weightPoints=data.weights.map(item=>({date:item.log_date,value:weight(item.weight_lbs)}))
 const caloriePoints=completeNutritionDays(data.nutrition,'calories').map(item=>({date:item.log_date,value:item.calories!}))
 const proteinPoints=completeNutritionDays(data.nutrition,'protein_g').map(item=>({date:item.log_date,value:item.protein_g!}))
 const stepPoints=data.metrics.filter(item=>item.steps!==null).map(item=>({date:item.log_date,value:item.steps!}))
 const workoutByDate=new Map<string,number>()
 for(const workout of data.workouts.filter(item=>item.status==='completed'))workoutByDate.set(workout.scheduled_date,(workoutByDate.get(workout.scheduled_date)??0)+1)
 const workoutPoints=[...workoutByDate].map(([date,value])=>({date,value})).sort((a,b)=>a.date.localeCompare(b.date))
 const first=summary.firstWeight===null?null:weight(summary.firstWeight)
 const latest=summary.latestWeight===null?null:weight(summary.latestWeight)
 const change=summary.weightChange===null?null:weight(summary.weightChange)
 const title=view==='week'?'Weekly progress':'Monthly progress'
 return <section className="periodProgress">
  <div className="sectionHead"><div><p className="eyebrow">{view.toUpperCase()} VIEW</p><h2>{title}</h2></div><span>Read only</span></div>
  <div className="periodSummaryGrid">
   <article><span>Weight trend</span><strong>{first===null?'—':number(first,1)} → {latest===null?'—':number(latest,1)} {weightUnit}</strong><small>{change===null?'Need 2 logged weights':`${change>0?'+':''}${number(change,1)} ${weightUnit} · ${summary.weightSampleCount} samples`}</small></article>
   <article><span>Calories</span><strong>{number(summary.averageCalories)} kcal</strong><small>Avg target {number(summary.averageCalorieTarget)} · {summary.completeCalorieDays} complete · {summary.nutritionLoggedDays} logged</small></article>
   <article><span>Protein</span><strong>{number(summary.averageProtein)} g</strong><small>Avg target {number(summary.averageProteinTarget)} g · {summary.completeProteinDays} complete · {summary.nutritionLoggedDays} logged</small></article>
   <article><span>Steps</span><strong>{number(summary.averageSteps)}</strong><small>{summary.stepsLoggedDays} logged days</small></article>
   <article><span>Training</span><strong>{summary.completedWorkouts} completed</strong><small>{summary.completedStrength} strength sessions</small></article>
  </div>
  <div className="progressCharts">
   <MiniChart label="Weight" points={weightPoints} bounds={data.bounds} color="#4f6b62" onDate={onDate}/>
   <MiniChart label="Calories" points={caloriePoints} bounds={data.bounds} color="#d98651" onDate={onDate}/>
   <MiniChart label="Protein" points={proteinPoints} bounds={data.bounds} color="#7c6db2" onDate={onDate}/>
   <MiniChart label="Steps" points={stepPoints} bounds={data.bounds} color="#4d78a8" onDate={onDate}/>
   <MiniChart label="Workouts" points={workoutPoints} bounds={data.bounds} color="#7a8f45" onDate={onDate}/>
  </div>
  <p className="periodFootnote">Averages use complete values only. Partial and missing days are not treated as zero. Tap a date below a chart to open that day.</p>
 </section>
}

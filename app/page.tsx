'use client'
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import Onboarding,{type AccountSetup} from './onboarding'
import GoalSettings from './goal-settings'
import NutritionPresets from './nutrition-presets'
import WorkoutTemplateEditor from './workout-template-editor'
import {supabase} from '../lib/supabase'
import {
 emptyDailyMetrics,getDailyMetrics,saveDailyMetricField,
 type AutosaveDailyMetricKey,type DailyMetrics
} from '../lib/daily-metrics'
import {
 getBodyMeasurement,getRecentWeights,saveBodyWeight,
 type BodyMeasurement,type WeightHistory
} from '../lib/body-measurements'
import {
 getTodayWorkoutCoachingFacts,getWorkoutCoachingFacts,getWorkoutPlan,setWorkoutCompletion,
 type WorkoutPlan
} from '../lib/workouts'
import {
 createNutritionEntry,deleteNutritionEntry,emptyDailyNutritionTotals,
 getDailyNutritionTotals,getNutritionEntries,replaceNutritionTotal,updateNutritionEntry,
 type CorrectableNutritionMetric,type DailyNutritionTotals,type MealSlot,type NutritionEntry
} from '../lib/nutrition'
import {
 completeProfileOnboarding,dismissGettingStarted,getProfile,hasCompleteCalculationProfile,saveCompatibilityTimezone,type Profile
} from '../lib/profile'
import {getActiveGoal,getCurrentGoalTarget,getEffectiveGoalTarget,type Goal,type GoalTarget} from '../lib/goals'
import {calendarDateInTimezone,caloriePace,goalIdentity,goalProgress,hourInTimezone,kilogramsToPounds,poundsToKilograms,primaryCalorieTarget} from '../lib/targets'
import {decideAccountBootstrap,decideCompatibilityTimezone} from '../lib/account-bootstrap'
import {
 calendarWeekBounds,nextProgramWorkout,recommendedWeeklyWorkouts,workoutName
} from '../lib/coaching'
import {
 defaultWorkoutTemplate,getWorkoutTemplates,resolveWorkoutTemplate,snapshotWorkout,
 type WorkoutTemplate
} from '../lib/workout-templates'

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

function emptyWorkoutPlan(_logDate:string):WorkoutPlan{
 return {code:'full_body_a',completed:false,session:null,strengthOpportunity:true}
}

function getTraining(iso:string,plan:WorkoutPlan,templates:WorkoutTemplate[]){
 const date=localDate(iso)
 const dayLabel=date.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()
 if(plan.code==='recovery')return {name:'Recovery + Movement',type:'Recovery',dayLabel,duration:'At your pace',kind:'recovery' as const}
 if(plan.code==='legacy_strength')return {name:'Legacy Strength Workout',type:'Historical strength',dayLabel,duration:'Logged workout',kind:'legacy' as const}
 const template=resolveWorkoutTemplate({
  code:plan.code,completed:plan.completed,snapshot:plan.session?.workout_snapshot??null,templates
 })
 return {...template,exercises:template.exercises.map(exercise=>[exercise.name,exercise.sets,exercise.reps] as const),type:'Strength',dayLabel,duration:'25–35 min',kind:'strength' as const}
}

const errorText=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Please try again.'
const parseMetric=(value:string,label:string)=>{
 if(value.trim()==='')return null
 const parsed=Number(value)
 if(!Number.isFinite(parsed)||parsed<0)throw new Error(`${label} must be a valid non-negative number.`)
 return parsed
}
const formatNumber=(value:number|null,digits=1)=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:digits})
const formatTarget=(value:number|null|undefined,digits=1)=>value===null||value===undefined?'—':formatNumber(value,digits)
const displayWeight=(pounds:number|null,unit:'lb'|'kg')=>pounds===null?null:unit==='kg'?poundsToKilograms(pounds):pounds
const storedWeight=(value:number,unit:'lb'|'kg')=>unit==='kg'?kilogramsToPounds(value):value
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
 const [authLoading,setAuthLoading]=useState(true)
 const [authMode,setAuthMode]=useState<'signin'|'signup'>('signin')
 const [bootstrapStatus,setBootstrapStatus]=useState<'auth-loading'|'signed-out'|'profile-loading'|'onboarding-required'|'dashboard-ready'|'error'>('auth-loading')
 const bootstrapSequence=useRef(0)
 const [profile,setProfile]=useState<Profile|null>(null)
 const [activeGoal,setActiveGoal]=useState<Goal|null>(null)
 const [currentTarget,setCurrentTarget]=useState<GoalTarget|null>(null)
 const [selectedTarget,setSelectedTarget]=useState<GoalTarget|null>(null)
 const [targetLoading,setTargetLoading]=useState(false)
 const [settingsOpen,setSettingsOpen]=useState(false)
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [msg,setMsg]=useState('')
 const [selectedDate,setSelectedDate]=useState(localISO())
 const selectedDateRef=useRef(selectedDate)
 const loadSequence=useRef(0)
 const workoutFactsSequence=useRef(0)
 const [metrics,setMetrics]=useState<DailyMetrics>(()=>emptyDailyMetrics(localISO()))
 const [measurement,setMeasurement]=useState<BodyMeasurement|null>(null)
 const [weightLbs,setWeightLbs]=useState<number|null>(null)
 const [weightHistory,setWeightHistory]=useState<WeightHistory[]>([])
 const [workoutPlan,setWorkoutPlan]=useState<WorkoutPlan>(()=>emptyWorkoutPlan(localISO()))
 const [workoutFacts,setWorkoutFacts]=useState<{
  lastCompleted:'full_body_a'|'full_body_b'|'full_body_c'|null
  lastCompletedDate:string|null
  completedThisWeek:number
  strengthRecommended:boolean
 }|null>(null)
 const [workoutTemplates,setWorkoutTemplates]=useState<WorkoutTemplate[]>(()=>[
  defaultWorkoutTemplate('full_body_a'),defaultWorkoutTemplate('full_body_b'),defaultWorkoutTemplate('full_body_c')
 ])
 const [workoutBusy,setWorkoutBusy]=useState(false)
 const [entries,setEntries]=useState<NutritionEntry[]>([])
 const [totals,setTotals]=useState<DailyNutritionTotals>(()=>emptyDailyNutritionTotals(localISO()))
 const [nutritionLoading,setNutritionLoading]=useState(false)
 const [nutritionBusy,setNutritionBusy]=useState<string|null>(null)
 const [nutritionError,setNutritionError]=useState('')
 const [nutritionNotice,setNutritionNotice]=useState<{text:string;entryId:string|null;logDate:string}|null>(null)
 const [meal,setMeal]=useState<MealDraft>(blankMeal)
 const [mealOpen,setMealOpen]=useState(false)
 const [editingId,setEditingId]=useState<string|null>(null)
 const [editDraft,setEditDraft]=useState<EditDraft|null>(null)
 const [saveState,setSaveState]=useState<Record<string,string>>({})
 const training=getTraining(selectedDate,workoutPlan,workoutTemplates)
 const today=profile?calendarDateInTimezone(profile.timezone):localISO()
 const isToday=selectedDate===today
 const selectedLabel=localDate(selectedDate).toLocaleDateString(undefined,{month:'short',day:'numeric'})

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false)})
  const {data}=supabase.auth.onAuthStateChange((_,nextSession)=>{
   setSession(nextSession)
   setAuthLoading(false)
  })
  return()=>data.subscription.unsubscribe()
 },[])

 useEffect(()=>{
  if(authLoading)return
  if(!session){
   bootstrapSequence.current++
   setBootstrapStatus('signed-out')
   setProfile(null)
   setActiveGoal(null)
   setCurrentTarget(null)
   return
  }
  void loadAccount(session)
 },[authLoading,session?.user.id])

 useEffect(()=>{
  selectedDateRef.current=selectedDate
  setNutritionError('')
  setNutritionNotice(null)
  setEditingId(null)
  setEditDraft(null)
  if(session&&bootstrapStatus==='dashboard-ready'&&activeGoal)void loadSelected(selectedDate)
 },[session?.user.id,selectedDate,bootstrapStatus,activeGoal])
 useEffect(()=>{
  if(session&&bootstrapStatus==='dashboard-ready')void loadWeightHistory().catch(error=>setMsg(errorText(error)))
 },[session?.user.id,bootstrapStatus])
 useEffect(()=>{
  if(!session||bootstrapStatus!=='dashboard-ready')return
  void getWorkoutTemplates(supabase,session.user.id).then(setWorkoutTemplates).catch(error=>setMsg(errorText(error)))
 },[session?.user.id,bootstrapStatus])

 async function loadAccount(accountSession:Session){
  const sequence=++bootstrapSequence.current
  setBootstrapStatus('profile-loading')
  setMsg('')
  try{
   const userId=accountSession.user.id
   const [nextProfile,nextGoal]=await Promise.all([
    getProfile(supabase,userId),getActiveGoal(supabase,userId)
   ])
   const detectedTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'
   const persistedTimezone=nextProfile?.timezone||detectedTimezone
   const persistedToday=calendarDateInTimezone(persistedTimezone)
   let nextTarget=nextGoal
    ?await getCurrentGoalTarget(supabase,userId,nextGoal.id,persistedToday)
    :null
   if(sequence!==bootstrapSequence.current)return
   const decision=decideAccountBootstrap({
    hasProfile:nextProfile!==null,
    hasActiveGoal:nextGoal!==null,
    hasCurrentTarget:nextTarget!==null,
    currentTargetIsLegacy:nextTarget?.source==='legacy',
    onboardingComplete:nextProfile?.onboarding_complete??false,
    hasCalculationProfile:nextProfile?hasCompleteCalculationProfile(nextProfile):false
   })
   let readyProfile=nextProfile
   if(decision.status==='dashboard'&&nextProfile){
    const timezoneDecision=decideCompatibilityTimezone({
     persistedTimezone:nextProfile.timezone,
     detectedTimezone,
     legacyCompatibility:decision.legacyCompatibility
    })
    readyProfile=timezoneDecision.shouldPersist
     ?await saveCompatibilityTimezone(
       supabase,userId,nextProfile.timezone,timezoneDecision.timezone
      )
     :nextProfile
    if(sequence!==bootstrapSequence.current)return
    if(decision.markOnboardingComplete){
     readyProfile=await completeProfileOnboarding(supabase,userId)
     if(sequence!==bootstrapSequence.current)return
    }
    const canonicalToday=calendarDateInTimezone(readyProfile.timezone)
    if(nextGoal&&canonicalToday!==persistedToday){
     nextTarget=await getCurrentGoalTarget(supabase,userId,nextGoal.id,canonicalToday)
     if(sequence!==bootstrapSequence.current)return
    }
    setProfile(readyProfile)
    setActiveGoal(nextGoal)
    setCurrentTarget(nextTarget)
    setSelectedTarget(nextTarget)
    selectedDateRef.current=canonicalToday
    setSelectedDate(canonicalToday)
    setBootstrapStatus('dashboard-ready')
   }else{
    const canonicalToday=calendarDateInTimezone(persistedTimezone)
    setProfile(nextProfile)
    setActiveGoal(nextGoal)
    setCurrentTarget(nextTarget)
    setSelectedTarget(nextTarget)
    selectedDateRef.current=canonicalToday
    setSelectedDate(canonicalToday)
    setBootstrapStatus('onboarding-required')
   }
  }catch(error){
   if(sequence!==bootstrapSequence.current)return
   setMsg(errorText(error))
   setBootstrapStatus('error')
  }
 }

 async function loadWeightHistory(){
  if(!session)return
  setWeightHistory(await getRecentWeights(supabase,session.user.id))
 }

 async function loadSelected(logDate:string,clearMessage=true){
  if(!session)return
  if(selectedDateRef.current!==logDate)return
  const sequence=++loadSequence.current
  const factsSequence=++workoutFactsSequence.current
  if(clearMessage)setMsg('')
  setMetrics(emptyDailyMetrics(logDate))
  setMeasurement(null)
  setWeightLbs(null)
  setWorkoutPlan(emptyWorkoutPlan(logDate))
  setWorkoutFacts(null)
  setTargetLoading(true)
  setEntries([])
  setTotals(emptyDailyNutritionTotals(logDate))
  setNutritionLoading(true)
  const coachingWeek=profile&&logDate===calendarDateInTimezone(profile.timezone)
   ?calendarWeekBounds(profile.timezone)
   :null
  const results=await Promise.allSettled([
   getDailyMetrics(supabase,session.user.id,logDate),
   getBodyMeasurement(supabase,session.user.id,logDate),
   getNutritionEntries(supabase,session.user.id,logDate),
   getDailyNutritionTotals(supabase,session.user.id,logDate),
   getWorkoutPlan(supabase,session.user.id,logDate),
   activeGoal?getEffectiveGoalTarget(supabase,session.user.id,activeGoal.id,logDate):Promise.resolve(null),
   coachingWeek
    ?getWorkoutCoachingFacts(
      supabase,session.user.id,
      coachingWeek.start,
      coachingWeek.endExclusive,
      logDate,
      recommendedWeeklyWorkouts(profile?.exercise_frequency??'none')
     )
    :Promise.resolve(null)
  ])
  if(sequence!==loadSequence.current||selectedDateRef.current!==logDate)return
  const [metricsResult,measurementResult,entriesResult,totalsResult,workoutResult,targetResult,coachingResult]=results
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
  if(targetResult.status==='fulfilled')setSelectedTarget(targetResult.value)
  else setMsg(errorText(targetResult.reason))
  if(coachingResult.status==='fulfilled'){
   if(factsSequence===workoutFactsSequence.current)setWorkoutFacts(coachingResult.value)
  }else setMsg(errorText(coachingResult.reason))
  setTargetLoading(false)
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
  if(authMode==='signin'){
   const signed=await supabase.auth.signInWithPassword({email,password})
   if(signed.error)setMsg(signed.error.message)
   return
  }
  const created=await supabase.auth.signUp({email,password})
  setMsg(created.error?.message||(created.data.session?'Account created.':'Account created. Check your inbox to confirm your email.'))
 }

 async function dismissFirstDay(){
  if(!session)return
  try{
   setProfile(await dismissGettingStarted(supabase,session.user.id))
  }catch(error){setMsg(errorText(error))}
 }

 async function autosaveMetric(metric:AutosaveDailyMetricKey,value:number|string|null){
  if(!session)return
  const logDate=selectedDate
  setSaveState(current=>({...current,[metric]:'Saving…'}))
  try{
   const saved=await saveDailyMetricField(supabase,session.user.id,logDate,metric,value)
   if(selectedDateRef.current!==logDate)return
   setMetrics(current=>({...current,id:saved.id,[metric]:saved[metric]}))
   setSaveState(current=>({...current,[metric]:'Saved'}))
  }catch(error){
   if(selectedDateRef.current===logDate)setSaveState(current=>({...current,[metric]:errorText(error)}))
  }
 }

 async function autosaveWeight(){
  if(!session)return
  const logDate=selectedDate
  const nextWeight=weightLbs
  const existing=measurement
  setSaveState(current=>({...current,weight:'Saving…'}))
  try{
   const saved=await saveBodyWeight(supabase,{
    userId:session.user.id,logDate,weightLbs:nextWeight,existing,isToday:logDate===today
   })
   await loadWeightHistory()
   if(selectedDateRef.current!==logDate)return
   setMeasurement(saved);setWeightLbs(saved?.weight_lbs??null)
   setSaveState(current=>({...current,weight:'Saved'}))
  }catch(error){
   if(selectedDateRef.current===logDate)setSaveState(current=>({...current,weight:errorText(error)}))
  }
 }

 async function replaceTotal(metric:CorrectableNutritionMetric,desired:number){
  if(!session)return
  const logDate=selectedDate
  setSaveState(current=>({...current,[metric]:'Saving…'}))
  try{
   await replaceNutritionTotal(supabase,{userId:session.user.id,logDate,metric,desiredTotal:desired,totals})
   await refreshNutrition(logDate)
   if(selectedDateRef.current===logDate)setSaveState(current=>({...current,[metric]:'Saved'}))
  }catch(error){
   if(selectedDateRef.current===logDate)setSaveState(current=>({...current,[metric]:errorText(error)}))
  }
 }

 const targetForDay=targetLoading?null:selectedTarget
 const startWeight=activeGoal?.start_weight_lbs??0
 const targetWeight=activeGoal?.target_weight_lbs??0
 const latest=weightHistory[0]?.weight_lbs??startWeight
 const progressData=goalProgress(startWeight,targetWeight,latest)
 const progress=progressData.visual
 const weightUnit=profile?.weight_unit||'lb'
 const displayedLatest=displayWeight(latest,weightUnit)??0
 const displayedTarget=displayWeight(targetWeight,weightUnit)??0
 const displayedChange=Math.abs(displayWeight(progressData.change,weightUnit)??0)
 const changeLabel=targetWeight<startWeight?'down':targetWeight>startWeight?'up':'change'
 const status=useMemo(()=>{
  if(!targetForDay||totals.entry_count===0)return ['Open','open']
  if(totals.calories_unknown_count>0||totals.protein_unknown_count>0)return ['Partial','warn']
  const calories=Number(totals.calories||0)
  const pace=caloriePace(calories,targetForDay.calorie_target_min,targetForDay.calorie_target_max)
  if(pace==='on_pace'&&Number(totals.protein_g||0)>=targetForDay.protein_target_g)return ['On pace','good']
  if(pace!=='over')return ['Close','warn']
  return ['Over target','bad']
 },[totals,targetForDay])
 const nextWorkout=workoutFacts?nextProgramWorkout(workoutFacts.lastCompleted):'full_body_a'
 const strengthSuppressed=isToday&&!workoutPlan.completed&&(!workoutFacts||!workoutFacts.strengthRecommended)

 const metricNumber=(key:'steps'|'water_oz',value:string)=>{
  setMetrics(current=>({...current,[key]:value===''?null:Number(value)}))
 }
 const selectDate=(next:string)=>{
  if(next<=today){
   selectedDateRef.current=next
   setMetrics(emptyDailyMetrics(next))
   setMeasurement(null)
   setWeightLbs(null)
   setWorkoutPlan(emptyWorkoutPlan(next))
   setWorkoutFacts(null)
   setSelectedTarget(null)
   setTargetLoading(true)
   setEntries([])
   setTotals(emptyDailyNutritionTotals(next))
   setNutritionLoading(true)
   setSaveState({})
   setSelectedDate(next)
  }
 }
 const changeDate=(days:number)=>selectDate(shiftDate(selectedDate,days))

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
  const template=plan.code==='full_body_a'||plan.code==='full_body_b'||plan.code==='full_body_c'
   ?resolveWorkoutTemplate({code:plan.code,completed:plan.completed,snapshot:plan.session?.workout_snapshot??null,templates:workoutTemplates})
   :null
  setWorkoutBusy(true)
  setMsg('')
  try{
   await setWorkoutCompletion(supabase,{
    userId:session.user.id,
    logDate,
    code:plan.code,
    completed:!plan.completed,
    session:plan.session,
    isToday:logDate===today,
    workoutSnapshot:template?snapshotWorkout(template):null
   })
   const week=profile?calendarWeekBounds(profile.timezone):null
   const factsSequence=++workoutFactsSequence.current
   const [refreshed,nextFacts]=await Promise.all([
    getWorkoutPlan(supabase,session.user.id,logDate),
    profile&&week&&logDate===today
     ?getWorkoutCoachingFacts(
       supabase,session.user.id,week.start,week.endExclusive,logDate,
       recommendedWeeklyWorkouts(profile.exercise_frequency)
      )
     :Promise.resolve(null)
   ])
   if(selectedDateRef.current===logDate){
    setWorkoutPlan(refreshed)
    if(nextFacts&&factsSequence===workoutFactsSequence.current)setWorkoutFacts(nextFacts)
   }
  }catch(error){
   if(selectedDateRef.current===logDate)setMsg(errorText(error))
  }finally{
   setWorkoutBusy(false)
  }
 }

 function beginEdit(entry:NutritionEntry){
  if(entry.entry_type==='adjustment')return
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
   :entry.entry_type==='adjustment'
    ?`Revert “${displayDescription(entry)}”?`
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

 function finishOnboarding(setup:AccountSetup){
  const canonicalToday=calendarDateInTimezone(setup.profile.timezone)
  setProfile(setup.profile)
  setActiveGoal(setup.goal)
  setCurrentTarget(setup.target)
  setSelectedTarget(setup.target)
  setTargetLoading(false)
  selectedDateRef.current=canonicalToday
  setSelectedDate(canonicalToday)
  setBootstrapStatus('dashboard-ready')
 }

 function finishGoalSettings(nextGoal:Goal,nextTarget:GoalTarget){
  setActiveGoal(nextGoal)
  if(nextTarget.effective_from<=today&&(nextTarget.effective_to===null||today<nextTarget.effective_to)){
   setCurrentTarget(nextTarget)
  }
  if(nextTarget.effective_from<=selectedDate&&(nextTarget.effective_to===null||selectedDate<nextTarget.effective_to)){
   setSelectedTarget(nextTarget)
  }
  setSettingsOpen(false)
 }

 function finishProfileSettings(nextProfile:Profile){
  const frequencyChanged=profile?.exercise_frequency!==nextProfile.exercise_frequency
  setProfile(nextProfile)
  if(!session||!frequencyChanged)return
  const refreshInstant=new Date()
  const expectedDate=calendarDateInTimezone(nextProfile.timezone,refreshInstant)
  if(selectedDateRef.current!==expectedDate)return
  const factsSequence=++workoutFactsSequence.current
  setWorkoutFacts(null)
  void getTodayWorkoutCoachingFacts(supabase,session.user.id,nextProfile,refreshInstant).then(nextFacts=>{
   if(factsSequence===workoutFactsSequence.current&&selectedDateRef.current===nextFacts.logDate){
    setWorkoutFacts(nextFacts)
   }
  }).catch(error=>{
   if(factsSequence===workoutFactsSequence.current&&selectedDateRef.current===expectedDate){
    setMsg(errorText(error))
   }
  })
 }

 if(authLoading||bootstrapStatus==='auth-loading'||bootstrapStatus==='profile-loading')return <main className="bootstrapPage">
  <div className="masterBrand">CUT365</div><p>Loading your plan…</p>
 </main>

 if(!session||bootstrapStatus==='signed-out')return <main className="loginPage">
  <div className="masterBrand">CUT365</div>
  <section className="loginCopy">
   <p className="eyebrow">YOUR PLAN · YOUR HISTORY</p>
   <h1>Build the habits.<br/>Keep the life.</h1>
   <p className="lede">A quiet daily dashboard for reaching your goal without making food, drinks, or fitness your entire personality.</p>
  </section>
  <form onSubmit={auth} className="loginForm">
   <input type="email" placeholder="Email" value={email} onChange={event=>setEmail(event.target.value)} required/>
   <input type="password" placeholder="Password" value={password} onChange={event=>setPassword(event.target.value)} required/>
   <button>{authMode==='signin'?'Sign in':'Create account'}</button>
   <small>{msg||`${authMode==='signin'?'Welcome back.':'Start with a free CUT365 account.'}`}</small>
   <button type="button" className="authSwitch" onClick={()=>{setAuthMode(authMode==='signin'?'signup':'signin');setMsg('')}}>{authMode==='signin'?'New here? Create account':'Already have an account? Sign in'}</button>
  </form>
 </main>

 if(bootstrapStatus==='error')return <main className="bootstrapPage">
  <div className="masterBrand">CUT365</div><p>{msg||'Could not load your account.'}</p><button onClick={()=>loadAccount(session)}>Try again</button>
 </main>

 if(bootstrapStatus==='onboarding-required')return <Onboarding session={session} onComplete={finishOnboarding}/>

 if(!profile||!activeGoal||!currentTarget)return <main className="bootstrapPage">
  <div className="masterBrand">CUT365</div><p>Finishing your dashboard…</p>
 </main>

 return <main className="app">
  <nav>
   <div><div className="brand">{goalIdentity(activeGoal.target_weight_lbs)}</div><small className="productMark">CUT365</small></div>
   <div className="navRight"><button onClick={()=>setSettingsOpen(true)}>Settings</button><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
  </nav>

  {settingsOpen&&<GoalSettings
   session={session} profile={profile} goal={activeGoal} target={currentTarget} currentWeightLbs={latest}
   onClose={()=>setSettingsOpen(false)} onGoalSaved={finishGoalSettings} onProfileSaved={finishProfileSettings}
  />}

  <div className="dateNavRow">
   <div className="dateNav" aria-label="Select log date">
    <button onClick={()=>changeDate(-1)} aria-label="Previous day">‹</button>
    <strong>{localDate(selectedDate).toLocaleDateString(undefined,{month:'short',day:'numeric'}).toUpperCase()} <i>·</i> {training.dayLabel}</strong>
    <button onClick={()=>changeDate(1)} disabled={isToday} aria-label="Next day">›</button>
   </div>
   {!isToday&&<button className="todayButton" onClick={()=>selectDate(today)}>Today</button>}
  </div>
  {isToday&&hourInTimezone(profile.timezone)<4&&<button className="yesterdayShortcut" onClick={()=>changeDate(-1)}>Still logging yesterday?</button>}

  {isToday&&currentTarget.source==='onboarding'&&!profile.getting_started_dismissed&&
   <aside className="gettingStarted">
    <div className="gettingStartedHead"><strong>Start your first day</strong><button onClick={dismissFirstDay} aria-label="Dismiss getting started">×</button></div>
    <p>Log a meal · Add your weight · Add your steps</p>
   </aside>}

  <section className="trainingWrap">
   <p className="eyebrow">{isToday?"TODAY'S TRAINING":"PRESCRIBED TRAINING"}</p>
   {strengthSuppressed?<div className="trainingRestState"><strong>{workoutFacts?'No strength workout today':'Checking today’s training…'}</strong><span>{workoutFacts?`Next workout: ${workoutName(nextWorkout)}`:'Reviewing completed workouts'}</span></div>:<details className="trainingCard">
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
     {training.kind==='recovery'&&<div className="trainingNote"><strong>Goal: {formatTarget(targetForDay?.steps_target,0)}+ steps</strong><p>Recovery and everyday movement.</p></div>}
     {training.kind==='legacy'&&<div className="trainingNote"><strong>Historical strength session</strong><p>Exercise details were not recorded in the original CUT165 log.</p></div>}
     {workoutPlan.code==='legacy_strength'
      ?<div className={`completeWorkout readOnly ${workoutPlan.completed?'done':''}`} role="status"><span>{workoutPlan.completed?'Historical workout complete':'Historical workout record'}</span><b>{workoutPlan.completed?'✓':'·'}</b></div>
      :<button className={`completeWorkout ${workoutPlan.completed?'done':''}`} onClick={toggleWorkout} disabled={workoutBusy}>
       <span>{workoutBusy?'Updating…':workoutPlan.completed?'Workout complete':'Mark workout complete'}</span><b>{workoutPlan.completed?'✓':'○'}</b>
      </button>}
    </div>
   </details>}
   <WorkoutTemplateEditor userId={session.user.id} templates={workoutTemplates} onChange={setWorkoutTemplates}/>
  </section>

  <section className={`goalCard p${Math.min(4,Math.floor(progress/25)+1)}`}>
   <div><p className="eyebrow">PROGRESS TO YOUR GOAL{activeGoal.target_date?` · ${localDate(activeGoal.target_date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`:''}</p><div className="weightLine"><strong>{formatNumber(displayedLatest)}</strong><span>{weightUnit}</span><i>→</i><b>{formatNumber(displayedTarget)}</b><span>{weightUnit}</span></div></div>
   <div className="goalMeta"><strong>{displayedChange.toFixed(1)} {weightUnit}</strong><span>{changeLabel}</span><strong>{progress.toFixed(0)}%</strong><span>complete</span></div>
   <div className="bar"><i style={{width:`${progress}%`}}/></div>
  </section>

  <div className="sectionHead">
   <div><p className="eyebrow">DAILY SIGNALS</p><h2>{isToday?'Today':selectedLabel}</h2></div>
   <span className={`signal ${status[1]}`}>● {status[0]}</span>
  </div>

  <NutritionPresets userId={session.user.id} logDate={selectedDate} dateLabel={isToday?'today':selectedLabel} onLogged={()=>refreshNutrition(selectedDate)}/>

  <section className="quickAdd oneOffMeal">
   <details className="addMeal" open={mealOpen} onToggle={event=>setMealOpen(event.currentTarget.open)}>
    <summary>Add one-off meal</summary>
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
   <NutritionMetric kind="calories" icon="◒" label="Calories" value={totals.calories} unit="kcal" target={`Goal · ${targetForDay?formatTarget(primaryCalorieTarget(targetForDay.calorie_target_min,targetForDay.calorie_target_max),0):'—'} kcal`} partial={totals.calories_unknown_count>0} loading={nutritionLoading} saveState={saveState.calories} onSave={value=>replaceTotal('calories',value)}/>
   <NutritionMetric kind="protein" icon="◆" label="Protein" value={totals.protein_g} unit="g" target={`Goal · ${formatTarget(targetForDay?.protein_target_g)}+`} partial={totals.protein_unknown_count>0} loading={nutritionLoading} saveState={saveState.protein_g} onSave={value=>replaceTotal('protein_g',value)}/>
   <Metric kind="steps" icon="↗" label="Steps" value={metrics.steps} unit="" target={`Goal · ${formatTarget(targetForDay?.steps_target,0)}+`} saveState={saveState.steps} onChange={value=>metricNumber('steps',value)} onSave={()=>autosaveMetric('steps',metrics.steps)}/>
   <Metric kind="weight" icon="●" label="Weight" value={displayWeight(weightLbs,weightUnit)} unit={weightUnit} target={`Destination · ${formatNumber(displayedTarget)} ${weightUnit}`} step=".1" saveState={saveState.weight} onChange={value=>setWeightLbs(value===''?null:storedWeight(Number(value),weightUnit))} onSave={autosaveWeight}/>
  </section>

  <section className="softGrid">
   <label className="softCard"><span>Water <small>Goal · {formatTarget(targetForDay?.water_target_oz)} oz/day</small></span><div><input type="number" value={metrics.water_oz??''} placeholder="0" onChange={event=>metricNumber('water_oz',event.target.value)} onBlur={()=>autosaveMetric('water_oz',metrics.water_oz)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/><b>/ {formatTarget(targetForDay?.water_target_oz)} oz</b></div>{saveState.water_oz&&<em className="fieldSaveState">{saveState.water_oz}</em>}</label>
   <article className="softCard nutritionSoft"><span>Carbs <small>{targetForDay?.carb_target_g===null?'No fixed target':targetForDay?`Goal · ${formatTarget(targetForDay.carb_target_g)}g`:'Loading target'}</small></span><div><strong>{nutritionLoading?'—':formatNumber(totals.carbs_g)}</strong><b>g</b>{totals.carbs_unknown_count>0&&<em>partial</em>}</div></article>
  </section>

  <section className="nutritionEntries" aria-busy={nutritionLoading}>
   <div className="nutritionEntriesHead"><div><p className="eyebrow">NUTRITION ENTRIES</p><h3>{isToday?'Today':selectedLabel}</h3></div><span>{entries.length} {entries.length===1?'entry':'entries'}</span></div>
   {nutritionLoading&&<p className="entryEmpty">Loading nutrition…</p>}
   {!nutritionLoading&&!entries.length&&<p className="entryEmpty">No nutrition logged for this day yet.</p>}
   {!nutritionLoading&&entries.map(entry=>editingId===entry.id&&editDraft?
    <form className="entryEdit" key={entry.id} onSubmit={event=>saveEntryEdit(event,entry)}>
     <div className="entryEditTop"><input type="text" value={editDraft.description} onChange={event=>setEditDraft({...editDraft,description:event.target.value})} aria-label="Description" required/><select value={editDraft.mealSlot} onChange={event=>setEditDraft({...editDraft,mealSlot:event.target.value as ''|MealSlot})} aria-label="Meal slot"><option value="">No meal slot</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></div>
     <div className="entryEditMetrics"><label>Calories<input type="number" min="0" step="any" value={editDraft.calories} onChange={event=>setEditDraft({...editDraft,calories:event.target.value})}/></label><label>Protein<input type="number" min="0" step="any" value={editDraft.protein_g} onChange={event=>setEditDraft({...editDraft,protein_g:event.target.value})}/></label><label>Carbs<input type="number" min="0" step="any" value={editDraft.carbs_g} onChange={event=>setEditDraft({...editDraft,carbs_g:event.target.value})}/></label></div>
     {entry.alcohol_servings!==null&&entry.alcohol_servings>0&&<small>Alcohol servings remain {formatNumber(entry.alcohol_servings,2)}.</small>}
     <div className="entryActions"><button disabled={nutritionBusy!==null}>{nutritionBusy===`edit:${entry.id}`?'Saving…':'Save entry'}</button><button type="button" className="quiet" onClick={()=>{setEditingId(null);setEditDraft(null)}} disabled={nutritionBusy!==null}>Cancel</button><button type="button" className="delete" onClick={()=>removeEntry(entry)} disabled={nutritionBusy!==null}>Delete</button></div>
    </form>
    :<article className="entryRow" key={entry.id}>
     <div><span className="entryLabel">{entry.meal_slot||entry.entry_type.replace('_',' ')}</span><strong>{displayDescription(entry)}</strong><small>{entrySummary(entry)}</small></div>
     <div className="entryRowActions">{entry.entry_type!=='adjustment'&&<button onClick={()=>beginEdit(entry)} disabled={nutritionBusy!==null}>Edit</button>}<button onClick={()=>removeEntry(entry)} disabled={nutritionBusy!==null}>{entry.entry_type==='adjustment'?'Revert':'Delete'}</button></div>
    </article>)}
  </section>

  <label className="notes"><span>Notes {saveState.notes&&<small>{saveState.notes}</small>}</span><textarea placeholder="Dinner out, hunger, workout, anything useful..." value={metrics.notes||''} onChange={event=>setMetrics(current=>({...current,notes:event.target.value}))} onBlur={()=>autosaveMetric('notes',metrics.notes)}/></label>
 </main>
}

function NutritionMetric({kind,icon,label,value,unit,target,partial,loading,saveState,onSave}:{
 kind:string;icon:string;label:string;value:number|null;unit:string;target:string;partial:boolean;loading:boolean
 saveState?:string;onSave:(value:number)=>Promise<void>
}){
 const [draft,setDraft]=useState(value?.toString()??'')
 useEffect(()=>setDraft(value?.toString()??''),[value])
 const commit=()=>{
  if(partial||draft.trim()==='')return
  const desired=Number(draft)
  if(!Number.isFinite(desired)||desired<0)return
  if(desired===Number(value??0))return
  void onSave(desired)
 }
 return <label className={`metric ${kind} nutritionMetric`}>
  <div className="metricTop"><i>{icon}</i><span>{label}</span>{partial&&<em>partial</em>}</div>
  <div className="metricValue"><input type="number" min="0" step="any" value={loading?'':draft} placeholder="—" disabled={loading||partial} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/><b>{unit}</b></div>
  <small>{target}</small>
  {partial?<em className="fieldSaveState">Complete partial entries before replacing this total.</em>:saveState&&<em className="fieldSaveState">{saveState}</em>}
 </label>
}

function Metric({kind,icon,label,value,unit,target,onChange,onSave,saveState,step='1'}:{
 kind:string;icon:string;label:string;value:number|null;unit:string;target:string
 onChange:(value:string)=>void;onSave:()=>void;saveState?:string;step?:string
}){
 return <label className={`metric ${kind}`}>
  <div className="metricTop"><i>{icon}</i><span>{label}</span></div>
  <div className="metricValue"><input type="number" min="0" step={step} value={value??''} placeholder="—" onChange={event=>onChange(event.target.value)} onBlur={onSave} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/><b>{unit}</b></div>
  <small>{target}</small>
  {saveState&&<em className="fieldSaveState">{saveState}</em>}
 </label>
}

import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Json,Tables} from './database.types'
import type {WorkoutExercise} from './workout-templates'
import type {CustomWorkoutCode,WorkoutSession} from './workouts'

type TypedSupabaseClient=SupabaseClient<Database>
type CustomWorkoutTemplateRow=Tables<'custom_workout_templates'>
type WorkoutSessionRow=Tables<'workout_sessions'>

export type CustomWorkoutFormat='structured'|'guided'
export type CustomWorkoutCategory='strength'|'cardio'|'mobility'|'other'
export type CustomWorkoutTemplate=Omit<CustomWorkoutTemplateRow,'format'|'category'|'exercises'>&{
 format:CustomWorkoutFormat
 category:CustomWorkoutCategory
 exercises:WorkoutExercise[]
}
export type CustomWorkoutInput=Pick<CustomWorkoutTemplate,
 'name'|'format'|'category'|'description'|'external_url'|'duration_minutes'|'exercises'|'sort_order'
>
export type CustomWorkoutSnapshot={
 version:1
 type:'custom'
 template_id:string
 name:string
 format:CustomWorkoutFormat
 category:CustomWorkoutCategory
 description:string|null
 external_url:string|null
 duration_minutes:number|null
 exercises:WorkoutExercise[]
}

const categories:CustomWorkoutCategory[]=['strength','cardio','mobility','other']
const formats:CustomWorkoutFormat[]=['structured','guided']
const cleanOptional=(value:string|null)=>value?.trim()||null

function normalizeExercise(value:unknown):WorkoutExercise{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Each exercise must be an object.')
 const record=value as Record<string,unknown>
 const exercise={name:String(record.name??'').trim(),sets:String(record.sets??'').trim(),reps:String(record.reps??'').trim()}
 if(!exercise.name||!exercise.sets||!exercise.reps)throw new Error('Each exercise needs a name, sets, and reps.')
 return exercise
}

function safeExternalUrl(value:string|null){
 const clean=cleanOptional(value)
 if(!clean)return null
 let parsed:URL
 try{parsed=new URL(clean)}catch{throw new Error('Use a valid external workout URL.')}
 if(parsed.protocol!=='https:'&&parsed.protocol!=='http:')throw new Error('Workout links must use http or https.')
 return parsed.toString()
}

export function validateCustomWorkout(input:CustomWorkoutInput){
 const name=input.name.trim()
 if(!name)throw new Error('Workout name is required.')
 if(!formats.includes(input.format))throw new Error('Choose a valid workout format.')
 if(!categories.includes(input.category))throw new Error('Choose a valid workout category.')
 if(input.duration_minutes!==null&&(!Number.isInteger(input.duration_minutes)||input.duration_minutes<1||input.duration_minutes>1440)){
  throw new Error('Duration must be between 1 and 1,440 minutes.')
 }
 if(!Number.isInteger(input.sort_order)||input.sort_order<0)throw new Error('Sort order must be a non-negative whole number.')
 const exercises=Array.isArray(input.exercises)?input.exercises.map(normalizeExercise):[]
 if(input.format==='structured'&&exercises.length===0)throw new Error('Structured workouts need at least one exercise.')
 if(exercises.length>30)throw new Error('Custom workouts support up to 30 exercises.')
 return {
  name,format:input.format,category:input.category,
  description:cleanOptional(input.description),external_url:safeExternalUrl(input.external_url),
  duration_minutes:input.duration_minutes,exercises,sort_order:input.sort_order
 }
}

function normalize(row:CustomWorkoutTemplateRow):CustomWorkoutTemplate{
 const validated=validateCustomWorkout({
  name:row.name,format:row.format as CustomWorkoutFormat,category:row.category as CustomWorkoutCategory,
  description:row.description,external_url:row.external_url,duration_minutes:row.duration_minutes,
  exercises:Array.isArray(row.exercises)?row.exercises.map(normalizeExercise):[],sort_order:row.sort_order
 })
 return {...row,...validated}
}

export async function getCustomWorkoutTemplates(client:TypedSupabaseClient,userId:string){
 const {data,error}=await client.from('custom_workout_templates').select()
  .eq('user_id',userId).order('sort_order',{ascending:true}).order('created_at',{ascending:true})
 if(error)throw error
 return (data??[]).map(normalize)
}

export async function getCompletedCustomWorkoutsForDate(client:TypedSupabaseClient,userId:string,logDate:string){
 const {data,error}=await client.from('workout_sessions').select()
  .eq('user_id',userId).eq('scheduled_date',logDate).eq('status','completed')
  .in('workout_code',['custom_strength','custom_cardio','custom_mobility','custom_other'])
 if(error)throw error
 return (data??[]).map(normalizeSession)
}

export async function createCustomWorkoutTemplate(client:TypedSupabaseClient,userId:string,input:CustomWorkoutInput){
 const values=validateCustomWorkout(input)
 const {data,error}=await client.from('custom_workout_templates').insert({
  user_id:userId,...values,exercises:values.exercises as Json
 }).select().single()
 if(error)throw error
 return normalize(data)
}

export async function updateCustomWorkoutTemplate(client:TypedSupabaseClient,userId:string,id:string,input:CustomWorkoutInput){
 const values=validateCustomWorkout(input)
 const {data,error}=await client.from('custom_workout_templates').update({...values,exercises:values.exercises as Json})
  .eq('id',id).eq('user_id',userId).select().single()
 if(error)throw error
 return normalize(data)
}

export async function deleteCustomWorkoutTemplate(client:TypedSupabaseClient,userId:string,id:string){
 const {data,error}=await client.from('custom_workout_templates').delete()
  .eq('id',id).eq('user_id',userId).select('id').maybeSingle()
 if(error)throw error
 if(!data)throw new Error('Custom workout was not found or could not be deleted.')
}

export function customWorkoutCode(category:CustomWorkoutCategory):CustomWorkoutCode{
 return `custom_${category}`
}

export function snapshotCustomWorkout(template:CustomWorkoutTemplate):CustomWorkoutSnapshot{
 const values=validateCustomWorkout(template)
 return {version:1,type:'custom',template_id:template.id,...values}
}

function normalizeSession(row:WorkoutSessionRow):WorkoutSession{
 return row as WorkoutSession
}

export async function completeCustomWorkout(client:TypedSupabaseClient,input:{
 userId:string;logDate:string;template:CustomWorkoutTemplate;isToday:boolean
}){
 const {userId,logDate,template,isToday}=input
 const code=customWorkoutCode(template.category)
 const sourceRef=`cut365:${logDate}:custom:${template.id}`
 const snapshot=snapshotCustomWorkout(template)
 const {data:existing,error:readError}=await client.from('workout_sessions').select()
  .eq('user_id',userId).eq('scheduled_date',logDate).eq('source','manual').eq('source_ref',sourceRef).maybeSingle()
 if(readError)throw readError
 if(existing)return normalizeSession(existing)
 const values={
  user_id:userId,scheduled_date:logDate,workout_code:code,status:'completed',
  completed_at:isToday?new Date().toISOString():null,duration_minutes:template.duration_minutes,
  source:'manual',source_ref:sourceRef,custom_workout_template_id:template.id,
  workout_snapshot:snapshot as Json
 }
 const {data,error}=await client.from('workout_sessions').insert(values).select().single()
 if(!error)return normalizeSession(data)
 if(error.code!=='23505')throw error
 const {data:concurrent,error:concurrentError}=await client.from('workout_sessions').select()
  .eq('user_id',userId).eq('scheduled_date',logDate).eq('source','manual').eq('source_ref',sourceRef).single()
 if(concurrentError)throw concurrentError
 return normalizeSession(concurrent)
}

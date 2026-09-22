import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Tables} from './database.types'

type WorkoutSessionRow=Tables<'workout_sessions'>
type TypedSupabaseClient=SupabaseClient<Database>

export type StructuredWorkoutCode='full_body_a'|'full_body_b'|'full_body_c'
export type WorkoutCode=StructuredWorkoutCode|'recovery'
export type WorkoutStatus='planned'|'completed'|'skipped'
export type WorkoutSource='manual'|'schedule'|'legacy'|'ai'

export type WorkoutSession=Omit<WorkoutSessionRow,'workout_code'|'status'|'source'>&{
 workout_code:WorkoutCode
 status:WorkoutStatus
 source:WorkoutSource
}

export type WorkoutPlan={
 code:WorkoutCode
 completed:boolean
 session:WorkoutSession|null
 strengthOpportunity:boolean
}

const betaCodes:StructuredWorkoutCode[]=['full_body_a','full_body_b']

function normalizeStructuredCode(value:string):StructuredWorkoutCode{
 if(value==='full_body_a'||value==='full_body_b'||value==='full_body_c')return value
 throw new Error(`Unsupported structured workout code: ${value}`)
}

function normalizeCode(value:string):WorkoutCode{
 if(value==='recovery')return value
 return normalizeStructuredCode(value)
}

function normalizeStatus(value:string):WorkoutStatus{
 if(value==='planned'||value==='completed'||value==='skipped')return value
 throw new Error(`Unsupported workout status: ${value}`)
}

function normalizeSource(value:string):WorkoutSource{
 if(value==='manual'||value==='schedule'||value==='legacy'||value==='ai')return value
 throw new Error(`Unsupported workout source: ${value}`)
}

function normalizeSession(row:WorkoutSessionRow):WorkoutSession{
 return {
  ...row,
  workout_code:normalizeCode(row.workout_code),
  status:normalizeStatus(row.status),
  source:normalizeSource(row.source)
 }
}

export function nextStructuredWorkout(previous:StructuredWorkoutCode|null):StructuredWorkoutCode{
 if(previous==='full_body_a')return 'full_body_b'
 return 'full_body_a'
}

export async function getWorkoutPlan(
 client:TypedSupabaseClient,userId:string,logDate:string
):Promise<WorkoutPlan>{
 const [selectedResult,previousResult]=await Promise.all([
  client.from('workout_sessions').select()
   .eq('user_id',userId).eq('scheduled_date',logDate)
   .order('created_at',{ascending:false}).limit(1).maybeSingle(),
  client.from('workout_sessions').select('workout_code')
   .eq('user_id',userId).eq('status','completed').in('workout_code',betaCodes)
   .lt('scheduled_date',logDate).order('scheduled_date',{ascending:false})
   .order('created_at',{ascending:false}).limit(1).maybeSingle()
 ])
 if(selectedResult.error)throw selectedResult.error
 if(previousResult.error)throw previousResult.error

 const session=selectedResult.data?normalizeSession(selectedResult.data):null
 const previous=previousResult.data?normalizeStructuredCode(previousResult.data.workout_code):null
 const code=session?.workout_code||nextStructuredWorkout(previous)
 return {code,completed:session?.status==='completed',session,strengthOpportunity:code!=='recovery'}
}

export async function getWorkoutCoachingFacts(
 client:TypedSupabaseClient,userId:string,weekStart:string,weekEndExclusive:string,throughDate:string
){
 const [latestResult,weekResult]=await Promise.all([
  client.from('workout_sessions').select('workout_code')
   .eq('user_id',userId).eq('status','completed').in('workout_code',betaCodes)
   .lte('scheduled_date',throughDate).order('scheduled_date',{ascending:false})
   .order('created_at',{ascending:false}).limit(1).maybeSingle(),
  client.from('workout_sessions').select('id')
   .eq('user_id',userId).eq('status','completed').in('workout_code',betaCodes)
   .gte('scheduled_date',weekStart).lt('scheduled_date',weekEndExclusive)
   .lte('scheduled_date',throughDate)
 ])
 if(latestResult.error)throw latestResult.error
 if(weekResult.error)throw weekResult.error
 const lastCompleted=latestResult.data
  ?normalizeStructuredCode(latestResult.data.workout_code)
  :null
 return {
  lastCompleted:lastCompleted==='full_body_a'||lastCompleted==='full_body_b'?lastCompleted:null,
  completedThisWeek:(weekResult.data??[]).length
 }
}

async function updateSession(
 client:TypedSupabaseClient,userId:string,logDate:string,session:WorkoutSession,completed:boolean,isToday:boolean
){
 const {data,error}=await client.from('workout_sessions').update({
  status:completed?'completed':'planned',
  completed_at:completed&&isToday?(session.completed_at||new Date().toISOString()):null
 }).eq('id',session.id).eq('user_id',userId).eq('scheduled_date',logDate)
  .select().single()
 if(error)throw error
 return normalizeSession(data)
}

export async function setWorkoutCompletion(client:TypedSupabaseClient,input:{
 userId:string
 logDate:string
 code:WorkoutCode
 completed:boolean
 session:WorkoutSession|null
 isToday:boolean
}){
 const {userId,logDate,code,completed,session,isToday}=input
 if(session)return updateSession(client,userId,logDate,session,completed,isToday)
 if(!completed)return null

 const sourceRef=`cut365:${logDate}:${code}`
 const {data:existing,error:readError}=await client.from('workout_sessions').select()
  .eq('user_id',userId).eq('scheduled_date',logDate).eq('source','manual')
  .eq('source_ref',sourceRef).maybeSingle()
 if(readError)throw readError
 if(existing)return updateSession(client,userId,logDate,normalizeSession(existing),true,isToday)

 const {data,error}=await client.from('workout_sessions').insert({
  user_id:userId,
  scheduled_date:logDate,
  workout_code:code,
  status:'completed',
  completed_at:isToday?new Date().toISOString():null,
  source:'manual',
  source_ref:sourceRef
 }).select().single()
 if(error){
  if(error.code!=='23505')throw error
  const {data:concurrent,error:concurrentError}=await client.from('workout_sessions').select()
   .eq('user_id',userId).eq('scheduled_date',logDate).eq('source','manual')
   .eq('source_ref',sourceRef).maybeSingle()
  if(concurrentError)throw concurrentError
  if(!concurrent)throw error
  return updateSession(client,userId,logDate,normalizeSession(concurrent),true,isToday)
 }
 return normalizeSession(data)
}

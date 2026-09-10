import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Tables} from './database.types'

type BodyMeasurementRow=Tables<'body_measurements'>
type TypedSupabaseClient=SupabaseClient<Database>

export type BodyMeasurement=BodyMeasurementRow
export type WeightHistory=Pick<BodyMeasurementRow,'log_date'|'weight_lbs'>

export async function getBodyMeasurement(
 client:TypedSupabaseClient,userId:string,logDate:string
){
 const {data,error}=await client.from('body_measurements').select()
  .eq('user_id',userId).eq('log_date',logDate).maybeSingle()
 if(error)throw error
 return data
}

export async function getRecentWeights(client:TypedSupabaseClient,userId:string,limit=45){
 const {data,error}=await client.from('body_measurements').select('log_date,weight_lbs')
  .eq('user_id',userId).order('log_date',{ascending:false}).limit(limit)
 if(error)throw error
 return data
}

export async function saveBodyWeight(client:TypedSupabaseClient,input:{
 userId:string
 logDate:string
 weightLbs:number|null
 existing:BodyMeasurement|null
 isToday:boolean
}){
 const {userId,logDate,weightLbs,existing,isToday}=input

 if(weightLbs===null){
  if(!existing)return null
  const {data,error}=await client.from('body_measurements').delete()
   .eq('id',existing.id).eq('user_id',userId).eq('log_date',logDate)
   .select('id').maybeSingle()
  if(error)throw error
  if(!data)throw new Error('Weight measurement was not found or could not be deleted.')
  return null
 }

 if(!Number.isFinite(weightLbs)||weightLbs<=0)throw new Error('Weight must be greater than zero.')

 if(existing){
  if(existing.weight_lbs===weightLbs)return existing
  const {data,error}=await client.from('body_measurements').update({
   weight_lbs:weightLbs,source:'manual',source_ref:null
  }).eq('id',existing.id).eq('user_id',userId).eq('log_date',logDate)
   .select().single()
  if(error)throw error
  return data
 }

 const {data,error}=await client.from('body_measurements').insert({
  user_id:userId,
  log_date:logDate,
  weight_lbs:weightLbs,
  measured_at:isToday?new Date().toISOString():null,
  source:'manual'
 }).select().single()
 if(error)throw error
 return data
}

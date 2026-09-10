import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Tables} from './database.types'

type DailyMetricsRow=Tables<'daily_metrics'>
type TypedSupabaseClient=SupabaseClient<Database>
type DailyMetricsProjection=Pick<DailyMetricsRow,
 'id'|'log_date'|'steps'|'water_oz'|'cardio_minutes'|'notes'
>

export type DailyMetrics=Omit<DailyMetricsProjection,'id'>&{id:string|null}

export type DailyMetricDeltaKey='steps'|'water_oz'

export function emptyDailyMetrics(logDate:string):DailyMetrics{
 return {id:null,log_date:logDate,steps:null,water_oz:null,cardio_minutes:null,notes:null}
}

function normalizeNotes(notes:string|null){
 const clean=notes?.trim()||''
 return clean||null
}

function validateMetrics(metrics:DailyMetrics){
 if(metrics.steps!==null&&(!Number.isInteger(metrics.steps)||metrics.steps<0)){
  throw new Error('Steps must be a non-negative whole number.')
 }
 if(metrics.water_oz!==null&&(!Number.isFinite(metrics.water_oz)||metrics.water_oz<0)){
  throw new Error('Water must be a valid non-negative number.')
 }
 if(metrics.cardio_minutes!==null&&(!Number.isInteger(metrics.cardio_minutes)||metrics.cardio_minutes<0)){
  throw new Error('Cardio minutes must be a non-negative whole number.')
 }
}

function normalizeRow(row:DailyMetricsProjection):DailyMetrics{
 return {
  id:row.id,
  log_date:row.log_date,
  steps:row.steps,
  water_oz:row.water_oz,
  cardio_minutes:row.cardio_minutes,
  notes:row.notes
 }
}

export async function getDailyMetrics(client:TypedSupabaseClient,userId:string,logDate:string){
 const {data,error}=await client.from('daily_metrics')
  .select('id,log_date,steps,water_oz,cardio_minutes,notes')
  .eq('user_id',userId).eq('log_date',logDate).maybeSingle()
 if(error)throw error
 return data?normalizeRow(data):emptyDailyMetrics(logDate)
}

export async function saveDailyMetrics(
 client:TypedSupabaseClient,userId:string,metrics:DailyMetrics
){
 validateMetrics(metrics)
 const values={
  steps:metrics.steps,
  water_oz:metrics.water_oz,
  cardio_minutes:metrics.cardio_minutes,
  notes:normalizeNotes(metrics.notes)
 }

 if(metrics.id){
  const {data,error}=await client.from('daily_metrics').update(values)
   .eq('id',metrics.id).eq('user_id',userId).eq('log_date',metrics.log_date)
   .select().single()
  if(error)throw error
  return normalizeRow(data)
 }

 if(Object.values(values).every(value=>value===null))return emptyDailyMetrics(metrics.log_date)

 const {data,error}=await client.from('daily_metrics').insert({
  user_id:userId,log_date:metrics.log_date,...values
 }).select().single()
 if(error)throw error
 return normalizeRow(data)
}

export async function incrementDailyMetric(
 client:TypedSupabaseClient,userId:string,logDate:string,metric:DailyMetricDeltaKey,amount:number
){
 if(!Number.isFinite(amount)||amount<=0)throw new Error('Quick Add requires a value greater than zero.')
 if(metric==='steps'&&!Number.isInteger(amount))throw new Error('Steps must be a whole number.')

 const {data:existing,error:readError}=await client.from('daily_metrics')
  .select('id,steps,water_oz').eq('user_id',userId).eq('log_date',logDate).maybeSingle()
 if(readError)throw readError

 if(existing){
  const values=metric==='steps'
   ?{steps:(existing.steps??0)+amount}
   :{water_oz:(existing.water_oz??0)+amount}
  const {data,error}=await client.from('daily_metrics').update(values)
   .eq('id',existing.id).eq('user_id',userId).eq('log_date',logDate)
   .select().single()
  if(error)throw error
  return normalizeRow(data)
 }

 const values=metric==='steps'?{steps:amount}:{water_oz:amount}
 const {data,error}=await client.from('daily_metrics').insert({
  user_id:userId,log_date:logDate,...values
 }).select().single()
 if(error)throw error
 return normalizeRow(data)
}

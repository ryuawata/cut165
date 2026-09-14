import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Tables} from './database.types'

type GoalRow=Tables<'goals'>
type GoalTargetRow=Tables<'goal_targets'>
type TypedSupabaseClient=SupabaseClient<Database>

export type GoalType='cut'|'maintain'|'bulk'
export type GoalStatus='active'|'completed'|'paused'|'abandoned'
export type Goal=Omit<GoalRow,'goal_type'|'status'>&{goal_type:GoalType;status:GoalStatus}
export type GoalTargetSource='onboarding'|'manual'|'system'|'coach'|'legacy'
export type GoalTarget=Omit<GoalTargetRow,'source'>&{source:GoalTargetSource}

const isoPattern=/^\d{4}-\d{2}-\d{2}$/

function validateDate(value:string,label:string){
 if(!isoPattern.test(value))throw new Error(`${label} must be a calendar date.`)
}

function normalizeGoal(row:GoalRow):Goal{
 if(row.goal_type!=='cut'&&row.goal_type!=='maintain'&&row.goal_type!=='bulk'){
  throw new Error('Goal contains an unsupported type.')
 }
 if(row.status!=='active'&&row.status!=='completed'&&row.status!=='paused'&&row.status!=='abandoned'){
  throw new Error('Goal contains an unsupported status.')
 }
 return {...row,goal_type:row.goal_type,status:row.status}
}

function normalizeTarget(row:GoalTargetRow):GoalTarget{
 if(row.source!=='onboarding'&&row.source!=='manual'&&row.source!=='system'&&row.source!=='coach'&&row.source!=='legacy'){
  throw new Error('Goal target contains an unsupported source.')
 }
 return {...row,source:row.source}
}

function validateGoalValues(input:{startWeightLbs:number;targetWeightLbs:number;startDate:string;targetDate:string|null}){
 if(!Number.isFinite(input.startWeightLbs)||input.startWeightLbs<=0)throw new Error('Starting weight must be greater than zero.')
 if(!Number.isFinite(input.targetWeightLbs)||input.targetWeightLbs<=0)throw new Error('Target weight must be greater than zero.')
 validateDate(input.startDate,'Start date')
 if(input.targetDate){
  validateDate(input.targetDate,'Target date')
  if(input.targetDate<input.startDate)throw new Error('Target date cannot be before the goal start date.')
 }
}

export async function getActiveGoal(client:TypedSupabaseClient,userId:string){
 const {data,error}=await client.from('goals').select()
  .eq('user_id',userId).eq('status','active').order('created_at',{ascending:false}).limit(2)
 if(error)throw error
 if(data.length>1)throw new Error('Multiple active goals were found. Resolve goal history before continuing.')
 return data[0]?normalizeGoal(data[0]):null
}

export async function createInitialGoal(client:TypedSupabaseClient,input:{
 userId:string
 goalType:GoalType
 startWeightLbs:number
 targetWeightLbs:number
 startDate:string
 targetDate:string|null
}){
 validateGoalValues(input)
 const existing=await getActiveGoal(client,input.userId)
 if(existing)return existing
 const {data,error}=await client.from('goals').insert({
  user_id:input.userId,
  goal_type:input.goalType,
  start_weight_lbs:input.startWeightLbs,
  target_weight_lbs:input.targetWeightLbs,
  start_date:input.startDate,
  target_date:input.targetDate,
  status:'active'
 }).select().single()
 if(error){
  if(error.code==='23505'){
   const concurrent=await getActiveGoal(client,input.userId)
   if(concurrent)return concurrent
  }
  throw error
 }
 return normalizeGoal(data)
}

export async function updateActiveGoal(client:TypedSupabaseClient,input:{
 userId:string
 goalId:string
 startWeightLbs:number
 targetWeightLbs:number
 startDate:string
 targetDate:string|null
}){
 validateGoalValues(input)
 const {data,error}=await client.from('goals').update({
  target_weight_lbs:input.targetWeightLbs,
  target_date:input.targetDate
 }).eq('id',input.goalId).eq('user_id',input.userId).eq('status','active').select().single()
 if(error)throw error
 return normalizeGoal(data)
}

export async function transitionGoal(client:TypedSupabaseClient,input:{
 userId:string
 goalId:string
 status:Exclude<GoalStatus,'active'>
}){
 const {data,error}=await client.from('goals').update({
  status:input.status,
  completed_at:input.status==='completed'?new Date().toISOString():null
 }).eq('id',input.goalId).eq('user_id',input.userId).eq('status','active').select().single()
 if(error)throw error
 return normalizeGoal(data)
}

export async function getEffectiveGoalTarget(
 client:TypedSupabaseClient,userId:string,goalId:string,logDate:string
){
 validateDate(logDate,'Selected date')
 const {data,error}=await client.from('goal_targets').select()
  .eq('user_id',userId).eq('goal_id',goalId)
  .lte('effective_from',logDate)
  .or(`effective_to.is.null,effective_to.gt.${logDate}`)
  .order('effective_from',{ascending:false}).limit(1).maybeSingle()
 if(error)throw error
 return data?normalizeTarget(data):null
}

export async function getCurrentGoalTarget(
 client:TypedSupabaseClient,userId:string,goalId:string,currentDate:string
){
 return getEffectiveGoalTarget(client,userId,goalId,currentDate)
}

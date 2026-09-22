import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Tables} from './database.types'

export type MealSlot='breakfast'|'lunch'|'dinner'|'snack'
export type NutritionEntryType='food'|'drink'|'supplement'|'quick_add'|'legacy'|'adjustment'
export type NutritionSource='manual'|'quick_add'|'legacy'|'ai'|'import'

type NutritionEntryRow=Tables<'nutrition_entries'>
type DailyNutritionTotalsRow=Tables<'daily_nutrition_totals'>
type TypedSupabaseClient=SupabaseClient<Database>

export type NutritionEntry=Omit<NutritionEntryRow,'entry_type'|'meal_slot'|'source'>&{
 entry_type:NutritionEntryType
 meal_slot:MealSlot|null
 source:NutritionSource
}

export type DailyNutritionTotals=Omit<DailyNutritionTotalsRow,
 'log_date'|'calories_unknown_count'|'protein_unknown_count'|'carbs_unknown_count'|
 'fat_unknown_count'|'alcohol_unknown_count'|'entry_count'
>&{
 log_date:string
 calories_unknown_count:number
 protein_unknown_count:number
 carbs_unknown_count:number
 fat_unknown_count:number
 alcohol_unknown_count:number
 entry_count:number
}

type NutritionValues={
 calories?:number|null
 protein_g?:number|null
 carbs_g?:number|null
 fat_g?:number|null
 alcohol_servings?:number|null
}

export type CreateNutritionEntryInput=NutritionValues&{
 userId:string
 logDate:string
 entryType:NutritionEntryType
 description:string
 mealSlot?:MealSlot|null
 source:NutritionSource
 consumedAt?:string|null
 sourceRef?:string|null
}

export type UpdateNutritionEntryInput={
 description:string
 mealSlot:MealSlot|null
 calories:number|null
 protein_g:number|null
 carbs_g:number|null
}

const entryColumns='id,user_id,log_date,consumed_at,entry_type,meal_slot,description,calories,protein_g,carbs_g,fat_g,alcohol_servings,source,source_ref,created_at,updated_at'
const totalsColumns='user_id,log_date,calories,protein_g,carbs_g,fat_g,alcohol_servings,calories_unknown_count,protein_unknown_count,carbs_unknown_count,fat_unknown_count,alcohol_unknown_count,entry_count'

const numberOrNull=(value:unknown)=>value===null||value===undefined?null:Number(value)
const count=(value:unknown)=>Number(value||0)

function normalizeEntryType(value:string):NutritionEntryType{
 if(value==='food'||value==='drink'||value==='supplement'||value==='quick_add'||value==='legacy'||value==='adjustment')return value
 throw new Error(`Unsupported nutrition entry type: ${value}`)
}

function normalizeMealSlot(value:string|null):MealSlot|null{
 if(value===null)return null
 if(value==='breakfast'||value==='lunch'||value==='dinner'||value==='snack')return value
 throw new Error(`Unsupported meal slot: ${value}`)
}

function normalizeSource(value:string):NutritionSource{
 if(value==='manual'||value==='quick_add'||value==='legacy'||value==='ai'||value==='import')return value
 throw new Error(`Unsupported nutrition source: ${value}`)
}

export function emptyDailyNutritionTotals(logDate:string):DailyNutritionTotals{
 return {
  user_id:null,log_date:logDate,calories:null,protein_g:null,carbs_g:null,fat_g:null,
  alcohol_servings:null,calories_unknown_count:0,protein_unknown_count:0,
  carbs_unknown_count:0,fat_unknown_count:0,alcohol_unknown_count:0,entry_count:0
 }
}

function normalizeEntry(row:NutritionEntryRow):NutritionEntry{
 return {
  ...row,
  entry_type:normalizeEntryType(row.entry_type),meal_slot:normalizeMealSlot(row.meal_slot),
  source:normalizeSource(row.source),
  calories:numberOrNull(row.calories),protein_g:numberOrNull(row.protein_g),
  carbs_g:numberOrNull(row.carbs_g),fat_g:numberOrNull(row.fat_g),
  alcohol_servings:numberOrNull(row.alcohol_servings)
 }
}

function normalizeTotals(row:DailyNutritionTotalsRow|null,logDate:string):DailyNutritionTotals{
 if(!row)return emptyDailyNutritionTotals(logDate)
 return {
  ...row,log_date:logDate,
  calories:numberOrNull(row.calories),protein_g:numberOrNull(row.protein_g),
  carbs_g:numberOrNull(row.carbs_g),fat_g:numberOrNull(row.fat_g),
  alcohol_servings:numberOrNull(row.alcohol_servings),
  calories_unknown_count:count(row.calories_unknown_count),
  protein_unknown_count:count(row.protein_unknown_count),
  carbs_unknown_count:count(row.carbs_unknown_count),
  fat_unknown_count:count(row.fat_unknown_count),
  alcohol_unknown_count:count(row.alcohol_unknown_count),entry_count:count(row.entry_count)
 }
}

function hasMetric(values:NutritionValues){
 return [values.calories,values.protein_g,values.carbs_g,values.fat_g,values.alcohol_servings]
  .some(value=>value!==null&&value!==undefined)
}

function validateMetrics(values:NutritionValues,allowSigned=false){
 for(const value of [values.calories,values.protein_g,values.carbs_g,values.fat_g,values.alcohol_servings]){
  if(value!==null&&value!==undefined&&(!Number.isFinite(value)||(!allowSigned&&value<0))){
   throw new Error(allowSigned?'Nutrition adjustments must be valid numbers.':'Nutrition values must be valid non-negative numbers.')
  }
 }
 if(!hasMetric(values))throw new Error('Add at least one nutrition value.')
}

function validateCreateInput(input:CreateNutritionEntryInput){
 validateMetrics(input,input.entryType==='adjustment')
 if(input.entryType==='adjustment'){
  const supplied=[input.calories,input.protein_g,input.carbs_g].filter(value=>value!==null&&value!==undefined)
  if(supplied.length!==1||input.fat_g!=null||input.alcohol_servings!=null||!input.sourceRef?.trim()){
   throw new Error('A correction requires one calorie, protein, or carb value and a source reference.')
  }
 }
}

function requireDescription(description:string){
 const clean=description.trim()
 if(!clean)throw new Error('Description is required.')
 return clean
}

export async function getNutritionEntries(client:TypedSupabaseClient,userId:string,logDate:string){
 const {data,error}=await client.from('nutrition_entries').select(entryColumns)
  .eq('user_id',userId).eq('log_date',logDate).order('created_at',{ascending:true})
 if(error)throw error
 return (data||[]).map(normalizeEntry)
}

export async function getDailyNutritionTotals(client:TypedSupabaseClient,userId:string,logDate:string){
 const {data,error}=await client.from('daily_nutrition_totals').select(totalsColumns)
  .eq('user_id',userId).eq('log_date',logDate).maybeSingle()
 if(error)throw error
 return normalizeTotals(data,logDate)
}

export async function createNutritionEntry(client:TypedSupabaseClient,input:CreateNutritionEntryInput){
 const description=requireDescription(input.description)
 validateCreateInput(input)
 const {data,error}=await client.from('nutrition_entries').insert({
  user_id:input.userId,log_date:input.logDate,consumed_at:input.consumedAt??null,
  entry_type:input.entryType,meal_slot:input.mealSlot??null,description,
  calories:input.calories??null,protein_g:input.protein_g??null,
  carbs_g:input.carbs_g??null,fat_g:input.fat_g??null,
  alcohol_servings:input.alcohol_servings??null,source:input.source,
  source_ref:input.sourceRef??null
 }).select(entryColumns).single()
 if(error)throw error
 return normalizeEntry(data)
}

export async function updateNutritionEntry(
 client:TypedSupabaseClient,userId:string,logDate:string,entryId:string,input:UpdateNutritionEntryInput
){
 const description=requireDescription(input.description)
 const {data:existing,error:readError}=await client.from('nutrition_entries').select(entryColumns)
  .eq('id',entryId).eq('user_id',userId).eq('log_date',logDate).single()
 if(readError)throw readError
 if(normalizeEntry(existing).entry_type==='adjustment'){
  throw new Error('Daily corrections can be reverted, but not edited as food entries.')
 }
 validateMetrics({...normalizeEntry(existing),...input})
 const {data,error}=await client.from('nutrition_entries').update({
  description,meal_slot:input.mealSlot,calories:input.calories,
  protein_g:input.protein_g,carbs_g:input.carbs_g
 }).eq('id',entryId).eq('user_id',userId).eq('log_date',logDate).select(entryColumns).single()
 if(error)throw error
 return normalizeEntry(data)
}

export type CorrectableNutritionMetric='calories'|'protein_g'

export function calculateNutritionCorrection(currentTotal:number|null,existingCorrection:number|null,desiredTotal:number){
 if(!Number.isFinite(desiredTotal)||desiredTotal<0)throw new Error('Daily total must be a valid non-negative number.')
 const underlying=(currentTotal??0)-(existingCorrection??0)
 const correction=desiredTotal-underlying
 return Math.abs(correction)<.0001?0:correction
}

export async function replaceNutritionTotal(client:TypedSupabaseClient,input:{
 userId:string
 logDate:string
 metric:CorrectableNutritionMetric
 desiredTotal:number
 totals:DailyNutritionTotals
}){
 const {userId,logDate,metric,desiredTotal,totals}=input
 const unknownCount=metric==='calories'?totals.calories_unknown_count:totals.protein_unknown_count
 if(unknownCount>0)throw new Error('Complete the partial entries before replacing this total.')
 const sourceRef=`daily-total-correction:${metric}:${logDate}`
 const {data:existing,error:readError}=await client.from('nutrition_entries').select(entryColumns)
  .eq('user_id',userId).eq('log_date',logDate).eq('entry_type','adjustment')
  .eq('source','manual').eq('source_ref',sourceRef).maybeSingle()
 if(readError)throw readError
 const currentTotal=metric==='calories'?totals.calories:totals.protein_g
 const existingCorrection=existing?(metric==='calories'?Number(existing.calories):Number(existing.protein_g)):null
 const correction=calculateNutritionCorrection(currentTotal,existingCorrection,desiredTotal)
 if(correction===0){
  if(!existing)return null
  const {data,error}=await client.from('nutrition_entries').delete()
   .eq('id',existing.id).eq('user_id',userId).eq('log_date',logDate)
   .eq('entry_type','adjustment').select('id').maybeSingle()
  if(error)throw error
  if(!data)throw new Error('Daily correction was not found or could not be removed.')
  return null
 }
 const values={
  description:metric==='calories'?'Daily calorie correction':'Daily protein correction',
  calories:metric==='calories'?correction:null,
  protein_g:metric==='protein_g'?correction:null
 }
 if(existing){
  const {data,error}=await client.from('nutrition_entries').update(values)
   .eq('id',existing.id).eq('user_id',userId).eq('log_date',logDate)
   .eq('entry_type','adjustment').select(entryColumns).single()
  if(error)throw error
  return normalizeEntry(data)
 }
 return createNutritionEntry(client,{
  userId,logDate,entryType:'adjustment',source:'manual',sourceRef,
  description:values.description,calories:values.calories,protein_g:values.protein_g
 })
}

export async function deleteNutritionEntry(client:TypedSupabaseClient,userId:string,logDate:string,entryId:string){
 const {data,error}=await client.from('nutrition_entries').delete()
  .eq('id',entryId).eq('user_id',userId).eq('log_date',logDate)
  .select(entryColumns).maybeSingle()
 if(error)throw error
 if(!data)throw new Error('Nutrition entry was not found or could not be deleted.')
 return normalizeEntry(data)
}

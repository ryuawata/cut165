import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Tables} from './database.types'
import {createNutritionEntry,type MealSlot} from './nutrition.ts'

type TypedSupabaseClient=SupabaseClient<Database>
type NutritionPresetRow=Tables<'nutrition_presets'>
export type NutritionPreset=Omit<NutritionPresetRow,'meal_slot'>&{meal_slot:MealSlot|null}
export type NutritionPresetInput=Pick<NutritionPreset,
 'name'|'meal_slot'|'calories'|'protein_g'|'carbs_g'|'fat_g'|'alcohol_servings'|'sort_order'
>

const metrics=['calories','protein_g','carbs_g','fat_g','alcohol_servings'] as const

function mealSlot(value:string|null):MealSlot|null{
 if(value===null)return null
 if(value==='breakfast'||value==='lunch'||value==='dinner'||value==='snack')return value
 throw new Error('Choose a valid meal slot.')
}

export function validateNutritionPreset(input:NutritionPresetInput){
 const name=input.name.trim()
 if(!name)throw new Error('Quick Add name is required.')
 const values=Object.fromEntries(metrics.map(metric=>[metric,input[metric]])) as Pick<NutritionPresetInput,typeof metrics[number]>
 for(const metric of metrics){
  const value=values[metric]
  if(value!==null&&(!Number.isFinite(value)||value<0))throw new Error('Nutrition values must be valid non-negative numbers.')
 }
 if(!metrics.some(metric=>values[metric]!==null))throw new Error('Add at least one nutrition value.')
 if(!Number.isInteger(input.sort_order)||input.sort_order<0)throw new Error('Sort order must be a non-negative whole number.')
 return {...values,name,meal_slot:mealSlot(input.meal_slot),sort_order:input.sort_order}
}

function normalize(row:NutritionPresetRow):NutritionPreset{
 return {...row,meal_slot:mealSlot(row.meal_slot)}
}

export async function getNutritionPresets(client:TypedSupabaseClient,userId:string){
 const {data,error}=await client.from('nutrition_presets').select()
  .eq('user_id',userId).order('sort_order',{ascending:true}).order('created_at',{ascending:true})
 if(error)throw error
 return (data??[]).map(normalize)
}

export async function createNutritionPreset(client:TypedSupabaseClient,userId:string,input:NutritionPresetInput){
 const values=validateNutritionPreset(input)
 const {data,error}=await client.from('nutrition_presets').insert({user_id:userId,...values})
  .select().single()
 if(error)throw error
 return normalize(data)
}

export async function updateNutritionPreset(client:TypedSupabaseClient,userId:string,presetId:string,input:NutritionPresetInput){
 const values=validateNutritionPreset(input)
 const {data,error}=await client.from('nutrition_presets').update(values)
  .eq('id',presetId).eq('user_id',userId).select().single()
 if(error)throw error
 return normalize(data)
}

export async function deleteNutritionPreset(client:TypedSupabaseClient,userId:string,presetId:string){
 const {data,error}=await client.from('nutrition_presets').delete()
  .eq('id',presetId).eq('user_id',userId).select('id').maybeSingle()
 if(error)throw error
 if(!data)throw new Error('Quick Add preset was not found or could not be deleted.')
}

export async function logNutritionPreset(client:TypedSupabaseClient,userId:string,logDate:string,preset:NutritionPreset){
 return createNutritionEntry(client,{
  userId,logDate,entryType:'quick_add',description:preset.name,mealSlot:preset.meal_slot,
  source:'quick_add',calories:preset.calories,protein_g:preset.protein_g,
  carbs_g:preset.carbs_g,fat_g:preset.fat_g,alcohol_servings:preset.alcohol_servings
 })
}

import {z} from 'zod'
import type {CanonicalFood,CanonicalServing,NutritionProvider} from './types.ts'

export const parsedItemSchema=z.object({query:z.string().trim().min(2).max(120),quantity:z.number().positive().nullable(),unit:z.enum(['g','oz','piece','serving']).nullable()}).strict()
export type ParsedItem=z.infer<typeof parsedItemSchema>
export function parseMeal(message:string):ParsedItem[]{
 const clean=message.trim().replace(/^i (?:ate|had|drank)\s+/i,'').replace(/\b(?:but )?it was (?:mostly air|probably only).*$/i,'').replace(/\b(?:and )?\d+(?:\.\d+)?\s*(?:calories|kcal)\b.*$/i,'')
 const parts=clean.split(/\s+and\s+|,\s*(?=\d)/i).map(part=>part.trim()).filter(Boolean)
 if(!parts.length||parts.length>8)throw new Error('Describe up to eight foods.')
 return parts.map(part=>{
  const match=/^(?:(\d+(?:\.\d+)?)\s*(g|grams?|oz|ounces?|pieces?|dumplings?|servings?)?\s+)?(?:of\s+)?(.+?)$/i.exec(part)
  if(!match)throw new Error('Could not understand a food.')
  const quantity=match[1]?Number(match[1]):null
  const rawUnit=match[2]?.toLowerCase()
  const unit=rawUnit?.startsWith('g')?'g':rawUnit?.startsWith('oz')||rawUnit?.startsWith('ounce')?'oz':rawUnit?.startsWith('serving')?'serving':rawUnit||quantity!==null&&/\b(?:dumplings?|pieces?)\b/i.test(match[3])?'piece':null
  const noun=rawUnit?.startsWith('dumpling')?'dumplings ':''
  const query=(noun+match[3]).trim().replace(/^(?:of\s+)/i,'').replace(/\s+(?:with|and)\s+\d+.*$/i,'')
  return parsedItemSchema.parse({query,quantity,unit})
 })
}
export async function resolveMeal(provider:NutritionProvider,message:string){
 const parsed=parseMeal(message)
 return Promise.all(parsed.map(async item=>({item,candidates:await provider.searchFoods(item.query)})))
}
export function servingScale(serving:CanonicalServing,quantity:number,unit:ParsedItem['unit']){
 if(!Number.isFinite(quantity)||quantity<=0||quantity>10000)throw new Error('Enter a valid quantity.')
 if(!unit)throw new Error('Choose a quantity and unit.')
 if(unit==='g'||unit==='oz'){
  if(!serving.grams||serving.grams<=0)throw new Error('This serving has no weight. Choose another serving.')
  return quantity*(unit==='oz'?28.349523125:1)/serving.grams
 }
 if(unit==='piece'){
  const match=/^(\d+(?:\.\d+)?)\s*(?:pieces?|dumplings?|units?|items?|rolls?|slices?)/i.exec(serving.description)
  if(match)return quantity/Number(match[1])
  if(/^(?:piece|dumpling|unit|item|roll|slice|each)$/i.test(serving.unit)||/^(?:one|a)\s+(?:piece|dumpling|unit|item|roll|slice)/i.test(serving.description))return quantity/serving.amount
  throw new Error('Choose a serving that specifies pieces.')
 }
 return quantity/serving.amount
}
export function calculateFood(food:CanonicalFood,servingId:string,quantity:number,unit:ParsedItem['unit']){
 const serving=food.servings.find(value=>value.id===servingId)
 if(!serving)throw new Error('Serving was not found.')
 const scale=servingScale(serving,quantity,unit)
 const scaled=(value:number|null)=>value===null?null:Math.round(value*scale*10)/10
 return {serving,calories:scaled(serving.calories),protein_g:scaled(serving.protein_g),carbs_g:scaled(serving.carbs_g),fat_g:scaled(serving.fat_g)}
}

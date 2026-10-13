import {z} from 'zod'
import {authenticateNutritionChat,NutritionChatAccessError} from '../../../lib/nutrition-provider/auth.ts'
import {getNutritionProvider} from '../../../lib/nutrition-provider/index.ts'
import {calculateFood,resolveMeal} from '../../../lib/nutrition-provider/resolve.ts'
import {calendarDateInTimezone} from '../../../lib/targets.ts'
import {createNutritionEntry} from '../../../lib/nutrition.ts'

const selection=z.object({foodId:z.string().min(1),servingId:z.string().min(1),quantity:z.number().positive(),unit:z.enum(['g','oz','piece','serving'])}).strict()
const requestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('resolve'),message:z.string().trim().min(2).max(1000)}).strict(),
 z.object({action:z.literal('food'),foodId:z.string().min(1)}).strict(),
 z.object({action:z.literal('preview'),items:z.array(selection).min(1).max(8)}).strict(),
 z.object({action:z.literal('save'),items:z.array(selection).min(1).max(8),logDate:z.iso.date(),requestId:z.uuid()}).strict()
])
async function preview(items:z.infer<typeof selection>[],provider:ReturnType<typeof getNutritionProvider>){
 return Promise.all(items.map(async item=>{
  const food=await provider.getFood(item.foodId)
  const values=calculateFood(food,item.servingId,item.quantity,item.unit)
  return {food:{id:food.id,name:food.name,brand:food.brand,provider:food.provider},selection:item,serving:values.serving.description,calories:values.calories,protein_g:values.protein_g,carbs_g:values.carbs_g,fat_g:values.fat_g}
 }))
}
export async function POST(request:Request){
 try{
  const {client,userId}=await authenticateNutritionChat(request)
  if(Number(request.headers.get('content-length')??0)>16000)return Response.json({error:'Request is too large.'},{status:413})
  const input=requestSchema.parse(await request.json())
  const provider=getNutritionProvider()
  if(input.action==='resolve')return Response.json({items:await resolveMeal(provider,input.message)})
  if(input.action==='food')return Response.json({food:await provider.getFood(input.foodId)})
  const items=await preview(input.items,provider)
  if(input.action==='preview')return Response.json({items})
  const profile=await client.from('profiles').select('timezone').eq('user_id',userId).single()
  if(profile.error||!profile.data)throw new Error('Complete your profile before logging food.')
  if(input.logDate>calendarDateInTimezone(profile.data.timezone))throw new Error('Choose today or an earlier date.')
  // Provider identifiers and calculated values are snapshotted in existing entries.
  // Review provider licensing before caching any larger provider response.
  // The date is explicit so users can correct past days. Authenticated RLS scopes every write.
  const saved=[]
  for(let index=0;index<items.length;index++){
   const item=items[index]
   const sourceRef=`nutrition-chat:${input.requestId}:${index}:${item.food.provider}:${item.selection.foodId}:${item.selection.servingId}`
   const existing=await client.from('nutrition_entries').select('id').eq('user_id',userId).eq('source','ai').eq('source_ref',sourceRef).maybeSingle()
   if(existing.error)throw existing.error
   if(existing.data){saved.push(existing.data.id);continue}
   const entry=await createNutritionEntry(client,{userId,logDate:input.logDate,entryType:'food',source:'ai',sourceRef,description:item.food.brand?`${item.food.brand} ${item.food.name}`:item.food.name,calories:item.calories,protein_g:item.protein_g,carbs_g:item.carbs_g,fat_g:item.fat_g})
   saved.push(entry.id)
  }
  return Response.json({saved})
 }catch(error){
  if(error instanceof NutritionChatAccessError)return Response.json({error:error.message},{status:error.status})
  if(error instanceof z.ZodError)return Response.json({error:'Check the food and quantity.'},{status:400})
  const message=error instanceof Error?error.message:'Could not process food.'
  return Response.json({error:message},{status:400})
 }
}

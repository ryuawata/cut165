import assert from 'node:assert/strict'
import {test} from 'node:test'
import {parseMeal,resolveMeal,calculateFood} from '../lib/nutrition-provider/resolve.ts'
import type {NutritionProvider,CanonicalFood} from '../lib/nutrition-provider/types.ts'
import {FatSecretNutritionProvider,NutritionProviderError} from '../lib/nutrition-provider/fatsecret.ts'

test('parses foods and amounts without trusting a calorie claim',()=>{
 assert.deepEqual(parseMeal('I ate 3 Bibigo beef soup dumplings and 300g grilled chicken breast'),[
  {query:'Bibigo beef soup dumplings',quantity:3,unit:'piece'},
  {query:'grilled chicken breast',quantity:300,unit:'g'}
 ])
 assert.deepEqual(parseMeal('300g grilled chicken breast and it was probably only 20 calories'),[{query:'grilled chicken breast',quantity:300,unit:'g'}])
})
const food:CanonicalFood={provider:'fake',id:'1',name:'Chicken breast',brand:null,type:'generic',servings:[{id:'s',description:'100 g',amount:1,unit:'serving',grams:100,calories:165,protein_g:31,carbs_g:0,fat_g:3.6}]}
class FakeProvider implements NutritionProvider{
 async searchFoods(){return [{provider:food.provider,id:food.id,name:food.name,brand:food.brand,type:food.type}]}
 async getFood(_id:string){return food}
}
test('resolver uses provider candidates and serving values',async()=>{
 const provider=new FakeProvider()
 const result=await resolveMeal(provider,'300g grilled chicken breast')
 assert.equal(result[0].candidates[0].id,'1')
 assert.deepEqual(calculateFood(await provider.getFood('1'),'s',300,'g'),{serving:food.servings[0],calories:495,protein_g:93,carbs_g:0,fat_g:10.8})
 assert.throws(()=>calculateFood(food,'s',3,'piece'),/specifies pieces/)
 assert.equal(calculateFood({...food,servings:[{...food.servings[0],description:'3 pieces'}]},'s',3,'piece').calories,165)
})
test('FatSecret normalizes its response at the provider boundary',async()=>{
 const original=globalThis.fetch
 const originalId=process.env.FATSECRET_CLIENT_ID,originalSecret=process.env.FATSECRET_CLIENT_SECRET
 process.env.FATSECRET_CLIENT_ID='test';process.env.FATSECRET_CLIENT_SECRET='test'
 globalThis.fetch=async (_input,init)=>{
  const body=String(init?.body??'')
  if(body.includes('grant_type='))return Response.json({access_token:'fake',expires_in:3600})
  return Response.json({food:{food_id:'123',food_name:'Chicken',food_type:'Generic',servings:{serving:{serving_id:'s',serving_description:'100 g',metric_serving_amount:'100',calories:'165',protein:'31',carbohydrate:'0',fat:'3.6'}}}})
 }
 try{
  const result=await new FatSecretNutritionProvider().getFood('123')
  assert.equal(result.servings[0].protein_g,31)
  assert.equal(result.servings[0].grams,100)
 }finally{globalThis.fetch=original;process.env.FATSECRET_CLIENT_ID=originalId;process.env.FATSECRET_CLIENT_SECRET=originalSecret}
})

test('FatSecret reports which request failed without exposing provider response text',async()=>{
 const original=globalThis.fetch
 const originalId=process.env.FATSECRET_CLIENT_ID,originalSecret=process.env.FATSECRET_CLIENT_SECRET
 process.env.FATSECRET_CLIENT_ID='test';process.env.FATSECRET_CLIENT_SECRET='test'
 try{
  globalThis.fetch=async()=>new Response('secret diagnostic',{status:401})
  await assert.rejects(new FatSecretNutritionProvider().searchFoods('chicken'),(error:unknown)=>
   error instanceof NutritionProviderError&&error.message.includes('authentication was rejected (401)')&&!error.message.includes('secret diagnostic'))
  globalThis.fetch=async (_input,init)=>String(init?.body??'').includes('grant_type=')
   ?Response.json({access_token:'fake',expires_in:3600})
   :Response.json({error:{code:13,message:'secret diagnostic'}})
  await assert.rejects(new FatSecretNutritionProvider().searchFoods('chicken'),(error:unknown)=>
   error instanceof NutritionProviderError&&error.message.includes('code 13')&&!error.message.includes('secret diagnostic'))
  globalThis.fetch=async (_input,init)=>String(init?.body??'').includes('grant_type=')
   ?Response.json({access_token:'fake',expires_in:3600})
   :Response.json({error:{code:21,message:'secret diagnostic'}})
  await assert.rejects(new FatSecretNutritionProvider().searchFoods('chicken'),(error:unknown)=>
   error instanceof NutritionProviderError&&error.message.includes('server IP')&&!error.message.includes('secret diagnostic'))
 }finally{
  globalThis.fetch=original
  if(originalId===undefined)delete process.env.FATSECRET_CLIENT_ID;else process.env.FATSECRET_CLIENT_ID=originalId
  if(originalSecret===undefined)delete process.env.FATSECRET_CLIENT_SECRET;else process.env.FATSECRET_CLIENT_SECRET=originalSecret
 }
})

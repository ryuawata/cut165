import type {CanonicalFood,CanonicalServing,FoodSearchResult,NutritionProvider} from './types.ts'

type RawFood={food_id?:string|number;food_name?:string;brand_name?:string;food_type?:string;servings?:{serving?:RawServing|RawServing[]}}
type RawServing={serving_id?:string|number;serving_description?:string;number_of_units?:string;measurement_description?:string;metric_serving_amount?:string;calories?:string;protein?:string;carbohydrate?:string;fat?:string}
export class NutritionProviderError extends Error{
 status:number
 constructor(message:string,status:number){super(message);this.status=status}
}
function responseError(stage:'authentication'|'food lookup',status:number){
 if(status===429)return new NutritionProviderError('FatSecret rate limit reached. Try again shortly.',429)
 if(status===401||status===403)return new NutritionProviderError(`FatSecret ${stage} was rejected (${status}). Check the Client ID, Client Secret, and API access.`,502)
 return new NutritionProviderError(`FatSecret ${stage} failed (HTTP ${status}).`,502)
}
const list=<T>(value:T|T[]|undefined):T[]=>value===undefined?[]:Array.isArray(value)?value:[value]
const metric=(value?:string)=>value===undefined?null:Number.isFinite(Number(value))?Number(value):null
function normalizeServing(raw:RawServing,index:number):CanonicalServing{
 return {id:String(raw.serving_id??index),description:raw.serving_description??'Serving',amount:metric(raw.number_of_units)??1,unit:raw.measurement_description??'serving',grams:metric(raw.metric_serving_amount),calories:metric(raw.calories),protein_g:metric(raw.protein),carbs_g:metric(raw.carbohydrate),fat_g:metric(raw.fat)}
}
function normalizeFood(raw:RawFood):FoodSearchResult{
 if(!raw.food_id||!raw.food_name)throw new Error('Nutrition provider returned an incomplete food.')
 return {provider:'fatsecret',id:String(raw.food_id),name:raw.food_name,brand:raw.brand_name??null,type:raw.food_type==='Brand'?'branded':raw.food_type==='Generic'?'generic':'unknown'}
}
export class FatSecretNutritionProvider implements NutritionProvider{
 private token:string|null=null
 private expires=0
 private async accessToken(){
  if(this.token&&Date.now()<this.expires)return this.token
  const id=process.env.FATSECRET_CLIENT_ID,key=process.env.FATSECRET_CLIENT_SECRET
  if(!id||!key)throw new Error('Nutrition provider is not configured.')
  const response=await fetch('https://oauth.fatsecret.com/connect/token',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${key}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=basic',cache:'no-store'})
  if(!response.ok)throw responseError('authentication',response.status)
  const data=await response.json() as {access_token?:string;expires_in?:number}
  if(!data.access_token)throw new NutritionProviderError('FatSecret did not return an access token.',502)
  this.token=data.access_token;this.expires=Date.now()+Math.max(0,(data.expires_in??3600)-60)*1000
  return this.token
 }
 private async call(method:string,params:Record<string,string>){
  const body=new URLSearchParams({method,format:'json',...params})
  const response=await fetch('https://platform.fatsecret.com/rest/server.api',{method:'POST',headers:{Authorization:`Bearer ${await this.accessToken()}`,'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'})
  if(!response.ok)throw responseError('food lookup',response.status)
  const data=await response.json() as {error?:{code?:string|number};foods?:{food?:RawFood|RawFood[]};food?:RawFood}
  if(data.error){
   const code=data.error.code
   const suffix=typeof code==='number'||typeof code==='string'&&/^\d{1,4}$/.test(code)?` (code ${code})`:''
   throw new NutritionProviderError(`FatSecret rejected the food lookup${suffix}.`,502)
  }
  return data
 }
 async searchFoods(query:string){
  const data=await this.call('foods.search',{search_expression:query,max_results:'8'})
  return list(data.foods?.food).map(normalizeFood)
 }
 async getFood(id:string):Promise<CanonicalFood>{
  const data=await this.call('food.get',{food_id:id})
  if(!data.food)throw new Error('Food was not found.')
  return {...normalizeFood(data.food),servings:list(data.food.servings?.serving).map(normalizeServing)}
 }
}

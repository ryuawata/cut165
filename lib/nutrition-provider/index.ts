import {FatSecretNutritionProvider} from './fatsecret.ts'
import type {NutritionProvider} from './types.ts'
let provider:NutritionProvider|undefined
export function getNutritionProvider():NutritionProvider{
 if(provider)return provider
 switch(process.env.NUTRITION_PROVIDER??'fatsecret'){
  case 'fatsecret':provider=new FatSecretNutritionProvider();return provider
  default:throw new Error('Unsupported nutrition provider.')
 }
}

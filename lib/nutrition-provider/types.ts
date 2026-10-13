export type CanonicalServing={id:string;description:string;amount:number;unit:string;grams:number|null;calories:number|null;protein_g:number|null;carbs_g:number|null;fat_g:number|null}
export type CanonicalFood={provider:string;id:string;name:string;brand:string|null;type:'generic'|'branded'|'restaurant'|'unknown';servings:CanonicalServing[]}
export type FoodSearchResult=Omit<CanonicalFood,'servings'>
export interface NutritionProvider{
 searchFoods(query:string):Promise<FoodSearchResult[]>
 getFood(id:string):Promise<CanonicalFood>
}

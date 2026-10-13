import {createClient} from '@supabase/supabase-js'
import type {Database} from '../database.types.ts'

export class NutritionChatAccessError extends Error{
 constructor(public status:number,message:string){super(message)}
}
export async function authenticateNutritionChat(request:Request){
 const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')??'')
 if(!match)throw new NutritionChatAccessError(401,'Authentication required.')
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(!url||!key)throw new NutritionChatAccessError(503,'Nutrition logging is unavailable.')
 const client=createClient<Database>(url,key,{global:{headers:{Authorization:`Bearer ${match[1]}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data,error}=await client.auth.getUser(match[1])
 if(error||!data.user)throw new NutritionChatAccessError(401,'Authentication required.')
 return {client,userId:data.user.id}
}

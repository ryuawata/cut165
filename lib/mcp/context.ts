import {createClient, type SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../database.types'

export type McpContext={client:SupabaseClient<Database>;userId:string}
export class McpAccessError extends Error{
 status:number
 constructor(status:number,message:string){super(message);this.status=status}
}

export async function authenticateMcp(request:Request):Promise<McpContext>{
 const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')??'')
 if(!match)throw new McpAccessError(401,'Authentication required.')
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(!url||!key)throw new McpAccessError(503,'MCP is unavailable.')
 // Never use the browser singleton or an administrative client here.
 const client=createClient<Database>(url,key,{
  global:{headers:{Authorization:`Bearer ${match[1]}`}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 })
 const {data,error}=await client.auth.getUser(match[1])
 if(error||!data.user)throw new McpAccessError(401,'Authentication required.')
 return {client,userId:data.user.id}
}

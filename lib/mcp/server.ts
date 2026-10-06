import {McpServer} from '@modelcontextprotocol/server'
import {z} from 'zod'
import type {McpContext} from './context.ts'
import {getTodaySummary} from './today-summary.ts'

export function createMcpServer(context:McpContext,onToolError:()=>void,summary=getTodaySummary){
 const server=new McpServer({name:'cut365',version:'0.1.0'},{capabilities:{tools:{}}})
 server.registerTool('get_today_summary',{
  description:'Read today in your persisted CUT365 timezone. Returns existing nutrition totals, targets, metrics and program training state. Null means unrecorded or unavailable; unknown counts preserve incomplete nutrition. Training code is the sequence/stored session; display determines whether today is rest. Does not change any data.',
  inputSchema:z.object({}).strict(),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
 },async()=>{
  try{
   const result=await summary(context)
   return {content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:result}
  }catch{
   onToolError()
   return {isError:true,content:[{type:'text' as const,text:'Today summary is unavailable. Please retry.'}],
    structuredContent:{error:{code:'SUMMARY_UNAVAILABLE',message:'Today summary is unavailable. Please retry.'}}}
  }
 })
 return server
}

import {createMcpHandler as createProtocolHandler} from '@modelcontextprotocol/server'
import {authenticateMcp,McpAccessError} from './context.ts'
import {createMcpServer} from './server.ts'

type Dependencies={authenticate?:typeof authenticateMcp;createServer?:typeof createMcpServer;log?:(event:Record<string,unknown>)=>void}
export function createMcpHandler(deps:Dependencies={}){
 return async(request:Request)=>{
  const requestId=crypto.randomUUID(),started=Date.now()
  const log=deps.log??(event=>console.info(JSON.stringify(event)))
  let status=500
  const finish=(response:Response)=>{
   status=response.status
   response.headers.set('Cache-Control','no-store')
   response.headers.set('X-Request-Id',requestId)
   return response
  }
  const failure=(httpStatus:number,message:string)=>finish(Response.json({jsonrpc:'2.0',id:null,
   error:{code:-32000,message,data:{request_id:requestId}}},{status:httpStatus,
    headers:httpStatus===401?{'WWW-Authenticate':'Bearer realm="cut365-mcp"'}:{}}))
  try{
   // Native MCP clients omit Origin. Browser origins must be explicitly trusted.
   const origin=request.headers.get('origin')
   const allowed=(process.env.MCP_ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean)
   if(origin&&!allowed.includes(origin))return failure(403,'Origin is not allowed.')
   const context=await (deps.authenticate??authenticateMcp)(request)
   if(request.method!=='POST'){
    const response=failure(405,'Method not allowed.')
    response.headers.set('Allow','POST')
    return response
   }
   if(!(request.headers.get('accept')??'').toLowerCase().includes('application/json'))return failure(406,'Not acceptable.')
   const protocol=createProtocolHandler(
    ()=> (deps.createServer??createMcpServer)(context,()=>log({event:'mcp_tool_error',request_id:requestId,code:'SUMMARY_UNAVAILABLE'})),
    {legacy:'reject',maxRequestBodySize:16*1024,
     onerror:()=>log({event:'mcp_protocol_error',request_id:requestId,code:'PROTOCOL_ERROR'})}
   )
   try{
    return finish(await protocol.fetch(request))
   }finally{await protocol.close()}
  }catch(error){
   return failure(error instanceof McpAccessError?error.status:500,
    error instanceof McpAccessError?error.message:'MCP request failed.')
  }finally{
   log({event:'mcp_request',request_id:requestId,status,duration_ms:Date.now()-started})
  }
 }
}

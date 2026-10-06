import test from 'node:test'
import assert from 'node:assert/strict'
import {createMcpHandler} from '../lib/mcp/handler.ts'
import {createMcpServer} from '../lib/mcp/server.ts'
import {authenticateMcp,McpAccessError} from '../lib/mcp/context.ts'
import {getTodaySummary} from '../lib/mcp/today-summary.ts'
import type {McpContext} from '../lib/mcp/context.ts'

const context={userId:'alice',client:{} as McpContext['client']}
const headers={authorization:'Bearer example',accept:'application/json, text/event-stream','content-type':'application/json','mcp-protocol-version':'2025-11-25'}
const request=(body:unknown,extra:Record<string,string>={})=>new Request('https://cut365.app/api/mcp',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)})
const rpc=(method:string,params?:unknown)=>({jsonrpc:'2.0',id:1,method,...(params===undefined?{}:{params})})
const setup=(summary=async(ctx:McpContext)=>({status:ctx.userId,date:'2026-10-06'}))=>{
 const logs:Record<string,unknown>[]=[]
 const handler=createMcpHandler({authenticate:async()=>context,log:e=>logs.push(e),createServer:(ctx,onError)=>createMcpServer(ctx,onError,summary)})
 return {handler,logs}
}

test('MCP initialize, notification, ping, list and call round trip',async()=>{
 const {handler}=setup()
 const init=await handler(request(rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}})))
 assert.equal(init.status,200)
 const body=await init.json()
 assert.equal(body.result.protocolVersion,'2025-11-25')
 assert.equal(body.result.serverInfo.name,'cut365')
 assert.equal(init.headers.get('mcp-session-id'),null)
 assert.equal((await handler(request({jsonrpc:'2.0',method:'notifications/initialized'}))).status,202)
 assert.deepEqual((await (await handler(request(rpc('ping')))).json()).result,{})
 const list=await (await handler(request(rpc('tools/list')))).json()
 assert.deepEqual(list.result.tools.map(t=>t.name),['get_today_summary'])
 assert.equal(list.result.tools[0].annotations.readOnlyHint,true)
 const call=await (await handler(request(rpc('tools/call',{name:'get_today_summary',arguments:{}})))).json()
 assert.equal(call.result.structuredContent.status,'alice')
})

test('authentication is required even for discovery, initialization and GET',async()=>{
 const handler=createMcpHandler({log:()=>{}})
 for(const method of ['GET','POST']){
  const res=await handler(new Request('https://cut365.app/api/mcp',{method}))
  assert.equal(res.status,401)
  assert.match(res.headers.get('www-authenticate')??'',/Bearer/)
  assert.equal(res.headers.get('cache-control'),'no-store')
 }
 await assert.rejects(authenticateMcp(new Request('https://cut365.app',{headers:{authorization:'Bearer x y'}})),McpAccessError)
 const rejected=createMcpHandler({authenticate:async()=>{throw new McpAccessError(401,'Authentication required.')},log:()=>{}})
 assert.equal((await rejected(request(rpc('tools/list')))).status,401)
})

test('origins, unsupported methods, bad versions and media types are rejected',async()=>{
 const {handler}=setup()
 assert.equal((await handler(request(rpc('ping'),{origin:'https://evil.example'}))).status,403)
 for(const method of ['GET','DELETE','PUT','PATCH','OPTIONS'])assert.equal((await handler(new Request('https://cut365.app/api/mcp',{method}))).status,405)
 assert.equal((await handler(request(rpc('ping'),{'mcp-protocol-version':'unsupported'}))).status,400)
 assert.equal((await handler(request(rpc('ping'),{accept:'text/plain'}))).status,406)
 assert.equal((await handler(request(rpc('ping'),{'content-type':'text/plain'}))).status,415)
})

test('invalid JSON, oversized bodies and unregistered tools cannot execute domain code',async()=>{
 let calls=0
 const {handler}=setup(async()=>{calls++;return {status:'ok',date:'2026-10-06'}})
 const bad=await handler(new Request('https://cut365.app/api/mcp',{method:'POST',headers,body:'{' }))
 assert.equal(bad.status,400)
 assert.equal((await handler(request({padding:'x'.repeat(17000)}))).status,413)
 for(const params of [{name:'execute_sql',arguments:{sql:'select *'}},{name:'get_today_summary',arguments:{userId:'bob'}},{name:'get_today_summary',arguments:{date:'2000-01-01'}}]){
  const body=await (await handler(request(rpc('tools/call',params)))).json()
  assert.ok(body.error||body.result?.isError)
 }
 assert.equal(calls,0)
})

test('domain errors are sanitized and logs contain no payloads or secrets',async()=>{
 const {handler,logs}=setup(async()=>{throw new Error('private SQL token and health data')})
 const res=await handler(request(rpc('tools/call',{name:'get_today_summary',arguments:{}})))
 const body=await res.json()
 assert.equal(body.result.isError,true)
 assert.equal(body.result.structuredContent.error.code,'SUMMARY_UNAVAILABLE')
 assert.doesNotMatch(JSON.stringify([body,logs]),/private SQL|example|health data/)
 assert.ok(logs.some(e=>e.event==='mcp_tool_error'))
 assert.ok(res.headers.get('x-request-id'))
})

test('concurrent requests never reuse another authenticated context',async()=>{
 const handler=createMcpHandler({log:()=>{},authenticate:async r=>({...context,userId:r.headers.get('authorization')!}),
  createServer:(ctx,onError)=>createMcpServer(ctx,onError,async c=>({status:c.userId,date:'2026-10-06'}))})
 const results=await Promise.all(['alice','bob'].map(async name=>(await (await handler(request(rpc('tools/call',{name:'get_today_summary',arguments:{}}),{authorization:name}))).json()).result.structuredContent.status))
 assert.deepEqual(results,['alice','bob'])
})

// A read-only query double runs the actual domain readers and records ownership filters.
function dataClient(rows:Record<string,unknown>){
 const queries:{table:string;filters:unknown[][]}[]=[]
 const client={from(table:string){
  const query={table,filters:[] as unknown[][]};queries.push(query)
  const chain={select(){return chain},eq(...args:unknown[]){query.filters.push(args);return chain},
   lte(){return chain},lt(){return chain},gte(){return chain},in(){return chain},or(){return chain},order(){return chain},limit(){return chain},
   maybeSingle(){return Promise.resolve({data:rows[table]??null,error:null})},
   then(resolve:(v:unknown)=>unknown){return Promise.resolve({data:rows[table]??[],error:null}).then(resolve)}}
  return chain
 }} as unknown as McpContext['client']
 return {client,queries}
}

test('summary uses persisted timezone, nulls and domain readers with ownership on every query',async()=>{
 const {client,queries}=dataClient({profiles:{timezone:'America/Chicago',exercise_frequency:'one_to_two',energy_estimation_sex:null,weight_unit:'lb',activity_level:'light'}})
 const summary=await getTodaySummary({client,userId:'alice'},new Date('2026-10-07T02:00:00Z'))
 assert.equal(summary.date,'2026-10-06')
 assert.equal(summary.weight_lbs,null)
 assert.equal(summary.nutrition.calories,null)
 assert.equal(summary.targets,null)
 assert.equal(summary.training.code,'full_body_a')
 for(const query of queries)assert.ok(query.filters.some(([key,value])=>key==='user_id'&&value==='alice'),query.table)
 assert.equal('user_id' in summary.nutrition,false)
})

test('missing profile does not invent a timezone or perform bootstrap writes',async()=>{
 const {client,queries}=dataClient({})
 assert.deepEqual(await getTodaySummary({client,userId:'alice'}),{status:'profile_required',date:null})
 assert.equal(queries.length,1)
})

test('official MCP client connects and calls through Streamable HTTP',async()=>{
 const {Client}=await import('@modelcontextprotocol/sdk/client/index.js')
 const {StreamableHTTPClientTransport}=await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
 const {handler}=setup()
 const transport=new StreamableHTTPClientTransport(new URL('https://cut365.app/api/mcp'),{
  requestInit:{headers:{authorization:'Bearer example'}},
  fetch:async(input,init)=>handler(new Request(input,init))
 })
 const client=new Client({name:'integration-test',version:'1'})
 try{
  await client.connect(transport)
  assert.equal((await client.listTools()).tools.length,1)
  const result=await client.callTool({name:'get_today_summary',arguments:{}})
  assert.equal((result.structuredContent as Record<string,unknown>)?.status,'alice')
 }finally{await client.close()}
})

test('real auth adapter validates bearer with Supabase and carries it into RLS reads',async t=>{
 const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
 const previousKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://auth-test.supabase.co'
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test'
 t.after(()=>{
  if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl
  if(previousKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=previousKey
 })
 const seen:{url:string;authorization:string}[]=[]
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input),authorization=new Headers(init?.headers).get('authorization')??''
  seen.push({url,authorization})
  if(url.includes('/auth/v1/user'))return Response.json(authorization==='Bearer valid-user-token'
   ?{id:'verified-alice',aud:'authenticated',role:'authenticated',email:'private@example.com'}
   :{message:'Invalid JWT',code:'bad_jwt'},{status:authorization==='Bearer valid-user-token'?200:401})
  return Response.json([])
 })
 const ctx=await authenticateMcp(new Request('https://cut365.app',{headers:{authorization:'Bearer valid-user-token'}}))
 assert.equal(ctx.userId,'verified-alice')
 await ctx.client.from('profiles').select().eq('user_id',ctx.userId)
 assert.ok(seen.every(x=>x.authorization==='Bearer valid-user-token'))
 assert.ok(seen.some(x=>x.url.includes('/auth/v1/user')))
 await assert.rejects(authenticateMcp(new Request('https://cut365.app',{headers:{authorization:'Bearer expired-token'}})),{status:401})
})

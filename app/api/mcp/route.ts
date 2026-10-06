import {createMcpHandler} from '../../../lib/mcp/handler'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const handle=createMcpHandler()
export const POST=handle
export const GET=handle
export const DELETE=handle
export const PUT=handle
export const PATCH=handle
export const OPTIONS=handle
export const HEAD=handle

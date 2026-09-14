import {createClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'
import type {Database,Tables} from '../../../lib/database.types'
import {calculateInitialTargets,calendarDateInTimezone,shiftCalendarDate} from '../../../lib/targets'
import type {ActivityLevel,EnergyEstimationSex} from '../../../lib/profile'
import type {GoalType} from '../../../lib/goals'

type GoalRow=Tables<'goals'>
type ProfileRow=Tables<'profiles'>

const isoPattern=/^\d{4}-\d{2}-\d{2}$/

function readRequest(value:unknown){
 if(!value||typeof value!=='object')throw new Error('Invalid request body.')
 const body=value as Record<string,unknown>
 const goalId=typeof body.goalId==='string'?body.goalId:''
 const effectiveFrom=typeof body.effectiveFrom==='string'?body.effectiveFrom:''
 const targetWeightLbs=typeof body.targetWeightLbs==='number'?body.targetWeightLbs:NaN
 const targetDate=body.targetDate===null?null:typeof body.targetDate==='string'?body.targetDate:''
 const stepsTarget=typeof body.stepsTarget==='number'?body.stepsTarget:NaN
 const source=body.source==='onboarding'||body.source==='manual'?body.source:null
 if(!goalId||!isoPattern.test(effectiveFrom)||(targetDate!==null&&!isoPattern.test(targetDate))||!source){
  throw new Error('Invalid goal-target request.')
 }
 return {goalId,effectiveFrom,targetWeightLbs,targetDate,stepsTarget,source}
}

function narrowGoalType(value:string):GoalType{
 if(value==='cut'||value==='maintain'||value==='bulk')return value
 throw new Error('Goal type is invalid.')
}

function narrowSex(value:string|null):EnergyEstimationSex{
 if(value==='male'||value==='female')return value
 throw new Error('Complete the profile before calculating targets.')
}

function narrowActivity(value:string):ActivityLevel{
 if(value==='sedentary'||value==='light'||value==='moderate'||value==='very_active')return value
 throw new Error('Complete the profile before calculating targets.')
}

function requireProfile(profile:ProfileRow|null):ProfileRow{
 if(!profile||profile.birth_year===null||profile.height_inches===null){
  throw new Error('Complete the profile before calculating targets.')
 }
 return profile
}

function requireGoal(goal:GoalRow|null):GoalRow{
 if(!goal)throw new Error('Active goal not found.')
 return goal
}

export async function POST(request:NextRequest){
 try{
  const authorization=request.headers.get('authorization')||''
  const accessToken=authorization.startsWith('Bearer ')?authorization.slice(7):''
  if(!accessToken)return NextResponse.json({error:'Authentication required.'},{status:401})

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const secretKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!publishableKey||!secretKey){
   return NextResponse.json({error:'Server configuration is incomplete.'},{status:500})
  }

  const authClient=createClient<Database>(url,publishableKey,{
   global:{headers:{Authorization:`Bearer ${accessToken}`}},
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  })
  const {data:userData,error:userError}=await authClient.auth.getUser(accessToken)
  if(userError||!userData.user)return NextResponse.json({error:'Authentication required.'},{status:401})
  const userId=userData.user.id
  const input=readRequest(await request.json())

  const admin=createClient<Database>(url,secretKey,{
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  })
  const [profileResult,goalResult,weightResult]=await Promise.all([
   admin.from('profiles').select().eq('user_id',userId).maybeSingle(),
   admin.from('goals').select().eq('id',input.goalId).eq('user_id',userId).eq('status','active').maybeSingle(),
   admin.from('body_measurements').select('weight_lbs').eq('user_id',userId)
    .lte('log_date',input.effectiveFrom).order('log_date',{ascending:false}).limit(1).maybeSingle()
  ])
  if(profileResult.error)throw profileResult.error
  if(goalResult.error)throw goalResult.error
  if(weightResult.error)throw weightResult.error
  const profile=requireProfile(profileResult.data)
  const goal=requireGoal(goalResult.data)
  const localToday=calendarDateInTimezone(profile.timezone)
  if(input.effectiveFrom!==localToday&&input.effectiveFrom!==shiftCalendarDate(localToday,1)){
   throw new Error('Goal changes must begin today or tomorrow in your timezone.')
  }
  if(!weightResult.data)throw new Error('Record a current weight before calculating targets.')

  const calculated=calculateInitialTargets({
   birthYear:profile.birth_year,
   sex:narrowSex(profile.energy_estimation_sex),
   heightInches:profile.height_inches,
   currentWeightLbs:weightResult.data.weight_lbs,
   targetWeightLbs:input.targetWeightLbs,
   goalType:narrowGoalType(goal.goal_type),
   activityLevel:narrowActivity(profile.activity_level),
   stepsTarget:input.stepsTarget,
   targetDate:input.targetDate,
   effectiveDate:input.effectiveFrom
  })

  const {data:target,error:targetError}=await admin.rpc('replace_goal_target',{
   p_user_id:userId,
   p_goal_id:goal.id,
   p_effective_from:input.effectiveFrom,
   p_target_weight_lbs:input.targetWeightLbs,
   p_target_date:input.targetDate,
   p_calorie_target_min:calculated.calorieTargetMin,
   p_calorie_target_max:calculated.calorieTargetMax,
   p_protein_target_g:calculated.proteinTargetG,
   p_carb_target_g:calculated.carbTargetG,
   p_steps_target:calculated.stepsTarget,
   p_water_target_oz:calculated.waterTargetOz,
   p_weekly_weight_change_target_lbs:calculated.weeklyWeightChangeTargetLbs,
   p_source:input.source
  })
  if(targetError)throw targetError
  const {data:updatedGoal,error:goalError}=await admin.from('goals').select()
   .eq('id',goal.id).eq('user_id',userId).eq('status','active').single()
  if(goalError)throw goalError
  return NextResponse.json({goal:updatedGoal,target})
 }catch(error){
  const message=error instanceof Error?error.message:'Could not update goal targets.'
  return NextResponse.json({error:message},{status:400})
 }
}

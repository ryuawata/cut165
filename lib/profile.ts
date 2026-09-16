import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Tables} from './database.types'

type ProfileRow=Tables<'profiles'>
type TypedSupabaseClient=SupabaseClient<Database>

export type EnergyEstimationSex='male'|'female'
export type WeightUnit='lb'|'kg'
export type ActivityLevel='sedentary'|'light'|'moderate'|'very_active'
export type ExerciseFrequency='none'|'one_to_two'|'three_to_four'|'five_plus'
export type Profile=Omit<ProfileRow,'energy_estimation_sex'|'weight_unit'|'activity_level'|'exercise_frequency'>&{
 energy_estimation_sex:EnergyEstimationSex|null
 weight_unit:WeightUnit
 activity_level:ActivityLevel
 exercise_frequency:ExerciseFrequency
}

export type ProfileInput={
 displayName:string|null
 birthYear:number|null
 energyEstimationSex:EnergyEstimationSex|null
 heightInches:number|null
 timezone:string
 weightUnit:WeightUnit
 activityLevel:ActivityLevel
 exerciseFrequency:ExerciseFrequency
 onboardingComplete:boolean
}

export type CalculationProfileFields=Pick<Profile,'birth_year'|'energy_estimation_sex'|'height_inches'>

export function hasCompleteCalculationProfile(profile:CalculationProfileFields){
 return profile.birth_year!==null&&profile.energy_estimation_sex!==null&&profile.height_inches!==null
}

function narrowSex(value:string|null):EnergyEstimationSex|null{
 if(value===null)return null
 if(value==='male')return 'male'
 if(value==='female')return 'female'
 throw new Error('Profile contains an unsupported energy-estimation sex.')
}

function narrowUnit(value:string):WeightUnit{
 if(value==='lb'||value==='kg')return value
 throw new Error('Profile contains an unsupported weight unit.')
}

function narrowActivity(value:string):ActivityLevel{
 if(value==='sedentary')return 'sedentary'
 if(value==='light')return 'light'
 if(value==='moderate')return 'moderate'
 if(value==='very_active')return 'very_active'
 throw new Error('Profile contains an unsupported activity level.')
}

function normalizeProfile(row:ProfileRow):Profile{
 return {
  ...row,
  energy_estimation_sex:narrowSex(row.energy_estimation_sex),
  weight_unit:narrowUnit(row.weight_unit),
  activity_level:narrowActivity(row.activity_level),
  exercise_frequency:narrowExerciseFrequency(row.exercise_frequency)
 }
}

function narrowExerciseFrequency(value:string):ExerciseFrequency{
 if(value==='none'||value==='one_to_two'||value==='three_to_four'||value==='five_plus')return value
 throw new Error('Profile contains an unsupported exercise frequency.')
}

function validateTimezone(timezone:string){
 try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format()}
 catch{throw new Error('Choose a valid timezone.')}
}

function validateProfile(input:ProfileInput){
 const currentYear=new Date().getFullYear()
 if(input.birthYear!==null&&(!Number.isInteger(input.birthYear)||input.birthYear<1900||input.birthYear>currentYear-18)){
  throw new Error('Birth year must represent an adult born in 1900 or later.')
 }
 if(input.heightInches!==null&&(!Number.isFinite(input.heightInches)||input.heightInches<48||input.heightInches>96)){
  throw new Error('Height must be between 48 and 96 inches.')
 }
 validateTimezone(input.timezone)
}

export async function getProfile(client:TypedSupabaseClient,userId:string){
 const {data,error}=await client.from('profiles').select().eq('user_id',userId).maybeSingle()
 if(error)throw error
 return data?normalizeProfile(data):null
}

export async function saveProfile(client:TypedSupabaseClient,userId:string,input:ProfileInput){
 validateProfile(input)
 const {data,error}=await client.from('profiles').upsert({
  user_id:userId,
  display_name:input.displayName?.trim()||null,
  birth_year:input.birthYear,
  energy_estimation_sex:input.energyEstimationSex,
  height_inches:input.heightInches,
  timezone:input.timezone,
  weight_unit:input.weightUnit,
  activity_level:input.activityLevel,
  exercise_frequency:input.exerciseFrequency,
  onboarding_complete:input.onboardingComplete
 },{onConflict:'user_id'}).select().eq('user_id',userId).single()
 if(error)throw error
 return normalizeProfile(data)
}

export async function dismissGettingStarted(client:TypedSupabaseClient,userId:string){
 const {data,error}=await client.from('profiles').update({getting_started_dismissed:true})
  .eq('user_id',userId).select().single()
 if(error)throw error
 return normalizeProfile(data)
}

export async function completeProfileOnboarding(
 client:TypedSupabaseClient,userId:string
){
 const {data,error}=await client.from('profiles').update({onboarding_complete:true})
  .eq('user_id',userId).select().single()
 if(error)throw error
 return normalizeProfile(data)
}

export async function saveCompatibilityTimezone(
 client:TypedSupabaseClient,userId:string,expectedTimezone:string,timezone:string
){
 validateTimezone(timezone)
 const {data,error}=await client.from('profiles').update({timezone})
  .eq('user_id',userId)
  .eq('onboarding_complete',false)
  .eq('timezone',expectedTimezone)
  .select().maybeSingle()
 if(error)throw error
 if(data)return normalizeProfile(data)
 const currentProfile=await getProfile(client,userId)
 if(!currentProfile)throw new Error('Profile was not found while setting its timezone.')
 return currentProfile
}

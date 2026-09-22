import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Json,Tables} from './database.types'

type TypedSupabaseClient=SupabaseClient<Database>
type WorkoutTemplateRow=Tables<'workout_templates'>
export type ProgramWorkoutCode='full_body_a'|'full_body_b'|'full_body_c'
export type WorkoutExercise={name:string;sets:string;reps:string}
export type WorkoutTemplate={
 id:string|null
 user_id:string|null
 workout_code:ProgramWorkoutCode
 name:string
 focus:string
 exercises:WorkoutExercise[]
}
export type WorkoutSnapshot={
 version:1
 workout_code:ProgramWorkoutCode
 name:string
 focus:string
 exercises:WorkoutExercise[]
}

const defaults:Record<ProgramWorkoutCode,WorkoutTemplate>={
 full_body_a:{id:null,user_id:null,workout_code:'full_body_a',name:'Full Body A',focus:'Squat + horizontal push/pull',exercises:[
  {name:'Goblet squat',sets:'3',reps:'8–12'},
  {name:'Dumbbell Romanian deadlift',sets:'3',reps:'8–12'},
  {name:'Dumbbell bench/floor press',sets:'3',reps:'8–12'},
  {name:'One-arm dumbbell row',sets:'3',reps:'10–12/side'},
  {name:'Dumbbell lateral raise',sets:'2',reps:'12–15'},
  {name:'Kettlebell swings',sets:'3',reps:'15'},
  {name:'Plank',sets:'2',reps:'30–60 sec'}
 ]},
 full_body_b:{id:null,user_id:null,workout_code:'full_body_b',name:'Full Body B',focus:'Single-leg + shoulders/back',exercises:[
  {name:'Dumbbell reverse lunge',sets:'3',reps:'8–10/leg'},
  {name:'Kettlebell sumo deadlift',sets:'3',reps:'10–12'},
  {name:'Dumbbell overhead press',sets:'3',reps:'8–12'},
  {name:'Lat pulldown',sets:'3',reps:'8–12'},
  {name:'Incline dumbbell press',sets:'2',reps:'10–12'},
  {name:'Dumbbell curls',sets:'2',reps:'10–15'},
  {name:'Dead bug',sets:'2',reps:'8–12/side'}
 ]},
 full_body_c:{id:null,user_id:null,workout_code:'full_body_c',name:'Full Body C',focus:'Athletic/metabolic full body',exercises:[
  {name:'Dumbbell split squat',sets:'3',reps:'8–10/leg'},
  {name:'Dumbbell hip thrust/glute bridge',sets:'3',reps:'10–15'},
  {name:'Push-ups',sets:'3',reps:'8–15'},
  {name:'Seated cable row or dumbbell row',sets:'3',reps:'10–12'},
  {name:'Dumbbell shoulder press',sets:'2',reps:'8–12'},
  {name:'Kettlebell swings',sets:'3',reps:'15–20'},
  {name:'Farmer carry',sets:'3',reps:'30–45 sec'}
 ]}
}

const clean=(value:string)=>value.trim()

function normalizeExercise(value:unknown):WorkoutExercise{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Each exercise must be an object.')
 const record=value as Record<string,unknown>
 const exercise={name:clean(String(record.name??'')),sets:clean(String(record.sets??'')),reps:clean(String(record.reps??''))}
 if(!exercise.name||!exercise.sets||!exercise.reps)throw new Error('Each exercise needs a name, sets, and reps.')
 return exercise
}

export function validateWorkoutTemplate(input:Pick<WorkoutTemplate,'workout_code'|'name'|'focus'|'exercises'>){
 if(input.workout_code!=='full_body_a'&&input.workout_code!=='full_body_b'&&input.workout_code!=='full_body_c'){
  throw new Error('Only Full Body A, B, and C can be customized.')
 }
 const name=clean(input.name)
 const focus=clean(input.focus)
 if(!name)throw new Error('Workout name is required.')
 if(!Array.isArray(input.exercises)||input.exercises.length<1||input.exercises.length>20){
  throw new Error('Add between 1 and 20 exercises.')
 }
 return {workout_code:input.workout_code,name,focus,exercises:input.exercises.map(normalizeExercise)}
}

export function defaultWorkoutTemplate(code:ProgramWorkoutCode):WorkoutTemplate{
 const template=defaults[code]
 return {...template,exercises:template.exercises.map(exercise=>({...exercise}))}
}

function normalizeRow(row:WorkoutTemplateRow):WorkoutTemplate{
 const validated=validateWorkoutTemplate({
  workout_code:row.workout_code as ProgramWorkoutCode,
  name:row.name,focus:row.focus,exercises:Array.isArray(row.exercises)?row.exercises.map(normalizeExercise):[]
 })
 return {id:row.id,user_id:row.user_id,...validated}
}

export async function getWorkoutTemplates(client:TypedSupabaseClient,userId:string){
 const {data,error}=await client.from('workout_templates').select()
  .eq('user_id',userId).order('workout_code',{ascending:true})
 if(error)throw error
 const overrides=(data??[]).map(normalizeRow)
 return (['full_body_a','full_body_b','full_body_c'] as const).map(code=>
  overrides.find(template=>template.workout_code===code)??defaultWorkoutTemplate(code)
 )
}

export async function saveWorkoutTemplate(client:TypedSupabaseClient,userId:string,input:Pick<WorkoutTemplate,'workout_code'|'name'|'focus'|'exercises'>){
 const validated=validateWorkoutTemplate(input)
 const {data,error}=await client.from('workout_templates').upsert({
  user_id:userId,
  workout_code:validated.workout_code,
  name:validated.name,
  focus:validated.focus,
  exercises:validated.exercises as Json
 },{onConflict:'user_id,workout_code'}).select().eq('user_id',userId).single()
 if(error)throw error
 return normalizeRow(data)
}

export async function deleteWorkoutTemplate(client:TypedSupabaseClient,userId:string,code:ProgramWorkoutCode){
 const {error}=await client.from('workout_templates').delete()
  .eq('user_id',userId).eq('workout_code',code)
 if(error)throw error
 return defaultWorkoutTemplate(code)
}

export function snapshotWorkout(template:WorkoutTemplate):WorkoutSnapshot{
 const validated=validateWorkoutTemplate(template)
 return {version:1,...validated}
}

export function parseWorkoutSnapshot(value:Json|null):WorkoutSnapshot|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const record=value as Record<string,unknown>
 if(record.version!==1)return null
 try{
  const validated=validateWorkoutTemplate({
   workout_code:record.workout_code as ProgramWorkoutCode,
   name:String(record.name??''),focus:String(record.focus??''),
   exercises:Array.isArray(record.exercises)?record.exercises.map(normalizeExercise):[]
  })
  return {version:1,...validated}
 }catch{return null}
}

export function resolveWorkoutTemplate(input:{
 code:ProgramWorkoutCode
 completed:boolean
 snapshot:Json|null
 templates:WorkoutTemplate[]
}){
 if(input.completed){
  const snapshot=parseWorkoutSnapshot(input.snapshot)
  if(snapshot)return {...snapshot,id:null,user_id:null}
  return defaultWorkoutTemplate(input.code)
 }
 return input.templates.find(template=>template.workout_code===input.code)
  ??defaultWorkoutTemplate(input.code)
}

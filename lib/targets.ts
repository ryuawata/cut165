import type {ActivityLevel,EnergyEstimationSex} from './profile'
import type {GoalType} from './goals'

export type TargetCalculationInput={
 birthYear:number
 sex:EnergyEstimationSex
 heightInches:number
 currentWeightLbs:number
 targetWeightLbs:number
 goalType:GoalType
 activityLevel:ActivityLevel
 stepsTarget:number
 targetDate:string|null
 effectiveDate:string
}

export type CalculatedTargets={
 calorieTargetMin:number
 calorieTargetMax:number
 proteinTargetG:number
 carbTargetG:number|null
 stepsTarget:number
 waterTargetOz:number
 weeklyWeightChangeTargetLbs:number
}

const isoPattern=/^\d{4}-\d{2}-\d{2}$/
const activityMultiplier:Record<ActivityLevel,number>={
 sedentary:1.2,
 light:1.375,
 moderate:1.55,
 very_active:1.725
}
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))
const roundTo=(value:number,increment:number)=>Math.round(value/increment)*increment

function utcDate(iso:string){
 if(!isoPattern.test(iso))throw new Error('Use a valid calendar date.')
 const [year,month,day]=iso.split('-').map(Number)
 const date=new Date(Date.UTC(year,month-1,day))
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day){
  throw new Error('Use a valid calendar date.')
 }
 return date
}

export function validateTargetInputs(input:TargetCalculationInput){
 const effective=utcDate(input.effectiveDate)
 const age=effective.getUTCFullYear()-input.birthYear
 if(!Number.isInteger(input.birthYear)||input.birthYear<1900||age<18||age>100){
  throw new Error('Birth year must represent an age between 18 and 100.')
 }
 if(!Number.isFinite(input.heightInches)||input.heightInches<48||input.heightInches>96){
  throw new Error('Height must be between 48 and 96 inches.')
 }
 if(!Number.isFinite(input.currentWeightLbs)||input.currentWeightLbs<75||input.currentWeightLbs>700){
  throw new Error('Current weight must be between 75 and 700 lb.')
 }
 if(!Number.isFinite(input.targetWeightLbs)||input.targetWeightLbs<75||input.targetWeightLbs>700){
  throw new Error('Target weight must be between 75 and 700 lb.')
 }
 if(input.goalType==='cut'&&input.targetWeightLbs>=input.currentWeightLbs){
  throw new Error('A cut target must be below your current weight.')
 }
 if(input.goalType==='bulk'&&input.targetWeightLbs<=input.currentWeightLbs){
  throw new Error('A bulk target must be above your current weight.')
 }
 if(!Number.isInteger(input.stepsTarget)||input.stepsTarget<1000||input.stepsTarget>100000){
  throw new Error('Step target must be a whole number between 1,000 and 100,000.')
 }
 if(input.targetDate&&utcDate(input.targetDate)<=effective){
  throw new Error('Target date must be after the goal start date.')
 }
}

function targetWeeklyChange(input:TargetCalculationInput){
 if(input.goalType==='maintain')return 0
 const safeMaximum=input.goalType==='cut'
  ?Math.min(1.5,input.currentWeightLbs*0.01)
  :Math.min(.75,input.currentWeightLbs*.005)
 let magnitude=input.goalType==='cut'
  ?clamp(input.currentWeightLbs*.005,.5,safeMaximum)
  :clamp(input.currentWeightLbs*.0025,.25,safeMaximum)
 if(input.targetDate){
  const weeks=(utcDate(input.targetDate).getTime()-utcDate(input.effectiveDate).getTime())/(7*86400000)
  magnitude=clamp(Math.abs(input.targetWeightLbs-input.currentWeightLbs)/weeks,.1,safeMaximum)
 }
 return roundTo(input.goalType==='cut'?-magnitude:magnitude,.05)
}

export function calculateInitialTargets(input:TargetCalculationInput):CalculatedTargets{
 validateTargetInputs(input)
 const age=utcDate(input.effectiveDate).getUTCFullYear()-input.birthYear
 const kilograms=input.currentWeightLbs*.45359237
 const centimeters=input.heightInches*2.54
 const bmr=10*kilograms+6.25*centimeters-5*age+(input.sex==='male'?5:-161)
 const maintenance=bmr*activityMultiplier[input.activityLevel]
 const weeklyChange=targetWeeklyChange(input)
 const calorieMidpoint=maintenance+weeklyChange*500
 const calorieFloor=input.sex==='male'?1500:1200
 const calorieTargetMin=Math.max(calorieFloor,roundTo(calorieMidpoint-100,10))
 const calorieTargetMax=Math.max(calorieTargetMin+100,roundTo(calorieMidpoint+100,10))
 const proteinFactor=input.goalType==='cut'?.8:.75
 const proteinTargetG=clamp(roundTo(input.currentWeightLbs*proteinFactor,5),80,250)
 const fatCalories=calorieTargetMax*.25
 const carbTargetG=Math.max(75,roundTo((calorieTargetMax-proteinTargetG*4-fatCalories)/4,5))
 const waterTargetOz=clamp(roundTo(input.currentWeightLbs*.5,5),64,160)
 return {
  calorieTargetMin,
  calorieTargetMax,
  proteinTargetG,
  carbTargetG,
  stepsTarget:input.stepsTarget,
  waterTargetOz,
  weeklyWeightChangeTargetLbs:weeklyChange
 }
}

export function goalIdentity(targetWeightLbs:number){
 return `CUT${Math.round(targetWeightLbs)}`
}

export function goalProgress(startWeightLbs:number,targetWeightLbs:number,currentWeightLbs:number){
 const total=targetWeightLbs-startWeightLbs
 const raw=total===0?100:(currentWeightLbs-startWeightLbs)/total*100
 return {raw,visual:clamp(raw,0,100),change:currentWeightLbs-startWeightLbs}
}

export const poundsToKilograms=(pounds:number)=>pounds*.45359237
export const kilogramsToPounds=(kilograms:number)=>kilograms/.45359237

export function calendarDateInTimezone(timezone:string,date=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(date)
 const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value
 return `${value('year')}-${value('month')}-${value('day')}`
}

export function shiftCalendarDate(iso:string,days:number){
 const date=utcDate(iso)
 date.setUTCDate(date.getUTCDate()+days)
 return date.toISOString().slice(0,10)
}

export function hourInTimezone(timezone:string,date=new Date()){
 return Number(new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'2-digit',hourCycle:'h23'}).format(date))
}

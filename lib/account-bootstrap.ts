export type AccountBootstrapFacts={
 hasProfile:boolean
 hasActiveGoal:boolean
 hasCurrentTarget:boolean
 currentTargetIsLegacy:boolean
 onboardingComplete:boolean
 hasCalculationProfile:boolean
}

export type AccountBootstrapDecision=
 |{status:'onboarding';markOnboardingComplete:false;legacyCompatibility:false}
 |{status:'dashboard';markOnboardingComplete:boolean;legacyCompatibility:boolean}

export function decideAccountBootstrap(facts:AccountBootstrapFacts):AccountBootstrapDecision{
 if(!facts.hasProfile||!facts.hasActiveGoal||!facts.hasCurrentTarget){
  return {status:'onboarding',markOnboardingComplete:false,legacyCompatibility:false}
 }
 const legacyCompatibility=
  facts.currentTargetIsLegacy&&!facts.onboardingComplete&&!facts.hasCalculationProfile
 return {
  status:'dashboard',
  markOnboardingComplete:!facts.onboardingComplete&&facts.hasCalculationProfile,
  legacyCompatibility
 }
}

export type CompatibilityTimezoneDecision={
 timezone:string
 shouldPersist:boolean
}

export function decideCompatibilityTimezone(input:{
 persistedTimezone:string
 detectedTimezone:string
 legacyCompatibility:boolean
}):CompatibilityTimezoneDecision{
 const detectedTimezone=input.detectedTimezone.trim()||'UTC'
 if(!input.legacyCompatibility||input.persistedTimezone!=='UTC'){
  return {timezone:input.persistedTimezone,shouldPersist:false}
 }
 return {
  timezone:detectedTimezone,
  shouldPersist:detectedTimezone!==input.persistedTimezone
 }
}

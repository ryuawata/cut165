export type AccountBootstrapFacts={
 hasProfile:boolean
 hasActiveGoal:boolean
 hasCurrentTarget:boolean
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
 const legacyCompatibility=!facts.hasCalculationProfile
 return {
  status:'dashboard',
  markOnboardingComplete:!facts.onboardingComplete&&!legacyCompatibility,
  legacyCompatibility
 }
}

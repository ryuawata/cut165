import assert from 'node:assert/strict'
import test from 'node:test'
import {decideAccountBootstrap,decideCompatibilityTimezone} from '../lib/account-bootstrap.ts'
import {hasCompleteCalculationProfile} from '../lib/profile.ts'

test('new and partially persisted users continue onboarding',()=>{
 assert.equal(decideAccountBootstrap({
  hasProfile:false,hasActiveGoal:false,hasCurrentTarget:false,
  currentTargetIsLegacy:false,
  onboardingComplete:false,hasCalculationProfile:false
 }).status,'onboarding')
 assert.equal(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:false,
  currentTargetIsLegacy:false,
  onboardingComplete:false,hasCalculationProfile:true
 }).status,'onboarding')
})

test('legacy CUT165 users enter the dashboard without falsifying profile completion',()=>{
 assert.deepEqual(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,
  currentTargetIsLegacy:true,
  onboardingComplete:false,hasCalculationProfile:false
 }),{
  status:'dashboard',markOnboardingComplete:false,legacyCompatibility:true
 })
})

test('a completed interrupted onboarding is finalized idempotently',()=>{
 assert.deepEqual(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,
  currentTargetIsLegacy:false,
  onboardingComplete:false,hasCalculationProfile:true
 }),{
  status:'dashboard',markOnboardingComplete:true,legacyCompatibility:false
 })
})

test('already completed users enter the dashboard without another write',()=>{
 assert.deepEqual(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,
  currentTargetIsLegacy:false,
  onboardingComplete:true,hasCalculationProfile:true
 }),{
  status:'dashboard',markOnboardingComplete:false,legacyCompatibility:false
 })
})

test('legacy compatibility unlocks goal editing only after profile completion',()=>{
 const legacyProfile={birth_year:null,energy_estimation_sex:null,height_inches:null}
 assert.equal(hasCompleteCalculationProfile(legacyProfile),false)

 const completedProfile={birth_year:1985,energy_estimation_sex:'male' as const,height_inches:70}
 assert.equal(hasCompleteCalculationProfile(completedProfile),true)
 assert.equal(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,
  currentTargetIsLegacy:true,
  onboardingComplete:true,hasCalculationProfile:hasCompleteCalculationProfile(completedProfile)
 }).legacyCompatibility,false)
})

test('legacy default UTC adopts a different browser-detected timezone once',()=>{
 assert.deepEqual(decideCompatibilityTimezone({
  persistedTimezone:'UTC',detectedTimezone:'America/New_York',legacyCompatibility:true
 }),{timezone:'America/New_York',shouldPersist:true})
})

test('a genuinely UTC legacy browser keeps UTC without a redundant write',()=>{
 assert.deepEqual(decideCompatibilityTimezone({
  persistedTimezone:'UTC',detectedTimezone:'UTC',legacyCompatibility:true
 }),{timezone:'UTC',shouldPersist:false})
})

test('established and previously customized timezones are preserved',()=>{
 assert.deepEqual(decideCompatibilityTimezone({
  persistedTimezone:'UTC',detectedTimezone:'America/New_York',legacyCompatibility:false
 }),{timezone:'UTC',shouldPersist:false})
 assert.deepEqual(decideCompatibilityTimezone({
  persistedTimezone:'Europe/London',detectedTimezone:'America/New_York',legacyCompatibility:true
 }),{timezone:'Europe/London',shouldPersist:false})
})

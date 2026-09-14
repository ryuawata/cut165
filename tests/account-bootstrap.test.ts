import assert from 'node:assert/strict'
import test from 'node:test'
import {decideAccountBootstrap} from '../lib/account-bootstrap.ts'

test('new and partially persisted users continue onboarding',()=>{
 assert.equal(decideAccountBootstrap({
  hasProfile:false,hasActiveGoal:false,hasCurrentTarget:false,
  onboardingComplete:false,hasCalculationProfile:false
 }).status,'onboarding')
 assert.equal(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:false,
  onboardingComplete:false,hasCalculationProfile:true
 }).status,'onboarding')
})

test('legacy CUT165 users enter the dashboard without falsifying profile completion',()=>{
 assert.deepEqual(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,
  onboardingComplete:false,hasCalculationProfile:false
 }),{
  status:'dashboard',markOnboardingComplete:false,legacyCompatibility:true
 })
})

test('a completed interrupted onboarding is finalized idempotently',()=>{
 assert.deepEqual(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,
  onboardingComplete:false,hasCalculationProfile:true
 }),{
  status:'dashboard',markOnboardingComplete:true,legacyCompatibility:false
 })
})

test('already completed users enter the dashboard without another write',()=>{
 assert.deepEqual(decideAccountBootstrap({
  hasProfile:true,hasActiveGoal:true,hasCurrentTarget:true,
  onboardingComplete:true,hasCalculationProfile:true
 }),{
  status:'dashboard',markOnboardingComplete:false,legacyCompatibility:false
 })
})

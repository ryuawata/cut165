import assert from 'node:assert/strict'
import test from 'node:test'
import {
 calculateInitialTargets,calendarDateInTimezone,goalIdentity,goalProgress
} from '../lib/targets.ts'

const base={
 birthYear:1985,
 sex:'male' as const,
 heightInches:70,
 currentWeightLbs:180,
 targetWeightLbs:165,
 goalType:'cut' as const,
 activityLevel:'light' as const,
 stepsTarget:7000,
 targetDate:'2026-12-01',
 effectiveDate:'2026-09-10'
}

test('calculates conservative loss and gain targets',()=>{
 const cut=calculateInitialTargets(base)
 assert.ok(cut.calorieTargetMin>=1500)
 assert.ok(cut.calorieTargetMax>cut.calorieTargetMin)
 assert.ok(cut.weeklyWeightChangeTargetLbs<0)
 assert.equal(cut.stepsTarget,7000)

 const bulk=calculateInitialTargets({
  ...base,sex:'female',currentWeightLbs:140,targetWeightLbs:150,goalType:'bulk'
 })
 assert.ok(bulk.calorieTargetMin>=1200)
 assert.ok(bulk.weeklyWeightChangeTargetLbs>0)
})

test('derives CUT identity and bidirectional progress',()=>{
 assert.equal(goalIdentity(165),'CUT165')
 assert.equal(goalIdentity(149.6),'CUT150')
 assert.equal(goalProgress(180,165,172.5).visual,50)
 assert.equal(goalProgress(150,180,165).visual,50)
 assert.equal(goalProgress(180,165,160).visual,100)
})

test('uses canonical timezone dates without UTC rollover',()=>{
 assert.equal(
  calendarDateInTimezone('America/Chicago',new Date('2026-09-11T02:00:00Z')),
  '2026-09-10'
 )
})

test('rejects invalid dates and anthropometric inputs',()=>{
 assert.throws(()=>calculateInitialTargets({...base,targetDate:'2026-09-10'}),/after/)
 assert.throws(()=>calculateInitialTargets({...base,heightInches:20}),/Height/)
 assert.throws(()=>calculateInitialTargets({...base,currentWeightLbs:0}),/Current weight/)
})

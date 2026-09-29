import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8')
const settings=readFileSync(new URL('../app/goal-settings.tsx',import.meta.url),'utf8')
const manager=readFileSync(new URL('../app/custom-workouts.tsx',import.meta.url),'utf8')
const launcher=readFileSync(new URL('../app/custom-workout-launcher.tsx',import.meta.url),'utf8')
const periods=readFileSync(new URL('../app/period-progress.tsx',import.meta.url),'utf8')
const presets=readFileSync(new URL('../app/nutrition-presets.tsx',import.meta.url),'utf8')
const productCss=readFileSync(new URL('../app/product.css',import.meta.url),'utf8')

test('date navigation precedes range navigation and Nutrition is the default domain',()=>{
 assert.ok(page.indexOf('className="dateNavRow"')<page.indexOf('className="trackingViewTabs"'))
 assert.match(page,/useState<DashboardDomain>\(['"]nutrition['"]\)/)
 assert.match(page,/aria-label="Dashboard domain"/)
 assert.match(page,/\(\['nutrition','training'\] as const\)/)
 assert.match(page,/onClick=\{\(\)=>setDashboardDomain\(domain\)\}/)
 assert.doesNotMatch(page,/setDashboardDomain\(domain\)[\s\S]{0,80}setSelectedDate/)
})

test('day domains stay mounted, hide the inactive panel, and keep Weight shared',()=>{
 const sharedWeight=page.indexOf('className="sharedWeight"')
 const domainTabs=page.indexOf('className="domainTabs"')
 const split=page.indexOf('className="dashboardDomainPanel"')
 assert.ok(sharedWeight>0&&sharedWeight<domainTabs&&domainTabs<split)
 assert.match(page,/aria-label="Nutrition" hidden=\{dashboardDomain!==['"]nutrition['"]\}[\s\S]*NutritionPresets[\s\S]*NutritionMetric[\s\S]*nutritionEntries/)
 assert.match(page,/aria-label="Training" hidden=\{dashboardDomain!==['"]training['"]\}[\s\S]*className="trainingWrap"[\s\S]*CustomWorkoutLauncher/)
 assert.equal((page.match(/<NutritionPresets/g)??[]).length,1)
 assert.doesNotMatch(page,/dashboardDomain==='nutrition'\?<|dashboardDomain==='training'\?</)
 assert.match(presets,/const \[draft,setDraft\]=useState<Draft>\(blank\)/)
 assert.match(presets,/getNutritionPresets\(supabase,userId\)[\s\S]*\},\[userId\]\)/)
 assert.equal((page.match(/kind="weight"/g)??[]).length,1)
 assert.equal((page.match(/kind="steps"/g)??[]).length,1)
})

test('prescribed training is permanently expanded without disclosure controls',()=>{
 const start=page.indexOf('className="trainingWrap"')
 const end=page.indexOf('<CustomWorkoutLauncher',start)
 const training=page.slice(start,end)
 assert.match(training,/className="trainingCard expandedTrainingCard"/)
 assert.match(training,/className="exerciseList"/)
 assert.match(training,/Mark workout complete/)
 assert.doesNotMatch(training,/<details|<summary|trainingToggle/)
})

test('workout configuration lives in Settings and daily launcher is execution-only',()=>{
 assert.match(settings,/SettingsSection='goal'\|'profile'\|'workouts'/)
 assert.match(settings,/>Workouts<\/button>/)
 assert.match(settings,/section==='workouts'[\s\S]*WorkoutTemplateEditor[\s\S]*CustomWorkoutManager/)
 assert.doesNotMatch(page,/<WorkoutTemplateEditor|<CustomWorkoutManager/)
 assert.match(manager,/createCustomWorkoutTemplate/)
 assert.match(manager,/updateCustomWorkoutTemplate/)
 assert.match(manager,/deleteCustomWorkoutTemplate/)
 assert.match(launcher,/completeCustomWorkout/)
 assert.match(launcher,/Manage workouts in Settings/)
 assert.match(launcher,/target="_blank" rel="noopener noreferrer"/)
 assert.doesNotMatch(launcher,/>Edit<|>Delete<|New workout/)
})

test('period domains split nutrition from training and drilldown preserves domain',()=>{
 assert.match(periods,/domain==='nutrition'[\s\S]*Calories[\s\S]*Protein/)
 assert.match(periods,/:<>[\s\S]*Steps[\s\S]*Training[\s\S]*Workouts/)
 assert.match(periods,/PeriodSharedProgressView[\s\S]*Weight trend[\s\S]*label="Weight"/)
 const drilldown=page.slice(page.indexOf('function openDateFromPeriod'),page.indexOf('function openSettings'))
 assert.match(drilldown,/setTrackingView\('day'\)/)
 assert.match(drilldown,/selectDate\(logDate\)/)
 assert.doesNotMatch(drilldown,/setDashboardDomain/)
})

test('standalone Weight and Steps KPI cards fill their intentional wrappers',()=>{
 assert.match(page,/className="sharedWeight"[\s\S]*<Metric kind="weight"/)
 assert.match(page,/className="trainingMetrics"[\s\S]*<Metric kind="steps"/)
 assert.match(productCss,/\.sharedWeight>\.metric,\.trainingMetrics>\.metric\{display:block;width:100%\}/)
 assert.match(productCss,/@media\(max-width:650px\)[\s\S]*\.sharedWeight,\.trainingMetrics\{width:100%\}/)
})

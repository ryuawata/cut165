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
 assert.ok(page.indexOf('className="dateNavRow"')<page.indexOf('className="trackingViewTabs desktopTrackingTabs"'))
 assert.match(page,/useState<DashboardDomain>\(['"]nutrition['"]\)/)
 assert.match(page,/aria-label="Dashboard domain"/)
 assert.match(page,/\(\['nutrition','training'\] as const\)/)
 assert.match(page,/onClick=\{\(\)=>setDashboardDomain\(domain\)\}/)
 assert.doesNotMatch(page,/setDashboardDomain\(domain\)[\s\S]{0,80}setSelectedDate/)
})

test('day domains stay mounted, hide the inactive panel, and keep daily measurements shared',()=>{
 const dailyMetrics=page.indexOf('className="dailyMetrics"')
 const domainTabs=page.indexOf('className="domainTabs dayDomainTabs"')
 const split=page.indexOf('className="dashboardDomainPanel nutritionDomainPanel"')
 assert.ok(domainTabs>0&&domainTabs<dailyMetrics&&dailyMetrics<split)
 assert.match(page,/aria-label="Nutrition" hidden=\{!nutritionVisible\}[\s\S]*NutritionMetric[\s\S]*NutritionPresets[\s\S]*nutritionEntries/)
 assert.match(page,/aria-label="Training" hidden=\{!trainingVisible\}[\s\S]*className="trainingWrap"[\s\S]*CustomWorkoutLauncher/)
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
 assert.match(launcher,/Manage routines/)
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

test('Weight and Steps are compact shared daily measurements after the domain switch',()=>{
 assert.match(page,/className="domainTabs dayDomainTabs"[\s\S]*className="dailyMetrics"[\s\S]*<Metric kind="weight"[\s\S]*<Metric kind="steps"/)
 assert.match(page,/className=\{`metric dailyMetric \$\{kind\}`\}/)
 assert.match(productCss,/\.dailyMetrics\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
 assert.match(productCss,/\.dailyMetric\{display:block;width:100%;min-height:112px/)
 assert.doesNotMatch(page,/sharedWeight|trainingMetrics/)
})

test('Day nutrition has one primary Add food action and human partial-data copy',()=>{
 assert.equal((page.match(/>\+ Add food<\/button>/g)??[]).length,1)
 assert.doesNotMatch(page,/\+ Add entry|New Quick Add|>partial</)
 assert.match(page,/Some entries don’t include carbs/)
 assert.match(presets,/QUICK LOG/)
 assert.match(presets,/Manage saved foods/)
})

test('nutrition entries are grouped by meal and the ambiguous Close signal is gone',()=>{
 assert.match(page,/mealGroupOrder/)
 assert.match(page,/groupedEntries\.map/)
 assert.match(page,/TODAY’S FOOD/)
 assert.doesNotMatch(page,/\['Close','warn'\]|className=\{`signal/)
})

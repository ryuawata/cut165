import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8')
const settings=readFileSync(new URL('../app/goal-settings.tsx',import.meta.url),'utf8')
const presets=readFileSync(new URL('../app/nutrition-presets.tsx',import.meta.url),'utf8')
const styles=readFileSync(new URL('../app/product.css',import.meta.url),'utf8')

test('mobile shell defaults to Today and exposes exactly five primary destinations',()=>{
 assert.match(page,/useState<MobileDestination>\(['"]today['"]\)/)
 const nav=page.slice(page.indexOf('<nav className="mobileBottomNav"'),page.indexOf('</nav>',page.indexOf('<nav className="mobileBottomNav"')))
 assert.equal((nav.match(/<button/g)??[]).length,5)
 assert.match(nav,/>Today<\/span>/)
 assert.match(nav,/>Progress<\/span>/)
 assert.match(nav,/className="mobileLogButton" aria-label="Log" aria-haspopup="dialog"/)
 assert.match(nav,/>Training<\/span>/)
 assert.match(nav,/>Profile<\/span>/)
 assert.equal((nav.match(/aria-current=/g)??[]).length,4)
})

test('mobile destination changes preserve selected date and mounted nutrition drafts',()=>{
 const choose=page.slice(page.indexOf('function chooseMobileDestination'),page.indexOf('function openMobileProfile'))
 assert.match(choose,/setMobileDestination\(destination\)/)
 assert.doesNotMatch(choose,/setSelectedDate|selectDate|setMeal/)
 assert.match(page,/className="dayView" hidden=\{!dayVisible\}/)
 assert.match(page,/className="dayShared" hidden=\{isMobile&&mobileDestination===['"]training['"]\}/)
 assert.match(page,/nutritionDomainPanel[\s\S]*hidden=\{!nutritionVisible\}/)
 assert.match(page,/trainingDomainPanel[\s\S]*hidden=\{!trainingVisible\}/)
 assert.equal((page.match(/<NutritionPresets/g)??[]).length,1)
 assert.match(presets,/const \[draft,setDraft\]=useState<Draft>\(blank\)/)
 assert.match(presets,/getNutritionPresets\(supabase,userId\)[\s\S]*\},\[userId\]\)/)
})

test('mobile Progress reuses period views and drills into Today with the chosen date',()=>{
 assert.match(page,/mobileProgressTabs[\s\S]*\(\['week','month'\] as const\)/)
 assert.match(page,/PeriodSharedProgressView view=\{activePeriodView\}/)
 assert.match(page,/PeriodProgressView domain=\{dashboardDomain\}/)
 const drilldown=page.slice(page.indexOf('function openDateFromPeriod'),page.indexOf('function openSettings'))
 assert.match(drilldown,/setMobileDestination\('today'\)/)
 assert.match(drilldown,/selectDate\(logDate\)/)
})

test('universal Log sheet reuses existing food, drink, water, weight, and workout flows',()=>{
 assert.match(page,/role="dialog" aria-modal="true" aria-labelledby="mobile-log-title"/)
 assert.match(page,/event\.key==='Escape'[\s\S]*setLogSheetOpen\(false\)/)
 assert.match(page,/openMealForm\(\)[\s\S]*openMealForm\('drink'\)[\s\S]*openWaterLog[\s\S]*openWeightLog[\s\S]*chooseMobileDestination\('training'\)/)
 assert.match(page,/mealIsBlank\(current\)\?\{\.\.\.current,mealSlot\}:current/)
 assert.match(page,/function openMealForm[\s\S]*setMealOpen\(true\)[\s\S]*#one-off-entry input/)
 assert.match(page,/function openWaterLog[\s\S]*\.waterCard input/)
 assert.match(page,/function openWeightLog[\s\S]*\.dailyMetric\.weight input/)
 assert.equal((page.match(/id="one-off-entry"/g)??[]).length,1)
})

test('Profile opens existing settings with account access',()=>{
 assert.match(page,/function openMobileProfile[\s\S]*openSettings\('profile'\)/)
 assert.match(page,/onSignOut=\{\(\)=>supabase\.auth\.signOut\(\)\}/)
 assert.match(settings,/className="settingsAccount"[\s\S]*onClick=\{onSignOut\}>Sign out/)
})

test('mobile navigation is fixed and safe-area aware while desktop controls remain',()=>{
 assert.match(styles,/\.mobileBottomNav,\.mobileProgressTabs,\.mobileLogShade\{display:none\}/)
 assert.match(styles,/@media\(max-width:650px\)[\s\S]*\.mobileBottomNav\{position:fixed/)
 assert.match(styles,/padding-bottom:calc\(var\(--mobile-nav-height\) \+ env\(safe-area-inset-bottom\) \+ 24px\)/)
 assert.match(styles,/height:calc\(var\(--mobile-nav-height\) \+ env\(safe-area-inset-bottom\)\)/)
 assert.match(page,/className="trackingViewTabs desktopTrackingTabs"/)
 assert.match(page,/className="domainTabs dayDomainTabs"/)
})

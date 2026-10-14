import '../lite.css'

export default function SupportPage(){
 return <main className="liteShell">
  <div className="liteKicker">CUT365 <span>LITE</span></div>
  <h1>CUT365 Lite Support</h1>
  <p className="liteIntro">Help for the minimal calorie and protein tracker.</p>
  <div className="liteForm">
   <h2>Before contacting support</h2>
   <p>CUT365 Lite stores your food log on your device only. There is no account, cloud sync, or server-side recovery in this version. If the app is deleted, locally stored data may also be deleted.</p>
   <p>If something is not working, include your iPhone model, iOS version, CUT365 Lite app version, and a short description of what happened.</p>
   <a className="litePrimary" href="https://github.com/ryuawata/cut165/issues/new" target="_blank" rel="noreferrer">Contact support</a>
   <p className="liteHint">Support requests are handled through the CUT365 GitHub issue tracker. Do not include private health or account information in a public issue.</p>
   <p><a href="/privacy">Read the privacy policy</a></p>
  </div>
 </main>
}

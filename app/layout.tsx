import './globals.css'
import './nutrition.css'
import './product.css'
import type {Metadata} from 'next'
import {PRODUCT_NAME,SITE_DESCRIPTION,SITE_URL} from '../lib/site'

export const metadata:Metadata={
 metadataBase:new URL(SITE_URL),
 title:PRODUCT_NAME,
 description:SITE_DESCRIPTION,
 applicationName:PRODUCT_NAME,
 alternates:{canonical:'/'},
 openGraph:{
  type:'website',
  url:SITE_URL,
  title:PRODUCT_NAME,
  siteName:PRODUCT_NAME,
  description:SITE_DESCRIPTION
 },
 appleWebApp:{capable:true,title:PRODUCT_NAME,statusBarStyle:'default'},
 manifest:'/manifest.webmanifest'
}

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>
}

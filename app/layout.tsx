import './globals.css'
import './nutrition.css'
import './product.css'

export const metadata={
 title:'CUT365',
 description:'Personal nutrition, movement, and goal dashboard'
}

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>
}

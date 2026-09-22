import type {MetadataRoute} from 'next'
import {PRODUCT_NAME,SITE_DESCRIPTION} from '../lib/site'

export default function manifest():MetadataRoute.Manifest{
 return {
  name:PRODUCT_NAME,
  short_name:PRODUCT_NAME,
  description:SITE_DESCRIPTION,
  start_url:'/',
  display:'standalone',
  background_color:'#ffffff',
  theme_color:'#ffffff'
 }
}

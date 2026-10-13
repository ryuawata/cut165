// Generate a deterministic 1024x1024 App Store icon without binary assets or external build tools.
const fs=require('node:fs')
const path=require('node:path')
const zlib=require('node:zlib')
const w=1024,h=1024
const raw=Buffer.alloc((w*4+1)*h)
function pixel(x,y,r,g,b){const p=y*(w*4+1)+1+x*4;raw[p]=r;raw[p+1]=g;raw[p+2]=b;raw[p+3]=255}
const segments={top:[0,0,1,0],middle:[0,1,1,1],bottom:[0,2,1,2],upperLeft:[0,0,0,1],upperRight:[1,0,1,1],lowerLeft:[0,1,0,2],lowerRight:[1,1,1,2]}
const nums={'3':['top','middle','bottom','upperRight','lowerRight'],'6':['top','middle','bottom','upperLeft','lowerLeft','lowerRight'],'5':['top','middle','bottom','upperLeft','lowerRight']}
function rect(x,y,ww,hh){return [x,y,ww,hh]}
function inRect(x,y,a){return x>=a[0]&&x<a[0]+a[2]&&y>=a[1]&&y<a[1]+a[3]}
const strokes=[]
for(const [i,d] of [...'365'].entries()){const x=183+i*231;const y=330;const sw=150,sh=320,t=26;const sets={top:rect(x+t,y,sw-2*t,t),middle:rect(x+t,y+sh/2-t/2,sw-2*t,t),bottom:rect(x+t,y+sh-t,sw-2*t,t),upperLeft:rect(x,y+t,t,sh/2-t),upperRight:rect(x+sw-t,y+t,t,sh/2-t),lowerLeft:rect(x,y+sh/2,t,sh/2-t),lowerRight:rect(x+sw-t,y+sh/2,t,sh/2-t)};for(const n of nums[d])strokes.push(sets[n])}
for(let y=0;y<h;y++){for(let x=0;x<w;x++){let color=[23,42,70];const dx=x-512,dy=y-512;if(dx*dx+dy*dy<435*435&&dx*dx+dy*dy>418*418)color=[117,165,237];if(strokes.some(a=>inRect(x,y,a)))color=[255,255,255];pixel(x,y,...color)}}
const crcTable=new Uint32Array(256)
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}
function crc32(b){let c=0xFFFFFFFF;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,sum])}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))])
const dir=path.join(__dirname,'..','assets');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'icon.png'),png)
console.log('Generated 1024x1024 CUT365 Lite icon')

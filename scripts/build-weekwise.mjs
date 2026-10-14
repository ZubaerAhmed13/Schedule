#!/usr/bin/env node
// Publish only the client. Tests, SQL, docs and backend source stay out of Pages.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'dist');
const files=['index.html','privacy.html','manifest.webmanifest','sw.js','weekwise-push.js','weekwise-calendar.js','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','web-vitals-LICENSE.txt',...['css','js'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(f=>/\.(css|js)$/.test(f)).map(f=>dir+'/'+f))];
files.push(...fs.readdirSync(path.join(root,'fonts')).filter(file=>file.endsWith('.woff2')||file==='OFL.txt').map(file=>'fonts/'+file));
const hash=crypto.createHash('sha256');for(const file of files)hash.update(file).update(fs.readFileSync(path.join(root,file)));const version=hash.digest('hex').slice(0,16);
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true}); // Only the generated client output is replaced.
for(const file of files){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
let html=fs.readFileSync(path.join(out,'index.html'),'utf8');html=html.replace(/(src|href)="(\.\/[^"?]+\.(?:js|css))"/g,(_,attr,url)=>`${attr}="${url}?v=${version}"`);fs.writeFileSync(path.join(out,'index.html'),html);
let privacy=fs.readFileSync(path.join(out,'privacy.html'),'utf8').replace(/href="(\.\/[^"?]+\.css)"/g,(_,url)=>`href="${url}?v=${version}"`);fs.writeFileSync(path.join(out,'privacy.html'),privacy);
let sw=fs.readFileSync(path.join(out,'sw.js'),'utf8').replace("weekwise-static-v77",'weekwise-static-v77-'+version);sw=sw.replace(/'((?:\.\/)[^']+\.(?:js|css))'/g,(_,url)=>`'${url}?v=${version}'`);fs.writeFileSync(path.join(out,'sw.js'),sw);
const marker=fs.existsSync(path.join(root,'build-info.json'))?JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8')):{};fs.writeFileSync(path.join(out,'build-info.json'),JSON.stringify({...marker,assetVersion:version})+'\n');
const included=files.filter(f=>f!=='sw.js');for(const file of included){if(!fs.existsSync(path.join(out,file)))throw new Error('Missing build asset '+file);}
console.log('Built '+files.length+' client assets; version '+version+'.');

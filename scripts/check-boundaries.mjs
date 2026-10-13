import fs from 'node:fs';
import path from 'node:path';
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const failures=[];
for(const file of files('src').filter(f=>/\.[tj]sx?$/.test(f))){
 const text=fs.readFileSync(file,'utf8');
 if(/(?:GuestExperience|useGuestChat|guestConversation)\.[tj]sx?$/.test(file)&&(/from\s*['"][^'"]*(?:\/api\/|liveSource|useSession)/.test(text)||/\b(fetch|localStorage|sessionStorage|EventSource)\b/.test(text)))failures.push(file+': guest cannot own transport or persistence');
 if(/^src\/(components|pages)\//.test(file)){
  if(/\b(fetch|XMLHttpRequest|EventSource)\s*\(|\b(localStorage|sessionStorage|document\.cookie)\b/.test(text))failures.push(file+': UI must not own network, session or storage');
  const imports=[...text.matchAll(/(?:import|export)\s+(?!type\b)[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
  for(const match of imports){const target=match[1]??match[2];if(/\/(api|demo|hooks|providers)\//.test(target))failures.push(file+': forbidden UI runtime dependency '+target);}
 }
 if(/^src\/(api|hooks|providers)\//.test(file)&&/(?:from\s*|import\s*\()\s*['"][^'"]*(?:\/demo\/|\/data\/mockData)/.test(text))failures.push(file+': live runtime cannot import demo');
 if(/^src\/demo\//.test(file)&&(/\b(fetch|XMLHttpRequest|EventSource)\s*\(/.test(text)||/from\s*['"][^'"]*\/api\//.test(text)))failures.push(file+': demo cannot make API requests');
 if(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b|-----BEGIN .*PRIVATE KEY-----|AIza[A-Za-z0-9_-]{30,}/.test(text))failures.push(file+': possible embedded credential');
}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('UI/data boundaries and frontend credential scan passed. Git review remains mandatory.');

import fs from 'node:fs';
const js=fs.readdirSync('dist/assets').filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync('dist/assets/'+x,'utf8')).join('\n');
for(const marker of ['Design states','design-user','Sarah Chen','Harbor Labs','Turn off the oven','Disconnect preview'])if(js.includes(marker))throw new Error('Demo marker in Production bundle: '+marker);
if(!js.includes('/api/v1/'))throw new Error('Missing same-origin API client');
console.log('Production bundle excludes demo fixtures, mock account and design controls.');

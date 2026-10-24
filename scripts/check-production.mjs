import fs from 'node:fs';
const js=fs.readdirSync('dist/assets').filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync('dist/assets/'+x,'utf8')).join('\n');
// Shared Settings contains preview button labels; reject fixture identity/data instead.
for(const marker of ['Design states','design-user','Sarah Chen','Harbor Labs','Turn off the oven','alex@lindqvist.studio','@alexlindqvist','conn-gcal','INITIAL_PROPOSALS','prop-1','Марк день рождения','Вадя день омона','Годовщина Мурашки','ДР Сашки','Alpha_Spec_v2.gdoc','match-vektor','INITIAL_NOTES','note-hiking-checklist','MaxSwap','Промокод Катц','Рабочий календарь (Work)','Личный календарь (Personal)'])if(js.includes(marker))throw new Error('Demo marker in Production bundle: '+marker);
if(!js.includes('/api/v1/'))throw new Error('Missing same-origin API client');
console.log('Production bundle excludes demo fixtures, mock account and Design Mode entry.');

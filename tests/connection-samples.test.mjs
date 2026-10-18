import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {connectionSamples} from '../src/demo/connectionSamples.ts';

test('Design connection fixtures remain intact but their module and values are excluded from production',async()=>{
 const samples=connectionSamples('design-calendar@example.test');
 assert.equal(samples.googleCalendarId,'conn-gcal');
 assert.equal(samples.calendars.find(cal=>cal.id==='work').desc,'Harbor Labs, Nordic Studio, client calls');
 assert.match(samples.calendars[0].name,/design-calendar@example.test/);
 assert.equal(samples.scenarios.length,9);
 const previous=process.env.MROYA_BUILD_TARGET;
 try{
  process.env.MROYA_BUILD_TARGET='production';
  const result=await build({mode:'production',logLevel:'silent',build:{write:false}});
  const chunks=(Array.isArray(result)?result:[result]).flatMap(bundle=>bundle.output).filter(item=>item.type==='chunk');
  const modules=chunks.flatMap(chunk=>chunk.moduleIds);
  assert.ok(modules.length>0,'inspect the actual production module graph');
  assert.equal(modules.some(id=>id.replaceAll('\\','/').includes('/src/demo/')),false,'no Design module is reachable from production');
  const js=chunks.map(chunk=>chunk.code).join('\n');
  for(const value of [samples.googleCalendarId,samples.telegramId,'Harbor Labs','Nordic Studio','Family & Birthdays','Work & Retainers','design-calendar@example.test']){
   assert.equal(js.includes(value),false,`Design-only value must not enter production: ${value}`);
  }
 }finally{if(previous===undefined)delete process.env.MROYA_BUILD_TARGET;else process.env.MROYA_BUILD_TARGET=previous;}
});

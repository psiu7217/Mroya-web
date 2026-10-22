import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({mode:'production',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {PrivacyControls}=await vite.ssrLoadModule('/src/components/PrivacyControls.tsx');
test('real privacy UI distinguishes consent, requests and completed erasure',()=>{
 const noop=()=>{};
 const html=renderToStaticMarkup(React.createElement(PrivacyControls,{privacy:{
 state:{notice_version:'google-data-ai-v1',ai_consent:false,provider_approved:false,
  deletion_automatic:false,notice:'Optional AI notice',privacy_contact:'support@dotstech.app',
  requests:[{id:'synthetic',kind:'account_deletion',status:'needs_review',reason_code:'review',created_at:'synthetic'}]},
 busy:false,error:null,message:null,refresh:noop,consent:noop,request:noop}}));
 assert.match(html,/External AI is blocked/);
 assert.match(html,/do not claim that deletion is complete/);
 assert.match(html,/needs_review/);
 assert.match(html,/href="https:\/\/heymroya.com\/privacy"/);
 assert.doesNotMatch(html,/<input[^>]*checked/);
 assert.equal(renderToStaticMarkup(React.createElement(PrivacyControls,{})),'');
});

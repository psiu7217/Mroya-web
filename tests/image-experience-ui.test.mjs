import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {ImageGenerationCard}=await vite.ssrLoadModule('/src/components/ImageGenerationCard.tsx');
const {ImageLightbox}=await vite.ssrLoadModule('/src/components/ImageLightbox.tsx');
const {AssistantMarkdown}=await vite.ssrLoadModule('/src/components/AssistantMarkdown.tsx');
const {ChatWorkspace}=await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const noop=()=>{},path='/api/v1/documents/10000000-0000-4000-8000-000000000001/original/';

test('generation shows a wave and labels its percentage as an estimate until the image is ready',()=>{
 const html=renderToStaticMarkup(React.createElement(ImageGenerationCard));
 assert.match(html,/role="progressbar"/);assert.match(html,/mroya-image-generation-wave/);
 assert.match(html,/Creating your image/);assert.match(html,/aria-valuetext="About 8%"/);
 assert.match(html,/>≈8%</);
 assert.equal((html.match(/8%<\/span>/g)??[]).length,1);
 assert.doesNotMatch(html,/Your image is ready|>100%</);
});

test('chat keeps one image card across tool success and while the protected preview loads',()=>{
 const activity={kind:'tool',id:'t1-c1',toolName:'generate_image',status:'running',phase:'started'};
 const message={id:'reply',sender:'assistant',status:'streaming',content:'',timestamp:''};
 const render=patch=>renderToStaticMarkup(React.createElement(ChatWorkspace,{
  account:{displayName:'Owner',initials:'O'},addedActionIds:[],live:true,onImageOpen:noop,
  conversation:{id:'chat',messages:[{...message,...patch}]},theme:'light',plan:'free',
 }));
 const waiting=render({});
 assert.equal((waiting.match(/class="guest-dot"/g)??[]).length,3);
 assert.doesNotMatch(waiting,/role="progressbar"/);
 const success={...activity,status:'success',phase:'finished'};
 for(const entry of [activity,success]){
  const image=render({timeline:[entry]});
  assert.match(image,/role="progressbar"/);
  assert.doesNotMatch(image,/class="guest-dot"/);
 }
 const loading=render({timeline:[success],content:`![Cat](${path})`});
 assert.match(loading,/role="progressbar"/);
 assert.match(loading,/aria-label="Open image"/);
 assert.match(loading,/loading="eager"/);
 assert.doesNotMatch(loading,/Your image is ready|class="guest-dot"/);
 const noImage=render({status:'completed',timeline:[success],content:'Ordinary text'});
 assert.match(noImage,/Ordinary text/);
 assert.doesNotMatch(noImage,/role="progressbar"|class="guest-dot"/);
 for(const settled of [
  {status:'failed',timeline:[activity]},
  {timeline:[{...activity,status:'failure',phase:'finished'}]},
  {content:'Ordinary text'},
 ])assert.doesNotMatch(render(settled),/role="progressbar"|class="guest-dot"/);
});

test('Chat image is an accessible button that opens the viewer',()=>{
 const html=renderToStaticMarkup(React.createElement(AssistantMarkdown,{content:`![Cat](${path})`,onImageOpen:noop}));
 assert.match(html,/<button[^>]*aria-label="Open image"/);assert.match(html,/<img/);
 assert.match(html,/cursor-pointer/);assert.doesNotMatch(html,/cursor-zoom-in/);
});

test('old image replies hide only duplicate original links and retain model prose and other sources',()=>{
 const content=`Ready!\n\n![Cat](${path})\n\n[Download image][original]\n\nThe caption is still here.\n\n[Source](/help)\n\n[original]: ${path}`;
 const render=(content,variant)=>renderToStaticMarkup(React.createElement(AssistantMarkdown,{content,variant,onImageOpen:noop}));
 const html=render(content,'assistant');
 assert.match(html,/<p>Ready!<\/p>/);assert.match(html,/<img/);
 assert.doesNotMatch(html,/Download image/);assert.doesNotMatch(html,/<p>\s*<\/p>/);
 assert.match(html,/<p>The caption is still here\.<\/p>/);assert.match(html,/<a href="\/help"/);
 assert.match(render(`[Download image](${path})`,'assistant'),/<a href=/);
 assert.match(render(content,'user'),/Download image/);
});

test('viewer provides close, download and share controls around the actual private image',()=>{
 const viewer={image:{url:path,title:'Cat'},previewUrl:'blob:private',downloadUrl:'blob:private',filename:'cat.png',
  loading:false,sharing:false,notice:null,onOpen:noop,onClose:noop,onShare:noop,onRetry:noop};
 const html=renderToStaticMarkup(React.createElement(ImageLightbox,{viewer}));
 assert.match(html,/role="dialog" aria-modal="true"/);assert.match(html,/aria-label="Close image"/);
 const toolbar=html.match(/<header[^>]*>(.*?)<\/header>/)?.[1]??'';
 assert.match(toolbar,/download="cat.png" aria-label="Download"/);
 assert.match(toolbar,/aria-label="Share"/);assert.match(toolbar,/aria-label="Close image"/);
 assert.doesNotMatch(toolbar,/>\s*(Download|Share|Cat)\s*</);assert.doesNotMatch(html,/<footer/);
 assert.match(html,/src="blob:private"/);
 const loading=renderToStaticMarkup(React.createElement(ImageLightbox,{viewer:{...viewer,loading:true,previewUrl:null,downloadUrl:null}}));
 assert.match(loading,/Loading image/);assert.doesNotMatch(loading,/href="blob/);
 assert.equal(renderToStaticMarkup(React.createElement(ImageLightbox,{viewer:{...viewer,image:null}})),'');
});

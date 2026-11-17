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
const noop=()=>{},path='/api/v1/documents/10000000-0000-4000-8000-000000000001/original/';

test('generation has an indeterminate circular progress indicator and no invented percentage',()=>{
 const html=renderToStaticMarkup(React.createElement(ImageGenerationCard,{phase:'generating'}));
 assert.match(html,/role="progressbar"/);assert.match(html,/mroya-image-generation-ring/);
 assert.match(html,/Creating your image/);assert.doesNotMatch(html,/aria-valuenow/);assert.doesNotMatch(html.replace(/<[^>]*>/g,''),/\d+%/);
 const complete=renderToStaticMarkup(React.createElement(ImageGenerationCard,{phase:'finishing'}));
 assert.doesNotMatch(complete,/role="progressbar"/);assert.match(complete,/Your image is ready/);
});

test('Chat image is an accessible button that opens the viewer',()=>{
 const html=renderToStaticMarkup(React.createElement(AssistantMarkdown,{content:`![Cat](${path})`,onImageOpen:noop}));
 assert.match(html,/<button[^>]*aria-label="Open image"/);assert.match(html,/<img/);
});

test('viewer provides close, download and share controls around the actual private image',()=>{
 const viewer={image:{url:path,title:'Cat'},previewUrl:'blob:private',downloadUrl:'blob:private',filename:'cat.png',
  loading:false,sharing:false,notice:null,onOpen:noop,onClose:noop,onShare:noop,onRetry:noop};
 const html=renderToStaticMarkup(React.createElement(ImageLightbox,{viewer}));
 assert.match(html,/role="dialog" aria-modal="true"/);assert.match(html,/aria-label="Close image"/);
 assert.match(html,/download="cat.png"/);assert.match(html,/>Share</);assert.match(html,/src="blob:private"/);
 const loading=renderToStaticMarkup(React.createElement(ImageLightbox,{viewer:{...viewer,loading:true,previewUrl:null,downloadUrl:null}}));
 assert.match(loading,/Loading image/);assert.doesNotMatch(loading,/href="blob/);
 assert.equal(renderToStaticMarkup(React.createElement(ImageLightbox,{viewer:{...viewer,image:null}})),'');
});

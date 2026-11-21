import type {Element,Root} from 'hast';

const element=(tagName:string,children:Element['children']):Element=>({type:'element',tagName,properties:{},children});
const words=(node:Element['children'][number]):string=>
 node.type==='text'?node.value:node.type==='element'?node.children.map(words).join(''):'';

function links(node:Element):Element[]{
 if(node.tagName==='a'&&typeof node.properties.href==='string'&&/^https?:\/\//i.test(node.properties.href))return [node];
 return node.children.flatMap(child=>child.type==='element'?links(child):[]);
}

/** Fold an explicit trailing source list without treating links as evidence of a search. */
export function groupWebSources(label:string) {
 return (tree:Root)=>{
  const blocks=tree.children.filter(node=>node.type==='element'||node.type==='text'&&node.value.trim());
  const trailing=blocks.at(-1),heading=blocks.at(-2);
  if(heading?.type!=='element'||trailing?.type!=='element')return;
  if(!/^(?:p|h[1-6])$/.test(heading.tagName)||!/^(?:sources|references|источники)\s*:?[\s]*$/i.test(words(heading).trim()))return;
  if(trailing.tagName!=='ol'&&trailing.tagName!=='ul')return;
  const items=trailing.children.filter(node=>node.type==='element');
  if(!items.length||items.some(item=>item.tagName!=='li'||!links(item).length))return;
  const seen=new Set<unknown>();
  const unique=items.filter(item=>{
   const urls=links(item).map(link=>link.properties.href);
   const repeated=urls.every(url=>seen.has(url));
   for(const url of urls)seen.add(url);
   return !repeated;
  });
  const disclosure=element('details',[
   element('summary',[{type:'text',value:label}]),
   element(trailing.tagName,unique),
  ]);
  disclosure.properties.className=['mroya-web-sources'];
  tree.children.splice(tree.children.indexOf(heading),tree.children.length,disclosure);
 };
}

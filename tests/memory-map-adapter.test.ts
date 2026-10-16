import test from 'node:test';
import assert from 'node:assert/strict';
import {graphPresentation} from '../src/hooks/liveAdapters.ts';
import {renderGraph} from '../src/components/memory-map/mapModel.ts';
import {forceSimulation,forceLink} from 'd3-force';
import type {MemoryMapResponse} from '../src/types/api.ts';

test('metadata and canonical IDs survive; simulation never mutates Workspace data',()=>{
 const map:MemoryMapResponse={nodes:[{id:'entity:1',type:'entity',label:'You',kind:'person',is_self:true,degree:1,memory_count:1},
  {id:'memory:2',type:'memory',label:'Tea',subject:'entity:1',statement_id:'uuid:2',predicate:'prefers',polarity:'negative',literal_type:'string',learned_at:'2026-10-16',evidence_count:2}],
  edges:[{id:'edge:1',source:'entity:1',target:'memory:2',type:'memory',statement_id:'uuid:2',predicate:'prefers',predicate_key:'prefers',polarity:'negative',valid_from:null,valid_to:null,learned_at:'2026-10-16',evidence_count:2}],truncated:true};
 const initial=JSON.stringify(map),props=graphPresentation(map),graph=renderGraph(props.nodes,props.edges);
 assert.equal(props.nodes[0].x,undefined);assert.equal(props.nodes[0].y,undefined);
 assert.equal(props.nodes[0].is_self,true);assert.equal(props.nodes[0].degree,1);assert.equal(props.nodes[0].memory_count,1);
 assert.equal(props.nodes[1].subject,'entity:1');assert.equal(props.nodes[1].linkedMemoryId,'uuid:2');
 assert.equal(props.nodes[1].literal_type,'string');assert.equal(props.nodes[1].polarity,'negative');
 assert.equal(props.edges[0].statement_id,'uuid:2');assert.equal(props.edges[0].evidence_count,2);
 const nodes=graph.nodes.map(n=>({...n})),links=graph.edges.map(e=>({...e}));
 const sim=forceSimulation(nodes).force('link',forceLink<(typeof nodes)[number],(typeof links)[number]>(links).id(n=>n.id)).stop();sim.tick(20);
 assert.equal(typeof links[0].source,'object');assert.equal(typeof graph.edges[0].source,'string');
 assert.equal(props.nodes[0].x,undefined);assert.equal(JSON.stringify(map),initial);
});

test('offline graph shares renderer model; dangling edges never invent nodes',()=>{
 const graph=renderGraph([{id:'demo',label:'Demo',subtitle:'Person',category:'person',connectionsCount:2,summary:'',dateRecorded:'',source:''}],
  [{id:'dangling',source:'demo',target:'missing',relationship:'knows'}]);
 assert.equal(graph.nodes[0].type,'entity');assert.equal(graph.nodes[0].kind,'person');
 assert.equal(graph.edges.length,0);assert.equal(graph.nodes.length,1);
 assert.deepEqual(renderGraph([],[]).nodes,[]);
});

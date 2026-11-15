'use strict';
(async function () {
const assert=require('node:assert/strict');
const source=require('./collection.json');
const engine=require('./engine.js').createEngine(source);
const pictures=require('./category-model.js').createModel(engine);
const model=require('./navigation-model.cjs');
const THREE=await import('three');
const {createTapTracker}=require('./tap-tracker.cjs');
const codes=view=>view.cards.map(c=>c.code);
assert.deepEqual(codes(pictures.branch('')),['A','B','C','D','E']);
assert.deepEqual(codes(pictures.branch('A')),['A1','A2']);
assert.deepEqual(codes(pictures.branch('D')),['D1','D2','D3','D4','D5']);
assert.deepEqual(codes(pictures.branch('D2')),['D2.1','D2.2','D2.3']);
assert.deepEqual(codes(pictures.branch('E1')),['E1.1','E1.2','E1.3']);
for(const code of ['A1','A1.2','B1','B1.4','C1','C1.1']) {
  const view=pictures.branch(code);
  assert(view.sizeOnly); assert(view.cards.every(c=>!pictures.isSize(c.code)));
}
assert.equal(pictures.branch('A1.2').selectedCode,'A1');
assert.equal(pictures.branch('A1.2').parentCode,'A');
assert.equal(pictures.branch('D2.1').selectedCode,'D2.1');
assert.equal(pictures.branch('D2.1').parentCode,'D2');
assert.equal(pictures.branch('B2').sizeOnly,false);
assert.throws(()=>pictures.branch('invalid'),/Unknown category/);
for(const category of engine.categories) {
  const view=pictures.branch(category.code);
  assert(view.cards.length>0 && view.cards.length<=5);
  assert.equal(engine.path(category.code).at(-1),category.code);
  const examples=pictures.examples(category.code);
  assert(examples.length>0 && examples.every(p=>p.path.includes(category.code)));
  assert(engine.categoryLabel(category.code));
}
const pink=engine.search({colour:'Pink',category:'A'});
assert.equal(pink.counts.category.A1,2); assert.equal(pink.counts.category.A2,0);
assert.deepEqual(engine.search({category:'A1',size:'1x4'}).items.map(p=>p.id),
  engine.search({category:'A1.2'}).items.map(p=>p.id));
assert.deepEqual(engine.search({category:'D2.3'}).items.map(p=>p.id),['TG048']);

const cabinet=require('./locations.json').cabinets[0];
let constrained=0;
for(const x of [-500,-20,0,20,500]) for(const y of [-500,0,0.5,20,500]) for(const z of [-50,0,0.5,30,500]) {
  for(const target of [[0,3,0.5],[-100,-100,-100],[100,100,100]]) {
    const pose=model.constrainPose(cabinet,{position:[x,y,z],target});
    assert(pose.position.concat(pose.target).every(Number.isFinite));
    const distance=Math.hypot(...pose.position.map((value,i)=>value-pose.target[i]));
    assert(distance>=1.9-1e-9 && distance<=36+1e-9);
    assert(pose.position[2]>1 && pose.position[1]>0.55);
    assert(Math.abs(pose.target[0])<=cabinet.columns*model.CELL_WIDTH/2+0.4);
    assert(pose.target[1]>=0.55 && pose.target[1]<=model.BASE_HEIGHT+cabinet.rows*model.CELL_HEIGHT+0.3);
    constrained++;
  }
}
for(const aspect of [0.65,1,1.5,2]) {
  const pose=model.fitCabinetPose(cabinet,aspect), camera=new THREE.PerspectiveCamera(44,aspect,0.05,120);
  camera.position.fromArray(pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld(true);
  for(const x of [-4.5,4.5]) for(const y of [0,7.3]) for(const z of [-0.45,0.56]) {
    const projected=new THREE.Vector3(x,y,z).project(camera);
    assert(Math.abs(projected.x)<1 && Math.abs(projected.y)<1,'Entire cabinet fits at aspect '+aspect);
  }
}
const event=(id,x,y,button=0)=>({pointerId:id,clientX:x,clientY:y,button});
let taps=createTapTracker();
taps.down(event(1,10,10)); assert.deepEqual(taps.up(event(1,12,11)),{x:12,y:11});
taps.down(event(1,10,10)); taps.move(event(1,30,10)); assert.equal(taps.up(event(1,10,10)),null,'Drag returning to start');
taps.down(event(1,10,10)); taps.down(event(2,20,20));
assert.equal(taps.up(event(1,10,10)),null); assert.equal(taps.up(event(2,20,20)),null,'Pinch ends without selecting');
taps.down(event(1,10,10)); taps.cancel(event(1,10,10)); assert.equal(taps.up(event(1,10,10)),null);
taps.down(event(1,10,10,2)); assert.equal(taps.up(event(1,10,10,2)),null,'Secondary button');
taps.down(event(1,10,10)); assert.deepEqual(taps.up(event(1,10,10)),{x:10,y:10},'New tap recovers after cancellation');
console.log(JSON.stringify({categoryNodes:engine.categories.length,constrainedViews:constrained,fitAspects:4,tapDragPinch:'PASS',status:'PASS'}));

})().catch(error=>{ console.error(error); process.exitCode=1; });

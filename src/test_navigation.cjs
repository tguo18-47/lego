'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('./navigation-model.cjs');
const layout = require('./locations.json');
const pieces = require('./collection.json').pieces;
const cabinet = model.validateLayout(layout, pieces);
const engine = require('./engine.js').createEngine(require('./collection.json'));

assert.equal(cabinet.rows, 7); assert.equal(cabinet.columns, 8);
assert.equal(Object.keys(layout.pieceLocations).length, 56);
// Explicit identities at first/last cells, row wraps and every class boundary.
const placed = Object.entries(layout.pieceLocations).sort((a,b) => a[1].row-b[1].row || a[1].column-b[1].column);
const expectedBoundaries = {
  1:'TG002', 8:'TG028', 9:'TG029', 19:'TG055', 20:'TG001',
  29:'TG054', 30:'TG003', 37:'TG056', 38:'TG009', 48:'TG052', 49:'TG016', 56:'TG049'
};
for (const [position, id] of Object.entries(expectedBoundaries)) assert.equal(placed[Number(position)-1][0], id, 'Slot ' + position);
for (const [id, row, column] of [['TG002',1,1],['TG053',3,2],['TG048',6,7],['TG038',5,3],['TG043',5,4]]) {
  assert.deepEqual(layout.pieceLocations[id], {cabinetId:'cabinet-1',row,column});
  assert.equal(model.address(layout,id), 'Cabinet 1 · Row ' + row + ' · Column ' + column);
}
assert.notDeepEqual(layout.pieceLocations.TG002, layout.pieceLocations.TG053);
assert.deepEqual(engine.search({colour:'Orange',category:'C'}).items.map(piece => model.address(layout,piece.id)),
  ['Cabinet 1 · Row 5 · Column 3','Cabinet 1 · Row 5 · Column 4']);
// Search result order and facet changes cannot reassign physical locations.
const saved = JSON.stringify(layout);
for (const category of ['A','B','C','D','E']) engine.search({category}).items.reverse().forEach(piece => assert(model.address(layout,piece.id)));
assert.equal(JSON.stringify(layout),saved);
assert.equal(model.address(layout,'TG999'),'');

const clone = () => structuredClone(layout);
let invalid = clone(); delete invalid.pieceLocations.TG002;
assert.throws(() => model.validateLayout(invalid,pieces),/coverage/);
invalid = clone(); invalid.pieceLocations.TG002 = {...invalid.pieceLocations.TG053};
assert.throws(() => model.validateLayout(invalid,pieces),/Duplicate cabinet/);
for (const value of [0,8,1.5,null]) {
  invalid = clone(); invalid.pieceLocations.TG002.row=value;
  assert.throws(() => model.validateLayout(invalid,pieces),/Out-of-bounds/);
}
invalid = clone(); invalid.pieceLocations.TG002.cabinetId='missing';
assert.throws(() => model.validateLayout(invalid,pieces),/Out-of-bounds/);
invalid = clone(); invalid.pieceLocations.TG999=invalid.pieceLocations.TG002; delete invalid.pieceLocations.TG002;
assert.throws(() => model.validateLayout(invalid,pieces),/Unknown TG/);
assert.throws(() => model.validateLayout(layout,pieces.concat(pieces[0])),/Duplicate TG/);

let routeSamples = 0;
for (const aspect of [0.65,1,1.5,2]) for (const location of Object.values(layout.pieceLocations)) {
  const start = model.routePose(cabinet,location,0,aspect), station = model.routePose(cabinet,null,0,aspect);
  assert.deepEqual(start,station);
  assert.deepEqual(model.routePose(cabinet,location,1,aspect).target,model.cellPosition(cabinet,location));
  assert.deepEqual(model.routePose(cabinet,location,-1,aspect),start);
  assert.deepEqual(model.routePose(cabinet,location,2,aspect),model.routePose(cabinet,location,1,aspect));
  let previous;
  for (let step=0; step<=100; step++) {
    const pose=model.routePose(cabinet,location,step/100,aspect);
    assert(pose.position.concat(pose.target).every(Number.isFinite));
    assert(pose.position[2]>1 && pose.position[1]>0.4,'Camera stays in front of cabinet and above floor');
    if (previous) assert(Math.hypot(...pose.position.map((value,i)=>value-previous[i]))<0.7,'Continuous route');
    previous=pose.position; routeSamples++;
  }
}
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const embedded=JSON.parse(html.match(/<script id="locationData" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded,layout);
assert.equal(require('../package.json').dependencies.three,'0.187.0');
console.log(JSON.stringify({locations:56,cabinets:1,rows:7,columns:8,routeSamples,status:'PASS'}));

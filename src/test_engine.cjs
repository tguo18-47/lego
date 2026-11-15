'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'collection.json'),'utf8'));
const {createEngine,normalSize}=require('./engine.js');
const e=createEngine(data);
let tests=0;
function ids(state,expected) {
  assert.deepEqual(e.search(state).items.map(p=>p.id),expected,JSON.stringify(state)); tests++;
}
function total(state,n) { assert.equal(e.search(state).total,n,JSON.stringify(state)); tests++; }
total({},56);
for (const [category,n] of Object.entries({A:19,B:10,C:8,D:11,E:8})) total({category},n);
ids({colour:'Pink',category:'A'},['TG002','TG053']);
ids({colour:'Orange',category:'C'},['TG038','TG043']);
ids({colour:'Dark grey',size:'1x3'},['TG005','TG010','TG015','TG056']);
ids({category:'D',size:'2x2'},['TG048']);
ids({colour:'Blue',category:'E'},['TG046']);
ids({colour:'White',category:'E'},['TG022','TG046']);
ids({colour:'Red',category:'A'},['TG028','TG032','TG033','TG037']);
total({q:'roof tile'},8); total({q:'upright slope'},5);
ids({q:'head'},['TG016']);
ids({q:'curved brick'},['TG007']);
ids({q:'brick with a side stud'},['TG021','TG026','TG031']);
ids({q:'plate with vertical pin'},['TG048']);
ids({q:'plate with vertical pin',category:'B'},[]);
ids({q:'transparent'},['TG003','TG027','TG032','TG037']);
ids({q:'clear'},['TG003']);
ids({q:'TG002',colour:'Blue'},[]);
ids({q:'tg002'},['TG002']);
total({size:'not-recorded'},14);
ids({q:'1x1'},['TG021','TG026','TG031']);
ids({q:'1x10'},['TG050','TG054']);
total({q:'4 × 1'},10); total({q:'1 * 4'},10);
total({q:'3x1x4'},0);
total({q:'dark gray 1x3'},4); total({q:'slopes'},8);
total({q:'block'},19); total({q:'bricks'},19);
ids({q:'orange roof tile 2x1'},['TG038','TG043']);
ids({q:'head',colour:'Green'},[]);
ids({q:'snap'},['TG030','TG048']); // Both source records explicitly carry this keyword.
ids({q:'see through red'},['TG032','TG037']);
ids({q:'blue and white'},['TG046']);
ids({colour:'Pink-purple'},['TG045','TG049']);
ids({colour:'Pale yellow'},['TG050','TG054']);
assert.equal(e.search({colour:'Pink',size:'1x4'}).counts.colour.Blue,2);tests++;
assert.equal(e.search({colour:'Orange',category:'C'}).counts.size['1x2'],2);tests++;
assert.equal(e.search({q:'head'}).counts.category.E,1);tests++;
assert.equal(e.search({q:'head',category:'A'}).counts.category.E,1);tests++;
assert.equal(e.pieces.find(p=>p.id==='TG001').topStuds,0);tests++;
assert.equal(e.colours.length,14);tests++;
assert.equal(normalSize('4x1'),'1x4');tests++;
assert.equal(normalSize(null),null);tests++;
assert.deepEqual(e.search({q:'upright slope'}).related,[{name:'Inverted slope',category:'C2'}]);tests++;
total({q:'<script>alert(1)</script>'},0); total({q:'the'},0);
// Every category has one exact path, avoiding accidental code-prefix matches.
for (const c of e.categories) {
  const results=e.search({category:c.code}).items;
  assert(results.every(p=>p.path.includes(c.code)));
  assert.equal(new Set(results.map(p=>p.id)).size,results.length);
}
// Audit every two-facet combination using source-derived component memberships.
const facets={colour:e.colours,category:['A','B','C','D','E'],size:[...e.sizes,'not-recorded']};
let pairs=0;
for (const [a,b] of [['colour','category'],['colour','size'],['category','size']]) {
  for (const av of facets[a]) for (const bv of facets[b]) {
    const state={[a]:av,[b]:bv};
    const result=e.search(state);
    assert.equal(result.total,new Set(result.items.map(p=>p.id)).size);
    function sourceMatches(p,key,value) {
      if (key==='category') return p.classCode[0]===value;
      if (key==='size') return value==='not-recorded' ? p.size===null : p.size===value;
      return p.colour.toLowerCase().split(/,|\band\b/).map(c=>c.trim().replace(/^transparent /,'')).includes(value.toLowerCase());
    }
    const expected=data.pieces.filter(p=>sourceMatches(p,a,av)&&sourceMatches(p,b,bv)).map(p=>p.id).sort();
    assert.deepEqual(result.items.map(p=>p.id),expected,JSON.stringify(state));
    pairs++;
  }
}
// Check the exported single-file artifact, not just the work files.
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,6);
const exportedData=JSON.parse(scripts[0]);
function withoutImageFields(record) {
  return Object.fromEntries(Object.entries(record).filter(([key])=>!['imageDataUrl','imageWidth','imageHeight','imageSource'].includes(key)));
}
assert.deepEqual(exportedData.pieces.map(withoutImageFields),data.pieces.map(withoutImageFields));
for (const key of ['categories','terms','useEntries','sources']) assert.deepEqual(exportedData[key],data[key]);
const expectedImageOverrides=path.join(__dirname,'highres/replacements.json');
if(fs.existsSync(expectedImageOverrides)) {
  const overrides=JSON.parse(fs.readFileSync(expectedImageOverrides,'utf8'));
  for(const p of exportedData.pieces) if(overrides[p.id]) {
    assert.equal(p.imageDataUrl,overrides[p.id].imageDataUrl);
    assert(p.imageWidth>=192 && p.imageHeight>=192);
  }
}
for (const code of scripts.slice(2)) new Function(code);
assert(!/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html));
assert(!/<img[^>]+src=["']https?:/i.test(html));
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(html));
assert(html.includes("connect-src 'none'"));
assert(!/type=["']module/.test(html));
console.log(JSON.stringify({acceptanceAssertions:tests,twoFacetCombinations:pairs,categories:e.categories.length,offlineArtifactBytes:Buffer.byteLength(html),status:'PASS'}));

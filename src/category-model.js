(function (root) {
  'use strict';
  // Presentation only: none of these labels or examples alter search vocabulary.
  var labels={A1:'Rectangular bricks',A2:'Round bricks',B1:'Plates',B2:'Smooth tiles',
    C1:'Regular slopes',C2:'Inverted slopes',C3:'Curved slopes',D1:'Arches',D2:'Special connections',
    'D2.1':'Side studs','D2.2':'Horizontal pins','D2.3':'Vertical pins',D3:'Rods',D4:'Ladders',D5:'Rotors',
    E1:'Figure parts',E2:'Decorations','E1.1':'Heads','E1.2':'Bodies','E1.3':'Legs','E2.1':'Flags','E2.2':'Flowers'};
  var examples={A:['TG002','TG027'],B:['TG012','TG001'],C:['TG038','TG007'],
    D:['TG009','TG030'],E:['TG016','TG045'],A1:['TG002','TG004'],A2:['TG027'],
    B1:['TG012','TG047'],B2:['TG001'],C1:['TG038'],C2:['TG005'],C3:['TG007'],
    D1:['TG009'],D2:['TG021','TG030','TG048'],'D2.1':['TG021'],'D2.2':['TG030'],'D2.3':['TG048'],
    D3:['TG036'],D4:['TG020'],D5:['TG052'],E1:['TG016','TG046','TG022'],E2:['TG019','TG045'],
    'E1.1':['TG016'],'E1.2':['TG046'],'E1.3':['TG022'],'E2.1':['TG019'],'E2.2':['TG045','TG042']};
  function createModel(engine) {
    var byCode=new Map(engine.categories.map(function (c) { return [c.code,c]; }));
    function children(code) { return engine.categories.filter(function (c) { return (c.parentCode || '')===(code || ''); }); }
    function isSize(code) { return /,\s*\d+\s*[x×]\s*\d+\s*$/i.test(byCode.get(code).name); }
    function sizeOnly(code) { var list=children(code); return !!list.length && list.every(function (c) { return isSize(c.code); }); }
    function branch(code) {
      if (!code) return {parentCode:'',cards:children(''),selectedCode:'',sizeOnly:false};
      if (!byCode.has(code)) throw new Error('Unknown category: '+code);
      var shapeCode=isSize(code)?byCode.get(code).parentCode:code;
      var list=children(shapeCode), parentCode;
      if (list.length && !sizeOnly(shapeCode)) parentCode=shapeCode;
      else parentCode=byCode.get(shapeCode).parentCode || '';
      return {parentCode:parentCode,cards:children(parentCode),selectedCode:shapeCode,sizeOnly:sizeOnly(shapeCode)};
    }
    function examplePieces(code) {
      var pool=engine.pieces.filter(function (p) { return p.path.includes(code); });
      var ids=examples[code] || [], found=ids.map(function (id) { return pool.find(function (p) { return p.id===id; }); }).filter(Boolean);
      if (found.length) return found;
      var seen=new Set(); return pool.filter(function (p) {
        if (seen.has(p.imageDataUrl)) return false; seen.add(p.imageDataUrl); return true;
      }).slice(0,2);
    }
    return {branch:branch,children:children,isSize:isSize,
      label:function (code) { return labels[code] || engine.categoryLabel(code); },
      parent:function (code) { return code?byCode.get(code).parentCode || '':''; },examples:examplePieces};
  }
  var api={createModel:createModel};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.LegoCategories=api;
})(typeof globalThis!=='undefined'?globalThis:this);

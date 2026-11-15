(function () {
  'use strict';
  var data=JSON.parse(document.getElementById('collectionData').textContent);
  var locations=JSON.parse(document.getElementById('locationData').textContent);
  var engine=LegoSearch.createEngine(data);
  var categoryModel=LegoCategories.createModel(engine);
  var state={q:'',colour:'',category:'',size:''}, lastResult;
  var selectedPieceId='', navigation, navigationState;
  var colourControls=[], sizeControls=[];
  var $=function (id) { return document.getElementById(id); };
  function element(tag,cls,text) {
    var node=document.createElement(tag);
    if (cls) node.className=cls;
    if (text!==undefined) node.textContent=String(text);
    return node;
  }
  function icon(name) {
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','icon'); svg.setAttribute('aria-hidden','true');
    var use=document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href','#i-'+name); svg.append(use); return svg;
  }
  function button(cls,text,action) {
    var b=element('button',cls,text); b.type='button'; b.addEventListener('click',action); return b;
  }
  function displayNote(note) {
    return String(note || '')
      .replace(/\bSize is not recorded[^.]*\.\s*/gi,'')
      .replace(/\bI do not infer it from the absence of top studs\.\s*/gi,'')
      .replace(/\bTransparency needs checking\.\s*/gi,'').trim();
  }
  function image(piece,decorative) {
    var img=element('img');
    img.src=piece.imageDataUrl; img.alt=decorative?'':piece.name;
    img.width=piece.imageWidth || 80; img.height=piece.imageHeight || 60; img.decoding='async';
    img.addEventListener('error',function () {
      img.hidden=true;
    },{once:true});
    return img;
  }
  function change(patch) {
    Object.assign(state,patch); render();
  }
  function reset() { resetNavigation(); change({q:'',colour:'',category:'',size:''}); $('searchInput').focus(); }
  function showDialog(dialog) { dialog.showModal(); document.body.classList.add('modal-open'); }
  function closeDialog(dialog) { dialog.close(); }
  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.querySelector('[data-close]').addEventListener('click',function () { closeDialog(dialog); });
    dialog.addEventListener('close',function () {
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    });
    dialog.addEventListener('click',function (event) {
      if (event.target===dialog) {
        var r=dialog.getBoundingClientRect();
        if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();
      }
    });
  });
  var palette={
    'Black':'#343940','Blue':'#4d8cc9','Clear':'','Dark grey':'#68717b','Green':'#4e9c68',
    'Lime':'#bed968','Medium grey':'#aeb6bd','Orange':'#f6a247','Pale yellow':'#f4e4a0',
    'Pink':'#e799bf','Pink-purple':'#bd79b7','Red':'#db665a','White':'#fff','Yellow':'#f3cf5e'
  };
  var colourOrder=['Pink','Red','Orange','Yellow','Pale yellow','Green','Lime','Blue','Pink-purple','White','Medium grey','Dark grey','Black','Clear'];
  function makeColour(value) {
    var b=button('colour-option','',function () { change({colour:state.colour===value?'':value}); });
    var swatch=element('span','swatch'+(!value?' swatch-all':value==='Clear'?' swatch-clear':''));
    if (palette[value]) swatch.style.background=palette[value];
    var mark=icon('check'); mark.setAttribute('hidden',''); swatch.append(mark);
    var label=element('span','colour-name',value || 'All colours'), count=element('span','colour-count');
    b.append(swatch,label,count); b.setAttribute('aria-pressed','false');
    $('colourOptions').append(b); colourControls.push({value:value,button:b,count:count,mark:mark});
  }
  makeColour('');
  colourOrder.filter(function (c) { return engine.colours.includes(c); }).forEach(makeColour);
  [{key:'',label:'Any size'}].concat(engine.sizes.map(function (s) { return {key:s,label:s.replace('x',' × ')}; })).forEach(function (s) {
    var node=element('option'); node.value=s.key; $('sizeSelect').append(node);
    sizeControls.push({key:s.key,label:s.label,node:node});
  });
  $('sizeSelect').addEventListener('change',function () { change({size:this.value}); });
  $('searchInput').addEventListener('input',function () { change({q:this.value}); });
  $('clearSearch').addEventListener('click',function () { change({q:''}); $('searchInput').focus(); });
  $('clearCategory').addEventListener('click',function () { change({category:''}); $('categoryPrompt').focus({preventScroll:true}); });
  $('clearAll').addEventListener('click',reset); $('startAgain').addEventListener('click',reset);
  function navigate(code) {
    document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); });
    change({q:'',category:code}); $('resultsHeading').focus({preventScroll:true});
    $('resultsHeading').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  function crosslinksFor(code) {
    if (code && code[0]==='A') return [{code:'D2.1',label:'Bricks with a side stud'},{code:'D2.2',label:'Bricks with a horizontal pin'}];
    if (code && code[0]==='B') return [{code:'D2.3',label:'Plates with a vertical pin'}];
    return [];
  }
  function appendCrosslinks(parent,links,cls) {
    links.forEach(function (link) {
      var b=button(cls || 'crosslink',link.label,function () { navigate(link.code); });
      b.append(icon('arrow')); parent.append(b);
    });
  }
  function chooseCategory(code) {
    change({category:state.category===code?categoryModel.parent(code):code});
    $('categoryPrompt').focus({preventScroll:true});
  }
  function categoryInfo(code) {
    var category=engine.categories.find(function (c) { return c.code===code; });
    $('categoryInfoTitle').textContent=engine.categoryLabel(code);
    var body=$('categoryInfoBody'); body.replaceChildren();
    body.append(element('p','breadcrumb',engine.path(code).map(function (c) { return c+' '+engine.categoryLabel(c); }).join(' › ')));
    body.append(element('p','category-scope',displayNote(category.scope)));
    appendCrosslinks(body,crosslinksFor(code)); showDialog($('categoryDialog'));
  }
  function renderCategoryBrowser(r) {
    var view=categoryModel.branch(state.category), area=$('categoryChoices'), crumbs=$('categoryBreadcrumbs');
    $('categoryPrompt').textContent=view.parentCode?'Choose a shape':'Choose a category';
    crumbs.replaceChildren(); crumbs.hidden=!state.category;
    if (state.category) {
      crumbs.append(button('','All categories',function () { change({category:''}); $('categoryPrompt').focus({preventScroll:true}); }));
      engine.path(state.category).forEach(function (code) {
        crumbs.append(element('span','crumb-divider','›'));
        if (code===state.category) crumbs.append(element('span','current-category',categoryModel.label(code)));
        else crumbs.append(button('',categoryModel.label(code),function () { change({category:code}); $('categoryPrompt').focus({preventScroll:true}); }));
      });
    }
    var all=$('categoryAll'); all.hidden=!view.parentCode;
    if (view.parentCode) {
      all.textContent='All '+categoryModel.label(view.parentCode).toLowerCase()+' · '+r.counts.category[view.parentCode];
      all.setAttribute('aria-pressed',String(state.category===view.parentCode));
      all.onclick=function () { chooseCategory(view.parentCode); };
    }
    $('sizeHint').hidden=!view.sizeOnly;
    $('sizeSelect').classList.toggle('size-suggested',view.sizeOnly);
    area.replaceChildren();
    view.cards.forEach(function (category) {
      var code=category.code, selected=view.selectedCode===code, count=r.counts.category[code];
      var tile=element('article','category-tile'); tile.dataset.category=code;
      var pick=button('category-picture','',function () { chooseCategory(code); });
      pick.dataset.category=code; pick.disabled=!count && !selected;
      pick.setAttribute('aria-pressed',String(selected));
      pick.setAttribute('aria-label',categoryModel.label(code)+', '+count+' '+(count===1?'piece':'pieces'));
      var pictures=element('span','category-art'), examples=categoryModel.examples(code);
      pictures.dataset.examples=examples.length;
      examples.forEach(function (piece) { pictures.append(image(piece,true)); });
      pick.append(pictures,element('span','category-picture-name',categoryModel.label(code)),element('span','category-picture-count',count+' '+(count===1?'piece':'pieces')));
      var info=button('category-info','i',function () { categoryInfo(code); }); info.setAttribute('aria-label','About '+categoryModel.label(code));
      tile.append(pick,info); area.append(tile);
    });
  }
  function openPiece(piece) {
    var container=$('pieceDetail'); container.replaceChildren();
    var top=element('div','detail-top'), picture=element('div','detail-picture');
    picture.append(image(piece)); top.append(picture);
    var body=element('div'), id=element('p','detail-id',piece.id), title=element('h2','',piece.name); title.id='detailTitle';
    body.append(id,title);
    var facts=element('dl','detail-facts');
    [['Colour',piece.colour || ''],['Size',piece.size ? piece.size.replace('x',' × ')+' · stud spacing':''],
      ['Original type',piece.type || ''],['Top studs',piece.topStuds==null?'':piece.topStuds],
      ['Keywords',(piece.keywords || []).join(', ')]].forEach(function (f) { facts.append(element('dt','',f[0]),element('dd','',f[1])); });
    body.append(facts); top.append(body); container.append(top);
    var category=element('div','detail-category');
    category.append(element('h3','','Classification'),element('p','breadcrumb',piece.path.map(function (c) {
      return c+' '+engine.categoryLabel(c);
    }).join('  ›  ')));
    var links=element('div','detail-links');
    links.append(button('','See this category',function () { navigate(piece.classCode); }));
    category.append(links); container.append(category);
    var notes=Array.from(new Set([piece.notes,piece.classificationNote].map(displayNote).filter(Boolean)));
    if (notes.length) {
      var noteBlock=element('div','detail-notes'); noteBlock.append(element('h3','','Notes about this record'));
      notes.forEach(function (note) { noteBlock.append(element('p','',note)); }); container.append(noteBlock);
    }
    showDialog($('pieceDialog')); $('pieceDialog').scrollTop=0;
  }
  function renderControls(r) {
    if ($('searchInput').value!==state.q) $('searchInput').value=state.q;
    $('clearSearch').hidden=!state.q;
    colourControls.forEach(function (c) {
      var selected=state.colour===c.value, n=c.value?r.counts.colour[c.value]:r.any.colour;
      c.button.classList.toggle('selected',selected); c.button.setAttribute('aria-pressed',String(selected));
      c.button.disabled=!!c.value && n===0 && !selected; c.count.textContent=n; c.mark.toggleAttribute('hidden',!selected);
      c.button.setAttribute('aria-label',(c.value || 'All colours')+', '+n+' '+(n===1?'piece':'pieces'));
    });
    renderCategoryBrowser(r);
    $('clearCategory').disabled=!state.category;
    sizeControls.forEach(function (s) {
      var n=s.key?r.counts.size[s.key]:r.any.size;
      s.node.textContent=s.label+' ('+n+')'; s.node.disabled=!!s.key && n===0 && state.size!==s.key;
    });
    $('sizeSelect').value=state.size;
    $('clearAll').disabled=!Object.values(state).some(Boolean) && !selectedPieceId;
    var cross=$('crosslinks'), links=crosslinksFor(state.category);
    cross.replaceChildren(); cross.hidden=!links.length;
    if (links.length) {
      cross.append(element('p','','Looking for an extra connection?')); appendCrosslinks(cross,links);
    }
  }
  function renderChips() {
    var area=$('activeFilters'); area.replaceChildren();
    [['q',state.q?'Search: '+state.q:''],['colour',state.colour],
      ['category',state.category?engine.categoryLabel(state.category):''],
      ['size',state.size.replace('x',' × ')]].forEach(function (pair) {
      if (!pair[1]) return;
      var b=button('filter-chip',pair[1],function () {
        var patch={}; patch[pair[0]]=''; change(patch);
        if (pair[0]==='category') $('categoryPrompt').focus({preventScroll:true});
        else if (pair[0]==='size') $('sizeSelect').focus();
        else if (pair[0]==='colour') colourControls[0].button.focus();
        else $('searchInput').focus();
      });
      b.setAttribute('aria-label','Remove '+pair[1]); b.append(icon('close')); area.append(b);
    });
  }
  function renderExplanation(r) {
    var explanations=Array.from(new Set(r.interpreted.filter(function (i) { return i.kind==='alias'; })
      .map(function (i) { return '“'+i.input+'” → '+i.preferred; })));
    $('queryExplanation').hidden=!explanations.length;
    $('queryExplanation').textContent=explanations.join(' · ')+' · Word relationships apply within this collection.';
    var related=$('relatedQueries'); related.replaceChildren(); related.hidden=!r.related.length;
    if (r.related.length) {
      related.append(element('span','','Also explore:'));
      r.related.forEach(function (link) { related.append(button('',link.name,function () { navigate(link.category); })); });
    }
  }
  function renderCards(r) {
    var grid=$('pieceGrid'); grid.replaceChildren(); grid.hidden=!r.total; $('emptyState').hidden=!!r.total;
    var fragment=document.createDocumentFragment();
    r.items.forEach(function (p) {
      var card=button('piece-card','',function () { selectPiece(p); });
      card.dataset.pieceId=p.id;
      card.setAttribute('aria-label','Find '+p.id+': '+p.name+' in the room');
      card.setAttribute('aria-pressed',String(selectedPieceId===p.id));
      card.classList.toggle('piece-selected',selectedPieceId===p.id);
      var picture=element('div','piece-image'), img=image(p); img.loading='lazy';
      picture.append(img,element('span','piece-id',p.id),element('span','piece-class',p.path[0]));
      var info=element('div','piece-info'), name=element('h3','',p.name), meta=element('div','piece-meta');
      meta.append(element('span','',p.colour || ''));
      if (p.size) meta.append(element('span','',p.size.replace('x',' × ')));
      info.append(name,meta); card.append(picture,info); fragment.append(card);
    }); grid.append(fragment);
    var recovery=$('emptyRecovery'); recovery.replaceChildren();
    if (!r.total && state.q && engine.search({q:state.q}).total>0) {
      recovery.append(element('p','','Your search has matches in the collection. Your selected filters are hiding them.'));
      recovery.append(button('recovery-button','Keep search, clear filters',function () { change({colour:'',category:'',size:''}); $('searchInput').focus(); }));
    }
  }
  function render() {
    var r=engine.search(state); lastResult=r;
    if (selectedPieceId && !r.items.some(function (p) { return p.id===selectedPieceId; })) resetNavigation();
    renderControls(r); renderChips(); renderExplanation(r); renderCards(r);
    var active=Object.values(state).some(Boolean);
    $('resultsHeading').textContent=active?r.total+' '+(r.total===1?'piece':'pieces')+' found':'All '+r.total+' pieces';
    $('resultsCaption').textContent=active?'Every piece below matches all your choices.':'Choose a piece to find its place in the room.';
    $('liveStatus').textContent=r.total+' '+(r.total===1?'piece matches':'pieces match')+' your search.';
  }

  // Search and physical navigation have separate state. Filtering never moves a piece.
  document.querySelector('.skip-link').addEventListener('click',function () {
    $('resultsHeading').focus({preventScroll:true});
  });
  $('mapCabinetName').textContent=locations.cabinets[0].label;
  document.querySelector('.legend-caption').textContent=locations.cabinets[0].rows+' rows × '+locations.cabinets[0].columns+' columns';
  document.querySelectorAll('.cabinet-legend [data-class]').forEach(function (label) {
    label.querySelector('b').textContent=engine.pieces.filter(function (piece) { return piece.classCode[0]===label.dataset.class; }).length;
  });
  function updateSelectionCards() {
    $('pieceGrid').querySelectorAll('[data-piece-id]').forEach(function (card) {
      var selected=card.dataset.pieceId===selectedPieceId;
      card.classList.toggle('piece-selected',selected); card.setAttribute('aria-pressed',String(selected));
    });
  }
  function updateNavigation(status) {
    navigationState=status;
    var piece=status.id?engine.pieces.find(function (p) { return p.id===status.id; }):null;
    $('navigationPanel').dataset.phase=status.phase;
    $('navigationPanel').dataset.selectedPiece=status.id;
    $('navigationPanel').dataset.viewMode=status.mode;
    $('navigationWelcome').hidden=!!piece; $('selectedPiece').hidden=!piece;
    $('viewDetails').disabled=!piece; $('replayRoute').disabled=!piece; $('backToStation').disabled=!piece;
    $('clearAll').disabled=!Object.values(state).some(Boolean) && !piece;
    $('toggleMap').textContent=status.mode==='3d'?'Cabinet map':status.canUse3d?'3D view':'Cabinet map';
    $('toggleMap').setAttribute('aria-pressed',String(status.mode==='map'));
    $('toggleMap').disabled=!status.canUse3d;
    $('sceneLocation').hidden=!piece;
    $('cameraTools').hidden=status.mode!=='3d';
    if (piece) {
      if ($('selectedPicture').dataset.pieceId!==piece.id) {
        $('selectedPicture').replaceChildren(image(piece,true)); $('selectedPicture').dataset.pieceId=piece.id;
      }
      $('selectedCode').textContent=piece.id+' · '+piece.classCode[0];
      $('selectedName').textContent=piece.name; $('selectedAddress').textContent=status.address;
      $('sceneLocationText').textContent=status.phase==='moving'?'On the way to '+piece.id:piece.id+' · Row '+
        locations.pieceLocations[piece.id].row+' · Column '+locations.pieceLocations[piece.id].column;
      $('navigationLive').textContent=status.phase==='moving'?'Navigating to '+piece.id+'.':
        piece.id+', '+piece.name+'. '+status.address+'.';
    } else {
      $('navigationLive').textContent='LEGO Navigation Station. Choose a piece to see its location.';
    }
    updateSelectionCards();
  }
  function revealCard(id) {
    var card=$('pieceGrid').querySelector('[data-piece-id="'+id+'"]');
    if (card) card.scrollIntoView({block:'center',behavior:'instant'});
  }
  function selectPiece(piece,source) {
    if (source==='cabinet') {
      if (!lastResult.items.some(function (p) { return p.id===piece.id; })) {
        Object.assign(state,{q:'',colour:'',category:'',size:''});
      }
      selectedPieceId=piece.id; render();
      navigation.select(piece.id,{preserveView:true});
      revealCard(piece.id);
    } else {
      selectedPieceId=piece.id; navigation.select(piece.id);
    }
  }
  function resetNavigation() { selectedPieceId=''; if (navigation) navigation.reset(); }
  $('viewDetails').addEventListener('click',function () {
    var piece=engine.pieces.find(function (p) { return p.id===selectedPieceId; });
    if (piece) openPiece(piece);
  });
  $('replayRoute').addEventListener('click',function () { if (selectedPieceId) navigation.select(selectedPieceId); });
  $('backToStation').addEventListener('click',resetNavigation);
  $('toggleMap').addEventListener('click',function () { navigation.setMapMode(navigationState.mode!=='map'); });
  $('zoomIn').addEventListener('click',function () { navigation.zoomIn(); });
  $('zoomOut').addEventListener('click',function () { navigation.zoomOut(); });
  $('fitCabinet').addEventListener('click',function () { navigation.fitCabinet(); });
  navigation=LegoNavigation.createNavigator({host:$('navigationScene'),map:$('cabinetMap'),grid:$('cabinetMapGrid'),
    layout:locations,pieces:engine.pieces,onChange:updateNavigation,onPick:function (id) {
      var piece=engine.pieces.find(function (p) { return p.id===id; }); if (piece) selectPiece(piece,'cabinet');
    }});
  window.addEventListener('pagehide',function (event) { if (!event.persisted) navigation.dispose(); });
  render();
})();

(function (root) {
  'use strict';
  function words(value) {
    return String(value || '').toLowerCase().replace(/[\u2010-\u2015]/g, '-')
      .replace(/(^|[^a-z0-9])(\d+)\s*[x×*]\s*(\d+)(?=$|[^a-z0-9])/gi,
        function (_, before, a, b) { return before + Math.min(+a, +b) + 'x' + Math.max(+a, +b); })
      .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
  }
  var plurals = {
    pieces:'piece', bricks:'brick', blocks:'block', tiles:'tile', plates:'plate',
    slopes:'slope', connectors:'connector', flags:'flag', flowers:'flower',
    heads:'head', legs:'leg', rods:'rod', arches:'arch', torsos:'torso',
    bases:'base', propellers:'propeller', streamers:'streamer', cylinders:'cylinder',
    pins:'pin', studs:'stud', bodies:'body', grey:'grey', gray:'grey'
  };
  function tokens(value) {
    return words(value).filter(function (w) { return !['a','an','the','and'].includes(w); })
      .map(function (w) { return plurals[w] || w; });
  }
  function normal(value) { return tokens(value).join(' '); }
  function normalSize(value) {
    if (!value) return null;
    var match = String(value).match(/^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i);
    return match ? Math.min(+match[1], +match[2]) + 'x' + Math.max(+match[1], +match[2]) : null;
  }
  var termClasses = {
    'Arch':'D1', 'Brick':'A', 'Connector':'D2', 'Curved slope':'C3',
    'Decorative piece':'E2', 'Figure and decorative piece':'E', 'Flag':'E2.1',
    'Flower':'E2.2', 'Horizontal-pin brick':'D2.2', 'Inverted slope':'C2',
    'Ladder':'D4', 'LEGO piece':null, 'Minifigure head':'E1.1',
    'Minifigure legs':'E1.3', 'Minifigure part':'E1', 'Minifigure torso':'E1.2',
    'Plate':'B1', 'Rectangular brick':'A1', 'Rod':'D3', 'Rotor':'D5',
    'Round brick':'A2', 'Round eye tile':'B2', 'Round tile':'B2',
    'Side-stud brick':'D2.1', 'Slope':'C', 'Structural and connecting piece':'D',
    'Thin piece':'B', 'Tile':'B2', 'Upright slope':'C1', 'Vertical-pin base':'D2.3'
  };
  var labels = {
    A:'Ordinary bricks', B:'Plates & tiles', C:'Slopes',
    D:'Connecting & structural pieces', E:'Figure parts & decorations'
  };
  function createEngine(data) {
    var cats = new Map(data.categories.map(function (c) { return [c.code, c]; }));
    function path(code) {
      var result = [], seen = new Set();
      while (code) {
        if (seen.has(code) || !cats.has(code)) throw new Error('Invalid category: ' + code);
        seen.add(code); result.unshift(code); code = cats.get(code).parentCode;
      }
      return result;
    }
    function components(value) {
      return Array.from(new Set(value.split(/,|\band\b/i).map(function (c) {
        return c.trim().replace(/^transparent\s+/i, '').replace(/^./,function (ch) { return ch.toUpperCase(); });
      }).filter(Boolean)));
    }
    var pieces = data.pieces.map(function (p) {
      return Object.assign({}, p, {
        colours:components(p.colour), sizeKey:normalSize(p.size), path:path(p.classCode),
        transparent:/^(clear|transparent\b)/i.test(p.colour),
        textWords:new Set(tokens(p.name + ' ' + p.keywords.join(' ')))
      });
    }).sort(function (a,b) { return a.id.localeCompare(b.id); });
    if (new Set(pieces.map(function (p) { return p.id; })).size !== pieces.length) throw new Error('Duplicate IDs');
    var colourOptions = Array.from(new Set(pieces.flatMap(function (p) { return p.colours; }))).sort();
    var sizeOptions = Array.from(new Set(pieces.map(function (p) { return p.sizeKey; }).filter(Boolean))).sort(function (a,b) {
      var aa=a.split('x').map(Number), bb=b.split('x').map(Number);
      return aa[0]-bb[0] || aa[1]-bb[1];
    });
    var dictionary = new Map(), terms = new Map(data.terms.map(function (t) { return [t.preferred,t]; }));
    function add(phrase, predicate, priority, info) {
      var ts=tokens(phrase), key=ts.join(' ');
      if (!key) return;
      var old=dictionary.get(key);
      if (!old || priority>old.priority) dictionary.set(key, {tokens:ts, predicate:predicate, priority:priority, info:info});
    }
    function conceptTest(preferred) {
      if (!Object.prototype.hasOwnProperty.call(termClasses, preferred)) throw new Error('Unmapped term: ' + preferred);
      var code=termClasses[preferred];
      return function (p) { return code === null || p.path.includes(code); };
    }
    data.terms.forEach(function (t) {
      add(t.preferred, conceptTest(t.preferred), 100, {kind:'concept', preferred:t.preferred, category:termClasses[t.preferred]});
      t.alternatives.forEach(function (a) {
        add(a, conceptTest(t.preferred), 100, {kind:'alias', input:a, preferred:t.preferred, category:termClasses[t.preferred]});
      });
    });
    (data.useEntries || []).forEach(function (t) {
      add(t.alternative, conceptTest(t.preferred), 100,
        {kind:'alias', input:t.alternative, preferred:t.preferred, category:termClasses[t.preferred]});
    });
    var keywordIds=new Map();
    pieces.forEach(function (p) {
      p.keywords.forEach(function (k) {
        var key=normal(k);
        if (!keywordIds.has(key)) keywordIds.set(key,new Set());
        keywordIds.get(key).add(p.id);
      });
    });
    keywordIds.forEach(function (ids,k) {
      add(k,function (p) { return ids.has(p.id); },20,{kind:'keyword'});
    });
    colourOptions.forEach(function (c) {
      add(c,function (p) { return p.colours.includes(c); },90,{kind:'colour',preferred:c});
    });
    ['transparent','see through','see-through'].forEach(function (t) {
      add(t,function (p) { return p.transparent; },95,{kind:'property',preferred:'Transparent'});
    });
    var phrases=Array.from(dictionary.values()).sort(function (a,b) {
      return b.tokens.length-a.tokens.length || b.priority-a.priority;
    });
    function parseQuery(query) {
      var ts=tokens(query), clauses=[], interpreted=[];
      for (var i=0;i<ts.length;) {
        var matched=phrases.find(function (entry) {
          return entry.tokens.every(function (word,offset) { return ts[i+offset]===word; });
        });
        if (matched) {
          clauses.push(matched.predicate); interpreted.push(matched.info); i+=matched.tokens.length;
        } else {
          var token=ts[i++];
          if (/^tg\d{3}$/.test(token)) clauses.push((function (id) { return function (p) { return p.id.toLowerCase()===id; }; })(token));
          else if (/^\d+x\d+$/.test(token)) clauses.push((function (s) { return function (p) { return p.sizeKey===s; }; })(token));
          else clauses.push((function (word) { return function (p) { return p.textWords.has(word); }; })(token));
        }
      }
      if (String(query || '').trim() && !clauses.length) clauses.push(function () { return false; });
      return {test:function (p) { return clauses.every(function (f) { return f(p); }); }, interpreted:interpreted};
    }
    function facetMatch(p,state,except) {
      return (except==='colour' || !state.colour || p.colours.includes(state.colour)) &&
        (except==='category' || !state.category || p.path.includes(state.category)) &&
        (except==='size' || !state.size || (state.size==='not-recorded' ? p.sizeKey===null : p.sizeKey===state.size));
    }
    function search(state) {
      state=Object.assign({q:'',colour:'',category:'',size:''},state);
      var parsed=parseQuery(state.q), pool=pieces.filter(parsed.test);
      var items=pool.filter(function (p) { return facetMatch(p,state); });
      var counts={colour:{},category:{},size:{}}, any={};
      ['colour','category','size'].forEach(function (facet) {
        var base=pool.filter(function (p) { return facetMatch(p,state,facet); });
        any[facet]=base.length;
        if (facet==='colour') colourOptions.forEach(function (c) { counts.colour[c]=base.filter(function (p) { return p.colours.includes(c); }).length; });
        if (facet==='category') data.categories.forEach(function (c) { counts.category[c.code]=base.filter(function (p) { return p.path.includes(c.code); }).length; });
        if (facet==='size') {
          sizeOptions.forEach(function (s) { counts.size[s]=base.filter(function (p) { return p.sizeKey===s; }).length; });
          counts.size['not-recorded']=base.filter(function (p) { return p.sizeKey===null; }).length;
        }
      });
      var related=new Map();
      parsed.interpreted.forEach(function (info) {
        var term=terms.get(info.preferred);
        if (!term) return;
        term.relationships.split('\n').filter(function (line) { return /^Related term RT:/i.test(line); })
          .forEach(function (line) {
            line.replace(/^Related term RT:\s*/i,'').split(';').forEach(function (name) {
              name=name.trim();
              if (termClasses[name]) related.set(name,termClasses[name]);
            });
          });
      });
      return {items:items,total:items.length,counts:counts,any:any,
        interpreted:parsed.interpreted,related:Array.from(related,function (r) { return {name:r[0],category:r[1]}; })};
    }
    return {search:search,pieces:pieces,categories:data.categories,colours:colourOptions,sizes:sizeOptions,
      categoryLabel:function (code) { return labels[code] || (cats.get(code) || {}).name || code; },
      category:function (code) { return cats.get(code); },path:path,normal:normal,normalSize:normalSize};
  }
  var api={createEngine:createEngine,normalSize:normalSize,normal:normal};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.LegoSearch=api;
})(typeof globalThis!=='undefined' ? globalThis : this);

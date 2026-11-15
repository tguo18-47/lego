"""Create disposable, local-only failure fixtures from the finished artifact."""
from pathlib import Path
import json
import re

base = Path(__file__).resolve().parent
html = (base.parent / "index.html").read_text()
target = base / "generated/qa"
target.mkdir(parents=True, exist_ok=True)

webgl = """<script>
// QA only: emulate a browser without WebGL; never included in index.html.
const originalContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(type, ...args) {
  if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
  return originalContext.call(this, type, ...args);
};
</script>"""
motion = """<script>
// QA only: emulate the user's reduced-motion media preference.
const originalMatchMedia = window.matchMedia.bind(window);
window.matchMedia = function(query) {
  if (query === '(prefers-reduced-motion: reduce)') return {
    matches:true, media:query, onchange:null,
    addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}
  };
  return originalMatchMedia(query);
};
</script>"""
for name, script in [("no-webgl.html", webgl), ("reduced-motion.html", motion)]:
    (target / name).write_text(html.replace("</head>", script + "</head>", 1))

loss = """<script>
// QA only: a real context-loss event, triggered through this fixture's UI.
const loseContext = document.createElement('button');
loseContext.textContent = 'QA: lose rendering context';
loseContext.id = 'qaLoseContext';
loseContext.style.cssText = 'position:fixed;bottom:4px;left:4px;z-index:1000;background:white;border:2px solid purple;padding:8px';
loseContext.addEventListener('click', () => {
  const canvas = document.querySelector('#navigationScene canvas');
  const context = canvas?.getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
});
document.body.append(loseContext);
</script>"""
(target / "context-loss.html").write_text(html.replace("</body>", loss + "</body>", 1))

touch = """<script>
// QA only: exercise the actual touch listeners without a physical touch screen.
const qaTouches = document.createElement('div');
qaTouches.style.cssText = 'position:fixed;bottom:4px;left:4px;z-index:1000;background:white;border:2px solid purple;padding:4px;display:flex;gap:8px';
function emitTouchGesture(kind) {
  const canvas = document.querySelector('#navigationScene canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect(), x = rect.left + rect.width/2, y = rect.top + rect.height/2;
  const capture = canvas.setPointerCapture.bind(canvas), release = canvas.releasePointerCapture.bind(canvas);
  canvas.setPointerCapture = id => { if (id < 10000) capture(id); };
  canvas.releasePointerCapture = id => { if (id < 10000) release(id); };
  function emit(type,id,px,py) {
    canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===10001,
      clientX:px,clientY:py,button:0,buttons:type==='pointerup'?0:1,bubbles:true,cancelable:true}));
  }
  if (kind === 'pinch') {
    emit('pointerdown',10001,x-30,y); emit('pointerdown',10002,x+30,y);
    for (let step=1; step<=8; step++) {
      emit('pointermove',10001,x-30-step*4,y); emit('pointermove',10002,x+30+step*4,y);
    }
    emit('pointerup',10001,x-62,y); emit('pointerup',10002,x+62,y);
  } else {
    emit('pointerdown',10001,x,y);
    for (let step=1; step<=8; step++) emit('pointermove',10001,x+step*5,y+step*4);
    emit('pointerup',10001,x+40,y+32);
  }
  canvas.setPointerCapture = capture; canvas.releasePointerCapture = release;
}
for (const kind of ['pinch','drag']) {
  const button = document.createElement('button'); button.textContent = 'QA: touch '+kind;
  button.addEventListener('click',() => emitTouchGesture(kind)); qaTouches.append(button);
}
document.body.append(qaTouches);
</script>"""
(target / "touch-controls.html").write_text(html.replace("</body>", touch + "</body>", 1))

pattern = r'(<script id="collectionData" type="application/json">)([\s\S]*?)(</script>)'
match = re.search(pattern, html)
data = json.loads(match[2])
for piece in data["pieces"]:
    if piece["id"] == "TG002":
        piece["imageDataUrl"] = "data:image/png;base64,broken-for-local-qa"
replacement = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
broken = html[:match.start(2)] + replacement + html[match.end(2):]
(target / "broken-image.html").write_text(broken)
print(json.dumps({"fixtures":[p.name for p in sorted(target.glob("*.html"))]}))

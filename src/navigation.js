import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import model from './navigation-model.cjs';
import {createTapTracker} from './tap-tracker.cjs';

const CLASS_COLOURS = {A:'#7961b4', B:'#3c8b86', C:'#cb8540', D:'#597da9', E:'#ba6b8c'};
const DURATION = 3000;

function buildMap(grid, layout, pieces, onPick) {
  const cabinet = layout.cabinets[0], byCell = new Map();
  pieces.forEach(piece => {
    const location = layout.pieceLocations[piece.id];
    byCell.set(location.row + ':' + location.column, piece);
  });
  grid.replaceChildren();
  grid.style.gridTemplateColumns = '16px repeat(' + cabinet.columns + ', minmax(0, 1fr))';
  grid.style.gridTemplateRows = '15px repeat(' + cabinet.rows + ', minmax(0, 1fr))';
  grid.setAttribute('aria-label', cabinet.label + ', ' + cabinet.rows + ' rows and ' + cabinet.columns + ' columns');
  grid.append(document.createElement('span'));
  for (let column = 1; column <= cabinet.columns; column++) {
    const heading = document.createElement('span');
    heading.className = 'map-coordinate'; heading.textContent = column; grid.append(heading);
  }
  for (let row = 1; row <= cabinet.rows; row++) {
    const heading = document.createElement('span');
    heading.className = 'map-coordinate'; heading.textContent = row; grid.append(heading);
    for (let column = 1; column <= cabinet.columns; column++) {
      const cell = document.createElement('button'), piece = byCell.get(row + ':' + column);
      cell.type = 'button';
      cell.className = 'map-cell';
      cell.dataset.row = row; cell.dataset.column = column;
      if (piece) {
        cell.dataset.pieceId = piece.id; cell.dataset.class = piece.classCode[0];
        cell.setAttribute('aria-label','Select '+piece.id+': '+piece.name+'. '+model.address(layout,piece.id));
        cell.setAttribute('aria-pressed','false');
        cell.addEventListener('click',() => onPick(piece.id));
        const image = document.createElement('img');
        image.src = piece.imageDataUrl; image.alt = ''; image.decoding = 'async';
        image.addEventListener('error', () => { image.hidden = true; }, {once:true});
        const label = document.createElement('span'); label.textContent = piece.classCode[0] + ' · ' + piece.id;
        cell.append(image, label);
      } else { cell.disabled = true; }
      grid.append(cell);
    }
  }
}

function createScene(host, layout, pieces, invalidate, onContextLoss, onManual, onPick) {
  const cabinet = layout.cabinets[0];
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'low-power'});
  const geometries = new Set(), materials = new Set(), textures = new Set();
  let disposed = false, controls = null, detachInputs = () => {}, detachContext = () => {};
  function release() {
    if (disposed) return;
    disposed = true; detachContext(); detachInputs(); if (controls) controls.dispose();
    geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
    textures.forEach(item => item.dispose()); renderer.dispose(); renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  try {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor('#e9edf2');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9edf2');
  scene.fog = new THREE.Fog('#e9edf2', 30, 65);
  const camera = new THREE.PerspectiveCamera(44, 1.2, 0.05, 120);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8c97a8', 2.5));
  const light = new THREE.DirectionalLight('#fff5e3', 3.2);
  light.position.set(-4, 13, 9); scene.add(light);
  const fill = new THREE.DirectionalLight('#dce6ff', 1.5);
  fill.position.set(8, 5, -3); scene.add(fill);

  const ownGeometry = geometry => { geometries.add(geometry); return geometry; };
  const ownMaterial = material => { materials.add(material); return material; };
  const ownTexture = texture => { textures.add(texture); return texture; };
  const unitBox = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const unitPlane = ownGeometry(new THREE.PlaneGeometry(1, 1));
  const standard = colour => ownMaterial(new THREE.MeshStandardMaterial({color:colour, roughness:0.86}));
  const basic = colour => ownMaterial(new THREE.MeshBasicMaterial({color:colour, toneMapped:false}));
  const wood = standard('#d8c7a5'), edge = standard('#bca783'), backing = standard('#ede6d9');
  const purple = basic('#6550b4'), yellow = basic('#f4c35c');
  function box(width, height, depth, x, y, z, material, parent = scene) {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.scale.set(width, height, depth); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function plane(width, height, x, y, z, material, parent = scene) {
    const mesh = new THREE.Mesh(unitPlane, material);
    mesh.scale.set(width, height, 1); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function canvasMaterial(width, height, draw) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas text is unavailable.');
    draw(context, width, height);
    const texture = ownTexture(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    return ownMaterial(new THREE.MeshBasicMaterial({map:texture, transparent:true, depthWrite:false, toneMapped:false}));
  }
  function textMaterial(text, colour = '#4d4a43', background = null) {
    return canvasMaterial(512, 80, (context, width, height) => {
      if (background) { context.fillStyle = background; context.fillRect(0, 0, width, height); }
      context.font = '600 43px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = colour;
      context.fillText(text, width / 2, height / 2, width - 20);
    });
  }

  const floor = plane(65, 65, 0, -0.035, 0, standard('#e3e8ef'));
  floor.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(40, 40, '#ced5de', '#d9e0e8');
  grid.position.y = -0.023; scene.add(grid);
  geometries.add(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(material => materials.add(material));
  const shadow = canvasMaterial(256, 256, (context, width, height) => {
    const gradient = context.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
    gradient.addColorStop(0, '#26334c32'); gradient.addColorStop(1, '#26334c00');
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  });
  const cabinetWidth = cabinet.columns * model.CELL_WIDTH, cabinetHeight = cabinet.rows * model.CELL_HEIGHT;
  const cabinetShadow = plane(cabinetWidth + 3, 4, 0, -0.015, 0.7, shadow); cabinetShadow.rotation.x = -Math.PI / 2;

  box(cabinetWidth + 0.18, cabinetHeight + 0.16, 0.12, 0, model.BASE_HEIGHT + cabinetHeight/2, -0.37, backing);
  box(cabinetWidth + 0.28, model.BASE_HEIGHT, 0.96, 0, model.BASE_HEIGHT/2, 0.02, edge);
  for (let column = 0; column <= cabinet.columns; column++) {
    box(0.075, cabinetHeight + 0.12, 0.85, -cabinetWidth/2 + column * model.CELL_WIDTH,
      model.BASE_HEIGHT + cabinetHeight/2, 0.04, column === 0 || column === cabinet.columns ? edge : wood);
  }
  for (let row = 0; row <= cabinet.rows; row++) {
    box(cabinetWidth + 0.16, row === cabinet.rows ? 0.14 : 0.075, 0.9, 0,
      model.BASE_HEIGHT + row * model.CELL_HEIGHT, 0.04, wood);
  }
  plane(2.5, 0.39, 0, model.BASE_HEIGHT + cabinetHeight + 0.46, 0.48, textMaterial(cabinet.label.toUpperCase()));
  for (let column = 1; column <= cabinet.columns; column++) {
    const point = model.cellPosition(cabinet, {row:1, column});
    plane(0.22, 0.14, point[0], model.BASE_HEIGHT + cabinetHeight + 0.15, 0.52, textMaterial(String(column), '#6d6557'));
  }
  for (let row = 1; row <= cabinet.rows; row++) {
    const point = model.cellPosition(cabinet, {row, column:1});
    plane(0.25, 0.16, -cabinetWidth/2 - 0.25, point[1], 0.52, textMaterial(String(row), '#6d6557'));
  }

  const pictureMaterials = new Map();
  const loader = new THREE.TextureLoader();
  function pictureMaterial(piece) {
    if (pictureMaterials.has(piece.imageDataUrl)) return pictureMaterials.get(piece.imageDataUrl);
    const material = ownMaterial(new THREE.MeshBasicMaterial({color:'#ffffff', toneMapped:false}));
    const texture = ownTexture(loader.load(piece.imageDataUrl, () => {
      if (!disposed) invalidate();
    }, undefined, () => {
      if (!disposed) { material.map = null; material.needsUpdate = true; invalidate(); }
    }));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    material.map = texture;
    pictureMaterials.set(piece.imageDataUrl, material); return material;
  }
  const pickTargets = [], pickMaterial = basic('#ffffff');
  for (const piece of pieces) {
    const point = model.cellPosition(cabinet, layout.pieceLocations[piece.id]);
    const hit = plane(model.CELL_WIDTH-0.08,model.CELL_HEIGHT-0.08,point[0],point[1],0.56,pickMaterial);
    hit.visible = false; hit.userData.pieceId = piece.id; pickTargets.push(hit);
    const ratio = (piece.imageWidth || 80) / (piece.imageHeight || 60);
    plane(0.68 * Math.min(1, ratio), 0.68 / Math.max(1, ratio), point[0], point[1] + 0.035, 0.19, pictureMaterial(piece));
    const label = canvasMaterial(256, 48, context => {
      context.fillStyle = CLASS_COLOURS[piece.classCode[0]]; context.fillRect(0, 4, 39, 40);
      context.font = '700 29px Arial, sans-serif'; context.textBaseline = 'middle'; context.textAlign = 'center';
      context.fillStyle = '#ffffff'; context.fillText(piece.classCode[0], 20, 25);
      context.fillStyle = '#514c43'; context.font = '600 27px Arial, sans-serif'; context.fillText(piece.id, 143, 25);
    });
    plane(0.83, 0.155, point[0], point[1] - 0.34, 0.5, label);
  }

  // Fixed starting station; no position sensing is involved.
  const kioskPurple = standard('#7b68b6');
  box(0.9, 1.13, 0.66, 3, 0.565, 7, kioskPurple);
  box(1.14, 0.19, 0.92, 3, 1.2, 7, standard('#f0c259'));
  box(1.04, 0.12, 0.8, 3, 0.06, 7, edge);
  plane(0.72, 0.35, 3, 0.87, 7.337, textMaterial('START HERE', '#ffffff', '#514575'));
  const studGeometry = ownGeometry(new THREE.CylinderGeometry(0.095, 0.095, 0.075, 16));
  for (const x of [2.72, 3.28]) for (const z of [6.79, 7.21]) {
    const stud = new THREE.Mesh(studGeometry, yellow); stud.position.set(x, 1.33, z); scene.add(stud);
  }
  const stationLabel = plane(3.2, 0.4, 3, 1.95, 7, textMaterial('YOU ARE HERE', '#6550b4'));
  stationLabel.rotation.y = 0.55;
  const stationShadow = plane(3.2, 3.1, 3, -0.01, 7, shadow); stationShadow.rotation.x = -Math.PI / 2;

  const highlight = new THREE.Group(); scene.add(highlight); highlight.visible = false;
  const hw = model.CELL_WIDTH - 0.025, hh = model.CELL_HEIGHT - 0.025;
  box(hw, 0.055, 0.055, 0, -hh/2, 0, purple, highlight);
  box(hw, 0.055, 0.055, 0, hh/2, 0, purple, highlight);
  box(0.055, hh, 0.055, -hw/2, 0, 0, purple, highlight);
  box(0.055, hh, 0.055, hw/2, 0, 0, purple, highlight);
  const arrow = new THREE.Mesh(ownGeometry(new THREE.ConeGeometry(0.105, 0.2, 4)), yellow);
  arrow.rotation.z = Math.PI; arrow.position.set(0, hh/2 + 0.15, 0.075); highlight.add(arrow);
  const route = new THREE.Group(); scene.add(route);
  function pathSegment(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1, length = Math.hypot(dx, dz);
    if (length < 0.01) return;
    const mesh = box(0.055, 0.025, length, (x1+x2)/2, 0.008, (z1+z2)/2, purple, route);
    mesh.rotation.y = Math.atan2(dx, dz);
  }
  function setTarget(id) {
    highlight.visible = !!id; route.clear();
    if (!id) return;
    const point = model.cellPosition(cabinet, layout.pieceLocations[id]);
    highlight.position.set(point[0], point[1], 0.56);
    pathSegment(3, 6.4, 3, 2.6); pathSegment(3, 2.6, point[0], 2.6);
  }
  function contextLost(event) { event.preventDefault(); if (!disposed) onContextLoss(); }
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  detachContext = () => renderer.domElement.removeEventListener('webglcontextlost', contextLost);

  const initial = model.routePose(cabinet,null,0);
  camera.position.fromArray(initial.position); camera.lookAt(...initial.target);
  controls = new OrbitControls(camera,renderer.domElement);
  controls.target.fromArray(initial.target);
  controls.enableRotate = false; controls.enableDamping = false;
  controls.screenSpacePanning = true; controls.minDistance = 1.9; controls.maxDistance = 36;
  controls.mouseButtons = {LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
  controls.touches = {ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN};
  controls.keyPanSpeed = 25; controls.update();
  function applyPose(pose) {
    camera.position.fromArray(pose.position); controls.target.fromArray(pose.target);
    camera.lookAt(controls.target);
  }
  function changed() {
    applyPose(model.constrainPose(cabinet,{position:camera.position.toArray(),target:controls.target.toArray()}));
    invalidate();
  }
  function zoom(factor) {
    onManual(); camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
    changed(); controls.update();
  }
  function fit() {
    onManual(); const bounds = host.getBoundingClientRect();
    applyPose(model.fitCabinetPose(cabinet,bounds.width/Math.max(1,bounds.height)));
    changed(); controls.update();
  }
  const taps = createTapTracker(), raycaster = new THREE.Raycaster();
  function pointerDown(event) { taps.down(event); host.focus({preventScroll:true}); }
  function pointerMove(event) { taps.move(event); }
  function pointerCancel(event) { taps.cancel(event); }
  function pointerUp(event) {
    const tap = taps.up(event); if (!tap || disposed) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    if (tap.x<bounds.left || tap.x>bounds.right || tap.y<bounds.top || tap.y>bounds.bottom) return;
    camera.updateMatrixWorld(true); pickTargets.forEach(mesh => mesh.updateWorldMatrix(true,false));
    raycaster.setFromCamera(new THREE.Vector2((tap.x-bounds.left)/bounds.width*2-1,-(tap.y-bounds.top)/bounds.height*2+1),camera);
    const hit = raycaster.intersectObjects(pickTargets,false)[0];
    if (hit) onPick(hit.object.userData.pieceId);
  }
  function keyDown(event) {
    if (event.target !== host && event.target !== renderer.domElement) return;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) onManual();
    else if (['+','=','-','_','Home','0'].includes(event.key)) {
      event.preventDefault();
      if (event.key==='Home' || event.key==='0') fit();
      else zoom(event.key==='+' || event.key==='='?0.8:1.25);
    }
  }
  controls.addEventListener('start',onManual); controls.addEventListener('change',changed);
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown',pointerDown);
  canvas.addEventListener('pointermove',pointerMove);
  canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('pointercancel',pointerCancel);
  canvas.addEventListener('lostpointercapture',pointerCancel);
  host.addEventListener('keydown',keyDown); controls.listenToKeyEvents(host);
  detachInputs = () => {
    controls.removeEventListener('start',onManual); controls.removeEventListener('change',changed);
    canvas.removeEventListener('pointerdown',pointerDown); canvas.removeEventListener('pointermove',pointerMove);
    canvas.removeEventListener('pointerup',pointerUp); canvas.removeEventListener('pointercancel',pointerCancel);
    canvas.removeEventListener('lostpointercapture',pointerCancel); host.removeEventListener('keydown',keyDown); taps.clear();
  };
  return {
    setTarget, zoom, fit,
    draw(id, progress, driveCamera) {
      const bounds = host.getBoundingClientRect();
      if (!bounds.width || !bounds.height || disposed) return;
      if (renderer.domElement.width !== Math.round(bounds.width * renderer.getPixelRatio()) ||
          renderer.domElement.height !== Math.round(bounds.height * renderer.getPixelRatio())) {
        renderer.setSize(bounds.width, bounds.height, false);
      }
      camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix();
      if (driveCamera) {
        applyPose(model.routePose(cabinet,id?layout.pieceLocations[id]:null,progress,camera.aspect));
        controls.update();
      }
      renderer.render(scene, camera);
    },
    dispose:release
  };
  } catch (error) { release(); throw error; }
}

export function createNavigator({host, map, grid, layout, pieces, onChange, onPick = () => {}}) {
  model.validateLayout(layout, pieces);
  buildMap(grid, layout, pieces, onPick);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let id = '', phase = 'station', mode = '3d', canUse3d = true;
  let scene = null, frame = 0, elapsed = 0, lastTime = null, disposed = false, manualView = false;
  function notify() { onChange({id, phase, mode, canUse3d, address:model.address(layout, id)}); }
  function stopFrame() { if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = null; }
  function markMap() {
    grid.querySelectorAll('[data-piece-id]').forEach(cell => {
      const selected = cell.dataset.pieceId === id;
      cell.classList.toggle('map-selected',selected); cell.setAttribute('aria-pressed',String(selected));
    });
    grid.setAttribute('aria-label', layout.cabinets[0].label + ', ' + layout.cabinets[0].rows +
      ' rows and ' + layout.cabinets[0].columns + ' columns' + (id ? '. ' + id + ': ' + model.address(layout, id) : ''));
  }
  function useMap() {
    stopFrame(); mode = 'map'; host.hidden = true; map.hidden = false;
    if (id) { phase = 'arrived'; elapsed = DURATION; }
    markMap(); notify();
  }
  function failScene() {
    if (disposed) return;
    if (scene) { scene.dispose(); scene = null; }
    canUse3d = false; useMap();
  }
  function draw(time) {
    frame = 0;
    if (disposed || document.hidden || mode !== '3d' || !scene) { lastTime = null; return; }
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) { lastTime = null; return; }
    if (phase === 'moving') {
      if (lastTime !== null) elapsed = Math.min(DURATION, elapsed + Math.min(time - lastTime, 80));
      lastTime = time;
      if (elapsed >= DURATION) { phase = 'arrived'; lastTime = null; notify(); }
    }
    try { scene.draw(id, id ? elapsed / DURATION : 0, !manualView); }
    catch { failScene(); return; }
    if (phase === 'moving') invalidate();
  }
  function invalidate() {
    if (!disposed && !frame && !document.hidden && mode === '3d') frame = requestAnimationFrame(draw);
  }
  function ensureScene() {
    if (scene || !canUse3d) return;
    try { scene = createScene(host, layout, pieces, invalidate, failScene, beginManual, onPick); }
    catch {
      host.replaceChildren(); failScene();
    }
  }
  function setMapMode(value) {
    if (disposed) return;
    if (value) { useMap(); return; }
    if (!canUse3d) return;
    ensureScene();
    if (!canUse3d) return;
    mode = '3d'; host.hidden = false; map.hidden = true;
    scene.setTarget(id); elapsed = id ? DURATION : 0;
    phase = manualView?'exploring':id?'arrived':'station'; notify(); invalidate();
  }
  function beginManual() {
    if (disposed || mode!=='3d') return;
    if (!manualView || phase!=='exploring') {
      stopFrame(); manualView = true; phase = 'exploring'; notify();
    }
    invalidate();
  }
  function select(nextId, {preserveView = false} = {}) {
    if (disposed || !Object.prototype.hasOwnProperty.call(layout.pieceLocations,nextId)) return;
    stopFrame(); id = nextId; elapsed = 0; manualView = preserveView;
    phase = !preserveView && mode === '3d' && !reduceMotion.matches ? 'moving' : 'arrived';
    if (phase === 'arrived') elapsed = DURATION;
    if (scene) scene.setTarget(id);
    markMap(); notify(); invalidate();
  }
  function reset() {
    if (disposed) return;
    stopFrame(); id = ''; phase = 'station'; elapsed = 0; manualView = false;
    if (scene) scene.setTarget('');
    markMap(); notify(); invalidate();
  }
  function motionChanged() {
    if (reduceMotion.matches && phase === 'moving') {
      stopFrame(); elapsed = DURATION; phase = 'arrived'; notify(); invalidate();
    }
  }
  function visibilityChanged() { if (document.hidden) stopFrame(); else invalidate(); }
  reduceMotion.addEventListener('change', motionChanged);
  document.addEventListener('visibilitychange', visibilityChanged);
  const observer = new ResizeObserver(invalidate); observer.observe(host);
  ensureScene();
  if (canUse3d) { notify(); invalidate(); }
  return {
    select, reset, setMapMode,
    zoomIn() { if (scene && mode==='3d') scene.zoom(0.8); },
    zoomOut() { if (scene && mode==='3d') scene.zoom(1.25); },
    fitCabinet() { if (scene && mode==='3d') scene.fit(); },
    dispose() {
      disposed = true; stopFrame(); observer.disconnect();
      reduceMotion.removeEventListener('change', motionChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
      if (scene) scene.dispose();
    }
  };
}

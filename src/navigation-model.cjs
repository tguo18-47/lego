'use strict';

// Storage addresses are independent of taxonomy and of the current result order.
function validateLayout(layout, pieces) {
  if (!layout || layout.cabinets?.length !== 1) throw new Error('This scene needs one cabinet.');
  const cabinet = layout.cabinets[0];
  if (!cabinet.id || !cabinet.label || !layout.station?.label ||
      !Number.isInteger(cabinet.rows) || cabinet.rows < 1 ||
      !Number.isInteger(cabinet.columns) || cabinet.columns < 1) {
    throw new Error('Invalid cabinet or station.');
  }
  const ids = new Set(pieces.map(piece => piece.id));
  if (ids.size !== pieces.length) throw new Error('Duplicate TG records.');
  const locations = layout.pieceLocations;
  if (!locations || Object.keys(locations).length !== ids.size) throw new Error('Incomplete location coverage.');
  const occupied = new Set();
  for (const [id, location] of Object.entries(locations)) {
    if (!ids.has(id)) throw new Error('Unknown TG number: ' + id);
    if (location.cabinetId !== cabinet.id || !Number.isInteger(location.row) ||
        !Number.isInteger(location.column) || location.row < 1 || location.row > cabinet.rows ||
        location.column < 1 || location.column > cabinet.columns) {
      throw new Error('Out-of-bounds location: ' + id);
    }
    const cell = location.cabinetId + ':' + location.row + ':' + location.column;
    if (occupied.has(cell)) throw new Error('Duplicate cabinet cell: ' + cell);
    occupied.add(cell);
  }
  return cabinet;
}

function address(layout, id) {
  const location = layout.pieceLocations[id];
  if (!location) return '';
  const cabinet = layout.cabinets.find(item => item.id === location.cabinetId);
  return cabinet ? cabinet.label + ' · Row ' + location.row + ' · Column ' + location.column : '';
}

const CELL_WIDTH = 1.05, CELL_HEIGHT = 0.9, BASE_HEIGHT = 0.35;
function cellPosition(cabinet, location) {
  return [(location.column - (cabinet.columns + 1) / 2) * CELL_WIDTH,
    BASE_HEIGHT + (cabinet.rows - location.row + 0.5) * CELL_HEIGHT, 0.5];
}

function smooth(t) { return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a.map((value, i) => value + (b[i] - value) * t); }

// Every camera position stays in front of the cabinet (positive Z).
function routePose(cabinet, location, progress, aspect = 1.2) {
  const fit = Math.max(1, 1.05 / Math.max(0.3, aspect));
  const height = BASE_HEIGHT + cabinet.rows * CELL_HEIGHT;
  const station = {position: [9 * fit, 7.7 * fit, 15 * fit], target: [0.3, height * 0.42, 2.6]};
  if (!location) return station;
  const point = cellPosition(cabinet, location);
  const approach = {position: [0, height * 0.64, 11.7 * fit], target: [0, height * 0.5, 0.3]};
  const end = {position: [point[0] + 0.24, point[1] + 0.18, 4.1 * fit], target: point};
  const p = Math.min(1, Math.max(0, progress));
  if (p === 0) return station;
  if (p === 1) return end;
  const first = p < 0.6;
  const from = first ? station : approach, to = first ? approach : end;
  const t = smooth(first ? p / 0.6 : (p - 0.6) / 0.4);
  return {position: mix(from.position, to.position, t), target: mix(from.target, to.target, t)};
}

function fitCabinetPose(cabinet, aspect = 1.2) {
  const height = BASE_HEIGHT + cabinet.rows * CELL_HEIGHT;
  const tangent = Math.tan(22 * Math.PI / 180);
  const distance = Math.max((height+0.9) / (2*tangent), (cabinet.columns * CELL_WIDTH+0.8) / (2*tangent*Math.max(0.3,aspect))) * 1.14;
  return {position:[0.24,height/2+0.47,0.5+distance],target:[0,height/2+0.25,0.5]};
}

function constrainPose(cabinet, pose) {
  const width = cabinet.columns * CELL_WIDTH, height = BASE_HEIGHT + cabinet.rows * CELL_HEIGHT;
  const target = [Math.max(-width/2-0.4,Math.min(width/2+0.4,pose.target[0])),
    Math.max(0.55,Math.min(height+0.3,pose.target[1])),Math.max(0.3,Math.min(2.6,pose.target[2]))];
  const offset = pose.position.map((value,i) => value-pose.target[i]);
  // Keep a front-facing direction and a camera above the floor, including at zoom limits.
  offset[1]=Math.max(0.05,offset[1]); offset[2]=Math.max(0.5,offset[2]);
  offset[0]=Math.max(-1.3*offset[2],Math.min(1.3*offset[2],offset[0]));
  offset[1]=Math.min(offset[1],Math.hypot(offset[0],offset[2])*1.2);
  const length = Math.hypot(...offset), distance = Math.max(1.9,Math.min(36,length));
  return {target,position:target.map((value,i)=>value+offset[i]/length*distance)};
}

module.exports = {validateLayout, address, cellPosition, routePose, fitCabinetPose, constrainPose, CELL_WIDTH, CELL_HEIGHT, BASE_HEIGHT};

'use strict';

// A multi-touch gesture, a drag that returns to its start, and cancellation
// must never become a cabinet pick on the final pointer-up.
function createTapTracker(threshold = 6) {
  const pointers = new Map();
  let suppressed = false;
  return {
    down(event) {
      if (!pointers.size) suppressed = false;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,button:event.button});
      if (pointers.size > 1) suppressed = true;
    },
    move(event) {
      const start = pointers.get(event.pointerId);
      if (start && Math.hypot(event.clientX-start.x,event.clientY-start.y) > threshold) suppressed = true;
    },
    up(event) {
      this.move(event);
      const start = pointers.get(event.pointerId);
      const tap = start && pointers.size === 1 && !suppressed && start.button === 0;
      pointers.delete(event.pointerId);
      return tap ? {x:event.clientX,y:event.clientY} : null;
    },
    cancel(event) { pointers.delete(event.pointerId); suppressed = true; },
    clear() { pointers.clear(); suppressed = false; }
  };
}
module.exports = {createTapTracker};

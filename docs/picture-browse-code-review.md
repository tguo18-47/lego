# Picture browsing and cabinet controls — code review

Date: 2026-11-15. Result: PASS. Includes the user’s PC-only amendment.

Reviewed in flow against the user's accepted
[design](superpowers/specs/2026-11-15-picture-browse-design.md), using source
inspection, model tests, generated-artifact checks and browser verification.
No commit, push or deployment was performed.

## Architecture and data

The query engine and source collection are unchanged. A separate category
presentation model supplies labels, example pictures and the current branch;
original category nodes, paths, scope and exact detail/cross-reference links
remain available. Cabinet picks emit an ID to the application, the single owner
of search and selection state. Only a cabinet pick outside the current result
clears conditions; ordinary queries retain strict AND semantics.

## Input and lifecycle

Every cubby has an ID-linked whole-cell raycast target; 2D cells are native
buttons with labels and pressed state. Gesture tracking suppresses picks after
drags, multiple pointers and cancellation, including a drag returning to its
start. OrbitControls is bundled from the pinned Three.js package, with rotation
disabled, panning/zooming enabled and bounded front-facing camera poses.

Manual input interrupts route animation while preserving selection. Repeated
wheel events share pending renders rather than repeatedly canceling frames or
rewriting all selected-card attributes. Normal input renders only on demand.
Controls, document/key listeners, pointer listeners, textures, geometry and the
renderer are disposed on failure or teardown. Public selection rejects unknown
location keys.

## Accessibility and offline behavior

Large category buttons and independent information buttons preserve access to
zero-count descriptions. Breadcrumbs, selected filters and All categories remain
available for recovery. The interactive scene has keyboard instructions; zoom
and fit have labelled buttons. Both PC panes stay visible and cabinet picks reveal their result immediately.
Mobile tabs and responsive mobile rules have been removed; the page retains a
1160px minimum width in narrow windows. Reduced motion and a clickable 2D fallback remain functional.

All new scripts, controls, pictures and styles are embedded into index.html.
Artifact checks confirm six classic scripts, data images, no external resource
dependencies or runtime fetch calls, and the original restrictive CSP. Text
uses DOM textContent and embedded JSON escapes `<`.

## Verification

- 52 existing acceptance assertions; 279 two-facet combinations.
- 56 location mappings; 22,624 camera-route samples.
- 39 category nodes; 375 constrained views; four cabinet-framing aspect ratios.
- Mouse click, native drag and wheel zoom; keyboard navigation/zoom/fit.
- Progressive categories, size handoff, breadcrumbs, zero-count information and
  the B-to-D2.3 cross reference.
- 3D and 2D reverse selection, filtered-out targets, matching-target preservation,
  distinct TG002/TG053 cells, PC two-pane layout and immediate card reveal.
- No WebGL, broken pictures, reduced motion and actual WebGL context loss.
- Single-finger drag and pinch through a local synthetic PointerEvent fixture;
  no physical touch-screen device was used.

The addresses remain demonstration data. Browser checks use the final artifact
over loopback because direct file URL automation is unavailable; static checks
also verify the single-file offline packaging.

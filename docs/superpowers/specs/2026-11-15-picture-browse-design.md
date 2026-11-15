# Picture categories and bidirectional cabinet interaction

Status: accepted in the user's implementation request, 2026-11-15.
Amended by the user on the same date: PC only; remove the mobile layout and tabs.

Move the Cabinet map / 3D view switch into the upper left of the scene. Remove
the former toolbar and its station status, and hide the initial location badge.
Keep destination labels, highlighting and the physical navigation station.

Replace the category select and main category-tree entry with large picture
cards, three per row. Initially show the five
main groups. Selecting a group filters immediately and shows its direct children;
terminal shapes remain selectable alongside their siblings. Breadcrumbs and All
categories go back to broader selections. Where children only divide by size,
use the independent Size control. Preserve all original classification nodes,
scopes, counts, cross references and exact links from piece details.

Results still start a station-to-cubby route. Every 3D cubby and 2D map cell is
also selectable. Cabinet selection preserves the camera. If the target is not
in the current result, clear all four search conditions and show all 56 records,
then reveal the selected card. Otherwise preserve the conditions. Both panes remain visible; cabinet picks reveal the selected result immediately.

Use wheel zoom and mouse drag panning. Add zoom and fit-cabinet buttons and keyboard controls. Manual input
interrupts flight without clearing selection. Distinguish taps from drags and
multi-touch, constrain the camera to the cabinet front, render on demand and
dispose listeners/controls. Fit cabinet keeps selection; Back to station clears
it. Replay always starts at the station. Only the 3D surface consumes gestures.

Keep a PC-only two-pane layout with a minimum width of 1160px and no
Search/Navigation tabs. Narrow windows can scroll horizontally. Keep English, the same 56 records and demo addresses, original query semantics,
and a fully embedded offline index.html. Validate progressive category browsing,
facet counts, precise detail links, 3D/2D picks, filtered-out selections, repeated
appearance IDs, interruption, gestures, bounds, keyboard and fallback.
Run search/navigation regression tests, review code and update local docs/output.

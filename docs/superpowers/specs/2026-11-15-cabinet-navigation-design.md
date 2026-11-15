# LEGO venue navigation

Status: accepted by the user's implementation request on 2026-11-15.

## Experience

Keep the existing English offline search and add a sticky 3D navigation pane on
the right. Below 1100px use Search / Navigation tabs, preserving search scroll
when navigating back. The search box remains the first item in the search pane.
The scene shows a fixed LEGO Navigation Station, a floor, and one 7-row, 8-column
cabinet. Use existing clear piece pictures inside the 3D cubbies, rather than
inventing 3D part models. Label this as Demo layout.

## Storage addresses

Store all 56 addresses explicitly in src/locations.json, keyed by TG ID.
Initial assignment groups records by top-level class A–E, sorts by TG ID inside
each group, then fills rows left-to-right and top-to-bottom. Counts are
A19/B10/C8/D11/E8. Each record has one distinct cell, including repeated shapes.
TG002 is row 1 column 1, TG053 row 3 column 2, TG048 row 6 column 7.
Classification and physical address remain separate data. Search or sort must
never recompute addresses. Real addresses can replace the demo configuration.

## Interaction

Clicking a result selects it and starts a roughly three-second camera journey
from the station, via the front of the cabinet, to the target cubby. Highlight
the target with a persistent border and arrow and show its full text address.
The last click wins: cancel any earlier journey immediately. Replay starts
again from the station. Back to station clears selection but preserves query.
Clear all resets both query and navigation. If a filter removes the selected
record, return to the station; otherwise preserve the current navigation.
View details opens the existing dialog. Closing it preserves navigation state.

## Implementation constraints

Preserve vanilla HTML/CSS/JavaScript and the existing search engine interface.
Bundle Three.js 0.187.0 and the navigation module as an inline classic script,
with pinned dependencies and a lockfile. All pictures, styles and navigation
data remain embedded in index.html. No runtime network requests, GPS, voice,
publishing or Git setup. Missing original metadata stays blank.

Use a pure validated location/route model separate from DOM and rendering.
Share picture textures, cap pixel ratio, render on demand and pause animation
while hidden. Reclaim renderer resources and listeners on teardown. Fall back
to a 2D cabinet map on WebGL failure. Reduced-motion preference skips flight.
Provide keyboard controls, selection state and live destination text.

## Acceptance

Validate coverage, unique cells, bounds and all class boundaries. Exercise
distinct TG002/TG053 addresses and Orange+C destinations, interruption, replay,
reset, filtering, details, tabs, resize, reduced motion and 2D fallback. Run the
existing search regression suite and inspect the generated offline artifact.
Complete code review, update README and deliver the same local index.html.

# Navigation code review — 2026-11-15

Result: PASS. In-flow source review against the user's accepted
[navigation design](superpowers/specs/2026-11-15-cabinet-navigation-design.md),
supported by unit tests and browser checks. No commit or deployment was made.

## Reviewed areas

- Architecture: physical addresses are explicit, validated TG mappings, separate
  from the untouched search engine and from result ordering. UI, pure route
  calculations, scene rendering and build logic have distinct responsibilities.
- Correctness: every record has a unique cell. Last selection cancels the old
  journey; filtering out the selection resets navigation; preserving it does
  not replay. Clear all resets both systems. Duplicate appearances stay separate.
- Security and offline packaging: metadata and queries use textContent; embedded
  JSON escapes `<`; dependencies are pinned; the generated artifact uses classic
  inline scripts, data images, system fonts, retained license text, and a CSP
  that blocks network connections. Artifact checks reject external dependencies.
- Performance and lifecycle: pictures share cached textures; cabinet meshes share
  geometry; pixel ratio is capped at 2. Rendering stops at rest and pauses while
  hidden. Context failure and teardown dispose GPU resources and listeners.
- Accessibility: native buttons, keyboard activation, selected states, status text,
  reduced-motion handling, modal return behavior and mobile tab controls checked.
- Documentation: README covers opening, development dependencies, addresses,
  rebuilding, compatibility and the demo nature of the scene.

## Resolved during review and verification

- Stretched the navigation grid item so its child can remain sticky during search
  scrolling; verified its top offset remains 24px on desktop.
- Corrected 2D map tracks so images retain visible height in short panes, and
  derive row tracks and cabinet labels from configuration.
- Made the keyboard skip link reveal the Search tab before targeting results.
- Added cleanup for partial scene initialization and for context loss, plus
  suspension of camera progression while its pane is hidden.

## Validation

- Existing search suite: 52 acceptance assertions and 279 two-facet combinations.
- Navigation model: 56 addresses, group boundaries, negative configuration cases
  and 22,624 continuous camera-route samples.
- Browser: desktop, 1100/1099 breakpoint, 390px mobile, repeated-shape identities,
  rapid selection, replay, station return, details, selection-preserving and
  selection-removing filters, reset, keyboard and scroll restoration.
- Local failure fixtures: no WebGL, reduced motion, broken picture and real
  WebGL context loss all retained usable search, addresses and details.
- After stopping the preview server, the already loaded final artifact continued
  to filter, navigate to TG053 and open its details without network access.

Direct browser navigation to file URLs was unavailable in the automation surface;
browser checks used the same final HTML over loopback. No system network settings
were changed. Addresses are demonstration data, not verified venue measurements.

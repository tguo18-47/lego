#!/usr/bin/env python3
"""Select visually reviewed native catalogue images without changing metadata."""
from pathlib import Path
from collections import Counter
import json

BASE = Path(__file__).resolve().parent
groups = json.loads((BASE / 'catalogue-candidates.json').read_text())
pieces = json.loads((BASE.parent / 'collection.json').read_text())['pieces']
replacements = {}
selected = []

for group in groups:
    candidates = group['candidates']
    if not candidates:
        raise ValueError('No image for ' + group['representative'])
    # LDraw's transparent slope is visibly white/grey rather than glass-like.
    # The exact official transparent element avoids misrepresenting this property.
    if group['representative'] == 'TG003':
        candidate = next(c for c in candidates if c['provider'] == 'lego')
    else:
        candidate = candidates[0]
    notes = candidate['matchNotes']
    if group['representative'] == 'TG003':
        notes += ' Official 192px image chosen over larger LDraw render because it preserves visibly transparent glass-like appearance.'
    if group['representative'] == 'TG027':
        notes += ' Native 250px render verified visually: transparent yellow, four top studs and round 2x2 geometry.'
    if group['representative'] in ['TG005', 'TG019', 'TG042', 'TG052'] and candidate['provider'] == 'rebrickable':
        notes += ' Catalogue camera shows the same mould from a different face/orientation than the original handout; no geometric or metadata alteration.'
    for identifier in group['ids']:
        replacements[identifier] = {
            'imageDataUrl': candidate['imageDataUrl'],
            'imageWidth': candidate['imageWidth'],
            'imageHeight': candidate['imageHeight'],
            'sourceUrl': candidate['sourceUrl'],
            'elementId': candidate['elementId'],
            'partId': candidate['partId'],
            'ldrawColour': candidate['ldrawColour'],
            'matchNotes': notes,
        }
    selected.append({
        'representative': group['representative'],
        'ids': group['ids'],
        'sourceUrl': candidate['sourceUrl'],
        'path': candidate['path'],
        'provider': candidate['provider'],
        'pixels': [candidate['imageWidth'], candidate['imageHeight']],
        'elementId': candidate['elementId'],
        'partId': candidate['partId'],
        'ldrawColour': candidate['ldrawColour'],
        'confidence': 'high: catalogue design/colour plus visual side-by-side comparison',
        'matchNotes': notes,
    })

assert set(replacements) == {p['id'] for p in pieces}
assert len(replacements) == 56 and len(selected) == 35
assert all(min(r['imageWidth'], r['imageHeight']) >= 192 for r in replacements.values())
(BASE / 'replacements.json').write_text(json.dumps(dict(sorted(replacements.items())), ensure_ascii=False, separators=(',', ':')))
audit = {
    'coveredTgIds': sorted(replacements),
    'coveredTgCount': len(replacements),
    'coveredAppearances': len(selected),
    'unmatchedTgIds': [],
    'resolutionByTgCount': dict(Counter(str(r['imageWidth']) + 'x' + str(r['imageHeight']) for r in replacements.values())),
    'resolutionByAppearanceCount': dict(Counter(str(r['pixels'][0]) + 'x' + str(r['pixels'][1]) for r in selected)),
    'upscalingPerformed': False,
    'aiRedrawingPerformed': False,
    'metadataModified': False,
    'mappingEvidence': [
        'The original handout PDF was audited: all 35 source rasters are 80x60, and its decoded RGB pixels exactly match all 56 current TG assets.',
        'Catalogue design numbers and element IDs were identified using the supplied set catalogue, its historical inventory and the current Brickset LEGO Customer Services inventory.',
        'All 35 higher-resolution appearances were reviewed side by side against the original thumbnails.',
        'Rebrickable native LDraw renders preferred where the mould and palette match; official LEGO images retained for eye print, female face, blue/white/yellow torso, legacy pin connections, transparent clear slope and flower mould.',
    ],
    'referenceUrls': [
        'https://www.bricklink.com/catalogItemInv.asp?S=2000409-2&viewCodes=Y',
        'https://brickset.com/inventories/2000409-1',
        'https://seriousplaypro.com/bricks/web/',
    ],
    'selectedAppearances': selected,
}
(BASE / 'replacement-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in audit.items() if k != 'selectedAppearances'}, ensure_ascii=False))

#!/usr/bin/env python3
"""Audit the provided PDF without claiming that its 80x60 rasters are HD.

Extract embedded image files unchanged, match them to existing TG assets by
decoded RGB pixels, and record source drawing positions and resolution.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
import pdfplumber


BASE = Path(__file__).resolve().parent
PROJECT = BASE.parent
SOURCE = PROJECT.parent / 'sources' / 'LEGO_CutOutAndKeep (1).pdf'


def pixel_hash(image):
    rgb = image.convert('RGB')
    return hashlib.sha256(str(rgb.size).encode() + b'\0' + rgb.tobytes()).hexdigest()


def main():
    originals = BASE / 'source-images'
    originals.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(SOURCE)
    assert len(reader.pages) == 1
    vectors = []
    placement_map = {}
    with pdfplumber.open(SOURCE) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            vectors.append({'page': number, 'curves': len(page.curves), 'rectangles': len(page.rects), 'lines': len(page.lines), 'imageDrawings': len(page.images)})
            for item in page.images:
                placement_map.setdefault(item['name'], []).append({
                    'page': number,
                    'boxPointsTopOrigin': [item['x0'], item['top'], item['x1'], item['bottom']],
                    'intrinsicPixels': list(item['srcsize']),
                    'effectiveDpi': [round(item['srcsize'][0] / item['width'] * 72, 1), round(item['srcsize'][1] / item['height'] * 72, 1)],
                })
        # A context preview only. This rasterization does not increase detail.
        pdf.pages[0].to_image(resolution=100).original.save(BASE / 'page-context.png')

    images = []
    by_hash = {}
    for page_number, page in enumerate(reader.pages, 1):
        for embedded in page.images:
            name = embedded.name
            path = originals / name
            path.write_bytes(embedded.data)
            image = embedded.image
            record = {
                'pdfImageName': Path(name).stem,
                'page': page_number,
                'path': str(path),
                'pixels': list(image.size),
                'format': image.format,
                'mode': image.mode,
                'bytes': len(embedded.data),
                'decodedRgbSha256': pixel_hash(image),
                'placements': placement_map.get(Path(name).stem, []),
            }
            images.append(record)
            by_hash.setdefault(record['decodedRgbSha256'], []).append(record)

    collection = json.loads((PROJECT / 'collection.json').read_text())
    pieces = []
    unmatched = []
    for piece in collection['pieces']:
        old_path = PROJECT / 'assets' / (piece['id'] + '.png')
        with Image.open(old_path) as image:
            old_size = list(image.size)
            old_hash = pixel_hash(image)
        matches = by_hash.get(old_hash, [])
        if not matches:
            unmatched.append(piece['id'])
        pieces.append({
            'id': piece['id'],
            'name': piece['name'],
            'existingAsset': str(old_path),
            'existingPixels': old_size,
            'exactDecodedPixelMatch': bool(matches),
            'confidence': 'exact' if matches else 'unmatched',
            'matchingPdfImages': [r['pdfImageName'] for r in matches],
            'matchingSourcePaths': [r['path'] for r in matches],
            'higherResolutionReplacementAvailable': False,
        })

    dimensions = sorted({tuple(r['pixels']) for r in images})
    report = {
        'sourcePdf': str(SOURCE),
        'pages': len(reader.pages),
        'uniqueEmbeddedImages': len(images),
        'sourcePixelDimensions': dimensions,
        'vectorDrawingCounts': vectors,
        'matchedTgCount': sum(p['exactDecodedPixelMatch'] for p in pieces),
        'unmatchedTgIds': unmatched,
        'uniqueMatchedAppearances': len({r['decodedRgbSha256'] for r in images}),
        'highResolutionAssetsAvailable': False,
        'upscalingPerformed': False,
        'sourceFilesExtractedUnchanged': True,
        'recommendation': 'Do not replace the current assets on a claim of improved resolution. All 35 source images are 80x60 rasters, and all 56 current TG thumbnails exactly match their decoded RGB pixels. Obtain a genuinely larger source image or vector resource instead.',
        'images': sorted(images, key=lambda r: int(r['pdfImageName'][2:])),
        'pieces': pieces,
    }
    (BASE / 'pdf-resolution-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (BASE / 'tg-source-mapping.json').write_text(json.dumps(pieces, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k not in ['images', 'pieces']}, ensure_ascii=False))
    assert len(images) == 35 and len(pieces) == 56 and not unmatched
    assert dimensions == [(80, 60)]
    assert all(v['curves'] == v['rectangles'] == v['lines'] == 0 for v in vectors)


if __name__ == '__main__':
    main()

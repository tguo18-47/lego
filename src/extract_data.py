#!/usr/bin/env python3
"""Read the two source workbooks and extract their records and anchored images.

Only Python's standard library is used. The source XLSX files are never edited.
"""

from __future__ import annotations

import base64
from collections import Counter
import json
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile


BASE = Path(__file__).resolve().parent
SOURCE_PIECES = BASE.parent / 'sources' / 'LEGO_Simple_Collection_EN.xlsx'
SOURCE_PROPOSAL = BASE.parent / 'sources' / 'LEGO_Organising_Proposal_EN.xlsx'
NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'd': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}
R_ID = '{' + NS['r'] + '}id'
R_EMBED = '{' + NS['r'] + '}embed'


def package_target(source_part: str, target: str) -> str:
    """Resolve OPC relationship targets relative to the source XML part."""
    if target.startswith('/'):
        return target.lstrip('/')
    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))
    if resolved.startswith('../'):
        raise ValueError(f'Relationship escapes package: {source_part} -> {target}')
    return resolved


def relationships(z: ZipFile, part: str) -> dict[str, dict[str, str]]:
    directory, basename = posixpath.split(part)
    rel_path = posixpath.join(directory, '_rels', basename + '.rels')
    if rel_path not in z.namelist():
        return {}
    return {
        item.attrib['Id']: dict(item.attrib)
        for item in ET.fromstring(z.read(rel_path))
    }


class WorkbookReader:
    def __init__(self, path: Path):
        self.path = path
        self.zip = ZipFile(path)
        self.strings = []
        if 'xl/sharedStrings.xml' in self.zip.namelist():
            self.strings = [
                ''.join(t.text or '' for t in item.findall('.//m:t', NS))
                for item in ET.fromstring(self.zip.read('xl/sharedStrings.xml'))
            ]
        rels = relationships(self.zip, 'xl/workbook.xml')
        workbook = ET.fromstring(self.zip.read('xl/workbook.xml'))
        self.sheets = {
            sheet.attrib['name']: package_target(
                'xl/workbook.xml', rels[sheet.attrib[R_ID]]['Target']
            )
            for sheet in workbook.find('m:sheets', NS)
        }

    def rows(self, sheet_name: str) -> list[tuple[int, dict[str, str]]]:
        root = ET.fromstring(self.zip.read(self.sheets[sheet_name]))
        result = []
        for row in root.findall('m:sheetData/m:row', NS):
            values = {}
            for cell in row:
                value = cell.find('m:v', NS)
                inline = cell.find('m:is', NS)
                text = value.text or '' if value is not None else ''
                if inline is not None:
                    text = ''.join(t.text or '' for t in inline.findall('.//m:t', NS))
                if cell.attrib.get('t') == 's' and text:
                    text = self.strings[int(text)]
                if text:
                    values[re.sub(r'\d+', '', cell.attrib['r'])] = text
            if values:
                result.append((int(row.attrib['r']), values))
        return result

    def anchored_images(self, sheet_name: str) -> dict[int, tuple[str, bytes]]:
        """Map image anchors in column B to their one-based worksheet row."""
        sheet_part = self.sheets[sheet_name]
        sheet_root = ET.fromstring(self.zip.read(sheet_part))
        sheet_rels = relationships(self.zip, sheet_part)
        output = {}
        for drawing in sheet_root.findall('m:drawing', NS):
            rel = sheet_rels[drawing.attrib[R_ID]]
            if rel.get('TargetMode') == 'External':
                raise ValueError('External drawings are not supported for offline output')
            drawing_part = package_target(sheet_part, rel['Target'])
            drawing_root = ET.fromstring(self.zip.read(drawing_part))
            drawing_rels = relationships(self.zip, drawing_part)
            for anchor in drawing_root:
                origin = anchor.find('d:from', NS)
                blip = anchor.find('.//a:blip', NS)
                if origin is None or blip is None:
                    continue
                row = int(origin.find('d:row', NS).text) + 1
                column = int(origin.find('d:col', NS).text) + 1
                if column != 2:
                    raise ValueError(f'Unexpected image column {column} at row {row}')
                image_rel = drawing_rels[blip.attrib[R_EMBED]]
                if image_rel.get('TargetMode') == 'External':
                    raise ValueError(f'External image at row {row}')
                image_part = package_target(drawing_part, image_rel['Target'])
                content = self.zip.read(image_part)
                if not content.startswith(b'\x89PNG\r\n\x1a\n'):
                    raise ValueError(f'Image at row {row} is not a PNG')
                if row in output:
                    raise ValueError(f'Multiple images anchored to row {row}')
                output[row] = (image_part, content)
        return output

    def close(self):
        self.zip.close()


def unique_id_rows(rows):
    output = {}
    for row_num, row in rows:
        identifier = row.get('A', '')
        if re.fullmatch(r'TG\d{3}', identifier):
            if identifier in output:
                raise ValueError(f'Duplicate ID {identifier}')
            output[identifier] = (row_num, row)
    return output


def parent_code(code: str):
    if '.' in code:
        return code.rsplit('.', 1)[0]
    return code[0] if len(code) > 1 else None


def main():
    BASE.mkdir(parents=True, exist_ok=True)
    asset_dir = BASE / 'assets'
    asset_dir.mkdir(exist_ok=True)
    pieces_book = WorkbookReader(SOURCE_PIECES)
    proposal_book = WorkbookReader(SOURCE_PROPOSAL)
    try:
        raw_pieces = unique_id_rows(pieces_book.rows('Pieces'))
        assignments = unique_id_rows(proposal_book.rows('Piece assignments'))
        if len(raw_pieces) != 56 or set(raw_pieces) != set(assignments):
            raise ValueError('Expected the same 56 unique TG identifiers in both workbooks')
        images = pieces_book.anchored_images('Pieces')
        if len(images) != 56:
            raise ValueError(f'Expected 56 anchored images, got {len(images)}')

        categories = []
        for row_num, row in proposal_book.rows('Classification'):
            code = row.get('A', '')
            if not re.fullmatch(r'[A-E](?:\d+(?:\.\d+)*)?', code):
                continue
            categories.append({
                'code': code,
                'name': row['B'].strip(),
                'scope': row.get('C', ''),
                'parentCode': parent_code(code),
            })
        category_codes = {c['code'] for c in categories}
        if len(category_codes) != len(categories):
            raise ValueError('Duplicate classification code')
        if any(c['parentCode'] and c['parentCode'] not in category_codes for c in categories):
            raise ValueError('A category has a missing parent')

        pieces = []
        image_audit = []
        for identifier, (row_num, row) in raw_pieces.items():
            _, assignment = assignments[identifier]
            for source_col, assignment_col, label in [('C', 'B', 'name'), ('D', 'C', 'colour'), ('E', 'D', 'size')]:
                if row.get(source_col, '') != assignment.get(assignment_col, ''):
                    raise ValueError(f'{identifier}: {label} differs between the workbooks')
            class_code = assignment['E'].split(' ', 1)[0]
            if class_code not in category_codes:
                raise ValueError(f'{identifier}: missing class {class_code}')
            if row_num not in images:
                raise ValueError(f'{identifier}: no image anchored on source row {row_num}')
            image_part, image_bytes = images[row_num]
            (asset_dir / f'{identifier}.png').write_bytes(image_bytes)
            stud_text = row.get('G', '')
            top_studs = int(stud_text) if stud_text else None
            piece = {
                'id': identifier,
                'name': row['C'],
                'colour': row.get('D', ''),
                'size': row.get('E') or None,
                'type': row.get('F', ''),
                'topStuds': top_studs,
                'keywords': [x.strip() for x in row.get('H', '').split(',') if x.strip()],
                'notes': row.get('I', ''),
                'imageDataUrl': 'data:image/png;base64,' + base64.b64encode(image_bytes).decode('ascii'),
                'classCode': class_code,
                'classificationNote': assignment.get('F', ''),
            }
            pieces.append(piece)
            image_audit.append({'id': identifier, 'worksheetRow': row_num, 'worksheetColumn': 'B', 'imagePart': image_part, 'bytes': len(image_bytes)})

        rows = proposal_book.rows('Thesaurus')
        terms = []
        for row_num, row in rows:
            if 8 <= row_num <= 37:
                terms.append({
                    'preferred': row['A'],
                    'alternatives': [s.strip() for s in re.split(r';|\n', row.get('B', '')) if s.strip()],
                    'relationships': row.get('C', ''),
                    'scope': row.get('D', ''),
                    'examples': row.get('E', ''),
                })
        use_entries = [
            {'alternative': row['A'], 'preferred': row['B'], 'scope': row.get('C', '')}
            for row_num, row in rows if 44 <= row_num <= 58
        ]
        if len(terms) != 30 or len(use_entries) != 15:
            raise ValueError('Expected 30 preferred terms and 15 USE relationships')
        terms_by_name = {t['preferred']: t for t in terms}
        for entry in use_entries:
            if entry['preferred'] not in terms_by_name:
                raise ValueError(f"Missing USE target {entry['preferred']}")
            if entry['alternative'] not in terms_by_name[entry['preferred']]['alternatives']:
                raise ValueError(f"USE/UF not mirrored for {entry['alternative']}")
        if sum(len(t['alternatives']) for t in terms) != 15:
            raise ValueError('UF alternative count does not match USE references')

        pieces.sort(key=lambda item: item['id'])
        counts = dict(sorted(Counter(p['classCode'][0] for p in pieces).items()))
        if counts != {'A': 19, 'B': 10, 'C': 8, 'D': 11, 'E': 8}:
            raise ValueError(f'Unexpected class counts {counts}')
        if sum(p['size'] is None for p in pieces) != 14:
            raise ValueError('Expected 14 records without a size')
        output = {
            'pieces': pieces,
            'categories': categories,
            'terms': terms,
            'useEntries': use_entries,
            'sources': [
                {'file': SOURCE_PIECES.name, 'sheets': ['Pieces'], 'role': 'Piece descriptions, keywords and anchored illustrations'},
                {'file': SOURCE_PROPOSAL.name, 'sheets': ['Classification', 'Piece assignments', 'Thesaurus'], 'role': 'Local classification, assignments and scoped vocabulary'},
            ],
        }
        (BASE / 'collection.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        audit = {
            'records': len(pieces),
            'uniqueIdentifiers': len({p['id'] for p in pieces}),
            'anchoredImages': len(images),
            'categoryNodes': len(categories),
            'mainClassCounts': counts,
            'preferredTerms': len(terms),
            'useRelationships': len(use_entries),
            'missingSize': sum(p['size'] is None for p in pieces),
            'zeroTopStudsIds': [p['id'] for p in pieces if p['topStuds'] == 0],
            'images': image_audit,
        }
        (BASE / 'extraction-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({k: v for k, v in audit.items() if k != 'images'}, ensure_ascii=False))
        print('Wrote', BASE / 'collection.json')
    finally:
        pieces_book.close()
        proposal_book.close()


if __name__ == '__main__':
    main()

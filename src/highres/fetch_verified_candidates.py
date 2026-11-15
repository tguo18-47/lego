#!/usr/bin/env python3
"""Fetch named catalogue renders at their native resolutions for visual review.

The mapping describes the existing records; it never changes metadata fields.
Rebrickable colour numbers are its LDraw palette identifiers. Sources that do
not return an image at the requested native resolution are rejected.
"""
from __future__ import annotations

import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import json
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageOps

BASE = Path(__file__).resolve().parent
DATA = json.loads((BASE.parent / 'collection.json').read_text())
PARTS = [
    # Representative TG, identical TGs, native render part, LDraw colour,
    # official element ID, exact identification notes.
    ('TG001',['TG001','TG006','TG011'],None,None,'6284599','White 1x1 round tile with a black pupil and white highlight; printed element, official image retained.'),
    ('TG002',['TG002','TG053'],'3010',5,'4206364','1x4 brick; local name Pink. Compare the catalogue Dark Pink hue to the supplied illustration before approving.'),
    ('TG003',['TG003'],'3039',47,'622740','45-degree 2x2 slope, Trans-Clear.'),
    ('TG004',['TG004','TG055'],'3004',27,'4164022','1x2 brick, Lime / Bright Yellowish Green.'),
    ('TG005',['TG005','TG056'],'4287b',72,'4211068','Inverted 33-degree 3x1 slope, Dark Bluish Gray; preserve inverted form.'),
    ('TG007',['TG007'],'6215',14,'621524','Curved 3x2 brick with four studs, Yellow; local C3 assignment remains unchanged.'),
    ('TG008',['TG008'],'3003',2,'300328','2x2 brick, Green.'),
    ('TG009',['TG009','TG014'],'3659',71,'4211435','1x4 arch, Light Bluish Gray.'),
    ('TG010',['TG010','TG015'],'4286',72,'4211045','Upright 33-degree 3x1 slope, Dark Bluish Gray.'),
    ('TG012',['TG012','TG017'],'3795',14,'379524','2x6 plate, Yellow.'),
    ('TG013',['TG013'],'3001',2,'4106356','2x4 brick, Green.'),
    ('TG016',['TG016'],None,None,'4651442','Printed female minifigure head with eyelashes and red lips; official element image retained to avoid a changed print.'),
    ('TG018',['TG018','TG023'],'3010',2,'4112838','1x4 brick, Green.'),
    ('TG019',['TG019','TG024'],'4495b',2,'449528','Wavy flag with cylindrical attachment, Green; compare mould to original.'),
    ('TG020',['TG020'],'4175',72,'4603504','Short ladder with 1x2 studded top connection, Dark Bluish Gray; preserve original ladder structure.'),
    ('TG021',['TG021','TG026','TG031'],'87087',15,'4558952','White 1x1 brick with one side stud.'),
    ('TG022',['TG022'],'970c00',15,'4570434','Assembled plain white hips and legs, not a single separated leg.'),
    ('TG025',['TG025'],'3032',0,'303226','4x6 plate, Black.'),
    ('TG027',['TG027'],'3941',46,'611644','2x2 round brick with axle hole, Trans-Yellow.'),
    ('TG028',['TG028','TG033'],'3010',4,'301021','1x4 brick, Red.'),
    ('TG029',['TG029','TG034'],'3004',2,'4107736','1x2 brick, Green.'),
    ('TG030',['TG030'],None,None,'4211087','Dark Bluish Gray 1x2 brick with horizontal pin; official legacy element image retained for pin/mould fidelity.'),
    ('TG032',['TG032','TG037'],'3065',36,'306541','1x2 brick without bottom tube, Trans-Red; preserve hollow internal construction.'),
    ('TG035',['TG035','TG040'],'3004',72,'4211088','1x2 brick, Dark Bluish Gray.'),
    ('TG036',['TG036','TG041'],'3957a',0,'395726','4H antenna with round top, Black; preserve top and base shape.'),
    ('TG038',['TG038','TG043'],'3040b',25,'4121967','45-degree 2x1 slope, Orange.'),
    ('TG039',['TG039','TG044'],'3010',1,'301023','1x4 brick, Blue.'),
    ('TG042',['TG042'],'4727',10,'4143562','Angular four-leaf flower/stalk, Bright Green; distinct from rounded petal flower.'),
    ('TG045',['TG045','TG049'],'4728',114,'4142898','Rounded petal flower with open stud, Trans-Dark Pink; do not use newer 32606 flower mould.'),
    ('TG046',['TG046'],None,None,'4275813','Blue torso assembly with WHITE arms and YELLOW hands; official exact multi-colour assembly image retained.'),
    ('TG047',['TG047'],'3020',25,'4158355','2x4 plate, Orange.'),
    ('TG048',['TG048'],None,None,'4211129','Dark Bluish Gray 2x2 base with vertical pin; official legacy element image retained for pin/mould fidelity.'),
    ('TG050',['TG050','TG054'],'4477',19,'4143409','1x10 plate, catalogue Tan / Brick Yellow; source local name Pale yellow remains unchanged.'),
    ('TG051',['TG051'],'3021',25,'4125278','2x3 plate, Orange.'),
    ('TG052',['TG052'],'2479',0,'247926','Four rounded rotor blades and open hub, Black.'),
]


def retrieve(url, destination):
    if destination.exists():
        content = destination.read_bytes()
    else:
        response = urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30)
        content = response.read()
    image = Image.open(BytesIO(content))
    if min(image.size) < 192:
        raise ValueError(f'Insufficient native resolution: {image.size}')
    destination.write_bytes(content)
    return content, image.size


def fetch(part):
    rep, ids, part_id, colour, element_id, note = part
    errors = []
    choices = []
    if part_id:
        choices.append(('rebrickable',f'https://cdn.rebrickable.com/media/parts/ldraw/{colour}/{part_id}.png',BASE/'catalogue-images'/f'{rep}-rb-{part_id}-{colour}.png'))
    choices.append(('lego',f'https://www.lego.com/cdn/product-assets/element.img.lod5photo.192x192/{element_id}.jpg',BASE/'catalogue-images'/f'{rep}-lego-{element_id}.jpg'))
    found = []
    for provider,url,path in choices:
        try:
            content,size = retrieve(url,path)
            found.append({'provider':provider,'path':str(path),'sourceUrl':url,'imageWidth':size[0],'imageHeight':size[1],
                          'elementId':element_id,'partId':part_id,'ldrawColour':colour,
                          'imageDataUrl':'data:image/'+('png' if path.suffix=='.png' else 'jpeg')+';base64,'+base64.b64encode(content).decode(),
                          'matchNotes':note})
        except Exception as exc:
            errors.append({'url':url,'error':str(exc)})
    print(rep,[(v['provider'],v['imageWidth'],v['imageHeight']) for v in found],errors,flush=True)
    return {'representative':rep,'ids':ids,'candidates':found,'errors':errors,'matchNotes':note}


def contact_sheet(groups):
    # Contact sheets are review aids; originals above remain at native resolution.
    width=1500; row_height=230; columns=5
    canvas=Image.new('RGB',(width,((len(groups)+columns-1)//columns)*row_height),'#f1f1f1')
    draw=ImageDraw.Draw(canvas)
    for i,g in enumerate(groups):
        x=(i%columns)*300;y=(i//columns)*row_height
        canvas.paste('white',(x+3,y+3,x+297,y+row_height-3))
        old=Image.open(BASE.parent/'assets'/f"{g['representative']}.png").convert('RGB')
        canvas.paste(old,(x+12,y+50))
        candidate=g['candidates'][0] if g['candidates'] else None
        if candidate:
            new=Image.open(candidate['path']).convert('RGBA')
            background=Image.new('RGBA',new.size,'white');background.alpha_composite(new)
            preview=background.convert('RGB');preview.thumbnail((180,175))
            canvas.paste(preview,(x+105+(180-preview.width)//2,y+30+(175-preview.height)//2))
            draw.text((x+110,y+205),f"{candidate['provider']} {candidate['imageWidth']} px",fill='black')
        draw.text((x+12,y+12),g['representative']+' / '+str((candidate or {}).get('partId') or (candidate or {}).get('elementId') or 'MISSING'),fill='black')
        draw.text((x+12,y+120),'original 80x60',fill='#555555')
    for start in range(0,len(groups),15):
        sheet=canvas.crop((0,(start//5)*row_height,width,min(((start+15+4)//5)*row_height,canvas.height)))
        sheet.save(BASE/f'comparison-{start+1:02}.png')


def main():
    (BASE/'catalogue-images').mkdir(exist_ok=True)
    all_ids=[i for p in PARTS for i in p[1]]
    assert len(all_ids)==56 and len(set(all_ids))==56
    assert set(all_ids)=={p['id'] for p in DATA['pieces']}
    groups=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for result in pool.map(fetch,PARTS):groups.append(result)
    (BASE/'catalogue-candidates.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2))
    contact_sheet(groups)
    print('FETCHED GROUPS',sum(bool(g['candidates']) for g in groups),'OF',len(groups),flush=True)


if __name__=='__main__':main()

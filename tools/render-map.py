# Renders assets/map/area.png from OpenStreetMap data (data.json from the Overpass API, bbox below).
# Map data (c) OpenStreetMap contributors, ODbL. Then convert to area.webp / area-sm.webp.
import json, math
from PIL import Image, ImageDraw, ImageFilter
S, N, W, E = 30.807, 30.932, 28.798, 28.962  # ~15.7 x 13.9 km around the site
SITE = (30.8697081, 28.8807809)
import sys
OUT_W = int(sys.argv[1]) if len(sys.argv) > 1 else 3200
SS = 2  # supersample
MINI_W = 3.2  # minimap roads are drawn bolder so they read when the map is small
K = OUT_W / 3200 * 10.70 / 15.68  # line widths tuned for 3200 px over 10.7 km; keep them per km
def merc(lat, lon):
    x = (lon + 180) / 360
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2
    return x, y
x0, y0 = merc(N, W); x1, y1 = merc(S, E)
OUT_H = round(OUT_W * (y1 - y0) / (x1 - x0))
w, h = OUT_W * SS, OUT_H * SS
def px(lat, lon):
    x, y = merc(lat, lon)
    return ((x - x0) / (x1 - x0) * w, (y - y0) / (y1 - y0) * h)
d = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'data.json'))['elements']
STYLE = sys.argv[3] if len(sys.argv) > 3 else ''
MINI = STYLE in ('mini', 'minilight')
C = {
  'land': (238, 234, 227), 'sea': (205, 218, 217), 'water': (196, 212, 212), 'sand': (232, 223, 204),
  'green': (221, 226, 210), 'pool': (190, 210, 212), 'building': (226, 221, 211), 'bline': (212, 205, 193),
  'casing': (214, 206, 192), 'major': (255, 255, 255), 'minor': (250, 248, 244), 'foot': (226, 220, 210), 'constr': (230, 225, 216),
}
if STYLE == 'minilight':  # light minimap: paper land, soft sea, white roads with sand edges
    C.update({
      'land': (240, 236, 229), 'sea': (190, 212, 214), 'water': (190, 212, 214), 'sand': (232, 222, 200),
      'green': (214, 224, 204), 'pool': (178, 206, 212), 'building': (226, 219, 207), 'bline': (214, 205, 190),
      'casing': (205, 181, 140), 'major': (255, 255, 255), 'minor': (255, 255, 255), 'foot': (230, 224, 214), 'constr': (232, 227, 218),
    })
elif MINI:  # dark, high-contrast minimap (GTA-like)
    C.update({
      'land': (24, 50, 58), 'sea': (12, 33, 41), 'water': (16, 44, 54), 'sand': (42, 66, 70),
      'green': (34, 70, 62), 'pool': (40, 92, 104), 'building': (38, 66, 74), 'bline': (46, 76, 84),
      'casing': (24, 50, 58), 'major': (196, 167, 122), 'minor': (98, 128, 134), 'foot': (40, 66, 72), 'constr': (30, 58, 66),
    })
img = Image.new('RGB', (w, h), C['land'])
dr = ImageDraw.Draw(img)
def pts(e): return [px(p['lat'], p['lon']) for p in e.get('geometry', []) if p]
# sea: merge coastline ways into one polyline, close it along the north (sea) edge
coast = [e for e in d if e.get('tags', {}).get('natural') == 'coastline']
segs = [[(p['lat'], p['lon']) for p in e['geometry']] for e in coast]
line = segs.pop(0)
while segs:
    for i, s in enumerate(segs):
        if s[0] == line[-1]: line += s[1:]; segs.pop(i); break
        if s[-1] == line[0]: line = s[:-1] + line; segs.pop(i); break
    else: break
print('coast points', len(line), 'start', line[0], 'end', line[-1])
# OSM coastline: land on the left, sea on the right of the drawing direction.
pl = [px(*p) for p in line]
# close via the top edge (sea is north here); order corners by direction
if pl[0][0] > pl[-1][0]:   # runs east -> west: sea (right side) is north
    poly = pl + [(-50, -50), (w + 50, -50)] if False else pl + [(min(p[0] for p in pl) - 50, -50), (max(p[0] for p in pl) + 50, -50)]
else:
    poly = pl + [(max(p[0] for p in pl) + 50, -50), (min(p[0] for p in pl) - 50, -50)]
dr.polygon(poly, fill=C['sea'])
def area_fill(cond, color, outline=None, width=0):
    for e in d:
        t = e.get('tags', {})
        if e['type'] != 'way' or not cond(t): continue
        p = pts(e)
        if len(p) > 2 and e['geometry'][0] == e['geometry'][-1]:
            dr.polygon(p, fill=color, outline=outline, width=width)
area_fill(lambda t: t.get('natural') in ('sand', 'beach'), C['sand'])
area_fill(lambda t: t.get('landuse') in ('grass', 'orchard', 'farmland', 'cemetery') or t.get('leisure') in ('garden', 'park', 'golf_course', 'pitch') or t.get('natural') in ('scrub', 'grassland', 'wood'), C['green'])
area_fill(lambda t: t.get('landuse') == 'construction', C['constr'])
area_fill(lambda t: t.get('natural') == 'water' or t.get('waterway'), C['water'])
area_fill(lambda t: t.get('leisure') in ('swimming_pool', 'water_park'), C['pool'])
area_fill(lambda t: 'building' in t, C['building'], C['bline'], max(1, round(SS * K)))
# roads, drawn minor -> major with casings
widths = {'motorway': 9, 'trunk': 9, 'primary': 8, 'secondary': 7, 'tertiary': 5.5, 'trunk_link': 5, 'secondary_link': 4.5, 'tertiary_link': 4,
          'residential': 3.4, 'unclassified': 3.4, 'service': 2.2, 'construction': 2.2, 'pedestrian': 2.4, 'track': 1.6}
def roads(kinds, color, casing=False, extra=0):
    for e in d:
        hw = e.get('tags', {}).get('highway')
        if hw not in kinds: continue
        p = pts(e)
        if len(p) < 2: continue
        wd = (widths.get(hw, 1.2) + extra) * SS * K * (MINI_W if MINI else 1)
        dr.line(p, fill=color, width=max(1, round(wd)), joint='curve')
foot = {'footway', 'path', 'steps', 'cycleway', 'corridor'}
if not MINI: roads(foot, C['foot'])
minor = {'residential', 'unclassified', 'service', 'construction', 'pedestrian', 'track'}
major = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'secondary_link', 'tertiary_link'}
roads(minor, C['casing'], extra=1.6); roads(minor, C['minor'])
roads(major, C['casing'], extra=2.4); roads(major, C['major'])
out = img.resize((OUT_W, OUT_H), Image.LANCZOS)
out.save('map.png')
sx, sy = px(*SITE)
print('size', OUT_W, OUT_H, 'site %', round(sx / w * 100, 3), round(sy / h * 100, 3))
# label anchors (percent) for HTML overlay
for e in d:
    t = e.get('tags', {})
    if t.get('place') and e['type'] == 'node':
        x, y = px(e['lat'], e['lon']); print('place', t.get('name:en') or t.get('name'), round(x / w * 100, 1), round(y / h * 100, 1))

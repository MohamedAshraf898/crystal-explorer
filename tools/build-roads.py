# Builds assets/map/roads.json: a compact drivable road graph for in-browser routing.
# Map data (c) OpenStreetMap contributors, ODbL.
import json, math, sys, collections
S, N, W, E = 30.807, 30.932, 28.798, 28.962
IMG_W, IMG_H = 8000, 7104  # coordinates are stored in pixels of this map size
def merc(lat, lon):
    x = (lon + 180) / 360
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2
    return x, y
x0, y0 = merc(N, W); x1, y1 = merc(S, E)
def px(lat, lon):
    x, y = merc(lat, lon)
    return ((x - x0) / (x1 - x0) * IMG_W, (y - y0) / (y1 - y0) * IMG_H)
# metres per pixel at the site latitude
M_PER_PX = (E - W) * 111320 * math.cos(math.radians(30.87)) / IMG_W
SPEED = {  # km/h, for time estimates
  'motorway': 90, 'trunk': 90, 'primary': 70, 'secondary': 55, 'tertiary': 45,
  'motorway_link': 50, 'trunk_link': 50, 'primary_link': 45, 'secondary_link': 40, 'tertiary_link': 35,
  'unclassified': 35, 'residential': 30, 'living_street': 15, 'service': 20, 'construction': 25,
}
CLASS = {k: i for i, k in enumerate(['trunk', 'primary', 'secondary', 'tertiary', 'link', 'local', 'service'])}
def cls(hw):
    if hw in ('motorway', 'trunk'): return 'trunk'
    if hw.endswith('_link'): return 'link'
    if hw in ('primary', 'secondary', 'tertiary'): return hw
    if hw in ('service',): return 'service'
    return 'local'
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'big.json'))['elements']
ways = [e for e in d if e['type'] == 'way' and e.get('tags', {}).get('highway') in SPEED and e.get('tags', {}).get('access') not in ('private', 'no')]
# count how many ways use each node -> intersections
use = collections.Counter()
for w in ways:
    for i, n in enumerate(w['nodes']):
        use[n] += 2 if i in (0, len(w['nodes']) - 1) else 1
coord = {}
for w in ways:
    for n, g in zip(w['nodes'], w['geometry']):
        coord[n] = px(g['lat'], g['lon'])
names = []; name_ix = {}
def name_id(t):
    n = t.get('name:en') or t.get('name')
    if not n: return -1
    if n not in name_ix: name_ix[n] = len(names); names.append(n)
    return name_ix[n]
keep = {n for n, c in use.items() if c >= 2}
node_ix = {}; nodes = []
def nid(n):
    if n not in node_ix: node_ix[n] = len(nodes); nodes.append([round(coord[n][0], 1), round(coord[n][1], 1)])
    return node_ix[n]
edges = []  # [a, b, lengthM, seconds, class, name, oneway, geometry(flat ints)]
for w in ways:
    t = w['tags']; hw = t['highway']
    ow = t.get('oneway') in ('yes', '1', 'true') or t.get('junction') == 'roundabout' or hw in ('motorway',)
    rev = t.get('oneway') == '-1'
    ns = w['nodes'][::-1] if rev else w['nodes']
    seg = [ns[0]]
    for n in ns[1:]:
        seg.append(n)
        if n in keep or n == ns[-1]:
            pts = [coord[m] for m in seg]
            L = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)) * M_PER_PX
            if L > 0.5:
                geo = [round(v) for p in pts[1:-1] for v in p]
                edges.append([nid(seg[0]), nid(seg[-1]), round(L, 1), round(L / (SPEED[hw] / 3.6), 1), CLASS[cls(hw)], name_id(t), 1 if ow else 0, geo])
            seg = [n]
out = {'size': [IMG_W, IMG_H], 'mPerPx': M_PER_PX, 'names': names, 'nodes': [v for p in nodes for v in p], 'edges': edges,
       'credit': 'Road data (c) OpenStreetMap contributors, ODbL'}
s = json.dumps(out, separators=(',', ':'))
open(sys.argv[2] if len(sys.argv) > 2 else 'roads.json', 'w').write(s)
print('nodes', len(nodes), 'edges', len(edges), 'names', len(names), 'size KB', len(s) // 1024, 'm/px', round(M_PER_PX, 3))

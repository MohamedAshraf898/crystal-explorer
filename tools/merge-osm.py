import json, glob
seen = {}; 
for f in sorted(glob.glob('part_*.json')):
    for e in json.load(open(f))['elements']:
        k = (e['type'], e['id'])
        # a way cut by two pieces comes back whole from each (out geom), keep the longest copy
        if k not in seen or len(e.get('geometry', [])) > len(seen[k].get('geometry', [])): seen[k] = e
json.dump({'elements': list(seen.values())}, open('wide.json', 'w'))
print('merged', len(seen))

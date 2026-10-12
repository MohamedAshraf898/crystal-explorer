/**
 * ROUTER — driving directions computed in the browser, no online service.
 * Uses assets/map/roads.json: the drivable roads around the project from
 * OpenStreetMap (tools/build-roads.py). Coordinates are pixels of the
 * 8000-wide area map (north up); distances in metres, times in seconds.
 */

let graph = null;

/** Load and index the road graph (once). */
export async function loadRoads(url = 'assets/map/roads.json') {
  if (graph) return graph;
  const g = await (await fetch(url)).json();
  const n = g.nodes.length / 2;
  const xs = new Float32Array(n), ys = new Float32Array(n);
  for (let i = 0; i < n; i++) (xs[i] = g.nodes[2 * i]), (ys[i] = g.nodes[2 * i + 1]);
  // adjacency: for each node, list of [edgeIndex, forward?]
  const adj = Array.from({ length: n }, () => []);
  g.edges.forEach(([a, b, , , , , oneway], i) => {
    adj[a].push(i * 2); // forward
    if (!oneway) adj[b].push(i * 2 + 1); // backward
  });
  // keep only the largest connected network for snapping (drops stray fragments)
  const comp = new Int32Array(n).fill(-1);
  const und = Array.from({ length: n }, () => []);
  g.edges.forEach(([a, b]) => (und[a].push(b), und[b].push(a)));
  let best = -1, bestSize = 0;
  for (let s = 0, c = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    let size = 0;
    const stack = [s];
    comp[s] = c;
    while (stack.length) {
      const u = stack.pop();
      size++;
      for (const v of und[u]) if (comp[v] === -1) (comp[v] = c), stack.push(v);
    }
    if (size > bestSize) (bestSize = size), (best = c);
    c++;
  }
  // nodes touching a real road (not just service lanes / car parks)
  const road = new Uint8Array(n);
  g.edges.forEach(([a, b, , , cls]) => cls < 6 && ((road[a] = 1), (road[b] = 1)));
  const deg = new Uint8Array(n);
  for (let i = 0; i < n; i++) deg[i] = Math.min(255, new Set(und[i]).size);
  const main = new Uint8Array(n);
  for (let i = 0; i < n; i++) main[i] = comp[i] === best ? 1 : 0;
  graph = { ...g, n, xs, ys, adj, main, deg, road };
  return graph;
}

/**
 * Closest road junction to a map point. Prefers a proper road over service
 * lanes (car parks, driveways) unless that road is much further away.
 */
export function nearestNode([x, y], preferRoad = true) {
  const { n, xs, ys, main, road, mPerPx } = graph;
  let any = -1, da = Infinity, onRoad = -1, dr = Infinity;
  for (let i = 0; i < n; i++) {
    if (!main[i]) continue;
    const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2;
    if (d < da) (da = d), (any = i);
    if (road[i] && d < dr) (dr = d), (onRoad = i);
  }
  const useRoad = preferRoad && onRoad >= 0 && (Math.sqrt(dr) - Math.sqrt(da)) * mPerPx < 250;
  const node = useRoad ? onRoad : any;
  return { node, distM: Math.sqrt(useRoad ? dr : da) * mPerPx };
}

/* ── A* (fastest route) with a small binary heap ─────────────────────── */
function astar(from, to) {
  const { n, xs, ys, adj, edges, mPerPx } = graph;
  const g = new Float64Array(n).fill(Infinity);
  const via = new Int32Array(n).fill(-1); // half-edge used to reach the node
  const maxSpeed = 90 / 3.6; // m/s, keeps the heuristic admissible
  const hcost = (i) => (Math.hypot(xs[i] - xs[to], ys[i] - ys[to]) * mPerPx) / maxSpeed;
  const heap = [[hcost(from), from]];
  g[from] = 0;
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [f, u] = pop();
    if (u === to) break;
    if (f - hcost(u) > g[u] + 1e-6) continue; // stale
    for (const he of adj[u]) {
      const e = edges[he >> 1];
      const v = he & 1 ? e[0] : e[1];
      const ng = g[u] + e[3];
      if (ng < g[v]) {
        g[v] = ng;
        via[v] = he;
        push([ng + hcost(v), v]);
      }
    }
  }
  if (!Number.isFinite(g[to])) return null;
  const path = [];
  for (let v = to; v !== from; ) {
    const he = via[v];
    path.push(he);
    const e = edges[he >> 1];
    v = he & 1 ? e[1] : e[0];
  }
  return path.reverse();
}

/** Points of one half-edge, in travel order. */
function edgePoints(he) {
  const { edges, xs, ys } = graph;
  const [a, b, , , , , , geo] = edges[he >> 1];
  const pts = [[xs[a], ys[a]]];
  for (let i = 0; i < geo.length; i += 2) pts.push([geo[i], geo[i + 1]]);
  pts.push([xs[b], ys[b]]);
  return he & 1 ? pts.reverse() : pts;
}

const bearing = ([x1, y1], [x2, y2]) => (Math.atan2(x2 - x1, -(y2 - y1)) * 180) / Math.PI; // 0 = north, clockwise
const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const compass = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Direction of a turn from the change in heading. */
function turnName(delta) {
  const d = ((delta + 540) % 360) - 180; // -180..180, + = right
  const a = Math.abs(d);
  if (a < 25) return null; // straight on
  if (a > 155) return 'Make a U-turn';
  const side = d > 0 ? 'right' : 'left';
  if (a < 55) return `Keep ${side}`;
  if (a < 125) return `Turn ${side}`;
  return `Turn sharp ${side}`;
}

/** Bearing over the first / last ~`m` metres of a polyline. */
function headBearing(pts, m) {
  const lim = m / graph.mPerPx;
  let acc = 0, i = 1;
  for (; i < pts.length - 1; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc >= lim) break;
  }
  return bearing(pts[0], pts[i]);
}
const tailBearing = (pts, m) => (headBearing([...pts].reverse(), m) + 180) % 360;
const angleDiff = (a, b) => ((b - a + 540) % 360) - 180; // + = right

/**
 * Fastest driving route between two map points.
 * Steps only announce real decisions: turns at junctions where another road
 * goes straighter; quick zig-zags (dual carriageways) are merged into one.
 * @returns {{points:number[][], distM:number, timeS:number, steps:object[], start:object, end:object}|null}
 */
export function route(fromXY, toXY, { toName = 'your destination' } = {}) {
  let start = nearestNode(fromXY), end = nearestNode(toXY);
  if (start.node < 0 || end.node < 0) return null;
  if (start.node === end.node) return { points: [fromXY, toXY], distM: 0, timeS: 0, steps: [{ text: `You're already at ${toName}`, distM: 0, detail: '', turn: 'arrive' }], start, end };
  let path = astar(start.node, end.node);
  if (!path) {
    // e.g. the preferred road is one-way the wrong way: fall back to the closest junctions
    (start = nearestNode(fromXY, false)), (end = nearestNode(toXY, false));
    path = start.node === end.node ? [] : astar(start.node, end.node);
  }
  if (!path?.length) return null;
  const { edges, names, deg, adj } = graph;
  const points = [];
  let distM = 0, timeS = 0;
  const segs = path.map((he) => {
    const e = edges[he >> 1];
    const pts = edgePoints(he);
    distM += e[2];
    timeS += e[3];
    points.push(...(points.length ? pts.slice(1) : pts));
    return { he, pts, len: e[2], name: e[5] >= 0 ? names[e[5]] : null, node: he & 1 ? e[0] : e[1] };
  });

  // decisions at junctions: [segment index where the new leg starts, signed turn angle]
  const events = [];
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1], cur = segs[i];
    const node = prev.node;
    if (deg[node] < 3 && prev.name === cur.name) continue; // just a bend
    const inB = tailBearing(prev.pts, 30);
    const d = angleDiff(inB, headBearing(cur.pts, 30));
    // is there another exit that goes straighter? then this is a real turn
    const back = prev.he ^ 1;
    let straighter = false;
    for (const he of adj[node]) {
      if (he === cur.he || he === back) continue;
      const alt = Math.abs(angleDiff(inB, headBearing(edgePoints(he), 30)));
      if (alt < Math.abs(d)) straighter = true;
    }
    const renamed = cur.name && cur.name !== prev.name;
    if (Math.abs(d) >= 25 && (straighter || Math.abs(d) >= 60)) events.push({ i, d, inB });
    else if (renamed) events.push({ i, d: 0, inB });
  }
  // merge turns closer than ~60 m (crossing a median, short connectors)
  const merged = [];
  for (const ev of events) {
    const last = merged[merged.length - 1];
    const gap = last ? segs.slice(last.i, ev.i).reduce((s, x) => s + x.len, 0) : Infinity;
    if (last && gap < 60) {
      const outB = headBearing(segs[ev.i].pts, 30);
      last.d = angleDiff(last.inB, outB);
      last.i2 = ev.i;
    } else merged.push({ ...ev });
  }
  // legs between decisions
  const cuts = [0, ...merged.map((m) => m.i), segs.length];
  const fmt = (m) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);
  const steps = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const legSegs = segs.slice(cuts[k], cuts[k + 1]);
    const len = legSegs.reduce((s, x) => s + x.len, 0);
    const name = legSegs.find((x) => x.name)?.name ?? null;
    if (k === 0) {
      steps.push({ text: `Head ${compass(headBearing(legSegs[0].pts, 60))}${name ? ` on ${name}` : ''}`, distM: len, detail: fmt(len), turn: 'start' });
      continue;
    }
    const t = turnName(merged[k - 1].d);
    if (!t && !name) {
      // nothing to announce: extend the previous step
      const prevStep = steps[steps.length - 1];
      prevStep.distM += len;
      prevStep.detail = fmt(prevStep.distM);
      continue;
    }
    steps.push({ text: `${t ?? 'Continue'}${name ? ` onto ${name}` : ''}`, distM: len, detail: fmt(len), turn: (t ?? 'straight').toLowerCase() });
  }
  // "Continue onto X" right before "Turn … onto X": keep only the turn
  for (let k = steps.length - 2; k >= 1; k--) {
    const a = steps[k], b = steps[k + 1];
    if (a.turn === 'straight' && b.text.endsWith(a.text.replace('Continue', '')) && a.distM < 300) {
      b.distM += a.distM;
      b.detail = fmt(b.distM);
      steps.splice(k, 1);
    }
  }
  steps.push({ text: `Arrive at ${toName}`, distM: 0, detail: '', turn: 'arrive' });
  return { points, distM, timeS, steps, start, end };
}

export const formatDistance = (m) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
export const formatDuration = (s) => (s < 90 ? '1 min' : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);

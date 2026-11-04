const T_DEEP = 0, T_SEA = 1, T_BEACH = 2, T_GRASS = 3, T_FOREST=4, T_HILLS = 5, T_MOUNT = 6, T_SNOW = 7;
const TER = [
  { name: 'Okyanus', speed: 0 }, { name: 'Deniz', speed: 0 }, { name: 'Kumsal', speed: 0.9 }, { name: 'Çayır', speed: 1 },
  { name: "Orman", speed: 0.7 }, { name: 'Tepe', speed: 0.6 }, { name: 'Dağ', speed: 0.4 }, { name: 'Karlı zirve', speed: 0 },
];
const W = CFG.cols * CFG.tile, H = CFG.rows * CFG.tile;
const RT = 6;

function makeNoise(cols, rows, cell)
{
  const gw = Math.ceil(cols / cell) + 2, g = [];
   for (let i = 0; i < gw * (Math.ceil(rows / cell) + 2); i++) g.push(Math.random());
  const sm = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  return (x, y) => {
    const gx = clamp(x, 0, cols) / cell, gy = clamp(y, 0, rows) / cell, ix=gx | 0, iy = gy | 0, sx = sm(gx - ix), sy = sm(gy - iy);
    const v = (i, j) => g[(iy + j) * gw + ix + i];
    return lerp(lerp(v(0, 0), v(1, 0), sx), lerp(v(0, 1), v(1, 1), sx), sy);
  };
}

function genWorld()
{
  const { cols: sutunlar, rows: satirlar } = CFG;
  const oct = [[40, 0.5], [18, 0.27], [8, 0.15], [3, 0.08]].map(([c, w]) => [makeNoise(sutunlar, satirlar, c), w]);
  const m1 = makeNoise(sutunlar, satirlar, 25), m2 = makeNoise(sutunlar, satirlar, 7), fine = makeNoise(sutunlar, satirlar, 0.7);

  const edge = (c, r) => Math.max(0, 0.08 - Math.min(c, sutunlar - c, r * 1.5, (satirlar - r) * 1.5) / sutunlar) * 4;
  const G = Sim.campGen, X = Sim.scenGen;
  const raw = X ? X.h : G ? (c, r) => G.h(c, r) + (oct[2][0](c, r) - 0.5) * 0.05 + (oct[3][0](c, r) - 0.5) * 0.035
    : (c, r) => { let h = 0; for (const [n, w] of oct) h += n(c, r) * w; return h - edge(c, r); };
  const pn = makeNoise(sutunlar, satirlar, 32), sm = t => t * t * (3 - 2 * t);
  const plain = X ? () => 0.92 : Sim.arena ? (c, r) => 0.82 + 0.18 * sm(clamp((pn(c, r) - 0.4) / 0.2, 0, 1)) : (c, r) => sm(clamp((pn(c, r) - 0.5) / 0.14, 0, 1));
  const moist = X ? X.m : G ? (c, r) => G.m(c, r) * 0.85 + m2(c, r) * 0.15 - plain(c, r) * 0.22 : (c, r) => m1(c, r) * 0.7 + m2(c, r) * 0.3 - plain(c, r) * 0.22;

  const hs = new Float32Array(sutunlar * satirlar);
  for (let r = 0; r < satirlar; r++) for (let c = 0; c < sutunlar; c++) hs[r * sutunlar + c] = raw(c + 0.5, r + 0.5);
  const sirali = Float32Array.from(hs).sort(), q = p => sirali[Math.floor(p * (sirali.length - 1))];
  const th = X ? X.th : G ? G.th : Sim.arena ? { deep: q(0.06), sea: q(0.1), beach: q(0.115), hills: q(0.82), mount: q(0.92), snow: q(0.975) }
    : { deep: q(0.27), sea: q(0.40), beach: q(0.425), hills: q(0.82), mount: q(0.92), snow: q(0.975) };
  const flat=th.beach + (th.hills - th.beach) * 0.35;
  const height = X ? raw : (c, r) => {
    const h = raw(c, r);

    if (h <= th.beach + 0.01) return h;
    const p = plain(c, r) * clamp((h - th.beach - 0.01) / 0.03, 0, 1);
    return h + (flat - h) * p * 0.9;
  };
  for (let r = 0; r < satirlar; r++) for (let c = 0; c < sutunlar; c++) hs[r * sutunlar + c] = height(c + 0.5, r + 0.5);
  const typeOf=(h, m) => h < th.deep ? T_DEEP : h < th.sea ? T_SEA : h < th.beach ? T_BEACH : h >= th.snow ? T_SNOW
    : h >= th.mount ? T_MOUNT : h >= th.hills ? T_HILLS : m > 0.53 ? T_FOREST : T_GRASS;
  Sim.terrain = new Uint8Array(sutunlar * satirlar);
  for (let r = 0; r < satirlar; r++) for (let c = 0; c < sutunlar; c++) Sim.terrain[r * sutunlar + c] = typeOf(hs[r * sutunlar + c], moist(c + 0.5, r + 0.5));

  const P = 5, iw = sutunlar * P, ih = satirlar * P;
  const img = document.createElement('canvas');
  img.width=iw; img.height=ih;
  const ic = img.getContext('2d'), id = ic.createImageData(iw, ih), px = id.data;
  const C = { deep: [16, 46, 88], shallow: [70, 140, 185], sand: [222, 205, 150], grassL: [138, 184, 88], grassD: [88, 142, 60],
    forest: [58, 108, 50], hills: [140, 142, 88], mount: [128, 122, 112], mountD: [92, 88, 82], snow: [238, 242, 248] };
  const lerpC = (a, b, t) => { t=clamp(t, 0, 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const hp=new Float32Array(iw * ih);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) hp[y * iw + x] = height(x / P, y / P);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const c = x / P, r = y / P, h = hp[y * iw + x], m = moist(c, r), t = typeOf(h, m);
    let sutun, k = 1;
    if (t <= T_SEA) {
      sutun=lerpC(C.deep, C.shallow, (h - th.deep + 0.06) / (th.sea - th.deep + 0.06));
      if (h > th.sea - 0.004) sutun = lerpC(sutun, [235, 240, 240], 0.35);
       k=0.97 + fine(c, r) * 0.06;
    } else {
      if (t === T_BEACH) sutun = C.sand;
      else if (t===T_GRASS) sutun = lerpC(C.grassL, C.grassD, (m - 0.3) / 0.25);
      else if (t === T_FOREST) sutun = lerpC(C.grassD, C.forest, (m - 0.53) / 0.1);
      else if (t === T_HILLS) sutun = lerpC(C.grassD, C.hills, (h - th.hills) / (th.mount - th.hills));
      else if (t === T_MOUNT) sutun = lerpC(C.mount, C.mountD, (h - th.mount) / (th.snow - th.mount));
      else sutun = C.snow;
      const slope = (h - hp[Math.max(0, y - 2) * iw + Math.max(0, x - 2)]) * 1.25 * (t >= T_HILLS ? 70 : 30);
      k = clamp(1 + slope, 0.7, 1.35) * (0.93 + fine(c, r) * 0.14);
    }
    const o = (y * iw + x) * 4;
    px[o] = sutun[0] * k; px[o + 1] = sutun[1] * k; px[o + 2] = sutun[2] * k; px[o + 3] = 255;
  }
  ic.putImageData(id, 0, 0);
  const Q = 2, buyuk = document.createElement('canvas');
  buyuk.width = iw * Q; buyuk.height=ih * Q;
  const bc = buyuk.getContext('2d');
  bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
  bc.drawImage(img, 0, 0, buyuk.width, buyuk.height);
  bc.scale(Q, Q);

  for (let r = 0; r < satirlar; r++) for (let c = 0; c < sutunlar; c++) {
    const t = Sim.terrain[r * sutunlar + c];
    const tree = (x, y, s) => {
      bc.fillStyle = 'rgba(0,0,0,0.25)'; bc.beginPath(); bc.arc(x + 0.8, y + 0.8, s, 0, 7); bc.fill();
      bc.fillStyle = '#2f5e2a'; bc.beginPath(); bc.arc(x, y, s, 0, 7); bc.fill();
      bc.fillStyle = '#4c8a3e'; bc.beginPath(); bc.arc(x - s * 0.3, y - s * 0.3, s * 0.55, 0, 7); bc.fill();
    };
    if (t === T_FOREST) { if (Math.random() < 0.85) tree((c + rnd(0.2, 0.8)) * P, (r + rnd(0.2, 0.8)) * P, rnd(3, 4.2)); }
    else if (t === T_GRASS && Math.random() < 0.025 * (1 - plain(c, r))) tree((c + 0.5) * P, (r + 0.5) * P, rnd(2.6, 3.4));
    else if ((t === T_MOUNT && Math.random() < (X ? 0.12 : 0.3)) || (t === T_HILLS && Math.random() < 0.06)) {
      const x = (c + 0.5) * P, y = (r + 0.7) * P, s = t === T_MOUNT ? rnd(8, 12) : 5;
      bc.fillStyle = '#a39d92'; bc.beginPath(); bc.moveTo(x - s, y); bc.lineTo(x, y - s * 1.2); bc.lineTo(x, y); bc.fill();
      bc.fillStyle = '#6e6960'; bc.beginPath(); bc.moveTo(x + s, y); bc.lineTo(x, y - s * 1.2); bc.lineTo(x, y); bc.fill();

      if (hs[r * sutunlar + c] > (th.mount + th.snow) / 2) {
        bc.fillStyle = "#f4f6f8"; bc.beginPath(); bc.moveTo(x - s * 0.35, y - s * 0.8); bc.lineTo(x, y - s * 1.2); bc.lineTo(x + s * 0.35, y - s * 0.8); bc.fill();
      }
    }
  }
  Sim.mapImg = buyuk;

  Sim.RW = W / RT; Sim.RH=H / RT;
  Sim.trail = new Float32Array(Sim.RW * Sim.RH);
  Sim.roadImg=document.createElement('canvas');
   Sim.roadImg.width = Sim.RW; Sim.roadImg.height = Sim.RH;
}

const terrainAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T_DEEP : Sim.terrain[(y / CFG.tile | 0) * CFG.cols + (x / CFG.tile | 0)];
const trailIdx = (x, y) => (y / RT | 0) * Sim.RW + (x / RT | 0);

function speedAt(x, y, p) {
  const t = terrainAt(x, y);
  let v = TER[t].speed;
  if (!v) return 0;
  if (p) {
    const home = p.R.home;
    if (home === 'hills' && (t === T_HILLS || t === T_MOUNT)) v = Math.min(1, v * 1.6);
    else if (home === 'forest' && t === T_FOREST) v = 1;
  }
  return Sim.trail[trailIdx(x, y)] > 25 ? v * 1.35 : v;
}

function updateRoadImg() {
  const rc = Sim.roadImg.getContext('2d'), id = rc.createImageData(Sim.RW, Sim.RH), px = id.data, tr = Sim.trail;
  for (let i = 0; i < tr.length; i++) {
    const v = tr[i];
    if (v < 6) continue;
    px[i * 4] = 150; px[i * 4 + 1] = 118; px[i * 4 + 2] = 80;
    px[i * 4 + 3]=Math.min(1, (v - 6) / 30) * 200;
  }
  rc.putImageData(id, 0, 0);

}

function computeTerritory()
{
  const { cols: sutunlar, rows: satirlar, tile: T } = CFG, n = sutunlar * satirlar;
  const kendi = new Int16Array(n), skor = new Float32Array(n).fill(1);
  if (!Sim.bNoise || Sim.bNoise.ter !== Sim.terrain) Sim.bNoise = { ter: Sim.terrain, f: makeNoise(sutunlar, satirlar, 9), g: makeNoise(sutunlar, satirlar, 3) };
  const bn = Sim.bNoise, TC = [0, 0, 1, 1, 1.1, 1.3, 1.7, 2.5];
  for (const s of Sim.settlements) {
    const b = s.bord || (s.bord = { round: Math.random() < 0.3, w: [2, 3, 5].map(f => [f, rnd(0, 6.28), rnd(0.05, 0.13)]) });
    const R = claimR(s) * (s.k.capital === s ? 1.15 : 1) * (b.round ? 1 : 1.12), rt = Math.ceil(R * (b.round ? 1 : 1.5) / T), c0 = s.x / T | 0, r0 = s.y / T | 0;
    for (let dy = -rt; dy <= rt; dy++) for (let dx = -rt; dx <= rt; dx++) {
      const c = c0 + dx, r = r0 + dy;
      if (c < 0 || r < 0 || c >= sutunlar || r >= satirlar) continue;
      const i = r * sutunlar + c;
      if (Sim.terrain[i] < T_BEACH) continue;
      let sc=Math.hypot(dx, dy) * T / R;
      if (!b.round && sc > 0.25) {
        const a = Math.atan2(dy, dx);
        let wav=1;
        for (const [f, ph, am] of b.w) wav += Math.sin(a * f + ph) * am;
        sc = sc / wav * TC[Sim.terrain[i]] + (bn.f(c, r) - 0.5) * 0.35 + (bn.g(c, r) - 0.5) * 0.12;
      }
      if (sc < skor[i]) { skor[i] = sc; kendi[i]=s.k.id; }
    }
  }
  Sim.own = kendi;
  const img = Sim.terrImg || (Sim.terrImg = document.createElement('canvas'));
  img.width = sutunlar; img.height = satirlar;
  const ic=img.getContext('2d'), id = ic.createImageData(sutunlar, satirlar), px = id.data;
  const byId = new Map(Sim.kingdoms.map(k => [k.id, k]));
  const E = [];
  for (let r = 0; r < satirlar; r++) for (let c = 0; c < sutunlar; c++) {
    const i=r * sutunlar + c, o = kendi[i];
    if (!o) continue;
    const k = byId.get(o), [R, G, Bc] = hexRGB(k.color);
    px[i * 4] = R; px[i * 4 + 1] = G; px[i * 4 + 2] = Bc; px[i * 4 + 3] = 38;
    if (c + 1 < sutunlar && kendi[i + 1] !== o && Sim.terrain[i + 1] >= T_BEACH) E.push([c + 1, r, c + 1, r + 1, k, kendi[i + 1] ? byId.get(kendi[i + 1]) : null]);
    if (r + 1 < satirlar && kendi[i + sutunlar] !== o && Sim.terrain[i + sutunlar] >= T_BEACH) E.push([c, r + 1, c + 1, r + 1, k, kendi[i + sutunlar] ? byId.get(kendi[i + sutunlar]) : null]);
    if (c > 0 && !kendi[i - 1] && Sim.terrain[i - 1] >= T_BEACH) E.push([c, r, c, r + 1, k, null]);
    if (r > 0 && !kendi[i - sutunlar] && Sim.terrain[i - sutunlar] >= T_BEACH) E.push([c, r, c + 1, r, k, null]);
  }
  ic.putImageData(id, 0, 0);
  Sim.borders = smoothBorders(E, T);
  Sim.terrDirty = false;
}
function smoothBorders(E, T) {

  const anahtar = (x, y) => y * 1024 + x, at = new Map();

  E.forEach((e, i) => { for (const k of [anahtar(e[0], e[1]), anahtar(e[2], e[3])]) { let l = at.get(k); if (!l) at.set(k, l = []); l.push(i); } });
  const same = (a, b) => (a[4] === b[4] && a[5] === b[5]) || (a[4] === b[5] && a[5] === b[4]);
  const used = new Uint8Array(E.length), paths = new Map();
  const next = (i, k) => { const l = at.get(k); if (l.length !== 2) return -1; const j = l[0] === i ? l[1] : l[0]; return !used[j] && same(E[i], E[j]) ? j : -1; };

  const far = (e, k) => anahtar(e[0], e[1]) === k ? [e[2], e[3]] : [e[0], e[1]];
  const grow=(i, p) => { const out = []; for (let simdiki = i, j; (j = next(simdiki, anahtar(p[0], p[1]))) >= 0; simdiki = j) { used[j]=1; p=far(E[j], anahtar(p[0], p[1])); out.push(p); } return out; };
  const add = (k, noktalar, closed) => {
    let p = paths.get(k);
    if (!p) paths.set(k, p = new Path2D());
    p.moveTo(noktalar[0][0] * T, noktalar[0][1] * T);
    for (let i = 1; i < noktalar.length; i++) p.lineTo(noktalar[i][0] * T, noktalar[i][1] * T);
    if (closed) p.closePath();
  };
  for (let i = 0; i < E.length; i++) {
    if (used[i]) continue;
    used[i] = 1;

    const e = E[i], a = [e[0], e[1]], b = [e[2], e[3]];
    const fwd = grow(i, b), back = grow(i, a);
    let noktalar = [...back.reverse(), a, b, ...fwd];
    const z = noktalar[noktalar.length - 1], closed = noktalar.length > 3 && z[0] === noktalar[0][0] && z[1] === noktalar[0][1];

    if (closed) noktalar.pop();
    noktalar = roundLine(noktalar, closed);
    add(e[4], noktalar, closed);
    if (e[5]) add(e[5], noktalar, closed);
  }
  return [...paths].map(([k, path]) => ({ k, path }));
}
function roundLine(p, closed) {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let q = closed ? p.map((a, i) => mid(a, p[(i + 1) % p.length])) : [p[0], ...p.slice(1).map((b, i) => mid(p[i], b)), p[p.length - 1]];
  for (let it = 0; it < 2; it++) {
    const cikti = closed ? [] : [q[0]], n = closed ? q.length : q.length - 1;
    for (let i = 0; i < n; i++) {
      const a = q[i], b = q[(i + 1) % q.length];
      cikti.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) cikti.push(q[q.length - 1]);
    q = cikti;
  }
  return q;
}
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function findPath(sx, sy, tx, ty, water)
{
  const { cols: sutunlar, rows: satirlar, tile: T } = CFG, n = sutunlar * satirlar;
  const s = (sy / T | 0) * sutunlar + (sx / T | 0), t = (ty / T | 0) * sutunlar + (tx / T | 0);

  const onceki = new Int32Array(n).fill(-1), q = new Int32Array(n);
  let head = 0, tail = 0;
  q[tail++] = s; onceki[s] = s;
  while (head < tail) {
    const i = q[head++];
    if (i === t) break;

    const c = i % sutunlar, r = i / sutunlar | 0;
     for (const [dx, dy] of N8) {
      const cc = c + dx, rr = r + dy;
      if (cc < 0 || rr < 0 || cc >= sutunlar || rr >= satirlar) continue;
      const j = rr * sutunlar + cc;
      if (onceki[j] !== -1 || (water ? Sim.terrain[j] > T_SEA : !TER[Sim.terrain[j]].speed)) continue;

      onceki[j] = i; q[tail++] = j;
    }
  }
  if (onceki[t] === -1) return null;

  const yol = [];
  for (let i=t; i !== s; i = onceki[i]) yol.push(i);
  yol.reverse();
  return yol.filter((_, k) => k % 4 === 3 || k === yol.length - 1).map(i => ({ x: (i % sutunlar + 0.5) * T, y: ((i / sutunlar | 0) + 0.5) * T }));
}

const ownerAt = (x, y) => Sim.own ? Sim.own[(y / CFG.tile | 0) * CFG.cols + (x / CFG.tile | 0)] : 0;

function decayRoads() {
  const tr = Sim.trail;
  for (let i = 0; i < tr.length; i++) if (tr[i]) tr[i] = tr[i] < 0.3 ? 0 : tr[i] * 0.994;
}

const SPEED1=0.5;
const Sim = {
  ready: false, people: [], kingdoms: [], settlements: [], log: [], fx: [], hall: [], deaths: {}, battles: [], battleLog: [], ruins: [], trenches: [], selS: null,
  arrows: [], ships: [], monsters: [], popHist: [], camps: [], diseases: [], nextArmy: 1, nextShip: 1, nextMon: 1, rainUntil: 0,
  tick: 0, speed: SPEED1, acc: 0, wars: 0, sel: null, selK: null, follow: true, placing: null, tool: null,
  nextId: 1, nextK: 1, nextS: 1, cam: { x: W / 2, y: H / 2, z: 0.8 }, ctrl: null, terrDirty: true,
};

const KEYS = {};
const year = () => Sim.tick / CFG.year | 0;
const arenaMin = () => Sim.tick / 60 | 0;
const stamp = () => Sim.arena ? lang`${arenaMin()}. dk` : year();
const stampTxt = () => Sim.arena ? lang`${arenaMin()}. dk` : lang`Yıl ${year()}`;
const dateStr = () => {
  if (Sim.arena) {
    const m = arenaMin(), hh = (8 + (m / 60 | 0)) % 24, mm = m % 60;
    return lang`Saat ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ⏱ ${m} dk ${String(Sim.tick % 60).padStart(2, "0")} sn`;
  }
  if (!Sim.camp) return lang`Yıl ${year()}`;
  const f = (Sim.tick % CFG.year) / CFG.year * 12, m = f | 0, d = (f - m) * 30 + 1 | 0;
  return lang`${d} ${MONTHS[m]}, Yıl ${year()}`;
};
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const dist = (a, b) => Math.sqrt(dist2(a, b));
function angDiff(a, b)
{
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d<-Math.PI) d += Math.PI * 2;
  return d;
}
const fullName = p => p.name + ' ' + p.house;
const title = p => p.k && p.k.republic ? lang("Başkan") : p.female ? lang('Kraliçe') : lang('Kral');
const isAdult = p => p.age >= CFG.adultAge;
const RACE_DB = { ...RACES };

function chron(yazi, a, b, s) {
  const e = { y: stamp(), text: yazi };
  Sim.log.unshift(e);
  if (Sim.log.length > 400) Sim.log.pop();
  for (const k of [a, b, s]) if (k) { k.hist.unshift(e); if (k.hist.length > 60) k.hist.pop(); }
}

function slog(s, yazi) {
  s.hist.unshift({ y: stamp(), text: yazi });
  if (s.hist.length > 60) s.hist.pop();
}
function plog(p, yazi) {
  p.log.unshift(lang`${stampTxt()}: ${yazi}`);
  if (p.log.length > 10) p.log.pop();
}

function makePerson(rk, k, s, x, y, o = {}) {
  const R = RACE_DB[rk], f=o.father, m = o.mother, stats = {};
  for (const [anahtar] of STATS) {
    const taban = f && m ? (f.stats[anahtar] + m.stats[anahtar]) / 2 : R.stats[anahtar];
    stats[anahtar] = clamp(Math.round(taban + rnd(-1.2, 1.2)), 1, 10);
  }
  const sk = f && m ? f.rgb.map((v, i) => (v + m.rgb[i]) / 2) : hexRGB(R.skin);
   const sh = rnd(-0.07, 0.07), rgb=sk.map(v => v * (1 + sh));
  const maxHp = (20 + stats.end * 4) * R.size;
  const p = {
    id: Sim.nextId++, race: rk, R, k, s, x, y, a: rnd(0, 6.28), female: o.female ?? Math.random() < 0.5,
    age: o.age ?? 0, life: R.stats.life * rnd(0.85, 1.15), name: makeName(R.names), house: o.house || makeName(R.names),
    father: f || null, mother: m || null, spouse: null, children: [], job: (o.age ?? 0) >= CFG.adultAge ? 'farmer' : 'child',
    gold: 0, kills: 0, hp: maxHp, maxHp, stats, rgb, skin: rgbCss(rgb), log: [], born: year(),
    state: null, sub: null, tgt: null, stuck: 0, side: 1,
    traits: inheritTraits(f, m), energy: rnd(40, 100), social: rnd(30, 100), pace: rnd(0.85, 1.15), ties: new Map(), act: null,
  };
  Sim.people.push(p);
  return p;
}

function newKingdom(rk) {
  const R = RACE_DB[rk];

  const renk = KCOLORS[(Sim.nextK - 1) % KCOLORS.length];
  const k = {
    id: Sim.nextK++, race: rk, R, name: lang`${makeName(R.names)} ${R.kword}`, color: renk, roof: mixHex(renk, '#6b4a2f', 0.55),
    gold: 50, republic: R.kword === 'Cumhuriyeti', rel: new Map(), hist: [], kills: 0, deaths: 0, wars: 0, conquests: 0, raids: 0,
    king: null, capital: null, founded: year(), dead: false, armies: [], armyCd: 0, reigns: [], shipsSunk: 0, tech: 0, research: 0, drought: 0,
  };
  Sim.kingdoms.push(k);
  return k;
}

function makeSettlement(k, x, y)
{
  const s={
    id: Sim.nextS++, name: makeName(k.R.names) + pick(PLACE_END), k, x, y, r: 24, houses: [], fields: new Set(),
    walls: null, prison: null, keep: false, project: null, food: 60, wood: 20, stone: 0, pop: 0, cap: 0,
    level: lang('Köy'), founded: year(), dead: false, hist: [], births: 0, deathsY: 0, stab: 70, lay: makeLayout(k),
  };
  for (let i = 0; i < 3; i++) { const h = houseSpot(s); if (h) { s.houses.push(h); s.cap += CFG.houseCap; } }
  computeSpots(s);
  Sim.settlements.push(s);
  Sim.terrDirty = true;

  return s;
}

function computeSpots(s)
{
  s.spots = { food: [], wood: [], stone: [] };
  const T = CFG.tile, R = 24, c0 = s.x / T | 0, r0 = s.y / T | 0, fin = 1.5, fout = s.r / T + 5.5;

  const built = [...s.houses, ...buildingsOf(s)];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const c = c0 + dx, r=r0 + dy, d = Math.hypot(dx, dy);
    if (c < 0 || r < 0 || c >= CFG.cols || r >= CFG.rows || d > R) continue;
    const t = Sim.terrain[r * CFG.cols + c], pt = { x: (c + 0.5) * T, y: (r + 0.5) * T, d, i: r * CFG.cols + c };
    if (t === T_FOREST) s.spots.wood.push(pt);
    if (t === T_HILLS || t === T_MOUNT) s.spots.stone.push(pt);
    if ((t === T_GRASS || t === T_BEACH) && d > fin && d < fout && !built.some(h => (h.x - pt.x) ** 2 + (h.y - pt.y) ** 2 < 144)) s.spots.food.push(pt);
  }
  for (const k in s.spots) s.spots[k].sort((a, b) => a.d - b.d);
}

function makeLayout(k) {
  const b = k.R.base || k.race;
  const kind = ["orc", 'goblin'].includes(b) ? pick(['cluster', 'cluster', 'street']) : pick(['grid', 'grid', 'street', 'cross']);
  return { kind, ang: rnd(0, Math.PI), cands: null };

}
const lotPos = i => i * 15 + 9 * Math.floor(i / 2);
function layoutCands(s)
{

  const L = s.lay, cikti = [];
  for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) {
    let u = lotPos(i), v = lotPos(j), sc;
    if (L.kind==='grid') sc=Math.max(Math.abs(u), Math.abs(v)) + Math.min(Math.abs(u), Math.abs(v)) * 0.15;
    else if (L.kind==='street') {
      if (!j || Math.abs(j) > 5) continue;
      v = Math.sign(j) * (8 + (Math.abs(j) - 1) * 15); u = i * 15;
      sc = Math.abs(u) + (Math.abs(j) - 1) * 70;
    } else {
      if (Math.abs(u) > 30 && Math.abs(v) > 30) continue;
      sc = Math.min(Math.abs(u) + Math.abs(v) * 2.5, Math.abs(v) + Math.abs(u) * 2.5);
    }
    if (u * u + v * v < 17 * 17) continue;
    cikti.push({ u, v, sc: sc + rnd(0, 10) });
  }
  return cikti.sort((a, b) => a.sc - b.sc);
}
const layXY = (s, u, v) => { const c = Math.cos(s.lay.ang), n = Math.sin(s.lay.ang); return { x: s.x + u * c - v * n, y: s.y + u * n + v * c }; };

function houseSpot(s) {

  if (s.lay && s.lay.kind !== 'cluster') {
    if (!s.lay.cands) s.lay.cands=layoutCands(s);
    const bs = buildingsOf(s), pr = s.project;
    for (const c of s.lay.cands) {
      const { x, y } = layXY(s, c.u, c.v);

      if (!speedAt(x, y) || terrainAt(x, y) >= T_MOUNT) continue;
      if (s.houses.some(h => (h.x - x) ** 2 + (h.y - y) ** 2 < 49) || bs.some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < 100)) continue;
      if (pr && (pr.x - x) ** 2 + (pr.y - y) ** 2 < 49) continue;
      return { x, y };
    }
  }
  for (let i = 0; i < 40; i++) {
    const a = rnd(0, 6.28), r = rnd(14, s.r + 10), x = s.x + Math.cos(a) * r, y=s.y + Math.sin(a) * r;
    if (!speedAt(x, y) || s.houses.some(h => (h.x - x) ** 2 + (h.y - y) ** 2 < 17 * 17)) continue;
    if (buildingsOf(s).some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < 18 * 18)) continue;
    return { x, y };
  }
  return null;
}

const buildingsOf=s => [s.prison, s.cem, ...Object.keys(BLDG).map(b => s[b])].filter(Boolean);
const foodCap = s => s.pop * 25 + 150 + (s.granary ? 300 + s.pop * 15 : 0);

function hull(noktalar) {
  noktalar = noktalar.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
  for (const p of noktalar) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of noktalar.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
   return lo.slice(0, -1).concat(up.slice(0, -1));
}
function wallShape(s)
{
  const ang = s.lay ? s.lay.ang : 0, c = Math.cos(ang), n = Math.sin(ang), M = 30, loc = [];
  for (const h of [...s.houses, ...buildingsOf(s), s]) {
    const dx = h.x - s.x, dy = h.y - s.y, u = dx * c + dy * n, v = -dx * n + dy * c;
    for (const [a, b] of [[-M, -M], [M, -M], [M, M], [-M, M]]) loc.push({ x: u + a, y: v + b });
  }
  const noktalar = hull(loc).map(p => ({ x: s.x + p.x * c - p.y * n, y: s.y + p.x * n + p.y * c }));
  let uzunluk = 0, r=0;
  noktalar.forEach((p, i) => { uzunluk += dist(p, noktalar[(i + 1) % noktalar.length]); r += dist(p, s); });

  return { pts: noktalar, len: uzunluk, r: r / noktalar.length };
}
function inPoly(noktalar, x, y)
{
  let ins = false;
  for (let i=0, j = noktalar.length - 1; i < noktalar.length; j = i++) {
    const a = noktalar[i], b = noktalar[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}
function wallRay(s, a)
{
  const w = s.walls, pts = w.pts, dx=Math.cos(a), dy = Math.sin(a);
  for (let i = 0; i < pts.length; i++) {
    const p=pts[i], q=pts[(i + 1) % pts.length], ex=q.x - p.x, ey = q.y - p.y, den = dx * ey - dy * ex;
    if (Math.abs(den)<1e-9) continue;
    const t = ((p.x - s.x) * ey - (p.y - s.y) * ex) / den, u = ((p.x - s.x) * dy - (p.y - s.y) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) return t;
  }
  return w.r;
}

function marry(a, b) {
  a.spouse = b; b.spouse = a;
  plog(a, lang`${fullName(b)} ile evlendi`); plog(b, lang`${fullName(a)} ile evlendi`);
}

function crown(k, p)
{
  leaveArmy(p);
  k.king = p;
  setJob(p, "king");
  if (k.capital) p.s = k.capital;
  k.reigns.push({ p, from: year() });
  plog(p, lang`${k.name} tahtına ${title(p)} olarak çıktı`);
}

function foundKingdom(rk, x, y, n) {
  const k = newKingdom(rk), s = makeSettlement(k, x, y), R = k.R;
  k.capital = s;
  const houses=[makeName(R.names), makeName(R.names), makeName(R.names)], ppl = [];
  for (let i = 0; i < n; i++) ppl.push(makePerson(rk, k, s, x + rnd(-10, 10), y + rnd(-10, 10),
    { age: CFG.adultAge + rnd(0, 16) | 0, female: i % 2 === 1, house: houses[i % 3] }));
  for (let i = 0; i + 1 < n; i += 2) if (Math.random() < 0.75) marry(ppl[i], ppl[i + 1]);
  crown(k, ppl.reduce((a, b) => a.stats.cha + a.stats.int >= b.stats.cha + b.stats.int ? a : b));
  s.pop = n; s.food = 120; s.wood = 40;

  chron(lang`🏰 ${k.name} kuruldu. Başkent: ${s.name}. İlk hükümdar: ${title(k.king)} ${fullName(k.king)}`, k);
  return k;
}

function setJob(p, j) {
  if (p.job === j) return;
  p.job = j; p.sub = null; p.tgt = null; p.dest = null;
  if (j !== 'farmer' && j !== 'child' && j !== 'king') plog(p, lang`${JOBS[j]} oldu`);
}
function leaveArmy(p) {
  if (!p.army) return;
  p.army.members = p.army.members.filter(q => q !== p);
  p.army = null;
  if (p.state === 'army') p.state = null;
}
function getRel(a, b) {
  let r = a.rel.get(b);
  if (!r) {
    r = { op: affinity(a.R.base, b.R.base), status: 'peace', trade: false, met: false, since: 0, kills: {}, hostileUntil: 0, claims: 0 };
    a.rel.set(b, r); b.rel.set(a, r);
  }
  return r;
}
const atWar = (a, b) => a !== b && a.rel.get(b)?.status === 'war';
function hostile(a, b) {
  if (a === b) return false;
  const r = a.rel.get(b);
  return !!r && (r.status === 'war' || Sim.tick < r.hostileUntil);
}
function allowed(v, h)
{
  if (v === h) return true;
  const r = h.rel.get(v);
  return !!r && (r.trade || r.status === 'alliance');
}
function countWars() {
  let n = 0;
  for (const k of Sim.kingdoms) for (const [o, r] of k.rel) if (r.status === 'war' || Sim.tick < r.hostileUntil) n++;
  Sim.wars = n / 2;
}
const kSettlements = k => Sim.settlements.filter(s => s.k === k && !s.dead);
function minDist(a, b) {
  let m = Infinity;
  for (const s of kSettlements(a)) for (const t of kSettlements(b)) m = Math.min(m, dist(s, t));
  return m;
}
const claimR = s => 90 + Math.sqrt(s.pop) * 14;
const isFighter = p => p.state === 'army' || isTroop(p) || p.job === 'guard';
const isTroop = p => p.job === 'soldier' || p.job === "archer" || p.job === 'cavalry' || p.job === 'artillery' || p.job === "spear" || p.job === 'shield' || NEW_JOBS.has(p.job);
const best = (liste, f) => liste.reduce((a, b) => f(a) >= f(b) ? a : b);
const vetMul = p => 1 + Math.min(10, p.vet || 0) * 0.03;
const UNIT_POW = { rifle: 1.6, rifleman: 1.5, hussar: 1.1, fieldgun: 2.5, gatling: 3, knight: 2, halberd: 1.15, xbow: 1.15, harcher: 1.25,
  trooper: 2.2, sapper: 1.8, flamer: 2, sniper: 2.2, mg: 4, mortar: 3, rocket: 3.5, tank: 8 };
const power = liste => liste.reduce((s, p) => s + (p.stats.str * p.R.size + p.stats.end * 0.5) * (UNIT_POW[p.job] || 1), 0);

const GB = 40, GW = Math.ceil(W / GB), GH = Math.ceil(H / GB);
const GRID = new Array(GW * GH);
function buildGrid() {
  const g = GRID;
  for (let i = 0; i < g.length; i++) if (g[i]) g[i].length = 0;
  for (const p of Sim.people) if (!p.dead) { const i = (p.y / GB | 0) * GW + (p.x / GB | 0); (g[i] || (g[i] = [])).push(p); }
  return g;
}
function near(g, x, y, r, fn) {
  const x0 = Math.max(0, (x - r) / GB | 0), x1 = Math.min(GW - 1, (x + r) / GB | 0);
  const y0 = Math.max(0, (y - r) / GB | 0), y1 = Math.min(GH - 1, (y + r) / GB | 0);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const b=g[j * GW + i]; if (b) for (const o of b) fn(o); }
}

const TURNS = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3];
const EDGE = 10, inMapX = x => clamp(x, EDGE, W - EDGE), inMapY = y => clamp(y, EDGE, H - EDGE);
function dryNear(p, tx, ty)
{
  for (let r = 8; r <= 160; r += 8) {
    let enIyi = null, bd = Infinity;
    for (let k=0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = tx + Math.cos(a) * r, y = ty + Math.sin(a) * r;
      if (!speedAt(x, y)) continue;
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d<bd) { bd = d; enIyi = [x, y]; }
    }
    if (enIyi) return enIyi;
  }
  return [p.x, p.y];
}
function moveTo(p, tx, ty, mult = 1)
{
  tx = inMapX(tx); ty = inMapY(ty);
  if (!speedAt(tx, ty)) {
    const d = p.dryC;
    if (d && Sim.tick - d.t < 30 && Math.abs(d.tx - tx) < 3 && Math.abs(d.ty - ty) < 3) { tx = d.x; ty = d.y; }
    else { const [x, y] = dryNear(p, tx, ty); p.dryC = { tx, ty, x, y, t: Sim.tick }; tx = x; ty = y; }
  }
  if (p.wp) {
     const W0 = p.wp;
    if (!W0.pts.length || Sim.tick > W0.until || (W0.tx - tx) ** 2 + (W0.ty - ty) ** 2 > 60 * 60) p.wp = null;
    else {
      const w = W0.pts[0];
      if (stepToward(p, w.x, w.y, mult) || (p.x - w.x) ** 2 + (p.y - w.y) ** 2 < 100) W0.pts.shift();
      return false;
    }
  }
  if (p.detour) {
    if (--p.detour.t <= 0 || stepToward(p, p.detour.x, p.detour.y, mult)) p.detour = null;
    return false;
  }

  if (p.stuck < (p.lastD || 0)) p.lastD = p.stuck;
  if (p.stuck > (p.lastD || 0) + 60) {
    p.lastD=p.stuck;
    if (Sim.pathBudget > 0 && (tx - p.x) ** 2 + (ty - p.y) ** 2 > 400) {
       Sim.pathBudget--;
      const path = findPath(p.x, p.y, tx, ty);
      if (path && path.length) { p.wp = { pts: path, tx, ty, until: Sim.tick + 900 }; p.detour = null; return false; }
    }
    const a = Math.atan2(ty - p.y, tx - p.x) + p.side * rnd(1.2, 2.2), d = rnd(30, 70);
    p.detour = { x: inMapX(p.x + Math.cos(a) * d), y: inMapY(p.y + Math.sin(a) * d), t: 140 };
    return false;
  }
  return stepToward(p, tx, ty, mult);
}

let SNOW_T = -1, SNOW_V = 0;
const snowNow = () => { if (SNOW_T !== Sim.tick) { SNOW_T = Sim.tick; SNOW_V = snowAmt(); } return SNOW_V; };
function stepToward(p, tx, ty, mult = 1) {
  if (p.trapT>Sim.tick) return false;
  if (p.slowT>Sim.tick) mult *= 0.5;
  const dx=tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 2.5) return true;

  const free = !p.army && p !== Sim.ctrl;
  const taban = Math.atan2(dy, dx) + (free && d > 25 ? Math.sin(Sim.tick * 0.035 + p.id * 1.3) * 0.35 : 0);

  const tempo = (free ? (p.pace || 1) * (1 + Math.sin(Sim.tick * 0.06 + p.id * 2.1) * 0.12) * (d < 10 ? 0.55 + d * 0.045 : 1) : 1)
    * (1 - snowNow() * 0.2) * (p.sick ? 0.7 : 1) * unitPace(p);
  const sp = Math.min(d, CFG.walk * (0.6 + p.stats.spd * 0.08) * (p.job === 'child' ? 0.7 : 1) * mult * tempo);
  for (const off of TURNS) {
    const a = taban + off * p.side, nx = p.x + Math.cos(a) * sp, ny = p.y + Math.sin(a) * sp;
    let v = speedAt(nx, ny, p);
    if (v > 0) {
      if (Sim.trenches.length && p.army) v *= trenchSlow(p, nx, ny);
      p.x += Math.cos(a) * sp * v; p.y += Math.sin(a) * sp * v; p.a = free ? p.a + angDiff(p.a, a) * 0.3 : a;
      p.stuck = off ? p.stuck + 1 : Math.max(0, p.stuck - 1);
      const i = trailIdx(p.x, p.y);
      Sim.trail[i] = Math.min(60, Sim.trail[i] + 0.12);
      return false;
    }
  }
  p.stuck += 5; p.side=-p.side;
  return false;
}
function wanderNear(p, c, r) {
  if (p.wait > 0) {
    p.wait--;
    if (Math.random()<0.02) p.lookA = p.a + rnd(-1.5, 1.5);
    if (p.lookA != null) p.a += angDiff(p.a, p.lookA) * 0.1;

    return;
  }
  if (!p.tgt || p.stuck > 150 || moveTo(p, p.tgt.x, p.tgt.y)) {
    const a = rnd(0, 6.28), d = rnd(0, r);
    p.tgt = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
    p.stuck = 0; p.wait = rnd(40, 160) | 0;
  }
}
function homeOf(p) {
  const hs = p.s.houses;
  if (!hs.length) return p.s;
  if (!p.home || !hs.includes(p.home)) p.home = (p.spouse && hs.includes(p.spouse.home)) ? p.spouse.home : pick(hs);
  return p.home;
}
const homeSpot = p => { const h = homeOf(p); return { x: h.x + rnd(-7, 7), y: h.y + rnd(-7, 7) }; };

const BODY_R = { cavalry: 5.5, hussar: 5.5, knight: 5.8, harcher: 5.5, tank: 7.5, artillery: 5, fieldgun: 5, gatling: 5, mg: 4.5, mortar: 4.5, rocket: 5 };
const bodyR = p => p.state !== 'army' ? 3.4 : BODY_R[p.job] || 3.6;
const SHUF_A = [], SHUF_B = [];
function shuffledPeople(a = SHUF_A) {
  const src = Sim.people, n = src.length;
  a.length = n;
  for (let i = 0; i < n; i++) a[i] = src[i];
  for (let i = n - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
const SB = 12, SBW = Math.ceil(W / SB), SBH = Math.ceil(H / SB), SEP_HEAD=new Int32Array(SBW * SBH), SEP_LIVE = [];
let SEP_NEXT = new Int32Array(1024);
function separate() {

  const canli = SEP_LIVE;
   canli.length = 0;
  SEP_HEAD.fill(-1);
  for (const q of Sim.people) {
    if (q.dead) continue;
    const i = canli.length;
    canli.push(q);
    if (i >= SEP_NEXT.length) { const nx = new Int32Array(SEP_NEXT.length * 2); nx.set(SEP_NEXT); SEP_NEXT=nx; }
    const c = Math.min(SBH - 1, Math.max(0, q.y / SB | 0)) * SBW + Math.min(SBW - 1, Math.max(0, q.x / SB | 0));
    SEP_NEXT[i] = SEP_HEAD[c]; SEP_HEAD[c] = i;
  }
   for (const p of shuffledPeople(SHUF_B)) {
    if (p.dead || p.state === 'jailed' || p.state === "arrested" || downed(p)) continue;
    const rp = bodyR(p);
    const x0 = Math.max(0, (p.x - 13) / SB | 0), x1 = Math.min(SBW - 1, (p.x + 13) / SB | 0);
    const y0 = Math.max(0, (p.y - 13) / SB | 0), y1 = Math.min(SBH - 1, (p.y + 13) / SB | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (let j = SEP_HEAD[cy * SBW + cx]; j >= 0; j = SEP_NEXT[j]) {
      const q = canli[j];

      if (q === p || q.dead || q.state === 'jailed' || downed(q)) continue;
      const R = rp + bodyR(q);
      let dx = p.x - q.x, dy = p.y - q.y, dd = dx * dx + dy * dy;
      if (dd>R * R) continue;
      if (dd<0.01) { dx=rnd(-1, 1); dy = rnd(-1, 1); dd = dx * dx + dy * dy; }
      const d = Math.sqrt(dd), f = (R - d) * (p.army && q.army ? 0.3 : 0.2) / d, nx = p.x + dx * f, ny = p.y + dy * f;
      if (speedAt(nx, ny)) { p.x = nx; p.y = ny; }
    }
  }
}

function controlled(p) {
  const dx = (KEYS.d || KEYS.arrowright ? 1 : 0) - (KEYS.a || KEYS.arrowleft ? 1 : 0);
  const dy = (KEYS.s || KEYS.arrowdown ? 1 : 0) - (KEYS.w || KEYS.arrowup ? 1 : 0);
  if (dx || dy) { const n = Math.hypot(dx, dy); stepToward(p, p.x + dx / n * 10, p.y + dy / n * 10, 1.4); }
}
function playerAttack(p) {
  if (!Sim.grid || p.dead) return;
  const G=GUNS[p.job], art = (bj(p) === 'artillery' || p.job === 'tank') && !G, flame = p.job === 'flamer', ranged = art || !!G || flame || bj(p) === 'archer';
  const R = art ? (SHELLS[p.job] ? SHELLS[p.job].R : ART_R) : G ? G.r : flame ? 50 : ranged ? 120 : 16;
  if (p.atkT && Sim.tick - p.atkT < (art ? 90 : G ? Math.max(6, G.reload / 2) : ranged ? 30 : 10)) return;
  let dusman=null, fd = R * R, any = null, ad = 16 * 16;
  near(Sim.grid, p.x, p.y, R, q => {
    if (q === p || q.dead || q.state === 'jailed') return;
    const d = dist2(p, q);

    if (hostile(p.k, q.k) && d < fd) { fd = d; dusman = q; }
    if (d < ad) { ad = d; any = q; }
  });
  if (!dusman && !ranged) dusman=any;
  if (!dusman) { say(p, '❔', 30); return; }
  p.atkT = Sim.tick; p.loud = Sim.tick;
  p.a=Math.atan2(dusman.y - p.y, dusman.x - p.x);
  const legal = hostile(p.k, dusman.k);
  if (!legal) {
    if (!p.criminal) plog(p, lang`${fullName(dusman)} adlı kişiye saldırdı`);
    p.criminal = true;
    if (dusman.k !== p.k) getRel(p.k, dusman.k).op -= 2;
  }
  if (art) return fireShell(p, dusman.x, dusman.y);
  if (flame) return fireFlame(p);
  if (G && dist2(p, dusman) > 14 * 14) return fireBullet(p, dusman, G.dmg * vetMul(p), G.spread);
  if (bj(p) === "archer" && dist2(p, dusman) > 14 * 14) return fireArrow(p, dusman, (2 + p.stats.spd * 0.25 + p.stats.int * 0.2) * 0.9 * techMul(p.k) * vetMul(p) * (p.job === 'xbow' ? 2.4 : 1), p.job === 'xbow');
  dusman.hp -= (2 + p.stats.str * 0.8) * p.R.size * rnd(0.7, 1.3) / (0.6 + dusman.stats.end * 0.08);
  dusman.hitT = Sim.tick; dusman.hitBy = p; dusman.loud = Sim.tick;
  Sim.fx.push({ x: dusman.x, y: dusman.y, t: 8, type: 'hit' });
  if (dusman.hp <= 0) kill(dusman, p, legal ? "savaş" : 'cinayet');
}

function gather(p, sonuc)
{
  const s = p.s;
  if (p.sub==='work') {
    if (--p.timer<=0) { p.sub='home'; p.tgt = homeSpot(p); }
    if (sonuc === 'fish' && s.port) p.a = Math.atan2(s.port.y - p.y, s.port.x - p.x);
    else if ((Sim.tick + p.id) % 30 === 0) p.lookA = p.a + rnd(-1.2, 1.2);
    if (p.lookA != null && sonuc !== 'fish') p.a += angDiff(p.a, p.lookA) * 0.15;
    if ((Sim.tick + p.id) % 45 === 0) { const nx = p.x + rnd(-2, 2), ny = p.y + rnd(-2, 2); if (speedAt(nx, ny)) { p.x = nx; p.y = ny; } }
    return;
  }
  if (p.sub === 'home') { if (moveTo(p, p.tgt.x, p.tgt.y) || p.stuck > 300) deposit(p, sonuc); return; }
  if (p.sub!=='go') {
    const list = sonuc === "fish" ? (s.port ? [{ x: s.port.lx, y: s.port.ly, i: -1 }] : []) : s.spots[sonuc];
    if (!list.length) return wanderNear(p, s, s.r);
    p.spot=list[Math.floor(Math.random() ** 2 * list.length)];
    p.tgt = { x: p.spot.x + rnd(-4, 4), y: p.spot.y + rnd(-4, 4) };
    p.sub='go'; p.stuck = 0;
  }
  if (moveTo(p, p.tgt.x, p.tgt.y) || p.stuck > 250) {
    p.sub = 'work'; p.timer = CFG.workTicks * rnd(0.7, 1.4);
    if (sonuc === "food" && s.fields.size < 40) s.fields.add(p.spot.i);
  }
}

function deposit(p, sonuc) {
  const s = p.s, st = p.stats, w = 0.8 + trait(p, 'work') * 0.2;
  if (sonuc === 'food') s.food += (21 + st.int) * w * seasonFarm() * (1 + s.k.tech * 0.08) * (s.k.drought > Sim.tick ? 0.4 : 1);
  else if (sonuc==='fish') s.food += (12 + st.int) * w * (snowAmt() > 0.5 ? 0.6 : 1);
  else if (sonuc === 'wood') s.wood += (4 + st.str * 0.5) * w;
  else {
    s.stone += 3 + st.str * 0.4;
    if (Math.random() < 0.25) { const g = rnd(4, 14) | 0; s.k.gold += g; p.gold += 2; if (g > 12) plog(p, lang`madende altın damarı buldu (+${g})`); }
  }
  s.food = Math.min(s.food, foodCap(s));
  p.gold += 1; s.k.gold += 0.5;
  p.sub = null; p.tgt = null; p.afterWork = true;
}

function build(p)
{

  const pr=p.s.project;
  if (!pr) return gather(p, 'food');
  if (!p.bo) p.bo = { x: rnd(-4, 4), y: rnd(-4, 4) };
  if (!moveTo(p, pr.x + p.bo.x, pr.y + p.bo.y) && p.stuck < 200) return;
  pr.progress += 0.5 + p.stats.int * 0.08;
  if (pr.progress>=pr.cost) finishProject(p.s, p);
}

function finishProject(s, p) {
  const pr = s.project;
  s.project = null;
  if (pr.type === 'house') {
    s.houses.push({ x: pr.x, y: pr.y }); s.cap += CFG.houseCap;
    s.r = Math.max(24 + Math.sqrt(s.houses.length) * 5, ...s.houses.map(h => dist(h, s) + 8));
    s.fields.delete((pr.y / CFG.tile | 0) * CFG.cols + (pr.x / CFG.tile | 0));
  }
  else if (pr.type==='prison') { s.prison = { x: pr.x, y: pr.y }; chron(lang`⛓ ${s.name} bir hapishane inşa etti`, s.k, null, s); }
  else if (pr.type==='wallExt') { Object.assign(s.walls, wallShape(s)); s.walls.max += 60; s.walls.hp += 60; chron(lang`🧱 ${s.name} büyüyen mahallelerini de içine alacak şekilde surlarını genişletti`, s.k, null, s); }
  else if (pr.type === 'walls') { const mx = 300 + s.k.tech * 100; s.walls = { ...wallShape(s), hp: mx, max: mx }; chron(lang`🧱 ${s.name} surlarla çevrildi`, s.k, null, s); plog(p, lang`${s.name} surlarını tamamladı`); }
  else if (pr.type==='repair') { s.walls.hp = s.walls.max; slog(s, lang("🧱 Surlar onarıldı")); }
  else if (pr.type==='keep') { s.keep=true; chron(lang`🏯 ${s.name} bir kale inşa etti`, s.k, null, s); }
  else if (pr.type === 'port') { s.port = pr.spot; chron(lang`⚓ ${s.name} bir liman inşa etti`, s.k, null, s); }
  else if (BLDG[pr.type]) {
    const B = BLDG[pr.type], of = pr.type === "monument" && s.k.king ? lang`${title(s.k.king)} ${fullName(s.k.king)}` : null;
    s[pr.type] = { x: pr.x, y: pr.y, of };
    chron(lang`${B.icon} ${s.name} bir ${B.name.toLowerCase()} inşa etti${of ? lang`: ${of} onuruna dev bir heykel dikildi` : ''}`, s.k, null, s);
  }
  if (pr.type==='house') slog(s, lang`🏠 Yeni bir ev yapıldı (${fullName(p)})`);
}

function guardJob(p, g) {
  const s = p.s;
  if (p.sub === 'escort') {
    const q = p.prisoner;

    if (!q || q.dead || q.state !== 'arrested') { p.sub = null; return; }
    const pr = s.prison || s;
    if (moveTo(p, pr.x, pr.y) || p.stuck > 300) jail(q, p);
    return;
  }
  if (p.sub === 'chase') {
    const q = p.foe;
    if (!q || q.dead || q.state === 'jailed' || q.state === 'arrested' || dist2(p, s) > (s.r + 140) ** 2) { p.sub = null; p.foe = null; return; }
    if (dist2(p, q) < 30) return arrest(q, p);
    moveTo(p, q.x, q.y, 1.25);
    return;
  }
  if ((Sim.tick + p.id) % 15 === 0) {
     let dusman = null, fd = 85 * 85;
    near(g, p.x, p.y, 85, q => {
      if (q === p || q.dead || q.state === 'jailed' || q.state === 'arrested') return;
      const d = dist2(p, q);
      if (d >= fd) return;
      if (q.army) return;

      const inTown = dist2(q, s) < (s.r + 15) ** 2, intruder = q.k !== p.k && !allowed(q.k, p.k) && inTown;
      if ((q.criminal && (q.s === s || inTown)) || intruder) { fd = d; dusman = q; }
    });
    if (dusman) {
      p.sub='chase'; p.foe=dusman;
      plog(p, lang`şüpheli ${fullName(dusman)} peşine düştü`);
      return;
    }
  }
  if (!p.tgt || p.stuck > 150 || moveTo(p, p.tgt.x, p.tgt.y)) {
    const a = rnd(0, 6.28), r = (s.walls ? wallRay(s, a) - 6 : s.r) * rnd(0.6, 1);

    p.tgt={ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r }; p.stuck=0;
  }
}

function arrest(q, g) {
  leaveArmy(q);
  q.state = "arrested"; q.captor=g;
  g.sub="escort"; g.prisoner = q; g.foe = null;
  plog(q, lang`${g.s.name} bekçisi ${fullName(g)} tarafından yakalandı`);
  plog(g, lang`${fullName(q)} adlı kişiyi tutukladı`);
  slog(g.s, lang`🚔 Bekçi ${fullName(g)}, ${q.k !== g.k ? lang`${q.k.name} halkından ` : ''}${fullName(q)} adlı ${q.spy ? lang('casus şüphelisini') : q.criminal ? lang('suçluyu') : lang('yabancıyı')} yakaladı`);
}

function jail(q, g)
{
  const s = g.s, pr = s.prison || s;
  g.sub = null; g.prisoner = null;
  q.state = 'jailed'; q.jailAt = s; q.x=pr.x + rnd(-2, 2); q.y = pr.y + rnd(-2, 2);
  q.jail = CFG.year * (q.criminal ? 1.5 : 0.7);
  let said;
  if (q.spy) {
    const broke = q.stats.int < g.stats.int + rnd(-2, 3);
    said = broke ? lang('casus olduğunu itiraf etti') : lang('sorguda tek kelime etmedi');
     if (broke && atWar(s.k, q.k)) {
      plog(g, lang`${fullName(q)} sorguya çekildi: ${said}`);
      chron(lang`⚖️ ${q.k.name} casusu ${fullName(q)}, ${s.name} şehrinde idam edildi`, s.k, q.k);
      return kill(q, null, 'idam');
    }
  } else if (q.criminal) {
    said = lang('suçunu itiraf etti, çaldıkları sahibine geri verildi');
    if (q.loot && !q.loot.v.dead) { const miktar = Math.min(q.gold, q.loot.amt); q.gold -= miktar; q.loot.v.gold += miktar; }
  } else said=pick([lang('sadece bir gezgin olduğunu söyledi'), lang('yolunu kaybettiğini söyledi'), lang('akrabalarını ziyarete geldiğini söyledi'), lang('tüccar olduğunu iddia etti')]);
  plog(q, lang`sorguya çekildi: ${said}`);

  plog(g, lang`${fullName(q)} sorguya çekildi: ${said}`);
  slog(s, lang`⛓ ${fullName(q)} hapse atıldı ve sorguya çekildi: ${said}`);
}

function release(q) {
  q.state=null;

  if (q.criminal && maybeOutlaw(q)) return;
  if (q.k !== q.jailAt.k) { q.job = 'wanderer'; q.sub = 'return'; q.intruder = false; plog(q, lang`hapisten çıkıp sınır dışı edildi`); }
  else { q.criminal=false; q.sub = null; plog(q, lang('cezasını çekip hapisten çıktı')); }
}

function wanderJob(p) {
  if (p.sub === 'return' || !p.dest || p.dest.dead) {
     if (moveTo(p, p.s.x, p.s.y) || p.stuck > 400) { p.job = 'farmer'; p.sub = null; p.spy = false; p.dest = null; plog(p, lang('yolculuğundan evine döndü')); }
    return;
  }
  const d = p.dest;
  if (p.sub === 'visit') { if (--p.timer <= 0) p.sub = 'return'; else wanderNear(p, d, d.r * 0.7); return; }
  if (dist2(p, d)>d.r ** 2) { moveTo(p, d.x, d.y); if (p.stuck > 500) p.sub = 'return'; return; }
  p.sub='visit'; p.timer=250;
  if (allowed(p.k, d.k)) return plog(p, lang`${d.name} şehrini ziyaret etti`);
  p.intruder = true;
  if (d.walls) {
    plog(p, lang`${d.name} surlarından atlayarak içeri girdi`);
    slog(d, lang`🧗 ${p.k.name} halkından ${fullName(p)} surlardan atlayıp içeri girdi`);
  } else { plog(p, lang`${d.name} köyüne izinsiz girdi`); slog(d, lang`👣 Yabancı ${fullName(p)} (${p.k.name}) izinsiz içeri girdi`); }
}

function tradeJob(p) {
  if (p.sub === 'back') {
    if (moveTo(p, p.s.x, p.s.y) || p.stuck > 400) { p.sub = null; p.dest = null; }
    return;
  }
   if (!p.dest || p.dest.dead || !p.k.rel.get(p.dest.k)?.trade) {
    const opts = Sim.settlements.filter(s => !s.dead && s.k !== p.k && p.k.rel.get(s.k)?.trade);
    if (!opts.length) return gather(p, 'food');
    p.dest = opts.reduce((a, b) => dist2(a, p) < dist2(b, p) ? a : b); p.stuck = 0;
  }
  if (moveTo(p, p.dest.x, p.dest.y) || p.stuck > 400) {
    const g = 8 + p.stats.cha * 2;
    p.gold += g; p.k.gold += g; p.dest.k.gold += g / 2;
    plog(p, lang`${p.dest.name} pazarında ticaret yaptı (+${g} altın)`);
    p.sub = 'back';
  }
}

const JOB_FN = {
  child: p => wanderNear(p, homeOf(p), 16),
  king: p => wanderNear(p, p.s, 16),
  farmer: p => gather(p, "food"),
  wood: p => gather(p, 'wood'),
  miner: p => gather(p, 'stone'),
  builder: build,
  guard: guardJob,
  soldier: p => wanderNear(p, p.s, p.s.r + 35),
  archer: p => wanderNear(p, p.s, p.s.walls ? p.s.walls.r : p.s.r + 20),
  cavalry: p => wanderNear(p, p.s, p.s.r + 45),
  artillery: p => wanderNear(p, p.s, p.s.r + 10),
  merchant: tradeJob,
  wanderer: wanderJob,
  fisher: p => p.s.port ? gather(p, 'fish') : gather(p, 'food'),
  hunter: p => huntJob(p),
  healer: p => healJob(p),
  spear: p => wanderNear(p, p.s, p.s.r + 35),
  shield: p => wanderNear(p, p.s, p.s.r + 35),
  medic: p => wanderNear(p, p.s, p.s.r + 15),
  rifle: p => wanderNear(p, p.s, p.s.r + 35),
  rifleman: p => wanderNear(p, p.s, p.s.r + 20),
  hussar: p => wanderNear(p, p.s, p.s.r + 45),
  fieldgun: p => wanderNear(p, p.s, p.s.r + 10),
  gatling: p => wanderNear(p, p.s, p.s.r + 10),
  knight: p => wanderNear(p, p.s, p.s.r + 45), harcher: p => wanderNear(p, p.s, p.s.r + 45), halberd: p => wanderNear(p, p.s, p.s.r + 35), xbow: p => wanderNear(p, p.s, p.s.r + 20),
  trooper: p => wanderNear(p, p.s, p.s.r + 35), sapper: p => wanderNear(p, p.s, p.s.r + 30), flamer: p => wanderNear(p, p.s, p.s.r + 30), sniper: p => wanderNear(p, p.s, p.s.r + 25),
  mg: p => wanderNear(p, p.s, p.s.r + 10), mortar: p => wanderNear(p, p.s, p.s.r + 10), rocket: p => wanderNear(p, p.s, p.s.r + 10), tank: p => wanderNear(p, p.s, p.s.r + 40),
};

function updatePerson(p, g) {
  if ((Sim.tick + p.id) % CFG.year === 0) personYear(p);
  if (p.dead) return;
  if (p.hp < p.maxHp && !p.sick) p.hp = Math.min(p.maxHp, p.hp + 0.01);
  if (p.sick && Sim.arena) p.sick = null;
  if (p.sick && (Sim.tick + p.id) % 5 === 0) { sickTick(p, g); if (p.dead) return; }
  if (p.state === 'jailed') { if (--p.jail<=0) release(p); return; }
  if (p.state === 'arrested') {
    const c = p.captor;
    if (!c || c.dead || c.prisoner !== p) { p.state = null; plog(p, lang('kaçmayı başardı')); return; }
    moveTo(p, c.x - Math.cos(c.a) * 4, c.y - Math.sin(c.a) * 4, 1.3);
    return;
  }
  if (p === Sim.ctrl) return controlled(p);
  if (p.state==='courier') return courierMove(p, g);
  if (p.state === "wounded") return woundedTick(p);
  if (p.state==='healing') return healingTick(p);
  if (Sim.monsters.length && monsterReact(p)) return;
  if (p.posse && posseMove(p)) return;
  if (defendTown(p, g)) { if ((Sim.tick + p.id) % 6 === 0) fight(p, g); return; }
  if (Sim.wars > 0 && (Sim.tick + p.id) % 6 === 0 && fight(p, g)) return;
  if (p.state === 'army') return armyMove(p, g);
  if (p.state === 'migrate') { if (moveTo(p, p.s.x + rnd(-8, 8), p.s.y + rnd(-8, 8)) || p.stuck > 800) p.state = null; return; }
  if (p.rally > Sim.tick && civRally(p, g)) return;
  if (p.flee > 0) { p.flee--; moveTo(p, p.s.x, p.s.y, 1.2); return; }
  if (Sim.wars > 0 && !isFighter(p) && (Sim.tick + p.id) % 12 === 0) {
     let danger = false;
    near(g, p.x, p.y, 45, q => { if (!danger && !q.dead && isFighter(q) && hostile(p.k, q.k)) danger = true; });
    if (danger) {
      if (p.brave==null) { const r = Math.random(); p.brave = r < 0.5 ? 'join' : r < 0.8 ? 'fight' : 'flee'; }
      const able = isAdult(p) && !p.state && p.job !== 'king';
      if (able && p.brave === 'join' && civJoin(p)) return;
      if (able && p.brave !== 'flee') { p.rally = Sim.tick + 400; say(p, '🔱', 60); return; }
      p.flee = 120; return;
    }
  }
  if (lifeAct(p, g)) return;
  JOB_FN[p.job](p, g);
}

function civJoin(p)
{
  let A = null, bd = 350 * 350;
  for (const B of p.k.armies) {
    if (!B.cmd || B.cmd.dead || B.members.length >= 90 || ['sail', 'embark', 'retreat'].includes(B.state)) continue;
     const d = dist2(p, B.cmd);
    if (d < bd) { bd = d; A = B; }
  }
  if (!A) return false;
  setJob(p, 'soldier'); p.rally = 0;
  A.members.push(p); A.start++; sortRanks(A);
  plog(p, lang`köyünü korumak için gönüllü olarak orduya katıldı`); say(p, '🛡', 80);
  return true;

}

function civRally(p, g)
{
  let dusman = null, fd = 60 * 60;
  near(g, p.x, p.y, 60, q => { if (!q.dead && isFighter(q) && hostile(p.k, q.k)) { const d = dist2(p, q); if (d < fd) { fd = d; dusman=q; } } });
  if (!dusman) { p.rally = 0; return false; }
  if (fd > 64) moveTo(p, dusman.x, dusman.y, 1.1);
  else if ((Sim.tick + p.id) % 6 === 0) fight(p, g);
  return true;
}

function personYear(p) {
  p.age++;
  if (p.age === CFG.adultAge && p.job === 'child') { setJob(p, 'farmer'); plog(p, lang('yetişkin oldu')); }
  if (p.criminal && Math.random() < 0.4) p.criminal = false;
  for (const q of p.ties.keys()) if (q.dead) p.ties.delete(q);
  const ratio = p.age / p.life;
  if (ratio > 0.8 && Math.random() < (ratio - 0.8) * 1.5) kill(p, null, 'yaşlılık');
}

function fight(p, g) {
  if (p.state === "jailed" || p.state === 'arrested') return false;
  const A = p.army, armed = !A && p.rally > Sim.tick, defender = !A && (armed || p.job === 'guard' || p.job === 'soldier' || p.job === 'king');
  if (!A && !defender) return false;
  if (p.job==='medic') return false;
  if (A && routing(A)) return false;
   let dusman = null, fd = 100;
  near(g, p.x, p.y, 10, q => {
    if (q === p || q.dead || q.state === 'jailed' || q.state === 'arrested' || downed(q) || !hostile(p.k, q.k)) return;
    const civ = !q.army && q.state !== 'courier' && q !== Sim.ctrl && q.job !== "guard" && q.job !== 'soldier' && q.job !== "king" && !(q.rally > Sim.tick);
    if ((civ && !(A && A.massacre)) || (!A && !q.army && !(armed && isFighter(q)))) return;
    const d = dist2(p, q);
    if (d < fd) { fd = d; dusman=q; }
  });
  if (!dusman) return false;
  let hasar = (1.5 + p.stats.str * 0.6) * p.R.size * rnd(0.6, 1.4) * 0.75 * (MELEE_SKILL[p.job] || 1) * meleeMul(p, dusman) * (armed ? 0.6 : 1);
  hasar *= techMul(p.k) / (1 + dusman.k.tech * 0.05) * (p.s && p.s.barracks ? 1.15 : 1);
  hasar *= takenMul(dusman, false) * vetMul(p);
  if (A) {
    hasar *= FORM_DMG[A.form];
    const taraf = Math.abs(angDiff(dusman.a, Math.atan2(p.y - dusman.y, p.x - dusman.x)));
    if (taraf > 1.9 && !(dusman.army && dusman.army.form === 'schiltron')) { hasar *= 1.4; dusman.hitSide = Sim.tick + 60; }
    else if (taraf < 1.2 && dusman.army) hasar *= formOf(dusman.army).front;

    if (A.turnUntil > Sim.tick) hasar *= 1.3;
    if (A.battle && A.btac === 'hold' && A.battle.t < 500) hasar *= 1.2;
    if (A.order && (A.order.type === 'hold' || A.order.type === "shape")) hasar *= 1.2;
    if (!A.cmdLost) hasar *= 1.1;
    if (onHill(p) && !onHill(dusman)) hasar *= 1.2;
    if (p.forgeT > Sim.tick) hasar *= 1.1;
    if (A.battle && dusman.army && dusman.army.battle) hasar *= A.lv ? 0.35 : 0.6;
    if (dusman.army && routing(dusman.army)) hasar *= 1.5;
  }
  const w = dusman.s.walls;
  if (w && w.hp > 0 && dusman.s.k === dusman.k && inPoly(w.pts, dusman.x, dusman.y)) hasar *= 0.7;
  dusman.hp -= hasar / (0.6 + dusman.stats.end * 0.08);
  dusman.hitT = Sim.tick; dusman.hitBy = p;
  if (dusman.army && A && dusman.army !== A) { dusman.army.hitT = Sim.tick; dusman.army.hitBy = A; }
  p.loud = dusman.loud = Sim.tick;
  p.a = Math.atan2(dusman.y - p.y, dusman.x - p.x);
  Sim.fx.push({ x: dusman.x, y: dusman.y, t: 8, type: 'hit' });
  if (dusman.hp <= 0) kill(dusman, p, 'savaş');
  return true;
}

const MELEE_SKILL = { archer: 0.5, rifleman: 0.55, rifle: 0.85, xbow: 0.55, trooper: 0.8, sapper: 0.9, flamer: 0.6, sniper: 0.5 };
const ARENA_NODIE = ["yaşlılık", 'açlık', 'veba'];
function kill(q, killer, sebep)
{
  if (q.dead) return;
  if (woundInstead(q, sebep)) return;
  if (Sim.arena && !killer && (ARENA_NODIE.includes(sebep) || (q.sick && q.sick.d && sebep === q.sick.d.name))) { q.hp = Math.max(q.hp, 1); q.sick = null; return; }
  q.dead=true; q.deathYear = year(); q.cause = sebep;
  if (Sim.ctrl === q) Sim.ctrl=null;
  Sim.deaths[sebep] = (Sim.deaths[sebep] || 0) + 1;

  leaveArmy(q);
  if (q.spouse && q.spouse.spouse === q) { plog(q.spouse, lang`eşi ${q.name} öldü (${sebep})`); q.spouse.spouse = null; }
  if (killer) {
    killer.kills++; killer.k.kills++; q.k.deaths++;
    if (killer.army && (q.army || isFighter(q))) { killer.vet = (killer.vet || 0) + 1; if (killer.vet === 5) plog(killer, lang('savaşlarda pişip gazi oldu')); }
    plog(killer, lang`öldürdü: ${fullName(q)} (${q.k.name})`);
    plog(q, lang`öldürüldü. Katili: ${fullName(killer)}`);
    const r = killer.k.rel.get(q.k);
    if (r) r.kills[killer.k.id] = (r.kills[killer.k.id] || 0) + 1;
    if (killer.kills===10) chron(lang`🗡 ${fullName(killer)} 10. düşmanını öldürdü, adı efsaneye karıştı`, killer.k);
  } else plog(q, lang`öldü (${sebep})`);
  if (q.kills >= 3 || q.k.king === q) Sim.hall.push(q);
  if (q.s) q.s.deathsY++;
  onDeath(q);
  if (q.k.king===q) {
    q.k.king = null;

    chron(lang`👑 ${title(q)} ${fullName(q)} öldü (${sebep}). ${q.k.name} yasta`, q.k);
    succession(q.k, q);
  }
}

function succession(k, eski) {

  if (k.dead) return;
  if (k.republic) return election(k, true);
  const kids = eski ? eski.children.filter(c => !c.dead && c.k === k && isAdult(c) && c.state !== 'jailed') : [];
  let heir = kids.sort((a, b) => b.age - a.age)[0];
  if (!heir) {
    const pool = Sim.people.filter(p => !p.dead && p.k === k && isAdult(p) && p.state !== 'jailed' && p.state !== 'arrested');
    if (!pool.length) return;
    heir = best(pool, p => p.stats.cha + p.stats.int);
  }
  crown(k, heir);
  chron(lang`👑 ${fullName(heir)} ${k.name} tahtına çıktı${kids.includes(heir) ? lang` (${eski.name} soyundan)` : ''}`, k);
}

function settlementYear(s)
{
  const sonuc = Sim.people.filter(p => !p.dead && p.s === s);
  s.pop = sonuc.length;
  if (!sonuc.length) return abandon(s);
  computeSpots(s);
  if (s.births || s.deathsY) slog(s, lang`📊 Yıl özeti: ${s.births} doğum, ${s.deathsY} ölüm, nüfus ${s.pop}`);
  s.births = 0; s.deathsY = 0;
  s.stab += (stability(s, sonuc) - s.stab) * 0.5;
  if (s.market) s.k.gold += Math.round(s.pop * 0.5);
  if (s.food < 0 && s.k.gold > 30) buyFood(s);
  const yetiskinler = sonuc.filter(p => isAdult(p) && p.state !== 'jailed' && p.state !== 'arrested');
  s.level = s.pop >= CFG.keepPop ? lang('Şehir') : s.pop >= CFG.prisonPop + 6 ? lang('Kasaba') : lang('Köy');
  assignJobs(s, yetiskinler);
  marriages(yetiskinler);
  births(s, sonuc);
  plan(s);
  buildShips(s);
  if (s.food < 0) famine(s, sonuc);
  expand(s, yetiskinler);
  events(s, yetiskinler);
  mergeCheck(s);

}

function mergeCheck(s) {
  if (s.dead) return;
  const o = Sim.settlements.find(o => o !== s && !o.dead && o.k === s.k && dist(o, s) < s.r + o.r + 60);
  if (!o) return;
  const k = s.k, big = k.capital === o || (k.capital !== s && o.pop > s.pop) ? o : s;
  mergeTowns(big, big === s ? o : s);

}
function mergeTowns(big, small)
{
  const k=big.k;

  for (const p of Sim.people) {
    if (p.s===small) p.s = big;
    if (p.dest===small) p.dest = big;
  }
  big.houses.push(...small.houses); big.cap += small.cap;
  for (const f of small.fields) big.fields.add(f);
  big.food += small.food; big.wood += small.wood; big.stone += small.stone; big.pop += small.pop;
  for (const b of ["prison", 'cem', 'port', 'keep', ...Object.keys(BLDG)]) if (!big[b] && small[b]) big[b] = small[b];
  if (!big.graves && small.graves) { big.graves = small.graves; big.graveN = small.graveN; }
  big.r = Math.max(big.r, ...big.houses.map(h => dist(h, big) + 8));
  if (big.walls || small.walls) {
    const hp = Math.max(big.walls?.hp || 0, small.walls?.hp || 0), mx = Math.max(big.walls?.max || 0, small.walls?.max || 0);
    big.walls={ ...wallShape(big), hp, max: mx };
    if (big.project && /^(walls|wallExt|repair)$/.test(big.project.type)) big.project = null;
  }
  for (const sh of Sim.ships) if (sh.home === small) sh.home = big;
  for (const kk of Sim.kingdoms) for (const A of kk.armies) if (A.target===small) A.target = big;
  for (const m of Sim.monsters) if (m.target === small) m.target = big;
  if (Sim.selS === small) Sim.selS = big;
  if (k.capital === small) k.capital = big;
  small.dead = true; small.houses = [];
  Sim.settlements = Sim.settlements.filter(x => x !== small);
  Sim.terrDirty=true;
  computeSpots(big);
  big.level = big.pop >= CFG.keepPop ? lang('Şehir') : big.pop >= CFG.prisonPop + 6 ? lang("Kasaba") : lang('Köy');
  chron(lang`🏙 ${small.name} ile ${big.name} büyüyüp birbirine kavuştu: iki yerleşim ${big.name} adıyla tek şehir oldu`, k, null, big);
  slog(big, lang`🏙 ${small.name} halkı şehrimize katıldı (+${small.pop} kişi)`);
}

function stability(s, sonuc) {
  const k = s.k, wars = [...k.rel.values()].filter(r => r.status === 'war').length;
  let v = 55 + (s.temple ? 15 : 0) + (s.market ? 5 : 0) + (s.tavern ? 4 : 0) + (s.monument ? 6 : 0) + (s.festY === year() ? 5 : 0) + (k.king ? (k.king.stats.cha - 5) * 3 : -20) - wars * 6;
  v += s.food <= 0 ? -25 : s.food > s.pop * 8 ? 5 : 0;
  if (s.pop > s.cap) v -= 8;
  if (k.capital && s !== k.capital) v -= Math.min(20, dist(s, k.capital) / 40); else v += 10;
  if (s.conqY != null && year() - s.conqY < 15) v -= 20;
  if (sonuc.filter(p => affinity(p.R.base, k.R.base) < -15).length > sonuc.length / 2) v -= 12;
  if (k.drought > Sim.tick) v -= 8;
  return clamp(v, 0, 100);
}
const STAB_TXT = v => v >= 75 ? '😊 mutlu' : v >= 50 ? '🙂 huzurlu' : v >= 30 ? '😠 huzursuz' : lang("🔥 isyan eşiğinde");

function buyFood(s) {
  const miktar = Math.min(-s.food + s.pop * 4, s.k.gold * 0.5) | 0;
  if (miktar<=0) return;
  s.k.gold -= miktar; s.food += miktar;
  slog(s, lang`🪙 Hazine ${miktar} altınlık tahıl satın aldı, kıtlık önlendi`);
}

function abandon(s) {
  s.dead = true; Sim.terrDirty = true;
  Sim.settlements = Sim.settlements.filter(x => x !== s);
  chron(lang`🏚 ${s.name} terk edildi`, s.k, null, s);
  const k = s.k;
  if (k.capital === s) {
    const kalan = kSettlements(k);
    if (kalan.length) { k.capital = kalan[0]; if (k.king) k.king.s = kalan[0]; }
    else fall(k);
  }
}

function assignJobs(s, yetiskinler) {
  const k=s.k, n = yetiskinler.length, inWar = [...k.rel.values()].some(r => r.status === 'war');
  const pool = yetiskinler.filter(p => p.job !== 'king' && p.state !== 'army' && p.job !== 'wanderer' && p.state !== 'migrate');
  const inArmy = yetiskinler.filter(p => p.state === 'army').length;
  const kingAgg = k.king ? k.king.stats.agg : 5;
  const askerler=Math.max(0, Math.round(n * ((inWar ? 0.35 : 0.05) + kingAgg * 0.01)) - inArmy);
  const archers = Math.round(askerler * (k.R.base === 'elf' || k.R.base === 'halfelf' ? 0.5 : 0.3)), rb = k.R.base;
  const cav = k.tech >= 1 ? Math.round(askerler * (['orc', 'goblin', 'halforc'].includes(rb) ? 0.25 : ['dwarf', 'gnome'].includes(rb) ? 0.08 : 0.18)) : 0;
  const art = k.tech >= 2 && askerler >= 8 ? Math.max(1, Math.round(askerler * (["dwarf", 'gnome'].includes(rb) ? 0.14 : 0.07))) : 0;
  const want = [
    ['archer', archers, p => p.stats.spd + p.stats.int],
    ['cavalry', cav, p => p.stats.spd + p.stats.str],
    ['artillery', art, p => p.stats.int + p.stats.str],
    ["soldier", Math.max(0, askerler - archers - cav - art), p => p.stats.str + p.stats.end],
    ['guard', n >= 8 ? Math.max(1, Math.round(n * 0.08)) : 0, p => p.stats.str + p.stats.int],
    ['merchant', [...k.rel.values()].some(r => r.trade) ? Math.max(1, Math.round(n * 0.06)) : 0, p => p.stats.cha],
    ['builder', Math.max(1, Math.round(n * 0.1)), p => p.stats.int],
    ['miner', s.spots.stone.length ? Math.round(n * 0.1) : 0, p => p.stats.str],
    ['wood', s.spots.wood.length ? Math.round(n * 0.14) : 0, p => p.stats.str],
    ['fisher', s.port && n >= 8 ? Math.max(1, Math.round(n * 0.06)) : 0, p => p.stats.int],
    ["healer", n >= 10 && (s.temple || n >= 20) ? 1 + Math.ceil(Sim.people.filter(o => o.sick && o.s === s).length / 5) : 0, p => p.stats.int + p.stats.cha],
    ['hunter', n >= 8 && Sim.monsters.some(m => m.type === 'deer' && dist2(m, s) < 450 * 450) ? Math.max(1, Math.round(n * 0.05)) : 0, p => p.stats.spd],
  ];
  const done=new Set(), maxSpecial = Math.max(0, n - Math.ceil(n * 0.45) - inArmy);
  for (const [meslek, sayi, skor] of want) {
     let c = Math.min(sayi, maxSpecial - done.size);
    for (const p of pool.filter(p => !done.has(p)).sort((a, b) => skor(b) - skor(a))) {
      if (c--<=0) break;
      done.add(p); setJob(p, meslek);
    }
  }

  for (const p of pool) if (!done.has(p)) setJob(p, 'farmer');
}

function marriages(yetiskinler) {
  const single = yetiskinler.filter(p => !p.spouse && p.age < p.life * 0.6 && p.age >= CFG.adultAge + 4 && Math.random() < 0.6);
  const adamlar = single.filter(p => !p.female), women = single.filter(p => p.female);
  for (const m of adamlar) {
    let i = women.findIndex(w => w.race === m.race && w.house !== m.house);
    if (i < 0 && Math.random() < 0.25) i = women.findIndex(w => w.house !== m.house);
    if (i >= 0) marry(m, women.splice(i, 1)[0]);
  }
}

function births(s, sonuc)
{
  for (const w of sonuc) {
    const f = w.spouse;
    if (!w.female || !f || f.dead || w.age > w.life * 0.55 || !isAdult(w) || w.state === 'jailed') continue;
    if (Sim.people.length >= CFG.maxPeople) return;
    const ch = w.stats.fert * 0.03 * (s.food > 0 || Sim.camp ? 1 : 0.2) * (s.pop < s.cap ? 1 : 0.35) * (Sim.camp ? 4 : 1);
    if (Math.random() >= ch) continue;
    const hy = HYBRID[[w.R.base, f.R.base].sort().join('+')];
    const c = makePerson(hy && RACE_DB[hy] ? hy : w.race, s.k, s, w.x, w.y, { father: f, mother: w, house: f.house });
    w.children.push(c); f.children.push(c);
    const t = lang`bir ${c.female ? lang('kızı') : lang('oğlu')} oldu: ${c.name}`;
    plog(w, t); plog(f, t); say(w, '👶', 150);
    s.pop++; s.births++;
  }
}

function plan(s)
{

  if (s.project) return;
  const gerek = s.pop + 3 > s.cap;
  if (gerek && s.wood >= 15) {
    const h = houseSpot(s);
    if (h) { s.wood -= 15; s.project = { type: 'house', ...h, progress: 0, cost: 60 }; }
  } else if (s.pop >= CFG.prisonPop && !s.prison && s.wood >= 20 && s.stone >= 15) {
    const h = houseSpot(s);
    if (h) { s.wood -= 20; s.stone -= 15; s.project = { type: 'prison', ...h, progress: 0, cost: 150 }; }
  } else if (s.pop >= CFG.wallPop && !s.walls && s.stone >= 60) {
    const sh = wallShape(s);
    s.stone -= 60; s.project = { type: 'walls', ...sh.pts[0], pts: sh.pts, progress: 0, cost: 250 + sh.len * 0.5 };
  } else if (s.walls && s.stone >= 35 && [...s.houses, ...buildingsOf(s)].some(h => !inPoly(s.walls.pts, h.x, h.y))) {
    const sh = wallShape(s);
    s.stone -= 35; s.project = { type: "wallExt", ...sh.pts[0], pts: sh.pts, progress: 0, cost: 100 + Math.max(0, sh.len - s.walls.len) * 0.8 };
  } else if (s.walls && s.walls.hp < s.walls.max * 0.7 && s.stone >= 15) {
    s.stone -= 15; s.project = { type: 'repair', ...s.walls.pts[0], progress: 0, cost: 100 };
  } else if (!s.port && !s.noCoast && s.pop >= 12 && s.wood >= 40) {
    const c = coastSpot(s);
    if (c) { s.wood -= 40; s.project = { type: 'port', x: c.lx, y: c.ly, spot: c, progress: 0, cost: 200 }; } else s.noCoast=true;
  } else if (s.pop >= CFG.keepPop && !s.keep && s.stone >= 120) {
    s.stone -= 120; s.project = { type: "keep", x: s.x, y: s.y, progress: 0, cost: 500 };
  } else {
    for (const [b, B] of Object.entries(BLDG)) {
      if (s[b] || s.pop < B.pop || s.wood < B.wood || s.stone < B.stone || s.k.gold < B.gold) continue;
      const h = houseSpot(s);
      if (!h) break;
      s.wood -= B.wood; s.stone -= B.stone; s.k.gold -= B.gold;
      s.project = { type: b, ...h, progress: 0, cost: B.cost };
       break;
    }
  }
}

function famine(s, sonuc) {
  if (Sim.arena || Sim.camp) { s.food = 0; return; }
   const n = Math.ceil(sonuc.length * (s.granary ? 0.04 : 0.08));
  for (let i = 0; i < n; i++) kill(pick(sonuc), null, 'açlık');
  s.food = 0;
  if (n>2) chron(lang`🍂 ${s.name} şehrinde kıtlık: ${n} kişi açlıktan öldü`, s.k, null, s);
  else slog(s, lang`🍂 Yiyecek bitti, ${n} kişi açlıktan öldü`);
}

function expand(s, yetiskinler) {
  if (s.pop < 70 || Math.random() > 0.35) return;
  const k = s.k;
  if (kSettlements(k).length >= CFG.maxSettlements) return;
  let site = null, bs = -Infinity;
  for (let i = 0; i < 50; i++) {
    const a = rnd(0, 6.28), d=rnd(220, 480), x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d, t = terrainAt(x, y);
    if (t < T_BEACH || t === T_SNOW || t === T_MOUNT) continue;
    const nearest = Math.min(...Sim.settlements.map(o => dist(o, { x, y })));
    if (nearest < 200) continue;
    const pref = (k.R.home === 'grass' && t === T_GRASS) || (k.R.home === 'forest' && t === T_FOREST) || (k.R.home === 'hills' && t === T_HILLS);
    const sc = (pref ? 50 : 0) + rnd(0, 30) - d * 0.05;
    if (sc > bs) { bs = sc; site={ x, y }; }
  }
  if (!site) return;
  const settlers=[];

  for (const p of yetiskinler) {
    if (settlers.length >= 8) break;
    if (p.job === 'king' || p.state || settlers.includes(p) || p.age > p.life * 0.6) continue;
    settlers.push(p);
    if (p.spouse && !p.spouse.dead && !p.spouse.state && p.spouse.job !== 'king' && p.spouse.s === s && !settlers.includes(p.spouse)) settlers.push(p.spouse);
  }
  if (settlers.length < 4) return;
  const ns = makeSettlement(k, site.x, site.y);
  for (const p of settlers) {
    p.s = ns; p.state = 'migrate'; setJob(p, 'farmer');
    plog(p, lang`yeni yerleşim ${ns.name} için yola çıktı`);
    for (const c of p.children) if (!c.dead && !isAdult(c) && c.s === s) { c.s = ns; c.state='migrate'; }
  }
  ns.food = Math.max(20, Math.min(s.food * 0.3, 80)); s.food -= ns.food; ns.wood = 20; ns.pop=settlers.length;
  chron(lang`🏘 ${k.name} yeni bir yerleşim kurdu: ${ns.name}`, k, null, ns);
  slog(s, lang`🧳 ${settlers.length} kişi ${ns.name} köyünü kurmak için göç etti`);
  for (const o of Sim.settlements) if (o.k !== k && dist(o, ns) < claimR(o) + claimR(ns)) {
    const r = getRel(k, o.k);
    r.op -= 10; r.claims++;
    chron(lang`🗺 Toprak anlaşmazlığı: ${k.name} "${ns.name} bizim" diyor, ${o.k.name} itiraz ediyor`, k, o.k);
    break;
  }
}

function events(s, yetiskinler) {

  const k = s.k;
  if (s.pop > 6 && yetiskinler.length) {
    const p = pick(yetiskinler);
    if (p.job !== 'king' && !p.state && Math.random() < p.stats.agg * 0.012 * (1.6 - s.stab / 100)) crime(p, s, yetiskinler);
  }
  if (s.pop > 8 && Math.random() < 0.25 && yetiskinler.filter(p => p.job === 'wanderer').length < Math.max(1, yetiskinler.length * 0.1)) {
    const p = yetiskinler.find(p => p.job === 'farmer' && !p.state);
    const known = Sim.settlements.filter(o => o !== s && !o.dead && (o.k === k || k.rel.get(o.k)?.met));
    if (p && known.length) {
      p.dest=pick(known); p.job = 'wanderer'; p.sub = null;
      p.spy = atWar(k, p.dest.k) && Math.random() < 0.6;
      plog(p, lang`${p.dest.name} yönüne ${p.spy ? lang('casusluk görevine') : lang('yolculuğa')} çıktı`);
    }
  }
  if (s !== k.capital && k.capital) {
    const ch = 0.002 + Math.max(0, 40 - s.stab) * 0.004;
    if (Math.random() < ch) rebel(s);
  }
}

function crime(p, s, yetiskinler) {
  const victims = yetiskinler.filter(v => v !== p && v.gold > 3);

  if (!victims.length) return;
  const v = best(victims, v => v.gold), miktar = Math.floor(v.gold * 0.4);
  v.gold -= miktar; p.gold += miktar; p.criminal = true; p.loot = { v, amt: miktar };
  plog(p, lang`${fullName(v)} adlı kişiden ${miktar} altın çaldı`);
  plog(v, lang`${miktar} altını çalındı`);
  slog(s, lang`🦹 Hırsızlık: ${fullName(v)} adlı kişinin ${miktar} altını çalındı`);
}

function rebel(s)
{
  const eski = s.k, sonuc = Sim.people.filter(p => !p.dead && p.s === s), yetiskinler=sonuc.filter(p => isAdult(p) && !p.state);
  if (yetiskinler.length < 4) return;
  const leader = best(yetiskinler, p => p.stats.cha + p.stats.int);
  const nk = newKingdom(leader.race);
  nk.capital = s; s.k = nk; Sim.terrDirty = true;
  nk.tech = eski.tech; nk.research = eski.research; s.stab = 65; s.conqY = null;
  for (const p of sonuc) { leaveArmy(p); p.k = nk; }
  crown(nk, leader);
  const r = getRel(eski, nk);

  r.met = true; r.op = -40;
  chron(lang`🔥 İsyan! ${s.name} halkı ${eski.name} yönetimine başkaldırdı. Yeni devlet: ${nk.name}, lideri ${fullName(leader)}`, eski, nk, s);
  if (Math.random() < 0.6) declareWar(eski, nk, lang('isyanı bastırmak'));
}

function fall(k) {
  if (k.dead) return;
   if (Sim.camp) return campHomeless(k);
  k.dead = true;
  for (const A of [...k.armies]) disband(A);

  for (const sh of Sim.ships) if (sh.k === k) sh.dead = true;
  for (const [, r] of k.rel) if (r.status === 'war') r.status = 'peace';
  countWars();
  chron(lang`💀 ${k.name} yıkıldı ve tarih sahnesinden silindi`, k);
}

function yearlyKingdoms() {
   const ks = Sim.kingdoms.filter(k => !k.dead);
  for (const k of ks) {
    if (!kSettlements(k).length) { if (!Sim.camp) fall(k); continue; }
    if (!k.king || k.king.dead) succession(k);

    if (k.king) k.king.gold += Math.floor(k.gold * 0.02);
    research(k);
    if (k.republic && k.king && year() - (k.elected ?? k.founded) >= 12) election(k);
  }
  const canli = ks.filter(k => !k.dead);
  for (let i = 0; i < canli.length; i++) for (let j = i + 1; j < canli.length; j++) {
    const a = canli[i], b = canli[j], r = getRel(a, b);
    if (!r.met) {
      if (minDist(a, b)>950) continue;
      r.met = true;
      chron(lang`👁 ${a.name} ile ${b.name} ilk kez karşılaştı`, a, b);
    }
    diplomacy(a, b, r);
  }
  countWars();
  const pops = new Map();
  for (const p of Sim.people) pops.set(p.k.id, (pops.get(p.k.id) || 0) + 1);
  Sim.popHist.push({ y: year(), v: pops });
  if (Sim.popHist.length > 500) Sim.popHist = Sim.popHist.filter((_, i) => i % 2 === 0);
}

function election(k, early) {

  const havuz = Sim.people.filter(p => !p.dead && p.k === k && isAdult(p) && !p.state && p.age < p.life * 0.8);
  if (!havuz.length) return;
  const cands = havuz.map(p => [p, p.stats.cha + p.stats.int + rnd(0, 4)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  const votes = new Map(cands.map(c => [c, 0]));
  for (const v of havuz) {
    let bc = cands[0], bs = -Infinity;
    for (const c of cands) { const sc = tie(v, c) + c.stats.cha * 3 + (v.house === c.house ? 15 : 0) + (v === c ? 99 : 0) + rnd(0, 20); if (sc > bs) { bs = sc; bc = c; } }
    votes.set(bc, votes.get(bc) + 1);
  }
  const sonuc = [...votes].sort((a, b) => b[1] - a[1]), win = sonuc[0][0], eski = k.king;
  if (eski && eski !== win && !eski.dead) setJob(eski, 'farmer');
  if (eski !== win) crown(k, win);
  k.elected = year();
  for (const c of cands) say(c, c === win ? '🎉' : '😞', 150);
  chron(lang`🗳 ${k.name} ${early ? lang('erken ') : ''}seçime gitti: ${sonuc.map(([c, n]) => lang`${fullName(c)} ${n} oy`).join(', ')}. Başkan: ${fullName(win)}${eski === win ? lang(' (yeniden seçildi)') : ''}`, k);
}

function research(k) {
  const pop = Sim.people.filter(p => p.k === k && isAdult(p));
  if (!pop.length) return;
  const avgInt = pop.reduce((s, p) => s + p.stats.int, 0) / pop.length, spend = Math.min(k.gold * 0.05, 30);
  k.gold -= spend;
  k.research += avgInt * Math.sqrt(pop.length) * 0.15 + spend * 0.2;

  for (const [o, r] of k.rel) if (r.trade && !o.dead && o.tech > k.tech) k.research += 2;

  if (AGES[k.tech + 1] && k.research >= AGES[k.tech + 1].need) advanceAge(k);
}
function advanceAge(k) {
  if (!AGES[k.tech + 1]) return;
  k.tech++
  k.research = Math.max(k.research, AGES[k.tech].need);
  for (const s of kSettlements(k)) if (s.walls) { s.walls.max += 100; s.walls.hp += 100; }
  chron(lang`🔬 ${k.name} ${AGES[k.tech].name}'na geçti! Silahlar, aletler ve surlar gelişti`, k);
}

function diplomacy(a, b, r) {
  if (Sim.camp) return;
  const ka = a.king, kb = b.king;

  if (!ka || !kb) return;
  const md = minDist(a, b), close = md < 300;
  let d=affinity(a.R.base, b.R.base) * 0.08 + ((ka.stats.cha + kb.stats.cha) / 2 - 5) * 0.7 + rnd(-5, 5) + (r.trade ? 2 : 0);
  for (const [c, rc] of a.rel) if (c !== b && rc.status === "war" && b.rel.get(c)?.status === "war") d += 4;
  let overlap = null;
  for (const s of kSettlements(a)) for (const t of kSettlements(b)) if (dist(s, t) < claimR(s) + claimR(t)) overlap = [s, t];
  if (overlap) {
    d -= 5; r.claims++;
    if (Math.random()<0.4) {
      const [s, t] = Math.random() < 0.5 ? overlap : [overlap[1], overlap[0]];
       chron(lang`🗺 Hak iddiası: ${s.k.name} "${s.name} ile ${t.name} arasındaki topraklar bizim" diyor. ${t.k.name}: "Hayır, bizim!"`, a, b);
    }
  } else if (close) d -= 2;
  r.op=clamp(r.op + d, -100, 100);
  if (r.status === 'war') return warYear(a, b, r);
  const tag = lang`${a.name} ile ${b.name}`;
  if (Math.random() < 0.3) {
    const txt = d > 0 ? pick(MEET_GOOD) : pick(MEET_BAD);
    plog(ka, lang`${b.name} hükümdarı ${kb.name} ile görüştü: ${txt}`);
    plog(kb, lang`${a.name} hükümdarı ${ka.name} ile görüştü: ${txt}`);
    chron(lang`📜 ${title(ka)} ${ka.name} (${a.name}) ve ${title(kb)} ${kb.name} (${b.name}) görüştü: ${txt}`, a, b);
  }
  if (!r.trade && r.op > 5 && Math.random() < 0.3) { r.trade = true; chron(lang`🤝 ${tag} ticaret anlaşması imzaladı`, a, b); }
  else if (r.trade && r.op < -25) { r.trade = false; chron(lang`🚫 ${tag} arasındaki ticaret anlaşması bozuldu`, a, b); }
   if (r.status === 'peace' && r.op > 55 && Math.random() < 0.25) { r.status='alliance'; chron(lang`🛡 ${tag} ittifak kurdu`, a, b); }
  else if (r.status === 'alliance' && r.op < 15) { r.status = 'peace'; chron(lang`💔 ${tag} arasındaki ittifak sona erdi`, a, b); }
  if (r.status !== "peace" || r.op > -15) return;
  const [att, def] = ka.stats.agg + rnd(0, 3) >= kb.stats.agg + rnd(0, 3) ? [a, b] : [b, a];
  const appetite = att.king.stats.agg / 35 + (-r.op - 15) / 200 + (overlap ? 0.1 : 0);
  if (r.op < -35 && Math.random() < appetite) {
    const reason = overlap ? lang('sınır toprakları üzerindeki hak iddiası') : affinity(a.R.base, b.R.base) < -20 ? lang('ırk düşmanlığı') : pick(WAR_REASONS);
    declareWar(att, def, reason);
  } else if (Math.random()<appetite) startRaid(att, def);
}

const WAR_MIN_YEARS = 12;
function warYear(a, b, r) {
  const yrs = year() - r.since;
  if (r.noPeace || yrs < WAR_MIN_YEARS) return;
  const mesgul = X => X.armies.some(A => A.members.length && (A.state === 'battle' || A.state === "assault" || A.state === 'occupy' ||
    (A.target && A.target.k !== X && dist(A.cmd, A.target) < 400)));
  if (mesgul(a) || mesgul(b)) return;
  const skor = k => (r.conq?.[k.id] || 0) * 2 + (r.kills[k.id] || 0) / 15;
  const dominant = Math.abs(skor(a) - skor(b)) > 2;
  const popOf = k => kSettlements(k).reduce((n, s) => n + s.pop, 0);
  const weary = (k, o) => { const kayip = r.kills[o.id] || 0; return kayip / (popOf(k) + kayip + 1); };
  const agg = ((a.king ? a.king.stats.agg : 5) + (b.king ? b.king.stats.agg : 5)) / 2;
  let p = 0.012 * (yrs - WAR_MIN_YEARS + 1) + Math.max(weary(a, b), weary(b, a)) * 0.35;

  p *= 1.3 - agg * 0.06;
  if (dominant && yrs < 30) p *= 0.2;
  if (Math.random() < p) makePeace(a, b);
}

function declareWar(a, b, reason, noAllies) {
  const r = getRel(a, b);
  if (r.status === 'war' || a === b || a.dead || b.dead) return;
  r.status = 'war'; r.trade = false; r.since = year(); r.kills={}; r.op = Math.min(r.op, -40); r.met = true;
  a.wars++; b.wars++;
  chron(lang`⚔️ SAVAŞ! ${a.name} → ${b.name}. Sebep: ${reason}`, a, b);
  if (a.king) plog(a.king, lang`${b.name} krallığına savaş ilan etti`);
  countWars()
  mobilize(a); mobilize(b);
  if (noAllies) return;
  for (const [c, rc] of b.rel) if (rc.status === 'alliance' && !c.dead && c !== a && getRel(c, a).status !== 'alliance') declareWar(c, a, lang`müttefiki ${b.name} için`, true);
  for (const [c, rc] of a.rel) if (rc.status === 'alliance' && !c.dead && c !== b && getRel(c, b).status !== 'alliance') declareWar(c, b, lang`müttefiki ${a.name} için`, true);
}

function massWar(pairsOf, msg, lock) {
  const ks = Sim.kingdoms.filter(k => !k.dead), mob = new Set();
  for (const [a, b] of pairsOf(ks)) {
    const r = getRel(a, b);
    if (lock && a !== b) r.noPeace = true;
    if (r.status === 'war' || a === b) continue;

    r.status = 'war'; r.trade = false; r.since = year(); r.kills = {}; r.op = Math.min(r.op, -40); r.met = true;
    a.wars++; b.wars++; mob.add(a); mob.add(b);
    if (a.king) plog(a.king, lang`${b.name} krallığına savaş ilan etti`);
  }
  chron(msg);
  countWars()
  for (const k of mob) mobilize(k);
}

function mobilize(k) {
  for (const s of kSettlements(k)) assignJobs(s, Sim.people.filter(p => !p.dead && p.s === s && isAdult(p) && p.state !== 'jailed' && p.state !== 'arrested'));
  k.armyCd = Math.min(k.armyCd, Sim.tick + 60);
  const t = Sim.people.filter(p => !p.dead && p.k === k && isTroop(p));
   chron(lang`📯 ${k.name} seferberlik ilan etti: ${armyComp(t)} silah altında`, k);
}

function makePeace(a, b) {
  const r = getRel(a, b);
  if (r.status !== 'war') return;
  const ka = r.kills[a.id] || 0, kb = r.kills[b.id] || 0, [kazanan, lose] = ka >= kb ? [a, b] : [b, a];

  const tribute = Math.floor(lose.gold * 0.3);
  lose.gold -= tribute; kazanan.gold += tribute;
  r.status = 'peace'; r.op = -10; r.hostileUntil = 0;
  chron(lang`🕊 Barış: ${a.name} ile ${b.name} antlaşma imzaladı. Kazanan taraf ${kazanan.name}, ${lose.name} ${tribute} altın tazminat ödedi`, a, b);
  countWars();
}

const BTAC = {
  charge: 'Hücum', flank: 'Kanat manevrası', hold: 'Savunma hattı',
  pincer: 'Çifte kuşatma (Kannai)', hammer: 'Örs ve çekiç', feint: 'Sahte ricat (Turan)',
  kite: 'Vur-kaç', center: 'Merkez yarma', oblique: "Verev düzen", volley: 'Ok yağmuru (yıpratma)',
};
const PLANS = { attack: 'Sefer', defend: "Savunma", raid: 'Baskın' };
const FORM_INFO = {
  line:      { n: 'Düzenli hat',          dmg: 1.05, taken: 1,    arrow: 1,    cav: 1,    front: 1,    pace: 1 },
  crescent:  { n: 'Hilal',                dmg: 1,    taken: 1,    arrow: 1,    cav: 1,    front: 1,    pace: 1 },
  squares:   { n: 'Kare blokları',        dmg: 0.95, taken: 0.85, arrow: 1,    cav: 0.6,  front: 1,    pace: 0.95 },
  horde:     { n: 'Düzensiz yığın',       dmg: 1.15, taken: 1.15, arrow: 0.9,  cav: 1.1,  front: 1,    pace: 1.05 },
  phalanx:   { n: 'Falanks',              dmg: 1.1,  taken: 0.9,  arrow: 1.1,  cav: 0.45, front: 0.6,  pace: 0.75 },
  shieldwall:{ n: 'Kalkan duvarı',        dmg: 0.95, taken: 0.85, arrow: 0.7,  cav: 0.7,  front: 0.7,  pace: 0.85 },
  testudo:   { n: 'Kaplumbağa (testudo)', dmg: 0.7,  taken: 0.8,  arrow: 0.3,  cav: 0.8,  front: 0.8,  pace: 0.6 },
  wedge:     { n: 'Kama (domuz başı)',    dmg: 1.25, taken: 1.1,  arrow: 1.05, cav: 1,    front: 1,    pace: 1.1 },
  schiltron: { n: 'Kirpi halkası',        dmg: 0.9,  taken: 0.85, arrow: 1.15, cav: 0.35, front: 1,    pace: 0.5 },
  column:    { n: 'Yürüyüş kolu',         dmg: 0.85, taken: 1.15, arrow: 1.2,  cav: 1.3,  front: 1,    pace: 1.3 },
  skirmish:  { n: 'Dağınık avcı hattı',   dmg: 0.85, taken: 1.2,  arrow: 0.55, cav: 1.3,  front: 1,    pace: 1.15 },
  echelon:   { n: 'Kademeli (eşelon)',    dmg: 1.05, taken: 1,    arrow: 1,    cav: 0.9,  front: 1,    pace: 1 },
  checker:   { n: 'Dama (manipül)',       dmg: 1.05, taken: 0.95, arrow: 0.9,  cav: 0.85, front: 1,    pace: 1 },
};
const FORMS = Object.fromEntries(Object.entries(FORM_INFO).map(([f, F]) => [f, F.n]));
const FORM_DMG = Object.fromEntries(Object.entries(FORM_INFO).map(([f, F]) => [f, F.dmg]));
const FORM_TAKEN = Object.fromEntries(Object.entries(FORM_INFO).map(([f, F]) => [f, F.taken]));
const formOf = A => FORM_INFO[A && A.form] || FORM_INFO.line;
const allArmies = () => Sim.kingdoms.flatMap(k => k.armies);

const superior = (A, O) => { const [m, f] = forceAt(A, O); return m >= f * 1.25; };
const idleTroops = k => Sim.people.filter(p => !p.dead && p.k === k && isTroop(p) && !p.state && isAdult(p) && p !== Sim.ctrl);

function nearestEnemySettlement(k, dusman, villagesFirst, exclude)
{
  const from = k.capital || kSettlements(k)[0];
  let list=kSettlements(dusman);
  if (villagesFirst) { const v = list.filter(s => s !== dusman.capital); if (v.length) list = v; }
  if (exclude) { const v = list.filter(s => !exclude.has(s)); if (v.length) list = v; }
  if (!list.length || !from) return null;
  return list.reduce((a, b) => dist2(a, from) < dist2(b, from) ? a : b);
}

function battleTactic(cmd, A)
{
  const i = cmd.stats.int + rnd(-2, 2);
   if (i <= 3.5) return 'charge';
  const n = A ? Math.max(1, A.members.length) : 1, cav = A ? (A.nCav || 0) / n : 0, arch = A ? rangedN(A) / n : 0;

  const opts = ['charge', 'hold', 'flank'];
  if (i >= 5.5) opts.push('center', 'oblique');
  if (i >= 7) opts.push('pincer', 'pincer', 'oblique', 'flank');
  if (cav > 0.15) opts.push('hammer', 'hammer');
  if (arch > 0.3) opts.push('volley', "volley");
  return pick(opts);

}
function pickFormation(k, cmd, askerler) {
  const i = cmd.stats.int + rnd(-1.5, 1.5), b = k.R.base, n = askerler ? askerler.length : 0;
  const share = j => n ? askerler.filter(p => p.job === j).length / n : 0;
  let opts;
  if (askerler && askerler.filter(p => WW_JOBS.has(p.job)).length * 2 > n) opts = ['skirmish', 'skirmish', 'line', 'line', 'echelon'];
  else if (askerler && askerler.filter(p => VIC_JOBS.has(p.job)).length * 2 > n) {
    opts=['line', 'line', 'line', 'column', 'echelon'];
    if (i>=5.5) opts.push('squares', 'skirmish', 'echelon', 'line');
    if (share('rifleman') > 0.3) opts.push('skirmish', 'skirmish');
     if (share('hussar') > 0.3) opts.push('column', 'echelon');
  } else if (i < 4 || (['orc', 'goblin', 'halforc'].includes(b) && i < 6.5)) opts = ['horde', 'horde', 'wedge', 'column'];
  else {
    opts = ['line', 'line', 'crescent', 'squares', 'shieldwall', 'wedge', 'checker', 'echelon'];
    if (i >= 6) opts.push('phalanx', 'echelon', 'checker', 'crescent');
    if (b === 'dwarf' || b === 'gnome') opts.push('shieldwall', 'shieldwall', 'phalanx', "testudo");
    if (b === 'elf' || b === 'halfelf') opts.push('skirmish', 'skirmish', 'crescent', 'echelon');
    if (b==='dragonborn') opts.push('wedge', 'wedge', 'phalanx');
    if (b === 'human') opts.push('checker', 'phalanx', 'shieldwall');
    if (share('archer') > 0.35) opts.push('skirmish', 'testudo');
    if (share('soldier') > 0.7 && n > 30) opts.push('phalanx', 'schiltron');
    if (share('cavalry') > 0.3) opts.push('wedge', 'crescent');
  }
  let f = pick(opts);
  if (f === Sim.lastForm) f = pick(opts.filter(x => x !== f)) || f;
  Sim.lastForm=f;
  return f;
}

function memberIdx(A, p) {
   const L = A.members;
  let m = A._idx;
  if (!m || A._idxArr !== L || A._idxN !== L.length) {
    if (!m) m = A._idx = new Map();
    m.clear();
    for (let i = 0; i < L.length; i++) if (!m.has(L[i])) m.set(L[i], i);
    A._idxArr = L; A._idxN = L.length;
  }
  const i = m.get(p);
  return i === undefined ? -1 : i;
}

function sortRanks(A) {
  A._idxArr = null;
  A.members.sort((a, b) => (UNIT_RANK[a.job] || 0) - (UNIT_RANK[b.job] || 0));
  A.members.forEach((p, i) => { p.army = A; p.slot = i; p.state = 'army'; p.foe = null; });
  countUnits(A);
}

function formArmy(k, dusman, cesit) {
  const raid = cesit === "raid";
  let askerler = idleTroops(k);
  if (askerler.length < (raid ? 4 : 6)) return null;
   askerler=raid ? askerler.filter(p => bj(p) !== 'artillery').sort((a, b) => b.stats.spd * unitPace(b) - a.stats.spd * unitPace(a)).slice(0, 10) : askerler.slice(0, 70);

  const hedef = nearestEnemySettlement(k, dusman, raid, new Set(k.armies.map(A => A.target)));
  if (!hedef) return null;
  const melee = askerler.filter(p => p.job === "soldier");
  const cmd = pickCmd(askerler);
  const foes = Sim.people.filter(p => !p.dead && p.k === dusman && (isTroop(p) || p.state === 'army'));
  const plan = raid ? 'raid' : cesit === 'main' && power(askerler) < power(foes) * 0.7 ? "defend" : 'attack';
  const A = { id: Sim.nextArmy++, k, enemy: dusman, target: hedef, cmd, members: askerler, start: askerler.length, plan, raid,
    state: plan === 'defend' ? 'defend' : "gather", t: 0, cap: 0, morale: 100, btac: battleTactic(cmd), form: pickFormation(k, cmd, askerler),
    foeArmy: null, battle: null, massacre: false };
  sortRanks(A);
  k.armies.push(A);
  plog(cmd, raid ? lang`${hedef.name} baskınına önderlik ediyor` : lang`${k.name} ordusunun komutanı oldu`);
  const comp = lang`${armyComp(A.members)}, düzen: ${FORMS[A.form]}`;
  if (raid) chron(lang`🔥 Baskın! ${k.name} akıncıları (${askerler.length} kişi), ${dusman.name} köyü ${hedef.name} üzerine yürüyor. Önderleri ${fullName(cmd)}`, k, dusman, hedef);
  else if (plan==="defend") chron(lang`🛡 ${k.name} savunmaya geçti (${comp}). Komutan ${fullName(cmd)} düşmanı topraklarında bekliyor`, k, dusman);
  else chron(lang`🎺 ${k.name} ordusu ${hedef.name} üzerine yürüyor (${comp}). Komutan: ${fullName(cmd)}`, k, dusman, hedef);
  return A;
}

function startRaid(k, dusman) {
  if (k.armies.some(A => A.raid)) return null;
  const r = getRel(k, dusman), A = formArmy(k, dusman, 'raid');
  if (A) { r.hostileUntil = Sim.tick + CFG.year; r.op -= 20; k.raids++; countWars(); }
  return A;
}

function disband(A) {
   if (A.battle) endBattle(A.battle, A);
  if (A.ship) A.ship.dead = true;
  for (const p of A.members) { p.state=null; p.army = null; p.foe = null; }
  A.members = [];

  A.k.armies = A.k.armies.filter(x => x !== A);
  A.k.armyCd = Math.max(A.k.armyCd, Sim.tick + 200);
}

const stopPoint = A => {
  const T = A.target, a = Math.atan2(A.cmd.y - T.y, A.cmd.x - T.x), rr = (T.walls ? wallRay(T, a) : T.r) + 25;
  return { x: T.x + Math.cos(a) * rr, y: T.y + Math.sin(a) * rr };
};

function warLogic(k)
{
  for (const A of [...k.armies]) { updateArmy(A); if (A.order) orderTick(A); if (A.members.length) trenchWork(A); }
  if (Sim.tick < k.armyCd) return;
  k.armyCd = Sim.tick + 300;
  const enemies = [...k.rel].filter(([o, r]) => r.status === 'war' && !o.dead).map(([o]) => o);
  if (!enemies.length) return;
  const dusman = enemies.reduce((a, b) => minDist(k, a) < minDist(k, b) ? a : b);
  const main = k.armies.find(A => !A.raid && !A.manual);
  if (!main) { formArmy(k, dusman, 'main'); return; }
  const idle = idleTroops(k);
  if (idle.length >= 20 && k.armies.length < 3 && main.plan === 'attack') formArmy(k, dusman, 'attack');
  else if (idle.length >= 5 && !k.armies.some(A => A.raid) && Math.random() < 0.4) formArmy(k, dusman, 'raid');
  else if (idle.length >= 3 && !['battle', 'sail', 'embark', "retreat"].includes(main.state)) {
    const add = idle.slice(0, Math.max(0, 70 - main.members.length));
    if (!add.length) return;
     main.members.push(...add); main.start += add.length; sortRanks(main);
     plog(main.cmd, lang`${add.length} kişilik takviye birlik orduya katıldı`);
  }
}

function updateArmy(A) {
  if (A.manual) return manualArmy(A);
  const k = A.k, r = k.rel.get(A.enemy);
  A.members = A.members.filter(p => !p.dead && p.k === k && p.state === 'army');
  const active = r && (r.status === 'war' || (A.raid && Sim.tick < r.hostileUntil));

  if (!A.members.length || !active || A.enemy.dead) {
    if (!A.members.length && active) chron(lang`☠ ${k.name} ${A.raid ? lang('akıncıları') : lang('ordusu')} yok edildi`, k, A.enemy);
    return disband(A);
  }
  if (A.cmd.dead || !A.members.includes(A.cmd)) {
    const old = A.cmd;
    A.cmd = pickCmd(A.members);
    A.cmdLost = true; A.path = null;
    chron(lang`🎖 ${k.name} ordusunda komutan ${fullName(old)} ${old.dead ? lang('düştü') : lang('ayrıldı')}. Yerine ${fullName(A.cmd)} geçti`, k);
    plog(A.cmd, lang('ordunun komutasını devraldı'));
  }
  A.t += 5;
  if (A.state === 'battle' || A.state === 'sail') return;
  if (A.state !== 'retreat' && armyHitReact(A)) return;
  if (A.state !== 'retreat' && A.state !== 'ambush') for (const O of allArmies()) {
    if (O === A || O.state === 'sail' || !O.members.length || !hostile(k, O.k) || (O.state === 'retreat' && !superior(A, O))) continue;
    if (O.state === "battle") { if (!A.raid && tryJoin(A, O)) return; continue; }
    if ((O.state === 'ambush' || unseen(O, k)) && dist2(A.cmd, O.cmd) > 90 * 90) continue;
    if (dist2(A.cmd, O.cmd) < 260 * 260) return startBattle(A, O);
  }

  if (!['retreat', 'embark'].includes(A.state) && A.plan !== "defend" && (A.target.dead || A.target.k !== A.enemy)) {
    const t = nearestEnemySettlement(k, A.enemy, A.raid, new Set(k.armies.filter(x => x !== A).map(x => x.target)));
    if (!t || A.raid) { A.state = 'retreat'; A.t = 0; } else { A.target = t; A.state = 'march'; A.t = 0; }
  }
  if (!A.raid && ['march', 'defend', 'gather'].includes(A.state) && (Sim.tick / 5 + A.id) % 4 === 0) aiHelp(A);
  const T = A.target;
  switch (A.state) {
    case 'gather': if (A.t>200) { A.state = 'march'; A.t = 0; } break;
    case 'defend':
      defendTrench(A);
      for (const O of allArmies()) {
        if (O.k !== k && hostile(k, O.k) && O.state !== 'retreat' && O.state !== 'sail' && O.members.length && kSettlements(k).some(s => dist2(s, O.cmd) < 650 * 650)) {
          if (tryAmbush(A, O)) break;
          { const [bm, bf] = forceAt(A, O); if (bm / bf < 0.7) continue; }
          A.foeArmy = O; A.state='intercept'; A.t = 0;
          chron(lang`🛡 ${k.name} ordusu, topraklarına yaklaşan ${O.k.name} ordusunu karşılamaya çıktı`, k, O.k);
          break;
        }
      }
      if (A.state === 'defend' && A.t > CFG.year * 2) {
        A.t = 0;
        const foes = Sim.people.filter(p => !p.dead && p.k === A.enemy && (isTroop(p) || p.state === 'army'));
        if (power(A.members) > power(foes) * 0.8) { A.plan = 'attack'; A.state = "gather"; chron(lang`⚔️ ${k.name} savunmadan saldırıya geçti`, k, A.enemy); }
      }
      break;
    case 'ambush': ambushTick(A); break;
    case 'intercept': {
      const O = A.foeArmy;
      if (!O || !O.members.length || O.state === 'retreat' || !O.k.armies.includes(O) || A.t > 2500) { A.state = A.helpPrev || "defend"; A.helpPrev=null; A.foeArmy = null; A.t = 0; }
      break;
    }
    case 'march':
      if (A.goal && A.goalFor === T && dist(A.cmd, A.goal) < 30) {
        A.state='assault'; A.t = 0;
        if (!A.raid) chron(lang`🏰 ${k.name} ordusu ${T.name} önlerine ulaştı. Kuşatma başlıyor`, k, A.enemy, T);
      } else if (A.noPath || A.t > 6000) {
        A.noPath = false;
        const other = kSettlements(A.enemy).find(s => s !== T && findPath(A.cmd.x, A.cmd.y, s.x, s.y));

        if (other && !A.raid) A.target=other;
        else if (A.raid || !navalInvasion(A)) { A.state = 'retreat'; A.t = 0; chron(lang`🧭 ${k.name} ordusu ${T.name} şehrine ulaşamadı, geri dönüyor`, k); }
      }
      break;
    case 'embark': {
      const S = A.ship;

      if (!S || S.dead) { A.state='retreat'; A.t = 0; break; }
      if (dist2(A.cmd, { x: S.home.port.lx, y: S.home.port.ly }) < 900 || A.t > 2500) { A.state = 'sail'; S.state='sail'; }
      break;
    }
    case 'assault':
      if (A.raid) {
        const inside = A.members.filter(p => dist2(p, T) < (T.r + 5) ** 2).length;
        if (inside >= Math.max(1, A.members.length / 3) || A.t > 600) raidLoot(A);
      } else checkCapture(A);
      if (A.t > (A.raid ? 4000 : 9000) || (A.t > 4000 && A.members.length < A.start * 0.35)) { A.state='retreat'; A.t = 0; }
      break;
    case 'occupy':
      if (A.t > 150) { A.massacre=false; capture(A); }
      break;
    case 'retreat': {
      const home = k.capital;
      if (!home || A.t > 1500 || A.members.every(p => dist2(p, home) < 3600)) disband(A);
      break;
    }
  }
}

const cruelty = A => A.cmd.stats.agg + (A.k.king ? A.k.king.stats.agg : 5) + rnd(-3, 3) + (affinity(A.k.R.base, A.enemy.R.base) < -20 ? 3 : 0);

function raidLoot(A) {
  const T = A.target, k = A.k;
  const food = Math.floor(Math.max(0, T.food) * 0.5), gold = Math.floor(T.k.gold * 0.15);

  T.food -= food; T.k.gold -= gold; k.gold += gold;
  if (k.capital) k.capital.food += food;
  for (const p of A.members) p.gold += Math.floor(gold / A.members.length);
  let extra = '';
  if (cruelty(A)>14) {
    const burn = Math.ceil(T.houses.length * 0.3);
    T.houses.splice(0, burn); T.cap=T.houses.length * CFG.houseCap;
    extra = lang`, ${burn} evi ateşe verdi`;
  }
  chron(lang`💰 Yağma: ${k.name} akıncıları ${T.name} köyünü yağmaladı (${food} yiyecek, ${gold} altın${extra})`, k, T.k, T);
  A.state = 'retreat'; A.t = 0;
}

const bArmies = (B, s) => B.sides[s].filter(X => X.battle === B && X.members.length && X.k.armies.includes(X));
const sideCount = (B, s) => bArmies(B, s).reduce((n, X) => n + X.members.length, 0);
const sideNames = (B, s) => [...new Set(B.sides[s].map(X => X.k.name))].join(' + ');
function prepBattle(X, B, s) {
  X.routT = 0;
  X.prevState = X.state; X.state = 'battle'; X.battle = B; X.bside = s; X.morale=100; X.cmdLost = false; X.duel = 0; X.rush = false; X.joinT = 0; X.galled = false; X.searching=false; X.blindT=0; X.bayonet = false;
  if (!X.btacSet) X.btac = battleTactic(X.cmd, X);
  X.anchor = { x: X.cmd.x, y: X.cmd.y }; X.charged = false; X.feint = X.btac === 'feint' ? 'flee' : null; X.turnUntil = 0;
  for (const p of X.members) p.flanked = false;
  pickGuards(X);
  if (B.all) B.all.add(X);
}
function startBattle(A, O)
{
  if ((A.escapeUntil > Sim.tick || O.escapeUntil > Sim.tick) && dist2(A.cmd, O.cmd) > 50 * 50) return;
  const mid = { x: (A.cmd.x + O.cmd.x) / 2, y: (A.cmd.y + O.cmd.y) / 2 };
  const place = Sim.settlements.length ? Sim.settlements.reduce((a, b) => dist2(a, mid) < dist2(b, mid) ? a : b) : null;
  const pursuit = A.state === "retreat" || O.state === 'retreat';
  const B = { a: A, b: O, sides: [[A], [O]], start: [A.members.length, O.members.length], cx: [0, 0], cy: [0, 0],
    name: lang`${place ? place.name : lang('Issız Ova')} Meydan Savaşı`, x: mid.x, y: mid.y, t: 0, place, all: new Set() };
  const rb = Sim.recentB || (Sim.recentB = []), R = rb.find(r => Sim.tick - r.t < 700 && (r.x - mid.x) ** 2 + (r.y - mid.y) ** 2 < 350 * 350 && (r.armies.has(A) || r.armies.has(O)));
   if (R) { Sim.recentB = rb.filter(r => r !== R); B.cont = R; B.name = R.name; B.place = R.place; }
  [A, O].forEach((X, s) => prepBattle(X, B, s));
  for (const [X, Y] of [[A, O], [O, A]]) {
    const [bm, bf] = forceAt(X, Y), over = bm / bf;
    X.rush = over >= 2 && X.cmd.stats.int + rnd(-2, 2) < 7 && !X.order;
    X.cocky=X.rush;
    if (pursuit || (X.lastBattle && Sim.tick - X.lastBattle < 900)) X.rush = true;
    if (X.rush && !X.btacSet) { X.btac = 'charge'; X.feint = null; }
  }
  for (const X of [A, O]) {
    say(X.cmd, X.rush ? '😤' : '📣', DEPLOY);
    plog(X.cmd, lang`${B.name} başladı: ${X.rush ? lang('düzen kurmadan hücum emri verdi') : lang`${FORMS[X.form]} düzeninde ${BTAC[X.btac]} emri verdi`}`);
  }
  centroids(B);
  Sim.battles.push(B);
  if (B.cont) return;
  const taraf = X => lang`${X.k.name} (${armyComp(X.members)}, ${FORMS[X.form]}, ${BTAC[X.btac]})`;
  chron(lang`⚔️ ${B.name} başladı! ${taraf(A)} karşısında ${taraf(O)}`, A.k, O.k, place);
  for (const X of [A, O]) if (X.cocky) chron(lang`😤 ${X.k.name} komutanı ${fullName(X.cmd)} sayıca üstün olduklarını görünce "zaten alırız" dedi, mevzi almadan saldırıya geçti`, X.k, null, place);
  championDuel(B);
}
function joinBattle(X, B, s) {
  if (X.battle || X.raid) return false;
  prepBattle(X, B, s);
  X.rush = true; X.joinT = B.t - 9999; X.joined = true;
  if (!X.btacSet) { X.btac = 'charge'; X.feint = null; }
  B.sides[s].push(X); B.start[s] += X.members.length;
  say(X.cmd, '📯', 150);
  plog(X.cmd, lang`${B.name} savaşına yetişip katıldı`);
  chron(lang`📯 ${X.k.name} ordusu (${armyComp(X.members)}) ${B.name} savaşına yetişti, ${sideNames(B, s)} safında savaşa girdi!`, X.k, null, B.place);
  return true;
}
function tryJoin(A, O) {
  const B = O.battle;
  if (!B || A.battle || A.escapeUntil > Sim.tick || !Sim.battles.includes(B) || dist2(A.cmd, O.cmd) > 300 * 300) return false;
  return joinBattle(A, B, 1 - O.bside);

}

function centroids(B) {
  for (const s of [0, 1]) {
    let sx = 0, sy = 0, sn = 0;
    for (const X of B.sides[s]) {
      let x = 0, y = 0;
      for (const p of X.members) { x += p.x; y += p.y; }
      const n = X.members.length || 1;
      X.cx = x / n; X.cy = y / n;
      if (X.battle === B && X.members.length) { sx += x; sy += y; sn += X.members.length; }
    }
    if (sn) { B.cx[s] = sx / sn; B.cy[s] = sy / sn; }
  }

}

function leaveBattle(B, X, routed) {
  B.sides[X.bside] = B.sides[X.bside].filter(Y => Y !== X);
  X.battle = null; X.t = 0; X.path = null;
  if (B.a === X && B.sides[0][0]) B.a = B.sides[0][0];
  if (B.b === X && B.sides[1][0]) B.b = B.sides[1][0];
  if (!X.k.armies.includes(X)) return;
  if (routed) { X.order = null; X.state = 'retreat'; chron(lang`🏳 ${X.k.name} ordusu ${B.name} savaşında bozguna uğrayıp çekildi, müttefikleri savaşmaya devam ediyor`, X.k, null, B.place); }
  else X.state=X.plan === 'defend' ? 'defend' : 'march';
}

function updateBattle(B)
{
  B.t += 5;
  for (const s of [0, 1]) for (const X of B.sides[s]) { X.members = X.members.filter(p => !p.dead && p.state === 'army'); countUnits(X); }
  for (const s of [0, 1]) {
    if (!bArmies(B, s).length) return endBattle(B, s);
    for (const X of [...B.sides[s]]) if (X.battle !== B || !X.members.length || !X.k.armies.includes(X)) leaveBattle(B, X, false);
  }

  const P = battleForce(B);
  for (const s of [0, 1]) {
    const oran = P[s] / (P[1 - s] || 1), sayi = sideCount(B, s), sol = sayi / Math.max(1, B.start[s]);

    const hist = B.hist || (B.hist = [[], []]), h = hist[s];
    h.push(sayi); if (h.length>60) h.shift();

    const shock = clamp((h[0] - sayi) / Math.max(1, B.start[s]) * 60, 0, 15);
    for (const X of bArmies(B, s)) {
      const flanked = X.members.length ? X.members.filter(p => p.hitSide > Sim.tick).length / X.members.length : 0;
      X.ratio = oran; X.left = sol;
      X.morale = 100 - (1 - sol) * 125 - shock - flanked * 40 - (X.cmdLost ? 10 : 0) + clamp((oran - 1) * 40, -35, 35)
        - (B.ambush && B.ambush !== X && B.t < 600 ? 25 : 0) - (B.ambushT && Sim.tick - B.ambushT < 500 && B.ambushSide !== s ? 20 : 0) + (X.duel || 0) + (X.cmd && !X.cmdLost ? rankOf(X.cmd).lv * 2 : 0) + (X.k.R.stats.agg || 5) - 5;
    }
  }
  centroids(B);

  bayonetCheck(B);

  for (const s of [0, 1]) for (const X of bArmies(B, s)) {
    if (X.feint !== 'flee' || B.t < DEPLOY + 120) continue;
    if (B.t > DEPLOY + 420 || (X.cx - B.cx[1 - s]) ** 2 + (X.cy - B.cy[1 - s]) ** 2 < 60 * 60) {
      X.feint = 'turn'; X.turnUntil=Sim.tick + 300;
      say(X.cmd, '🔄', 150);
      chron(lang`🏇 ${X.k.name} ordusu kaçar gibi yaptı; peşine düşen ${sideNames(B, 1 - s)} askerleri dağılınca birden dönüp üstlerine çullandı!`, X.k, null, B.place);
    }
  }
  const rout = X => !X.lastStand && X.left <= 0.2 && X.ratio < 1;
  const mor = s => Math.min(...bArmies(B, s).map(X => X.left));
  const order=mor(0) <= mor(1) ? [0, 1] : [1, 0];
  for (const s of order) {
    const canli = bArmies(B, s), routed = canli.filter(rout);
    if (routed.length && routed.length === canli.length) { for (const X of canli) routMark(X, B); return endBattle(B, s); }
    for (const X of routed) { routMark(X, B); leaveBattle(B, X, true); }
  }
   if (B.t > 4000) endBattle(B, null);
}

function bayonetCheck(B) {
  if (B.t < DEPLOY + 200) return;
  for (const s of [0, 1]) for (const X of bArmies(B, s)) {
    if (X.bayonet || !X.nRifle || X.nRifle < X.members.length * 0.35 || !X.cmd || routing(X)) continue;
    const tr = cmdTrait(X.cmd), lean = tr === CMD_TRAITS.bold ? -0.25 : tr === CMD_TRAITS.cautious ? 0.2 : 0;
    const dusmanlar = bArmies(B, 1 - s), foeLeft = Math.min(1, ...dusmanlar.map(Y => Y.left ?? 1)), myN = sideCount(B, s), foeN = Math.max(1, sideCount(B, 1 - s));
    const dug = dusmanlar.some(Y => Y.trench && Y.trench !== true && Sim.trenches.includes(Y.trench) && Y.trench.prog >= 0.6);
    if ((foeLeft < 0.5 - lean * 0.4 && (!dug || foeLeft < 0.3)) || (!dug && ((myN >= foeN * (1.6 + lean) && B.t > DEPLOY + 300) || (B.t > DEPLOY + 1800 + lean * 1000 && myN >= foeN * 1.1)))) {
      X.bayonet = true;

      say(X.cmd, X.ww ? '📯' : '🗡', 150);
      chron(X.ww ? (entrenched(X) ? lang`📯 ${X.k.name} komutanı ${rankName(X.cmd)} düdüğünü öttürdü: "Siperden çıkın!" Piyade süngü takıp hücuma kalktı`
          : lang`📯 ${X.k.name} komutanı ${rankName(X.cmd)} düdüğünü öttürdü: piyade süngü takıp son hücuma kalktı`)
        : lang`🗡 ${X.k.name} komutanı ${rankName(X.cmd)} "Süngü takın!" diye bağırdı: hat piyadesi ateşi bırakıp süngü hücumuna kalktı`, X.k, null, B.place);
    }
  }
}
function battleForce(B) {
  const N = [0, 0], Pw = [0, 0];
  for (const s of [0, 1]) for (const X of bArmies(B, s)) { N[s] += X.members.length; Pw[s] += power(X.members); }
   if ((B.t / 5) % 4 === 0 || !B.near) {
    B.near = [[0, 0], [0, 0]];
    const kS=[0, 1].map(s => bArmies(B, s)[0]);
    for (const X of allArmies()) {
      if (X.battle || !X.members.length || !X.cmd || X.state === 'sail' || X.state === 'retreat' || routing(X)) continue;
      for (const s of [0, 1]) {
        const ref = kS[s];
        if (!ref || (X.k !== ref.k && !cpFriend(ref, X))) continue;
        if ((X.cmd.x - B.cx[s]) ** 2 + (X.cmd.y - B.cy[s]) ** 2 > 400 * 400) continue;
        B.near[s][0] += X.members.length * 0.5; B.near[s][1] += power(X.members) * 0.5;
      }
    }
  }
  return [0, 1].map(s => Math.sqrt((N[s] + B.near[s][0]) * (Pw[s] + B.near[s][1])));
}
function routMark(X, B) {
  const os = 1 - X.bside;
  X.routT = Sim.tick; X.routFrom = { x: B.cx[os], y: B.cy[os] };
  say(X.cmd, '🏳', 150);
}
const routing = A => A.routT && Sim.tick - A.routT < 420;
function routMove(p, A) {

  const F = A.routFrom, a0 = Math.atan2(p.y - F.y, p.x - F.x);
  const a=a0 + ((p.id * 7919) % 100 / 100 - 0.5) * 0.35;
  moveTo(p, p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, 1.25);

}

function endBattle(B, loser) {
  if (!Sim.battles.includes(B)) return;
  if (loser && typeof loser === 'object') {
    const s = loser.bside;

    if (B.sides[s].some(X => X !== loser && X.battle === B && X.members.length && X.k.armies.includes(X))) return leaveBattle(B, loser, false);
    loser = s;
  }
  Sim.battles = Sim.battles.filter(x => x !== B);
  const ls = loser, ws = ls == null ? null : 1 - ls;
  const loss = [0, 1].map(s => Math.max(0, B.start[s] - B.sides[s].reduce((n, X) => n + X.members.length, 0)));
  const R = B.cont, sideK = [0, 1].map(s => new Set([...B.sides[s], ...[...(B.all || [])].filter(X => X.bside === s)].map(X => X.k)));
  const prevLoss = s => R ? [...sideK[s]].reduce((n, k) => n + (R.lossK.get(k) || 0), 0) : 0;
  const lossAll = [0, 1].map(s => loss[s] + prevLoss(s)), tAll = (R ? R.tAll : 0) + B.t;
  for (const s of [0, 1]) for (const X of B.sides[s]) {
    if (X.battle !== B) continue;
    X.battle = null; X.t = 0; X.path = null; X.lastBattle = Sim.tick;
    if (s===ls) X.order = null;
    if (!X.k.armies.includes(X)) continue;
    X.state = s === ls ? 'retreat' : X.plan === 'defend' ? 'defend' : "march";
  }
  const kA = (B.sides[0][0] || B.a).k, kO = (B.sides[1][0] || B.b).k;
  if (ws != null) {
    const winners = B.sides[ws].filter(X => X.k.armies.includes(X) && X.members.length), lk = ls === 0 ? kA : kO;
    for (const W of winners) if (!W.manual && W.plan === 'defend' && W.members.length > W.start * 0.5) {
      const t = nearestEnemySettlement(W.k, lk);
      if (t) { W.plan = 'attack'; W.enemy = lk; W.target = t; W.state = 'march'; chron(lang`⚔️ ${W.k.name} zaferin ardından karşı saldırıya geçti. Hedef: ${t.name}`, W.k, lk, t); }
    }
    for (const k of new Set(winners.map(X => X.k))) k.battlesWon = (k.battlesWon || 0) + 1;
    const real = tAll >= 300 && lossAll[ls] >= 5;
    for (const W of winners) {
      const c = W.cmd;
      if (!c || c.dead || !real || (c.winT && Sim.tick - c.winT < 900)) { W.noBonus = true; continue; }
       const r0 = rankOf(c).lv; c.winT = Sim.tick; W.noBonus = false;
      c.battlesWon = (c.battlesWon || 0) + 1; plog(c, lang`${B.name} zaferini kazandı`); cmdPromote(c, r0);
    }
    for (const W of winners) {
      const c = W.cmd && !W.cmd.dead ? W.cmd : null, n = W.members.length;
      if (!c || !n || W.noBonus) continue;
      const gain = c.stats.int * 4 + c.stats.cha * 1.5;
      for (const p of W.members) p.stats.str = Math.min(20, p.stats.str + gain / (n * p.R.size));
      say(c, '💪', 150);
      chron(lang`💪 ${W.k.name} askerleri ${B.name} zaferiyle güçlendi: komutan ${fullName(c)} sayesinde ordu +${gain.toFixed(1)} güç kazandı (zekâ ${c.stats.int}×4 + karizma ${c.stats.cha}×1,5)`, W.k, null, B.place);
    }
    for (const X of B.sides[ls]) if (X.cmd && !X.cmd.dead) plog(X.cmd, lang`${B.name} yenilgisinden sonra geri çekildi`);
    if (!R || (real && R.winK !== (ws === 0 ? kA : kO))) chron(lang`🏆 ${B.name} bitti: ${sideNames(B, ws)} kazandı! Kayıplar: ${sideNames(B, 0)} ${lossAll[0]}, ${sideNames(B, 1)} ${lossAll[1]}. ${sideNames(B, ls)} bozguna uğradı`, kA, kO, B.place);
  } else if (!R || loss[0] + loss[1] >= 5) chron(lang`⚖️ ${B.name} kesin bir sonuç vermeden bitti. Kayıplar: ${sideNames(B, 0)} ${lossAll[0]}, ${sideNames(B, 1)} ${lossAll[1]}`, kA, kO, B.place);
  const winK = ws == null ? null : ws === 0 ? kA : kO;
  let log=R && R.log && Sim.battleLog.includes(R.log) ? R.log : null;
  if (log) {
    for (const s of [0, 1]) { if (sideK[s].has(log.a)) log.la += loss[s]; if (sideK[s].has(log.b)) log.lb += loss[s]; }
    if (winK) log.winner = sideK[ws].has(log.a) ? log.a : sideK[ws].has(log.b) ? log.b : winK;
  } else {
    log = { name: B.name, y: stamp(), a: kA, b: kO, la: loss[0], lb: loss[1], winner: winK };
    Sim.battleLog.unshift(log);
    if (Sim.battleLog.length > 100) Sim.battleLog.pop();
  }

  const lossK = new Map(R ? R.lossK : []);
  for (const s of [0, 1]) for (const k of sideK[s]) lossK.set(k, (lossK.get(k) || 0) + loss[s] / sideK[s].size);
  Sim.recentB = (Sim.recentB || []).filter(r => Sim.tick - r.t < 700).slice(-12);
  Sim.recentB.push({ name: B.name, x: B.x, y: B.y, t: Sim.tick, place: B.place, armies: new Set([...(B.all || []), ...B.sides[0], ...B.sides[1]]), lossK, tAll, log, winK: winK || (R && R.winK) });
}

function championDuel(B) {
  const A = B.a, O = B.b, a = A.cmd, o = O.cmd;
  if (A.rush || O.rush || A.order || O.order || a.stats.agg + o.stats.agg < 12 || Math.random() > 0.25) return;
  const roll = p => (p.stats.str * 1.2 + p.stats.spd * 0.6 + p.stats.end * 0.6) * p.R.size * (1 + Math.min(10, p.vet || 0) * 0.04) * rnd(0.6, 1.4);
  const [w, l, W, L] = roll(a) >= roll(o) ? [a, o, A, O] : [o, a, O, A];
  W.duel = 12; L.duel = -15;
  say(w, '🏆', 200);
  chron(lang`🤺 Er meydanı! ${B.name} öncesi ${W.k.name} komutanı ${fullName(w)} ile ${L.k.name} komutanı ${fullName(l)} teke tek çarpıştı. ${w.name} rakibini yere serdi, ordusu coştu!`, W.k, L.k, B.place);
  kill(l, w, "düello");
}

function meleeCols(A, melee) {
  if ((A.vic || A.ww) && A.form === 'line') return Math.max(5, Math.ceil(melee / 3));
  return A.form === 'line' ? Math.max(5, Math.ceil(Math.sqrt(melee * 3))) : Math.max(4, Math.ceil(Math.sqrt(melee * 2.5)));
}
const phalanxCols = m => Math.max(4, Math.ceil(m / 8));
const wallRows = m => m > 40 ? 3 : 2;
const ringR = m => Math.max(12, Math.ceil(m / 2) * 6 / (Math.PI * 2));
function meleeDepth(A, melee)
{
  switch (A.form) {
    case "line": return Math.ceil(melee / meleeCols(A, melee)) * 7;
    case "crescent": return 14;
    case 'squares': return 21;
    case 'phalanx': return Math.ceil(melee / phalanxCols(melee)) * 5;
    case 'shieldwall': return wallRows(melee) * 6;
    case 'testudo': return Math.ceil(Math.sqrt(melee)) * 4.5;
    case 'wedge': return Math.ceil(Math.sqrt(melee)) * 6;
    case 'schiltron': return ringR(melee) * 2 + 6;
    case 'column': return Math.ceil(melee / 4) * 7;
    case 'skirmish': return 24;
    case "echelon": return Math.ceil(melee / 6) * 12 + 12;
    case 'checker': return 42;
  }
  return 40;
}
function slotOffset(A, p) {
  const nArch = A.nArch || 0, nCav = A.nCav || 0, nArt = A.nArt || 0, melee = meleeCount(A);
  let i = memberIdx(A, p);
  const ci = memberIdx(A, A.cmd), depth = meleeDepth(A, Math.max(1, melee));
  if (p===A.cmd) return [0, depth + 8];
  if (ci >= 0 && i > ci) i--;
  if (p.job === 'medic') { const nMed = A.nMed || 1, j = A.members.filter(q => q.job === 'medic').indexOf(p); return [(j - (nMed - 1) / 2) * 12, depth + 38]; }
  const b = bj(p);

  if (A.ww && (p.job === 'mg' || p.job === 'sniper')) {
    const liste = A.members.filter(q => q.job === p.job), j = liste.indexOf(p), n = liste.length, fh = frontHalf(A, melee);
    return [((j + 1) / (n + 1) * 2 - 1) * fh * 0.9, p.job === 'mg' ? 3 : 8];
  }
  if (b === 'cavalry' && i >= melee && i < melee + nCav) {
    const j = i - melee, side = j % 2 ? 1 : -1, k = j >> 1;

    return [side * (frontHalf(A, melee) + 14 + (k % 3) * 11), (k / 3 | 0) * 11 - 4];
  }
  if (b === 'artillery' && i >= melee + nCav + nArch) {
    const j = i - melee - nCav - nArch;
    return [(j - (nArt - 1) / 2) * 18, depth + 50];
  }

  if (b === 'archer' && i >= melee + nCav) {
    const j = i - melee - nCav;
    if (A.form === 'horde') { const cols = Math.max(4, Math.ceil(nArch / 2)); return [(j % cols - (cols - 1) / 2) * 8, depth + 16 + (j / cols | 0) * 8]; }
    if (A.form === 'schiltron' || A.form === 'testudo') {
      const cols = Math.max(2, Math.ceil(Math.sqrt(nArch))), row = j / cols | 0;
      if (A.form === "schiltron") return [(j % cols - (cols - 1) / 2) * 5, ringR(melee) + (row - (Math.ceil(nArch / cols) - 1) / 2) * 5];
      return [(j % cols - (cols - 1) / 2) * 5, depth + 8 + row * 6];
    }
    if (A.form==='column') return [(j % 4 - 1.5) * 6, depth + 10 + (j / 4 | 0) * 7];
    if (A.form === 'skirmish') { const sutunlar = Math.ceil(nArch / 2) || 1; return [(j % sutunlar - (sutunlar - 1) / 2) * 12 + 6, depth + 6 + (j / sutunlar | 0) * 10]; }
    const satirlar = nArch > 14 ? 2 : 1, per = Math.ceil(nArch / satirlar), row = j % satirlar, k = j / satirlar | 0;
    const t = per > 1 ? k / (per - 1) * 2 - 1 : 0, yari = frontHalf(A, Math.max(1, melee)) + 14, th = t * 1.25;
    return [Math.sin(th) * yari / Math.sin(1.25), depth + 22 + row * 7 - (1 - Math.cos(th)) * (depth + 22) * 0.8];
  }
  switch (A.form) {
    case 'crescent': {
      const t = melee > 1 ? i / (melee - 1) * 2 - 1 : 0, R = 25 + melee * 1.2;
      return [Math.sin(t * 1.2) * R, -(1 - Math.cos(t * 1.2)) * R * 0.9 + (i % 2) * 7];
    }
    case 'squares': {
      const b = i / 9 | 0, nb = Math.ceil(melee / 9), j = i % 9;
       return [(b - (nb - 1) / 2) * 30 + (j % 3 - 1) * 7, (j / 3 | 0) * 7];
    }
    case 'horde': {
      const h1 = (p.id * 9301 + 49297) % 233280 / 233280, h2 = (p.id * 4096 + 150889) % 714025 / 714025;
      return [(h1 - 0.5) * 70, h2 * 40];
    }
    case 'phalanx': {
      const cols = phalanxCols(melee);
      return [(i % cols - (cols - 1) / 2) * 5.5, (i / cols | 0) * 5];
    }
    case 'shieldwall': {
      const sutunlar = Math.ceil(melee / wallRows(melee));
      return [(i % sutunlar - (sutunlar - 1) / 2) * 5, (i / sutunlar | 0) * 6];
    }
    case 'testudo': {
      const sutunlar = Math.ceil(Math.sqrt(melee));
      return [(i % sutunlar - (sutunlar - 1) / 2) * 4.5, (i / sutunlar | 0) * 4.5];
    }
    case 'wedge': {
      const r = Math.floor(Math.sqrt(i)), pos = i - r * r;
      return [(pos - r) * 5.5, r * 6];
    }
    case 'schiltron': {
      const R0 = ringR(melee), ring = i % 2, per = Math.ceil(melee / 2), a = (i >> 1) / per * Math.PI * 2 + ring * Math.PI / per, r = R0 + ring * 6;
      return [Math.sin(a) * r, R0 - Math.cos(a) * r];
    }
    case 'column': return [(i % 4 - 1.5) * 6, (i / 4 | 0) * 7];
    case 'skirmish': {
      const sutunlar = Math.ceil(melee / 2);
      return [(i % sutunlar - (sutunlar - 1) / 2) * 13, (i / sutunlar | 0) * 12 + (i % 2) * 4];
    }
    case 'echelon': {
      const b = i / 6 | 0, nb = Math.ceil(melee / 6), j = i % 6;
      return [(b - (nb - 1) / 2) * 24 + (j % 3 - 1) * 7, b * 12 + (j / 3 | 0) * 7];
    }
    case 'checker': {
      const b = i / 9 | 0, nb=Math.ceil(melee / 9), j = i % 9;
      return [(b - (nb - 1) / 2) * 22 + (j % 3 - 1) * 6, (b % 2) * 24 + (j / 3 | 0) * 6];
    }
    default: {
      const sutunlar = meleeCols(A, melee);
      return [(i % sutunlar - (sutunlar - 1) / 2) * 7, (i / sutunlar | 0) * 7];
    }
  }

}

const DEPLOY = 220;
function battleMove(p, g, A)
{
  if (p.guardOf && p.guardOf === A.cmd && guardMove(p, g, A)) return;
  const archer = isRanged(p), B = A.battle, os = 1 - (A.bside || 0), O0 = bArmies(B, os)[0] || (os ? B.b : B.a);
  const O = { cx: B.cx[os], cy: B.cy[os], btac: O0.btac };
  const dir = Math.atan2(O.cy - A.cy, O.cx - A.cx), cd = Math.cos(dir), sd=Math.sin(dir), px = -sd, py = cd;
  const galled = A.shotT > Sim.tick - 80 && rangedN(A) < A.members.length * 0.25 && B.t > 60;
  if (galled && !A.galled) { A.galled = true; say(A.cmd, '📯', 120); }
  if (B.t < DEPLOY * (B.ambush && B.ambush !== A ? 1.6 : 1) && A.form !== 'horde' && B.ambush !== A && !A.rush && !A.galled) {
    const [lat, back] = slotOffset(A, p);
    if (archer) {
      const firing = fireAt(p, g, 100);
      const fa = p.a;
      if (moveTo(p, A.anchor.x + px * lat - cd * back, A.anchor.y + py * lat - sd * back, 1.1)) p.a = firing ? fa : dir;
      else if (firing) p.a=fa;
      return;
    }
    if (reflex(p, g, 14)) return;
    if (moveTo(p, A.anchor.x + px * lat - cd * back, A.anchor.y + py * lat - sd * back, 1.1)) p.a=dir;
    return;
  }
  if (p === A.cmd && !A.charged) { A.charged = true; say(p, TAC_ICON[A.btac] || '⚔️', 120); }
  if (p === A.cmd && cmdBack(p, g, A, B.cx[os], B.cy[os])) return;
  const T0 = A.rush ? B.t - (A.joinT || 0) : A.galled ? 9999 : B.t - DEPLOY, cav = isCav(p), [lat, back] = slotOffset(A, p);
  let tac = A.btac;
   if (tac === 'feint' && A.feint === "flee") {
    if (archer ? fireAt(p, g, 95) : engage(p, g, 8)) return;
    const fx = A.anchor.x - cd * 150, fy = A.anchor.y - sd * 150;
    moveTo(p, fx + px * lat - cd * back, fy + py * lat - sd * back, 1.1);
    return;
  }
  if (tac === 'kite' && bj(p) === 'archer' && kiteAway(p, g)) return;
  if (strike(p, g, 95, A.form === 'horde' ? 60 : 35)) return;
  if (bj(p) === 'artillery') {
    return moveTo(p, O.cx - cd * 170 + px * lat, O.cy - sd * 170 + py * lat);
  }

  if (tac === 'feint') tac='charge';
  if (tac === 'hold' && (T0 > 500 || O.btac === 'hold')) tac=T0 > 250 ? 'charge' : 'hold';
  const fh = frontHalf(A, meleeCount(A)), wing=Math.abs(lat) > Math.max(20, fh * 0.4);
  const foeFront = { x: O.cx - cd * 25, y: O.cy - sd * 25 };
  let taban = foeFront, L = lat, Bk = back, pace = tac === "charge" || A.form === 'horde' ? 1.15 : 1;

  const holdAt = (until, give = 0) => { if (T0 < until) { taban = { x: A.anchor.x - cd * give * Math.min(1, T0 / until), y: A.anchor.y - sd * give * Math.min(1, T0 / until) }; pace = 1; } };
  switch (tac) {
    case 'hold': taban=A.anchor; break;
    case 'pincer': if (!wing && !cav && !archer) holdAt(450, 30); break;
    case 'hammer': if (!cav && !archer) holdAt(300); break;
    case 'center': if (!cav && !archer) { L = lat * 0.35; Bk = back * 1.3; pace = 1.2; } break;
    case 'oblique': if (!archer && lat > 0) holdAt(450); break;
    case 'volley': case 'kite':
      if (archer) taban = { x: O.cx - cd * 85, y: O.cy - sd * 85 };
      else if (!cav) holdAt(tac === "kite" ? 800 : 600);
      break;
  }
  let tx = taban.x + px * L - cd * Bk, ty = taban.y + py * L - sd * Bk;
  if (archer && (tac === 'volley' || tac === 'kite')) { tx=taban.x + px * lat * 0.8; ty = taban.y + py * lat * 0.8; }
  const foeSoft = O0 && O0.members.length && (O0.nArch || 0) + (O0.nArt || 0) >= O0.members.length * 0.6;
  const flanker = (cav && !foeSoft) || (!archer && A.form !== 'horde' && ((tac === 'flank' && Math.abs(lat) > 20) || (tac === 'pincer' && wing)));
  if (flanker && (Math.abs(lat) > 20 || cav)) {
     const taraf = Math.sign(lat) || (p.id % 2 ? 1 : -1), wide = cav ? (tac === 'hammer' ? 140 : 90) : tac === 'pincer' ? 75 : 60;
    const wx = O.cx + px * taraf * wide - (tac === 'pincer' ? cd * 10 : 0), wy = O.cy + py * taraf * wide - (tac === 'pincer' ? sd * 10 : 0);
    if (!p.flanked && (p.x - wx) ** 2 + (p.y - wy) ** 2 < 400) p.flanked = true;
    const rear = cav ? (tac === 'hammer' ? 60 : 35) : tac === 'pincer' ? 20 : 0;
    if (!p.flanked) { tx = wx; ty = wy; } else { tx = O.cx + cd * rear; ty = O.cy + sd * rear; }
  }
  moveTo(p, tx, ty, pace);
}
const TAC_ICON = { charge: '⚔️', flank: '↪️', hold: '🛡', pincer: "🦀", hammer: '🔨', feint: '🏇', kite: '🏹', center: '🗡', oblique: '📐', volley: '🌧' };

function shoot(p, g, range)
{
  if (GUNS[p.job]) return gunFire(p, g, range);
  const hill = onHill(p), xb = p.job === 'xbow';
  if (hill) range *= 1.15;
  if (xb) range *= 0.9;
  let dusman = p.foe;
  if (!dusman || dusman.dead || downed(dusman) || (!dusman.army && dusman !== Sim.ctrl && dusman.state !== 'courier') || dist2(p, dusman) > range * range) {
    dusman = null;
    if ((Sim.tick + p.id) % 10 === 0) {
      let fd = range * range;
      near(g, p.x, p.y, range, q => {
        if (q.dead || (!q.army && q !== Sim.ctrl && q.state !== 'courier') || (q.army && q.army.state === 'sail') || !hostile(p.k, q.k) || q.hid) return;
        const d = dist2(p, q);
        if (d<fd) { fd = d; dusman = q; }
      });
    }
     p.foe = dusman
  }
  if (!dusman) return false;
  p.a = Math.atan2(dusman.y - p.y, dusman.x - p.x);
  if ((Sim.tick + p.id) % (xb ? 75 : 35) === 0) fireArrow(p, dusman, (2 + p.stats.spd * 0.25 + p.stats.int * 0.2) * 0.8 * techMul(p.k) * vetMul(p) * (terrainAt(p.x, p.y) === T_FOREST ? 1.2 : 1) * (hill ? 1.15 : 1) * (xb ? 2.4 : 1), xb);
  return true;
}
function fireArrow(from, foe, hasar, ap) {
  from.loud = Sim.tick;
  const d = dist(from, foe), skill = from.stats ? clamp(1.35 - (from.stats.int + from.stats.spd) * 0.03, 0.6, 1.3) : 1;
  const sp = (2 + d * 0.11 * skill) * (ap ? 0.75 : 1), a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * sp;
  Sim.arrows.push({ x0: from.x, y0: from.y, tx: foe.x + Math.cos(a) * r, ty: foe.y + Math.sin(a) * r, foe, from, dmg: hasar, t: 0, T: Math.max(6, d / 6 | 0), ap: !!ap });
}
function updateArrows()
{
  Sim.arrows = Sim.arrows.filter(a => {
    if (++a.t < a.T) return true;
    if (a.shell) { shellHit(a); return false; }
    if (a.bullet) { bulletHit(a); return false; }
    const f = a.foe;
    if (f.hull) { if (!f.dead) damageShip(f, a.dmg, a.from); }
    else if (f.mon) { if (!f.dead) hurtMonster(f, a.dmg, a.from); }
    else if (!f.dead && (f.x - a.tx) ** 2 + (f.y - a.ty) ** 2 < 64) {
      if (f.army) { f.army.shotT = Sim.tick; if (a.from.army) f.army.shotBy=a.from.army; }
      f.loud = Sim.tick;
      if (a.from.stats) { f.hitT = Sim.tick; f.hitBy = a.from; }
      const ap = a.ap && f.job !== 'tank' && (f.job === 'shield' || f.job === 'knight' || f.job === 'cavalry') ? 1.8 : 1;

      f.hp -= a.dmg * takenMul(f, true) * ap / (0.6 + f.stats.end * 0.08);
      if (f.hp <= 0) kill(f, a.from.stats ? a.from : null, "ok");
    }
    return false;
  });
}

function checkCapture(A) {
  const T = A.target;
  let def = 0, inside = 0;
  for (const p of Sim.people) if (!p.dead && p.k === T.k && p.state !== 'jailed' && (isFighter(p) || p.job === 'king') && dist2(p, T) < (T.r + 40) ** 2) def++;
  for (const p of A.members) if (dist2(p, T)<T.r ** 2) inside++;
  if (def === 0 && inside > 0) { A.cap += 5; if (A.cap > 80) decideFate(A); } else A.cap = 0;
}

function decideFate(A) {
  const T = A.target, k = A.k, c = cruelty(A);
  A.cap = 0;
  if (c > 16 && T !== T.k.capital && Math.random() < 0.5) return raze(A);
  if (c > 12) {
    A.massacre = true; A.state = 'occupy'; A.t = 0;

    plog(A.cmd, lang`${T.name} halkının kılıçtan geçirilmesini emretti`);
    chron(lang`🩸 Katliam! ${k.name} askerleri ${T.name} halkına kılıç çekti. Emri veren: ${fullName(A.cmd)}`, k, T.k, T);
    return;
  }
  plog(A.cmd, lang`${T.name} halkına dokunulmamasını emretti`);
  chron(lang`🏳 ${T.name} teslim oldu. Komutan ${fullName(A.cmd)} halka dokunulmamasını emretti`, k, T.k, T)
   capture(A);
}

function countConquest(k, old) {
  const r=getRel(k, old);
  r.conq=r.conq || {};
  r.conq[k.id] = (r.conq[k.id] || 0) + 1;
}

function raze(A) {
  const T = A.target, k = A.k, eski = T.k;
  const refuge = kSettlements(eski).filter(s => s !== T);
  let killed = 0, fled=0;
  for (const p of Sim.people.filter(p => !p.dead && p.s === T)) {
    if (p.army) continue;
    if (!refuge.length || Math.random() < 0.5) { kill(p, null, "katliam"); killed++; continue; }
    const to = refuge.reduce((a, b) => dist2(a, p) < dist2(b, p) ? a : b);
    leaveArmy(p); p.s = to; p.state = 'migrate'; p.home = null; fled++;
    plog(p, lang`${T.name} yakılınca ${to.name} şehrine sığındı`);
  }
  T.dead = true; T.houses = [];
  Sim.settlements = Sim.settlements.filter(s => s !== T);
  Sim.ruins.push({ x: T.x, y: T.y, name: T.name, r: T.r, year: year() });
  Sim.terrDirty = true; countConquest(k, eski);
  plog(A.cmd, lang`${T.name} şehrini yakıp yıktı`);
  chron(lang`🔥 ${T.name} yerle bir edildi! ${k.name} ordusu ${killed} kişiyi öldürdü, ${fled} kişi kaçtı. Komutan: ${fullName(A.cmd)}`, k, eski, T);
  if (!kSettlements(eski).length) fall(eski);
  A.state = 'march'; A.t = 0;

}

function capture(A) {
  const k = A.k, T = A.target, eski=T.k;
  A.cap = 0;
  T.k=k; k.conquests++; Sim.terrDirty = true; countConquest(k, eski);
  T.conqY = year(); T.stab = Math.min(T.stab, 30);
  if (T.walls) T.walls.hp = 0;
  const sonuc = Sim.people.filter(p => !p.dead && p.s === T);
  const oldKing = eski.king && eski.king.s === T ? eski.king : null;
  for (const p of sonuc) {
    if (p===oldKing) continue;
    leaveArmy(p); p.k = k;
    if (isTroop(p) || p.job === 'guard') setJob(p, 'farmer');
  }
  for (const sh of Sim.ships) if (sh.home === T && sh.type !== 'transport') sh.k = k;
  plog(A.cmd, lang`${T.name} şehrini fethetti`);
  chron(lang`🏴 FETİH! ${T.name} düştü: ${eski.name} → ${k.name}. Fatih komutan: ${fullName(A.cmd)}`, k, eski, T);
  if (eski.capital === T) {
    const kalan = kSettlements(eski);

    if (kalan.length) { eski.capital = kalan[0]; chron(lang`${eski.name} başkentini ${kalan[0].name} şehrine taşıdı`, eski, null, kalan[0]); }
  }
  if (oldKing) { chron(lang`⚔️ ${title(oldKing)} ${fullName(oldKing)} esir alınıp idam edildi`, eski, k, T); kill(oldKing, A.cmd, 'idam'); }
  if (!kSettlements(eski).length) fall(eski);
   A.state = 'march'; A.t = 0;
}

function followPath(A, goal) {
  const c = A.cmd;
  if (!A.path || A.pathGoal !== goal || Sim.tick - A.pathT > 600 || c.stuck > 200) {
    A.path = findPath(c.x, c.y, goal.x, goal.y);
    A.pathGoal = goal; A.pathT = Sim.tick; c.stuck = 0;
    A.noPath = !A.path;

    if (!A.path) A.path = [];
  }
  while (A.path.length && dist2(c, A.path[0]) < 144) A.path.shift();
  const wp = A.path[0] || goal;
  moveTo(c, wp.x, wp.y);
}

function armyMove(p, g)
{
  const A = p.army, c = A.cmd, T = A.target;
  if (A.state==='sail') { if (A.ship) { p.x = A.ship.x; p.y = A.ship.y; } return; }
  if (p.job === 'medic' && medicMove(p, g, A)) return;
  if (A.order) return orderMove(p, g, A);
  if (A.state === "battle") return battleMove(p, g, A);
  if (A.state === 'retreat' && routing(A)) return routMove(p, A);
  if (A.manual) return manualMove(p, g, A);
  if (A.state === 'retreat') {
    if (p === c) return followPath(A, A.k.capital || p.s);
    return formation(p, A, c.x, c.y);
  }
  if (A.state === "defend" && A.post) {
    const P=A.post, a = P.a;

    if (p===c) { const b = meleeDepth(A, meleeCount(A)) + 16; if (moveTo(c, P.x - Math.cos(a) * b, P.y - Math.sin(a) * b)) c.a = a; return; }
    const [lat, back] = slotOffset(A, p);

    if (moveTo(p, P.x - Math.sin(a) * lat - Math.cos(a) * back, P.y + Math.cos(a) * lat - Math.sin(a) * back)) p.a = a;
    return;
  }
  if (A.state === 'ambush' && A.ambush) {
    if (p === c) return followPath(A, A.ambush);
    return formation(p, A, c.x, c.y);
  }
  if (A.state === 'gather' || A.state === 'defend') { const h = A.k.capital || p.s; return formation(p, A, h.x, h.y); }
  if (A.state === 'intercept' || A.state === 'march' || A.state === 'embark') {
    if (p === c) {
      if (A.state === 'intercept' && A.foeArmy) return followPath(A, A.foeArmy.cmd);
      if (A.state === 'embark' && A.ship) { if (A.goalFor!==A.ship) { A.goal = { x: A.ship.home.port.lx, y: A.ship.home.port.ly }; A.goalFor = A.ship; } }
      else if (A.goalFor !== T) { A.goal = stopPoint(A); A.goalFor = T; }
      return followPath(A, A.goal);
    }
    return formation(p, A, c.x, c.y);
  }
  if (bj(p) === 'artillery' && p.job !== 'gatling' && !A.raid) return siegeGun(p, g, T);
  if (strike(p, g, 95, 120)) return;
  const w = T.walls, arch = bj(p) === 'archer';
  if (w && w.hp > 0 && !A.raid) {
    const a = Math.atan2(p.y - T.y, p.x - T.x), rr = wallRay(T, a) + (arch ? 35 : 3);
    if (moveTo(p, T.x + Math.cos(a) * rr, T.y + Math.sin(a) * rr) && !arch) w.hp -= 0.03 + p.stats.str * 0.01;
    return;
  }
  moveTo(p, T.x + (p.slot % 7 - 3) * 6, T.y + ((p.slot / 7 | 0) % 7 - 3) * 6);
}

function engage(p, g, r) {
  const massacre = p.army && p.army.massacre;
  const f=p.foe;
  if (f && !f.dead && f.state !== 'jailed' && !downed(f) && hostile(p.k, f.k) && dist2(p, f) < (r * 1.5) ** 2) { moveTo(p, f.x, f.y, 1.1); return true; }
  p.foe = null;
  if ((Sim.tick + p.id) % 15 !== 0) return false;
  let fd = r * r;
  near(g, p.x, p.y, r, q => {
    if (q.dead || q.state === 'jailed' || q.state === "arrested" || downed(q) || !hostile(p.k, q.k) || (q.army && q.army.state === 'sail')) return;
    if (!isFighter(q) && q.job !== 'king' && !massacre) return;
    const d = dist2(p, q);
    if (q.hid && d > HID_SPOT * HID_SPOT) return;
    if (d<fd) { fd = d; p.foe = q; }
  });
  return !!p.foe;
}

function defendTown(p, g) {
  if (p.army || (p.job !== 'guard' && !isTroop(p)) || Sim.wars === 0) return false;
  if (isRanged(p)) {
    const f = p.foe;
    if (f && !f.dead && f.army && dist2(f, p.s) > (p.s.r + (bj(p) === 'artillery' ? 200 : 110)) ** 2) p.foe = null;
    return fireAt(p, g, 100);
  }
  const f = p.dfoe;
  if (f && !f.dead && f.army && hostile(p.k, f.k) && dist2(f, p.s) < (p.s.r + 80) ** 2) { moveTo(p, f.x, f.y, 1.1); return true; }

  p.dfoe = null;
  if ((Sim.tick + p.id) % 15) return false;
  let fd = 90 * 90;

  near(g, p.x, p.y, 90, q => { if (!q.dead && q.army && hostile(p.k, q.k) && dist2(q, p.s) < (p.s.r + 80) ** 2) { const d = dist2(p, q); if (d < fd) { fd=d; p.dfoe = q; } } });
  return !!p.dfoe;
}

function armyHitReact(A) {

  const H = A.hitBy;
  if (!(A.hitT > Sim.tick - 30) || !H || H === A || !H.members.length || !H.k.armies.includes(H) || H.state === "sail" || !hostile(A.k, H.k) || A.battle) return false;
  if (A.escapeUntil > Sim.tick || A.lv) return false;
  A.hitBy = null;
  if (A.cp && A.cp.phase === 'ambush') { cpSpring(A); return true; }
  if (H.battle) return Sim.battles.includes(H.battle) && joinBattle(A, H.battle, 1 - H.bside);
  say(A.cmd, '❗', 120);

  startBattle(A, H);
  return A.state === 'battle';
}
function aiHelp(A)
{
  let enIyi = null, bs = Infinity;
  for (const B of Sim.battles) for (const s of [0, 1]) {
    const mine = bArmies(B, s);
    if (!mine.length || mine.includes(A) || !mine.some(X => X.k === A.k || (A.k.rel.get(X.k) && A.k.rel.get(X.k).status === 'alliance'))) continue;
    const dusmanlar = bArmies(B, 1 - s).filter(X => hostile(A.k, X.k));
    if (!dusmanlar.length) continue;
    const d = (B.cx[s] - A.cmd.x) ** 2 + (B.cy[s] - A.cmd.y) ** 2, X = mine[0], need = (X.ratio ?? 1) * (X.left ?? 1);
    if (d > 500 * 500 || need > 1.1) continue;
    const sc = need * 2 + Math.sqrt(d) / 500;
    if (sc < bs) { bs = sc; enIyi = [B, s, dusmanlar[0], X]; }
  }
  if (!enIyi || Math.random() > clamp(0.5 + (A.cmd.stats.int - 5) * 0.06, 0.3, 0.9)) return;
  const [B, , F, X] = enIyi;
   A.helpPrev = A.state === "defend" ? 'defend' : 'march'; A.foeArmy = F; A.state = 'intercept'; A.t = 0; A.path = null;

  say(A.cmd, '📯', 150);
  chron(lang`📯 ${A.k.name} ordusu, ${B.name} savaşında zor durumdaki ${X.k === A.k ? lang('dost') : lang('müttefik ') + X.k.name} ordusunu görüp yolunu değiştirdi: yardıma koşuyor`, A.k, F.k, B.place);
}

function formation(p, A, cx, cy)
{

  if (p.hitT > Sim.tick - 45 && A.state !== 'retreat' && !routing(A) && (isRanged(p) ? fireAt(p, Sim.grid, 95) : reflex(p, Sim.grid, 6))) return;
  const yon = A.cmd.a, [lat, back] = slotOffset(A, p);
  moveTo(p, cx - Math.sin(yon) * lat - Math.cos(yon) * (back + 8), cy + Math.cos(yon) * lat - Math.sin(yon) * (back + 8));
}

function plague(k) {
  let n = 0;
  for (const p of Sim.people) if (!p.dead && p.k === k && Math.random() < 0.35 - p.stats.end * 0.02) { kill(p, null, 'veba'); n++; }
  chron(lang`☠ ${k.name} topraklarında veba salgını! ${n} kişi öldü`, k);
}
function meteor(x, y) {
  let n = 0;
  for (const p of Sim.people) if (!p.dead && (p.x - x) ** 2 + (p.y - y) ** 2 < 2500) { kill(p, null, "meteor"); n++; }
  for (const s of Sim.settlements) {
    s.houses = s.houses.filter(h => (h.x - x) ** 2 + (h.y - y) ** 2 > 2500);
    s.cap = s.houses.length * CFG.houseCap;

    for (const b in BLDG) if (s[b] && (s[b].x - x) ** 2 + (s[b].y - y) ** 2 < 2500) s[b]=null;
    if (s.walls && dist(s, { x, y }) < s.walls.r + 50) s.walls.hp = Math.max(0, s.walls.hp - 200);
  }
  Sim.fx.push({ x, y, t: 60, type: 'boom' });
  chron(lang`☄ Gökten bir meteor düştü! ${n} kişi öldü`)
}

function initWorld()
{
  genWorld();
  buildSeasonImgs();
  Object.assign(Sim, { sides: [], bases: [], camps: [], diseases: [], people: [], kingdoms: [], settlements: [], log: [], fx: [], hall: [], deaths: {}, battles: [], battleLog: [], ruins: [], trenches: [], arrows: [], msgs: [], traps: [], recentB: [], ships: [], monsters: [], popHist: [], rainUntil: 0, wx: null, scen: null,
    tick: 0, wars: 0, sel: null, selK: null, selS: null, ready: true });
  chron(lang('🌍 Dünya yaratıldı'));
}

function findHome(ev, minD) {
  for (let i = 0; i < 600; i++) {
    const x = rnd(60, W - 60), y = rnd(60, H - 60), t = terrainAt(x, y);
    const ok = ev === "grass" ? t === T_GRASS : ev === 'forest' ? t === T_FOREST : t === T_HILLS;
    if ((ok || i > 400) && t >= T_BEACH && t < T_MOUNT && Sim.settlements.every(s => dist(s, { x, y }) > minD)) return { x, y };
  }
  return null;
}

function quickStart() {
  campOff();
  if (!Sim.ready || Sim.arena) { Sim.arena=false; initWorld(); }
  for (const rk of ['human', 'elf', 'dwarf', 'orc', 'halfling', 'goblin']) {
    const spot=findHome(RACE_DB[rk].home, 600);
    if (spot) foundKingdom(rk, spot.x, spot.y, 14);
  }
}

function step() {
  Sim.tick++;
  Sim.pathBudget = 3;
  const g = buildGrid();
  Sim.grid = g;
  for (const s of Sim.settlements) if ((Sim.tick + s.id * 37) % CFG.year === 0) settlementYear(s);
  if (Sim.tick % CFG.year === 200 || (Sim.terrDirty && Sim.tick % 20 === 0)) computeTerritory();
  if (Sim.tick % 2 === 0) separate(g);
  if (Sim.tick % 30===0) for (const s of Sim.settlements) s.food -= s.pop * CFG.eat;
  if (Sim.tick % CFG.year === 150 && !Sim.arena) yearlyKingdoms();
  if (Sim.tick % 5 === 0) {
    for (const k of Sim.kingdoms) if (!k.dead) warLogic(k);
    for (const B of [...Sim.battles]) updateBattle(B);
    cpTick();

    if (Sim.scen) scenTick();
  }
  if (Sim.tick % 10===0) concealTick(g);
  updateArrows();
  updateShips();
  natureTick();
  lifeTick();
  if (Sim.tick % 50 === 0) { decayRoads(); countWars(); trenchTick(); }
  for (const p of shuffledPeople()) if (!p.dead) updatePerson(p, g);
  if (Sim.tick % 10 === 0) Sim.people = Sim.people.filter(p => !p.dead);
  if (Sim.camp && Sim.tick % MTICK === 0) campLocalTick();
}

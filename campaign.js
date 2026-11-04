const RCW = 24, RCH = 16, CP = 8;
let RX = 4, RY = 3, MC = RCW * RX, MR = RCH * RY;
function setCampSize(buyuk) { RX = buyuk ? 8 : 4; RY = buyuk ? 5 : 3; MC = RCW * RX; MR = RCH * RY; CW.big = !!buyuk; }
const LPC = W / RCW;
const MTICK = 25;
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const UPOW = { soldier: 1, archer: 0.9, cavalry: 1.7, artillery: 2.2 };
const CW = {
  on: false, view: "map", t: 0, nations: [], cities: [], armies: [], roads: [], msgs: [], rel: new Map(), log: [], adj: new Set(),
  cam: { x: MC * CP / 2, y: MR * CP / 2, z: 1.3 }, saved: new Map(), kOf: new Map(), calm: 0, sel: null, hover: null, drag: null, active: -1, acc: 0, fr: 0, cards: true, terrDirty: true, nextA: 1,
  provs: [], pv: null, core: null, battles: [], plans: [], selA: new Set(), player: null, fc: {}, nextB: 1, rdrag: null, box: null, watch: null,
};

function mulberry32(a)
{
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function withSeed(seed, fn) { const r = Math.random; Math.random = mulberry32(seed); try { return fn(); } finally { Math.random = r; } }

const cIdx = (x, y) => clamp(y | 0, 0, MR - 1) * MC + clamp(x | 0, 0, MC - 1);

const isLandC = i => CW.ter[i] >= T_BEACH && CW.ter[i] < T_SNOW;
const regionOf = (x, y) => clamp(y / RCH | 0, 0, RY - 1) * RX + clamp(x / RCW | 0, 0, RX - 1);

const regName = ri => 'ABCDEFGH'[ri % RX] + ((ri / RX | 0) + 1);
const natById = id => CW.nations.find(n => n.id === id);
const relKey = (a, b) => a.id < b.id ? a.id + "-" + b.id : b.id + '-' + a.id;
const relN = (a, b) => (CW.rel.get(relKey(a, b)) || { st: 'peace' }).st;
const warN = (a, b) => a !== b && relN(a, b) === 'war';
const setRel = (a, b, st, since) => CW.rel.set(relKey(a, b), { st, since: since ?? cYear() });
const cYear=() => CW.t / 12 | 0;
const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const armySize = a => a.n.soldier + a.n.archer + a.n.cavalry + a.n.artillery;
const raceMul = N => { const R = RACE_DB[N.race]; return (R.stats.str * R.size + R.stats.end * 0.5) / 7.5 * (1 + N.tech * 0.08); };
const armyPow = a => (a.n.soldier * UPOW.soldier + a.n.archer * UPOW.archer + a.n.cavalry * UPOW.cavalry + a.n.artillery * UPOW.artillery) * raceMul(a.nat) * (0.5 + a.morale / 200);
const liveArmies = () => CW.armies.filter(a => !a.dead);
const natCities = N => CW.cities.filter(c => c.own === N);
const nearCity = (p, f) => { let b = null, bd = Infinity; for (const c of CW.cities) { if (f && !f(c)) continue; const d = hyp(p, c); if (d < bd) { bd = d; b=c; } } return b; };
const placeOf = p => { const c = nearCity(p); return c ? (hyp(p, c) < 1.5 ? c.name : lang`${c.name} yakınında`) : lang('bilinmeyen bir yerde'); };
function clog(yazi) { CW.log.unshift({ y: cYear(), text: yazi }); if (CW.log.length > 300) CW.log.pop(); }

function campType(h, m)
{
  const th = CW.th;
  return h < th.deep ? T_DEEP : h < th.sea ? T_SEA : h < th.beach ? T_BEACH : h >= th.snow ? T_SNOW
    : h >= th.mount ? T_MOUNT : h >= th.hills ? T_HILLS : m > 0.53 ? T_FOREST : T_GRASS;
}
function campTerrain() {
  withSeed(CW.seed, () => {

    const oct = [[16, 0.5], [8, 0.27], [3.5, 0.15], [1.4, 0.08]].map(([c, w]) => [makeNoise(MC, MR, c), w]);
    const m1 = makeNoise(MC, MR, 9), m2 = makeNoise(MC, MR, 2.5);
    CW.hf = (x, y) => {
      let h = 0;
      for (const [n, w] of oct) h += n(x, y) * w;
      const e = Math.min(x, MC - x, y * 1.4, (MR - y) * 1.4);
      return h - Math.max(0, 7 - e) * 0.03;
    };
    CW.mf = (x, y) => m1(x, y) * 0.7 + m2(x, y) * 0.3;
  });
   const n = MC * MR, hs = new Float32Array(n);
  for (let i = 0; i < n; i++) hs[i] = CW.hf(i % MC + 0.5, (i / MC | 0) + 0.5);
  const sirali = Float32Array.from(hs).sort(), q = p => sirali[Math.floor(p * (n - 1))];
  CW.th={ deep: q(0.14), sea: q(0.24), beach: q(0.255), hills: q(0.8), mount: q(0.91), snow: q(0.975) };
  CW.ter = new Uint8Array(n);
  for (let i = 0; i < n; i++) CW.ter[i]=campType(hs[i], CW.mf(i % MC + 0.5, (i / MC | 0) + 0.5) - 0.06);
  campRelief();
}

function campRelief() {
  const iw = MC * CP, ih = MR * CP, th = CW.th;
  const img = document.createElement('canvas');
  img.width = iw; img.height = ih;
  const ic = img.getContext('2d'), id = ic.createImageData(iw, ih), px = id.data;
  const hp = new Float32Array(iw * ih);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) hp[y * iw + x] = CW.hf((x + 0.5) / CP, (y + 0.5) / CP);

  const C={ deep: [22, 62, 110], shallow: [72, 150, 196], sand: [214, 200, 150], grassL: [132, 172, 92], grassD: [92, 138, 70],
    forest: [62, 104, 58], hills: [150, 140, 100], mount: [128, 118, 106], mountD: [96, 90, 84], snow: [236, 238, 242] };
  const lerpC = (a, b, t) => { t = clamp(t, 0, 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const [jxN, jyN] = withSeed(CW.seed + 7, () => [makeNoise(iw, ih, 7), makeNoise(iw, ih, 7)]);
  CW.pixCell = new Int32Array(iw * ih); CW.pixLand = new Uint8Array(iw * ih);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const i = y * iw + x, cx = (x + 0.5) / CP, cy = (y + 0.5) / CP, h = hp[i], m = CW.mf(cx, cy) - 0.06, t = campType(h, m);
    let col, k = 1;
    if (t <= T_SEA) {
      col = lerpC(C.deep, C.shallow, (h - th.deep + 0.05) / (th.sea - th.deep + 0.05));
      if (h > th.sea - 0.003) col = lerpC(col, [225, 235, 238], 0.3);
    } else {
      if (t === T_BEACH) col = C.sand;
      else if (t === T_GRASS) col = lerpC(C.grassL, C.grassD, (m - 0.3) / 0.25);
      else if (t===T_FOREST) col = lerpC(C.grassD, C.forest, (m - 0.53) / 0.1);
      else if (t === T_HILLS) col = lerpC(C.grassD, C.hills, (h - th.hills) / (th.mount - th.hills));
      else if (t === T_MOUNT) col=lerpC(C.mount, C.mountD, (h - th.mount) / (th.snow - th.mount));
      else col=C.snow;
      const slope = (h - hp[Math.max(0, y - 2) * iw + Math.max(0, x - 2)]) * (t >= T_HILLS ? 55 : 30);
      k = clamp(1 + slope, 0.6, 1.45);
      CW.pixLand[i] = 1;
      const j = cIdx(cx + (jxN(x, y) - 0.5) * 1.1, cy + (jyN(x, y) - 0.5) * 1.1);
      CW.pixCell[i] = isLandC(j) ? j : cIdx(cx, cy);
    }
    const o = i * 4;
    px[o] = col[0] * k; px[o + 1] = col[1] * k; px[o + 2]=col[2] * k; px[o + 3] = 255;
  }

  ic.putImageData(id, 0, 0);
  withSeed(CW.seed + 11, () => {
    for (let i = 0; i < MC * MR; i++) {
      const t = CW.ter[i];
       if (!(t === T_MOUNT || t === T_SNOW) || Math.random() > 0.55) continue;

      const x = (i % MC + rnd(0.2, 0.8)) * CP, y = ((i / MC | 0) + rnd(0.5, 0.9)) * CP, s = rnd(3.5, 5.5);
      ic.fillStyle = 'rgba(170,162,150,0.9)'; ic.beginPath(); ic.moveTo(x - s, y); ic.lineTo(x, y - s * 1.3); ic.lineTo(x, y); ic.fill();

      ic.fillStyle = 'rgba(90,84,76,0.9)'; ic.beginPath(); ic.moveTo(x + s, y); ic.lineTo(x, y - s * 1.3); ic.lineTo(x, y); ic.fill();
    }
  });
  CW.relief = img;
}

function campTerrImg() {
  const iw = MC * CP, ih = MR * CP;
  const img = CW.terrImg || (CW.terrImg = document.createElement('canvas'));
  img.width = iw; img.height = ih;
  const ic = img.getContext('2d'), id = ic.createImageData(iw, ih), px = id.data, kendi = CW.own;
  const po = new Int16Array(iw * ih), pp = new Int16Array(iw * ih).fill(-1), core = CW.core;
   for (let i = 0; i < po.length; i++) if (CW.pixLand[i]) { po[i] = kendi[CW.pixCell[i]]; pp[i] = CW.pv[CW.pixCell[i]]; }
  const rgb={}, war = {};
  for (const N of CW.nations) { rgb[N.id]=hexRGB(N.color); for (const O of CW.nations) war[N.id * 100 + O.id] = warN(N, O); }
  for (let i = 0; i < po.length; i++) {
    const o = po[i];
    if (!o) continue;
    const cr = core[CW.pixCell[i]], x = i % iw, y = i / iw | 0;
    const c = cr && cr !== o && rgb[cr] && ((x + y) % 10) < 4 ? rgb[cr] : rgb[o];
    px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 150;
  }
  const set = (i, r, g, b, a) => { px[i * 4] = r; px[i * 4 + 1]=g; px[i * 4 + 2]=b; px[i * 4 + 3] = a; };
  for (let y=0; y < ih - 1; y++) for (let x = 0; x < iw - 1; x++) {
    const i = y * iw + x, o = po[i];
     if (!o) continue;
    for (let k = 0; k < 2; k++) {
      const j=k ? i + iw : i + 1, p = po[j];
      if (p === o && pp[j] !== pp[i] && pp[j] >= 0) { px[i * 4] *= 0.72; px[i * 4 + 1] *= 0.72; px[i * 4 + 2] *= 0.72; px[i * 4 + 3] = 175; continue; }
      if (!p || p === o) continue;
      if (war[o * 100 + p]) {
        if (((x >> 2) + (y >> 2)) & 1) { set(i, 255, 255, 255, 240); set(j, 255, 255, 255, 240); if (x>0) set(i - 1, 255, 255, 255, 200); }
      } else { set(i, 30, 24, 20, 210); set(j, 30, 24, 20, 120); }
    }
  }
  ic.putImageData(id, 0, 0);
  const toplam = {};
  CW.adj=new Set();
  let kara = 0;
   for (let i = 0; i < kendi.length; i++) {
    if (!isLandC(i)) continue;
    kara++;
    const o = kendi[i];

    if (!o) continue;
    const s = toplam[o] || (toplam[o] = { x: 0, y: 0, n: 0 });
    s.x += i % MC + 0.5; s.y += (i / MC | 0) + 0.5; s.n++;
    for (const j of [i + 1, i + MC]) if (j < kendi.length && kendi[j] && kendi[j] !== o) CW.adj.add(Math.min(o, kendi[j]) + '-' + Math.max(o, kendi[j]));
  }
  for (const N of CW.nations) { const s = toplam[N.id]; N.cells = s ? s.n : 0; N.share = s ? s.n / kara : 0; N.lbl = s ? { x: s.x / s.n, y: s.y / s.n } : null; }
  CW.terrDirty = false;
}

function campPath(s, t)
{
  if (s===t) return [];
  const n = MC * MR, onceki = new Int32Array(n).fill(-1), q = new Int32Array(n);
  let head = 0, tail = 0;
  q[tail++] = s; onceki[s]=s;
  while (head < tail) {
    const i = q[head++];
    if (i === t) break;
    const c = i % MC, r = i / MC | 0;
    for (const [dx, dy] of N8) {
      const cc = c + dx, rr = r + dy;
      if (cc < 0 || rr < 0 || cc >= MC || rr >= MR) continue;
       const j = rr * MC + cc;
      if (onceki[j] !== -1 || (!isLandC(j) && j !== t)) continue;
      onceki[j] = i; q[tail++] = j;
    }
  }
  if (onceki[t] === -1) return null;
  const yol = [];
  for (let i = t; i !== s; i = onceki[i]) yol.push(i);
  return yol.reverse();
}

function campCities() {
  const cand=[];
  for (let i = 0; i < MC * MR; i++) { const t = CW.ter[i]; if (t >= T_GRASS && t < T_MOUNT) cand.push(i); }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
  CW.cities = [];

  for (const i of cand) {
    const p = { x: i % MC + 0.5, y: (i / MC | 0) + 0.5 };
    if (CW.cities.some(c => hyp(c, p) < 5.6)) continue;
    CW.cities.push({ id: CW.cities.length, ...p, name: '', own: null, pop: rnd(14, 28) | 0, gar: 0, walls: false, siege: 0, ri: regionOf(p.x, p.y), s: null });
    if (CW.cities.length >= Math.round(44 * MC * MR / (96 * 48))) break;
  }
  const n = MC * MR, prov = new Int16Array(n).fill(-1), q = [];
  for (const c of CW.cities) { const i = cIdx(c.x, c.y); prov[i] = c.id; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], cc = i % MC, rr = i / MC | 0;
    for (const [dx, dy] of N8.slice(0, 4)) {
      const c = cc + dx, r = rr + dy;
      if (c < 0 || r < 0 || c >= MC || r >= MR) continue;
      const j = r * MC + c;
      if (prov[j] !== -1 || !isLandC(j)) continue;
      prov[j] = prov[i]; q.push(j);
    }
  }

  CW.prov=prov;
  CW.cityCell = new Set(CW.cities.map(c => cIdx(c.x, c.y)));
  const gorulen = new Set();
  CW.roads=[];
  for (const a of CW.cities) {
    const yakin = CW.cities.filter(b => b !== a && hyp(a, b) < 13).sort((x, y) => hyp(a, x) - hyp(a, y)).slice(0, 3);
    for (const b of yakin) {
      const key = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id);
      if (gorulen.has(key)) continue;
      let wet = 0;
      for (let t = 0; t <= 1; t += 0.1) if (!isLandC(cIdx(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t))) wet++;
      if (wet > 1) continue;
      gorulen.add(key);
      CW.roads.push({ a, b, bend: rnd(-0.18, 0.18) });
    }
  }
}

const SCEN=[
  { race: 'human', color: '#3a78d4', at: [0.27, 0.55], w: 1, word: 'Kolordu' },
  { race: 'dragonborn', color: '#c42b2b', at: [0.72, 0.45], w: 1.3, word: 'Ordu' },
  { race: 'elf', color: '#b8a62c', at: [0.1, 0.18], w: 0.8, word: 'Ordu' },
  { race: 'dwarf', color: '#8a5aa6', at: [0.86, 0.8], w: 0.9, word: "Ordu" },
];
const SCEN_BIG = [
  { race: 'orc', color: '#4f8a2c', at: [0.5, 0.12], w: 1.1, word: 'Orda' },
  { race: 'halfling', color: '#d98a2b', at: [0.08, 0.85], w: 0.8, word: 'Alay' },
  { race: 'gnome', color: "#2bb3a8", at: [0.4, 0.88], w: 0.8, word: 'Alay' },
  { race: 'tiefling', color: '#7a2b52', at: [0.93, 0.15], w: 1, word: 'Lejyon' },
  { race: 'goblin', color: '#9fb52c', at: [0.6, 0.7], w: 0.9, word: "Sürü" },
  { race: 'halfelf', color: '#e05a9a', at: [0.3, 0.25], w: 0.9, word: 'Ordu' },
];
const UNIT = { soldier: 0, archer: 0, cavalry: 0, artillery: 0 };
function newArmy(N, x, y, comp, isim) {
  const R = RACE_DB[N.race];
  const a = { id: CW.nextA++, nat: N, name: isim || `${N.armyNo++}.${N.word}`, x, y, n: { ...UNIT, ...comp }, start: 0, morale: 100,
    gen: { name: makeName(R.names), house: makeName(R.names), female: Math.random() < 0.15, skin: rgbCss(hexRGB(R.skin).map(v => v * rnd(0.93, 1.07))) },
    goal: null, path: null, order: null, state: 'idle', foes: [], t: 0, local: null, ppl: null, exit: null, dead: false,
    pv: pvOf({ x, y }), to: -1, route: null, mode: 'ai', dig: 0, bt: null, rest: 0, fp: null, plan: null };
  a.start = armySize(a);
  CW.armies.push(a);
  return a;

}
function newGen(a, neden)
{
  const R = RACE_DB[a.nat.race], eski = a.gen;
  a.gen={ name: makeName(R.names), house: makeName(R.names), female: Math.random() < 0.15, skin: rgbCss(hexRGB(R.skin).map(v => v * rnd(0.93, 1.07))) };
  clog(lang`🎖 ${a.name} komutanı ${eski.name} ${eski.house} ${neden}. Yerine ${a.gen.name} ${a.gen.house} geçti`);
}
const comp = (n, cav = 0.12, arch = 0.25, art = 0.04) => ({ cavalry: n * cav | 0, archer: n * arch | 0, artillery: Math.round(n * art), soldier: n - (n * cav | 0) - (n * arch | 0) - Math.round(n * art) });

function startCampaign(big)
{
  setCampSize(big === true);
  Object.assign(CW, { on: true, view: 'map', t: 12 * 340 + 3, nations: [], armies: [], msgs: [], rel: new Map(), log: [], saved: new Map(), kOf: new Map(), calm: 0, sel: null, active: -1, acc: 0, nextA: 1, seed: Math.random() * 1e9 | 0,
    battles: [], plans: [], selA: new Set(), player: null, fc: {}, nextB: 1, rdrag: null, box: null, watch: null });
  Sim.arena = false; Sim.camp = false; Sim.ready = false; Sim.placing = null; Sim.tool = null;
  campTerrain();
  campCities();
  campProvinces();
  const taken = new Set();
  for (const [i, S] of [...SCEN, ...(CW.big ? SCEN_BIG : [])].entries()) {
    const R = RACE_DB[S.race], at = { x: S.at[0] * MC, y: S.at[1] * MR };
    const baskent = CW.cities.filter(c => !taken.has(c)).reduce((a, b) => hyp(a, at) < hyp(b, at) ? a : b);
    taken.add(baskent);
     CW.nations.push({ id: i + 1, race: S.race, name: lang`${makeName(R.names)} ${R.kword}`, color: S.color, cap: baskent, w: S.w, word: S.word, armyNo: 1, tech: 1, gold: 300, dead: false, cells: 0 });
    initStrat(CW.nations[i]);
  }
  for (const c of CW.cities) {
    c.own = CW.nations.reduce((a, b) => hyp(c, a.cap) / a.w < hyp(c, b.cap) / b.w ? a : b);
    c.name = makeName(c.own.R ? c.own.R.names : RACE_DB[c.own.race].names) + pick(PLACE_END);
    c.gar = 6 + c.pop / 3 | 0;
    c.walls = c.pop > 23;
  }
  for (const N of CW.nations) { N.cap.pop = 40; N.cap.walls = true; N.cap.gar = 24; }
  CW.own = new Int16Array(MC * MR);
  for (let i = 0; i < CW.own.length; i++) if (CW.prov[i]>=0) CW.own[i] = CW.cities[CW.prov[i]].own.id;
  provSyncAll();
  CW.core = Int16Array.from(CW.own);
  for (const X of CW.nations) for (const Y of CW.nations) if (X.id < Y.id) setRel(X, Y, 'peace', cYear() - rnd(0, 8) | 0);
  const [A, B, C, D] = CW.nations;
  setRel(A, B, 'war', cYear() - 6); setRel(B, D, "alliance", cYear() - 30); setRel(A, C, 'peace'); setRel(B, C, 'peace');
  clog(lang`🌍 Dünya ${RX * RY} bölgeye ayrıldı. ${CW.nations.map(N => N.name).join(', ')} krallıkları dünyayı paylaşıyor`);
  clog(lang`⚔️ ${A.name} ile ${B.name} arasındaki savaş altıncı yılında`);

  const kayip=natCities(B).filter(c => c !== B.cap).sort((x, y) => hyp(x, A.cap) - hyp(y, A.cap)).slice(0, 3);
  for (const c of kayip) { c.own = A; for (let i = 0; i < CW.own.length; i++) if (CW.prov[i] === c.id && CW.own[i] === B.id) CW.own[i] = A.id; }
  provSyncAll();
  if (kayip.length) clog(lang`🏴 ${A.name} orduları ${kayip.map(c => c.name).join(', ')} şehirlerini ele geçirdi. Cephe ${B.name} topraklarının içinde`);
  const front = (X, Y) => {

    const cikti = [];
    for (let i = 0; i < CW.own.length; i++) if (CW.own[i] === X.id && [1, -1, MC, -MC].some(d => CW.own[i + d] === Y.id)) cikti.push(i);
    return cikti.sort((a, b) => (a / MC | 0) - (b / MC | 0));
  };
  const spread = (cells, n) => cells.length ? Array.from({ length: n }, (_, k) => cells[Math.floor((k + 0.5) / n * cells.length)]) : [];
  const fa = spread(front(A, B), 3), fb = spread(front(B, A), 3), xy = i => [i % MC + 0.5, (i / MC | 0) + 0.5];
  const atOr = (cells, k, N) => cells[k] != null ? xy(cells[k]) : [N.cap.x + rnd(-2, 2), N.cap.y + rnd(-2, 2)];

  newArmy(A, ...atOr(fa, 0, A), comp(64), '3.Kolordu');
  newArmy(A, ...atOr(fa, 1, A), comp(70, 0.1, 0.25, 0.05), '2.Kolordu');
  newArmy(A, ...atOr(fa, 2, A), comp(60), '1.Kolordu');
  A.armyNo = 4;
  newArmy(A, A.cap.x + 1, A.cap.y, comp(36), lang('4.Kolordu (yedek)'));
  newArmy(B, ...atOr(fb, 0, B), comp(58), lang('Kuzey Grubu'));
  newArmy(B, ...atOr(fb, 1, B), comp(72, 0.12, 0.25, 0.05), '2.Ordu');
  newArmy(B, ...atOr(fb, 2, B), comp(56), '1.Ordu');
  newArmy(B, B.cap.x + 1, B.cap.y + 1, comp(40, 0.8, 0.05, 0), lang('5.Süvari Kolordusu'));
   B.armyNo = 6;
  newArmy(C, C.cap.x + 1, C.cap.y, comp(40, 0.1, 0.45, 0));
  newArmy(D, D.cap.x - 1, D.cap.y, comp(44, 0.05, 0.2, 0.08));
  for (const N of CW.nations.slice(SCEN.length)) { newArmy(N, N.cap.x + 1, N.cap.y, comp(rnd(38, 52) | 0)); newArmy(N, N.cap.x - 1, N.cap.y, comp(rnd(30, 42) | 0, 0.2, 0.3, 0.03)); }
  for (const a of CW.armies) { a.pv = pvOf(a); const P = CW.provs[a.pv]; a.x = P.x; a.y = P.y; }

  CW.terrDirty = true;
  campTerrImg();
  const z = Math.min(VW / (MC * CP), VH / (MR * CP)) * 0.98;
  Object.assign(CW.cam, { x: MC * CP / 2, y: MR * CP / 2, z: Math.max(0.3, z) });
  setTab('world');
  campUI();
}

function setOwner(c, N) {
  const old = c.own;
  c.own = N; c.siege=0;
  provSet(CW.provs[c.pv], N.id);
}
function captureCity(c, N, a)
{
  const old = c.own;
  setOwner(c, N);
  c.gar = a ? 3 : c.gar; c.pop = Math.max(6, c.pop * 0.85 | 0);
  clog(lang`🏴 FETİH! ${c.name} düştü: ${old.name} → ${N.name}${a ? lang` (${a.name})` : ''}`);
  if (old.cap === c) {
    const kalan = natCities(old);
     if (kalan.length) { old.cap = kalan.reduce((x, y) => x.pop >= y.pop ? x : y); clog(lang`👑 ${old.name} başkentini ${old.cap.name} şehrine taşıdı`); }
    else nationFall(old, N);
  }
}
function nationFall(N, by) {
  N.dead=true;
  for (const a of CW.armies) if (a.nat === N && !a.local) a.dead = true;
  for (const O of CW.nations) if (relN(N, O) !== 'peace') setRel(N, O, 'peace');
  for (let i = 0; i < CW.own.length; i++) if (CW.own[i] === N.id) CW.own[i] = by.id;
  for (let i = 0; i < CW.own.length; i++) if (CW.core[i] === N.id) CW.core[i] = CW.own[i] || by.id;
  for (const c of CW.cities) if (c.own === N) c.own = by;
  provSyncAll();
  if (CW.player === N) clog(lang`☠ Ülken ${N.name} yıkıldı. İzleyici olarak devam edebilir ya da başka bir ülke seçebilirsin`);
  clog(lang`💀 ${N.name} yıkıldı. Toprakları ${by.name} eline geçti`);
}
function armyDead(a, why)
{
  if (a.dead) return;
  a.dead = true; a.local = null; a.ppl = null;
  clog(lang`☠ ${a.name} (${a.nat.name}) ${why || lang("yok edildi")} · ${placeOf(a)}`);

}
function loseUnits(a, L) {
  L = Math.floor(L) + (Math.random() < L % 1 ? 1 : 0);
  for (let k = 0; k < L; k++) {
    const w = { soldier: a.n.soldier, archer: a.n.archer * 0.8, cavalry: a.n.cavalry * 0.9, artillery: a.n.artillery * 0.4 };
    let r = Math.random() * (w.soldier + w.archer + w.cavalry + w.artillery);
    if (r <= 0) return;
    for (const j in w) { r -= w[j]; if (r<=0) { a.n[j]--; break; } }
  }
  return L;
}
const enemyNear = (p, N, r) => CW.armies.some(b => !b.dead && warN(N, b.nat) && hyp(p, b) < r);
const inActive = (x, y) => CW.view === "region" && regionOf(x, y) === CW.active;

function setGoal(a, x, y, kind, ref) {
  const tp = pvOf({ x, y }), sp = a.local || a.pv == null || a.pv < 0 ? pvOf(a) : a.pv;
  if (!a.goal || a.goal.pv !== tp || !a.route || (!a.route.length && sp !== tp)) a.route = provRoute(a.nat, sp, tp, kind === 'home');
  a.goal = a.route ? { x, y, kind, ref, pv: tp, cell: cIdx(x, y) } : null;
  a.path = a.route ? a.route.map(id => CW.provs[id].c0) : null;
}
function aiTarget(a) {
  const N = a.nat;
  if (a.order) return setGoal(a, a.order.x, a.order.y, 'order');
  if (a.rest>CW.t) { a.goal = null; a.route=null; return; }
  const m = a.mode || "ai";
  if (m === 'hold' || m === 'order') { a.goal = null; a.route = null; return; }
  if (m === 'front') return frontGoal(a);
   if (m === "plan") return planGoal(a);
  if (a.help) {
    const h = a.help, r = h.ref;
    if (CW.t < h.until && !(r.dead) && (h.kind === 'city' ? r.own === a.nat && r.siege > 0 : r.state === 'battle')) return setGoal(a, r.x, r.y, 'help', r);
    a.help = null;
  }
  const foesN = CW.nations.filter(o => !o.dead && warN(N, o));
  if (!foesN.length) { const c = nearCity(a, c => c.own === N); return c ? setGoal(a, c.x, c.y, "home", c) : (a.goal = null); }
  const myP = armyPow(a);
  let threat = 0, enIyi = null, bs = -Infinity;
  for (const b of CW.armies) {
    if (b.dead || !foesN.includes(b.nat)) continue;
    const d = hyp(a, b), bp = armyPow(b);
    if (d < 5) threat += bp;
    if (d > 10 || b.state === 'retreat') continue;
    const s = myP / bp * 3 - d * 0.3;
     if (myP >= bp * 0.7 && s > bs) { bs = s; enIyi = b; }
  }
  if (threat > myP * 2.2) {
    const c = nearCity(a, c => c.own === N && hyp(c, a) > 1);
    if (c) { a.state = "retreat"; a.t = 0; return setGoal(a, c.x, c.y, "home", c); }
  }
  if (enIyi) return setGoal(a, enIyi.x, enIyi.y, 'army', enIyi);
  const mates = CW.armies.filter(b => b !== a && !b.dead && b.nat === N && b.goal && b.goal.kind === 'city').map(b => b.goal.ref);

  let tc = null, ts = Infinity;
  for (const c of CW.cities) {
     if (!foesN.includes(c.own)) continue;
    const s=hyp(a, c) + c.gar * 0.05 + (c.walls ? 2 : 0) + (mates.includes(c) ? 7 : 0);
    if (s<ts) { ts = s; tc = c; }
  }

  if (tc) setGoal(a, tc.x, tc.y, 'city', tc);
  else a.goal = null;
}

function campTick() {
  CW.t++;
  const field = liveArmies().filter(a => !a.local);
  for (const a of field) if (a.pv == null || a.pv < 0) a.pv = pvOf(a);
  coLocated(field);
   for (const b of [...CW.battles]) fightTick(b);
  for (const a of field) if (!a.dead && armySize(a) < 4) armyDead(a, lang('dağıldı'));
  for (const a of field) {
    if (a.dead || a.local || a.state === 'battle') continue;
    a.morale = Math.min(100, a.morale + (a.state === 'retreat' ? 1 : 2.5) * (a.nat.org || 1));
    if (a.to < 0 && !(a.route && a.route.length)) a.dig = Math.min(1, (a.dig || 0) + 0.04);
    if (a.state === 'retreat' && ++a.t > 18 && a.morale > 55) a.state='idle';
    const c = a.to < 0 && a.state !== 'retreat' && CW.provs[a.pv].city;
    if (c && warN(a.nat, c.own) && !inActive(c.x, c.y) && a.mode !== 'order') { a.state='siege'; siege(a, c); continue; }
    if (a.state === 'siege') a.state = 'idle';
    if (a.state !== 'retreat' && ((CW.t + a.id) % 4 === 0 || !a.goal)) aiTarget(a);
    moveArmy(a);
  }
  for (const c of CW.cities) if (c.siege > 0 && !field.some(a => !a.dead && a.state === 'siege' && a.pv === c.pv)) c.siege = Math.max(0, c.siege - 3);
  for (const a of field) {
    if (a.dead || a.local || a.state === 'battle' || a.state === 'siege' || armySize(a) >= 90) continue;
    const c = CW.cities.find(c => c.own === a.nat && c.gar > 6 && hyp(c, a) < 2.5 && !inActive(c.x, c.y));
    if (!c) continue;
    const n = Math.min(c.gar - 4, 3, 90 - armySize(a)) | 0;

    if (n <= 0) continue;
    c.gar -= n; a.n.soldier += Math.ceil(n * 0.7); a.n.archer += n - Math.ceil(n * 0.7); a.start = Math.max(a.start, armySize(a));
  }
  helpCalls(field);
  stratMonth();
  if (CW.t % 12===0) campYear();
}

const isIdleArmy = a => !a.dead && !a.local && (a.mode || 'ai') === 'ai' && !a.order && !a.help && a.state === 'idle' && (!a.goal || a.goal.kind !== 'army') && !enemyNear(a, a.nat, 3);
function helpCalls(field)
{

  const asks = [];
  for (const c of CW.cities) if (c.own && c.siege > 0 && !inActive(c.x, c.y)) asks.push({ kind: 'city', ref: c, N: c.own });
  for (const a of field) if (!a.dead && a.state === 'battle') asks.push({ kind: 'army', ref: a, N: a.nat });
  for (const q of asks) {
    if (CW.msgs.some(m => m.ref === q.ref)) continue;
    if (CW.armies.some(b => b.help && b.help.ref === q.ref && !b.dead)) continue;
    let to = null, bd = 30;
    for (const b of field) {
      if (b === q.ref || b.nat !== q.N || !isIdleArmy(b)) continue;
      const d = hyp(b, q.ref);
      if (d > 1.5 && d < bd) { bd = d; to=b; }
    }
    if (!to) continue;
    CW.msgs.push({ x: q.ref.x, y: q.ref.y, kind: q.kind, ref: q.ref, to, N: q.N, t: 0 });
    clog(lang`🆘 ${q.kind === "city" ? q.ref.name + lang(' şehri') : q.ref.name} (${q.N.name}) yardım istiyor: atlı haberci ${to.name} ordusuna yola çıktı`);
  }
  for (const m of CW.msgs) {
    const b = m.to;
    if (b.dead || ++m.t > 60) { m.done = true; continue; }
    const dx = b.x - m.x, dy = b.y - m.y, d = Math.hypot(dx, dy);

    const v = 0.1 * 2 * (TER[CW.ter[cIdx(m.x, m.y)]].speed || 0.5) * 1.6;
    if (d > v) { m.x += dx / d * v; m.y += dy / d * v; continue; }
    m.done = true;
    if (b.order || b.state === 'battle' || b.state === 'retreat') continue;
    const still = m.kind === 'city' ? m.ref.own === b.nat && m.ref.siege > 0 : !m.ref.dead && m.ref.state === 'battle';
    if (!still) continue;
    b.help = { kind: m.kind, ref: m.ref, until: CW.t + 14 };
    setGoal(b, m.ref.x, m.ref.y, 'help', m.ref)
    clog(lang`🐎 Haberci ${b.name} ordusuna ulaştı: ordu ${m.kind === 'city' ? m.ref.name : m.ref.name + ' ordusunun'} yardımına koşuyor`);
  }
  CW.msgs = CW.msgs.filter(m => !m.done);
}

function siege(a, c)
{
  const def = 10 + c.gar * 1.5 + (c.walls ? 30 : 0) + (c.own.cap === c ? 15 : 0);
  if (c.siege === 0) clog(lang`🔥 ${a.name} (${a.nat.name}) ${c.name} şehrini kuşattı`);
  c.siege += armyPow(a) / def * 3;
  c.gar = Math.max(0, c.gar - armyPow(a) * 0.01);
  loseUnits(a, c.gar * 0.015 + (c.walls ? 0.25 : 0));
  if (c.siege >= 100) { captureCity(c, a.nat, a); a.state = 'idle'; a.goal = null; a.route = null; }
}

function campAdj()
{
   const own = CW.own;

  CW.adj = new Set();
  for (let i = 0; i < own.length; i++) {
    const o = own[i];
    if (!o) continue;
    for (const j of [i + 1, i + MC]) if (j < own.length && own[j] && own[j] !== o) CW.adj.add(Math.min(o, own[j]) + '-' + Math.max(o, own[j]));
  }
}
function campYear() {
  campAdj();
  for (const c of CW.cities) {
    if (inActive(c.x, c.y)) continue;
    if (c.siege === 0 && c.pop < 140) c.pop=Math.min(140, c.pop + 4);
    const gp = Math.min(c.pop, 60);

    c.gar = Math.min(c.gar + 3 + gp / 10, gp * 0.8 + 10);
  }
  for (const N of CW.nations) {
    if (N.dead) continue;
    const cs = natCities(N);
    if (!cs.length) continue;
    if (N === CW.player) continue;
    if (!CW.nations.some(o => warN(N, o))) continue;
    const mine = liveArmies().filter(a => a.nat === N).length;
    if (mine >= 2 + (cs.length / 4 | 0)) continue;
    const c = cs.filter(c => !inActive(c.x, c.y)).sort((x, y) => y.gar - x.gar)[0];
    if (!c || c.gar < 24) continue;
    const n = c.gar * 0.75 | 0;
    c.gar -= n;
    const a = newArmy(N, c.x + 0.6, c.y, comp(n));
    clog(lang`📯 ${N.name} ${c.name} şehrinde yeni bir ordu topladı: ${a.name} (${n} asker)`);
  }
  const canli = CW.nations.filter(N => !N.dead);
  for (let i = 0; i < canli.length; i++) for (let j=i + 1; j < canli.length; j++) {
    const a = canli[i], b = canli[j], r = CW.rel.get(relKey(a, b)) || { st: 'peace', since: 0 }, yrs = cYear() - r.since;
    if (r.st==='war') {
      const mesgul = liveArmies().some(x => (x.nat === a || x.nat === b) && (x.state === 'battle' || x.state === 'siege'));
      const py = CW.big ? 9 : 14;
      if (yrs >= py && !mesgul && a !== CW.player && b !== CW.player && Math.random() < Math.min(0.25, 0.02 * (yrs - py + 1))) {
        cwPeace(a, b);
        clog(lang`🕊 ${a.name} ile ${b.name} barış yaptı. ${yrs} yıllık savaş bitti, cephe hattı yeni sınır oldu`);
        CW.terrDirty = true;
      }
      continue;
    }
    if (r.st === 'alliance' && yrs > 15 && !canli.some(z => warN(a, z) || warN(b, z)) && Math.random() < 0.08) {
      setRel(a, b, 'peace');
      clog(lang`💔 ${a.name} ile ${b.name} arasındaki ittifak sona erdi`);
      continue;
    }
    if (r.st === 'alliance') {
      for (const [x, y] of [[a, b], [b, a]]) for (const z of canli) if (x !== CW.player && warN(y, z) && !warN(x, z) && z !== x && relN(x, z) !== 'alliance' && cYear() - (CW.rel.get(relKey(x, z))?.since ?? -99) > 8 && Math.random() < (CW.big ? 0.1 : 0.2)) {
        setRel(x, z, 'war');
        clog(lang`⚔️ ${x.name}, müttefiki ${y.name} için ${z.name} krallığına savaş ilan etti!`);
        CW.terrDirty = true;
      }
      continue;
    }
    if (CW.adj.has(Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id)) && yrs > 4) {
      const pa = natPow(a), pb = natPow(b), oran = Math.max(pa, pb) / Math.max(1, Math.min(pa, pb));
      if ((pa >= pb ? a : b) !== CW.player && Math.random() < (0.03 + (yrs - 4) * 0.004 + (oran - 1) * 0.03) * (CW.big ? 0.3 : 1)) declareN(pa >= pb ? a : b, pa >= pb ? b : a, pick(WAR_REASONS));
    }
  }
  const anyWar = canli.some(a => canli.some(b => warN(a, b)));
  CW.calm = anyWar ? 0 : CW.calm + 1;
  if (CW.calm >= 3 && canli.length > 1) {
     const pairs = [];
    for (const a of canli) for (const b of canli) if (a !== b && a !== CW.player && relN(a, b) !== 'alliance') pairs.push([a, b, natPow(a) / Math.max(1, natPow(b)) * (CW.adj.has(Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id)) ? 3 : 1)]);
    if (pairs.length) { const [a, b] = pairs.sort((x, y) => y[2] - x[2])[0]; declareN(a, b, lang('zayıf komşusunun topraklarına göz dikmesi')); }
  }
}
const natPow = N => liveArmies().filter(a => a.nat === N).reduce((s, a) => s + armyPow(a), 0) + natCities(N).reduce((s, c) => s + c.gar, 0);
function declareN(a, b, neden)
{
   setRel(a, b, 'war');
  clog(lang`⚔️ SAVAŞ! ${a.name} → ${b.name}. Sebep: ${neden}`);
  CW.terrDirty = true; CW.calm = 0;
  for (const x of CW.nations) if (!x.dead && x !== a && x !== b && x !== CW.player && relN(x, b) === 'alliance' && relN(x, a) !== 'alliance') { setRel(x, a, 'war'); clog(lang`🛡 ${x.name}, müttefiki ${b.name} için ${a.name} krallığına savaş ilan etti`); }
}

const regOrigin = ri => ({ x: ri % RX * RCW, y: (ri / RX | 0) * RCH });
const toLocal = (mx, my) => { const o = regOrigin(CW.active); return { x: clamp((mx - o.x) * LPC, 30, W - 30), y: clamp((my - o.y) * LPC, 30, H - 30) }; };
const toMacro = (x, y) => { const o = regOrigin(CW.active); return { x: o.x + x / LPC, y: o.y + y / LPC }; };
function landNear(x, y, settle) {
  const ok = (x, y) => { const t = terrainAt(x, y); return x > 25 && y > 25 && x < W - 25 && y < H - 25 && (settle ? t >= T_GRASS && t < T_MOUNT : speedAt(x, y) > 0); };
  if (ok(x, y)) return { x, y };
  for (let r = 24; r < 900; r += 24) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (ok(px, py)) return { x: px, y: py };
  }
  return { x, y };
}
function campSite(k, x, y) {
  return { id: -k.id, name: lang`${k.name} Ordugâhı`, k, x, y, r: 12, camp: true, houses: [], fields: new Set(), walls: null, hist: [],
    deathsY: 0, births: 0, food: 0, wood: 0, stone: 0, pop: 0, dead: false, spots: { food: [], wood: [], stone: [] } };
}
function campHomeless(k)
{
  const at = k.capital || (k.armies[0] && k.armies[0].cmd) || { x: W / 2, y: H / 2 };
  if (!k.capital || !k.capital.camp) k.capital = campSite(k, at.x, at.y);
}
function kFor(N) {
  let k = CW.kOf.get(N);
  if (k) return k;
  k = newKingdom(N.race);
  Object.assign(k, { name: N.name, color: N.color, roof: mixHex(N.color, '#6b4a2f', 0.55), nation: N, tech: N.tech, gold: 200, founded: cYear() - 60 });
  CW.kOf.set(N, k);
  return k;

}
function campRels() {
  const ks = Sim.kingdoms.filter(k => k.nation && !k.dead);
  for (const a of ks) for (const b of ks) {
    if (a.id >= b.id) continue;
    const r = getRel(a, b), st = relN(a.nation, b.nation);
    r.met = true; r.noPeace = true;
    if (r.status !== (st === 'war' ? 'war' : st === "alliance" ? 'alliance' : 'peace')) { r.status = st === "war" ? 'war' : st === 'alliance' ? 'alliance' : 'peace'; r.since = year(); }
    if (r.status === 'war') r.op = Math.min(r.op, -40);
  }
  countWars();
}
function localCity(c)
{
  const k = kFor(c.own), p0 = toLocal(c.x, c.y), at = landNear(p0.x, p0.y, true);
  const s = makeSettlement(k, at.x, at.y);
  s.name=c.name; s.city = c; c.s = s;
  if (!k.capital || c.own.cap === c) k.capital = s;
  const R = k.R, fam = [makeName(R.names), makeName(R.names), makeName(R.names)], n = c.pop, ppl = [];
  for (let i = 0; i < n; i++) {
    const adult = i < n * 0.75;
    ppl.push(makePerson(k.race, k, s, at.x + rnd(-16, 16), at.y + rnd(-16, 16),
      { age: adult ? CFG.adultAge + rnd(0, 30) | 0 : rnd(1, CFG.adultAge - 1) | 0, female: i % 2 === 1, house: fam[i % 3] }));
  }
  for (let i = 0; i + 1 < n * 0.75; i += 2) if (Math.random() < 0.7) marry(ppl[i], ppl[i + 1]);
  const g = Math.round(c.gar);
  for (let i = 0; i < g; i++) {
    const p = makePerson(k.race, k, s, at.x + rnd(-16, 16), at.y + rnd(-16, 16), { age: CFG.adultAge + rnd(2, 20) | 0, female: Math.random() < 0.15 });
    setJob(p, i % 3 === 2 ? 'archer' : 'soldier');
  }
  s.pop = n + g;
  while (s.cap < s.pop + 4) { const h = houseSpot(s); if (!h) break; s.houses.push(h); s.cap += CFG.houseCap; }
  s.r = Math.max(24 + Math.sqrt(s.houses.length) * 5, ...s.houses.map(h => dist(h, s) + 8));
  computeSpots(s);
  s.food = 150 + s.pop * 10; s.wood = 80; s.stone = 40;
  s.level = s.pop >= CFG.keepPop ? lang('Şehir') : s.pop >= CFG.prisonPop + 6 ? lang('Kasaba') : lang('Köy');
  if (c.walls) { const mx = 300 + k.tech * 100; s.walls = { ...wallShape(s), hp: mx, max: mx }; }
}
function localArmy(a, mx, my)
{

  const k = kFor(a.nat), p = toLocal(mx, my), at = landNear(p.x, p.y);
  if (!kSettlements(k).length && !(k.capital && k.capital.camp)) k.capital = campSite(k, at.x, at.y);
  const A = spawnArmy(k, a.nat.race, at.x, at.y, a.n, null, null, true);
  Object.assign(A.cmd, { name: a.gen.name, house: a.gen.house, female: a.gen.female });
  A.morale = a.morale; A.camp = a;
  a.local = A; a.ppl = A.members.slice(); a.exit = null;
  if (a.bt) { a.bt.att = a.bt.att.filter(x => x !== a); a.bt.def = a.bt.def.filter(x => x !== a); a.bt = null; }
  if (a.state === 'battle' || a.state === "siege") a.state = 'idle';
  return A;

}
function moveOrder(A, pt) {
  const wp = findPath(A.cmd.x, A.cmd.y, pt.x, pt.y) || [pt];
  A.manual = true; A.target = null; A.state = 'idle';
  A.order={ type: 'move', path: resample([{ x: A.cmd.x, y: A.cmd.y }, ...wp, pt], 18), i: 0, phase: 'go', t: 0 }
}
function exitOrder(a)
{
  const A = a.local, path = a.path;
  let last = cIdx(a.x, a.y), cikti = null;
   for (const i of path || []) { if (regionOf(i % MC + 0.5, (i / MC | 0) + 0.5) !== CW.active) { cikti = i; break; } last = i; }
  if (cikti == null) { A.manual = true; A.order = null; A.state = 'idle'; return; }
  const ox = cikti % MC + 0.5, oy = (cikti / MC | 0) + 0.5, lx = last % MC + 0.5, ly = (last / MC | 0) + 0.5;
  a.exit = { x: ox, y: oy };
  const p = toLocal((ox + lx) / 2, (oy + ly) / 2);
  moveOrder(A, landNear(clamp(p.x, 15, W - 15), clamp(p.y, 15, H - 15)));
}
function localOrder(a)
{
  const A = a.local;
  if (!A || !A.members.length) return;
  const m = toMacro(A.cmd.x, A.cmd.y);
  a.x = m.x; a.y = m.y; a.goal = null; a.path = null;

  aiTarget(a);
  if (a.state === "retreat") a.state='idle';
  const g = a.goal;
  A.order = null; a.exit = null;
  if (!g) { A.manual=true; A.target = null; A.state = 'idle'; return; }

  if (regionOf(g.x, g.y) !== CW.active) return exitOrder(a);
  const s = g.kind === 'city' && g.ref.s;
  if (s && !s.dead && s.k !== A.k && atWar(A.k, s.k)) { A.manual = false; A.enemy = s.k; A.target=s; A.state = 'march'; A.path = null; return; }
  if (g.kind === 'army') { A.manual = true; A.target = null; A.state = 'idle'; return; }
  moveOrder(A, landNear(...Object.values(toLocal(g.x, g.y))));
}
function enterLocal(a, mx, my) {
  localArmy(a, mx, my);
  campRels();
  localOrder(a);
  chron(lang`🚩 ${a.name} (${a.nat.name}) bölge sınırını geçip ${regName(CW.active)} bölgesine girdi`, a.local.k)
}
function exitArmy(a) {
  const A = a.local, yasayan = a.ppl.filter(p => !p.dead && p.k === A.k);
  syncArmy(a, yasayan);
  for (const p of yasayan) { leaveArmy(p); p.dead = true; }
  if (A.battle) endBattle(A.battle, A);
  A.members=[];
  A.k.armies = A.k.armies.filter(x => x !== A);
  Object.assign(a, { x: a.exit.x, y: a.exit.y, local: null, ppl: null, exit: null, state: 'idle', goal: null, path: null, to: -1, route: null, bt: null });
  a.pv=pvOf(a);
  const to = regName(regionOf(a.x, a.y));
  chron(lang`🚩 ${a.name} bölge sınırını geçti → ${to} bölgesine`, A.k);
  clog(lang`🚩 ${a.name} (${a.nat.name}) ${regName(CW.active)} bölgesinden ${to} bölgesine geçti`);
}
function syncArmy(a, yasayan) {
  const A = a.local, n={ ...UNIT };
  for (const p of yasayan) n[p.job in UNIT ? p.job : 'soldier']++;
  a.n = n; a.start = Math.max(armySize(a), a.start * 0.6 | 0);
  a.morale=clamp(A.morale ?? 80, 20, 100);
  if (A.cmd && !A.cmd.dead) a.gen = { ...a.gen, name: A.cmd.name, house: A.cmd.house, female: A.cmd.female, skin: A.cmd.skin };
  const c = A.cmd && !A.cmd.dead ? A.cmd : yasayan[0];
  if (c) { const m = toMacro(c.x, c.y); a.x = m.x; a.y = m.y; }
  a.pv = pvOf(a);
}
function campLocalTick() {
  for (const a of CW.armies) {
    if (!a.local || a.dead) continue;
    const A = a.local, yasayan = a.ppl.filter(p => !p.dead && p.k === A.k);
    if (!yasayan.length) { chron(lang`☠ ${a.name} yok edildi`, A.k); armyDead(a); continue; }
    if (!A.k.armies.includes(A) || !A.members.length) {
      const t = yasayan.filter(p => isTroop(p) && !p.army && p.state !== 'jailed' && p.state !== 'arrested');
      if (t.length<4) { a.dead = true; a.local = null; a.ppl = null; clog(lang`🏠 ${a.name} (${a.nat.name}) dağıldı, askerleri şehirlere döndü`); continue; }
      const B = makeManualArmy(A.k, t);
      B.camp = a; a.local = B; a.ppl = t.slice();
      localOrder(a);
      continue;
    }

    const m=toMacro(A.cmd.x, A.cmd.y);
     a.x = m.x; a.y = m.y; a.pv = pvOf(a);
    if (!A.cmd.dead && A.cmd.name !== a.gen.name) a.gen = { ...a.gen, name: A.cmd.name, house: A.cmd.house, female: A.cmd.female, skin: A.cmd.skin };
    a.n = { ...UNIT };

    for (const p of yasayan) a.n[p.job in UNIT ? p.job : 'soldier']++;
     a.morale=clamp(A.morale ?? a.morale, 0, 100);
  }
  campTick();
  for (const a of CW.armies) {
    const A = a.local;
    if (!A || a.dead) continue;
    if (a.exit && A.state !== 'battle') {
      const c = A.cmd, pa = A.order && A.order.path, bitis = pa && pa[pa.length - 1];
      if (c.x < 70 || c.y < 70 || c.x > W - 70 || c.y > H - 70 || (bitis && dist(c, bitis) < 50)) { exitArmy(a); continue; }
    }
    if (A.state === 'battle' || (CW.t + a.id) % 4) continue;
    const idle = A.manual ? (!A.order || a.exit || (A.order.type === 'move' && A.order.t > 1500)) && A.state !== 'retreat'
      : !A.target || A.target.dead || A.target.k === A.k;
    if (idle && !(a.exit && A.order)) localOrder(a);
  }
}

function enterRegion(ri) {
  ctx.fillStyle = "rgba(10,16,24,0.75)"; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 20px Redaction35, system-ui'; ctx.textAlign = 'center';
  ctx.fillText(lang`📍 ${regName(ri)} bölgesi hazırlanıyor…`, VW / 2, VH / 2); ctx.textAlign = 'left';
  setTimeout(() => enterRegionNow(ri), 30);
}
function enterRegionNow(ri) {
  if (CW.view === 'region') leaveRegion();
  CW.active = ri; CW.view = 'region';
  Sim.arena = false; Sim.camp = true; Sim.placing = null; Sim.tool = null;
  const snap = CW.saved.get(ri);
  if (snap) restoreRegion(ri, snap);
  else {
    CW.kOf = new Map();
    const o = regOrigin(ri), sx = RCW / CFG.cols, sy = RCH / CFG.rows;
    Sim.campGen={ h: (c, r) => CW.hf(o.x + c * sx, o.y + r * sy), m: (c, r) => CW.mf(o.x + c * sx, o.y + r * sy), th: CW.th };
    withSeed(CW.seed + (ri + 1) * 7919, initWorld);
    Sim.campGen=null;
    Sim.tick = CW.t * MTICK; Sim.log = [];
    chron(lang`📍 ${regName(ri)} bölgesine inildi. Bu bölge şimdi tam simülasyonla işliyor; dünyanın geri kalanı genel haritada sürüyor`);
    for (const c of CW.cities) if (c.ri === ri) localCity(c);
    for (const k of Sim.kingdoms) {
      if (!kSettlements(k).length) continue;
      const havuz = Sim.people.filter(p => p.k === k && p.s === k.capital && isAdult(p) && !isTroop(p));
      if (havuz.length) crown(k, havuz.reduce((a, b) => a.stats.cha + a.stats.int >= b.stats.cha + b.stats.int ? a : b));
    }
  }
  for (const a of CW.armies) if (!a.dead && !a.local && regionOf(a.x, a.y) === ri) localArmy(a, a.x, a.y);
  campRels();
  for (const a of CW.armies) if (a.local) localOrder(a);
  Sim.terrDirty = true; Sim.follow = false; Sim.speed = Sim.speed || SPEED1;
  if (!snap) {
    const focus = CW.armies.find(a => a.local) ? CW.armies.find(a => a.local).local.cmd : Sim.settlements[0] || { x: W / 2, y: H / 2 };
    Object.assign(Sim.cam, { x: focus.x, y: focus.y, z: 0.7 });
  }
  if (CW.watch) { watchLocal(CW.watch); CW.watch = null; }
  MULTI.clear();

  select(null);
  setTab('world');
  refreshSpeeds();
}

const SNAP_KEYS = ["terrain", 'mapImg', 'roadImg', 'trail', 'RW', "RH", 'snowImg', 'fallImg', 'own', 'terrImg', 'borders', 'sides', 'camps', 'diseases', 'people', 'kingdoms',
  'settlements', 'log', 'fx', 'hall', 'deaths', 'battles', 'battleLog', 'ruins', 'trenches', 'arrows', 'ships', 'monsters', 'popHist', 'rainUntil', 'wx', 'wars', 'grid'];
const MAX_SAVED = 6;
function saveRegion(ri) {
  const sim = {};
  for (const k of SNAP_KEYS) sim[k] = Sim[k];
  sim.cam = { ...Sim.cam };
  CW.saved.delete(ri);
  CW.saved.set(ri, { sim, kOf: CW.kOf, t: CW.t });
  while (CW.saved.size > MAX_SAVED) dropSaved(CW.saved.keys().next().value);
}
function dropSaved(ri) {
  const snap = CW.saved.get(ri);
  CW.saved.delete(ri);
  for (const s of snap.sim.settlements) if (s.city && s.city.s === s) s.city.s = null;
}
function dropArmy(A) {
  const ps = A.members.slice();
  disband(A);
  for (const p of ps) p.dead = true;
}
function handOver(s, k)
{
  const eski = s.k;
  s.k=k; s.conqY = year(); s.stab = Math.min(s.stab, 30); Sim.terrDirty = true;
  for (const p of Sim.people) {
    if (p.dead || p.s !== s) continue;
    leaveArmy(p);
    if (p === eski.king) { p.dead = true; continue; }
    p.k = k;
    if (isTroop(p) || p.job === 'guard') setJob(p, 'farmer');
  }
  if (!k.capital || k.capital.camp || k.capital.k !== k) k.capital = s;
  if (eski.capital === s) { const kalan = kSettlements(eski); if (kalan.length) eski.capital = kalan[0]; else campHomeless(eski); }
  if (s.walls) s.walls.hp = Math.min(s.walls.hp, s.walls.max * 0.4);
}
function addLocals(s, n, troop) {
  const k = s.k;
  for (let i = 0; i < n; i++) {
    const p = makePerson(k.race, k, s, s.x + rnd(-16, 16), s.y + rnd(-16, 16), { age: CFG.adultAge + rnd(1, 25) | 0, female: troop ? Math.random() < 0.15 : Math.random() < 0.5 });
    if (troop) setJob(p, i % 3 === 2 ? 'archer' : 'soldier');
  }
}
function restoreRegion(ri, snap) {
  CW.saved.delete(ri);
  for (const k of SNAP_KEYS) Sim[k] = snap.sim[k];

  Object.assign(Sim.cam, snap.sim.cam);
  Object.assign(Sim, { sel: null, selK: null, selS: null, ctrl: null, ready: true, terrDirty: true });
  CW.kOf = snap.kOf;
  const yrs = (CW.t - snap.t) / 12 | 0;
  Sim.tick = CW.t * MTICK;
  if (yrs > 0) for (const p of Sim.people) if (!p.dead) p.age += yrs;
  chron(lang`📍 ${regName(ri)} bölgesine geri dönüldü (${yrs ? yrs + lang(' yıl sonra') : lang("kısa süre sonra")}). Aradaki gelişmeler işlendi`);
  for (const s of Sim.settlements) {
    const c = s.city;
    if (!c || s.dead || c.ri !== ri) continue;
    c.s = s;
    if (c.own!==s.k.nation) { const eski=s.k; handOver(s, kFor(c.own)); chron(lang`🏴 ${s.name} bu arada ${eski.name} elinden ${s.k.name} eline geçmiş`, s.k, eski, s); }
    const res = Sim.people.filter(p => !p.dead && p.s === s), gar = res.filter(p => isTroop(p) && !p.army).length, civ = res.filter(p => !isTroop(p)).length;
    addLocals(s, Math.max(0, Math.round(c.gar) - gar), true);
    addLocals(s, Math.max(0, c.pop - civ - 2), false);
  }
  for (const c of CW.cities) if (c.ri === ri && !c.s) localCity(c);
  for (const k of Sim.kingdoms) for (const A of [...k.armies]) {
    const a = A.camp;
    if (!a) continue;
    if (a.dead || a.local || regionOf(a.x, a.y) !== ri) { dropArmy(A); continue; }
    A.members = A.members.filter(p => !p.dead);
    if (!A.members.length) { dropArmy(A); continue; }
    if (!kSettlements(k).length && !(k.capital && k.capital.camp)) k.capital = campSite(k, A.cmd.x, A.cmd.y);
    for (const [j] of UNIT_NAMES) {
      const have = A.members.filter(p => (p.job in UNIT ? p.job : 'soldier') === j);
      for (let i=a.n[j]; i < have.length; i++) { leaveArmy(have[i]); have[i].dead = true; }
      for (let i = have.length; i < a.n[j]; i++) A.members.push(newTroop(a.nat.race, k, homeNear(k, A.cmd), A.cmd.x + rnd(-20, 20), A.cmd.y + rnd(-20, 20), j));
    }
    A.members = A.members.filter(p => !p.dead);
    if (!A.members.length) { dropArmy(A); continue; }
    if (A.cmd.dead || !A.members.includes(A.cmd)) A.cmd = pickCmd(A.members);
    const now = toLocal(a.x, a.y), dx = now.x - A.cmd.x, dy = now.y - A.cmd.y;
    if (dx * dx + dy * dy > 250 * 250) for (const p of A.members) { p.x = inMapX(p.x + dx); p.y = inMapY(p.y + dy); }
    A.morale = a.morale; A.start = Math.max(A.start, A.members.length);
    sortRanks(A);
    a.local=A; a.ppl = A.members.slice(); a.exit=null;
  }
}

function leaveRegion() {
  if (CW.view!=='region') return;
  const tracked = new Set();
  for (const a of CW.armies) if (a.ppl) for (const p of a.ppl) tracked.add(p);
  for (const a of CW.armies) {
    if (!a.local || a.dead) continue;
    const yasayan = a.ppl.filter(p => !p.dead && p.k === a.local.k);
    syncArmy(a, yasayan);
    Object.assign(a, { local: null, ppl: null, exit: null, state: 'idle', goal: null, path: null, to: -1, route: null, bt: null });

    if (armySize(a) < 4) armyDead(a, lang('bölgedeki savaşlarda eridi'));
  }
  for (const c of CW.cities) {
    const s = c.s;
    if (!s) continue;
    c.s = null;
    if (s.dead) { c.pop = Math.max(5, c.pop * 0.4 | 0); c.gar = 0; clog(lang`🏚 ${c.name} yerle bir oldu, kalanlar yeniden kuruyor`); continue; }
    const sonuc = Sim.people.filter(p => !p.dead && p.s === s);
    c.pop = clamp(sonuc.filter(p => !isTroop(p) && p.job !== 'guard').length, 5, 150);
    c.gar = sonuc.filter(p => (isTroop(p) || p.job === 'guard') && !tracked.has(p)).length;
    c.walls = !!s.walls;
    const N = s.k.nation;
    if (N && N !== c.own && !N.dead) captureCity(c, N, null);
  }
  computeTerritory();
  const o = regOrigin(CW.active);
  for (let y = 0; y < RCH; y++) for (let x = 0; x < RCW; x++) {
    const i = cIdx(o.x + x, o.y + y);
    if (!isLandC(i)) continue;
    const id = ownerAt((x + 0.5) * LPC, (y + 0.5) * LPC), k = id && Sim.kingdoms.find(k => k.id === id);
    if (k && k.nation && !k.nation.dead && CW.own[i] !== k.nation.id) CW.own[i] = k.nation.id;
  }
  provSyncAll();
  clog(lang`🗺 ${regName(CW.active)} bölgesinden dünya haritasına dönüldü`);
  saveRegion(CW.active);
  Object.assign(Sim, { camp: false, ready: false, people: [], settlements: [], kingdoms: [], battles: [], monsters: [], ships: [], sel: null, selK: null, selS: null, ctrl: null });
  MULTI.clear();
  if (typeof PLAN !== 'undefined' && PLAN.open) togglePlan(false);
  CW.view = 'map'; CW.active = -1; CW.terrDirty = true;
  setTab('world');
}

function campOff() {
  if (!CW.on) return;
  CW.on = false; CW.view = 'map'; CW.active = -1; CW.saved = new Map();
  Object.assign(Sim, { camp: false, campGen: null, ready: false });
  campUI();
}

const lightOf = hex => mixHex(hex, '#ffffff', 0.45);
function campFrame(ctx, w, h) {

  if (Sim.speed > 0) {
    CW.acc += Sim.speed / MTICK;
    const t0 = performance.now();
    while (CW.acc >= 1 && performance.now() - t0 < 25) { campTick(); CW.acc--; }
    if (CW.acc > Math.max(1, Sim.speed)) CW.acc=0;
  }
  CW.fr++;
  if (CW.terrDirty && CW.fr % (CW.big ? 16 : 8) === 0) campTerrImg();
  if (CW.fr % 30 === 0) updatePanels();
  const cam = CW.cam, z = cam.z;
  ctx.fillStyle = '#1b456b'; ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(CW.relief, 0, 0);
  ctx.drawImage(CW.terrImg, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const N of CW.nations) {
    if (N.dead || !N.lbl || N.cells < 20) continue;
    const fs = clamp(Math.sqrt(N.cells) * CP * 0.32, 18, 70);
    ctx.font = `bold ${fs}px Redaction35, Georgia, serif`;
    ctx.fillStyle = 'rgba(20,10,10,0.3)';
    ctx.fillText(N.name.split(' ')[0].toLocaleUpperCase(LANG), N.lbl.x * CP, N.lbl.y * CP);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.6 / z;
  ctx.beginPath()
  for (const r of CW.roads) {
    const ax = r.a.x * CP, ay = r.a.y * CP, bx = r.b.x * CP, by = r.b.y * CP, mx = (ax + bx) / 2 - (by - ay) * r.bend, my = (ay + by) / 2 + (bx - ax) * r.bend;
    ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by);
  }
  ctx.stroke();
  const hr = CW.hover ? regionOf(CW.hover.x, CW.hover.y) : -1, sr = CW.sel && CW.sel.type === 'region' ? CW.sel.ri : -1;

  for (const ri of [hr, sr]) {
    if (ri < 0) continue;
    const o = regOrigin(ri);
    ctx.fillStyle = ri === sr ? 'rgba(255,209,102,0.12)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(o.x * CP, o.y * CP, RCW * CP, RCH * CP);
  }
  ctx.strokeStyle = 'rgba(10,10,10,0.75)'; ctx.lineWidth = 2.2 / z;
  ctx.beginPath();
  for (let i = 1; i < RX; i++) { ctx.moveTo(i * RCW * CP, 0); ctx.lineTo(i * RCW * CP, MR * CP); }
  for (let i=1; i < RY; i++) { ctx.moveTo(0, i * RCH * CP); ctx.lineTo(MC * CP, i * RCH * CP); }
  ctx.stroke();
  if (sr>=0) { const o = regOrigin(sr); ctx.strokeStyle = "#ffd166"; ctx.lineWidth=3 / z; ctx.strokeRect(o.x * CP, o.y * CP, RCW * CP, RCH * CP); }
  ctx.textAlign = 'left'; ctx.textBaseline = "top";
   ctx.font = `bold ${13 / z}px Redaction35, system-ui`;
  for (let ri = 0; ri < RX * RY; ri++) {
    const o = regOrigin(ri);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(regName(ri), o.x * CP + 5 / z, o.y * CP + 4 / z);
  }
  drawCampPlans(ctx, z);
  ctx.restore();
  const S = (x, y) => [(x * CP - cam.x) * z + w / 2, (y * CP - cam.y) * z + h / 2];
   ctx.textBaseline = 'middle';
  for (const c of CW.cities) {
    const [X, Y] = S(c.x, c.y), cap = c.own.cap === c;
     if (X < -50 || Y < -50 || X > w + 50 || Y > h + 50) continue;
     if (c.siege>0) {
      ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(X, Y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, c.siege / 100)); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X, Y, cap ? 5 : 3.3, 0, 7); ctx.fill(); ctx.stroke();
    if (cap) { ctx.fillStyle=c.own.color; ctx.beginPath(); ctx.arc(X, Y, 2.3, 0, 7); ctx.fill(); }
    if (z >= 0.9 || cap) {
      ctx.font = `${cap ? 'bold 12' : '11'}px Redaction35, system-ui`; ctx.textAlign = "left";
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(c.name, X + 7, Y - 1);
       ctx.fillStyle = '#fff'; ctx.fillText(c.name, X + 7, Y - 1);
    }
  }

  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
  for (const a of liveArmies()) {
    const [X, Y] = S(a.x, a.y);
    if (X < -80 || Y < -80 || X > w + 80 || Y > h + 80) continue;
    if (CW.cards && z >= 1.1 && armySize(a) >= 30) drawCard(ctx, a, X, Y);
  }
   drawCounters(ctx, w, h, S, pulse);
  for (const m of CW.msgs) {
    const [X, Y] = S(m.x, m.y);
    if (X < -40 || Y < -40 || X > w + 40 || Y > h + 40) continue;
     ctx.fillStyle = m.N.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X, Y, 5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Redaction35, system-ui'; ctx.textAlign="center"; ctx.fillText("♞", X, Y + 1);
    ctx.font = `${12 + pulse * 3}px Redaction35, system-ui`; ctx.fillText('🆘', X, Y - 11);
  }
   ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (CW.hover && hr >= 0) {
     const P = CW.provs[CW.pv[cIdx(CW.hover.x, CW.hover.y)]];
    const t = lang`${P ? provName(P) + ' · ' : ''}${regName(hr)} bölgesi · çift tık: bölgeye in`;
    ctx.font = 'bold 12px Redaction35, system-ui';

    const tw = ctx.measureText(t).width;
    ctx.fillStyle = 'rgba(15,22,30,0.85)'; ctx.fillRect(CW.hover.mx + 14, CW.hover.my + 10, tw + 12, 20);
    ctx.fillStyle = '#ffd166'; ctx.fillText(t, CW.hover.mx + 20, CW.hover.my + 24);
  }
}
function drawCard(ctx, a, X, Y) {
  const R = RACE_DB[a.nat.race], cx = X - 30, cy = Y - 62;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(((a.id % 3) - 1) * 0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-20, -24, 44, 58);
  ctx.fillStyle = '#f4efe4'; ctx.fillRect(-22, -26, 44, 58);
  ctx.fillStyle=mixHex(a.nat.color, '#1a1a1a', 0.55); ctx.fillRect(-18, -22, 36, 36);
  drawFigure(ctx, { skin: a.gen.skin, ears: R.ears, extra: R.extra, size: 1, ring: a.nat.color, female: a.gen.female, helm: AGES[a.nat.tech].helm,
    child: false, sick: false, job: 'cmd', mount: null, horse: '#7a4a2a', gun: false, ghost: false }, 0, -2, -Math.PI / 2, 2.6);
  ctx.fillStyle = "#222"; ctx.font = 'bold 8px Redaction35, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = "middle";
  ctx.fillText(a.gen.name.slice(0, 11), 0, 21);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy + 32); ctx.lineTo(X, Y); ctx.stroke();
}

const campMap = () => CW.on && CW.view === "map" && tab !== 'race';
function campMouse(tur, e) {
  const [mx, my] = mpos(e), cam = CW.cam, wx = (mx - VW / 2) / cam.z + cam.x, wy = (my - VH / 2) / cam.z + cam.y, x = wx / CP, y = wy / CP;

  if (tur === "down") {
    if (e.button === 2) { CW.rdrag = { x, y, x1: x, y1: y, mx, my, moved: false }; return; }
    if (e.button === 0 && (e.shiftKey || e.ctrlKey)) { CW.box = { mx, my, mx1: mx, my1: my, moved: false, add: true }; return; }
    CW.drag = { mx, my, cx: cam.x, cy: cam.y, moved: false, btn: e.button };
    if (e.button === 1) e.preventDefault();
  } else if (tur === 'move') {
    const d = CW.drag, r = CW.rdrag, b = CW.box;
    if (r) { r.x1 = x; r.y1 = y; if (Math.abs(mx - r.mx) + Math.abs(my - r.my)>18) r.moved = true; }
    if (b) { b.mx1 = mx; b.my1 = my; if (Math.abs(mx - b.mx) + Math.abs(my - b.my)>5) b.moved=true; }
    if (d) {
      if (Math.abs(mx - d.mx) + Math.abs(my - d.my) > 5) d.moved = true;
      if (d.moved) { cam.x = d.cx - (mx - d.mx) / cam.z; cam.y = d.cy - (my - d.my) / cam.z; }
    }
    CW.hover = x >= 0 && y >= 0 && x < MC && y < MR ? { x, y, mx, my } : null;
  } else if (tur==='up') {
    const d = CW.drag, r = CW.rdrag, b = CW.box;
    CW.drag = null; CW.rdrag = null; CW.box = null;
    if (r && e.button === 2) {
      const L = [...CW.selA].filter(commandable);
      if (r.moved) { if (L.length) makePlan(L, r.x, r.y, clamp(x, 0, MC - 0.01), clamp(y, 0, MR - 0.01)); updatePanels(); }
      else campOrder(x, y);
      return;
    }
    if (b) { if (b.moved) boxSelectCW(b); else campClick(mx, my, x, y, true); return; }
    if (d && !d.moved && d.btn === 0) campClick(mx, my, x, y, false);
  } else if (tur === 'leave') { CW.drag=null; CW.hover = null; CW.rdrag = null; CW.box = null; }
  else if (tur === "dbl") { if (x >= 0 && y >= 0 && x < MC && y < MR && !hitArmy(mx, my)) enterRegion(regionOf(x, y)); }
  else if (tur === "wheel") {
    e.preventDefault();
    cam.z = clamp(cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.3, 8);
    const nx = (mx - VW / 2) / cam.z + cam.x, ny = (my - VH / 2) / cam.z + cam.y;
    cam.x += wx - nx; cam.y += wy - ny;
  }
}
function campClick(mx, my, x, y, add) {
  const cam = CW.cam, S = (px, py) => [(px * CP - cam.x) * cam.z + VW / 2, (py * CP - cam.y) * cam.z + VH / 2];
  const b = hitBattle(mx, my);
  if (b && !add) { CW.selA.clear(); CW.sel = { type: 'battle', o: b }; return updatePanels(); }
  const a = hitArmy(mx, my);
  if (a) {
    if (add) { if (CW.selA.has(a)) CW.selA.delete(a); else CW.selA.add(a); }
    else CW.selA=new Set([a]);
    return selSync();
  }
  if (add) return;
  CW.selA.clear();
   let best = null, bd = 10 ** 2;
  for (const c of CW.cities) { const [X, Y]=S(c.x, c.y), d = (X - mx) ** 2 + (Y - my) ** 2; if (d < bd) { bd = d; best={ type: 'city', o: c }; } }
  if (!best && x >= 0 && y >= 0 && x < MC && y < MR) best = { type: 'region', ri: regionOf(x, y), nat: natById(CW.own[cIdx(x, y)]), pv: CW.pv[cIdx(x, y)] };

  CW.sel=best;
  updatePanels()
}
function campOrder(x, y) {
  if (x < 0 || y < 0 || x >= MC || y >= MR || !isLandC(cIdx(x, y))) return;
  const L = [...CW.selA].filter(commandable);
  for (const a of L) {
    a.mode = 'order'; a.order = { x, y }; a.plan = null; a.fp = null; a.goal = null; a.route=null; a.rest = 0;
    if (a.state === 'retreat') a.state = 'idle';
    aiTarget(a);
  }
  updatePanels();
}

const nSw = N => `<a data-cw="nat:${N.id}"><span class="sw" style="background:${N.color}"></span> ${N.name}${N.dead ? ' †' : ''}</a>`;

const STATE_TR = { idle: "Bekliyor", battle: '⚔️ Meydan savaşında', siege: '🔥 Kuşatmada', retreat: "🏳 Çekiliyor" };
function goalText(a) {
  const g=a.goal;
  if (!g) return 'yok';
  if (g.kind === 'city') return lang`🏰 ${g.ref.name} (${g.ref.own.name})`;
  if (g.kind === 'army') return lang`⚔️ ${g.ref.name} (${g.ref.nat.name})`;
  if (g.kind === 'home') return lang`🏠 ${g.ref.name}`;

  if (g.kind==='help') return lang`🆘 ${g.ref.name} yardımına`;
  if (g.kind === "front") return lang`🛡 cephe: ${provName(g.ref)}`;
  if (g.kind === 'plan') return lang`🏹 taarruz: ${provName(CW.provs[g.ref.pv1])}`;
  return lang('📍 senin emrin');
}

function campInfo() {
  const s = CW.sel;
  if (!s) return lang('Haritada bir orduya, şehre, eyalete ya da ⚔️ muharebeye tıkla. <b>Çift tık</b> bölgeye iner. Ordu seçiliyken <b>sağ tık</b> oraya yürütür, <b>sağ tuşla sürüklemek</b> taarruz oku çizer. Shift+sürükle: kutu seçimi.');
  if (s.type === 'battle') return CW.battles.includes(s.o) ? battleInfo(s.o) : lang('Bu muharebe bitti.');
  if (s.type === 'group') return groupInfo();
  const enter = ri => lang`<button data-cw="enter:${ri}">🔍 ${regName(ri)} bölgesine in</button>`;
  if (s.type === 'army') {
    const a = s.o, ri = regionOf(a.x, a.y);
    if (a.dead) return lang`<b>${a.name}</b> †<br>Bu ordu artık yok.`;

    return `<b style="font-size:14px">${a.name}</b><br>${nSw(a.nat)}<br>Komutan: ${a.gen.name} ${a.gen.house}<br>` +
      lang`Birlikler: ${UNIT_NAMES.filter(([j]) => a.n[j]).map(([j, n]) => lang`${a.n[j]} ${n}`).join(", ")} (toplam ${armySize(a)})<br>` +
      lang`Düzen: ${a.morale | 0} · Güç: ${armyPow(a) | 0}${a.dig > 0.2 ? lang` · ⛏ siper %${Math.round(a.dig * 100)}` : ''}<br>Durum: ${STATE_TR[a.state] || a.state} · ${MODE_TR[a.mode] || ''}<br>Hedef: ${goalText(a)}<br>Yer: ${a.pv >= 0 ? provName(CW.provs[a.pv]) : placeOf(a)} · ${regName(ri)}<br>` +
      (a.bt ? lang`<a data-cw="battle:${a.bt.id}">⚔️ ${provName(CW.provs[a.bt.pv])} muharebesinde</a><br>` : '') +
      `<div class="row" style="margin-top:6px">${enter(ri)}${a.bt ? lang`<button data-cw="watch:${a.bt.id}">👁 Savaşı izle</button>` : ''}</div>` +
      (commandable(a) ? modeBtns() : lang`<div class="muted" style="margin-top:4px">Bu ordu ${CW.player ? lang('senin değil') : ''}</div>`);
  }
  if (s.type === 'city') {
    const c = s.o;
    return lang`<b style="font-size:14px">${c.own.cap === c ? '👑 ' : ''}${c.name}</b><br>${nSw(c.own)}<br>Nüfus: ${c.pop} · Garnizon: ${c.gar | 0}${c.walls ? ' · 🧱 surlu' : ''}<br>` +
      (c.siege > 0 ? lang`🔥 Kuşatma: %${Math.min(100, c.siege) | 0}<br>` : "") + lang`Bölge: ${regName(c.ri)}<div class="row" style="margin-top:6px">${enter(c.ri)}</div>`;
  }
  const ri = s.ri, inR = (x, y) => regionOf(x, y) === ri;
   const cs=CW.cities.filter(c => c.ri === ri), as = liveArmies().filter(a => inR(a.x, a.y));
  const nats = [...new Set([...cs.map(c => c.own), ...as.map(a => a.nat)])];
  return (s.pv >= 0 ? provInfo(s.pv) : '') + lang`<b style="font-size:14px">🗺 ${regName(ri)} bölgesi</b>${s.nat ? lang` · ${nSw(s.nat)} toprağı` : ''}<br>` +
    lang`Ülkeler: ${nats.map(nSw).join(', ') || lang('<span class="muted">kimse yok</span>')}<br>` +
    lang`Şehirler: ${cs.map(c => `<a data-cw="city:${c.id}">${c.name}</a>`).join(', ') || '-'}<br>` +
    lang`Ordular: ${as.map(a => `<a data-cw="army:${a.id}">${a.name}</a>`).join(', ') || '-'}<br>` +
    lang`<div class="row" style="margin-top:6px">${enter(ri)}</div><div class="muted" style="margin-top:4px">Bölgeye inince orası tam simülasyonla işler (kişiler, köyler, meydan savaşları). Dünyanın geri kalanı bu haritada sürer.</div>`;
}
function campPanels() {
  const live = CW.nations.filter(N => !N.dead), wars = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) if (warN(live[i], live[j])) wars.push(lang`${live[i].name} ⚔️ ${live[j].name}`);
  $("clock")._h = null; $('clock').innerHTML = lang`<b style="font-size:15px">🗺 Yıl ${cYear()} · ${MONTHS[CW.t % 12]}</b><br>Dünya Haritası · ${RX * RY} bölge · ${CW.cities.length} şehir · ${liveArmies().length} ordu<br>` +
    `<span class="muted">${wars.length ? lang('Savaşlar: ') + wars.slice(0, 3).join(' · ') + (wars.length > 3 ? lang` · +${wars.length - 3} savaş daha` : '') : lang('Dünyada barış var')}</span>`;
  $('info')._h = null; $('info').innerHTML=campInfo();
  $('cwPlay').innerHTML=playPanel();
  const bs = CW.battles.slice(0, 8);
  $('cwBattles').innerHTML = bs.length ? lang`<h3>⚔️ Süren muharebeler</h3>` + bs.map(b => lang`<div><a data-cw="battle:${b.id}">${provName(CW.provs[b.pv])}</a> <span class="muted">${b.att.map(a => a.nat.name.split(' ')[0]).join('+')} → ${b.def.map(a => a.nat.name.split(' ')[0]).join("+")}</span> <a data-cw="watch:${b.id}">👁 izle</a></div>`).join('') : '';
  $('kList')._h = null; $('kList').innerHTML = CW.nations.map(N => {
    const as = liveArmies().filter(a => a.nat === N), askerler = as.reduce((s, a) => s + armySize(a), 0);
    return lang`<div class="kr">${nSw(N)}<span class="n">${natCities(N).length} şehir · ${askerler} asker · %${(N.share * 100 || 0).toFixed(0)}</span></div>`;
  }).join('');
}
function natInfo(N) {
  const rels = CW.nations.filter(o => o !== N && !o.dead).map(o => lang`${nSw(o)}: ${{ war: lang('⚔️ savaş'), alliance: '🛡 ittifak', peace: lang('barış') }[relN(N, o)]}`).join('<br>');
  return lang`<b style="font-size:14px">${N.name}</b>${N.dead ? " †" : ''}${!N.dead && N !== CW.player ? lang` <button data-cw="play:${N.id}">🎮 Bu ülkeyi oyna</button>` : ''}<br>Irk: ${RACE_DB[N.race].name} · Başkent: ${N.cap.name}<br>` +
    lang`Şehirler: ${natCities(N).map(c => `<a data-cw="city:${c.id}">${c.name}</a>`).join(', ') || '-'}<br>` +
    lang`Ordular: ${liveArmies().filter(a => a.nat === N).map(a => `<a data-cw="army:${a.id}">${a.name}</a>`).join(', ') || '-'}<br>Toprak: %${(N.share * 100 || 0).toFixed(1)}<br><br>${rels}`;
}
document.body.addEventListener('click', e => {
  const el = e.target.closest('[data-cw]');
  if (!el || !CW.on) return;
  const [cmd, arg] = el.dataset.cw.split(':');
  if (cmd === 'enter') return enterRegion(+arg);
  if (cmd === 'back') return leaveRegion();
  if (cmd === 'cards') { CW.cards = !CW.cards; return campUI(); }
  if (CW.view !== 'map') return;
  if (cmd === 'free' && CW.sel && CW.sel.o) { CW.sel.o.order = null; CW.sel.o.goal = null; }
  if (cmd === "army") CW.sel={ type: 'army', o: CW.armies.find(a => a.id === +arg) };
  if (cmd === 'city') CW.sel = { type: 'city', o: CW.cities[+arg] };
  if (cmd==='nat') { const N = natById(+arg); $('info')._h = null; $('info').innerHTML = natInfo(N); return; }
  const o = CW.sel && CW.sel.o;
  if (o && (cmd === 'army' || cmd === 'city')) Object.assign(CW.cam, { x: o.x * CP, y: o.y * CP });
  updatePanels();
});

function campUI() {
  const bar = $('campBar'), map = campMap();
  bar.classList.toggle('hidden', !CW.on || tab === 'race');
  for (const id of ['cwPlay', 'cwBattles']) $(id).classList.toggle("hidden", !map);
   if (CW.on) {
    const P = CW.player;
    bar.innerHTML=CW.view === 'map'
      ? (P && !P.dead ? lang`<span class="sw" style="background:${P.color}"></span> <b>${P.name}</b> · ${P.gold | 0} altın · ${P.mp | 0} insan gücü · ${liveArmies().filter(a => a.nat === P).length} ordu${P.focus ? lang` · ${FOCUS.find(f => f.k === P.focus.k).icon} ${P.focus.left} ay` : ''} · ` : lang('🗺 <b>Dünya Haritası</b> · ')) +
        lang`📅 ${MONTHS[CW.t % 12]} ${cYear()} <button data-cw="cards" class="${CW.cards ? 'on' : ''}">🖼 Komutan kartları</button>`
      : lang`📍 <b>${regName(CW.active)} bölgesi</b> · 📅 ${dateStr()} <button data-cw="back">🗺 Dünya Haritasına Dön</button> <span class="muted">Sınıra varan ordu komşu bölgeye geçer</span>`;
  }
  if (map) {
    $('spawnBar').classList.add('hidden'); $('planTab').classList.add('hidden');
    if (PLAN.open) togglePlan(false);
  }
}
const campHint = () => lang('Sol tık: seç (Shift: ekle, Shift+sürükle: kutu) · Sürükle: kaydır · Tekerlek: yakınlaş · Çift tık: bölgeye in · Sağ tık: yürü · Sağ tuşla sürükle: taarruz oku · ⚔️ simgesi: savaşı izle · 1-5: hız · Boşluk: durdur');

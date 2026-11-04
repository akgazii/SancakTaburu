
function campProvinces() {
  const n=MC * MR, pv = new Int16Array(n).fill(-1), seeds = [], cx = i => i % MC, cy=i => i / MC | 0;
  for (const c of CW.cities) seeds.push(cIdx(c.x, c.y));
  const kara = [];
  for (let i = 0; i < n; i++) if (isLandC(i)) kara.push(i);
  for (let i = kara.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [kara[i], kara[j]] = [kara[j], kara[i]]; }
  const R2 = 3.4 ** 2;

  for (const i of kara) if (!seeds.some(s => (cx(s) - cx(i)) ** 2 + (cy(s) - cy(i)) ** 2 < R2)) seeds.push(i);
  CW.provs = [];
  const flood = s => {
     const id = CW.provs.length, q = [s];
    CW.provs.push({ id, c0: s, x: cx(s) + 0.5, y: cy(s) + 0.5, cells: [], nb: [], city: null, ter: CW.ter[s], ri: regionOf(cx(s) + 0.5, cy(s) + 0.5) });
    pv[s] = id;
    return q;
  };
  let q = [];
  for (const s of seeds) q.push(...flood(s));
  const grow = q => {
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = cx(i), r = cy(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x=c + dx, y = r + dy;
        if (x < 0 || y < 0 || x >= MC || y >= MR) continue;

        const j = y * MC + x;
        if (pv[j] !== -1 || !isLandC(j)) continue;
        pv[j] = pv[i]; q.push(j);
      }
    }
  };
  grow(q);
  for (const i of kara) if (pv[i] === -1) grow(flood(i));
  for (let i = 0; i < n; i++) if (pv[i]>=0) CW.provs[pv[i]].cells.push(i);
  const nb = CW.provs.map(() => new Set());
  for (let i=0; i < n; i++) {
    const a = pv[i];
    if (a<0) continue;
    for (const j of [i % MC < MC - 1 ? i + 1 : -1, i + MC < n ? i + MC : -1]) {
      const b = j >= 0 ? pv[j] : -1;
      if (b >= 0 && b !== a) { nb[a].add(b); nb[b].add(a); }
    }
  }
  CW.provs.forEach((P, k) => { P.nb = [...nb[k]]; })
  CW.pv = pv;
  for (const c of CW.cities) { const P = CW.provs[pv[cIdx(c.x, c.y)]]; P.city = c; c.pv = P.id; }
}
const pown = P => CW.own[P.c0];
const pvOf=p => {
  const i = CW.pv[cIdx(p.x, p.y)];

  if (i >= 0) return i;
  let b = 0, bd = Infinity;
  for (const P of CW.provs) { const d = hyp(P, p); if (d < bd) { bd = d; b = P.id; } }

  return b;
};
function provSet(P, id) {

  for (const i of P.cells) CW.own[i] = id;
  CW.terrDirty = true;
}
function provSyncAll() {
  for (const P of CW.provs) {
    const sayi = {};
    let best=CW.own[P.c0], bn = 0;
    for (const i of P.cells) { const o = CW.own[i]; sayi[o] = (sayi[o] || 0) + 1; if (sayi[o] > bn) { bn = sayi[o]; best = o; } }
    if (P.city) best = P.city.own.id;
    for (const i of P.cells) CW.own[i]=best;
  }
  CW.terrDirty = true;
}
const provName = P => P.city ? P.city.name : lang`${(nearCity(P) || { name: '?' }).name} kırsalı`;
const armiesIn = pv => CW.armies.filter(a => !a.dead && !a.local && a.pv === pv);
function passable(N, Q, safe) {
  const o = pown(Q);
  if (!o || o === N.id) return true;
  const O = natById(o);
  if (!O || O.dead || relN(N, O) === 'alliance') return true;

  return !safe && warN(N, O);
}
function provRoute(N, s, t, safe) {
  if (s === t) return [];
  const n = CW.provs.length, mesafe = new Float64Array(n).fill(Infinity), onceki = new Int16Array(n).fill(-1), H = [];
  const push = (d, i) => { H.push([d, i]); let k = H.length - 1; while (k) { const p = (k - 1) >> 1; if (H[p][0] <= H[k][0]) break; [H[p], H[k]] = [H[k], H[p]]; k = p; } };
  const nufus = () => {
    const ust = H[0], last = H.pop();

    if (H.length) {
      H[0] = last;
      for (let k = 0; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m===k) break; [H[m], H[k]] = [H[k], H[m]]; k = m; }
    }

    return ust;
  };
  mesafe[s] = 0; push(0, s);
   while (H.length) {
    const [d, i] = nufus();
    if (d > mesafe[i]) continue;
    if (i === t) break;
    const P = CW.provs[i];
    for (const j of P.nb) {
      const Q = CW.provs[j];
      if (j !== t && !passable(N, Q, safe)) continue;
      const nd = d + hyp(P, Q) / (TER[Q.ter].speed || 0.5);
      if (nd < mesafe[j]) { mesafe[j] = nd; onceki[j] = i; push(nd, j); }
    }
  }

  if (onceki[t]===-1) return null;
  const r = [];
  for (let i = t; i !== s; i = onceki[i]) r.push(i);
  return r.reverse();
}

function initStrat(N) {
  Object.assign(N, { mp: 150, atk: 1, def: 1, org: 1, inc: 1, spd: 1, queue: [], focus: null, done: [], dipT: 0 });
}
const commandable = a => a && !a.dead && (!CW.player || a.nat === CW.player);

function moveArmy(a) {
  if (a.pv == null || a.pv < 0) a.pv=pvOf(a);
  if (a.to == null || a.to < 0) {
    a.to = -1;
    const r = a.route, P0=CW.provs[a.pv];
    while (r && r.length && r[0] === a.pv) r.shift();
    if (!r || !r.length) {
      stepXY(a, P0.x, P0.y, 0.08);
      if (a.goal && a.goal.kind === 'order' && a.goal.pv === a.pv) { a.goal = null; a.order = null; if (a.mode === 'order') a.mode = 'hold'; }
      return;
    }
    const nx = r[0], P = CW.provs[nx];
    if (!P0.nb.includes(nx)) { a.route = null; return; }
    const dusmanlar = armiesIn(nx).filter(b => warN(a.nat, b.nat));
    if (dusmanlar.length) {
      if (a.state === 'retreat') a.route = null;
      else if (a.morale >= 40 && !(a.rest > CW.t)) startFight(a, nx, dusmanlar);
      return;
    }
    if (!passable(a.nat, P, false)) { a.route = null; a.goal = null; return; }
    a.to = nx; r.shift();
  }
  const P = CW.provs[a.to], cav = a.n.cavalry / Math.max(1, armySize(a));
  const v = 0.13 * (TER[CW.ter[cIdx(a.x, a.y)]].speed || 0.5) * (cav > 0.6 ? 1.5 : 1) * (a.state === 'retreat' ? 1.2 : 1) * (a.nat.spd || 1);
  const dx = P.x - a.x, dy = P.y - a.y, d = Math.hypot(dx, dy);
  const nx = d > v ? a.x + dx / d * v : P.x, ny = d > v ? a.y + dy / d * v : P.y;
  if (inActive(nx, ny)) return enterLocal(a, nx, ny);
  a.x = nx; a.y = ny;
  if (d <= v) { a.pv=a.to; a.to=-1; a.dig = 0; arriveProv(a, P); }
}
function stepXY(a, x, y, v)
{

  const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy);
  if (d <= v) { a.x=x; a.y=y; } else { a.x += dx / d * v; a.y += dy / d * v; }
}
function arriveProv(a, P)
{
  const o = pown(P), N = a.nat;
  if (!o || o === N.id || a.state === 'retreat' || inActive(P.x, P.y)) return;
  const O = natById(o);
  if (!warN(N, O) || (P.city && P.city.own === O)) return;
  provSet(P, N.id);
  for (const j of P.nb) {
    const Q = CW.provs[j], q = pown(Q), QO = natById(q);
    if (!QO || !warN(N, QO) || Q.city || inActive(Q.x, Q.y) || armiesIn(j).some(b => b.nat === QO)) continue;
    if (Q.nb.every(k => { const w = pown(CW.provs[k]); return !w || w === N.id || relN(N, natById(w)) === 'alliance'; })) provSet(Q, N.id);
  }
}

function startFight(a, pv, dusmanlar) {
  let b = CW.battles.find(x => x.pv === pv && !x.done);
  const P = CW.provs[pv];
  if (!b) {
    b = { id: CW.nextB++, pv, att: [], def: [], t: 0, ratio: 0.5, done: false };
    CW.battles.push(b);
    clog(lang`⚔️ ${provName(P)} Muharebesi: ${a.name} (${a.nat.name}) saldırıyor, ${dusmanlar.map(f => f.name).join(', ')} savunuyor`);
  }
  for (const f of dusmanlar) {
    if (b.def.includes(f) || b.att.includes(f)) continue;
     if (f.bt && f.bt !== b) { f.bt.att=f.bt.att.filter(x => x !== f); f.bt.def = f.bt.def.filter(x => x !== f); }
    b.def.push(f); f.state = 'battle'; f.bt = b; f.to=-1;
  }
  if (!b.att.includes(a)) b.att.push(a);
  a.state = 'battle'; a.bt = b; a.to=-1;

}
const TER_DEF = { [T_FOREST]: 1.25, [T_HILLS]: 1.35, [T_MOUNT]: 1.6 };
function hitSide(L, D, att)
{
  const toplam = L.reduce((s, x) => s + armySize(x), 0) || 1;
  for (const x of L) {
    const n = armySize(x), kayip = loseUnits(x, D * n / toplam * rnd(0.7, 1.3) / raceMul(x.nat)) || 0;
    x.morale = Math.max(0, x.morale - kayip / Math.max(1, n) * 120 - (att ? 3 : 1.8));
    if (Math.random()<kayip * 0.004) newGen(x, lang('savaşta düştü'));
  }
}
function battleMods(b) {
  const P = CW.provs[b.pv], c = P.city, mine=c && b.def.some(d => d.nat === c.own);
  return { terr: TER_DEF[P.ter] || 1, wall: mine && c.walls ? 1.3 : 1, gar: mine ? c.gar * 0.5 : 0 };
}
function fightTick(b) {
  const ok = x => !x.dead && !x.local && x.bt === b;
  b.att = b.att.filter(ok); b.def = b.def.filter(ok);
  if (!b.att.length || !b.def.length) return endFight(b);
  b.t++;
  const m = battleMods(b), sum = (L, f) => L.reduce((s, x) => s + f(x), 0);
  const aP = sum(b.att, x => armyPow(x) * x.nat.atk) / (m.terr * m.wall);
  const dP = sum(b.def, x => armyPow(x) * x.nat.def * (1 + 0.25 * (x.dig || 0))) + m.gar;
  b.ratio = b.ratio * 0.8 + aP / Math.max(1, aP + dP) * 0.2;
  hitSide(b.def, aP * 0.04, false)
  hitSide(b.att, dP * 0.044, true);
  for (const d of [...b.def]) {
    if (armySize(d) < 4) { armyDead(d, lang`${provName(CW.provs[b.pv])} muharebesinde yok edildi`); continue; }
    if (d.morale < 15 || armySize(d) < d.start * 0.3) retreatFrom(d, b);
  }
  for (const a of [...b.att]) {
    if (armySize(a) < 4) { armyDead(a, lang`${provName(CW.provs[b.pv])} saldırısında yok edildi`); continue; }
    if (a.morale < 15) {
      a.bt = null; a.state = 'idle'; a.rest = CW.t + 8; a.route = null;
      if (Math.random() < 0.15) newGen(a, lang('başarısız saldırının ardından görevden alındı'));
      clog(lang`↩ ${a.name} (${a.nat.name}) ${provName(CW.provs[b.pv])} saldırısını durdurdu, düzen topluyor`);
    }
  }
  b.att = b.att.filter(ok); b.def = b.def.filter(ok);
  if (!b.def.length && b.att.length) {
    const w = b.att.reduce((x, y) => x.morale >= y.morale ? x : y);
    if (!w.route || w.route[0] !== b.pv) w.route = [b.pv, ...(w.route || [])];
    clog(lang`🏆 ${provName(CW.provs[b.pv])} muharebesini ${w.nat.name} kazandı (${b.att.map(x => x.name).join(', ')})`);
  }
  if (!b.att.length || !b.def.length) endFight(b);
}
function endFight(b) {
  b.done = true;
  for (const x of [...b.att, ...b.def]) if (x.bt === b) { x.bt = null; if (x.state === 'battle') x.state = "idle"; }
  CW.battles = CW.battles.filter(x => x !== b);
}
function retreatFrom(d, b) {
  const P = CW.provs[b.pv], from = new Set(b.att.map(a => a.pv));
  const ax = b.att.reduce((s, a) => s + a.x, 0) / b.att.length, ay = b.att.reduce((s, a) => s + a.y, 0) / b.att.length;
  let best = null, bs = -Infinity;
  for (const j of P.nb) {
    const Q = CW.provs[j], o = pown(Q);
    if (from.has(j) || !(o === d.nat.id || (o && relN(d.nat, natById(o)) === 'alliance'))) continue;
    if (armiesIn(j).some(x => warN(x.nat, d.nat))) continue;
    const s = Math.hypot(Q.x - ax, Q.y - ay);
    if (s > bs) { bs = s; best = Q; }
  }
  b.def = b.def.filter(x => x !== d);
  d.bt = null;
  if (!best) {
    clog(lang`🎯 KUŞATMA! ${d.name} (${d.nat.name}) ${provName(P)} cebinde kuşatıldı: kaçacak yer kalmadı`);
    return armyDead(d, lang('kuşatılıp imha edildi'));
  }
  d.state = 'retreat'; d.t = 0; d.order = null; d.dig = 0; d.to = -1;
  if (d.mode === 'order' || d.mode === 'plan') { d.mode=d.nat === CW.player ? 'front' : 'ai'; d.plan = null; }
  const c=nearCity(best, c => c.own === d.nat);
  const home = c ? provRoute(d.nat, best.id, c.pv, true) : null;
  d.route = [best.id, ...(home || [])];
  d.goal=c ? { x: c.x, y: c.y, kind: 'home', ref: c, pv: c.pv, cell: cIdx(c.x, c.y) } : null;
  if (Math.random() < 0.3) newGen(d, Math.random() < 0.5 ? lang('bozgunda esir düştü') : lang('bozgunun ardından görevden alındı'));
  clog(lang`🏳 ${d.name} (${d.nat.name}) ${provName(P)} hattından ${provName(best)} yönüne çekiliyor. Kalan: ${armySize(d)}`);

}
function coLocated(field)
{
  const by = new Map();
  for (const a of field) if (!a.dead && a.to < 0) { if (!by.has(a.pv)) by.set(a.pv, []); by.get(a.pv).push(a); }
  for (const [pv, L] of by) for (const a of L) {
    if (a.state === 'battle' || a.dead || pown(CW.provs[pv]) === a.nat.id) continue;
    const dusmanlar = L.filter(b => warN(a.nat, b.nat) && !b.dead && !(b.bt && b.bt.att.includes(b)));
     if (dusmanlar.length) startFight(a, pv, dusmanlar);
  }
}

function frontProvs(N) {
  const c = CW.fc[N.id];
  if (c && c.t === CW.t) return c.l;
  const l=CW.provs.filter(P => pown(P) === N.id && P.nb.some(j => { const o = pown(CW.provs[j]); return o && o !== N.id && warN(N, natById(o)); }));

  CW.fc[N.id] = { t: CW.t, l };
  return l;
}
function frontGoal(a) {
  const F = frontProvs(a.nat);
  if (!F.length) { a.fp = null; a.goal = null; a.route = null; return; }
  const mates = liveArmies().filter(b => b !== a && b.nat === a.nat && b.mode === 'front' && b.fp != null);
  const taken = new Set(mates.map(b => b.fp));
  const clash = mates.some(b => b.fp === a.fp && b.id < a.id);
  if (a.fp == null || clash || !F.some(P => P.id === a.fp)) {
    let enIyi = null, bd = Infinity;
    for (const P of F) { const d = hyp(a, P) + (taken.has(P.id) ? 40 : 0); if (d < bd) { bd = d; enIyi = P; } }
    a.fp = enIyi.id;
  }
  const P = CW.provs[a.fp];
  if (a.pv===a.fp) { a.goal = null; a.route = null; return; }
  setGoal(a, P.x, P.y, 'front', P)
}
function planGoal(a) {
  const pl = a.plan;
  if (!pl || pl.done || a.pv === pl.pv1) { a.plan = null; a.mode = 'front'; return frontGoal(a); }
  const P = CW.provs[pl.pv1];
  setGoal(a, P.x, P.y, "plan", pl);
  if (!a.goal) { a.plan = null; a.mode='front'; }
}
function makePlan(list, x0, y0, x1, y1) {
  list = list.filter(commandable);
  if (!list.length) return;
  const pv1 = pvOf({ x: x1, y: y1 });

  const pl = { id: CW.nextB++, N: list[0].nat, x0, y0, x1, y1, pv1, done: false };
  CW.plans.push(pl);
   for (const a of list) { a.mode='plan'; a.plan = pl; a.order = null; a.goal = null; a.route = null; a.fp = null; if (a.state === 'retreat') a.state = "idle"; aiTarget(a); }
  clog(lang`🏹 Taarruz planı: ${list.map(a => a.name).join(', ')} → ${provName(CW.provs[pv1])}`);
}
function setMode(list, m) {
  for (const a of list) {
    if (!commandable(a)) continue;
    a.mode = m; a.order = null; a.plan = null; a.fp = null; a.goal = null; a.route=null;
    if (a.state !== 'battle' && a.state !== 'retreat') aiTarget(a);
  }
}

const DIVS=[
  { k: 'inf', icon: '⚔', name: 'Piyade Tümeni', short: 'Piyade Tümeni', n: 40, c: [0, 0.25, 0], gold: 80, mp: 40, m: 4 },
  { k: 'arc', icon: '🏹', name: 'Okçu Tümeni', short: 'Okçu Tümeni', n: 36, c: [0, 0.6, 0], gold: 95, mp: 36, m: 4 },
  { k: 'cav', icon: '🐎', name: 'Süvari Tümeni', short: 'Süvari Tümeni', n: 30, c: [0.8, 0.05, 0], gold: 150, mp: 30, m: 6 },
  { k: 'art', icon: '💣', name: 'Topçu Tümeni', short: 'Topçu Tümeni', n: 32, c: [0, 0.2, 0.25], gold: 190, mp: 32, m: 7 },
];
const FOCUS = [
  { k: 'mob', icon: '📯', name: 'Seferberlik', m: 8, txt: '+200 insan gücü', fx: N => { N.mp += 200; } },
  { k: "treas", icon: "💰", name: 'Hazine Reformu', m: 8, txt: '+250 altın, gelir +%25', fx: N => { N.gold += 250; N.inc *= 1.25; } },
  { k: 'drill', icon: '🗡', name: 'Taarruz Doktrini', m: 10, txt: 'Saldırı gücü +%15', fx: N => { N.atk *= 1.15; } },
  { k: 'fort', icon: '🧱', name: 'Kale Hattı', m: 10, txt: 'Bütün şehirlere sur, savunma +%10', fx: N => { for (const c of natCities(N)) c.walls = true; N.def *= 1.1; } },
  { k: "staff", icon: '🎖', name: 'Kurmay Okulu', m: 8, txt: 'Ordular düzeni %50 hızlı toplar', fx: N => { N.org *= 1.5; } },
  { k: 'tech', icon: '📜', name: 'Bilim Akademisi', m: 12, txt: 'Teknoloji +1: bütün ordular güçlenir', fx: N => { N.tech = Math.min(AGES.length - 1, N.tech + 1); } },
  { k: 'ride', icon: '🐎', name: 'Akıncı Yolları', m: 8, txt: 'Ordular %20 hızlı yürür', fx: N => { N.spd *= 1.2; } },
  { k: 'ally', icon: '🤝', name: 'Dostluk Antlaşmaları', m: 8, txt: 'Savaşmadığın en güçlü ülkeyle ittifak', fx: N => {
    const O = CW.nations.filter(o => o !== N && !o.dead && relN(N, o) === 'peace' && !CW.nations.some(z => warN(N, z) && relN(o, z) === 'alliance')).sort((x, y) => natPow(y) - natPow(x))[0];
    if (O) { setRel(N, O, "alliance"); clog(lang`🤝 ${N.name} ile ${O.name} ittifak kurdu`); }
  } },
];
function enqueue(N, k) {
  const D = DIVS.find(d => d.k === k);
  if (!D || N.gold < D.gold || N.mp < D.mp || N.queue.length >= 6) return false;
  N.gold -= D.gold; N.mp -= D.mp;
  N.queue.push({ k, left: D.m, m: D.m });
  return true;
}
function deployDiv(N, D) {
  const c = N.cap;
  const x = c.x + rnd(-0.6, 0.6), y = c.y + rnd(-0.6, 0.6);
  const a = newArmy(N, x, y, comp(D.n, ...D.c), `${N.armyNo++}.${D.short}`);
  a.mode = N === CW.player ? 'hold' : 'ai';
  clog(lang`🎖 ${N.name}: ${a.name} ${c.name} şehrinde eğitimini bitirdi (${armySize(a)} asker)`);
  if (inActive(a.x, a.y)) enterLocal(a, a.x, a.y);
}
function startFocus(N, k)
{
  const F = FOCUS.find(f => f.k === k);
  if (!F || N.focus || N.done.includes(k)) return;
  N.focus = { k, left: F.m, m: F.m };
}
function cwPeace(a, b)
{
  setRel(a, b, 'peace');
  for (let i = 0; i < CW.own.length; i++) {
    const o = CW.own[i], c = CW.core[i];
    if (o !== c && (o === a.id || o === b.id) && (c === a.id || c === b.id)) CW.core[i] = o;
  }
  CW.terrDirty = true;
}
function coreShare(N) {
  let core = 0, held = 0;
  for (let i = 0; i < CW.core.length; i++) if (CW.core[i] === N.id) { core++; if (CW.own[i] === N.id) held++; }
  return core ? held / core : 1;
}
function offerPeace(P, O) {
  if (P.dipT > CW.t) return;
  P.dipT = CW.t + 6;
  const yrs = cYear() - (CW.rel.get(relKey(P, O))?.since ?? cYear());
  const ok = natPow(O) < natPow(P) * 0.85 || coreShare(O) < 0.7 || (yrs >= 10 && Math.random() < 0.5);
  if (ok) { cwPeace(P, O); clog(lang`🕊 ${O.name}, ${P.name} krallığının barış teklifini kabul etti. Cephe hattı yeni sınır oldu`); }
  else clog(lang`✋ ${O.name}, ${P.name} krallığının barış teklifini reddetti`);
}
function offerAlliance(P, O) {
  if (P.dipT > CW.t) return;
  P.dipT = CW.t + 6;
  const enemyFriend = CW.nations.some(z => warN(P, z) && relN(O, z) === 'alliance');
  if (!enemyFriend && natPow(P) > natPow(O) * 0.6 && Math.random() < 0.6) { setRel(P, O, 'alliance'); clog(lang`🤝 ${O.name}, ${P.name} ile ittifak kurdu`); }
  else clog(lang`✋ ${O.name}, ${P.name} krallığının ittifak teklifini reddetti`);
}
function capitulate(N) {
  const occ = {};
  for (let i = 0; i < CW.core.length; i++) if (CW.core[i] === N.id && CW.own[i] && CW.own[i] !== N.id) occ[CW.own[i]] = (occ[CW.own[i]] || 0) + 1;
  const W = CW.nations.filter(o => warN(N, o) && occ[o.id]).sort((x, y) => occ[y.id] - occ[x.id])[0];
  if (!W) return;
  clog(lang`🏳 TESLİMİYET! ${N.name} topraklarının çoğunu kaybetti ve ${W.name} karşısında teslim oldu`);
  for (const c of natCities(N)) if (!inActive(c.x, c.y)) { c.own = W; c.siege = 0; provSet(CW.provs[c.pv], W.id); }

  nationFall(N, W);
}

function stratMonth()
{
  for (const N of CW.nations) {
    if (N.dead) continue;
    const cs = natCities(N), nufus = cs.reduce((s, c) => s + c.pop, 0);
    N.gold = Math.min(5000, N.gold + (cs.length + nufus * 0.008) * N.inc);
    N.mp = Math.min(1500, N.mp + 2 + nufus * 0.015);
    for (const q of N.queue.slice(0, 2)) if (--q.left <= 0) { q.done = true; deployDiv(N, DIVS.find(d => d.k === q.k)); }
    N.queue = N.queue.filter(q => !q.done);
    if (N.focus && --N.focus.left <= 0) {
      const F = FOCUS.find(f => f.k === N.focus.k);
      N.done.push(F.k); N.focus = null; F.fx(N);
      clog(lang`${F.icon} ${N.name} ulusal odağını tamamladı: ${F.name} (${F.txt})`);
    }
    if (N === CW.player) continue;
    if (!N.focus) { const f = FOCUS.filter(f => !N.done.includes(f.k)); if (f.length) startFocus(N, pick(f).k); }
    const atWar = CW.nations.some(o => warN(N, o)), mine = liveArmies().filter(a => a.nat === N).length;
    if (atWar && !N.queue.length && mine < 3 + cs.length / 3) enqueue(N, Math.random() < 0.6 ? 'inf' : pick(['arc', 'cav', 'art']));
    if ((CW.t + N.id) % 12===0) {
      const as = liveArmies().filter(a => a.nat === N && (a.mode === 'ai' || a.mode === 'front')).sort((x, y) => armySize(x) - armySize(y));
      as.forEach((a, i) => { a.mode = atWar && as.length >= 3 && i < as.length / 3 ? 'front' : 'ai'; });
    }
  }
  CW.plans = CW.plans.filter(pl => !pl.done && CW.armies.some(a => !a.dead && a.plan === pl));
  if (CW.t % 6 === 0) for (const N of CW.nations) if (!N.dead && CW.nations.some(o => warN(N, o)) && coreShare(N) < 0.3) capitulate(N);
}

function setPlayer(N) {
  CW.player = N;
  CW.selA.clear(); CW.sel = null;
  if (N) {
    for (const a of liveArmies()) if (a.nat === N) { a.mode = 'front'; a.order = null; a.plan=null; a.goal = null; }
    clog(lang`🎮 ${N.name} artık senin yönetiminde`);
  }
  updatePanels();

}
function watchBattle(b) {
  const P = CW.provs[b.pv];
  const ax = b.att.length ? b.att.reduce((s, a) => s + a.x, 0) / b.att.length : P.x, ay = b.att.length ? b.att.reduce((s, a) => s + a.y, 0) / b.att.length : P.y;
  const x = (P.x + ax) / 2, y=(P.y + ay) / 2;
  CW.watch = { x, y, att: b.att.slice(), def: b.def.slice() };
  enterRegion(regionOf(x, y));
}
function watchLocal(W)
{
  W.att = W.att || []; W.def = W.def || [];
  for (const a of [...W.att, ...W.def]) if (!a.dead && !a.local) localArmy(a, a.x, a.y);
  campRels();
  const A = W.att.find(a => a.local && a.local.members.length), D = W.def.find(a => a.local && a.local.members.length);
  let at = toLocal(W.x, W.y);
  if (A && D) {
    if (!A.local.battle && !D.local.battle) {
       for (const X of [A.local, D.local]) { X.state = 'idle'; X.order = null; X.manual = true; X.target = null; }
      startBattle(A.local, D.local);
    }
    const B = A.local.battle || D.local.battle;
    for (const [L, X] of [[W.att, A.local], [W.def, D.local]]) for (const a of L) {
      if (!a.local || a.local === X || a.local.battle) continue;
      a.local.state = 'idle'; a.local.order = null; a.local.manual = true;

      if (B) joinBattle(a.local, B, X.bside);
    }
    if (B) at = { x: B.x, y: B.y };
  }
  Object.assign(Sim.cam, { x: at.x, y: at.y, z: 1.1 });
}
function battlePos(b) {
  const P = CW.provs[b.pv];
  if (!b.att.length) return { x: P.x, y: P.y };
  const ax = b.att.reduce((s, a) => s + a.x, 0) / b.att.length, ay = b.att.reduce((s, a) => s + a.y, 0) / b.att.length;

  return { x: P.x + (ax - P.x) * 0.4, y: P.y + (ay - P.y) * 0.4 };
}

const DIV_TYPE = a => {
  const n = Math.max(1, armySize(a));
  return a.n.cavalry > n * 0.5 ? "cav" : a.n.artillery > n * 0.12 ? 'art' : a.n.archer > n * 0.45 ? 'arc' : 'inf';
};
function drawCampPlans(ctx, z)
{
  const arrow = (x0, y0, x1, y1, col, w) => {
    const X0 = x0 * CP, Y0 = y0 * CP, X1 = x1 * CP, Y1 = y1 * CP, a = Math.atan2(Y1 - Y0, X1 - X0), hl = w * 2.6;

    const ex = X1 - Math.cos(a) * hl * 0.8, ey = Y1 - Math.sin(a) * hl * 0.8;
    const mx = (X0 + ex) / 2 - (ey - Y0) * 0.12, my = (Y0 + ey) / 2 + (ex - X0) * 0.12;
    for (const [c, lw] of [['rgba(0,0,0,0.6)', w + 3 / z], [col, w]]) {
      ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      const b = Math.atan2(ey - my, ex - mx);
      ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(X1 + Math.cos(b) * (lw - w), Y1 + Math.sin(b) * (lw - w));
      ctx.lineTo(ex + Math.cos(b + 1.7) * hl * 0.7, ey + Math.sin(b + 1.7) * hl * 0.7);
      ctx.lineTo(ex + Math.cos(b - 1.7) * hl * 0.7, ey + Math.sin(b - 1.7) * hl * 0.7);
      ctx.fill()
    }
    ctx.lineCap = 'butt';
  };
  for (const pl of CW.plans) if (!CW.player || pl.N === CW.player) arrow(pl.x0, pl.y0, pl.x1, pl.y1, lightOf(pl.N.color), 6);
  const d = CW.rdrag;
  if (d && d.moved) arrow(d.x, d.y, d.x1, d.y1, "rgba(255,90,60,0.9)", 6);

  ctx.setLineDash([6 / z, 5 / z]); ctx.lineWidth = 2.2 / z;
  for (const a of CW.selA) {
    if (a.dead || a.local || !(a.to >= 0 || (a.route && a.route.length))) continue;
    ctx.strokeStyle = lightOf(a.nat.color);
    ctx.beginPath(); ctx.moveTo(a.x * CP, a.y * CP);

    if (a.to >= 0) ctx.lineTo(CW.provs[a.to].x * CP, CW.provs[a.to].y * CP);
    for (const i of a.route || []) ctx.lineTo(CW.provs[i].x * CP, CW.provs[i].y * CP);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (CW.player) {
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5 / z;
    for (const a of CW.selA) if (!a.dead && a.mode === 'front' && a.fp != null && a.fp !== a.pv) {
      const P = CW.provs[a.fp]; ctx.beginPath(); ctx.arc(P.x * CP, P.y * CP, 6, 0, 7); ctx.stroke();
    }
  }
}
function drawCounters(ctx, w, h, S, pulse) {
  const stack = new Map(), size = new Map(), keyOf = a => a.to >= 0 || a.local ? 'm' + a.id : a.pv;
  ctx.textBaseline = 'middle';
  for (const a of liveArmies()) size.set(keyOf(a), (size.get(keyOf(a)) || 0) + 1);
  const maxK = CW.cam.z < 1.6 ? 2 : 99;
  for (const a of liveArmies()) {
    const anahtar = keyOf(a), k=stack.get(anahtar) || 0, tot = size.get(anahtar);
    stack.set(anahtar, k + 1);
    let [X, Y] = S(a.x, a.y);
     Y += k * 20 - 8; X -= 25;
    a._sx = null;
    if (k >= maxK && tot > maxK + 1 && !CW.selA.has(a)) {
      if (k === maxK) {
        ctx.fillStyle = 'rgba(15,20,28,0.9)'; ctx.fillRect(X, Y, 30, 13);
        ctx.strokeStyle = a.nat.color; ctx.lineWidth = 1.5; ctx.strokeRect(X, Y, 30, 13);
        ctx.fillStyle = "#fff"; ctx.font = 'bold 10px Redaction35, system-ui'; ctx.textAlign = 'center'; ctx.fillText(`+${tot - maxK}`, X + 15, Y + 7);
        ctx.textAlign='left';
      }
      continue;
    }
    a._sx = X; a._sy = Y;
    if (X < -80 || Y < -80 || X > w + 80 || Y > h + 80) continue;
    const n = armySize(a), sel = CW.selA.has(a), mine = CW.player && a.nat === CW.player, Wd = 50, Hd = 15;
    ctx.globalAlpha = a.state === 'retreat' ? 0.55 : 1;
    if (a.state==='battle') { ctx.fillStyle = `rgba(255,70,40,${0.3 + pulse * 0.4})`; ctx.fillRect(X - 4, Y - 4, Wd + 8, Hd + 12); }
    ctx.fillStyle = mixHex(a.nat.color, "#000000", 0.15); ctx.fillRect(X, Y, Wd, Hd);
    ctx.fillStyle = mixHex(a.nat.color, '#000000', 0.5); ctx.fillRect(X, Y, 17, Hd);
    const t = DIV_TYPE(a), bx = X + 3, by = Y + 3, bw = 11, bh = 9;

    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    ctx.beginPath();
    if (t === 'inf') { ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by + bh); ctx.moveTo(bx + bw, by); ctx.lineTo(bx, by + bh); }
    else if (t === 'cav') { ctx.moveTo(bx, by + bh); ctx.lineTo(bx + bw, by); }
    else if (t === 'arc') { ctx.moveTo(bx + 2, by + bh - 1); ctx.quadraticCurveTo(bx + bw / 2, by - 2, bx + bw - 2, by + bh - 1); }
    ctx.stroke();
    if (t === 'art') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx + bw / 2 + 0.5, by + bh / 2 + 0.5, 2.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Redaction35, system-ui'; ctx.textAlign='center';

    ctx.fillText(String(n), X + 34, Y + Hd / 2 + 1);

    ctx.strokeStyle = sel ? '#7dff8c' : mine ? "#ffffff" : 'rgba(0,0,0,0.8)'; ctx.lineWidth = sel ? 2.2 : 1;
    ctx.strokeRect(X, Y, Wd, Hd);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(X, Y + Hd, Wd, 5);
    ctx.fillStyle = '#4fd65a'; ctx.fillRect(X, Y + Hd, Wd * clamp(a.morale / 100, 0, 1), 2.5);
    ctx.fillStyle = '#e8c547'; ctx.fillRect(X, Y + Hd + 2.5, Wd * clamp(n / Math.max(1, a.start), 0, 1), 2.5);
    ctx.font = '11px Redaction35, system-ui'; ctx.textAlign = 'left';

    const badge = a.state === "retreat" ? '🏳' : a.state === 'siege' ? '🔥' : a.mode === 'plan' ? '🏹' : a.mode === 'front' && mine ? '🛡' : '';
    if (badge) ctx.fillText(badge, X + Wd + 2, Y + 7);
    if ((sel && CW.selA.size < 4) || CW.cam.z >= 3) {
      ctx.font = 'bold 11px Redaction35, Georgia, serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(a.name, X, Y - 7); ctx.fillStyle=lightOf(a.nat.color); ctx.fillText(a.name, X, Y - 7);
    }
    ctx.globalAlpha = 1;
  }
  for (const b of CW.battles) {
    const p=battlePos(b), [X, Y] = S(p.x, p.y);
    b._sx = X; b._sy=Y;
    if (X < -40 || Y < -40 || X > w + 40 || Y > h + 40) continue;
    const winA = b.ratio >= 0.5, me = CW.player, good = me ? (b.att.some(a => a.nat === me) ? winA : b.def.some(a => a.nat === me) ? !winA : null) : null;
    ctx.fillStyle = good == null ? 'rgba(30,30,30,0.9)' : good ? "rgba(30,110,40,0.95)" : 'rgba(140,30,30,0.95)';
    ctx.strokeStyle=CW.sel && CW.sel.o === b ? '#ffd166' : '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Y, 11 + pulse * 1.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font='12px Redaction35, system-ui'; ctx.textAlign = 'center'; ctx.fillText("⚔️", X, Y + 1);
    const ac = b.att[0] ? b.att[0].nat.color : '#888', dc = b.def[0] ? b.def[0].nat.color : "#888";

    ctx.fillStyle = dc; ctx.fillRect(X - 15, Y + 14, 30, 4);
    ctx.fillStyle=ac; ctx.fillRect(X - 15, Y + 14, 30 * b.ratio, 4);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(X - 15, Y + 14, 30, 4);
  }

  const bx = CW.box;
  if (bx && bx.moved) {
    ctx.fillStyle = 'rgba(120,255,140,0.08)'; ctx.strokeStyle = 'rgba(120,255,140,0.9)'; ctx.lineWidth = 1;
    ctx.fillRect(bx.mx, bx.my, bx.mx1 - bx.mx, bx.my1 - bx.my); ctx.strokeRect(bx.mx, bx.my, bx.mx1 - bx.mx, bx.my1 - bx.my);
  }
  ctx.textAlign = 'left';
}

function hitArmy(mx, my) {
   let enIyi = null;
  for (const a of liveArmies()) if (a._sx != null && mx >= a._sx - 2 && mx <= a._sx + 52 && my >= a._sy - 2 && my <= a._sy + 21) enIyi = a;
  return enIyi;
}
function hitBattle(mx, my) {

  return CW.battles.find(b => b._sx != null && (b._sx - mx) ** 2 + (b._sy - my) ** 2 < 14 ** 2) || null;
}
function boxSelectCW(b) {
   const x0=Math.min(b.mx, b.mx1), x1 = Math.max(b.mx, b.mx1), y0 = Math.min(b.my, b.my1), y1 = Math.max(b.my, b.my1);
  if (!b.add) CW.selA.clear();
  for (const a of liveArmies()) if (commandable(a) && a._sx + 25 >= x0 && a._sx + 25 <= x1 && a._sy + 8 >= y0 && a._sy + 8 <= y1) CW.selA.add(a);
  selSync();
}
function selSync() {
  const L = [...CW.selA].filter(a => !a.dead);
  CW.selA = new Set(L);
  CW.sel = L.length === 1 ? { type: 'army', o: L[0] } : L.length ? { type: 'group' } : null;
  updatePanels();
}

const MODE_TR = { ai: '🤖 Komutanın kararı', hold: '⏸ Yerinde bekliyor', front: '🛡 Cepheyi tutuyor', plan: '🏹 Taarruz planında', order: '📍 Emrinle yürüyor' };
function modeBtns()
{
  return lang`<div class="row" style="margin-top:6px"><button data-cw="mode:front">🛡 Cepheyi tut</button><button data-cw="mode:hold">⏸ Bekle</button><button data-cw="mode:ai">🤖 Komutana bırak</button></div>` +
    lang`<div class="muted" style="margin-top:4px">Sağ tık: oraya yürü · <b>Sağ tuşla sürükle: taarruz oku</b> (ordular okun ucuna doğru eyalet eyalet saldırır)</div>`;
}
function groupInfo() {
  const L = [...CW.selA].filter(a => !a.dead);
  const tot = L.reduce((s, a) => s + armySize(a), 0);
  return lang`<b style="font-size:14px">🎖 ${L.length} ordu seçili</b> · ${tot} asker<br>` +
    L.map(a => lang`<a data-cw="army:${a.id}">${a.name}</a> <span class="muted">${armySize(a)} · düzen ${a.morale | 0} · ${MODE_TR[a.mode] || ''}</span>`).join('<br>') + modeBtns();
}
function battleInfo(b)
{
  const P = CW.provs[b.pv], m = battleMods(b);
  const taraf = L => L.map(a => lang`${nSw(a.nat)} <a data-cw="army:${a.id}">${a.name}</a> <span class="muted">${armySize(a)} asker · düzen ${a.morale | 0}</span>`).join('<br>') || "-";
  return lang`<b style="font-size:14px">⚔️ ${provName(P)} Muharebesi</b><br>Arazi: ${TER[P.ter].name}${m.terr > 1 ? lang` (savunana +%${Math.round((m.terr - 1) * 100)})` : ''}${m.wall > 1 ? ' · 🧱 sur' : ''} · ${b.t} aydır sürüyor<br>` +
    lang`<b>Saldıran</b><br>${taraf(b.att)}<br><b>Savunan</b><br>${taraf(b.def)}<br>` +
    lang`Saldıranın üstünlüğü: %${Math.round(b.ratio * 100)}<div style="height:6px;background:${b.def[0] ? b.def[0].nat.color : '#555'};margin:3px 0"><div style="height:6px;width:${b.ratio * 100}%;background:${b.att[0] ? b.att[0].nat.color : '#555'}"></div></div>` +
    lang`<div class="row" style="margin-top:6px"><button data-cw="watch:${b.id}">👁 Savaşı izle (${regName(regionOf(P.x, P.y))} bölgesine in)</button></div>` +
    lang`<div class="muted" style="margin-top:4px">Bölgeye inince ordular asker asker çarpışır; kamera muharebenin üstüne gelir.</div>`;
}
function provInfo(pv) {
  const P = CW.provs[pv], o = natById(pown(P)), core = natById(CW.core[P.c0]);
  const as = armiesIn(pv);
  return lang`<b>📍 ${provName(P)}</b> eyaleti · ${TER[P.ter].name}${TER_DEF[P.ter] ? lang` (savunma +%${Math.round((TER_DEF[P.ter] - 1) * 100)})` : ''}<br>` +
    (o ? lang`Elinde tutan: ${nSw(o)}` : lang('Sahipsiz')) + (core && core !== o ? lang` · <span style="color:#f4a261">işgal altında</span> (asıl sahibi ${nSw(core)})` : "") +
    (as.length ? lang`<br>Ordular: ${as.map(a => `<a data-cw="army:${a.id}">${a.name}</a>`).join(', ')}` : '') + '<br><br>';
}
function playPanel() {
  const N = CW.player;
  if (!N) {
    return lang`<h3>🎮 Ülkeni seç</h3><div class="muted">Bir ülkeyi yönet: ordularını cepheye diz, taarruz okları çiz, tümen üret, ulusal odak seç. Seçmezsen izleyici olarak dünyayı izlersin.</div>` +
      `<div class="row" style="margin-top:4px">${CW.nations.filter(n => !n.dead).map(n => `<button data-cw="play:${n.id}" style="border-left:6px solid ${n.color}">${n.name}</button>`).join('')}</div>`;
  }
  if (N.dead) return lang`<h3>🎮 ${N.name} †</h3><div class="muted">Ülken yıkıldı.</div><button data-cw="spect">👁 İzleyici ol</button>`;
  const mine = liveArmies().filter(a => a.nat === N), wars = CW.nations.filter(o => warN(N, o));
  const prod = DIVS.map(D => lang`<button data-cw="build:${D.k}" ${N.gold < D.gold || N.mp < D.mp ? 'style="opacity:.45"' : ""} title="${D.n} asker · ${D.m} ay">${D.icon} ${D.name}<br><span class="muted" style="font-size:11px">${D.gold} altın, ${D.mp} insan · ${D.m} ay</span></button>`).join("");
   const queue = N.queue.map((q, i) => { const D = DIVS.find(d => d.k === q.k); return `<div>${D.icon} ${D.name} ${i < 2 ? `<span class="muted">%${Math.round((1 - q.left / q.m) * 100)}</span>` : lang('<span class="muted">sırada</span>')} <a data-cw="cancel:${i}">✕</a></div>`; }).join('');
  const F = N.focus && FOCUS.find(f => f.k === N.focus.k);
  const focus = F ? lang`<div>${F.icon} <b>${F.name}</b> · ${N.focus.left} ay kaldı<div style="height:5px;background:var(--bg3);margin-top:3px"><div style="height:5px;width:${(1 - N.focus.left / N.focus.m) * 100}%;background:var(--hi)"></div></div><span class="muted">${F.txt}</span></div>`
    : `<div class="row">${FOCUS.filter(f => !N.done.includes(f.k)).map(f => `<button data-cw="focus:${f.k}" title="${f.txt} · ${f.m} ay">${f.icon} ${f.name}</button>`).join('') || lang('<span class="muted">Bütün odaklar tamam</span>')}</div>`;
  const dip = CW.nations.filter(o => o !== N && !o.dead).map(o => {
    const st = relN(N, o);
    return `<div class="kr">${nSw(o)}<span class="n">${{ war: lang('⚔️ savaş'), alliance: lang('🛡 müttefik'), peace: lang("barış") }[st]}</span></div><div class="row" style="margin:0 0 4px 16px">` +
      (st === 'war' ? lang`<button data-cw="peace:${o.id}">🕊 Barış öner</button>` : st === 'peace' ? lang`<button data-cw="war:${o.id}">⚔️ Savaş ilan et</button><button data-cw="ally:${o.id}">🤝 İttifak öner</button>` : '') + '</div>';
  }).join('');
  return `<h3>🎮 <span class="sw" style="background:${N.color}"></span> ${N.name}</h3>` +
    lang`<div>💰 ${N.gold | 0} altın · 👥 ${N.mp | 0} insan gücü · 🎖 ${mine.length} ordu (${mine.reduce((s, a) => s + armySize(a), 0)} asker)</div>` +
    lang`<div class="muted">Saldırı ×${N.atk.toFixed(2)} · Savunma ×${N.def.toFixed(2)} · Teknoloji: ${AGES[N.tech].name} · Öz toprak elinde %${Math.round(coreShare(N) * 100)}</div>` +
    lang`<div class="row" style="margin-top:4px"><button data-cw="selall">☑ Bütün ordularımı seç</button><button data-cw="allfront">🛡 Hepsi cepheye</button><button data-cw="spect">👁 İzleyici ol</button></div>` +
    lang`<h3>🏭 Tümen üretimi</h3><div class="row">${prod}</div>${queue ? `<div class="box" style="margin-top:4px">${queue}</div>` : ''}` +
    lang`<h3>🎯 Ulusal odak</h3>${focus}` +
    lang`<h3>🏛 Diplomasi</h3>${dip}` +
    (wars.length ? '' : lang('<div class="muted">Şu an savaşta değilsin.</div>'));
}

document.body.addEventListener('click', e => {

  const el = e.target.closest('[data-cw]');
  if (!el || !CW.on) return;
  const [cmd, arg] = el.dataset.cw.split(':'), N = CW.player, O = arg != null ? natById(+arg) : null;
  if (cmd === 'watch') { const b = CW.battles.find(b => b.id === +arg); if (b) watchBattle(b); return; }
  if (CW.view!=='map') return;
  const secili = [...CW.selA];
  switch (cmd) {
    case "army": { const a = CW.armies.find(a => a.id === +arg); CW.selA = new Set(a ? [a] : []); break; }
    case 'battle': { const b = CW.battles.find(b => b.id === +arg); CW.sel = b ? { type: 'battle', o: b } : null; break; }
    case 'mode': setMode(secili, arg); break;
    case 'free': setMode(secili.length ? secili : CW.sel && CW.sel.o ? [CW.sel.o] : [], 'ai'); break;
    case 'play': setPlayer(O); break;
    case 'spect': setPlayer(null); break;
    case 'selall': CW.selA = new Set(liveArmies().filter(a => a.nat === N)); return selSync();
    case 'allfront': setMode(liveArmies().filter(a => a.nat === N), 'front'); break;
    case 'build': if (N) enqueue(N, arg); break;
    case 'cancel': if (N && N.queue[+arg]) { const q = N.queue.splice(+arg, 1)[0], D = DIVS.find(d => d.k === q.k); N.gold += D.gold; N.mp += D.mp; } break;
    case 'focus': if (N) startFocus(N, arg); break;
    case 'war': if (N && O && relN(N, O) === 'peace') declareN(N, O, lang('hükümdarın kararı')); break;
    case 'peace': if (N && O && warN(N, O)) offerPeace(N, O); break;
    case 'ally': if (N && O && relN(N, O) === 'peace') offerAlliance(N, O); break;
    default: return;
  }
  updatePanels();
});
window.addEventListener('keydown', e => {

  if (!campMap() || e.target.type === 'text') return;
  if (e.key === 'Escape') { CW.selA.clear(); CW.sel = null; CW.rdrag = null; CW.box = null; updatePanels(); }
});

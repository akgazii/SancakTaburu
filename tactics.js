const UNIT_RANK = { shield: -0.2, flamer: -0.1, soldier: 0, rifle: 0, trooper: 0, sapper: 0.05, spear: 0.1, halberd: 0.12,
  tank: 0.9, cavalry: 1, hussar: 1, knight: 1, harcher: 1.05, archer: 2, xbow: 2.05, rifleman: 2, sniper: 2.1,
  gatling: 2.9, mg: 2.9, artillery: 3, mortar: 3.05, fieldgun: 3.1, rocket: 3.2, medic: 4 };
const UNIT_NAMES = [['soldier', 'piyade'], ['shield', 'kalkanlı'], ['spear', 'mızrakçı'], ['halberd', 'teberdar'], ['cavalry', 'süvari'], ['knight', 'şövalye'],
  ['harcher', 'atlı okçu'], ['archer', 'okçu'], ['xbow', 'arbaletçi'], ['artillery', 'topçu'], ['medic', 'sedyeci']];
const UNIT_NAMES_V = [['rifle', "hat piyadesi"], ['rifleman', 'avcı'], ['hussar', 'süvari'], ['fieldgun', 'sahra topu'], ['gatling', 'mitralyöz'], ['medic', 'sedyeci']];
const UNIT_NAMES_W = [['trooper', 'piyade'], ['sapper', 'hendekçi'], ['flamer', 'alevci'], ['mg', 'makineli tüfek'], ['sniper', 'keskin nişancı'],
  ['mortar', "havan"], ['rocket', 'roketatar'], ['tank', 'tank'], ['medic', 'sedyeci']];
const ERAS = { mid: { n: 'İlkçağ-Ortaçağ', units: UNIT_NAMES }, vic: { n: 'Victoria', units: UNIT_NAMES_V }, ww: { n: 'Dünya Savaşları', units: UNIT_NAMES_W } };
const ALL_UNITS = [...UNIT_NAMES, ...UNIT_NAMES_V, ...UNIT_NAMES_W].filter(([j], i, a) => a.findIndex(u => u[0] === j) === i);
const VIC_JOBS = new Set(['rifle', 'rifleman', 'hussar', 'fieldgun', 'gatling']);
const WW_JOBS = new Set(["trooper", 'sapper', 'flamer', 'mg', 'sniper', 'mortar', 'rocket', 'tank']);
const NEW_JOBS = new Set([...VIC_JOBS, ...WW_JOBS, 'knight', 'halberd', 'xbow', 'harcher']);

const BASE_JOB = { rifle: 'soldier', rifleman: "archer", hussar: 'cavalry', fieldgun: 'artillery', gatling: 'artillery',
  knight: 'cavalry', harcher: 'cavalry', xbow: 'archer', halberd: "spear",
  trooper: 'soldier', sapper: 'soldier', flamer: 'soldier', sniper: 'archer', mg: 'artillery', mortar: 'artillery', rocket: "artillery", tank: 'cavalry' };
const bj = p => BASE_JOB[p.job] || p.job;
const isCav = p => bj(p) === 'cavalry';
const isHorse = p => isCav(p) && p.job !== 'tank';
const isPike = p => p.job === 'spear' || p.job === "halberd";
const LINE_INF = new Set(['rifle', 'trooper', 'sapper']);
const isRanged = p => { const b = bj(p); return b === "archer" || b === 'artillery' || LINE_INF.has(p.job) || p.job === "harcher" || p.job === 'tank'; };
const SHOOTERS = new Set(['archer', 'xbow', 'harcher', 'rifleman', 'rifle', 'gatling', "trooper", 'sapper', 'sniper', 'mg']);
const shooter = p => SHOOTERS.has(p.job);
const rangedN = A => (A.nArch || 0) + (A.nArt || 0) + (A.nRifle || 0);
const digger = p => bj(p) !== 'archer' && bj(p) !== 'artillery' && p.job !== 'tank' && p.job !== "harcher";
const ART_R = 230, FIELD_R = 340;

function armyComp(liste) {
  const c = {};
  for (const p of liste) { const j = UNIT_RANK[p.job] != null ? p.job : 'soldier'; c[j] = (c[j] || 0) + 1; }
  return ALL_UNITS.filter(([j]) => c[j]).map(([j, n]) => lang`${c[j]} ${n}`).join(', ') || lang('0 asker');
}
function countUnits(A)
{
  A.nArch=A.nCav = A.nArt = A.nMed = A.nRifle = A.nSap = A.nBomb = 0;
  let nV = 0, nW = 0;
  for (const p of A.members) {
    if (VIC_JOBS.has(p.job)) nV++; else if (WW_JOBS.has(p.job)) nW++;
    if (p === A.cmd) continue;
    const b = bj(p);

    if (b === 'archer') A.nArch++; else if (b === 'cavalry') A.nCav++; else if (b === 'artillery') A.nArt++; else if (p.job === 'medic') A.nMed++;
    else if (LINE_INF.has(p.job)) A.nRifle++;
    if (p.job === 'sapper') A.nSap++; else if (p.job === 'mortar' || p.job === 'rocket') A.nBomb++;
  }
  A.vic = nV * 2 > A.members.length; A.ww = nW * 2 > A.members.length;

}

function strike(p, g, shootR, meleeR) {
  const j = p.job;
  if (j === 'medic') return false;
  if (LINE_INF.has(j)) return rifleStrike(p, g, meleeR);
  if (j === 'flamer') return flameStrike(p, g, meleeR);
  if (j === 'tank') return tankStrike(p, g);
  if (j === 'harcher') return kiteAway(p, g) || shoot(p, g, 100) || engage(p, g, meleeR * 1.4);
  const b = bj(p);
  if (b === 'archer' || b === 'artillery') return fireAt(p, g, shootR);
  return engage(p, g, b === 'cavalry' ? meleeR * 1.4 : meleeR);
}
function fireAt(p, g, range)
{
  const j = p.job;
  if (j === 'gatling' || j === 'mg') return gunFire(p, g, range);
  if (j==='tank') return tankStrike(p, g);
  if (bj(p)==='artillery') return bombard(p, g);
  return shoot(p, g, range);
}
function rifleStrike(p, g, meleeR)
{
  const A = p.army, f = p.foe;
  if (A && A.bayonet) return engage(p, g, Math.max(meleeR, 30));
  if (f && !f.dead && !downed(f) && hostile(p.k, f.k) && dist2(p, f) < 15 * 15) { moveTo(p, f.x, f.y, 1.1); return true; }
  if (!shoot(p, g, 0)) return false;

  if (A && A.ww) {
    const o = A.order;
    if (o && (o.type === 'attack' || o.type === 'free') && p.foe && Sim.trenches.length && inTrench(p.foe) && !inTrench(p)) return false;
    A.stopT = Sim.tick;
  }
  return true;
}
const ducked = p => WW_JOBS.has(p.job) && p.job !== 'tank' && !(p.upT > Sim.tick - 12) && inTrench(p);

function flameStrike(p, g, meleeR)
{
  const R = clamp((meleeR || 35) * 1.8, 70, 110);
  let f = p.foe, bd = Infinity;
  if (!f || f.dead || downed(f) || !hostile(p.k, f.k) || dist2(p, f) > R * R) {
    f = null;
    if ((Sim.tick + p.id) % 8 === 0) near(g, p.x, p.y, R, q => {

      if (q.dead || downed(q) || !q.army || q.army.state === 'sail' || !hostile(p.k, q.k) || q.hid) return;
      const d = dist2(p, q) * (inTrench(q) ? 0.6 : 1);
      if (d < bd) { bd=d; f = q; }
    });
    p.foe = f;
  }
  if (!f) return false;
  p.a = Math.atan2(f.y - p.y, f.x - p.x);
  if (dist2(p, f) > 60 * 60) { moveTo(p, f.x, f.y, 1.05); return true; }
  p.upT = Sim.tick;

  if ((Sim.tick + p.id) % 5 === 0) fireFlame(p);
  return true;
}
const FLAME_R = 72;
function fireFlame(p) {

  const a = p.a, ca = Math.cos(a), sa = Math.sin(a);
  if (Sim.fx.length < 1500) for (let i = 0; i < 3; i++) { const d = rnd(8, FLAME_R - 4), o = rnd(-0.3, 0.3) * d; Sim.fx.push({ x: p.x + ca * d - sa * o, y: p.y + sa * d + ca * o, t: 9 + (Math.random() * 7 | 0), type: 'flame' }); }
  p.loud = Sim.tick;
  if (!Sim.grid) return;
  const hit = [];
  near(Sim.grid, p.x + ca * FLAME_R / 2, p.y + sa * FLAME_R / 2, FLAME_R / 2 + 4, q => {
     if (q.dead || downed(q) || !hostile(p.k, q.k) || (!q.army && !isFighter(q))) return;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (d > FLAME_R || d < 2 || Math.abs(angDiff(a, Math.atan2(dy, dx))) > 0.42) return;

    hit.push(q);
  });
  for (const q of hit) {
    if (q.dead) continue;
    const m = q.job === 'tank' ? 0.35 : inTrench(q) ? 1.25 : 1;
     q.hp -= 3.2 * m / (0.6 + q.stats.end * 0.08);
    q.supT = Sim.tick + 60;
    q.loud = Sim.tick; q.hitT = Sim.tick; q.hitBy = p;
    if (q.army) { q.army.shotT = Sim.tick; if (p.army) q.army.shotBy=p.army; }
    if (q.hp<=0) kill(q, p, 'alev');
  }
}

function tankStrike(p, g) {
  let dusman = p.foe;
  if (!dusman || dusman.dead || downed(dusman) || !dusman.army || dist2(p, dusman) > 240 * 240) {
    dusman=null;
    if ((Sim.tick + p.id) % 10 === 0) {
      let fd = Infinity;
      near(g, p.x, p.y, 240, q => {
        if (q.dead || downed(q) || !q.army || q.army.state === 'sail' || !hostile(p.k, q.k) || q.hid) return;
        const d = dist2(p, q) * (q.job === "tank" || bj(q) === 'artillery' ? 0.5 : 1);
        if (d < fd && dist2(p, q) < 240 * 240) { fd = d; dusman = q; }
      });
    }
    p.foe = dusman;
  }
  if (!dusman) return false;
  const d2 = dist2(p, dusman);
  p.a = Math.atan2(dusman.y - p.y, dusman.x - p.x);
  if ((Sim.tick + p.id * 5) % 110 === 0) fireShell(p, dusman.x, dusman.y, null);
  if (d2<140 * 140) { const ph = (Sim.tick + p.id * 3) % 100; if (ph < 40 && ph % 4 === 0) fireBullet(p, dusman, 9, 0.08); }
  if (d2 < 45 * 45) { moveTo(p, dusman.x, dusman.y, 1); return true; }
  return false;
}

const GUNS = {
  rifle:    { r: 150, reload: 60, dmg: 12, spread: 0.09, volley: true },
  rifleman: { r: 200, reload: 80, dmg: 13, spread: 0.05 },
  gatling:  { r: 160, reload: 4, dmg: 9, spread: 0.09, burst: 20, rest: 50 },
  trooper:  { r: 175, reload: 50, dmg: 13, spread: 0.075 },
  sapper:   { r: 130, reload: 75, dmg: 11, spread: 0.1 },
  sniper:   { r: 300, reload: 150, dmg: 34, spread: 0.018, sniper: true },
  mg:       { r: 230, reload: 3, dmg: 10, spread: 0.075, burst: 26, rest: 55 },
};
function gunFire(p, g, range)
{
  const G = GUNS[p.job], hill=onHill(p), R = Math.max(range || 0, G.r) * (hill ? 1.1 : 1);
  let foe = p.foe;
  if (!foe || foe.dead || downed(foe) || (!foe.army && foe !== Sim.ctrl && foe.state !== 'courier') || dist2(p, foe) > R * R) {
    foe = null;
    if ((Sim.tick + p.id) % 10 === 0) {
      let fd = R * R;
      if (G.sniper) for (const X of allArmies()) {
        const c = X.cmd;

        if (c && !c.dead && X.members.length && hostile(p.k, X.k) && !c.hid && dist2(p, c) < fd) { fd = dist2(p, c); foe = c; }
      }
      if (!foe) near(g, p.x, p.y, R, q => {
        if (q.dead || downed(q) || (!q.army && q !== Sim.ctrl && q.state !== 'courier') || (q.army && q.army.state === "sail") || !hostile(p.k, q.k) || q.hid) return;
        const d = dist2(p, q) * (q.job === 'tank' ? 9 : 1);
        if (d<fd) { fd = d; foe = q; }
      });
    }
    p.foe = foe;
  }
  if (!foe) return false;
  p.a = Math.atan2(foe.y - p.y, foe.x - p.x);
  const A = p.army;
  if (p.supT > Sim.tick && WW_JOBS.has(p.job) && inTrench(p)) return true;
  let fire, up;
  if (G.burst) { const cyc = G.burst * G.reload + G.rest, ph = (Sim.tick + p.id * 11) % cyc; up = ph < G.burst * G.reload || ph > cyc - 10; fire = ph < G.burst * G.reload && ph % G.reload === 0; }
  else if (G.volley && A) { const ph=(Sim.tick + A.id * 13) % G.reload; fire=ph === 0; up = fire || ph > G.reload - 10; }
  else { const ph = (Sim.tick + p.id * 7) % G.reload; fire = ph === 0; up = fire || ph > G.reload - 10; }
  if (up) p.upT=Sim.tick;
  if (fire) { fireBullet(p, foe, G.dmg * vetMul(p) * (hill ? 1.1 : 1), G.spread); if (A) A.fireT = Sim.tick; }
  return true;
}
function fireBullet(from, foe, hasar, spread) {
  from.loud=Sim.tick;
  const d = dist(from, foe), skill = from.stats ? clamp(1.25 - (from.stats.int + from.stats.spd) * 0.025, 0.7, 1.2) : 1;
  const sp = 1.5 + d * spread * skill, a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * sp;
  Sim.arrows.push({ bullet: true, x0: from.x, y0: from.y, tx: foe.x + Math.cos(a) * r, ty: foe.y + Math.sin(a) * r, foe, from, dmg: hasar, t: 0, T: Math.max(2, d / 20 | 0) });
  smoke(from, 1);
}
function fireCanister(p, dusman) {
  const a0 = Math.atan2(dusman.y - p.y, dusman.x - p.x), d = Math.max(30, dist(p, dusman));
  for (let i = 0; i < 10; i++) {
    const a = a0 + rnd(-0.28, 0.28), r=d * rnd(0.8, 1.25);

    Sim.arrows.push({ bullet: true, x0: p.x, y0: p.y, tx: p.x + Math.cos(a) * r, ty: p.y + Math.sin(a) * r, foe: null, from: p, dmg: 5.5, t: 0, T: Math.max(2, r / 18 | 0) });
  }
  p.loud = Sim.tick
  smoke(p, 2);
}
function smoke(p, s) {
  if (Sim.fx.length > 1200 || (Sim.fx.length > 600 && Math.random() < 0.6)) return;
  const a = p.a || 0;
  Sim.fx.push({ x: p.x + Math.cos(a) * 5, y: p.y + Math.sin(a) * 5, t: 40, type: 'smoke', s, dx: rnd(-0.08, 0.08) });
}
function bulletHit(a) {

  const f = a.foe;
  if (f && (f.hull || f.mon)) { if (!f.dead) { if (f.hull) damageShip(f, a.dmg, a.from); else hurtMonster(f, a.dmg, a.from); } return; }
  let q = f && !f.dead && !downed(f) && (f.x - a.tx) ** 2 + (f.y - a.ty) ** 2 < (isCav(f) ? 81 : 49) ? f : null;
  if (!q && Sim.grid && a.from.k) {
    let bd = 25;
    near(Sim.grid, a.tx, a.ty, 5, o => {
      if (o.dead || downed(o) || !hostile(a.from.k, o.k) || !(o.army || isFighter(o))) return;
      const d = (o.x - a.tx) ** 2 + (o.y - a.ty) ** 2;
      if (d < bd) { bd = d; q = o; }
    });
  }
  if (!q) return;
  if (q.army) { q.army.shotT = Sim.tick; if (a.from.army) q.army.shotBy = a.from.army; }
  q.loud = Sim.tick;
  if (a.from.stats) { q.hitT=Sim.tick; q.hitBy = a.from; }
  q.hp -= a.dmg * bulletTaken(q) / (0.6 + q.stats.end * 0.08);
  if (q.hp <= 0) kill(q, a.from.stats && !a.from.dead ? a.from : null, 'kurşun');
}
function bulletTaken(f) {
  if (f.job==='tank') return 0.05;
  let m = 1;
  const F = f.army && f.army.form;
   if (F==='skirmish') m = 0.8; else if (F === 'column' || F === 'testudo' || F === 'phalanx' || F === "squares") m = 1.1;
  if (f.job === "shield") m *= 0.85; else if (f.job === 'knight') m *= 0.9;
  else if (f.job === 'flamer' && f.army && foeDug(f.army)) m *= 0.6;
  if (Sim.trenches.length && inTrench(f)) {
    if (WW_JOBS.has(f.job)) return f.upT > Sim.tick - 12 ? m * 0.35 : 0;
    m *= 0.55;
  }
  return m;
}
function reflex(p, g, r) {
  const h = p.hitBy, A = p.army;
  if (p.hitT > Sim.tick - 45 && h && !h.dead && hostile(p.k, h.k) && dist2(p, h) < 40 * 40) p.foe = h;
  return engage(p, g, A && A.hitT > Sim.tick - 60 ? Math.max(r, 30) : r);
}
function unitPace(p)
{
  const A = p.army, cav = isCav(p), art = bj(p) === 'artillery';
  let v = cav ? (CAV_PACE[p.job] || 1.75) : art ? 0.8 : p.job === 'shield' ? 0.88 : p.job === 'flamer' ? 0.92 : 1;
  if (A && !cav && !art) v *= formOf(A).pace;
  if (A && p === A.cmd && A.state !== 'battle') {
    const allCav = A.members.length - (A.nCav || 0) <= 1;
    v = Math.min(v, (allCav ? 1.75 : formOf(A).pace) * (A.nArt ? 0.8 : 1) * 0.92);
  }
  return v;
}
const CAV_PACE = { hussar: 1.85, knight: 1.5, harcher: 1.95, tank: 1.3 };
const pickCmd = liste => { const m = liste.filter(p => p.job === 'soldier' || p.job === "rifle" || p.job === 'trooper'); return best(m.length ? m : liste, p => p.stats.str + p.stats.int); };

function kiteAway(p, g) {
  let th = null, td = 55 * 55;
  if ((Sim.tick + p.id) % 5 === 0 || p.kiteFrom) near(g, p.x, p.y, 55, q => {
    if (q.dead || !q.army || isRanged(q) || !hostile(p.k, q.k)) return;
    const d = dist2(p, q); if (d<td) { td = d; th = q; }
  });
  p.kiteFrom = th;
  if (!th) return false;
  const a = Math.atan2(p.y - th.y, p.x - th.x);
  moveTo(p, p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30, 1.2);
  return true;
}

function meleeMul(p, dusman) {
  let m = 1;
  if (p.job === "tank") { m *= dusman.job === 'tank' ? 0.15 : 2.4; p.lastHit=Sim.tick; }
  else if (isCav(p)) {
    const charge = Sim.tick - (p.lastHit || 0) > 90, j = p.job;
    m *= charge ? (j === "hussar" ? 2.4 : j === 'knight' ? 3.3 : j === 'harcher' ? 1.3 : 2.8) : (j === "hussar" ? 1.4 : j === 'knight' ? 1.75 : j === 'harcher' ? 0.8 : 1.5);
    if (isRanged(dusman)) m *= 1.3;
    if (dusman.army) m *= formOf(dusman.army).cav;
    if (isPike(dusman) || (dusman.job === 'rifle' && dusman.army && dusman.army.form === 'squares')) m *= 0.4;
    if (dusman.job==='tank') m *= 0.1;
    if (charge && Sim.grid && dusman.army && formOf(dusman.army).cav >= 0.8 && !isPike(dusman) && dusman.job !== 'shield' && dusman.job !== 'tank' && j !== 'harcher') trample(p, dusman);
    p.lastHit = Sim.tick;
  } else if (bj(p)==='artillery') m *= 0.4;
  else if (isPike(p) && isHorse(dusman)) { m *= p.job === "halberd" ? 2 : 2.2; p.lastHit=Sim.tick; }
  else if (p.job === 'halberd') { m *= 1.25; p.lastHit = Sim.tick; }
  else if (p.job === 'rifle' && isHorse(dusman) && p.army && p.army.form === 'squares') { m *= 2; p.lastHit=Sim.tick; }
  else if (p.job === 'shield') { m *= 0.8; p.lastHit=Sim.tick; }
  else if (p.army && p.army.form === 'wedge' && Sim.tick - (p.lastHit || 0) > 120) { m *= 1.5; p.lastHit = Sim.tick; }
  else p.lastHit = Sim.tick;
  const B = p.army && p.army.battle;
  if (B && B.ambush === p.army && B.t < 600) m *= 1.35;
  return m;
}
function trample(p, dusman) {
  let n = 0;

  near(Sim.grid, dusman.x, dusman.y, 8, q => {
    if (n >= 2 || q === dusman || q.dead || !q.army || !hostile(p.k, q.k) || (q.x - dusman.x) ** 2 + (q.y - dusman.y) ** 2 > 64) return;
     n++;
    q.hp -= (2 + p.stats.str * 0.5) * p.R.size * takenMul(q, false) / (0.6 + q.stats.end * 0.08);
    q.hitSide = Sim.tick + 60; q.loud = Sim.tick;
     if (q.hp <= 0) kill(q, p, "savaş");
  });
}
function takenMul(f, ranged)
{
  let m = f.army ? (ranged ? formOf(f.army).arrow : formOf(f.army).taken) : 1;
  if (f.job==='tank') return ranged ? 0.04 : 0.06;
  if (!ranged && f.army && isRanged(f)) m = LINE_INF.has(f.job) ? m * 1.1 : 1.3;
  if (f.job === "shield") m *= ranged ? 0.45 : 0.8;
  else if (f.job === 'halberd') m *= ranged ? 0.9 : 0.85;
  if (Sim.trenches.length && inTrench(f)) m *= ranged ? 0.5 : 0.75;
  if (f.job === 'cavalry' && f.army) m *= ranged ? 0.85 : 0.55;
  else if (f.job === 'knight' && f.army) m *= ranged ? 0.65 : 0.4;
  else if ((f.job === "hussar" || f.job === 'harcher') && f.army) m *= ranged ? 1 : 0.75;
  return m;
}

const SHELLS = {
  artillery: null,
  fieldgun: { R: FIELD_R, minD: 100, sp0: 3, spK: 10, v: 6, dmg: p => 9 + p.stats.int * 0.4, rad: 16, T0: 12 },
  mortar:   { R: 360, minD: 70 * 70, sp0: 3, spK: 12, v: 3, dmg: () => 10, rad: 15, T0: 30, kind: 'mortar' },
  rocket:   { R: 420, minD: 120 * 120, sp0: 10, spK: 26, v: 7, dmg: () => 9, rad: 14, T0: 15, kind: 'rocket' },
  tank:     { R: 240, minD: 0, sp0: 2, spK: 6, v: 9, dmg: () => 14, rad: 11, T0: 5, kind: 'tank' },
};
function bombard(p, g) {
  const S = SHELLS[p.job], field = p.job === 'fieldgun', R = S ? S.R : ART_R, minD = S ? S.minD : 900;
  let foe = p.foe;
  if (!foe || foe.dead || !foe.army || dist2(p, foe) > R * R) {
    foe = null;
    if ((Sim.tick + p.id) % 10 === 0) {
      let fd = R * R;
      near(g, p.x, p.y, R, q => {

         if (q.dead || !q.army || q.army.state === 'sail' || !hostile(p.k, q.k) || q.hid) return;
        const d = dist2(p, q);
        if (d > minD && d < fd) { fd = d; foe = q; }
      });
    }
    p.foe = foe;
  }
  if (!foe) return false;
  p.a = Math.atan2(foe.y - p.y, foe.x - p.x);
  if (field) {
    if (dist2(p, foe) < 110 * 110) { if ((Sim.tick + p.id) % 90 === 0) fireCanister(p, foe); }
    else if ((Sim.tick + p.id) % 140 === 0) fireShell(p, foe.x, foe.y, null);
    return true;
  }
  const bar = p.army && p.army.barrageT > Sim.tick;
  if (p.job === 'mortar') { if ((Sim.tick + p.id) % (bar ? 65 : 110) === 0) fireShell(p, foe.x, foe.y, null); return true; }
  if (p.job==='rocket') { const ph = (Sim.tick + p.id * 9) % (bar ? 260 : 420); if (ph < 40 && ph % 5 === 0) fireShell(p, foe.x, foe.y, null); return true; }
  if ((Sim.tick + p.id) % 140 === 0) fireShell(p, foe.x, foe.y, null);
  return true;
}
function fireShell(from, tx, ty, wallOf)
{

  from.loud = Sim.tick;
  const S=SHELLS[from.job], d = Math.hypot(tx - from.x, ty - from.y);
  if (S) {
    const sp = S.sp0 + d / S.R * S.spK;
    Sim.arrows.push({ shell: true, x0: from.x, y0: from.y, tx: tx + rnd(-sp, sp), ty: ty + rnd(-sp, sp), from, wall: wallOf, t: 0, T: Math.max(S.T0, d / S.v | 0),
      dmg: S.dmg(from), cannon: true, rad: S.rad, kind: S.kind })
    smoke(from, S.kind === 'mortar' ? 1.4 : 2);

    return;
  }
  const sp = 4 + d / ART_R * 14;
  Sim.arrows.push({ shell: true, x0: from.x, y0: from.y, tx: tx + rnd(-sp, sp), ty: ty + rnd(-sp, sp), from, wall: wallOf, t: 0, T: Math.max(20, d / 3.5 | 0),
    dmg: (8 + from.stats.int * 0.6) * techMul(from.k), cannon: from.k.tech >= 3, rad: 16 });

}
function shellHit(a) {
  Sim.fx.push({ x: a.tx, y: a.ty, t: 20, type: 'blast' });

  const w = a.wall && a.wall.walls;
  if (w && w.hp > 0) w.hp -= 5 + a.dmg * 0.6;
  if (!Sim.grid) return;
  const k = a.from.k, rad = a.rad || 16;
  near(Sim.grid, a.tx, a.ty, rad, q => {
    if (q.dead || !hostile(k, q.k) || (!isFighter(q) && q.job !== 'king') || (q.army && q.army.state === 'sail')) return;
    const d = Math.hypot(q.x - a.tx, q.y - a.ty);
    if (d > rad) return;
    let m = q.job === 'tank' ? (a.kind === 'tank' || a.cannon ? 0.5 : 0.3) : takenMul(q, true);
    if ((a.kind === 'mortar' || a.kind === 'rocket') && q.job !== 'tank' && inTrench(q)) m *= 1.6;
    q.hp -= a.dmg * (1 - d / (rad + 6)) * m / (0.6 + q.stats.end * 0.08);
    q.loud = Sim.tick;
    if (q.army) { q.army.shotT = Sim.tick; if (a.from.army) q.army.shotBy=a.from.army; }
    if (q.hp <= 0) kill(q, a.from.dead ? null : a.from, 'gülle');
  });
  near(Sim.grid, a.tx, a.ty, SUPPRESS_R, q => { if (!q.dead && q.army && hostile(k, q.k)) q.supT = Sim.tick + 90; });
}
const SUPPRESS_R = 50;
function siegeGun(p, g, T) {
  const w = T.walls;
  if (!w || w.hp <= 0 || T.k === p.k) { if (bombard(p, g)) return; moveTo(p, T.x + (p.slot % 5 - 2) * 14, T.y + 140); return; }
  const a = Math.atan2(p.y - T.y, p.x - T.x), rr = wallRay(T, a);
  if (moveTo(p, T.x + Math.cos(a) * (rr + 120), T.y + Math.sin(a) * (rr + 120), 1)) {
    p.a = a + Math.PI;
    if ((Sim.tick + p.id) % 140 === 0) fireShell(p, T.x + Math.cos(a) * rr, T.y + Math.sin(a) * rr, T);
  }
}

const TRENCH_TR = { line: 'düz', wave: 'dalgalı', zigzag: 'zikzak', arc: 'hilal biçimli', segments: 'parçalı, kademeli' };
function trenchShape(A) {
  if (!A || !A.cmd) return pick(["line", 'line', 'wave']);
  if (A.ww) return pick(['zigzag', "zigzag", 'line', 'wave']);
  const i = A.cmd.stats.int + rnd(-2, 2), n = Math.max(1, A.members.length);
  const arch = ((A.nArch || 0) + (A.nArt || 0)) / n;
  const F=(A.cp && A.cp.foe) || A.foeArmy || (A.manual ? nearestFoeArmy(A) : null);
  const fcav = F && F.members.length ? (F.nCav || 0) / F.members.length : 0;
  const opts = ['line', 'line'];
  if (i < 4) opts.push('line', 'segments');
  if (i >= 5) opts.push('wave', 'arc');
  if (i >= 6.5) opts.push('arc', 'zigzag', 'segments');
  if (arch > 0.3) opts.push("segments", 'segments');
  if (fcav > 0.25) opts.push('zigzag', 'zigzag', 'arc');
  if (n > 50) opts.push("segments");
  return pick(opts);
}
function newTrench(k, x, y, a, len, shape) {
  return { k, x, y, a, len, prog: 0, until: Sim.tick + CFG.year * 4, shape, p1: rnd(0, 6.28), p2: rnd(0, 6.28), waves: rnd(1.5, 3) };
}
const trenchOk = (x, y, a, len) => {
  const ca = Math.cos(a + Math.PI / 2), sa = Math.sin(a + Math.PI / 2);
  for (let t = -0.5; t <= 0.5; t += 0.25) if (!speedAt(x + ca * len * t, y + sa * len * t)) return false;
  return true;
};

function digTrench(k, x, y, a, len, A)
{
  const shape = trenchShape(A);
  if (shape === 'segments') {
    const n = clamp(Math.round(len / 30), 3, 6), step = len / n, grp = [];
    const ca=Math.cos(a + Math.PI / 2), sa = Math.sin(a + Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const along = (i - (n - 1) / 2) * step, back=(i % 2 ? -7 : 0) + rnd(-2, 2), aa = a + rnd(-0.18, 0.18);
      const sx = x + ca * along - Math.cos(a) * back, sy = y + sa * along - Math.sin(a) * back, sl = step * rnd(0.6, 0.78);
       if (!trenchOk(sx, sy, aa, sl)) continue;
      const tr = newTrench(k, sx, sy, aa, sl, 'line');
      tr.grp = grp; grp.push(tr); Sim.trenches.push(tr);
    }
    return grp[0] || null;
  }
  if (!trenchOk(x, y, a, len)) return null;
  const tr=newTrench(k, x, y, a, len, shape);
  if (A && A.ww) tr.ww = true;
  Sim.trenches.push(tr);
  return tr;
}
function trenchOff(tr, al) {
  let o = Math.sin(al * 0.09 + (tr.p1 || 0)) * 1.3 + Math.sin(al * 0.23 + (tr.p2 || 0)) * 0.6;
  const u = al / (tr.len / 2);
  if (tr.shape === 'wave') o += Math.sin(u * Math.PI * (tr.waves || 2) + (tr.p1 || 0)) * 5;
  else if (tr.shape === 'zigzag') { const ph = ((al / 13 + (tr.p1 || 0)) % 2 + 2) % 2; o += (ph < 1 ? ph : 2 - ph) * 10 - 5; }
  else if (tr.shape === 'arc') o += u * u * 14;
  return o;
}
function trenchDist(tr, x, y) {
  const dx = x - tr.x, dy = y - tr.y, ca = Math.cos(tr.a), sa = Math.sin(tr.a);
  const along = -dx * sa + dy * ca, across = dx * ca + dy * sa;
  return [along, across - trenchOff(tr, along)];

}
function inTrench(p) {
  if (p._itT === Sim.tick && p._itX === p.x && p._itY === p.y) return p._it;
  let v = false;
  for (const tr of Sim.trenches) {
    if ((tr.prog < 1 && !(tr.sap && tr.prog >= 0.3)) || tr.k !== p.k) continue;
    const [al, ac] = trenchDist(tr, p.x, p.y);
    if (Math.abs(al) < tr.len / 2 + 4 && (tr.sap ? Math.abs(ac) < 11 : ac < 4 && ac > -26)) { v = true; break; }
  }
  p._itT = Sim.tick; p._itX = p.x; p._itY = p.y; p._it=v;
  return v;
}
const inLine = (A, q) => q !== A.cmd && q.job !== 'tank' && q.job !== 'medic' && (bj(q) !== 'artillery' || q.job === "mg");
function trenchSlot(A, p) {
  const tr = A.trench;
  if (!A.ww || !tr || tr === true || tr.grp || tr.prog < 1 || !Sim.trenches.includes(tr) || !inLine(A, p)) return null;
  let tl = A._tl;
  if (!tl || tl.t !== Sim.tick) { tl = A._tl = { t: Sim.tick, m: new Map(), n: 0 }; for (const q of A.members) if (inLine(A, q)) tl.m.set(q, tl.n++); }
  const j = tl.m.get(p);
  if (j == null) return null;
  const ca = Math.cos(tr.a + Math.PI / 2), sa = Math.sin(tr.a + Math.PI / 2), cd=Math.cos(tr.a), sd = Math.sin(tr.a);
  const at=(al, o) => { const f = trenchOff(tr, al) + o; return { x: tr.x + ca * al + cd * f, y: tr.y + sa * al + sd * f, a: tr.a }; };

  if (p.job === 'sapper') {
    const s = A.saps && A.saps[A.saps.length - 1];
    if (s && s.prog < 1 && Sim.trenches.includes(s)) return { x: s.x + (p.id % 5 - 2) * 1.6, y: s.y + ((p.id >> 2) % 5 - 2) * 1.6, a: Math.atan2(s.end.y - s.y, s.end.x - s.x) };
    if (tr.max && tr.len < tr.max) return at((j % 2 ? 1 : -1) * (tr.len / 2 - 4), -2);
  }
   const rows = tl.n * 4.5 > tr.len ? 2 : 1, k = rows === 2 ? j >> 1 : j, per = Math.ceil(tl.n / rows);
  return at(((k + 0.5) / per - 0.5) * (tr.len - 8), rows === 2 && j & 1 ? -6 : -1.5);
}
const entrenched = F => { const tr = F.trench; return !!tr && tr !== true && tr.prog >= 1 && Sim.trenches.includes(tr); };
const foeDug = A => { if (A._fdT>Sim.tick - 30) return A._fd; A._fdT = Sim.tick; const F = nearestFoeArmy(A); return (A._fd = !!(F && entrenched(F))); };
function artPrep(A, o, c)
{
  const F = nearestFoeArmy(A);
  if (!F || !F.cmd || dist2(c, F.cmd) > 290 * 290) return false;
  if (!entrenched(F)) { o.prepDone = true; return false; }
  if (!o.prepT) {
    o.prepT = Sim.tick; say(c, "💥", 150);
    chron(lang`💥 ${A.k.name} komutanı ${rankName(c)} siperdeki ${F.k.name} askerlerini topçu hazırlığıyla dövdürüyor; piyade ateş kesilene kadar bekliyor`, A.k, F.k);
  }
  A.barrageT = Sim.tick + 10;
  if (Sim.tick - o.prepT<480) return true;
  o.prepDone=true; A.barrageT = Sim.tick + 400; say(c, "📯", 150);
  chron(lang`📯 ${A.k.name} topçu hazırlığı bitti: düdükler çaldı, piyade siperdeki düşmana hücuma kalktı, toplar ateşi sürdürüyor`, A.k, F.k);
  return false;
}
function wwLead(A, o, c) {
  if (!o.sapChk) {
    o.sapChk = true;
    const F=!o.sapN && nearestFoeArmy(A), sap=F && sapRoute(A, F);
    if (sap) {
      const end = o.path[o.path.length - 1], se = sap[sap.length - 1];
      if (dist(se, end) < dist(sap[0], end) - 40) { o.path = [...sap, ...resample([se, end], 18).slice(1)]; o.i = 0; o.sapN = sap.length; }
    }
  }

  if (o.sapN && o.i < o.sapN) return false;
  if (o.sapN && !o.sapOut) {
    o.sapAt = o.sapAt || Sim.tick;
    let n = 0, m = 0;
    for (const q of A.members) if (inLine(A, q)) { m++; if (dist2(q, c) < 70 * 70) n++; }
    if (n < m * 0.6 && Sim.tick - o.sapAt < 400) return true;

    o.sapOut = true; say(c, '📯', 150);
    const F = (A.cp && A.cp.foe) || nearestFoeArmy(A);
    chron(lang`📯 ${A.k.name} askerleri siper yolundan düşmanın burnunun dibine kadar eğilerek geldi; düdük çaldı, hücuma kalktılar`, A.k, F && F.k);
  }
  if (A.stopT > Sim.tick - 60) return true;
  if (A.nBomb && !o.prepDone && artPrep(A, o, c)) return true;

  const F = nearestFoeArmy(A);
  if (F && F.cmd && dist2(c, F.cmd) < 250 * 250) {
    A.order = { type: 'free', t: 0, idle: 0, foe: F, cp: o.cp };
    say(c, '⚔️', 120)
    return true;
  }
  return false;
}
function sapRoute(A, F) {
  const tr = A.trench;
  if (!A.ww || !tr || tr === true || !A.saps) return null;
  const done = A.saps.filter(s => s.prog >= 1 && Sim.trenches.includes(s));
  if (!done.length) return null;
  const pts = [{ x: tr.x, y: tr.y }, ...done.map(s => s.end)], e = pts[pts.length - 1];
  if (dist(e, F.cmd)>dist(pts[0], F.cmd) - 50) return null;
  return resample(pts, 14);
}
function trenchSlow(p, x, y) {
  if (p.job === 'tank') return 1;
  for (const tr of Sim.trenches) {
    if (tr.prog < 0.5 || tr.k === p.k || !hostile(p.k, tr.k)) continue;
    const [al, ac] = trenchDist(tr, x, y);
    if (Math.abs(al) < tr.len / 2 && Math.abs(ac) < 5) return 0.35;
  }
  return 1;
}
function frontHalf(A, melee)
{
  if (A.form === 'line') return meleeCols(A, melee) * 3.5;
  if (A.form === 'crescent') return (25 + melee * 1.2) * 0.93;
  if (A.form === 'squares') return Math.ceil(melee / 9) * 15;
  if (A.form === 'phalanx') return phalanxCols(melee) * 2.75;
  if (A.form==='shieldwall') return Math.ceil(melee / wallRows(melee)) * 2.5;
  if (A.form === 'testudo') return Math.ceil(Math.sqrt(melee)) * 2.25;
  if (A.form === 'wedge') return Math.ceil(Math.sqrt(melee)) * 5.5;
  if (A.form === 'schiltron') return ringR(melee) + 6;
  if (A.form === 'column') return 12;
  if (A.form === "skirmish") return Math.ceil(melee / 2) * 6.5;
  if (A.form === 'echelon') return Math.ceil(melee / 6) * 12 + 8;
  if (A.form === 'checker') return Math.ceil(melee / 9) * 11 + 6;
  return 35;
}
const meleeCount = A => Math.max(1, A.members.length - (A.nArch || 0) - (A.nCav || 0) - (A.nArt || 0) - (A.nMed || 0) - 1);

function defendTrench(A)
{
  const h = A.k.capital;
  if (!h || A.t < 60) return;
  if (A.trench && Sim.trenches.includes(A.trench) && A.post) return;

  const E = A.enemy.capital || kSettlements(A.enemy)[0];
  if (!E) return;
  const a = Math.atan2(E.y - h.y, E.x - h.x), d = (h.walls ? h.walls.r : h.r) + 45;
  const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;

  const tr = digTrench(A.k, x, y, a, frontHalf(A, meleeCount(A)) * 2 + 30, A);

  if (!tr) return;
  A.trench = tr; A.post = { x: x - Math.cos(a) * 10, y: y - Math.sin(a) * 10, a };
  say(A.cmd, '⛏', 150);
  chron(lang`⛏ ${A.k.name} ordusu ${h.name} önüne hendek kazıyor`, A.k, A.enemy, h);
}
function trenchWork(A) {
  const tr = A.trench;
  if (!tr || !Sim.trenches.includes(tr)) return;
  if (dist2(A.cmd, tr)>120 * 120) return;
  const liste = tr.grp || [tr];
  if (A.state === 'battle' && tr.prog >= 1) {
    if (A.ww) for (const t of [...liste, ...(A.saps || [])]) t.until = Math.max(t.until, Sim.tick + CFG.year * 2);
    return;
  }
  for (const t of liste) t.until = Math.max(t.until, Sim.tick + CFG.year * 2);
  if (A.nSap) sapWork(A);
  if (liste.every(t => t.prog >= 1)) return;
  let diggers = 0;
  for (const p of A.members) if (digger(p) && dist2(p, tr) < 110 * 110) diggers += p.job === 'sapper' ? 4 : 1;
  for (const t of liste) t.prog = Math.min(1, t.prog + diggers * 0.0007 * (liste.length > 1 ? 1.4 : 1));
  if (Math.random() < 0.15 && A.members.length) say(pick(A.members), '⛏', 50);
}
function sapWork(A)
{
  const tr=A.trench, o = A.order;
  if (!tr || tr === true || tr.grp || tr.prog < 1 || A.battle || !o || o.type !== 'hold' || (Sim.tick / 5 + A.id) % 8) return;
  const n = A.nSap, saps = A.saps || (A.saps = []);
  for (const s of saps) s.until = Math.max(s.until, Sim.tick + CFG.year * 2);
  tr.base = tr.base || tr.len;
  if (!tr.max) { let m = 0; for (const q of A.members) if (inLine(A, q)) m++; tr.max = Math.min(tr.base * 1.8, Math.max(tr.base + 40, m * 5.5 + 40)); }
  if (tr.len<tr.max) { tr.len = Math.min(tr.max, tr.len + 3 * n); return; }
  const son = saps[saps.length - 1];
  if (son && Sim.trenches.includes(son) && son.prog < 1) { son.prog = Math.min(1, son.prog + 0.06 * n); return; }
  const F = nearestFoeArmy(A);
  if (!F || saps.length >= 9) return;
  const from = son ? son.end : { x: tr.x, y: tr.y };
  if (dist2(from, F.cmd) < 165 * 165) return;
  const th = Math.atan2(F.cmd.y - from.y, F.cmd.x - from.x) + (saps.length % 2 ? 0.45 : -0.45), L = 30;
  const bitis = { x: from.x + Math.cos(th) * L, y: from.y + Math.sin(th) * L };
  if (!speedAt(bitis.x, bitis.y)) return;
  const s = newTrench(A.k, (from.x + bitis.x) / 2, (from.y + bitis.y) / 2, th - Math.PI / 2, L + 4, 'line');
  s.sap=true; s.end = bitis;
  Sim.trenches.push(s); saps.push(s);
  if (saps.length===1) { say(A.cmd, '⛏', 150); chron(lang`⛏ ${A.k.name} hendekçileri hattı uzattı, şimdi düşmana doğru zikzak bir siper yolu kazıyor`, A.k); }
}
function holdTrench(A, o)
{
  if (o.trench || o.t < 40) return;
  const cd = Math.cos(o.dir), sd = Math.sin(o.dir);
  let uzunluk = frontHalf(A, meleeCount(A)) * 2 + 24;
  if (A.ww) uzunluk = Math.max(uzunluk, A.members.filter(q => inLine(A, q)).length * 2.6 + 24);
  o.trench = A.trench = digTrench(A.k, o.x + cd * 9, o.y + sd * 9, o.dir, uzunluk, A) || true;
  if (A.trench && A.trench !== true && A.cmd) plog(A.cmd, lang`${TRENCH_TR[A.trench.grp ? 'segments' : A.trench.shape] || lang('düz')} hendek kazdırdı`);
}

function tryAmbush(A, O) {
  if (A.manual || A.noAmb || A.members.length < 6 || A.cmd.stats.int + rnd(-2, 2) < 6) return false;
  const ss = kSettlements(A.k);
  if (!ss.length) return false;
  const s = ss.reduce((a, b) => dist2(a, O.cmd) < dist2(b, O.cmd) ? a : b);
  const cover = A.k.R.home === 'hills' ? [T_FOREST, T_HILLS] : [T_FOREST];
   for (let i = 0; i < 50; i++) {
    const t = rnd(0.25, 0.65), x = s.x + (O.cmd.x - s.x) * t + rnd(-80, 80), y = s.y + (O.cmd.y - s.y) * t + rnd(-80, 80);
    if (!cover.includes(terrainAt(x, y)) || dist2({ x, y }, O.cmd) < 220 * 220 || dist2({ x, y }, s) < (s.r + 60) ** 2) continue;

    A.state = 'ambush'; A.ambush = { x, y, set: false }; A.foeArmy = O; A.t = 0; A.path = null;

    plog(A.cmd, lang`${O.k.name} ordusuna pusu kurdu`)
    chron(lang`🌲 ${A.k.name} komutanı ${fullName(A.cmd)}, yaklaşan ${O.k.name} ordusuna ${terrainAt(x, y) === T_FOREST ? lang('ormanda') : lang('tepelerde')} pusu kuruyor`, A.k, O.k);
    return true;
  }
  A.noAmb = true;
  return false;
}
function ambushTick(A) {
  const O = A.foeArmy;
  if (!O || !O.members.length || O.state === "retreat" || !O.k.armies.includes(O) || A.t > 3000) {
    A.state = 'defend'; A.foeArmy = null; A.ambush = null; A.t = 0; A.noAmb=true; return;
  }
  if (O.state === 'battle' || O.state === 'assault') { A.state = 'intercept'; A.ambush = null; A.t = 0; return; }
  const set = dist2(A.cmd, A.ambush) < 40 * 40;
  if (set && !A.ambush.set) { A.ambush.set = true; say(A.cmd, '🤫', 200); }
  if (dist2(A.cmd, O.cmd) < 150 * 150 || (set && O.members.some(q => dist2(q, A.cmd) < 110 * 110))) springAmbush(A, O);
}
function springAmbush(A, O) {
   const hidden = A.ambush && A.ambush.set;

  A.ambush = null; A.noAmb = true;
  startBattle(A, O);
  if (!hidden || !A.battle) return;
  A.battle.ambush = A;
  say(A.cmd, '⚔️', 150);
  chron(lang`🌲 PUSU! ${A.k.name} askerleri ağaçların arasından ${O.k.name} ordusunun üstüne çullandı. Düzen kuramadan yakalandılar`, A.k, O.k, A.battle.place)
}
const hiddenIn = p => p.hid || (p.army && ((p.army.state === 'ambush' && p.army.ambush && p.army.ambush.set) || (p.army.cp && p.army.cp.hidden)));

const HID_SPOT = 22, HID_SEARCH = 60;
function concealTick(g) {
  for (const A of allArmies()) A.hidN = 0;
  for (const p of Sim.people) {
    if (p.dead) continue;
    if (!p.army) { p.hid = false; continue; }
    const hareketli = p.hx == null ? 99 : Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy);
    p.hx = p.x; p.hy = p.y;
    p.still = hareketli < 4 ? (p.still || 0) + 10 : 0;
    let hid = terrainAt(p.x, p.y) === T_FOREST && p.still >= 60 && Sim.tick - (p.loud || -1e9) > 150 && p.army.state !== 'sail';

    if (hid) near(g, p.x, p.y, HID_SEARCH, q => {
      if (!hid || q.dead || !q.army || !hostile(p.k, q.k)) return;
      const r = q.army.searching ? HID_SEARCH : HID_SPOT;
      if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < r * r) { hid = false; p.loud = Sim.tick - 60; }

    });
    if (hid && !p.hid && p.army.cmd === p) say(p, '🤫', 80);
    p.hid = hid;
    if (hid) p.army.hidN = (p.army.hidN || 0) + 1;
  }
  for (const A of allArmies()) A.hidFrac = A.members.length ? (A.hidN || 0) / A.members.length : 0;
}

function trenchTick()
{
  if (Sim.trenches.length) Sim.trenches = Sim.trenches.filter(tr => tr.until > Sim.tick);
}

function drawTrenches(ctx, vis)
{
  for (const tr of Sim.trenches) {
    if (!vis(tr)) continue;
    const ca = Math.cos(tr.a + Math.PI / 2), sa = Math.sin(tr.a + Math.PI / 2), cd = Math.cos(tr.a), sd = Math.sin(tr.a), h = tr.len / 2 * Math.min(1, tr.prog + 0.05);
    const yol = (fwd) => { ctx.beginPath(); for (let al = -h, i = 0; al <= h + 0.01; al += Math.min(3, h), i++) { const o = trenchOff(tr, al) + fwd, x = tr.x + ca * al + cd * o, y = tr.y + sa * al + sd * o; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tr.sap) { ctx.strokeStyle='rgba(150,115,70,0.8)'; ctx.lineWidth=8; yol(0); ctx.strokeStyle='rgba(55,38,22,0.92)'; ctx.lineWidth = 5; yol(0); }
    else if (tr.ww) {
      ctx.strokeStyle = 'rgba(150,115,70,0.9)'; ctx.lineWidth = 3.5; yol(4.5);
      ctx.strokeStyle = 'rgba(55,38,22,0.92)'; ctx.lineWidth = 8.5; yol(-3);
      ctx.strokeStyle = "rgba(196,180,140,0.9)"; ctx.lineWidth = 1.2; ctx.setLineDash([2.2, 1.2]); yol(4.5); ctx.setLineDash([]);
    } else {
      ctx.strokeStyle='rgba(150,115,70,0.9)'; ctx.lineWidth = 3; yol(3.5);
      ctx.strokeStyle='rgba(55,38,22,0.92)'; ctx.lineWidth = 4; yol(0);
    }
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }

}
function drawShells(ctx)
{
  for (const a of Sim.arrows) {
    if (!a.shell) continue;
    const t = a.t / a.T, x = a.x0 + (a.tx - a.x0) * t, y = a.y0 + (a.ty - a.y0) * t;
    if (a.kind === "rocket") {
      const aci = Math.atan2(a.ty - a.y0, a.tx - a.x0), hgt = Math.sin(t * Math.PI) * 20;
      ctx.strokeStyle = 'rgba(200,200,195,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y - hgt); ctx.lineTo(x - Math.cos(aci) * 12, y - hgt - Math.sin(aci) * 12 + 2); ctx.stroke();

      ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.arc(x, y - hgt, 1.4, 0, 7); ctx.fill();
      continue;
    }

    const hgt = a.kind === 'tank' ? 0 : Math.sin(t * Math.PI) * (a.kind === 'mortar' ? 70 : Math.min(45, a.T * 0.8));
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
    ctx.fillStyle = a.cannon ? '#1d1d1d' : '#7a7068'; ctx.beginPath(); ctx.arc(x, y - hgt, a.cannon ? 1.8 : 2.3, 0, 7); ctx.fill();
  }
}
function drawMount(ctx, f, U)
{
  const R = 3.2 * U, wolf = f.mount === "wolf";
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0.5, 1, 2.4 * R, 1.05 * R, 0, 0, 7); ctx.fill();
  ctx.fillStyle = wolf ? "#6d6a66" : f.horse;
  ctx.beginPath(); ctx.ellipse(-0.3 * R, 0, 2.2 * R, 0.95 * R, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(2.2 * R, 0, 0.75 * R, 0.42 * R, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = wolf ? '#4a4744' : '#2e1f14'; ctx.lineWidth = 0.4 * R;
  ctx.beginPath(); ctx.moveTo(-2.4 * R, 0); ctx.lineTo(-3.1 * R, wolf ? 0.5 * R : 0); ctx.stroke();
  if (!wolf) { ctx.strokeStyle = '#2e1f14'; ctx.lineWidth = 0.25 * R; ctx.beginPath(); ctx.moveTo(0.4 * R, 0); ctx.lineTo(1.7 * R, 0); ctx.stroke(); }
  if (f.job === 'knight') {
    ctx.fillStyle = f.ring; ctx.beginPath(); ctx.ellipse(-0.3 * R, 0, 2.05 * R, 0.98 * R, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8bec4'; ctx.beginPath(); ctx.ellipse(2.2 * R, 0, 0.62 * R, 0.34 * R, 0, 0, 7); ctx.fill();
  } else ctx.fillStyle = f.ring, ctx.fillRect(-1.1 * R, -0.95 * R, 1.3 * R, 1.9 * R);
}

function drawTank(ctx, f, U)
{
  const R = 3.2 * U;
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(-2.3 * R, -1.45 * R, 4.9 * R, 3.1 * R);
  ctx.fillStyle = '#2a2a26'; ctx.fillRect(-2.4 * R, -1.55 * R, 4.8 * R, 0.62 * R); ctx.fillRect(-2.4 * R, 0.93 * R, 4.8 * R, 0.62 * R);
  ctx.fillStyle=mixHex('#55603f', f.ring, 0.35); ctx.fillRect(-2.2 * R, -1.0 * R, 4.4 * R, 2.0 * R);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.12 * R; ctx.strokeRect(-2.2 * R, -1.0 * R, 4.4 * R, 2.0 * R);
  ctx.fillStyle = '#2f3524'; ctx.fillRect(0.6 * R, -0.18 * R, 2.9 * R, 0.36 * R);
  ctx.fillStyle = mixHex('#4a5436', f.ring, 0.3); ctx.beginPath(); ctx.arc(-0.1 * R, 0, 0.95 * R, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = f.ring; ctx.fillRect(-0.45 * R, -0.25 * R, 0.5 * R, 0.5 * R);
}
function drawGun(ctx, f, U) {
  const R=3.2 * U;
  ctx.save(); ctx.translate(2.6 * R, 0);
  if (f.job==='fieldgun') {
    ctx.fillStyle = '#3b2a1a'; ctx.fillRect(-1.25 * R, -1.25 * R, 0.45 * R, 2.5 * R);
    ctx.strokeStyle = "#2b1d10"; ctx.lineWidth = 0.22 * R;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-1.03 * R, s * 1.15 * R, 0.75 * R, 0.2 * R, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#5a4630'; ctx.fillRect(-3 * R, -0.18 * R, 1.4 * R, 0.36 * R);
    ctx.fillStyle='#3d4436'; ctx.fillRect(-1.7 * R, -0.3 * R, 4.1 * R, 0.6 * R);
    ctx.fillStyle = '#23271f'; ctx.fillRect(2.3 * R, -0.36 * R, 0.35 * R, 0.72 * R);
  } else if (f.job === 'gatling') {
     ctx.fillStyle = '#2b1d10'; for (const s of [-1, 1]) ctx.fillRect(-1.3 * R, s * R - 0.14 * R, 1.1 * R, 0.28 * R);
    ctx.fillStyle = '#5a4630'; ctx.fillRect(-2.5 * R, -0.15 * R, 1.6 * R, 0.3 * R);
    ctx.fillStyle = '#b08d3c'; ctx.fillRect(-0.95 * R, -0.6 * R, 1.15 * R, 1.2 * R);
    ctx.fillStyle = '#1e1e1e'; for (const o of [-0.34, 0, 0.34]) ctx.fillRect(0.2 * R, (o - 0.1) * R, 2.3 * R, 0.2 * R);
  } else if (f.job==="mg") {
    ctx.strokeStyle='#2b2b2b'; ctx.lineWidth = 0.16 * R; ctx.beginPath();
    for (const a of [2.3, -2.3, Math.PI]) { ctx.moveTo(-0.6 * R, 0); ctx.lineTo(-0.6 * R + Math.cos(a) * 0.9 * R, Math.sin(a) * 0.9 * R); } ctx.stroke();

    ctx.fillStyle = "#3c4430"; ctx.fillRect(-0.9 * R, -0.28 * R, 2.4 * R, 0.56 * R);
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(1.5 * R, -0.12 * R, 0.9 * R, 0.24 * R);
  } else if (f.job === 'mortar') {
    ctx.fillStyle = '#4a4a44'; ctx.fillRect(-1.1 * R, -0.75 * R, 1.1 * R, 1.5 * R);
    ctx.fillStyle = "#2f3524"; ctx.fillRect(-0.4 * R, -0.3 * R, 1.6 * R, 0.6 * R);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(1.25 * R, 0, 0.32 * R, 0, 7); ctx.fill();
  } else if (f.job === "rocket") {
    ctx.fillStyle = '#2b2b26'; for (const s of [-1, 1]) ctx.fillRect(-1.4 * R, s * 1.05 * R - 0.15 * R, 1.2 * R, 0.3 * R);
    ctx.fillStyle = '#4a5436'; ctx.fillRect(-1.6 * R, -0.9 * R, 3.4 * R, 1.8 * R);
    ctx.fillStyle = "#9a3a20"; for (let i = -2; i <= 2; i++) ctx.fillRect(-1.3 * R, i * 0.32 * R - 0.1 * R, 3.0 * R, 0.2 * R);
  } else if (f.gun) {
    ctx.fillStyle = '#4a3220'; ctx.fillRect(-1.2 * R, -1.1 * R, 0.9 * R, 2.2 * R);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-1.6 * R, -0.42 * R, 3.6 * R, 0.84 * R);

    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(2 * R, 0, 0.42 * R, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = "#7b5a3a"; ctx.fillRect(-1.4 * R, -1.1 * R, 2.8 * R, 0.4 * R); ctx.fillRect(-1.4 * R, 0.7 * R, 2.8 * R, 0.4 * R);
    ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 0.4 * R; ctx.beginPath(); ctx.moveTo(-1 * R, 0); ctx.lineTo(1.9 * R, 0); ctx.stroke();
    ctx.fillStyle = '#6a6460'; ctx.beginPath(); ctx.arc(-1.1 * R, 0, 0.45 * R, 0, 7); ctx.fill();
  }
  ctx.restore();

}

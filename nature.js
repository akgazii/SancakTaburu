const SEASONS = [
  { name: 'İlkbahar', icon: '🌱', farm: 1.1, farmSlow: 1.0 }, { name: "Yaz", icon: '☀️', farm: 1.3, farmSlow: 1.1 },
  { name: 'Sonbahar', icon: '🍂', farm: 1, farmSlow: 0.95 }, { name: 'Kış', icon: '❄️', farm: 0.35, farmSlow: 0.7 },
];
const SEASON_SLOW=20;
const seasonLen = () => Sim.camp ? CFG.year : CFG.year * SEASON_SLOW;
const seasonFarm = () => Sim.camp ? season().farm : season().farmSlow;
const WX_T = [0.125, 0.375, 0.62, 0.88];
const yearT=() => Sim.wx && Sim.wx.season != null ? WX_T[Sim.wx.season] : (Sim.tick % seasonLen()) / seasonLen();
const season = () => SEASONS[yearT() * 4 | 0];
const bump=(t, c, wd) => Math.max(0, 1 - Math.abs(((t - c + 1.5) % 1) - 0.5) / wd);
const snowAmt = () => bump(yearT(), 0.88, 0.16);
const fallAmt = () => bump(yearT(), 0.62, 0.13);

function buildSeasonImgs() {
  const { cols: sutunlar, rows: satirlar } = CFG, mk = () => { const c = document.createElement('canvas'); c.width = sutunlar; c.height = satirlar; return c; };
  const snow = mk(), fall = mk(), sd = snow.getContext('2d').createImageData(sutunlar, satirlar), fd = fall.getContext('2d').createImageData(sutunlar, satirlar);
  for (let i = 0; i < sutunlar * satirlar; i++) {
    const t = Sim.terrain[i];
    if (t >= T_BEACH && t !== T_SNOW) sd.data.set([240, 245, 255, t === T_FOREST ? 150 : t === T_BEACH ? 110 : 215], i * 4);

    if (t === T_FOREST || t === T_GRASS) fd.data.set(t === T_FOREST ? [195, 90, 30, 170] : [205, 155, 60, 100], i * 4);
  }
  snow.getContext('2d').putImageData(sd, 0, 0); fall.getContext('2d').putImageData(fd, 0, 0);
  Sim.snowImg = snow; Sim.fallImg = fall;

}

const MON = {
  wolf: { name: 'Kurt', hp: 28, dmg: 4, speed: 1.05, fly: false },
  dragon: { name: 'Ejderha', hp: 450, dmg: 16, speed: 1.6, fly: true },
  bandit: { name: 'Haydut', hp: 35, dmg: 5, speed: 1, fly: false },
  deer: { name: 'Geyik', hp: 14, dmg: 0, speed: 1.15, fly: false },
};
const DRAGON_COLORS = [['Kızıl', '#b3261e'], ["Kara", "#2b2b33"], ['Altın', "#c9a227"], ['Yeşil', '#2f7d32'], ['Mavi', '#2c5aa0']];
const DSTATE = { sleep: "💤 İninde uyuyor", fly: '🪽 Uçuyor', attack: '🔥 Saldırıyor', return: '🪽 İnine dönüyor' };

function makeMonster(tur, x, y, o = {}) {
  const D = MON[tur];
  const m = { id: Sim.nextMon++, mon: true, type: tur, x, y, a: rnd(0, 6.28), hp: D.hp, max: D.hp, lair: { x, y }, state: "idle", t: 0, kills: 0, ...o };
  Sim.monsters.push(m);
  return m;
}

function spawnWolves(yakin) {
  for (let i = 0; i < 200; i++) {
    const c = rnd(5, CFG.cols - 5) | 0, r = rnd(5, CFG.rows - 5) | 0;
    if (Sim.terrain[r * CFG.cols + c] !== T_FOREST) continue;
    const x = (c + 0.5) * CFG.tile, y = (r + 0.5) * CFG.tile;
    if (Sim.settlements.some(s => dist2(s, { x, y }) < 260 * 260)) continue;
    if (yakin && dist2(yakin, { x, y }) > 700 * 700 && i < 150) continue;
    const lair = { x, y }, n = rnd(3, 6) | 0;
    for (let j = 0; j < n; j++) makeMonster('wolf', x + rnd(-6, 6), y + rnd(-6, 6), { lair });
    return lair;
  }
  return null;
}

function spawnDragon(targetK)
{
  for (let i = 0; i < 400; i++) {
    const c = rnd(3, CFG.cols - 3) | 0, r = rnd(3, CFG.rows - 3) | 0, t = Sim.terrain[r * CFG.cols + c];
    if (t !== T_MOUNT && t !== T_SNOW && i < 300) continue;
    if (t<T_BEACH) continue;
    const [adj, renk] = pick(DRAGON_COLORS), name = lang`${adj} ${makeName('dragon')}`;
    const m = makeMonster("dragon", (c + 0.5) * CFG.tile, (r + 0.5) * CFG.tile, { name, color: renk, state: 'sleep', t: targetK ? 30 : CFG.year, pref: targetK, burned: 0 });
    chron(lang`🐉 Dağlarda bir ejderha yuva yaptı: ${name}. Halk korku içinde`);
    return m;
  }
  return null;

}

function monStep(m, tx, ty, mult)
{
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
  if (d < 3) return true;
  const sp = Math.min(d, MON[m.type].speed * mult), a0 = Math.atan2(dy, dx), fly = MON[m.type].fly;
  for (const turn of fly ? [0] : TURNS) {
    const a = a0 + turn, nx = m.x + Math.cos(a) * sp, ny = m.y + Math.sin(a) * sp;
    if (fly || speedAt(nx, ny)) { m.x = nx; m.y = ny; m.a = a; return false; }
  }
  m.a = a0; m.t -= 20;
  return false;
}

function hurtPerson(m, p, dmg, sebep) {
  p.hp -= dmg / (0.6 + p.stats.end * 0.08);
  Sim.fx.push({ x: p.x, y: p.y, t: 8, type: 'hit' });
  if (p.hp > 0) return;
  m.kills++;
  kill(p, null, sebep);
  const how = { wolf: lang('🐺 kurtlar tarafından parçalandı'), dragon: lang`🐉 ejderha ${m.name} tarafından yakıldı`, bandit: lang`🏴 ${m.camp && m.camp.name} haydutlarınca öldürüldü` }[m.type];
  if (p.s && !p.s.dead) slog(p.s, lang`${fullName(p)} ${how}`);
}

function hurtMonster(m, dmg, by)
{
  if (m.dead) return;
  m.hp -= dmg;
  if (m.type === 'deer') {
    if (m.hp > 0) { m.threat = by; return; }
    m.dead = true;

    if (by && by.stats) by.meat = 30;

    return;
  }
  if (by && by.stats) m.prey = by;
  if (m.hp>0) return;
  m.dead = true;

  if (m.type === 'bandit') return banditDown(m, by);
  Sim.fx.push({ x: m.x, y: m.y, t: 30, type: 'boom' });
  if (!by || !by.stats) return;
  by.beasts = (by.beasts || 0) + 1;
  plog(by, lang`bir ${m.type === 'dragon' ? lang`ejderhayı (${m.name})` : 'kurdu'} öldürdü`);
  if (m.type === 'dragon') {
    by.legend = lang`Ejderha ${m.name} avcısı`;
    by.k.gold += 400; by.gold += 100;
    if (!Sim.hall.includes(by)) Sim.hall.push(by);
    chron(lang`🐉⚔ Ejderha ${m.name} öldürüldü! Son darbeyi ${fullName(by)} (${by.k.name}) vurdu ve efsane oldu. Ejderhanın hazinesi (400 altın) ${by.k.name} hazinesine geçti`, by.k);
  }
}

const ARENA_HUNT = Math.hypot(W, H);
function arenaPrey(m, maxD, ok) {
  let fd = maxD * maxD, f = null;
  for (const q of Sim.people) {
    if (q.dead || q.state === 'jailed' || (q.army && q.army.state === 'sail') || (ok && !ok(q))) continue;
    const d = dist2(m, q);

    if (d < fd) { fd = d; f = q; }
  }
  return f;
}

function wolfAI(m) {
   const f = m.prey;
  if (f && !f.dead && f.state !== "jailed" && (Sim.arena ? dist2(m, f) < ARENA_HUNT ** 2 : dist2(m, f) < 150 * 150 && dist2(m, m.lair) < 340 * 340)) {
    if (dist2(m, f) < 36) {
      if ((Sim.tick + m.id) % 20 === 0) { if (f.mon) hurtMonster(f, 20, null); else hurtPerson(m, f, MON.wolf.dmg * rnd(0.6, 1.4), lang('kurt saldırısı')); }
    } else monStep(m, f.x, f.y, f.mon ? 1.35 : 1.15);
    return;
  }
  m.prey = null;
  if ((Sim.tick + m.id) % 30 === 0 && Sim.grid) {
    let fd = 80 * 80;
    for (const o of Sim.monsters) if (o.type === 'deer' && !o.dead) { const d = dist2(m, o); if (d < 110 * 110 && d * 0.5 < fd) { fd = d * 0.5; m.prey=o; } }
    if (Sim.arena && !m.prey) m.prey = arenaPrey(m, ARENA_HUNT);
    else near(Sim.grid, m.x, m.y, 80, q => {
      if (q.dead || q.state === 'jailed' || (q.army && q.army.state === 'sail')) return;
      if (Sim.settlements.some(s => dist2(q, s) < (s.r + 25) ** 2)) return;
      const d = dist2(m, q);
      if (d < fd) { fd = d; m.prey = q; }
    });
    if (m.prey) return;
  }
  if (!m.tgt || --m.t < 0 || monStep(m, m.tgt.x, m.tgt.y, 0.5)) {
    const a = rnd(0, 6.28), d = rnd(0, 60);
    m.tgt = { x: m.lair.x + Math.cos(a) * d, y: m.lair.y + Math.sin(a) * d }; m.t = 300;
  }
}

const isArmyT = T => !!T.members;
const dragonGone = T => isArmyT(T) ? !T.members.some(p => !p.dead) || !T.k.armies.includes(T) : T.dead;
const dragonTName = T => isArmyT(T) ? lang`${T.k.name} ordusu` : T.name;
function armySpot(A) {
  let x=0, y = 0, n = 0;
  for (const p of A.members) if (!p.dead) { x += p.x; y += p.y; n++; }
  return n ? { x: x / n, y: y / n } : A.cmd || { x: 0, y: 0 };
}
function dragonSpot(m) {
  const T = m.target;
  if (!isArmyT(T)) return T;
  if (!m.spot || Sim.tick % 10 === 0) m.spot = armySpot(T);
  return m.spot;
}
function dragonRetarget(m) {
  if (!isArmyT(m.target)) return false;
  const nt = dragonTarget(m);
  if (!nt) return false;
  m.target = nt; m.spot = null;
  return true;
}

function dragonAI(m) {
  if (m.breath && --m.breath.t <= 0) m.breath=null;
  switch (m.state) {
    case 'sleep':
      m.hp = Math.min(m.max, m.hp + 0.25);
      if (--m.t > 0 || m.hp < m.max * 0.8) return;
      m.target = dragonTarget(m); m.spot = null;
      if (!m.target) { m.t = Sim.arena ? 60 : CFG.year; return; }
      m.state = 'fly'; m.pref = null;
      chron(lang`🐉 Ejderha ${m.name} uyandı ve ${dragonTName(m.target)} üzerine uçuyor!`, m.target.k, null, isArmyT(m.target) ? null : m.target);
      return;
    case 'fly': {
      const T = m.target;
      if (dragonGone(T)) { if (!dragonRetarget(m)) m.state = 'return'; return; }
      const at = dragonSpot(m);
      if (dist2(m, at) < (isArmyT(T) ? 60 : T.r + 10) ** 2) {
        m.state = 'attack';
        if (!m.cont) { m.t=0; m.raidKills = m.kills; m.raidBurn = m.burned; }

        m.cont = false;
        chron(isArmyT(T) ? lang`🔥 Ejderha ${m.name} ${T.k.name} ordusunun üstüne ateş yağdırıyor!` : lang`🔥 Ejderha ${m.name} ${T.name} şehrini ateşe veriyor!`, T.k, null, isArmyT(T) ? null : T);
      } else monStep(m, at.x, at.y, 1);
      return;
    }
    case 'attack': {
      const T = m.target, gone = dragonGone(T);
      m.t++;
      if (gone && m.t <= 400 && m.hp >= m.max * 0.4 && dragonRetarget(m)) { m.state = 'fly'; m.cont = true; return; }
      if (gone || m.t > 400 || m.hp < m.max * 0.4) {
        const why=m.hp < m.max * 0.4 ? (isArmyT(T) ? lang('okçuların oklarıyla yaralanıp') : lang("okçuların ve askerlerin direnişiyle yaralanıp")) : "doyup";
        if (isArmyT(T)) chron(lang`🐉 Ejderha ${m.name} ${gone ? lang('saldıracak ordu bulamayınca') : why} inine çekildi. Ordulardan ${m.kills - m.raidKills} ölü`, T.k);
        else if (!gone) chron(lang`🐉 Ejderha ${m.name} ${why} inine çekildi. ${T.name}: ${m.kills - m.raidKills} ölü, ${m.burned - m.raidBurn} ev yandı`, T.k, null, T);
        m.state = 'return';
        return;
      }
      const at = dragonSpot(m), a = m.t * 0.018, R = isArmyT(T) ? 30 : T.r * 0.9;
      monStep(m, at.x + Math.cos(a) * R, at.y + Math.sin(a) * R, 0.7);
      if (isArmyT(T) ? m.t % 20 === 1 : m.t % 45 === 0) breathe(m, T);
      return;
    }
    case 'return':
      if (monStep(m, m.lair.x, m.lair.y, 1)) { m.state = 'sleep'; m.t=(Sim.arena ? rnd(300, 700) : CFG.year * rnd(3, 8)) | 0; m.target = null; m.spot = null; m.cont = false; }
  }
}

function dragonTarget(m)
{
  let liste = Sim.settlements.filter(s => !s.dead), size = s => s.pop;
  if (!liste.length) {
    liste = Sim.kingdoms.flatMap(k => k.dead ? [] : k.armies.filter(A => A.members.length && A.state !== "sail"));
    size = A => A.members.length;
  }
  if (m.pref && !m.pref.dead) { const kendi = liste.filter(s => s.k === m.pref); if (kendi.length) liste = kendi; }

  if (!liste.length) return null;
  return best(liste, s => (size(s) + 10) / (300 + dist(isArmyT(s) ? armySpot(s) : s, m)));
}

function breathe(m, T) {
  if (isArmyT(T)) {
    const yasayan = T.members.filter(p => !p.dead);
    if (!yasayan.length) return;
     const q = pick(yasayan), x = q.x + rnd(-5, 5), y = q.y + rnd(-5, 5);

    m.breath = { x, y, t: 14 };
    for (let i = 0; i < 6; i++) Sim.fx.push({ x: x + rnd(-12, 12), y: y + rnd(-12, 12), t: 40, type: 'fire' });
    if (Sim.grid) near(Sim.grid, x, y, 20, o => { if (!o.dead && dist2(o, { x, y }) < 20 * 20) hurtPerson(m, o, MON.dragon.dmg * rnd(0.8, 1.6), lang('ejderha ateşi')); });
    return;
  }
  const h = T.houses.length ? pick(T.houses) : T, x = h.x + rnd(-6, 6), y = h.y + rnd(-6, 6);
  m.breath = { x, y, t: 14 };
  for (let i = 0; i < 4; i++) Sim.fx.push({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), t: 40, type: "fire" });
  if (Sim.grid) near(Sim.grid, x, y, 16, q => { if (!q.dead && dist2(q, { x, y }) < 16 * 16) hurtPerson(m, q, MON.dragon.dmg * rnd(0.5, 1.2), lang('ejderha ateşi')); });
  if (h !== T && Math.random() < 0.3) { T.houses = T.houses.filter(o => o !== h); T.cap = T.houses.length * CFG.houseCap; m.burned++; }

  for (const b in BLDG) if (T[b] && (T[b].x - x) ** 2 + (T[b].y - y) ** 2 < 200 && Math.random() < 0.3) { slog(T, lang`🔥 ${BLDG[b].name} yandı`); T[b]=null; }
  T.food = Math.max(0, T.food - 8);
}

const airborne = o => o.type === "dragon" && !!(o.target && o.target.members);
const monReach = (p, o, mesgul, fighter) => !shooter(p) && airborne(o) ? 0
  : mesgul ? (shooter(p) && o.type === 'dragon' ? 110 : 24) : fighter ? (shooter(p) ? 110 : 90) : 45;

function monsterReact(p) {
  if (p.army && p.army.state === 'sail') return false;
  const fighter = isFighter(p), mesgul = !!(p.army && p.army.state === 'battle');
  if (mesgul && !fighter) return false;
  let m = p.mfoe;
  if (m && (m.dead || (!shooter(p) && airborne(m)) || dist2(p, m) > (mesgul ? monReach(p, m, true) + 10 : fighter ? 170 : 70) ** 2)) m=p.mfoe = null;
  if (!m && (Sim.tick + p.id) % 15 === 0) {
    let fd = Infinity;
    for (const o of Sim.monsters) {
      if (o.dead || o.type === 'deer' || (o.type === 'dragon' && o.state === 'sleep')) continue;
      const d = dist2(p, o);
      if (d < fd && d < monReach(p, o, mesgul, fighter) ** 2) { fd = d; m = o; }
    }

    p.mfoe = m;
  }

  if (!m) return false;
  if (!fighter) { if (Math.random() < trait(p, "fear") * 0.6) p.flee = 80; return false; }

  const d2 = dist2(p, m);
  p.a = Math.atan2(m.y - p.y, m.x - p.x);
  if (shooter(p)) {
    const G = GUNS[p.job];
    if (d2 > 100 * 100) moveTo(p, m.x, m.y);
    else if (G ? (Sim.tick + p.id) % Math.max(8, G.reload) === 0 : (Sim.tick + p.id) % 35 === 0) {
      if (G) fireBullet(p, m, G.dmg, G.spread); else fireArrow(p, m, (2 + p.stats.spd * 0.25 + p.stats.int * 0.2) * techMul(p.k));
    }
    return true;
  }
  if (d2 < (m.type === 'dragon' ? 16 : 9) ** 2) {
    if ((Sim.tick + p.id) % 6 === 0) {
      hurtMonster(m, (1.5 + p.stats.str * 0.6) * p.R.size * rnd(0.6, 1.4) * techMul(p.k), p);
      Sim.fx.push({ x: m.x, y: m.y, t: 8, type: 'hit' });
    }
  } else moveTo(p, m.x, m.y, 1.1);
   return true;
}

function burnHouses(s, n)
{
   let burned = 0;
  for (let i = 0; i < n && s.houses.length > 1; i++) {
    const h = s.houses.splice(Math.random() * s.houses.length | 0, 1)[0];
    for (let j = 0; j < 3; j++) Sim.fx.push({ x: h.x + rnd(-6, 6), y: h.y + rnd(-6, 6), t: 40, type: 'fire' });
    burned++;
  }
  s.cap = s.houses.length * CFG.houseCap;

  return burned;
}

function townFire(s)
{
  const n = burnHouses(s, Math.max(1, Math.min(5, s.houses.length * rnd(0.1, 0.35) | 0)));
  let extra = '';
  for (const b of ['market', "granary"]) if (s[b] && Math.random() < 0.12) { s[b] = null; extra += lang`, ${BLDG[b].name.toLowerCase()} kül oldu`; }
   if (n >= 3 || extra) chron(lang`🔥 ${s.name} şehrinde büyük yangın! ${n} ev yandı${extra}`, s.k, null, s);
  else slog(s, lang`🔥 Yangın çıktı, ${n} ev yandı`);
}

function earthquake(x, y)
{
  const hit = [];

  for (const s of Sim.settlements) {
     const d = dist(s, { x, y });
     if (d > 550) continue;
    const f = 1 - d / 550;
    if (s.walls) s.walls.hp = Math.max(0, s.walls.hp - 250 * f);
    burnHouses(s, Math.round(s.houses.length * 0.3 * f));
    hit.push(s.name);
  }
  Sim.fx.push({ x, y, t: 60, type: 'boom' });
  chron(lang`🌋 Deprem! ${hit.length ? lang`${hit.join(', ')} sarsıldı; evler ve surlar çöktü` : lang('Issız topraklarda yer yarıldı')}`);
}

function drought(k) {
  k.drought = Sim.tick + CFG.year * (1 + Math.random() * 2 | 0);
  chron(lang`☀️ Kuraklık! ${k.name} topraklarında ekinler kuruyor`, k);
}

function spawnDeer() {
  for (let i = 0; i < 150; i++) {
    const c = rnd(5, CFG.cols - 5) | 0, r = rnd(5, CFG.rows - 5) | 0;
    if (Sim.terrain[r * CFG.cols + c]!==T_FOREST) continue;
    const x=(c + 0.5) * CFG.tile, y = (r + 0.5) * CFG.tile;
    if (Sim.settlements.some(s => dist2(s, { x, y }) < 130 * 130)) continue;
    const lair = { x, y }, n = rnd(3, 6) | 0;
    for (let j = 0; j < n; j++) makeMonster('deer', x + rnd(-6, 6), y + rnd(-6, 6), { lair, buck: Math.random() < 0.35 });
    return true;
  }
  return false;
}

function deerAI(m) {
  if ((Sim.tick + m.id) % 12 === 0 && Sim.grid) {
    let th = null, td = 50 * 50;
    near(Sim.grid, m.x, m.y, 50, q => { if (!q.dead && q.state !== 'jailed') { const d = dist2(m, q); if (d < td) { td = d; th = q; } } });
    for (const w of Sim.monsters) if (w.type === 'wolf' && !w.dead) { const d = dist2(m, w); if (d < 90 * 90 && d < td * 2) { td = d; th = w; } }
    if (th) m.threat = th;
  }
  const t = m.threat;
  if (t && !t.dead && dist2(m, t) < 85 * 85) {
    const a = Math.atan2(m.y - t.y, m.x - t.x) + rnd(-0.4, 0.4);
    monStep(m, m.x + Math.cos(a) * 20, m.y + Math.sin(a) * 20, 1.3);
    return;
  }
  m.threat = null;
  if (m.wait > 0) { m.wait--; if (Math.random()<0.01) m.a += rnd(-1, 1); return; }
  if (Math.random()<0.0005) { m.lair.x += rnd(-40, 40); m.lair.y += rnd(-40, 40); }
  if (!m.tgt || --m.t < 0 || monStep(m, m.tgt.x, m.tgt.y, 0.35)) {
    const a = rnd(0, 6.28), d = rnd(0, 45);
    m.tgt = { x: m.lair.x + Math.cos(a) * d, y: m.lair.y + Math.sin(a) * d }; m.t = 300; m.wait = rnd(40, 200) | 0;
  }
}

function natureYear()
{
  const deer = Sim.monsters.filter(m => m.type === 'deer').length;
  for (let i = 0; i < (year() === 0 ? 10 : deer < 50 ? 2 : 0); i++) spawnDeer();
  if (Sim.monsters.filter(m => m.type === 'wolf').length < 18 && Math.random() < 0.35) spawnWolves();
  if (year() > 25 && !Sim.monsters.some(m => m.type === 'dragon') && Math.random() < 0.02) spawnDragon();
  for (const k of Sim.kingdoms) {
    if (k.dead) continue;
    if (Math.random() < 0.025 && !(k.drought > Sim.tick)) drought(k);
    else if (Math.random() < 0.03) {
      for (const s of kSettlements(k)) s.food += 60 + s.pop * 3;
      chron(lang`🌾 ${k.name} topraklarında bereketli bir hasat oldu`, k);
    }
  }
  for (const s of [...Sim.settlements]) if (s.houses.length > 3 && Math.random() < 0.006) townFire(s);
  if (Math.random() < 0.008) earthquake(rnd(200, W - 200), rnd(200, H - 200));
  dangersYear();
}


function natureTick() {
  if (Sim.tick % CFG.year === 100 && !Sim.arena) natureYear();
  if (Sim.wx && Sim.wx.rain != null) Sim.rainUntil=Sim.wx.rain ? Sim.tick + 10 : 0;
  else if (Sim.tick % 40 === 0 && Sim.tick > Sim.rainUntil && snowAmt() < 0.2 && Math.random() < 0.05) Sim.rainUntil = Sim.tick + rnd(80, 260);
  for (const m of Sim.monsters) if (!m.dead) (m.type === 'wolf' ? wolfAI : m.type === 'deer' ? deerAI : m.type === 'bandit' ? banditAI : dragonAI)(m);
  if (Sim.tick % 30 === 0) Sim.monsters = Sim.monsters.filter(m => !m.dead);
}

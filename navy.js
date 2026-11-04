const SHIP = {
  trade: { name: 'Ticaret gemisi', hp: 60, speed: 0.9, len: 16 },
  war: { name: 'Savaş gemisi', hp: 140, speed: 1.05, len: 20 },
  transport: { name: 'Nakliye gemisi', hp: 90, speed: 0.8, len: 24 },
};
const SHIP_NAMES = ['Deniz Kızı', 'Fırtına', 'Altın Yıldız', 'Martı', 'Rüzgâr Gülü', 'Kara İnci', 'Dalga', 'Mercan', 'Şafak', "Yunus", 'Şimşek', "Poyraz", 'Lodos', 'Kasırga'];

function coastSpot(s) {
  const { cols: sutunlar, rows: satirlar, tile: T } = CFG, R = Math.ceil((s.r + 50) / T), c0 = s.x / T | 0, r0 = s.y / T | 0;
  let spot = null, bd = Infinity;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const c = c0 + dx, r = r0 + dy;
    if (c < 1 || r < 1 || c >= sutunlar - 1 || r >= satirlar - 1 || Sim.terrain[r * sutunlar + c] > T_SEA) continue;
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t=Sim.terrain[(r + ey) * sutunlar + c + ex], d = dx * dx + dy * dy;
      if (t >= T_BEACH && TER[t].speed && d < bd) { bd = d; spot = { x: (c + 0.5) * T, y: (r + 0.5) * T, lx: (c + ex + 0.5) * T, ly: (r + ey + 0.5) * T }; }
    }
  }
  return spot;
}

function makeShip(k, s, tur) {
  const D = SHIP[tur];
  const sh = { id: Sim.nextShip++, hull: true, k, home: s, type: tur, x: s.port.x, y: s.port.y, a: 0, hp: D.hp, max: D.hp,
    path: [], state: 'idle', t: 60, name: pick(SHIP_NAMES), bad: new Set() };
  Sim.ships.push(sh);
  slog(s, lang`⛵ Limanda yeni bir ${D.name.toLowerCase()} suya indirildi: "${sh.name}"`);
  return sh;
}

function buildShips(s) {
  if (!s.port) return;
  const k = s.k, atWar = [...k.rel.values()].some(r => r.status === 'war');
  const navy=Sim.ships.filter(sh => !sh.dead && sh.k === k && sh.type === 'war').length;
  const trade = Sim.ships.filter(sh => !sh.dead && sh.home === s && sh.type === 'trade').length;
  if (atWar && navy < 3 && s.wood >= 40) { s.wood -= 40; makeShip(k, s, 'war'); chron(lang`⚓ ${k.name} donanmasına yeni bir savaş gemisi katıldı (${s.name})`, k, null, s); }
  else if (trade < (s.pop > 30 ? 2 : 1) && s.wood >= 20) { s.wood -= 20; makeShip(k, s, 'trade'); }
}

function sail(sh, tx, ty) {
  if (sh.gx !== tx || sh.gy !== ty) {
    sh.path=findPath(sh.x, sh.y, tx, ty, true);

    sh.gx = tx; sh.gy = ty; sh.noPath = !sh.path;
    if (!sh.path) { sh.path=[]; return false; }
  }
  if (sh.noPath) return false;
  const wp = sh.path[0] || { x: tx, y: ty }, dx = wp.x - sh.x, dy = wp.y - sh.y, d = Math.hypot(dx, dy), v = SHIP[sh.type].speed;

  if (d < 6) { if (sh.path.length) { sh.path.shift(); return false; } return true; }

  sh.a = Math.atan2(dy, dx);
  sh.x += dx / d * Math.min(v, d); sh.y += dy / d * Math.min(v, d);
  return false;

}
const snap = v => (v / 48 | 0) * 48 + 24;

function damageShip(sh, dmg, from) {
  sh.hp -= dmg;
  if (sh.hp > 0) return;
  sh.dead = true;
  Sim.fx.push({ x: sh.x, y: sh.y, t: 40, type: 'boom' });
  if (from && from.k) from.k.shipsSunk++;
  let kayip = '';
  if (sh.army) {
    const A=sh.army, n = A.members.length;
    for (const p of [...A.members]) kill(p, null, 'boğulma');
    kayip = lang` Gemideki ${n} asker boğuldu!`;
  }
  chron(lang`🌊 ${sh.k.name} ${SHIP[sh.type].name.toLowerCase()} "${sh.name}" batırıldı${from && from.k ? lang` (${from.k.name} donanması)` : ''}.${kayip}`, sh.k, from && from.k);
}

const SHIP_FN = {
  trade(sh) {
    const ev = sh.home;
    if (sh.state === 'back') { if (sail(sh, ev.port.x, ev.port.y) || sh.noPath) { sh.state = 'idle'; sh.t=150; } return; }
    if (sh.state==='idle') {
      if (--sh.t > 0 || (ev.blockade || 0) > Sim.tick) return;
      const ports = Sim.settlements.filter(s => s.port && s !== ev && !sh.bad.has(s) && (s.k === sh.k || sh.k.rel.get(s.k)?.trade));
      if (!ports.length) { sh.t = 300; return; }
      sh.dest = pick(ports); sh.state = 'go';
      return;
    }
    const d = sh.dest;
    if (d.dead || !d.port) { sh.state = 'back'; return; }
    if (sh.noPath) { sh.bad.add(d); sh.state = 'idle'; sh.t = 60; sh.gx = null; return; }
    if (sail(sh, d.port.x, d.port.y)) {
      const g = d.k === sh.k ? 10 : 25;
      sh.k.gold += g; d.k.gold += g / 2; ev.food += 10;
      slog(d, lang`⛵ ${sh.k.name} ticaret gemisi "${sh.name}" limana yanaştı (+${g} altın)`);
      sh.state = 'back';
    }
  },
  war(sh) {

    const k = sh.k;
    if ((Sim.tick + sh.id) % 20 === 0) {
      sh.foe = null;

      let fd = 320 * 320;
      for (const o of Sim.ships) if (!o.dead && o !== sh && hostile(k, o.k) && !sh.bad.has(o)) { const d = dist2(sh, o); if (d < fd) { fd = d; sh.foe = o; } }
    }
    const f = sh.foe;
    if (f && !f.dead) {
      if (dist2(sh, f) < 70 * 70) {
        if ((Sim.tick + sh.id) % 25===0) fireArrow(sh, f, rnd(8, 14));
        if (!sh.fought) { sh.fought = true; chron(lang`🌊 Deniz çatışması: ${k.name} savaş gemisi "${sh.name}", ${f.k.name} gemisi "${f.name}" ile çarpışıyor`, k, f.k); }
        return;
      }
      sail(sh, snap(f.x), snap(f.y));
      if (sh.noPath) { sh.bad.add(f); sh.foe = null; sh.gx = null; }
      return;
    }
    const ports = Sim.settlements.filter(s => s.port && hostile(k, s.k) && !sh.bad.has(s));
     if (ports.length) {
      const t = ports.reduce((a, b) => dist2(a.port, sh) < dist2(b.port, sh) ? a : b);
      if (dist2(sh, t.port) < 50 * 50) {
        if ((t.blockade || 0) < Sim.tick) chron(lang`⚓ Abluka! ${k.name} savaş gemisi "${sh.name}", ${t.name} limanını kuşattı`, k, t.k, t);
        t.blockade = Sim.tick + 200; t.food -= 0.3;

        return;
      }
      sail(sh, t.port.x, t.port.y);
      if (sh.noPath) { sh.bad.add(t); sh.gx = null; }
      return;
    }
    if (dist2(sh, sh.home.port) > 3600) sail(sh, sh.home.port.x, sh.home.port.y);
  },
  transport(sh) {
    const A = sh.army;
    if (!A || !A.k.armies.includes(A)) { sh.dead = true; return; }
    if (sh.state !== 'sail') return;
    if (sh.noPath) return disembark(A, sh, sh.home);

    if (sail(sh, sh.dest.port.x, sh.dest.port.y)) disembark(A, sh, sh.dest);
  },
};

function updateShips()
{
  for (const sh of Sim.ships) {
    if (sh.dead) continue;
    if (sh.home.dead && sh.type !== 'transport') { sh.dead = true; continue; }
    SHIP_FN[sh.type](sh);
  }
  if (Sim.tick % 30===0) Sim.ships = Sim.ships.filter(s => !s.dead);
}

function navalInvasion(A) {
  const k = A.k, mine = kSettlements(k).filter(s => s.port && findPath(A.cmd.x, A.cmd.y, s.port.lx, s.port.ly));
  if (!mine.length) return false;
  const from = mine.reduce((a, b) => dist2(a, A.cmd) < dist2(b, A.cmd) ? a : b);
  const theirs = kSettlements(A.enemy).filter(s => s.port && findPath(from.port.x, from.port.y, s.port.x, s.port.y, true));
  if (!theirs.length) return false;
  const to = theirs.reduce((a, b) => dist2(a, from) < dist2(b, from) ? a : b);
  const sh = makeShip(k, from, 'transport');
  sh.army = A; sh.dest = to; sh.state = 'wait';
  A.ship = sh; A.target = to; A.state = 'embark'; A.t = 0;
  chron(lang`⛵ Deniz aşırı sefer! ${k.name} ordusu (${A.members.length} asker) ${from.name} limanında gemilere biniyor. Hedef: ${to.name}`, k, A.enemy, from);
  return true;
}

function disembark(A, sh, at) {
  for (const p of A.members) {
    p.x = at.port.lx + rnd(-6, 6); p.y = at.port.ly + rnd(-6, 6);
    if (!speedAt(p.x, p.y)) { p.x = at.port.lx; p.y = at.port.ly; }
  }
  sh.dead = true; A.ship = null; A.state = 'march'; A.t = 0; A.goalFor = null; A.path = null;
  if (at === sh.dest) chron(lang`⚓ ${A.k.name} ordusu ${at.name} kıyılarına çıktı!`, A.k, A.enemy, at);
  else chron(lang`⚓ ${A.k.name} ordusunun gemisi yol bulamayıp limana döndü`, A.k);
}

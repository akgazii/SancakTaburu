const TRAITS = {
  hard: { name: 'Çalışkan', work: 1.3, rest: 0.7, tired: 0.8 },
  lazy: { name: 'Tembel', work: 0.7, rest: 1.6, tired: 1.3 },
  chatty: { name: 'Konuşkan', social: 1.8 },
  loner: { name: 'Yalnız', social: 0.35 },
  grumpy: { name: 'Huysuz', brawl: 2.5, social: 0.8 },
  cheerful: { name: 'Neşeli', brawl: 0.3, social: 1.2 },
  romantic: { name: 'Romantik', love: 2.2 },
  brave: { name: 'Cesur', fear: 0.25 },
  coward: { name: 'Korkak', fear: 2 },
  curious: { name: 'Meraklı', roam: 3 },
  drunk: { name: "Ayyaş", tavern: 3, brawl: 1.6 },
  pious: { name: 'Dindar', temple: 4, brawl: 0.5 },
};
const TRAIT_KEYS = Object.keys(TRAITS);
const CLASH = { hard: 'lazy', lazy: "hard", chatty: 'loner', loner: "chatty", brave: 'coward', coward: 'brave', grumpy: 'cheerful', cheerful: 'grumpy' };
const trait = (p, anahtar) => p.traits.reduce((v, t) => v * (TRAITS[t][anahtar] ?? 1), 1);
const TALK = { friend: ['💬', '😄', '😂', '🗣️', '👍'], love: ['❤️', '😊', '🌹', '😳'], rival: ['😒', '😠', '💢'], neutral: ['💬', '🙂', '🤔', "👋"], kid: ['😆', '🤪', '😝'] };

function inheritTraits(f, m)
{
  const t = [], add = x => { if (!t.includes(x) && !t.includes(CLASH[x])) t.push(x); };
  for (const par of [f, m]) if (par && Math.random() < 0.3) add(pick(par.traits));
  while (!t.length || (t.length < 2 && Math.random() < 0.5)) add(pick(TRAIT_KEYS));
  return t.slice(0, 2);
}

function say(p, e, t = 60) { p.bub = { e, t: Sim.tick + t }; }
const tie = (p, q) => p.ties.get(q) || 0;
function addTie(p, q, d) {
  for (const [a, b] of [[p, q], [q, p]]) {
    a.ties.set(b, clamp(tie(a, b) + d, -100, 100));
    if (a.ties.size>12) {
      let w = null;
      for (const [o, v] of a.ties) if (o !== a.spouse && (!w || Math.abs(v) < Math.abs(a.ties.get(w)))) w = o;
      a.ties.delete(w);
    }
  }
}
const canCourt = (p, q) => isAdult(p) && isAdult(q) && p.female !== q.female && !p.spouse && !q.spouse && p.house !== q.house &&
  p.age < p.life * 0.6 && q.age < q.life * 0.6 && affinity(p.R.base, q.R.base) > -20;

const LIFE_JOBS = new Set(['farmer', 'wood', 'miner', 'builder', 'child', 'king', 'soldier', 'archer', 'cavalry', 'artillery', 'guard', "hunter", 'fisher', 'healer', 'spear', 'shield', "medic",
  'rifle', "rifleman", 'hussar', 'fieldgun', 'gatling', 'knight', "halberd", "xbow", 'harcher', 'trooper', 'sapper', 'flamer', 'mg', 'sniper', 'mortar', 'rocket']);
function startAct(p, tur, t, o = {}) { p.act = { type: tur, t: t | 0, until: Sim.tick + (t | 0) + 600, ...o }; p.stuck = 0; return true; }
function endAct(p) { p.act = null; p.stuck = 0; p.detour = null; return false; }
const freeFor = q => !q.dead && !q.state && !q.act && LIFE_JOBS.has(q.job) && q !== Sim.ctrl && (!q.sub || q.sub === 'go');

function lifeAct(p, g) {
  p.energy -= (p.sub === "work" ? 0.07 : 0.03) * trait(p, 'tired');
  p.social -= 0.08 * trait(p, 'social');
  if (p.act) return doAct(p, g);
  if (!LIFE_JOBS.has(p.job) || (p.job === 'guard' && p.sub)) return false;

  if (!p.afterWork && (Sim.tick + p.id) % 12) return false;
  if (p.sub && !p.afterWork && p.energy > 15 && !(p.s.fest > Sim.tick)) return false;
  const after = p.afterWork;
  p.afterWork = false;
  return decide(p, g, after);
}

function decide(p, g, after) {
  const s = p.s, kid = !isAdult(p);
  if (s.fest > Sim.tick && (!p.sub || after) && Math.random() < 0.85) return startAct(p, 'fest', 99999);
  if (p.energy < 18) return startAct(p, 'rest', rnd(60, 120) * trait(p, 'rest'), { tgt: homeSpot(p) });
  if (kid) {
    if (Math.random() < 0.25) {
      let q = null;
      near(g, p.x, p.y, 70, o => { if (!q && o !== p && !isAdult(o) && freeFor(o) && o.s === s) q = o; });
      if (q) { startAct(q, 'play', 260, { with: p, it: false }); return startAct(p, 'play', 260, { with: q, it: true }); }
    }
    return false;
  }
  if (p.age > p.life * 0.55 && Math.random() < 0.08) {
    const cocuklar = [];
    near(g, p.x, p.y, 70, o => { if (cocuklar.length < 6 && !isAdult(o) && freeFor(o) && o.s === s) cocuklar.push(o); });
    if (cocuklar.length >= 2) {
      cocuklar.forEach((o, i) => startAct(o, 'listen', 999, { with: p, i, n: cocuklar.length }));
      return startAct(p, 'story', rnd(180, 300), { kids: cocuklar });
    }
  }
  if (p.social < 35 || Math.random() < 0.03 * trait(p, "social")) {
    if (s.tavern && Math.random() < 0.18 * trait(p, 'tavern')) return startAct(p, 'tavern', rnd(120, 240), { tgt: { x: s.tavern.x + rnd(-10, 10), y: s.tavern.y + rnd(-10, 10) } });

    if (s.temple && Math.random() < 0.08 * trait(p, 'temple')) return startAct(p, 'pray', rnd(80, 150), { tgt: { x: s.temple.x + rnd(-9, 9), y: s.temple.y + 12 + rnd(0, 6) } });
    const q = chatPartner(p, g);
    if (q) return startChat(p, q);
  }
  if (after && Math.random() < 0.2 / trait(p, 'work')) return startAct(p, 'idle', rnd(20, 60) / trait(p, 'work'));
  if (Math.random() < 0.012 * trait(p, 'roam')) {
    const a = rnd(0, 6.28), d = rnd(10, s.r + 50);
    return startAct(p, "stroll", 60, { tgt: { x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d } });
  }
  return false;
}

function chatPartner(p, g) {
  let q = null, bs = -Infinity;
  near(g, p.x, p.y, 75, o => {
     if (o === p || o.k !== p.k || !isAdult(o) || !freeFor(o)) return;
    const sc = tie(p, o) + rnd(0, 20) - (o.social > 85 ? 15 : 0) + (canCourt(p, o) ? 12 * trait(p, 'love') : 0) - Math.sqrt(dist2(p, o)) * 0.2;
    if (sc > bs) { bs = sc; q = o; }
  });
  return q;
}
function startChat(p, q) {
  const t = rnd(50, 110);
  startAct(q, 'chat', t, { with: p });
  return startAct(p, 'chat', t, { with: q });
}

function doAct(p, g) {
  const a = p.act, s = p.s;

  if (Sim.tick > a.until || s.dead) return endAct(p);
  const goTo = (tgt, m = 1) => moveTo(p, tgt.x, tgt.y, m) || p.stuck > 300;
  switch (a.type) {
    case 'rest':
      if (!a.arrived) { if (goTo(a.tgt)) a.arrived = true; return true; }
      p.energy = Math.min(100, p.energy + 0.8);
      if (!p.bub || p.bub.t < Sim.tick) say(p, '💤', 80);
      if (--a.t <= 0) { p.energy = 100; endAct(p); }
      return true;
    case 'idle':
      if (Math.random() < 0.03) p.lookA = p.a + rnd(-1.6, 1.6);
      if (p.lookA != null) p.a += angDiff(p.a, p.lookA) * 0.1;
      if (--a.t<=0) endAct(p);
      return true;
    case 'stroll':
      if (goTo(a.tgt, 0.6)) { endAct(p); startAct(p, 'idle', rnd(20, 60)); }
      return true;
    case 'tavern':
    case 'pray':
      if (!a.arrived) { if (goTo(a.tgt, 0.9)) a.arrived=true; return true; }
      p.social = Math.min(100, p.social + 0.5);
      if (Math.random() < 0.012) say(p, a.type === 'tavern' ? pick(['🍺', '🍺', '🎶', '😂']) : '🙏');
      if (a.type === 'tavern' && Math.random() < 0.0015 * trait(p, 'brawl') * p.stats.agg / 5) {
         let q = null;
        near(g, p.x, p.y, 25, o => { if (!q && o !== p && o.act && o.act.type === 'tavern') q = o; });
        if (q) return startBrawl(p, q);
      }
      if (--a.t <= 0) { if (a.type === 'pray') s.stab = Math.min(100, s.stab + 0.3); endAct(p); }
      return true;
    case 'chat': return chatTick(p, a);
    case 'story':
      if (Math.random()<0.02) say(p, pick(['📖', '🐉', '👑', '⚔️', '👻', '🧙']));
      p.social = Math.min(100, p.social + 0.3);
      if (--a.t <= 0) { endAct(p); for (const k of a.kids) if (k.act && k.act.with === p) { endAct(k); say(k, '😄'); } plog(p, lang('çocuklara masal anlattı')); }
      return true;
    case "listen": {
      const e = a.with;
      if (!e || e.dead || !e.act || e.act.type !== "story") return endAct(p);
      const aci = a.i / a.n * Math.PI * 1.4 - Math.PI * 0.7 + e.a;
      if (moveTo(p, e.x + Math.cos(aci) * 9, e.y + Math.sin(aci) * 9, 1.1)) p.a += angDiff(p.a, Math.atan2(e.y - p.y, e.x - p.x)) * 0.3;
      if (Math.random() < 0.008) say(p, pick(['😮', '😲', '😨', '🤩']));
      return true;
    }
    case 'brawl': return brawlTick(p, a);
    case 'play': return playTick(p, a);
    case 'fest': {
      if (!(s.fest > Sim.tick)) return endAct(p);
      const ring = p.id % 3, yon = ring % 2 ? 1 : -1, R = 16 + ring * 9, aci = Sim.tick * 0.012 * yon + p.id * 0.9;
      moveTo(p, s.x + Math.cos(aci) * R, s.y + Math.sin(aci) * R, 0.9);
      p.social=Math.min(100, p.social + 0.3);
      if (Math.random() < 0.006) say(p, pick(['🎉', '🎶', '💃', '🍻', '😄']));
      return true;
    }
  }
  return endAct(p);
}

function chatTick(p, a) {
  const q = a.with;
  if (!q || q.dead || q.state || !q.act || q.act.with !== p) return endAct(p);
  if (dist2(p, q) > 8 * 8) { moveTo(p, (p.x + q.x) / 2, (p.y + q.y) / 2, 0.9); return true; }
  p.a += angDiff(p.a, Math.atan2(q.y - p.y, q.x - p.x)) * 0.2;
  p.social = Math.min(100, p.social + 0.4);
  if (Math.random() < 0.022) {
    const t = tie(p, q);
    say(p, pick(canCourt(p, q) && t > 15 ? TALK.love : t > 25 ? TALK.friend : t < -15 ? TALK.rival : TALK.neutral));
  }
  if (p.id < q.id && --a.t <= 0) chatEnd(p, q);
  return true;
}

function chatEnd(p, q) {
  const d = rnd(2, 10) - (trait(p, 'brawl') + trait(q, 'brawl') - 2) * rnd(0, 5) + affinity(p.R.base, q.R.base) * 0.06 + (p.house === q.house ? 3 : 0) + (canCourt(p, q) ? 12 * Math.sqrt(trait(p, 'love') * trait(q, 'love')) : 0);
  addTie(p, q, d);
  endAct(p); endAct(q);
  p.social = Math.max(p.social, 90); q.social = Math.max(q.social, 90);
  const t = tie(p, q);
  if (d < -2) { say(p, '😠'); say(q, '😒'); }
  if (t < -30 && Math.random() < 0.35 * Math.max(trait(p, 'brawl'), trait(q, 'brawl'))) return startBrawl(p, q);
  if (canCourt(p, q) && t > 25 && Math.random() < 0.5 * trait(p, 'love') * trait(q, 'love')) return wed(p, q);
  if (t > 30 && Math.abs(t - d) <= 30) plog(p, lang`${fullName(q)} ile dost oldu`);
}

function wed(p, q) {
  Sim.loveN = (Sim.loveN || 0) + 1;

  const [m, f] = p.female ? [q, p] : [p, q];
  marry(m, f);
  if (f.s !== m.s) { f.s = m.s; f.home = null; f.state = 'migrate'; plog(f, lang`${m.s.name} köyüne, eşinin yanına taşındı`); }
  f.home = m.home;
  for (const o of [m, f]) { say(o, '💍', 150); Sim.fx.push({ x: o.x, y: o.y - 4, t: 60, type: 'heart' }); }
  slog(m.s, lang`💍 ${fullName(m)} ile ${fullName(f)} birbirine âşık olup evlendi`);
}

function startBrawl(p, q)
{
  const [att, def] = p.stats.agg >= q.stats.agg ? [p, q] : [q, p];
  startAct(def, 'brawl', 50, { with: att });
  startAct(att, 'brawl', 50, { with: def, att: true });
  addTie(p, q, -20);
  say(att, '💢'); say(def, '😡');
  return true;
}
function brawlTick(p, a)
{
   const q = a.with;
  if (!q || q.dead || q.state || !q.act || q.act.with !== p) return endAct(p);
  if (dist2(p, q) > 6 * 6) { moveTo(p, q.x, q.y, 1.2); return true; }
  p.a = Math.atan2(q.y - p.y, q.x - p.x);

  if ((Sim.tick + p.id) % 9 === 0) {
    q.hp = Math.max(1, q.hp - (0.5 + p.stats.str * 0.35));
    Sim.fx.push({ x: q.x, y: q.y, t: 8, type: 'hit' });
  }
  if (--a.t <= 0) {
    endAct(p);
    if (a.att) {
      p.criminal = true;
      plog(p, lang`${fullName(q)} ile kavga etti`); plog(q, lang`${fullName(p)} ona saldırdı`);
      slog(p.s, lang`👊 Kavga: ${fullName(p)}, ${fullName(q)} adlı kişiyle yumruk yumruğa geldi`);
    }
  }
  return true;
}

function playTick(p, a) {
  const q = a.with, s = p.s;
  if (!q || q.dead || q.state || !q.act || q.act.with !== p || --a.t <= 0) { if (Math.random() < 0.5) say(p, '😆'); return endAct(p); }
  if (a.cool > 0) a.cool--;
  if (a.it && !a.cool) {
    if (dist2(p, q) < 25) { a.it = false; q.act.it = true; q.act.cool = 30; say(p, pick(TALK.kid)); }
    else moveTo(p, q.x, q.y, 1.35);
  } else {
    let ax = p.x - q.x, ay = p.y - q.y;
    const n = Math.hypot(ax, ay) || 1;
    if (dist2(p, s) > (s.r + 25) ** 2) { ax=s.x - p.x; ay = s.y - p.y; }
    else { ax /= n; ay /= n; }
    const m = Math.hypot(ax, ay) || 1;
    moveTo(p, p.x + ax / m * 15 + rnd(-4, 4), p.y + ay / m * 15 + rnd(-4, 4), a.it ? 0.5 : 1.25);
  }
  return true;
}

function startFest(s) {
  s.fest = Sim.tick + 110; s.festY=year();
  s.food -= s.pop * 1.5;
  s.stab = Math.min(100, s.stab + 4);
  slog(s, lang`🎉 Hasat şenliği! Halk meydanda ateşin etrafında dans ediyor`);
  if (s.pop >= 30) chron(lang`🎉 ${s.name} büyük bir hasat şenliği düzenledi`, s.k, null, s);
}


function cemSpot(s) {
  for (let i = 0; i < 40; i++) {
    const a = rnd(0, 6.28), r = s.r + rnd(22, 40), x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r;
    if (!speedAt(x, y) || !speedAt(x + 14, y + 14) || !speedAt(x - 14, y - 14)) continue;
    if (s.houses.some(h => (h.x - x) ** 2 + (h.y - y) ** 2 < 24 * 24) || buildingsOf(s).some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < 26 * 26)) continue;
    return { x, y };
  }
  return null;
}
function addGrave(s, q) {
  if (!s.cem) { s.cem = cemSpot(s); s.graves = []; s.graveN = 0; if (!s.cem) return; }
  s.graves[s.graveN++ % 36] = { n: fullName(q), y: year(), king: q.k.king === q || q.k.reigns.some(r => r.p === q) };
}

function onDeath(q) {
  for (const [o, v] of q.ties) if (v > 35 && !o.dead && o !== q.spouse) { plog(o, lang`yakın dostu ${fullName(q)} öldü`); say(o, '😢', 150); o.social -= 20; }
  if (q.spouse && !q.spouse.dead) say(q.spouse, '😭', 200);
  const s = q.s;
  if (s && !s.dead && !s.camp && dist2(q, s) < (s.r + 90) ** 2) addGrave(s, q);
}

function huntJob(p) {
  const s = p.s;
  if (p.sub === "hhome") {
    if (moveTo(p, p.tgt.x, p.tgt.y) || p.stuck > 300) {
      s.food += p.meat; p.gold += 2; s.k.gold += 0.5;
      p.meat = 0; p.sub = null; p.afterWork = true;
    }
    return;
  }
  if (p.meat) { p.sub = 'hhome'; p.tgt = homeSpot(p); plog(p, lang('bir geyik avladı')); return; }
  let d = p.prey;
  if (!d || d.dead || dist2(d, s) > 520 * 520) {
    d = p.prey = null;
     let bd = 450 * 450;
    for (const m of Sim.monsters) if (m.type === "deer" && !m.dead) { const dd = dist2(m, s); if (dd < bd) { bd=dd; d = p.prey = m; } }
    if (!d) return gather(p, 'food');
    p.sub = null;
  }
  if (dist2(p, d) > 70 * 70) { moveTo(p, d.x, d.y, 0.85); return; }
  p.a = Math.atan2(d.y - p.y, d.x - p.x);
  if ((Sim.tick + p.id) % 30 === 0) fireArrow(p, d, 4 + p.stats.spd * 0.5);
}

function lifeTick() {
  if (Sim.tick % CFG.year === 165) for (const s of Sim.settlements) {
    if (s.pop >= 8 && s.food > s.pop * 5 && s.stab >= 45 && Math.random() < 0.3) startFest(s);
  }
}

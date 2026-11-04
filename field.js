
const CMD_TRAITS = {
  cautious: { n: 'Temkinli', ic: "🧐", atk: 1.15, retreat: 0.85, rethink: 1.25, ambush: 0, accept: { defend: 0.2, attack: -0.15, help: 0.05 } },
  bold:     { n: 'Gözü kara', ic: '🔥', atk: 0.75, retreat: 0.55, rethink: 0.6, ambush: -0.1, accept: { attack: 0.25, defend: -0.25, help: 0.15 } },
  cunning:  { n: 'Kurnaz', ic: '🦊', atk: 0.95, retreat: 0.75, rethink: 1.3, ambush: 0.25, accept: { ambush: 0.3 } },
  stubborn: { n: 'İnatçı', ic: '🐂', atk: 0.95, retreat: 0.6, rethink: 0.35, ambush: 0, accept: { merge: -0.4, defend: 0.1 } },
};
function cmdTrait(p) {
  if (!p) return CMD_TRAITS.cautious;
  if (!p.ctrait) {
    const s = p.stats, w=[['cautious', 1 + (10 - s.agg) * 0.15], ['bold', 0.5 + s.agg * 0.15], ['cunning', 0.3 + s.int * 0.15], ['stubborn', 0.6 + s.end * 0.1]];
    let r = Math.random() * w.reduce((t, [, v]) => t + v, 0);
    p.ctrait = w.find(([, v]) => (r -= v) <= 0)?.[0] || 'cautious';
  }
  return CMD_TRAITS[p.ctrait];
}
const trOf = A => cmdTrait(A && A.cmd);

const RANKS=[[0, 'Yüzbaşı'], [2, 'Binbaşı'], [4, "Albay"], [7, 'Paşa'], [11, 'Mareşal']];
function rankOf(p) {
  const w = (p && p.battlesWon) || 0;
  let lv = 0;
  RANKS.forEach(([n], i) => { if (w>=n) lv = i; });
  return { lv, n: RANKS[lv][1] };
}
const rankName = p => lang`${rankOf(p).n} ${fullName(p)}`;
const cmdInt = p => p ? p.stats.int + rankOf(p).lv * 0.5 : 5;
function cmdPromote(p, before) {
  const r = rankOf(p);
  if (r.lv <= before) return;

  say(p, '🎖', 200)
  plog(p, lang`${r.n} rütbesine yükseldi`);
  chron(lang`🎖 ${p.k.name}: ${fullName(p)} kazandığı ${p.battlesWon}. zaferle ${r.n} rütbesine yükseldi${r.lv >= 3 ? lang('; adı dilden dile dolaşıyor') : ''}`, p.k);
}

function pickGuards(X) {
  for (const p of X.members) if (p.guardOf) p.guardOf = null;
  const c = X.cmd;
  if (!c || X.lv) { X.cmdFront = true; return; }
  X.cmdFront = Math.random() < (cmdTrait(c) === CMD_TRAITS.bold ? 0.5 : 0.06) || X.members.length < 8;

  if (X.cmdFront || X.members.length < 12) return;
  const n = clamp(Math.round(X.members.length / 15), 2, 5), pref = { shield: 3, soldier: 2, spear: 1, halberd: 1 };
  const havuz=X.members.filter(p => p !== c && pref[p.job]).sort((a, b) => (pref[b.job] - pref[a.job]) * 10 + (b.stats.str + b.stats.end) - (a.stats.str + a.stats.end));
  havuz.slice(0, n).forEach((p, i) => { p.guardOf = c; p.guardI = i; p.guardN = Math.min(n, havuz.length); });
}
function cmdBack(p, g, A, fx, fy) {

  if (A.cmdFront || A.members.length < 8 || A.lv) return false;
  if (reflex(p, g, 10)) return true;
  let cx = A.cx, cy = A.cy;
  if (!A.battle || cx == null) { cx = 0; cy = 0; for (const q of A.members) { cx += q.x; cy += q.y; } cx /= A.members.length; cy /= A.members.length; }
  const a = Math.atan2(fy - cy, fx - cx), back = meleeDepth(A, Math.max(1, meleeCount(A))) + 28;
  if (moveTo(p, cx - Math.cos(a) * back, cy - Math.sin(a) * back, 1.1)) p.a = a;
  return true;
}
function guardMove(p, g, A) {
  const c = A.cmd;
  if (!c || c.dead || A.cmdFront) { p.guardOf = null; return false; }
  let dusman = p.foe && !p.foe.dead && dist2(p.foe, c) < 60 * 60 ? p.foe : null;
   if (!dusman && (Sim.tick + p.id) % 8 === 0) {
    let bd = 50 * 50;
    near(g, c.x, c.y, 50, q => { if (!q.dead && !downed(q) && q.army && hostile(p.k, q.k)) { const d = dist2(q, c); if (d < bd) { bd = d; dusman = q; } } });
  }
  if (dusman) { p.foe = dusman; moveTo(p, dusman.x, dusman.y, 1.15); return true; }
  p.foe = null;
  const n = p.guardN || 3, a = c.a + ((p.guardI || 0) - (n - 1) / 2) * 0.55;
  if (moveTo(p, c.x + Math.cos(a) * 9, c.y + Math.sin(a) * 9, 1.15)) p.a = c.a;
  return true;
}

const WOUND_CAUSES = ['savaş', 'ok', 'gülle', 'tuzak', 'kurşun'];
function woundInstead(q, sebep) {
  const A = q.army;
  if (!A || q.state !== 'army' || A.lv || q === A.cmd || q === Sim.ctrl || q.job === 'tank' || !WOUND_CAUSES.includes(sebep)) return false;
  if (Math.random()>0.35) return false;
  leaveArmy(q);
  q.state='wounded'; q.hp = 1; q.woundT = Sim.tick; q.woundA = A; q.foe=null; q.carrier = null; q.medic=null; q.wp = null; q.detour = null;
  say(q, '🩸', 120);
  plog(q, lang('savaşta ağır yaralanıp yere yığıldı'));
  return true;
}
const downed = q => q.state === 'wounded' || q.state === 'healing';
function woundedTick(p) {
   const c = p.carrier;
  if (c && !c.dead && c.carry === p) { p.x = c.x - Math.cos(c.a) * 5; p.y = c.y - Math.sin(c.a) * 5; p.a=c.a; return; }
  p.carrier = null;
  if (Sim.tick - p.woundT > 1800) { p.state = null; kill(p, null, 'kan kaybı'); }
}
function healingTick(p)
{

  const b=p.healAt;
  if (!b) { p.state = null; return; }
  if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 > ((b.r || 20) * 0.8) ** 2) moveTo(p, b.x + rnd(-6, 6), b.y + rnd(-6, 6), 0.5);
  p.hp = Math.min(p.maxHp, p.hp + (b.hosp ? 0.12 : b.A ? 0.05 : 0.03));
  if (p.hp < p.maxHp * 0.7) return;
  let A = armyAlive(p.woundA) ? p.woundA : allArmies().filter(X => X.k === p.k && armyAlive(X) && X.manual === (p.woundA ? p.woundA.manual : true)).sort((a, b) => dist2(a.cmd, p) - dist2(b.cmd, p))[0];
  p.healAt = null; p.woundA=null;
  if (!A) { p.state = null; return; }
  A.members.push(p); sortRanks(A); A.start++;
  say(p, '💪', 90); plog(p, lang('yaraları iyileşti, orduya geri döndü'));
}
function medBase(A, p) {
  let enIyi = null, bd = 1600 * 1600;
  for (const b of Sim.bases || []) if (b.k === A.k) { const d = dist2(b, p); if (d<bd) { bd = d; enIyi = b; } }
  return enIyi || { x: A.home.x, y: A.home.y, r: 20 };
}

function medicMove(p, g, A) {
  if (p.carry) {
    const w=p.carry;
    if (w.dead || w.state !== 'wounded') { p.carry=null; return false; }

    const b = medBase(A, p);
    if (moveTo(p, b.x, b.y, 0.85) || dist2(p, b) < ((b.r || 20) * 0.7) ** 2) {
      w.state = 'healing'; w.healAt=b; w.carrier = null; w.medic = null; p.carry = null;
      A.saved = (A.saved || 0) + 1;
      plog(w, lang('sedyeciler tarafından ordugâha taşındı'));
      if (A.saved % 5 === 0) chron(lang`🩹 ${A.k.name} sedyecileri ${A.saved}. yaralıyı savaş alanından ordugâha taşıdı`, A.k);
    }
     return true;
  }
  const w = p.patient;
  if (w) {
    if (w.dead || w.state !== 'wounded' || (w.carrier && w.carrier !== p)) { p.patient = null; if (w.medic === p) w.medic = null; return false; }
    if (moveTo(p, w.x, w.y, 1.15) || dist2(p, w) < 25) { p.carry = w; w.carrier = p; p.patient = null; say(p, '🩹', 80); }
     return true;
  }
  if ((Sim.tick + p.id) % 15) return false;
  let best = null, bd = 320 * 320;
  for (const q of Sim.people) {
    if (q.state !== 'wounded' || q.dead || q.medic || q.carrier || (q.k !== p.k && !cpFriend(A, { k: q.k }))) continue;
    const d = dist2(p, q);
    if (d<bd) { bd = d; best = q; }
  }
  if (!best) return false;
  p.patient = best; best.medic=p;
  return true;
}

const onHill = q => terrainAt(q.x, q.y) === T_HILLS;
function terrainChance(A) { return clamp(0.2 + (cmdInt(A.cmd) - 5) * 0.12 + (['cautious', "cunning"].includes(A.cmd.ctrait) ? 0.15 : 0), 0.05, 0.85); }
function findHill(A, from, yon)
{
  let best = null, bd = Infinity;
  for (let i = 0; i < 70; i++) {
    const a = yon + rnd(-1.4, 1.4), d = rnd(30, 230), x = from.x + Math.cos(a) * d, y = from.y + Math.sin(a) * d;
     if (terrainAt(x, y) !== T_HILLS || !speedAt(x, y)) continue;
    let n = 0; for (const [dx, dy] of [[20, 0], [-20, 0], [0, 20], [0, -20]]) if (terrainAt(x + dx, y + dy)===T_HILLS) n++;
    if (n < 2) continue;
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
function passWidth(x, y, a)
{
  const px = -Math.sin(a), py = Math.cos(a);
  let w = 0;
  for (const s of [1, -1]) {
     let d = 0;
    while (d < 160 && speedAt(x + px * s * (d + 8), y + py * s * (d + 8))) d += 8;
    w += d;
  }
  return w;
}
function findChoke(A, F) {
  const yol = cpRoute(A.cmd, F.cmd);
  if (yol.length < 6) return null;
  let enIyi = null, bw = 110;
  for (let i = Math.floor(yol.length * 0.12); i < yol.length * 0.65; i++) {
    const p = yol[i], q = yol[Math.min(yol.length - 1, i + 1)], a = Math.atan2(q.y - p.y, q.x - p.x), w = passWidth(p.x, p.y, a);
    if (w >= 24 && w < bw) { bw = w; enIyi = { x: p.x, y: p.y, dir: a, w }; }
  }
  return enIyi;
}

const TRAP_N = { stakes: 'kazık tuzağı', pit: "gizli çukur", oil: "yağ birikintisi", wire: 'dikenli tel', mine: 'mayın' };
function placeTraps(A, o)
{
  A.trapsSet = true;
  if (cmdInt(A.cmd) + rnd(-2, 2) + (A.cmd.ctrait === 'cunning' ? 1.5 : 0) < 5) return;
  const traps = Sim.traps || (Sim.traps = []), cd = Math.cos(o.dir), sd = Math.sin(o.dir), yari = frontHalf(A, meleeCount(A)) + 20;
  const n = clamp(Math.round(A.members.length / 9 * (0.5 + cmdInt(A.cmd) / 10)), 2, 18), made = {}, oils = clamp(Math.floor(n / 6), A.members.length >= 20 ? 1 : 0, 3);
  for (let i = 0; i < n; i++) {
    const tur = A.ww ? (Math.random() < 0.6 ? 'wire' : 'mine') : i < oils && Math.random() < 0.7 ? 'oil' : Math.random() < 0.55 ? 'stakes' : 'pit';
    const fwd = rnd(45, 100 + n * 4), lat = rnd(-yari * 1.2, yari * 1.2), x = o.x + cd * fwd - sd * lat, y = o.y + sd * fwd + cd * lat;
    if (!speedAt(x, y)) continue;
    traps.push({ k: A.k, x, y, type: tur, r: tur === 'oil' ? 26 : tur === 'pit' || tur === 'mine' ? 7 : tur === 'wire' ? 14 : 10, hp: 25, t0: Sim.tick, fire: 0, spent: false, seed: Math.random() * 6, a: o.dir });
    made[tur] = (made[tur] || 0) + 1;
  }
  const liste = Object.entries(made).map(([t, c]) => lang`${c} ${TRAP_N[t]}`).join(", ");
  if (liste) { say(A.cmd, '🪤', 150); chron(lang`🪤 ${A.k.name} komutanı ${rankName(A.cmd)} hattın önüne tuzak kurdurdu: ${liste}`, A.k); }
}
function trapHurt(q, dmg, t) {
  if (q.job === 'tank') dmg *= t.type === 'pit' ? 0.4 : t.type === 'mine' ? 0.5 : 0.1;
  q.hp -= dmg / (0.6 + q.stats.end * 0.08);
  q.hitT = Sim.tick; q.loud = Sim.tick;
  Sim.fx.push({ x: q.x, y: q.y, t: 8, type: 'hit' })
  if (q.hp <= 0) kill(q, null, 'tuzak');
}
function trapTick()
{
   const traps = Sim.traps;
  if (!traps || !traps.length || !Sim.grid) return;
  for (const t of traps) {
    if (t.spent) continue;
    if (t.fire) {
      near(Sim.grid, t.x, t.y, t.r, q => { if (!q.dead && !downed(q) && dist2(q, t) < t.r * t.r) trapHurt(q, 2.2, t); });
      if (Sim.tick>t.fire) t.spent = true;

      continue;
    }
    const foes = [];
    near(Sim.grid, t.x, t.y, t.r, q => { if (!q.dead && q.army && hostile(t.k, q.k) && dist2(q, t) < t.r * t.r) foes.push(q); });
    if (!foes.length) continue;
    if (t.type === 'stakes') {
      for (const q of foes) { trapHurt(q, isCav(q) ? 6 : 2.5, t); q.slowT=Sim.tick + 25; if (--t.hp<=0) t.spent = true; }
    } else if (t.type === 'wire') {
      for (const q of foes) { trapHurt(q, 0.4, t); q.slowT = Sim.tick + 45; if ((t.hp -= q.job === 'tank' ? 9 : 0.5) <= 0) t.spent = true; }
    } else if (t.type === 'mine') {
      Sim.fx.push({ x: t.x, y: t.y, t: 20, type: 'blast' });
      const hit = [];
      near(Sim.grid, t.x, t.y, 18, q => { if (!q.dead && !downed(q) && q.army && dist2(q, t) < 18 * 18) hit.push(q); });
      for (const q of hit) if (!q.dead) trapHurt(q, (q.job === 'tank' ? 40 : 16) * (1 - dist(q, t) / 24), t);
      t.spent = true; say(foes[0], "😱", 80);
    } else if (t.type === "pit") {
      const q = foes[0];
      trapHurt(q, isCav(q) ? 16 : 11, t); q.trapT = Sim.tick + 90;
      t.spent=true; say(q, '😱', 80);
    } else if (t.type === 'oil' && foes.length >= 3) {
      t.fire = Sim.tick + 160;

      chron(lang`🔥 ${foes[0].k.name} askerleri yağ birikintisine girdi, ${t.k.name} ${t.k.armies.some(X => X.vic) ? lang('askerleri') : lang('okçuları')} ateşe verdi!`, t.k, foes[0].k);
    }
  }
  if (Sim.tick % 250 === 0) Sim.traps=traps.filter(t => !(t.spent && t.type !== 'pit' && t.type !== 'mine') && Sim.tick - t.t0 < 8000 && !t.k.dead);
}

function extraTrenches(A) {
  const o = A.order;
  if (!A.manual || !A.cp || A.headless || A.lv || A.battle || A.cp.phase !== 'defend' || !o || !o.cp || o.type !== "hold" || o.hide || (Sim.tick / 5 + A.id) % 4) return;
  const main = A.trench && A.trench !== true && Sim.trenches.includes(A.trench) ? A.trench : null;
  if (!main) return;
  const liste = A.extraTr || (A.extraTr = []);
  const open = liste.filter(t => Sim.trenches.includes(t) && t.prog < 1);
   if (open.length) {
    const diggers = A.members.filter(p => digger(p) && p.job !== 'medic' && dist2(p, A.cmd) < 160 * 160).length;
    for (const t of open) { t.prog = Math.min(1, t.prog + diggers * 0.0035 / open.length); t.until = Math.max(t.until, Sim.tick + CFG.year * 2); }
  }
  for (const t of liste) t.until = Math.max(t.until, Sim.tick + CFG.year);
  const want = clamp(Math.floor(A.members.length / 30 + (cmdInt(A.cmd) - 5) / 2), 0, 4);
  if (liste.length >= want || main.prog < 0.6 || open.length || (A.extraT && Sim.tick - A.extraT < 300)) return;
  const cd = Math.cos(o.dir), sd = Math.sin(o.dir), yari = frontHalf(A, meleeCount(A)) + 12, k = liste.length;
  const spots = [[0, 50, 0, yari * 2 + 30], [-(yari + 22), 10, -0.9, yari], [yari + 22, 10, 0.9, yari], [0, 95, 0, yari * 2 + 50]];
  const [lat, fwd, turn, uzunluk] = spots[k];
  const x = o.x + cd * fwd - sd * lat, y = o.y + sd * fwd + cd * lat;
  const t = speedAt(x, y) ? digTrench(A.k, x, y, o.dir + turn, uzunluk, A) : null;
  A.extraT = Sim.tick;

  if (!t) { liste.push({ prog: 1 }); return; }
  liste.push(t);
  if (k === 0) chron(lang`⛏ ${A.k.name} komutanı ${rankName(A.cmd)} savunmayı derinleştiriyor: ${want} ek hendek hattı kazdırıyor`, A.k);
}

const BASE_UP = [['tower', 600, '🗼 gözetleme kulesi'], ['forge', 1200, '⚒ demirci'], ["hosp", 1800, "⛑ sahra hastanesi"]];
function baseTick(b)
{
  const A = b.A, here = A && armyAlive(A) && dist2(A.cmd, b) < 450 * 450;
  if (here) b.age = (b.age || 0) + 5;
  for (const [anahtar, need, isim] of BASE_UP) if (!b[anahtar] && (b.age || 0) >= need) {
     b[anahtar] = true;
    chron(lang`⛺ ${b.k.name} ordugâhına ${isim} kuruldu`, b.k);
  }
  if (b.tower && Sim.tick % 30 === 0) {
    for (const O of allArmies()) if (O.members.length && hostile(b.k, O.k) && cpHidden(O) && dist2(O.cmd, b) < 320 * 320) {
      if (O.spotK !== b.k || Sim.tick - O.spotT > 600) chron(lang`🗼 ${b.k.name} gözetleme kulesinden ormanda gizlenen ${O.k.name} ordusu görüldü!`, b.k, O.k);

      O.spotK = b.k; O.spotT = Sim.tick;
    }
  }
  if (b.forge && here && Sim.tick % 50 === 0) for (const p of A.members) if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (b.r + 30) ** 2) p.forgeT=Sim.tick + 1500;
}

function fieldDraw(ctx, vis)
{
  const z = Sim.cam.z, simdi = Sim.tick;
  for (const t of Sim.traps || []) {
    if (!vis(t)) continue;
    if (t.type === 'stakes' && !t.spent) {
      ctx.fillStyle = '#6b4a2b';
      for (let i = 0; i < 5; i++) { const a = t.seed + i * 1.3, x = t.x + Math.cos(a) * t.r * 0.6, y = t.y + Math.sin(a) * t.r * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y - 3.5); ctx.lineTo(x + 1.3, y + 1); ctx.lineTo(x - 1.3, y + 1); ctx.fill(); }
    } else if (t.type === 'wire' && !t.spent) {
      const ca = Math.cos((t.a || 0) + Math.PI / 2), sa = Math.sin((t.a || 0) + Math.PI / 2), cd = Math.cos(t.a || 0), sd = Math.sin(t.a || 0);
      ctx.strokeStyle = 'rgba(70,70,66,0.85)'; ctx.lineWidth=0.6; ctx.beginPath();
      for (let i = 0; i <= 14; i++) { const al = (i / 14 - 0.5) * t.r * 2, o = (i % 2 ? 1.6 : -1.6), x = t.x + ca * al + cd * o, y = t.y + sa * al + sd * o; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
       ctx.stroke();
      ctx.fillStyle = '#5a4630'; for (const s of [-1, 0, 1]) ctx.fillRect(t.x + ca * s * t.r * 0.9 - 0.6, t.y + sa * s * t.r * 0.9 - 0.6, 1.2, 1.2);
    } else if (t.type === 'mine') {
      if (t.spent) { ctx.fillStyle = 'rgba(25,25,25,0.6)'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 1.2, 0, 7); ctx.fill(); }
      else { ctx.globalAlpha = 0.22; ctx.fillStyle = '#3a3a30'; ctx.beginPath(); ctx.arc(t.x, t.y, 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    } else if (t.type==='pit') {
      if (t.spent) { ctx.fillStyle = 'rgba(30,20,10,0.75)'; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.7, 0, 0, 7); ctx.fill(); }
      else { ctx.globalAlpha = 0.25; ctx.strokeStyle = "#4a3520"; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; }
    } else if (t.type === 'oil') {
      if (t.fire && !t.spent) {
        for (let i = 0; i < 9; i++) { const a = t.seed + i * 0.7, d = (i % 3 + 1) / 3.4 * t.r, x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d * 0.7, h = 5 + Math.sin(simdi * 0.4 + i) * 2.5;
          ctx.fillStyle = i % 2 ? 'rgba(255,140,30,0.8)' : 'rgba(255,215,60,0.75)'; ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.quadraticCurveTo(x, y - h * 2, x + 2.5, y); ctx.fill(); }
      } else if (!t.spent) { ctx.fillStyle='rgba(40,30,15,0.45)'; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.65, t.seed, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(20,20,20,0.35)'; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.65, t.seed, 0, 7); ctx.fill(); }
    }
  }
  for (const b of Sim.bases || []) {
    if (!vis(b)) continue;
    ctx.globalAlpha = 0.8;
    if (b.tower) { const x = b.x + b.r * 0.85, y = b.y - b.r * 0.4;
      ctx.fillStyle = '#7a5a36'; ctx.fillRect(x - 2.5, y - 12, 5, 14); ctx.fillStyle = '#5a3f22'; ctx.fillRect(x - 4, y - 15, 8, 3.5);
      ctx.fillStyle = b.k.color; ctx.fillRect(x - 0.5, y - 21, 4, 3); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 0.6, y - 21, 0.9, 6); }
    if (b.forge) { const x = b.x - b.r * 0.55, y = b.y + b.r * 0.35;
      ctx.fillStyle = '#444'; ctx.fillRect(x - 4, y - 2, 8, 3); ctx.fillRect(x - 1.5, y + 1, 3, 3);
      if (simdi % 40<6) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(x + 2, y - 4, 1.2, 0, 7); ctx.fill(); } }
    if (b.hosp) { const x = b.x + b.r * 0.3, y = b.y + b.r * 0.55;
      ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 3); ctx.lineTo(x - 6, y + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d62828'; ctx.fillRect(x - 0.8, y - 2.5, 1.6, 4.5); ctx.fillRect(x - 2.2, y - 1.1, 4.4, 1.6); }
    ctx.globalAlpha = 1;
  }
  if (z > 0.5) for (const p of Sim.people) {
    if (p.dead || !vis(p) || (p.state !== 'wounded' && p.state !== 'healing')) continue;
    if (p.state === 'wounded' && !p.carrier) { ctx.fillStyle = 'rgba(140,10,10,0.45)'; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 2, 4, 2.5, p.id, 0, 7); ctx.fill(); }
    ctx.fillStyle = p.state === 'healing' ? '#2a9d8f' : '#d62828';
    ctx.fillRect(p.x - 0.7, p.y - 9, 1.4, 4); ctx.fillRect(p.x - 2, p.y - 7.7, 4, 1.4);
  }
}

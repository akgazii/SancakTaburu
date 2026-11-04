function cpInit() {

  let v = null;
  try {
    v = localStorage.getItem('krallik.cplan');
    if (localStorage.getItem('krallik.cplanV')!=='2') { localStorage.setItem('krallik.cplanV', '2'); localStorage.removeItem('krallik.cplan'); v = null; }
  } catch {}
  Sim.cplan = v == null ? true : v === '1';
  Sim.bases = Sim.bases || [];
  Sim.msgs = Sim.msgs || [];
}
function cpSet(on)
{
  Sim.cplan = on;
  try { localStorage.setItem('krallik.cplan', on ? '1' : '0'); } catch {}
  if (on) return;
  Sim.bases = [];
  for (const m of [...(Sim.msgs || [])]) courierEnd(m);
  for (const A of allArmies()) {
    if (A.order && A.order.cp) A.order = null;
    A.cp = null; A.cpBase = null;
  }
}
cpInit();

const BAL_R = 480;
function attackerOf(A)
{
  const ok = X => X && X.members && X.members.length && X.cmd && X.k.armies.includes(X) && hostile(A.k, X.k);
  if (A.hitT > Sim.tick - 300 && ok(A.hitBy)) return A.hitBy;
  if (A.shotT > Sim.tick - 300 && ok(A.shotBy)) return A.shotBy;
  if (A.battle && Sim.battles.includes(A.battle)) return bArmies(A.battle, 1 - A.bside)[0] || null;
  return null;
}
const threatFoe = A => attackerOf(A) || nearestFoeArmy(A);
function forceAt(A, F, kendi) {
  kendi = kendi || [A];
  const k = A.k, cs = kendi.map(X => X.cmd).filter(Boolean), R2 = BAL_R * BAL_R;
  const nearUs = X => cs.some(c => dist2(X.cmd, c) < R2);
  const nearF = X => F && F.cmd && dist2(X.cmd, F.cmd) < 420 * 420;
  const sameFight = X => kendi.some(Y => Y.battle && X.battle === Y.battle);
  let mN = 0, mP = 0, fN = 0, fP = 0;
  for (const X of allArmies()) {
    if (!X.members.length || !X.cmd || X.state === "sail") continue;
    if (kendi.includes(X)) { mN += X.members.length; mP += power(X.members); continue; }
    if (hostile(k, X.k)) {
      const attacking = X === F || sameFight(X) || kendi.some(Y => (Y.hitBy === X && Y.hitT > Sim.tick - 300) || (Y.shotBy === X && Y.shotT > Sim.tick - 300));
      if (!attacking && ((!nearUs(X) && !nearF(X)) || unseen(X, k))) continue;
      let w = 1;
      if (!attacking) {
        if (routing(X) || X.state === 'retreat') w = 0.3;
        else if (X.battle) w = 0.5;
      }
      fN += X.members.length * w; fP += power(X.members) * w;
    } else if (cpFriend(A, X) && (nearUs(X) || sameFight(X))) {
      if (routing(X) || X.state === 'retreat' || X.lastStand || (X.cp && X.cp.phase === 'escape')) continue;
      let w=X.k === k ? 1 : 0.8;
      if (X.battle && !sameFight(X)) w *= 0.3;
      else if (X.manual && X.order && !X.order.cp && !sameFight(X)) w *= 0.6;
      mN += X.members.length * w; mP += power(X.members) * w;
    }
  }
  const r = [Math.sqrt(mN * mP) || 0, Math.sqrt(fN * fP) || 1];
  r.mN = Math.round(mN); r.fN = Math.round(fN);

  return r;
}
const cpPowers = (A, F) => forceAt(A, F);

const balTxt=(b, inner) => b && b.fN ? (inner ? lang`, bölgede ~${b.mN} askerimize karşı ~${b.fN} düşman` : lang` (bölgede ~${b.mN} askerimize karşı ~${b.fN} düşman)`) : '';

function cpBase(A, x = A.cmd.x, y = A.cmd.y)
{
  const yakin=Sim.bases.find(b => b.k === A.k && dist2(b, { x, y }) < 250 * 250);
   if (yakin) { yakin.A = A; return yakin; }
  if (!speedAt(x, y)) return null;
  const b = { k: A.k, A, x, y, r: clamp(16 + A.members.length * 0.35, 18, 42), until: Sim.tick + 800, n: clamp(Math.round(A.members.length / 6), 3, 10) };
   Sim.bases.push(b);
  return b;
}

function cpManual(A)
{
  if (!Sim.cplan || A.lv || A.state === "battle" || A.state === 'retreat') return false;
  const cp = A.cp;
   if (A.order && !A.order.cp) { if (cp && cp.phase !== 'flankwait') cp.phase = 'done'; return false; }
  if (cp && cp.phase === 'escape') return true;
  if (cp && cp.phase === 'stand') { A.order = null; cp.phase = 'done'; }
  if (cp && cp.phase === 'join') return true;
  if (cp && cp.phase === 'wavewait') return true;
  if (A.headless) return cpHeadlessTick(A);
  if (cp && (cp.phase === 'react' || cp.phase === 'help')) {
    if (cp.phase === 'help' && A.order && cp.helpB && Sim.battles.includes(cp.helpB)) return true;
    cpResume(A); return true;
  }
  if (cp && (cp.phase === 'await' || cp.phase === 'pact' || cp.phase === 'host')) return cpWaitTick(A);

  const F = threatFoe(A);
  if (cp && cp.phase === 'flankwait') {
    const Pa = cp.parent;
    if (!Pa || !Pa.members.length || !Pa.k.armies.includes(Pa) || Sim.tick - cp.t0 > 2500) { if (F) cpLaunchFlank(A, F); else cp.phase = 'done'; }
    return true;
  }
  if (cp && (cp.phase === "done" || (cp.phase === 'attack' && !A.order)) && cp.waveOf && armyAlive(cp.waveOf) && cp.waveOf !== A && cp.waveOf.k === A.k && !cp.waveOf.battle) {
    const W = cp.waveOf; cp.waveOf=null;

    A.joinTo = W; A.joinUntil=Sim.tick + 2000; cp.phase = 'join';
    A.order = { type: 'move', path: cpRoute(A.cmd, W.cmd), i: 0, t: 0, cp: true };
    return true;
  }
  if (!cp || cp.phase === 'done') {
    if (!F || (cp && Sim.tick - cp.t0 < 500)) return false;
    const eski = Sim.bases.find(b => b.k === A.k && dist2(b, A.cmd) < 250 * 250);
    A.cp = { phase: eski ? 'decide' : 'camp', t0: Sim.tick, base: cpBase(A), foe: F };
     if (!eski) {
      say(A.cmd, '⛺', 160);
      chron(lang`⛺ ${A.k.name} ordusu ordugâh kurdu; komutan ${fullName(A.cmd)} düşmanı gözlüyor`, A.k);
    }
    A.state = 'idle'; A.foeArmy = null;
    return true;
  }
  if (!F) return false;
  const bal = cpPowers(A, F), [mine, dusman] = bal, oran = mine / dusman;
  cp.bal = bal;
  if (cp.phase==='camp') {
    A.state = 'idle'; A.foeArmy = null;
    const d2F = dist2(A.cmd, F.cmd);
    if (!cp.solo && !cp.group && Sim.tick - cp.t0 >= 40 && d2F > 480 * 480 && cpTryGroup(A, F, true)) return true;
    const inc = cp.msgIn && Sim.msgs.includes(cp.msgIn) && !cp.msgIn.p.dead && cp.msgIn.stage !== "back" && dist2(cp.msgIn.p, A.cmd) < 700 * 700 ? cp.msgIn : null;
    if (inc && d2F > 320 * 320 && Sim.tick - cp.t0 < 1500) { if (!cp.waitSaid) { cp.waitSaid = true; say(A.cmd, '👀', 120); } return true; }
    if (Sim.tick - cp.t0 > 200 || d2F < 320 * 320) cp.phase = 'decide';
    return true;
  }
  if (cp.phase === 'decide') {
    const inc = cp.msgIn && Sim.msgs.includes(cp.msgIn) && !cp.msgIn.p.dead && cp.msgIn.stage !== 'back' && dist2(cp.msgIn.p, A.cmd) < 800 * 800 ? cp.msgIn : null;
    if (inc && cp.waitFor !== inc) {
      cp.waitFor=inc; cp.waitIn = Sim.tick;
      cp.waitOk = Math.random() < clamp(0.45 + (cmdInt(A.cmd) - 5) * 0.08 + (cmdTrait(A.cmd) === CMD_TRAITS.bold ? -0.2 : 0), 0.1, 0.9);
      if (cp.waitOk) { say(A.cmd, '👀', 120); chron(lang`👀 ${A.k.name} komutanı ${rankName(A.cmd)} yaklaşan dost mesajcıyı gördü; mektubu okumadan karar vermemek için planını erteledi`, A.k); }
    }
    if (inc && cp.waitOk && cp.waitFor === inc && !cp.group && dist2(A.cmd, F.cmd) > 320 * 320 && Sim.tick - cp.waitIn < 1500) { A.state = 'idle'; A.foeArmy = null; return true; }
    if (!cp.group && !cp.solo && cpTryGroup(A, F)) return true;
    const G = cpGroupOf(A);
    if (G) {
       if (G.leader === A) cpGroupDecide(G, F);
      else if (Sim.tick - G.t0>400) cp.group = null;
      else A.state = 'idle';
       return true;
    }
    if (oran >= trOf(A).atk) cpAttack(A, F, oran); else cpDefend(A, F);
    return true;
  }
  if (cp.phase==='ambush') { A.state = "idle"; A.foeArmy=null; return true; }
  if (cp.phase === "defend") {
    const G = cpGroupOf(A);
    if (G) {
      if (G.leader === A) { const [m, f] = cpGroupPowers(G, F); if (m / f >= 1.15) cpGroupDecide(G, F, true); }
    } else if (oran >= 1.15) {
      chron(lang`🔄 ${A.k.name} komutanı ${rankName(A.cmd)} artık üstün olduklarını fark etti: savunmayı bırakıp saldırıya geçiyor`, A.k, F.k);
      cpAttack(A, F, oran); cpRally(A, F, oran); return true;
    }
    if (!G && cpSapApproach(A, F, oran)) return true;
    if (!A.order) cp.phase = 'done';
    return !!A.order;
  }
  if (cp.phase === 'attack') {
    if (!A.order) cp.phase = 'done';
    return !!A.order;
  }

  return false;
}

function cpRoute(from, to) {
  const p = findPath(from.x, from.y, to.x, to.y);
  return resample([{ x: from.x, y: from.y }, ...(p && p.length ? p : []), { x: to.x, y: to.y }], 18);
}
function cpAttack(A, F, oran, via, quiet) {
  const ates = A.vic || A.ww, sap = !via && sapRoute(A, F);
  if (!via && !quiet && !ates && !A.cp.flank && !A.cp.group && A.members.length >= 24 && oran >= 1.25 && (cmdInt(A.cmd) + rnd(-2, 2) >= 6 || rankOf(A.cmd).lv >= 2) && Math.random() < 0.4 + trOf(A).ambush && cpEncircle(A, F, oran)) return;
  const waved = !via && !ates && !A.cp.group && !A.cp.waves && cpWaves(A, F);
  const c = A.cmd, dir = Math.atan2(F.cmd.y - c.y, F.cmd.x - c.x), px = -Math.sin(dir), py = Math.cos(dir);
  let yazi = waved ? lang`ilk dalga cepheden yüklenecek, ${A.cp.waveArmies.length} dalga arkadan sırayla gelecek` : lang('ana kuvvet cepheden saldıracak');
  const cav = A.members.filter(p => isCav(p) && p !== c);

  if (!A.cp.flank && cav.length >= 3 && A.members.length - cav.length >= 4) {
    const open = s => { let n = 0; for (let d=40; d <= 160; d += 30) if (speedAt(F.cmd.x + px * s * d, F.cmd.y + py * s * d)) n++; return n; };
    let cy = 0; for (const p of cav) cy += (p.x - c.x) * px + (p.y - c.y) * py;
    let taraf = cy >= 0 ? 1 : -1;
    if (open(taraf) < 2 && open(-taraf) > open(taraf)) taraf = -taraf;
    const D = cpDetach(A, cav);
    const w = { x: F.cmd.x + px * taraf * 130 - Math.cos(dir) * 30, y: F.cmd.y + py * taraf * 130 - Math.sin(dir) * 30 };
    const rear = { x: F.cmd.x + Math.cos(dir) * 50, y: F.cmd.y + Math.sin(dir) * 50 };
    D.cp={ phase: 'flankwait', t0: Sim.tick, parent: A, side: taraf, w, rear };
    D.cp.route=[{ x: D.cmd.x, y: D.cmd.y }, { x: D.cmd.x + px * taraf * 80, y: D.cmd.y + py * taraf * 80 }, w, rear];
    D.order = { type: 'hold', x: D.cmd.x + px * taraf * 40, y: D.cmd.y + py * taraf * 40, dir, t: 0, trench: true, cp: true };
    A.cp.flank=D;
    yazi += lang`, süvari ${taraf > 0 ? lang('sağ') : lang('sol')} kanattan dolanıp arkadan vuracak`;
  }
  const yol = via && speedAt(via.x, via.y) ? [...cpRoute(c, via), ...resample([via, F.cmd], 18).slice(1)]
    : sap ? [...sap, ...cpRoute(sap[sap.length - 1], F.cmd).slice(1)] : cpRoute(c, F.cmd);
  if (sap) yazi += lang(', piyade siper yolundan eğilerek ilerleyip düşmanın dibinden hücuma kalkacak');
  A.order={ type: 'attack', path: yol, i: 0, phase: 'go', t: 0, cp: true, sapN: sap ? sap.length : 0 };
  A.cp.phase = 'attack'; A.cp.foe = F;
  cpReform(A, "attack", true);
  say(c, '📜', 150);
  if (!quiet) chron(lang`📜 ${A.k.name} komutanı ${rankName(c)} saldırı planı yaptı (güç ${oran >= 1.5 ? lang('çok üstün') : oran >= 1.1 ? lang('üstün') : lang('denk')}${balTxt(A.cp.bal, true)}): ${yazi}`, A.k, F.k);
}
function cpLaunchFlank(D, F)
{
  const cp = D.cp, dir = Math.atan2(F.cmd.y - D.cmd.y, F.cmd.x - D.cmd.x), px = -Math.sin(dir), py = Math.cos(dir);
  cp.w = { x: F.cmd.x + px * cp.side * 130 - Math.cos(dir) * 30, y: F.cmd.y + py * cp.side * 130 - Math.sin(dir) * 30 };
  cp.rear = { x: F.cmd.x + Math.cos(dir) * 50, y: F.cmd.y + Math.sin(dir) * 50 };
  const noktalar = [{ x: D.cmd.x, y: D.cmd.y }, { x: D.cmd.x + px * cp.side * 90, y: D.cmd.y + py * cp.side * 90 }, cp.w, cp.rear].map(p => speedAt(p.x, p.y) ? p : null).filter(Boolean);
  D.order = { type: "attack", path: resample(noktalar.length > 1 ? noktalar : [D.cmd, F.cmd], 18), i: 0, phase: "go", t: 0, cp: true, flank: true }
  cp.phase = 'done'; cp.t0 = Sim.tick;
  say(D.cmd, '🐎', 150);
  chron(lang`🐎 ${D.k.name} süvarisi plan gereği ${cp.side > 0 ? lang('sağ') : lang('sol')} kanattan dolanmaya başladı`, D.k, F.k);
}
function cpDefend(A, F, at, quiet) {
  const b=A.cp.base || { x: A.cmd.x, y: A.cmd.y, r: 20 }; let dir = at ? at.dir : Math.atan2(F.cmd.y - b.y, F.cmd.x - b.x);
  let x = at ? at.x : b.x + Math.cos(dir) * (b.r + 30), y=at ? at.y : b.y + Math.sin(dir) * (b.r + 30), ground = null;
  if (!speedAt(x, y)) { x = A.cmd.x; y = A.cmd.y; }
  if (!at && !A.headless && Math.random() < terrainChance(A)) {
    const ch = findChoke(A, F), hl = ch ? null : findHill(A, b, dir);
    if (ch) { x = ch.x - Math.cos(ch.dir) * 20; y = ch.y - Math.sin(ch.dir) * 20; dir = ch.dir; ground = lang`🏔 ${A.k.name} komutanı ${rankName(A.cmd)} ${Math.round(ch.w)} adım genişliğindeki dar geçidi tutuyor: düşman oradan ancak dar bir kolla geçebilir`; }
    else if (hl) { x = hl.x; y = hl.y; dir = Math.atan2(F.cmd.y - y, F.cmd.x - x); ground = lang`⛰ ${A.k.name} komutanı ${rankName(A.cmd)} yakındaki tepeye çıkıp yukarıdan savunuyor`; }
  }
  const px = -Math.sin(dir), py = Math.cos(dir), gap = frontHalf(A, meleeCount(A)) * 2 + 30;
  const taken = (x0, y0) => allArmies().some(X => X !== A && X.order && X.order.cp && X.order.type === 'hold' && !X.order.hide && cpFriend(A, X) && (X.order.x - x0) ** 2 + (X.order.y - y0) ** 2 < (gap * 0.8) ** 2);
  for (let k = 1; k <= 6 && taken(x, y); k++) {
    const s = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * gap, nx = x + px * s, ny = y + py * s;
    if (speedAt(nx, ny) && !taken(nx, ny)) { x = nx; y = ny; break; }
  }
  A.order = { type: 'hold', x, y, dir, t: 0, cp: true };
  A.cp.phase='defend'; A.cp.foe = F;
  cpReform(A, 'defend', true);
  say(A.cmd, '⛏', 150);
  if (ground) chron(ground, A.k, F.k);
  else if (!quiet) chron(lang`🛡 ${A.k.name} komutanı ${rankName(A.cmd)} düşmanın güçlü olduğunu görüp${balTxt(A.cp.bal)} savunma planı yaptı: ordugâhın önüne hendek kazıp hat kuruyor`, A.k, F.k);
}
function cpSapApproach(A, F, oran) {
  const cp = A.cp, o = A.order;
  if (!A.ww || !o || o.type !== 'hold' || !o.cp) return false;
  if (cp.sapAtk) {
    const s = A.saps && A.saps[A.saps.length - 1], ready = s && s.prog >= 1 && Sim.trenches.includes(s) && dist2(s.end, F.cmd) < 190 * 190;
    if (!ready && Sim.tick - cp.sapT < 4000) return false;
    cp.sapAtk = false;

    chron(ready ? lang`⛏ ${A.k.name} hendekçilerinin siper yolu ${F.k.name} siperinin dibine vardı: komutan ${rankName(A.cmd)} piyadeyi o yoldan saldırıya sürüyor`
      : lang`⛏ ${A.k.name} siper yolu yarım kaldı; komutan ${rankName(A.cmd)} daha fazla beklemeden saldırı emri verdi`, A.k, F.k);
    cpAttack(A, F, oran, null, true);
    return true;
  }
  if (cp.sapDone || A.nSap < 2 || !entrenched(A) || !entrenched(F) || Sim.tick - cp.t0 < 500 || (Sim.tick / 5 + A.id) % 20) return false;
  const d = dist(A.cmd, F.cmd);
  if (d < 420) return false;
  cp.sapDone = true;
  if (Math.random() > clamp(0.45 + (cmdInt(A.cmd) - 5) * 0.1, 0.2, 0.9)) return false;
  const t = (d - 300) / d, at = { x: A.cmd.x + (F.cmd.x - A.cmd.x) * t, y: A.cmd.y + (F.cmd.y - A.cmd.y) * t, dir: Math.atan2(F.cmd.y - A.cmd.y, F.cmd.x - A.cmd.x) };
  if (!speedAt(at.x, at.y)) return false;
  A.trench = null; A.saps = null;
  cpDefend(A, F, at, true);
  cp.sapAtk = true; cp.sapT = Sim.tick;
  chron(lang`⛏ ${A.k.name} komutanı ${rankName(A.cmd)}: iki taraf da siperde, açıktan yürümek ölüm. Ordu düşmanın 300 adım yakınına yeni siper kazacak, hendekçiler oradan düşman siperine doğru siper yolu açacak`, A.k, F.k)
  return true;
}
function cpDetach(A, ps) {
  for (const p of ps) { leaveArmy(p); p.flee=0; }
  const cmd = pickCmd(ps);
  const D = { id: Sim.nextArmy++, k: A.k, enemy: null, target: null, cmd, members: ps, start: ps.length, plan: 'attack', raid: false,
    state: 'idle', t: 0, cap: 0, morale: 100, btac: 'charge', btacSet: true, form: 'wedge', foeArmy: null, battle: null,
    massacre: false, manual: true, home: { x: cmd.x, y: cmd.y } };
  sortRanks(D); sortRanks(A);
  A.k.armies.push(D);
  return D;
}

const cpFriend = (A, X) => X.k === A.k || (A.k.rel && A.k.rel.get(X.k) && A.k.rel.get(X.k).status === 'alliance');
const cpHidden = A => !!(A && ((A.cp && A.cp.hidden) || A.hidFrac >= 0.8));
const spotBy = (O, k) => O.spotK === k && Sim.tick - (O.spotT || 0) < 1500;
const unseen = (O, k) => cpHidden(O) && !spotBy(O, k);
const GTYPE={ attack: '🤝 Ortak taarruz', defend: '🛡 Ortak savunma', ambush: '🌲 Ortak pusu', encircle: '🎯 Dört yandan kuşatma' };
function cpGroupOf(A) {
  const G = A.cp && A.cp.group;
  if (!G) return null;
  G.armies = G.armies.filter(X => X.members.length && X.k.armies.includes(X) && X.cp && X.cp.group === G);
  if (G.armies.length < 2) { for (const X of G.armies) X.cp.group = null; return null; }
  if (!G.armies.includes(G.leader)) G.leader = G.armies[0];
  return G;
}
function cpTryGroup(A, F, early) {
  if (A.cp.msgIn) return false;
   if (dist2(A.cmd, F.cmd) < 380 * 380) return false;
  const mates = allArmies().filter(X => X !== A && X.manual && !X.lv && !X.headless && X.members.length && X.cmd && X.state !== 'battle' && X.state !== 'retreat'
    && X.cp && !X.cp.group && !X.cp.msgIn && ['camp', 'decide', 'defend'].includes(X.cp.phase) && cpFriend(A, X) && dist2(X.cmd, A.cmd) < (early ? 900 : 1400) ** 2)
    .sort((a, b) => dist2(a.cmd, A.cmd) - dist2(b.cmd, A.cmd));

  if (!mates.length) return false;
  A.cp.solo = true;
  const tr = cmdTrait(A.cmd), trB = tr === CMD_TRAITS.cunning || tr === CMD_TRAITS.cautious ? 0.1 : tr === CMD_TRAITS.bold ? -0.1 : tr === CMD_TRAITS.stubborn ? -0.15 : 0;
  const chance = clamp(0.35 + (cmdInt(A.cmd) - 5) * 0.07 + (mates[0].k === A.k ? 0.1 : 0) + (early ? 0.15 : 0) + trB, 0.15, 0.85);
  if (Math.random() > chance) return false;
  return cpSendCourier(A, mates[0], cpProposal(A, mates[0], F), F);
}
const cpGroupPowers = (G, F) => forceAt(G.leader, F, G.armies);
function cpAmbushSpot(bait, F, taraf, used) {
  const dx = F.cmd.x - bait.cmd.x, dy = F.cmd.y - bait.cmd.y, d = Math.hypot(dx, dy) || 1, px = -dy / d, py = dx / d;
  for (let i = 0; i < 60; i++) {
    const t = rnd(0.15, 0.6), off = rnd(70, 170) * taraf;
    const x = bait.cmd.x + dx * t + px * off, y = bait.cmd.y + dy * t + py * off, ter = terrainAt(x, y);
    if ((ter === T_FOREST || ter === T_HILLS) && speedAt(x, y) && dist2({ x, y }, F.cmd) > 200 * 200 && !used.some(u => dist2(u, { x, y }) < 60 * 60)) return { x, y };
  }
  return null;
}
function cpGroupDecide(G, F, again, force) {
  const [mine, dusman] = cpGroupPowers(G, F), oran = mine / dusman, n = G.armies.length;
  const c = { x: 0, y: 0 };
  for (const X of G.armies) { c.x += X.cmd.x / n; c.y += X.cmd.y / n; }
  const yon = Math.atan2(F.cmd.y - c.y, F.cmd.x - c.x), px = -Math.sin(yon), py = Math.cos(yon);
  const across = X => (X.cmd.x - c.x) * px + (X.cmd.y - c.y) * py;

  G.foe = F;

  if (force === 'ambush' || (!force && !again && cmdInt(G.leader.cmd) + rnd(-2, 2) >= 5.5 && Math.random() < 0.45 + trOf(G.leader).ambush)) {
    const bait = G.armies.reduce((a, b) => dist2(a.cmd, F.cmd) < dist2(b.cmd, F.cmd) ? a : b), used = [], yerler = [];
    for (const [i, X] of G.armies.filter(X => X !== bait).entries()) {
      const s = cpAmbushSpot(bait, F, i % 2 ? -1 : 1, used) || cpAmbushSpot(bait, F, i % 2 ? 1 : -1, used);
      if (!s) { yerler.length = 0; break; }
      used.push(s); yerler.push([X, s]);
    }
    if (yerler.length) {
      G.type = 'ambush';
      if (oran>=1.1) cpAttack(bait, F, oran, null, true); else cpDefend(bait, F, null, true);

      bait.cp.bait = true;
      for (const [X, s] of yerler) {
        X.order = { type: 'hold', x: s.x, y: s.y, dir: Math.atan2(F.cmd.y - s.y, F.cmd.x - s.x), t: 0, trench: true, cp: true, hide: true };
        X.cp.phase = 'ambush'; X.cp.hidden = true; X.cp.t0 = Sim.tick; X.cp.foe = F;
        say(X.cmd, '🤫', 160);
      }
      chron(lang`🌲 Ortak pusu: ${bait.k.name} ordusu yem olup ${oran >= 1.1 ? lang('düşmanın üstüne yürüyor') : lang('ordugâhında bekliyor')}; ${yerler.map(([X]) => X.k.name).join(', ')} ordusu ormana gizlendi, ${F.k.name} yeme dalınca yandan çullanacak`, G.leader.k, F.k);
      return;
    }
  }
  const emir = [...G.armies].sort((a, b) => across(a) - across(b));
  if (force === 'attack' ? oran >= 0.7 : force === 'defend' ? oran >= 1.6 : oran >= trOf(G.leader).atk) {
    G.type = "attack";
    emir.forEach((X, i) => {
      const lat = (i - (n - 1) / 2) * 120, via = { x: F.cmd.x - Math.cos(yon) * 80 + px * lat, y: F.cmd.y - Math.sin(yon) * 80 + py * lat };
      cpAttack(X, F, oran, lat ? via : null, true);
    });
    chron(lang`🤝 Ortak taarruz: ${G.armies.map(X => X.k.name).join(' + ')} orduları ${F.k.name} ordusunu ${n > 2 ? lang('üç') : 'iki'} yönden kıskaca alacak (güç ${oran >= 1.5 ? lang("çok üstün") : oran >= 1.1 ? lang('üstün') : lang('denk')})`, G.leader.k, F.k);
    return;
  }
  G.type = 'defend';
  const gap = Math.max(70, ...G.armies.map(X => frontHalf(X, meleeCount(X)) * 2 + 20));
  emir.forEach((X, i) => {
    let at = { x: c.x + Math.cos(yon) * 30 + px * (i - (n - 1) / 2) * gap, y: c.y + Math.sin(yon) * 30 + py * (i - (n - 1) / 2) * gap, dir: yon };
    if (!speedAt(at.x, at.y)) at = null;
    cpDefend(X, F, at, true);
  });
  chron(lang`🛡 Ortak savunma: ${G.armies.map(X => X.k.name).join(' + ')} orduları güçlü ${F.k.name} ordusuna karşı yan yana tek bir hat kurup hendek kazıyor`, G.leader.k, F.k);
}
function cpSpring(X)
{
  const G = X.cp.group, F = (X.cp.foe && X.cp.foe.members.length) ? X.cp.foe : nearestFoeArmy(X);
  X.cp.hidden = false; X.cp.phase = 'attack';
  if (!F) { X.order = null; X.cp.phase = 'done'; return; }
  X.order = { type: "attack", path: resample([{ x: X.cmd.x, y: X.cmd.y }, { x: F.cmd.x, y: F.cmd.y }], 18), i: 0, phase: 'go', t: 0, cp: true };
  say(X.cmd, '⚔️', 150);
  const B = F.battle;
  if (B && Sim.battles.includes(B)) {
    joinBattle(X, B, 1 - F.bside);
    B.ambushT = Sim.tick; B.ambushSide = 1 - F.bside;
  }
  chron(lang`🌲 PUSU! ${X.k.name} askerleri ağaçların arasından çıkıp ${F.k.name} ordusunun ${B ? lang('yanına') : lang('üstüne')} çullandı${G && G.type === 'ambush' ? lang(' (ortak plan)') : ''}!`, X.k, F.k);
}

function cpEncircle(A, F, oran) {
  const c = A.cmd, yon = Math.atan2(F.cmd.y - c.y, F.cmd.x - c.x), px = -Math.sin(yon), py = Math.cos(yon), cd = Math.cos(yon), sd = Math.sin(yon);
  const n = A.members.length, four = n >= 40;
  const inf = A.members.filter(p => p !== c && ['soldier', 'spear', 'shield', 'rifle'].includes(p.job)), cav = A.members.filter(p => p !== c && isCav(p));
  const take = (liste, k) => liste.splice(0, Math.max(0, Math.min(liste.length, k)));
  const kW = Math.round(n * (four ? 0.2 : 0.25));
  const sol = take(inf, kW), right = take(inf, kW);
  const rear = four ? (cav.length >= 4 ? take(cav, cav.length) : take(inf, Math.round(n * 0.16))) : [];
  if (sol.length < 4 || right.length < 4 || (four && rear.length < 4)) { for (const p of [...sol, ...right, ...rear]) p.army = A; return false; }
  const open = s => { let k = 0; for (let d = 60; d <= 180; d += 40) if (speedAt(F.cmd.x + px * s * d, F.cmd.y + py * s * d)) k++; return k; };
  const rs = open(1) >= open(-1) ? 1 : -1;
  const at = (lat, fwd) => ({ x: F.cmd.x + px * lat + cd * fwd, y: F.cmd.y + py * lat + sd * fwd });
  const legs = [
    [sol, [at(-140, -40)]],
    [right, [at(140, -40)]],
    ...(four ? [[rear, [at(rs * 170, 0), at(rs * 60, 110)]]] : []),
  ];
   const G = { leader: A, armies: [A], type: 'encircle', foe: F, t0: Sim.tick };
  for (const [ps, vias] of legs) {
    const D = cpDetach(A, ps);
    const pts = [{ x: D.cmd.x, y: D.cmd.y }, ...vias.filter(v => speedAt(v.x, v.y)), { x: F.cmd.x, y: F.cmd.y }];
    const yol = [...cpRoute(pts[0], pts[1]), ...resample(pts.slice(1), 18).slice(1)];
    D.order={ type: 'attack', path: yol, i: 0, phase: "go", t: 0, cp: true, flank: ps === rear };
    D.cp = { phase: 'attack', t0: Sim.tick, foe: F, group: G, waveOf: A };
    G.armies.push(D);
  }
  A.cp.group = G; A.cp.flank = true;
  A.order = { type: 'attack', path: cpRoute(c, F.cmd), i: 0, phase: 'go', t: 0, cp: true };
  A.cp.phase = 'attack'; A.cp.foe = F;
  say(c, '🎯', 160);
  chron(lang`🎯 ${A.k.name} komutanı ${rankName(c)} ordusunu ${four ? lang('dörde') : lang('üçe')} böldü: cephe${four ? lang(', sol, sağ ve arka') : lang(", sol ve sağ")} kollar ${F.k.name} ordusunu ${four ? lang('dört') : lang('üç')} yandan kuşatacak`, A.k, F.k);
  return true;
}

function cpSacrificeCheck(B) {
   for (const s of [0, 1]) for (const X of bArmies(B, s)) {
    if (X.lv || X.lastStand || X.sacTried || X.members.length < 10 || B.t < 300) continue;
    if (!(X.left < 0.7 && X.ratio < 0.65)) continue;
    X.sacTried = true;
    const Fr = allArmies().filter(Y => Y !== X && Y.members.length && Y.cmd && !Y.battle && Y.state !== 'sail' && cpFriend(X, Y)
      && dist2(Y.cmd, X.cmd) < 1500 * 1500 && power(Y.members) >= power(X.members) * 0.8)
      .sort((a, b) => dist2(a.cmd, X.cmd) - dist2(b.cmd, X.cmd))[0];
    if (!Fr || Math.random() > clamp(0.35 + (cmdInt(X.cmd) - 5) * 0.08, 0.15, 0.8)) continue;
    const havuz = X.members.filter(p => p !== X.cmd).sort((a, b) => (bj(a) === 'soldier' ? 0 : 1) - (bj(b) === 'soldier' ? 0 : 1));
    const rear = havuz.slice(0, Math.max(3, Math.round(X.members.length * 0.35)));
    if (rear.length>=X.members.length - 2) continue;
    const R = cpDetach(X, rear), O = bArmies(B, 1 - s)[0];
    joinBattle(R, B, s); B.start[s] -= R.members.length;
    R.lastStand = true; R.rush = true;
    const yon = O ? Math.atan2(O.cmd.y - R.cmd.y, O.cmd.x - R.cmd.x) : R.cmd.a;
    R.order = { type: 'hold', x: R.cmd.x, y: R.cmd.y, dir: yon, t: 0, trench: true, cp: true };
    R.cp = { phase: 'stand', t0: Sim.tick };
    leaveBattle(B, X, false);
    X.escapeUntil=Sim.tick + 1800; X.joinTo = Fr;
    X.order = { type: 'move', path: cpRoute(X.cmd, Fr.cmd), i: 0, t: 0, cp: true };
    X.cp = { phase: 'escape', t0: Sim.tick };
    say(R.cmd, '🛡', 200); say(X.cmd, '🏃', 160);
    chron(lang`🛡 ${X.k.name} ordusu sıkıştı! ${R.members.length} asker geride kalıp kendini feda ederek düşmanı tutuyor, kalan ${X.members.length} kişi ${Fr.k === X.k ? 'kendi' : lang`müttefik ${Fr.k.name}`} ordusunun yanına çekiliyor`, X.k, O && O.k, B.place);
  }
}
function cpEscapeTick(X) {
  const Fr = X.joinTo;
  if (!Fr || !Fr.members.length || !Fr.k.armies.includes(Fr)) { X.joinTo = null; X.order = null; if (X.cp) X.cp.phase = 'done'; return; }
  if (X.order && X.order.type === "move" && X.order.path) { const e = X.order.path[X.order.path.length - 1]; if (dist2(e, Fr.cmd) > 120 * 120) X.order.path = cpRoute(X.cmd, Fr.cmd), X.order.i = 0; }
  if (dist2(X.cmd, Fr.cmd) > 90 * 90 && Sim.tick < (X.joinUntil || X.escapeUntil + 1500)) return;
  X.joinTo = null; X.escapeUntil = 0; X.joinUntil = 0;
   if (Fr.k === X.k) {
    const ps=X.members.slice();

    for (const p of ps) { p.army = Fr; Fr.members.push(p); }
    X.members = []; Fr.start += ps.length;
    X.k.armies = X.k.armies.filter(Y => Y !== X);
    sortRanks(Fr);
    chron(lang`🤝 ${X.k.name}: çekilen ${ps.length} asker dost orduya katıldı`, X.k);
  } else { X.order=null; if (X.cp) X.cp.phase = 'done'; }
}

function cpRally(A, F, oran)
{
  const mates=allArmies().filter(X => X !== A && X.manual && !X.lv && !X.lastStand && !X.headless && X.members.length && X.cmd && !X.battle && X.state !== 'retreat'
    && (!X.order || X.order.cp) && !(X.cp && ['flankwait', 'wavewait', 'escape', 'ambush'].includes(X.cp.phase)) && cpFriend(A, X) && dist2(X.cmd, A.cmd) < 350 * 350);
  for (const X of mates) { if (!X.cp) X.cp = { phase: 'decide', t0: Sim.tick }; X.cp.group = null; cpAttack(X, F, oran, null, true); }
  if (mates.length) chron(lang`🤝 ${mates.length} dost ordu da ${A.k.name} komutanının çağrısıyla saldırıya katıldı`, A.k, F.k);
}
function cpRethinkAttack(A, o) {
  if (A.battle || A.headless || o.phase !== 'go' || o.flank || A.lv || !A.cp || A.cp.phase !== 'attack' || !A.members.length) return;
  if ((Sim.tick / 5 + A.id) % 8 || Sim.tick - (A.cp.rethinkT || A.cp.t0 || 0) < 300) return;
  const F = attackerOf(A) || (A.cp.foe && A.cp.foe.members.length && A.cp.foe.k.armies.includes(A.cp.foe) ? A.cp.foe : nearestFoeArmy(A));
  if (!F) return;
  A.cp.rethinkT = Sim.tick;
  if (Math.random() > clamp((0.25 + (cmdInt(A.cmd) - 5) * 0.08) * trOf(A).rethink, 0.05, 0.8)) return;
  const G = cpGroupOf(A);
  if (G && G.leader !== A) return;
   const [m, f] = G ? cpGroupPowers(G, F) : cpPowers(A, F), oran = m / f;
  if (oran<trOf(A).retreat) {
    const ordular = G ? G.armies.filter(X => !X.battle) : [A];
    const Fr = allArmies().filter(Y => !ordular.includes(Y) && Y.members.length && Y.cmd && !Y.battle && cpFriend(A, Y) && dist2(Y.cmd, A.cmd) < 1200 * 1200 && power(Y.members) >= power(A.members) * 0.8)
      .sort((a, b) => dist2(a.cmd, A.cmd) - dist2(b.cmd, A.cmd))[0];
    for (const X of ordular) {
      if (!X.cp) continue;
      if (Fr) { X.order = { type: 'move', path: cpRoute(X.cmd, Fr.cmd), i: 0, t: 0, cp: true }; X.joinTo=Fr; X.escapeUntil = Sim.tick + 1200; X.cp.phase = 'escape'; }
      else cpDefend(X, F, null, true);
      say(X.cmd, '🔄', 150);
    }
    chron(lang`🔄 ${A.k.name} komutanı ${rankName(A.cmd)} düşmanın sandığından güçlü olduğunu gördü: saldırıdan vazgeçip ${Fr ? lang`${Fr.k === A.k ? lang('dost') : lang('müttefik')} orduya çekiliyor` : lang('geri dönüp savunma kuruyor')}`, A.k, F.k);
    return;
  }
  const tr = F.trench && F.trench !== true && Sim.trenches.includes(F.trench) ? F.trench : null;
  if (tr && tr.prog >= 0.6 && !o.side && oran < 1.8 && rangedN(A) < A.members.length * 0.3) {
    const pa = tr.a + Math.PI / 2, s=Math.random() < 0.5 ? 1 : -1, L = (tr.grp ? tr.grp.length * 30 : tr.len) / 2 + 45;
    const via={ x: tr.x + Math.cos(pa) * s * L + Math.cos(tr.a) * 25, y: tr.y + Math.sin(pa) * s * L + Math.sin(tr.a) * 25 };
    if (speedAt(via.x, via.y)) {
      A.order = { type: 'attack', path: [...cpRoute(A.cmd, via), ...resample([via, F.cmd], 18).slice(1)], i: 0, phase: 'go', t: 0, cp: true, side: true };
      say(A.cmd, "↪️", 150);
      chron(lang`🔄 ${A.k.name} komutanı ${rankName(A.cmd)}, ${F.k.name} hendeğine cepheden saldırmak yerine planı değiştirdi: hendeğin ${s > 0 ? lang('sağ') : lang('sol')} ucundan dolanıyor`, A.k, F.k);
      return;
    }
  }
  const bitis = o.path[o.path.length - 1];
  if (bitis && dist2(bitis, F.cmd) > 160 * 160) { o.path = cpRoute(A.cmd, F.cmd); o.i = 0; say(A.cmd, '🧭', 100); }
}
function cpRethink(A) {
  const o = A.order;
  if (o && o.cp && o.type === 'attack') return cpRethinkAttack(A, o);
   if (A.headless || !o || !o.cp || o.type !== 'hold' || o.hide || A.lastStand || A.lv || !A.members.length || !A.cp || A.cp.phase === "flankwait" || A.cp.phase === 'wavewait' || A.cp.phase === 'escape') return;
  if ((Sim.tick + A.id * 5) % 20) return;
  const F = attackerOf(A) || (A.cp.foe && A.cp.foe.members.length && A.cp.foe.k.armies.includes(A.cp.foe) ? A.cp.foe : nearestFoeArmy(A));
  if (!F) return;
  const G = cpGroupOf(A);
  const [m, f] = G ? cpGroupPowers(G, F) : cpPowers(A, F), oran=m / f;
  if (oran >= 1.35 || (!A.battle && oran >= 1.15)) {
    if (G && G.leader !== A) return;
    chron(lang`🔄 ${A.k.name} komutanı ${rankName(A.cmd)} artık sayıca üstün olduklarını fark etti: savunmayı bırakıp saldırıya geçiyor${G ? lang(" (bütün ortak hat)") : ''}`, A.k, F.k);
    if (G) cpGroupDecide(G, F, true); else { cpAttack(A, F, oran); cpRally(A, F, oran); }
    return;
  }
  const ranged = rangedN(A), galled = A.shotT > Sim.tick - 60 && ranged < A.members.length * 0.25;
  if (galled) {
    const T = A.shotBy && A.shotBy.members.length && A.shotBy.k.armies.includes(A.shotBy) ? A.shotBy : F;
     A.order = { type: 'attack', path: resample([{ x: A.cmd.x, y: A.cmd.y }, { x: T.cmd.x, y: T.cmd.y }], 18), i: 0, phase: "go", t: 0, cp: true };
    A.cp.phase = 'attack'; A.cp.foe = T;
     cpReform(A, 'attack', true);
     say(A.cmd, '📯', 150);
    chron(lang`📯 ${A.k.name} ordusu ok yağmuru altında bekleyip erimedi: hendekten çıkıp ${T.k.name} okçularının üstüne atıldı`, A.k, T.k);
  }

}

function cpTick()
{

  if (!Sim.cplan) return;
  const bases = Sim.bases || (Sim.bases = []);
   for (const B of [...Sim.battles]) cpSacrificeCheck(B);
   for (const A of allArmies()) cpRethink(A);
  cpCourierTick();
  trapTick();
  for (const A of allArmies()) { cpReactTick(A); cpFormTick(A); cpHelpLetter(A); cpTrapCheck(A); extraTrenches(A); if (A.cp && A.cp.phase === 'wavewait' && A.members.length) cpWaveTick(A); }

  for (const A of allArmies()) {
    if (A.joinTo) cpEscapeTick(A);
    if (A.cp && A.cp.phase === 'flankwait' && A.members.length) {
      const Pa = A.cp.parent, F = Pa && Pa.members.length ? (Pa.cp && Pa.cp.foe && Pa.cp.foe.members.length ? Pa.cp.foe : nearestFoeArmy(Pa)) : null;
      if (F && (Pa.battle || dist2(Pa.cmd, F.cmd) < 380 * 380)) cpLaunchFlank(A, F);
    }
    if (A.cp && A.cp.phase === 'ambush' && A.members.length) {
      const F = A.cp.foe && A.cp.foe.members.length ? A.cp.foe : nearestFoeArmy(A);
      if (!F || F.battle || dist2(F.cmd, A.cmd) < 160 * 160 || Sim.tick - A.cp.t0 > 3500) cpSpring(A);
    }
    if (A.manual || !A.members.length || !A.cmd) continue;

    if (A.state === 'assault' && !A.raid && !A.cpBase && A.target) {
      const T = A.target, a = Math.atan2(A.cmd.y - T.y, A.cmd.x - T.x), d = (T.walls ? T.walls.r : T.r) + 150;
      A.cpBase = cpBase(A, T.x + Math.cos(a) * d, T.y + Math.sin(a) * d) || true;
      if (A.cpBase !== true) chron(lang`⛺ ${A.k.name} ordusu ${T.name} önünde kuşatma ordugâhı kurdu`, A.k, T.k, T);
    }
    if (A.state !== 'assault') A.cpBase = null;
  }
  for (const b of bases) {
    baseTick(b);
    const A = b.A;
    if (A && A.members.length && A.k.armies.includes(A) && dist2(A.cmd, b) < 450 * 450) b.until=Math.max(b.until, Sim.tick + 600);
    if (A) for (const p of A.members) if (p.hp < p.maxHp && (p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (b.r + 15) ** 2) p.hp = Math.min(p.maxHp, p.hp + (b.hosp ? 0.75 : 0.25));
  }
  if (bases.length && Sim.tick % 50 === 0) Sim.bases = bases.filter(b => b.until > Sim.tick && !b.k.dead);
}

const armyAlive = X => !!(X && X.members.length && X.k.armies.includes(X) && X.cmd && !X.cmd.dead);
function cpSuspend(A, phase)
{
  const cp = A.cp;
  if (cp.phase !== 'react' && cp.phase !== 'help') cp.prev={ phase: cp.phase, foe: cp.foe, joinTo: A.joinTo };
  cp.phase=phase; cp.t0 = Sim.tick; cp.group = null;
}
function cpBusy(A) {
  const cp = A.cp, o = A.order;
  if (A.lastStand || cpHidden(A) || ['escape', 'flankwait', 'wavewait', 'ambush', 'help', "react", 'stand', 'join', "pact", "host"].includes(cp.phase)) return true;
  if (o && o.flank) return true;
  if (cp.phase === 'attack' && cp.foe && cp.foe.members.length) {
    if (cp.foe.battle) return true;
    if (dist2(A.cmd, cp.foe.cmd) < 300 * 300) return true;
  }
  const F = nearestFoeArmy(A);
  return !!(F && !F.battle && dist2(F.cmd, A.cmd) < 280 * 280);
}
function cpReactTick(A) {

  if (!A.manual || A.lv || !A.cp || !A.members.length || A.lastStand || !A.cmd) return;
  const cp = A.cp, o=A.order;
  if (A.battle) {
    if (!o || !o.cp || o.type === "hold" || !Sim.battles.includes(A.battle)) return;
    const s = 1 - A.bside, dusmanlar = bArmies(A.battle, s);
    if (!dusmanlar.length || (A.battle.cx[s] - A.cmd.x) ** 2 + (A.battle.cy[s] - A.cmd.y) ** 2 > 240 * 240) return;
    if ((o.type === 'attack' || o.type === 'free') && cp.foe && dusmanlar.includes(cp.foe)) {
      if (o.type === 'attack' && !o.flank && !(o.sapN && !o.sapOut) && (A.battle.cx[s] - A.cmd.x) ** 2 + (A.battle.cy[s] - A.cmd.y) ** 2 < 170 * 170) A.order = { type: "free", t: 0, idle: 0, foe: cp.foe, cp: true };
      return;
    }
    if (cp.phase === 'help' || o.help) { A.order = null; cpReform(A, 'attack'); return; }
     const H = dusmanlar[0];
    cpSuspend(A, 'react');
    A.order = null;

    say(A.cmd, '❗', 120);
    chron(lang`❗ ${A.k.name} ordusu emri uygularken ${H.k.name} ordusunun saldırısına uğradı: komutan ${fullName(A.cmd)} yürüyüşü kesip karşılık veriyor`, A.k, H.k);
    const [m, f] = cpPowers(A, H);
    cpReform(A, m / f >= 1 ? "attack" : 'defend');
    return;
  }

  if (A.headless || (o && !o.cp) || A.state === 'retreat' || (Sim.tick / 5 + A.id) % 4) return;
  if (cp.helpSkipT && Sim.tick - cp.helpSkipT < 600) return;
  if (cpBusy(A)) return;
  let enIyi=null, bs = Infinity;
  for (const B of Sim.battles) for (const s of [0, 1]) {
    const mine = bArmies(B, s);
    if (!mine.length || !mine.some(X => cpFriend(A, X))) continue;
    const dusmanlar = bArmies(B, 1 - s).filter(X => hostile(A.k, X.k));
    if (!dusmanlar.length) continue;
    const d = (B.cx[s] - A.cmd.x) ** 2 + (B.cy[s] - A.cmd.y) ** 2, X = mine[0], gerek = (X.ratio ?? 1) * (X.left ?? 1);
    if (d > 550 * 550 || gerek > 1.1) continue;
    const sc = gerek * 2 + Math.sqrt(d) / 550;
    if (sc<bs) { bs = sc; enIyi = [B, s, dusmanlar[0], X]; }
  }

  if (!enIyi) return;
  if (Math.random() > clamp(0.55 + (cmdInt(A.cmd) - 5) * 0.06, 0.35, 0.9)) { cp.helpSkipT = Sim.tick; return; }
  const [B, s, F, X] = enIyi, to = { x: B.cx[1 - s], y: B.cy[1 - s] };
  cpSuspend(A, 'help'); cp.helpB = B;
  A.order={ type: 'attack', path: cpRoute(A.cmd, to), i: 0, phase: 'go', t: 0, cp: true, help: true };
  A.state = "idle"; A.foeArmy = null;
  if (dist2(A.cmd, to) > 300 * 300) cpReform(A, 'march', true);
  say(A.cmd, '📯', 150);
  chron(lang`📯 ${A.k.name} komutanı ${rankName(A.cmd)}, ${B.name} savaşında zor durumdaki ${X.k === A.k ? lang('dost') : lang`müttefik ${X.k.name}`} ordusunu gördü: ${cp.prev && cp.prev.phase === 'attack' ? lang('saldırı emrini bekletip') : lang('yerini bırakıp')} yardıma koşuyor`, A.k, F.k, B.place);
}
function cpResume(A) {
   const cp = A.cp, pv = cp.prev;
  cp.prev = null; cp.helpB = null;
  A.state = 'idle'; A.foeArmy=null; A.order = null;
  const F = threatFoe(A);
  if (pv && pv.phase === 'join' && armyAlive(pv.joinTo)) {
    A.joinTo = pv.joinTo; A.joinUntil = Sim.tick + 2000; cp.phase='join';
    A.order = { type: 'move', path: cpRoute(A.cmd, A.joinTo.cmd), i: 0, t: 0, cp: true };
    chron(lang`🧠 ${A.k.name} komutanı ${rankName(A.cmd)} çatışmadan sonra yoluna devam ediyor: dost orduyla birleşmeye gidiyor`, A.k);
    return;
  }
  if (!F) { cp.phase = 'done'; cp.t0 = Sim.tick; return; }
  const [m, f] = cpPowers(A, F), oran = m / f;
  const eski = pv && pv.foe && armyAlive(pv.foe) ? pv.foe : null;
  let txt;
  if (pv && pv.phase === 'attack' && eski && oran >= 0.95) { cpAttack(A, eski, oran, null, true); txt = lang`eski emrine dönüyor, ${eski.k.name} ordusuna saldırı sürüyor`; }
  else if (pv && pv.phase === 'defend' && oran < 1.15) { cpDefend(A, F, null, true); txt=lang('eski emrine dönüyor, ordugâhın önündeki hatta geri çekiliyor'); }
  else { cp.phase = 'decide'; cp.solo = false; cp.t0 = Sim.tick; txt = pv && ['attack', 'defend'].includes(pv.phase) ? lang('eski plan artık tutmuyor, yeni bir plan yapıyor') : lang('yeni bir plan yapıyor'); }
  say(A.cmd, '🧠', 120);
  chron(lang`🧠 ${A.k.name} komutanı ${rankName(A.cmd)} durumu yeniden tarttı (güç ${oran >= 1.15 ? lang('üstün') : oran >= 0.9 ? lang('denk') : lang("zayıf")}): ${txt}`, A.k, F.k);

}

const REFORM_WHY = { attack: 'saldırı için', defend: 'savunma için', surround: 'dört yandan sarıldılar', arrows: "ok yağmuruna karşı", march: "hızlı yürüyüş için" };
function cpReform(A, mode, quiet) {
  if (!A || A.formSet || A.lv || A.headless || !A.cmd || A.members.length < 8) return;
  if (A.reformT && Sim.tick - A.reformT < 300) return;
  const i = cmdInt(A.cmd) + rnd(-2, 2);
  if (i<4) return;
  const n = A.members.length, F = A.cp && A.cp.foe && A.cp.foe.members.length ? A.cp.foe : nearestFoeArmy(A), fn = F ? Math.max(1, F.members.length) : 1;
  const fa = F ? rangedN(F) / fn : 0, fc = F ? (F.nCav || 0) / fn : 0, myCav = (A.nCav || 0) / n;
  let f;

  if (A.vic) {
    if (mode === 'attack') f = myCav > 0.35 ? 'column' : i >= 6 ? pick(['column', 'line', 'echelon']) : 'column';
    else if (mode==='defend') f = fc > 0.3 ? 'squares' : 'line';
    else if (mode === 'surround') f = 'squares';
    else if (mode === 'arrows') f = 'skirmish';
    else if (mode === 'march') f = 'column';
  } else if (A.ww) {
    if (mode === "attack") f = i >= 5 ? 'skirmish' : 'line';
    else if (mode === 'defend') f = "line";
    else if (mode === 'surround' || mode === 'arrows') f = 'skirmish';
    else if (mode === 'march') f = 'column';
  } else if (mode === "attack") f = myCav > 0.35 ? "wedge" : fa > 0.45 ? 'skirmish' : i >= 6.5 ? pick(["checker", 'echelon', 'wedge']) : 'wedge';
  else if (mode === 'defend') f = fa > 0.4 ? (i >= 6 ? 'testudo' : 'shieldwall') : fc > 0.3 ? (i >= 6 ? 'phalanx' : 'squares') : pick(['shieldwall', 'line', 'phalanx']);
  else if (mode === "surround") f = 'schiltron';
  else if (mode === 'arrows') f = i >= 5.5 ? 'testudo' : 'shieldwall';
  else if (mode === 'march') f = 'column';
  if (!f || f === A.form) return;
  const eski = A.form;
  A.form = f; A.reformT = Sim.tick;
  if (A.order) A.order.n = -1;
  const yazi = lang`düzeni değiştirdi: ${FORMS[eski] || eski} → ${FORMS[f]} (${REFORM_WHY[mode]})`;
  plog(A.cmd, yazi);
  if (!quiet) { say(A.cmd, '📣', 100); chron(lang`📣 ${A.k.name} komutanı ${rankName(A.cmd)} ${yazi}`, A.k); }
}
function cpFormTick(A) {
  if (!A.battle || !A.members.length || A.lv || A.formSet || (Sim.tick / 5 + A.id) % 6) return;
  const n = A.members.length, flanked = A.members.filter(p => p.hitSide > Sim.tick).length / n;
  if (flanked > 0.3 && n >= 12) return cpReform(A, 'surround');
  const ranged = rangedN(A);
  if (A.order && A.order.type === 'hold' && A.shotT > Sim.tick - 40 && ranged < n * 0.25 && !A.members.some(p => p.foe && !p.foe.dead && dist2(p, p.foe) < 30 * 30)) cpReform(A, 'arrows');
}

function cpHeadless(A, eski) {
  A.headless = true;
  const o = A.order, task = o && o.cp ? (o.type === "attack" ? lang('saldırı emrini') : o.type === 'hold' ? lang('mevzi tutma emrini') : lang('son emrini')) : null;
  A.cp.group = null; A.cp.msg = null;
  say(A.cmd, '💀', 200);
  chron(lang`💀 ${A.k.name} ordusunun komutanı ${rankName(eski)} düştü! Ordu komutansız kaldı${task ? lang`; askerler komutanın verdiği ${task} yerine getirmeye devam ediyor` : ''}`, A.k);
}
function cpHeadlessTick(A)
{

  const cp = A.cp, o = A.order;
  if (o && o.cp && !['await', 'pact', 'host', 'decide', 'camp', "react", 'help'].includes(cp.phase)) {
    if (o.type === 'hold') {
      cp.holdT = cp.holdT || Sim.tick;
      if (Sim.tick - cp.holdT<1500) return true;
    } else return true;
  }
  if (o && !o.cp) return false;
  A.order = null;
  if (cp.after !== 'free') {
    if (!cp.after) {
      const Fr = allArmies().filter(Y => Y !== A && Y.k === A.k && armyAlive(Y) && !Y.headless && !Y.battle && Y.state !== 'sail' && dist2(Y.cmd, A.cmd) < 1000 * 1000)
        .sort((a, b) => dist2(a.cmd, A.cmd) - dist2(b.cmd, A.cmd))[0];
      if (Fr && Math.random() < 0.35) {
        cp.after = 'join'; cp.phase = 'join';
        A.joinTo = Fr; A.joinUntil = Sim.tick + 2500;
        A.order = { type: 'move', path: cpRoute(A.cmd, Fr.cmd), i: 0, t: 0, cp: true };
        say(A.cmd, '🚶', 150);
        chron(lang`🚶 Komutansız kalan ${A.k.name} askerleri son görevi bitirdi; dağılmak yerine yakındaki dost orduya katılmaya gidiyor`, A.k);
        return true;
      }
    }
    cp.after='free';
    chron(lang`⚔️ Komutansız ${A.k.name} askerleri son görevi bitirdi; plan yapacak kimse kalmadığından gözlerine kestirdikleri düşmana saldırıyor`, A.k);
  }
  const dusmanlar = allArmies().filter(O => O !== A && O.members.length && O.state !== 'sail' && hostile(A.k, O.k) && !(cpHidden(O) && dist2(O.cmd, A.cmd) > 90 * 90) && dist2(O.cmd, A.cmd) < 1500 * 1500);
  if (!dusmanlar.length) return false;
  const T = cp.rfoe && dusmanlar.includes(cp.rfoe) ? cp.rfoe : (cp.rfoe = pick(dusmanlar));
  A.order={ type: 'attack', path: cpRoute(A.cmd, T.cmd), i: 0, phase: 'go', t: 0, cp: true };
  return true;
}

const LETTER = { help: 'Sıkıştık, yardıma gelin!', merge: 'Ordularımızı birleştirelim, ordugâhıma gel', attack: 'Düşmana birlikte, iki yandan saldıralım', defend: 'Yan yana hendek kazıp ortak bir savunma hattı kuralım', ambush: 'Biri yem olsun, öbürü ormana gizlenip pusu kursun', plan: 'Savaş planı' };
const LETTER_S = { help: 'Yardım', merge: 'Birleşme', attack: 'Saldırı', defend: 'Hendek', ambush: 'Pusu', plan: 'Emir' };
function cpProposal(A, X, F) {
  const [a, b] = forceAt(A, F, [A, X]), r = a / b;
  if (X.k === A.k && Math.min(A.members.length, X.members.length) < 25 && Math.random() < 0.45) return 'merge';
  if (cmdInt(A.cmd) + rnd(-2, 2) >= 5.5 && Math.random() < 0.3 + trOf(A).ambush) return 'ambush';
  return r >= 0.95 ? 'attack' : 'defend';
}
const courierSpeed=p => CFG.walk * (0.6 + p.stats.spd * 0.08) * (isCav(p) ? 1.75 : 1) * 1.15;
function hasCourier(A)
{
  if (A.courierOk == null) A.courierOk = Math.random() < clamp(0.45 + (cmdInt(A.cmd) - 5) * 0.07, 0.25, 0.85);
  return A.courierOk;
}
function cpSendCourier(A, X, tur, F)
{
  if (!hasCourier(A)) return false;
  const havuz = A.members.filter(p => p !== A.cmd && bj(p) !== "artillery");
  if (havuz.length<4) return false;
  const p = havuz.find(isHorse) || havuz.filter(q => q.job === 'soldier' || q.job === 'rifle' || q.job === 'trooper').pop() || havuz.filter(q => q.job !== 'tank').pop();
  if (!p) return false;
  leaveArmy(p);
  p.state = 'courier'; p.foe=null; p.wp = null; p.detour=null;
  const m = { p, from: A, to: X, type: tur, foe: F, stage: 'go', ans: null, t0: Sim.tick };
  p.courier = m
  Sim.msgs.push(m);
   X.cp.msgIn = m;
  const d = dist(A.cmd, X.cmd);
  if (tur === 'help') { m.battle = A.battle; m.side = A.bside; }
  else { A.cp.msg = m; A.cp.phase = 'await'; A.cp.t0 = Sim.tick; A.cp.waitMax = 2 * d / courierSpeed(p) * 1.6 + 500; A.state = 'idle'; A.foeArmy = null; }
  say(A.cmd, '✍️', 120);
  chron(lang`✉️ ${A.k.name} komutanı ${rankName(A.cmd)} mesajcı yolladı → ${X.k === A.k ? '' : lang('müttefik ')}${X.k.name} komutanı ${rankName(X.cmd)}: "${LETTER[tur]}"`, A.k, X.k);
  return true;

}
function courierEnd(m) {
  const p = m.p, A = m.from;
  Sim.msgs = Sim.msgs.filter(x => x !== m);
  if (m.to && m.to.cp && m.to.cp.msgIn === m) m.to.cp.msgIn = null;
  if (p.dead) return;
  p.courier = null;
  if (m.extra) { if (p.state==='courier') p.dead = true; return; }
  if (armyAlive(A)) { A.members.push(p); sortRanks(A); A.start++; }
  else p.state = null;
}
function courierMove(p, g) {
  const m = p.courier;

  if (!m || !Sim.msgs.includes(m)) { p.state=null; p.courier = null; return; }
  if ((Sim.tick + p.id) % 10===0) {
    p.danger = null; let bd = 50 * 50;
    near(g, p.x, p.y, 50, q => {
      if (q.dead || !hostile(p.k, q.k) || !(q.army || q.state === 'courier') || (m.ignore && m.ignore.has(q))) return;

      const d = dist2(p, q); if (d < bd) { bd = d; p.danger = q; }
    })
  }
  if (m.duel && cpDuel(p, m)) return;
  if (p.danger && p.danger.state === 'courier' && p.danger.courier && !m.ignore?.has(p.danger) && dist2(p, p.danger) < 40 * 40) cpMeet(p, m, p.danger);
  if (p.danger && p.danger.army && !m.read && (Sim.tick + p.id) % 10 === 0) cpSpyCheck(m, p.danger);
  const hedef = m.stage === 'back' ? m.from : m.to;
  if (m.stage !== 'back' && (!armyAlive(hedef) || hedef.headless)) {
    m.stage="back"; m.ans = null; m.lost = true;
    say(p, '❓', 150);
    return;
  }
  if (m.stage === 'back' && !armyAlive(hedef)) return courierEnd(m);
  const T = hedef.cmd;
  if (p.danger && !p.danger.dead && dist2(p, T) > 40 * 40) {
    const d = p.danger, a = Math.atan2(p.y - d.y, p.x - d.x), b=Math.atan2(T.y - p.y, T.x - p.x);
    moveTo(p, p.x + Math.cos(a) * 30 + Math.cos(b) * 20, p.y + Math.sin(a) * 30 + Math.sin(b) * 20, 1.25);
    return;
  }
  if (m.stage === 'wait') {
    moveTo(p, T.x + 7, T.y + 5);
    if (Sim.tick - m.t > 60) cpAnswer(m);
    return;
  }
  if (moveTo(p, T.x, T.y, 1.15) || dist2(p, T) < 14 * 14) {
    if (m.stage === 'go') { m.stage = 'wait'; m.t = Sim.tick; say(hedef.cmd, '📜', 70); }
    else cpDeliver(m);
  }
}
function cpAnswer(m)
{
  if (m.type === 'plan') {
    m.ans = true; m.stage = 'back'; m.tAns = Sim.tick;
    if (armyAlive(m.to)) say(m.to.cmd, '👍', 120);
    return;
  }
  const X = m.to, A = m.from, F = armyAlive(m.foe) ? m.foe : nearestFoeArmy(X), c = X.cmd.stats;

  let ok = false, why = '';
  const farAttack = X.cp && X.cp.phase === 'attack' && !(X.order && X.order.flank) && !(X.cp.foe && X.cp.foe.members.length && (X.cp.foe.battle || dist2(X.cp.foe.cmd, X.cmd) < 450 * 450));
  const busy = X.battle || !X.cp || (X.order && !X.order.cp) || X.headless || (m.type === 'help' && (!m.battle || !Sim.battles.includes(m.battle))) || (!farAttack && X.cp.phase === 'attack') || ['escape', 'ambush', 'flankwait', 'wavewait', 'help', 'react', 'stand', 'join', 'await', 'pact', 'host'].includes(X.cp.phase);
  if (busy) why = lang('kendi işimiz var, şimdi olmaz');
  else if (!F) why = lang('ortada düşman görünmüyor');
  else {
    const mine = power(X.members), his = armyAlive(A) ? power(A.members) : 0, [ba, bb] = forceAt(X, F, armyAlive(A) ? [X, A] : [X]), r = ba / bb * rnd(0.85, 1.15);
    let pr = 0.6;
    if (m.type==='merge') { pr=X.k !== A.k ? 0 : mine > his * 1.3 ? 0.25 : 0.75; why = mine > his * 1.3 ? lang('benim ordum daha büyük, asıl sen bana gel') : lang('kendi sancağımın altında kalacağım'); }
    else if (m.type === 'attack') { pr = r >= 1 ? 0.45 + c.agg * 0.05 : 0.15; why=r >= 1 ? lang('acele etmeyelim') : lang('düşman çok güçlü, saldırmak delilik'); }
    else if (m.type === 'defend') { pr = 0.5 + (10 - c.agg) * 0.04; why = lang('hendekte beklemek bize göre değil'); }
    else if (m.type === 'ambush') { pr = 0.35 + c.int * 0.05; why = lang('bu pusu tutmaz'); }
    if (m.type === 'help') { pr = cpBusy(X) ? 0.1 : 0.75; why=lang('önümüzde kendi düşmanımız var'); }
    ok = Math.random() < clamp(pr + (cmdTrait(X.cmd).accept[m.type] || 0), 0, 0.95);
  }
  m.ans = ok; m.why=ok ? '' : why; m.stage = 'back'; m.tAns = Sim.tick;
  if (X.cp && X.cp.msgIn === m) X.cp.msgIn = null;
  say(X.cmd, ok ? '👍' : '👎', 120);
  chron(lang`${ok ? '✅' : '❌'} ${X.k.name} komutanı ${rankName(X.cmd)}, ${A.k.name} komutanının "${LETTER_S[m.type]}" mektubuna ${ok ? lang('onay verdi') : lang`ret cevabı yazdı ("${why}")`}; mesajcı cevabı götürüyor`, X.k, A.k);
  if (!ok) return;
  const back = (armyAlive(A) ? dist(X.cmd, A.cmd) : 300) / courierSpeed(m.p) * 1.6 + 500;
  if (m.type === 'help') {
    const B = m.battle, s = 1 - (m.side || 0), to = { x: B.cx[s], y: B.cy[s] };
    cpSuspend(X, 'help'); X.cp.helpB = B;
    X.order = { type: "attack", path: cpRoute(X.cmd, to), i: 0, phase: 'go', t: 0, cp: true, help: true };
    X.state = 'idle'; X.foeArmy = null;
    say(X.cmd, '📯', 150);
    chron(lang`📯 ${X.k.name} komutanı ${rankName(X.cmd)} yardım çağrısına uydu: "Geliyoruz!" diye cevap yollayıp ${B.name} savaşına koşuyor`, X.k, A.k, B.place);
    return;
  }
  if (m.type === 'merge') {
    X.cp.phase = 'join'; X.joinTo=A; X.joinUntil = Sim.tick + back + 2000;
    X.order = { type: 'move', path: cpRoute(X.cmd, A.cmd), i: 0, t: 0, cp: true };
    cpReform(X, "march", true);
  } else { X.cp.phase = 'pact'; X.cp.pact = m; X.cp.t0 = Sim.tick; X.cp.waitMax = back; }
}
function cpDeliver(m) {

  const A = m.from, X = m.to;
  courierEnd(m);
  if (m.type === 'plan') { if (armyAlive(A)) say(A.cmd, '📨', 90); return; }
  if (m.type === 'help') {
    if (!armyAlive(A) || A.headless) return;
    say(A.cmd, m.ans ? '📨' : "😞", 120);
    if (A.battle) A.duel = (A.duel || 0) + (m.ans ? 10 : -5);
    chron(m.ans ? lang`📨 ${A.k.name} mesajcısı müjdeyi getirdi: yardım geliyor! Askerler yeniden canlandı` : lang`📨 ${A.k.name} mesajcısı kötü haberi getirdi: yardım gelmeyecek${m.why ? lang` ("${m.why}")` : ''}`, A.k);
    return;
  }
  if (!A.cp || A.cp.msg !== m) return;
  A.cp.msg = null;
  if (A.headless || A.cp.phase !== 'await') return;
  const F = nearestFoeArmy(A);
  say(A.cmd, m.ans ? '📨' : m.ans === false ? '😒' : '❓', 120);

  if (m.ans == null) { chron(lang`📨 ${A.k.name} mesajcısı döndü: ${X.k.name} komutanına ulaşamadı. Komutan ${fullName(A.cmd)} kendi planını yapıyor`, A.k); A.cp.phase = 'decide'; A.cp.solo = true; return; }
  if (!m.ans) { chron(lang`📨 ${A.k.name} mesajcısı ret cevabını getirdi ("${m.why}"). Komutan ${fullName(A.cmd)} kendi planını yapıyor`, A.k, X.k); A.cp.phase='decide'; A.cp.solo = true; return; }
  if (m.type === "merge") {
    A.cp.phase = 'host'; A.cp.guest = X; A.cp.t0 = Sim.tick;
    chron(lang`📨 ${A.k.name} mesajcısı onayı getirdi: ${X.k.name} ordusu birleşmek için yola çıktı`, A.k);
    return;
  }
  if (!armyAlive(X) || !X.cp || X.cp.phase !== 'pact' || X.cp.pact !== m || !F) {
    chron(lang`📨 ${A.k.name} mesajcısı onayı getirdi ama ${X.k.name} ordusu artık hazır değil; komutan ${fullName(A.cmd)} kendi planını yapıyor`, A.k, X.k);
    A.cp.phase = 'decide'; A.cp.solo = true; return;
  }
  X.cp.pact = null;
  const G = { leader: A, armies: [A, X], type: null, foe: F, t0: Sim.tick };
  A.cp.group = X.cp.group = G; A.cp.phase = X.cp.phase = 'decide';
  for (const Y of G.armies) if (Y.order && Y.order.cp) Y.order = null;
  chron(lang`📨 ${A.k.name} mesajcısı onayı getirdi: ortak plan ("${LETTER_S[m.type]}") yürürlüğe giriyor`, A.k, X.k);
  cpGroupDecide(G, F, false, m.type);
}
function cpWaitTick(A) {
  const cp = A.cp, F = nearestFoeArmy(A);
  if (!A.order) { A.state = "idle"; A.foeArmy = null; }
  let give;
  if (F && !F.battle && dist2(F.cmd, A.cmd) < 300 * 300) give = lang('düşman beklemeye fırsat vermedi');
  else if (cp.phase === "host" && (!armyAlive(cp.guest) || cp.guest.joinTo !== A)) give = '';
  else if (Sim.tick - cp.t0 > (cp.phase === 'host' ? 3000 : cp.waitMax || 2500)) give = cp.phase === 'await' ? lang('mesajcısından haber alamadı') : cp.phase === "pact" ? lang('müttefikten ortak plan gelmedi') : lang('beklenen ordu gelmedi');
  else return true;
  if (give) { say(A.cmd, '❓', 150); chron(lang`❓ ${A.k.name} komutanı ${rankName(A.cmd)} ${give}; kendi planını yapıyor`, A.k); }
  cp.phase='decide'; cp.solo = true; cp.msg = null; cp.pact = null; cp.guest = null;
  return true;
}
function cpCourierTick() {
  for (const m of [...(Sim.msgs || [])]) {
    if (!m.p.dead && m.p.state === 'courier') continue;
    if (m.p.dead && !m.read) {
      const E = allArmies().filter(X => X.members.length && X.cmd && hostile(m.from.k, X.k) && dist2(X.cmd, m.p) < 250 * 250)[0];
      if (E && Math.random() < 0.5) { m.read = E; cpLetterRead(m, E, false); }
    }
    if (m.p.dead) chron(lang`✉️💀 ${m.from.k.name} mesajcısı yolda öldürüldü: ${m.stage === 'back' ? lang`${m.ans ? lang('onay') : 'ret'} cevabı ${m.from.k.name} komutanına hiç ulaşmayacak` : lang`"${LETTER_S[m.type]}" mektubu ${m.to.k.name} komutanına ulaşmadı`}`, m.from.k, m.to.k);
    courierEnd(m);
  }
}

function courierHit(p, T) {
  if ((Sim.tick + p.id) % 6) return;
  T.hp -= (1.5 + p.stats.str * 0.6) * p.R.size * rnd(0.6, 1.4) * 0.75 * (isCav(p) ? 1.4 : 1) / (0.6 + T.stats.end * 0.08);
  T.hitT = Sim.tick; T.hitBy=p; p.a = Math.atan2(T.y - p.y, T.x - p.x);
  Sim.fx.push({ x: T.x, y: T.y, t: 8, type: 'hit' });
  if (T.hp <= 0) kill(T, p, 'savaş');
}
function cpMeet(p, m, q) {
  const n = q.courier;
  m.ignore = m.ignore || new Set(); n.ignore = n.ignore || new Set();
  const brave = (p.stats.agg + q.stats.agg) / 20;
  if (Math.random()<clamp(0.25 + brave * 0.5, 0.2, 0.75)) {
    m.duel = q; n.duel = p;
    say(p, '⚔️', 80); say(q, '⚔️', 80);
    chron(lang`⚔️ ${p.k.name} mesajcısı ile ${q.k.name} mesajcısı yolda karşılaştı ve kılıçlarını çekti`, p.k, q.k);
  } else { m.ignore.add(q); n.ignore.add(p); }
}
function cpDuel(p, m)
{
  const q = m.duel;
  if (!q || q.dead || q.state !== 'courier' || dist2(p, q) > 80 * 80) { m.duel = null; return false; }
  if (dist2(p, q) > 8 * 8) moveTo(p, q.x, q.y, 1.2); else courierHit(p, q);
  return true;
}

function cpWaves(A, F) {
   const c = A.cmd, n = A.members.length;
  const melee = A.members.filter(p => p !== c && !p.guardOf && ['soldier', "spear", 'shield', 'rifle'].includes(p.job));
  if (n < 40 || melee.length < 24) return false;
  const smart = cmdInt(c) + rnd(-2, 2), tr = cmdTrait(c);
  const sans = 0.35 + (tr === CMD_TRAITS.cautious ? 0.15 : tr === CMD_TRAITS.cunning ? 0.1 : tr === CMD_TRAITS.bold ? -0.2 : 0);
  if ((smart < 6 && rankOf(c).lv < 2) || Math.random() > sans) return false;
  const waves = n >= 70 && smart >= 7 ? 3 : 2, yon = Math.atan2(F.cmd.y - c.y, F.cmd.x - c.x), cd = Math.cos(yon), sd = Math.sin(yon);
  melee.sort((a, b) => ((a.x - c.x) * cd + (a.y - c.y) * sd) - ((b.x - c.x) * cd + (b.y - c.y) * sd));
  const per = Math.round(melee.length * (waves === 3 ? 0.27 : 0.35)), made = [];
  for (let w = 2; w <= waves; w++) {
    const ps = melee.splice(0, per);
    if (ps.length < 6) break;
    const D = cpDetach(A, ps), back = 110 * (w - 1);
    let x = c.x - cd * back, y = c.y - sd * back;
    if (!speedAt(x, y)) { x = D.cmd.x; y = D.cmd.y; }
    D.cp = { phase: 'wavewait', t0: Sim.tick, parent: A, wave: w, foe: F };
    D.order={ type: 'hold', x, y, dir: yon, t: 0, trench: true, cp: true };
    made.push(D);
  }
  if (!made.length) return false;
  A.cp.waves = true; A.cp.waveArmies = made;
  say(c, '🌊', 150);
  chron(lang`🌊 ${A.k.name} komutanı ${rankName(c)} ordusunu ${made.length + 1} dalgaya böldü: ilk dalga ${F.k.name} hattını yoracak, arkadakiler sırayla gelip kıracak`, A.k, F.k);
  return true;
}
function cpWaveTick(D) {
  const cp = D.cp, Pa = cp.parent, paOk = armyAlive(Pa);
  if (D.battle) { D.order = null; cp.phase = 'attack'; cp.waveOf = paOk ? Pa : null; return; }
  const F = cp.foe && armyAlive(cp.foe) ? cp.foe : nearestFoeArmy(paOk ? Pa : D);
  if (!F) { D.order = null; cp.phase = 'done'; cp.waveOf = paOk ? Pa : null; return; }
  cp.foe = F;

  if (paOk && !Pa.battle && Pa.cp && !['attack', 'react', 'help'].includes(Pa.cp.phase)) { D.order = null; cp.phase = 'done'; cp.waveOf = Pa; return; }
  const B = paOk && Pa.battle && Sim.battles.includes(Pa.battle) ? Pa.battle : null, k = cp.wave - 1;
  const prevOk = k < 2 || (paOk && Pa.cp && Pa.cp.lastWaveT && Sim.tick - Pa.cp.lastWaveT >= 200);
  const go = !paOk || (prevOk && B && (B.t > 220 + k * 260 || (Pa.left ?? 1) < 0.85 - k * 0.1)) || Sim.tick - cp.t0 > 3500;
  if (!go) {
    if (paOk && !B && (Sim.tick + D.id * 5) % 50 === 0) {
      const a=Math.atan2(F.cmd.y - Pa.cmd.y, F.cmd.x - Pa.cmd.x), x = Pa.cmd.x - Math.cos(a) * 110 * k, y = Pa.cmd.y - Math.sin(a) * 110 * k;
      if (speedAt(x, y) && D.order) { D.order.x = x; D.order.y = y; D.order.dir=a; }
    }
    return;
  }
  const s = B ? 1 - Pa.bside : 0, to = B ? { x: B.cx[s], y: B.cy[s] } : F.cmd;
  D.order = { type: 'attack', path: cpRoute(D.cmd, to), i: 0, phase: "go", t: 0, cp: true };
  cp.phase = "attack"; cp.waveOf = paOk ? Pa : null; cp.t0 = Sim.tick;
  if (paOk && Pa.cp) Pa.cp.lastWaveT = Sim.tick;
  say(D.cmd, '🌊', 150);
  chron(lang`🌊 ${D.k.name}: ${cp.wave}. dalga saldırıya kalktı${B ? lang`, yıpranan ${F.k.name} hattına yükleniyor` : ''}`, D.k, F.k);
}

function cpSpyCheck(m, q) {
  const E = q.army;
  if (m.type === 'plan' || !E || !E.cp || E.headless || !E.cmd || E.lv || !hostile(E.k, m.from.k)) return;
  const smart = cmdInt(E.cmd) + (E.cmd.ctrait === "cunning" ? 2 : 0);
  if (Math.random() > clamp(0.03 + (smart - 5) * 0.02, 0.01, 0.15)) return;
  m.read = E;
  const t0 = m.type;
  cpLetterRead(m, E, true);
  let what = lang('okuyup mesajcıyı fark ettirmeden yoluna saldı');
  if ((E.cmd.ctrait === 'cunning' || smart >= 7.5) && Math.random() < 0.6) {
    if (m.stage === 'back' && m.ans != null) { m.ans = !m.ans; m.why = m.ans ? '' : lang("şimdi olmaz"); what = lang`cevabı sahtesiyle değiştirdi (${m.ans ? lang('ret yerine onay') : lang('onay yerine ret')})`; }
    else if (m.stage === 'go' && t0 !== 'help') { const nt = t0 === 'attack' || t0 === 'ambush' ? "defend" : 'attack'; m.type = nt; what = lang`"${LETTER_S[t0]}" mektubunu "${LETTER_S[nt]}" diye sahtesiyle değiştirdi`; }
    m.forged = true;
  }
  say(E.cmd, '🕵', 150);
  chron(lang`🕵 ${E.k.name} komutanı ${rankName(E.cmd)}, ${m.from.k.name} mesajcısını yolda yakalattı; mektubu ${what}`, E.k, m.from.k);
}
function cpLetterRead(m, E, caught) {

  const S = m.from, k = E.k, t = m.type;
  if (!caught) chron(lang`📜 ${k.name} askerleri ölen ${S.k.name} mesajcısının üstünde mektubu buldu: "${LETTER_S[t]}"`, k, S.k);
  if (t === 'ambush') {
    let n = 0;
    for (const O of allArmies()) if (O.members.length && O.cmd && cpFriend(S, O) && dist2(O.cmd, E.cmd) < 1500 * 1500) { O.spotK = k; O.spotT = Sim.tick + 1500; n++; }
    if (n) chron(lang`🕵 ${k.name} pusunun kurulacağı yeri öğrendi: ${S.k.name} ordularının gizlenmesi boşa çıkacak`, k, S.k);
  }
  if (!E.cp || E.battle || E.headless || !armyAlive(S)) return;
  const [a, b]=cpPowers(E, S), r = a / b;
  if (t === 'attack' && E.cp.phase !== 'defend') {
    cpDefend(E, S, null, true);
    chron(lang`🛡 ${k.name} komutanı ${rankName(E.cmd)} ortak saldırı geleceğini öğrendi: hazırlıksız yakalanmamak için hendek kazıyor`, k, S.k);
  } else if ((t === 'merge' || t === 'defend') && r >= 0.8 && E.cp.phase !== 'attack') {
    cpAttack(E, S, r, null, true);
    chron(lang`⚔️ ${k.name} komutanı ${rankName(E.cmd)} düşman orduların birleşeceğini öğrendi: birleşmeden önce vurmak için saldırıya geçti`, k, S.k);
  }
}

function cpHelpLetter(A) {
  if (!A.manual || !A.cp || A.headless || A.lv || !A.battle || A.helpAsk === A.battle || (Sim.tick / 5 + A.id) % 6) return;
  if (A.members.length < 8 || !(A.ratio < 0.9 && A.left < 0.8)) return;
  A.helpAsk = A.battle;
  if (Math.random() > clamp(0.5 + (cmdInt(A.cmd) - 5) * 0.08, 0.2, 0.9)) return;
  const Y=allArmies().filter(X => X !== A && X.manual && X.cp && !X.headless && !X.lv && armyAlive(X) && !X.battle && !X.cp.msgIn && cpFriend(A, X) && dist2(X.cmd, A.cmd) < 1300 * 1300)
    .sort((a, b) => dist2(a.cmd, A.cmd) - dist2(b.cmd, A.cmd))[0];

  const F = bArmies(A.battle, 1 - A.bside)[0];
  if (Y && F) cpSendCourier(A, Y, 'help', F);
}
function cpTrapCheck(A) {
  const o = A.order;
  if (!A.manual || !A.cp || A.headless || A.lv || A.trapsSet || A.battle || A.cp.phase !== 'defend' || !o || !o.cp || o.type !== 'hold' || o.hide || (o.t || 0) < 300) return;
  placeTraps(A, o);
}

function cpDrawBases(ctx, vis)
{
  if (!Sim.cplan || !Sim.bases) return;
  const z = Sim.cam.z;
  for (const b of Sim.bases) {
    if (!vis(b)) continue;
    const fade = clamp((b.until - Sim.tick) / 300, 0.2, 0.75);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.6; ctx.setLineDash([2.5, 2]);
     ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,95,60,0.18)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    for (let i = 0; i < b.n; i++) {
      const a = i / b.n * Math.PI * 2 + 0.3, x = b.x + Math.cos(a) * b.r * 0.62, y = b.y + Math.sin(a) * b.r * 0.62;
       ctx.fillStyle = i % 3 ? '#e9dfc4' : mixHex(b.k.color, '#ffffff', 0.55); ctx.strokeStyle = '#7a6440'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x, y - 4.5); ctx.lineTo(x + 4, y + 2.5); ctx.lineTo(x - 4, y + 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#7a6440'; ctx.beginPath(); ctx.moveTo(x, y - 4.5); ctx.lineTo(x, y + 2.5); ctx.stroke();
    }
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(b.x, b.y + 3); ctx.lineTo(b.x, b.y - 11); ctx.stroke();
    ctx.fillStyle = b.k.color; ctx.beginPath(); ctx.moveTo(b.x, b.y - 11); ctx.lineTo(b.x + 7, b.y - 8.5); ctx.lineTo(b.x, b.y - 6); ctx.fill();
    if (z > 0.9) { ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.font = `${Math.max(3.5, 9 / z)}px Redaction35, system-ui`; ctx.textAlign='center'; ctx.fillText('⛺ Ordugâh', b.x, b.y + b.r + 9 / z); ctx.textAlign = 'left'; }
    ctx.globalAlpha = 1;
  }

}
function cpArrow(ctx, pts, renk, w, dash) {
  if (pts.length<2) return;
  const cizgi = () => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); };
  const a = pts[pts.length - 2], b = pts[pts.length - 1], aci = Math.atan2(b.y - a.y, b.x - a.x), hs = w * 2.4;
  const uc = () => { ctx.beginPath(); ctx.moveTo(b.x + Math.cos(aci) * hs * 0.6, b.y + Math.sin(aci) * hs * 0.6);
    ctx.lineTo(b.x - Math.cos(aci - 0.6) * hs, b.y - Math.sin(aci - 0.6) * hs); ctx.lineTo(b.x - Math.cos(aci + 0.6) * hs, b.y - Math.sin(aci + 0.6) * hs); ctx.closePath(); };
   ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash([w * 1.6, w * 1.2]);
  ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth = w + 2.2; cizgi();
  ctx.strokeStyle = renk; ctx.lineWidth = w; cizgi();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; uc(); ctx.fill();
  ctx.save(); ctx.translate(-Math.cos(aci) * 1.2, -Math.sin(aci) * 1.2); ctx.fillStyle = renk; ctx.scale(1, 1); uc(); ctx.fill(); ctx.restore();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';

}
function cpDrawPlans(ctx) {
  if (!Sim.cplan || !Sim.ready) return;
  for (const A of allArmies()) {
    if (!A.members.length || !A.cmd || A.state === 'sail' || A.lv) continue;

    const o = A.order, sutun = A.k.color;
     ctx.globalAlpha = 0.3;
    if (A.cp && A.cp.phase === 'flankwait' && A.cp.route) cpArrow(ctx, A.cp.route, sutun, 3.2, true);
    else if (A.cp && A.cp.phase === 'wavewait' && A.cp.foe && A.cp.foe.members.length) cpArrow(ctx, [A.cmd, A.cp.foe.cmd], sutun, 2.4, true);
    else if (o && o.cp && o.path) { const rest = [A.cmd, ...o.path.slice(o.i)]; if (rest.length > 1) cpArrow(ctx, rest, sutun, o.flank ? 3.4 : 5, false); }
    else if (o && o.cp && o.hide) {
      ctx.strokeStyle = sutun; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(o.x, o.y, 26, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.5; ctx.font = '12px Redaction35, system-ui'; ctx.textAlign = 'center'; ctx.fillText('🌲', o.x, o.y - 30); ctx.textAlign = 'left';
    } else if (o && o.cp && o.type === 'hold') {
      const yari = frontHalf(A, meleeCount(A)) + 14, cd = Math.cos(o.dir), sd = Math.sin(o.dir);
      ctx.strokeStyle = sutun; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = -1; t <= 1.001; t += 0.1) { const x = o.x + cd * 14 - sd * t * yari - cd * t * t * 10, y = o.y + sd * 14 + cd * t * yari - sd * t * t * 10; t <= -1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let t = -1; t <= 1.001; t += 0.25) { const x = o.x + cd * 14 - sd * t * yari - cd * t * t * 10, y = o.y + sd * 14 + cd * t * yari - sd * t * t * 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cd * 6, y + sd * 6); ctx.stroke(); }
      ctx.lineCap = 'butt';
    } else if (!A.manual && ["march", 'intercept', 'assault'].includes(A.state)) {
      const goal = A.state === 'intercept' && A.foeArmy ? A.foeArmy.cmd : A.target;
      if (goal) {
        const noktalar = [A.cmd, ...(A.path && A.state !== 'assault' ? A.path : []), goal];
        ctx.globalAlpha = 0.25; cpArrow(ctx, noktalar.length > 12 ? noktalar.filter((_, i) => i % 3 === 0 || i === noktalar.length - 1) : noktalar, sutun, 4.5, A.raid);
      }
    }
    ctx.globalAlpha = 1;
  }
  const gorulen = new Set();
  for (const A of allArmies()) {
    const G = A.cp && A.cp.group;
    if (!G || gorulen.has(G) || !G.type) continue;
    gorulen.add(G);
    const L = G.armies.filter(X => X.members.length && X.cmd && X.k.armies.includes(X));
    if (L.length < 2) continue;
    ctx.globalAlpha = 0.45; ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 1.6; ctx.setLineDash([3, 4]);
    ctx.beginPath(); L.forEach((X, i) => i ? ctx.lineTo(X.cmd.x, X.cmd.y) : ctx.moveTo(X.cmd.x, X.cmd.y)); ctx.stroke(); ctx.setLineDash([]);
    const cx=L.reduce((s, X) => s + X.cmd.x, 0) / L.length, cy = L.reduce((s, X) => s + X.cmd.y, 0) / L.length, z = Sim.cam.z;
    ctx.font = `bold ${Math.max(5, 11 / z)}px Redaction35, system-ui`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(GTYPE[G.type], cx + 0.8 / z, cy - 14 + 0.8 / z);
    ctx.fillStyle = '#ffd166'; ctx.fillText(GTYPE[G.type], cx, cy - 14); ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
   const z = Sim.cam.z;
  for (const m of Sim.msgs || []) {
    const p = m.p, hedef = m.stage === 'back' ? m.from : m.to;
    if (p.dead) continue;
    if (hedef && hedef.cmd) {
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#f1faee'; ctx.lineWidth = 1 / Math.max(0.5, z); ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(hedef.cmd.x, hedef.cmd.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
    const simge = m.stage === 'back' ? (m.ans ? '✅' : m.ans === false ? '❌' : '❓') : "✉️";
    ctx.font = '6px Redaction35, system-ui'; ctx.fillText(simge, p.x, p.y - 5);
    ctx.textAlign = 'left';
  }
}

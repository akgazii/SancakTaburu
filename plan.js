const ORDERS = {
  shape: { icon: '✏️', name: 'Düzen çiz', hint: 'Kalemle bir çizgi ya da kapalı bir şekil çiz: askerler o şekle dizilir (öndekiler piyade, arkadakiler okçu)' },
  attack: { icon: '➡️', name: 'Saldırı yolu', hint: 'Yolu çiz: ordu düzenini bozmadan bu yoldan yürür, yolun sonunda saldırıya geçer' },
  hold: { icon: '🛡', name: 'Burayı tut', hint: 'Tutulacak yere bas ve yüzlerini döneceği yöne doğru sürükle' },
  pierce: { icon: '🗡', name: 'Yar ve ayrıl', hint: 'Düşman hattının içinden geçen bir yol çiz: dar bir kolda yarıp geçerler, sonunda iki kanada ayrılıp arkadan vururlar' },
  envelop: { icon: '🦀', name: 'Kuşat (iki kanattan)', hint: 'Kuşatılacak düşmana tıkla: birlik ikiye ayrılır, iki yandan dolanıp kıskaca alır; okçular cepheden yağdırır' },
  move: { icon: "🚶", name: 'Yürü / çekil', hint: 'Yolu çiz: savaşa girmeden bu yoldan gider, varınca orada mevzi tutar' },
  feint: { icon: '🏇', name: 'Sahte ricat', hint: 'Geri kaçılacak yere tıkla: kaçar gibi yaparlar, düşman peşlerine düşüp yaklaşınca dönüp çullanırlar' },
  kite: { icon: '🏹', name: 'Vur-kaç', hint: '' },
  free: { icon: "🎯", name: 'Serbest saldırı', hint: '' },
};
const INSTANT = ['free', 'kite'];
const ordInfo = t => ORDERS[t] || { icon: '🎯', name: lang('Bölüm saldırısı'), hint: '' };
const PLAN = { open: false, army: null, tool: null, stroke: null };

const pathLen = pts => pts.reduce((s, p, i) => i ? s + dist(pts[i - 1], p) : 0, 0);
function resample(noktalar, adim) {
  const cikti = [{ x: noktalar[0].x, y: noktalar[0].y }];
  let onceki = noktalar[0], need = adim;
  for (let i = 1; i < noktalar.length; i++) {
    let a = onceki, d = dist(a, noktalar[i]);
    const b=noktalar[i];
    while (d >= need) {
      const t = need / d;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };

      cikti.push(a); d -= need; need = adim;
    }
    need -= d; onceki = b;
  }
  const son = noktalar[noktalar.length - 1];
  if (dist(cikti[cikti.length - 1], son) > adim * 0.3) cikti.push({ x: son.x, y: son.y });
  return cikti;
}

function nearestFoeArmy(A) {
  let bo = null, bd = Infinity;
  for (const O of allArmies()) {
    if (O === A || !O.members.length || O.state === 'sail' || !hostile(A.k, O.k)) continue;
    const d = dist2(A.cmd, O.cmd);
    if (unseen(O, A.k) && d > 90 * 90) continue;
    if (d < bd) { bd = d; bo = O; }
  }
  return bo;
}

function shapeSlots(A, o) {
  if (o.n === A.members.length && o.slots) return;
  const n = o.n = A.members.length, noktalar = o.pts, len = Math.max(7, pathLen(noktalar));
  const closed = noktalar.length > 4 && dist(noktalar[0], noktalar[noktalar.length - 1]) < Math.max(30, len * 0.12);

  const ranks = Math.max(1, Math.ceil(n * 7 / len)), per = Math.ceil(n / ranks);
  const cizgi = per > 1 ? resample(noktalar, len / (closed ? per : per - 1)) : [noktalar[noktalar.length >> 1]];
  let cx = 0, cy = 0;
  for (const p of noktalar) { cx += p.x; cy += p.y; }
  cx /= noktalar.length; cy /= noktalar.length;
  const dusman = nearestFoeArmy(A), tgt = dusman ? dusman.cmd : null;
  const normal = j => {

    const a = cizgi[Math.max(0, j - 1)], b = cizgi[Math.min(cizgi.length - 1, j + 1)], d = dist(a, b) || 1;
    return [-(b.y - a.y) / d, (b.x - a.x) / d];
  };
  const [mx, my] = normal(cizgi.length >> 1), mid = cizgi[cizgi.length >> 1];
  let sgn = 1;
  if (closed) sgn = mx * (mid.x - cx) + my * (mid.y - cy) >= 0 ? 1 : -1;
  else if (tgt) sgn = mx * (tgt.x - mid.x) + my * (tgt.y - mid.y) >= 0 ? 1 : -1;
  o.slots = new Map();
  A.members.forEach((p, i) => {
    const r=i / per | 0, j = Math.min(cizgi.length - 1, i % per), q = cizgi[j], [nx, ny] = normal(j);

    o.slots.set(p, { x: q.x - nx * sgn * r * 7, y: q.y - ny * sgn * r * 7, a: Math.atan2(ny * sgn, nx * sgn) });
  });
}

function orderMove(p, g, A) {

  const o = A.order, archer = isRanged(p), c = A.cmd;
  if (o.type === 'shape' || o.type === 'hold') {
    if (p.guardOf === c && A.battle && guardMove(p, g, A)) return;
    if (p === c && A.members.length >= 8 && !A.cmdFront ? reflex(p, g, 10) : o.silent ? reflex(p, g, 8) : strike(p, g, 110, 55)) return;
    let s;
    if (o.type === 'shape') { shapeSlots(A, o); s = o.slots.get(p); if (s) s = { x: s.x + o.ox, y: s.y + o.oy, a: s.a }; }
    else if (A.ww && (s = trenchSlot(A, p))) {  }
    else {
      const [lat, back] = slotOffset(A, p), cd = Math.cos(o.dir), sd = Math.sin(o.dir);
      s = { x: o.x - sd * lat - cd * back, y: o.y + cd * lat - sd * back, a: o.dir };
    }

    if (s && moveTo(p, s.x, s.y, 1.1)) p.a = s.a;
    return;
  }
  if (o.type === 'level') return levelMove(p, g, A);
  if (o.type === 'free') {
    const O=o.foe;
    if (p.guardOf === c && guardMove(p, g, A)) return;
    if (p === c && O && O.members.length && cmdBack(p, g, A, O.cmd.x, O.cmd.y)) return;
    if (strike(p, g, 110, 160)) return;
    if (O && O.members.length) moveTo(p, O.cmd.x, O.cmd.y, 1.05);
    return;
  }
  if (o.type === 'move') {
    const hit = A.hitT > Sim.tick - 60 && !(A.cp && A.cp.phase === 'escape');
    if (archer ? hit && fireAt(p, g, 95) : hit ? reflex(p, g, 8) : engage(p, g, 8)) return;
    if (p !== c) return formation(p, A, c.x, c.y);
    const wp=o.path[o.i];
    if (wp && (moveTo(c, wp.x, wp.y, 1.05) || dist2(c, wp) < 64)) o.i++;
    if (o.i >= o.path.length) {
      const e = o.path[o.path.length - 1], foe = nearestFoeArmy(A);
      A.order = { type: 'hold', x: e.x, y: e.y, dir: foe ? Math.atan2(foe.cmd.y - e.y, foe.cmd.x - e.x) : c.a };
      say(c, '🛡', 90);
    }
    return;
  }
  if (o.type==='feint') {
    if (archer ? fireAt(p, g, 95) : engage(p, g, 8)) return;
    if (p === c) { moveTo(c, o.x, o.y, 1.05); return; }
    return formation(p, A, c.x, c.y);
  }
  if (o.type === 'kite') {
    if (bj(p) === 'archer') {
      if (kiteAway(p, g)) return;
      if (shoot(p, g, 110)) return;
      const O = o.foe;
      if (O && O.members.length) { const a = Math.atan2(p.y - O.cmd.y, p.x - O.cmd.x); moveTo(p, O.cmd.x + Math.cos(a) * 95, O.cmd.y + Math.sin(a) * 95); }
      return;
    }
    if (strike(p, g, 110, 40)) return;

    const [lat, back] = slotOffset(A, p), cd = Math.cos(o.dir), sd = Math.sin(o.dir);
     if (moveTo(p, o.x - sd * lat - cd * back, o.y + cd * lat - sd * back, 1.1)) p.a = o.dir;
    return;
  }
  if (o.type === 'envelop') {
    const O = o.foe && o.foe.members.length ? o.foe : null, T = O ? O.cmd : o;
    const cd = Math.cos(o.dir), sd = Math.sin(o.dir);
    if (archer) {
       if (strike(p, g, 110, 25)) return;
      return moveTo(p, T.x - cd * 90 + (p.slot % 7 - 3) * 6 * -sd, T.y - sd * 90 + (p.slot % 7 - 3) * 6 * cd);
    }
    if (!o.done.has(p)) {
      if (engage(p, g, 10)) return;
      const taraf = memberIdx(A, p) % 2 ? 1 : -1, wx = T.x - sd * taraf * 85 - cd * 10, wy = T.y + cd * taraf * 85 - sd * 10;
      if (moveTo(p, wx, wy, 1.15) || dist2(p, { x: wx, y: wy }) < 400) o.done.add(p);
      return;
    }
    if (strike(p, g, 110, 160)) return;
    moveTo(p, T.x + cd * 15, T.y + sd * 15, 1.1);
    return;
  }
  const pierce = o.type === 'pierce';
  if (o.phase === 'split') {
    if (engage(p, g, 12)) return;
     const i = memberIdx(A, p), taraf = i % 2 ? 1 : -1, k = (i >> 1) % 6 - 2.5, cd = Math.cos(o.dir), sd = Math.sin(o.dir);
    moveTo(p, o.end.x + cd * (20 + k * 6) - sd * taraf * 70, o.end.y + sd * (20 + k * 6) + cd * taraf * 70, 1.15);
    return;
  }
  if (p === c) {
    if (engage(p, g, pierce ? 8 : A.members.length >= 8 && !A.cmdFront ? 10 : 25)) return;
    if (!pierce && A.vic && A.fireT > Sim.tick - 90) return;
    if (!pierce && A.ww && wwLead(A, o, c)) return;
    if (A.order !== o) return;
    const wp = o.path[o.i];
    if (wp && (moveTo(c, wp.x, wp.y, pierce ? 1.15 : 1) || dist2(c, wp) < 64)) o.i++;
    if (o.i >= o.path.length) {
      if (pierce) { o.phase = 'split'; o.t = 0; o.end = { x: c.x, y: c.y }; o.dir = c.a; say(c, '↔️', 120); }
      else { A.order = { type: 'free', t: 0, idle: 0, foe: o.then && o.then.members.length ? o.then : nearestFoeArmy(A) }; say(c, '⚔️', 120); }
    }
    return;
  }
  if (o.sapN && !o.sapOut && inLine(A, p)) {
    if (engage(p, g, 10)) return;
    const j = memberIdx(A, p), w = o.path[Math.max(0, Math.min(o.i, o.sapN) - 1 - (j >> 2))], a = c.a;
    moveTo(p, w.x - Math.sin(a) * ((j & 3) - 1.5) * 2.4, w.y + Math.cos(a) * ((j & 3) - 1.5) * 2.4, 1.05);
    return;
  }
  if (archer ? !pierce && strike(p, g, 95, 25) : strike(p, g, 95, pierce ? 8 : 25)) return;
  let lat, back;
  if (pierce) { const i = memberIdx(A, p); lat = (i % 3 - 1) * 6; back = 8 + (i / 3 | 0) * 6; }
  else { [lat, back] = slotOffset(A, p); back += 8; }
  const d = c.a;

  moveTo(p, c.x - Math.sin(d) * lat - Math.cos(d) * back, c.y + Math.cos(d) * lat - Math.sin(d) * back, pierce ? 1.2 : 1.05);
}

function orderTick(A) {
  const o = A.order;
  o.t = (o.t || 0) + 5;
  if (o.type==='hold') holdTrench(A, o);
  if (o.type === 'shape' && o.t > 250) {
    const O = nearestFoeArmy(A), busy = A.members.some(p => p.foe && !p.foe.dead && dist2(p, p.foe) < 80 * 80);
    if (O && !busy) {
      let cx = 0, cy = 0;
      for (const p of o.pts) { cx += p.x; cy += p.y; }
      cx = cx / o.pts.length + o.ox; cy = cy / o.pts.length + o.oy;
      const dx = O.cmd.x - cx, dy = O.cmd.y - cy, d = Math.hypot(dx, dy), v = CFG.walk * 5 * 0.55;
      if (d > 40) { o.ox += dx / d * v; o.oy += dy / d * v; }
    }
  }
  if (o.type === 'feint') {
    const O = nearestFoeArmy(A), close = O && O.members.some(q => dist2(q, A.cmd) < 90 * 90);
    const there = dist2(A.cmd, o) < (o.lure ? 35 * 35 : 400);
    if ((close && o.t > 60 && !o.lure) || (there && (o.lure || o.t > 900)) || o.t > 2500) {
      A.order = { type: 'free', t: 0, idle: 0, foe: O }; A.turnUntil = Sim.tick + 300;
      say(A.cmd, '🔄', 150);
      if (O && close) chron(lang`🏇 ${A.k.name} birliği kaçar gibi yaptı, peşine düşen ${O.k.name} askerlerine birden dönüp saldırdı!`, A.k, O.k);
    }
  }
  if ((o.type === 'kite' || o.type === "envelop") && (!o.foe || !o.foe.members.length)) o.foe = nearestFoeArmy(A);
  if (o.type === 'envelop' && o.t > 1500) A.order = { type: "free", t: 0, idle: 0, foe: nearestFoeArmy(A) };
  if (o.type === 'pierce' && o.phase === "split" && o.t > 220) A.order={ type: 'free', t: 0, idle: 0, foe: nearestFoeArmy(A) };
  else if (o.type === 'free') {
    if (!o.foe || !o.foe.members.length) o.foe = nearestFoeArmy(A);
    const mesgul=A.members.some(p => p.foe && !p.foe.dead && !downed(p.foe));
    o.idle = mesgul ? 0 : o.idle + 5;
    if (o.idle > 400 && (!o.foe || dist(A.cmd, o.foe.cmd) > 500)) {
      A.order = null;
      if (!A.manual && A.target) A.state = "march";
    }
  }

}

function manualArmy(A)
{

  const k = A.k;
  A.members = A.members.filter(p => !p.dead && p.state === 'army');
  countUnits(A);
  if (!A.members.length) {
    if (A.battle) endBattle(A.battle, A);
    k.armies = k.armies.filter(x => x !== A)

    if (PLAN.army === A) PLAN.army = null;
    chron(lang`☠ ${k.name} ordusu yok edildi`, k);

    return;
  }

  if (A.cmd.dead || !A.members.includes(A.cmd)) {
    const eski = A.cmd;
    A.cmd=pickCmd(A.members);
    A.cmdLost = true;
     if (Sim.cplan && A.cp && !A.lv && !A.headless) cpHeadless(A, eski);
    else if (!A.headless) chron(lang`🎖 ${k.name} ordusunda komutan ${fullName(eski)} düştü. Yerine ${fullName(A.cmd)} geçti`, k);
  }
  A.t += 5;
  if (A.state === 'battle') return;
  if (A.state === 'retreat') {
    const F = nearestFoeArmy(A);
    if (A.t > 500 || (F && superior(A, F))) { A.state = 'idle'; A.t = 0; A.routT = 0; }
    else return;
  }
  if (armyHitReact(A)) return;

  if (!cpHidden(A)) for (const O of allArmies()) {
    if (O === A || O.state === 'sail' || !O.members.length || !hostile(k, O.k) || (O.state === 'retreat' && !superior(A, O))) continue;
    if (O.state === 'battle') { if (tryJoin(A, O)) return; continue; }
    if (unseen(O, k) && dist2(A.cmd, O.cmd) > 90 * 90) continue;
    if (dist2(A.cmd, O.cmd) < 260 * 260) return startBattle(A, O);
  }
  if (cpManual(A)) return;
  if (!A.order) {
    A.foeArmy = nearestFoeArmy(A);
    if (A.foeArmy) { A.state = 'seek'; A.lastFoe = { x: A.foeArmy.cmd.x, y: A.foeArmy.cmd.y }; A.lastFoeDone = false; A.blindT = 0; A.searching = false; A.searchPt = null; }
    else searchTick(A);
  }
}

function searchTick(A)
{
  const dusmanlar = allArmies().some(O => O.members.length && O.state !== 'sail' && hostile(A.k, O.k));
  if (!dusmanlar) { A.state = 'idle'; A.searching=false; A.blindT=0; return; }
  A.blindT = (A.blindT || 0) + 5;
  if (A.blindT<400) { A.state = 'idle'; return; }
  if (!A.searching) {
    A.searching = true;
    say(A.cmd, '🔍', 150);
    chron(lang`🔍 ${A.k.name} ordusu düşmanı gözden kaybetti; ${A.lastFoe ? lang('son görüldüğü yere ve ') : ''}çevredeki ormanlara arama yapıyor`, A.k);
  }
  A.state = 'search';
  if (!A.searchPt || dist2(A.cmd, A.searchPt) < 35 * 35 || Sim.tick > A.searchUntil) { A.searchPt = nextSearchPt(A); A.searchUntil = Sim.tick + 1500; }
}
function nextSearchPt(A)
{
   if (A.lastFoe && !A.lastFoeDone) { A.lastFoeDone = true; return A.lastFoe; }
  const c = A.lastFoe || A.cmd, gorulen = A.visited || (A.visited = []);
  let enIyi = null, bs = -Infinity;
  for (let i = 0; i < 90; i++) {
    const a = rnd(0, 6.28), d = rnd(50, 500), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
    if (terrainAt(x, y) !== T_FOREST || !speedAt(x, y) || gorulen.some(v => dist2(v, { x, y }) < 90 * 90)) continue;
    let dense = 0;
     for (const [dx, dy] of [[25, 0], [-25, 0], [0, 25], [0, -25]]) if (terrainAt(x + dx, y + dy) === T_FOREST) dense++;
    const s = dense * 10 - Math.sqrt(dist2(A.cmd, { x, y })) * 0.03;
    if (s>bs) { bs = s; enIyi = { x, y }; }
  }
  if (!enIyi) { const a = rnd(0, 6.28); enIyi = { x: inMapX(c.x + Math.cos(a) * 250), y: inMapY(c.y + Math.sin(a) * 250) }; }
  gorulen.push(enIyi); if (gorulen.length > 10) gorulen.shift();
  return enIyi;
}
function manualMove(p, g, A) {
  const c = A.cmd;
  if (A.state==="retreat") {
    if (p===c) return moveTo(c, A.home.x, A.home.y);
    return formation(p, A, c.x, c.y);
  }
  if (A.state === 'search' && A.searchPt) {
    if (p===c) return followPath(A, A.searchPt);
    return formation(p, A, c.x, c.y);
  }
  if (A.state === 'seek' && A.foeArmy && A.foeArmy.members.length) {
    if (p === c) return followPath(A, A.foeArmy.cmd);
    return formation(p, A, c.x, c.y);
  }
  if (p === c) return;
  formation(p, A, c.x, c.y);
}

const selUnits = () => [...MULTI].filter(p => !p.dead && p.state !== 'jailed' && p.state !== 'arrested' && p !== Sim.ctrl &&
  (p.army ? p.army.state !== 'sail' : isAdult(p) && p.job !== 'king'));
function orderGroups() {
  const secili = selUnits();
  if (!secili.length) return PLAN.army && PLAN.army.members.length ? [PLAN.army] : [];
  const byK = new Map();
  for (const p of secili) { if (!byK.has(p.k)) byK.set(p.k, []); byK.get(p.k).push(p); }
  const cikti = [];
  for (const [k, ps] of byK) {
    const A = ps[0].army;
    if (A && ps.every(p => p.army === A) && ps.length >= A.members.length) { cikti.push(A); continue; }
    const from = A && ps.every(p => p.army === A) ? A : null, B = makeManualArmy(k, ps);
    if (from) { B.form = from.form; B.btac = from.btac; B.btacSet=from.btacSet; sortRanks(B); }
    chron(lang`🚩 ${k.name}: ${armyComp(ps)} ${from ? lang('ordudan ayrılıp') : lang("toplanıp")} ayrı bir bölük kurdu. Bölük komutanı ${fullName(B.cmd)}`, k);
    cikti.push(B);
  }
  return cikti;
}
function mergeSelected() {
  const byK = new Map();
  for (const p of selUnits()) if (p.army) { if (!byK.has(p.k)) byK.set(p.k, new Set()); byK.get(p.k).add(p.army); }
  let n = 0;
  for (const [k, set] of byK) {
    const liste = [...set];
    if (liste.length < 2) continue;
    const main=liste.reduce((a, b) => (a.manual ? 0 : 1000) + a.members.length >= (b.manual ? 0 : 1000) + b.members.length ? a : b);
    for (const X of liste) {
      if (X === main) continue;
      if (X.battle) endBattle(X.battle, null);
      main.members.push(...X.members); main.start += X.members.length;
      X.members=[]; k.armies = k.armies.filter(Y => Y !== X);
      if (PLAN.army === X) PLAN.army = main;
      n++;
    }
    sortRanks(main);
    chron(lang`🔗 ${k.name} bölükleri birleşti: ${armyComp(main.members)}`, k);
  }
  return n;
}
function groupLabel() {
  const secili = selUnits();
  if (secili.length) {
    const A = secili[0].army, whole = A && secili.every(p => p.army === A) && secili.length >= A.members.length;
    return whole ? lang`Emir alacak: <b>bütün ordu</b> (${secili.length} kişi seçili)` : lang`Emir alacak: <b style="color:#78ff8c">sadece seçili ${secili.length} birim</b> (${armyComp(secili)}) · ayrı bölük olur`;
  }
  return PLAN.army ? lang('Emir alacak: <b>bütün ordu</b> · sadece bir kısmına emir için haritada seç (kutu/Ctrl+tık)') : '';
}

function togglePlan(on = !PLAN.open) {
  PLAN.open = on;
  $('plan').classList.toggle('hidden', !on);
  document.body.classList.toggle('planOn', on);
  $('planTab').classList.toggle('on', on)
  if (!on) { PLAN.tool = null; PLAN.stroke = null; }
  renderPlan(); refreshHint();
}
function initPlan() {

  $('planTab').onclick=() => togglePlan();
  $('planCp').onclick = () => {
    cpSet(!Sim.cplan); renderPlan();
    planMsg(Sim.cplan ? lang("Komutan planları açık: ordugâh, plan ve mesajcılar.") : lang('Komutan planları kapalı: ordular doğrudan en yakın düşmana yürür.'));
  };
  $('planTools').innerHTML=Object.entries(ORDERS).map(([t, O]) => `<button data-o="${t}">${O.icon} ${O.name}</button>`).join('') +
    lang`<button data-o="clear">❌ Emri kaldır</button><button data-o="merge">🔗 Seçili bölükleri birleştir</button>`;
  $('planForm').innerHTML = Object.entries(FORMS).map(([f, n]) => `<option value="${f}">${n}</option>`).join('');
  $('planTac').innerHTML = lang`<option value="">🧠 Komutan seçsin</option>` + Object.entries(BTAC).map(([t, n]) => `<option value="${t}">${TAC_ICON[t]} ${n}</option>`).join('');
  $('planForm').onchange = () => {
    const gs = orderGroups();
    for (const A of gs) { A.form=$('planForm').value; A.formSet = true; if (A.order) A.order.n=-1; say(A.cmd, '📣', 90); }
    if (gs.length) { PLAN.army = gs[0]; planMsg(lang`Düzen: ${FORMS[$('planForm').value]}`); renderPlan(); }
  };
  $('planTac').onchange = () => {
    const v = $('planTac').value, gs = orderGroups();
    for (const A of gs) { A.btacSet = !!v; A.btac = v || battleTactic(A.cmd, A); say(A.cmd, TAC_ICON[A.btac], 90); }
    if (gs.length) { PLAN.army=gs[0]; planMsg(v ? lang`Meydan taktiği: ${BTAC[v]} (emir yokken savaşta uygulanır)` : lang('Taktiği komutan seçecek.')); renderPlan(); }
  };
  $('planTools').onclick = e => {
    const t = e.target.dataset.o;
    if (!t) return;
    if (t === 'merge') { const n = mergeSelected(); planMsg(n ? lang`${n} bölük birleştirildi.` : lang('Birleştirmek için aynı krallıktan en az iki bölüğün askerlerini seç.')); renderPlan(); return; }
    if (!hasTargets()) return planMsg(lang('Önce listeden bir ordu seç ya da haritada birimleri seç (kutu / Ctrl+tık).'));
    if (t==='clear') { for (const A of orderGroups()) A.order = null; PLAN.tool = null; planMsg(lang('Emir kaldırıldı, komutan kendi aklıyla yönetiyor.')); }
    else if (INSTANT.includes(t)) {
      for (const A of orderGroups()) {
        A.order = t === 'free' ? { type: 'free', t: 0, idle: 0, foe: nearestFoeArmy(A) } : { type: 'kite', x: A.cmd.x, y: A.cmd.y, dir: dirToFoe(A, A.cmd), foe: nearestFoeArmy(A), t: 0 };
        say(A.cmd, ORDERS[t].icon, 120);
      }
      PLAN.tool = null; planMsg(t === 'free' ? lang('Serbest saldırı: herkes en yakın düşmana!') : lang('Vur-kaç: okçular menzili korur, piyade perde olur.'));
    }
    else { PLAN.tool = PLAN.tool === t ? null : t; planMsg(PLAN.tool ? ORDERS[t].hint : ''); }
    renderPlan(); refreshHint();
  };
  $('planList').onclick = e => {
    const el = e.target.closest('[data-army]');
     if (!el) return;
    const A = allArmies().find(x => x.id === +el.dataset.army);
    if (A) { PLAN.army=A; MULTI.clear(); Object.assign(Sim.cam, { x: A.cmd.x, y: A.cmd.y }); Sim.follow = false; renderPlan(); refreshHint(); }
  };
}
const hasTargets = () => selUnits().length > 0 || !!(PLAN.army && PLAN.army.members.length);
const dirToFoe = (A, at) => { const f=nearestFoeArmy(A); return f ? Math.atan2(f.cmd.y - at.y, f.cmd.x - at.x) : A.cmd.a; };
const planMsg = t => { $('planMsg').textContent = t; };
function renderPlan() {
  if (!PLAN.open) return;

  const cpb = $('planCp'), cpt = lang`Komutan planları: ${Sim.cplan ? lang('Açık') : lang('Kapalı')}`;
  if (cpb.textContent!==cpt) cpb.textContent = cpt;
  cpb.classList.toggle('on', !!Sim.cplan);
  if (PLAN.army && !PLAN.army.members.length) PLAN.army = null;
  const liste = Sim.ready ? allArmies().filter(A => A.members.length && A.state !== 'sail') : [];
  const st = A => A.order ? lang`${ordInfo(A.order.type).icon} ${ordInfo(A.order.type).name}` : A.state === "battle" ? lang('⚔️ savaşta') : A.state === 'retreat' ? lang('🏳 çekiliyor') : lang('🧠 komutanın aklıyla');
  planRows(liste.map(A => ({ id: A.id, cls: 'kr' + (A === PLAN.army ? ' sel' : ''), html: `<span class="sw" style="background:${A.k.color}"></span>` +
    `<span>${A.k.name}<br><span class="muted" style="font-size:11px">${st(A)}</span></span><span class="n">${A.members.length - A.nArch - (A.nCav || 0) - (A.nArt || 0)} ${A.ww ? lang('piyade') : A.vic ? lang('tüfekli') : lang('yaya')}${A.nCav ? ' · ' + A.nCav + (A.ww ? ' tank' : lang(' atlı')) : ''}${A.nArch ? ' · ' + A.nArch + (A.ww ? lang(' nişancı') : A.vic ? lang(' avcı') : lang(' okçu')) : ""}${A.nArt ? ' · ' + A.nArt + (A.ww ? lang(' ağır silah') : ' top') : ''}</span>` })), lang('<span class="muted">Ortada ordu yok. Alttaki ⚔️ Ordu menüsünden ordu çıkarabilir ya da bir savaş başlatabilirsin.</span>'));
  for (const b of $('planTools').children) b.classList.toggle('on', b.dataset.o === PLAN.tool);
  const A = PLAN.army;
  renderPlanSel();

  if (A && document.activeElement !== $('planForm')) $('planForm').value = A.form;
  if (A && document.activeElement !== $('planTac')) $('planTac').value = A.btacSet ? A.btac : '';
}
function planRows(satirlar, empty)
{
  const el = $('planList');
  if (!satirlar.length) { el._keys = null; return setHTML(el, empty); }
  const keys = satirlar.map(r => r.id).join(',');

  if (el._keys !== keys) {
    el.innerHTML = satirlar.map(r => `<div class="${r.cls}" data-army="${r.id}">${r.html}</div>`).join('');
    satirlar.forEach((r, i) => { el.children[i]._h = r.html; });
    el._keys=keys; el._h = null;
    return;
  }
  satirlar.forEach((r, i) => {
    const c = el.children[i];
    if (c.className !== r.cls) c.className = r.cls;
    if (c._h!==r.html) { c._h = r.html; c.innerHTML = r.html; }
  });
}

function renderPlanSel() {
  if (!PLAN.open) return;
  const A = PLAN.army;
  setHTML($('planSel'), (A ? lang`Seçili: <b style="color:${A.k.color}">${A.k.name}</b> · Komutan ${pL(A.cmd)} · ${TAC_ICON[A.btac] || ''} ${BTAC[A.btac] || ''}` : lang('<span class="muted">Ordu seçilmedi</span>')) +
    `<br><span style="font-size:11px">${groupLabel()}</span>`);
}

function planDown(x, y)
{
  if (!PLAN.open || !PLAN.tool || !hasTargets()) return false;
  PLAN.stroke = [{ x, y }];
  return true;
}
function planMove(x, y) {
  const s = PLAN.stroke, l = s[s.length - 1];
  if ((l.x - x) ** 2 + (l.y - y) ** 2 > (3 / Sim.cam.z) ** 2) s.push({ x, y });
}
function foeArmyAt(A, x, y) {

  let bo = null, bd=160 * 160;
  for (const O of allArmies()) {
    if (!O.members.length || O.state === 'sail' || !hostile(A.k, O.k)) continue;
    for (const q of O.members) { const d=(q.x - x) ** 2 + (q.y - y) ** 2; if (d<bd) { bd = d; bo = O; } }
  }
  return bo || nearestFoeArmy(A);
}
function planUp() {
  const s = PLAN.stroke, t = PLAN.tool;
  PLAN.stroke = null;
  if (!hasTargets()) return;
  const uzunluk = pathLen(s), point = ['hold', "feint", 'envelop'].includes(t);
  if (!point && uzunluk < 12) return planMsg(lang('Çok kısa, biraz daha uzun çiz.'));
  const gs = orderGroups();
  for (const A of gs) {
    if (t === 'hold') {
      const bitis = s[s.length - 1];
      const yon = uzunluk > 15 ? Math.atan2(bitis.y - s[0].y, bitis.x - s[0].x) : dirToFoe(A, s[0]);
      A.order = { type: 'hold', x: s[0].x, y: s[0].y, dir: yon };
    } else if (t === 'feint') A.order = { type: 'feint', x: s[0].x, y: s[0].y, t: 0 };
    else if (t==="envelop") {
      const O = foeArmyAt(A, s[0].x, s[0].y), T = O ? O.cmd : s[0];
      A.order = { type: 'envelop', x: s[0].x, y: s[0].y, foe: O, dir: Math.atan2(T.y - A.cmd.y, T.x - A.cmd.x), done: new Set(), t: 0 };
    }
    else if (t==='shape') A.order = { type: 'shape', pts: resample(s, 4), ox: 0, oy: 0 };
    else A.order={ type: t, path: resample(s, 18), i: 0, phase: 'go', t: 0 };
    if (A.state === 'retreat' || A.state === 'ambush') { A.state = A.manual ? "idle" : "march"; A.ambush = null; }
    say(A.cmd, '📣', 120);
    plog(A.cmd, lang`${ORDERS[t].name} emrini aldı`);
  }
  if (gs.length) PLAN.army = gs[0];
  PLAN.tool = null;
  planMsg(lang`${ORDERS[t].icon} ${ORDERS[t].name} emri verildi.`);
  renderPlan(); refreshHint();
}

function arrowHead(ctx, a, b, s) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath(); ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - Math.cos(ang - 0.5) * s, b.y - Math.sin(ang - 0.5) * s);
  ctx.lineTo(b.x - Math.cos(ang + 0.5) * s, b.y - Math.sin(ang + 0.5) * s);
  ctx.fill();
}
function strokeLine(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
function drawPlans(ctx) {
  if (!Sim.ready) return;
  const z = Sim.cam.z;
  for (const A of allArmies()) {
    const o = A.order, secili = A === PLAN.army && PLAN.open;
    if (secili) {
      ctx.strokeStyle = 'rgba(255,209,102,0.8)'; ctx.lineWidth = 1 / z;
      ctx.beginPath(); for (const p of A.members) { ctx.moveTo(p.x + 4.5, p.y); ctx.arc(p.x, p.y, 4.5, 0, 7); } ctx.stroke();
      ctx.lineWidth = 2 / z; ctx.beginPath(); ctx.arc(A.cmd.x, A.cmd.y, 8, 0, 7); ctx.stroke();
    }
    if (!o || (!secili && !PLAN.open)) continue;
    ctx.globalAlpha = secili ? 0.9 : 0.35;
    ctx.strokeStyle=ctx.fillStyle = A.k.color; ctx.lineWidth=2.5 / z; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.type === "shape") { ctx.setLineDash([6 / z, 4 / z]); strokeLine(ctx, o.pts.map(p => ({ x: p.x + o.ox, y: p.y + o.oy }))); ctx.setLineDash([]); }
    else if (o.type === 'hold') {
      ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, 7); ctx.stroke();

      const b = { x: o.x + Math.cos(o.dir) * 30, y: o.y + Math.sin(o.dir) * 30 };
      strokeLine(ctx, [o, b]); arrowHead(ctx, o, b, 8);
    } else if (o.type === 'feint') {
      ctx.setLineDash([5 / z, 4 / z]); strokeLine(ctx, [A.cmd, o]); ctx.setLineDash([]); arrowHead(ctx, A.cmd, o, 8);
       ctx.beginPath(); ctx.arc(o.x, o.y, 9, Math.PI * 0.2, Math.PI * 1.8); ctx.stroke();
    } else if (o.type==='kite') {
      ctx.setLineDash([3 / z, 4 / z]); ctx.beginPath(); ctx.arc(o.x, o.y, 95, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    } else if (o.type === 'envelop') {
      const T = o.foe && o.foe.members.length ? o.foe.cmd : o, cd = Math.cos(o.dir), sd=Math.sin(o.dir);
      for (const sd2 of [-1, 1]) {
        const w = { x: T.x - sd * sd2 * 85 - cd * 10, y: T.y + cd * sd2 * 85 - sd * 10 }, e = { x: T.x + cd * 15, y: T.y + sd * 15 };
         strokeLine(ctx, [A.cmd, w, e]); arrowHead(ctx, w, e, 8);
      }
    } else if (o.path) {
      if (o.type === 'move') ctx.setLineDash([2 / z, 5 / z]);
      if (o.type === 'pierce') ctx.strokeStyle = ctx.fillStyle = '#ff4d4d';
      const kalan = o.phase === 'go' ? [A.cmd, ...o.path.slice(o.i)] : o.path;
      if (kalan.length > 1) { strokeLine(ctx, kalan); ctx.setLineDash([]); arrowHead(ctx, kalan[kalan.length - 2], kalan[kalan.length - 1], 9); }
      ctx.setLineDash([]);
      if (o.type === "pierce" && kalan.length > 1) {
        const a = kalan[kalan.length - 2], b = kalan[kalan.length - 1], aci = Math.atan2(b.y - a.y, b.x - a.x);
        for (const s of [-1, 1]) { const e = { x: b.x + Math.cos(aci + s * 1.1) * 25, y: b.y + Math.sin(aci + s * 1.1) * 25 }; strokeLine(ctx, [b, e]); arrowHead(ctx, b, e, 7); }
      }
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  if (PLAN.stroke && PLAN.stroke.length > 1) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth=2.5 / z; ctx.lineCap='round';

    strokeLine(ctx, PLAN.stroke); ctx.lineCap = 'butt';
  }
}

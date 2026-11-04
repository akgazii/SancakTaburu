const LV_UNITS = [['soldier', '🗡', "Piyade", 50], ['archer', '🏹', 'Okçu', 70], ['cavalry', '🐎', 'Süvari', 120], ['artillery', '💣', 'Topçu', 300]];
const LV_COST = Object.fromEntries(LV_UNITS.map(u => [u[0], u[3]]));
const LV_NAME = Object.fromEntries(LV_UNITS.map(u => [u[0], u[2]]));
const LV_ICON = Object.fromEntries(LV_UNITS.map(u => [u[0], u[1]]));
const LV_ZX0 = 50, LV_ZX1 = 340, LV_ZY = 190;
const LV_GAP = 8;
const LV={ on: false, list: [], prog: {}, edit: false, cur: -1, phase: null, c: null, pA: null, eA: null, kP: null, kE: null,
  tool: 'soldier', etool: 'soldier', money: 0, last: null, result: null, paint: null, t: 0, saved: 0 };

const lvBlank = i => ({ name: lang`Bölüm ${i + 1}`, money: 1000, race: 'orc', prace: 'human', enemy: [] });
function lvLoad() {
  let liste = null, prog = null;
   try { liste = JSON.parse(localStorage.getItem('krallik.levels')); prog = JSON.parse(localStorage.getItem('krallik.levelProg')); } catch {}
  LV.list = Array.isArray(liste) && liste.length ? liste : Array.from({ length: 10 }, (_, i) => lvBlank(i));
  LV.prog = prog && typeof prog === 'object' ? prog : {};
}
function lvSave() {
  try { localStorage.setItem('krallik.levels', JSON.stringify(LV.list)); localStorage.setItem('krallik.levelProg', JSON.stringify(LV.prog)); } catch {}
  LV.saved = Date.now();
}
const lvDef = () => LV.list[LV.cur];

const lvUnlocked = i => LV.edit || i === 0 || (LV.prog[i - 1] && LV.prog[i - 1].won) || (LV.prog[i] && LV.prog[i].won) || !LV.list[i - 1].enemy.length;

function lvSeeded(seed, fn)
{

  const r = Math.random;
  let s = (seed * 2654435761) >>> 0 || 1;
  Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  try { fn(); } finally { Math.random = r; }
}

function lvField() {
  let enIyi = null, bs = -1;
  for (let cy = H / 2 - 400; cy <= H / 2 + 400; cy += 100) for (let cx = W / 2 - 600; cx <= W / 2 + 600; cx += 100) {
    let s = 0;
    for (let y = -LV_ZY - 20; y <= LV_ZY + 20; y += 30) for (let x = -LV_ZX1 - 20; x <= LV_ZX1 + 20; x += 30) {
      const t = terrainAt(cx + x, cy + y);
      s += t === T_GRASS ? 1 : t === T_BEACH ? 0.6 : t === T_FOREST ? 0.35 : t === T_HILLS ? 0.3 : -2;
    }
    s -= Math.hypot(cx - W / 2, cy - H / 2) * 0.01;
    if (s>bs) { bs = s; enIyi = { x: cx, y: cy }; }
  }
  return enIyi;
}

function levelMode() {
  campOff();
  lvLoad();
  LV.on = true; LV.cur = -1; LV.phase = 'select'; LV.result = null;

  Sim.arena = true; Sim.placing = null; Sim.tool = null; MULTI.clear();
  if (PLAN.open) togglePlan(false);
  if (!Sim.ready) { initWorld(); Sim.wx = { season: 1, rain: false }; }
  setMode('level');
  lvUI();
}
function levelOff() {
  if (!LV.on) return;
  LV.on = false; LV.phase = null; LV.paint = null; Sim.level = null;
  lvUI();
}

function lvOpen(i)
{
  LV.cur = i; LV.result = null;
  const d = lvDef();
  Sim.arena = true;
  lvSeeded(i + 1, () => initWorld());

  Sim.wx={ season: 1, rain: false };
  Sim.log.length = 0;
  LV.c = lvField();
  const c = LV.c;
  LV.kP = arenaSide(0, d.prace, c.x - 200, c.y); LV.kP.name = lang('Senin Ordun');
  LV.kE = arenaSide(1, d.race, c.x + 200, c.y); LV.kE.name = lang('Düşman');
  LV.pA = lvArmy(LV.kP); LV.eA=lvArmy(LV.kE);

  for (const u of d.enemy) lvAdd(LV.eA, u.j, c.x + u.x, c.y + u.y);
  LV.money=d.money;
  if (LV.last && LV.last.i === i) for (const u of LV.last.units) if (LV_COST[u.j] <= LV.money) { lvAdd(LV.pA, u.j, c.x + u.x, c.y + u.y); LV.money -= LV_COST[u.j]; }
  LV.phase = 'prep'; LV.t = 0;
  Object.assign(Sim.cam, { x: c.x, y: c.y, z: clamp(VW / 820, 0.8, 2.4) });
  Sim.follow = false; Sim.sel = null;
  if (!Sim.speed) Sim.speed = SPEED1;
  lvUI();
}
function lvBack() { LV.phase = 'select'; LV.result = null; LV.paint = null; lvUI(); }

function lvArmy(k) {
  return { id: Sim.nextArmy++, k, enemy: null, target: null, cmd: null, members: [], start: 0, plan: 'attack', raid: false, state: 'idle', t: 0, cap: 0,
    morale: 100, btac: 'charge', btacSet: true, form: 'line', foeArmy: null, battle: null, massacre: false, manual: true, home: { x: k.capital.x, y: k.capital.y }, lv: true };
}
function lvAdd(A, meslek, x, y) {

  const k = A.k, p = newTroop(k.race, k, k.capital, x, y, meslek);
  p.a = A === LV.pA ? 0 : Math.PI
  A.members.push(p);
  sortRanks(A);
  A.cmd = pickCmd(A.members);
   return p;

}
function lvRemove(A, p) {
  p.dead = true
  A.members = A.members.filter(q => q !== p);
  Sim.people = Sim.people.filter(q => q !== p);
  if (A.members.length) { sortRanks(A); A.cmd = pickCmd(A.members); } else A.cmd = null;
}
const lvNearest = (A, x, y, r) => { let b = null, bd = r * r; for (const p of A.members) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p; } } return b; };
function lvCanPlace(x, y, dusman) {
  const c = LV.c, dx = (x - c.x) * (dusman ? 1 : -1);
  if (dx < LV_ZX0 || dx > LV_ZX1 || Math.abs(y - c.y) > LV_ZY) return lang('Sadece kendi alanına dizebilirsin.');
  if (!speedAt(x, y)) return lang('Oraya asker konmaz.');
   for (const A of [LV.pA, LV.eA]) for (const p of A.members) if ((p.x - x) ** 2 + (p.y - y) ** 2 < (p.job === 'cavalry' || p.job === 'artillery' ? 10 : LV_GAP) ** 2) return 'dolu';
  return null;
}
function lvPlace(x, y, dusman) {
  const job = dusman ? LV.etool : LV.tool, why = lvCanPlace(x, y, dusman);
  if (why) return why;
  if (!dusman) {
    if (LV_COST[job] > LV.money) return lang('Paran yetmiyor!');
    LV.money -= LV_COST[job];
    lvAdd(LV.pA, job, x, y);
  } else { lvAdd(LV.eA, job, x, y); lvStoreEnemy(); }
   return null;
}
function lvStoreEnemy() {
  const c = LV.c;
  lvDef().enemy = LV.eA.members.map(p => ({ j: p.job, x: Math.round(p.x - c.x), y: Math.round(p.y - c.y) }));
  lvSave();
}
function lvAutoSpot(meslek, mine) {
  const sg = mine ? -1 : 1, en = !mine;
  const c = LV.c, [x0, x1, k0, k1] = { soldier: [70, 135, 0, 55], archer: [150, 215, 0, 65], cavalry: [75, 200, 75, 130], artillery: [240, 330, 0, 90] }[meslek];
  const adim = meslek === 'artillery' || meslek === 'cavalry' ? 12 : 10;
  for (let dx = x0; dx <= x1; dx += adim) {
    const ys = [];
    for (let k = k0; k <= k1; k += adim) ys.push(k, -k);
    for (const dy of ys) { const x = c.x + dx * sg, y = c.y + dy; if (!lvCanPlace(x, y, en)) return { x, y }; }
  }
  for (let dx = LV_ZX0; dx <= LV_ZX1; dx += 10) for (let dy = -LV_ZY; dy <= LV_ZY; dy += 10) if (!lvCanPlace(c.x + dx * sg, c.y + dy, en)) return { x: c.x + dx * sg, y: c.y + dy };
  return null;
}
function lvEnemyPlus(job, n)
{

  for (let i = 0; i < n; i++) {
    if (n>0) { const s = lvAutoSpot(job); if (!s) break; lvAdd(LV.eA, job, s.x, s.y); }
  }
  lvStoreEnemy();

}
function lvEnemyMinus(meslek, n) {
  for (let i = 0; i < n; i++) {
    const liste = LV.eA.members.filter(p => p.job === meslek);
    if (!liste.length) break;
    lvRemove(LV.eA, liste.reduce((a, b) => Math.abs(a.x - LV.c.x) > Math.abs(b.x - LV.c.x) ? a : b));
  }
  lvStoreEnemy();
}
function lvRelayout() {
  const meslekler = LV.eA.members.map(p => p.job);
  for (const p of [...LV.eA.members]) lvRemove(LV.eA, p);
  for (const j of ['soldier', 'cavalry', 'archer', 'artillery']) for (const x of meslekler) if (x === j) { const s = lvAutoSpot(j); if (s) lvAdd(LV.eA, j, s.x, s.y); }
  lvStoreEnemy();
}
function lvClearPlayer() {
  for (const p of [...LV.pA.members]) { LV.money += LV_COST[p.job]; lvRemove(LV.pA, p); }
}

function lvSetRace(dusman, rk)
{
  const d = lvDef();
  if (dusman) d.race = rk; else d.prace = rk;
  lvSave();
  const keep = LV.pA.members.map(p => ({ j: p.job, x: p.x - LV.c.x, y: p.y - LV.c.y }));
  LV.last = { i: LV.cur, units: keep };
   lvOpen(LV.cur);
}

function lvStart()
{
  if (!LV.pA.members.length) return lvMsg(lang('Önce asker diz!'));
  if (!LV.eA.members.length) return lvMsg(LV.edit ? lang('Düşman yok: önce düşman askeri ekle.') : lang('Bu bölüm boş.'));
  const c = LV.c;
  LV.last = { i: LV.cur, units: LV.pA.members.map(p => ({ j: p.job, x: Math.round(p.x - c.x), y: Math.round(p.y - c.y) })) };
  LV.spent = lvDef().money - LV.money;
  for (const [A, O] of [[LV.pA, LV.eA], [LV.eA, LV.pA]]) {
    A.cmd = pickCmd(A.members); A.start = A.members.length; A.order = { type: 'level', foe: O };
    A.k.armies.push(A);
  }
  LV.phase='fight'; LV.t = 0; LV.paint = null;
  if (!Sim.speed) Sim.speed = SPEED1;
  refreshSpeeds()
  lvUI();
}
function levelMove(p, g, A) {
  const O = A.order.foe;
  if (!O || !O.members.length) return;
  let T=p.lvT;
  if (!T || T.dead || (Sim.tick + p.id) % 20 === 0) {
    let bd = Infinity; T = null;
    for (const q of O.members) { if (q.dead) continue; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; T = q; } }
    p.lvT = T;
  }
  if (!T) return;
  const d = dist(p, T);
  if (p.job === 'artillery') {
    if (d < ART_R * 0.9 && bombard(p, g)) return;
    if (d > ART_R * 0.8) moveTo(p, T.x, T.y);
    else p.a = Math.atan2(T.y - p.y, T.x - p.x);
    return;
  }
  if (p.job === 'archer') {
    if (d < 105 && shoot(p, g, 110)) return;
    if (d>95) moveTo(p, T.x, T.y);
    return;
  }
  if (strike(p, g, 110, p.job === 'cavalry' ? 70 : 45)) return;
  moveTo(p, T.x, T.y, p.job === 'cavalry' ? 1.05 : 1);
}
const lvAlive = A => A.members.filter(p => !p.dead).length;
function levelFrame() {
  if (!LV.on || LV.phase !== 'fight') return;
  LV.t++;
  const pa = lvAlive(LV.pA), ea = lvAlive(LV.eA), routed = A => A.state === 'retreat' && routing(A);
  const win=!ea || (routed(LV.eA) && pa), lose = !pa || routed(LV.pA);
  if (!win && !lose) { if (LV.t % 15 === 0) lvBarStats(); return; }
  LV.phase = 'done';
  LV.result = win ? 'win' : "lose";
  if (win) {
    const pr = LV.prog[LV.cur] || {};
    LV.prog[LV.cur] = { won: true, best: Math.min(pr.best || Infinity, LV.spent) };
    lvSave();
  }
  setTimeout(lvUI, 700);
}

function levelMouse(cesit, x, y, e) {
  if (!LV.on) return false;
  if (LV.phase === 'select') return true;
  if (LV.phase !== 'prep') return cesit === "down" && e.button === 2;
  const enemySide = (x - LV.c.x) > 0;
  if (cesit === "down") {
    if (e.button === 2) {
      const A = enemySide ? LV.eA : LV.pA;
       if (enemySide && !LV.edit) return true;
      const p = lvNearest(A, x, y, 9);
      if (p) { if (A === LV.pA) LV.money += LV_COST[p.job]; lvRemove(A, p); if (A === LV.eA) lvStoreEnemy(); lvBarStats(); }
      LV.paint = { rm: A, last: null };
      return true;
    }
    if (e.button !== 0) return false;
    if (enemySide && !LV.edit) { lvMsg(lang('Sağ taraf düşmanın. Askerlerini sol (mavi) alana diz.')); return true; }
    LV.paint = { enemy: enemySide, last: { x, y } };
    const neden = lvPlace(x, y, enemySide);

    if (neden && neden !== 'dolu') lvMsg(neden);
    lvBarStats();

    return true;
  }
  if (cesit === 'move' && LV.paint) {
    const P = LV.paint;
    if (P.rm) { const p = lvNearest(P.rm, x, y, 7); if (p) { if (P.rm === LV.pA) LV.money += LV_COST[p.job]; lvRemove(P.rm, p); if (P.rm === LV.eA) lvStoreEnemy(); lvBarStats(); } return true; }
    if (P.last && (P.last.x - x) ** 2 + (P.last.y - y) ** 2 < LV_GAP ** 2) return true;
    if (enemySide !== P.enemy) return true;
     P.last = { x, y };
     const neden = lvPlace(x, y, P.enemy);
    if (neden === lang("Paran yetmiyor!")) lvMsg(neden);

    lvBarStats();
    return true;
  }

  if (cesit === 'up' && LV.paint) { LV.paint = null; return true; }
  return false;
}

function levelKey(e) {
  if (e.code !== 'NumpadMultiply') return false;
  if (!LV.on) return false;
  LV.edit=!LV.edit;
  lvUI();
  return true;
}

function levelDraw(ctx) {
  if (!LV.on || !LV.c || LV.phase === 'select') return;
  const c=LV.c, z = Sim.cam.z;
  if (LV.phase === 'prep') {
    const zone = (sgn, fill, line) => {
      const x0=sgn > 0 ? c.x + LV_ZX0 : c.x - LV_ZX1;
      ctx.fillStyle = fill; ctx.fillRect(x0, c.y - LV_ZY, LV_ZX1 - LV_ZX0, LV_ZY * 2);
      ctx.strokeStyle = line; ctx.lineWidth = 2 / z; ctx.setLineDash([8 / z, 5 / z]);
      ctx.strokeRect(x0, c.y - LV_ZY, LV_ZX1 - LV_ZX0, LV_ZY * 2); ctx.setLineDash([]);
    };
    zone(-1, "rgba(58,134,255,0.10)", 'rgba(120,170,255,0.8)');
    zone(1, LV.edit ? 'rgba(230,57,70,0.12)' : 'rgba(230,57,70,0.06)', "rgba(255,110,110,0.7)");
  }
}

const raceSel = (id, simdiki) => `<select id="${id}">${Object.entries(RACE_DB).map(([k, R]) => `<option value="${k}"${k === simdiki ? " selected" : ''}>${R.name}</option>`).join('')}</select>`;
const lvComp = liste => { const c = {}; for (const u of liste) c[u.j || u.job]=(c[u.j || u.job] || 0) + 1; return LV_UNITS.filter(([j]) => c[j]).map(([j, ic]) => `${ic}${c[j]}`).join(' ') || "—"; };
function lvMsg(t) { const e = $('lvMsg'); if (e) { e.textContent = t; clearTimeout(lvMsg.h); lvMsg.h = setTimeout(() => { e.textContent = ''; }, 2600); } }

function lvUI() {
  const on = LV.on && tab !== 'race';
  $("lvSel").classList.toggle('hidden', !on || LV.phase !== 'select')
  $('lvBar').classList.toggle('hidden', !on || LV.phase === 'select');
   $('lvEdit').classList.toggle('hidden', !on || !LV.edit || LV.phase !== 'prep');
   $('lvRes').classList.toggle('hidden', !on || LV.phase !== 'done' || !LV.result);
  $('lvBadge').classList.toggle('hidden', !on || !LV.edit);
  if (on) { $('spawnBar').classList.add('hidden'); $('planTab').classList.add('hidden'); }
  if (!on) { fitHint(); refreshHint(); return; }
  if (LV.phase === 'select') renderLvSel();
  else { renderLvBar(); if (LV.edit && LV.phase === "prep") renderLvEdit(); if (LV.phase === 'done') renderLvRes(); }
  $('hint').style.bottom = (LV.phase === "select" ? 8 : $('lvBar').offsetHeight + 8) + 'px';
  refreshHint();
}
function levelHint() {
  if (LV.phase === 'select') return '';
  if (LV.phase === 'prep') return LV.edit ? lang('✏️ Düzenleme: sol alana kendi askerini, sağ alana düşman askerini diz (sol tık / basılı sürükle) · Sağ tık: sil · Numpad *: düzenlemeyi kapat')
    : lang('🎯 Alttan birlik seç, mavi alana tıkla ya da basılı tutup sürükle · Sağ tık: geri al (para iade) · Orta tuş: kaydır · Tekerlek: yakınlaş');
  if (LV.phase === 'fight') return lang("⚔️ Savaş sürüyor · 1-5: hız · Boşluk: durdur · Tekerlek: yakınlaş · Orta tuş: kaydır");
  return "";
}

function renderLvSel() {
  const tiles = LV.list.map((d, i) => {
    const won = LV.prog[i] && LV.prog[i].won, open = lvUnlocked(i), empty = !d.enemy.length;
    const st = won ? lang`<span class="ok">✓ Kazanıldı${LV.prog[i].best != null ? lang` · ${LV.prog[i].best}💰` : ""}</span>` : empty ? lang('<span class="muted">Boş bölüm</span>') : open ? '<span>Oynanabilir</span>' : '<span class="muted">🔒 Kilitli</span>';
    return lang`<div class="lvt${won ? ' won' : ''}${!open ? ' lock' : ''}${empty ? ' empty' : ''}" data-i="${i}">
      <div class="lvn">${i + 1}</div><div class="lvnm">${d.name.replace(/</g, '&lt;')}</div>
      <div class="lvinf">${d.money} altın · ${empty ? lang('düşman yok') : lvComp(d.enemy)}</div>${st}
      ${LV.edit ? lang`<button class="lvdel" data-del="${i}" title="Bölümü sil">🗑</button>` : ''}</div>`;
  }).join('');
  $('lvSel').innerHTML = lang`<div class="lvhead"><h2>🎯 Bölümler</h2><span class="muted">Kısıtlı parayla askerlerini diz, düşmanı yen.${LV.edit ? '' : lang(' Bölümleri düzenlemek için <b>Numpad *</b>')}</span>
    <span style="flex:1"></span><button id="lvExit">✕ Çık</button></div>
    <div class="lvgrid">${tiles}${LV.edit ? lang('<div class="lvt add" data-add="1"><div class="lvn">＋</div><div class="lvnm">Bölüm ekle</div></div>') : ''}</div>
    ${LV.edit ? lang('<div class="txt" style="margin-top:12px">✏️ <b>Düzenleme modu açık.</b> Bir bölüme tıkla: parasını, düşman askerlerini ve ırkları ayarla. Değişiklikler kendiliğinden kaydedilir.</div>') : ""}`;
}
function renderLvBar()
{
  const d = lvDef(), prep = LV.phase === 'prep';
  let h=`<b class="lvtitle">${LV.cur + 1}. ${d.name.replace(/</g, "&lt;")}</b>`;
  if (prep) {
    h += `<span class="lvmoney" id="lvMoney"></span>` + LV_UNITS.map(([j, ic, n, cost]) =>
      `<button class="lvu${LV.tool === j ? ' on' : ''}${cost > LV.money ? ' poor' : ''}" data-u="${j}"><span class="ic">${ic}</span>${n}<small>${cost}💰</small></button>`).join('') +
      lang`<button data-a="clear">🧹 Temizle</button><button data-a="start" class="lvgo">⚔️ Savaşı Başlat</button>`;
  } else h += lang`<span id="lvStats" class="lvstats"></span><button data-a="retry">↺ Yeniden dene</button>`;
  h += lang`<button data-a="back">📋 Bölümler</button><span id="lvMsg"></span>`;
  $('lvBar').innerHTML = h;
  lvBarStats();
}
function lvBarStats() {
  const m = $('lvMoney');
  if (m) {
    m.innerHTML = lang`💰 <b>${LV.money}</b> / ${lvDef().money} <span class="muted">· Sen: ${lvComp(LV.pA.members)} · Düşman: ${lvComp(LV.eA.members)}</span>`;
    for (const b of $('lvBar').querySelectorAll('.lvu')) b.classList.toggle('poor', LV_COST[b.dataset.u] > LV.money);
  }
  const s = $('lvStats');

  if (s) s.innerHTML = lang`<span style="color:#8ecae6">Sen: ${lvAlive(LV.pA)}/${LV.pA.start}</span> · <span style="color:#ff8a8a">Düşman: ${lvAlive(LV.eA)}/${LV.eA.start}</span>`;
  if (LV.edit && LV.phase === 'prep') for (const [j] of LV_UNITS) { const e = $('lvc_' + j); if (e) e.textContent = LV.eA.members.filter(p => p.job === j).length; }
}
function renderLvEdit()
{
  const d = lvDef();
  $('lvEdit').innerHTML = lang`<h2>✏️ Bölüm ${LV.cur + 1} düzenleyici</h2>
    <label>Ad <input id="lvName" type="text" value="${d.name.replace(/"/g, '&quot;')}" style="width:62%"></label>
    <h3>💰 Başlangıç parası</h3>
    <div class="row"><button data-m="-500">−500</button><button data-m="-50">−50</button><input id="lvMoneyIn" type="number" min="0" step="50" value="${d.money}" style="width:80px"><button data-m="50">+50</button><button data-m="500">+500</button></div>
    <h3>Irklar</h3>
    <label>Düşman ${raceSel('lvRace', d.race)}</label><label>Oyuncu ${raceSel('lvPRace', d.prace)}</label>
    <h3>⚔️ Düşman askerleri</h3>
    ${LV_UNITS.map(([j, ic, n]) => lang`<div class="row lvrow"><button class="lvpick${LV.etool === j ? ' on' : ''}" data-e="${j}" title="Sağ alana elle koymak için seç">${ic} ${n}</button>
      <button data-d="${j}" data-n="-5">−5</button><button data-d="${j}" data-n="-1">−</button><b id="lvc_${j}" class="lvcnt">0</b><button data-d="${j}" data-n="1">+</button><button data-d="${j}" data-n="5">+5</button></div>`).join('')}
    <div class="row" style="margin-top:6px"><button data-x="relayout">📐 Düzenli diz</button><button data-x="clearE">🧹 Düşmanı temizle</button></div>
    <div class="txt muted" style="margin-top:6px">Sağ (kırmızı) alana tıklayınca seçili türde düşman konur, sağ tık siler. Sol alana kendi askerini dizip deneyebilirsin.</div>
    <div id="lvSaved" class="txt" style="color:#8fd18f;margin-top:6px">✓ Kaydedildi</div>`;

  lvBarStats();
}
function renderLvRes()
{
  const kazanan=LV.result === 'win', next = LV.cur + 1 < LV.list.length && LV.list[LV.cur + 1].enemy.length;
   $("lvRes").innerHTML = lang`<div class="lvcard ${kazanan ? "win" : "lose"}"><div class="big">${kazanan ? "🏆 Zafer!" : '💀 Yenilgi'}</div>
    <div class="txt">${kazanan ? lang`Düşman ${lvAlive(LV.eA) ? lang('bozguna uğrayıp kaçtı') : lang('yok edildi')}. Harcanan: <b>${LV.spent}💰</b> / ${lvDef().money}` : lang`Ordun ${lvAlive(LV.pA) ? lang('bozguna uğradı') : lang('yok edildi')}. Başka bir diziliş dene!`}</div>
    <div class="txt muted">Kayıplar: sen ${LV.pA.start - lvAlive(LV.pA)}, düşman ${LV.eA.start - lvAlive(LV.eA)}</div>
    <div class="row" style="justify-content:center;margin-top:10px">${kazanan && next ? lang('<button data-a="next" class="lvgo">▶ Sonraki bölüm</button>') : ''}<button data-a="retry">↺ ${kazanan ? lang('Tekrar oyna') : lang('Yeniden dene')}</button><button data-a="back">📋 Bölümler</button></div></div>`;
}

function initLevels() {
  lvLoad();
  $('lvSel').onclick = e => {
    const t = e.target.closest('[data-i],[data-add],[data-del],#lvExit');

    if (!t) return;
    if (t.id === 'lvExit') { openMenu(); return; }
    if (t.dataset.del != null) {
      e.stopPropagation();
      const i = +t.dataset.del;
      if (LV.list.length > 1 && confirm(lang`${i + 1}. bölüm silinsin mi?`)) {
        LV.list.splice(i, 1);
         const pr = {}; for (const k in LV.prog) { const n = +k; if (n < i) pr[n] = LV.prog[k]; else if (n > i) pr[n - 1] = LV.prog[k]; }
        LV.prog = pr; lvSave(); renderLvSel();
      }
      return;
    }
    if (t.dataset.add) { LV.list.push(lvBlank(LV.list.length)); lvSave(); renderLvSel(); return; }
    const i = +t.dataset.i, d = LV.list[i];
    if (!LV.edit && !d.enemy.length) return;
    if (!lvUnlocked(i)) return;
    lvOpen(i);
  };
  const act = a => {
    if (a==='back') lvBack();
    else if (a === 'retry') lvOpen(LV.cur);
    else if (a === 'next') { LV.last = null; lvOpen(LV.cur + 1); }
    else if (a === 'start') lvStart();
    else if (a === "clear") { lvClearPlayer(); lvBarStats(); }
  };
  $('lvBar').onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.u) { LV.tool=b.dataset.u; renderLvBar(); return; }
    act(b.dataset.a);
  };
  $('lvRes').onclick = e => { const b = e.target.closest('button'); if (b) act(b.dataset.a); };
  const ed = $("lvEdit");
  const saved = () => { lvSave(); const s = $("lvSaved"); if (s) { s.textContent = lang('✓ Kaydedildi'); s.style.opacity = 1; } };
  ed.onclick=e => {

    const b = e.target.closest('button');
    if (!b) return;
    const d = lvDef();
    if (b.dataset.m) { d.money = Math.max(0, d.money + +b.dataset.m); lvMoneyChanged(); saved(); renderLvEdit(); return; }
    if (b.dataset.e) { LV.etool = b.dataset.e; renderLvEdit(); return; }
    if (b.dataset.d) { const n = +b.dataset.n; if (n > 0) lvEnemyPlus(b.dataset.d, n); else lvEnemyMinus(b.dataset.d, -n); lvBarStats(); saved(); return; }
    if (b.dataset.x === 'relayout') { lvRelayout(); saved(); return; }
    if (b.dataset.x === 'clearE') { for (const p of [...LV.eA.members]) lvRemove(LV.eA, p); lvStoreEnemy(); lvBarStats(); saved(); }

  };
  ed.onchange = e => {
    const d = lvDef();
    if (e.target.id === 'lvName') { d.name = e.target.value.trim() || lang`Bölüm ${LV.cur + 1}`; saved(); renderLvBar(); }
    else if (e.target.id === 'lvMoneyIn') { d.money = Math.max(0, Math.round(+e.target.value || 0)); lvMoneyChanged(); saved(); }
    else if (e.target.id === 'lvRace') lvSetRace(true, e.target.value);
    else if (e.target.id === 'lvPRace') lvSetRace(false, e.target.value);
  };
}
function lvMoneyChanged()
{
  const d = lvDef(), spent = LV.pA.members.reduce((s, p) => s + LV_COST[p.job], 0);
  LV.money = d.money - spent;
  while (LV.money < 0 && LV.pA.members.length) { const p = LV.pA.members[LV.pA.members.length - 1]; LV.money += LV_COST[p.job]; lvRemove(LV.pA, p); }
  renderLvBar();
}

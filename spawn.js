const SIDES = [["Mavi", '#3a86ff'], ['Kızıl', '#e63946'], ['Yeşil', '#2a9d8f'], ['Altın', '#f4c430']];
const SP_JOBS = { farmer: 'Çiftçi', soldier: 'Asker', archer: 'Okçu', cavalry: 'Süvari', artillery: "Topçu", guard: 'Bekçi', wood: 'Oduncu', miner: 'Madenci', builder: 'Yapıcı', merchant: 'Tüccar', hunter: 'Avcı' };
const SP_BEASTS = { wolves: '🐺 Kurt sürüsü', deer: '🦌 Geyik sürüsü', dragon: '🐉 Ejderha', bandits: '🏴 Haydut çetesi' };
let spCat = null;

function arenaSide(i, rk, x, y)
{
  let k = Sim.sides[i];
  if (k && !k.dead) return k;
  k = newKingdom(rk);
  k.name = lang`${SIDES[i][0]} Taraf`; k.color = SIDES[i][1]; k.roof = mixHex(k.color, "#6b4a2f", 0.55);
  k.capital = { id: -k.id, name: lang`${SIDES[i][0]} Ordugâhı`, k, x, y, r: 12, camp: true, houses: [], fields: new Set(), walls: null, hist: [],
    deathsY: 0, births: 0, food: 0, wood: 0, stone: 0, pop: 0, dead: false, spots: { food: [], wood: [], stone: [] } };
  for (const o of Sim.kingdoms) if (o !== k && !o.dead) { const r = getRel(k, o); r.met = true; r.status = 'war'; }
  Sim.sides[i] = k;
  countWars();
  return k;
}

const homeNear = (k, at) => k.capital && k.capital.camp ? k.capital : kSettlements(k).reduce((a, b) => dist2(a, at) < dist2(b, at) ? a : b);
const newTroop=(rk, k, ev, x, y, meslek) => {
  const p = makePerson(rk, k, ev, x, y, { age: CFG.adultAge + rnd(2, 15) | 0, female: Math.random() < 0.2 });
  p.job = meslek;
  return p;
};
function spawnArmy(k, rk, x, y, sayilar, form, dusman, quiet) {
  const ev = homeNear(k, { x, y }), meslekler = ALL_UNITS.flatMap(([j]) => Array(sayilar[j] || 0).fill(j));
  const askerler = [], n = meslekler.length, sutunlar = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    let px = x + (i % sutunlar - sutunlar / 2) * 8, py = y + ((i / sutunlar | 0) - sutunlar / 2) * 8;
    if (!speedAt(px, py)) { px = x; py = y; }
    askerler.push(newTroop(rk, k, ev, px, py, meslekler[i]));
  }
  const melee = askerler.filter(p => p.job === 'soldier');
  const cmd = pickCmd(askerler);
   const A = { id: Sim.nextArmy++, k, enemy: dusman || null, target: null, cmd, members: askerler, start: n, plan: 'attack', raid: false,
    state: 'idle', t: 0, cap: 0, morale: 100, btac: battleTactic(cmd), form: form || pickFormation(k, cmd, askerler), foeArmy: null, battle: null,
    massacre: false, manual: true, home: { x, y } };
  sortRanks(A); countUnits(A);
  k.armies.push(A);
  if (dusman) {
    const r = getRel(k, dusman);
    r.met = true;
    if (r.status==='alliance') r.status = 'peace';
    declareWar(k, dusman, lang('tanrıların iradesi'));
    const T = nearestEnemySettlement(k, dusman);
    if (T) { A.manual = false; A.target = T; A.state = 'march'; }
  }
  if (!quiet) chron(lang`⚡ Tanrılar ${k.name} için bir ordu indirdi: ${armyComp(askerler)} (${RACE_DB[rk].name}). Komutan: ${fullName(cmd)}${A.target ? `. Hedef: ${A.target.name}` : ''}`, k, dusman);
  return A;
}

const opt = (v, t, secili) => `<option value="${v}"${secili ? ' selected' : ''}>${t}</option>`;
const raceOpts = () => Object.entries(RACE_DB).map(([k, R]) => opt(k, R.name)).join('');
const kOpts = () => Sim.kingdoms.filter(k => !k.dead && kSettlements(k).length).map(k => opt(k.id, lang`${k.name} (${k.R.name})`)).join('');
const spMsg = t => { $('spMsg').textContent = t; };
const spVal = id => { const e = $(id); return e ? e.value : null; };

function renderSpawn() {
  for (const b of $('spCats').children) b.classList.toggle("on", b.dataset.c === spCat);
  const sub = $('spSub');
  sub.classList.toggle('hidden', !spCat);
  if (!spCat) return fitHint();
  const keep = {};
  for (const e of sub.querySelectorAll('select,input')) keep[e.id]=e.value;
  const place = (what, etiket) => `<button data-s="${what}" class="${Sim.tool === 'spawn' && Sim.spawn === what ? 'on' : ''}">${etiket}</button>`;
  let h = '';
  if (!Sim.ready) h = lang('<span class="muted">Önce ana menüden bir mod seç.</span>');
  else if (spCat === 'army') {
     const forms = opt('', lang("Komutan seçsin")) + Object.entries(FORMS).map(([f, n]) => opt(f, n)).join('');
    const era = lang`<span class="spL">Dönem</span><span class="spEra">${Object.entries(ERAS).filter(([e]) => eraOn(e)).map(([e, E]) => `<button data-era="${e}" class="${e === SP_ERA ? 'on' : ''}">${E.n}</button>`).join('')}</span>`;
    let head = "";
    if (Sim.arena) head = lang`<span class="spL">Taraf</span><span class="spSides">${SIDES.map(([n, c], i) =>
      `<button data-side="${i}" class="${i === SP_SIDE ? 'on' : ""}" title="${n} taraf${Sim.sides[i] && !Sim.sides[i].dead ? '' : ' (yeni)'}"><span class="sw" style="background:${c}"></span></button>`).join('')}</span>
      <span class="spL">Irk</span><select id="spRace">${raceOpts()}</select>`;
    else {
       const ko = kOpts();
      if (ko) head=lang`<span class="spL">Krallık</span><select id="spK">${ko}</select>
        <span class="spL">Hedef</span><select id="spT">${opt("auto", lang('En yakın düşman'))}${opt('none', lang('Hiçbiri (beklesin)'))}${Sim.kingdoms.filter(k => !k.dead && kSettlements(k).length).map(k => opt(k.id, k.name)).join('')}</select>`;
    }
    if (!head) h = lang('<span class="muted">Ordu çıkaracak krallık yok. Önce 🏰 Krallık kur.</span>');
    else {
      const paint = Sim.tool === 'spawn' && Sim.spawn === 'armyPaint';
      h=lang`<div class="spArmy${paint ? ' painting' : ''}">
        <div class="spHead">${era}${head}<span class="spL">Düzen</span><select id="spF">${forms}</select><span id="spMsg"></span></div>
        <div class="spTop"><span id="spTot"></span><button data-mul="0" title="Bütün sayıları sıfırla">Sıfırla</button></div>
        <div class="spUnits">${eraUnits().map(([j]) => lang`<div class="uc${j === SP_BRUSH ? ' brush' : ''}" data-u="${j}" title="${unitName(j)} · tekerlek ya da −/+ (Shift: 10'ar) · fırça için karta tıkla">
          <canvas></canvas><div class="un">${unitName(j)}</div>
          <div class="uq"><button data-d="-1">−</button><input type="number" min="0" max="${unitMax(j)}" value="${SP_N[j]}"><button data-d="1">+</button></div></div>`).join('')}</div>
        <div class="spAct"><div class="spPreRow"><select id="spPre">${opt('', lang('Hazır ordu…'))}${eraKinds().map(([n], i) => opt(i, n[0].toLocaleUpperCase(LANG) + n.slice(1))).join('')}</select>
          <button data-mul="0.5" title="Bütün sayıları yarıya indir">×½</button><button data-mul="2" title="Bütün sayıları ikiye katla">×2</button></div>
          ${place("army", lang('Haritaya yerleştir'))}
          <button data-s="armyPaint" class="${paint ? 'on' : ''}" title="Basılı tutup sürükle: geçtiğin yere birer birer dizilir. Birliği karta tıklayarak seç">Fırçayla çiz · ${unitName(SP_BRUSH)}</button></div>
      </div>`;
    }
  } else if (spCat === 'kingdom') {
    h=Sim.arena ? lang('<span class="muted">Savaş alanında krallık kurulmaz; ordu çıkar. Krallıklı dünya için ana menüden Yeni Dünya.</span>')
      : lang`<label>Irk <select id="spKR">${raceOpts()}</select></label><label>Nüfus <input id="spKN" type="number" min="4" max="60" value="14"></label>${place('kingdom', lang('📍 Krallığı kur'))}`;
  } else if (spCat === 'beast') h = Object.entries(SP_BEASTS).map(([k, n]) => place(k, n)).join('');
  else if (spCat === 'person') {
    const ko = kOpts();
    h = !ko ? lang('<span class="muted">Kişi ekleyecek krallık yok.</span>')
      : lang`<label>Krallık <select id="spPK">${ko}</select></label><label>Meslek <select id="spPJ">${Object.entries(SP_JOBS).map(([j, n]) => opt(j, n)).join('')}</select></label>
        <label>Kaç kişi <input id="spPN" type="number" min="1" max="50" value="1"></label>${place('person', lang('📍 Yerleştir'))}${place('personPaint', lang('🖌 Basılı tutup çiz'))}`;
  } else if (spCat === 'weather') {
    const wx = Sim.wx || {}, wb = (w, etiket, on) => `<button data-w="${w}" class="${on ? 'on' : ''}">${etiket}</button>`;
    h = (Sim.arena ? '' : wb('auto', '🔄 Otomatik', !Sim.wx)) + SEASONS.map((S, i) => wb('s' + i, lang`${S.icon} ${S.name}`, wx.season === i)).join('') +
      ' · ' + wb('rain', lang('🌧 Yağmur'), wx.rain === true) + wb('dry', lang('🌤 Açık hava'), wx.rain === false) +
      `<span class="muted"> ${Sim.arena ? lang('Savaş alanında hava kendiliğinden değişmez.') : lang('Seçtiğin hava sen değiştirene kadar kalır.')}</span>`;
  } else if (spCat === 'disaster') h = `${place("meteor", '☄ Meteor')}${place('quake', '🌋 Deprem')}${Sim.arena ? '' : place('fire', lang('🔥 Şehirde yangın'))}`;
  else if (spCat === 'test') h = scenPanel();
  sub.innerHTML = h.includes('id="spMsg"') ? h : h + '<span id="spMsg"></span>';
  for (const id in keep) {
    const e=id && $(id);
    if (e && id !== 'spPre' && (e.tagName !== 'SELECT' || [...e.options].some(o => o.value === keep[id]))) e.value = keep[id];
  }
  spSync(); spDrawFigs();
  fitHint();
}

const UNIT_MAX = { artillery: 50, medic: 30, fieldgun: 30, gatling: 20, mg: 20, mortar: 20, rocket: 15, tank: 30, sniper: 30 }, unitMax = j => UNIT_MAX[j] || 1000;
const SP_N = { soldier: 24, shield: 0, spear: 0, halberd: 0, cavalry: 8, knight: 0, harcher: 0, archer: 12, xbow: 0, artillery: 2, medic: 2,
  rifle: 30, rifleman: 8, hussar: 8, fieldgun: 2, gatling: 1,
  trooper: 30, sapper: 4, flamer: 3, mg: 2, sniper: 2, mortar: 2, rocket: 0, tank: 2 };
let SP_SIDE = 0, SP_BRUSH = 'soldier', spHold = null, SP_ERA = 'mid';
let WW_ON = false;
try { WW_ON = localStorage.getItem('krallik.ww') === '1'; } catch {}
const eraOn = e => ERAS[e] && (e !== 'ww' || WW_ON);
try { const e=localStorage.getItem('krallik.era'); if (eraOn(e)) { SP_ERA = e; SP_BRUSH = ERAS[e].units[0][0]; } } catch {}
const eraUnits = () => ERAS[SP_ERA].units;
const eraKinds = () => ({ vic: ARMY_KINDS_V, ww: ARMY_KINDS_WW })[SP_ERA] || ARMY_KINDS;
function setWW(on) {
  WW_ON = on;
  try { localStorage.setItem('krallik.ww', on ? '1' : '0'); } catch {}
  if (!on && SP_ERA === 'ww') setEra('mid');
  else if (on) setEra('ww');
  renderSpawn(); refreshHint();
}
const unitName = j => { const n = (ALL_UNITS.find(u => u[0] === j) || [j, j])[1]; return n[0].toLocaleUpperCase('tr') + n.slice(1); };
const eraCounts = () => Object.fromEntries(eraUnits().map(([j]) => [j, SP_N[j]]));
function setEra(e)
{
  SP_ERA = e;
  try { localStorage.setItem('krallik.era', e); } catch {}
  if (!eraUnits().some(([j]) => j === SP_BRUSH)) SP_BRUSH = eraUnits()[0][0];
}
function spSync(skip) {
  const sub = $('spSub');
  for (const c of sub.querySelectorAll('.uc')) {
    const j = c.dataset.u, inp = c.querySelector('input');
    if (inp !== skip && +inp.value !== SP_N[j]) inp.value = SP_N[j];
    c.classList.toggle('zero', !SP_N[j]);
  }
  const t = $('spTot');
  if (t) { const n = eraUnits().reduce((s, [j]) => s + SP_N[j], 0); t.innerHTML = n ? lang`<b>${n}</b> asker` : lang('<span class="muted">Asker yok</span>'); }
}
function spBump(j, d) { SP_N[j] = clamp(SP_N[j] + d, 0, unitMax(j)); spSync(); }
function spFig(j) {
  let R = RACE_DB.human, renk = '#888', tech = 0;
  if (Sim.arena) { R = RACE_DB[spVal('spRace')] || R; renk = SIDES[SP_SIDE][1]; const k = Sim.sides[SP_SIDE]; tech = k && !k.dead ? k.tech || 0 : 0; }
  else { const k = kById(spVal('spK')); if (k) { R=k.R; renk = k.color; tech = k.tech || 0; } }
  return { skin: R.skin, ears: R.ears, extra: R.extra, size: R.size, ring: renk, female: false, helm: AGES[tech].helm, child: false, sick: false, job: j,
    mount: j === 'cavalry' || j === 'harcher' ? (['orc', 'goblin', "halforc"].includes(R.base) ? 'wolf' : 'horse') : j === 'hussar' || j === 'knight' ? 'horse' : null, horse: HORSES[0], gun: tech >= 3, ghost: false };
}
const SP_TIGHT = new Map();
function figTight(f) {
  const anahtar = [f.size, f.ears, f.extra, f.job, f.mount].join('|');
  let b = SP_TIGHT.get(anahtar);
  if (b) return b;
  const [x0, y0, x1, y1] = sprBounds(f), k=8, c = document.createElement('canvas'), W = c.width = Math.ceil((x1 - x0) * k), H = c.height = Math.ceil((y1 - y0) * k);
  const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);

  drawFigure(g, f, 0, 0, 0, 1);
  const d = g.getImageData(0, 0, W, H).data;
  let l = W, t = H, r = -1, bt=-1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < l) l = x; if (x > r) r = x; if (y < t) t=y; if (y > bt) bt = y; }
  b=r < 0 ? [x0, y0, x1, y1] : [x0 + l / k, y0 + t / k, x0 + (r + 1) / k, y0 + (bt + 1) / k];
  SP_TIGHT.set(anahtar, b);
  return b;
}
function spDrawFigs() {
  const cs = [...$('spSub').querySelectorAll('.uc canvas')];
  if (!cs.length) return;
  const w = cs[0].clientWidth, h=cs[0].clientHeight;
  if (!w || !h) return;
  const figs = cs.map(c => spFig(c.parentNode.dataset.u)), B = figs.map(figTight);
  const U=Math.min(5, ...B.map(b => Math.min((w - 10) / (b[2] - b[0]), (h - 8) / (b[3] - b[1]))));
   cs.forEach((c, i) => {
    const b = B[i], g = c.getContext('2d');
    c.width=Math.round(w * DPR); c.height=Math.round(h * DPR);
    g.setTransform(DPR * U, 0, 0, DPR * U, DPR * (w / 2 - (b[0] + b[2]) / 2 * U), DPR * (h / 2 - (b[1] + b[3]) / 2 * U));
    drawFigure(g, figs[i], 0, 0, 0, 1);
  });
}
function spHoldStop() { clearTimeout(spHold); spHold = null; }
function initArmyPanel() {
  const sub = $('spSub');
  sub.addEventListener('pointerdown', e => {
    const b = e.target.closest("[data-d]");
    if (!b || e.button !== 0) return;
    e.preventDefault();
    const j = b.closest('.uc').dataset.u, d=+b.dataset.d * (e.shiftKey ? 10 : 1);
    let n = 0;
    spBump(j, d); spHoldStop();
    const rep = () => { n++; spBump(j, d * (n > 15 ? 5 : 1)); spHold = setTimeout(rep, n > 15 ? 90 : 60); };
    spHold = setTimeout(rep, 400);
  });
  for (const ev of ["pointerup", "pointercancel", 'blur']) window.addEventListener(ev, spHoldStop);
  sub.addEventListener("wheel", e => {
    const c = e.target.closest('.uc');
    if (!c) return;
    e.preventDefault();
    spBump(c.dataset.u, (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1));
  }, { passive: false });

  sub.addEventListener('input', e => {
    const c = e.target.closest('.uc');
    if (!c) return;
     SP_N[c.dataset.u]=clamp(Math.round(+e.target.value || 0), 0, unitMax(c.dataset.u));
    spSync(e.target);
  });
   sub.addEventListener('change', e => {
    if (e.target.closest('.uc')) return spSync();
    if (e.target.id === "spPre" && e.target.value !== '') {
      const K = eraKinds()[+e.target.value][1];
      for (const [j] of eraUnits()) SP_N[j] = K[j] ? Math.round((K[j][0] + K[j][1]) / 2) : 0;

      e.target.value = ''; spSync();
    }
    if (e.target.id === 'spRace' || e.target.id === 'spK') spDrawFigs();
  });
}
function armyPanelClick(e)
{
  const t = e.target, side = t.closest("[data-side]"), mul = t.closest('[data-mul]'), c = t.closest('.uc'), era = t.closest('[data-era]');
  if (era) { setEra(era.dataset.era); renderSpawn(); refreshHint(); return true; }
  if (side) { SP_SIDE = +side.dataset.side; renderSpawn(); return true; }
  if (mul) { const m = +mul.dataset.mul; for (const [j] of eraUnits()) SP_N[j] = clamp(Math.round(SP_N[j] * m), 0, unitMax(j)); spSync(); return true; }
  if (c) {
    if (!t.closest('.uq')) { SP_BRUSH = c.dataset.u; renderSpawn(); refreshHint(); }
    return true;
  }
  return false;
}
function fitHint() { $('hint').style.bottom = $('spawnBar').offsetHeight + 8 + "px"; }

function initSpawn()
{
  new ResizeObserver(() => { fitHint(); spDrawFigs(); }).observe($('spawnBar'));
  $('spCats').onclick = e => {
    const c = e.target.dataset.c;
    if (!c) return;

    spCat=spCat === c ? null : c;
    if (Sim.tool === 'spawn') Sim.tool = null;
    renderSpawn(); refreshHint();
  };
  initArmyPanel();
  $('spSub').onclick=e => {
    if (armyPanelClick(e)) return;
    const bt = e.target.closest('button') || e.target;
    if (bt.dataset.w) { setWeather(bt.dataset.w); renderSpawn(); return; }
    if (bt.dataset.rw) { if (Sim.scen) { startArena(); spCat = "test"; } randomWars(); renderSpawn(); return; }
    if (bt.dataset.sc) { startScen(+bt.dataset.sc); return; }
    const w = bt.dataset.s;
    if (!w) return;
    if (w === 'meteor' || w === 'quake') { Sim.tool = w; Sim.spawn = null; }
    else if (Sim.tool === 'spawn' && Sim.spawn === w) Sim.tool = null;
    else { Sim.tool = 'spawn'; Sim.spawn = w; }
    spMsg(''); renderSpawn(); refreshHint();
  };

}

function startArena() {
  campOff(); levelOff();
  Sim.arena = true; Sim.placing = null; Sim.tool = null;
  initWorld();
  Sim.wx = { season: 1, rain: false };
  Object.assign(Sim.cam, { x: W / 2, y: H / 2, z: 0.9 });
  Sim.follow = false;
  chron(lang('🏟 Savaş alanı hazır: geniş ovalar, ne köy ne kale. Alttaki ⚔️ Ordu menüsünden taraflara ordu koy, sağdaki 🗺 Savaş Planı ile emir ver'));
  setMode('arena');
  spCat = 'army'; renderSpawn();
  togglePlan(true);
}

const spawnHint = () => ({ army: lang('⚔️ Orduyu koymak için karaya tıkla (tekrar tekrar koyabilirsin) · Esc: bitir'), kingdom: lang('🏰 Krallığın kurulacağı yere tıkla'),
  armyPaint: lang`🖌 ${unitName(SP_BRUSH)} fırçası: basılı tutup sürükle, geçtiğin yere dizilir (bir sürüş = bir ordu) · birlik için karta tıkla · Esc: bitir`,
  personPaint: lang('🖌 Sol tuşu basılı tutup sürükle: geçtiğin yere kişiler konur · Esc: bitir'),
  person: lang('👤 Kişileri koymak için tıkla · Esc: bitir'), fire: lang('🔥 Yanacak şehre tıkla · Esc: bitir') }[Sim.spawn] || lang`${SP_BEASTS[Sim.spawn] || ''} koymak için haritaya tıkla · Esc: bitir`);

const num = (id, lo, hi) => clamp(Math.round(+spVal(id) || 0), lo, hi);
const kById=id => Sim.kingdoms.find(k => k.id === +id && !k.dead);
function armySide(x, y) {
  const form = spVal('spF') || null;
  if (Sim.arena) { const rk = spVal('spRace'); return { k: arenaSide(SP_SIDE, rk, x, y), rk, enemy: null, form }; }
  const k = kById(spVal('spK'));
  if (!k) return lang('Krallık seç.');
  const tv = spVal('spT');
  let dusman = null;
  if (tv==='auto') {
    const es = [...k.rel].filter(([o, r]) => r.status === 'war' && !o.dead).map(([o]) => o);
    if (es.length) dusman=es.reduce((a, b) => minDist(k, a) < minDist(k, b) ? a : b);
  } else if (tv !== 'none') {
    dusman = kById(tv);
    if (dusman === k) return lang('Krallık kendine saldıramaz.');
  }
  return { k, rk: k.race, enemy: dusman, form };
}

function setWeather(w) {
  const wx = Sim.wx || { season: null, rain: null };
  if (w === 'auto') { Sim.wx = null; return; }
  if (w[0] === 's') wx.season = +w.slice(1);
  else wx.rain = w === 'rain';
  Sim.wx = wx;

  if (!wx.rain) Sim.rainUntil = 0;
}

const PAINTS = { armyPaint: true, personPaint: true };
let PAINT = null;
function paintStart(x, y) { PAINT = { last: null, A: null, n: 0, k: null }; paintAt(x, y); }
function paintAt(x, y)
{

  const P = PAINT, t = terrainAt(x, y);
  if (P.last && (P.last.x - x) ** 2 + (P.last.y - y) ** 2 < 49) return;
  if (t < T_BEACH || t >= T_SNOW || !speedAt(x, y)) return;
  P.last = { x, y };
  if (Sim.spawn === 'personPaint') {
    const k = kById(spVal('spPK'));
    if (!k) return spMsg(lang('Krallık seç.'));
    const p = makePerson(k.race, k, homeNear(k, { x, y }), x, y, { age: CFG.adultAge + rnd(0, 20) | 0 });
    setJob(p, spVal('spPJ'));
    P.n++; P.k = k;
    return;
  }
  const meslek = SP_BRUSH, A = P.A;
  if (!A || !A.members.length || !A.k.armies.includes(A)) {
    const r = armySide(x, y);
    if (typeof r === 'string') return spMsg(r);
    P.A = spawnArmy(r.k, r.rk, x, y, { [meslek]: 1 }, r.form, r.enemy, true); P.rk = r.rk; P.n = 1;

    return;
  }
  A.members.push(newTroop(P.rk, A.k, homeNear(A.k, { x, y }), x, y, meslek));
  A.start++; P.n++;
  sortRanks(A);

}
function paintEnd() {
  const P = PAINT;
  PAINT = null;
  if (P.A && P.A.members.length) chron(lang`⚡ Tanrılar ${P.A.k.name} için tek tek bir ordu dizdi: ${armyComp(P.A.members)}. Komutan: ${fullName(P.A.cmd)}`, P.A.k);
  else if (P.n && P.k) chron(lang`✨ ${P.n} kişi tanrıların eliyle ${P.k.name} topraklarına kondu`, P.k);
  if (P.n) spMsg(lang`${P.n} kondu.`);
  updatePanels(); renderPlan();
}

function doSpawn(x, y) {
  const w = Sim.spawn, t = terrainAt(x, y), kara = t >= T_BEACH && t < T_SNOW;
  if (!kara && w !== 'fire') return spMsg(lang('Karaya tıkla.'));
  switch (w) {
    case 'army': {
      const counts = eraCounts();
      if (Object.values(counts).every(v => !v)) return spMsg(lang('En az bir asker gir.'));
      const r = armySide(x, y);
      if (typeof r==='string') return spMsg(r);
      spawnArmy(r.k, r.rk, x, y, counts, r.form, r.enemy)
      break;
    }
    case 'kingdom': {
      if (t>=T_MOUNT) return spMsg(lang("Dağa krallık kurulmaz."));
       const k = foundKingdom(spVal('spKR'), x, y, num("spKN", 4, 60));
      Sim.tool = null; select(k);
      break;
    }
    case 'person': {
      const k = kById(spVal('spPK'));
      if (!k) return spMsg(lang('Krallık seç.'));
      const at = { x, y }, s=kSettlements(k).reduce((a, b) => dist2(a, at) < dist2(b, at) ? a : b), job = spVal('spPJ');
      const n = num("spPN", 1, 50);
      for (let i = 0; i < n; i++) {
        const p = makePerson(k.race, k, s, x + rnd(-6, 6), y + rnd(-6, 6), { age: CFG.adultAge + rnd(0, 20) | 0 });
        setJob(p, job);
      }
      slog(s, lang`✨ ${n} yeni kişi tanrıların eliyle köye katıldı`);
      break;
    }
    case 'wolves': case "deer": {
      const lair = { x, y }, n = rnd(3, 6) | 0;
      for (let j = 0; j < n; j++) makeMonster(w === 'wolves' ? 'wolf' : 'deer', x + rnd(-6, 6), y + rnd(-6, 6), w === 'deer' ? { lair, buck: Math.random() < 0.35 } : { lair });
      break;
    }
    case 'dragon': {
      const [adj, renk] = pick(DRAGON_COLORS), isim = lang`${adj} ${makeName('dragon')}`;
      makeMonster('dragon', x, y, { name: isim, color: renk, state: 'sleep', t: 60, pref: null, burned: 0 });
      chron(lang`🐉 Tanrılar bir ejderha saldı: ${isim}`);
      Sim.tool = null;
      break;
    }
    case 'bandits': makeCamp(x, y); break;
    case 'fire': {
      const s = Sim.settlements.find(s => !s.dead && dist2(s, { x, y }) < (s.r + 20) ** 2);
      if (!s) return spMsg(lang("Bir şehrin üstüne tıkla."));
      if (s.houses.length<1) return spMsg(lang('Orada yanacak ev yok.'));
      townFire(s);
      break;
    }
  }
  spMsg(lang('Yapıldı.'));
  renderSpawn(); refreshHint(); updatePanels(); renderPlan();
}

const ARMY_KINDS = [
  ["dengeli", { soldier: [15, 30], shield: [0, 6], spear: [0, 6], archer: [8, 15], cavalry: [4, 10], artillery: [0, 2], medic: [1, 3] }],
  ['piyade yığını', { soldier: [40, 70], archer: [0, 8], medic: [0, 2] }],
  ['okçu ağırlıklı', { soldier: [5, 12], shield: [6, 12], archer: [20, 35], medic: [1, 2] }],
  ['süvari akını', { cavalry: [14, 28], soldier: [0, 10] }],
  ['topçu destekli', { soldier: [15, 25], shield: [4, 10], archer: [6, 12], artillery: [3, 6], medic: [1, 3] }],
  ['mızraklı duvar', { spear: [25, 40], shield: [8, 15], archer: [5, 10], medic: [1, 3] }],
  ['kalkan duvarı', { shield: [25, 40], soldier: [5, 12], archer: [6, 12], medic: [1, 2] }],
  ['küçük seçkin bölük', { soldier: [8, 14], spear: [2, 5], cavalry: [4, 8], archer: [4, 8], medic: [0, 1] }],
  ['şövalye ordusu', { knight: [8, 16], soldier: [15, 25], halberd: [0, 6], xbow: [6, 12], medic: [1, 2] }],
  ['bozkır atlıları', { harcher: [15, 28], cavalry: [4, 10], soldier: [0, 8] }],
  ['teber ve arbalet', { halberd: [20, 32], xbow: [12, 20], shield: [0, 6], medic: [1, 3] }],
];
const ARMY_KINDS_WW = [
  ['piyade taburu', { trooper: [35, 55], mg: [1, 3], sniper: [1, 3], mortar: [1, 2], medic: [2, 3] }],
  ['siper bölüğü', { trooper: [25, 40], sapper: [5, 10], mg: [2, 4], mortar: [2, 3], medic: [2, 3] }],
  ['taarruz grubu', { trooper: [20, 30], flamer: [4, 8], sapper: [3, 6], mg: [1, 2], medic: [1, 2] }],
  ['zırhlı birlik', { tank: [4, 8], trooper: [15, 25], mg: [0, 2], medic: [1, 2] }],
  ['topçu alayı', { trooper: [20, 30], mortar: [3, 5], rocket: [1, 3], mg: [1, 2], medic: [1, 2] }],
  ['karma tümen', { trooper: [30, 45], sapper: [3, 6], flamer: [2, 4], mg: [2, 3], sniper: [1, 3], mortar: [1, 3], tank: [1, 3], medic: [2, 3] }],
];
const ARMY_KINDS_V = [
  ['hat piyadesi alayı', { rifle: [40, 60], rifleman: [6, 12], medic: [1, 3] }],
  ['karma tümen', { rifle: [30, 45], rifleman: [6, 10], hussar: [6, 12], fieldgun: [2, 3], gatling: [0, 1], medic: [2, 3] }],
  ['avcı taburu', { rifleman: [25, 40], rifle: [10, 20], medic: [1, 2] }],
  ['süvari tugayı', { hussar: [20, 35], rifle: [0, 10] }],
  ['topçu destekli', { rifle: [25, 40], fieldgun: [3, 5], medic: [1, 2] }],
  ['mitralyöz bataryası', { rifle: [20, 30], gatling: [2, 4], medic: [1, 2] }],
];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function randArmy() {
  const [isim, K] = pick(eraKinds()), c = {};
  for (const [j, [a, b]] of Object.entries(K)) c[j] = ri(a, b);
  return [isim, c];
}

function landNear(x, y)
{

  for (let r = 0; r < 300; r += 15) for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, px = inMapX(x + Math.cos(a) * r), py=inMapY(y + Math.sin(a) * r), t = terrainAt(px, py);
    if (t >= T_BEACH && t < T_MOUNT && speedAt(px, py)) return { x: px, y: py };
    if (!r) break;
  }
  return null;
}
function randomWars()
{
  if (!Sim.ready) startArena();
  const fronts = ri(1, 3), log = [];
  if (Sim.arena) {
    const nSides = Math.min(SIDES.length, ri(2, Math.min(4, fronts + 1)));
    const sideRace = SIDES.map(() => 'human');
    const c = fronts > 1 ? { x: W / 2, y: H / 2 } : { x: clamp(Sim.cam.x, 900, W - 900), y: clamp(Sim.cam.y, 650, H - 650) };
    for (let f = 0; f < fronts; f++) {
      const a = ri(0, nSides - 1); let b = ri(0, nSides - 2); if (b >= a) b++;
      const fc = { x: c.x + (fronts > 1 ? Math.cos(f / fronts * 6.28 + 0.6) * 900 : 0), y: c.y + (fronts > 1 ? Math.sin(f / fronts * 6.28 + 0.6) * 560 : 0) };
      const aci = rnd(0, Math.PI * 2), gap = rnd(700, 950), dx = Math.cos(aci), dy = Math.sin(aci);
      const parcalar = [];
      for (const [s, sg] of [[a, -1], [b, 1]]) {
        const n = ri(1, 3), comps = [];
        for (let i = 0; i < n; i++) {
          const lat = (i - (n - 1) / 2) * rnd(200, 280) + rnd(-40, 40);
          const p = landNear(fc.x + dx * sg * gap / 2 - dy * lat, fc.y + dy * sg * gap / 2 + dx * lat);
          if (!p) continue;
          const [isim, sayilar] = randArmy(), rk = sideRace[s];
          spawnArmy(arenaSide(s, rk, p.x, p.y), rk, p.x, p.y, sayilar, null, null, true);
          comps.push(lang(isim));
        }
        parcalar.push(lang`${SIDES[s][0]} (${RACE_DB[sideRace[s]].name}: ${comps.join(", ") || '—'})`);
      }
      log.push(parcalar.join(' ⚔ '));
    }
    Object.assign(Sim.cam, { x: c.x, y: c.y, z: fronts > 1 ? 0.3 : 0.55 });
  } else {
    const ks = Sim.kingdoms.filter(k => !k.dead && kSettlements(k).length);
    if (ks.length < 2) return spMsg(lang('Savaşacak en az iki krallık lazım.'));
    for (let f = 0; f < fronts; f++) {
      const A = pick(ks), B=pick(ks.filter(k => k !== A));
      const sa = kSettlements(A).reduce((x, y) => minDistS(y, B) < minDistS(x, B) ? y : x);
       const sb = kSettlements(B).reduce((x, y) => minDistS(y, A) < minDistS(x, A) ? y : x);
      const parts = [];
       for (const [k, s, o, en] of [[A, sa, sb, B], [B, sb, sa, A]]) {
        const n=ri(1, 2), comps = [], a = Math.atan2(o.y - s.y, o.x - s.x);
        for (let i = 0; i < n; i++) {
          const p=landNear(s.x + Math.cos(a) * (s.r + 60) - Math.sin(a) * (i - (n - 1) / 2) * 120, s.y + Math.sin(a) * (s.r + 60) + Math.cos(a) * (i - (n - 1) / 2) * 120);
           if (!p) continue;
          const [isim, counts] = randArmy();
          spawnArmy(k, 'human', p.x, p.y, counts, null, en, true)
          comps.push(lang(isim));
        }
         parts.push(lang`${k.name} (${comps.join(', ') || '—'})`);
      }
      log.push(parts.join(' ⚔ '));
    }
  }
  chron(lang`🎲 Rastgele savaş: ${fronts} cephe açıldı! ${log.join(' · ')}`);
  spMsg(lang`${fronts} cephe açıldı.`);
  updatePanels(); renderPlan(); renderSpawn();
}
const minDistS = (s, k) => Math.min(...kSettlements(k).map(t => dist2(s, t)));

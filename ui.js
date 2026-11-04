const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}][\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]*\s?/gu;
const EMOJI_ANY = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}]/u;
const keepEmoji = el => !el || !!el.closest('.log, script, style, canvas, [data-emoji]');
function stripText(n) {
  langNode(n);

  const v = n.nodeValue;
  if (!v || !EMOJI_ANY.test(v)) return;
  if (keepEmoji(n.parentElement)) return emojifyText(n);
  const t = v.replace(EMOJI_RE, '').replace(/[\uFE0F\u200D]/g, '');
  if (t.trim()) n.nodeValue=t;
  else emojifyText(n);
}
function stripEmoji(root) {
  if (!root) return;
  if (root.nodeType === 3) return stripText(root);
  if (root.nodeType !== 1 || root.nodeName === 'SCRIPT' || root.nodeName === 'STYLE') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) stripText(n);
  if (root.hasAttribute('title') || root.hasAttribute('placeholder')) langAttrs(root);
  for (const el of root.querySelectorAll('[title],[placeholder]')) langAttrs(el);
}
new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') stripText(m.target); else for (const n of m.addedNodes) stripEmoji(n); } })
  .observe(document.body, { childList: true, subtree: true, characterData: true })
stripEmoji(document.body);
let tab = 'race', frameN = 0, lastSpeed=SPEED1;

const MODES = {
  arena: { tabs: ['world', 'events'], cats: ['army', 'beast', 'disaster', 'weather', 'test'], name: "Meydan", kHead: 'Taraflar' },
  world: { tabs: ['world', 'events', 'stats'], cats: ['army', 'kingdom', "beast", 'person', 'disaster', 'weather', 'test'], name: 'Dünya', kHead: 'Krallıklar' },
  race: { tabs: ['race'], cats: [], name: 'Dünya', kHead: 'Krallıklar' },
  camp: { tabs: ['world', 'events'], cats: ['army', 'beast', 'disaster', 'weather'], name: 'Dünya', kHead: 'Krallıklar' },
  level: { tabs: ['world', 'events'], cats: [], name: 'Bölüm', kHead: 'Taraflar' },
};
let MODE = 'race';
function setMode(m) {
  MODE = m;
  const M = MODES[m];
  $('tabs').querySelector('[data-t="world"]').textContent = M.name;
  $('kHead').textContent = M.kHead;
  for (const b of $("spCats").querySelectorAll('[data-c]')) b.classList.toggle('hidden', !M.cats.includes(b.dataset.c));
  if (spCat && !M.cats.includes(spCat)) { spCat = null; if (Sim.tool === 'spawn') Sim.tool = null; }
  renderSpawn();
  setTab(M.tabs.includes(tab) ? tab : M.tabs[0]);
}

for (const b of $('tabs').children) b.onclick = () => setTab(b.dataset.t);
function setTab(t) {
  const M = MODES[MODE];
  if (!M.tabs.includes(t)) t = M.tabs[0];
  tab = t;
  for (const b of $('tabs').children) { b.classList.toggle("on", b.dataset.t === t); b.classList.toggle('hidden', !M.tabs.includes(b.dataset.t)); }
  for (const id of ['race', 'world', 'events', 'stats']) $('p-' + id).classList.toggle('hidden', id !== t);
  $('spawnBar').classList.toggle("hidden", t === 'race' || !M.cats.length);
  $('planTab').classList.toggle('hidden', t === 'race');
  if (t === 'race' && PLAN.open) togglePlan(false);
  campUI();
  fitHint();
  refreshHint();
  updatePanels();
  lvUI();
}

function renderNews() {
  let seen=null;
  try { seen = localStorage.getItem("krallik.seenVer"); } catch {}
  $('mnewsList').innerHTML = CHANGELOG.map((c, i) =>
    `<div class="cl${i === 0 ? " new" : ""}"><div class="ver"><b>v${c.v}</b>${i === 0 ? lang('<b style="font-size:10px;color:#fff;background:var(--on);padding:1px 5px">YENİ</b>') : ''}<span>${lang(c.date || '')}</span></div>` +
    `<div class="ttl">${lang(c.title)}</div>` +
    c.items.map(([ic, h, t]) => `<div class="it"><span class="ic">${ic}</span><span><b>${lang(h)}.</b> ${lang(t)}</span></div>`).join('') +
    (c.fixes ? lang`<div class="muted" style="margin-top:8px;font-size:11px">DÜZELTMELER</div><ul class="fx">${c.fixes.map(f => `<li>${lang(f)}</li>`).join('')}</ul>` : '') + `</div>`).join('');
  const btn = $('mgrid').querySelector('[data-m="news"]');
  if (seen !== CHANGELOG[0].v && !btn.querySelector('.dot')) btn.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
}
function seenNews() {
   try { localStorage.setItem('krallik.seenVer', CHANGELOG[0].v); } catch {}
  const dot = $('mgrid').querySelector('.dot');

  if (dot) dot.remove();
}

let design;
function loadSaved() { try { return JSON.parse(localStorage.getItem('krallik.races')) || []; } catch { return []; } }
function storeSaved(l) { try { localStorage.setItem('krallik.races', JSON.stringify(l)); } catch {} }

function fromRace(taban, R, isim) {
  return { base: taban, name: isim, skin: R.skin, ears: R.ears, extra: R.extra, home: R.home, size: R.size, stats: { ...R.stats }, info: R.info };
}
function registerRace(d) {

  if (!d.key) d.key = 'c_' + Date.now().toString(36) + (Math.random() * 1e4 | 0);
  const B = RACES[d.base];
  RACE_DB[d.key]={ name: d.name, skin: d.skin, ears: d.ears, extra: d.extra, home: d.home, size: d.size, stats: { ...d.stats },
    info: d.info, base: d.base, names: B.names, kword: B.kword, custom: true };
  return d.key;
}
for (const d of loadSaved()) registerRace(d);

function useDesign(d) { design = JSON.parse(JSON.stringify(d)); syncEditor(); }
function newFromTemplate(k) {
  const n = loadSaved().filter(d => d.base === k).length + 1;
  useDesign(fromRace(k, RACES[k], lang`${RACES[k].name} Türü ${n}`));
}

for (const k in RACES) {
  const b = document.createElement('button');
  b.textContent = RACES[k].name;
  b.onclick = () => newFromTemplate(k);
   $('templates').append(b);
}
function renderSaved()
{
  const box = $('saved'), list=loadSaved();
  box.innerHTML = list.length ? '' : lang('<span class="muted">Henüz yok</span>');
  list.forEach((d, i) => {

    const b = document.createElement('button');
    b.innerHTML = `★ ${d.name} <span style="color:#f4a261" title="Sil">×</span>`;
    b.onclick = e => {
      if (e.target.tagName === 'SPAN') { list.splice(i, 1); storeSaved(list); renderSaved(); }
      else useDesign(d);
    };
    box.append(b);
  });
}

for (const [anahtar, etiket, uc] of STATS) {
  $('statSliders').insertAdjacentHTML('beforeend',
    `<label title="${uc}">${etiket} <span id="s_${anahtar}V"></span></label><input id="s_${anahtar}" type="range" min="1" max="10" title="${uc}">`);
  $('s_' + anahtar).oninput = e => { design.stats[anahtar] = +e.target.value; syncEditor(); };
}
$('rName').oninput=e => { design.name = e.target.value; }
$("rSkin").oninput = e => { design.skin=e.target.value; };
$('rEars').onchange = e => { design.ears=e.target.value; };
$('rExtra').onchange = e => { design.extra = e.target.value; };
$('rHome').onchange = e => { design.home = e.target.value; };
$('rSize').oninput = e => { design.size = e.target.value / 100; syncEditor(); };
$('rLife').oninput = e => { design.stats.life=+e.target.value; syncEditor(); };
$('rCount').oninput=() => { $("rCountV").textContent = $('rCount').value; };

function syncEditor() {
  const d = design;
  $('rName').value = d.name; $('rSkin').value = d.skin; $('rEars').value = d.ears; $('rExtra').value = d.extra; $('rHome').value = d.home;

  $('rSize').value = Math.round(d.size * 100); $('rSizeV').textContent = d.size.toFixed(2);
  $('rLife').value = d.stats.life; $('rLifeV').textContent=d.stats.life;
  for (const [key] of STATS) { $('s_' + key).value = d.stats[key]; $('s_' + key + 'V').textContent = d.stats[key]; }
  $('rInfo').innerHTML = lang`<b>${RACES[d.base].name} kökenli.</b> ${d.info}`;
}

const msg = t => { $('msg').textContent = t; };
$('saveBtn').onclick = () => {
  const liste = loadSaved().filter(x => x.key !== design.key);
  registerRace(design);
  liste.push(JSON.parse(JSON.stringify(design)));
  storeSaved(liste); renderSaved();
  msg(lang`"${design.name}" kaydedildi.`);
};
$('releaseBtn').onclick = () => {
  campOff(); levelOff();
  if (!Sim.ready || Sim.arena) { Sim.arena = false; initWorld(); }
  const key = registerRace(design);
   Sim.placing = { key, n: +$('rCount').value, name: design.name };
  msg('');
  setMode('world');
};
function startQuick() { levelOff(); quickStart(); focusFirst(); setMode('world'); }
function startCamp(big) { levelOff(); setMode('camp'); startCampaign(big); }
function focusFirst() { const s = Sim.settlements[0]; if (s) Object.assign(Sim.cam, { x: s.x, y: s.y, z: 1.5 }); }

const SPEEDS = [['⏸', 0], ['½×', 0.25], ['1×', 0.5], ['2×', 1], ['4×', 2], ['10×', 5], ['20×', 10], ['50×', 25], ['200×', 100], ['2000×', 1000]];
SPEEDS.forEach(([etiket, v], i) => {
  const b = document.createElement('button');
  b.textContent = etiket; b.dataset.v = v;
  b.title = i === 0 ? lang('Durdur (Boşluk)') : i <= 5 ? lang`Kısayol: ${i}` : '';
  b.onclick = () => setSpeed(v);
  $('speeds').append(b)
});
function setSpeed(v) { Sim.speed = v; refreshSpeeds(); }
function refreshSpeeds() { for (const b of $('speeds').children) b.classList.toggle('on', +b.dataset.v === Sim.speed); }

let LINKS = [];
const L = (obj, yazi) => `<a data-l="${LINKS.push(obj) - 1}">${yazi}</a>`;
const pL = p => p ? L(p, fullName(p) + (p.dead ? ' †' : '')) : '<span class="muted">bilinmiyor</span>';
const kL = k => L(k, `<span class="sw" style="background:${k.color}"></span> ${k.name}${k.dead ? ' †' : ""}`);
$('info').addEventListener('click', e => {
  const c = e.target.dataset.ctrl;
  if (!c) return;
  setCtrl(c === 'on' ? Sim.sel : null);
});
function setCtrl(p) {
  if (Sim.ctrl) plog(Sim.ctrl, lang('kontrolü tekrar kendi iradesine geçti'));
  Sim.ctrl = p;
  if (p) { leaveArmy(p); plog(p, lang('bir tanrı tarafından yönetilmeye başlandı')); Sim.cam.z = Math.max(Sim.cam.z, 2); }
  for (const k in KEYS) KEYS[k] = false;
  refreshHint(); updatePanels();
}
document.body.addEventListener('click', e => {
  const a=e.target.closest('a[data-l]');
  if (!a) return;
  const o = LINKS[+a.dataset.l];
  if (!o) return;
  select(o);
});
function select(o)
{
  Sim.sel = Sim.selK = Sim.selS = null;
  if (o && o.rel) { Sim.selK = o; if (o.capital) Object.assign(Sim.cam, { x: o.capital.x, y: o.capital.y }); }
  else if (o && o.houses) { Sim.selS = o; Object.assign(Sim.cam, { x: o.x, y: o.y }); }
  else if (o) { Sim.sel = o; Sim.follow = !o.dead; }
  updatePanels();
}
const sL=s => s ? L(s, s.name + (s.dead ? ' (harabe)' : '')) : '-';

function setHTML(el, h) { if (el._h!==h) { el._h = h; el.innerHTML = h; } }
function renderChron() {
  const el = $('chron'), log = campMap() ? CW.log : Sim.log, satir = e => `<div><span class="y">${e.y}</span>${e.text}</div>`;

  if (!log.length) { el._top = null; return setHTML(el, lang('<span class="muted">Henüz bir şey olmadı</span>')); }
  const k = el._log === log && el._top ? log.indexOf(el._top) : -1;

  if (k < 0 || k >= 150) el.innerHTML=log.slice(0, 150).map(satir).join('');
  else if (k>0) {
    el.insertAdjacentHTML("afterbegin", log.slice(0, k).map(satir).join(''));
    while (el.children.length > 150) el.lastElementChild.remove();
  }
  el._log=log; el._top = log[0]; el._h = null;

}
let tps = 0, tpsTicks = 0, tpsTime = performance.now();
function updatePanels() {
  LINKS=[];
  const simdi = performance.now();
  if (simdi - tpsTime > 1000) { tps=(Sim.tick - tpsTicks) * 1000 / (simdi - tpsTime); tpsTicks = Sim.tick; tpsTime = simdi; }
  if (CW.on) campUI();
  if (tab === 'events') renderChron();
  if (tab === 'world' && campMap()) return campPanels();
  if (tab==="world") {
    const canli = Sim.kingdoms.filter(k => !k.dead);
    const sYr = !Sim.arena && !Sim.camp && !Sim.wx ? lang` <span class="muted">(${(Sim.tick % seasonLen()) / (seasonLen() / 4) % 1 * 5 + 1 | 0}/5. yıl)</span>` : "";
    setHTML($('clock'), lang`<b style="font-size:15px">📅 ${dateStr()} · ${season().icon} ${season().name}</b>${sYr} <span class="muted">(gerçek hız: ${Sim.arena ? lang`${(tps / 60).toFixed(1)} dk/sn` : Sim.camp ? lang`${(tps / CFG.year * 360).toFixed(0)} gün/sn` : lang`${(tps / CFG.year).toFixed(1)} yıl/sn`})</span><br>` +
      lang`Nüfus: ${Sim.people.length} · Yerleşim: ${Sim.settlements.length} · Kurt: ${Sim.monsters.filter(m => m.type === 'wolf').length}${Sim.monsters.some(m => m.type === 'dragon') ? lang(' · 🐉 ejderha var!') : ''}<br>Krallık: ${canli.length} (yıkılan ${Sim.kingdoms.length - canli.length}) · Aktif savaş/baskın: ${Sim.wars}`);
    setHTML($('info'), Sim.selK ? kingdomInfo(Sim.selK) : Sim.selS ? villageInfo(Sim.selS) : Sim.sel ? (Sim.sel.mon ? monsterInfo(Sim.sel) : personInfo(Sim.sel))
      : lang('Haritada bir kişiye, köye ya da krallık toprağına tıkla.'));
    const pops = new Map();
    for (const p of Sim.people) pops.set(p.k, (pops.get(p.k) || 0) + 1);
    setHTML($("kList"), canli.sort((a, b) => (pops.get(b) || 0) - (pops.get(a) || 0)).map(k =>
      lang`<div class="kr">${kL(k)}<span class="n">${pops.get(k) || 0} kişi</span></div>`).join('') || lang('<span class="muted">Henüz krallık yok</span>'));
  } else if (tab === 'stats') { setHTML($('statsBox'), statsHtml()); drawPopChart(); }
  renderPlan();
}

function monsterInfo(m) {
  if (m.type==='bandit') return lang`<b style="font-size:14px">🏴 Haydut ${m.name}</b>${m.dead ? ' †' : ''}<br>Çetesi: ${m.camp.name}${m.camp.dead ? lang(' (dağıtıldı)') : ""}<br>` +
    lang`Can: ${Math.max(0, m.hp) | 0}/${m.max} · Soyduğu: ${m.stole} altın · Öldürdüğü: ${m.kills}<br>Çetenin kasası: ${m.camp.gold | 0} altın, ${m.camp.robs} soygun` +
    `<br><span class="muted">${Sim.arena ? lang('Savaş alanında en yakın askerin üstüne yürür.') : lang('Yoldaki silahsızları soyar, silahlılardan kaçınır.')}</span>`;
  if (m.type === 'deer') return lang`<b style="font-size:14px">🦌 Geyik${m.buck ? ' (erkek)' : ''}</b>${m.dead ? ' †' : ''}<br>Sürüsüyle ormanda otluyor. İnsan ya da kurt görünce kaçar. Avcılar onu avlayıp köye et getirir.`;
  if (m.type === 'wolf') return lang`<b style="font-size:14px">🐺 Kurt</b>${m.dead ? ' †' : ""}<br>${Sim.arena ? lang('Savaş alanında en yakın orduya saldırır.') : lang('Sürüsüyle ormanda avlanıyor, köylere girmez.')}<br>Can: ${Math.max(0, m.hp) | 0}/${m.max} · Öldürdüğü: ${m.kills}`;
  return lang`<b style="font-size:14px;color:${m.color}">🐉 Ejderha ${m.name}</b>${m.dead ? ' †' : ''}<br>Durum: ${DSTATE[m.state]}` +
    lang`${m.target ? lang` · Hedef: ${m.target.members ? lang`${kL(m.target.k)} ordusu` : sL(m.target)}` : ''}<br>Can: ${Math.max(0, m.hp) | 0}/${m.max}<br>Öldürdüğü: ${m.kills} · Yaktığı ev: ${m.burned}` +
    lang`<br><span class="muted">Okçular ve askerler ona karşı koyar; ordunun üstünde uçarken ona sadece ok yetişir. Son darbeyi vuran efsane olur.</span>`;
}

let chartHover = null;
$('popChart').onmousemove = e => { chartHover = e.offsetX; drawPopChart(); };
$('popChart').onmouseleave = () => { chartHover = null; drawPopChart(); };
function drawPopChart() {
  const c = $('popChart'), g = c.getContext("2d"), Wc = c.width, Hc = c.height, hist = Sim.popHist;
  g.fillStyle = '#0f1229'; g.fillRect(0, 0, Wc, Hc);
  g.font = '10px Redaction35, system-ui';
  if (hist.length < 2) {
    g.fillStyle='#9a96b0'; g.font = '12px Redaction35, system-ui'; g.fillText(lang('Birkaç yıl geçince grafik çizilecek'), 14, Hc / 2);
    $('popLegend').innerHTML = "";
    return;
  }

  const L = 32, Rr = 8, T = 10, B = 18, pw = Wc - L - Rr, ph = Hc - T - B;
  const peak = new Map();
   for (const e of hist) for (const [id, v] of e.v) peak.set(id, Math.max(peak.get(id) || 0, v));
  const ids = [...peak].sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
  const max = Math.max(4, ...ids.map(id => peak.get(id)));
  const adim = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find(v => v * 4 >= max) || 1000, ust = adim * 4;
   const y0 = hist[0].y, y1 = hist[hist.length - 1].y;
  const X = y => L + (y - y0) / Math.max(1, y1 - y0) * pw, Y = v => T + ph - v / ust * ph;
  g.strokeStyle = '#2a1433'; g.lineWidth = 1; g.fillStyle = '#9a96b0'; g.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const yy = Math.round(Y(adim * i)) + 0.5; g.beginPath(); g.moveTo(L, yy); g.lineTo(Wc - Rr, yy); g.stroke(); g.fillText(adim * i, L - 4, yy + 3); }
  g.textAlign = 'center'; g.fillText(lang('Yıl ') + y0, L + 12, Hc - 4); g.fillText(lang("Yıl ") + y1, Wc - Rr - 14, Hc - 4); g.textAlign='left';
  const byId = new Map(Sim.kingdoms.map(k => [k.id, k]));
  g.lineWidth = 2; g.lineJoin = 'round';
  for (const id of ids) {
     g.strokeStyle = byId.get(id).color; g.beginPath();
    let on = false;
    for (const e of hist) { const v = e.v.get(id); if (v == null) { on = false; continue; } if (on) g.lineTo(X(e.y), Y(v)); else g.moveTo(X(e.y), Y(v)); on=true; }
    g.stroke();
  }
  if (chartHover != null && chartHover >= L) {
     const yr = y0 + (chartHover - L) / pw * (y1 - y0), e = hist.reduce((a, b) => Math.abs(b.y - yr) < Math.abs(a.y - yr) ? b : a), ex = Math.round(X(e.y)) + 0.5;
    g.strokeStyle = '#e8a0c8'; g.lineWidth = 1; g.beginPath(); g.moveTo(ex, T); g.lineTo(ex, T + ph); g.stroke();
    const satirlar = ids.filter(id => e.v.get(id)).map(id => [byId.get(id), e.v.get(id)]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    for (const [k, v] of satirlar) { g.fillStyle = k.color; g.strokeStyle = '#0f1229'; g.lineWidth = 2; g.beginPath(); g.arc(ex, Y(v), 4, 0, 7); g.fill(); g.stroke(); }
    const bw = 150, bh = 18 + satirlar.length * 14, bx = ex + 10 + bw > Wc ? ex - 10 - bw : ex + 10;
    g.fillStyle = 'rgba(7,9,24,0.95)'; g.fillRect(bx, T, bw, bh); g.strokeStyle = '#542240'; g.lineWidth=1; g.strokeRect(bx + 0.5, T + 0.5, bw - 1, bh - 1);
    g.fillStyle = '#fff'; g.font='bold 11px Redaction35, system-ui'; g.fillText(lang('Yıl ') + e.y, bx + 7, T + 13); g.font = '11px Redaction35, system-ui';
    satirlar.forEach(([k, v], i) => {
      const ty = T + 27 + i * 14;
      g.fillStyle = k.color; g.fillRect(bx + 7, ty - 8, 8, 8);
      g.fillStyle='#fff'; g.fillText(k.name.length > 18 ? k.name.slice(0, 17) + '…' : k.name, bx + 19, ty);
      g.textAlign='right'; g.fillStyle = '#fff'; g.fillText(v, bx + bw - 7, ty); g.textAlign = 'left';

    });
  }
  const son = hist[hist.length - 1].v;
  $('popLegend').innerHTML = ids.map(id => { const k = byId.get(id); return `<div class="kr">${kL(k)}<span class="n">${son.get(id) || 0}</span></div>`; }).join('');
}

function doing(p) {
  if (p.dead) return lang('öldü');
  if (p === Sim.ctrl) return lang('bir tanrının iradesiyle yürüyor');
   if (p.state==="jailed") return lang('hapiste yatıyor');
  if (p.state === 'arrested') return lang('tutuklu, hapse götürülüyor');
  if (p.army) return lang`seferde (${ASTATE[p.army.state]})`;
  if (p.state === 'migrate') return lang`yeni yurdu ${p.s.name} yolunda`;
  if (p.flee > 0) return lang('canını kurtarmak için kaçıyor!');
  if (p.posse) return lang`müfrezeyle ${p.posse.name} kampına gidiyor`;
   if (p.mfoe && !p.mfoe.dead && isFighter(p)) return lang`bir ${MON[p.mfoe.type].name.toLowerCase()} ile savaşıyor`;
  const a = p.act;
  if (a) return ({ chat: lang`${pL(a.with)} ile sohbet ediyor`, rest: a.arrived ? lang('evinde uyuyor') : lang('yorgun, dinlenmek için evine gidiyor'), fest: lang('şenlikte dans ediyor'),
    tavern: a.arrived ? lang('meyhanede içiyor') : lang('meyhaneye gidiyor'), pray: a.arrived ? lang('tapınakta dua ediyor') : lang('tapınağa gidiyor'), play: lang`${pL(a.with)} ile kovalamaca oynuyor`,
    story: lang('çocuklara masal anlatıyor'), listen: lang`${pL(a.with)} adlı yaşlıdan masal dinliyor`,
    idle: lang('soluklanıyor, etrafı seyrediyor'), stroll: lang('kasabada geziniyor'), brawl: lang`${pL(a.with)} ile kavga ediyor` })[a.type] || '-';
  const sub = p.sub;
  switch (p.job) {
    case 'farmer': return sub === 'work' ? lang('tarlada çalışıyor') : sub === 'home' ? lang('hasadı eve taşıyor') : lang('tarlaya gidiyor');
    case "wood": return sub === 'work' ? lang('ağaç kesiyor') : sub === 'home' ? lang('odunları taşıyor') : lang('ormana gidiyor');
    case "miner": return sub === 'work' ? lang('madende kazıyor') : sub === 'home' ? lang('taşları taşıyor') : lang('madene gidiyor');
    case "fisher": return sub === 'work' ? lang('iskelede balık tutuyor') : sub === 'home' ? lang('balıkları eve taşıyor') : lang('iskeleye gidiyor');
    case 'hunter': return sub === 'hhome' ? lang('avladığı geyiği eve taşıyor') : p.prey && !p.prey.dead ? lang('geyik peşinde') : lang('av arıyor');
    case 'healer': return sub === 'heal' ? lang`${pL(p.patient)} adlı hastayı tedavi ediyor` : lang("hasta arıyor, şifalı ot topluyor");
    case 'builder': return p.s.project ? lang('inşaatta çalışıyor') : lang('tarlaya yardım ediyor');
    case 'guard': return sub === 'chase' ? lang`${pL(p.foe)} adlı şüpheliyi kovalıyor` : sub === 'escort' ? lang('tutukluyu hapse götürüyor') : lang('devriye geziyor');
    case 'merchant': return sub === "back" ? lang('pazardan dönüyor') : p.dest ? lang`${p.dest.name} pazarına gidiyor` : lang('mal topluyor');
    case 'wanderer': return p.spy ? lang('gizli bir görevde') : lang`${p.dest ? p.dest.name : lang('uzak diyarlar')} yolculuğunda`;
    case 'child': return 'oynuyor';
    case 'king': return lang("sarayında ülkeyi yönetiyor");
    default: return lang('talim yapıyor');
  }
}

function bar(v) { const n = clamp(Math.round(v), 0, 10); return '█'.repeat(n) + '<span class="muted">' + '░'.repeat(10 - n) + '</span>' + (v > 10.4 ? ` <b>${v.toFixed(1)}</b>` : ""); }

function personInfo(p) {
  const k = p.k, isKing = k.king === p;
  const role = isKing ? lang`👑 ${title(p)}` : p.army ? (p.army.cmd === p ? '🎖 Komutan' : lang('⚔️ Asker (seferde)')) : JOBS[p.job];
  const status = p.dead ? lang`<b style="color:#e76f51">Öldü</b> (Yıl ${p.deathYear}, ${p.cause})` : p.sick ? lang`🤒 <b style="color:#90be6d">${p.sick.d.name}</b> hastası` : p.state === 'jailed' ? '⛓ Hapiste' : p.state === 'arrested' ? '🚔 Tutuklu' : p.criminal ? lang('🦹 Aranan suçlu') : p.spy ? '🕵 Casus' : lang('Yaşıyor');

  const gp = [p.father?.father, p.father?.mother, p.mother?.father, p.mother?.mother].filter(Boolean);
  const cocuklar = p.children, grand = cocuklar.flatMap(c => c.children);
  const ctl = p.dead ? '' : Sim.ctrl === p ? lang('<button data-ctrl="off">🎮 Kontrolü bırak (Esc)</button><br>')
    : lang('<button data-ctrl="on">🎮 Bu karakteri kontrol et</button><br>');
  let h = lang`${ctl}<b style="font-size:14px">${fullName(p)}</b><br>${role} · ${p.R.name} · ${p.female ? lang('Kadın') : lang('Erkek')} · ${p.age} yaşında<br>` +
    lang`${kL(k)} · ${sL(p.s)}<br>Durum: ${status}<br>Huy: <b>${p.traits.map(t => TRAITS[t].name).join(', ')}</b><br>` +
    (p.ctrait || p.battlesWon || (p.army && p.army.cmd === p) ? lang`🎖 Rütbe: <b>${rankOf(p).n}</b> · Komutan huyu: ${cmdTrait(p).ic} <b>${cmdTrait(p).n}</b> · Zafer: ${p.battlesWon || 0}<br>` : '') +
    lang`Şu an: <i>${doing(p)}</i><br>⚡ Enerji ${Math.max(0, p.energy) | 0} · 💬 Sohbet ihtiyacı ${100 - clamp(p.social, 0, 100) | 0}<br>Altın: ${p.gold | 0} · Öldürdüğü: ${p.kills} · Can: ${Math.max(0, p.hp) | 0}/${p.maxHp | 0}` +
    lang`<h3>Özellikler</h3><div style="font-family:monospace;font-size:11px">` +
    STATS.map(([key, etiket]) => lang`${etiket.padEnd(12, ' ')} ${bar(p.stats[key])}`).join('<br>') + '</div>';
  if (p.army) h += lang`<h3>Sefer</h3>` + armyHtml(p.army);
  if (p.battlesWon) h += lang`<br>🏆 Kazandığı meydan savaşı: ${p.battlesWon}`;
  if (p.vet) h += lang`<br>${p.vet >= 5 ? '⭐ Gazi' : lang('🎖 Tecrübe')}: savaşta ${p.vet} düşman · vuruş gücü +%${Math.min(10, p.vet) * 3}`;
  if (p.legend) h += `<br>🐉 <b style="color:var(--hi)">${p.legend}</b>`;
  if (p.beasts) h += lang`<br>🐺 Öldürdüğü canavar: ${p.beasts}`;
  if (p.bandits) h += lang`<br>🏴 Öldürdüğü haydut: ${p.bandits}`;
  if (p.cured) h += lang`<br>💊 İyileştirdiği hasta: ${p.cured}`;
  h += lang`<h3>Soy Ağacı <button data-tree="1" style="float:right;padding:2px 6px">🌳 Ağacı aç</button></h3>` +
    (gp.length ? lang`Büyükanne/babalar: ${gp.map(pL).join(', ')}<br>` : '') +
    lang`Baba: ${pL(p.father)}<br>Anne: ${pL(p.mother)}<br>Eş: ${p.spouse ? pL(p.spouse) : '<span class="muted">yok</span>'}<br>` +
    lang`Çocuklar (${cocuklar.length}): ${cocuklar.map(pL).join(', ') || '<span class="muted">yok</span>'}` +
    (grand.length ? lang`<br>Torunlar: ${grand.length}` : '') + lang`<br>Hane: <b>${p.house}</b>`;
  const ties = [...p.ties].filter(([o]) => !o.dead).sort((a, b) => b[1] - a[1]);
  const friends = ties.filter(([, v]) => v > 15).slice(0, 5), dusmanlar = ties.filter(([, v]) => v < -15).reverse().slice(0, 3);
  h += lang`<h3>İlişkiler</h3>Dostları: ${friends.map(([o, v]) => `${pL(o)} <span class="muted">(${v | 0})</span>`).join(', ') || '<span class="muted">yok</span>'}` +
    (dusmanlar.length ? lang`<br>Hasımları: ${dusmanlar.map(([o, v]) => `${pL(o)} <span class="muted">(${v | 0})</span>`).join(', ')}` : '');
   if (isKing) h += lang`<h3>Diplomasi</h3>` + relList(k);
  h += lang`<h3>Son Yaptıkları</h3><div class="log">${p.log.map(l => `<div>${l}</div>`).join('') || lang('<span class="muted">Henüz bir şey yok</span>')}</div>`;
  return h;
}

const ASTATE = { gather: 'Toplanıyor', march: 'Yürüyüşte', intercept: 'Düşmanı karşılamaya gidiyor', battle: '⚔️ Meydan savaşında', assault: 'Kuşatmada',
  occupy: '🩸 Katliam yapıyor', retreat: "🏳 Geri çekiliyor", defend: 'Savunmada bekliyor', embark: '⛵ Gemilere biniyor', sail: '🚢 Denizde',
  seek: 'Düşman ordusunun üstüne yürüyor', idle: 'Yerinde bekliyor' };
function armyHtml(A) {
  return `${A.manual ? lang('Tanrıların çıkardığı ordu') : PLANS[A.plan]} · ${ASTATE[A.state] || A.state}${A.state === 'battle' ? lang` (${A.battle.name}, moral ${Math.max(0, A.morale) | 0})` : ''}<br>` +
    (A.order ? lang`Emir: ${ordInfo(A.order.type).icon} ${ordInfo(A.order.type).name}<br>` : "") +
    lang`Hedef: ${A.plan === 'defend' ? lang('kendi toprakları') : A.target ? sL(A.target) : lang('düşman ordusu')}<br>Düzen: ${FORMS[A.form]} · Taktik: ${BTAC[A.btac]}<br>` +
    lang`Komutan: ${pL(A.cmd)} · ${armyComp(A.members)} (başta ${A.start})${A.state === 'ambush' ? ' · 🌲 pusuda' : ''}`;
}

function villageInfo(s) {
  const sonuc = Sim.people.filter(p => p.s === s), meslekler = {};
   for (const p of sonuc) meslekler[JOBS[p.job]]=(meslekler[JOBS[p.job]] || 0) + 1;

  const jailed = Sim.people.filter(p => p.state === 'jailed' && p.jailAt === s);
  const rich = [...sonuc].sort((a, b) => b.gold - a.gold).slice(0, 3);
  const pr = s.project ? ({ house: lang("ev"), prison: lang('hapishane'), walls: lang('sur'), repair: lang('sur onarımı'), keep: lang('kale'), port: lang('liman') }[s.project.type] || BLDG[s.project.type].name.toLowerCase()) : null;
  const stc = s.stab >= 50 ? '#90be6d' : s.stab >= 30 ? '#f4a261' : '#e76f51';
  return lang`<b style="font-size:14px">${s.name}</b> · ${s.level}${s.k.capital === s ? lang(" ★ Başkent") : ''}<br>${kL(s.k)} · Kuruluş: Yıl ${s.founded}<br>` +
    lang`Nüfus: ${s.pop} · Ev: ${s.houses.length} (kapasite ${s.cap})<br>Yiyecek ${s.food | 0}/${foodCap(s) | 0} · Odun ${s.wood | 0} · Taş ${s.stone | 0}<br>` +
    lang`Huzur: <b style="color:${stc}">${s.stab | 0}</b> ${STAB_TXT(s.stab)}${s.k.drought > Sim.tick ? lang(' · ☀️ kuraklık') : ""}<br>` +
    lang`Yapılar: ${[s.walls ? lang`surlar (${Math.max(0, s.walls.hp) | 0}/${s.walls.max})` : '', s.prison ? lang("hapishane") : '', s.keep ? lang('kale') : '', s.port ? lang("liman") : '',
      ...Object.entries(BLDG).filter(([b]) => s[b]).map(([, B]) => `<span title="${B.info}">${B.icon} ${B.name.toLowerCase()}</span>`)].filter(Boolean).join(', ') || 'yok'}` +
    ((s.blockade || 0) > Sim.tick ? lang('<br><b style="color:#e76f51">⚓ Liman abluka altında!</b>') : '') +
    (s.fest > Sim.tick ? lang('<br><b style="color:var(--hi)">🎉 Hasat şenliği sürüyor!</b>') : "") +
    ((n => n ? lang`<br>🤒 Hasta: ${n} kişi` : '')(Sim.people.filter(p => p.sick && p.s === s).length)) +
    (s.monument && s.monument.of ? lang`<br>🗿 Anıt: ${s.monument.of}` : '') +
    (s.graves && s.graves.length ? lang`<br>⚰ Mezarlık: ${s.graveN} kişi gömüldü` : '') +
    (pr ? lang`<br>İnşaat: ${pr} (%${s.project.progress / s.project.cost * 100 | 0})` : '') +
    lang`<h3>Meslekler</h3>${Object.entries(meslekler).map(([j, n]) => lang`${j} ${n}`).join(' · ')}` +
    lang`<h3>Önde gelenler</h3>${rich.map(p => lang`${pL(p)} (${p.gold | 0} altın)`).join('<br>') || "-"}` +
    (jailed.length ? lang`<h3>Hapistekiler</h3>${jailed.map(pL).join('<br>')}` : "") +
    lang`<h3>Köyün Olayları</h3><div class="log">${s.hist.slice(0, 25).map(e => `<div><span class="y">${e.y}</span>${e.text}</div>`).join('') || lang('<span class="muted">Henüz bir şey olmadı</span>')}</div>`;
}

function openTree(root) {
  const U = 160, RH = 105, BW = 140, BH = 60, MAXD = 3, boxes = [], lines = [];

  const cocuklar = p => p.children.slice(0, 8);
  const width = (p, d) => d >= MAXD || !cocuklar(p).length ? 1 : cocuklar(p).reduce((s, c) => s + width(c, d + 1), 0);
  const place = (p, d, x0) => {
    const cx = x0 + width(p, d) / 2 - 0.5;
    boxes.push({ p, x: cx, y: d, root: p === root });
    if (d < MAXD) { let x = x0; for (const c of cocuklar(p)) { lines.push([cx, d, place(c, d + 1, x), d + 1]); x += width(c, d + 1); } }
    return cx;
  };
  const rx = place(root, 0, 0);
  if (root.spouse) boxes.push({ p: root.spouse, x: rx + 1, y: 0, spouse: true });
  const up = (p, x, d, spread) => {
    if (d < -2) return;
    [[p.father, -1], [p.mother, 1]].forEach(([q, taraf]) => {

      if (!q) return;
      const qx = x + taraf * spread;
      boxes.push({ p: q, x: qx, y: d - 1 });
      lines.push([qx, d - 1, x, d]);
      up(q, qx, d - 1, spread / 2);
    });
  };
  up(root, rx, 0, 1);
  const minX = Math.min(...boxes.map(b => b.x)), minY = Math.min(...boxes.map(b => b.y));
  const X = x => (x - minX) * U + 30, Y = y => (y - minY) * RH + 20;
  const maxX=Math.max(...boxes.map(b => X(b.x))) + BW + 30, maxY = Math.max(...boxes.map(b => Y(b.y))) + BH + 30;
  const paths = lines.map(([x1, y1, x2, y2]) => {
    const ax = X(x1) + BW / 2, ay = Y(y1) + BH, bx=X(x2) + BW / 2, by = Y(y2), my = (ay + by) / 2;
    return `<path d="M${ax},${ay} V${my} H${bx} V${by}" />`;

  });
  if (root.spouse) paths.push(`<path d="M${X(rx) + BW},${Y(0) + BH / 2} H${X(rx + 1)}" stroke-dasharray="4 3" />`);
  const GEN = { '-2': lang('Büyük ebeveyn'), '-1': lang('Ebeveyn'), 0: '', 1: lang('Çocuk'), 2: lang('Torun'), 3: lang('Torun çocuğu') };
  TREE = boxes.map(b => b.p);
  const html = boxes.map((b, i) => {
    const p = b.p, king = p.k.reigns.some(r => r.p === p);
    const life = p.dead ? lang`${p.born}–${p.deathYear} †` : lang`${p.born}– (${p.age} yaş)`;

    return `<div class="tb${p.dead ? ' dead' : ""}${b.root ? ' root' : ''}${king ? ' king' : ""}" data-t="${i}" style="left:${X(b.x)}px;top:${Y(b.y)}px;border-color:${p.k.color}">` +
      `<span class="gl">${b.spouse ? lang('Eş') : GEN[b.y] || ''}</span><b>${king ? '👑 ' : ""}${fullName(p)}</b>${p.R.name} · ${p.female ? 'K' : 'E'} · ${king ? title(p) : JOBS[p.job]}<br>${life}</div>`;
  }).join('');
  const t = $('tree');
  t.innerHTML=lang`<div class="th"><b style="font-size:15px">🌳 ${root.house} Hanesi · ${fullName(root)}</b><span class="muted">Bir kutuya tıkla: ağacı o kişiye göre aç · Esc: kapat</span>` +
    lang`<button id="treeClose" style="margin-left:auto">✕ Kapat</button></div>` +
    `<div class="tc" style="width:${maxX}px;height:${maxY}px"><svg width="${maxX}" height="${maxY}" fill="none" stroke="#8796a8" stroke-width="2">${paths.join('')}</svg>${html}</div>`;
  t.classList.remove('hidden');
  $('treeClose').onclick = closeTree;
}
let TREE = [];
function closeTree() { $('tree').classList.add('hidden'); }
$('tree').addEventListener('click', e => {

  const b = e.target.closest('.tb');
  if (!b) return;
  const p = TREE[+b.dataset.t];
  select(p);
  openTree(p);
});
$('info').addEventListener('click', e => { if (e.target.dataset.tree && Sim.sel) openTree(Sim.sel); });

function relList(k) {
  const ICON = { war: lang('⚔️ Savaşta'), alliance: lang('🛡 Müttefik'), peace: lang('— Barış') };
  const satirlar = [...k.rel].filter(([o, r]) => r.met && !o.dead).map(([o, r]) =>
    lang`<div>${kL(o)}: ${Sim.tick < r.hostileUntil && r.status !== 'war' ? lang('🔥 Baskın') : ICON[r.status]}${r.trade ? ' · 🤝 Ticaret' : ''} · ilişki <b style="color:${r.op >= 0 ? '#90be6d' : '#e76f51'}">${r.op | 0}</b>${r.claims ? lang` · 🗺 ${r.claims} hak iddiası` : ""}</div>`);

  return satirlar.join('') || lang('<span class="muted">Henüz kimseyle tanışmadı</span>');
}

function kingdomInfo(k) {

  const pop = Sim.people.filter(p => p.k === k), ss = kSettlements(k);
  const races={};
  for (const p of pop) races[p.R.name] = (races[p.R.name] || 0) + 1;
  let h = lang`<b style="font-size:14px;color:${k.color}">${k.name}</b>${k.dead ? lang(' <b>(yıkıldı)</b>') : ''}<br>Kurucu ırk: ${k.R.name} · Kuruluş: Yıl ${k.founded}<br>` +
    lang`Hükümdar: ${k.king ? lang`${title(k.king)} ${pL(k.king)}` : '<span class="muted">yok</span>'}<br>Başkent: ${k.capital ? k.capital.name : '-'}<br>` +
    lang`Nüfus: ${pop.length} (${Object.entries(races).map(([r, n]) => lang`${r} ${n}`).join(', ')})<br>Hazine: ${k.gold | 0} altın<br>` +
    `🔬 ${AGES[k.tech].name}${AGES[k.tech + 1] ? lang` (araştırma ${k.research | 0}/${AGES[k.tech + 1].need})` : lang(' (son çağ)')}${k.drought > Sim.tick ? lang(' · ☀️ Kuraklık') : ''}<br>` +
    lang`Öldürdüğü: ${k.kills} · Kaybı: ${k.deaths} · Savaş: ${k.wars} · Fetih: ${k.conquests} · Baskın: ${k.raids}`;
  k.armies.forEach((A, i) => { h += `<h3>${A.raid ? lang('Akıncılar') : lang`${i + 1}. Ordu`}</h3>` + armyHtml(A); });
  const ships=Sim.ships.filter(sh => !sh.dead && sh.k === k);
  if (ships.length || k.shipsSunk) h += lang`<h3>Donanma</h3>⚓ ${ships.filter(s => s.type === 'war').length} savaş gemisi · ⛵ ${ships.filter(s => s.type === 'trade').length} ticaret gemisi` +
    lang`${ships.some(s => s.type === 'transport') ? lang(' · 🚢 nakliye seferde') : ''} · Batırdığı gemi: ${k.shipsSunk}`;
  h += lang`<h3>Yerleşimler</h3>` + ss.map(s => lang`${sL(s)} (${s.level}, ${s.pop} kişi${s.walls ? ', surlu' : ''}${s.prison ? ', hapishaneli' : ''})`).join('<br>');
  const bl = Sim.battleLog.filter(b => b.a === k || b.b === k).slice(0, 8);
  if (bl.length) h += lang`<h3>Meydan Savaşları</h3>` + bl.map(b => lang`Yıl ${b.y}: ${b.name} — ${b.winner ? (b.winner === k ? '🏆 zafer' : '💀 yenilgi') : lang('berabere')} (${b.la}-${b.lb})`).join('<br>');
  h += lang`<h3>Diplomasi</h3>` + relList(k);
  h += lang`<h3>Hanedan</h3>` + k.reigns.slice(-8).map(r => lang`Yıl ${r.from}: ${pL(r.p)}`).join('<br>');
  h += lang`<h3>Tarih</h3><div class="log">${k.hist.slice(0, 15).map(e => `<div><span class="y">${e.y}</span>${e.text}</div>`).join('')}</div>`;
  return h;
}

function statsHtml() {
  const yasayan = Sim.people;
   const everyone = [...new Set([...yasayan, ...Sim.hall])];
  const ust = (list, f, fmt, n = 8) => '<table>' + [...list].sort((a, b) => f(b) - f(a)).slice(0, n).filter(x => f(x) > 0)
    .map(x => `<tr><td>${x.rel ? kL(x) : pL(x)}</td><td>${fmt(f(x))}</td></tr>`).join('') + "</table>";
  const ks = Sim.kingdoms.filter(k => !k.dead);
  const pops = new Map();
  for (const p of yasayan) pops.set(p.k, (pops.get(p.k) || 0) + 1);
  const races = {};
   for (const p of yasayan) races[p.R.name] = (races[p.R.name] || 0) + 1;
  LINKS = [];
  return lang`<h3>🗡 En çok öldürenler</h3>${ust(everyone, p => p.kills, v => v + lang(' kişi'))}` +
    lang`<h3>💰 En zenginler</h3>${ust(yasayan, p => p.gold, v => (v | 0) + lang(' altın'))}` +
    lang`<h3>👴 En yaşlılar</h3>${ust(yasayan, p => p.age, v => v + lang(' yaş'))}` +
    lang`<h3>👪 En kalabalık aileler</h3>${ust(yasayan, p => p.children.length, v => v + lang(' çocuk'))}` +
    lang`<h3>🏰 Krallıklar: nüfus</h3>${ust(ks, k => pops.get(k) || 0, v => v)}` +
    lang`<h3>🪙 Krallıklar: hazine</h3>${ust(ks, k => k.gold, v => (v | 0) + lang(' altın'))}` +
    lang`<h3>🗺 Krallıklar: toprak</h3>${ust(ks, k => kSettlements(k).length, v => v + lang(' yerleşim'))}` +
    lang`<h3>⚔️ Krallıklar: öldürme</h3>${ust(Sim.kingdoms, k => k.kills, v => v)}` +
    lang`<h3>🏴 Krallıklar: fetih</h3>${ust(Sim.kingdoms, k => k.conquests, v => v)}` +
    lang`<h3>🏆 Meydan savaşı kazanan komutanlar</h3>${ust(everyone, p => p.battlesWon || 0, v => v + ' zafer')}` +
    lang`<h3>🐉 Efsaneler ve canavar avcıları</h3>${ust(everyone, p => (p.legend ? 100 : 0) + (p.beasts || 0), v => v >= 100 ? lang`🐉 efsane` : v + ' canavar')}` +
    lang`<h3>🤝 En sevilenler</h3>${ust(yasayan, p => { let n = 0; for (const [o, v] of p.ties) if (v > 25 && !o.dead) n++; return n; }, v => v + lang(" dost"))}` +
    lang`<h3>👊 En kavgacılar</h3>${ust(yasayan, p => { let n = 0; for (const [o, v] of p.ties) if (v < -25 && !o.dead) n++; return n; }, v => v + lang(' hasım'))}` +
    lang`<h3>💊 En iyi şifacılar</h3>${ust(everyone, p => p.cured || 0, v => v + ' hasta')}` +
    lang`<h3>🏴 Haydut çeteleri</h3>${Sim.camps.filter(c => !c.dead).map(c => lang`${c.name}: ${Sim.monsters.filter(m => m.camp === c && !m.dead).length} haydut, ${c.robs} soygun, ${c.gold | 0} altın`).join('<br>') || lang('<span class="muted">Şu an yok</span>')}` +
    lang`<h3>🦠 Salgınlar</h3>${Sim.diseases.slice(-8).reverse().map(d => lang`Yıl ${d.start}: <b>${d.name}</b> (${d.s0}) · ${d.cases} vaka, ${d.deaths} ölü${d.over ? '' : lang(' · <b style="color:#e76f51">sürüyor</b>')}`).join('<br>') || lang('<span class="muted">Henüz yok</span>')}` +
    lang`<h3>🔬 Krallıklar: çağ</h3><table>${[...ks].sort((a, b) => b.research - a.research).slice(0, 8).map(k => `<tr><td>${kL(k)}</td><td>${AGES[k.tech].name}</td></tr>`).join('')}</table>` +
    lang`<h3>🏆 Krallıklar: meydan zaferi</h3>${ust(Sim.kingdoms, k => k.battlesWon || 0, v => v)}` +
    lang`<h3>⚔️ Son meydan savaşları</h3>${Sim.battleLog.slice(0, 10).map(b => lang`Yıl ${b.y}: <b>${b.name}</b><br>${kL(b.a)} ${b.la} kayıp – ${kL(b.b)} ${b.lb} kayıp → ${b.winner ? kL(b.winner) : lang('berabere')}`).join('<br>') || lang('<span class="muted">Henüz yok</span>')}` +
    lang`<h3>🧬 Irk dağılımı</h3><table>${Object.entries(races).sort((a, b) => b[1] - a[1]).map(([r, n]) => `<tr><td>${r}</td><td>${n}</td></tr>`).join('')}</table>` +
    lang`<h3>⚰️ Ölüm nedenleri</h3><table>${Object.entries(Sim.deaths).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<tr><td>${c}</td><td>${n}</td></tr>`).join('')}</table>`;
}

function toggleAdmin()
{
  const a = $('admin');
  a.classList.toggle('hidden');
  if (!a.classList.contains('hidden')) renderAdmin();
}
function renderAdmin()
{
  const ks = Sim.kingdoms.filter(k => !k.dead);
  const opts = ks.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
  $('admin').innerHTML = lang`<h2>🛠 Admin Aracı <span class="muted">(0 ile kapat)</span></h2>
    <h3>⚑ Komutan planları</h3>
    <button data-a="cplan" class="${Sim.cplan ? 'on' : ''}">${Sim.cplan ? lang("✅ Açık") : lang('⬜ Kapalı')} · Ordular plan yapsın</button>
    <div class="txt muted" style="font-size:11px">Açıkken konan her ordunun komutanı önce ordugâh kurar, gücünü düşmanla tartar: güçlüyse saldırı planı yapar (ana kuvvet cepheden, süvari kanattan dolanır), zayıfsa ordugâhın önüne hendek kazıp savunur. Planlar haritada ordunun renginde oklarla görünür; kuşatmaya giden ordular kuşatma ordugâhı kurar.</div>
    <h3>⚑ Birlikler</h3>
    <button data-a="ww" class="${WW_ON ? 'on' : ''}">${WW_ON ? lang('✅ Açık') : lang('⬜ Kapalı')} · Dünya Savaşları birimleri</button>
    <div class="txt muted" style="font-size:11px">Açıkken ordu panelinin Dönem seçiminde "Dünya Savaşları" çıkar: piyade, hendekçi, alevci, makineli tüfek, keskin nişancı, havan, roketatar, tank. Kapalıyken sadece İlkçağ-Ortaçağ ve Victoria.</div>
    <label>Krallık A</label><select id="aA">${opts}</select>
    <label>Krallık B</label><select id="aB">${opts}</select>
    <h3>A ile B arasında</h3>
    <div class="row"><button data-a="war">⚔️ Savaş</button><button data-a="peace">🕊 Barış</button><button data-a="ally">🛡 İttifak</button></div>
    <div class="row"><button data-a="trade">🤝 Ticaret</button><button data-a="raid">🔥 A, B'ye baskın yapsın</button></div>
    <h3>Toplu diplomasi</h3>
    <div class="row"><button data-a="warall">🔥 Herkes herkese savaş (barışsız)</button><button data-a="waronA">⚔️ A herkese savaş açsın</button></div>
    <div class="row"><button data-a="allvsA">🎯 Herkes A'ya saldırsın</button><button data-a="peaceall">🕊 Herkes barışsın</button></div>
    <h3>Krallık A</h3>
    <button data-a="gold">💰 +1000 altın</button><button data-a="plague">☠ Veba salgını</button>
    <button data-a="rebel">🔥 İsyan çıkar</button><button data-a="regicide">🗡 Hükümdarı öldür</button>
    <button data-a="dragon">🐉 Ejderha saldırsın</button><button data-a="drought">☀️ Kuraklık</button>
    <button data-a="fire">🔥 Bir şehirde yangın</button><button data-a="sick">🦠 Bulaşıcı salgın başlat</button>
    <button data-a="elect">🗳 Seçim yaptır</button><button data-a="age">🔬 Bir çağ ilerlet</button>
    <h3>Seçili kişi</h3>
    <button data-a="pkill">💀 Öldür</button><button data-a="pking">👑 Hükümdar yap</button>
    <button data-a="pgold">💰 +500 altın</button><button data-a="pcrime">🦹 Suçlu ilan et</button>
    <h3>Dünya</h3>
    <button data-a="meteor">☄ Meteor düşür (sonra haritaya tıkla)</button>
    <button data-a="feast">🌾 Bolluk: her yere +200 yiyecek</button>
    <button data-a="walls">🧱 Bütün surları yık</button>
    <button data-a="merge">🏙 Yakın şehirleri birleştir</button>
    <button data-a="wolves">🐺 Kurt sürüsü salıver</button>
    <button data-a="deer">🦌 Geyik sürüsü salıver</button>
    <button data-a="camp">🏴 Haydut çetesi türet</button>
    <button data-a="fest">🎉 Her yerde şenlik</button>
    <button data-a="quake">🌋 Deprem (sonra haritaya tıkla)</button>
    <button data-a="killmon">✨ Bütün canavarları yok et</button>
    <div id="aMsg" style="color:var(--hi);margin-top:6px"></div>`;
  if (ks.length > 1) $('aB').value = ks[1].id;
}
$('admin').addEventListener('click', e => {
  const act = e.target.dataset.a;
  if (!act) return;

  const byId = id => Sim.kingdoms.find(k => k.id === +id);
  const A = byId($('aA')?.value), B = byId($('aB')?.value), p = Sim.sel, say=t => { $("aMsg").textContent = t; };
  if (act === 'cplan') { cpSet(!Sim.cplan); renderAdmin(); renderPlan(); $('aMsg').textContent = Sim.cplan ? lang('Komutan planları açıldı.') : lang('Komutan planları kapandı; ordular eski yapay zekâyla dövüşür.'); return; }
  if (act === 'ww') { setWW(!WW_ON); renderAdmin(); $('aMsg').textContent = WW_ON ? lang('Dünya Savaşları birimleri açıldı: ordu panelinde Dönem seçiminde.') : lang('Dünya Savaşları birimleri kapandı.'); return; }
  const needAB = ['war', "peace", 'ally', 'trade', 'raid'];
  if (needAB.includes(act) && (!A || !B || A === B)) return say(lang('İki farklı krallık seç.'));
  if (["warall", 'peaceall', 'merge'].includes(act) && Sim.kingdoms.filter(k => !k.dead).length < (act === 'merge' ? 1 : 2)) return say(lang('Yeterli krallık yok.'));
  if (['gold', 'waronA', 'allvsA', 'plague', 'rebel', 'regicide', 'dragon', 'drought', 'fire', 'age', 'sick', 'elect'].includes(act) && !A) return say(lang('Krallık A seç.'));
  if (['pkill', 'pking', 'pgold', 'pcrime'].includes(act) && (!p || p.dead || p.mon)) return say(lang('Önce haritada yaşayan birini seç.'));
  const r = A && B ? getRel(A, B) : null;
  switch (act) {
    case 'war': r.met = true; if (r.status === "alliance") r.status = "peace"; declareWar(A, B, lang('tanrıların iradesi (admin)')); break;
    case 'peace': r.noPeace = false; if (r.status==='war') makePeace(A, B); r.hostileUntil = 0; r.op = Math.max(r.op, 0); countWars(); break;
    case 'ally': r.noPeace = false; if (r.status === 'war') makePeace(A, B); r.met = true; r.status = 'alliance'; r.op = Math.max(r.op, 60); chron(lang`🛡 ${A.name} ile ${B.name} ittifak kurdu (admin)`, A, B); break;
    case 'trade': r.met = true; r.trade=true; r.op = Math.max(r.op, 10); chron(lang`🤝 ${A.name} ile ${B.name} ticaret anlaşması imzaladı (admin)`, A, B); break;
    case "raid": r.met=true; if (A.armies.some(x => x.raid)) return say(lang('A krallığının akıncıları zaten yolda.')); if (!startRaid(A, B)) return say(lang('A krallığında boşta yeterli asker yok (en az 4).')); break;
    case 'warall': massWar(ks => ks.flatMap((a, i) => ks.slice(i + 1).map(b => [a, b])), lang('🔥 Tanrılar öfkelendi: bütün krallıklar birbirine savaş açtı! Bu savaşlarda barış yok'), true); break;
    case "waronA": massWar(ks => ks.filter(b => b !== A).map(b => [A, b]), lang`⚔️ ${A.name} bütün dünyaya savaş ilan etti!`); break;
    case 'allvsA': massWar(ks => ks.filter(b => b !== A).map(b => [b, A]), lang`🎯 Bütün krallıklar ${A.name} krallığına karşı birleşti!`); break;
    case 'peaceall': {
      const ks=Sim.kingdoms.filter(k => !k.dead);
      for (const a of ks) for (const b of ks) if (a.id < b.id) { const rr = getRel(a, b); rr.noPeace=false; if (rr.status === 'war') makePeace(a, b); rr.hostileUntil = 0; rr.op = Math.max(rr.op, 0); }
      countWars(); chron(lang('🕊 Tanrılar araya girdi: bütün savaşlar sona erdi')); break;
    }
    case "merge": {
      let n = 0;
      for (let again = true; again;) {
        again = false;
        for (const s of Sim.settlements) {
          const o = Sim.settlements.find(o => o !== s && o.k === s.k && dist(o, s) < s.r + o.r + 180);
          if (!o) continue;
          const big = s.k.capital === o || (s.k.capital !== s && o.pop > s.pop) ? o : s;
          mergeTowns(big, big === s ? o : s); n++; again = true; break;
        }
      }
      if (!n) return say(lang('Birleşecek kadar yakın şehir yok.'));
      say(lang`${n} birleşme yapıldı.`); renderAdmin(); updatePanels(); return;
    }
    case 'gold': A.gold += 1000; break;
    case 'plague': plague(A); break;
    case 'rebel': { const ss = kSettlements(A).filter(s => s !== A.capital); if (!ss.length) return say(lang('İsyan edecek başka şehir yok.')); rebel(pick(ss)); break; }
    case 'regicide': if (A.king) kill(A.king, null, 'suikast'); break;
    case 'pkill': kill(p, null, 'ilahi ceza'); break;
    case 'pking': if (p.k.king && p.k.king !== p) setJob(p.k.king, 'farmer'); crown(p.k, p); chron(lang`👑 ${fullName(p)} ${p.k.name} tahtına oturtuldu (admin)`, p.k); break;
    case 'pgold': p.gold += 500; break;
    case 'pcrime': p.criminal = true; plog(p, lang('suçlu ilan edildi')); break;
    case 'meteor': Sim.tool = 'meteor'; say(lang('Haritada bir yere tıkla.')); refreshHint(); return;
    case 'quake': Sim.tool = 'quake'; say(lang('Haritada bir yere tıkla.')); refreshHint(); return;
    case 'dragon': { const m = Sim.monsters.find(m => m.type === "dragon" && m.state === 'sleep'); if (m) { m.pref = A; m.t=1; } else if (!spawnDragon(A)) return say(lang('Ejderha için yer bulunamadı.')); break; }
    case 'drought': drought(A); break;
    case 'fire': { const ss = kSettlements(A).filter(s => s.houses.length > 1); if (!ss.length) return say(lang('Yanacak şehir yok.')); townFire(pick(ss)); break; }
    case 'age': if (!AGES[A.tech + 1]) return say(lang('A zaten son çağda.')); advanceAge(A); break;
    case 'wolves': if (!spawnWolves(Sim.cam)) return say(lang('Uygun orman bulunamadı.')); chron(lang('🐺 Ormanlarda bir kurt sürüsü görüldü')); break;
    case "deer": for (let i = 0; i < 3; i++) spawnDeer(); break;
    case 'camp': if (!spawnCamp()) return say(lang("Uygun yer bulunamadı.")); break;
    case 'sick': { const ss = kSettlements(A); if (!ss.length) return say(lang('Şehir yok.')); outbreak(best(ss, s => s.pop)); break; }
    case 'elect': election(A); break;
    case 'fest': for (const s of Sim.settlements) if (s.pop >= 4) startFest(s); chron(lang('🎉 Tanrılar bolluk saçtı, bütün diyarlarda şenlik var')); break;
    case 'killmon': for (const m of Sim.monsters) if (m.type !== 'deer') m.dead = true; for (const c of Sim.camps) c.dead = true; chron(lang('✨ Tanrılar bütün canavarları yok etti')); break;
    case 'feast': for (const s of Sim.settlements) s.food += 200; chron(lang('🌾 Bereketli bir yıl: her yerde bolluk')); break;
    case 'walls': for (const s of Sim.settlements) if (s.walls) s.walls.hp = 0; chron(lang('🌋 Büyük deprem: bütün surlar yıkıldı')); break;
  }
  say(lang('Yapıldı.'));
  renderAdmin();

  updatePanels();
});

const MOVE_KEYS = ['w', 'a', 's', 'd', "arrowup", 'arrowdown', 'arrowleft', "arrowright"];
window.addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; })
window.addEventListener('keydown', e => {
   if (e.target.type === 'text' || e.target.type === 'number') return;

  if (menuOpen()) { if (e.key === 'Escape') { if (creditsOpen()) showCredits(false); else if (entered) closeMenu(); } return; }
  if (levelKey(e)) { e.preventDefault(); return; }
  const anahtar = e.key.toLowerCase();
  if (Sim.ctrl) {
    if (MOVE_KEYS.includes(anahtar)) { e.preventDefault(); KEYS[anahtar] = true; return; }
    if (anahtar === 'f') { playerAttack(Sim.ctrl); return; }
    if (anahtar === 'escape') { setCtrl(null); return; }
  }
  if (anahtar === 'delete' && tab !== 'race') { deleteSelected(); return; }
  if (anahtar === 'escape') { MULTI.clear(); closeTree(); Sim.tool = null; Sim.placing=null; PLAN.tool = null; PLAN.stroke=null; renderSpawn(); renderPlan(); refreshHint(); return; }
  if (e.code === 'Digit0' || e.code === 'Numpad0') { toggleAdmin(); return; }
  const sk = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
  if (sk && !['SELECT', 'TEXTAREA'].includes(e.target.tagName)) { setSpeed(SPEEDS[+sk[1]][1]); return; }
  if (e.code !== 'Space') return;

  e.preventDefault();
  document.activeElement.blur()
  if (Sim.speed) { lastSpeed = Sim.speed; Sim.speed = 0; } else Sim.speed = lastSpeed;
  refreshSpeeds();
});

function refreshHint() {
  const h = $('hint');
  renderPlanSel();
  if (campMap()) { h.classList.remove('place'); h.textContent = campHint(); return; }
  if (LV.on) { h.classList.remove('place'); h.textContent = levelHint(); return; }
  const place = tab !== 'race' && (Sim.placing || Sim.tool || (PLAN.open && PLAN.tool));
   h.classList.toggle('place', !!place);
  h.textContent = tab === 'race' ? lang('Irkını tasarla, "Kaydet" ile sakla. "Dünyaya Bırak" deyip haritada bir yere tıkla (açık bir dünya varsa ona eklenir).')
    : Sim.placing ? lang`▶ "${Sim.placing.name}" krallığını kurmak için karada bir yere tıkla`
    : Sim.tool === 'meteor' ? lang('☄ Meteorun düşeceği yere tıkla')
    : Sim.tool === 'quake' ? lang('🌋 Depremin merkezine tıkla')
    : Sim.tool === 'spawn' ? spawnHint()
    : PLAN.open && PLAN.tool ? lang`${ORDERS[PLAN.tool].icon} ${ORDERS[PLAN.tool].hint} · Esc: vazgeç`
    : PLAN.open ? lang('🗺 Birimleri seç (kutu / Ctrl+tık / çift tık: bütün ordu) ya da listeden ordu seç, sonra sağdan emir ver. Emir sadece seçilenlere gider')
    : Sim.ctrl ? lang`🎮 ${fullName(Sim.ctrl)} senin kontrolünde · WASD/oklar: yürü · F (basılı tut): saldır, okçu ok atar, topçu gülle atar · Esc: bırak`
    : MULTI.size ? lang`✅ ${MULTI.size} birim seçili · Sağ tık: oraya saldır · Del: sil · Ctrl+tık: ekle/çıkar · Çift tık: bütün ordu · Esc: bırak`
    : lang("Orta tuş sürükle: kaydır · Tekerlek: yakınlaş · Sol tık: seç (Ctrl: çoklu, sürükle: kutu) · Sağ tık: saldırı emri · Del: sil · 1-5: hız · Boşluk: durdur · 0: admin");
}

let drag = null, box = null;
const MULTI = new Set();
const mpos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const toWorld = (mx, my) => [(mx - VW / 2) / Sim.cam.z + Sim.cam.x, (my - VH / 2) / Sim.cam.z + Sim.cam.y];
cv.oncontextmenu = e => e.preventDefault();
cv.onmousedown = e => {
  if (campMap()) return campMouse('down', e);
  if (tab === 'race' || !Sim.ready) return;
  const [mx, my] = mpos(e), [wx, wy] = toWorld(mx, my);
  if (e.button === 1) { e.preventDefault(); drag={ mx, my, cx: Sim.cam.x, cy: Sim.cam.y }; Sim.follow = false; return; }
   if (levelMouse('down', wx, wy, e)) return;
  if (e.button === 2) return orderAt(wx, wy);
  if (e.button !== 0) return;
  if (planDown(wx, wy)) return;
  if (Sim.tool === 'spawn' && PAINTS[Sim.spawn]) { paintStart(wx, wy); return; }
  box = { x0: wx, y0: wy, x1: wx, y1: wy, mx, my, moved: false, add: e.ctrlKey || e.shiftKey };
};
cv.onmousemove = e => {
  if (campMap()) return campMouse('move', e);
  const [mx, my] = mpos(e), [wx, wy] = toWorld(mx, my);
  if (PLAN.stroke) return planMove(wx, wy);
  if (PAINT) return paintAt(wx, wy);
  if (!drag && levelMouse('move', wx, wy, e)) return;
  if (drag) { Sim.cam.x = drag.cx - (mx - drag.mx) / Sim.cam.z; Sim.cam.y = drag.cy - (my - drag.my) / Sim.cam.z; return; }
  if (box) {
    box.x1 = wx; box.y1 = wy;
    if (Math.abs(mx - box.mx) + Math.abs(my - box.my) > 5) box.moved = true;
  }
};

cv.onmouseup = e => {
  if (campMap()) return campMouse('up', e);
  if (e.button===1) { drag = null; return; }
  if (levelMouse('up', 0, 0, e)) return;

  if (PLAN.stroke) return planUp();
  if (PAINT) return paintEnd();
  if (box) {
    const b = box;
    box = null;
    if (b.moved && !Sim.tool && !Sim.placing) boxSelect(b); else clickWorld(b.x0, b.y0, b.add);
  }
};
cv.onmouseleave = () => {
  if (campMap()) return campMouse('leave', {}); LV.paint = null; drag = null; box = null; if (PLAN.stroke) planUp(); if (PAINT) paintEnd(); };
cv.ondblclick = e => {

  if (campMap()) return campMouse('dbl', e);
  if (tab === 'race' || !Sim.ready || Sim.tool) return;
  const p = Sim.sel;
  if (p && !p.dead && p.army) { for (const q of p.army.members) MULTI.add(q); refreshHint(); }
};

function boxSelect(b)
{
  const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
  let list = Sim.people.filter(p => !p.dead && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !(p.army && p.army.state === 'sail'));
  if (list.some(isFighter)) list = list.filter(isFighter);
  if (!b.add) MULTI.clear();
  for (const p of list) MULTI.add(p);
  if (list.length) { select(list[0]); Sim.follow=false; if (PLAN.open && list[0].army) { PLAN.army = list[0].army; renderPlan(); } }
  refreshHint();
}
function pickUnit(p, add)
{

  if (add) { if (MULTI.has(p)) MULTI.delete(p); else MULTI.add(p); }
  else { MULTI.clear(); MULTI.add(p); }
  if (PLAN.open && p.army) { PLAN.army = p.army; renderPlan(); }
  select(p)
  if (p.army || add) Sim.follow = false;
  refreshHint();
}

function orderAt(x, y) {
  const ordular = orderGroups();
  for (const A of ordular) {
    A.order = { type: 'attack', path: resample([{ x: A.cmd.x, y: A.cmd.y }, { x, y }], 18), i: 0, phase: "go", t: 0 };
     if (A.state === 'retreat' || A.state === 'ambush') { A.state = A.manual ? 'idle' : 'march'; A.ambush = null; }
    say(A.cmd, '📣', 90);
  }
  if (!ordular.length) return;
  Sim.fx.push({ x, y, t: 40, type: 'order' })
  if (PLAN.open) { PLAN.army = ordular[0]; renderPlan(); }
}
function makeManualArmy(k, ps) {
  for (const p of ps) { leaveArmy(p); p.flee = 0; }
  const cmd = pickCmd(ps);
  const A = { id: Sim.nextArmy++, k, enemy: null, target: null, cmd, members: ps, start: ps.length, plan: 'attack', raid: false,
    state: 'idle', t: 0, cap: 0, morale: 100, btac: battleTactic(cmd), form: pickFormation(k, cmd, ps), foeArmy: null, battle: null,
    massacre: false, manual: true, home: { x: cmd.x, y: cmd.y } };
  sortRanks(A);
  k.armies.push(A);
  plog(cmd, lang("tanrıların emriyle bir birliğin başına geçti"));
  return A;
}

function deleteSelected()
{
  const liste = [...MULTI].filter(p => !p.dead);
  if (!liste.length && Sim.sel && !Sim.sel.dead) {
    if (Sim.sel.mon) { Sim.sel.dead = true; select(null); return; }
    liste.push(Sim.sel);
  }
  for (const p of liste) kill(p, null, 'tanrıların eli');
  MULTI.clear();
  if (liste.length) { chron(lang`✋ Tanrılar ${liste.length} kişiyi yeryüzünden sildi`); select(null); }
  refreshHint(); renderPlan();
}

function drawSelection(ctx) {
  const z = Sim.cam.z;
  if (MULTI.size) {
    for (const p of MULTI) if (!p || p.dead) MULTI.delete(p);
    ctx.strokeStyle = 'rgba(120,255,140,0.9)'; ctx.lineWidth = 1.2 / z;
    ctx.beginPath(); for (const p of MULTI) { const r = isCav(p) && p.army ? 8 : 5; ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, 7); } ctx.stroke();
  }
  if (box && box.moved) {
    ctx.fillStyle = 'rgba(120,255,140,0.08)'; ctx.strokeStyle = "rgba(120,255,140,0.9)"; ctx.lineWidth=1 / z;
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  }
}
cv.onwheel=e => {
  if (campMap()) return campMouse('wheel', e);
  if (tab === 'race') return;
  e.preventDefault()
  const [mx, my] = mpos(e), [bx, by] = toWorld(mx, my);
  Sim.cam.z = clamp(Sim.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.25, 10);
  const [ax, ay] = toWorld(mx, my);
  Sim.cam.x += bx - ax; Sim.cam.y += by - ay;
};

function clickWorld(x, y, add) {
  if (Sim.tool==='meteor') { meteor(x, y); Sim.tool = null; refreshHint(); return; }
  if (Sim.tool==='quake') { earthquake(x, y); Sim.tool = null; refreshHint(); return; }
  if (Sim.tool === 'spawn') return doSpawn(x, y);
  if (Sim.placing) {
    const t = terrainAt(x, y);
    if (t < T_BEACH || t >= T_MOUNT) return;
    const k = foundKingdom(Sim.placing.key, x, y, Sim.placing.n);
    Sim.placing = null;
    refreshHint(); select(k);
    return;
  }
  const mon = Sim.monsters.find(m => !m.dead && (m.x - x) ** 2 + (m.y - y) ** 2 < (m.type === 'dragon' ? 18 : 6 / Math.min(1, Sim.cam.z)) ** 2);
  if (mon) return select(mon);
  if (Sim.cam.z >= 0.3) {
    let bp = null, bd = (6 / Math.min(1, Sim.cam.z)) ** 2;
    for (const p of Sim.people) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; bp = p; } }

    if (bp) return pickUnit(bp, add);
  }
   if (!add) MULTI.clear();
  if (Sim.cam.z >= 0.45) {
     const s = Sim.settlements.find(s => (s.x - x) ** 2 + (s.y - y) ** 2 < (s.r + 15) ** 2);
    if (s) return select(s);
  }
  const o = ownerAt(x, y);
  select(o ? Sim.kingdoms.find(k => k.id === o) : null);
}

let DPR = 1, VW=0, VH = 0;

const curDPR = () => Math.min(window.devicePixelRatio || 1, 3);
function resize()
{
   DPR = curDPR();
  VW = $('main').clientWidth; VH = $('main').clientHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
}
window.onresize = resize;
const menuOpen = () => !$('menu').classList.contains('hidden');
const CREDITS = [['Oyun', 'Sancak Taburu'], ['Developer', 'Akgazi']];
let menuSub = null, entered = false;
function showSub(s) {
  menuSub = s;
  if (s === 'credits') $('mcred').innerHTML = CREDITS.map(([a, b]) => `<div class="cr"><b>${a}</b><span>${b}</span></div>`).join('') + lang('<div class="back"><button data-m="back">Geri</button></div>');
  if (s === 'news') { $('mnewsList').scrollTop = 0; seenNews(); }

  $('mcred').classList.toggle('hidden', s !== 'credits');
  $('mnews').classList.toggle('hidden', s !== "news");
  $('mgrid').classList.toggle('hidden', !!s);
}
const creditsOpen = () => !!menuSub;

const showCredits = on => showSub(on ? 'credits' : null);
function openMenu()
{
  $("menu").classList.remove('hidden');
  showSub(null);
  $('menu').querySelector('[data-m="continue"]').classList.toggle('hidden', !entered);
  $('menuVer').textContent = 'v' + CHANGELOG[0].v;
}
function closeMenu() { $('menu').classList.add('hidden'); }
function setLang(l)
{

  LANG = l;
  try { localStorage.setItem('krallik.lang', l); } catch {}
  document.documentElement.lang = l;
  for (const b of $('mlang').children) b.classList.toggle('on', b.dataset.l === l);
  langDom(document.body);
  renderNews();
  showSub(menuSub);
  renderSaved();
  if (!entered) return;
  renderSpawn();
  renderPlan();
  updatePanels();
  if (!$('admin').classList.contains('hidden')) renderAdmin();
}

$('mlang').addEventListener('click', e => {
  const b = e.target.closest('button[data-l]');
  if (b && b.dataset.l !== LANG) setLang(b.dataset.l);
});
document.documentElement.lang = LANG;
for (const b of $('mlang').children) b.classList.toggle('on', b.dataset.l === LANG);
$('menuBtn').onclick=openMenu;

$('menu').addEventListener('click', e => {
  const b = e.target.closest('button[data-m]');
  if (!b) return;
  const m = b.dataset.m;
  if (m === 'credits' || m === 'news') return showSub(m);
  if (m === 'back') return showSub(null);
  closeMenu();
  if (m === 'continue') return;
  entered = true;
  if (m==='quick') startQuick();
  else if (m === 'race') setMode('race');
  else if (m === 'camp' || m === 'campBig') startCamp(m === 'campBig');
  else if (m === 'level') levelMode();
  else if (m === "arena") startArena();
});
function setSide(off) {
  document.body.classList.toggle("sideOff", off);
  $('sideTab').textContent = off ? lang("Paneli aç") : lang('Paneli gizle');
  try { localStorage.setItem("krallik.sideOff", off ? '1' : '0'); } catch {}
  resize();
}
$('sideTab').onclick = () => setSide(!document.body.classList.contains('sideOff'));
try { if (localStorage.getItem('krallik.sideOff') === '1') setSide(true); } catch {}

function frame() {
  if (DPR !== curDPR()) resize();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (tab === 'race') renderPreview(ctx, VW, VH, design);
  else if (campMap()) campFrame(ctx, VW, VH);
  else if (!Sim.ready) {
    ctx.fillStyle = '#111a24'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#c9d6e3"; ctx.font = '16px Redaction35, system-ui'; ctx.textAlign = 'center';
    ctx.fillText(lang('Henüz dünya yok. Irkını tasarlayıp "Dünyaya Bırak" de.'), VW / 2, VH / 2); ctx.textAlign = 'left';
  } else {
    if (Sim.speed > 0 && !(LV.on && LV.phase !== 'fight' && LV.phase !== 'done')) {
       Sim.acc += Sim.speed;
      const t0 = performance.now();
      while (Sim.acc >= 1 && performance.now() - t0 < 30) { step(); Sim.acc--; }
      if (Sim.acc > Math.max(1, Sim.speed)) Sim.acc = 0;
    }
    levelFrame();
    if (++frameN % 30 === 0) { updateRoadImg(); updatePanels(); }
     renderWorld(ctx, VW, VH);
  }
  requestAnimationFrame(frame);
}

initPlan();
initSpawn();
initLevels();
resize();
renderSaved();
renderNews();
newFromTemplate('human');
$('rCountV').textContent = $('rCount').value;
setMode('race');
refreshSpeeds();
openMenu();
frame();

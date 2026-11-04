const SC_E = 0, SC_W = Math.PI, SC_N = -Math.PI / 2, SC_S = Math.PI / 2;
const scP = q => Array.isArray(q) ? { x: W / 2 + q[0], y: H / 2 + q[1] } : q;

function segDist(x, y, noktalar) {
  let best = Infinity;
  for (let i = 1; i < noktalar.length; i++) {
    const [ax, ay] = noktalar[i - 1], [bx, by] = noktalar[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1) : 0, ex = ax + dx * t - x, ey = ay + dy * t - y, d = ex * ex + ey * ey;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function scenTerrain(F) {
  const { cols, rows, tile } = CFG, S = 2, gw = cols * S + 1, gh = rows * S + 1;
  const n1 = makeNoise(cols, rows, 10), n2 = makeNoise(cols, rows, 2.5), nm = makeNoise(cols, rows, 6), BASE = 0.42;
  const ell = (x, y, f) => Math.hypot((x - f[1]) / f[3], (y - f[2]) / f[4]);
  const mtn = (u, s, c, r) => {
    if (u <= -24) return 0;
    if (u <= 0) return 0.6 - 0.18 * (-u / 24);

    if (u < s) return 0.6 + 0.28 * u / s;
    if (u < s + 18) return 0.95;
    return 0.84 + (n1(c, r) - 0.5) * 0.3;
  };
  const H0 = new Float32Array(gw * gh), M0 = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = i / S, r = j / S, x = c * tile - W / 2, y = r * tile - H / 2, wob=(n2(c, r) - 0.5) * 26;
    let v = BASE + (n1(c, r) - 0.5) * 0.08 + (n2(c, r) - 0.5) * 0.03, m = 0.3 + (nm(c, r) - 0.5) * 0.16;
    for (const f of F) switch (f[0]) {
      case 'hill': { const d = ell(x, y, f) + wob / 500; if (d < 1.6) v=Math.max(v, BASE + 0.3 * (1 - (d / 1.6) ** 2)); break; }
      case 'ridge': v = Math.max(v, mtn(f[2] + f[3] - segDist(x, y, f[1]) + wob, f[3], c, r)); break;
      case 'valley': { const sl = typeof f[2] === 'function' ? f[2](x) : f[2]; v = Math.max(v, mtn(Math.abs(y) - f[1](x) + wob * Math.min(1, sl / 50), sl, c, r)); break; }
      case 'trail': if (segDist(x, y, f[1]) + wob * 0.2 < f[2] && v > 0.6) v = 0.63; break;
      case 'river': { const d = segDist(x, y, f[1]) + wob * 0.25; if (d < f[2]) v = 0.12; else if (d < f[2] + 10) v = Math.min(v, 0.22); break; }
      case 'lake': { const d=ell(x, y, f) + wob / 600; if (d < 1) v = 0.12; else if (d < 1.12) v = Math.min(v, 0.22); break; }
      case 'ford': if (ell(x, y, f) < 1) v = 0.225; break;
      case 'forest': if (ell(x, y, f) + wob / 300 < 1) m = 0.75; break;
      case 'forestBand': if (segDist(x, y, f[1]) + wob * 1.5 < f[2]) m = 0.75; break;
      case 'clear': if (segDist(x, y, f[1]) + wob * 0.3 < f[2]) m = 0.3; break;
    }
    H0[j * gw + i] = v; M0[j * gw + i] = m;
  }
  const look = G => (c, r) => {
    const fx = clamp(c * S, 0, gw - 1.001), fy = clamp(r * S, 0, gh - 1.001), i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, o=j * gw + i;
    return (G[o] * (1 - tx) + G[o + 1] * tx) * (1 - ty) + (G[o + gw] * (1 - tx) + G[o + gw + 1] * tx) * ty;
  };
  return { h: look(H0), m: look(M0), th: { deep: 0.08, sea: 0.2, beach: 0.24, hills: 0.6, mount: 0.74, snow: 0.9 } };
}

const scLive = X => !!(X && X.members.length && X.k.armies.includes(X) && X.state !== 'retreat' && !routing(X));
function scOrder(X, o, simge)
{
  if (!scLive(X)) return false;
  X.order = o;
  if (X.state === 'ambush') X.state = 'idle';
  say(X.cmd, simge, 120);
  return true;
}

function scRun(S)
{
  const s = { S, t0: Sim.tick, t: 0, A: {}, done: new Set(), at: {} }, A = id => s.A[id];
  const from = X => ({ x: X.cmd.x, y: X.cmd.y }), yol = (X, pts) => resample([from(X), ...pts.map(scP)], 18);
  Object.assign(s, {
    ok: id => scLive(A(id)),
    lost: id => { const X=A(id); return X && X.k.armies.includes(X) ? 1 - X.members.length / Math.max(1, X.start) : 1; },
    fought: id => { const X = A(id); return X && X.scFight ? Sim.tick - X.scFight : 0; },
    since: id => s.at[id] != null ? Sim.tick - s.at[id] : -1,
    ctr: id => {
      const X=A(id);
      if (!X || !X.members.length) return { x: -1e6, y: -1e6 };
      let x=0, y = 0;
      for (const p of X.members) { x += p.x; y += p.y; }
      return { x: x / X.members.length, y: y / X.members.length };
    },
    rel: id => { const c = s.ctr(id); return { x: c.x - W / 2, y: c.y - H / 2 }; },
    d: (a, b) => dist(s.ctr(a), typeof b === 'string' ? s.ctr(b) : scP(b)),
    attack: (id, noktalar, dusman) => { const X = A(id); return scLive(X) && scOrder(X, { type: 'attack', path: yol(X, noktalar), i: 0, phase: 'go', t: 0, then: dusman ? A(dusman) : null }, '⚔️'); },
    free: (id, dusman) => { const X = A(id); return scLive(X) && scOrder(X, { type: 'free', t: 0, idle: 0, foe: (dusman && scLive(A(dusman)) ? A(dusman) : null) || nearestFoeArmy(X) }, '⚔️'); },
    hold: (id, at, yon, trench) => { const p = scP(at); return scOrder(A(id), { type: 'hold', x: p.x, y: p.y, dir: yon, t: 0, trench: !trench }, '🛡'); },
    move: (id, noktalar) => { const X = A(id); return scLive(X) && scOrder(X, { type: 'move', path: yol(X, noktalar), i: 0, t: 0 }, '🚶'); },
    feint: (id, at) => { const p = scP(at); return scOrder(A(id), { type: 'feint', x: p.x, y: p.y, t: 0, lure: true }, '🏇'); },
    pierce: (id, noktalar) => { const X = A(id); return scLive(X) && scOrder(X, { type: 'pierce', path: yol(X, noktalar), i: 0, phase: 'go', t: 0 }, '🗡'); },
    form: (id, f) => { const X = A(id); if (!scLive(X)) return; X.form = f; X.reformT=Sim.tick; if (X.order) X.order.n = -1; },
    fury: id => { const X = A(id); if (scLive(X)) X.turnUntil = Sim.tick + 300; },
  });
   return s;
}
function scArmy(s, id, taraf, race, sayilar, at, yon, form, o = {}) {
  const p0 = scP(at), def = s.S.sides[taraf];
  let k = Sim.sides[taraf];
  if (!k || k.dead) {
    k = arenaSide(taraf, def.race || race, p0.x, p0.y);
    k.name = def.name; k.capital.name = lang`${def.name} Ordugâhı`; k.tech = def.tech || 0;
    if (def.color) { k.color = def.color; k.roof = mixHex(k.color, '#6b4a2f', 0.55); }
  }
  const A = spawnArmy(k, race, p0.x, p0.y, sayilar, form, null, true);
  A.formSet = true; A.btacSet = true; A.btac = o.btac || 'charge'; A.scen = id;
  countUnits(A);
  const cd = Math.cos(yon), sd = Math.sin(yon);

  A.cmd.a = yon;
  for (const p of A.members) {
    const [lat, back] = slotOffset(A, p), x = p0.x - sd * lat - cd * back, y = p0.y + cd * lat - sd * back;
    if (speedAt(x, y)) { p.x = x; p.y = y; } else { p.x = p0.x + rnd(-4, 4); p.y = p0.y + rnd(-4, 4); }
    p.a = yon; p.hx = null;
  }
  A.order = { type: 'hold', x: p0.x, y: p0.y, dir: yon, t: 0, trench: true, silent: !!o.silent };
  A.scHold = A.order; A.scDig = !!o.trench;
   s.A[id] = A
  return A;
}
function scTraps(s, taraf, liste)
{
  const k = Sim.sides[taraf], traps = Sim.traps || (Sim.traps = []);
  for (const [tur, x, y] of liste) {
    const p = scP([x, y]);
    if (speedAt(p.x, p.y)) traps.push({ k, x: p.x, y: p.y, type: tur, r: tur === 'oil' ? 26 : tur === 'pit' ? 7 : 10, hp: 25, t0: Sim.tick, fire: 0, spent: false, seed: Math.random() * 6 });
  }
}
function scTrench(s, taraf, at, yon, uzunluk) {
  const p = scP(at), tr = newTrench(Sim.sides[taraf], p.x, p.y, yon, uzunluk, 'line');
  tr.prog = 1; tr.until = Sim.tick + 1e7;
  Sim.trenches.push(tr);

}
function scSay(simge, yazi) {
  chron(lang`${simge} ${yazi}`);
  scNow(lang`${simge} ${yazi}`);
}
function scNow(yazi) {
  if (!Sim.scen) return;
  Sim.scen.last = yazi;
  const el = document.getElementById('scNow');
  if (el) el.innerHTML=`<b>${Sim.scen.S.name}</b> · ${yazi}`;
}

const SC_PREP_MAX = 750;
function scPrepStart(s) {
  const P = s.prep = { t0: Sim.tick, sides: [], planned: false, cnt: '' };
  (s.S.plan || []).forEach(pl => {
    const A = s.A[pl.lead];
    if (!scLive(A)) return;
    const n = Object.values(s.A).filter(X => X.k === A.k).reduce((t, X) => t + X.members.length, 0);
    const yon = A.cmd.a, back=70 + Math.sqrt(A.members.length) * 6;
    const at = landNear(A.cmd.x - Math.cos(yon) * back, A.cmd.y - Math.sin(yon) * back) || { x: A.cmd.x, y: A.cmd.y };
    const base = { k: A.k, A: null, x: at.x, y: at.y, r: clamp(16 + n * 0.12, 22, 40), until: Sim.tick + 1e9, n: clamp(Math.round(n / 18), 5, 12), deco: true };
    Sim.bases.push(base);
    const queue = Object.entries(pl.orders || {}).filter(([id]) => scLive(s.A[id])).sort(([a], [b]) => dist2(s.A[b].cmd, at) - dist2(s.A[a].cmd, at));
     P.sides.push({ pl, A, base, queue, letters: [], last: 0, done: false });
    say(A.cmd, '⛺', 160);
    chron(lang`⛺ ${A.k.name} ordugâh kurdu; komutan ${rankName(A.cmd)} çadırında savaş planını hazırlıyor`, A.k);
  });
  scNow(lang('⛺ Hazırlık: iki taraf da ordugâh kurdu, komutanlar savaş planını hazırlıyor...'));
}
function scLetter(d, X, role, yazi)
{
  const A = d.A, b = d.base;
  if (!scLive(X) || !scLive(A)) return null;
  const p=newTroop(A.cmd.race, A.k, homeNear(A.k, b), b.x + rnd(-6, 6), b.y + rnd(-6, 6), 'cavalry');
  p.pace = 2; p.state = 'courier';
  const m = { p, from: A, to: X, type: 'plan', foe: null, stage: 'go', ans: null, t0: Sim.tick, extra: true, role, text: yazi };
  p.courier = m;
  Sim.msgs.push(m);
  say(A.cmd, '✍️', 120);
  chron(lang`✉️ ${A.k.name} komutanı ${rankName(A.cmd)} mesajcı yolladı → ${role}: "${yazi}"`, A.k);
  scNow(lang`✉️ ${A.k.name} → ${role}: "${yazi}"`);
  return m;
}
function scPrepTick(s) {
  const P=s.prep, t = Sim.tick - P.t0;
  if (!Sim.cplan) return scBegin(s, lang('Komutan planları kapatıldı: hazırlık bırakıldı, savaş başlıyor!'));
  if (Object.values(s.A).some(X => X.battle)) return scBegin(s, lang('Ordular hazırlık bitmeden çarpıştı: savaş başladı!'));
  if (!P.planned && t >= 60) {
    P.planned = true;
    for (const d of P.sides) if (scLive(d.A)) { say(d.A.cmd, '📜', 150); chron(lang`📜 ${d.A.k.name} komutanı ${rankName(d.A.cmd)} savaş planını yaptı: ${d.pl.text}`, d.A.k); }
    scNow(lang('📜 Komutanlar savaş planını yaptı; atlı mesajcılar bölüklere emirleri götürecek'));
  }
  if (!P.planned || t < 100) return;
  for (const d of P.sides) {
    if (!d.queue.length || Sim.tick - d.last < 20) continue;
    const [id, [role, yazi]] = d.queue.shift(), m = scLetter(d, s.A[id], role, yazi);
    if (m) { d.letters.push(m); d.last = Sim.tick; }
  }

  for (const d of P.sides) if (!d.done && !d.queue.length && d.letters.every(m => m.ans != null || !Sim.msgs.includes(m))) {
    d.done=true;
    if (d.letters.length) chron(lang`✅ ${d.A.k.name}: bütün bölükler emri aldı, ordu işaret bekliyor`, d.A.k);
  }
  const all = P.sides.reduce((n, d) => n + d.letters.length + d.queue.length, 0), got = P.sides.reduce((n, d) => n + d.letters.filter(m => m.ans != null).length, 0);
  if (got && `${got}/${all}` !== P.cnt) { P.cnt = `${got}/${all}`; scNow(lang`✅ ${got}/${all} emir yerine ulaştı, mesajcılar dönüyor`); }
  if ((P.sides.every(d => d.done) && t >= 240) || t >= SC_PREP_MAX) scBegin(s);
}
function scBegin(s, neden) {
  const P = s.prep;
  s.prep=null; s.t0 = Sim.tick; s.t = 0;
  for (const id in s.A) { const X = s.A[id]; if (X.scDig && X.order === X.scHold) { X.order.trench = false; X.order.t = 0; } }
  if (P) scSay('🎺', neden || lang('Emirler bütün bölüklere ulaştı. Borular çalıyor: savaş başlıyor!'));

}

function scenTick() {
  const s = Sim.scen;
  if (s.prep) return scPrepTick(s);
  s.t = Sim.tick - s.t0;
  for (const id in s.A) { const X = s.A[id]; if (X.battle && !X.scFight) X.scFight = Sim.tick; }
  for (const st of s.S.script) {
    if (s.done.has(st.id) || (st.need && !st.need.every(n => s.done.has(n)))) continue;
     let ok = false;
    try { ok = st.when(s); } catch (e) { ok=false; }
    if (!ok) continue;
    s.done.add(st.id); s.at[st.id]=Sim.tick;
    if (st.run) st.run(s);

    if (st.say) scSay(st.say[0], st.say[1]);
  }
}

function startScen(i)
{
  const S = SCENS[i];
  campOff(); levelOff();
  Sim.arena = true; Sim.placing = null; Sim.tool = null;
  Sim.scenGen=scenTerrain(S.map);
  initWorld();
  Sim.scenGen = null;
  Sim.wx={ season: S.season ?? 1, rain: !!S.rain };
  const s = Sim.scen = scRun(S);

  S.setup(s);
  Sim.follow = false; MULTI.clear(); PLAN.army = null;
  if (!Sim.speed) Sim.speed=SPEED1;
  chron(lang`🎬 ${S.name}: ${S.desc}`);
  setMode('arena');
  spCat='test'; renderSpawn(); togglePlan(true); updatePanels();

  const z = S.cam[2], bar = document.getElementById('spawnBar'), bh = bar && typeof bar.offsetHeight === 'number' ? bar.offsetHeight : 0;
  Object.assign(Sim.cam, { x: W / 2 + S.cam[0] + (PLAN.open ? 135 : 0) / z, y: H / 2 + S.cam[1] + bh / 2 / z, z });

  if (Sim.cplan && S.plan) scPrepStart(s); else scBegin(s);
}

function scenPanel() {
  if (!Sim.arena) return lang`<button data-rw="1" title="Rastgele krallık çiftleri savaşa tutuşur, sınırlarına ordular çıkar">Rastgele savaşlar</button>
    <span class="muted">Hazır savaşlar Savaş Meydanında (ana menüden).</span>`;
  const simdiki = Sim.scen && Sim.scen.S;
  return lang`<div class="scWrap"><div class="scGrid">${SCENS.map((S, i) => `<button data-sc="${i}" class="${simdiki === S ? "on" : ""}" title="${S.desc}"><b>${i + 1}. ${S.name}</b><small>${S.sub}</small></button>`).join('')}
    <button data-rw="1" title="Rastgele taraflar ve ordularla 1-3 cephe açar (mevcut meydanda)"><b>Rastgele savaşlar</b><small>1-3 cephe, rastgele ordular</small></button></div>
    <div id="scNow">${simdiki ? `<b>${simdiki.name}</b> · ${Sim.scen.last || simdiki.desc}` : lang('<span class="muted">Bir savaş seç: meydan o savaşın haritasıyla baştan kurulur, ordular dizilir. Önce komutanlar ordugâhta plan yapıp bölüklerine atlı mesajcıyla emir yollar; emirler ulaşınca savaş başlar ve plan kendiliğinden işler. Olaylar sekmesinden izle.</span>')}</div></div>`;
}

const SCENS = [
  {
    name: 'Dar Geçit', sub: "Geçit savunması, keçi yolu",
    desc: 'Bir avuç Demirdağ cücesi, iki karlı dağın arasındaki dar geçidi kalkan duvarıyla tutuyor. Kara Pençe orkları dalga dalga yüklenecek; ama dağların arasında bir keçi yolu var...',
    sides: [{ name: 'Demirdağ Cüceleri', race: 'dwarf', tech: 3 }, { name: 'Kara Pençe Orduları', race: 'orc', tech: 1 }],
    map: [
      ['valley', x => { const a = Math.abs(x); return a < 220 ? 34 : Math.min(560, 34 + (a - 220) * 0.55); }, x => Math.min(70, 16 + Math.max(0, Math.abs(x) - 260) * 0.2)],
      ['trail', [[-600, 170], [-430, 270], [-160, 330], [200, 330], [440, 240], [600, 140]], 20],
      ['forest', -1000, -260, 160, 110], ['forest', -1100, 320, 140, 100], ['forest', 1000, -250, 150, 120],
    ],
    cam: [-290, 0, 0.6],
    plan: [
      { lead: 'res', text: 'Geçidi kalkan duvarıyla tutacağız. Okçular duvarın arkasından ok yağdıracak, yedekler en arkada bekleyip gerekirse sırtımızı koruyacak.',
        orders: { wall: ['kalkan duvarı', 'Geçidin ağzını kapatın, kalkanları kenetleyin. Bir adım bile geri yok.'], arch: ['okçular', 'Duvarın arkasında durun; düşman yokuşa vurunca ok yağdırın.'] } },
      { lead: 'o2', text: 'Önce goblin sürüsü geçide akıp cüceleri yoracak, ardından seçkinler kama düzeninde yüklenecek. Bir bölük keçi yolundan dolanıp geçidin arkasından çıkacak; o an kurt binicileri de cepheden dalacak.',
        orders: { g1: ['goblin sürüsü', 'Geçide ilk siz akın. Cüceleri yorun, kalkanlarını gevşetin.'], oarc: ['okçular', 'Seçkinler yürüyünce geçidin ağzına dizilip duvarı oklayın.'],
          wolf: ['kurt binicileri', 'Dağın ardındaki bölük geçidin arkasından çıkınca cepheden dalın.'], flank: ["keçi yolu bölüğü", 'Çoban size keçi yolunu gösterecek. Dağı dolanıp geçidin arkasından çıkın.'] } },
    ],
    setup(s) {
      scArmy(s, 'wall', 0, 'dwarf', { shield: 30, spear: 16 }, [90, 0], SC_W, 'line');
      scTrench(s, 0, [80, 0], SC_W, 104);
      scArmy(s, 'arch', 0, 'dwarf', { archer: 22 }, [150, 0], SC_W, "horde");
      scArmy(s, 'res', 0, 'dwarf', { soldier: 18, medic: 4 }, [270, 0], SC_W, 'line');
      scArmy(s, 'g1', 1, 'goblin', { soldier: 110 }, [-600, 0], SC_E, 'horde');
      scArmy(s, "o2", 1, 'orc', { soldier: 44 }, [-860, 0], SC_E, 'wedge')
      scArmy(s, 'oarc', 1, "orc", { archer: 26 }, [-860, 170], SC_E, 'horde');
      scArmy(s, "wolf", 1, 'orc', { cavalry: 22 }, [-860, -230], SC_E, "wedge");
      scArmy(s, 'flank', 1, 'orc', { soldier: 26 }, [-720, 230], SC_E, 'column');
    },
    script: [
      { id: 'go', when: s => s.t > 60, run: s => s.attack('g1', [[-300, 0], [60, 0]], 'wall'),
        say: ['⚔️', 'Goblin sürüsü çığlıklar atarak geçide akıyor! Demirdağ cüceleri kalkanlarını kenetledi, okçular arkada yay geriyor.'] },
      { id: 'goat', need: ['go'], when: s => s.fought("g1") > 300 || s.t > 1300, run: s => s.move('flank', [[-600, 170], [-430, 270], [-160, 330], [200, 330], [440, 240], [600, 140]]),
        say: ['🐐', 'Bir hain çoban, orklara dağların ardından dolanan keçi yolunu gösterdi... Bir ork bölüğü tek sıra halinde karlı yamaçlara tırmanıyor.'] },
      { id: 'w2', need: ['go'], when: s => s.fought('g1') > 650 || s.lost('g1') > 0.6, run: s => { s.attack('o2', [[-300, 0], [40, 0]], 'wall'); s.move('oarc', [[-300, 30], [-40, 10]]); },
        say: ['📯', "Goblin cesetleri geçidi tıkadı. Şimdi sıra Kara Pençe seçkinlerinde: kama düzeninde yürüyorlar, ork okçuları geçidin ağzına diziliyor."] },
      { id: 'out', need: ['goat'], when: s => s.d('flank', [600, 140]) < 90, run: s => { s.attack('flank', [[430, 40]], 'res'); s.attack('wolf', [[-300, 0], [60, 0]], "wall"); },
        say: ['😱', 'Orklar geçidin ARKASINDAN çıktı! Aynı anda kurt binicileri cepheden saldırıyor: cüceler iki ateş arasında.'] },
      { id: 'turn', need: ['out'], when: s => s.d('flank', 'res') < 320, run: s => { s.hold('res', [320, 0], SC_E); s.form('res', 'shieldwall'); },
        say: ['🛡', 'Cüce yedekleri arkayı tutmak için yüzlerini doğuya çevirdi.'] },
      { id: 'last', when: s => s.lost('wall') > 0.6, run: s => s.form('wall', 'schiltron'),
        say: ['🔥', 'Kalkan duvarı inceldi; kalan cüceler sırt sırta verip son direnişe geçti!'] },
    ],
  },
  {
    name: 'Kannai Kıskacı', sub: 'Çifte kuşatma',
    desc: 'Kalabalık Gümüş Lejyon merkeze yüklenecek. Kızıl Tuğ\'un merkezi bilerek ince: geri esneyip lejyonu içine çekecek, kanatlardaki ağır piyade ve süvari kıskacı kapatacak.',
    sides: [{ name: 'Kızıl Tuğ', race: 'human', tech: 1, color: '#e63946' }, { name: 'Gümüş Lejyon', race: 'human', tech: 2, color: "#3a86ff" }],
    map: [
      ['river', [[-1800, 600], [-700, 540], [0, 590], [700, 520], [1800, 560]], 40],
      ["forest", -900, -700, 260, 120], ['forest', 900, -720, 240, 110], ["hill", 700, 0, 120, 160],
    ],
    cam: [-140, 0, 0.58],
    plan: [
      { lead: 'mid', text: 'Merkez bilerek ince kalacak, geri esneyip lejyonu içine çekecek. Kanatlardaki ağır piyade dönüp yanlardan kapanacak, süvari arkadan dolanıp çemberi tamamlayacak.',
        orders: { wl: ['sol kanat', 'Merkez geri esneyince bekleyin. Lejyon torbaya girince dönüp yanına yüklenin.'], wr: ["sağ kanat", 'Merkez geri esneyince bekleyin. Lejyon torbaya girince dönüp yanına yüklenin.'],
          cl: ['sol süvari', 'Önce karşınızdaki atlıları dağıtın, sonra lejyonun arkasına dolanın.'], cr: ['sağ süvari', 'Önce karşınızdaki atlıları dağıtın, sonra lejyonun arkasına dolanın.'] } },
      { lead: "la", text: 'Bütün ağırlığımızla merkeze yükleneceğiz: iki lejyon yan yana, okçular önde. Süvari kanatlardaki düşman atlılarını bağlayacak.',
        orders: { lb: ['ikinci lejyon', 'Yanımızda yürüyün; ince merkezlerini birlikte yarıp geçeceğiz.'], lv: ['okçular', 'Önden yürüyüp merkezlerine ok yağdırın.'],
          mc1: ['sol süvari', 'Karşınızdaki atlıları bağlayın, lejyonun yanını açık bırakmayın.'], mc2: ['sağ süvari', 'Karşınızdaki atlıları bağlayın, lejyonun yanını açık bırakmayın.'] } },
    ],
    setup(s) {
      scArmy(s, 'mid', 0, 'human', { soldier: 50 }, [160, 0], SC_W, 'crescent');
      scArmy(s, "wl", 0, 'human', { shield: 20, spear: 22 }, [140, -215], SC_W, 'phalanx');
      scArmy(s, 'wr', 0, 'human', { shield: 20, spear: 22 }, [140, 215], SC_W, 'phalanx');
      scArmy(s, 'cl', 0, 'human', { cavalry: 30 }, [110, -440], SC_W, 'wedge');
      scArmy(s, 'cr', 0, 'human', { cavalry: 24 }, [110, 410], SC_W, 'wedge');
      scArmy(s, 'la', 1, 'human', { soldier: 70, shield: 10 }, [-430, -85], SC_E, 'line');

      scArmy(s, 'lb', 1, 'human', { soldier: 70, shield: 10 }, [-430, 90], SC_E, 'line');
      scArmy(s, 'lv', 1, 'human', { archer: 20 }, [-300, 0], SC_E, 'horde');
      scArmy(s, 'mc1', 1, 'human', { cavalry: 18 }, [-430, -420], SC_E, 'wedge');
      scArmy(s, 'mc2', 1, 'human', { cavalry: 18 }, [-430, 390], SC_E, 'wedge');
    },
    script: [
      { id: 'adv', when: s => s.t > 60, run: s => {
        s.attack('la', [[-80, -50], [120, -30]], "mid"); s.attack('lb', [[-80, 50], [120, 30]], 'mid'); s.attack('lv', [[0, 0]], 'mid');
        s.attack("mc1", [[60, -430]], 'cl'); s.attack('mc2', [[60, 400]], 'cr'); s.attack("cl", [[-100, -430]], 'mc1'); s.attack('cr', [[-100, 400]], "mc2");
      }, say: ['⚔️', 'Gümüş Lejyon bütün ağırlığıyla merkeze yürüyor. Kızıl Tuğ\'un hilali ince... belki de bilerek ince. Kanatlarda süvariler çarpışıyor.'] },
      { id: "give", need: ['adv'], when: s => s.fought('mid') > 80 || s.d('la', 'mid') < 130 || s.d('lb', 'mid') < 130, run: s => s.feint("mid", [340, 0]),
        say: ['🌙', 'Merkez geri esniyor! Lejyon ilerledikçe hilal içe kıvrılıyor, lejyon farkında olmadan torbaya giriyor.'] },
      { id: 'jaws', need: ['give'], when: s => s.since('give') > 220 || s.rel("la").x > 60 || s.rel('lb').x > 60, run: s => {
        s.attack('wl', [[-40, -150]], 'la'); s.attack('wr', [[-40, 150]], 'lb');
      }, say: ['🦀', 'Kıskaç kapanıyor! Kanatlardaki ağır piyade sola ve sağa dönüp lejyonun açık yanlarına yürüdü.'] },
      { id: 'hammer', need: ['jaws'], when: s => s.since('jaws') > 260 || (!s.ok('mc1') && !s.ok('mc2')), run: s => {
        s.attack('cl', [[-300, -420], [-680, -160], [-620, -20]], 'la'); s.attack("cr", [[-300, 400], [-680, 160], [-620, 20]], 'lb');
      }, say: ['🐎', 'Kızıl süvari lejyonun arkasına dolandı: çember tamam! Gümüş Lejyon dört yandan sıkıştırılıyor.'] },
      { id: 'turnMid', need: ["jaws"], when: s => s.since('jaws') > 120, run: s => { s.free('mid', 'la'); s.fury('mid'); } },
    ],
  },
  {
    name: 'Köprübaşı', sub: 'Nehir geçidinde baskın',
    desc: 'Demir Kraliyet ordusu nehrin üstündeki dar geçitten karşıya geçmeye çalışıyor. Gümüşırmak yarı-elfleri tepede bekliyor: düşmanın yarısı geçince köprübaşına inecekler.',
    sides: [{ name: "Gümüşırmak Yarı-Elfleri", race: 'halfelf', tech: 2, color: '#2a9d8f' }, { name: 'Demir Kraliyet', race: 'human', tech: 2 }],
    map: [
      ['river', [[0, -1300], [40, -700], [-30, -300], [0, 0], [30, 300], [-20, 800], [0, 1300]], 45],
      ['ford', 0, 0, 72, 24],
      ['hill', 380, -40, 160, 140], ['forest', 700, -330, 200, 170], ['forest', 760, 330, 160, 140], ['forest', -700, -400, 200, 140],
    ],
    cam: [-60, 0, 0.6],
    plan: [
      { lead: 'arc', text: 'Tepede kıpırdamadan bekleyeceğiz. Düşmanın yarısı geçidi geçince inip köprübaşını keseceğiz: geçenlerle geçemeyenler birbirinden kopacak.',
        orders: { sp: ['mızrakçılar', 'Yarısı geçince köprübaşına inin, şövalyeleri mızrak duvarıyla karşılayın.'], inf: ['piyade', 'Yarısı geçince geçidin ağzına yüklenin, geçenleri nehre sıkıştırın.'],
          cav: ['süvari', 'Yarısı geçince güneyden dolanıp geçidin ağzını tutun.'] } },
      { lead: 'mn', text: 'Dar geçitten karşıya geçeceğiz: önce şövalyeler köprübaşını tutacak, ana kol arkalarından geçecek, yedekler batı yakasında bekleyecek.',
        orders: { kn: ["şövalyeler", 'Geçidi ilk siz geçin, karşı yakada köprübaşını tutun.'], rr: ["yedekler ve toplar", 'Biz geçerken batı yakasında bekleyin, sonra arkamızdan gelin.'] } },
    ],
    setup(s) {
      scArmy(s, 'sp', 0, 'halfelf', { spear: 50, shield: 10 }, [420, -180], SC_W, 'phalanx');
      scArmy(s, 'inf', 0, 'halfelf', { soldier: 54 }, [430, 160], SC_W, "line");
      scArmy(s, 'arc', 0, 'halfelf', { archer: 36 }, [320, -20], SC_W, 'horde');
      scArmy(s, 'cav', 0, "halfelf", { cavalry: 20 }, [540, 340], SC_W, 'wedge');
      scArmy(s, 'kn', 1, 'human', { cavalry: 20, shield: 14 }, [-260, 0], SC_E, 'wedge');
      scArmy(s, "mn", 1, "human", { soldier: 54, archer: 14 }, [-460, 0], SC_E, 'column');
      scArmy(s, 'rr', 1, 'human', { soldier: 24, archer: 8, artillery: 4 }, [-680, 0], SC_E, 'line');
    },
    script: [
      { id: "cross", when: s => s.t > 60, run: s => { s.move('kn', [[-80, 0], [70, 0], [200, 10]]); s.move('mn', [[-200, 0], [-80, 0], [70, 0], [170, 70]]); s.move('rr', [[-170, 0]]); },
        say: ['🌉', 'Demir Kraliyet dar geçitten karşıya geçmeye başladı. Yarı-elfler tepede kıpırdamadan bekliyor...'] },
      { id: 'half', need: ['cross'], when: s => {
        const ms = [s.A.kn, s.A.mn].flatMap(X => X.members), east = ms.filter(p => p.x > W / 2 + 60).length;
        return east >= ms.length * 0.42 || s.t > 2400;
      }, run: s => { s.attack('sp', [[200, -60]], 'kn'); s.attack('inf', [[160, 70], [80, 15]], "mn"); s.attack('cav', [[260, 260], [100, 40]], 'mn'); },
      say: ['📯', 'Yarısı geçti! Yarı-elfler tepeden iniyor: mızrakçılar köprübaşına, piyade ve süvari geçidin ağzına. Geçenlerle geçemeyenler birbirinden koptu!'] },
      { id: 'push', need: ['half'], when: s => s.since('half') > 320, run: s => s.attack('rr', [[-70, 0], [70, 0], [160, 0]], 'inf'),
        say: ['🌊', 'Batı yakasındaki yedekler köprüye yığıldı; dar geçitte birbirlerini ite kaka karşıya geçmeye çalışıyorlar.'] },
    ],
  },
  {
    name: "Orman Pususu", sub: 'Yolda kol, ağaçlarda pusu',
    desc: 'İmparatorluk lejyonları uzun bir kol halinde sık ormandan geçen yolda yürüyor. Yağmur yağıyor. Kara Orman kabileleri ağaçların arasında gizlenmiş, yolun sonu da kapalı.',
    sides: [{ name: 'İmparatorluk Lejyonları', race: 'human', tech: 2 }, { name: 'Kara Orman Kabileleri', race: 'human', tech: 1, color: '#2a9d8f' }],
    rain: true,
    map: [
      ['forestBand', [[-1500, 40], [-1000, -20], [-500, 30], [0, -30], [500, 20], [1000, -10], [1500, 0]], 420],
      ['clear', [[-1800, 40], [-1500, 40], [-1000, -20], [-500, 30], [0, -30], [500, 20], [1000, -10], [1800, 0]], 34],
      ['clear', [[860, -60], [860, 60]], 150], ['clear', [[-1500, 40], [-1300, 30]], 150],
      ['hill', -60, -250, 110, 70], ['lake', 220, 270, 90, 45],
    ],
    cam: [-450, 0, 0.5],
    plan: [
      { lead: 'l2', text: 'Ormandan geçen yolda kol halinde yürüyüp yolun sonundaki barikata varacağız. Öncü önde, ağır lejyon ortada, süvari arkada.',
        orders: { l1: ['öncü lejyon', 'Yolda önden gidin, ağaçlara gözünüzü dört açın.'], l3: ['artçı', "Arkayı kollayın, kolun arkasından kopmayın."] } },
      { lead: 'am3', text: 'Lejyonlar yolun ortasına gelene kadar kimse kıpırdamayacak, tek ok bile atılmayacak. İşaret gelince okçular yol kenarından yağdıracak, savaşçılar derinden fırlayacak; barikat yolun sonunu kapatacak.',
        orders: { am1: ['1. pusu grubu', 'Sessiz durun. İşaret gelince ortadaki ağır lejyona çullanın.'], am2: ['2. pusu grubu', 'Sessiz durun. İşaret gelince ortadaki ağır lejyona çullanın.'],
          am4: ['4. pusu grubu', 'Sessiz durun. İşaret gelince öncü lejyona çullanın.'], blk: ['barikat', 'Yolun sonunu kapatın, hendeğin arkasından kimseyi geçirmeyin.'] } },
    ],
    setup(s) {
      const road = [[-1000, -20], [-500, 30], [0, -30], [500, 20], [860, 0]];
      s.road = road;
      scArmy(s, 'l1', 0, 'human', { soldier: 36, archer: 8 }, [-1000, -20], SC_E, 'column');
      scArmy(s, 'l2', 0, "human", { soldier: 40, shield: 12, medic: 4 }, [-1190, 10], SC_E, 'column');
      scArmy(s, 'l3', 0, 'human', { soldier: 26, cavalry: 12 }, [-1380, 30], SC_E, 'column');
      for (const [id, x, y, d] of [['1', -360, 13, -1], ['2', -160, -11, 1], ['3', 160, -14, -1], ["4", 340, 4, 1]]) {
        scArmy(s, 'aa' + id, 1, 'human', { archer: 24 }, [x, y + d * 52], d < 0 ? SC_S : SC_N, 'skirmish', { silent: true });
        scArmy(s, 'am' + id, 1, 'human', { soldier: 30, spear: 8 }, [x + 30, y + d * 150], d < 0 ? SC_S : SC_N, 'skirmish', { silent: true });
      }
      scArmy(s, 'blk', 1, 'human', { spear: 24, archer: 16 }, [800, 0], SC_W, "phalanx", { trench: true });
    },
    script: [
      { id: 'march', when: s => s.t > 40, run: s => { for (const id of ['l1', 'l2', 'l3']) s.move(id, s.road); },
        say: ['🌧', "Lejyonlar yağmurun altında uzun bir kol halinde ormana girdi. Ağaçların arasında hiçbir şey kıpırdamıyor..."] },
      { id: 'spring', need: ['march'], when: s => s.rel('l2').x > -330 || ["l1", 'l2', 'l3'].some(id => s.fought(id) > 0 && s.rel(id).x < 600), run: s => {

        for (const id of ['aa1', 'aa2', "aa3", 'aa4']) if (s.ok(id)) s.A[id].order.silent = false;
        const hit = (id, foe) => { const c = s.ctr(foe); s.attack(id, [c], foe); };
        for (const id of ['am1', 'am2', 'am3', 'am4']) s.form(id, 'horde');
        hit('am1', 'l2'); hit('am2', 'l2'); hit('am3', 'l1'); hit('am4', 'l1');
        for (const [id, f] of [['l1', 'squares'], ['l2', 'schiltron'], ['l3', 'squares']]) { const c = s.rel(id); s.hold(id, [c.x, c.y], SC_E); s.form(id, f); }
      }, say: ['🌲', 'PUSU! Yol kenarındaki ağaçlardan oklar yağıyor, ormanın derinliklerinden savaşçılar fırladı. Lejyonlar yolun ortasında kalkanlarını kaldırıp kapanıyor!'] },
      { id: 'flee', need: ['spring'], when: s => s.lost('l3') > 0.3 || s.since('spring') > 700, run: s => { s.move('l3', [[-1450, 40]]); s.free('am2', 'l3'); },
        say: ['🏇', 'Arka koldaki süvariler kaçmaya çalışıyor; kabileler geri dönüp peşlerine düştü.'] },
      { id: "break", need: ['spring'], when: s => s.since('spring') > 900, run: s => s.attack('l1', [[600, 15], [790, 0]], 'blk'),
        say: ['🚩', 'Öncü lejyon yolu açmak için ileri atıldı: hedef yolun sonundaki barikat!'] },
    ],
  },
  {
    name: 'Sahte Ricat', sub: 'Tepede kalkan duvarı, yalancı kaçış',
    desc: 'Ak Tepe Beyliği uzun bir tepenin üstünde kalkan duvarı kurdu. Deniz Aşırı Dükalık yokuşa saldıracak; kıramazsa kaçar gibi yapıp tepedekileri aşağı çekmeyi deneyecek.',
    sides: [{ name: 'Ak Tepe Beyliği', race: 'human', tech: 1, color: '#2a9d8f' }, { name: "Deniz Aşırı Dükalık", race: 'human', tech: 2 }],
    map: [
      ['hill', 260, 0, 200, 430], ['forest', 720, 0, 220, 520],
      ['river', [[-1800, 650], [-300, 560], [200, 610], [1800, 640]], 22], ['lake', -700, -430, 120, 70],
    ],
    cam: [-150, 0, 0.6],
    plan: [
      { lead: 'core', text: 'Tepenin üstünde kalkan duvarı kuracağız. Ne olursa olsun yokuştan inmeyeceğiz; bırakın onlar tırmansın.',
        orders: { fyrd: ['sağ kanat köylüleri', 'Tepeden inmeyin. Düşman kaçsa bile peşine düşmeyin!'], fyrd2: ['sol kanat köylüleri', 'Tepeden inmeyin, yerinizi tutun.'],
          tarc: ['okçular', 'Duvarın arkasından yokuşa ok yağdırın.'] } },
      { lead: 'inf', text: 'Okçular önce duvarı yıpratacak, ardından piyade yokuşa saldıracak. Kıramazsak kaçar gibi yapıp tepedekileri aşağı çekeceğiz; süvari inenleri yandan biçecek.',
        orders: { arc: ['okçular', 'Tepenin eteğine dizilin, kalkan duvarına ok yağdırın.'], cav: ['süvari', 'Güneyde bekleyin. Tepeden inen olursa yanına çullanın.'] } },
    ],
    setup(s) {
      scArmy(s, 'core', 0, "human", { shield: 40, soldier: 20 }, [150, -30], SC_W, 'shieldwall');
      scArmy(s, 'fyrd', 0, 'human', { soldier: 45 }, [160, 190], SC_W, 'line');
      scArmy(s, 'fyrd2', 0, 'human', { soldier: 40 }, [160, -250], SC_W, "line");
      scArmy(s, 'tarc', 0, 'human', { archer: 12 }, [215, -30], SC_W, 'horde');
      scArmy(s, 'arc', 1, 'human', { archer: 36 }, [-350, 0], SC_E, 'horde');
      scArmy(s, 'inf', 1, "human", { soldier: 50, spear: 16 }, [-460, -30], SC_E, 'line');
      scArmy(s, 'cav', 1, 'human', { cavalry: 44 }, [-520, 260], SC_E, 'wedge');
    },
    script: [
      { id: 'volley', when: s => s.t > 60, run: s => s.move('arc', [[40, 0]]),
        say: ['🏹', 'Dükalık okçuları tepenin eteğine dizildi; kalkan duvarına ok yağmuru başlıyor.'] },
      { id: 'assault', when: s => s.t > 450, run: s => s.attack('inf', [[-100, -30], [120, -30]], 'core'),
        say: ['⚔️', 'Dükalık piyadesi yokuşa saldırıyor. Kalkan duvarı bir adım bile geri gitmiyor!'] },
      { id: 'feint', need: ['assault'], when: s => s.fought('inf') > 450 || s.lost("inf") > 0.35, run: s => { s.feint("inf", [-430, 170]); s.free('fyrd', 'inf'); },
        say: ["🏃", 'Dükalık piyadesi dağılıp kaçıyor! Sağ kanattaki köylüler sevinçle peşlerine atıldı... ve tepeden indiler.'] },
      { id: 'trap', need: ['feint'], when: s => s.rel('fyrd').x < 40 || s.since('feint') > 450, run: s => { const c = s.rel("fyrd"); s.attack("cav", [[c.x - 60, c.y + 120]], 'fyrd'); },
        say: ['🐎', 'Bu bir tuzaktı! Dükalık süvarisi tepeden inen köylülerin yanına çullandı, kaçan piyade de dönüp saldırıyor.'] },
      { id: 'final', need: ['trap'], when: s => !s.ok('fyrd') || s.since('trap') > 650, run: s => {
        s.attack('inf', [[120, -30]], "core"); s.attack('cav', [[-60, -380], [220, -380], [330, -120]], 'core'); s.attack('arc', [[60, -10]], 'core');
      }, say: ['🚩', 'Son hücum: süvari tepeyi kuzeyden dolanıp arkaya iniyor, piyade yeniden yokuşta!'] },
    ],
  },
  {
    name: 'Kirpi Halkaları', sub: 'Mızrak halkası, süvari, ok',
    desc: 'Dağ Klanları mızraklarını dışa çevirip üç kirpi halkası kurdu. Kral süvarisi bu halkaları kırmaya çalışacak; kıramazsa sıra okçulara gelecek.',
    sides: [{ name: 'Dağ Klanları', race: "human", tech: 1, color: '#2a9d8f' }, { name: 'Kral Ordusu', race: 'human', tech: 2 }],
    map: [
      ['lake', -60, 0, 90, 150], ["forest", 640, 0, 200, 420], ['forest', -900, -500, 200, 120], ['hill', -700, 350, 140, 90],
    ],
    cam: [-190, 0, 0.58],
    plan: [
      { lead: 'c2', text: 'Mızrakları dışa çevirip üç kirpi halkası kuracağız. Halkalar birbirini kollayacak, kimse halkadan çıkmayacak.',
        orders: { c1: ['kuzey halkası', 'Mızrakları dışa çevirin, ne olursa olsun halkayı bozmayın.'], c3: ['güney halkası', 'Mızrakları dışa çevirin, ne olursa olsun halkayı bozmayın.'],
          ccav: ["süvari", 'Halkaların arkasında yedekte bekleyin.'] } },
      { lead: 'kinf', text: 'Önce süvari bataklığın iki yanından dolanıp halkalara çarpacak. Kıramazsa okçular öne çıkıp halkaları delik deşik edecek; son hücumu hep birlikte yapacağız.',
        orders: { k1: ['kuzey süvarisi', 'Bataklığın kuzeyinden dolanıp kuzey halkasına çarpın.'], k2: ['güney süvarisi', 'Bataklığın güneyinden dolanıp güney halkasına çarpın.'],
          ka1: ["kuzey okçuları", 'Süvari çekilince bataklığı dolanıp halkalara ok yağdırın.'], ka2: ['güney okçuları', 'Süvari çekilince bataklığı dolanıp halkalara ok yağdırın.'] } },
    ],
    setup(s) {
      scArmy(s, 'c1', 0, 'human', { spear: 44, archer: 6 }, [190, -230], SC_W, 'schiltron');
      scArmy(s, 'c2', 0, 'human', { spear: 44, archer: 6 }, [240, 0], SC_W, 'schiltron');
      scArmy(s, 'c3', 0, 'human', { spear: 44, archer: 6 }, [190, 230], SC_W, 'schiltron');
      scArmy(s, 'ccav', 0, 'human', { cavalry: 16 }, [430, 0], SC_W, 'wedge');
      scArmy(s, 'k1', 1, 'human', { cavalry: 36 }, [-480, -270], SC_E, 'wedge');

      scArmy(s, 'k2', 1, 'human', { cavalry: 36 }, [-480, 270], SC_E, 'wedge')
      scArmy(s, 'ka1', 1, 'human', { archer: 36 }, [-660, -90], SC_E, 'horde');
      scArmy(s, 'ka2', 1, 'human', { archer: 36 }, [-660, 90], SC_E, 'horde')
      scArmy(s, 'kinf', 1, 'human', { soldier: 44, shield: 12 }, [-800, 0], SC_E, 'line');
    },
    script: [
      { id: 'flee', when: s => s.t > 100, run: s => s.move("ccav", [[900, -120]]),
        say: ['🐴', 'Klanların süvarisi daha savaş başlamadan atlarını mahmuzlayıp kaçtı! Mızrakçılar yalnız.'] },
      { id: 'charge', when: s => s.t > 140, run: s => { s.attack('k1', [[-200, -340], [110, -260]], 'c1'); s.attack('k2', [[-200, 340], [110, 260]], 'c3'); },
        say: ['🐎', 'Kral süvarisi bataklığın iki yanından dolanıp kirpi halkalarına çarpıyor!'] },
      { id: 'regroup', need: ['charge'], when: s => s.lost('k1') + s.lost('k2') > 0.35 || s.since('charge') > 550, run: s => { s.move('k1', [[-380, -330]]); s.move('k2', [[-380, 330]]); },
        say: ['🦔', "Mızrak duvarı kırılmadı; atlar mızraklara saplandı, süvari ağır kayıpla geri çekiliyor."] },
      { id: "arrows", need: ['regroup'], when: s => s.since('regroup') > 60, run: s => { s.move('ka1', [[-300, -260], [20, -330], [150, -205]]); s.move('ka2', [[-300, 260], [20, 330], [150, 205]]); },
        say: ['🏹', 'Okçular bataklığı iki yandan dolanıp öne çıktı: sıkışık halkalara ok yağmuru!'] },
      { id: "final", need: ['arrows'], when: s => ['c1', 'c3'].some(id => s.lost(id) > 0.4) || s.since('arrows') > 1100, run: s => {

        s.attack('k1', [[110, -260]], 'c1'); s.attack('k2', [[110, 260]], 'c3'); s.attack('kinf', [[-300, -200], [40, -160], [200, -30]], 'c2');
      }, say: ['⚔️', 'Delik deşik olan halkalara son hücum: süvari kanatlardan, piyade ortadan!'] },
    ],
  },
  {
    name: 'Turan Taktiği', sub: 'Kaçar gibi yapıp kuşatma',
    desc: 'Bozkır Hanlığının bir avuç atlısı Demir Tarikat şövalyelerine sataşıp kaçacak. Şövalyeler peşlerine düşüp iki ormanın arasındaki vadiye girince tuzak kapanacak.',
    sides: [{ name: "Bozkır Hanlığı", race: 'human', tech: 2, color: '#f4c430' }, { name: "Demir Tarikat", race: 'human', tech: 3, color: '#9aa4b2' }],
    map: [
      ['forest', 120, -270, 170, 160], ['forest', 120, 270, 170, 160], ['hill', 540, 0, 120, 210], ['forest', -1200, -500, 220, 160],
    ],
    cam: [-170, 0, 0.48],
    plan: [
      { lead: 'tn', text: 'Bir avuç atlı şövalyelere sataşıp kaçacak, onları iki ormanın arasındaki vadiye çekecek. Vadiye girdikleri an ormanlardan oklar yağacak, tepenin ardındaki ana ordu çıkıp çemberi kapatacak.',
        orders: { bait: ['yem atlılar', "Şövalyelere ok atıp sataşın; peşinize düşünce vadiye kaçın, vadide dönüp vurun."], ts: ['güney ormanı okçuları', 'Ormanda sessiz bekleyin. Şövalyeler vadiye girince ok yağdırın.'],
          main: ['ana ordu', "Tepenin ardında bekleyin; şövalyeler vadiye girince çıkıp çemberi kapatın."] } },
      { lead: 'ft', text: 'Atlı şövalyeler önden gidecek, yaya şövalyeler arkadan gelecek. Bozkır atlıları kaçarsa peşlerini bırakmayacağız.',
        orders: { kn: ['atlı şövalyeler', 'Bozkır atlılarını görürseniz peşlerine düşün, kaçmalarına izin vermeyin.'] } },
    ],
    setup(s) {

      scArmy(s, "bait", 0, 'human', { cavalry: 26 }, [-380, 0], SC_W, 'wedge');
      scArmy(s, 'tn', 0, 'human', { archer: 28, soldier: 10 }, [120, -260], SC_S, 'horde', { silent: true });
      scArmy(s, "ts", 0, "human", { archer: 28, soldier: 10 }, [120, 260], SC_N, 'horde', { silent: true });
      scArmy(s, 'main', 0, 'human', { cavalry: 44 }, [700, 0], SC_W, "wedge");
      scArmy(s, 'kn', 1, 'human', { cavalry: 46 }, [-820, 0], SC_E, "wedge");
      scArmy(s, 'ft', 1, 'human', { soldier: 44, shield: 16 }, [-1020, 0], SC_E, 'line');
    },
    script: [
      { id: 'tease', when: s => s.t > 60, run: s => s.attack('bait', [[-640, 0]], "kn"),
        say: ['🏹', 'Bozkır atlıları şövalyelere yaklaşıp ok atıyor, alay ediyor...'] },
      { id: 'flee', need: ['tease'], when: s => s.d('bait', 'kn') < 220 || s.fought("bait") > 30 || s.since('tease') > 500, run: s => {
        s.feint("bait", [380, 0]); s.free('kn', 'bait'); s.attack('ft', [[-400, 0], [-60, 0]], 'bait');
      }, say: ["🏃", 'Atlılar dönüp kaçıyor! Şövalyeler zafer çığlıklarıyla peşlerinde, yaya şövalyeler de arkadan geliyor.'] },
      { id: 'trap', need: ['flee'], when: s => s.rel('kn').x > 30, run: s => {
        const c = s.rel('kn');
        s.attack('tn', [[c.x + 40, c.y - 40]], 'kn'); s.attack('ts', [[c.x + 40, c.y + 40]], 'kn'); s.attack('main', [[300, 0]], 'kn');
        s.free('bait', 'kn'); s.fury("bait");
      }, say: ['🌪', 'TURAN! İki ormandan oklar yağıyor, kaçan atlılar birden döndü, tepenin ardından ana ordu çıktı: şövalyeler çembere düştü!'] },
      { id: 'foot', need: ['trap'], when: s => !s.ok('kn') || s.since('trap') > 700, run: s => { for (const id of ['bait', 'main', 'tn', 'ts']) s.free(id, 'ft'); },
        say: ['⚔️', 'Atlı şövalyeler dağıldı; sıra geride kalan yaya şövalyelerde.'] },
    ],
  },
  {
    name: 'Verev Düzen', sub: 'Güçlü kanatla yarma',
    desc: 'Kara Sancak bütün gücünü sol kanadına yığdı: derin bir mızrak kolu Tunç Kalkanların seçkin kanadına verev yürüyecek, zayıf merkez ve sağ kanat geride oyalayacak.',
    sides: [{ name: 'Kara Sancak', race: 'human', tech: 1 }, { name: 'Tunç Kalkanlar', race: 'human', tech: 2 }],
    map: [["forest", 0, -760, 500, 140], ['hill', -700, 380, 160, 90], ['hill', 700, 420, 150, 80]],
    cam: [-130, -80, 0.58],
    plan: [
      { lead: 'mid', text: "Bütün gücümüz sol kanatta: derin mızrak kolu düşmanın seçkin kanadına verev yürüyecek. Merkez ve sağ kanat geride kalıp oyalayacak, üstlerine gelinirse geri çekilecek.",
        orders: { col: ["mızrak kolu", 'Verev yürüyün; seçkin kanadı ezin, sonra güneye dönüp hattı yandan dürün.'], rgt: ['sağ kanat', 'Geride durun. Üstünüze gelirlerse geri geri çekilip oyalayın.'],
          tcav: ['süvari', 'Kuzeydeki atlılarını bağlayın, kolun yanını açık bırakmayın.'] } },
      { lead: 'smid', text: 'Seçkin kanat kalkan duvarıyla yerini tutacak; merkez ve sol kanat ileri yürüyüp karşılarındakini ezecek.',
        orders: { elite: ['seçkin kanat', 'Kalkan duvarını bozmayın, gelen kolu yerinde karşılayın.'], slft: ['sol kanat', 'Merkezle birlikte ileri yürüyüp karşınızdakini ezin.'],
          scav: ["süvari", "Kuzeydeki atlılarını dağıtın."] } },
    ],
    setup(s) {
      scArmy(s, 'col', 0, "human", { shield: 30, spear: 80 }, [-260, -220], SC_E, 'phalanx');
      scArmy(s, 'mid', 0, "human", { soldier: 32 }, [-420, 30], SC_E, 'line');
      scArmy(s, 'rgt', 0, 'human', { soldier: 32 }, [-560, 270], SC_E, 'line');
      scArmy(s, 'tcav', 0, 'human', { cavalry: 26 }, [-220, -450], SC_E, 'wedge');
      scArmy(s, 'elite', 1, 'human', { shield: 40, spear: 20 }, [260, -220], SC_W, 'shieldwall');
      scArmy(s, "smid", 1, 'human', { soldier: 45 }, [260, 40], SC_W, 'line');
       scArmy(s, 'slft', 1, 'human', { soldier: 45 }, [260, 280], SC_W, 'line');
      scArmy(s, 'scav', 1, 'human', { cavalry: 20 }, [300, -460], SC_W, 'wedge');
    },
    script: [
      { id: 'cav', when: s => s.t > 60, run: s => { s.attack('tcav', [[40, -460]], 'scav'); s.attack('scav', [[-40, -460]], 'tcav'); },
        say: ["🐎", 'Kuzeyde süvariler çarpışıyor. Ana hatlar birbirini kolluyor...'] },
      { id: 'col', when: s => s.t > 220, run: s => s.attack('col', [[0, -220], [230, -220]], "elite"),
        say: ['🗡', 'Kara Sancak\'ın derin mızrak kolu verev yürüyor: hedef Tunç Kalkanların seçkin sağ kanadı! Merkez ve sağ kanat bilerek geride.'] },
      { id: 'sadv', when: s => s.t > 500, run: s => { s.attack("smid", [[-200, 40]], 'mid'); s.attack('slft', [[-320, 280]], 'rgt'); },
        say: ['⚔️', 'Tunç Kalkanlar merkezde ilerliyor; Kara Sancak\'ın zayıf kanatları geri geri çekilip oyalıyor.'] },
      { id: 'refuse', need: ['sadv'], when: s => s.d("smid", 'mid') < 220 || s.d("slft", 'rgt') < 220, run: s => { s.feint("mid", [-640, 40]); s.feint("rgt", [-780, 280]); } },
      { id: 'roll', when: s => !s.ok('elite') || s.lost('elite') > 0.6, run: s => {
        s.attack('col', [[200, -60]], "smid"); s.free('tcav', 'smid');
      }, say: ['💥', 'Seçkin kanat çöktü! Kara Sancak kolu güneye dönüp düşman hattını yandan dürüyor.'] },
    ],
  },
  {
    name: 'Merkez Yarma', sub: 'Tepe boşalınca yarma',
    desc: 'Üç Taç İttifakı, Gölge Kartalının zayıf bıraktığı güney kanadına yüklenecek. Merkezdeki platoyu boşalttıkları an, ormanda sisin içinde saklanan yedekler ortadan yarıp geçecek.',
    sides: [{ name: 'Gölge Kartalı', race: 'human', tech: 2 }, { name: 'Üç Taç İttifakı', race: 'human', tech: 2 }],
    season: 3,
    map: [
      ['hill', 60, -20, 230, 180],
      ['river', [[-300, -1300], [-280, -500], [-320, 0], [-260, 500], [-300, 1300]], 16],
      ['ford', -305, -420, 34, 45], ['ford', -320, 0, 34, 70], ['ford', -265, 400, 34, 55],
      ['lake', 200, 560, 170, 70], ['lake', -60, 640, 120, 55],
      ['forest', -620, 0, 150, 210], ['forest', 700, -500, 200, 140],
    ],
    cam: [-140, 40, 0.5],
    plan: [
      { lead: 'res', text: "Güney ve kuzey kanatlar derenin önünde hendeklerinde tutacak. Yedekler ormanda sisin içinde gizlenecek; düşman platoyu boşalttığı an ortadan yarıp geçeceğiz.",
        orders: { fr: ['güney kanadı', 'Derenin önünde hendek kazıp tutun, geri adım yok.'], fl: ['kuzey kanadı', 'Derenin önünde hendek kazıp tutun, geri adım yok.'],
          fcav: ['süvari', 'Yedekler platoya çıkınca kuzeyden dolanıp atlılarını bağlayın.'], grd: ['muhafızlar', 'Geride bekleyin; onların muhafızları kıpırdarsa karşılayın.'] } },
      { lead: 'agd', text: 'Gölge Kartalının zayıf güney kanadına yükleneceğiz; kuzeyde de bir ordu dereyi geçmeye çalışacak. Plato güneyde yardım gerekirse inecek.',
        orders: { a1: ['birinci ordu', 'Güneydeki geçitten geçip sağ kanatlarına yüklenin.'], a2: ['ikinci ordu', "Güneydeki geçitten geçip sağ kanatlarına yüklenin."],
          a3: ['plato ordusu', 'Platoyu tutun; güneyde yardım gerekirse inin.'], a4: ['kuzey ordusu', 'Kuzeydeki geçitten dereyi geçmeye çalışın.'], acav: ['süvari', 'Platonun arkasında bekleyin.'] } },
    ],
    setup(s) {
      scArmy(s, 'fr', 0, 'human', { soldier: 36, shield: 10 }, [-360, 400], SC_E, 'line', { trench: true });
      scArmy(s, "fl", 0, 'human', { soldier: 36, shield: 10 }, [-370, -420], SC_E, 'line', { trench: true });
      scArmy(s, 'res', 0, 'human', { soldier: 76, shield: 24 }, [-580, 0], SC_E, 'wedge', { silent: true });
      scArmy(s, 'fcav', 0, "human", { cavalry: 34 }, [-620, -280], SC_E, 'wedge');
      scArmy(s, "grd", 0, 'human', { shield: 30 }, [-800, 0], SC_E, "shieldwall");
      scArmy(s, 'a1', 1, "human", { soldier: 55 }, [180, 260], SC_W, 'line');
      scArmy(s, 'a2', 1, 'human', { soldier: 55 }, [320, 390], SC_W, 'line');
      scArmy(s, 'a3', 1, 'human', { soldier: 45, archer: 12 }, [70, -40], SC_W, "line");
      scArmy(s, 'a4', 1, 'human', { soldier: 40 }, [160, -390], SC_W, 'line');
      scArmy(s, 'acav', 1, 'human', { cavalry: 26 }, [430, -140], SC_W, 'wedge');
      scArmy(s, "agd", 1, 'human', { shield: 30 }, [520, 40], SC_W, 'shieldwall')

    },
    script: [
      { id: 'south', when: s => s.t > 60, run: s => {
        s.attack('a1', [[-140, 360], [-265, 400], [-340, 400]], 'fr'); s.attack('a2', [[-90, 430], [-265, 410], [-350, 410]], 'fr');

        s.attack('a4', [[-180, -410], [-305, -420], [-370, -420]], "fl");
      }, say: ['⚔️', 'İttifak orduları güneyde Gölge Kartalının zayıf sağ kanadına yükleniyor; kuzeyde de bir ordu dereyi geçmeye çalışıyor.'] },
      { id: 'leave', when: s => s.t > 380, run: s => s.attack('a3', [[150, 220], [-120, 390], [-300, 400]], 'fr'),
        say: ['👀', 'Platodaki ordu da güneydeki savaşa koşuyor: tepe boşaldı!'] },
      { id: 'sun', need: ['leave'], when: s => s.rel('a3').y > 230 || s.since('leave') > 500, run: s => {
        s.attack('res', [[-320, 0], [-120, -10], [80, -20]], 'a3'); s.attack('fcav', [[-310, -160], [150, -160]], "acav");
      }, say: ['🌅', 'Güneş sisi deldi! Ormanda saklanan Gölge Kartalı yedekleri kama düzeninde platoya tırmanıyor: ittifakın merkezi ikiye bölünüyor!'] },
      { id: "guard", need: ['sun'], when: s => s.d('res', 'agd') < 380 || s.since('sun') > 450, run: s => { s.free("agd", "res"); s.free('acav', 'fcav'); s.attack('grd', [[-320, 0], [100, 0]], 'agd'); },
        say: ['🛡', 'İttifakın muhafızları karşı saldırıya geçti; Kartalın muhafızları da dereyi geçip yetişiyor.'] },
      { id: 'trap', need: ['sun'], when: s => s.since('sun') > 950, run: s => s.free('res', "a2"),
        say: ['❄️', 'Kartal güneye dönüyor: ittifak orduları donmuş göllere sıkıştı!'] },
    ],
  },
  {
    name: 'Kazıklı Hat', sub: 'Okçular, kazıklar, dalgalar',
    desc: 'Ada Krallığının okçuları iki ormanın arasındaki daralan ovada, önlerine kazık çakıp dizildi. Zırhlı Dükalar üç dalga halinde, yağmurun çamurlaştırdığı ovadan saldıracak.',
    sides: [{ name: 'Ada Krallığı', race: 'human', tech: 2 }, { name: 'Zırhlı Dükalar', race: 'human', tech: 3 }],
    rain: true, season: 2,
    map: [
      ['forestBand', [[-1100, -560], [-200, -300], [400, -380], [1100, -720]], 170],
      ['forestBand', [[-1100, 560], [-200, 300], [400, 380], [1100, 720]], 170],
    ],
    cam: [230, 0, 0.55],
    plan: [
      { lead: 'res', text: 'Okçular kazıkların arkasından üç dalgayı da oklayacak, kalkanlılar ortayı tutacak. Düşman çamura saplanınca okçular balta ve tokmakla inecek.',
        orders: { ctr: ['kalkanlılar', 'Ortayı tutun, kazıkların arasından geçeni karşılayın.'], al: ['sol okçular', 'Kazıkların arkasından ok yağdırın; zırhlılar sıkışınca baltalarla inin.'],
          ar: ['sağ okçular', 'Kazıkların arkasından ok yağdırın; zırhlılar sıkışınca baltalarla inin.'] } },
      { lead: 'w2', text: 'Üç dalga halinde saldıracağız: önce zırhlı süvari, sonra ağır piyade, en son yedekler.',
        orders: { w1: ['zırhlı süvari', 'İlk dalga sizsiniz: çamuru umursamadan hücuma kalkın.'], w3: ['üçüncü dalga', 'İkinci dalga takılırsa siz yüklenin.'] } },
    ],
    setup(s) {

      scArmy(s, 'ctr', 0, "human", { shield: 30, soldier: 16 }, [-240, 0], SC_E, 'shieldwall');
       scArmy(s, "al", 0, 'human', { archer: 40 }, [-180, -88], SC_E, 'horde');
      scArmy(s, 'ar', 0, 'human', { archer: 40 }, [-180, 88], SC_E, 'horde');
      scArmy(s, 'res', 0, 'human', { soldier: 20, medic: 4 }, [-380, 0], SC_E, 'line');
       const st = [];
      for (let y = -125; y <= 125; y += 20) if (Math.abs(y) > 30) st.push(['stakes', -150 + (Math.abs(y) % 40 ? 8 : 0), y]);
      st.push(['pit', -100, -60], ['pit', -95, 55], ['pit', -110, 5], ['pit', -90, -110], ['pit', -105, 105]);
      scTraps(s, 0, st);
      scArmy(s, 'w1', 1, 'human', { cavalry: 50 }, [460, 0], SC_W, 'wedge');
      scArmy(s, "w2", 1, 'human', { shield: 60, soldier: 20 }, [660, 0], SC_W, "line");
      scArmy(s, "w3", 1, 'human', { soldier: 50, archer: 20 }, [860, 0], SC_W, 'line');
    },
    script: [
      { id: 'w1', when: s => s.t > 80, run: s => s.attack('w1', [[100, 0], [-150, 0]], 'ctr'),
        say: ['🐎', "Zırhlı süvari çamurlu ovada hücuma kalktı! Ada okçuları yaylarını gerdi..."] },
      { id: 'w2', need: ['w1'], when: s => s.fought('w1') > 220 || s.lost('w1') > 0.4 || s.since('w1') > 1000, run: s => s.attack('w2', [[200, 0], [-150, 0]], 'ctr'),
        say: ["⛓", 'İkinci dalga: ağır zırhlı piyade çamura bata çıka ilerliyor; ok yağmuru altında saflar birbirine sıkışıyor.'] },
      { id: "axes", need: ['w2'], when: s => s.fought('w2') > 260 || s.lost('w2') > 0.35, run: s => { s.free('al', "w2"); s.free('ar', 'w2'); },
        say: ['🪓', "Okçular yaylarını bırakıp balta ve tokmaklarla sıkışmış zırhlıların üstüne atıldı!"] },
      { id: 'w3', need: ['w2'], when: s => s.lost('w2') > 0.55 || s.since("w2") > 1200, run: s => s.attack('w3', [[200, 0], [-150, 0]], 'ctr'),
        say: ['📯', 'Üçüncü dalga isteksizce ilerliyor; önlerindeki ova ölü ve yaralılarla dolu.'] },
    ],
  },
];

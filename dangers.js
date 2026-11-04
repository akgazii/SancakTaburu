const DISEASES=['Kara Öksürük', 'Kızıl Humma', 'Çürük Ateşi', "Gri Veba", 'Titreme Hastalığı', 'Bataklık Sıtması', 'Kemik Ağrısı'];

function infect(p, d)
{
  if (p.sick || p.dead || (p.immune || 0) > year()) return;
  p.sick = { d, t: rnd(250, 500) | 0, sev: rnd(0.6, 1.6) };
  d.cases++;
}

function outbreak(s) {
  const sonuc=Sim.people.filter(p => p.s === s && !p.dead);
  if (!sonuc.length) return null;
  const d = { name: pick(DISEASES), cases: 0, deaths: 0, start: year(), s0: s.name, k: s.k, over: false };
  Sim.diseases.push(d);
  for (let i = 0; i < Math.min(3, sonuc.length); i++) infect(pick(sonuc), d);
  chron(lang`🦠 ${s.name} şehrinde bulaşıcı bir hastalık baş gösterdi: ${d.name}!`, s.k, null, s);
  return d;
}

function sickTick(p, g) {

  const S = p.sick, frail = (p.age / p.life > 0.7 ? 2 : 1) * (isAdult(p) ? 1 : 1.4);

  S.t -= 5;
  p.hp -= 0.32 * S.sev * frail * (1.4 - p.stats.end * 0.08);

  if (p.hp <= 0) { S.d.deaths++; kill(p, null, S.d.name); return; }
  if (Math.random() < 0.5) near(g, p.x, p.y, 10, q => { if (q !== p && !q.sick && !q.dead && Math.random() < 0.015) infect(q, S.d); });

  if (S.t<=0) { p.sick=null; p.immune = year() + 30; plog(p, lang`${S.d.name} hastalığını atlattı`); say(p, '😮‍💨', 90); }
  else if (Math.random() < 0.012) say(p, pick(['🤒', '🤧', '🤢']));
}

function healJob(p) {
  const s = p.s;
  if (p.sub==='heal') {
    const q = p.patient;
    if (!q || q.dead || !q.sick) { p.sub=null; p.patient = null; return; }
    if (dist2(p, q)>7 * 7) { moveTo(p, q.x, q.y, 1.1); return; }
    p.a = Math.atan2(q.y - p.y, q.x - p.x);
    if (--p.timer > 0) return;
    if (Math.random() < 0.45 + p.stats.int * 0.04 + (s.temple ? 0.1 : 0)) {
      plog(q, lang`şifacı ${fullName(p)} tarafından iyileştirildi`); plog(p, lang`${fullName(q)} adlı hastayı iyileştirdi`);
      q.sick = null; q.immune = year() + 30; q.hp = Math.max(q.hp, q.maxHp * 0.5);
      say(q, '😊'); say(p, '💊');
      p.cured = (p.cured || 0) + 1;
    } else say(p, "😔");
    q.healer=null; p.sub = null; p.patient = null;

    return;
  }
  if ((Sim.tick + p.id) % 20===0) {
    let q = null, bd = (s.r + 90) ** 2;
    for (const o of Sim.people) if (o.sick && !o.dead && !o.healer && o.s === s) { const d = dist2(o, s); if (d<bd) { bd = d; q = o; } }
    if (q) { q.healer = p; p.patient=q; p.sub="heal"; p.timer = 50; return; }
  }
  gather(p, "food");
}

const CAMP_A = ['Kara', 'Kızıl', 'Kurt', 'Yılan', 'Gölge', 'Tilki', 'Akrep', 'Kuzgun'];
const CAMP_B = ['Çetesi', 'Eşkıyaları', 'Haydutları', 'Kardeşliği'];

function spawnCamp() {
  for (let i = 0; i < 300; i++) {
    const c = rnd(5, CFG.cols - 5) | 0, r = rnd(5, CFG.rows - 5) | 0, t = Sim.terrain[r * CFG.cols + c];
    if (t !== T_FOREST && t !== T_HILLS) continue;
    const x = (c + 0.5) * CFG.tile, y=(r + 0.5) * CFG.tile;
    const nd = Sim.settlements.length ? Math.min(...Sim.settlements.map(s => dist({ x, y }, s))) : 400;
    if (nd < 240 || nd > 650) continue;
    return makeCamp(x, y);
  }
  return null;
}
function makeCamp(x, y)
{
  const kamp = { id: Sim.nextMon++, x, y, name: lang`${pick(CAMP_A)} ${pick(CAMP_B)}`, gold: 0, robs: 0, dead: false, founded: year() };
  Sim.camps.push(kamp);
  const n = rnd(4, 7) | 0;

  for (let j = 0; j < n; j++) addBandit(kamp, x + rnd(-10, 10), y + rnd(-10, 10));
  chron(lang`🏴 Bir haydut çetesi türedi: ${kamp.name}. Yolcular tetikte`);
  return kamp;

}
function addBandit(kamp, x, y, from) {
  const R = from ? from.R : RACE_DB[pick(['human', 'orc', 'goblin', 'halforc', "human"])];
  return makeMonster("bandit", x, y, { camp: kamp, lair: kamp, name: from ? fullName(from) : makeName(R.names) + ' ' + pick([lang('Kanlı'), lang('Tek Göz'), lang('Sinsi'), lang('Çolak'), lang('Kara'), lang('Yaralı')]),
    skin: from ? from.skin : R.skin, size: R.size, ears: R.ears, extra: R.extra, stole: 0 });
}

function maybeOutlaw(q)
{
  if (q.stats.agg < 6 || Math.random() > 0.25) return false;
  const camps = Sim.camps.filter(c => !c.dead && dist2(c, q) < 900 * 900);
  if (!camps.length) return false;
  const c = camps.reduce((a, b) => dist2(a, q) < dist2(b, q) ? a : b);
  addBandit(c, q.x, q.y, q);
  slog(q.jailAt, lang`🏴 ${fullName(q)} hapisten çıkınca ormana kaçıp ${c.name} çetesine katıldı`);
  plog(q, lang`kanun kaçağı olup ${c.name} çetesine katıldı`);
  q.dead = true; q.deathYear = year(); q.cause = lang('kanun kaçağı oldu');
  if (q.spouse && q.spouse.spouse === q) q.spouse.spouse = null;
  return true;
}

function banditAI(m) {
  const c = m.camp;
  if (m.cool>0) m.cool--;
  const f = m.prey;
  if (f && !f.dead && f.state !== 'jailed' && (Sim.arena || (dist2(m, f) < 150 * 150 && dist2(m, c) < 420 * 420))) {
    if (dist2(m, f)>36) { monStep(m, f.x, f.y, 1.15); return; }
    if ((Sim.tick + m.id) % 25) return;
    if (isFighter(f)) { hurtPerson(m, f, MON.bandit.dmg * rnd(0.6, 1.4), lang('haydut saldırısı')); return; }
    const amt = Math.floor(f.gold * 0.6) + (f.job === 'merchant' ? 15 : 0);
    f.gold = Math.max(0, f.gold - amt); c.gold += amt; m.stole += amt; c.robs++;
    if (f.job === 'merchant') f.k.gold = Math.max(0, f.k.gold - 10);
     f.hp = Math.max(1, f.hp - 5); f.flee = 150; say(f, '😱', 100);
    plog(f, lang`${c.name} haydutları tarafından soyuldu (${amt} altın)`);
    if (f.s && !f.s.dead) slog(f.s, lang`🏴 ${fullName(f)} yolda ${c.name} haydutları tarafından soyuldu (${amt} altın)`);
    m.prey = null; m.cool=250;
    return;
  }
  m.prey = null;
  if (Sim.arena) { if (!m.cool && (Sim.tick + m.id) % 30 === 0) m.prey = arenaPrey(m, ARENA_HUNT); if (m.prey) return; }
  else if (!m.cool && (Sim.tick + m.id) % 30 === 0 && Sim.grid) {
    let fd = 110 * 110;
    near(Sim.grid, m.x, m.y, 110, q => {
      if (q.dead || q.state || q.army || isFighter(q)) return;

      if (Sim.settlements.some(s => dist2(q, s) < (s.r + 30) ** 2)) return;
      const d=dist2(m, q) * (q.job === 'merchant' ? 0.4 : 1);
      if (d<fd) { fd = d; m.prey = q; }
    });
    if (m.prey) return;
  }
  if (!m.tgt || --m.t < 0 || monStep(m, m.tgt.x, m.tgt.y, 0.5)) {
    const a=rnd(0, 6.28), d = rnd(0, 70);
    m.tgt = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d }; m.t = 300;
  }
}

function banditDown(m, by) {
  const c = m.camp;
  if (by && by.stats) {
    const loot = Math.floor(c.gold / Math.max(1, Sim.monsters.filter(o => o.camp === c && !o.dead).length + 1));
    c.gold -= loot; by.gold += loot + 5;
    by.bandits = (by.bandits || 0) + 1
    plog(by, lang`haydut ${m.name} adlı kişiyi öldürdü`);
  }
  if (Sim.monsters.some(o => o.camp === c && !o.dead)) return;
  c.dead = true;
  const k = by && by.k;
  if (k) k.gold += c.gold;
  chron(lang`⚔️ ${c.name} dağıtıldı!${k ? lang` ${k.name} askerleri kampı bastı, ${c.gold | 0} altınlık ganimet hazineye geçti` : ''}`, k)
}

function sendPosse(c)
{
  const s = Sim.settlements.filter(s => !s.dead).reduce((a, b) => dist2(a, c) < dist2(b, c) ? a : b, Sim.settlements[0]);
  if (!s || dist2(s, c) > 700 * 700) return;
  const adamlar = Sim.people.filter(p => !p.dead && p.s === s && !p.state && !p.posse && isAdult(p) && (isTroop(p) || p.job === 'guard'))
    .sort((a, b) => b.stats.str - a.stats.str).slice(0, 6);

  if (adamlar.length < 3) return;
  for (const p of adamlar) { p.posse = c; p.act = null; plog(p, lang`${c.name} haydutlarına karşı müfrezeye katıldı`); }
  c.posse = year();

  chron(lang`🛡 ${s.k.name}, ${s.name} şehrinden ${adamlar.length} kişilik bir müfrezeyi ${c.name} kampına yolladı`, s.k, null, s);
}
function posseMove(p) {

  const c = p.posse;
  if (c.dead || Sim.wars && [...p.k.rel.values()].some(r => r.status === 'war')) { p.posse = null; return false; }
  if (p.mfoe && !p.mfoe.dead) return false;
  if (dist2(p, c) > 40 * 40) { moveTo(p, c.x, c.y, 1.05); return true; }
  if (!Sim.monsters.some(o => o.camp === c && !o.dead && dist2(o, p) < 200 * 200)) {
    if ((p.posseT = (p.posseT || 0) + 1) > 300) { p.posse = null; p.posseT = 0; }
  }
  return false;
}

function dangersYear() {

  if (year() > 8 && Sim.camps.filter(c => !c.dead).length < 3 && Math.random() < 0.15) spawnCamp();
  for (const c of Sim.camps) if (!c.dead && c.robs >= 3 && year() - (c.posse || -99) > 6) sendPosse(c);
  Sim.camps = Sim.camps.filter(c => !c.dead || year() - c.founded < 1);
  for (const s of Sim.settlements) if (s.pop >= 20 && Math.random() < 0.004 + s.pop * 0.00004) { outbreak(s); break; }
  for (const d of Sim.diseases) if (!d.over && !Sim.people.some(p => p.sick && p.sick.d === d)) {
    d.over = true;
    chron(lang`🦠 ${d.name} salgını sona erdi. ${d.cases} kişi hastalandı, ${d.deaths} kişi öldü`, d.k.dead ? null : d.k);
  }
}

function drawCamp(ctx, c)
{
  ctx.fillStyle = 'rgba(60,45,30,0.35)'; ctx.beginPath(); ctx.arc(c.x, c.y, 22, 0, 7); ctx.fill();
  for (const [dx, dy] of [[-12, -6], [10, -9], [0, 11]]) {
    ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.moveTo(c.x + dx - 7, c.y + dy + 5); ctx.lineTo(c.x + dx, c.y + dy - 6); ctx.lineTo(c.x + dx + 7, c.y + dy + 5); ctx.fill();

    ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.moveTo(c.x + dx - 1.5, c.y + dy + 5); ctx.lineTo(c.x + dx, c.y + dy); ctx.lineTo(c.x + dx + 1.5, c.y + dy + 5); ctx.fill();
  }
  const f = performance.now() / 100;
  ctx.fillStyle = 'rgba(255,120,30,0.85)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 2.5, 3.5 + Math.sin(f), 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(c.x + 16, c.y - 18, 1.2, 12); ctx.fillStyle = '#111'; ctx.fillRect(c.x + 17, c.y - 18, 7, 5);
}

function figOf(p) {
   const cmd = p.army && p.army.cmd === p, wolfy = ['orc', 'goblin', 'halforc'].includes(p.R.base);
  return { skin: p.skin, ears: p.R.ears, extra: p.R.extra, size: p.R.size, ring: p.k.color, female: p.female, helm: AGES[p.k.tech || 0].helm,
    child: !isAdult(p), sick: !!p.sick, job: cmd ? (p.army.ww ? 'cmdW' : p.army.vic ? 'cmdV' : 'cmd') : p.state === 'army' && UNIT_RANK[p.job] == null ? 'soldier' : p.job,
    mount: p.job === 'cavalry' || p.job === 'harcher' ? (wolfy ? 'wolf' : 'horse') : p.job === 'hussar' || p.job === "knight" ? 'horse' : null, horse: HORSES[p.id % HORSES.length],
    gun: (p.k.tech || 0) >= 3, ghost: hiddenIn(p) };
}
const HORSES = ['#7a4a2a', '#5a3a22', "#a0703f", '#3a2a20', '#c9b8a0', '#8a8580'];
const GUN_JOBS = new Set(['artillery', 'fieldgun', 'gatling', 'mg', "mortar", 'rocket']);

function drawFigure(ctx, f, x, y, a, U)
{
  const r = 3.2 * f.size * (f.child ? 0.65 : 1) * U;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (f.ghost) ctx.globalAlpha = 0.3;

  if (f.job === "tank") { drawTank(ctx, f, U); ctx.restore(); return; }
  if (f.duck) {
    ctx.fillStyle = f.job === 'sniper' ? '#56663a' : '#4b5320'; ctx.beginPath(); ctx.arc(-0.35 * r, 0, 0.78 * r, 0, 7); ctx.fill();
    ctx.lineWidth=Math.max(0.6, 0.22 * r); ctx.strokeStyle = f.ring; ctx.stroke();
    ctx.restore(); return;
  }
  if (f.mount) drawMount(ctx, f, U);
  if (GUN_JOBS.has(f.job)) drawGun(ctx, f, U);
  const tri = (p) => { ctx.beginPath(); ctx.moveTo(p[0] * r, p[1] * r); ctx.lineTo(p[2] * r, p[3] * r); ctx.lineTo(p[4] * r, p[5] * r); ctx.fill(); };
  ctx.fillStyle = f.skin;
  if (f.ears!=="none") {
    const L = { small: 1.15, pointy: 1.65, big: 1.95 }[f.ears], Wd = f.ears === 'big' ? 0.5 : 0.3;
    for (const s of [-1, 1]) tri([0.3, s * 0.75, -0.35, s * (0.75 - Wd), -0.75, s * L]);
  }
  if (f.female) { ctx.fillStyle='#3b2a20'; ctx.beginPath(); ctx.arc(-0.8 * r, 0, 0.32 * r, 0, 7); ctx.fill(); }
  if (f.extra === 'snout') {
    ctx.fillStyle = f.skin; ctx.beginPath(); ctx.ellipse(0.8 * r, 0, 0.65 * r, 0.42 * r, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(1.3 * r, -0.15 * r, 0.08 * r, 0, 7); ctx.arc(1.3 * r, 0.15 * r, 0.08 * r, 0, 7); ctx.fill();
  }
  ctx.fillStyle = f.skin;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.lineWidth = Math.max(0.7, 0.28 * r); ctx.strokeStyle = f.ring; ctx.stroke();
  if (f.extra === 'beard') { ctx.fillStyle = '#7a4b2a'; ctx.beginPath(); ctx.arc(0.25 * r, 0, 0.72 * r, -1.15, 1.15); ctx.closePath(); ctx.fill(); }
  if (f.extra === 'tusks') { ctx.fillStyle = '#fffbe8'; for (const s of [-1, 1]) tri([0.65, s * 0.2, 0.65, s * 0.45, 1.2, s * 0.32]); }
  if (f.extra === 'horns') { ctx.fillStyle = '#2e2222'; for (const s of [-1, 1]) tri([0, s * 0.45, -0.45, s * 0.2, -1.05, s * 0.9]); }
  if (f.extra === 'hat') {
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(-0.1 * r, 0, 0.78 * r, 0, 7); ctx.fill();
    ctx.fillStyle = '#8e2a20'; ctx.beginPath(); ctx.arc(-0.3 * r, 0, 0.25 * r, 0, 7); ctx.fill();
  }
   if (f.sick) { ctx.fillStyle = 'rgba(120,190,60,0.45)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, 7); ctx.fill(); }
  const stick = (sutun, uzunluk, taraf) => {
    ctx.strokeStyle=sutun; ctx.lineWidth = Math.max(0.5, 0.18 * r);
    ctx.beginPath(); ctx.moveTo(0.2 * r, taraf * 0.95 * r); ctx.lineTo(uzunluk * r, taraf * 0.95 * r); ctx.stroke();
  };

  const helmet = sutun => { ctx.strokeStyle = sutun; ctx.lineWidth = 0.3 * r; ctx.beginPath(); ctx.arc(0, 0, 0.62 * r, 1.9, 4.4); ctx.stroke(); };
  const wwHelm = () => { ctx.fillStyle = '#4b5320'; ctx.beginPath(); ctx.arc(-0.05 * r, 0, 0.74 * r, 0, 7); ctx.fill(); ctx.strokeStyle = '#2f3414'; ctx.lineWidth = 0.12 * r; ctx.stroke(); };
  switch (f.job) {
    case 'soldier': helmet(f.helm || '#a0a6ad'); stick("#7b5a3a", 2.3, 1); ctx.fillStyle = '#c9d0d6'; tri([2.3, 0.8, 2.3, 1.1, 2.7, 0.95]); break;
    case 'cmd':
      helmet('#d4af37'); stick('#7b5a3a', 2.3, 1);
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 0.15 * r; ctx.beginPath(); ctx.moveTo(-0.5 * r, -0.6 * r); ctx.lineTo(-2.4 * r, -1.3 * r); ctx.stroke();
      ctx.fillStyle = f.ring; ctx.fillRect(-2.4 * r, -1.9 * r, 0.9 * r, 0.6 * r); break;
    case 'guard': helmet('#4f74a0'); stick('#555', 1.9, -1); break;
    case "cavalry": helmet(f.helm || '#a0a6ad'); stick('#7b5a3a', 3.4, 1); ctx.fillStyle = '#c9d0d6'; tri([3.4, 0.82, 3.4, 1.08, 3.9, 0.95]); break;
    case "artillery": helmet('#5a3d22'); break;
    case 'spear':
      helmet(f.helm || '#a0a6ad'); stick('#7b5a3a', 4.6, 1); ctx.fillStyle = '#c9d0d6'; tri([4.6, 0.78, 4.6, 1.12, 5.4, 0.95]); break;
    case 'shield':
      helmet(f.helm || '#a0a6ad'); stick('#9aa0a6', 1.9, 1);
      ctx.fillStyle = f.ring; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth=0.15 * r; ctx.beginPath(); ctx.arc(0.75 * r, -0.95 * r, 0.62 * r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d4c08a'; ctx.beginPath(); ctx.arc(0.75 * r, -0.95 * r, 0.18 * r, 0, 7); ctx.fill(); break;
    case 'medic':
      ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.arc(-0.1 * r, 0, 0.62 * r, 0, 7); ctx.fill();
      ctx.fillStyle = '#d62828'; ctx.fillRect(-0.18 * r, -0.45 * r, 0.36 * r, 0.9 * r); ctx.fillRect(-0.55 * r, -0.13 * r, 0.9 * r, 0.26 * r); break;
    case 'rifle':
      ctx.fillStyle = '#20232c'; ctx.beginPath(); ctx.arc(-0.05 * r, 0, 0.66 * r, 0, 7); ctx.fill();
      ctx.fillStyle = f.ring; ctx.beginPath(); ctx.arc(0.32 * r, 0, 0.2 * r, 0, 7); ctx.fill();
      stick('#5b3b1f', 3.0, 1);
      ctx.strokeStyle = '#d7dde2'; ctx.lineWidth = Math.max(0.35, 0.09 * r); ctx.beginPath(); ctx.moveTo(3.0 * r, 0.95 * r); ctx.lineTo(3.75 * r, 0.95 * r); ctx.stroke();
      break;
    case 'rifleman':
      ctx.fillStyle = '#3d5232'; ctx.beginPath(); ctx.arc(0, 0, 0.88 * r, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b3a23'; ctx.beginPath(); ctx.arc(0, 0, 0.5 * r, 0, 7); ctx.fill();
      stick('#4a2f18', 3.35, 1);
      break;
    case 'hussar':
      ctx.fillStyle = '#1c1a18'; ctx.beginPath(); ctx.arc(-0.05 * r, 0, 0.7 * r, 0, 7); ctx.fill();
      ctx.fillStyle = f.ring; ctx.beginPath(); ctx.ellipse(-0.55 * r, 0.25 * r, 0.32 * r, 0.2 * r, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d7dde2'; ctx.lineWidth = Math.max(0.45, 0.13 * r); ctx.beginPath(); ctx.moveTo(0.25 * r, 0.95 * r); ctx.quadraticCurveTo(1.6 * r, 1.25 * r, 2.7 * r, 0.75 * r); ctx.stroke();
      break;
    case "fieldgun": case 'gatling':
      ctx.fillStyle = '#2a3550'; ctx.beginPath(); ctx.arc(-0.1 * r, 0, 0.6 * r, 0, 7); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.ellipse(0.48 * r, 0, 0.2 * r, 0.42 * r, 0, 0, 7); ctx.fill();
      break;
    case 'cmdV':
      ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.ellipse(-0.05 * r, 0, 0.45 * r, 1.05 * r, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 0.14 * r; ctx.stroke();
      stick('#d7dde2', 2.1, 1);
      ctx.strokeStyle = "#5a4030"; ctx.lineWidth = 0.15 * r; ctx.beginPath(); ctx.moveTo(-0.5 * r, -0.6 * r); ctx.lineTo(-2.4 * r, -1.3 * r); ctx.stroke();
      ctx.fillStyle = f.ring; ctx.fillRect(-2.4 * r, -1.9 * r, 0.9 * r, 0.6 * r); break;
    case 'knight':
      ctx.fillStyle = '#b8bec4'; ctx.beginPath(); ctx.arc(0, 0, 0.8 * r, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0.38 * r, -0.45 * r, 0.14 * r, 0.9 * r);
      ctx.fillStyle = f.ring; ctx.beginPath(); ctx.ellipse(-0.62 * r, 0, 0.34 * r, 0.2 * r, 0, 0, 7); ctx.fill();
      stick('#7b5a3a', 4.4, 1); ctx.fillStyle='#c9d0d6'; tri([4.4, 0.8, 4.4, 1.1, 5.0, 0.95]);
      ctx.fillStyle = f.ring; tri([3.5, 1.0, 4.1, 1.0, 3.75, 1.6]); break;
    case 'halberd':
      helmet(f.helm || '#a0a6ad'); stick("#7b5a3a", 4.2, 1);
      ctx.fillStyle = '#c9d0d6'; ctx.beginPath(); ctx.moveTo(3.35 * r, 1.05 * r); ctx.lineTo(3.95 * r, 1.05 * r); ctx.quadraticCurveTo(3.9 * r, 1.8 * r, 3.35 * r, 1.65 * r); ctx.closePath(); ctx.fill();
      tri([4.2, 0.85, 4.2, 1.05, 4.75, 0.95]); break;
    case 'xbow':
      ctx.fillStyle = '#8a8f94'; ctx.beginPath(); ctx.arc(0, 0, 0.88 * r, 0, 7); ctx.fill();
      ctx.fillStyle = '#6f747a'; ctx.beginPath(); ctx.arc(0, 0, 0.5 * r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(0.5, 0.22 * r); ctx.beginPath(); ctx.moveTo(0.8 * r, 0); ctx.lineTo(2.5 * r, 0); ctx.stroke();
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = Math.max(0.45, 0.2 * r); ctx.beginPath(); ctx.moveTo(1.95 * r, -1.0 * r); ctx.quadraticCurveTo(2.5 * r, 0, 1.95 * r, 1.0 * r); ctx.stroke();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = Math.max(0.3, 0.06 * r); ctx.beginPath(); ctx.moveTo(1.95 * r, -1.0 * r); ctx.lineTo(1.45 * r, 0); ctx.lineTo(1.95 * r, 1.0 * r); ctx.stroke();
      break;
    case 'harcher':
      ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.arc(-0.05 * r, 0, 0.74 * r, 0, 7); ctx.fill();
      ctx.fillStyle = f.ring; ctx.beginPath(); ctx.arc(-0.1 * r, 0, 0.3 * r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(0.5, 0.17 * r); ctx.beginPath(); ctx.arc(0.6 * r, 0, 1.05 * r, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = Math.max(0.3, 0.06 * r); ctx.beginPath(); ctx.moveTo(0.6 * r + Math.cos(-1.15) * 1.05 * r, Math.sin(-1.15) * 1.05 * r); ctx.lineTo(0.6 * r + Math.cos(1.15) * 1.05 * r, Math.sin(1.15) * 1.05 * r); ctx.stroke();
      break;
    case 'trooper': wwHelm(); stick("#4a3520", 3.0, 1); ctx.strokeStyle = '#c9d0d6'; ctx.lineWidth = Math.max(0.35, 0.09 * r); ctx.beginPath(); ctx.moveTo(3.0 * r, 0.95 * r); ctx.lineTo(3.6 * r, 0.95 * r); ctx.stroke(); break;
    case 'sapper':
      wwHelm(); stick('#6b4a2a', 2.2, 1); ctx.fillStyle = '#8a8f94'; ctx.fillRect(2.15 * r, 0.62 * r, 0.7 * r, 0.66 * r); break;
    case 'flamer':
      ctx.fillStyle = '#5a5a52'; ctx.strokeStyle = '#2a2a26'; ctx.lineWidth = 0.1 * r;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(-1.05 * r, s * 0.4 * r, 0.38 * r, 0, 7); ctx.fill(); ctx.stroke(); }
      wwHelm(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0.6 * r, 0, 0.26 * r, 0, 7); ctx.fill();
      stick('#333', 2.5, 1); ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.arc(2.55 * r, 0.95 * r, 0.17 * r, 0, 7); ctx.fill(); break;
    case 'sniper':
      ctx.fillStyle='#56663a'; ctx.beginPath(); ctx.arc(0, 0, 0.9 * r, 0, 7); ctx.fill();
      ctx.fillStyle = '#3f4a2a'; ctx.beginPath(); ctx.arc(-0.3 * r, -0.3 * r, 0.22 * r, 0, 7); ctx.arc(0.2 * r, 0.35 * r, 0.18 * r, 0, 7); ctx.fill();
      stick('#3a2a18', 3.9, 1); ctx.fillStyle='#1a1a1a'; ctx.fillRect(1.3 * r, 0.6 * r, 0.95 * r, 0.2 * r); break;
    case 'mg': case 'mortar': case 'rocket': wwHelm(); break;
    case 'cmdW':
      ctx.fillStyle = "#4a5232"; ctx.beginPath(); ctx.arc(-0.05 * r, 0, 0.7 * r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8a2a2a'; ctx.lineWidth = 0.14 * r; ctx.stroke();
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(0.55 * r, 0, 0.22 * r, 0.5 * r, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 0.15 * r; ctx.beginPath(); ctx.moveTo(-0.5 * r, -0.6 * r); ctx.lineTo(-2.4 * r, -1.3 * r); ctx.stroke();
      ctx.fillStyle = f.ring; ctx.fillRect(-2.4 * r, -1.9 * r, 0.9 * r, 0.6 * r); break;
    case 'archer':
      ctx.strokeStyle = '#3d6b35'; ctx.lineWidth=0.3 * r; ctx.beginPath(); ctx.arc(0, 0, 0.7 * r, 2, 4.3); ctx.stroke();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(0.5, 0.17 * r); ctx.beginPath(); ctx.arc(0.6 * r, 0, 1.2 * r, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = Math.max(0.3, 0.06 * r); ctx.beginPath(); ctx.moveTo(0.6 * r + Math.cos(-1.1) * 1.2 * r, Math.sin(-1.1) * 1.2 * r); ctx.lineTo(0.6 * r + Math.cos(1.1) * 1.2 * r, Math.sin(1.1) * 1.2 * r); ctx.stroke();
      break;
    case 'king':
      ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 0.25 * r; ctx.beginPath(); ctx.arc(0, 0, 0.5 * r, 0, 7); ctx.stroke();
      ctx.fillStyle = '#f5c518'; for (let i=0; i < 5; i++) { const t = i * 1.2566; ctx.beginPath(); ctx.arc(Math.cos(t) * 0.5 * r, Math.sin(t) * 0.5 * r, 0.16 * r, 0, 7); ctx.fill(); }
      break;
    case 'merchant': ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.arc(-0.2 * r, 1.05 * r, 0.38 * r, 0, 7); ctx.fill(); break;
    case 'wanderer': ctx.strokeStyle='#3d5a3a'; ctx.lineWidth = 0.35 * r; ctx.beginPath(); ctx.arc(0, 0, 0.75 * r, 1.7, 4.6); ctx.stroke(); break;
    case 'builder': ctx.fillStyle = '#888'; ctx.fillRect(0.4 * r, 0.8 * r, 0.7 * r, 0.35 * r); break;
    case 'wood': stick('#6b4a2a', 1.6, 1); break;
    case 'miner': stick("#777", 1.6, 1); break;
    case 'hunter':
      ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 0.35 * r; ctx.beginPath(); ctx.arc(0, 0, 0.75 * r, 1.7, 4.6); ctx.stroke();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(0.5, 0.17 * r); ctx.beginPath(); ctx.arc(0.6 * r, 0, 1.1 * r, -1.1, 1.1); ctx.stroke();
      break;
    case 'healer':
      ctx.fillStyle = '#eee8dc'; ctx.beginPath(); ctx.arc(0, 0, 0.72 * r, 0, 7); ctx.fill();
      ctx.fillStyle='#2a9d4f'; ctx.fillRect(-0.12 * r, -0.4 * r, 0.24 * r, 0.8 * r); ctx.fillRect(-0.4 * r, -0.12 * r, 0.8 * r, 0.24 * r);
      break;
    case 'bandit':
      ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.arc(-0.15 * r, 0, 0.85 * r, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a1e1e'; ctx.fillRect(0.3 * r, -0.85 * r, 0.25 * r, 1.7 * r);
      stick('#bbb', 1.8, 1);
      break;
    case "fisher":
      ctx.fillStyle = "#d9c27a"; ctx.beginPath(); ctx.arc(0, 0, 0.7 * r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8b6a45'; ctx.lineWidth = Math.max(0.4, 0.12 * r); ctx.beginPath(); ctx.moveTo(0.3 * r, 0.9 * r); ctx.lineTo(3 * r, 1.4 * r); ctx.stroke();
      break;
  }
  ctx.restore();
}

function figCached(p)
{
  const c = p._fc, cmd = !!(p.army && p.army.cmd === p), vic = cmd ? (p.army.ww ? 2 : p.army.vic ? 1 : 0) : 0, tech = p.k.tech || 0, sick = !!p.sick, adult = isAdult(p);
  if (!c || c.job !== p.job || c.state !== p.state || c.cmd !== cmd || c.vic !== vic || c.tech !== tech || c.sick !== sick || c.adult !== adult || c.k !== p.k || c.color !== p.k.color || c.skin !== p.skin) {
    const f = figOf(p);
    p._fc = { job: p.job, state: p.state, cmd, vic, tech, sick, adult, k: p.k, color: p.k.color, skin: p.skin, f,
      key: [f.skin, f.ears, f.extra, f.size, f.ring, f.female ? 1 : 0, f.helm, f.child ? 1 : 0, f.sick ? 1 : 0, f.job, f.mount || '', f.mount ? f.horse : '', f.job === 'artillery' ? +f.gun : ''].join('|') };
  }
  p._fc.f.ghost = hiddenIn(p);
  return p._fc;
}

const SPR = { k: 0, atlas: null, g: null, map: new Map(), x: 0, y: 0, rowH: 0, full: false };
const SPR_SIZE = 2048, SPR_KMAX = 14;
const sprLevel = s => Math.pow(2, Math.ceil(Math.log2(s) * 4 - 1e-9) / 4);
const FIG_FWD = { spear: 5.6, knight: 5.1, halberd: 4.85, rifle: 3.85, trooper: 3.7, sniper: 4.0, rifleman: 3.45, fisher: 3.2 };
function sprBounds(f)
{
  if (f.job === 'tank') return [-2.5 * 3.2 - 0.6, -1.6 * 3.2 - 0.6, 3.6 * 3.2 + 0.6, 1.6 * 3.2 + 0.6];
  const gun = GUN_JOBS.has(f.job);
  const r = 3.2 * f.size * (f.child ? 0.65 : 1), R = 3.2, m = Math.max(r, f.mount || gun ? (f.job === 'fieldgun' ? 1.25 * R : f.job === 'rocket' ? 1.25 * R : R) : 0);

  const fwd = Math.max((FIG_FWD[f.job] || 3) * r, f.mount ? Math.max(4.1 * r, 3.1 * R) : 0, gun ? 5.3 * R : 0);
  const back = Math.max(f.job === 'cmd' || f.job === 'cmdV' || f.job === 'cmdW' ? 2.6 * r : f.job === 'flamer' ? 1.55 * r : 1.3 * r, f.mount ? 3.4 * R : 0);
  const yari = Math.max(2.1 * r, m * 1.2) + 0.6;
  return [-back - 0.6, -yari, fwd + 0.6, yari];
}
function sprGet(f, anahtar, k)
{
  if (SPR.k !== k) {
    if (!SPR.atlas) { SPR.atlas = document.createElement('canvas'); SPR.atlas.width = SPR.atlas.height = SPR_SIZE; SPR.g=SPR.atlas.getContext("2d"); }
    SPR.k = k; SPR.map.clear(); SPR.x = SPR.y = SPR.rowH = 0; SPR.full = false;
    SPR.g.setTransform(1, 0, 0, 1, 0, 0); SPR.g.clearRect(0, 0, SPR_SIZE, SPR_SIZE);
  }
  let e = SPR.map.get(anahtar);
  if (e || SPR.full) return e || null;
  const [x0, y0, x1, y1] = sprBounds(f), w = Math.ceil((x1 - x0) * k) + 2, h = Math.ceil((y1 - y0) * k) + 2;
  if (SPR.x + w>SPR_SIZE) { SPR.x = 0; SPR.y += SPR.rowH + 1; SPR.rowH=0; }
  if (SPR.y + h > SPR_SIZE) { SPR.full = true; return null; }
  const g = SPR.g, ghost = f.ghost;
  f.ghost = false;
  g.setTransform(k, 0, 0, k, SPR.x + 1 - x0 * k, SPR.y + 1 - y0 * k);
  drawFigure(g, f, 0, 0, 0, 1);
  f.ghost = ghost;
  e = { sx: SPR.x, sy: SPR.y, w, h, ox: x0 - 1 / k, oy: y0 - 1 / k, dw: w / k, dh: h / k };
  SPR.x += w + 1; SPR.rowH=Math.max(SPR.rowH, h);
  SPR.map.set(anahtar, e);
  return e;
}
function drawPeople(ctx, vis)
{
  const M = ctx.getTransform(), k=sprLevel(Math.hypot(M.a, M.b)), useSpr = k <= SPR_KMAX, trs = Sim.trenches.length > 0;
  let hareketli = false;
  for (const p of Sim.people) {
    if (p.dead || !vis(p) || (p.army && p.army.state === 'sail')) continue;
    const c = figCached(p);
    let f = c.f, key = c.key;
    if (trs && WW_JOBS.has(p.job) && ducked(p)) { f = c.fd || (c.fd = Object.assign({}, c.f, { duck: true })); f.ghost = c.f.ghost; key += '|d'; }

    const e = useSpr ? sprGet(f, key, k) : null;

    if (!e) { if (hareketli) { ctx.setTransform(M); hareketli = false; } drawFigure(ctx, f, p.x, p.y, p.a, 1); continue; }
    const cs = Math.cos(p.a), sn = Math.sin(p.a);
    ctx.setTransform(M.a * cs + M.c * sn, M.b * cs + M.d * sn, M.c * cs - M.a * sn, M.d * cs - M.b * sn, M.a * p.x + M.c * p.y + M.e, M.b * p.x + M.d * p.y + M.f);
    hareketli = true;
    if (f.ghost) { ctx.globalAlpha=0.3; ctx.drawImage(SPR.atlas, e.sx, e.sy, e.w, e.h, e.ox, e.oy, e.dw, e.dh); ctx.globalAlpha = 1; }
    else ctx.drawImage(SPR.atlas, e.sx, e.sy, e.w, e.h, e.ox, e.oy, e.dw, e.dh);
  }

  if (hareketli) ctx.setTransform(M);
}

function drawShip(ctx, sh)
{
  const L = SHIP[sh.type].len, Wd = L * 0.38;
  ctx.save();
  ctx.translate(sh.x, sh.y);

  ctx.rotate(sh.a);
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(-L * 1.1, -Wd * 0.7); ctx.lineTo(-L * 1.1, Wd * 0.7); ctx.fill();
  ctx.fillStyle = sh.type === "war" ? '#4a3220' : '#6b4a2b'; ctx.strokeStyle = "#2e1e10"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(L / 2, 0); ctx.lineTo(L * 0.2, Wd / 2); ctx.lineTo(-L / 2, Wd * 0.4); ctx.lineTo(-L / 2, -Wd * 0.4); ctx.lineTo(L * 0.2, -Wd / 2); ctx.closePath();
  ctx.fill(); ctx.stroke();
  const sails = sh.type === 'trade' ? [0] : [-L * 0.18, L * 0.15];
  for (const sx of sails) {
    ctx.fillStyle = sh.type === 'war' ? sh.k.color : '#efe8d8';
    ctx.fillRect(sx - 1.5, -Wd * 0.75, 3, Wd * 1.5);
    if (sh.type === 'transport') { ctx.fillStyle = sh.k.color; ctx.fillRect(sx - 1.5, -1, 3, 2); }
  }
  ctx.fillStyle = sh.k.color; ctx.fillRect(-L / 2 - 3, -1.5, 3, 3);
  ctx.restore();
   if (sh.hp < sh.max) {
    ctx.fillStyle = '#300'; ctx.fillRect(sh.x - 8, sh.y - L * 0.6, 16, 2);

    ctx.fillStyle = '#e63946'; ctx.fillRect(sh.x - 8, sh.y - L * 0.6, 16 * Math.max(0, sh.hp) / sh.max, 2);
  }
}

function drawBuildings(ctx, s) {
  const { granary: g, market: m, temple: t, barracks: b, tavern: v, monument: mo } = s;
  if (mo) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(mo.x - 6, mo.y - 3, 14, 12);
    ctx.fillStyle = '#9a958a'; ctx.fillRect(mo.x - 7, mo.y - 5, 14, 12);
    ctx.fillStyle='#b8b2a4'; ctx.fillRect(mo.x - 5, mo.y - 3, 10, 8);
    ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(mo.x, mo.y + 1, 3.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a6d12'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mo.x + 3, mo.y + 1); ctx.lineTo(mo.x + 7, mo.y - 5); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  if (v) {
    ctx.fillStyle = '#6b4226'; ctx.fillRect(v.x - 8, v.y - 7, 16, 14); ctx.strokeRect(v.x - 8, v.y - 7, 16, 14);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(v.x - 8, v.y - 7, 16, 6);
    ctx.fillStyle = "#f2c14e"; ctx.fillRect(v.x + 5, v.y + 1, 5, 5); ctx.fillStyle = '#fff'; ctx.fillRect(v.x + 5, v.y + 1, 5, 1.5);
  }
  if (s.cem && s.graves) {
    const c = s.cem;
    ctx.fillStyle = 'rgba(70,90,50,0.35)'; ctx.fillRect(c.x - 19, c.y - 19, 38, 38);
    ctx.strokeStyle='#6b5a45'; ctx.lineWidth = 1; ctx.strokeRect(c.x - 19, c.y - 19, 38, 38);
    s.graves.forEach((gr, i) => {
      if (!gr) return;
      const gx = c.x - 15 + (i % 6) * 6, gy=c.y - 15 + (i / 6 | 0) * 6;
      ctx.fillStyle = gr.king ? '#d4af37' : '#9a9a96'; ctx.fillRect(gx - 1, gy - 2, gr.king ? 3 : 2, gr.king ? 4 : 3);
      ctx.fillRect(gx - 2, gy - 1, gr.king ? 5 : 4, 1);
    });
  }
  if (s.fest>Sim.tick) {
    const f = performance.now() / 90;
    ctx.fillStyle = '#5a3d22'; ctx.fillRect(s.x - 4, s.y - 1, 8, 2);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['rgba(255,80,20,0.85)', 'rgba(255,160,30,0.85)', 'rgba(255,230,120,0.9)'][i]
      ctx.beginPath(); ctx.ellipse(s.x + Math.sin(f + i) * 0.8, s.y - 2 - i * 1.3, 4 - i, 5 - i + Math.sin(f * 1.7 + i), 0, 0, 7); ctx.fill();
    }
  }
  if (g) {
    ctx.fillStyle = '#7a5a30'; ctx.beginPath(); ctx.arc(g.x, g.y, 7, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a25a'; ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, 7); ctx.fill();
  }
  if (m) {
    ctx.fillStyle = '#d8cfb8'; ctx.fillRect(m.x - 8, m.y - 6, 16, 12);
    for (let i = 0; i < 4; i++) { ctx.fillStyle=i % 2 ? '#e63946' : '#f4f1e8'; ctx.fillRect(m.x - 8 + i * 4, m.y - 6, 4, 7); }
    ctx.strokeRect(m.x - 8, m.y - 6, 16, 12);
  }
  if (t) {
    ctx.fillStyle = '#ece6d4'; ctx.fillRect(t.x - 8, t.y - 8, 16, 16); ctx.strokeRect(t.x - 8, t.y - 8, 16, 16);
    ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(t.x, t.y, 4.5, 0, 7); ctx.fill();
  }
  if (b) {
    ctx.fillStyle = '#7a2e2e'; ctx.fillRect(b.x - 9, b.y - 7, 18, 14); ctx.strokeRect(b.x - 9, b.y - 7, 18, 14);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(b.x - 4, b.y - 4); ctx.lineTo(b.x + 4, b.y + 4); ctx.moveTo(b.x + 4, b.y - 4); ctx.lineTo(b.x - 4, b.y + 4); ctx.stroke();
    ctx.fillStyle = s.k.color; ctx.fillRect(b.x + 6, b.y - 13, 6, 4); ctx.fillStyle = '#333'; ctx.fillRect(b.x + 5, b.y - 13, 1, 7);
  }
}

function drawMonster(ctx, m)
{
  if (m.type === 'bandit') {
    drawFigure(ctx, { skin: m.skin, ears: m.ears, extra: m.extra, size: m.size, ring: '#111', female: false, child: false, job: 'bandit' }, m.x, m.y, m.a, 1);
    return;
  }
   if (m.type === "deer") {
     ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
    ctx.fillStyle = '#9a6a3c'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4.3, 0, 1.7, 1.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle='#f4f1e8'; ctx.beginPath(); ctx.arc(-4, 0, 0.9, 0, 7); ctx.fill();
    if (m.buck) {
      ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (const sd of [-1, 1]) { ctx.moveTo(4, sd * 0.6); ctx.lineTo(2.5, sd * 3); ctx.moveTo(3.2, sd * 1.8); ctx.lineTo(4.4, sd * 3.2); }
      ctx.stroke();
    }
    ctx.restore();

    return;
  }
  if (m.type === "wolf") {
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-7.5, Math.sin(Sim.tick * 0.3 + m.id) * 1.2); ctx.stroke();
    ctx.fillStyle = '#6e6e72'; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 2.3, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(4.2, 0, 2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -1.2); ctx.lineTo(3, -3); ctx.lineTo(5, -1.6); ctx.moveTo(4, 1.2); ctx.lineTo(3, 3); ctx.lineTo(5, 1.6); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.fillRect(5, -0.9, 0.8, 0.6); ctx.fillRect(5, 0.3, 0.8, 0.6);
    ctx.restore();
    return;
  }
  const sleep = m.state === 'sleep', flap=sleep ? -0.6 : Math.sin(performance.now() / 110 + m.id), dark = mixHex(m.color, '#000000', 0.35);
  if (!sleep) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(m.x + 10, m.y + 16, 18, 8, m.a, 0, 7); ctx.fill(); }
   if (m.breath) {
    const hx = m.x + Math.cos(m.a) * 16, hy = m.y + Math.sin(m.a) * 16;

    const gr = ctx.createLinearGradient(hx, hy, m.breath.x, m.breath.y);
    gr.addColorStop(0, 'rgba(255,240,150,0.9)'); gr.addColorStop(1, 'rgba(255,90,20,0.5)');
    ctx.strokeStyle = gr; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(m.breath.x, m.breath.y); ctx.stroke(); ctx.lineCap = 'butt';
  }
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
  ctx.fillStyle = dark;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(5, sd * 2); ctx.lineTo(-4, sd * (18 + 6 * flap)); ctx.lineTo(-10, sd * (14 + 4 * flap)); ctx.lineTo(-12, sd * 4); ctx.fill();
  }
  ctx.strokeStyle = m.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-18, Math.sin(performance.now() / 300) * 5, -25, 0); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = m.color; ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13, 0, 5, 3.2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffd166"; ctx.fillRect(14, -2, 1.5, 1.2); ctx.fillRect(14, 0.8, 1.5, 1.2);
  ctx.fillStyle = '#f4f1e8'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(10, sd * 2.5); ctx.lineTo(7, sd * 6); ctx.lineTo(9, sd * 2.5); ctx.fill(); }
  ctx.restore();
  if (m.hp < m.max) {
    ctx.fillStyle = "#300"; ctx.fillRect(m.x - 14, m.y - 26, 28, 3);
    ctx.fillStyle = '#e63946'; ctx.fillRect(m.x - 14, m.y - 26, 28 * Math.max(0, m.hp) / m.max, 3);
  }
}

function drawWeather(ctx, w, h) {
  if (Sim.speed > 10 || Sim.cam.z < 0.4) return;
  const simdi = performance.now(), sn = snowAmt();
  if (sn > 0.15) {
    ctx.fillStyle=`rgba(255,255,255,${Math.min(0.85, sn)})`;
    for (let i = 0; i < 150; i++) {
      const x = ((i * 137.5 + simdi * 0.012 * (1 + i % 3) + Math.sin(simdi / 900 + i) * 20) % w + w) % w, y = (i * 91.7 + simdi * 0.04 * (1 + i % 4)) % h;
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (Sim.tick < Sim.rainUntil) {
    ctx.fillStyle = 'rgba(20,30,50,0.13)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(185,205,235,0.5)'; ctx.lineWidth=1; ctx.beginPath();
    for (let i = 0; i < 170; i++) {
      const x = (i * 173.3 + simdi * 0.25) % (w + 60) - 30, y = (i * 59.9 + simdi * 0.9 * (1 + i % 3 * 0.2)) % h;
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 11);
    }
    ctx.stroke();
  }
}

function polyPath(ctx, noktalar, frac) {
  let total = 0;
  for (let i = 0; i < noktalar.length; i++) total += dist(noktalar[i], noktalar[(i + 1) % noktalar.length]);
  let sol = total * clamp(frac, 0, 1);
  ctx.beginPath(); ctx.moveTo(noktalar[0].x, noktalar[0].y);
  for (let i = 0; i < noktalar.length && sol > 0; i++) {
     const p = noktalar[i], q = noktalar[(i + 1) % noktalar.length], d = dist(p, q), t = Math.min(1, sol / d);
    ctx.lineTo(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
    sol -= d;
  }
}

function drawSettlement(ctx, s) {
  const k = s.k;

  if (s.port) {
    const p = s.port;
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(p.lx, p.ly); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = '#8b6a45'; ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1; ctx.strokeRect(p.x - 5, p.y - 5, 10, 10);
  }
  ctx.fillStyle = '#c9b458'
  for (const i of s.fields) {
    const x = (i % CFG.cols) * CFG.tile, y = (i / CFG.cols | 0) * CFG.tile;
    ctx.fillRect(x + 1, y + 1, CFG.tile - 2, CFG.tile - 2);
  }
  ctx.strokeStyle = "rgba(120,100,40,0.5)"; ctx.lineWidth=0.6;
  ctx.beginPath();
  for (const i of s.fields) { const x = (i % CFG.cols) * CFG.tile, y = (i / CFG.cols | 0) * CFG.tile; for (let j = 3; j < CFG.tile; j += 3) { ctx.moveTo(x + 1, y + j); ctx.lineTo(x + CFG.tile - 1, y + j); } }
  ctx.stroke()
  ctx.fillStyle = '#c8b48e'; ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, 7); ctx.fill();
  const H = 6.5, aci = s.lay && s.lay.kind !== 'cluster' ? s.lay.ang : 0;
  for (const h of s.houses) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(aci);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-H + 1.5, -H + 1.5, H * 2, H * 2);
    ctx.fillStyle = k.roof; ctx.fillRect(-H, -H, H * 2, H * 2);
    ctx.fillStyle = "rgba(255,255,255,0.13)"; ctx.fillRect(-H, -H, H * 2, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(-H, -H, H * 2, H * 2);
    ctx.beginPath(); ctx.moveTo(-H, 0); ctx.lineTo(H, 0); ctx.stroke();
    ctx.restore();
  }
  if (s.keep) {
    const K = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(s.x - K + 2, s.y - K + 2, K * 2, K * 2);
    ctx.fillStyle = "#8f8f8f"; ctx.fillRect(s.x - K, s.y - K, K * 2, K * 2);

    ctx.fillStyle = '#a8a8a8'; ctx.fillRect(s.x - K + 5, s.y - K + 5, K * 2 - 10, K * 2 - 10);
    ctx.fillStyle = '#6f6f6f'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(s.x + dx * K - 4, s.y + dy * K - 4, 8, 8);
    ctx.fillStyle = '#444'; ctx.fillRect(s.x - 1, s.y - K - 14, 1.5, 16);
    ctx.fillStyle = k.color; ctx.fillRect(s.x + 0.5, s.y - K - 14, 9, 6);
  }
  drawBuildings(ctx, s);
  if (s.prison) {
    const p = s.prison;
    ctx.fillStyle = "#3d3d3d"; ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1; ctx.beginPath();

    for (let i = -6; i <= 6; i += 3) { ctx.moveTo(p.x + i, p.y - 7); ctx.lineTo(p.x + i, p.y + 7); }
    ctx.stroke();
  }
  const pr = s.project;
  if (pr) {
    ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    if (pr.pts) {
      polyPath(ctx, pr.pts, 1); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 4; polyPath(ctx, pr.pts, pr.progress / pr.cost); ctx.stroke();
    }
    else if (pr.type !== 'repair') ctx.strokeRect(pr.x - 7, pr.y - 7, 14, 14);
    ctx.setLineDash([]);
  }
  const w = s.walls;
  if (w) {
    const ok = w.hp > 0;
    ctx.strokeStyle = ok ? '#9a9a9a' : 'rgba(140,140,140,0.35)'; ctx.lineWidth = 4.5;
    if (w.hp < w.max * 0.4) ctx.setLineDash([9, 6]);
    ctx.lineJoin='miter'; polyPath(ctx, w.pts, 1); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    if (ok) {
      ctx.fillStyle = '#7d7d7d';
      w.pts.forEach((p, i) => {
        const q = w.pts[(i + 1) % w.pts.length], n = Math.floor(dist(p, q) / 45);
        for (let j = 0; j <= n; j++) { const t = n ? j / (n + 1) : 0, x = p.x + (q.x - p.x) * t, y=p.y + (q.y - p.y) * t; ctx.fillRect(x - 4, y - 4, 8, 8); }
      });
    }
  }
}

function renderWorld(ctx, w, h) {
  const cam = Sim.cam;
  const fol = Sim.ctrl || (Sim.follow && Sim.sel);
  if (fol && !fol.dead) { cam.x = fol.x; cam.y = fol.y; }
  ctx.fillStyle = '#0b2140'
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.x, -cam.y)
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(Sim.mapImg, 0, 0, W, H);
   ctx.drawImage(Sim.roadImg, 0, 0, W, H);
  if (Sim.snowImg && Sim.speed <= 25) {
    const sn = snowAmt(), fa = fallAmt();
    if (fa > 0) { ctx.globalAlpha = fa * 0.55; ctx.drawImage(Sim.fallImg, 0, 0, W, H); }
    if (sn > 0) { ctx.globalAlpha=sn * 0.75; ctx.drawImage(Sim.snowImg, 0, 0, W, H); }
    ctx.globalAlpha = 1;
  }
  const x0 = cam.x - w / 2 / cam.z - 60, x1 = cam.x + w / 2 / cam.z + 60, y0 = cam.y - h / 2 / cam.z - 60, y1 = cam.y + h / 2 / cam.z + 60;
  const vis=o => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1;

  if (Sim.terrImg) {
    ctx.drawImage(Sim.terrImg, 0, 0, W, H);
    ctx.lineCap = 'round';
    for (const b of Sim.borders) { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 4; ctx.stroke(b.path); }
    ctx.setLineDash([7, 4]);
    for (const b of Sim.borders) { ctx.strokeStyle = b.k.color; ctx.lineWidth = 2.2; ctx.stroke(b.path); }
    ctx.setLineDash([]); ctx.lineCap = 'butt';
  }

  for (const r of Sim.ruins) {
    if (!vis(r)) continue;
    ctx.fillStyle = 'rgba(30,25,20,0.45)'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.8, 0, 7); ctx.fill();

    ctx.fillStyle = '#5a5550';
    for (let i = 0; i < 9; i++) { const a = i * 2.4, d = (i * 37 % 10) / 10 * r.r * 0.7; ctx.fillRect(r.x + Math.cos(a) * d - 3, r.y + Math.sin(a) * d - 2, 6 - i % 3, 4); }
  }
  drawTrenches(ctx, vis);
  for (const c of Sim.camps) if (!c.dead && vis(c)) drawCamp(ctx, c);

  cpDrawBases(ctx, vis);
  for (const s of Sim.settlements) if (vis(s)) drawSettlement(ctx, s);
  for (const sh of Sim.ships) if (!sh.dead && vis(sh)) drawShip(ctx, sh);
  for (const m of Sim.monsters) if (!m.dead && m.type !== 'dragon' && vis(m) && cam.z >= 0.3) drawMonster(ctx, m);
  if (cam.z >= 0.3) drawPeople(ctx, vis);
  ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1;
  ctx.beginPath();
  let bullets = false;
  for (const a of Sim.arrows) {
    if (a.shell) continue;
    if (a.bullet) { bullets = true; continue; }
    const t = a.t / a.T, x = a.x0 + (a.tx - a.x0) * t, y = a.y0 + (a.ty - a.y0) * t, aci = Math.atan2(a.ty - a.y0, a.tx - a.x0);

    ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(aci) * 5, y - Math.sin(aci) * 5);
  }

  ctx.stroke();
  if (bullets) {
    ctx.strokeStyle = "rgba(255,236,170,0.85)"; ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const a of Sim.arrows) {
      if (!a.bullet) continue;
      const t = a.t / a.T, x = a.x0 + (a.tx - a.x0) * t, y = a.y0 + (a.ty - a.y0) * t, aci = Math.atan2(a.ty - a.y0, a.tx - a.x0);
      ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(aci) * 7, y - Math.sin(aci) * 7);
    }
    ctx.stroke();
  }
  drawShells(ctx);

  levelDraw(ctx);
  drawSelection(ctx);
  for (const m of Sim.monsters) if (!m.dead && m.type === 'dragon' && vis(m)) drawMonster(ctx, m);

  Sim.fx = Sim.fx.filter(f => --f.t > 0);
  for (const f of Sim.fx) {
    if (f.type === 'hit') { ctx.fillStyle = `rgba(255,40,40,${f.t / 8})`; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, 7); ctx.fill(); }
    else if (f.type === 'heart') {
      ctx.fillStyle = `rgba(255,90,130,${f.t / 60})`; ctx.font = '7px Redaction35, system-ui'; ctx.fillText('❤', f.x - 3 + Math.sin(f.t / 5) * 2, f.y - (60 - f.t) * 0.25);
    }
    else if (f.type==='order') {
      ctx.strokeStyle = `rgba(255,80,60,${f.t / 40})`; ctx.lineWidth=1.5 / Sim.cam.z;
      ctx.beginPath(); ctx.arc(f.x, f.y, 4 + (40 - f.t) * 0.3, 0, 7); ctx.moveTo(f.x - 4, f.y - 4); ctx.lineTo(f.x + 4, f.y + 4); ctx.moveTo(f.x + 4, f.y - 4); ctx.lineTo(f.x - 4, f.y + 4); ctx.stroke();
    }
    else if (f.type === 'blast') {
      ctx.fillStyle = `rgba(110,90,70,${f.t / 30})`; ctx.beginPath(); ctx.arc(f.x, f.y, 14 - f.t * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,${120 + f.t * 5 | 0},40,${f.t / 22})`; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + (20 - f.t) * 0.35, 0, 7); ctx.fill();
    }
    else if (f.type === 'smoke') {
      const yas = 40 - f.t, rad = (1.6 + yas * 0.13) * (f.s || 1);
      if (yas < 3) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.beginPath(); ctx.arc(f.x, f.y, 1.4 * (f.s || 1), 0, 7); ctx.fill(); }
      ctx.fillStyle = `rgba(222,222,215,${f.t / 40 * 0.45})`; ctx.beginPath(); ctx.arc(f.x + (f.dx || 0) * yas * 4, f.y - yas * 0.12, rad, 0, 7); ctx.fill();
    }
    else if (f.type === 'flame') {
      const yas = 16 - f.t;
      ctx.fillStyle = `rgba(255,${110 + f.t * 8 | 0},30,${Math.min(0.85, f.t / 12)})`; ctx.beginPath(); ctx.arc(f.x, f.y - yas * 0.2, 2 + yas * 0.3, 0, 7); ctx.fill();
    }
    else if (f.type==='fire') {
      ctx.fillStyle = `rgba(255,${90 + f.t * 3 | 0},20,${f.t / 45})`; ctx.beginPath(); ctx.arc(f.x, f.y - (40 - f.t) * 0.3, 3 + (40 - f.t) * 0.15, 0, 7); ctx.fill();
    }
    else { ctx.fillStyle=`rgba(255,140,40,${f.t / 60})`; ctx.beginPath(); ctx.arc(f.x, f.y, 50 + (60 - f.t), 0, 7); ctx.fill(); }
  }
  if (Sim.selS && !Sim.selS.dead) {
    const v = Sim.selS;
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2 / cam.z; ctx.setLineDash([6 / cam.z, 4 / cam.z]);
    ctx.beginPath(); ctx.arc(v.x, v.y, v.r + 18, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  const s = Sim.sel;
  if (s && !s.dead) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 / cam.z * 1.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 7); ctx.stroke();
    if (s.army && s.army.target) { ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.army.target.x, s.army.target.y); ctx.stroke(); ctx.setLineDash([]); }
  }
  const c = Sim.ctrl;
  if (c) {
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, 9 + Math.sin(performance.now() / 200), 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(c.x, c.y - 12); ctx.lineTo(c.x - 4, c.y - 19); ctx.lineTo(c.x + 4, c.y - 19); ctx.fill();
  }
  drawPlans(ctx);
  fieldDraw(ctx, vis);
  cpDrawPlans(ctx)
  ctx.restore();

  const scr = o => [(o.x - cam.x) * cam.z + w / 2, (o.y - cam.y) * cam.z + h / 2];
  if (cam.z < 0.45) {
    ctx.textAlign = "center";
    for (const k of Sim.kingdoms) {
      if (k.dead) continue;
      let x = 0, y = 0, n=0, nufus = 0;
      for (const s of Sim.settlements) if (s.k === k) { const wt = s.pop + 5; x += s.x * wt; y += s.y * wt; n += wt; nufus += s.pop; }

      if (!n) continue;
      const [sx, sy] = scr({ x: x / n, y: y / n }), fs = clamp(13 + Math.sqrt(nufus) * 0.9, 13, 28) | 0;
      ctx.font = `bold ${fs}px Redaction35, system-ui`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(k.name, sx, sy);
      ctx.fillStyle = '#fff'; ctx.fillText(k.name, sx, sy);
      const sub = lang`${nufus} kişi${k.armies.length ? lang` · ⚔ ${k.armies.length} ordu` : ''}`;
      ctx.font = '11px Redaction35, system-ui'; ctx.strokeText(sub, sx, sy + 15);
      ctx.fillStyle = k.color; ctx.fillText(sub, sx, sy + 15);
    }
    ctx.textAlign = 'left';
  }
  if (cam.z < 0.8) {
     ctx.font = 'bold 11px Redaction35, system-ui';

    for (const A of allArmies()) {
      const k = A.k;
      if (!A.members.length || A.state === "sail") continue;
       const [sx, sy] = scr(A.cmd);

      ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 24); ctx.stroke();
      ctx.fillStyle = k.color; ctx.fillRect(sx, sy - 24, 20, 12);
      ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
      const etiket = lang`${A.state === 'ambush' ? "🌲" : A.raid ? '🔥' : '⚔'} ${A.members.length}`;
      ctx.strokeText(etiket, sx + 23, sy - 14); ctx.fillText(etiket, sx + 23, sy - 14);
    }
  }
  ctx.textAlign = 'center';
  for (const B of Sim.battles) {
    const [sx, sy] = scr(B);
    ctx.font = 'bold 13px Redaction35, system-ui'; ctx.lineWidth = 4; ctx.strokeStyle = '#000';
    const n = B.sides[0].length + B.sides[1].length, t = lang`⚔️ ${B.name} (${sideCount(B, 0)} - ${sideCount(B, 1)})${n > 2 ? lang` · ${n} ordu` : ''}`;
    ctx.strokeText(t, sx, sy - 30); ctx.fillStyle = '#ffd166'; ctx.fillText(t, sx, sy - 30);
  }
  ctx.textAlign = 'left';
  if (cam.z>=0.45) {
    ctx.font = 'bold 11px Redaction35, system-ui'; ctx.textAlign = 'center';
    for (const s of Sim.settlements) {
      if (!vis(s)) continue;
      const sx = (s.x - cam.x) * cam.z + w / 2, sy = (s.y - cam.y) * cam.z + h / 2 - (s.r + 10) * cam.z;
       const etiket = lang`${s.name} · ${s.level}${s.k.capital === s ? ' ★' : ''}`;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; const tw = ctx.measureText(etiket).width;
      ctx.fillRect(sx - tw / 2 - 10, sy - 11, tw + 16, 15);

      ctx.fillStyle=s.k.color; ctx.fillRect(sx - tw / 2 - 7, sy - 7, 6, 6);
      ctx.fillStyle = '#fff'; ctx.fillText(etiket, sx + 3, sy);
    }
    ctx.textAlign='left';
  }

  if (cam.z>=1.1) {
    ctx.font = `${clamp(9 * cam.z / 1.6, 10, 18) | 0}px Redaction35, system-ui`; ctx.textAlign = 'center';
    const now = Sim.tick, bs = clamp(cam.z * 5.5, 9, 18);
    for (const p of Sim.people) {
      if (p.dead || !p.bub || p.bub.t < now || !vis(p)) continue;
      const [sx, sy] = scr(p), by = sy - 7 * cam.z - bs;
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(sx, by, bs, bs * 0.8, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - 3, by + bs * 0.6); ctx.lineTo(sx, by + bs * 1.1); ctx.lineTo(sx + 3, by + bs * 0.6); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillText(p.bub.e, sx, by + bs * 0.35);
    }
    ctx.textAlign = 'left';
  }
  drawWeather(ctx, w, h);
  if (Sim.speed === 0 && !(LV.on && LV.phase !== 'fight')) {
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(w / 2 - 95, 12, 190, 32);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Redaction35, system-ui'; ctx.textAlign = 'center';
     ctx.fillText('⏸ DURAKLATILDI', w / 2, 34); ctx.textAlign = 'left';
  }
}

function renderPreview(ctx, w, h, d) {
  ctx.fillStyle='#5f8f45'; ctx.fillRect(0, 0, w, h);
  const taban = { skin: d.skin, ears: d.ears, extra: d.extra, size: d.size, ring: '#e63946', female: false, child: false, job: 'farmer' };
  drawFigure(ctx, taban, w / 2, h / 2 - 60, -Math.PI / 2, 14);
  const vars = [[lang('Kadın'), { female: true }], [lang('Çocuk'), { child: true }], [lang('Asker'), { job: 'soldier' }], [lang('Bekçi'), { job: 'guard' }],
    [lang("Komutan"), { job: 'cmd' }], [lang('Hükümdar'), { job: "king" }], [lang('Tüccar'), { job: "merchant" }], [lang('Gezgin'), { job: 'wanderer' }]];
  const gap = Math.min(110, (w - 40) / vars.length);
  ctx.font = '12px Redaction35, system-ui'; ctx.textAlign = 'center';
  vars.forEach(([label, o], i) => {
    const x = w / 2 + (i - (vars.length - 1) / 2) * gap, y = h / 2 + 130;
    drawFigure(ctx, { ...taban, ...o }, x, y, -Math.PI / 2, 5);
    ctx.fillStyle = '#fff'; ctx.fillText(label, x, y + 40);
  });
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Redaction35, system-ui';
  ctx.fillText(d.name, w / 2, 40);
   ctx.textAlign = 'left';
}

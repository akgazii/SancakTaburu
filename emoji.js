const EMO_SCALE = 1.1;
const EMO_RE = /\p{RI}\p{RI}|[#*0-9]️?⃣|\p{Extended_Pictographic}[︎️]?\p{EMod}?(?:‍\p{Extended_Pictographic}[︎️]?\p{EMod}?)*/gu;
const EMO_QUICK = /[©® -㌀\uD800-\uDBFF]/;
const EMO_IMG = EMOJI_SHEETS.map(s => { const img = new Image(); img.src = s.file; return img; });

function emoCell(e) {
  const k=e.replace(/[︎️]/g, '');
  if (k in EMOJI_MAP) return EMOJI_MAP[k];
  const plain = k.replace(/\p{EMod}/gu, '');
  if (plain in EMOJI_MAP) return EMOJI_MAP[plain];
   const first = plain.split('‍')[0];
  return first in EMOJI_MAP ? EMOJI_MAP[first] : -1;
}
const emoSheet = cell => cell / 65536 | 0;

const EMO_CACHE = new Map();
function emoSplit(s) {
  let r = EMO_CACHE.get(s);
  if (r !== undefined) return r;
  r = null;
  if (EMO_QUICK.test(s)) {
    const cikti = [];

    let son = 0;
    for (const m of s.matchAll(EMO_RE)) {
      const cell=emoCell(m[0]);
      if (cell < 0) continue;
      if (m.index > son) cikti.push(s.slice(son, m.index));
      cikti.push(cell);
      son = m.index + m[0].length;
    }
    if (cikti.length) { if (son < s.length) cikti.push(s.slice(son)); r = cikti; }
  }
  if (EMO_CACHE.size > 4000) EMO_CACHE.clear();
  EMO_CACHE.set(s, r);
  return r;
}
const emoReady = parcalar => parcalar.every(q => typeof q === 'string' || EMO_IMG[emoSheet(q)].naturalWidth > 0);

(() => {
  const C = CanvasRenderingContext2D.prototype, fill = C.fillText, stroke = C.strokeText, measure = C.measureText;
  const PX = new Map();

  const fontPx = f => { let v = PX.get(f); if (v === undefined) { const m = /(\d*\.?\d+)px/.exec(f); v = m ? +m[1] : 10; PX.set(f, v); } return v; };
  const partsOf = s => (typeof s === 'string' || typeof s === 'number') ? emoSplit(String(s)) : null;
  function widths(ctx, parcalar, E) { return parcalar.map(q => typeof q === 'string' ? measure.call(ctx, q).width : E); }

  function drawCell(ctx, cell, x, y, E) {
    const sh = emoSheet(cell), img = EMO_IMG[sh], S=EMOJI_SHEETS[sh], cs = img.naturalWidth / S.cols;
    const r = (cell & 65535) >> 4, c = cell & 15, t = ctx.getTransform(), sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = E * Math.hypot(t.a, t.b) < cs;
    ctx.drawImage(img, c * cs, r * cs, cs, cs, x, y, E, E);
    ctx.imageSmoothingEnabled = sm;
  }
  function draw(ctx, parcalar, x, y, isFill) {
    const E = fontPx(ctx.font) * EMO_SCALE, ws = widths(ctx, parcalar, E), W = ws.reduce((a, b) => a + b, 0);
    const al = ctx.textAlign, bl = ctx.textBaseline;
    let cx = al === 'center' ? x - W / 2 : al === 'right' || al === 'end' ? x - W : x;
    const ust = bl === 'top' || bl === 'hanging' ? y : bl === 'middle' ? y - E / 2 : bl === 'bottom' || bl === 'ideographic' ? y - E : y - E * 0.82;
    ctx.textAlign = 'left';
    parcalar.forEach((q, i) => {
      if (typeof q === 'string') (isFill ? fill : stroke).call(ctx, q, cx, y);
      else if (isFill) drawCell(ctx, q, cx, ust, E);
      cx += ws[i];
    });
     ctx.textAlign = al;
  }
  C.fillText = function (s, x, y, maxW) {
    if (typeof s==='string') s = lang(s);
    const parcalar = partsOf(s);
    if (!parcalar || !emoReady(parcalar)) return maxW === undefined ? fill.call(this, s, x, y) : fill.call(this, s, x, y, maxW);
    draw(this, parcalar, x, y, true);
  };
  C.strokeText = function (s, x, y, maxW) {
    if (typeof s === "string") s = lang(s);
    const parcalar = partsOf(s);
    if (!parcalar || !emoReady(parcalar)) return maxW === undefined ? stroke.call(this, s, x, y) : stroke.call(this, s, x, y, maxW);
    draw(this, parcalar, x, y, false);
  };
  C.measureText = function (s) {
    if (typeof s === "string") s = lang(s);
    const parcalar = partsOf(s);
    if (!parcalar || !emoReady(parcalar)) return measure.call(this, s);
    const E = fontPx(this.font) * EMO_SCALE;
    return { width: widths(this, parcalar, E).reduce((a, b) => a + b, 0) };
  };

})();

const EMO_SKIP = new Set(['SCRIPT', 'STYLE', 'OPTION', 'TEXTAREA', "TITLE"]);
function emoEl(cell)
{
  const sh = emoSheet(cell), S = EMOJI_SHEETS[sh], r = (cell & 65535) >> 4, c = cell & 15, el=document.createElement('i');
  el.className = sh ? 'emo fl' : 'emo';
  el.style.backgroundPosition = `${c / (S.cols - 1) * 100}% ${r / (S.rows - 1) * 100}%`;
  return el;
}
function emojifyText(n)
{
  const p = n.parentNode;
  if (!p || EMO_SKIP.has(p.nodeName)) return;
  const parcalar=emoSplit(n.nodeValue);
  if (!parcalar) return;
  const frag = document.createDocumentFragment();
  for (const q of parcalar) frag.append(typeof q === 'string' ? q : emoEl(q));
  p.replaceChild(frag, n);
}

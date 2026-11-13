  /* ===== Pedido: modelos reais, logo ao vivo, tamanhos item a item ===== */
  var AS = __ASSETS__;
  var CLEAN = [AS.tee.base, AS.polo.base, AS.polo2.base, AS.social.base, AS.jaleco.base, AS.set.base];
  var OV = __OV__;
  var SGMIN = { polo2: 10, social: 8 };
  var MIN = 80, KEY = 'uzza-pedido-v9', CW = 640, CH = 960;
  var LOOKS = [
    { n: 'Camisa social', c: 'Azul-claro', s: 'Manga longa, gola clássica', t: 'polo', rk: 'social', ti: 3, feat: true },
    { n: 'Jaleco', c: 'Azul royal', s: 'Manga longa, 3 bolsos', t: 'polo', rk: 'jaleco', ti: 4 },
    { n: 'Conjunto com faixa refletiva', c: 'Cinza', s: 'Camiseta manga longa e calça', t: 'polo', rk: 'set', ti: 5 },
    { n: 'Camiseta', c: 'Preta', s: 'Malha, gola careca', t: 'polo', rk: 'tee', ti: 0 },
    { n: 'Polo', c: 'Branca', s: 'Piquet, gola e botões', t: 'polo', rk: 'polo', ti: 1 },
    { n: 'Polo bicolor', c: 'Branca com azul Uzza', c2: 'Azul Uzza', s: 'Gola, carcela e punhos em outra cor', t: 'polo', rk: 'polo2', ti: 2, two: true }
  ];
  var PAL = {
    polo: [['#262a82', 'Azul Uzza'], ['#22345a', 'Azul-marinho'], ['#2f55a4', 'Azul royal'], ['#8fb4dc', 'Azul-celeste'], ['#f2f3f5', 'Branco'], ['#b4b8c0', 'Cinza-mescla'], ['#808080', 'Cinza Uzza'], ['#3d424c', 'Grafite'], ['#1e1f23', 'Preto'], ['#a8323a', 'Vermelho'], ['#6b2336', 'Bordô'], ['#d8742f', 'Laranja'], ['#d8ac3c', 'Amarelo'], ['#2f6b54', 'Verde']]
  };
  var TIPOS = [['bord', 'Bordado'], ['est', 'Estampa']];
  var SIZES = ['P', 'M', 'G', 'GG', 'XG'];
  function zero() { return { P: 0, M: 0, G: 0, GG: 0, XG: 0 }; }
  var draft = { look: 0, cor: '', cor2: '', tipo: 'bord', qty: zero(), editId: null };
  var LG = { raw: null, canvas: null, key: true, mono: null, size: 100 };
  var order = [], uid = 1, info = { nome: '', empresa: '', obs: '' };
  var IMG = [], ready = false, defLogo = {}, raf = 0, fabric = [], D = {}, CACHE = new Map();
  var cv = document.getElementById('tryCv'), cx = cv.getContext('2d', { willReadFrequently: true });
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sum(q) { return SIZES.reduce(function (s, k) { return s + (q[k] || 0); }, 0); }
  function sizesTxt(q) { return SIZES.filter(function (k) { return q[k] > 0; }).map(function (k) { return k + ' ' + q[k]; }).join(', '); }
  function nameOf(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v; }
  function logoTxt(d) { return 'Logo ' + (d.tipo === 'bord' ? 'bordada' : 'estampada'); }
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function store(save) {
    try { if (save) localStorage.setItem(KEY, JSON.stringify({ order: order, uid: uid, info: info })); else { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } } catch (e) { return null; }
  }

  /* ---------- cor: recoloração fotográfica em CIELAB ----------
     Regras:
     1) A luminância (L*) de cada pixel vem da própria fotografia (textura, dobras e luz reais).
     2) A cor escolhida define apenas a tonalidade e a luminosidade-base (a*, b*, L*) a partir do HEX.
     3) Toda troca parte da foto original; nada é acumulado. Resultado determinístico por (modelo, HEX).
     4) Só a máscara do tecido é alterada. Pele, cabelo, fundo, botões e objetos ficam intactos. */
  function rgbOf(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function lumHex(h) { var c = rgbOf(h); return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 255000; }
  var LIN = new Float32Array(256); for (var li = 0; li < 256; li++) { var cc = li / 255; LIN[li] = cc <= 0.04045 ? cc / 12.92 : Math.pow((cc + 0.055) / 1.055, 2.4); }
  function fLab(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787037 * t + 16 / 116; }
  function fInv(t) { var t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787037; }
  function enc8(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return c < 0 ? 0 : c > 1 ? 255 : Math.round(c * 255); }
  function hexToLab(h) {
    var c = rgbOf(h), r = LIN[c[0]], g = LIN[c[1]], b = LIN[c[2]];
    var X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b, Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
    var fx = fLab(X / 0.95047), fy = fLab(Y), fz = fLab(Z / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function labToLin(L, a, b) {
    var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, X = 0.95047 * fInv(fx), Y = fInv(fy), Z = 1.08883 * fInv(fz);
    return [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z];
  }
  function px(img) { var c = document.createElement('canvas'); c.width = CW; c.height = CH; var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, CW, CH); return x.getImageData(0, 0, CW, CH).data; }
  /* pré-processamento por modelo (uma vez): L* original de cada pixel do tecido e estatísticas robustas */
  function prepLook(key, bi, mi) {
    var base = px(bi), mk = px(mi), N = CW * CH, n = 0, i, j, z;
    for (i = 0; i < N; i++) if (mk[i * 4] > 2 || mk[i * 4 + 1] > 2) n++;
    var d = { base: base, n: n, idx: new Int32Array(n), A: new Float32Array(n), DN: new Float32Array(n), Z: new Uint8Array(n) }, Lo = new Float32Array(n);
    var hist = [new Float32Array(401), new Float32Array(401)], tot = [0, 0];
    for (i = 0, j = 0; i < N; i++) {
      var p = i * 4; if (mk[p] <= 2 && mk[p + 1] <= 2) continue;
      z = mk[p + 1] > mk[p] ? 1 : 0;
      var Y = 0.2126729 * LIN[base[p]] + 0.7151522 * LIN[base[p + 1]] + 0.0721750 * LIN[base[p + 2]], L = 116 * fLab(Y) - 16, a = Math.max(mk[p], mk[p + 1]) / 255;
      d.idx[j] = i; d.A[j] = a; d.Z[j] = z; Lo[j] = L;
      if (a > 0.9) { hist[z][Math.max(0, Math.min(400, Math.round(L * 4)))]++; tot[z]++; }
      j++;
    }
    function pct(z, q) { var s = 0, k; for (k = 0; k <= 400; k++) { s += hist[z][k]; if (s >= q * tot[z]) return k / 4; } return 100; }
    var fl = SGMIN[key] || 3, med = [pct(0, 0.5), pct(1, 0.5)], sg = [Math.max(fl, (pct(0, 0.84) - pct(0, 0.16)) / 2), Math.max(fl, (pct(1, 0.84) - pct(1, 0.16)) / 2)];
    for (j = 0; j < n; j++) { z = d.Z[j]; var dn = (Lo[j] - med[z]) / sg[z], lim = d.A[j] > 0.98 ? 3.2 : 2.0; d.DN[j] = dn > lim ? lim : dn < -lim ? -lim : dn; }
    /* descontaminação de borda, por zona: o contorno usa o sombreado do tecido interior vizinho da mesma zona */
    for (z = 0; z < 2; z++) {
      if (!tot[z]) continue;
      var bin = new Float32Array(N), intr = new Float32Array(N), num = new Float32Array(N);
      for (j = 0; j < n; j++) if (d.Z[j] === z) bin[d.idx[j]] = d.A[j] > 0.98 ? 1 : 0;
      var er = boxBlur(bin, 2);
      for (j = 0; j < n; j++) { if (d.Z[j] !== z) continue; var q = d.idx[j]; if (er[q] > 0.999) { intr[q] = 1; num[q] = d.DN[j]; } }
      var nb = boxBlur(num, 5), db = boxBlur(intr, 5);
      for (j = 0; j < n; j++) { if (d.Z[j] !== z) continue; var q2 = d.idx[j]; if (!intr[q2] && db[q2] > 0.02) d.DN[j] = Math.max(-2.2, Math.min(2.2, nb[q2] / db[q2])); }
    }
    D[key] = d;
  }
  function boxBlur(src, r) {
    var t = new Float32Array(CW * CH), o = new Float32Array(CW * CH), x, y, s, k, w = 2 * r + 1;
    for (y = 0; y < CH; y++) { s = 0; var row = y * CW; for (k = -r; k <= r; k++) s += src[row + Math.max(0, Math.min(CW - 1, k))]; for (x = 0; x < CW; x++) { t[row + x] = s / w; s += src[row + Math.min(CW - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; } }
    for (x = 0; x < CW; x++) { s = 0; for (k = -r; k <= r; k++) s += t[Math.max(0, Math.min(CH - 1, k)) * CW + x]; for (y = 0; y < CH; y++) { o[y * CW + x] = s / w; s += t[Math.min(CH - 1, y + r + 1) * CW + x] - t[Math.max(0, y - r) * CW + x]; } }
    return o;
  }
  /* tabela L* -> RGB para um HEX: mantém os eixos a e b do HEX, reduz croma em sombras/luzes e no limite do gamut */
  function buildLUT(hex) {
    var t = hexToLab(hex), Lt = t[0], lut = new Uint8ClampedArray(1002 * 3), k;
    for (k = 0; k <= 1001; k++) {
      var L = k / 10, cf = L < Lt ? Math.pow(Math.max(L, 0.01) / Math.max(Lt, 0.01), 0.6) : Math.pow(Math.max(0, 100 - L) / Math.max(100 - Lt, 1), 0.8);
      if (cf > 1) cf = 1; if (cf < 0.2 && Lt > 5 && Lt < 95) cf = Math.max(cf, 0.2);
      var rgb, tries = 0, s = cf;
      for (;;) { rgb = labToLin(L, t[1] * s, t[2] * s); if ((rgb[0] >= -0.0004 && rgb[0] <= 1.0004 && rgb[1] >= -0.0004 && rgb[1] <= 1.0004 && rgb[2] >= -0.0004 && rgb[2] <= 1.0004) || tries++ > 24) break; s *= 0.9; }
      lut[k * 3] = enc8(rgb[0]); lut[k * 3 + 1] = enc8(rgb[1]); lut[k * 3 + 2] = enc8(rgb[2]);
    }
    return { lut: lut, Lt: Lt };
  }
  function recolor(key, hex, hex2) {
    var d = D[key], cfg = [hex, hex2].map(function (h) {
      if (!h) return null;
      var B = buildLUT(h), Lt = B.Lt, st = 5 + 0.11 * Lt, kk = Math.max(0, Math.min(1, (Lt - 55) / 40)) * 0.95;
      return { lut: B.lut, st: st, center: Lt - kk * st };
    });
    var out = new Uint8ClampedArray(d.base), base = d.base, idx = d.idx, A = d.A, DN = d.DN, Z = d.Z, n = d.n;
    for (var j = 0; j < n; j++) {
      var c = cfg[Z[j]]; if (!c) continue;
      var dn = DN[j], x = c.center + (dn > 0 ? dn : dn * 0.7) * c.st;
      if (x > 94) x = 94 + 4.5 * Math.tanh((x - 94) / 4.5);
      if (x < 1.5) x = 1.5;
      var lut = c.lut, q = ((x * 10 + 0.5) | 0) * 3, p = idx[j] * 4, a = A[j], ia = 1 - a;
      out[p] = base[p] * ia + lut[q] * a; out[p + 1] = base[p + 1] * ia + lut[q + 1] * a; out[p + 2] = base[p + 2] * ia + lut[q + 2] * a;
    }
    return out;
  }
  function cacheGet(k) { var v = CACHE.get(k); if (v) { CACHE.delete(k); CACHE.set(k, v); } return v; }
  function cacheSet(k, v) { CACHE.set(k, v); while (CACHE.size > 10) CACHE.delete(CACHE.keys().next().value); }
  function drawBase() {
    var L = LOOKS[draft.look], key = L.rk;
    var c2 = L.two ? draft.cor2 : '';
    if ((draft.cor || c2) && key) {
      if (!D[key]) ensure(key);
      if (D[key]) {
        var ck = key + draft.cor + '|' + c2, im = cacheGet(ck);
        if (!im) { im = new ImageData(recolor(key, draft.cor, c2), CW, CH); cacheSet(ck, im); }
        cx.putImageData(im, 0, 0); return;
      }
    }
    cx.imageSmoothingQuality = 'high'; cx.drawImage(IMG[L.ti], 0, 0, CW, CH);
  }

  var loading = {};
  function ensure(key) {
    if (D[key] || loading[key]) return; loading[key] = 1;
    loadImg(AS[key].base).then(function (bi) { return loadImg(AS[key].mk).then(function (mi) { if (bi && mi) { prepLook(key, bi, mi); refresh(); } }); });
  }

  /* ---------- logo ao vivo sobre a foto real ---------- */
  var lc = document.createElement('canvas'); lc.width = CW; lc.height = CH; var lx = lc.getContext('2d', { willReadFrequently: true });
  function blurBox(src, w, h, r) {
    var t = new Float32Array(w * h), o = new Float32Array(w * h), x, y, i, k, a, n;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { a = 0; n = 0; for (k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < w) { a += src[y * w + xx]; n++; } } t[y * w + x] = a / n; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { a = 0; n = 0; for (k = -r; k <= r; k++) { var yy = y + k; if (yy >= 0 && yy < h) { a += t[yy * w + x]; n++; } } o[y * w + x] = a / n; }
    return o;
  }
  function fabricLum(P) {
    var x0 = Math.round(P.x / 100 * CW - 8), y0 = Math.round(P.y / 100 * CH - 8), d = cx.getImageData(Math.max(0, x0), Math.max(0, y0), 16, 16).data, s = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) { s += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 255000; n++; }
    return s / n;
  }
  function paint() {
    var im = IMG[ti()]; if (!im) return;
    drawBase();
    var emb = draft.tipo === 'bord', ovs = OV[ti()];
    fabric = [];
    ovs.forEach(function (P, oi) {
      var fl = fabricLum(P); fabric.push(fl);
      var img = LG.canvas || (fl < 0.5 ? defLogo.white : defLogo.navy);
      if (!img || !img.width) return;
      var w = P.w / 100 * CW * LG.size / 100, sc = LG.canvas ? Math.min(w / img.width, w * .62 / img.height) : w / img.width, bw = img.width * sc, bh = img.height * sc;
      var px = P.x / 100 * CW, py = P.y / 100 * CH;
      lx.clearRect(0, 0, CW, CH); lx.save(); lx.translate(px, py); lx.rotate(P.r * Math.PI / 180); lx.drawImage(img, -bw / 2, -bh / 2, bw, bh); lx.restore();
      var rad = Math.ceil(Math.max(bw, bh) * .75) + 6, x0 = Math.max(0, Math.round(px - rad)), y0 = Math.max(0, Math.round(py - rad)), x1 = Math.min(CW, Math.round(px + rad)), y1 = Math.min(CH, Math.round(py + rad)), lw = x1 - x0, lh = y1 - y0;
      var ld = lx.getImageData(x0, y0, lw, lh).data, bd = cx.getImageData(x0, y0, lw, lh), b = bd.data, A = new Float32Array(lw * lh), Y = new Float32Array(lw * lh), i, x, y;
      for (i = 0; i < lw * lh; i++) { A[i] = ld[i * 4 + 3] / 255; Y[i] = (b[i * 4] * 299 + b[i * 4 + 1] * 587 + b[i * 4 + 2] * 114) / 1000; }
      var Yb = blurBox(Y, lw, lh, 7), Lb = blurBox(A, lw, lh, 1);
      for (y = 3; y < lh - 3; y++) for (x = 3; x < lw - 3; x++) {
        i = y * lw + x; var p = i * 4, la = A[i], fold = Y[i] / Math.max(Yb[i], 6), s = Math.min(1.15, Math.max(0.72, 0.55 + 0.45 * fold)), gx = Lb[i + 1] - Lb[i - 1], gy = Lb[i + lw] - Lb[i - lw], e = (gx + gy) * 0.9;
        if (emb) {
          var shd = Lb[(y - 2) * lw + (x - 1)] * 0.45 * (1 - la);
          b[p] *= 1 - shd; b[p + 1] *= 1 - shd; b[p + 2] *= 1 - shd;
          b[p] += e * 26 * (1 - la); b[p + 1] += e * 26 * (1 - la); b[p + 2] += e * 26 * (1 - la);
        }
        if (la < 0.01) continue;
        var th = emb ? 0.92 + 0.08 * Math.sin((x * 0.8 + y * 1.6) * 2.4) : 0.97 + 0.03 * Math.sin((x + y) * 1.25), al = la * (emb ? 0.97 : 0.92), q = i * 4;
        var cr = ld[q] * s * th + (emb ? e * 70 : 0), cg = ld[q + 1] * s * th + (emb ? e * 70 : 0), cb = ld[q + 2] * s * th + (emb ? e * 70 : 0);
        b[p] = b[p] * (1 - al) + cr * al; b[p + 1] = b[p + 1] * (1 - al) + cg * al; b[p + 2] = b[p + 2] * (1 - al) + cb * al;
      }
      cx.putImageData(bd, x0, y0);
    });
  }
  function refresh() { if (!ready || raf) return; raf = requestAnimationFrame(function () { raf = 0; paint(); }); }
  function thumb() {
    if (!ready) return '';
    if (raf) { cancelAnimationFrame(raf); raf = 0; paint(); }
    var c = document.createElement('canvas'); c.width = 112; c.height = 187; c.getContext('2d').drawImage(cv, 0, 0, 112, 187);
    try { return c.toDataURL('image/jpeg', 0.75); } catch (e) { return ''; }
  }

  /* ---------- passos ---------- */
  function renderModels() {
    $('models').innerHTML = LOOKS.map(function (l, i) {
      return '<label class="mc' + (l.feat ? ' feat' : '') + '">' + (l.feat ? '<i class="badge">Em destaque</i>' : '') + '<input type="radio" name="md" value="' + i + '"' + (i === draft.look ? ' checked' : '') + '><img src="' + CLEAN[l.ti] + '" alt="' + esc(l.n + ' ' + l.s) + '" loading="lazy"><span><b>' + esc(l.n) + '</b><em>' + esc(l.s) + '</em></span></label>';
    }).join('') + '<a class="mc more" href="' + wa('Olá! Gostaria de ver outros modelos de uniformes além dos que aparecem no site.') + '" target="_blank" rel="noopener"><span class="mm" aria-hidden="true">+</span><span><b>Outros modelos</b><em>Fazemos muitos outros. Chame no WhatsApp</em></span></a>';
  }
  /* a prévia só fica fixa na tela depois que a pessoa clica num modelo (ou mexe nas opções) */
  var pinned = false, bld = document.querySelector('.builder'), pinBtn = $('pinBtn');
  function setPin(v) { pinned = v; bld.classList.toggle('pinned', v); if (pinBtn) { pinBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); pinBtn.textContent = v ? 'Soltar prévia' : 'Fixar prévia'; } }
  function pinOn() { if (!pinned) setPin(true); }
  if (pinBtn) pinBtn.addEventListener('click', function () { setPin(!pinned); });
  $('models').addEventListener('click', function (e) { if (e.target.closest('label.mc')) pinOn(); });
  ['optCor', 'optCor2', 'optTipo'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('click', function (e) { if (e.target.closest('label')) pinOn(); }); });
  $('models').addEventListener('change', function (e) { draft.look = +e.target.value; fixColor(); renderColors(); refresh(); updateAll(); });
  function radios(id, name, list, cur, onPick) {
    var el = $(id);
    el.innerHTML = list.map(function (it) { return '<label><input type="radio" name="' + name + '" value="' + it[0] + '"' + (cur === it[0] ? ' checked' : '') + '><span class="pill">' + esc(it[1]) + '</span></label>'; }).join('');
    el.onchange = function (e) { onPick(e.target.value); };
  }
  function palOf() { return PAL[LOOKS[draft.look].t]; }
  function ti() { return LOOKS[draft.look].ti; }
  function colName(h) { return nameOf(PAL.polo, h); }
  function nearest(hex, list) {
    var c = rgbOf(hex), best = list[0][0], bd = 1e9;
    list.forEach(function (it) { var q = rgbOf(it[0]), d = Math.pow(q[0] - c[0], 2) + Math.pow(q[1] - c[1], 2) + Math.pow(q[2] - c[2], 2); if (d < bd) { bd = d; best = it[0]; } });
    return best;
  }
  function fixColor() { if (draft.cor) draft.cor = nearest(draft.cor, palOf()); }
  function renderColors() {
    var L = LOOKS[draft.look], pal = palOf(), el = $('optCor');
    el.className = 'chips dots';
    el.innerHTML = '<label><input type="radio" name="cr" value=""' + (!draft.cor ? ' checked' : '') + '><span class="pill">Original</span></label>' +
      pal.map(function (it) { return '<label><input type="radio" name="cr" value="' + it[0] + '"' + (draft.cor === it[0] ? ' checked' : '') + '><span class="sw" title="' + esc(it[1]) + '"><i style="background:' + it[0] + '"></i><b>' + esc(it[1]) + '</b></span></label>'; }).join('');
    el.onchange = function (e) { draft.cor = e.target.value; refresh(); updateAll(); };
    $('cnCor').textContent = draft.cor ? colName(draft.cor) : L.c;
    var e2 = $('optCor2'); $('fsCor2').hidden = !L.two;
    if (L.two) {
      e2.className = 'chips dots';
      e2.innerHTML = '<label><input type="radio" name="cr2" value=""' + (!draft.cor2 ? ' checked' : '') + '><span class="pill">Original</span></label>' +
        pal.map(function (it) { return '<label><input type="radio" name="cr2" value="' + it[0] + '"' + (draft.cor2 === it[0] ? ' checked' : '') + '><span class="sw" title="' + esc(it[1]) + '"><i style="background:' + it[0] + '"></i><b>' + esc(it[1]) + '</b></span></label>'; }).join('');
      e2.onchange = function (ev) { draft.cor2 = ev.target.value; refresh(); updateAll(); };
      $('cnCor2').textContent = draft.cor2 ? colName(draft.cor2) : L.c2;
    }
  }
  function renderSteps() {
    renderModels(); renderColors(); radios('optTipo', 'tp', TIPOS, draft.tipo, function (v) { draft.tipo = v; refresh(); updateAll(); });
    SIZES.forEach(function (k) { $('q' + k).value = draft.qty[k]; }); updateAll();
  }
  $('logoSize').addEventListener('input', function (e) { LG.size = +e.target.value; refresh(); });
  $('sizes').innerHTML = SIZES.map(function (k) {
    return '<div class="sz"><b>' + k + '</b><div class="ctl"><button type="button" data-k="' + k + '" data-d="-1" aria-label="Menos ' + k + '">−</button>' +
      '<input id="q' + k + '" type="number" min="0" step="1" inputmode="numeric" value="0" aria-label="Quantidade ' + k + '">' +
      '<button type="button" data-k="' + k + '" data-d="1" aria-label="Mais ' + k + '">+</button></div></div>';
  }).join('');
  $('sizes').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var k = b.getAttribute('data-k'); draft.qty[k] = Math.max(0, draft.qty[k] + (+b.getAttribute('data-d')) * (e.shiftKey ? 10 : 1));
    $('q' + k).value = draft.qty[k]; updateAll();
  });
  $('sizes').addEventListener('input', function (e) {
    var el = e.target; if (el.tagName !== 'INPUT') return;
    var k = el.id.slice(1); draft.qty[k] = Math.max(0, parseInt(el.value, 10) || 0); updateAll();
  });
  $('quick').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var n = +b.getAttribute('data-n'); SIZES.forEach(function (k) { draft.qty[k] = n === 0 ? 0 : draft.qty[k] + n; $('q' + k).value = draft.qty[k]; }); updateAll();
  });

  /* ---------- logo do cliente ---------- */
  var file = $('logoFile'), clr = $('logoClear'), lh = $('logoHint'), bgw = $('bgWrap'), bgk = $('bgKey');
  function prepLogo() {
    var img = LG.raw; if (!img) return;
    var s = Math.min(1, 800 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
    var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    var id = x.getImageData(0, 0, w, h), d = id.data, n = w * h, opaque = 0, i;
    for (i = 0; i < n; i++) if (d[i * 4 + 3] > 245) opaque++;
    var hasBg = opaque / n > 0.97 && Math.min(d[0], d[1], d[2]) > 215;
    bgw.hidden = !hasBg;
    if (hasBg && LG.key) for (i = 0; i < n; i++) { var m = 255 - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); d[i * 4 + 3] = Math.max(0, Math.min(255, (m - 16) * 255 / 50)); }
    if (LG.mono) { var v = LG.mono === 'white' ? 250 : 20; for (i = 0; i < n; i++) { d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; } }
    var x0 = w, y0 = h, x1 = 0, y1 = 0, yy, xx;
    for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    if (x1 <= x0 || y1 <= y0) { LG.canvas = null; return; }
    x.putImageData(id, 0, 0);
    var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d', { willReadFrequently: true }).drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    LG.canvas = o;
  }
  function logoLum() {
    var c = LG.canvas; if (!c) return null;
    var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = Math.max(1, Math.floor(c.width / 48)), t = 0, n = 0;
    for (var y = 0; y < c.height; y += s) for (var xx = 0; xx < c.width; xx += s) { var p = (y * c.width + xx) * 4; if (d[p + 3] > 128) { t += (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 255000; n++; } }
    return n ? t / n : null;
  }
  file.addEventListener('change', function () {
    var f = file.files && file.files[0]; if (!f) return;
    if (f.size > 6 * 1024 * 1024) { lh.textContent = 'Arquivo grande demais para a prévia. Use um de até 6 MB.'; return; }
    var r = new FileReader();
    r.onload = function () { loadImg(r.result).then(function (im) { if (!im) { lh.textContent = 'Não foi possível ler esse arquivo. Tente PNG ou JPG.'; return; } LG.raw = im; LG.mono = null; prepLogo(); clr.hidden = false; lh.textContent = 'Prévia ao vivo com a sua logo. O arquivo vai pelo WhatsApp.'; refresh(); updateAll(); }); };
    r.readAsDataURL(f);
  });
  bgk.addEventListener('change', function () { LG.key = bgk.checked; prepLogo(); refresh(); updateAll(); });
  clr.addEventListener('click', function () { LG.canvas = null; LG.raw = null; LG.mono = null; file.value = ''; clr.hidden = true; bgw.hidden = true; lh.textContent = 'A prévia mostra a logo da Uzza até você enviar a sua.'; refresh(); updateAll(); });
  $('logoWarn').addEventListener('click', function (e) { if (e.target.id === 'monoBtn') { LG.mono = (fabric[0] || 0.5) < 0.5 ? 'white' : 'dark'; prepLogo(); refresh(); updateAll(); } });

  /* ---------- pedido ---------- */
  function updateAll() {
    var n = sum(draft.qty), editing = draft.editId !== null, L = LOOKS[draft.look];
    $('cnCor').textContent = draft.cor ? colName(draft.cor) : L.c; if (L.two) $('cnCor2').textContent = draft.cor2 ? colName(draft.cor2) : L.c2;
    $('cap').textContent = L.n + ' · ' + colTxt(draft).slice(3).toLowerCase() + '. ' + logoTxt(draft) + (LG.canvas ? ' com a sua logo.' : ' da Uzza.');
    $('itemTotal').textContent = n ? n + (n === 1 ? ' peça neste item' : ' peças neste item') : 'Informe a quantidade em ao menos um tamanho.';
    $('addBtn').disabled = n === 0;
    $('addBtn').textContent = editing ? 'Salvar alterações no item' : 'Adicionar ao pedido';
    $('cancelEdit').hidden = !editing; $('stepBadge').hidden = !editing;
    var ll = logoLum(), warn = $('logoWarn'), fl = fabric[0];
    if (ll !== null && fl !== undefined && Math.abs(ll - fl) < 0.28) { warn.hidden = false; warn.innerHTML = 'Pouco contraste entre a logo e a peça. <button type="button" class="link" id="monoBtn">' + (fl < 0.5 ? 'Deixar a logo branca' : 'Deixar a logo escura') + '</button>'; } else warn.hidden = true;
  }
  function total() { return order.reduce(function (s, it) { return s + sum(it.qty); }, 0); }
  function itemName(it) { return LOOKS[it.look].n; }
  function colTxt(it) { var l = LOOKS[it.look]; if (!l.two) return ' · ' + (it.cor ? colName(it.cor) : l.c); return ' · ' + (it.cor ? colName(it.cor) : 'Branca') + ', gola e punhos ' + (it.cor2 ? colName(it.cor2) : l.c2); }
  function renderOrder() {
    var t = total(), list = $('ordList');
    $('ordEmpty').hidden = order.length > 0; $('ordBody').hidden = order.length === 0;
    $('ordCount').textContent = order.length ? order.length + (order.length === 1 ? ' item' : ' itens') + ' · ' + t + ' peças' : '';
    list.innerHTML = order.map(function (it, n) {
      var th = it.thumb ? '<img src="' + it.thumb + '" alt="" width="56" height="93">' : '<span class="nothumb"></span>';
      return '<li class="oi" data-id="' + it.id + '">' + th + '<div class="oi-main"><b>' + (n + 1) + '. ' + esc(itemName(it)) + esc(colTxt(it)) + '</b><span>' + esc(logoTxt(it)) + ' · ' + esc(LOOKS[it.look].s) + '</span>' +
        '<span class="szs">' + SIZES.filter(function (k) { return it.qty[k] > 0; }).map(function (k) { return '<em>' + k + ' <strong>' + it.qty[k] + '</strong></em>'; }).join('') + '</span>' +
        '<span class="oi-act"><button type="button" class="link" data-a="edit">Editar</button><button type="button" class="link" data-a="dup">Duplicar</button><button type="button" class="link danger" data-a="del">Remover</button></span></div>' +
        '<div class="oi-q"><b>' + sum(it.qty) + '</b><span>peças</span></div></li>';
    }).join('');
    var pct = Math.min(100, Math.round(t / MIN * 100));
    $('ordBar').style.width = pct + '%'; $('ordMeter').classList.toggle('ok', t >= MIN);
    $('ordTotal').textContent = t;
    $('ordNote').textContent = t >= MIN ? 'Pedido mínimo de ' + MIN + ' peças atingido.' : 'Faltam ' + (MIN - t) + ' peças para o pedido mínimo de ' + MIN + '. Você ainda pode enviar o orçamento.';
    $('ordNote').className = 'hint ' + (t >= MIN ? 'okt' : 'warn');
    var nav = $('navPedido'); nav.hidden = order.length === 0; nav.textContent = 'Pedido · ' + t + ' peças';
    renderQuote();
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
  function quoteText() {
    var L = [], t = total();
    L.push('*Solicitação de orçamento · Uzza Uniformes*'); L.push('');
    L.push('Prezados, ' + greeting().toLowerCase() + '.'); L.push('');
    L.push('Gostaria de solicitar um orçamento de uniformes' + (info.empresa ? ' para a ' + info.empresa : '') + ', conforme os itens abaixo.'); L.push('');
    order.forEach(function (it, n) {
      L.push((n + 1) + ') ' + itemName(it) + colTxt(it));
      L.push('    ' + logoTxt(it));
      L.push('    Tamanhos: ' + sizesTxt(it.qty) + ' · Total: ' + sum(it.qty) + ' peças');
    });
    L.push(''); L.push('*Total do pedido: ' + t + ' peças*');
    if (info.obs) { L.push(''); L.push('Observações: ' + info.obs); }
    L.push(''); L.push(LG.canvas ? 'A logo da empresa será enviada em arquivo nesta conversa.' : 'Posso enviar a logo da empresa em arquivo nesta conversa.');
    L.push('Fico no aguardo do valor, do prazo de produção e das condições de pagamento.');
    L.push(''); L.push('Atenciosamente,'); L.push(info.nome || '[seu nome]'); if (info.empresa) L.push(info.empresa);
    return L.join('\n');
  }
  function renderQuote() {
    var t = total(), d = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    $('qDate').textContent = d;
    $('qRows').innerHTML = order.map(function (it, n) {
      return '<tr><td>' + (n + 1) + '</td><td><b>' + esc(itemName(it)) + '</b><br><span>' + esc(colTxt(it).slice(3)) + ' · ' + esc(logoTxt(it)) + '</span></td><td>' + esc(sizesTxt(it.qty)) + '</td><td class="r">' + sum(it.qty) + '</td></tr>';
    }).join('');
    $('qTotal').textContent = t;
    $('qLogo').textContent = LG.canvas ? 'A logo da empresa será enviada em arquivo na conversa.' : 'Logo da empresa a enviar em arquivo na conversa.';
    $('qSend').href = wa(quoteText());
  }
  $('ordList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var li = b.closest('.oi'), id = +li.getAttribute('data-id'), idx = order.findIndex(function (x) { return x.id === id; }), it = order[idx], a = b.getAttribute('data-a');
    if (a === 'del') { order.splice(idx, 1); if (draft.editId === id) draft.editId = null; store(true); renderOrder(); updateAll(); }
    if (a === 'dup') { var c = JSON.parse(JSON.stringify(it)); c.id = uid++; order.splice(idx + 1, 0, c); store(true); renderOrder(); }
    if (a === 'edit') { draft.look = it.look; draft.cor = it.cor || ''; draft.cor2 = it.cor2 || ''; draft.tipo = it.tipo; draft.qty = JSON.parse(JSON.stringify(it.qty)); draft.editId = id; renderSteps(); refresh(); $('montar').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('addBtn').addEventListener('click', function () {
    var n = sum(draft.qty); if (!n) return;
    var it = { id: draft.editId !== null ? draft.editId : uid++, look: draft.look, cor: draft.cor, cor2: LOOKS[draft.look].two ? draft.cor2 : '', tipo: draft.tipo, qty: JSON.parse(JSON.stringify(draft.qty)), thumb: thumb() };
    if (draft.editId !== null) { var i = order.findIndex(function (x) { return x.id === draft.editId; }); if (i >= 0) order[i] = it; else order.push(it); } else order.push(it);
    var was = draft.editId !== null; draft.editId = null; draft.qty = zero(); store(true);
    renderSteps(); renderOrder(); toast(was ? 'Item atualizado.' : 'Item adicionado ao pedido.');
  });
  $('cancelEdit').addEventListener('click', function () { draft.editId = null; draft.qty = zero(); renderSteps(); });
  $('clearOrder').addEventListener('click', function () { if (!order.length) return; order = []; store(true); renderOrder(); toast('Pedido limpo.'); });
  var tt = 0;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  ['qNome', 'qEmpresa', 'qObs'].forEach(function (id) {
    $(id).addEventListener('input', function () { info.nome = $('qNome').value.trim(); info.empresa = $('qEmpresa').value.trim(); info.obs = $('qObs').value.trim(); store(true); renderQuote(); });
  });
  $('qSend').addEventListener('click', function (e) {
    if (!info.nome) { e.preventDefault(); $('qNome').focus(); $('qNomeErr').hidden = false; return; }
    $('qNomeErr').hidden = true;
  });
  $('qCopy').addEventListener('click', function () {
    var txt = quoteText();
    function fallback() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Texto copiado.'); } catch (e) { toast('Não foi possível copiar.'); } document.body.removeChild(ta); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Texto copiado.'); }, fallback); else fallback();
  });

  /* ---------- início ---------- */
  var saved = store(false);
  if (saved && saved.order && saved.order.length) { order = saved.order.filter(function (it) { return typeof it.look === 'number' && LOOKS[it.look]; }); uid = saved.uid || (order.length + 1); info = saved.info || info; $('qNome').value = info.nome || ''; $('qEmpresa').value = info.empresa || ''; $('qObs').value = info.obs || ''; }
  renderSteps(); renderOrder();
  /*DEBUG_START*/ window.__uzza = { setColor: function (h) { draft.cor = h; refresh(); }, setColor2: function (h) { draft.cor2 = h; refresh(); }, setLook: function (i) { draft.look = i; fixColor(); renderColors(); refresh(); }, loaded: function (k) { return !!D[k]; }, ensure: ensure, LOOKS: LOOKS, PAL: PAL, cacheSize: function () { return CACHE.size; }, D: D, recolor: recolor, hexToLab: hexToLab, LIN: LIN, fLab: fLab, CW: CW, CH: CH }; /*DEBUG_END*/
  Promise.all(CLEAN.map(loadImg)).then(function (r) { IMG = r; return Promise.all([loadImg(LOGO_WHITE), loadImg(LOGO_NAVY)]); }).then(function (r) { defLogo.white = r[0]; defLogo.navy = r[1]; ready = true; refresh(); });
})();

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
    var base = px(bi), mk = px(mi), N = CW * CH, n = 0, i, j;
    for (i = 0; i < N; i++) if (mk[i * 4] > 2) n++;
    var d = { base: base, n: n, idx: new Int32Array(n), A: new Float32Array(n), DN: new Float32Array(n) }, Lo = new Float32Array(n), hist = new Float32Array(401), tot = 0;
    for (i = 0, j = 0; i < N; i++) {
      var p = i * 4; if (mk[p] <= 2) continue;
      var Y = 0.2126729 * LIN[base[p]] + 0.7151522 * LIN[base[p + 1]] + 0.0721750 * LIN[base[p + 2]], L = 116 * fLab(Y) - 16, a = mk[p] / 255;
      d.idx[j] = i; d.A[j] = a; Lo[j] = L;
      if (a > 0.9) { hist[Math.max(0, Math.min(400, Math.round(L * 4)))]++; tot++; }
      j++;
    }
    function pct(q) { var s = 0, k; for (k = 0; k <= 400; k++) { s += hist[k]; if (s >= q * tot) return k / 4; } return 100; }
    var med = pct(0.5), sg = Math.max(3, (pct(0.84) - pct(0.16)) / 2);
    for (j = 0; j < n; j++) { var dn = (Lo[j] - med) / sg, lim = d.A[j] > 0.98 ? 3.2 : 2.0; d.DN[j] = dn > lim ? lim : dn < -lim ? -lim : dn; }
    D[key] = d;
  }
  /* tabela L* -> RGB para um HEX: mantém a*/b* do HEX, reduz croma em sombras/luzes e no limite do gamut */
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
  function recolor(key, hex) {
    var d = D[key], B = buildLUT(hex), lut = B.lut, Lt = B.Lt;
    var st = 5 + 0.11 * Lt, kk = Math.max(0, Math.min(1, (Lt - 55) / 40)) * 0.95, center = Lt - kk * st;
    var out = new Uint8ClampedArray(d.base), base = d.base, idx = d.idx, A = d.A, DN = d.DN, n = d.n;
    for (var j = 0; j < n; j++) {
      var dn = DN[j], x = center + (dn > 0 ? dn : dn * 0.7) * st;
      if (x > 94) x = 94 + 4.5 * Math.tanh((x - 94) / 4.5);
      if (x < 1.5) x = 1.5;
      var q = ((x * 10 + 0.5) | 0) * 3, p = idx[j] * 4, a = A[j], ia = 1 - a;
      out[p] = base[p] * ia + lut[q] * a; out[p + 1] = base[p + 1] * ia + lut[q + 1] * a; out[p + 2] = base[p + 2] * ia + lut[q + 2] * a;
    }
    return out;
  }
  function cacheGet(k) { var v = CACHE.get(k); if (v) { CACHE.delete(k); CACHE.set(k, v); } return v; }
  function cacheSet(k, v) { CACHE.set(k, v); while (CACHE.size > 10) CACHE.delete(CACHE.keys().next().value); }
  function drawBase() {
    var L = LOOKS[draft.look], key = L.rk;
    if (draft.cor && key) {
      if (!D[key]) ensure(key);
      if (D[key]) {
        var ck = key + draft.cor, im = cacheGet(ck);
        if (!im) { im = new ImageData(recolor(key, draft.cor), CW, CH); cacheSet(ck, im); }
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


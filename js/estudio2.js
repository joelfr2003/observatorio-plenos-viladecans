/* Observatorio de plenos · Estudio profesional (v7)
   Sustituye la pestaña «Estudio» por un módulo con:
   Panorama · Mi grupo · Gobierno/oposición · Mociones · Temas · Calidad de datos · Metodología.
   Rigor estadístico: intervalos de Wilson, contraste de dos proporciones, afinidad sobre votaciones
   NO unánimes, bloques por clustering jerárquico y avisos de muestra pequeña.
   Se carga después del script principal y reutiliza sus funciones globales (D, G, fp, legOf, cat, nv, apr…). */
(function () {
"use strict";

/* ====================== Estado de la interfaz ====================== */
var S = { tab: "pan", grupo: "", solo: true, mq: "", tc: "", mres: "", mprop: "", msort: "apoyo", qsev: "", tq: "" };
try {
  S.grupo = localStorage.getItem("obs-mi-grupo") || "";
  var so = localStorage.getItem("obs-solo-plenos");
  if (so !== null) S.solo = so === "1";
} catch (e) {}

var MINP = 5;      // votaciones mínimas para comparar dos grupos
var MINSMALL = 10; // por debajo se avisa de muestra pequeña

/* ====================== Temas ====================== */
var TOP = [
  ["Urbanismo y vivienda", /urban|planejament|planeamiento|llic[eè]ncia|licencia|habitatge|vivienda|\bsolar|\bpgm\b|modificaci[oó] puntual|zona verda|edific|\bobr(a|es|as)\b|pla parcial|pla especial|reparcel/i],
  ["Hacienda y presupuestos", /pressupost|presupuesto|ordenan[cç]a|ordenanza|impost|impuesto|tribut|\btaxa|\btasa|cr[eè]dit|cr[eé]dito|comptes|cuenta general|\bibi\b|fiscal|subvenci|endeutament|tresoreria|extrajudicial|factures/i],
  ["Contratación y servicios públicos", /contract|licitaci|concessi|concesi[oó]n|adjudicaci|subministr|suministro|\bservei|\bservicio|encàrrec|encargo|viqual|vimed|vigem/i],
  ["Servicios sociales y derechos", /social|\bajut|\bayuda|depend[eè]ncia|pobres|fam[ií]li|igualtat|igualdad|feminis|migra|inclusi|violència|violencia/i],
  ["Medio ambiente y movilidad", /medi ambient|medio ambiente|mobilitat|movilidad|transport|clima|residu|energ|\bverd|arbrat|\bzbe\b|bicicleta|\baigua|\bagua/i],
  ["Seguridad y convivencia", /seguretat|seguridad|polic[ií]a|guardia|incivisme|civismo|convivencia/i],
  ["Cultura, educación y deporte", /cultur|educaci|escola|escuela|esport|deport|biblioteca|\bfesta|\bfiesta|joventut|juventud/i],
  ["Participación y transparencia", /participaci|transpar|consell de ciutat|consejo de ciudad|bon govern|buen gobierno/i],
  ["Organización y personal", /personal|plantilla|retribu|reglament|reglamento|regidor|concejal|dedicaci|assignaci|asignaci|comissi|comisi|nomenament|nombramiento|estatut|conveni|convenio/i]
];
var TEMAS = TOP.map(function (t) { return t[0]; }).concat(["Otros"]);
function topic(a) { a = String(a || ""); for (var i = 0; i < TOP.length; i++) if (TOP[i][1].test(a)) return TOP[i][0]; return "Otros"; }

/* ====================== Utilidades ====================== */
function sh(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
function Q(f) { return f.slice(0, 4) + "T" + Math.ceil(+f.slice(5, 7) / 3); }
function isPle(p) { var c = cat(p); return !/^Junta\s*·/i.test(c) && !/^(VIQUAL|VIMED|VIGEM)$/i.test(c); }
function scope() { var L = fp(); return TP ? L : (S.solo ? L.filter(isPle) : L); }
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
function pct(x) { return x == null ? "–" : Math.round(x * 100) + " %"; }

function wilson(k, n, z) {
  z = z || 1.96; if (!n) return null;
  var p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}
function prop(k, n) { var w = wilson(k, n); return { k: k, n: n, p: n ? k / n : null, lo: w ? w[0] : null, hi: w ? w[1] : null }; }
function fP(o) { return o.n ? Math.round(o.p * 100) + " %" : "–"; }
function fCI(o) { return o.n ? "IC 95 %: " + Math.round(o.lo * 100) + "–" + Math.round(o.hi * 100) + " %" : ""; }
function pS(o) { return fP(o) + (o.n && o.n < MINSMALL ? ' <span class="ep-warn" title="Muestra pequeña: interpretar con cautela">⚠</span>' : "") + (o.n ? ' <span class="ep-ci">(' + o.k + "/" + o.n + ")</span>" : ""); }

function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
function pTwo(z) { return 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2))); }
function z2(k1, n1, k2, n2) {
  if (!n1 || !n2) return null; var p = (k1 + k2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); if (!se) return null;
  var z = (k1 / n1 - k2 / n2) / se; return { z: z, p: pTwo(z) };
}
function fPv(p) { return p < 0.001 ? "p < 0,001" : "p = " + p.toFixed(3).replace(".", ","); }

/* ====================== Datos: registros de votación ====================== */
function seatOf(l, k) {
  var g = G.find(function (x) { return x.id == l; }), r = g && (g.grupos || []).find(function (x) { return String(x.partido).toLowerCase() == String(k).toLowerCase(); });
  return r ? +r.concejales || 0 : 0;
}
function gobOf(l) { var g = G.find(function (x) { return x.id == l; }); return ((g && g.gobierno) || []).map(function (x) { return String(x).toLowerCase(); }); }
function isGov(l, k) { return gobOf(l).indexOf(String(k).toLowerCase()) > -1; }
function propsOf(v) { return String(v.proponente || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
function isMo(v) { return propsOf(v).length > 0 && (v.clase || "Moción") == "Moción"; }

function rec(p, v, l, j) {
  var f = +v.favor || 0, c = +v.contra || 0, a = +v.abst || 0, q = v.partidos || {}, ds = v.desglose || {}, g = {};
  Object.keys(q).forEach(function (k) {
    var s = q[k], r = { f: 0, c: 0, a: 0, pos: "" };
    if (s === "dividido") { var d = ds[k] || {}; r.f = +d.favor || 0; r.c = +d.contra || 0; r.a = +d.abst || 0; r.pos = "div"; }
    else { var x = nv(s); if (!x) return; var n = seatOf(l, k) || 1; r[x === "favor" ? "f" : x === "contra" ? "c" : "a"] = n; r.pos = x; }
    g[k] = r;
  });
  if (!(f || c || a)) Object.keys(g).forEach(function (k) { f += g[k].f; c += g[k].c; a += g[k].a; });
  var t = f + c + a, pr = propsOf(v);
  return { p: p, v: v, l: l, i: D.indexOf(p), j: j, f: f, c: c, a: a, t: t, ok: apr(v), un: t > 0 && !c && !a, g: g,
    tema: v.tema || topic(v.asunto), prop: pr, mo: isMo(v) };
}
function recs(ses) {
  var R = [];
  ses.forEach(function (p) { var l = legOf(p.fecha); (p.votaciones || []).forEach(function (v, j) { if (!nov(v)) R.push(rec(p, v, l, j)); }); });
  return R;
}
function govDir(r) {
  var gf = 0, gc = 0; Object.keys(r.g).forEach(function (k) { if (isGov(r.l, k)) { gf += r.g[k].f; gc += r.g[k].c; } });
  return gf > gc ? "f" : gc > gf ? "c" : "";
}
function tight(r) { return r.ok && !r.un && r.t > 0 && (r.f - r.c) <= Math.max(2, Math.round(r.t * 0.1)); }

/* ====================== Indicadores ====================== */
function summary(R) {
  var n = R.length, ap = 0, un = 0, sc = 0, ti = 0;
  R.forEach(function (r) { if (r.ok) ap++; if (r.un) un++; if (r.c > 0) sc++; if (tight(r)) ti++; });
  return { n: n, ap: prop(ap, n), un: prop(un, n), sc: prop(sc, n), ti: prop(ti, n), apro: ap, unan: un };
}
function groupStats(R) {
  var g = {};
  R.forEach(function (r) {
    Object.keys(r.g).forEach(function (k) {
      var x = r.g[k], o = g[k] || (g[k] = { k: k, n: 0, rn: 0, rs: 0, dv: 0, pv: 0, w: 0, d: 0, wN: 0, dN: 0, fa: 0, co: 0, ab: 0 });
      o.n++;
      if (x.pos === "div") o.dv++; else if (x.pos === "favor") o.fa++; else if (x.pos === "contra") o.co++; else if (x.pos === "abst") o.ab++;
      if (x.f + x.c > 0) { o.rn++; o.rs += Math.abs(x.f - x.c) / (x.f + x.c); }
      var dir = x.f > x.c ? "f" : x.c > x.f ? "c" : "";
      if (dir) { o.d++; if ((dir === "f") === r.ok) o.w++; if (!r.un) { o.dN++; if ((dir === "f") === r.ok) o.wN++; } }
      if ((x.f > 0 && r.ok && r.f - x.f <= r.c) || (x.c > 0 && !r.ok && r.c - x.c < r.f)) o.pv++;
    });
  });
  return g;
}
function affinity(R, onlyNon) {
  var A = {};
  R.forEach(function (r) {
    if (onlyNon && r.un) return;
    var ks = Object.keys(r.g).filter(function (k) { return r.g[k].pos && r.g[k].pos !== "div"; });
    ks.forEach(function (a) { ks.forEach(function (b) {
      if (a === b) return; var row = A[a] || (A[a] = {}), o = row[b] || (row[b] = { s: 0, t: 0 }); o.t++; if (r.g[a].pos === r.g[b].pos) o.s++;
    }); });
  });
  return A;
}
function pairs(A, min) {
  var P = []; Object.keys(A).forEach(function (a) { Object.keys(A[a]).forEach(function (b) {
    var o = A[a][b]; if (a < b && o.t >= min) P.push({ a: a, b: b, s: o.s, t: o.t, o: prop(o.s, o.t) });
  }); });
  return P.sort(function (x, y) { return y.o.p - x.o.p; });
}
function polar(A) { var P = pairs(A, MINP); return P.length ? mean(P.map(function (x) { return 1 - x.o.p; })) : null; }
function blocks(A, keys, thr, min) {
  var cl = keys.map(function (k) { return [k]; });
  function dist(x, y) { var s = 0, n = 0; x.forEach(function (a) { y.forEach(function (b) { var o = A[a] && A[a][b]; if (o && o.t >= min) { s += 1 - o.s / o.t; n++; } }); }); return n ? s / n : Infinity; }
  for (;;) {
    var best = null;
    for (var i = 0; i < cl.length; i++) for (var j = i + 1; j < cl.length; j++) { var d = dist(cl[i], cl[j]); if (d <= thr && (!best || d < best.d)) best = { i: i, j: j, d: d }; }
    if (!best) break; cl[best.i] = cl[best.i].concat(cl[best.j]); cl.splice(best.j, 1);
  }
  return cl;
}
function byQuarter(R) { var by = {}; R.forEach(function (r) { (by[Q(r.p.fecha)] = by[Q(r.p.fecha)] || []).push(r); }); return by; }
function halves(R) {
  var s = R.slice().sort(function (a, b) { return a.p.fecha.localeCompare(b.p.fecha); }), h = Math.floor(s.length / 2);
  return [s.slice(0, h), s.slice(h)];
}

/* ====================== Calidad de datos ====================== */
function quality() {
  var I = [], seen = {}, nVot = 0, badKey = {}, withG = 0;
  D.forEach(function (p, i) {
    var key = p.fecha + "|" + cat(p), l = legOf(p.fecha), vs = p.votaciones || [];
    if (seen[key]) I.push({ s: "error", i: i, p: p, msg: "Sesión duplicada (misma fecha y tipo)." }); seen[key] = 1;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || "")) I.push({ s: "error", i: i, p: p, msg: "Fecha no válida." });
    else if (!l) I.push({ s: "error", i: i, p: p, msg: "La fecha no pertenece a ninguna legislatura definida." });
    if (!vs.length) I.push({ s: "info", i: i, p: p, msg: "Sesión sin puntos cargados." });
    if (!p.url && !p.acta) I.push({ s: "info", i: i, p: p, msg: "Sin enlace al acta ni PDF adjunto." });
    var pts = {}, known = {};
    ((G.find(function (g) { return g.id == l; }) || {}).grupos || []).forEach(function (x) { known[String(x.partido).toLowerCase()] = 1; });
    vs.forEach(function (v, j) {
      var b = { i: i, j: j, p: p, v: v }, add = function (s, m) { var o = Object.assign({ s: s, msg: m }, b); I.push(o); if (s === "error") badKey[i + ":" + j] = 1; };
      var pk = String(v.punto); if (pts[pk]) add("error", "Punto " + pk + " duplicado en la sesión."); pts[pk] = 1;
      if (!String(v.asunto || "").trim()) add("error", "Punto sin asunto.");
      if (nov(v)) return;
      nVot++;
      var f = +v.favor || 0, c = +v.contra || 0, a = +v.abst || 0, r = res(v), q = v.partidos || {}, kq = Object.keys(q);
      if (!(f || c || a)) add("error", "Votación con resultado pero sin recuento de votos.");
      else {
        if (/^aprob/i.test(r) && c > f) add("error", "Marcada como aprobada pero hay más votos en contra (" + c + ") que a favor (" + f + ").");
        if (/^rechaz/i.test(r) && f > c) add("error", "Marcada como rechazada pero hay más votos a favor (" + f + ") que en contra (" + c + ").");
        if (/^aprob/i.test(r) && f === c) add("aviso", "Empate a votos marcado como aprobado (¿voto de calidad del alcalde?). Revísalo.");
      }
      if (!kq.length) add("aviso", "Sin desglose por grupo: esta votación no cuenta en los análisis por grupo.");
      else {
        withG++;
        var sinDes = false, sum = [0, 0, 0];
        kq.forEach(function (k) {
          if (!known[k.toLowerCase()] && Object.keys(known).length) add("aviso", "El grupo «" + k + "» no figura en la composición de la legislatura (¿errata en el nombre?).");
          if (q[k] === "dividido") { var d = (v.desglose || {})[k]; if (!d) { sinDes = true; add("aviso", "Grupo «" + k + "» dividido sin reparto de votos."); } else { sum[0] += +d.favor || 0; sum[1] += +d.contra || 0; sum[2] += +d.abst || 0; } }
          else { var x = nv(q[k]); if (x) sum["favor,contra,abst".split(",").indexOf(x)] += seatOf(l, k) || 1; }
        });
        if (!sinDes && (f || c || a)) {
          var tot = [f, c, a];
          if (sum.some(function (x, n) { return x > tot[n]; })) add("error", "Los grupos suman más votos (" + sum.join("/") + ") que el recuento total (" + tot.join("/") + ").");
          else if (sum.some(function (x, n) { return x < tot[n]; })) add("info", "Los grupos suman " + sum.join("/") + " frente al recuento " + tot.join("/") + " (puede deberse a ausencias o a composición incompleta).");
        }
      }
      propsOf(v).forEach(function (k) { if (Object.keys(known).length && !known[k.toLowerCase()]) add("aviso", "Proponente «" + k + "» no figura en la legislatura."); });
    });
  });
  G.forEach(function (g) {
    var used = D.some(function (p) { return legOf(p.fecha) == g.id; });
    if (used && !(g.grupos || []).length) I.push({ s: "aviso", i: -1, msg: "Legislatura " + g.id + " con sesiones pero sin composición registrada (se pierde el peso de cada grupo)." });
    if (used && (g.grupos || []).length && !(g.gobierno || []).length) I.push({ s: "info", i: -1, msg: "Legislatura " + g.id + ": equipo de gobierno sin definir (activa el análisis gobierno/oposición)." });
  });
  var nErr = Object.keys(badKey).length;
  return { I: I, nVot: nVot, nErr: nErr, withG: withG, score: nVot ? Math.round((nVot - nErr) / nVot * 100) : null, cover: nVot ? Math.round(withG / nVot * 100) : null };
}

/* ====================== Gráficos SVG ====================== */
function pl(seg, c) { return '<polyline fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linejoin="round" points="' + seg.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>'; }
function lines(ss, ls) {
  var x0 = 44, x1 = 506, X = function (i) { return ls.length > 1 ? x0 + i * (x1 - x0) / (ls.length - 1) : (x0 + x1) / 2; }, Y = function (v) { return 180 - v * 1.6; };
  var o = '<svg viewBox="0 0 520 222" role="img" aria-label="Evolución por trimestre">';
  [0, 25, 50, 75, 100].forEach(function (v) { o += '<line class="axis" x1="40" x2="510" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="chartlabel" x="2" y="' + (Y(v) + 4) + '">' + v + "%</text>"; });
  var step = Math.ceil(ls.length / 10);
  ls.forEach(function (l, i) { if (i % step === 0) o += '<text class="chartlabel" x="' + X(i) + '" y="206" text-anchor="middle">' + esc(l) + "</text>"; });
  ss.forEach(function (s) {
    var seg = [];
    s.v.forEach(function (v, i) { if (v == null) { if (seg.length > 1) o += pl(seg, s.c); seg = []; return; } seg.push([X(i), Y(v)]); });
    if (seg.length > 1) o += pl(seg, s.c);
    s.v.forEach(function (v, i) { if (v != null) o += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3.5" fill="' + s.c + '"><title>' + esc(s.n) + " · " + esc(ls[i]) + ": " + v + " %" + (s.t && s.t[i] ? " (n=" + s.t[i] + ")" : "") + "</title></circle>"; });
  });
  return o + "</svg>";
}
function forest(rows, aria) {
  rows = rows.filter(function (r) { return r.o.n > 0; });
  if (!rows.length) return '<p class="e">Datos insuficientes.</p>';
  var W = 520, lw = 178, x0 = lw + 10, x1 = W - 18, rh = 26, H = rows.length * rh + 36, X = function (p) { return x0 + p * (x1 - x0); }, o = "";
  [0, 0.25, 0.5, 0.75, 1].forEach(function (t) { o += '<line class="axis" x1="' + X(t) + '" x2="' + X(t) + '" y1="10" y2="' + (H - 20) + '"/><text class="chartlabel" x="' + X(t) + '" y="' + (H - 5) + '" text-anchor="middle">' + t * 100 + "%</text>"; });
  rows.forEach(function (r, i) {
    var y = 22 + i * rh, q = r.o, c = r.c || "var(--ac)", sm = q.n < MINSMALL;
    o += '<text class="chartlabel" x="' + lw + '" y="' + (y + 4) + '" text-anchor="end">' + esc(sh(r.l, 26)) + ' <tspan fill="var(--mut)">(' + q.n + ")</tspan></text>"
      + '<line x1="' + X(q.lo) + '" x2="' + X(q.hi) + '" y1="' + y + '" y2="' + y + '" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round" opacity="' + (sm ? 0.35 : 0.8) + '"/>'
      + '<circle cx="' + X(q.p) + '" cy="' + y + '" r="5" fill="' + c + '" opacity="' + (sm ? 0.5 : 1) + '"><title>' + esc(r.l) + ": " + fP(q) + " (" + q.k + " de " + q.n + "; " + fCI(q) + ")</title></circle>";
  });
  return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(aria || "Porcentajes con intervalo de confianza") + '">' + o + "</svg>";
}

/* ====================== Piezas de HTML ====================== */
function kp(b, s, c, sub) { return '<div class="kp ' + (c || "") + '"><b>' + b + "</b><span>" + s + "</span>" + (sub ? '<small class="ep-ci" style="display:block;margin-top:2px">' + sub + "</small>" : "") + "</div>"; }
function box(t, m, c, n) { return '<div class="chartbox"><h2>' + t + "</h2>" + (m ? '<p class="m">' + m + "</p>" : "") + c + (n ? '<p class="corrnote">' + n + "</p>" : "") + "</div>"; }
function empty(t) { return '<div class="pnl"><p class="e">' + t + "</p></div>"; }
function linkVid(v) { return v.video ? '<br><a class="vl" href="' + esc(v.video) + '" target="_blank" rel="noopener">▶ Ver este punto en el videoacta</a>' : ""; }
function vrow(r, extra) {
  return '<div class="it"><small>' + fd(r.p.fecha) + " · " + esc(cat(r.p)) + " · punto " + esc(r.v.punto) + " · " + esc(r.tema) + "</small>" + esc(sh(r.v.asunto, 180)) + " " + tg(r.v) + (extra || "")
    + '<div class="pv" style="padding:6px 0 0">' + pv(r.v) + "</div>" + linkVid(r.v) + (IS_ADMIN && r.i > -1 ? ' <button class="sm noprint" onclick="ObsPro.edit(' + r.i + "," + r.j + ')">Editar</button>' : "") + "</div>";
}
function smallWarn(n) { return n < 30 ? '<p class="wn">⚠ Solo hay ' + n + " votaciones en este filtro: los porcentajes son poco robustos. Las barras de intervalo (IC 95 %) muestran cuánta incertidumbre hay.</p>" : ""; }

/* ====================== Vista: Panorama ====================== */
function vPan(R, ses) {
  if (!R.length) return empty("Aún no hay votaciones con resultado en este filtro.");
  var sm = summary(R), gs = groupStats(R), keys = Object.keys(gs).sort(function (a, b) { return gs[b].n - gs[a].n; }),
    A = affinity(R, true), pol = polar(A), by = byQuarter(R), qs = Object.keys(by).sort(), ls = qs.map(function (q) { return q.slice(2); });
  var line = function (f) { return qs.map(function (q) { return by[q].length >= 3 ? Math.round(f(by[q]) * 100) : null; }); };
  var ser = [
    { n: "Aprobadas", c: "var(--ok)", v: line(function (x) { return x.filter(function (r) { return r.ok; }).length / x.length; }), t: qs.map(function (q) { return by[q].length; }) },
    { n: "Unánimes", c: "var(--ac)", v: line(function (x) { return x.filter(function (r) { return r.un; }).length / x.length; }), t: qs.map(function (q) { return by[q].length; }) },
    { n: "Con votos en contra", c: "var(--ko)", v: line(function (x) { return x.filter(function (r) { return r.c > 0; }).length / x.length; }), t: qs.map(function (q) { return by[q].length; }) }
  ];
  var F = [], h = halves(R);
  F.push("<b>Consenso:</b> " + sm.un.k + " de " + sm.n + " votaciones fueron unánimes (" + fP(sm.un) + ", " + fCI(sm.un) + ") y se aprobó el " + fP(sm.ap) + " (" + fCI(sm.ap) + ").");
  if (h[0].length >= 8 && h[1].length >= 8) {
    var u0 = h[0].filter(function (r) { return r.un; }).length, u1 = h[1].filter(function (r) { return r.un; }).length, t = z2(u0, h[0].length, u1, h[1].length);
    if (t) F.push("<b>Tendencia:</b> la unanimidad pasa del " + Math.round(u0 / h[0].length * 100) + " % (primera mitad del periodo) al " + Math.round(u1 / h[1].length * 100) + " % (segunda). " + (t.p < 0.05 ? "La diferencia es estadísticamente significativa (" + fPv(t.p) + "), aunque los datos no permiten atribuirla a una causa concreta." : "La diferencia no es concluyente (" + fPv(t.p) + ")."));
  }
  if (pol != null) F.push("<b>Polarización:</b> en las votaciones no unánimes, dos grupos cualesquiera discrepan de media el " + Math.round(pol * 100) + " % de las veces.");
  var mi = keys.filter(function (k) { return gs[k].dN >= 8; }).sort(function (a, b) { return gs[a].wN / gs[a].dN - gs[b].wN / gs[b].dN; })[0];
  if (mi) { var o = prop(gs[mi].wN, gs[mi].dN); F.push("<b>Minoría frecuente:</b> " + esc(mi) + " coincide con el resultado final en el " + fP(o) + " de las votaciones no unánimes (" + fCI(o) + ")."); }
  var dc = keys.filter(function (k) { return gs[k].n >= 8; }).sort(function (a, b) { return gs[b].pv / gs[b].n - gs[a].pv / gs[a].n; })[0];
  if (dc && gs[dc].pv) F.push("<b>Peso decisivo:</b> los votos de " + esc(dc) + " habrían cambiado el resultado en " + gs[dc].pv + " de " + gs[dc].n + " votaciones (" + Math.round(gs[dc].pv / gs[dc].n * 100) + " %).");
  var mo = R.filter(function (r) { return r.mo; }); if (mo.length) { var ma = mo.filter(function (r) { return r.ok; }).length; F.push("<b>Iniciativa:</b> " + mo.length + " mociones votadas, " + ma + " aprobadas (" + fP(prop(ma, mo.length)) + ")."); }
  var tm = {}; R.forEach(function (r) { (tm[r.tema] = tm[r.tema] || []).push(r); });
  var tk = Object.keys(tm).filter(function (k) { return tm[k].length >= 5; }).sort(function (a, b) { return tm[a].filter(function (r) { return r.ok; }).length / tm[a].length - tm[b].filter(function (r) { return r.ok; }).length / tm[b].length; });
  if (tk.length > 1) { var lo = tk[0], hi = tk[tk.length - 1]; F.push("<b>Temas:</b> el menor porcentaje de aprobación está en «" + esc(lo) + "» (" + pct(tm[lo].filter(function (r) { return r.ok; }).length / tm[lo].length) + ") y el mayor en «" + esc(hi) + "» (" + pct(tm[hi].filter(function (r) { return r.ok; }).length / tm[hi].length) + "). La clasificación temática es automática por palabras clave."); }
  var Qd = quality();
  var leg = "";
  if (!LG) {
    leg = '<div class="pnl" style="margin-top:18px"><h2>Evolución por legislatura</h2><div class="w"><table><tr><th>Legislatura</th><th class="n">Votaciones</th><th class="n">Unanimidad</th><th class="n">Aprobadas</th><th class="n">Cohesión media</th></tr>'
      + G.slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).map(function (g) {
        var r = R.filter(function (x) { return x.l == g.id; }); if (!r.length) return "";
        var s = summary(r), st = groupStats(r), rs = Object.keys(st).map(function (k) { return st[k].rn ? st[k].rs / st[k].rn : null; }).filter(function (x) { return x != null; });
        return "<tr><td><b>" + esc(g.id) + '</b></td><td class="n">' + s.n + '</td><td class="n">' + pS(s.un) + '</td><td class="n">' + pS(s.ap) + '</td><td class="n">' + (rs.length ? pct(mean(rs)) : "–") + "</td></tr>";
      }).join("") + "</table></div></div>";
  }
  var sesRows = ses.filter(function (p) { return (p.votaciones || []).some(function (v) { return !nov(v); }); }).slice(0, 12).map(function (p) {
    var r = R.filter(function (x) { return x.p === p; }), s = summary(r);
    return '<div class="li"><span><b>' + fd(p.fecha) + '</b> <span class="tag t">' + esc(cat(p)) + "</span><br><small>" + s.n + " votaciones · " + s.apro + " aprobadas · " + s.unan + ' unánimes</small></span><div class="bar"><i class="f" style="width:' + (s.n ? s.unan * 100 / s.n : 0) + '%;background:var(--ac)"></i></div></div>';
  }).join("");
  return '<div class="kpis">' + kp(sm.n, "votaciones analizadas", "", ses.length + " sesiones") + kp(fP(sm.un), "unanimidad", "kp-ok", fCI(sm.un)) + kp(fP(sm.ap), "aprobadas", "", fCI(sm.ap)) + kp(fP(sm.sc), "con algún voto en contra", "kp-ko", fCI(sm.sc)) + kp(sm.ti.k, "aprobadas por la mínima", "", "margen ≤ 10 % de los votos") + kp(pol == null ? "–" : Math.round(pol * 100) + " %", "polarización (no unánimes)", "kp-ko") + "</div>"
    + smallWarn(sm.n)
    + '<p class="m">Calidad de los datos cargados: <b>' + (Qd.score == null ? "–" : Qd.score + " %") + '</b> de votaciones sin errores · <b>' + (Qd.cover == null ? "–" : Qd.cover + " %") + '</b> con desglose por grupo. <a href="#" onclick="ObsPro.set(\'tab\',\'cal\');return false">Ver detalle</a></p>'
    + '<div class="pnl latest"><h3>Lectura del periodo</h3><ul class="insights">' + F.map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ul><p class="corrnote">Resultados descriptivos sobre las votaciones cargadas. Las coincidencias de voto no implican pactos ni motivaciones.</p></div>'
    + '<div class="analytics">'
    + box("Pulso trimestral", "Solo se dibujan trimestres con 3 o más votaciones; el tooltip indica n.", lines(ser, ls) + '<div class="chartlegend"><span><i style="background:var(--ok)"></i>Aprobadas</span><span><i style="background:var(--ac)"></i>Unánimes</span><span><i style="background:var(--ko)"></i>Con votos en contra</span></div>')
    + box("Aprobación por tema", "Porcentaje de aprobadas con intervalo de confianza del 95 % (puntos pálidos = menos de " + MINSMALL + " votaciones).", forest(Object.keys(tm).sort(function (a, b) { return tm[b].length - tm[a].length; }).map(function (k) { return { l: k, o: prop(tm[k].filter(function (r) { return r.ok; }).length, tm[k].length) }; }), "Aprobación por tema"))
    + "</div>" + leg
    + '<div class="pnl" style="margin-top:18px"><h2>Cohesión y peso por grupo</h2><p class="m">Cohesión (índice de Rice): 100 % = todos los concejales del grupo votan igual. «Con el resultado» solo cuenta votaciones no unánimes. «Decisivo»: votaciones que habrían cambiado sin los votos del grupo.</p><div class="w"><table><tr><th>Grupo</th><th class="n">Votos</th><th>Cohesión</th><th class="n">Divididos</th><th class="n">Con el resultado (no unánimes)</th><th class="n">Decisivo</th></tr>'
    + keys.map(function (k) { var x = gs[k], r = x.rn ? Math.round(x.rs / x.rn * 100) : null; return "<tr><td>" + dot(k) + "<b>" + esc(k) + '</b></td><td class="n">' + x.n + '</td><td><span class="bar" style="min-width:90px"><i class="f" style="width:' + (r || 0) + '%;background:var(--ac)"></i></span><small> ' + (r == null ? "–" : r + " %") + '</small></td><td class="n">' + (x.dv || "–") + '</td><td class="n">' + pS(prop(x.wN, x.dN)) + '</td><td class="n">' + x.pv + " <small>(" + Math.round(x.pv * 100 / x.n) + " %)</small></td></tr>"; }).join("") + "</table></div></div>"
    + '<div class="pnl" style="margin-top:18px"><h2>Termómetro de las últimas sesiones</h2><p class="m">Barra = % de votaciones unánimes en cada sesión.</p>' + (sesRows || '<p class="e">Sin datos.</p>') + "</div>";
}

/* ====================== Vista: Mi grupo ====================== */
function vGrupo(R) {
  var gs = groupStats(R), keys = Object.keys(gs).sort(function (a, b) { return gs[b].n - gs[a].n; });
  if (!keys.length) return empty("Aún no hay votos desglosados por grupo con estos filtros.");
  if (!S.grupo || !gs[S.grupo]) S.grupo = keys[0];
  var k = S.grupo, g = gs[k], mine = R.filter(function (r) { return r.g[k]; }), A = affinity(R, true), kl = k.toLowerCase();
  var sel = '<select onchange="ObsPro.set(\'grupo\',this.value)" aria-label="Elige tu grupo" style="font-weight:600">' + keys.map(function (x) { return '<option value="' + esc(x) + '"' + (x === k ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select>";
  var wN = prop(g.wN, g.dN), coh = g.rn ? Math.round(g.rs / g.rn * 100) : null;
  var legs = {}; mine.forEach(function (r) { legs[r.l] = 1; });
  var gv = 0, op = 0; Object.keys(legs).forEach(function (l) { var gl = gobOf(l); if (gl.length) { if (gl.indexOf(kl) > -1) gv++; else op++; } });
  var role = gv && !op ? "Gobierno" : op && !gv ? "Oposición" : gv && op ? "Gobierno y oposición (según legislatura)" : "Sin definir";
  var Mm = R.filter(function (r) { return r.mo && r.prop.indexOf(k) > -1; }), Mo = R.filter(function (r) { return r.mo && r.prop.indexOf(k) < 0; });
  var pm = prop(Mm.filter(function (r) { return r.ok; }).length, Mm.length), po = prop(Mo.filter(function (r) { return r.ok; }).length, Mo.length);
  var dirOf = function (r) { var x = r.g[k]; return x.f > x.c ? "f" : x.c > x.f ? "c" : ""; };
  var tm = {};
  mine.forEach(function (r) {
    var x = r.g[k], dir = dirOf(r), o = tm[r.tema] || (tm[r.tema] = { n: 0, d: 0, w: 0, fa: 0, co: 0, ab: 0 });
    o.n++; if (x.pos === "favor") o.fa++; else if (x.pos === "contra") o.co++; else if (x.pos === "abst") o.ab++;
    if (dir && !r.un) { o.d++; if ((dir === "f") === r.ok) o.w++; }
  });
  var tk = Object.keys(tm).sort(function (a, b) { return tm[b].n - tm[a].n; });
  var defeats = mine.filter(function (r) { var d = dirOf(r); return d && (d === "f") !== r.ok; });
  var dec = mine.filter(function (r) { var x = r.g[k]; return (x.f > 0 && r.ok && r.f - x.f <= r.c) || (x.c > 0 && !r.ok && r.c - x.c < r.f); });
  var al = []; Object.keys(A[k] || {}).forEach(function (b) { var o = A[k][b]; if (o.t >= MINP) al.push({ b: b, o: prop(o.s, o.t) }); }); al.sort(function (x, y) { return y.o.p - x.o.p; });
  var by = byQuarter(mine), qs = Object.keys(by).sort();
  var tv = qs.map(function (q) { var d = 0, w = 0; by[q].forEach(function (r) { var dd = dirOf(r); if (dd) { d++; if ((dd === "f") === r.ok) w++; } }); return d >= 3 ? Math.round(w / d * 100) : null; });
  /* Aritmética de escaños */
  var lid = LG || (mine[0] && mine[0].l) || "", lg = G.find(function (x) { return x.id == lid; }), seatTxt = "";
  if (lg && (lg.grupos || []).length) {
    var N = (lg.grupos || []).reduce(function (a, x) { return a + (+x.concejales || 0); }, 0), mj = Math.floor(N / 2) + 1, mine_s = seatOf(lid, k), gl = gobOf(lid);
    seatTxt = "En la legislatura " + esc(lid) + " " + esc(k) + " tiene " + mine_s + " de " + N + " escaños (mayoría absoluta: " + mj + ").";
    if (gl.length) {
      var gsx = (lg.grupos || []).filter(function (x) { return gl.indexOf(String(x.partido).toLowerCase()) > -1; }).reduce(function (a, x) { return a + (+x.concejales || 0); }, 0);
      seatTxt += " El gobierno suma " + gsx + " escaños" + (gsx >= mj ? " (mayoría absoluta)." : " y necesita " + (mj - gsx) + " más.");
      if (gsx < mj && gl.indexOf(kl) < 0 && gsx + mine_s >= mj) seatTxt += " Con los votos de " + esc(k) + " el gobierno alcanzaría la mayoría absoluta: su grupo es bisagra.";
    }
  }
  var L = [];
  L.push("<b>Posición:</b> " + esc(k) + " votó " + g.n + " veces (" + g.fa + " Sí, " + g.co + " No, " + g.ab + " abstenciones" + (g.dv ? ", " + g.dv + " divididas" : "") + "). Rol: " + role + ".");
  if (g.dN) L.push("<b>Peso real:</b> en las votaciones no unánimes su voto coincidió con el resultado en el " + fP(wN) + " (" + fCI(wN) + ").");
  if (Mm.length && Mo.length) { var t = z2(pm.k, pm.n, po.k, po.n); L.push("<b>Mociones:</b> el " + fP(pm) + " de las mociones de " + esc(k) + " se aprobó, frente al " + fP(po) + " de las del resto" + (t && pm.n >= 5 ? (t.p < 0.05 ? " (diferencia significativa, " + fPv(t.p) + ")" : " (diferencia no concluyente, " + fPv(t.p) + ")") : "") + "."); }
  var worst = tk.filter(function (x) { return tm[x].d >= 5; }).sort(function (a, b) { return tm[a].w / tm[a].d - tm[b].w / tm[b].d; })[0];
  if (worst) L.push("<b>Dónde pierde más:</b> «" + esc(worst) + "» (coincide con el resultado en el " + pct(tm[worst].w / tm[worst].d) + " de " + tm[worst].d + " votaciones no unánimes).");
  if (al.length) L.push("<b>Aliados y rivales:</b> más cercano, " + esc(al[0].b) + " (" + fP(al[0].o) + "); más alejado, " + esc(al[al.length - 1].b) + " (" + fP(al[al.length - 1].o) + "). Es cercanía de voto, no alianza formal.");
  if (dec.length) L.push("<b>Decisivo:</b> su voto cambió el resultado en " + dec.length + " votaciones.");
  if (seatTxt) L.push("<b>Aritmética:</b> " + seatTxt);
  return '<div class="fm noprint" style="align-items:center"><span class="m" style="margin:0">Informe para:</span>' + sel + '<button onclick="window.print()">Imprimir / PDF</button></div>'
    + '<p class="eyebrow" style="margin-top:6px">Informe estratégico</p><h2 class="lead" style="margin-top:0">' + dot(k) + esc(k) + ": cómo le va en la legislatura</h2>"
    + '<div class="kpis">' + kp(g.n, "votos emitidos", "", "rol: " + role) + kp(g.dN ? fP(wN) : "–", "con el resultado (no unánimes)", "kp-ok", g.dN ? fCI(wN) : "") + kp(defeats.length, "votaciones en las que perdió", "kp-ko") + kp(dec.length, "votaciones decisivas", "") + kp(coh == null ? "–" : coh + " %", "cohesión interna", "") + kp(Mm.length ? Mm.filter(function (r) { return r.ok; }).length + "/" + Mm.length : "0", "mociones aprobadas / presentadas", "", Mm.length ? fCI(pm) : "") + "</div>"
    + smallWarn(g.n)
    + '<div class="pnl latest"><h3>Lectura estratégica</h3><ul class="insights">' + L.map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ul><p class="corrnote">Descriptivo: no infiere motivos. Contrasta cada dato con el acta enlazada antes de usarlo en un documento público.</p></div>'
    + '<div class="analytics">'
    + box("Evolución de su peso real", "% de votaciones (con dirección de voto) en que coincidió con el resultado; trimestres con 3+ votaciones.", lines([{ n: k, c: col(k), v: tv, t: qs.map(function (q) { return by[q].length; }) }], qs.map(function (q) { return q.slice(2); })))
    + box("Afinidad con el resto (votaciones no unánimes)", "Coincidencia de voto con cada grupo (mín. " + MINP + " votaciones comunes). Intervalo de confianza del 95 %.", forest(al.map(function (x) { return { l: x.b, o: x.o, c: col(x.b) }; }), "Afinidad"), "Se excluyen las votaciones unánimes para que no inflen la coincidencia.")
    + "</div>"
    + '<div class="pnl" style="margin-top:18px"><h2>Resultados por tema</h2><div class="w"><table><tr><th>Tema</th><th class="n">Votos</th><th class="n">Sí</th><th class="n">No</th><th class="n">Abst.</th><th class="n">Con el resultado</th></tr>'
    + tk.map(function (x) { var o = tm[x]; return "<tr><td>" + esc(x) + '</td><td class="n">' + o.n + '</td><td class="n ok">' + o.fa + '</td><td class="n ko">' + o.co + '</td><td class="n ab">' + o.ab + '</td><td class="n">' + (o.d ? pS(prop(o.w, o.d)) : "–") + "</td></tr>"; }).join("") + "</table></div></div>"
    + '<div class="two" style="margin-top:18px"><div class="pnl"><h2>Sus mociones</h2>' + (Mm.length ? Mm.slice(0, 15).map(function (r) { return vrow(r); }).join("") : '<p class="e">Sin mociones registradas.</p>') + '</div><div class="pnl"><h2>Votaciones en las que perdió</h2>' + (defeats.length ? defeats.slice(0, 10).map(function (r) { return vrow(r); }).join("") + (defeats.length > 10 ? '<p class="m">Se muestran las 10 más recientes de ' + defeats.length + ".</p>" : "") : '<p class="e">Ninguna.</p>') + "</div></div>"
    + '<div class="pnl" style="margin-top:18px"><h2>Votaciones decisivas</h2>' + (dec.length ? dec.slice(0, 10).map(function (r) { return vrow(r); }).join("") : '<p class="e">Ninguna votación habría cambiado sin sus votos.</p>') + "</div>";
}

/* ====================== Vista: Gobierno y oposición ====================== */
function vGob(R) {
  var gs = G.slice().sort(function (a, b) { return b.id.localeCompare(a.id); }).filter(function (g) { return (g.grupos || []).length; });
  if (!gs.length) return empty("Registra la composición de las legislaturas en Mi cuenta → Administración.");
  var h = '<p class="m">Indica qué grupos forman el gobierno en cada legislatura para medir cuándo la oposición lo derrota y qué mociones prosperan. ' + (IS_ADMIN ? "Pulsa los grupos que gobiernan." : "Solo el administrador puede editarlo.") + "</p>";
  gs.forEach(function (g) {
    var gl = gobOf(g.id), N = seats(g), mj = Math.floor(N / 2) + 1;
    h += '<div class="pnl" style="margin-top:14px"><h2>' + esc(g.nombre) + '</h2><div class="chips">' + g.grupos.map(function (x) {
      var on = gl.indexOf(String(x.partido).toLowerCase()) > -1;
      return IS_ADMIN ? '<button class="' + (on ? "sel" : "") + '" data-l="' + esc(g.id) + '" data-k="' + esc(x.partido) + '" onclick="ObsPro.gov(this.dataset.l,this.dataset.k)">' + esc(x.partido) + " (" + x.concejales + ")</button>" : '<span class="cp">' + dot(x.partido) + esc(x.partido) + "<b>" + (on ? "Gobierno" : "Oposición") + "</b></span>";
    }).join("") + "</div>";
    if (!gl.length) { h += '<p class="e">Equipo de gobierno sin definir.</p></div>'; return; }
    var gsx = g.grupos.filter(function (x) { return gl.indexOf(String(x.partido).toLowerCase()) > -1; }).reduce(function (a, x) { return a + (+x.concejales || 0); }, 0);
    var r = R.filter(function (x) { return x.l == g.id; }), w = 0, d = 0, loss = [], hq = [];
    r.forEach(function (x) {
      var dir = govDir(x); if (!dir) return; d++; if ((dir === "f") === x.ok) w++; else loss.push(x);
      var gf = 0, gc = 0; Object.keys(x.g).forEach(function (k) { if (isGov(g.id, k)) { gf += x.g[k].f; gc += x.g[k].c; } }); hq.push(Math.abs(gf - gc) / (gf + gc));
    });
    var wp = prop(w, d), mo = r.filter(function (x) { return x.mo && x.prop.every(function (k) { return !isGov(g.id, k); }); }),
      ma = mo.filter(function (x) { return x.ok; }), ms = ma.filter(function (x) { return govDir(x) === "f"; }), mc = ma.filter(function (x) { return govDir(x) === "c"; });
    var bis = [];
    if (gsx < mj) {
      var op = g.grupos.filter(function (x) { return gl.indexOf(String(x.partido).toLowerCase()) < 0; });
      op.forEach(function (x) { if (gsx + (+x.concejales || 0) >= mj) bis.push(x.partido); });
      if (!bis.length) op.forEach(function (x, i) { op.slice(i + 1).forEach(function (y) { if (gsx + (+x.concejales || 0) + (+y.concejales || 0) >= mj) bis.push(x.partido + " + " + y.partido); }); });
    }
    h += '<div class="kpis" style="margin-top:12px">' + kp(gsx + "/" + N, gsx >= mj ? "escaños: mayoría absoluta" : "escaños: gobierno en minoría", gsx >= mj ? "kp-ok" : "kp-ko", "mayoría absoluta = " + mj) + kp(d ? fP(wp) : "–", "votaciones en que el gobierno gana", "", d ? fCI(wp) : "") + kp(loss.length, "derrotas del gobierno", "kp-ko") + kp(hq.length ? pct(mean(hq)) : "–", "cohesión del gobierno", "") + kp(mo.length, "mociones de la oposición", "", ma.length + " aprobadas") + "</div>"
      + '<p class="m">Mociones de la oposición aprobadas: <b>' + ma.length + "</b> de " + mo.length + "; con voto favorable del gobierno: <b>" + ms.length + "</b>; contra el voto del gobierno: <b>" + mc.length + "</b>. «Derrota»: el sentido mayoritario de los grupos de gobierno (por concejales) no coincide con el resultado.</p>"
      + (bis.length ? '<p class="m">Para alcanzar la mayoría absoluta el gobierno necesitaría: <b>' + bis.map(esc).join("</b>, <b>") + ".</b></p>" : "")
      + (loss.length ? '<details class="v"><summary style="grid-template-columns:1fr 14px"><span><b>Ver las ' + loss.length + " derrotas del gobierno</b></span></summary><div style=\"padding:0 18px 14px\">" + loss.slice(0, 20).map(function (x) { return vrow(x); }).join("") + "</div></details>" : "") + "</div>";
  });
  return h;
}

/* ====================== Vista: Mociones ====================== */
function vMoc(R) {
  var M = R.filter(function (r) { return r.mo; });
  if (!M.length) return empty("No hay mociones votadas con estos filtros.");
  var by = {}; M.forEach(function (r) { r.prop.forEach(function (k) { (by[k] = by[k] || []).push(r); }); });
  var ks = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; });
  var tbl = ks.map(function (k) {
    var x = by[k], ok = x.filter(function (r) { return r.ok; }), un = x.filter(function (r) { return r.un; }).length, gv = ok.filter(function (r) { return govDir(r) === "f"; }).length;
    return "<tr><td>" + dot(k) + "<b>" + esc(k) + '</b></td><td class="n">' + x.length + '</td><td class="n">' + pS(prop(ok.length, x.length)) + '</td><td class="n">' + un + '</td><td class="n">' + gv + '</td><td class="n">' + (x.length - ok.length) + "</td></tr>";
  }).join("");
  var L = M.filter(function (r) {
    if (S.mres === "ok" && !r.ok) return false; if (S.mres === "ko" && r.ok) return false;
    if (S.mprop && r.prop.indexOf(S.mprop) < 0) return false;
    if (S.mq && (r.v.asunto || "").toLowerCase().indexOf(S.mq.toLowerCase()) < 0) return false; return true;
  });
  var sup = function (r) { return r.t ? r.f / r.t : 0; };
  L.sort(function (a, b) { return S.msort === "fecha" ? b.p.fecha.localeCompare(a.p.fecha) : S.msort === "contra" ? (b.c + b.a) - (a.c + a.a) : (sup(b) - sup(a)) || b.f - a.f; });
  var all = prop(M.filter(function (r) { return r.ok; }).length, M.length);
  return '<div class="kpis">' + kp(M.length, "mociones votadas") + kp(fP(all), "aprobadas", "kp-ok", fCI(all)) + kp(M.filter(function (r) { return r.un; }).length, "aprobadas por unanimidad") + kp(M.filter(function (r) { return !r.ok; }).length, "rechazadas", "kp-ko") + "</div>"
    + '<div class="analytics">' + box("Éxito de las mociones por grupo", "% aprobadas con intervalo de confianza del 95 %.", forest(ks.map(function (k) { return { l: k, o: prop(by[k].filter(function (r) { return r.ok; }).length, by[k].length), c: col(k) }; }), "Éxito de mociones"))
    + '<div class="chartbox"><h2>Resumen por proponente</h2><div class="w"><table><tr><th>Grupo</th><th class="n">Presentadas</th><th class="n">Aprobadas</th><th class="n">Unánimes</th><th class="n">Con apoyo del gobierno</th><th class="n">Rechazadas</th></tr>' + tbl + "</table></div><p class=\"corrnote\">Una moción conjunta cuenta para cada grupo proponente.</p></div></div>"
    + '<div class="tools noprint" style="margin-top:18px"><input class="x" type="search" placeholder="Buscar en el asunto" value="' + esc(S.mq) + '" oninput="ObsPro.q(\'mq\',this.value)"><select onchange="ObsPro.set(\'mprop\',this.value)"><option value="">Todos los grupos</option>' + ks.map(function (k) { return '<option value="' + esc(k) + '"' + (k === S.mprop ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("") + '</select><select onchange="ObsPro.set(\'mres\',this.value)"><option value="">Todas</option><option value="ok"' + (S.mres === "ok" ? " selected" : "") + '>Aprobadas</option><option value="ko"' + (S.mres === "ko" ? " selected" : "") + '>Rechazadas</option></select><select onchange="ObsPro.set(\'msort\',this.value)"><option value="apoyo"' + (S.msort === "apoyo" ? " selected" : "") + '>Más apoyo</option><option value="contra"' + (S.msort === "contra" ? " selected" : "") + '>Más oposición</option><option value="fecha"' + (S.msort === "fecha" ? " selected" : "") + ">Más recientes</option></select></div>"
    + '<div class="pnl" id="ep-list"><p class="m">' + L.length + " mociones.</p>" + mocList(L) + "</div>";
}
function mocList(L) {
  return L.slice(0, 60).map(function (r) {
    var sp = r.t ? Math.round(r.f / r.t * 100) : 0;
    return vrow(r, ' <span class="ep-ci">' + r.f + " Sí · " + r.c + " No · " + r.a + " Abst. (" + sp + " % a favor) · presenta " + esc(r.prop.join(", ")) + "</span>");
  }).join("") + (L.length > 60 ? '<p class="m">Se muestran 60 de ' + L.length + "; afina los filtros.</p>" : "") || '<p class="e">Sin resultados.</p>';
}

/* ====================== Vista: Temas ====================== */
function vTem(R) {
  if (!R.length) return empty("No hay votaciones con resultado con estos filtros.");
  var tm = {}; R.forEach(function (r) { (tm[r.tema] = tm[r.tema] || []).push(r); });
  var ks = Object.keys(tm).sort(function (a, b) { return tm[b].length - tm[a].length; });
  var rows = ks.map(function (k) {
    var x = tm[k], ok = x.filter(function (r) { return r.ok; }).length, un = x.filter(function (r) { return r.un; }).length, ap = mean(x.map(function (r) { return r.t ? r.f / r.t : 0; })), co = mean(x.map(function (r) { return r.t ? r.c / r.t : 0; }));
    return "<tr><td><b>" + esc(k) + '</b></td><td class="n">' + x.length + '</td><td class="n">' + pS(prop(ok, x.length)) + '</td><td class="n">' + pS(prop(un, x.length)) + '</td><td class="n ok">' + pct(ap) + '</td><td class="n ko">' + pct(co) + "</td></tr>";
  }).join("");
  var L = R.filter(function (r) { return (!S.tc || r.tema === S.tc) && (!S.tq || (r.v.asunto || "").toLowerCase().indexOf(S.tq.toLowerCase()) > -1 || r.prop.join(" ").toLowerCase().indexOf(S.tq.toLowerCase()) > -1); });
  return '<p class="m">Los temas se asignan automáticamente por palabras clave del asunto. ' + (IS_ADMIN ? "Como administrador puedes corregir el tema de cualquier punto en la lista inferior." : "") + "</p>"
    + '<div class="analytics">' + box("¿Qué temas salen adelante?", "% de aprobación por tema con IC 95 %.", forest(ks.map(function (k) { return { l: k, o: prop(tm[k].filter(function (r) { return r.ok; }).length, tm[k].length) }; }), "Aprobación por tema"))
    + '<div class="chartbox"><h2>Apoyo y oposición por tema</h2><div class="w"><table><tr><th>Tema</th><th class="n">Votaciones</th><th class="n">Aprobadas</th><th class="n">Unánimes</th><th class="n">% medio a favor</th><th class="n">% medio en contra</th></tr>' + rows + "</table></div><p class=\"corrnote\">% medio sobre los votos emitidos en cada votación.</p></div></div>"
    + '<div class="tools noprint" style="margin-top:18px"><input class="x" type="search" placeholder="Buscar por asunto o proponente" value="' + esc(S.tq) + '" oninput="ObsPro.q(\'tq\',this.value)"><select onchange="ObsPro.set(\'tc\',this.value)"><option value="">Todos los temas</option>' + TEMAS.map(function (t) { return '<option value="' + esc(t) + '"' + (t === S.tc ? " selected" : "") + ">" + esc(t) + (tm[t] ? " (" + tm[t].length + ")" : "") + "</option>"; }).join("") + "</select></div>"
    + '<div class="pnl" id="ep-list">' + temList(L) + "</div>";
}
function temList(L) {
  return '<p class="m">' + L.length + " votaciones.</p>" + (L.slice(0, 60).map(function (r) {
    var sel = IS_ADMIN && r.i > -1 ? ' <select class="sm noprint" onchange="ObsPro.setTema(' + r.i + "," + r.j + ',this.value)" aria-label="Corregir tema"><option value="">Tema automático</option>' + TEMAS.map(function (t) { return '<option value="' + esc(t) + '"' + (r.v.tema === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>" : "";
    return vrow(r, sel);
  }).join("") || '<p class="e">Sin resultados.</p>') + (L.length > 60 ? '<p class="m">Se muestran 60 de ' + L.length + ".</p>" : "");
}

/* ====================== Vista: Bloques ====================== */
function vBlo(R) {
  var A = affinity(R, true), keys = Object.keys(A);
  if (keys.length < 2) return empty("Se necesitan al menos dos grupos con votaciones no unánimes en común.");
  var P = pairs(A, MINP), B = blocks(A, keys, 0.3, MINP), mult = B.filter(function (x) { return x.length > 1; }), sing = B.filter(function (x) { return x.length === 1; }).map(function (x) { return x[0]; });
  var mx = '<div class="w"><table class="mx"><tr><th></th>' + keys.map(function (k) { return "<th>" + esc(k) + "</th>"; }).join("") + "</tr>" + keys.map(function (a) {
    return '<tr><th style="text-align:left">' + dot(a) + esc(a) + "</th>" + keys.map(function (b) {
      if (a === b) return '<td style="background:var(--ln)">–</td>'; var o = A[a] && A[a][b]; if (!o || o.t < MINP) return '<td class="m" title="Menos de ' + MINP + ' votaciones comunes">·</td>';
      var v = Math.round(o.s / o.t * 100), m = v >= 50 ? "var(--ok)" : "var(--ko)", w = Math.round(Math.abs(v - 50) * 1.6 + 12);
      return '<td title="' + o.s + " de " + o.t + ' votaciones" style="background:color-mix(in srgb,' + m + " " + w + '%,var(--sf))">' + v + " %</td>";
    }).join("") + "</tr>";
  }).join("") + "</table></div>";
  return '<div class="pnl"><h2>Bloques de voto</h2><p class="m">Agrupación jerárquica (enlace medio) de los grupos con distancia = 1 − coincidencia, solo sobre votaciones no unánimes. Se unen grupos con al menos un 70 % de coincidencia media (mín. ' + MINP + " votaciones comunes).</p>"
    + (mult.length ? mult.map(function (b, i) { return '<div class="li"><span><b>Bloque ' + (i + 1) + "</b><br>" + b.map(function (k) { return '<span class="cp">' + dot(k) + esc(k) + "</span> "; }).join("") + "</span></div>"; }).join("") : '<p class="e">No se detectan bloques estables con este umbral.</p>')
    + (sing.length ? '<p class="m">Sin bloque: ' + sing.map(esc).join(", ") + ".</p>" : "") + '<p class="corrnote">Los bloques son empíricos (cómo votan), no ideológicos ni pactos formales.</p></div>'
    + '<div class="pnl" style="margin-top:18px"><h2>Matriz de afinidad</h2>' + mx + '<p class="corrnote">Verde = votan igual; rojo = votan distinto. Solo votaciones no unánimes.</p></div>'
    + '<div class="analytics" style="margin-top:18px">' + box("Pares más afines", "IC 95 %.", forest(P.slice(0, 6).map(function (x) { return { l: x.a + " – " + x.b, o: x.o }; }), "Pares más afines")) + box("Pares más alejados", "IC 95 %.", forest(P.slice(-6).reverse().map(function (x) { return { l: x.a + " – " + x.b, o: x.o }; }), "Pares más alejados")) + "</div>";
}

/* ====================== Vista: Calidad ====================== */
function vCal() {
  var Q_ = quality(), cnt = { error: 0, aviso: 0, info: 0 }; Q_.I.forEach(function (x) { cnt[x.s]++; });
  var L = Q_.I.filter(function (x) { return !S.qsev || x.s === S.qsev; }).sort(function (a, b) { return ({ error: 0, aviso: 1, info: 2 })[a.s] - ({ error: 0, aviso: 1, info: 2 })[b.s]; });
  var lab = { error: "Error", aviso: "Aviso", info: "Info" };
  return '<p class="m">Revisión automática de coherencia: recuentos, resultado, desglose por grupo, nombres de grupos, duplicados y fechas. Un error indica un dato que contradice a otro; un aviso, algo que limita el análisis.</p>'
    + '<div class="kpis">' + kp(Q_.score == null ? "–" : Q_.score + " %", "votaciones sin errores", Q_.score >= 95 ? "kp-ok" : "kp-ko", Q_.nVot + " votaciones con resultado") + kp(Q_.cover == null ? "–" : Q_.cover + " %", "con desglose por grupo") + kp(cnt.error, "errores", "kp-ko") + kp(cnt.aviso, "avisos") + kp(cnt.info, "informativos") + "</div>"
    + '<div class="chips noprint" style="margin:10px 0">' + [["", "Todos (" + Q_.I.length + ")"], ["error", "Errores (" + cnt.error + ")"], ["aviso", "Avisos (" + cnt.aviso + ")"], ["info", "Info (" + cnt.info + ")"]].map(function (x) { return '<button class="' + (S.qsev === x[0] ? "sel" : "") + "\" onclick=\"ObsPro.set('qsev','" + x[0] + "')\">" + x[1] + "</button>"; }).join("") + "</div>"
    + '<div class="pnl">' + (L.length ? '<div class="w"><table><tr><th>Nivel</th><th>Sesión</th><th>Punto</th><th>Detalle</th><th></th></tr>' + L.slice(0, 200).map(function (x) {
      return '<tr><td><b class="' + (x.s === "error" ? "ko" : x.s === "aviso" ? "ab" : "") + '">' + lab[x.s] + "</b></td><td>" + (x.p ? fd(x.p.fecha) + "<br><small class=\"m\">" + esc(cat(x.p)) + "</small>" : "—") + "</td><td>" + (x.v ? esc(x.v.punto) : "") + "</td><td>" + esc(x.msg) + (x.v ? "<br><small class=\"m\">" + esc(sh(x.v.asunto, 100)) + "</small>" : "") + "</td><td>" + (IS_ADMIN && x.i > -1 ? '<button class="sm noprint" onclick="ObsPro.edit(' + x.i + "," + (x.j == null ? -2 : x.j) + ')">' + (x.j == null ? "Editar sesión" : "Editar") + "</button>" : "") + "</td></tr>";
    }).join("") + "</table></div>" + (L.length > 200 ? '<p class="m">Se muestran 200 de ' + L.length + ".</p>" : "") : '<p class="e">Sin incidencias en esta categoría. ✔</p>') + "</div>";
}

/* ====================== Vista: Metodología y exportación ====================== */
function vMet() {
  var d = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
    c = "Fernández, J. (" + new Date().getFullYear() + "). Observatorio de plenos de Viladecans [Aplicación web]. Universitat Autònoma de Barcelona. " + location.href.split("#")[0] + " (consultado el " + d + ").";
  return '<div class="pnl"><h2>Fuente y unidad de análisis</h2><p>Los datos proceden de las actas y videoactas públicas del pleno del Ayuntamiento de Viladecans, transcritas o extraídas de forma asistida; cada sesión enlaza a su acta. La unidad de análisis es la <b>votación</b> y, dentro de ella, el <b>posicionamiento de cada grupo municipal</b>. No hay voto nominal individual salvo cuando el grupo se divide (se registra el reparto).</p>'
    + '<h2>Codificación</h2><ul class="insights"><li>Posiciones: a favor, en contra, abstención o dividido.</li><li>Los puntos informativos o sin votación se excluyen de todos los indicadores y no se consideran rechazos.</li><li>Un grupo no dividido pesa tantos votos como concejales tiene en la legislatura (o 1 si no consta).</li><li>La legislatura se asigna por la fecha de la sesión. Por defecto se analizan solo los plenos municipales; las juntas de VIQUAL, VIMED y VIGEM se excluyen (se pueden incluir con el selector de la pestaña).</li><li>Una <b>moción</b> es toda votación con proponente y clase «Moción».</li></ul>'
    + '<h2>Indicadores</h2><ul class="insights"><li><b>Intervalos de confianza:</b> intervalo de Wilson al 95 % para toda proporción. Los porcentajes con menos de ' + MINSMALL + ' observaciones se marcan con ⚠.</li><li><b>Unanimidad:</b> votaciones con solo votos a favor. <b>Aprobada por la mínima:</b> aprobada no unánime con diferencia ≤ 10 % de los votos (mínimo 2).</li><li><b>Con el resultado:</b> % de votaciones en que la dirección mayoritaria del grupo (a favor o en contra, por concejales) coincide con el desenlace. Se calcula solo sobre votaciones <b>no unánimes</b>, porque las unánimes no discriminan.</li><li><b>Cohesión (Rice):</b> media de |A favor − En contra| / (A favor + En contra) entre los concejales del grupo; las abstenciones no cuentan.</li><li><b>Decisivo:</b> votaciones cuyo resultado cambiaría al restar los votos del grupo (aprobada: sin sus Sí ya no hay mayoría; rechazada: sin sus No saldría adelante).</li><li><b>Afinidad:</b> % de votaciones no unánimes con la misma posición, sobre las votaciones comunes (mín. ' + MINP + ').</li><li><b>Bloques:</b> clustering jerárquico de enlace medio sobre la distancia 1 − afinidad, umbral 0,30.</li><li><b>Polarización:</b> media de (1 − afinidad) entre pares de grupos.</li><li><b>Tendencia:</b> comparación de la unanimidad entre la primera y la segunda mitad cronológica con contraste de dos proporciones (z); se informa el valor p.</li><li><b>Derrota del gobierno:</b> el sentido mayoritario de los grupos de gobierno no coincide con el resultado.</li></ul>'
    + '<h2>Limitaciones</h2><ul class="insights"><li>Pueden existir errores de transcripción: contrasta con el acta enlazada y revisa la pestaña «Calidad».</li><li>Sin voto individual ni datos ideológicos, los bloques son empíricos, no ideológicos.</li><li>El análisis es descriptivo y no establece causalidad; las muestras por legislatura son pequeñas y los intervalos amplios.</li><li>La clasificación temática es automática por palabras clave y puede equivocarse (se puede corregir por punto).</li></ul>'
    + '<h2>Cómo citar</h2><p class="inf-ex" id="cita">' + esc(c) + '</p><button class="sm noprint" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById(\'cita\').textContent)">Copiar cita (APA)</button></div>'
    + '<div class="pnl" style="margin-top:18px"><h2>Exportar datos para tu análisis</h2><p class="m">Pensado para replicar los resultados en R, Python, SPSS o Excel (CSV con separador «;» y codificación UTF-8). Usa el filtro de legislatura y tipo de arriba antes de exportar.</p><div class="fm noprint"><button onclick="ObsPro.csvVot()">CSV · una fila por votación</button><button onclick="ObsPro.csvGrp()">CSV · una fila por votación y grupo</button><button onclick="ObsPro.csvInd()">CSV · indicadores por grupo</button><button onclick="ObsPro.json()">JSON · copia completa</button><button onclick="window.print()">Imprimir / PDF</button></div></div>';
}

/* ====================== Exportaciones ====================== */
function dl(name, rows, mime) {
  var txt = mime ? rows : "﻿" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(";"); }).join("\n");
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: mime || "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function cur() { return recs(scope()); }
function csvVot() {
  var r = [["legislatura", "fecha", "tipo", "punto", "asunto", "tema", "clase", "proponentes", "resultado", "a_favor", "en_contra", "abstenciones", "unanime", "aprobada_por_la_minima", "direccion_gobierno"]];
  cur().forEach(function (x) { r.push([x.l, x.p.fecha, cat(x.p), x.v.punto, x.v.asunto, x.tema, x.v.clase || (x.prop.length ? "Moción" : ""), x.prop.join(", "), res(x.v), x.f, x.c, x.a, x.un ? 1 : 0, tight(x) ? 1 : 0, govDir(x)]); });
  dl("votaciones-viladecans.csv", r);
}
function csvGrp() {
  var r = [["legislatura", "fecha", "tipo", "punto", "tema", "resultado", "grupo", "posicion", "concejales_si", "concejales_no", "concejales_abst", "es_gobierno", "es_proponente"]];
  cur().forEach(function (x) { Object.keys(x.g).forEach(function (k) { var o = x.g[k]; r.push([x.l, x.p.fecha, cat(x.p), x.v.punto, x.tema, res(x.v), k, o.pos, o.f, o.c, o.a, isGov(x.l, k) ? 1 : 0, x.prop.indexOf(k) > -1 ? 1 : 0]); }); });
  dl("votos-por-grupo-viladecans.csv", r);
}
function csvInd() {
  var gs = groupStats(cur()), r = [["grupo", "votos", "si", "no", "abstenciones", "divididos", "cohesion_rice_pct", "con_resultado_no_unanimes_pct", "n_no_unanimes", "decisivo"]];
  Object.keys(gs).forEach(function (k) { var x = gs[k]; r.push([k, x.n, x.fa, x.co, x.ab, x.dv, x.rn ? Math.round(x.rs / x.rn * 100) : "", x.dN ? Math.round(x.wN / x.dN * 100) : "", x.dN, x.pv]); });
  dl("indicadores-grupos-viladecans.csv", r);
}
function json() { dl("copia-observatorio-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ plenos: D, legislaturas: G }, null, 1), "application/json"); }

/* ====================== Render principal ====================== */
var TABS = [["pan", "Panorama"], ["mg", "Mi grupo"], ["gob", "Gobierno y oposición"], ["moc", "Mociones"], ["tem", "Temas"], ["blo", "Bloques"], ["cal", "Calidad de datos"], ["met", "Metodología"]];
function render() {
  var el = $("v-estudio"); if (!el) return;
  var ses = scope(), R = recs(ses), body = "";
  try {
    body = ({ pan: function () { return vPan(R, ses); }, mg: function () { return vGrupo(R); }, gob: function () { return vGob(R); }, moc: function () { return vMoc(R); }, tem: function () { return vTem(R); }, blo: function () { return vBlo(R); }, cal: vCal, met: vMet })[S.tab]();
  } catch (e) { body = '<div class="pnl"><p class="e">No se pudo calcular esta vista: ' + esc(e.message || e) + "</p></div>"; if (window.console) console.error(e); }
  var ale = !TP ? '<label class="m noprint" style="display:inline-flex;gap:6px;align-items:center;margin:0 0 14px"><input type="checkbox"' + (S.solo ? " checked" : "") + ' onchange="ObsPro.solo(this.checked)"> Solo plenos municipales (excluye las juntas de VIQUAL, VIMED y VIGEM)</label>' : '<p class="m noprint">Filtro de tipo activo: ' + esc(TP) + ".</p>";
  el.innerHTML = '<p class="eyebrow">Estudio de gobernanza municipal · ' + (LG ? "legislatura " + esc(LG) : "todas las legislaturas") + '</p><h2 class="lead" style="margin-top:0">Pleno de Viladecans: consenso, poder y bloques</h2>'
    + '<div class="chips noprint" style="margin-bottom:12px">' + TABS.map(function (t) { return '<button class="' + (S.tab === t[0] ? "sel" : "") + "\" onclick=\"ObsPro.set('tab','" + t[0] + "')\">" + t[1] + "</button>"; }).join("") + "</div>" + ale + body
    + '<div class="fm noprint" style="margin-top:18px"><button onclick="window.print()">Imprimir / guardar PDF</button></div>';
}
window.renderEstudio = render;

/* ====================== Acciones públicas ====================== */
window.ObsPro = {
  set: function (k, v) {
    S[k] = v; if (k === "grupo") { try { localStorage.setItem("obs-mi-grupo", v); } catch (e) {} }
    render(); if (k === "tab") { var e = $("v-estudio"); if (e && e.scrollIntoView) e.scrollIntoView({ block: "start" }); }
  },
  q: function (k, v) { S[k] = v; render(); var i = document.querySelector("#v-estudio input[type=search]"); if (i) { i.focus(); try { i.setSelectionRange(v.length, v.length); } catch (e) {} } },
  solo: function (b) { S.solo = !!b; try { localStorage.setItem("obs-solo-plenos", b ? "1" : "0"); } catch (e) {} render(); },
  edit: function (i, j) { if (typeof edv === "function" && IS_ADMIN) { if (j === -2 && typeof eds === "function") eds(i); else edv(i, j); } },
  gov: function (l, k) { if (!IS_ADMIN) return; var g = G.find(function (x) { return x.id == l; }); if (!g) return; var a = g.gobierno || [], i = a.indexOf(k); if (i > -1) a.splice(i, 1); else a.push(k); g.gobierno = a; sv(); if (typeof window.render === "function") window.render(); else render(); },
  setTema: function (i, j, t) { if (!IS_ADMIN || !D[i] || !D[i].votaciones[j]) return; if (t) D[i].votaciones[j].tema = t; else delete D[i].votaciones[j].tema; sv(); if (typeof window.render === "function") window.render(); else render(); },
  csvVot: csvVot, csvGrp: csvGrp, csvInd: csvInd, json: json,
  /* funciones puras expuestas para pruebas */
  _t: { wilson: wilson, z2: z2, recs: recs, summary: summary, groupStats: groupStats, affinity: affinity, blocks: blocks, quality: quality, topic: topic, polar: polar, govDir: govDir,
    scope: scope, tight: tight, prop: prop, fP: fP, fCI: fCI, isGov: isGov, gobOf: gobOf, seatOf: seatOf, isSolo: function () { return S.solo; }, TEMAS: TEMAS }
};

/* ====================== Importación de actas: más cómoda ====================== */
function mejorarImportacion() {
  var af = $("af"); if (!af || af.dataset.mej) return; af.dataset.mej = "1";
  af.addEventListener("change", function () { if (af.files.length && typeof actaRun === "function") actaRun(); });
  var zone = af.parentNode; if (!zone) return;
  ["dragenter", "dragover"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.style.outline = "2px dashed var(--ac)"; }); });
  ["dragleave", "drop"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.style.outline = ""; }); });
  zone.addEventListener("drop", function (e) {
    var fs = Array.prototype.filter.call(e.dataTransfer ? e.dataTransfer.files : [], function (f) { return /\.pdf$/i.test(f.name); }); if (!fs.length) return;
    var dt = new DataTransfer(); fs.forEach(function (f) { dt.items.add(f); }); af.files = dt.files; if (typeof actaRun === "function") actaRun();
  });
}
try { mejorarImportacion(); } catch (e) {}

/* ====================== Estilos propios ====================== */
if (typeof document !== "undefined" && document.head) {
  var st = document.createElement("style");
  st.textContent = ".ep-ci{color:var(--mut);font-size:12px;white-space:nowrap}.ep-warn{color:var(--ab)}#v-estudio .chartbox svg text{font-family:inherit}#v-estudio .kp small{font-weight:400}@media print{#v-estudio .chips,#v-estudio .tools{display:none!important}.pnl,.chartbox,.kp{box-shadow:none!important;break-inside:avoid}}";
  document.head.appendChild(st);
}
render();
})();

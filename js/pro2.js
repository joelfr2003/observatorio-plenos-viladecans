/* Observatorio de plenos · v8
   Inicio con impacto · pestaña «Explorar» (mapa político, test «¿con quién votarías?», buscador,
   curiosidades y novedades) · copiar / descargar gráficos y tablas CON CITA.
   Inspirado en: Voteview (mapas de puntos ideales), Parlameter/Parlacards (tarjetas compartibles),
   Qué hacen los diputados (buscador, fichas y seguimiento), Brno (comparar y filtrar por grupo),
   Wahl-O-Mat / VoteMatch (test de afinidad) y HowTheyVote (datos abiertos descargables). */
(function () {
"use strict";

var TT = function () { return (window.ObsPro && window.ObsPro._t) || {}; };
var MINP = 5;
var X = { tab: "mapa", vaa: null, vaaN: 10, F: { q: "", g: "", pos: "", tema: "", res: "", tipo: "", leg: "", mo: false, n: 40 } };

/* ====================== Utilidades ====================== */
function sh(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
function Q(f) { return f.slice(0, 4) + "T" + Math.ceil(+f.slice(5, 7) / 3); }
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
function pct(x) { return x == null ? "–" : Math.round(x * 100) + " %"; }
function el_(id) { return document.getElementById(id); }
function cur() { var t = TT(); return t.recs ? t.recs(t.scope()) : []; }
function emptyBox(t) { return '<div class="pnl"><p class="e">' + t + "</p></div>"; }
function gdir(x) { return x.f > x.c ? "favor" : x.c > x.f ? "contra" : (x.a > 0 && !x.f && !x.c ? "abst" : ""); }
var NOM = { favor: "Sí", contra: "No", abst: "Abst." };

/* ====================== Cita ====================== */
function filtros() {
  var t = TT(), a = [LG ? "legislatura " + LG : "todas las legislaturas"];
  a.push(TP ? "tipo: " + TP : (t.isSolo && t.isSolo() ? "solo plenos municipales" : "incluye juntas de empresas públicas"));
  return a.join(" · ");
}
function hoy() { return new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }); }
function base() { return String(location.href).split("#")[0]; }
function citaCorta() {
  return "Fuente: Observatorio de plenos de Viladecans (J. Fernández, UAB, " + new Date().getFullYear() + "), a partir de las actas del Pleno del Ayuntamiento de Viladecans. Filtros: " + filtros() + ". Elaboración propia. Consultado el " + hoy() + ". " + base();
}
function citaApa() {
  return "Fernández, J. (" + new Date().getFullYear() + "). Observatorio de plenos de Viladecans [Aplicación web]. Universitat Autònoma de Barcelona. " + base() + " (consultado el " + hoy() + ").";
}
window.ObsCite = { corta: citaCorta, apa: citaApa };

/* ====================== Mapa político (escalado multidimensional) ====================== */
function posScore(a, b) { return a === b ? 1 : (a === "abst" || b === "abst") ? 0.5 : 0; }
function groupKeys(NU) {
  var c = {}; NU.forEach(function (r) { Object.keys(r.g).forEach(function (k) { if (r.g[k].pos && r.g[k].pos !== "div") c[k] = (c[k] || 0) + 1; }); });
  return Object.keys(c).filter(function (k) { return c[k] >= MINP; }).sort(function (a, b) { return c[b] - c[a]; });
}
function distMatrix(NU, keys) {
  var n = keys.length, D = [], known = [], miss = 0;
  for (var i = 0; i < n; i++) { D.push([]); for (var j = 0; j < n; j++) D[i].push(i === j ? 0 : null); }
  for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
    var s = 0, m = 0;
    NU.forEach(function (r) { var x = r.g[keys[i]], y = r.g[keys[j]]; if (!x || !y || x.pos === "div" || y.pos === "div" || !x.pos || !y.pos) return; m++; s += posScore(x.pos, y.pos); });
    if (m >= MINP) { D[i][j] = D[j][i] = 1 - s / m; known.push(1 - s / m); }
  }
  if (!known.length) return null;
  var mu = mean(known);
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (D[i][j] === null) { D[i][j] = mu; if (i < j) miss++; }
  return { D: D, miss: miss };
}
function topEig(B) {
  var n = B.length, c = 0, i, j;
  for (i = 0; i < n; i++) { var rs = 0; for (j = 0; j < n; j++) rs += Math.abs(B[i][j]); if (rs > c) c = rs; }
  var v = []; for (i = 0; i < n; i++) v.push(Math.sin(i * 1.7 + 1.3) + 1.1);
  for (var it = 0; it < 600; it++) {
    var w = []; for (i = 0; i < n; i++) { var a = c * v[i]; for (j = 0; j < n; j++) a += B[i][j] * v[j]; w.push(a); }
    var nr = Math.sqrt(w.reduce(function (x, y) { return x + y * y; }, 0)); if (!nr) break; v = w.map(function (x) { return x / nr; });
  }
  var lam = 0; for (i = 0; i < n; i++) { var bv = 0; for (j = 0; j < n; j++) bv += B[i][j] * v[j]; lam += bv * v[i]; }
  return { v: v, l: lam };
}
function mds(Dm) {
  var n = Dm.length; if (n < 3) return null;
  var A = Dm.map(function (r) { return r.map(function (x) { return x * x; }); }), rm = A.map(function (r) { return mean(r); }), gm = mean(rm);
  var B = A.map(function (r, i) { return r.map(function (x, j) { return -0.5 * (x - rm[i] - rm[j] + gm); }); });
  var tr = 0; for (var i = 0; i < n; i++) tr += B[i][i];
  var e1 = topEig(B);
  var B2 = B.map(function (r, i) { return r.map(function (x, j) { return x - e1.l * e1.v[i] * e1.v[j]; }); });
  var e2 = topEig(B2);
  var s1 = Math.sqrt(Math.max(e1.l, 0)), s2 = Math.sqrt(Math.max(e2.l, 0)), den = Math.abs(tr) || 1;
  return { pts: e1.v.map(function (x, i) { return [x * s1, e2.v[i] * s2]; }), ex: [Math.max(e1.l, 0) / den, Math.max(e2.l, 0) / den] };
}
function latestLeg(R, k) { for (var i = 0; i < R.length; i++) if (R[i].g[k]) return R[i].l; return LG || ""; }

function vMapa(R) {
  var t = TT(), NU = R.filter(function (r) { return !r.un; }), keys = groupKeys(NU);
  if (keys.length < 3) return emptyBox("Hacen falta al menos 3 grupos con " + MINP + " o más votaciones no unánimes para dibujar el mapa. Prueba con «Todas las legislaturas».");
  var dm = distMatrix(NU, keys), m = dm && mds(dm.D); if (!m) return emptyBox("No hay datos suficientes para calcular el mapa.");
  var pts = m.pts.map(function (p) { return p.slice(); }), lid = latestLeg(R, keys[0]);
  var gov = keys.map(function (k, i) { return t.isGov && t.isGov(latestLeg(R, k), k) ? i : -1; }).filter(function (i) { return i > -1; });
  if (gov.length && mean(gov.map(function (i) { return pts[i][0]; })) > 0) pts.forEach(function (p) { p[0] = -p[0]; });
  else if (!gov.length && pts[0][0] > 0) pts.forEach(function (p) { p[0] = -p[0]; });
  if (pts[0][1] < 0) pts.forEach(function (p) { p[1] = -p[1]; });
  var mx = Math.max.apply(null, pts.map(function (p) { return Math.max(Math.abs(p[0]), Math.abs(p[1])); })) || 1,
    W = 560, H = 380, X0 = W / 2, Y0 = H / 2, sc = Math.min(W / 2 - 70, H / 2 - 50) / mx;
  var P = pts.map(function (p) { return [X0 + p[0] * sc, Y0 - p[1] * sc]; });
  var o = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Mapa político del pleno: cuanto más cerca, más votan igual">'
    + '<line class="axis" x1="20" x2="' + (W - 20) + '" y1="' + Y0 + '" y2="' + Y0 + '"/><line class="axis" y1="14" y2="' + (H - 14) + '" x1="' + X0 + '" x2="' + X0 + '"/>'
    + '<text class="chartlabel" x="' + (W - 14) + '" y="' + (H - 8) + '" text-anchor="end">Eje horizontal · ' + Math.round(m.ex[0] * 100) + ' % de las diferencias</text>'
    + '<text class="chartlabel" x="14" y="' + (H - 8) + '">Eje vertical · ' + Math.round(m.ex[1] * 100) + ' %</text>';
  for (var i = 0; i < keys.length; i++) for (var j = i + 1; j < keys.length; j++) {
    var d = dm.D[i][j]; if (d <= 0.2) o += '<line x1="' + P[i][0].toFixed(1) + '" y1="' + P[i][1].toFixed(1) + '" x2="' + P[j][0].toFixed(1) + '" y2="' + P[j][1].toFixed(1) + '" stroke="var(--ac)" stroke-width="2" stroke-dasharray="4 4" opacity=".45"><title>' + esc(keys[i] + " – " + keys[j]) + ": " + Math.round((1 - d) * 100) + " % de coincidencia</title></line>";
  }
  var above = {};
  keys.forEach(function (k, i) { for (var j = 0; j < i; j++) { if (Math.abs(P[i][0] - P[j][0]) < 46 && Math.abs(P[i][1] - P[j][1]) < 40 && !above[j]) { above[i] = true; break; } } });
  keys.forEach(function (k, i) {
    var s = t.seatOf ? t.seatOf(latestLeg(R, k), k) : 0, r = 11 + 4.2 * Math.sqrt(s || 1), isg = gov.indexOf(i) > -1;
    o += '<circle cx="' + P[i][0].toFixed(1) + '" cy="' + P[i][1].toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + col(k) + '" fill-opacity=".85" stroke="' + (isg ? "var(--fg)" : "var(--sf)") + '" stroke-width="' + (isg ? 3 : 2) + '"><title>' + esc(k) + (s ? " · " + s + " escaños" : "") + (isg ? " · gobierno" : "") + "</title></circle>"
      + '<text x="' + (P[i][0] + (above[i] ? r + 6 : 0)).toFixed(1) + '" y="' + (above[i] ? P[i][1] + 4 : P[i][1] + r + 14).toFixed(1) + '" text-anchor="' + (above[i] ? "start" : "middle") + '" font-size="12" font-weight="600" fill="var(--fg)">' + esc(k) + "</text>";
  });
  o += "</svg>";
  var prox = "";
  if (gov.length && gov.length < keys.length) {
    var rows = keys.map(function (k, i) { if (gov.indexOf(i) > -1) return null; var a = mean(gov.map(function (g) { return 1 - dm.D[i][g]; })); return { k: k, v: a }; }).filter(Boolean).sort(function (a, b) { return b.v - a.v; });
    prox = '<div class="pnl" style="margin-top:18px"><h2>Cercanía al gobierno</h2><p class="m">Coincidencia media de voto con los grupos de gobierno, en votaciones no unánimes.</p>' + rows.map(function (r) { return '<div class="li"><span>' + dot(r.k) + "<b>" + esc(r.k) + '</b> <small>' + Math.round(r.v * 100) + ' %</small></span><div class="bar"><i style="width:' + Math.round(r.v * 100) + "%;background:" + col(r.k) + '"></i></div></div>'; }).join("") + "</div>";
  }
  return '<div class="pnl xmap-box"><h2>Mapa político del pleno</h2><p class="m">Cada burbuja es un grupo; <b>cuanto más cerca, más votan igual</b>. Se calcula con escalado multidimensional clásico sobre la discrepancia de voto en las ' + NU.length + " votaciones no unánimes (idea de los mapas de Voteview). Tamaño = escaños; borde grueso = gobierno; línea discontinua = coincidencia ≥ 80 %.</p>"
    + o + '<p class="corrnote">Los ejes no tienen etiqueta ideológica: describen cómo se agrupan los votos. Los dos ejes explican en conjunto el ' + Math.round((m.ex[0] + m.ex[1]) * 100) + " % de las diferencias." + (dm.miss ? " " + dm.miss + " pares con menos de " + MINP + " votaciones comunes se han estimado con la distancia media." : "") + "</p></div>" + prox;
}

/* ====================== Test «¿con quién votarías?» ====================== */
function vaaQuestions(R, n) {
  var C = [];
  R.forEach(function (r) {
    if (r.un) return; var f = 0, c = 0, a = 0;
    Object.keys(r.g).forEach(function (k) { var d = gdir(r.g[k]); if (d === "favor") f++; else if (d === "contra") c++; else if (d === "abst") a++; });
    if (f && c) { var mn = Math.min(f, c); C.push({ r: r, score: mn * 10 + mn / (f + c) + (a ? 1 : 0) }); }
  });
  C.sort(function (a, b) { return b.score - a.score; });
  var out = [], cnt = {}, cap = Math.max(2, Math.ceil(n / 4));
  C.forEach(function (x) { if (out.length < n && (cnt[x.r.tema] || 0) < cap) { out.push(x.r); cnt[x.r.tema] = (cnt[x.r.tema] || 0) + 1; } });
  C.forEach(function (x) { if (out.length < n && out.indexOf(x.r) < 0) out.push(x.r); });
  return out;
}
function vaaScore(qs, ans) {
  var A = {};
  qs.forEach(function (r, i) {
    var a = ans[i]; if (!a) return;
    Object.keys(r.g).forEach(function (k) {
      var d = gdir(r.g[k]); if (!d) return; var o = A[k] || (A[k] = { k: k, s: 0, n: 0 });
      o.n++; o.s += a === d ? 1 : (a === "abst" || d === "abst") ? 0.5 : 0;
    });
  });
  return Object.keys(A).map(function (k) { return { k: k, n: A[k].n, p: A[k].s / A[k].n }; }).sort(function (a, b) { return b.p - a.p || b.n - a.n; });
}
function vVaa(R) {
  var V = X.vaa;
  if (!V) {
    var q = vaaQuestions(R, 10);
    if (q.length < 5) return emptyBox("Hacen falta al menos 5 votaciones divididas con desglose por grupo para montar el test. Prueba con «Todas las legislaturas».");
    return '<div class="pnl vaa-intro"><p class="eyebrow">Test de afinidad</p><h2>¿Con quién votarías en el pleno de Viladecans?</h2><p>Te presentamos votaciones reales en las que los grupos se dividieron. Responde como lo harías tú (sin ver qué votó cada grupo) y te diremos con quién coincides más.</p>'
      + '<div class="chips" style="margin:12px 0">' + [8, 10, 15].map(function (n) { return '<button class="' + (X.vaaN === n ? "sel" : "") + '" onclick="ObsX.vaaN(' + n + ')">' + n + " preguntas</button>"; }).join("") + '</div><button class="p vaa-go" onclick="ObsX.start()">Empezar el test →</button>'
      + '<p class="corrnote">Tus respuestas no se guardan ni se envían a ningún sitio. Se usa el filtro de legislatura y tipo de sesión de arriba. Coincidir en votos no implica afinidad ideológica ni recomendación de voto.</p></div>';
  }
  if (V.i < V.qs.length) {
    var r = V.qs[V.i], pr = Math.round(V.i / V.qs.length * 100);
    return '<div class="pnl vaa-card"><div class="bar" style="height:8px;margin:14px 0 6px"><i style="width:' + pr + '%;background:var(--ac)"></i></div><p class="m">Pregunta ' + (V.i + 1) + " de " + V.qs.length + " · " + fd(r.p.fecha) + " · " + esc(r.tema) + "</p>"
      + '<h2 class="vaa-q">' + esc(sh(r.v.asunto, 260)) + '</h2><div class="vaa-btns"><button class="vaa-b vaa-f" onclick="ObsX.ans(\'favor\')">👍 A favor</button><button class="vaa-b vaa-c" onclick="ObsX.ans(\'contra\')">👎 En contra</button><button class="vaa-b vaa-a" onclick="ObsX.ans(\'abst\')">✋ Me abstengo</button></div>'
      + '<div class="fm" style="margin-top:12px"><button class="sm" onclick="ObsX.ans(\'\')">Saltar</button>' + (V.i ? '<button class="sm" onclick="ObsX.back()">← Anterior</button>' : "") + '<button class="sm" onclick="ObsX.reset()">Cancelar</button></div></div>';
  }
  var sc = vaaScore(V.qs, V.ans), n = V.ans.filter(Boolean).length;
  if (!sc.length) return '<div class="pnl"><p class="e">No has respondido ninguna pregunta.</p><button class="p" onclick="ObsX.reset()">Volver a empezar</button></div>';
  var top = sc[0], low = sc[sc.length - 1];
  var tb = '<div class="w"><table><tr><th>Votación</th><th>Tú</th>' + sc.map(function (s) { return "<th>" + esc(s.k) + "</th>"; }).join("") + "<th>Resultado</th></tr>"
    + V.qs.map(function (r, i) {
      return "<tr><td>" + esc(sh(r.v.asunto, 70)) + "</td><td><b>" + (V.ans[i] ? NOM[V.ans[i]] : "—") + "</b></td>" + sc.map(function (s) { var d = r.g[s.k] ? gdir(r.g[s.k]) : ""; return '<td class="' + (d && V.ans[i] ? (d === V.ans[i] ? "ok" : "ko") : "") + '">' + (d ? NOM[d] : "·") + "</td>"; }).join("") + "<td>" + (r.ok ? "Aprobado" : "Rechazado") + "</td></tr>";
    }).join("") + "</table></div>";
  return '<div class="pnl vaa-res"><p class="eyebrow">Tu resultado · ' + n + " respuestas</p><h2>Coincides más con <span style=\"color:" + col(top.k) + '">' + esc(top.k) + "</span> (" + Math.round(top.p * 100) + " %)</h2>"
    + (sc.length > 1 ? '<p class="m">Y menos con ' + esc(low.k) + " (" + Math.round(low.p * 100) + " %).</p>" : "")
    + sc.map(function (s) { return '<div class="li"><span>' + dot(s.k) + "<b>" + esc(s.k) + "</b><small> " + s.n + " votaciones comparadas</small></span><div><b>" + Math.round(s.p * 100) + ' %</b><div class="bar"><i style="width:' + Math.round(s.p * 100) + "%;background:" + col(s.k) + '"></i></div></div></div>'; }).join("")
    + '<p class="corrnote">Puntuación: 100 % si votas igual que el grupo, 50 % si uno se abstiene y el otro no, 0 % si votáis en sentido opuesto. Es coincidencia en votaciones concretas, no afinidad ideológica ni recomendación de voto.</p>'
    + '<div class="fm noprint"><button class="p" onclick="ObsX.share()">Copiar mi resultado</button><button onclick="ObsX.reset()">Repetir el test</button></div></div>'
    + '<div class="pnl" style="margin-top:18px"><h2>Comparación detallada</h2>' + tb + "</div>";
}

/* ====================== Buscador ====================== */
function searchRecs() {
  var t = TT(), F = X.F, all = t.recs ? t.recs(D) : [], q = F.q.trim().toLowerCase();
  return all.filter(function (r) {
    if (q && (r.v.asunto || "").toLowerCase().indexOf(q) < 0 && r.prop.join(" ").toLowerCase().indexOf(q) < 0) return false;
    if (F.g) { var x = r.g[F.g]; if (!x) return false; if (F.pos && x.pos !== F.pos) return false; }
    if (F.tema && r.tema !== F.tema) return false;
    if (F.res === "ok" && !r.ok) return false; if (F.res === "ko" && r.ok) return false; if (F.res === "un" && !r.un) return false;
    if (F.tipo && cat(r.p) !== F.tipo) return false; if (F.leg && r.l !== F.leg) return false; if (F.mo && !r.mo) return false;
    return true;
  }).sort(function (a, b) { return b.p.fecha.localeCompare(a.p.fecha) || String(a.v.punto).localeCompare(String(b.v.punto), "es", { numeric: true }); });
}
function rrow(r) {
  return '<div class="it"><small>' + fd(r.p.fecha) + " · " + esc(cat(r.p)) + " · punto " + esc(r.v.punto) + " · " + esc(r.tema) + (r.prop.length ? " · presenta " + esc(r.prop.join(", ")) : "") + "</small>" + esc(sh(r.v.asunto, 200)) + " " + tg(r.v)
    + ' <span class="ep-ci">' + r.f + " Sí · " + r.c + " No · " + r.a + " Abst.</span>" + '<div class="pv" style="padding:6px 0 0">' + pv(r.v) + "</div>" + (r.v.video ? '<a class="vl" href="' + esc(r.v.video) + '" target="_blank" rel="noopener">▶ Ver este punto en el videoacta</a>' : "") + "</div>";
}
function searchList() {
  var L = searchRecs(), F = X.F;
  return '<p class="m">' + L.length + " votaciones encontradas." + (L.length ? ' <button class="sm noprint" onclick="ObsX.csv()">Descargar resultados (CSV)</button>' : "") + "</p>" + (L.slice(0, F.n).map(rrow).join("") || '<p class="e">Sin resultados. Prueba con menos filtros.</p>')
    + (L.length > F.n ? '<button class="sm noprint" onclick="ObsX.more()">Ver más (' + (L.length - F.n) + " restantes)</button>" : "");
}
function vBus() {
  var t = TT(), F = X.F, gs = {}, tipos = {}, legs = {};
  D.forEach(function (p) { tipos[cat(p)] = 1; legs[legOf(p.fecha)] = 1; (p.votaciones || []).forEach(function (v) { Object.keys(v.partidos || {}).forEach(function (k) { gs[k] = 1; }); }); });
  var opt = function (arr, cur_, all) { return '<option value="">' + all + "</option>" + arr.map(function (x) { return '<option value="' + esc(x) + '"' + (x === cur_ ? " selected" : "") + ">" + esc(x) + "</option>"; }).join(""); };
  return '<div class="pnl" style="padding-top:16px"><h2 style="margin-top:0">Buscador de votaciones</h2><div class="fm"><input class="x" type="search" placeholder="Palabra del asunto o grupo que presenta…" value="' + esc(F.q) + '" oninput="ObsX.sf(\'q\',this.value)"></div>'
    + '<div class="fm"><select onchange="ObsX.sf(\'g\',this.value)">' + opt(Object.keys(gs).sort(), F.g, "Cualquier grupo") + '</select><select onchange="ObsX.sf(\'pos\',this.value)"><option value="">Cualquier voto</option>' + [["favor", "votó Sí"], ["contra", "votó No"], ["abst", "se abstuvo"], ["div", "se dividió"]].map(function (x) { return '<option value="' + x[0] + '"' + (F.pos === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + '</select><select onchange="ObsX.sf(\'tema\',this.value)">' + opt(t.TEMAS || [], F.tema, "Cualquier tema") + '</select></div>'
    + '<div class="fm"><select onchange="ObsX.sf(\'res\',this.value)"><option value="">Cualquier resultado</option><option value="ok"' + (F.res === "ok" ? " selected" : "") + '>Aprobadas</option><option value="ko"' + (F.res === "ko" ? " selected" : "") + '>Rechazadas</option><option value="un"' + (F.res === "un" ? " selected" : "") + '>Unánimes</option></select><select onchange="ObsX.sf(\'tipo\',this.value)">' + opt(Object.keys(tipos).sort(), F.tipo, "Cualquier tipo de sesión") + '</select><select onchange="ObsX.sf(\'leg\',this.value)">' + opt(Object.keys(legs).filter(Boolean).sort().reverse(), F.leg, "Cualquier legislatura") + '</select><label class="m" style="display:inline-flex;gap:6px;align-items:center;margin:0"><input type="checkbox"' + (F.mo ? " checked" : "") + ' onchange="ObsX.sf(\'mo\',this.checked)"> Solo mociones</label></div></div>'
    + '<div class="pnl" id="xs-res" style="margin-top:14px">' + searchList() + "</div>";
}

/* ====================== Curiosidades ====================== */
function curiosities(R) {
  var t = TT(), C = [], fP = t.fP || function (o) { return Math.round(o.p * 100) + " %"; };
  if (!R.length) return C;
  var close = R.filter(function (r) { return r.t > 0 && !r.un && r.f !== r.c; }).sort(function (a, b) { return Math.abs(a.f - a.c) - Math.abs(b.f - b.c) || b.p.fecha.localeCompare(a.p.fecha); })[0];
  if (close) C.push({ i: "⚖️", t: "La votación más ajustada", x: "«" + esc(sh(close.v.asunto, 130)) + "» " + (close.ok ? "salió adelante" : "se rechazó") + " por solo <b>" + Math.abs(close.f - close.c) + (Math.abs(close.f - close.c) === 1 ? " voto" : " votos") + "</b> (" + close.f + "–" + close.c + ", " + close.a + " abst.) el " + fd(close.p.fecha) + "." });
  var asc = R.slice().sort(function (a, b) { return a.p.fecha.localeCompare(b.p.fecha) || String(a.v.punto).localeCompare(String(b.v.punto), "es", { numeric: true }); }), best = 0, run = 0;
  asc.forEach(function (r) { run = r.un ? run + 1 : 0; if (run > best) best = run; });
  if (best >= 3) C.push({ i: "🤝", t: "Racha de consenso", x: "La racha más larga de votaciones <b>unánimes consecutivas</b> es de <b>" + best + "</b>." + (run === best ? " Y sigue abierta." : "") });
  var gs = t.groupStats ? t.groupStats(R) : {}, ks = Object.keys(gs);
  var nays = ks.filter(function (k) { return gs[k].n >= 10; }).sort(function (a, b) { return gs[b].co / gs[b].n - gs[a].co / gs[a].n; })[0];
  if (nays && gs[nays].co) C.push({ i: "🚫", t: "El grupo del «No»", x: "<b>" + esc(nays) + "</b> votó en contra en el <b>" + Math.round(gs[nays].co / gs[nays].n * 100) + " %</b> de sus " + gs[nays].n + " votaciones." });
  var abs = ks.filter(function (k) { return gs[k].n >= 10; }).sort(function (a, b) { return gs[b].ab / gs[b].n - gs[a].ab / gs[a].n; })[0];
  if (abs && gs[abs].ab && abs !== nays) C.push({ i: "✋", t: "El grupo de la abstención", x: "<b>" + esc(abs) + "</b> se abstuvo en el <b>" + Math.round(gs[abs].ab / gs[abs].n * 100) + " %</b> de sus votaciones." });
  var dec = ks.filter(function (k) { return gs[k].n >= 8; }).sort(function (a, b) { return gs[b].pv / gs[b].n - gs[a].pv / gs[a].n; })[0];
  if (dec && gs[dec].pv) C.push({ i: "🎯", t: "El grupo que desequilibra", x: "Sin los votos de <b>" + esc(dec) + "</b> habría cambiado el resultado en <b>" + gs[dec].pv + "</b> votaciones." });
  var by = {}; R.forEach(function (r) { var k = r.p.fecha + "|" + cat(r.p); by[k] = (by[k] || 0) + 1; });
  var big = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0];
  if (big && by[big] >= 5) C.push({ i: "📚", t: "La sesión más cargada", x: "El pleno del <b>" + fd(big.split("|")[0]) + "</b> (" + esc(big.split("|")[1]) + ") sometió a votación <b>" + by[big] + " puntos</b>." });
  var mo = R.filter(function (r) { return r.mo && r.ok; }).sort(function (a, b) { return b.f - a.f; })[0];
  if (mo) C.push({ i: "📣", t: "La moción con más apoyos", x: "«" + esc(sh(mo.v.asunto, 120)) + "» de <b>" + esc(mo.prop.join(", ")) + "</b> reunió <b>" + mo.f + " votos a favor</b>." });
  var A = t.affinity ? t.affinity(R, true) : {}, best2 = null;
  Object.keys(A).forEach(function (a) { Object.keys(A[a]).forEach(function (b) {
    var o = A[a][b]; if (a < b && o.t >= MINP) { var cross = t.isGov && R[0] && (t.isGov(R[0].l, a) !== t.isGov(R[0].l, b)); var s = o.s / o.t + (cross ? 0.0001 : 0); if (!best2 || s > best2.s) best2 = { a: a, b: b, s: s, o: o, cross: cross }; }
  }); });
  if (best2) C.push({ i: "🧲", t: "Los que más coinciden", x: "<b>" + esc(best2.a) + "</b> y <b>" + esc(best2.b) + "</b> votan igual en el <b>" + Math.round(best2.o.s / best2.o.t * 100) + " %</b> de las votaciones no unánimes (" + best2.o.t + " en común)." });
  var tm = {}; R.forEach(function (r) { (tm[r.tema] = tm[r.tema] || []).push(r); });
  var hot = Object.keys(tm).filter(function (k) { return tm[k].length >= 5 && k !== "Otros"; }).sort(function (a, b) { return tm[a].filter(function (r) { return r.un; }).length / tm[a].length - tm[b].filter(function (r) { return r.un; }).length / tm[b].length; })[0];
  if (hot) C.push({ i: "🔥", t: "El tema más polémico", x: "<b>" + esc(hot) + "</b>: solo el <b>" + Math.round(tm[hot].filter(function (r) { return r.un; }).length / tm[hot].length * 100) + " %</b> de las " + tm[hot].length + " votaciones fue unánime." });
  var gl = R.filter(function (r) { return t.govDir && t.govDir(r) && ((t.govDir(r) === "f") !== r.ok); });
  if (gl.length) C.push({ i: "📉", t: "Cuando el gobierno pierde", x: "El sentido de voto del gobierno no coincidió con el resultado en <b>" + gl.length + "</b> votaciones. La última, el " + fd(gl[0].p.fecha) + ": «" + esc(sh(gl[0].v.asunto, 100)) + "»." });
  return C;
}
function vCur(R) {
  var C = curiosities(R); if (!C.length) return emptyBox("Aún no hay datos suficientes para generar curiosidades.");
  return '<p class="m">Hallazgos automáticos sobre el periodo filtrado. Cada tarjeta se puede copiar como imagen con su cita (botón ⧉).</p><div class="cu-grid">' + C.map(cuCard).join("") + "</div>";
}
function cuCard(c) { return '<div class="cu"><div class="cu-i" aria-hidden="true">' + c.i + "</div><h3>" + c.t + "</h3><p>" + c.x + "</p></div>"; }

/* ====================== Novedades y seguimiento ====================== */
function LS(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
function LSset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function keyOf(p, v) { return p.fecha + "|" + cat(p) + "|" + v.punto; }
function follow() { return LS("obs-sigo", { g: [], t: [] }); }
function novedades() {
  var R = (TT().recs ? TT().recs(D) : []), seen = LS("obs-visto", null), F = follow();
  if (!R.length) return { list: [], init: false };
  if (!seen) { LSset("obs-visto", R.map(function (r) { return keyOf(r.p, r.v); })); return { list: [], init: true }; }
  var s = {}; seen.forEach(function (k) { s[k] = 1; });
  var L = R.filter(function (r) { return !s[keyOf(r.p, r.v)]; });
  if (F.g.length || F.t.length) L = L.filter(function (r) { return F.g.some(function (g) { return r.g[g]; }) || F.t.indexOf(r.tema) > -1; });
  return { list: L, init: false };
}
function vNov(R) {
  var N = novedades(), F = follow(), t = TT(), gs = {}; R.forEach(function (r) { Object.keys(r.g).forEach(function (k) { gs[k] = 1; }); });
  var chips = function (arr, kind, sel) { return '<div class="chips">' + arr.map(function (x) { var on = sel.indexOf(x) > -1; return '<button class="' + (on ? "sel" : "") + '" data-k="' + esc(x) + '" onclick="ObsX.follow(\'' + kind + '\',this.dataset.k)">' + (on ? "★ " : "☆ ") + esc(x) + "</button>"; }).join("") + "</div>"; };
  return '<div class="pnl" style="padding-top:16px"><h2 style="margin-top:0">Sigue lo que te interesa</h2><p class="m">Marca los grupos y temas que sigues y aquí verás las votaciones nuevas desde tu última visita (se guarda solo en este navegador).</p><p class="m"><b>Grupos</b></p>' + chips(Object.keys(gs).sort(), "g", F.g) + '<p class="m" style="margin-top:12px"><b>Temas</b></p>' + chips(t.TEMAS || [], "t", F.t) + "</div>"
    + '<div class="pnl" style="margin-top:14px"><h2>Novedades' + (N.list.length ? " (" + N.list.length + ")" : "") + "</h2>"
    + (N.list.length ? N.list.slice(0, 40).map(rrow).join("") + '<div class="fm noprint"><button class="p" onclick="ObsX.seen()">Marcar todo como visto</button></div>' : '<p class="e">' + (N.init ? "Primera visita: a partir de ahora te avisaremos de lo nuevo." : "Estás al día. No hay votaciones nuevas desde tu última visita.") + "</p>") + "</div>";
}

/* ====================== Tarjetas de grupo (inicio) ====================== */
function spark(vals) {
  var pts = vals.map(function (v, i) { return v == null ? null : [6 + i * (108 / Math.max(1, vals.length - 1)), 30 - v * 26]; }).filter(Boolean);
  if (pts.length < 2) return "";
  return '<svg viewBox="0 0 120 34" class="gc-sp" aria-hidden="true"><polyline fill="none" stroke="var(--gc)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/><circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="2.8" fill="var(--gc)"/></svg>';
}
function groupCards(R) {
  var t = TT(); if (!R.length || !t.groupStats) return "";
  var gs = t.groupStats(R), ks = Object.keys(gs).sort(function (a, b) { return gs[b].n - gs[a].n; }), F = follow();
  if (!ks.length) return "";
  return '<h2 class="sec-t">Los grupos, de un vistazo</h2><div class="gc-grid">' + ks.map(function (k) {
    var g = gs[k], seats = t.seatOf ? t.seatOf(latestLeg(R, k), k) : 0, by = {};
    R.forEach(function (r) { var x = r.g[k]; if (!x) return; var d = x.f > x.c ? "f" : x.c > x.f ? "c" : ""; if (!d) return; var q = Q(r.p.fecha), o = by[q] || (by[q] = { d: 0, w: 0 }); o.d++; if ((d === "f") === r.ok) o.w++; });
    var qs = Object.keys(by).sort(), vals = qs.map(function (q) { return by[q].d >= 3 ? by[q].w / by[q].d : null; }), on = F.g.indexOf(k) > -1;
    var mo = R.filter(function (r) { return r.mo && r.prop.indexOf(k) > -1; });
    return '<div class="gc" style="--gc:' + col(k) + '"><div class="gc-h"><b>' + esc(k) + '</b><button class="gc-star noprint" data-k="' + esc(k) + '" onclick="ObsX.follow(\'g\',this.dataset.k);event.stopPropagation()" title="Seguir este grupo" aria-label="Seguir ' + esc(k) + '">' + (on ? "★" : "☆") + "</button></div><div class=\"gc-n\">" + (seats ? seats + " escaños · " : "") + g.n + " votos</div>"
      + '<div class="gc-s"><div><b>' + (g.dN ? Math.round(g.wN / g.dN * 100) + " %" : "–") + "</b><span>con el resultado</span></div><div><b>" + (g.rn ? Math.round(g.rs / g.rn * 100) + " %" : "–") + "</b><span>cohesión</span></div><div><b>" + mo.length + "</b><span>mociones</span></div></div>" + spark(vals)
      + '<button class="sm noprint" data-k="' + esc(k) + '" onclick="ObsX.grupo(this.dataset.k)">Ver su informe →</button></div>';
  }).join("") + "</div>";
}

/* ====================== Inicio (hero) ====================== */
function hero() {
  var t = TT(), R = cur(), n = R.length;
  if (!n || !t.summary) return "";
  var s = t.summary(R), ses = {}; R.forEach(function (r) { ses[r.p.fecha + "|" + cat(r.p)] = 1; });
  var mo = R.filter(function (r) { return r.mo; }).length, N = novedades().list.length;
  var head = s.un.p >= 0.6 ? "En Viladecans, " + Math.round(s.un.p * 100) + " de cada 100 votaciones del pleno salen por unanimidad" : "En Viladecans, solo " + Math.round(s.un.p * 100) + " de cada 100 votaciones del pleno son unánimes";
  var cnt = function (v, suf, lab) { return '<div><b data-count="' + v + '" data-suf="' + suf + '">' + v + suf + "</b><span>" + lab + "</span></div>"; };
  return '<section class="hero"><div class="hero-in"><p class="eyebrow">Observatorio de plenos · ' + (LG ? "legislatura " + esc(LG) : "todas las legislaturas") + "</p><h1>" + head + "</h1><p class=\"hero-sub\">Qué se vota, quién gana, quién decide y con quién coincide cada grupo. Datos de las actas del pleno, analizados con rigor.</p>"
    + '<div class="hero-cnt">' + cnt(n, "", "votaciones analizadas") + cnt(Object.keys(ses).length, "", "sesiones") + cnt(Math.round(s.un.p * 100), " %", "unanimidad") + cnt(Math.round(s.ap.p * 100), " %", "aprobadas") + cnt(mo, "", "mociones") + "</div>"
    + '<div class="hero-cta noprint"><button class="btn-h" onclick="ObsX.go(\'vaa\')">🗳️ ¿Con quién votarías?</button><button class="btn-h btn-2" onclick="ObsX.go(\'mapa\')">🧭 Mapa político</button><button class="btn-h btn-2" onclick="ObsX.go(\'cur\')">✨ Curiosidades</button>' + (N ? '<button class="btn-h btn-3" onclick="ObsX.go(\'nov\')">🔔 ' + N + " novedades</button>" : "") + "</div></div></section>";
}
function inicio() {
  var R = cur(), h = hero(); if (!h) return "";
  var C = curiosities(R).slice(0, 3);
  return h + (C.length ? '<h2 class="sec-t">Lo que dicen los datos</h2><div class="cu-grid">' + C.map(cuCard).join("") + '</div><p class="m noprint"><a href="#explora" onclick="ObsX.go(\'cur\')">Ver todas las curiosidades →</a></p>' : "") + groupCards(R) + '<h2 class="sec-t">Informe del último pleno</h2>';
}

/* ====================== Pestaña Explorar ====================== */
var XT = [["mapa", "🧭 Mapa político"], ["vaa", "🗳️ ¿Con quién votarías?"], ["bus", "🔎 Buscador"], ["cur", "✨ Curiosidades"], ["nov", "🔔 Novedades"]];
function renderExplora() {
  var el = el_("v-explora"); if (!el) return;
  var R = cur(), body = "";
  try { body = ({ mapa: function () { return vMapa(R); }, vaa: function () { return vVaa(R); }, bus: vBus, cur: function () { return vCur(R); }, nov: function () { return vNov(R); } })[X.tab](); }
  catch (e) { body = emptyBox("No se pudo generar esta vista: " + esc(e.message || e)); if (window.console) console.error(e); }
  var N = 0; try { N = novedades().list.length; } catch (e) {}
  el.innerHTML = '<p class="eyebrow">Explorar los datos</p><h2 class="lead" style="margin-top:0">Descubre cómo vota Viladecans</h2><div class="chips noprint" style="margin-bottom:14px">'
    + XT.map(function (x) { return '<button class="' + (X.tab === x[0] ? "sel" : "") + "\" onclick=\"ObsX.tab('" + x[0] + "')\">" + x[1] + (x[0] === "nov" && N ? " (" + N + ")" : "") + "</button>"; }).join("") + "</div>" + body;
}
function csvRows(L) {
  var r = [["fecha", "tipo", "punto", "asunto", "tema", "resultado", "a_favor", "en_contra", "abstenciones", "proponentes"]];
  L.forEach(function (x) { r.push([x.p.fecha, cat(x.p), x.v.punto, x.v.asunto, x.tema, res(x.v), x.f, x.c, x.a, x.prop.join(", ")]); });
  return r;
}
function dlText(name, txt, mime) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function dlCsv(name, rows, cite) {
  var rr = rows.slice(); if (cite) { rr.push([]); rr.push([cite]); }
  dlText(name, "﻿" + rr.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(";"); }).join("\n"), "text/csv;charset=utf-8");
}

window.ObsX = {
  tab: function (t) { X.tab = t; renderExplora(); },
  go: function (t) { X.tab = t; if (t === "vaa") X.vaa = null; location.hash = "#explora"; renderExplora(); window.scrollTo(0, 0); },
  vaaN: function (n) { X.vaaN = n; renderExplora(); },
  start: function () { var q = vaaQuestions(cur(), X.vaaN); X.vaa = { qs: q, i: 0, ans: [] }; renderExplora(); },
  ans: function (a) { var V = X.vaa; if (!V) return; V.ans[V.i] = a; V.i++; renderExplora(); window.scrollTo(0, 0); },
  back: function () { var V = X.vaa; if (V && V.i > 0) { V.i--; renderExplora(); } },
  reset: function () { X.vaa = null; renderExplora(); },
  share: function () {
    var V = X.vaa, sc = vaaScore(V.qs, V.ans), txt = "Mi afinidad de voto en el pleno de Viladecans (" + V.ans.filter(Boolean).length + " votaciones reales): " + sc.map(function (s) { return s.k + " " + Math.round(s.p * 100) + " %"; }).join(" · ") + ".\n" + citaCorta();
    copyPlain(txt);
  },
  sf: function (k, v) { X.F[k] = v; X.F.n = 40; var r = el_("xs-res"); if (r) { r.innerHTML = searchList(); enhance(); } },
  more: function () { X.F.n += 40; var r = el_("xs-res"); if (r) r.innerHTML = searchList(); },
  csv: function () { dlCsv("busqueda-votaciones-viladecans.csv", csvRows(searchRecs()), citaCorta()); },
  follow: function (kind, v) { var F = follow(), a = F[kind], i = a.indexOf(v); if (i > -1) a.splice(i, 1); else a.push(v); LSset("obs-sigo", F); window.render(); },
  seen: function () { var R = TT().recs(D); LSset("obs-visto", R.map(function (r) { return keyOf(r.p, r.v); })); window.render(); },
  grupo: function (k) { if (window.ObsPro) { window.ObsPro.set("grupo", k); window.ObsPro.set("tab", "mg"); } location.hash = "#estudio"; window.scrollTo(0, 0); },
  _t: { mds: mds, distMatrix: distMatrix, groupKeys: groupKeys, vaaQuestions: vaaQuestions, vaaScore: vaaScore, curiosities: curiosities, citaCorta: citaCorta, citaApa: citaApa, searchRecs: searchRecs, novedades: novedades }
};

/* ====================== Copiar / descargar con cita ====================== */
var CX_SEL = ".chartbox,.pnl,.cu,.gc,.inf-hero";
var PROPS = ["display", "position", "top", "left", "right", "bottom", "float", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-self", "align-content", "justify-content", "justify-items", "gap", "row-gap", "column-gap", "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end", "order",
  "min-width", "max-width", "min-height", "max-height", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius", "background-color", "background-image", "background-size", "background-position", "background-repeat", "color", "font-family", "font-size", "font-weight", "font-style", "font-variant-numeric", "line-height", "letter-spacing", "text-align", "text-transform", "text-decoration-line", "white-space", "overflow-x", "overflow-y", "text-overflow", "vertical-align", "box-sizing", "opacity", "box-shadow", "transform", "visibility",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "fill-opacity", "stroke-opacity", "border-collapse", "border-spacing", "table-layout", "list-style-type", "list-style-position", "text-anchor"];
var SIZED = /^(svg|i|canvas|img|circle|rect|line|polyline|text|tspan)$/i;
function inline(src, dst) {
  if (src.nodeType !== 1) return;
  var cs = getComputedStyle(src), st = "";
  for (var i = 0; i < PROPS.length; i++) { var v = cs.getPropertyValue(PROPS[i]); if (v) st += PROPS[i] + ":" + v + ";"; }
  if (SIZED.test(src.tagName) && src.tagName.toLowerCase() !== "text" && src.tagName.toLowerCase() !== "tspan") { st += "width:" + cs.getPropertyValue("width") + ";height:" + cs.getPropertyValue("height") + ";"; }
  dst.setAttribute("style", st);
  var sc = src.children, dc = dst.children; for (var j = 0; j < sc.length; j++) if (dc[j]) inline(sc[j], dc[j]);
}
function bgOf(el) {
  var b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(.*,\s*0\)$|transparent/.test(b)) return b;
  b = getComputedStyle(document.body).backgroundColor; return b && !/rgba\(.*,\s*0\)$|transparent/.test(b) ? b : "#ffffff";
}
function wrapText(s, max) { var w = s.split(" "), L = [], cur_ = ""; w.forEach(function (x) { if ((cur_ + " " + x).trim().length > max) { L.push(cur_); cur_ = x; } else cur_ = (cur_ + " " + x).trim(); }); if (cur_) L.push(cur_); return L; }
function toast(msg, bad) {
  var t = document.querySelector(".cx-toast"); if (!t) { t = document.createElement("div"); t.className = "cx-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.className = "cx-toast show" + (bad ? " bad" : ""); clearTimeout(toast.h); toast.h = setTimeout(function () { t.className = "cx-toast"; }, 2600);
}
function slug(el) { var h = el.querySelector("h1,h2,h3"); return ((h ? h.textContent : "grafico").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "grafico").slice(0, 50); }
function fileBase(el) { return "observatorio-viladecans-" + slug(el); }

function svgPackage(svg, title) {
  var vb = (svg.getAttribute("viewBox") || "0 0 520 300").split(/\s+/).map(Number), W = vb[2] || 520, H = vb[3] || 300, c = svg.cloneNode(true);
  inline(svg, c); c.removeAttribute("class"); c.setAttribute("x", 0); c.setAttribute("y", title ? 30 : 0); c.setAttribute("width", W); c.setAttribute("height", H); c.setAttribute("overflow", "visible");
  var lines = wrapText(citaCorta(), Math.max(40, Math.floor(W / 5.6))), th = title ? 30 : 0, fh = lines.length * 14 + 18, ns = "http://www.w3.org/2000/svg", cs = getComputedStyle(document.body);
  var out = document.createElementNS(ns, "svg"), bg = bgOf(svg.parentNode || document.body), mut = getComputedStyle(document.documentElement).getPropertyValue("--mut") || "#5c6874", fg = cs.color;
  out.setAttribute("xmlns", ns); out.setAttribute("width", W); out.setAttribute("height", H + th + fh); out.setAttribute("viewBox", "0 0 " + W + " " + (H + th + fh));
  var r = document.createElementNS(ns, "rect"); r.setAttribute("width", W); r.setAttribute("height", H + th + fh); r.setAttribute("fill", bg); out.appendChild(r);
  if (title) { var tt = document.createElementNS(ns, "text"); tt.setAttribute("x", 12); tt.setAttribute("y", 22); tt.setAttribute("font-size", 15); tt.setAttribute("font-weight", 700); tt.setAttribute("font-family", "Georgia,serif"); tt.setAttribute("fill", fg); tt.textContent = title; out.appendChild(tt); }
  out.appendChild(c);
  lines.forEach(function (l, i) { var x = document.createElementNS(ns, "text"); x.setAttribute("x", 12); x.setAttribute("y", th + H + 16 + i * 14); x.setAttribute("font-size", 10.5); x.setAttribute("font-family", "system-ui,sans-serif"); x.setAttribute("fill", String(mut).trim()); x.textContent = l; out.appendChild(x); });
  return { text: new XMLSerializer().serializeToString(out), w: W, h: H + th + fh };
}
function imgFromSvg(text, w, h) {
  return new Promise(function (ok, ko) {
    var img = new Image(); img.onload = function () {
      try { var c = document.createElement("canvas"), k = 2; c.width = Math.ceil(w * k); c.height = Math.ceil(h * k); var x = c.getContext("2d"); x.scale(k, k); x.drawImage(img, 0, 0, w, h); c.toBlob(function (b) { b ? ok(b) : ko(new Error("No se pudo generar la imagen")); }, "image/png"); } catch (e) { ko(e); }
    }; img.onerror = function () { ko(new Error("No se pudo dibujar")); }; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
  });
}
function elementBlob(el) {
  var clone = el.cloneNode(true); inline(el, clone);
  clone.querySelectorAll(".cx-bar,.cx-src,.noprint,.cx-menu").forEach(function (n) { n.remove(); }); clone.style.margin = "0"; clone.style.opacity = "1"; clone.style.transform = "none";
  var w = Math.ceil(el.getBoundingClientRect().width), bg = bgOf(el), root = getComputedStyle(document.documentElement);
  var wrap = document.createElement("div"); wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml"); wrap.style.cssText = "box-sizing:border-box;width:" + w + "px;background:" + bg + ";";
  wrap.appendChild(clone);
  var foot = document.createElement("div"); foot.style.cssText = "box-sizing:border-box;padding:10px 14px;border-top:1px solid " + (root.getPropertyValue("--ln") || "#ddd") + ";font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:" + (root.getPropertyValue("--mut") || "#555") + ";background:" + bg + ";"; foot.textContent = citaCorta(); wrap.appendChild(foot);
  var hold = document.createElement("div"); hold.style.cssText = "position:fixed;left:-100000px;top:0;width:" + w + "px;"; hold.appendChild(wrap); document.body.appendChild(hold);
  var h = Math.ceil(wrap.getBoundingClientRect().height), xml = new XMLSerializer().serializeToString(wrap); hold.remove();
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xml + "</foreignObject></svg>";
  return imgFromSvg(svg, w, h);
}
function biggestSvg(el) { var a = Array.prototype.slice.call(el.querySelectorAll("svg")).filter(function (s) { return s.getAttribute("viewBox") && !s.closest(".cx-bar"); }); a.sort(function (x, y) { return y.getBoundingClientRect().width * y.getBoundingClientRect().height - x.getBoundingClientRect().width * x.getBoundingClientRect().height; }); return a[0]; }
function titleOf(el) { var h = el.querySelector("h1,h2,h3"); return h ? h.textContent.trim() : ""; }
function blobFor(el) {
  return elementBlob(el).catch(function () {
    var s = biggestSvg(el); if (!s) throw new Error("Tu navegador no permite copiar este elemento como imagen. Usa «Copiar tabla/texto» o Imprimir.");
    var p = svgPackage(s, titleOf(el)); return imgFromSvg(p.text, p.w, p.h);
  });
}
function bigTable(el) { var t = Array.prototype.slice.call(el.querySelectorAll("table")); t.sort(function (a, b) { return b.rows.length - a.rows.length; }); return t[0]; }
function tableData(tb) { return Array.prototype.map.call(tb.rows, function (r) { return Array.prototype.map.call(r.cells, function (c) { return c.textContent.replace(/\s+/g, " ").trim(); }); }); }
function copyPlain(txt) { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast("Copiado al portapapeles ✓"); }, function () { toast("No se pudo copiar", true); }); else toast("Tu navegador no permite copiar", true); }
function copyHtml(html, plain) {
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]).then(function () { toast("Copiado con su cita ✓"); }, function () { copyPlain(plain); });
  } else copyPlain(plain);
}
function esc2(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
function copyTable(el) {
  var tb = bigTable(el); if (!tb) return; var d = tableData(tb), cite = citaCorta();
  var html = "<table border=\"1\" cellpadding=\"4\" style=\"border-collapse:collapse\">" + d.map(function (r, i) { return "<tr>" + r.map(function (c) { return (i ? "<td>" : "<th>") + esc2(c) + (i ? "</td>" : "</th>"); }).join("") + "</tr>"; }).join("") + "</table><p><i>" + esc2(cite) + "</i></p>";
  copyHtml(html, d.map(function (r) { return r.join("\t"); }).join("\n") + "\n\n" + cite);
}
function copyText(el) {
  var c = el.cloneNode(true); c.querySelectorAll(".cx-bar,.cx-src,.noprint,.cx-menu,svg").forEach(function (n) { n.remove(); });
  var txt = (c.innerText || c.textContent || "").replace(/\n{3,}/g, "\n\n").trim(); copyPlain(txt + "\n\n" + citaCorta());
}
function run(a, el) {
  try {
    if (a === "apa") return copyPlain(citaApa());
    if (a === "tab") return copyTable(el);
    if (a === "txt") return copyText(el);
    if (a === "csv") { var tb = bigTable(el); if (tb) dlCsv(fileBase(el) + ".csv", tableData(tb), citaCorta()); return; }
    if (a === "svg") { var s = biggestSvg(el); if (!s) return toast("Aquí no hay un gráfico SVG", true); var p = svgPackage(s, titleOf(el)); return dlText(fileBase(el) + ".svg", p.text, "image/svg+xml"); }
    toast("Preparando imagen…");
    blobFor(el).then(function (b) {
      if (a === "png") { var u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = fileBase(el) + ".png"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000); toast("Imagen descargada ✓"); return; }
      if (navigator.clipboard && window.ClipboardItem) navigator.clipboard.write([new ClipboardItem({ "image/png": b })]).then(function () { toast("Imagen copiada con su cita ✓"); }, function () { toast("El navegador bloqueó el portapapeles: usa «Descargar imagen»", true); });
      else toast("Tu navegador no permite copiar imágenes: usa «Descargar imagen»", true);
    }).catch(function (e) { toast(e.message || "No se pudo generar la imagen", true); });
  } catch (e) { toast("No se pudo completar la acción", true); if (window.console) console.error(e); }
}
function closeMenus() { var m = document.querySelectorAll(".cx-menu"); for (var i = 0; i < m.length; i++) { m[i].hidden = true; } }
function openMenu(el, bar) {
  var m = bar.querySelector(".cx-menu"), was = !m.hidden; closeMenus(); if (was) return;
  var hasT = !!el.querySelector("table"), hasS = !!biggestSvg(el);
  var items = [["img", "🖼️ Copiar como imagen (con cita)"], hasT ? ["tab", "📋 Copiar tabla (Excel / Word)"] : ["txt", "📝 Copiar texto (con cita)"], ["png", "⬇️ Descargar imagen PNG"], hasS ? ["svg", "⬇️ Descargar gráfico SVG"] : null, hasT ? ["csv", "⬇️ Descargar tabla CSV"] : null, ["apa", "🎓 Copiar cita (APA)"]].filter(Boolean);
  m.innerHTML = items.map(function (i) { return '<button type="button" role="menuitem" data-a="' + i[0] + '">' + i[1] + "</button>"; }).join(""); m.hidden = false;
  m.onclick = function (e) { var b = e.target.closest("button"); if (!b) return; e.stopPropagation(); closeMenus(); run(b.dataset.a, el); };
}
function animateCounts(root) {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  root.querySelectorAll("[data-count]:not([data-done])").forEach(function (b) {
    b.dataset.done = "1"; var to = +b.dataset.count, suf = b.dataset.suf || ""; if (reduce || !isFinite(to)) { b.textContent = to + suf; return; }
    var t0 = null; b.textContent = "0" + suf; (function step(ts) { if (t0 === null) t0 = ts; var k = Math.min(1, (ts - t0) / 900), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(step); })(performance.now());
  });
}
var IO = null;
function enhance() {
  var root = document.querySelector("main"); if (!root) return;
  if (!IO && "IntersectionObserver" in window) IO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); IO.unobserve(e.target); } }); }, { rootMargin: "0px 0px -6% 0px" });
  root.querySelectorAll(CX_SEL + ",.kp,.cu,.gc").forEach(function (el) {
    if (IO && !el.dataset.rv && !el.closest("#v-datos")) { el.dataset.rv = "1"; el.classList.add("rv"); IO.observe(el); }
    if (el.dataset.cx || !el.matches(CX_SEL) || el.closest("#v-datos") || el.closest("dialog")) return;
    var par = el.parentElement && el.parentElement.closest(CX_SEL); if (par) return;
    el.dataset.cx = "1"; el.classList.add("cx");
    var bar = document.createElement("div"); bar.className = "cx-bar noprint";
    bar.innerHTML = '<button type="button" class="cx-b" aria-haspopup="true" title="Copiar o descargar con su cita">⧉<span> Copiar</span></button><div class="cx-menu" role="menu" hidden></div>';
    el.appendChild(bar); var src = document.createElement("p"); src.className = "cx-src"; src.textContent = citaCorta(); el.appendChild(src);
    bar.querySelector(".cx-b").addEventListener("click", function (e) { e.stopPropagation(); openMenu(el, bar); });
  });
  animateCounts(root);
  if (!enhance.t) enhance.t = setTimeout(function () { document.querySelectorAll('.rv:not(.in)').forEach(function (n) { n.classList.add('in'); }); enhance.t = 0; }, 1800);
}
(function watch() {
  if (typeof document === "undefined" || !document.addEventListener) return;
  document.addEventListener("click", function () { closeMenus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenus(); });
  var main = document.querySelector && document.querySelector("main"); if (!main || !window.MutationObserver) return;
  var h = null;
  new MutationObserver(function (ms) {
    var real = ms.some(function (m) { return Array.prototype.some.call(m.addedNodes, function (n) { return n.nodeType === 1 && !/(^|\s)(cx-bar|cx-src|cx-toast)(\s|$)/.test(n.className || ""); }); });
    if (!real) return; clearTimeout(h); h = setTimeout(enhance, 80);
  }).observe(main, { childList: true, subtree: true });
})();

/* ====================== Integración con la aplicación ====================== */
var origRender = window.render, origRs = window.rs;
if (typeof origRs === "function") window.rs = function () { var h = ""; try { h = inicio(); } catch (e) { if (window.console) console.error(e); } return h + origRs.apply(this, arguments); };
if (typeof origRender === "function") window.render = function () { origRender.apply(this, arguments); try { renderExplora(); } catch (e) { if (window.console) console.error(e); } try { enhance(); } catch (e) {} };
if (typeof window.render === "function") window.render();
})();

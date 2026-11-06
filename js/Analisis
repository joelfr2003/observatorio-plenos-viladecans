/* Observatorio de plenos · pestaña «Análisis» + noticias en Resumen */
(function(){
var Q=function(f){return f.slice(0,4)+" T"+Math.ceil(+f.slice(5,7)/3)};
function lc(ss,ls){var x=function(i){return ls.length>1?44+i*460/(ls.length-1):270},y=function(v){return 180-v*1.6};
 return '<svg viewBox="0 0 520 220" role="img" aria-label="Evolución trimestral">'+[0,50,100].map(function(v){return '<line class="axis" x1="40" x2="510" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="chartlabel" x="2" y="'+(y(v)+4)+'">'+v+'%</text>'}).join("")
 +ls.map(function(l,i){return '<text class="chartlabel" x="'+x(i)+'" y="206" text-anchor="middle">'+l+'</text>'}).join("")
 +ss.map(function(s){return '<polyline fill="none" stroke="'+s.c+'" stroke-width="2.5" stroke-linejoin="round" points="'+s.v.map(function(v,i){return x(i)+","+y(v)}).join(" ")+'"/>'+s.v.map(function(v,i){return '<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3.5" fill="'+s.c+'"><title>'+s.n+" · "+ls[i]+": "+v+' %</title></circle>'}).join("")}).join("")+'</svg>'}
function hb(r){return r.map(function(o){return '<div class="li"><span>'+dot(o.n)+'<b>'+esc(o.n)+'</b><small> '+o.t+'</small></span><div class="bar"><i style="width:'+o.v+'%;background:'+col(o.n)+'"></i></div></div>'}).join("")||'<p class="e">Datos insuficientes.</p>'}
function box(t,m,c,e){return '<div class="chartbox"><h2>'+t+'</h2><p class="m">'+m+'</p>'+c+'<p class="corrnote">'+e+'</p></div>'}

/* ---- Noticias (campo «noticia» de cada sesión: {titular, entradilla, cuerpo:[], claves:[]}) ---- */
function nw(p,m){var n=p.noticia,h=m?"h2":"h3";
 return '<article>'+(m===0?'':'<'+h+' style="margin:4px 0 4px">'+esc(n.titular)+'</'+h+'><p class="m">'+fd(p.fecha)+' · '+esc(cat(p))+'</p>')+(n.entradilla?'<p><b>'+esc(n.entradilla)+'</b></p>':'')+(n.cuerpo||[]).map(function(t){return '<p>'+esc(t)+'</p>'}).join("")+((n.claves||[]).length?'<ul class="insights">'+n.claves.map(function(t){return '<li>'+esc(t)+'</li>'}).join("")+'</ul>':"")+'</article>'}
window.noticiasHtml=function(){var n=D.filter(function(p){return p.noticia&&p.noticia.titular});if(!n.length)return"";
 return '<div class="pnl latest"><p class="eyebrow">Noticias del pleno</p>'+nw(n[0],1)+n.slice(1,6).map(function(p){return '<details class="v"><summary style="grid-template-columns:1fr 14px"><span><b>'+esc(p.noticia.titular)+'</b><br><small class="m">'+fd(p.fecha)+' · '+esc(cat(p))+'</small></span></summary><div style="padding:0 18px 14px">'+nw(p,0)+'</div></details>'}).join("")+'</div>'};

/* ---- Pestaña Análisis ---- */
window.renderAnalisis=function(){var el=$("v-analisis");if(!el)return;var vs=flat();
 if(!vs.length){el.innerHTML='<p class="e">Aún no hay votaciones con resultado para analizar con estos filtros.</p>';return}
 var by={};vs.forEach(function(o){var k=Q(o.p.fecha),b=by[k]||(by[k]={n:0,a:0,u:0,c:0});b.n++;if(apr(o.v))b.a++;if(+o.v.favor&&!+o.v.contra&&!+o.v.abst)b.u++;if(+o.v.contra)b.c++});
 var ks=Object.keys(by).sort(),P=function(k,f){return pc(by[k][f],by[k].n)},ls=ks.map(function(k){return k.slice(2,4)+"T"+k.slice(-1)}),
 sm=function(a,f){return a.reduce(function(t,k){return t+by[k][f]},0)},rt=function(a,f){return pc(sm(a,f),sm(a,"n"))},
 h=Math.floor(ks.length/2),A=ks.slice(0,h),B=ks.slice(h),all=ks,
 un=rt(all,"u"),ap=rt(all,"a"),co=rt(all,"c"),L=[],tr="";
 if(ks.length>1){var du=rt(B,"u")-rt(A,"u"),dc=rt(B,"c")-rt(A,"c");
  tr=du<-5||dc>5?"La unanimidad baja del "+rt(A,"u")+" % al "+rt(B,"u")+" % y los votos en contra suben del "+rt(A,"c")+" % al "+rt(B,"c")+" % entre la primera y la segunda mitad del periodo: patrón compatible con una confrontación creciente, aunque estos datos no permiten atribuirlo a una causa concreta (p. ej. el ciclo electoral).":du>5||dc<-5?"El consenso aumenta: la unanimidad pasa del "+rt(A,"u")+" % al "+rt(B,"u")+" % entre la primera y la segunda mitad del periodo.":"Los niveles de consenso se mantienen estables entre la primera y la segunda mitad del periodo ("+rt(A,"u")+" % y "+rt(B,"u")+" % de unanimidad)."}
 var gr=PK.filter(function(k){return ST.m[k].d>=5}).map(function(k){var e=ST.m[k];return{n:k,v:pc(e.w,e.d),t:e.d+" votos"}}).sort(function(a,b){return b.v-a.v}),
 mo=PK.filter(function(k){return ST.m[k].mo.length}).map(function(k){var m=ST.m[k].mo,a=m.filter(function(x){return /aprob/i.test(x.r)}).length;return{n:k,v:pc(a,m.length),t:m.length+" presentadas · "+a+" aprobadas",c:m.length}}).sort(function(a,b){return b.c-a.c}),
 pr=[];Object.keys(ST.A).forEach(function(a){Object.keys(ST.A[a]).forEach(function(b){var o=ST.A[a][b];if(a<b&&o.t>=5)pr.push({a:a,b:b,v:pc(o.s,o.t),t:o.t})})});pr.sort(function(x,y){return y.v-x.v});
 var td=new Date().toISOString().slice(0,10),g=G.find(function(x){return x.id==(LG||legOf(td))}),prog="";
 if(g){var t0=new Date(g.inicio),t1=new Date(g.fin),t=Math.max(0,Math.min(100,Math.round((new Date(td)-t0)/(t1-t0)*100)));prog='<h3>Avance del mandato '+esc(g.id)+'</h3><div class="ap"><span class="bar"><i style="width:'+t+'%;background:var(--ac)"></i></span><small><b>'+t+' %</b> del mandato transcurrido · '+fp().length+' sesiones registradas</small></div>'}
 L.push('<b>Consenso:</b> el '+un+' % de las votaciones fue unánime y el '+ap+' % se aprobó. '+tr);
 L.push('<b>Conflictividad:</b> el '+co+' % de las votaciones recibió al menos un voto en contra.');
 if(gr.length>1)L.push('<b>Minoría frecuente:</b> '+esc(gr[gr.length-1].n)+' es el grupo que menos coincide con el resultado final ('+gr[gr.length-1].v+' %), frente a '+esc(gr[0].n)+' ('+gr[0].v+' %).');
 if(mo.length)L.push('<b>Iniciativa:</b> '+esc(mo[0].n)+' es quien más mociones presenta ('+mo[0].c+'), con un '+mo[0].v+' % aprobadas.');
 if(pr.length>1)L.push('<b>Afinidad:</b> los grupos más cercanos son '+esc(pr[0].a)+' y '+esc(pr[0].b)+' ('+pr[0].v+' %); los más alejados, '+esc(pr[pr.length-1].a)+' y '+esc(pr[pr.length-1].b)+' ('+pr[pr.length-1].v+' %).');
 var pe=function(r){return hb(r.map(function(o){return{n:o.a+" – "+o.b,v:o.v,t:o.v+" % · "+o.t+" votos"}}))};
 el.innerHTML='<p class="eyebrow">'+(LG?"Legislatura "+esc(LG):"Todas las legislaturas")+'</p><h1 class="lead">Cómo avanza la legislatura</h1>'
 +'<div class="pnl latest">'+prog+'<h3>Lectura politológica</h3><ul class="insights">'+L.map(function(x){return '<li>'+x+'</li>'}).join("")+'</ul><p class="corrnote">Análisis descriptivo generado a partir de las votaciones cargadas. Las coincidencias de voto no implican pactos ni motivaciones, y con pocas votaciones los porcentajes son poco robustos.</p></div>'
 +'<div class="analytics">'
 +box("Pulso trimestral","Aprobación, unanimidad y votaciones con algún voto en contra, por trimestre.",lc([{n:"Aprobadas",c:"var(--ok)",v:ks.map(function(k){return P(k,"a")})},{n:"Unánimes",c:"var(--ac)",v:ks.map(function(k){return P(k,"u")})},{n:"Con votos en contra",c:"var(--ko)",v:ks.map(function(k){return P(k,"c")})}],ls)+'<div class="chartlegend"><span><i style="background:var(--ok)"></i>Aprobadas</span><span><i style="background:var(--ac)"></i>Unánimes</span><span><i style="background:var(--ko)"></i>Con votos en contra</span></div>',tr||"Se necesitan al menos dos trimestres con votaciones para ver una tendencia.")
 +box("Coincidencia con el resultado","Porcentaje de votos a favor o en contra de cada grupo que coincidió con el desenlace (mínimo 5 votos).",hb(gr),"Un porcentaje bajo indica que el grupo queda a menudo en minoría; uno alto, que vota con la mayoría que se impone.")
 +box("Pares más afines","Porcentaje de votaciones con la misma posición (mínimo 5 votaciones comunes).",pe(pr.slice(0,4)),"Mide cercanía de voto, no alianza formal.")
 +box("Pares más alejados","Los pares con menor coincidencia de voto.",pe(pr.slice(-4).reverse()),"Útil para identificar los ejes de confrontación del pleno.")
 +box("Iniciativa: mociones","Mociones presentadas por grupo y porcentaje aprobado.",hb(mo),"Refleja capacidad de agenda, especialmente de la oposición.")
 +'</div>'};
})();

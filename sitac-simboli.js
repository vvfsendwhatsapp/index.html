/*!
 * FireOps VVF — sitac-simboli.js — simbologia SI.TA.C.
 *
 * Fonte: "SI.TA.C. — Cartografia Operativa", Corpo Nazionale dei Vigili del
 * Fuoco, Direzione Centrale per l'Emergenza, il Soccorso Tecnico e
 * l'Antincendio Boschivo, Ufficio Pianificazione e Coordinamento Servizio
 * AIB, Roma 2021. A cura di Gianfilippo Micillo e Luca Torrini.
 *
 * I simboli della tavola sono qui ridisegnati in SVG: sono forme geometriche
 * regolari — la pubblicazione dice esplicitamente che sono studiati per poter
 * essere tracciati a mano su carta — quindi si generano da poche primitive
 * invece di ricalcare un tracciato per volta.
 *
 * LE QUATTRO TAVOLE
 * L'originale è diviso in quattro fogli, e questo file mantiene la stessa
 * partizione: la zona di intervento, l'evoluzione dell'incendio, il
 * dispositivo di intervento, le azioni. `g` è la tavola, `sg` il riquadro
 * interno (Dispositivo aereo, Squadre a terra, Evacuazione…).
 *
 * DUE STATI, NON DUE SIMBOLI
 * La tavola distingue sistematicamente i due momenti, ma con parole diverse:
 * previsto/attivo per i mezzi, prevista/attiva per il DOS e le squadre,
 * prevista/effettuata per tutte le azioni. Qui non sono due voci ma un
 * parametro `stato`; le parole le sceglie sitac.js leggendo `g` e `f`.
 *
 * PENDENZE E VENTO SONO TRACCIATI, NON PUNTI
 * Una pendenza e una direzione di vento hanno un verso e una lunghezza sul
 * terreno: come punto orientabile si leggevano solo dopo aver trascinato una
 * maniglia, e in stampa non dicevano da dove a dove. Adesso sono linee con
 * la freccia in punta e le codine in coda — a T per la pendenza, a 45° per
 * il vento — una, due o tre secondo l'intensità. La chiave NON cambia
 * (`pend_lieve`, `vento_forte`…): i GeoJSON vecchi restano leggibili, ma la
 * geometria che si esporta ora è una LineString invece di un Point.
 *
 * COSA VIAGGIA NEL GEOJSON
 * La chiave (`vvf`, `origine`, `lancio_pesante_acqua`…), lo stato e
 * l'eventuale testo. Le chiavi sono identificativi tecnici: non vanno
 * tradotte né rinominate, o i file salvati diventano illeggibili.
 *
 * I FLAG
 * `r` i simboli che vanno orientati; `e` quelli che la tavola vuole
 * accompagnati da un testo (la matricola del mezzo, il numero della
 * squadra: nella tavola sono i puntini di "CAN ......."); `s` quelli che
 * hanno i due stati; `f` quelli di genere femminile, che al posto di
 * previsto/attivo leggono prevista/attiva.
 *
 * I colori sono normativi: rosso il dispositivo VVF e il fuoco, verde il
 * soccorso sanitario e l'evacuazione, azzurro l'acqua e le forze di polizia,
 * nero il terreno e le infrastrutture. Non vanno rimappati sulla palette di
 * FireOps: qui distinguono un lancio d'acqua da uno di ritardante.
 */
(function () {
'use strict';
const NS = (window.FireOps = window.FireOps || {});

const C = {
  rosso:  '#cc0000',
  verde:  '#009900',
  acqua:  '#29abe2',
  polizia:'#00a0e3',
  giallo: '#ffe000',
  nero:   '#000000'
};

/* Tutti i simboli puntuali vivono in una tela 64x64: un unico sistema di
   coordinate rende confrontabili gli ingombri e semplifica l'ancoraggio. */
const T = dentro => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${dentro}</svg>`;
const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g,
  c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const attivo = o => (o && o.stato) === 'attivo';

/* La tavola lascia sulla carta lo spazio per una matricola breve: quattro
   caratteri sono il massimo che sta nella banda senza rimpicciolire il
   simbolo. Il taglio va fatto qui e non solo nell'input, o un GeoJSON
   arrivato da fuori sfonda comunque il riquadro. */
const ID_MAX = 6;
const idTesto = o => String((o && o.testo) || '').trim().slice(0, ID_MAX);

/* Lo stesso simbolo può comparire nel pannello e sulla mappa: con un id
   fisso il browser risolve url(#...) sulla prima occorrenza nel documento
   e le altre restano senza campitura appena quella viene rimossa dal DOM. */
let seq = 0;
const uid = p => `sitac-${p}-${++seq}`;

function txt(x, y, s, col, dim, ancora, trasforma){
  return `<text x="${x}" y="${y}" text-anchor="${ancora || 'middle'}" font-size="${dim || 13}"`
    + (trasforma ? ` transform="${trasforma}"` : '')
    + ` font-family="Arial,Helvetica,sans-serif" font-weight="700" fill="${col}">${esc(s)}</text>`;
}
/* La riga di puntini è il posto dove sulla carta si scrive a penna il
   numero della squadra o la matricola del mezzo: va lasciata anche a video. */
const puntini = (x1, x2, y, col) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="1.6" stroke-dasharray="1.5,2.5"/>`;

const RIG = (id, col, largo) => `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"`
  + ` patternTransform="rotate(45)"><line x1="3.5" y1="0" x2="3.5" y2="7" stroke="${col}" stroke-width="${largo}"/></pattern>`;

/* Larghezza del cuneo pieno che dice "attivo" sui riquadri terrestri.
   È UNA costante e non due numeri scritti in due posti: il testo si centra
   nella parte bianca che resta, e finché le due misure erano diverse la
   sigla ci finiva sopra — rossa su rosso, cioè invisibile, e a sparire per
   primo era il numero della squadra, che sta in coda. */
const CUNEO = 16;

/* ---- BANDIERE DEI MODULI INTERNAZIONALI ----------------------------
   Sono a bande: due o tre colori, verticali o orizzontali. Niente
   dettagli araldici — a 14 px per 9 una stella non si vede — ma il colpo
   d'occhio su "di chi è quel modulo" sì. Il codice ISO resta scritto
   accanto: le bandiere a tinta unita (DK, CH, TR, AL) da sole non si
   distinguono, e su una carta operativa l'ambiguità non è un'opzione. */
const STATI = [
  ['EU','Unione Europea','European Union','eu','#003399','#FFCC00'],
  ['IT','Italia','Italy','v','#008C45','#F4F5F0','#CD212A'],
  ['FR','Francia','France','v','#002395','#FFFFFF','#ED2939'],
  ['ES','Spagna','Spain','h','#AA151B','#F1BF00','#AA151B'],
  ['PT','Portogallo','Portugal','v','#046A38','#DA291C'],
  ['GR','Grecia','Greece','h','#0D5EAF','#FFFFFF','#0D5EAF','#FFFFFF','#0D5EAF'],
  ['DE','Germania','Germany','h','#000000','#DD0000','#FFCE00'],
  ['AT','Austria','Austria','h','#ED2939','#FFFFFF','#ED2939'],
  ['SI','Slovenia','Slovenia','h','#FFFFFF','#0000C6','#FF0000'],
  ['HR','Croazia','Croatia','h','#FF0000','#FFFFFF','#171796'],
  ['HU','Ungheria','Hungary','h','#CD2A3E','#FFFFFF','#436F4D'],
  ['RO','Romania','Romania','v','#002B7F','#FCD116','#CE1126'],
  ['BG','Bulgaria','Bulgaria','h','#FFFFFF','#00966E','#D62612'],
  ['PL','Polonia','Poland','h','#FFFFFF','#DC143C'],
  ['CZ','Cechia','Czechia','h','#FFFFFF','#D7141A'],
  ['SK','Slovacchia','Slovakia','h','#FFFFFF','#0B4EA2','#EE1C25'],
  ['CY','Cipro','Cyprus','h','#FFFFFF','#D57800','#FFFFFF'],
  ['MT','Malta','Malta','v','#FFFFFF','#CF142B'],
  ['IE','Irlanda','Ireland','v','#169B62','#FFFFFF','#FF883E'],
  ['NL','Paesi Bassi','Netherlands','h','#AE1C28','#FFFFFF','#21468B'],
  ['BE','Belgio','Belgium','v','#000000','#FDDA24','#EF3340'],
  ['LU','Lussemburgo','Luxembourg','h','#ED2939','#FFFFFF','#00A1DE'],
  ['DK','Danimarca','Denmark','h','#C8102E','#C8102E','#C8102E'],
  ['SE','Svezia','Sweden','h','#006AA7','#FECC00','#006AA7'],
  ['FI','Finlandia','Finland','h','#FFFFFF','#003580','#FFFFFF'],
  ['EE','Estonia','Estonia','h','#0072CE','#000000','#FFFFFF'],
  ['LV','Lettonia','Latvia','h','#9E3039','#FFFFFF','#9E3039'],
  ['LT','Lituania','Lithuania','h','#FDB913','#006A44','#C1272D'],
  ['CH','Svizzera','Switzerland','h','#FF0000','#FF0000','#FF0000'],
  ['NO','Norvegia','Norway','h','#BA0C2F','#FFFFFF','#00205B'],
  ['AL','Albania','Albania','h','#E41E20','#E41E20','#E41E20'],
  ['MK','Macedonia del Nord','North Macedonia','h','#D20000','#FFE600','#D20000'],
  ['RS','Serbia','Serbia','h','#C6363C','#0C4076','#FFFFFF'],
  ['ME','Montenegro','Montenegro','h','#C40308','#C40308','#C40308'],
  ['BA','Bosnia ed Erzegovina','Bosnia and Herzegovina','h','#002F6C','#FECB00','#002F6C'],
  ['TR','Turchia','T\u00fcrkiye','h','#E30A17','#E30A17','#E30A17'],
  ['UA','Ucraina','Ukraine','h','#0057B7','#FFD700']
];
const ST = {};
STATI.forEach(r => { ST[r[0]] = {k:r[0], n:{it:r[1], en:r[2]}, d:r[3], c:r.slice(4)}; });

function bandeStati(cod, x, y, w, h){
  const s = ST[String(cod || '').toUpperCase()];
  const bordo = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none"`
    + ` stroke="${C.nero}" stroke-width="1.1"/>`;
  if (!s) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>` + bordo;
  if (s.d === 'eu')
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${s.c[0]}"/>`
      + `<circle cx="${(x + w/2).toFixed(2)}" cy="${(y + h/2).toFixed(2)}"`
      + ` r="${(h*0.26).toFixed(2)}" fill="none" stroke="${s.c[1]}"`
      + ` stroke-width="${(h*0.17).toFixed(2)}"`
      + ` stroke-dasharray="${(h*0.09).toFixed(2)},${(h*0.09).toFixed(2)}"/>` + bordo;
  const n = s.c.length;
  let out = '';
  for (let i = 0; i < n; i++){
    out += s.d === 'v'
      ? `<rect x="${(x + w*i/n).toFixed(2)}" y="${y}" width="${(w/n + .3).toFixed(2)}"`
        + ` height="${h}" fill="${s.c[i]}"/>`
      : `<rect x="${x}" y="${(y + h*i/n).toFixed(2)}" width="${w}"`
        + ` height="${(h/n + .3).toFixed(2)}" fill="${s.c[i]}"/>`;
  }
  return out + bordo;
}
/* Bandiera come SVG a sé: la consuma il pannello di scelta in sitac.js. */
const bandieraTag = (cod, w, h) =>
  `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
  + bandeStati(cod, 0.6, 0.6, w - 1.2, h - 1.2) + `</svg>`;

/* =====================================================================
   1. FAMIGLIE
   ===================================================================== */

/* Dispositivo aereo: riquadro con le diagonali e una banda in basso. La
   sigla è FISSA (CAN, S64, Boss): quello che si digita finisce sui
   puntini accanto, che sulla carta è dove si scrive la matricola. */
function mezzoAereo(sigla){
  return o => {
    const p = attivo(o), R = C.rosso;
    const x1 = 2, y1 = 9, x2 = 62, y2 = 41, ym = 55;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const dia = `<path d="M${x1} ${y1}L${x2} ${y2}M${x2} ${y1}L${x1} ${y2}" stroke="${R}" stroke-width="2.2" fill="none"/>`;
    const corpo = (p ? `<path d="M${x1} ${y1}V${y2}L${cx} ${cy}ZM${x2} ${y1}V${y2}L${cx} ${cy}Z" fill="${R}"/>` : '') + dia;

    const s = sigla || '';
    const n = idTesto(o);
    const bx1 = x1 + 3, bx2 = x2 - 3, base = ym - 4;
    const dim = (t, max, cap) => Math.min(max, cap / (t.length * 0.58));
    let banda;
    if (s){
      const dimS = dim(s, 12, 38), xn = bx1 + s.length * dimS * 0.58 + 3;
      banda = txt(bx1, base, s, R, dimS, 'start')
        + (n ? txt(xn, base, n, R, dim(n, 10, bx2 - xn), 'start')
             : puntini(xn, bx2, base - 4, R));
    } else {
      banda = n ? txt(bx1, base, n, R, dim(n, 12, bx2 - bx1), 'start')
                : puntini(bx1, bx2, base - 4, R);
    }
    return T(`<rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" fill="#fff" stroke="${R}" stroke-width="2.8"/>
      ${corpo}
      <rect x="${x1}" y="${y2}" width="${x2-x1}" height="${ym-y2}" fill="#fff" stroke="${R}" stroke-width="2.8"/>
      ${banda}`);
  };
}

/* Dispositivo terrestre: riquadro con la sigla al centro e l'asta sopra
   che conta il livello — una per la squadra, due per il modulo/gruppo, tre
   per il modulo UE/colonna. Attivo = triangolo pieno a destra. */
function mezzoTerra(sigla, aste, col){
  return o => {
    const p = attivo(o), K = col || C.rosso;
    const x1 = 3, y1 = 20, x2 = 61, y2 = 46, xc = (x1 + x2) / 2;
    let a = '';
    for (let i = 0; i < aste; i++){
      const x = (xc - (aste - 1) * 4 + i * 8).toFixed(1);
      a += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y1-8}" stroke="${K}" stroke-width="2.2"/>`;
    }
    const s = sigla || '';
    const n = idTesto(o);
    /* La zona bianca finisce dove comincia il cuneo dell'attivo: sigla e
       numero si centrano LÌ DENTRO. Prima il testo era centrato sul
       riquadro intero e sull'attivo finiva sotto il cuneo, rosso su rosso:
       spariva il numero della squadra, che è il dato per cui il simbolo
       esiste. */
    /* La zona utile è SEMPRE quella dell'attivo, anche quando il cuneo non
       c'è: così la sigla ha lo stesso corpo nei due stati. Con la larghezza
       che cambia, "VVF 3" si rimpiccioliva passando a in atto e sulla carta
       sembrava un altro simbolo. */
    const xd = x2 - CUNEO;
    const largo = xd - x1 - 6;
    let dentro;
    if (s && !n){
      /* Sigla senza numero: restano i puntini, che sulla carta sono il
         posto dove il numero si scrive a penna. Sul simbolo aereo c'erano
         già, qui mancavano — e un riquadro senza puntini non dice che
         quel numero va messo. */
      const dimS = Math.min(15, largo / (s.length * 0.62));
      const xs = x1 + 4;
      const xn = xs + s.length * dimS * 0.6 + 3;
      dentro = txt(xs, y2 - 9, s, K, dimS, 'start')
        + (xn < xd - 6 ? puntini(xn, xd - 4, y2 - 13, K) : '');
    } else {
      const et = s ? (n ? s + ' ' + n : s) : n;
      const dim = et ? Math.max(8, Math.min(15, largo / (et.length * 0.6))) : 15;
      dentro = et ? txt((x1 + xd) / 2, y2 - 9, et, K, dim) : '';
    }
    return T(`${a}
      <rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" fill="#fff" stroke="${K}" stroke-width="2.6"/>
      ${p ? `<path d="M${x2-CUNEO} ${y2}H${x2}V${y1}Z" fill="${K}"/>` : ''}
      ${dentro}`);
  };
}

/* Modulo UE / colonna: tre aste come gli altri livelli, ma il riquadro è la
   bandiera. Il francobollo da 14×9 accanto al testo era illeggibile a
   dimensione di simbolo — tre bande di quattro pixel non si distinguono — e
   soprattutto rubava spazio al numero, che è il dato per cui il simbolo
   esiste: su una carta con sei nazioni in campo si cerca "il 4", non "IT".
   Il codice ISO non sparisce, cambia posto: sta nel suggerimento e nel
   riepilogo stampato, dove lo spazio c'è e la nazione si legge per esteso.
   Il numero va in bianco bordato di nero: una bandiera può essere chiara o
   scura, e nessun colore fisso si leggerebbe su tutte e trentasette. */
function moduloUE(){
  return o => {
    const p = attivo(o), K = C.rosso;
    const x1 = 3, y1 = 20, x2 = 61, y2 = 46, xc = (x1 + x2) / 2;
    let a = '';
    for (let i = 0; i < 3; i++){
      const x = (xc - 8 + i * 8).toFixed(1);
      a += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y1-8}" stroke="${K}" stroke-width="2.2"/>`;
    }
    const cod = String((o && o.paese) || '').toUpperCase().slice(0, 3);
    const n = idTesto(o);
    const w = x2 - x1, h = y2 - y1;
    const xd = x2 - CUNEO;              // corpo utile: fisso nei due stati
    const largo = xd - x1 - 6;
    const dim = n ? Math.max(11, Math.min(22, largo / (n.length * 0.62))) : 22;
    const numero = n
      ? `<text x="${((x1 + xd) / 2).toFixed(1)}" y="${(y2 - 8).toFixed(1)}"`
        + ` text-anchor="middle" font-size="${dim.toFixed(1)}"`
        + ` font-family="Arial,Helvetica,sans-serif" font-weight="700"`
        + ` fill="#fff" stroke="#000" stroke-width="3"`
        + ` paint-order="stroke fill" stroke-linejoin="round">${esc(n)}</text>`
      : puntini(x1 + 6, xd - 4, (y1 + y2) / 2, '#000');
    return T(`${a}
      ${cod ? bandeStati(cod, x1, y1, w, h)
            : `<rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="#fff"/>`}
      <rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="none" stroke="${K}" stroke-width="2.6"/>
      ${p ? `<path d="M${x2-CUNEO} ${y2}H${x2}V${y1}Z" fill="${K}"/>` : ''}
      ${numero}`);
  };
}

/* Lanci: ellisse per i mezzi pesanti, cerchio per gli elicotteri; rigato
   per il ritardante, vuoto per l'acqua. Prevista = tratteggiata. */
function lancio(grande, ritardante){
  return o => {
    const p = attivo(o), K = ritardante ? C.rosso : C.acqua;
    const tratto = p ? '' : ' stroke-dasharray="5,4"';
    const forma = grande ? `<ellipse cx="32" cy="32" rx="29" ry="14"` : `<circle cx="32" cy="32" r="17"`;
    const id = uid('rig');
    return T((ritardante ? `<defs>${RIG(id, C.rosso, 2.2)}</defs>` : '')
      + `${forma} fill="${ritardante ? `url(#${id})` : 'none'}" stroke="${K}" stroke-width="2.6"${tratto}/>`);
  };
}

/* Il vento resta disponibile anche come GLIFO puntuale, ma solo per il
   quadro fisso in alto a sinistra sulla carta: lì non c'è un tracciato da
   decorare, c'è un dato di scenario da mostrare. Sulla tavola invece il
   vento è una linea (vedi sezione 3). */
function glifoVento(n){
  return o => {
    let b = '';
    for (let i = 0; i < n; i++){
      const x = 52 - i * 6;
      b += `<line x1="${x}" y1="30" x2="${x-8}" y2="41" stroke="${C.nero}" stroke-width="3"/>`;
    }
    return T(`<line x1="56" y1="35" x2="14" y2="35" stroke="${C.nero}" stroke-width="2.6"/>
      <path d="M5 35l13-6.5v13Z" fill="${C.nero}"/>${b}
      ${(o && o.senzaTesto) ? '' :
        txt(34, 22, (o && o.testo) ? o.testo + ' Km/h' : '(.....Km/h)', C.nero, 10)}`);
  };
}

/* Tipo di incendio: tre rami, il pieno dice a che quota corre il fuoco —
   chioma in alto, radente in mezzo, sotterraneo in basso. */
function quotaFuoco(pieno){
  return () => {
    let c = '';
    [16, 32, 48].forEach((yy, i) => {
      c += `<line x1="12" y1="32" x2="45" y2="${yy}" stroke="${C.nero}" stroke-width="2.2"/>`;
      c += `<circle cx="49" cy="${yy}" r="6" fill="${i === pieno ? C.nero : '#fff'}" stroke="${C.nero}" stroke-width="2.2"/>`;
    });
    return T(c);
  };
}

/* Pendenza e vento — un disegno solo, non più un tratto più una freccia
   incollata sopra: da linea la cucitura fra i due si vedeva ai bordi
   (era la causa del gradino che si rompeva sulla punta), e il gesto per
   posarli era diverso da ogni altro simbolo orientabile. Da qui in poi si
   comportano come il Transit Point — un clic per posare, si punta col
   mouse guardando il simbolo girare, secondo clic per confermare — e
   quell'intero meccanismo (anteprima che ruota, maniglia, "Cambia
   direzione" dal tasto destro, rotazione nel GeoJSON) arriva gratis:
   è lo stesso di TP e DOS, non c'è niente da riscrivere.
   Non hanno un "previsto": un pendio o un vento non sono un'azione
   programmata, sono un dato del terreno o dell'aria, quindi il glifo è
   uno solo — niente stato spento a metà.
   Disegnato con la punta in alto: r0:0, la rotazione applicata dal
   contenitore corrisponde già all'azimut, senza correzioni.
   `forma` è 'T' per la pendenza o '45' per il vento, `n` le codine — una,
   due o tre secondo l'intensità. */
function direzione(forma, n){
  return () => {
    const col = C.nero;
    /* Asta sottile con la punta a un capo e le codine all'altro: la stessa
       grammatica della freccia del vento sul DOS. La sagoma piena di prima
       era un blocco che a colpo d'occhio si leggeva come il cursore del
       mouse, non come una direzione.
       Il disegno occupa la tela DA UN ESTREMO ALL'ALTRO e l'ancoraggio sta
       al centro: il punto cliccato cade a metà dell'asta, metà da dove si
       viene e metà verso dove si va, come il vento del DOS. Con la punta
       ancorata al clic il simbolo cresceva tutto da una parte sola. */
    let d = `<line x1="32" y1="26" x2="32" y2="60" stroke="${col}" stroke-width="3"/>`
      + `<path d="M32 3L42 27L32 22L22 27Z" fill="${col}"/>`;
    /* Le codine partono dal capo opposto alla punta e risalgono: così una,
       due o tre restano tutte alla coda invece di allungare il simbolo. */
    const passo = 6;
    for (let i = 0; i < n; i++){
      const y = (forma === '45' ? 54 : 58) - (n - 1 - i) * passo;
      d += forma === '45'
        ? `<line x1="32" y1="${y}" x2="40" y2="${y + 8}"`
          + ` stroke="${col}" stroke-width="3" stroke-linecap="round"/>`
        : `<line x1="25" y1="${y}" x2="39" y2="${y}"`
          + ` stroke="${col}" stroke-width="3" stroke-linecap="round"/>`;
    }
    return T(d);
  };
}

/* Cerchio con sigla: Area da evacuare (Ev) e Zona Sicura (SZ), entrambe
   verdi. Effettuata = cerchio interamente pieno con la sigla in bianco. */
function tondoSigla(sigla, col){
  return o => {
    const p = attivo(o);
    return T(`<circle cx="32" cy="32" r="19" fill="${p ? col : '#fff'}" stroke="${col}" stroke-width="3"/>
      ${txt(32, 38, sigla, p ? '#fff' : col, 17)}`);
  };
}

/* =====================================================================
   2. SIMBOLI PUNTUALI
   ===================================================================== */
const S = {};
const agg = (k, g, sg, it, en, svg, extra) => {
  S[k] = Object.assign({g, sg, n:{it, en}, svg}, extra || {});
};

/* ---- TAVOLA 1: la zona di intervento ---- */
agg('acqua','zona',null,'Punto d\u2019acqua per mezzi terrestri','Water point, ground means',
  () => T(`<circle cx="32" cy="32" r="21" fill="${C.acqua}"/>`));
agg('acqua_aerei','zona',null,'Punto d\u2019acqua per mezzi aerei','Water point, air means',
    o => { const id = uid('clip');
    return T(`<clipPath id="${id}"><circle cx="32" cy="28" r="19"/></clipPath>
    <circle cx="32" cy="28" r="19" fill="#fff" stroke="${C.acqua}" stroke-width="1.6"/>
    <path d="M13 9h38L13 47h38Z" fill="${C.acqua}" clip-path="url(#${id})"/>
    ${txt(32, 60, (o && o.testo) || 'Eli/CAN', C.acqua, 12)}`); }, {e:1});

agg('sensibile','zona',null,'Punto sensibile','Sensitive point',
  () => T(`<path d="M6 12h52L32 57Z" fill="${C.rosso}"/>`));
agg('sensibile_wui','zona',null,'Punto sensibile per interfaccia','Sensitive point for WUI',
  () => { const id = uid('rig');
    return T(`<defs>${RIG(id, C.verde, 1.6)}</defs>
      <path d="M6 12h52L32 57Z" fill="url(#${id})" stroke="${C.verde}" stroke-width="2.2"/>`); });

agg('elisuperficie','zona',null,'Piazzola per elicottero','Helispot',
  () => T(`<circle cx="32" cy="32" r="20" fill="#fff" stroke="${C.nero}" stroke-width="2.8"/>
    ${txt(32, 40, 'H', C.nero, 24)}`));
agg('ripetitore','zona',null,'Ripetitori, antenne, pale eoliche, ecc.','Masts, antennas, wind turbines',
  () => T(`<circle cx="32" cy="11" r="6" fill="${C.nero}"/>
    <path d="M32 15L20 56h24Z" fill="none" stroke="${C.nero}" stroke-width="2.6" stroke-linejoin="round"/>
    <line x1="32" y1="15" x2="32" y2="56" stroke="${C.nero}" stroke-width="2"/>`));
agg('pend_lieve','zona',null,'Pendenza lieve','Light slope', direzione('T', 1), {r:1, r0:0, senzaDisco:1, lungo:1});
agg('pend_moderata','zona',null,'Pendenza moderata','Moderate slope', direzione('T', 2), {r:1, r0:0, senzaDisco:1, lungo:1});
agg('pend_forte','zona',null,'Pendenza forte','Steep slope', direzione('T', 3), {r:1, r0:0, senzaDisco:1, lungo:1});

/* ---- TAVOLA 2: l'evoluzione dell'incendio ---- */
/* "Punto d'innesco" e non "Area d'origine": sulla carta è un punto, e la
   parola che si usa per radio è innesco. */
agg('origine','evoluzione',null,'Punto d\u2019innesco','Point of origin',
  () => T(`<path d="M32 4l7.7 17.3L58 23.6 44.9 36.1 48.4 54 32 45 15.6 54l3.5-17.9L6 23.6l18.3-2.3Z" fill="${C.rosso}"/>`));
agg('inc_chioma','evoluzione',null,'Incendio di chioma','Crown fire', quotaFuoco(0));
agg('inc_radente','evoluzione',null,'Incendio radente','Surface fire', quotaFuoco(1));
agg('inc_sotterraneo','evoluzione',null,'Incendio sotterraneo','Ground fire', quotaFuoco(2));
agg('vento_debole','evoluzione',null,'Direzione del vento, intensit\u00e0 debole','Wind direction, light',
  direzione('45', 1), {r:1, r0:0, senzaDisco:1});
agg('vento_moderato','evoluzione',null,'Direzione del vento, intensit\u00e0 moderata','Wind direction, moderate',
  direzione('45', 2), {r:1, r0:0, senzaDisco:1});
agg('vento_forte','evoluzione',null,'Direzione del vento, intensit\u00e0 forte','Wind direction, strong',
  direzione('45', 3), {r:1, r0:0, senzaDisco:1});

/* ---- TAVOLA 3: il dispositivo di intervento ---- */
agg('can','dispositivo','sgAereo','Canadair','Canadair', mezzoAereo('CAN'), {s:1, e:1, lbl:'ID CAN'});
agg('s64','dispositivo','sgAereo','S 64','S 64', mezzoAereo('S64'), {s:1, e:1, lbl:'ID S64'});
agg('fireboss','dispositivo','sgAereo','Fireboss','Fireboss', mezzoAereo('Boss'), {s:1, e:1, lbl:'ID Boss'});
agg('eli','dispositivo','sgAereo','Elicotteri medi e leggeri','Light and medium helicopters', mezzoAereo('Eli'), {s:1, e:1, lbl:'ID Eli'});
agg('eli_com','dispositivo','sgAereo','Elicottero Comando','Command helicopter', mezzoAereo('Eli Com'), {s:1, e:1, lbl:'ID Eli Com'});
agg('aereo_altro','dispositivo','sgAereo','Altro mezzo aereo','Other air means', mezzoAereo(''), {s:1, e:1, lbl:'ID mezzo'});

agg('dos','dispositivo','sgTerra','DOS — Direttore Operazioni Spegnimento','Fire operations director',
  o => {
    const p = attivo(o), K = C.rosso;
    const x1 = 2, y1 = 18, x2 = 62, y2 = 48, xc = 32;
    return T(`<line x1="${xc}" y1="${y1}" x2="${xc}" y2="${y1-9}" stroke="${K}" stroke-width="2.6"/>
      <rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" fill="#fff" stroke="${K}" stroke-width="3"/>
      ${p ? `<path d="M${x2-CUNEO-4} ${y2}H${x2}V${y1}Z" fill="${K}"/>` : ''}
      ${txt(24, y2-8, 'DOS', K, 18)}`);
  }, {s:1, f:1});
agg('vvf','dispositivo','sgTerra','Squadra VVF','VVF crew', mezzoTerra('VVF', 1), {s:1, e:1, f:1, lbl:'N. squadra'});
agg('vol','dispositivo','sgTerra','Squadra VOL','Volunteer crew', mezzoTerra('VOL', 1), {s:1, e:1, f:1, lbl:'N. squadra'});
agg('gos','dispositivo','sgTerra','Squadra GOS','GOS crew', mezzoTerra('GOS', 1), {s:1, e:1, f:1, lbl:'N. squadra'});
agg('sai','dispositivo','sgTerra','Squadra SAI','SAI crew', mezzoTerra('SAI', 1), {s:1, e:1, f:1, lbl:'N. squadra'});
agg('squadra_altra','dispositivo','sgTerra','Squadra\u2026','Other crew', mezzoTerra('', 1), {s:1, e:1, f:1, lbl:'Sigla e numero'});
agg('modulo_vvf','dispositivo','sgTerra','Modulo VVF / Gruppo','VVF module / Group', mezzoTerra('', 2), {s:1, e:1, lbl:'N. modulo'});
agg('modulo_ue','dispositivo','sgTerra','Modulo UE / Colonna','EU module / Column', moduloUE(),
  {s:1, e:1, paese:1, lbl:'N. modulo'});
agg('cp','dispositivo','sgTerra','Posto di Comando','Command post', mezzoTerra('CP', 0, C.rosso), {s:1});
agg('ss','dispositivo','sgTerra','Soccorso Sanitario','Ambulance', mezzoTerra('SS', 0, C.verde), {s:1});
agg('pol','dispositivo','sgTerra','Forze di Polizia','Police forces', mezzoTerra('Pol', 0, C.polizia), {s:1, f:1});

agg('tp','dispositivo','sgTerra','Transit Point','Transit point', o => {
  const R = C.rosso, p = attivo(o);
  return T(`<circle cx="32" cy="32" r="22" fill="${p ? R : '#fff'}" stroke="${R}" stroke-width="3"/>
    ${txt(32, 38, 'TP', p ? '#fff' : R, 18)}`);
}, {s:1, r:1, r0:0});

/* ---- TAVOLA 4: le azioni ---- */
agg('lancio_pesante_ritardante','azioni','sgAereo','Lancio mezzi aerei pesanti con ritardante','Retardant drop, heavy means', lancio(1,1), {s:1, poly:{a:125, b:20}});
agg('lancio_pesante_acqua','azioni','sgAereo','Lancio mezzi aerei pesanti con acqua','Water drop, heavy means', lancio(1,0), {s:1, poly:{a:125, b:20}});
agg('lancio_leggero_ritardante','azioni','sgAereo','Lancio elicotteri medi e leggeri con ritardante','Retardant drop, light helicopters', lancio(0,1), {s:1, poly:{a:35, b:35}});
agg('lancio_leggero_acqua','azioni','sgAereo','Lancio elicotteri medi e leggeri con acqua','Water drop, light helicopters', lancio(0,0), {s:1, poly:{a:35, b:35}});

/* Difesa perimetrale: stella a otto punte formata da DUE QUADRATI ruotati
   di 45° l'uno rispetto all'altro.
   Effettuata NON vuol dire stella tutta rossa: si campiscono le sole PUNTE,
   e il nocciolo ottagonale al centro resta bianco. Piena per intero, a
   dimensione di simbolo su una carta, diventava una macchia rossa che a
   colpo d'occhio si confondeva con un punto sensibile.
   L'ottagono su cui poggiano le punte è l'intersezione dei due quadrati: i
   suoi vertici stanno a 22,5° + 45k, a raggio r·cos(22,5°)/... — in pratica
   0,765·r, che è il numero qui sotto. */
agg('difesa_perimetrale','azioni','sgTerra','Difesa perimetrale','Perimeter defence', o => {
  const R = C.rosso, p = attivo(o), r = 27, rO = r * 0.765;
  const pt = (raggio, gradi) => {
    const a = gradi * Math.PI / 180;
    return (32 + raggio * Math.cos(a)).toFixed(1) + ' '
         + (32 + raggio * Math.sin(a)).toFixed(1);
  };
  const quadrato = a0 => {
    let d = '';
    for (let i = 0; i < 4; i++) d += (i ? 'L' : 'M') + pt(r, a0 + i * 90);
    return d + 'Z';
  };
  /* Le otto punte: apice sul vertice della stella, base sulla corda
     dell'ottagono che le sta sotto. */
  let punte = '';
  if (p) for (let i = 0; i < 8; i++){
    const a = i * 45;
    punte += `<path d="M${pt(r, a)}L${pt(rO, a - 22.5)}L${pt(rO, a + 22.5)}Z" fill="${R}"/>`;
  }
  const st = ` fill="#fff" stroke="${R}" stroke-width="2.6" stroke-linejoin="round"`;
  return T(`<path d="${quadrato(45)}"${st}/><path d="${quadrato(0)}"${st}/>${punte}`);
}, {s:1});

agg('accensione_punti','azioni','sgControfuoco','Accensione per punti','Ignition by points', o => T(
  `<circle cx="32" cy="23" r="16" fill="${attivo(o) ? C.rosso : '#fff'}" stroke="${C.rosso}" stroke-width="2.8"/>
   <line x1="32" y1="39" x2="32" y2="50" stroke="${C.rosso}" stroke-width="2.8"/>
   <path d="M25 48l7 12 7-12Z" fill="${C.rosso}"/>`), {s:1});

agg('area_evacuare','azioni','sgEvacuazione','Area da evacuare','Area to evacuate', tondoSigla('Ev', C.verde), {s:1});
agg('zona_sicura','azioni','sgEvacuazione','Zona Sicura','Safety zone', tondoSigla('SZ', C.verde), {s:1});

/* =====================================================================
   3. MOTIVI RIPETUTI LUNGO LE LINEE

   CONVENZIONE — vale per OGNI glifo qui sotto, ed è l'unica cosa da tenere
   a mente per aggiungerne di nuovi:
     · la linea attraversa il glifo IN VERTICALE, dal basso verso l'alto;
     · "in alto" è il verso di percorrenza (PolylineDecorator ruota il
       marcatore secondo la direzione del tracciato, e l'angolo 0 è il nord);
     · l'asse x è la PERPENDICOLARE alla linea;
     · il centro dell'icona (w/2, h/2) sta sul tracciato ed è anche il centro
       di rotazione: quello che si disegna lì finisce esattamente sul punto.

   Da questo discende la regola delle frecce: la punta va disegnata sul
   CENTRO del glifo e il resto in coda, verso il basso. Così, con offset
   '100%', la punta cade sull'ultimo vertice del tracciato invece di
   sporgere oltre o restare indietro.

   `h` è anche il passo di ripetizione dei motivi contigui (triangoli,
   denti, greca): chi li usa passa `passo:'auto'` e sitac.js legge di qui.
   ===================================================================== */

/* `dim` è la misura caratteristica del motivo e cambia significato con il
   tipo — è la base del triangolo, il lato della greca, l'apertura della
   freccia. Sta scritto accanto a ogni caso. */
function decoGlifo(tipo, opz){
  const o = opz || {};
  const col = o.col || C.nero;
  const pieno = !!o.pieno;
  const n = Math.max(1, o.n || 1);
  const dim = o.dim || 14;
  const riempi = pieno ? col : '#fff';
  /* `lato` dice da che parte del tracciato guarda il motivo: +1 a destra del
     verso di percorrenza, -1 a sinistra. Lo sceglie chi disegna con un terzo
     clic — un attacco sui fianchi che punta dalla parte sbagliata manda le
     squadre nel fuoco invece che addosso al fianco. */
  const lato = o.lato === -1 ? -1 : 1;
  const f = x => (+x).toFixed(1);
  let w, h, d = '';

  /* Altezza (= estensione lungo la linea) e larghezza dipendono dal tipo:
     si fissano prima, perché tutto il disegno è riferito al centro. */
  const alt = dim * 0.866;                       // altezza del triangolo equilatero

  switch (tipo){

    /* Difesa in linea — triangoli equilateri CONTIGUI appoggiati sulla
       linea: la base è un pezzo di linea, l'apice sta di lato. `dim` è la
       base, e coincide col passo, così due triangoli si toccano. */
    case 'triangoloBase': {
      h = dim; w = Math.ceil(alt * 2) + 2;
      const cx = w / 2, cy = h / 2;
      d = `<path d="M${f(cx)} ${f(cy - dim/2)}L${f(cx - alt)} ${f(cy)}L${f(cx)} ${f(cy + dim/2)}Z"`
        + ` fill="${riempi}" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/>`;
      break;
    }

    /* Creazione linea di sicurezza — DUE serie di triangoli consecutivi con
       la base in comune: la linea è la base, e i triangoli stanno di qua e
       di là. Stesso passo dei precedenti. */
    case 'bifronte': {
      h = dim; w = Math.ceil(alt * 2) + 2;
      const cx = w / 2, cy = h / 2;
      const tri = seg => `<path d="M${f(cx)} ${f(cy - dim/2)}L${f(cx + seg * alt)} ${f(cy)}`
        + `L${f(cx)} ${f(cy + dim/2)}Z" fill="${riempi}" stroke="${col}"`
        + ` stroke-width="1.6" stroke-linejoin="round"/>`;
      d = tri(-1) + tri(1);
      break;
    }

    /* Ricognizione — greca continua. Il motivo disegna UN periodo completo:
       mezzo tratto sulla linea, la sporgenza quadra, mezzo tratto sulla
       linea. Ripetuto con passo pari alla propria altezza, i mezzi tratti
       si saldano con quelli dei vicini e la greca corre senza interruzioni.
       Prima il glifo portava la sola sporgenza e la linea restava scoperta
       fra un motivo e l'altro: si leggeva come una fila di gradini staccati,
       non come la greca della tavola.
       `dim` è il lato del quadro; l'altezza del motivo È il periodo, quindi
       `passo:'auto'` lo prende da qui e i conti tornano da sé. */
    case 'omega': {
      h = dim * 2; w = dim * 2 + 6;
      const cx = w / 2, s = dim * 0.62;
      /* Il tracciato sotto è spento (weight:0 sulla riga della ricognizione):
         la greca È la linea, quindi il tratteggio del "prevista" lo porta
         lei. `pieno` qui non riempie niente — non c'è area da campire — ma
         resta il flag che distingue i due stati, come sull'accensione per
         linee. */
      const tr = pieno ? '' : ' stroke-dasharray="5,4"';
      d = `<path d="M${f(cx)} ${f(h)}V${f(h/2 + s/2)}H${f(cx - s)}`
        + `V${f(h/2 - s/2)}H${f(cx)}V0"`
        + ` fill="none" stroke="${col}" stroke-width="2.4"`
        + ` stroke-linejoin="miter" stroke-linecap="butt"${tr}/>`;
      break;
    }

    /* Accensione per linee — la punta in coda al tracciato, disegnata con
       la stessa grammatica della fascia che la precede: interno bianco,
       bordo rosso, spigoli vivi. Non è `punta` con `pieno:0`, perché lì il
       vuoto è trasparente: qui il bianco è parte del segno, non l'assenza
       di colore.
       Base più larga della fascia (13px di guaina): una punta della stessa
       larghezza sembrerebbe la linea che finisce, non una freccia.
       `dim` è la base. */
    case 'puntaVuota': {
      const b = dim, alt = dim * 0.85;
      /* Il triangolo esce di TRAVERSO al tracciato: sulla tavola dice da che
         parte si accende, non dove finisce la fascia.
         La tela è larga il doppio dell'altezza della punta perché il glifo
         resta ancorato al centro — è la convenzione del decoratore — e la
         punta va disegnata tutta da una parte, con la BASE sul margine della
         fascia invece che sul suo asse. Metà punta dentro la fascia bianca
         era quello che si vedeva prima: la base spariva e il triangolo
         sembrava sbucare dal mezzo. */
      const semiFascia = 5;              // metà della guaina (13px)
      w = (alt + semiFascia) * 2 + 6;
      h = b + 6;
      const cy = h / 2, cx = w / 2;
      const xb = cx + lato * semiFascia;    // base, sul bordo della fascia
      const xp = xb + lato * alt;           // vertice, fuori
      const y1 = cy- b/2, y2 = cy + b/2;
      d = `<path d="M${f(xp)} ${f(cy)}L${f(xb)} ${f(y1)}L${f(xb)} ${f(y2)}Z"`
        + ` fill="#ffffff" stroke="none"/>`
        + `<path d="M${f(xb)} ${f(y1)}L${f(xp)} ${f(cy)}L${f(xb)} ${f(y2)}"`
        + ` fill="none" stroke="${col}" stroke-width="2.8"`
        + ` stroke-linejoin="miter" stroke-linecap="butt"/>`;
      break;
    }

    /* Fronte dell'incendio — doppia linea parallela unita da lineette. Il
       tracciato vero è una delle due; il motivo disegna l'altra, affiancata,
       e le traversine che le legano. Passo corto: le lineette devono essere
       tante, o non si legge come un fronte dentato. `dim` è la distanza fra
       le due linee. */
    case 'denti': {
      h = Math.max(6, Math.round(dim * 0.62)); w = dim * 2 + 8;
      const cx = w / 2, cy = h / 2;
      d = `<line x1="${f(cx + dim)}" y1="0" x2="${f(cx + dim)}" y2="${h}"`
        + ` stroke="${col}" stroke-width="2.6"/>`
        + `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + dim)}" y2="${f(cy)}"`
        + ` stroke="${col}" stroke-width="2"/>`;
      break;
    }

    /* Punta di freccia — il triangolo sta sul tracciato con il BARICENTRO nel
       punto, non con l'apice. Ancorandolo per l'apice il tratto arrivava fino
       alla punta e sporgeva oltre, perché il linecap e lo spessore della linea
       aggiungono qualche pixel dopo l'ultimo vertice: si vedeva una codina
       fuori dal triangolo. Col baricentro il vertice finale cade DENTRO la
       figura, che lo copre, e la freccia sporge in avanti come su una carta
       disegnata a mano.
       Il baricentro di un triangolo sta a un terzo dell'altezza dalla base:
       apice a 2/3 davanti, base a 1/3 dietro. `dim` è la base. */
    case 'freccia':          // ripetuta lungo la linea (senso di marcia)
    case 'punta': {          // una sola, sull'ultimo vertice
      const hT = dim * 1.15, bT = dim;
      w = Math.ceil(bT) + 4;
      h = Math.ceil(hT) + 6;
      const cx = w / 2, cy = h / 2;
      const ay = cy - hT * 2 / 3, by = cy + hT / 3;
      /* Vuota = campita di bianco, non a V aperta: il bianco è quello che
         nasconde il tratto sotto, ed è il motivo per cui si è spostato il
         baricentro. Una V aperta rimetterebbe la linea in vista. */
      /* `aperta` toglie la BASE del triangolo: sugli assi secondari l'asta
         è già bianca bordata di rosso, e una base disegnata di traverso
         taglia la freccia in due invece di lasciarla sfociare nella punta.
         Il tratto non chiude il percorso, il riempimento sì — quindi il
         bianco copre lo stesso i bordi dell'asta che entrano nel
         triangolo, e quei bordi finiscono esattamente sulla base. */
      const chiudi = o.aperta ? '' : 'Z';
      d = `<path d="M${f(cx - bT/2)} ${f(by)}L${f(cx)} ${f(ay)}`
        + `L${f(cx + bT/2)} ${f(by)}${chiudi}"`
        + ` fill="${pieno ? col : '#fff'}" stroke="${col}"`
        + ` stroke-width="${pieno ? 1.2 : 2.2}" stroke-linejoin="round"`
        + ` stroke-linecap="butt"/>`;
      break;
    }

    /* Pendenze e vento — le CODINE dell'intensità, una due o tre: a T per la
       pendenza, a 45° per il vento.
       Stanno all'estremità OPPOSTA alla punta, non accanto ad essa: è la
       convenzione con cui si legge un vento su qualunque carta — la freccia
       dice dove va, le barbe in coda dicono quanto forte — e con la freccia
       e le codine allo stesso capo il simbolo diventava un grumo in cui non
       si distingueva più né l'una né le altre. Per questo il tracciato porta
       DUE motivi, la punta a fine linea e le codine a inizio linea, invece di
       un glifo solo.
       Il primo trattino cade sul primo vertice e gli altri proseguono in
       avanti. `dim` è la larghezza della codina. */
    case 'codine': {
      const s = dim * 0.62, passo = dim * 0.5;
      w = Math.ceil(dim * 1.3) + 4;
      h = Math.ceil(Math.max(s * 1.3 + (n - 1) * passo, s) * 2) + 6;
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < n; i++){
        const y = cy - i * passo;
        d += (o.forma === '45')
          /* La barba è inclinata all'indietro, come su una carta del vento:
             in avanti sembrerebbe una seconda punta. */
          ? `<line x1="${f(cx)}" y1="${f(y)}" x2="${f(cx + s * lato)}" y2="${f(y + s)}"`
            + ` stroke="${col}" stroke-width="2.8" stroke-linecap="round"/>`
          : `<line x1="${f(cx - s / 2)}" y1="${f(y)}" x2="${f(cx + s / 2)}" y2="${f(y)}"`
            + ` stroke="${col}" stroke-width="2.8" stroke-linecap="round"/>`;
      }
      break;
    }

    /* Bonifica — il quadro con la B. Appoggia UN LATO sulla linea invece di
       esserne attraversato: il tratto resta continuo e leggibile, e la
       lettera non ci finisce sopra.
       Il glifo ruota col tracciato, così il lato resta a filo anche sulle
       diagonali — ma la B no: `giro` la controruota dell'esatto azimut
       della linea, e resta dritta sulla pagina. Una B coricata non si legge,
       e a testa in giù si legge peggio.
       Tratteggiato quando l'azione è prevista, continuo quando è fatta,
       come la linea che lo porta. `dim` è il lato. */
    case 'quadro': {
      const s = dim;
      w = Math.ceil(s * 2) + 6;
      h = Math.ceil(s) + 6;
      const cx = w / 2, cy = h / 2;
      const x0 = lato > 0 ? cx : cx - s;   // il lato che tocca il tracciato
      const bx = cx + lato * s / 2;        // centro del quadro, dove sta la B
      const tr = pieno ? '' : ' stroke-dasharray="3.5,3"';
      const giro = o.giro || 0;
      d = `<rect x="${f(x0)}" y="${f(cy - s/2)}" width="${f(s)}" height="${f(s)}"`
        + ` fill="#fff" stroke="${col}" stroke-width="2.4"${tr}/>`
        + txt(bx, cy + s * 0.28, o.testo || '', col, s * 0.72, 'middle',
            giro ? `rotate(${f(giro)} ${f(bx)} ${f(cy)})` : '');
      break;
    }

    /* Accensione per linee — alla fine del tracciato il braccio gira di 90°
       verso il lato scelto e ci mette una punta: è quello il verso in cui si
       manda il fuoco, e non è mai quello della linea, che è la linea di
       appoggio. `dim` è la lunghezza del braccio. */
    /* Accensione per linee — alla fine del tracciato il braccio gira di 90°
       verso il lato scelto: è quello il verso in cui si manda il fuoco, e
       non è mai quello della linea, che è la linea di appoggio.
       È UNA sagoma chiusa, asta e punta insieme, non una linea più un
       triangolo: solo così la freccia prevista può essere vuota col
       contorno, come gli assi di sviluppo. Con l'asta disegnata a tratto e
       la punta a parte, il vuoto avrebbe lasciato l'asta piena — mezza
       freccia prevista e mezza fatta. `dim` è la lunghezza del braccio. */
    case 'ortogonale': {
      const sw = dim * 0.15, hw = dim * 0.34, hl = dim * 0.42;
      w = Math.ceil(dim * 2 + hw) + 6;
      h = Math.ceil(hw * 2) + 6;
      const cx = w / 2, cy = h / 2;
      const tip = cx + lato * dim;
      const base = tip - lato * hl;
      d = `<path d="M${f(cx)} ${f(cy - sw)}L${f(base)} ${f(cy - sw)}`
        + `L${f(base)} ${f(cy - hw)}L${f(tip)} ${f(cy)}L${f(base)} ${f(cy + hw)}`
        + `L${f(base)} ${f(cy + sw)}L${f(cx)} ${f(cy + sw)}Z"`
        + ` fill="${pieno ? col : '#fff'}" stroke="${col}"`
        + ` stroke-width="2" stroke-linejoin="round"/>`;
      break;
    }

    /* Attacco sui fianchi — freccia inclinata di 45° che parte dal tracciato
       e punta verso il fianco scelto. Lunga: era un trattino, e su una carta
       a scala d'incendio tre trattini non dicono da che parte si attacca.
       `dim` è la lunghezza dell'asta misurata sulla diagonale. */
    case 'freccia45': {
      const k = dim * 0.707;                 // proiezione sui due assi
      w = Math.ceil(k * 2) + 8; h = Math.ceil(k * 2) + 8;
      const cx = w / 2, cy = h / 2;
      const tx = cx + k * lato, ty = cy - k;
      const hT = dim * 0.34, bT = dim * 0.2;
      /* Base della punta arretrata di hT lungo la diagonale, larga bT per
         parte: la punta resta un triangolo anche a 45°. */
      const bx = tx - hT * 0.707 * lato, by = ty + hT * 0.707;
      d = `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(bx)}" y2="${f(by)}"`
        + ` stroke="${col}" stroke-width="2.6"/>`
        + `<path d="M${f(tx)} ${f(ty)}L${f(bx - bT * lato)} ${f(by - bT)}`
        + `L${f(bx + bT * lato)} ${f(by + bT)}Z"`
        + ` fill="${pieno ? col : '#fff'}" stroke="${col}"`
        + ` stroke-width="1.6" stroke-linejoin="round"/>`;
      break;
    }

    /* Via di fuga — chevron nel verso di percorrenza. È l'unico tracciato
       della tavola in cui fra prevista ed effettuata non cambia il tratto ma
       il NUMERO dei segni: uno quando è prevista, due quando è percorribile
       davvero. Un tratteggio qui non si sarebbe letto, perché il chevron è
       già fatto di segmenti staccati. */
    case 'chevron': {
      const b = dim * 0.42, sep = dim * 0.5;
      const quanti = pieno ? 2 : 1;
      w = dim + 6;
      h = Math.ceil(b * 1.4 + (quanti - 1) * sep) + 8;
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < quanti; i++){
        const y = cy + (i - (quanti - 1) / 2) * sep;
        d += `<path d="M${f(cx - b)} ${f(y + b * 0.7)}L${f(cx)} ${f(y - b * 0.7)}`
          + `L${f(cx + b)} ${f(y + b * 0.7)}" fill="none" stroke="${col}"`
          + ` stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      break;
    }

    /* Tappo di coda — la traversa che chiude il capo dell'asta. Una guaina
       è una polilinea, e una polilinea i capi non li chiude: i due bordi
       correvano paralleli e in fondo finivano nel nulla, come un tubo
       tagliato. `dim` è la larghezza della guaina, cioè quanto deve essere
       lunga la traversa. */
    case 'tappo': {
      w = Math.ceil(dim) + 4; h = 10;
      const cx = w / 2, cy = h / 2, sp = Math.max(1.8, dim * 0.18);
      d = `<line x1="${f(cx - dim / 2)}" y1="${f(cy)}" x2="${f(cx + dim / 2)}" y2="${f(cy)}"`
        + ` stroke="${col}" stroke-width="${f(sp)}" stroke-linecap="butt"/>`;
      break;
    }

    /* Accesso interrotto — croce sul tracciato, simmetrica: la rotazione non
       la cambia. */
    case 'croce': {
      w = h = dim;
      d = `<path d="M2 2L${dim-2} ${dim-2}M${dim-2} 2L2 ${dim-2}" stroke="${col}" stroke-width="2.6"/>`;
      break;
    }

    /* Funivie e seggiovie — un seggiolino appeso al cavo, di traverso.
       L'attacco esce dall'asse x locale, cioè perpendicolare alla linea:
       tracciato lungo y stava nel verso di percorrenza, quindi pendeva lungo
       il cavo invece che da esso, e su una campata verticale scendeva giù
       per la pagina come un piolo.
       `incl` è l'angolo FRA il braccio e il cavo: 90 lo tiene perpendicolare,
       meno lo inclina all'indietro — un seggiolino in movimento non sta a
       squadra, e a 75° la fila si legge subito come qualcosa che scorre
       invece che come una serie di trattini.
       Ruota tutto il seggiolino attorno al punto d'attacco, seduta compresa:
       inclinare il solo braccio lascerebbe la seduta a squadra col cavo, cioè
       storta rispetto a ciò che la regge.
       `dim` è la misura complessiva. */
    case 'pilone': {
      const st = dim * 0.45;        // braccio d'attacco
      const sl = dim * 0.5;         // seggiolino: lunghezza lungo il cavo
      const sw = dim * 0.22;        //             spessore, di traverso
      const incl = o.incl != null ? o.incl : 90;
      const gr = 90 - incl;         // scarto dalla perpendicolare, in gradi
      /* Il riquadro va misurato SULLA figura ruotata: con l'ingombro della
         perpendicolare la seduta usciva tagliata dal bordo dell'icona. */
      const a = gr * Math.PI / 180, rag = st + sw;
      w = Math.ceil((rag * Math.cos(a) + sl / 2 * Math.sin(a)) * 2) + 6;
      h = Math.ceil((rag * Math.sin(a) + sl / 2 * Math.cos(a)) * 2) + 6;
      const cx = w / 2, cy = h / 2;
      const x1 = cx + lato * st;
      const x0 = lato > 0 ? x1 : x1 - sw;
      d = `<g transform="rotate(${f(lato * gr)} ${f(cx)} ${f(cy)})">`
        + `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(x1)}" y2="${f(cy)}"`
        + ` stroke="${col}" stroke-width="1.8"/>`
        + `<rect x="${f(x0)}" y="${f(cy - sl/2)}" width="${f(sw)}" height="${f(sl)}"`
        + ` rx="1" fill="${col}"/></g>`;
      break;
    }

    /* Linea elettrica: il fulmine sta dritto sulla pagina. Ruotato lungo la
       campata finirebbe capovolto sui tratti verso ovest, e un fulmine a
       testa in giù non lo riconosce nessuno. */
    case 'fulmine':
    case 'fulmineOff': {
      w = h = dim;
      d = `<g transform="scale(${(dim/64).toFixed(3)})">`
        + `<path d="M38 5L17 35h11l-5 24 25-33H36l8-21Z" fill="${C.giallo}" stroke="${col}" stroke-width="4" stroke-linejoin="round"/>`
        + (tipo === 'fulmineOff'
            ? `<path d="M9 9L55 55M55 9L9 55" stroke="${col}" stroke-width="5"/>` : '')
        + `</g>`;
      break;
    }

    default:
      w = h = dim;
  }

  return {w, h, html: d};
}

/* Icona pronta per PolylineDecorator / per l'anteprima. */
const decoSvg = g =>
  `<svg viewBox="0 0 ${g.w} ${g.h}" width="${g.w}" height="${g.h}" xmlns="http://www.w3.org/2000/svg">${g.html}</svg>`;

/* I motivi che si toccano fra loro: il passo è l'altezza del glifo. */
const DECO_CONTIGUI = ['triangoloBase', 'bifronte', 'omega', 'denti'];

/* =====================================================================
   4. LINEE
   Metà della tavola sono tracciati. Ognuno porta lo stile Leaflet e, dove
   serve, il motivo ripetuto che sitac.js passa a PolylineDecorator:
   {tipo, passo, dim, n, forma, pieno, offset}.
   `stati:1` dice che il tracciato ha prevista/effettuata: tratteggiato
   quando è prevista, pieno quando è fatta.
   ===================================================================== */
const L = {};
const aggL = (k, g, sg, it, en, stile, extra) => {
  L[k] = Object.assign({g, sg, n:{it, en}}, stile, extra || {});
};

/* ---- TAVOLA 1: sentiero e viabilità ---- */
aggL('sentiero','zona',null,'Sentiero o mulattiera','Trail',
  {color:C.nero, weight:3, dashArray:'14,5,3,5'});
aggL('strada_leggeri','zona',null,'Strada per mezzi leggeri','Light means road',
  {color:C.nero, weight:3, dashArray:'11,8'});
aggL('sterrata_leggeri','zona',null,'Strada sterrata per mezzi leggeri','Unpaved road, light means',
  {color:C.nero, weight:3, dashArray:'11,8'}, {badge:'4x4'});
aggL('strada_pesanti','zona',null,'Strada per mezzi pesanti','Heavy means road',
  {color:C.nero, weight:3.5});
aggL('sterrata_pesanti','zona',null,'Strada sterrata per mezzi pesanti','Unpaved road, heavy means',
  {color:C.nero, weight:3.5}, {badge:'4x4'});
aggL('senso_unico','zona',null,'Senso di marcia obbligatorio','One way only',
  {color:C.nero, weight:3}, {deco:{tipo:'freccia', passo:'25%', dim:13}});
aggL('accesso_interrotto','zona',null,'Accesso interrotto','Road closed',
  {color:C.nero, weight:3.5}, {deco:{tipo:'croce', passo:34, dim:18}});
aggL('fune_sbalzo','zona',null,'Funivie, fili a sbalzo, ecc.','Cableways and aerial wires',
  {color:C.nero, weight:2.6}, {deco:{tipo:'pilone', passo:60, dim:22, verso:135, incl:75}});
aggL('elettrodotto','zona',null,'Linea elettrica attiva','Power line on',
  {color:C.nero, weight:2.4, dashArray:'14,5,3,5'}, {deco:{tipo:'fulmine', passo:70, dim:24, dritto:1}});
aggL('elettrodotto_off','zona',null,'Linea elettrica disattivata','Power line off',
  {color:C.nero, weight:2.4, dashArray:'14,5,3,5'}, {deco:{tipo:'fulmineOff', passo:70, dim:24, dritto:1}});

/* ---- TAVOLA 2: assi di sviluppo, fronte ---- */
/* Fig. della tavola: il principale è un blocco rosso pieno, i secondari
   sono frecce VUOTE col contorno — riempimento bianco e bordo rosso — e si
   distinguono fra loro per il calibro, non per il colore. `guaina` è la
   seconda linea che sta sotto e fa da bordo; `bordo` è il colore con cui si
   disegnano guaina, punta e legenda, perché il tracciato vero è bianco e
   una punta bianca su fondo bianco non c'è. */
/* Il principale è un blocco ROSSO PIENO, non un contorno: le due secondarie
   sono le sole aperte, ed è quello che le distingue a colpo d'occhio dalla
   principale — non lo spessore soltanto. */
aggL('asse_principale','evoluzione',null,'Asse di sviluppo principale','Head of the fire',
  {color:C.rosso, weight:11, lineCap:'butt'},
  {deco:{tipo:'punta', passo:0, offset:'100%', dim:38, pieno:1, sempre:1}});
aggL('asse_veloce','evoluzione',null,'Asse secondario (veloce)','Secondary axis (fast)',
  {color:'#ffffff', weight:7, lineCap:'butt'},
  {bordo:C.rosso, guaina:{weight:11},
   deco:[{tipo:'punta', passo:0, offset:'100%', dim:30, sempre:1},
         {tipo:'tappo', passo:0, offset:4, dim:14}]});
aggL('asse_lento','evoluzione',null,'Asse secondario (lento)','Secondary axis (slow)',
  {color:'#ffffff', weight:4.5, lineCap:'butt'},
  {bordo:C.rosso, guaina:{weight:8},
   deco:[{tipo:'punta', passo:0, offset:'100%', dim:22, sempre:1},
         {tipo:'tappo', passo:0, offset:3, dim:11}]});
/* Doppia linea parallela a denti: il tracciato è la linea di monte, il
   motivo aggiunge quella affiancata e le traversine. */
aggL('fronte','evoluzione',null,'Fronte dell\u2019incendio','Fire front',
  {color:C.rosso, weight:3}, {deco:{tipo:'denti', passo:'auto', dim:9}});

/* ---- TAVOLA 4: azioni su linea ---- */
aggL('ricognizione','azioni','sgTerra','Ricognizione','Patrol',
  {color:C.rosso, weight:0, opacity:0},
  {stati:1, deco:{tipo:'omega', passo:'auto', dim:14, pieno:1}});
aggL('difesa_linea','azioni','sgTerra','Difesa in linea','Defence on a line',
  {color:C.rosso, weight:3}, {stati:1, deco:{tipo:'triangoloBase', passo:'auto', dim:13, pieno:1}});
/* Tre frecce a 45° verso il fianco scelto: `lato` dice quale, e lo chiede
   sitac.js con un terzo clic dopo aver chiuso la linea. */
aggL('attacco_fianchi','azioni','sgTerra','Attacco sui fianchi','Containment attack',
  {color:C.rosso, weight:2.8},
  {stati:1, lato:1, deco:{tipo:'freccia45', dim:34, offset:'20%', passo:'30%', pieno:1}});
/* Un attacco localizzato è un punto in cui si entra da una direzione: due
   vertici, origine e punta, come pendenza e vento. */
aggL('attacco_localizzato','azioni','sgTerra','Attacco localizzato','Hot spotting',
  {color:C.rosso, weight:2},
  {stati:1, punti2:1, deco:{tipo:'punta', passo:0, offset:'100%', dim:18, pieno:1}});
/* Il quadro con la B non è più un badge CSS ma un motivo: così può essere
   tratteggiato quando l'azione è prevista, come la linea che lo porta. */
aggL('bonifica','azioni','sgTerra','Bonifica','Mop up',
  {color:C.rosso, weight:2.8},
  {stati:1, deco:[{tipo:'punta', passo:0, offset:'100%', dim:20, pieno:1},
                  {tipo:'quadro', testo:'B', dim:18, passo:60, offset:'12%',
                   pieno:1, verso:0}]});
aggL('linea_sicurezza','azioni','sgControfuoco','Creazione linea di sicurezza','Creation of a safety line',
  {color:C.rosso, weight:3}, {stati:1, deco:{tipo:'bifronte', passo:'auto', dim:12, pieno:1}});
/* Accensione e linea di sicurezza sono lo stesso gesto in due tempi: si
   crea la linea d'appoggio, poi si accende. Nella tavola stanno nello
   stesso riquadro, e separarle costringeva a cercarle in due punti della
   barra mentre si sta facendo una cosa sola. */
aggL('accensione_linee','azioni','sgControfuoco','Accensione per linee','Line firing',
  {color:'#ffffff', weight:7, lineCap:'butt', lineJoin:'miter'},
  {stati:1, lato:1, vuota:1, bordo:C.rosso,
   guaina:{weight:13, lineCap:'butt', lineJoin:'miter'},
   deco:{tipo:'puntaVuota', dim:26, passo:'0'}});
aggL('via_fuga','azioni','sgEvacuazione','Via di fuga per evacuazione','Evacuation escape route',
  {color:C.nero, weight:2.6}, {stati:1, deco:{tipo:'chevron', passo:'33%', dim:16, pieno:1}});

/* =====================================================================
   5. ANTEPRIMA DI UNA LINEA
   Serve nella colonna di sinistra, nella legenda a video e in quella
   stampata. Una barretta colorata non basta più: due tracciati rossi dello
   stesso peso si distinguono SOLO per il motivo, ed è quello che va visto
   prima di premere il pulsante — 4x4 compreso.

   Il glifo è disegnato con la linea verticale; qui la linea è orizzontale,
   quindi si ruota di 90° attorno al punto in cui va posato. Dopo la
   rotazione l'altezza del glifo (lungo la linea) diventa la sua larghezza
   sullo schermo, e la larghezza diventa l'altezza: la scala si calcola su
   entrambe, o un motivo alto esce dal riquadro.
   ===================================================================== */
const A_W = 64, A_H = 30;

function anteprimaLinea(k, stato){
  const d = L[k];
  if (!d) return '';
  const y = A_H / 2;
  /* Il colore dei motivi è quello del BORDO, non del tratto: sugli assi
     secondari il tracciato è bianco. */
  const col = d.bordo || d.color || C.rosso;
  const dentro = d.color || C.rosso;
  const previsto = !!(d.stati && stato !== 'attivo');
  const tratto = (previsto && !d.vuota) ? '8,6' : (d.dashArray || null);
  const corpo = (previsto && d.vuota) ? '#ffffff' : dentro;
  const peso = Math.min(d.weight || 3, 9);
  let s = '';
  if (d.guaina)
    s += `<line x1="1" y1="${y}" x2="${A_W - 1}" y2="${y}" stroke="${col}"`
      + ` stroke-width="${Math.min(peso + 3.5, 9)}"/>`;
  s += `<line x1="1" y1="${y}" x2="${A_W - 1}" y2="${y}"`
    + ` stroke="${d.guaina ? corpo : col}" stroke-width="${peso}"`
    + (tratto ? ` stroke-dasharray="${tratto}"` : '') + `/>`;

  /* `deco` può essere uno o un elenco: pendenza, vento e bonifica ne hanno
     due, e l'anteprima deve mostrarli tutti o il pulsante mente. */
  [].concat(d.deco || []).forEach(dc => {
    const pieno = !!(dc.pieno && !previsto);
    const g = decoGlifo(dc.tipo,
      {col, pieno, n:dc.n, forma:dc.forma, dim:dc.dim, testo:dc.testo,
       aperta:dc.aperta, incl:dc.incl, lato:1});
    /* I motivi che non ruotano col tracciato non devono ruotare nemmeno
       qui: il glifo è disegnato con la linea verticale, ma un pilone o un
       seggiolino stanno dritti sulla pagina, e ruotarli di 90° per
       l'anteprima li corica. Cambiando la rotazione cambia anche quale
       lato del glifo occupa la larghezza del riquadro. */
    const lw = dc.dritto ? g.w : g.h;
    const lh = dc.dritto ? g.h : g.w;
    const sc = Math.min(1, (A_H - 2) / lh, (A_W - 2) / lw);
    const posa = px => `<g transform="translate(${px.toFixed(1)} ${y}) `
      + `rotate(${dc.dritto ? 0 : 90}) `
      + `scale(${sc.toFixed(3)}) translate(${-g.w/2} ${-g.h/2})">${g.html}</g>`;
    /* Le posizioni ricalcano quelle sul tracciato: offset 0 è l'inizio,
       '100%' la fine, '50%' la metà. Un motivo che nell'anteprima sta dove
       non starà mai sulla carta non serve a decidere. */
    if (dc.offset === '100%')      s += posa(A_W - 3);
    else if (dc.offset === 0)      s += posa(3);
    else if (dc.offset === '50%')  s += posa(A_W / 2);
    else if (DECO_CONTIGUI.indexOf(dc.tipo) >= 0){
      const passo = g.h * sc;
      for (let x = passo / 2; x < A_W; x += passo) s += posa(x);
    } else s += posa(A_W * 0.34) + posa(A_W * 0.72);
  });

  if (d.badge){
    const bw = d.badge.length > 1 ? 20 : 14;
    /* Ai due capi, come sul tracciato: l'anteprima deve dire dove il bollo
       comparirà davvero. */
    [2, A_W - bw - 2].forEach(bx => {
      s += `<rect x="${bx}" y="${y - 8}" width="${bw}" height="16" rx="${d.badgeQuadro ? 2 : 8}"`
        + ` fill="#fff" stroke="#000" stroke-width="1.8"/>`
        + `<text x="${bx + bw/2}" y="${y + 4}" text-anchor="middle" font-size="10"`
        + ` font-family="Arial,Helvetica,sans-serif" font-weight="700" fill="#000">${esc(d.badge)}</text>`;
    });
  }
  return `<svg viewBox="0 0 ${A_W} ${A_H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/* =====================================================================
   6. TAVOLE E RIQUADRI
   L'ordine è quello della pubblicazione.
   ===================================================================== */
NS.SITAC_SIMBOLI = S;
NS.SITAC_LINEE   = L;
NS.SITAC_COLORI  = C;
NS.SITAC_TAVOLE  = [
  {k:'zona',       n:{it:'La zona di intervento', en:'The operating area'}},
  {k:'evoluzione', n:{it:'L\u2019evoluzione dell\u2019incendio', en:'Fire progression'}},
  {k:'dispositivo',n:{it:'Il dispositivo di intervento', en:'The deployed means'}},
  {k:'azioni',     n:{it:'Le azioni', en:'The actions'}}
];
NS.SITAC_RIQUADRI = {
  sgAereo:      {it:'Dispositivo aereo', en:'Air means'},
  sgTerra:      {it:'Squadre a terra', en:'Ground crews'},
  sgControfuoco:{it:'Controfuoco e fuoco prescritto', en:'Backfire and prescribed fire'},
  sgEvacuazione:{it:'Evacuazione', en:'Evacuation'}
};

/* Motivi, anteprime e glifo del vento: li consuma sitac.js. */
NS.SITAC_DECO          = decoGlifo;
NS.SITAC_DECO_SVG      = decoSvg;
NS.SITAC_DECO_CONTIGUI = DECO_CONTIGUI;
NS.SITAC_ANTEPRIMA     = anteprimaLinea;

/* Il quadro del vento in alto a sinistra sulla carta non è un elemento
   della tavola ma un dato di scenario: lì il vento resta un glifo. */
NS.SITAC_GLIFI = {
  vento_debole:   glifoVento(1),
  vento_moderato: glifoVento(2),
  vento_forte:    glifoVento(3)
};

/* Quale codina e quante, per i due simboli che si allungano. La freccia
   non è più un glifo a misura fissa ma un tracciato decorato, quindi qui
   basta la ricetta: la disegna sitac.js con gli stessi motivi delle linee. */
NS.SITAC_CODINE = {
  pend_lieve:    {forma:'T',  n:1},
  pend_moderata: {forma:'T',  n:2},
  pend_forte:    {forma:'T',  n:3},
  vento_debole:   {forma:'45', n:1},
  vento_moderato: {forma:'45', n:2},
  vento_forte:    {forma:'45', n:3}
};

/* Quante codine per intensità. La legge `codineVento` in sitac.js per la
   freccia del vento sul DOS: non può più ricavarlo da una riga di LIN,
   perché il vento è diventato un simbolo. */
NS.SITAC_INTENSITA = {vento_debole:1, vento_moderato:2, vento_forte:3};

/* Etichetta e lunghezza per la finestra di inserimento: la chiede sitac.js
   quando si posa un simbolo con il flag `e`. */
NS.SITAC_ID_MAX = ID_MAX;

/* Nazioni e bandiere: le consuma il pannello di scelta di sitac.js. */
NS.SITAC_STATI = STATI.map(r => ST[r[0]]);
NS.SITAC_BANDIERA = bandieraTag;

/* Compatibilità con le versioni precedenti del modulo: i vecchi GeoJSON
   rientrano ricondotti alle chiavi nuove. Pendenze e vento NON stanno qui:
   la chiave è la stessa, cambia solo la geometria, e l'import se ne accorge
   da sé trovando un Point dove ora c'è una linea. */
NS.SITAC_VECCHI = {gruppo:'modulo_vvf', colonna:'modulo_ue', acqua_eli:'acqua_aerei',
  ostacolo_volo:'fune_sbalzo', evacuazione:'area_evacuare'};

})();
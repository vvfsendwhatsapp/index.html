/*!
 * FireOps VVF — sitac.js — SITAC incendio boschivo
 * Dipendenze (nell'ordine): Leaflet 1.9 · Geoman 2.15 · PolylineDecorator 1.6
 *                           sitac-simboli.js (dati della simbologia)
 *                           sitac-vento.js (vento, cono, fronti)
 * Markup: sezione #sitac-aib di index.html
 * Stile:  style.css, sezione MODULI AGGIUNTIVI
 *
 * IMPIANTO
 * Due schede. La prima è l'intestazione: intervento, DOS, posizione. La
 * seconda è la carta — comandi a sinistra, mappa a destra — e resta muta
 * finché la prima non è convalidata.
 *
 * Non è una sequenza didattica imposta a un operatore che ha fretta: il
 * DOS lo nomina il ROS su un intervento già aperto, quindi quando qualcuno
 * apre questa pagina il numero e il nominativo ESISTONO GIÀ. Chiederli
 * prima non ferma nessuno, e una SITAC che gira fra sale operative senza
 * dire a quale intervento si riferisce e chi la firma non serve a niente.
 *
 * L'unica eccezione prevista è la posizione scelta sulla carta: lì si
 * passa alla scheda 2 con la sola mappa viva, si clicca, e la convalida
 * arriva dal popup senza tornare indietro.
 *
 * NIENTE DIALOGHI DEL BROWSER
 * prompt() e confirm() intestano la finestra col dominio del sito
 * (vvfsendwhatsapp.github.io), che in sala operativa non dice niente a
 * nessuno. Al loro posto c'è un modale interno che dice FireOps VVF.
 *
 * DIREZIONE A DUE PUNTI
 * I simboli orientabili (vento, pendenze, lanci, Transit Point) non
 * chiedono un azimut da digitare: si posa il simbolo, si clicca dove
 * punta, e resta una maniglia trascinabile. Su una carta si ragiona per
 * direzioni viste, non per gradi.
 *
 * STATO PREVISTO / IN ATTO
 * La tavola distingue ciò che è pianificato da ciò che è in atto. Non sono
 * voci separate ma un interruttore in cima, che resta fisso mentre si
 * scorre: vale per il prossimo elemento disegnato e viaggia nel GeoJSON
 * insieme al tipo.
 */
(function () {
'use strict';
const NS = (window.FireOps = window.FireOps || {});
if (NS.Sitac) return;

function avvia(app){
  /* Bandiere, descrizione e pulsante Espandi stanno nella riga sopra
     #sitac-app, fuori dal riquadro: le ricerche partono dalla sezione. */
  const radice = app.closest('.page-section') || app;
  const q  = s => radice.querySelector(s);
  const qq = s => radice.querySelectorAll(s);

  /* =======================================================================
     0. LINGUE
     La chiave `tipo` nel GeoJSON resta sempre quella tecnica: cambiare
     lingua non tocca in alcun modo i file esportati.
     ===================================================================== */
  const BANDIERE = {
    it:'<svg viewBox="0 0 9 6"><rect width="3" height="6" fill="#008C45"/><rect x="3" width="3" height="6" fill="#F4F5F0"/><rect x="6" width="3" height="6" fill="#CD212A"/></svg>',
    en:'<svg viewBox="0 0 60 30"><clipPath id="cUk"><rect width="60" height="30"/></clipPath><g clip-path="url(#cUk)"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="3"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></g></svg>',
    fr:'<svg viewBox="0 0 9 6"><rect width="3" height="6" fill="#002395"/><rect x="3" width="3" height="6" fill="#fff"/><rect x="6" width="3" height="6" fill="#ED2939"/></svg>',
    es:'<svg viewBox="0 0 12 8"><rect width="12" height="8" fill="#AA151B"/><rect y="2" width="12" height="4" fill="#F1BF00"/></svg>'
  };

  const L10N = {
    it:{
      sub:'Segui i passi a sinistra: prima i dati, poi lo scenario, poi le quattro tavole. Doppio clic o Invio per chiudere una linea.',
      gStato:'Stato', statoPrevisto:'Previsto', statoAttivo:'In atto',
      nIntervento:'N. intervento', nDos:'DOS', dosAiuto:'Cifre o lettere, fino a sei. Es. VF 12A4',
      ventoLeggo:'Lettura del vento in corso…',
      ventoErrore:'Vento non disponibile: {e}',
      gPunti:'Punti', gLinee:'Linee', gAree:'Aree',
      areeFuori:'Perimetri fuori tavola SITAC: servono al calcolo di superficie e perimetro.',
      gModifica:'Modifica', gMappa:'Mappa e dati', gEsporta:'Esportazione',
      legenda:'Legenda', legVuota:'Nessun elemento sulla mappa.',
      bSposta:'Sposta', bElimina:'Elimina', bAnnulla:'Annulla ultimo', bPulisci:'Cancella tutto',
      bSfondo:'Sfondo', bImporta:'Importa GeoJSON', bStampa:'Stampa PDF', bCentra:'Centra sulla mia posizione',
      pronto:'Pronto.\nApri un passo a sinistra e scegli uno strumento.',
      spento:'Strumento disattivato.',
      suggLinea:'Clic per i vertici, doppio clic per chiudere.',
      suggArea:'Clic per i vertici, clic sul primo per chiudere.',
      suggSimbolo:'Clic sulla mappa per posizionare.',
      chiediSigla:'Sigla o testo da scrivere nel simbolo',
      chiediNota:'Testo dell\u2019annotazione',
      chiediDirezione:'Clicca sulla mappa dove punta il simbolo.\nPoi puoi trascinare la maniglia.',
      confPulisci:'Cancellare tutti gli elementi disegnati?',
      ok:'Conferma', annulla:'Annulla', titoloModale:'FireOps VVF — SITAC',
      modOn:'Modifica attiva.\nTrascina i vertici o i simboli.', modOff:'Modifica disattivata.',
      elimOn:'Eliminazione attiva.\nClic su un elemento per rimuoverlo.', elimOff:'Eliminazione disattivata.',
      nienteAnnulla:'Niente da annullare.', giaVuota:'La mappa è già vuota.',
      sfondo:'Sfondo: {n}', localizzo:'Localizzazione in corso…',
      posizione:'Posizione: {lat}, {lon}\n±{m} m',
      posErrore:'Posizione non disponibile.\nSu http non locale il GPS è bloccato.',
      nienteExport:'Niente da esportare.',
      geojsonFatto:'GeoJSON: {n} elementi.\nÈ l\'unico formato che rientra qui identico.',
      kmlFatto:'KML: {n} elementi ({a} poligoni).\nApribile in QGIS e Google Earth.',
      fileErrato:'File non valido: {e}', importati:'Importati {n} elementi.',
      conteggio:'{p} punti · {l} linee · {a} aree',
      superficie:'\nSuperficie totale: {v} ha', perimetro:'\nPerimetro totale: {v} km',
      areaDi:'Superficie {a} ha · perimetro {p} km', lunghezzaDi:'Lunghezza {v} km',
      kmlDoc:'SITAC incendio boschivo', kmlAree:'Aree', kmlLinee:'Linee', kmlSimboli:'Simboli',
      sfSat:'Satellite', sfTopo:'Topografico', sfStrada:'Stradale',
      stTitolo:'SITAC — Incendio boschivo', stData:'Redatta il {d}',
      importAree:'Importati {n} perimetri.', importScarti:'\n{n} elementi non poligonali ignorati.',
      importNiente:'Nessun poligono nel file: si importano solo aree.',
      conoPendenza:'Dalla linea di massima pendenza',
      conoPendenzaNota:'Fig. 4: senza vento la bisettrice \u00e8 la massima salita, letta dal rilievo.',
      pendLeggo:'Lettura del rilievo attorno al fronte\u2026',
      pendPiatto:'Terreno quasi piano attorno al fronte: qui la pendenza non guida la propagazione.',
      pendTrovata:'Massima salita verso {a}\u00b0 · pendenza {p}%',
      pendFonte:'massima pendenza',
      pendVelQuale:'Da dove viene la velocit\u00e0 di avanzamento?',
      pendVelPercorso:'Dal terreno gi\u00e0 percorso',
      pendVelPercorsoNota:'{d} m dall\u2019innesco al fronte, divisi per le ore trascorse.',
      pendVelVista:'Stimata a vista', pendVelVistaNota:'In metri all\u2019ora, guardando il fronte.',
      chiediOraInnesco:'Ora d\u2019innesco (hh:mm)', oraErrata:'Ora non valida.',
      chiediMetriOra:'Avanzamento del fronte in metri all\u2019ora\n300 = come vento 10 km/h · 900 = come 30 km/h · 1800 = come 60 km/h',
      conoPendFatto:'Cono {a}\u00b0 su massima salita {d}\u00b0 (pendenza {p}%)\nFronte a {m} m in un\u2019ora — velocit\u00e0 stimata, non SI.TA.C.',
    },
    en:{
      sub:'Follow the steps on the left: data first, then the scenario, then the four tables. Double-click or Enter closes a line.',
      gStato:'State', statoPrevisto:'Planned', statoAttivo:'Active',
      nIntervento:'Incident no.', nDos:'DOS', dosAiuto:'One letter and three digits, e.g. A123',
      ventoLeggo:'Reading wind data…',
      ventoErrore:'Wind unavailable: {e}',
      gPunti:'Points', gLinee:'Lines', gAree:'Areas',
      areeFuori:'Polygons outside the SITAC table: used to compute area and perimeter.',
      gModifica:'Edit', gMappa:'Map and data', gEsporta:'Export',
      legenda:'Legend', legVuota:'Nothing on the map yet.',
      bSposta:'Move', bElimina:'Delete', bAnnulla:'Undo last', bPulisci:'Clear all',
      bSfondo:'Basemap', bImporta:'Import GeoJSON', bStampa:'Print PDF', bCentra:'Centre on my position',
      pronto:'Ready.\nOpen a step on the left and pick a tool.',
      spento:'Tool switched off.',
      suggLinea:'Click each vertex, double-click to close.',
      suggArea:'Click each vertex, click the first one to close.',
      suggSimbolo:'Click the map to place it.',
      chiediSigla:'Label to write inside the symbol',
      chiediNota:'Note text',
      chiediDirezione:'Click on the map where the symbol points.\nThen you can drag the handle.',
      confPulisci:'Delete every drawn element?',
      ok:'Confirm', annulla:'Cancel', titoloModale:'FireOps VVF — SITAC',
      modOn:'Edit mode on.\nDrag vertices or symbols.', modOff:'Edit mode off.',
      elimOn:'Delete mode on.\nClick an element to remove it.', elimOff:'Delete mode off.',
      nienteAnnulla:'Nothing to undo.', giaVuota:'The map is already empty.',
      sfondo:'Basemap: {n}', localizzo:'Locating…',
      posizione:'Position: {lat}, {lon}\n±{m} m',
      posErrore:'Position unavailable.\nGPS is blocked on non-local http.',
      nienteExport:'Nothing to export.',
      geojsonFatto:'GeoJSON: {n} elements.\nThe only format that comes back in unchanged.',
      kmlFatto:'KML: {n} elements ({a} polygons).\nOpens in QGIS and Google Earth.',
      fileErrato:'Invalid file: {e}', importati:'{n} elements imported.',
      conteggio:'{p} points · {l} lines · {a} areas',
      superficie:'\nTotal area: {v} ha', perimetro:'\nTotal perimeter: {v} km',
      areaDi:'Area {a} ha · perimeter {p} km', lunghezzaDi:'Length {v} km',
      kmlDoc:'Wildfire SITAC', kmlAree:'Areas', kmlLinee:'Lines', kmlSimboli:'Symbols',
      sfSat:'Satellite', sfTopo:'Topographic', sfStrada:'Street',
      stTitolo:'SITAC — Wildfire', stData:'Drawn on {d}'
    },
    fr:{
      sub:'Suivez les étapes à gauche : les données, puis la situation, puis les quatre tableaux. Double-clic ou Entrée pour fermer une ligne.',
      gStato:'État', statoPrevisto:'Prévu', statoAttivo:'En cours',
      nIntervento:'N° d\'intervention', nDos:'DOS', dosAiuto:'Une lettre et trois chiffres, ex. A123',
      ventoLeggo:'Lecture du vent en cours…',
      ventoErrore:'Vent indisponible : {e}',
      gPunti:'Points', gLinee:'Lignes', gAree:'Zones',
      areeFuori:'Polygones hors tableau SITAC : ils servent au calcul de la surface et du périmètre.',
      gModifica:'Modifier', gMappa:'Carte et données', gEsporta:'Exportation',
      legenda:'Légende', legVuota:'Rien sur la carte pour le moment.',
      bSposta:'Déplacer', bElimina:'Supprimer', bAnnulla:'Annuler le dernier', bPulisci:'Tout effacer',
      bSfondo:'Fond de carte', bImporta:'Importer GeoJSON', bStampa:'Imprimer PDF', bCentra:'Centrer sur ma position',
      pronto:'Prêt.\nOuvrez une étape à gauche et choisissez un outil.',
      spento:'Outil désactivé.',
      suggLinea:'Cliquez chaque sommet, double-clic pour fermer.',
      suggArea:'Cliquez chaque sommet, cliquez le premier pour fermer.',
      suggSimbolo:'Cliquez sur la carte pour le poser.',
      chiediSigla:'Texte à inscrire dans le symbole',
      chiediNota:'Texte de l\u2019annotation',
      chiediDirezione:'Cliquez sur la carte dans la direction du symbole.\nVous pourrez ensuite déplacer la poignée.',
      confPulisci:'Supprimer tous les éléments dessinés ?',
      ok:'Confirmer', annulla:'Annuler', titoloModale:'FireOps VVF — SITAC',
      modOn:'Modification active.\nDéplacez les sommets ou les symboles.', modOff:'Modification désactivée.',
      elimOn:'Suppression active.\nCliquez un élément pour le retirer.', elimOff:'Suppression désactivée.',
      nienteAnnulla:'Rien à annuler.', giaVuota:'La carte est déjà vide.',
      sfondo:'Fond : {n}', localizzo:'Localisation en cours…',
      posizione:'Position : {lat}, {lon}\n±{m} m',
      posErrore:'Position indisponible.\nLe GPS est bloqué en http non local.',
      nienteExport:'Rien à exporter.',
      geojsonFatto:'GeoJSON : {n} éléments.\nSeul format qui revient ici à l\'identique.',
      kmlFatto:'KML : {n} éléments ({a} polygones).\nS\'ouvre dans QGIS et Google Earth.',
      fileErrato:'Fichier invalide : {e}', importati:'{n} éléments importés.',
      conteggio:'{p} points · {l} lignes · {a} zones',
      superficie:'\nSurface totale : {v} ha', perimetro:'\nPérimètre total : {v} km',
      areaDi:'Surface {a} ha · périmètre {p} km', lunghezzaDi:'Longueur {v} km',
      kmlDoc:'SITAC feu de forêt', kmlAree:'Zones', kmlLinee:'Lignes', kmlSimboli:'Symboles',
      sfSat:'Satellite', sfTopo:'Topographique', sfStrada:'Routier',
      stTitolo:'SITAC — Feu de forêt', stData:'Établie le {d}'
    },
    es:{
      sub:'Sigue los pasos de la izquierda: primero los datos, luego la situación, luego las cuatro tablas. Doble clic o Intro para cerrar una línea.',
      gStato:'Estado', statoPrevisto:'Previsto', statoAttivo:'En curso',
      nIntervento:'N.º de intervención', nDos:'DOS', dosAiuto:'Una letra y tres cifras, p. ej. A123',
      ventoLeggo:'Leyendo el viento…',
      ventoErrore:'Viento no disponible: {e}',
      gPunti:'Puntos', gLinee:'Líneas', gAree:'Áreas',
      areeFuori:'Polígonos fuera de la tabla SITAC: sirven para calcular superficie y perímetro.',
      gModifica:'Editar', gMappa:'Mapa y datos', gEsporta:'Exportación',
      legenda:'Leyenda', legVuota:'Todavía no hay nada en el mapa.',
      bSposta:'Mover', bElimina:'Eliminar', bAnnulla:'Deshacer último', bPulisci:'Borrar todo',
      bSfondo:'Fondo', bImporta:'Importar GeoJSON', bStampa:'Imprimir PDF', bCentra:'Centrar en mi posición',
      pronto:'Listo.\nAbre un paso a la izquierda y elige una herramienta.',
      spento:'Herramienta desactivada.',
      suggLinea:'Haz clic en cada vértice, doble clic para cerrar.',
      suggArea:'Haz clic en cada vértice, clic en el primero para cerrar.',
      suggSimbolo:'Haz clic en el mapa para colocarlo.',
      chiediSigla:'Texto que va dentro del símbolo',
      chiediNota:'Texto de la anotación',
      chiediDirezione:'Haz clic en el mapa hacia donde apunta el símbolo.\nLuego puedes arrastrar el tirador.',
      confPulisci:'¿Borrar todos los elementos dibujados?',
      ok:'Confirmar', annulla:'Cancelar', titoloModale:'FireOps VVF — SITAC',
      modOn:'Edición activa.\nArrastra los vértices o los símbolos.', modOff:'Edición desactivada.',
      elimOn:'Eliminación activa.\nHaz clic en un elemento para quitarlo.', elimOff:'Eliminación desactivada.',
      nienteAnnulla:'Nada que deshacer.', giaVuota:'El mapa ya está vacío.',
      sfondo:'Fondo: {n}', localizzo:'Localizando…',
      posizione:'Posición: {lat}, {lon}\n±{m} m',
      posErrore:'Posición no disponible.\nEn http no local el GPS está bloqueado.',
      nienteExport:'Nada que exportar.',
      geojsonFatto:'GeoJSON: {n} elementos.\nEl único formato que vuelve aquí idéntico.',
      kmlFatto:'KML: {n} elementos ({a} polígonos).\nSe abre en QGIS y Google Earth.',
      fileErrato:'Archivo no válido: {e}', importati:'{n} elementos importados.',
      conteggio:'{p} puntos · {l} líneas · {a} áreas',
      superficie:'\nSuperficie total: {v} ha', perimetro:'\nPerímetro total: {v} km',
      areaDi:'Superficie {a} ha · perímetro {p} km', lunghezzaDi:'Longitud {v} km',
      kmlDoc:'SITAC incendio forestal', kmlAree:'Áreas', kmlLinee:'Líneas', kmlSimboli:'Símbolos',
      sfSat:'Satélite', sfTopo:'Topográfico', sfStrada:'Callejero',
      stTitolo:'SITAC — Incendio forestal', stData:'Redactada el {d}'
    }
  };

  /* Le voci dei passi e del percorso guidato del cono stanno qui in blocco
     invece che dentro L10N: sono un'aggiunta successiva, e tenerle insieme
     rende evidente cosa appartiene al percorso e cosa alla tavola. Quello
     che manca in una lingua ricade sull'italiano, come fa `t`. */
  const L10N_EXTRA = {
    it:{ bCono:'Aggiungi cono',
      bPosizione:'Inserisci coordinate',
      bPosizionePronta:'Posizione disponibile',
      bPosizioneFatta:'Coordinate rilevate',
      conoModo:'Come si costruisce il cono?',
      conoSettore:'Dal punto d\u2019innesco', conoSettoreNota:'Settore a 30° dall\u2019origine; un secondo clic dice dove sta il fronte adesso (T0).',
      conoFronte:'Dalla linea del fronte', conoFronteNota:'Si disegna il fronte rilevato e lo si fa avanzare a 15, 30 e 60 minuti.',
      conoTerzo:'Pendenza e vento composti', conoStandby:'Non ancora disponibile (fig. 4 e 5 della pubblicazione).',
      conoVia:'Togli tutti i coni', conoViaNota:'Rimuove le previsioni dalla carta.', conoTolto:'Coni rimossi.',
      conoAnnullato:'Cono annullato.',
      conoClicOrigine:'Clicca sulla mappa il punto d\u2019innesco.',
      conoClicFronte:'Clicca dove sta il fronte adesso (T0).',
      conoClicVento:'Clicca sulla mappa nella direzione verso cui va il vento.',
      conoDisegnaFronte:'Disegna la linea del fronte: clic sui vertici, doppio clic per chiudere.',
      conoDirezione:'Direzione del vento', dirWeb:'Da servizio meteo', dirWebNota:'Open-Meteo, MET Norway, OpenWeatherMap in cascata.',
      dirBussola:'Punta il telefono verso il fumo', dirBussolaNota:'Tieni il telefono verso il fronte e conferma: si legge la bussola.',
      dirBussolaNo:'Bussola non disponibile su questo dispositivo.',
      dirMappa:'Scelta sulla mappa', dirMappaNota:'Un clic nella direzione verso cui va il vento.',
      bussolaLeggo:'Lettura della bussola in corso\u2026 tieni il telefono fermo.',
      conoIntensita:'Intensit\u00e0 del vento', intWeb:'Da servizio meteo', intWebNota:'Arrotondata in eccesso a decine di km/h.',
      intScala:'Scala 10\u2013110 km/h', intScalaNota:'La colonna della tabella 1 della pubblicazione.',
      conoAvanza:'il fuoco avanza di {m} m in un\u2019ora', conoT0:'T0 — fronte rilevato',
      conoFatto:'Cono {a}° · vento {v} km/h verso {d}° ({f})\nFronte a {m} m in un\u2019ora.',
      vento_debole:'Intensit\u00e0 debole', vento_moderato:'Intensit\u00e0 moderata', vento_forte:'Intensit\u00e0 forte',
      nNominativo:'Nominativo', nTelefono:'Telefono',
      nPosizione:'Posizione attuale', bConvalida:'Convalida',
      datiOk:'Dati convalidati: intervento {i}, {n}.',
      datiMancanti:'Mancano o non sono validi: {c}',
      statoPrevista:'Prevista', statoAttiva:'Attiva', statoEffettuata:'Effettuata',
      stVento:'Vento {v} km/h verso {d}° (rilevato alle {o})',
      p1:'Intervento', p2:'Vento locale', p3:'Innesco e superficie coinvolta',
      p4:'Coni di propagazione', p5:'Zona di intervento', p6:'Evoluzione dell\u2019incendio',
      p7:'Dispositivo di intervento', p8:'Azioni', p9:'Modifica', p10:'Importa ed Esporta',
      nDos:'ID DOS', dosAiuto:'Quattro caratteri, cifre o lettere. Es. VF 12A4',
      posDos:'Posizione DOS',
      posComeQuale:'Come indichi la posizione del DOS?',
      posGps:'Localizzazione GPS', posGpsNota:'Legge dove sta questo dispositivo.',
      posCoord:'Inserisci le coordinate', posCoordNota:'Gradi decimali, separati da virgola.',
      posMappa:'Clic sulla mappa', posMappaNota:'Un clic dove sta il DOS.',
      posClicMappa:'Clicca sulla mappa la posizione del DOS.',
      chiediCoord:'Coordinate: latitudine, longitudine in gradi decimali',
      coordErrate:'Coordinate non valide.',
      provincia:'Provincia', comando:'Comando afferente',
      geoLeggo:'Ricerca della provincia in corso\u2026',
      geoErrore:'Provincia non determinata: {e}',
      geoFatto:'DOS in provincia di {p}.',
      bVentoDir:'Direzione sulla mappa', bVentoWeb:'Leggi da Open-Meteo',
      ventoTrascina:'Trascina la punta della freccia: indica dove VA il vento.',
      ventoNoDos:'Prima indica la posizione del DOS al passo 1.',
      ventoNota:'La stima da servizio meteo non vede il vento di versante: correggila a vista.',
      ventoImpostato:'Vento {v} km/h verso {d}\u00b0 ({f}).',
      statoDispositivo:'Stato del dispositivo', statoAzioni:'Stato delle azioni',
      bSfondo:'Mappa: {n}',
      p2Nota:'Il rilievo è la posizione di questo dispositivo: in sala operativa non è quella del DOS.',
      pFatto:'\u2713', pManca:'da fare',
      pInneschi:'{n} sul terreno', pFronti:'{n} tracciati', pConi:'{n} coni',
      pEttari:'{v} ha', pNessuno:'nessuno',
      dosDove:'Posizione rilevata. Cosa ne faccio?',
      dosPosa:'Posa qui il simbolo DOS', dosSposta:'Sposta qui il DOS',
      dosSolo:'Tieni solo le coordinate', dosPosato:'DOS posato sulla posizione rilevata.',
      conoElemento:'Da un\u2019area o un fronte gi\u00e0 disegnati',
      conoElementoNota:'Di un\u2019area percorsa si prende il bordo sottovento; di un fronte, il tracciato.',
      conoNienteBase:'Nessuna area percorsa n\u00e9 fronte sulla carta: disegnane uno, o usa gli altri modi.',
      conoScegliBase:'Clicca sulla mappa l\u2019area o il fronte da cui far partire il cono.',
      conoBaseCorta:'La geometria scelta ha troppo pochi vertici.',
      lancioManiglie:'Trascina la punta per direzione e lunghezza, il fianco per la larghezza, il centro per spostarlo.',
      lancioDi:'Asse {a} m · larghezza {b} m · {s} ha',
      ventoQuale:'Con che vento si costruisce?',
      ventoRiusa:'Vento dello scenario — {v} km/h verso {d}\u00b0',
      ventoRiusaNota:'Quello impostato al passo 2 ({f}).',
      ventoAltro:'Un vento locale diverso',
      ventoAltroNota:'Vale solo per questo cono: il quadro dello scenario non cambia.',
      rilLeggo:'Lettura del rilievo in corso\u2026',
      rilErrore:'Rilievo non disponibile: {e} — cono non corretto.',
      rilFatto:'Raggi corretti per pendenza: {k}\nStima empirica, non SI.TA.C.',
      posRilevataQ:'Posizione rilevata: {lat}, {lon}\nÈ questa la posizione del DOS?',
      posRilevataSi:'Sì, è la posizione del DOS',
      posRilevataSiNota:'Posa qui il simbolo e compila il campo del passo 1.',
      posRilevataNo:'No, la indico in un altro modo',
      posRilevataNoNota:'Coordinate dettate per radio, o un clic sulla mappa.',
      supPercorsa:'Percorsa: {v} ha',
      supAttiva:'A fuoco attivo: {v} ha',
      supTotale:'Coinvolta in totale: {v} ha',
      ventoRiancorato:'Posizione DOS modificata.\nLa freccia del vento è stata riancorata: verifica la direzione.',
      bModificaDati:'Modifica', datiBloccati:'Dati bloccati.\nPremi Modifica per correggerli.',
      posComando:'Sede del Comando', posComandoNota:'Le coordinate della caserma di {c}.',
      posComandoNo:'Nessun Comando attivo selezionato.',
      sch1:'1 · Dati intervento', sch2:'2 · Mappa',
      dataOra:'Data e ora', nQualifica:'Qualifica', qualificaVuota:'—',
      datiNota:'Compila tutti i campi: la posizione si sblocca dopo, e la mappa dopo la convalida.',
      posBloccata:'Prima compila intervento, qualifica, nominativo, ID DOS e telefono.',
      cartaBloccata:'Convalida i dati del passo 1 per usare la mappa.',
      popPosTit:'Posizione del DOS', popPosOk:'Convalida', popPosSposta:'Sposta',
      posAnnullata:'Scelta della posizione annullata.',
      redatta:'Redatta',
      bPulisciDati:'Pulisci campi',
      confPulisciDati:'Svuotare tutti i campi dell\u2019intervento?\nIl disegno sulla mappa non viene toccato.',
      datiPuliti:'Campi svuotati.',
      menuSposta:'Sposta', menuElimina:'Elimina',
      menuVertici:'Modifica i vertici', menuTesto:'Modifica la sigla',
      menuDirezione:'Cambia direzione', menuManiglie:'Modifica ingombro',
      menuStato:'Segna come {s}', menuCono:'Cono {n}',
      menuVerticiOn:'Vertici modificabili.\nTrascina i pallini, Esc per finire.',
      menuSpostaPunto:'Trascina il simbolo dove serve.',
      menuSpostaArea:'Trascina la geometria intera.\nEsc per finire.',
      lanciChiedi:'Lanci del dispositivo aereo',
      lanciNota:'Lascia vuoto ci\u00f2 che non \u00e8 intervenuto: nel foglio compare solo chi ha lanciato.',
      lanciTot:'Totale lanci', stampaAnnullata:'Stampa annullata.',
      lancioPosato:'Lancio posato.\u000aSelezionalo, o tasto destro, per regolarne l\u2019ingombro.',
      menuMisure:'Misure',
      scegliLato:'Scegli il lato: clicca sulla mappa dalla parte verso cui\u000avanno le frecce.',
      latoScelto:'Lato impostato.\u000aTasto destro sul tracciato per cambiarlo.',
      menuLato:'Cambia lato',
      ventoTit:'Vento locale',
      menuVentoDir:'Modifica direzione',
      menuVentoInt:'Modifica intensit\u00e0',
      ventoClicDir:'Clicca sulla mappa nella direzione verso cui VA il vento.',
      ventoBloccato:'La freccia del vento non si trascina.\u000aTasto destro per direzione e intensit\u00e0.',
      legVento:'Direzione del vento \u2014 {v} km/h verso {d}\u00b0',
      chiediNotaLibera:'Nota',
      notaAggiunta:'Nota aggiunta.',
      bAggiungiNota:'Aggiungi nota',
      disegnoAnnullato:'Disegno annullato: troppi pochi vertici.',
      chiediPaese:'Nazione del modulo',
      menuPaese:'Cambia nazione',
      stSquadre:'Dispositivo a terra \u2014 squadre previste e attive',
      dirSegui:'\u25b6 Muovi il puntatore: il simbolo gira.\u000aSecondo clic per fermare la direzione.',
      p8note:'Note', bNotePulisci:'Svuota le note',
      noteAiuto:'Quello che si scriveva a mano nel margine della carta: orari, nominativi, quello che non ha un simbolo.',
      stNote:'Note',
      datiOkAuto:'Dati completi: convalidati da s\u00e9 \u2014 intervento {i}, {n}.\u000aLa scheda 2 \u00e8 sbloccata.', },
    en:{ bCono:'Add cone', conoModo:'How should the cone be built?',
      bPosizione:'Enter coordinates',
      conoSettore:'From the point of origin', conoSettoreNota:'30° sector from the origin; a second click marks where the front is now (T0).',
      conoFronte:'From the fire front line', conoFronteNota:'Draw the observed front and push it forward at 15, 30 and 60 minutes.',
      conoTerzo:'Slope and wind combined', conoStandby:'Not available yet (fig. 4 and 5 of the publication).',
      conoVia:'Remove every cone', conoViaNota:'Takes the forecasts off the map.', conoTolto:'Cones removed.',
      conoAnnullato:'Cone cancelled.',
      conoClicOrigine:'Click the point of origin on the map.',
      conoClicFronte:'Click where the front is right now (T0).',
      conoClicVento:'Click on the map in the direction the wind is going.',
      conoDisegnaFronte:'Draw the front line: click each vertex, double-click to close.',
      conoDirezione:'Wind direction', dirWeb:'From weather service', dirWebNota:'Open-Meteo, MET Norway, OpenWeatherMap in turn.',
      dirBussola:'Point the phone at the smoke', dirBussolaNota:'Hold the phone towards the front and confirm: the compass is read.',
      dirBussolaNo:'Compass not available on this device.',
      dirMappa:'Pick on the map', dirMappaNota:'One click in the direction the wind is going.',
      bussolaLeggo:'Reading the compass\u2026 hold the phone still.',
      conoIntensita:'Wind speed', intWeb:'From weather service', intWebNota:'Rounded up to tens of km/h.',
      intScala:'Scale 10\u2013110 km/h', intScalaNota:'The column from table 1 of the publication.',
      conoAvanza:'fire advances {m} m in one hour', conoT0:'T0 — observed front',
      conoFatto:'Cone {a}° · wind {v} km/h towards {d}° ({f})\nFront at {m} m in one hour.',
      vento_debole:'Light', vento_moderato:'Moderate', vento_forte:'Strong',
      nNominativo:'Name', nTelefono:'Phone',
      nPosizione:'Current position', bConvalida:'Validate',
      datiOk:'Data validated: incident {i}, {n}.',
      datiMancanti:'Missing or invalid: {c}',
      statoPrevista:'Planned', statoAttiva:'Active', statoEffettuata:'Done',
      stVento:'Wind {v} km/h towards {d}° (read at {o})',
      p1:'Incident', p2:'DOS position', p3:'Area of origin',
      p4:'Wind and cones', p5:'Fire front', p6:'Area involved',
      p2Nota:'This reads where this device is: in the control room that is not where the DOS stands.',
      pFatto:'\u2713', pManca:'to do',
      pInneschi:'{n} on the ground', pFronti:'{n} drawn', pConi:'{n} cones',
      pEttari:'{v} ha', pNessuno:'none',
      dosDove:'Position acquired. What should I do with it?',
      dosPosa:'Place the DOS symbol here', dosSposta:'Move the DOS here',
      dosSolo:'Keep the coordinates only', dosPosato:'DOS placed on the acquired position.',
      sch1:'1 · Incident data', sch2:'2 · Map', dataOra:'Date and time',
      nQualifica:'Rank', qualificaVuota:'—',
      popPosTit:'DOS position', popPosOk:'Confirm', popPosSposta:'Move', },
    fr:{ bCono:'Ajouter un c\u00f4ne', conoModo:'Comment construire le c\u00f4ne ?',
      bPosizione:'Saisir les coordonnées',
      conoSettore:'Depuis le point d\u2019origine', conoSettoreNota:'Secteur \u00e0 30° depuis l\u2019origine ; un second clic indique o\u00f9 est le front (T0).',
      conoFronte:'Depuis la ligne de front', conoFronteNota:'Tracez le front relev\u00e9 et faites-le avancer \u00e0 15, 30 et 60 minutes.',
      conoTerzo:'Pente et vent compos\u00e9s', conoStandby:'Pas encore disponible (fig. 4 et 5 de la publication).',
      conoVia:'Retirer tous les c\u00f4nes', conoViaNota:'Enl\u00e8ve les pr\u00e9visions de la carte.', conoTolto:'C\u00f4nes retir\u00e9s.',
      conoAnnullato:'C\u00f4ne annul\u00e9.',
      conoClicOrigine:'Cliquez le point d\u2019origine sur la carte.',
      conoClicFronte:'Cliquez o\u00f9 se trouve le front maintenant (T0).',
      conoClicVento:'Cliquez sur la carte dans la direction o\u00f9 va le vent.',
      conoDisegnaFronte:'Tracez la ligne de front : cliquez chaque sommet, double-clic pour fermer.',
      conoDirezione:'Direction du vent', dirWeb:'Depuis un service m\u00e9t\u00e9o', dirWebNota:'Open-Meteo, MET Norway, OpenWeatherMap tour \u00e0 tour.',
      dirBussola:'Pointez le t\u00e9l\u00e9phone vers la fum\u00e9e', dirBussolaNota:'Tenez le t\u00e9l\u00e9phone vers le front et confirmez : la boussole est lue.',
      dirBussolaNo:'Boussole indisponible sur cet appareil.',
      dirMappa:'Choix sur la carte', dirMappaNota:'Un clic dans la direction o\u00f9 va le vent.',
      bussolaLeggo:'Lecture de la boussole\u2026 gardez le t\u00e9l\u00e9phone immobile.',
      conoIntensita:'Intensit\u00e9 du vent', intWeb:'Depuis un service m\u00e9t\u00e9o', intWebNota:'Arrondie par exc\u00e8s \u00e0 la dizaine de km/h.',
      intScala:'\u00c9chelle 10\u2013110 km/h', intScalaNota:'La colonne du tableau 1 de la publication.',
      conoAvanza:'le feu avance de {m} m en une heure', conoT0:'T0 — front relev\u00e9',
      conoFatto:'C\u00f4ne {a}° · vent {v} km/h vers {d}° ({f})\nFront \u00e0 {m} m en une heure.',
      vento_debole:'Faible', vento_moderato:'Mod\u00e9r\u00e9e', vento_forte:'Forte',
      nNominativo:'Nom', nTelefono:'T\u00e9l\u00e9phone',
      nPosizione:'Position actuelle', bConvalida:'Valider',
      datiOk:'Donn\u00e9es valid\u00e9es : intervention {i}, {n}.',
      datiMancanti:'Manquant ou invalide : {c}',
      statoPrevista:'Pr\u00e9vue', statoAttiva:'En cours', statoEffettuata:'Effectu\u00e9e',
      stVento:'Vent {v} km/h vers {d}° (relev\u00e9 \u00e0 {o})',
      p1:'Intervention', p2:'Position DOS', p3:'Zone d\u2019origine',
      p4:'Vent et c\u00f4nes', p5:'Front de flamme', p6:'Surface concern\u00e9e',
      p2Nota:'Le relev\u00e9 donne la position de cet appareil : en salle op\u00e9rationnelle ce n\u2019est pas celle du DOS.',
      pFatto:'\u2713', pManca:'\u00e0 faire',
      pInneschi:'{n} sur le terrain', pFronti:'{n} trac\u00e9s', pConi:'{n} c\u00f4nes',
      pEttari:'{v} ha', pNessuno:'aucun',
      dosDove:'Position relev\u00e9e. Qu\u2019en fait-on ?',
      dosPosa:'Poser ici le symbole DOS', dosSposta:'D\u00e9placer le DOS ici',
      dosSolo:'Garder seulement les coordonn\u00e9es', dosPosato:'DOS pos\u00e9 sur la position relev\u00e9e.',
      sch1:'1 · Données', sch2:'2 · Carte', dataOra:'Date et heure',
      nQualifica:'Grade', qualificaVuota:'—',
      popPosTit:'Position du DOS', popPosOk:'Valider', popPosSposta:'Déplacer', },
    es:{ bCono:'A\u00f1adir cono', conoModo:'\u00bfC\u00f3mo se construye el cono?',
      bPosizione:'Introducir coordenadas',
      conoSettore:'Desde el punto de origen', conoSettoreNota:'Sector de 30° desde el origen; un segundo clic marca d\u00f3nde est\u00e1 el frente (T0).',
      conoFronte:'Desde la l\u00ednea del frente', conoFronteNota:'Dibuja el frente observado y hazlo avanzar a 15, 30 y 60 minutos.',
      conoTerzo:'Pendiente y viento compuestos', conoStandby:'A\u00fan no disponible (fig. 4 y 5 de la publicaci\u00f3n).',
      conoVia:'Quitar todos los conos', conoViaNota:'Retira las previsiones del mapa.', conoTolto:'Conos retirados.',
      conoAnnullato:'Cono cancelado.',
      conoClicOrigine:'Haz clic en el punto de origen.',
      conoClicFronte:'Haz clic donde est\u00e1 el frente ahora (T0).',
      conoClicVento:'Haz clic en el mapa hacia donde va el viento.',
      conoDisegnaFronte:'Dibuja la l\u00ednea del frente: clic en cada v\u00e9rtice, doble clic para cerrar.',
      conoDirezione:'Direcci\u00f3n del viento', dirWeb:'Desde servicio meteorol\u00f3gico', dirWebNota:'Open-Meteo, MET Norway, OpenWeatherMap en cascada.',
      dirBussola:'Apunta el m\u00f3vil hacia el humo', dirBussolaNota:'Sost\u00e9n el m\u00f3vil hacia el frente y confirma: se lee la br\u00fajula.',
      dirBussolaNo:'Br\u00fajula no disponible en este dispositivo.',
      dirMappa:'Elecci\u00f3n en el mapa', dirMappaNota:'Un clic en la direcci\u00f3n hacia la que va el viento.',
      bussolaLeggo:'Leyendo la br\u00fajula\u2026 mant\u00e9n el m\u00f3vil quieto.',
      conoIntensita:'Intensidad del viento', intWeb:'Desde servicio meteorol\u00f3gico', intWebNota:'Redondeada por exceso a decenas de km/h.',
      intScala:'Escala 10\u2013110 km/h', intScalaNota:'La columna de la tabla 1 de la publicaci\u00f3n.',
      conoAvanza:'el fuego avanza {m} m en una hora', conoT0:'T0 — frente observado',
      conoFatto:'Cono {a}° · viento {v} km/h hacia {d}° ({f})\nFrente a {m} m en una hora.',
      vento_debole:'D\u00e9bil', vento_moderato:'Moderada', vento_forte:'Fuerte',
      nNominativo:'Nombre', nTelefono:'Tel\u00e9fono',
      nPosizione:'Posici\u00f3n actual', bConvalida:'Validar',
      datiOk:'Datos validados: intervenci\u00f3n {i}, {n}.',
      datiMancanti:'Faltan o no son v\u00e1lidos: {c}',
      statoPrevista:'Prevista', statoAttiva:'Activa', statoEffettuata:'Efectuada',
      stVento:'Viento {v} km/h hacia {d}° (medido a las {o})',
      p1:'Intervenci\u00f3n', p2:'Posici\u00f3n DOS', p3:'\u00c1rea de origen',
      p4:'Viento y conos', p5:'Frente de llama', p6:'Superficie afectada',
      p2Nota:'La medici\u00f3n da la posici\u00f3n de este dispositivo: en sala no es la del DOS.',
      pFatto:'\u2713', pManca:'pendiente',
      pInneschi:'{n} en el terreno', pFronti:'{n} trazados', pConi:'{n} conos',
      pEttari:'{v} ha', pNessuno:'ninguno',
      dosDove:'Posici\u00f3n obtenida. \u00bfQu\u00e9 hago con ella?',
      dosPosa:'Coloca aqu\u00ed el s\u00edmbolo DOS', dosSposta:'Mueve aqu\u00ed el DOS',
      dosSolo:'Conserva solo las coordenadas', dosPosato:'DOS colocado en la posici\u00f3n obtenida.',
      sch1:'1 · Datos', sch2:'2 · Mapa', dataOra:'Fecha y hora',
      nQualifica:'Categoría', qualificaVuota:'—',
      popPosTit:'Posición del DOS', popPosOk:'Validar', popPosSposta:'Mover', }
  };
  Object.keys(L10N_EXTRA).forEach(k => Object.assign(L10N[k], L10N_EXTRA[k]));

  let lingua = 'it';
  const t = (chiave, val) => {
    let s = (L10N[lingua] && L10N[lingua][chiave]) || L10N.it[chiave] || chiave;
    if (val) Object.keys(val).forEach(k => { s = s.split('{'+k+'}').join(val[k]); });
    return s;
  };
  /* I nomi della tavola esistono in italiano e inglese: per francese e
     spagnolo si ricade sull'italiano, che è la lingua della fonte. */
  const nm = d => { const x = d && d.n; return (x && (x[lingua] || x.it)) || ''; };

  /* =======================================================================
     1. SIMBOLOGIA E CATEGORIE
     ===================================================================== */
  const SIM = NS.SITAC_SIMBOLI || {};
  const LIN = NS.SITAC_LINEE   || {};
  const COL = NS.SITAC_COLORI  || {rosso:'#cc0000', verde:'#009900'};

  /* Le quattro tavole della pubblicazione, coi riquadri interni: i passi
     7-10 riproducono la stessa partizione del documento, così chi ha in
     mano il pieghevole ritrova le voci dove se le aspetta. */
  const TAVOLE = NS.SITAC_TAVOLE || [];
  const RIQUADRI = NS.SITAC_RIQUADRI || {};
  const nmRiquadro = k => { const x = RIQUADRI[k]; return (x && (x[lingua] || x.it)) || ''; };

  /* Sul simbolo la nazione è la bandiera più il codice ISO: è quanto ci sta
     dentro un riquadro largo mezzo centimetro. Il nome per esteso vive nel
     suggerimento e nel foglio stampato, dove lo spazio c'è. */
  const STATI = {};
  (NS.SITAC_STATI || []).forEach(s => { STATI[s.k] = s; });
  const nmStato = k => { const s = STATI[k]; return s ? (s.n[lingua] || s.n.it) : (k || ''); };

  function scegliPaese(gia){
    const voci = (NS.SITAC_STATI || []).map(s => ({
      k: s.k, nota: s.k,
      et: (s.n[lingua] || s.n.it) + (gia === s.k ? ' \u2713' : ''),
      svg: NS.SITAC_BANDIERA ? NS.SITAC_BANDIERA(s.k, 26, 17) : ''}));
    return scegli({testo: t('chiediPaese'), voci});
  }

  async function cambiaPaese(l){
    const cod = await scegliPaese(l._paese);
    if (!cod) return;
    l._paese = cod;
    l.setIcon(iconaSimbolo(l._tipo, {stato:l._stato, testo:l._testo,
      rotazione:l._rotazione, paese:l._paese}));
    etichettaElemento(l);
    aggiornaStato();
  }

  /* Perimetri: la tavola SITAC non prevede poligoni campiti, ma l'area
     percorsa e il fronte attivo sono ciò che si legge per primo su una
     carta, e superficie ed ettari si calcolano solo su un poligono.
     Restano quindi qui, dichiaratamente fuori standard. */
  /* I pieni erano tarati per non coprire l'ortofoto, ma a schermo un 15% su
     fondo scuro non si distingue dal terreno: un'area disegnata deve LEGGERSI
     come area. In stampa restano alleggeriti da alleggerisciPerStampa(), che
     è il posto giusto per quel compromesso.
     La zona minacciata ha il bordo giallo CONTINUO: il tratteggio nella
     tavola vuol dire "previsto", e una zona minacciata non è una previsione
     di zona — è una zona, con dentro gente da avvisare. */
  const AREE = {
    percorsa:   {color:'#6b6b6b', fillColor:'#3a3a3a', fillOpacity:.62, dashArray:'8,6', weight:2,
      n:{it:'Superficie percorsa', en:'Burned area', fr:'Surface parcourue', es:'Superficie quemada'}},
    attiva:     {color:COL.rosso, fillColor:COL.rosso, fillOpacity:.42, weight:3,
      n:{it:'Area a fuoco attivo', en:'Active fire area', fr:'Zone en feu', es:'Área en llamas'}},
    minacciata: {color:'#e8a000', fillColor:'#e8a000', fillOpacity:.3, weight:2.6,
      n:{it:'Zona minacciata', en:'Threatened area', fr:'Zone menacée', es:'Zona amenazada'}},
    evacuata:   {color:COL.verde, fillColor:COL.verde, fillOpacity:.3, weight:2,
      n:{it:'Zona evacuata', en:'Evacuated area', fr:'Zone évacuée', es:'Zona evacuada'}},
    bonificata: {color:'#0070c0', fillColor:'#0070c0', fillOpacity:.3, weight:2,
      n:{it:'Zona bonificata', en:'Mopped up area', fr:'Zone noyée', es:'Zona liquidada'}}
  };
  /* Solo queste due contano come "superficie coinvolta": le altre sono
     zone di gestione, non terreno bruciato o in fiamme. */
  const AREE_SUPERFICIE = ['percorsa', 'attiva'];

  /* Annotazione libera: non è nella tavola, ma scrivere un orario o un
     nome sulla carta è la cosa che si fa più spesso in sala operativa. */
  const NOTA = {libero:1, n:{it:'Annotazione', en:'Note', fr:'Annotation', es:'Anotación'}};

  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g,
    c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

  /* Il colore non è un campo dei simboli: sta dentro il disegno. Per il
     KML, che ne vuole uno solo, si prende il primo del tracciato saltando
     il bianco, che è sempre fondo. I <defs> vanno scartati: contengono la
     campitura del ritardante anche nei lanci d'acqua, che uscirebbero
     rossi invece che azzurri. */
  function coloreSimbolo(k){
    const d = SIM[k];
    if (!d || !d.svg) return COL.rosso;
    const corpo = d.svg({stato:'attivo'}).replace(/<defs>[\s\S]*?<\/defs>/g, '');
    const c = (corpo.match(/#[0-9a-fA-F]{6}/g) || [])
      .filter(x => x.toLowerCase() !== '#ffffff');
    return c[0] || COL.rosso;
  }
  const svgSimbolo = (k, o) => (SIM[k] && SIM[k].svg) ? SIM[k].svg(o || {}) : '';

  /* Sulla mappa il simbolo ha bisogno di un disco chiaro dietro: la
     tavola è disegnata per la carta bianca, e su ortofoto o bosco fitto
     il nero e il rosso sparirebbero. */
    function iconaSimbolo(k, opz){
    const o = opz || {};
    if (k === 'nota')
      return L.divIcon({className:'sitac-etichetta', html: esc(o.testo || ''),
        iconSize:null, iconAnchor:[0,10]});
    /* Pendenza e vento: il punto resta invisibile. Il simbolo lo porta la
       maniglia, e disegnarlo anche qui vorrebbe dire vederlo due volte —
       uno fermo sull'origine e uno in punta, che è quello che conta.
       L'icona esiste lo stesso, vuota: serve a Leaflet per avere qualcosa
       da spostare, e a chi disegna per poterci cliccare sopra col destro. */
    if (SIM[k] && SIM[k].senzaDisco)
      return L.divIcon({className:'sitac-sim sitac-invisibile',
        html:'', iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-11]});
    /* `rotazione` è un azimut vero; `r0` dice verso dove punta il disegno
       così com'è (il vento è disegnato verso ovest, la pendenza verso
       sud-ovest). Senza la differenza i simboli escono ruotati di novanta
       gradi e le squadre leggono una direzione sbagliata. */
    const d0 = (SIM[k] && SIM[k].r0) || 0;
    /* La rotazione la applica il contenitore, ma il glifo può averne bisogno
       per raddrizzare il proprio testo: gliela si passa. */
    const gradi = o.rotazione != null ? ((o.rotazione - d0) % 360 + 360) % 360 : 0;
      /* Il TP non gira: la direzione sta nell'asta, e una sigla ruotata non si
       legge. Gli altri orientabili hanno il disegno che punta da sé. */
    const gir = (o.rotazione != null && k !== 'tp')
      ? ` style="transform:rotate(${((o.rotazione - d0) % 360 + 360) % 360}deg)"` : '';
    /* Il disco chiaro serve ai simboli campiti, che su ortofoto sparirebbero.
       Un'asta con la punta no: è già leggibile per forma, e il pallino le
       ritaglia intorno un bollo bianco che sulla carta sembra un simbolo a
       sé. Stessa scelta della freccia del vento sul DOS. */
    const disco = (SIM[k] && SIM[k].senzaDisco)
      ? '' : '<span class="sitac-disco"></span>';
    return L.divIcon({className:'sitac-sim',
      html:`${disco}<span class="sitac-glifo"${gir}>`
        + `${svgSimbolo(k, o)}</span>`,
      iconSize:[56,56], iconAnchor:[28,28], popupAnchor:[0,-28]});
  }

  /* Opzioni di stile per Leaflet: le chiavi nostre non devono arrivargli.
     Previsto = tratto spezzato, come nella tavola. */
  function stileLinea(d, stato){
    const {n, deco, badge, badgeQuadro, stati, lato, punti2, guaina, bordo,
      vuota, g, sg, r0, ...resto} = d;
    /* `dashArray` va dichiarato SEMPRE, anche a null. Leaflet fonde le
       opzioni invece di sostituirle: omettendo la chiave, una linea che
       passa da prevista a effettuata si tiene il tratteggio di prima e
       continua a dirsi prevista quando non lo è più. */
    const base = Object.assign({}, resto, {dashArray: resto.dashArray || null});
    if (stati && vuota)
      return Object.assign(base,
        {color: stato === 'previsto' ? '#ffffff' : (bordo || resto.color)});
    if (stati && stato === 'previsto')
      return Object.assign(base, {dashArray: resto.dashArray || '9,7'});
    return base;
  }
  const stileArea = d => { const {n, ...resto} = d; return resto; };

  /* =======================================================================
     2. MODALE INTERNO
     Sostituisce prompt e confirm, che intestano la finestra col dominio.
     ===================================================================== */
  const modale = q('#sitac-modale');
  let chiudiModale = null;

  function chiedi(opz){
    return new Promise(risolvi => {
      const soloConferma = !opz.campo;
      modale.querySelector('.sitac-modale-titolo').textContent = t('titoloModale');
      modale.querySelector('.sitac-modale-testo').textContent = opz.testo || '';
      const input = modale.querySelector('#sitac-modale-input');
      const ok = modale.querySelector('#sitac-modale-ok');
      input.style.display = soloConferma ? 'none' : '';
      input.value = opz.valore || '';
      input.maxLength = opz.max || 524288;
      /* Il filtro normalizza mentre si digita: incollare "VF-12/A4" deve
         lasciare 12A4, non far fallire il campo in silenzio. */
      input.oninput = opz.filtro ? () => { input.value = opz.filtro(input.value); } : null;
      ok.textContent = t('ok');
      ok.style.display = '';   // scegli() lo nasconde: qui va rimesso
      modale.querySelector('#sitac-modale-no').textContent = t('annulla');
      modale.hidden = false;

      const fine = val => {
        modale.hidden = true;
        chiudiModale = null;
        risolvi(val);
      };
      chiudiModale = () => fine(null);
      ok.onclick = () => fine(soloConferma ? true : input.value.trim());
      modale.querySelector('#sitac-modale-no').onclick = () => fine(null);
      input.onkeydown = e => {
        if (e.key === 'Enter'){ e.preventDefault(); fine(input.value.trim()); }
        if (e.key === 'Escape') fine(null);
      };
      setTimeout(() => (soloConferma ? ok : input).focus(), 30);
    });
  }

  /* Scelta a pulsanti: stessi elementi del modale, ma al posto del campo di
     testo un elenco di voci. Serve al percorso guidato del cono, dove ogni
     passo è una scelta fra due o tre. */
  function scegli(opz){
    return new Promise(risolvi => {
      const testo = modale.querySelector('.sitac-modale-testo');
      const input = modale.querySelector('#sitac-modale-input');
      const ok = modale.querySelector('#sitac-modale-ok');
      const no = modale.querySelector('#sitac-modale-no');
      let chiuso = false;
      const fine = val => {
        if (chiuso) return;
        chiuso = true;
        modale.hidden = true; chiudiModale = null;
        ok.style.display = ''; input.style.display = ''; testo.textContent = '';
        risolvi(val);
      };

      modale.querySelector('.sitac-modale-titolo').textContent = t('titoloModale');
      testo.textContent = '';
      const p = document.createElement('p');
      p.textContent = opz.testo || '';
      testo.appendChild(p);
      const el = document.createElement('div');
      el.className = 'sitac-scelte';
      (opz.voci || []).forEach(v => {
        if (v.titolo){
          const h = document.createElement('p');
          h.className = 'sitac-scelta-titolo';
          h.textContent = v.titolo;
          el.appendChild(h);
          return;
        }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sitac-scelta';
        b.disabled = !!v.off;
        /* `v.svg` lo costruiamo noi (bandiere), non arriva da fuori: è
           l'unico pezzo di questo pannello che non passa da esc(). */
        b.innerHTML = (v.svg ? `<i class="sitac-bandiera">${v.svg}</i>` : '')
          + `<b>${esc(v.et)}</b>${v.nota ? `<span>${esc(v.nota)}</span>` : ''}`;
        b.onclick = () => fine(v.k);
        el.appendChild(b);
      });
      testo.appendChild(el);
      input.style.display = 'none';
      ok.style.display = 'none';
      no.textContent = t('annulla');
      no.onclick = () => fine(null);
      chiudiModale = () => fine(null);
      modale.hidden = false;
      setTimeout(() => {
        const b = el.querySelector('button:not([disabled])');
        if (b) b.focus();
      }, 30);
    });
  }

  /* =======================================================================
     2bis. PASSI 1 e 2: INTESTAZIONE E POSIZIONE
     Numero d'intervento e DOS non sono un vezzo burocratico: una SITAC che
     gira fra sale operative e squadre senza dire a quale intervento si
     riferisce, e chi la firma, non serve a niente. Finiscono nel GeoJSON,
     nel nome del file e nella testata di stampa.
     ===================================================================== */
    const inIntervento = q('#sitac-nIntervento');
  const inQualifica  = q('#sitac-qualifica');
  const inDos        = q('#sitac-nDos');
  const inNominativo = q('#sitac-nominativo');
  const inTelefono   = q('#sitac-telefono');
  const inPosizione  = q('#sitac-posizione');
  const CHIAVE_SESS  = 'fireops_sitac_intestazione';
  const CHIAVE_NOTE  = 'fireops_sitac_note';

  function normalizzaDos(v){
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      .replace(/^VF/, '').slice(0, 6);
  }
  const dosValido = () => /^[A-Z0-9]{1,6}$/.test(inDos.value);
  const dosCompleto = () => dosValido() ? 'VF ' + inDos.value : '';
  const interventoValido = () => /^[0-9]+$/.test(inIntervento.value);
  const telefonoValido = () =>
    /^\+?[0-9]{6,15}$/.test(inTelefono.value.replace(/[ .\-]/g, ''));

  /* Due soglie distinte. L'anagrafica sblocca il pulsante della posizione:
     finché non si sa CHI è il DOS non ha senso chiedere DOVE sta. La
     posizione in più sblocca la convalida. */
  const anagraficaOk = () => interventoValido() && !!inQualifica.value
    && !!inNominativo.value.trim() && dosValido() && telefonoValido();
  const datiCompleti = () => anagraficaOk() && !!posDos;

  /* datiBloccati = campi in sola lettura adesso.
     datiConvalidati = lo sono stati almeno una volta, ed è QUESTO che apre
     la carta. Premere Modifica per correggere un numero non deve spegnere
     la barra sotto le mani di chi ha già disegnato mezza SITAC. */
  let datiBloccati = false;
  let datiConvalidati = false;
  let autoFatta = false;      // la convalida da sé avviene una volta sola
  let oraRedazione = null;      // congelata alla convalida
  let orologio = null;
  const bDati = q('#sitac-bConvalida');

  const fmtOra = d => new Intl.DateTimeFormat(lingua === 'it' ? 'it-IT' : lingua, {
    dateStyle:'short', timeStyle:'medium', timeZone:'Europe/Rome'}).format(d);

  function mostraOra(){
    q('#sitac-dataOra').textContent = fmtOra(oraRedazione || new Date());
  }
  function avviaOrologio(){
    if (orologio) return;
    orologio = setInterval(mostraOra, 1000);
  }
  function fermaOrologio(){
    if (orologio){ clearInterval(orologio); orologio = null; }
  }

  function segnaIntestazione(){
    if (!datiBloccati){
      inIntervento.classList.toggle('campo-mancante', !interventoValido());
      inQualifica.classList.toggle('campo-mancante', !inQualifica.value);
      inDos.classList.toggle('campo-mancante', !dosValido());
      inNominativo.classList.toggle('campo-mancante', !inNominativo.value.trim());
      inTelefono.classList.toggle('campo-mancante', !telefonoValido());
      inPosizione.classList.toggle('campo-mancante', !posDos);
    }
    try {
      sessionStorage.setItem(CHIAVE_SESS, JSON.stringify({
        intervento: inIntervento.value, qualifica: inQualifica.value,
        dos: inDos.value, nominativo: inNominativo.value,
        telefono: inTelefono.value, posizione: inPosizione.value}));
    } catch(e){ /* sessione non disponibile: si perde solo il ricordo */ }
    const mDos = dosSullaCarta();
    if (mDos){
      mDos._testo = inDos.value || null;
      mDos.setIcon(iconaSimbolo('dos', {stato:'attivo', testo: mDos._testo}));
      etichettaElemento(mDos);
    }
    mostraBlocco();
    aggiornaPassi();
    autoConvalida();
  }

  /* Quando i campi ci sono tutti non c'è più niente da chiedere: premere
     Convalida sarebbe un passaggio a vuoto. L'ultimo campo a completarsi è
     sempre la posizione — il suo pulsante si sblocca solo ad anagrafica
     piena — quindi il momento in cui scatta è prevedibile e non coglie
     nessuno a metà digitazione. */
  function autoConvalida(){
    if (autoFatta || datiBloccati || datiConvalidati) return;
    if (!datiCompleti()) return;
    autoFatta = true;
    convalida({auto:1});
  }

  inIntervento.oninput = () => {
    inIntervento.value = inIntervento.value.replace(/[^0-9]/g, '');
    segnaIntestazione();
  };
  inQualifica.onchange = segnaIntestazione;
  inDos.oninput = () => { inDos.value = normalizzaDos(inDos.value); segnaIntestazione(); };
  inNominativo.oninput = segnaIntestazione;
  inTelefono.oninput = () => {
    inTelefono.value = inTelefono.value.replace(/[^0-9+ ]/g, '');
    segnaIntestazione();
  };

  function mostraBlocco(){
    [inIntervento, inDos, inNominativo, inTelefono].forEach(c => {
      c.readOnly = datiBloccati;
      c.classList.toggle('campo-bloccato', datiBloccati);
    });
    /* Un <select> non ha readOnly: si disabilita e basta. */
    inQualifica.disabled = datiBloccati;
    inQualifica.classList.toggle('campo-bloccato', datiBloccati);
    const bPos = q('#sitac-bPosizione');
    bPos.disabled = datiBloccati || !anagraficaOk();
    /* L'etichetta segue il dato, non la funzione: a posizione acquisita quel
       clic non inserisce più niente, corregge — ed è anche l'unico modo di
       vedere a colpo d'occhio, dal solo pulsante, che il DOS è già a posto. */
    /* Tre stati, non due. Quando il GPS ha già risposto la posizione esiste
       ma non è ancora quella del DOS — in sala operativa non lo è quasi mai,
       il computer non sta sull'incendio — e il pulsante lo dice invece di
       chiedere di inserire qualcosa che è lì da acquisire con un clic. */
    bPos.textContent = t(posDos ? 'bPosizioneFatta'
      : (posizioneOttenuta && cerchioPosizione) ? 'bPosizionePronta'
      : 'bPosizione');
    bDati.textContent = t(datiBloccati ? 'bModificaDati' : 'bConvalida');
    bDati.classList.toggle('attivo', datiBloccati);
    bDati.disabled = !datiBloccati && !datiCompleti();

    const barra = q('#sitac-barra');
    if (barra) barra.classList.toggle('sitac-barra-spenta', !datiConvalidati);
    const lin = q('.sitac-scheda-btn[data-scheda="carta"]');
    if (lin) lin.classList.toggle('sitac-scheda-bloccata', !datiConvalidati);
  }

  function convalida(opz){
    const auto = !!(opz && opz.auto);
    if (!datiCompleti()){ segnaIntestazione(); return; }
    datiBloccati = true;
    datiConvalidati = true;
    oraRedazione = new Date();
    fermaOrologio();
    mostraOra();
    mostraBlocco();
    aggiornaPassi();
    /* Chi ha premuto Convalida ha chiesto di passare alla carta; chi ha
       solo finito di compilare no. ← togli il `if (!auto)` per saltare
       comunque alla carta anche in automatico. */
    if (!auto) vaiAScheda('carta');
    stato(t(auto ? 'datiOkAuto' : 'datiOk',
        {i: inIntervento.value, n: inNominativo.value.trim()})
      + '\n' + t('datiBloccati'));
  }

  bDati.onclick = () => {
    if (datiBloccati){
      datiBloccati = false;
      oraRedazione = null;        // riprende a scorrere, si ricongela alla convalida
      avviaOrologio();
      mostraBlocco();
      inIntervento.focus();
      return;
    }
    convalida();
  };
    /* Svuota SOLO l'intestazione: il disegno resta. Sono due cose diverse —
     "ho sbagliato a digitare" non è "ricomincio la SITAC", e per quello
     c'è già Cancella tutto al passo 8. */
  q('#sitac-bPulisciDati').onclick = async () => {
    if (!await chiedi({testo: t('confPulisciDati')})) return;
    [inIntervento, inDos, inNominativo, inTelefono, inPosizione]
      .forEach(c => { c.value = ''; });
    inQualifica.value = '';
    posDos = null;
    provinciaDos = null;
    comandoSitac = null;
    q('#sitac-provincia').textContent = '\u2014';
    q('#sitac-comando').textContent = '\u2014';
    datiBloccati = false;
    oraRedazione = null;
    avviaOrologio();
    segnaIntestazione();
    stato(t('datiPuliti'));
  };
  avviaOrologio();
  mostraOra();

  try {
    const salvato = JSON.parse(sessionStorage.getItem(CHIAVE_SESS) || '{}');
    inIntervento.value = salvato.intervento || '';
    inQualifica.value  = salvato.qualifica || '';
    inDos.value        = salvato.dos || '';
    inNominativo.value = salvato.nominativo || '';
    inTelefono.value   = salvato.telefono || '';
    inPosizione.value  = salvato.posizione || '';
  } catch(e){ /* niente da ripristinare */ }

    const intestazione = () => ({
    intervento: inIntervento.value || null,
    qualifica: inQualifica.value || null,
    dos: dosCompleto() || null,
    nominativo: inNominativo.value.trim() || null,
    telefono: inTelefono.value.trim() || null,
    posizione: inPosizione.value || null,
    
    /* L'ora della REDAZIONE, non quella della stampa o dell'export: una
       SITAC dice quando è stata fatta, non quando è stata riletta. */
    redatta: oraRedazione ? oraRedazione.toISOString() : null
  });
  function siglaFile(){
    const i = intestazione();
    return (i.intervento ? '_' + i.intervento : '') + (i.dos ? '_' + i.dos.replace(/\s/g, '') : '');
  }

  /* La posizione del DOS non è più "dove sta questo dispositivo": si sceglie
   il modo. In sala operativa il GPS è inutile, e il modo giusto è il clic
   sulla mappa o le coordinate dettate per radio. */
let posDos = null;
let provinciaDos = null;

async function scriviPosizione(latlng, acc, opz){
  const o = opz || {};
  posDos = L.latLng(latlng.lat, latlng.lng);
  inPosizione.value = `${posDos.lat.toFixed(5)}, ${posDos.lng.toFixed(5)}`
    + (acc ? ` (\u00b1${Math.round(acc)} m)` : '');
  segnaIntestazione();
  ventoSeguiDos();
  cercaProvincia(posDos);

  /* Dal clic sulla carta il simbolo si posa e basta: il clic ERA la
     posizione del DOS, chiederlo di nuovo è una domanda senza contenuto. */
  if (o.posa){ posaDos(posDos); vaiAllaCarta(); return; }

  const gia = dosSullaCarta();
  const scelta = await scegli({testo: t('dosDove'), voci: [
    {k:'posa', et: t(gia ? 'dosSposta' : 'dosPosa')},
    {k:'solo', et: t('dosSolo')}
  ]});
  if (scelta === 'posa'){
    posaDos(posDos);
    stato(t('dosPosato'));
  }
  vaiAllaCarta();
}

/* La posizione è l'ultimo dato del passo 1: appena entra, l'anagrafica era
   già piena (è la condizione che sblocca quel pulsante) e autoConvalida ha
   già chiuso la scheda. Restarci davanti a guardare campi in sola lettura
   non serve a niente — quello che si vuole fare adesso è disegnare.
   Il ramo del clic sulla carta esce prima e non passa di qui: lì si è già
   sulla mappa, e convalida() ci pensa da sé. */
function vaiAllaCarta(){
  if (datiConvalidati) vaiAScheda('carta');
}

const dosSullaCarta = () => {
  let m = null;
  disegni.eachLayer(x => { if (x._tipo === 'dos' && x.getLatLng) m = x; });
  return m;
};

function posaDos(latlng){
  const gia = dosSullaCarta();
  if (gia){ gia.setLatLng(latlng); aggiornaStato(); return; }
  const m = L.marker(latlng, {draggable:true,
    icon: iconaSimbolo('dos', {stato:'attivo', testo: inDos.value || null})});
  m._tipo = 'dos'; m._genere = 'simbolo'; m._stato = 'attivo';
  m._testo = inDos.value || null;
  m.on('pm:remove', () => scollega(m));
  /* Trascinando il simbolo si sposta il dato, non solo il disegno: sono
     la stessa cosa, e due posizioni DOS diverse sono un errore garantito. */
  m.on('dragend', () => {
    posDos = m.getLatLng();
    inPosizione.value = `${posDos.lat.toFixed(5)}, ${posDos.lng.toFixed(5)}`;
    segnaIntestazione();
    aggiornaAncoraVento();
    cercaProvincia(posDos);
  });
  disegni.addLayer(m);
  etichettaElemento(m);
  aggiornaStato();
}

q('#sitac-bPosizione').onclick = async () => {
  /* Se il GPS ha risposto, la posizione c'è già: si chiede solo se è quella
     del DOS. In sala operativa la risposta è no — il computer non sta
     sull'incendio — ma su un tablet in campo è sì, ed è un clic invece di tre. */
  if (posizioneOttenuta && cerchioPosizione){
    const p = cerchioPosizione.getLatLng();
    const usa = await scegli({
      testo: t('posRilevataQ', {lat: p.lat.toFixed(5), lon: p.lng.toFixed(5)}),
      voci: [
        {k:'si', et: t('posRilevataSi'), nota: t('posRilevataSiNota')},
        {k:'no', et: t('posRilevataNo'), nota: t('posRilevataNoNota')}
      ]});
    if (!usa) return;                       // Annulla: si esce del tutto
    /* `posa` salta la seconda domanda: chi ha appena risposto "sì, è la
       posizione del DOS" ha già detto tutto quello che serve, e chiedergli
       subito dopo se posare il simbolo è la stessa domanda in altre parole.
       È lo stesso motivo per cui il clic sulla carta non la fa: lì il clic
       ERA la posizione, qui lo è la conferma. */
    if (usa === 'si') return scriviPosizione(p, null, {posa:1});
    /* 'no' cade nel percorso qui sotto */
  }

  /* La sede del Comando è la caserma, non l'incendio: in sala è quasi
     sempre il dato sbagliato per il DOS. Resta però la scorciatoia onesta
     quando il DOS È in sede — succede a incendio appena aperto — e quando
     serve un punto qualsiasi per far partire la lettura del vento. */
  const cmd = centroComando();
  const nomeCmd = (window.FireOpsComandoAttivo || {}).Comando || '';
  const modo = await scegli({testo: t('posComeQuale'), voci: [
    {k:'comando', et:t('posComando'),
      nota: cmd ? t('posComandoNota', {c: nomeCmd}) : t('posComandoNo'), off: !cmd},
    {k:'coord', et:t('posCoord'), nota:t('posCoordNota')},
    {k:'mappa', et:t('posMappa'), nota:t('posMappaNota')}
  ]});
  if (!modo) return;
    if (modo === 'mappa') return posizionaSuMappa();
  if (modo === 'comando') return scriviPosizione(L.latLng(cmd[0], cmd[1]));
  const v = await chiedi({campo:1, testo: t('chiediCoord'), valore: inPosizione.value});
  if (!v) return;
  const n = v.split(/[,;\s]+/).map(Number).filter(x => !isNaN(x));
  if (n.length < 2 || Math.abs(n[0]) > 90 || Math.abs(n[1]) > 180)
    return stato(t('coordErrate'));
  scriviPosizione(L.latLng(n[0], n[1]));
};

/* Popup sulla carta: mostra il punto cliccato e chiede se è quello buono.
   Non è un modale: coprirebbe proprio la mappa che si sta guardando. */
function popupPosizione(latlng){
  return new Promise(risolvi => {
    const box = document.createElement('div');
    box.className = 'sitac-popup-pos';
    box.innerHTML = `<b>${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</b>`;
    const az = document.createElement('div');
    az.className = 'sitac-popup-azioni';
    const fai = (cls, et, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.textContent = t(et);
      b.onclick = () => { map.closePopup(pop); risolvi(k); };
      az.appendChild(b);
    };
    fai('ok', 'popPosOk', 'ok');
    fai('', 'popPosSposta', 'sposta');
    box.appendChild(az);
    const pop = L.popup({closeButton:false, autoClose:false, closeOnClick:false})
      .setLatLng(latlng).setContent(box).openOn(map);
  });
}

/* Percorso "scelgo sulla carta": si passa alla scheda 2 con la sola mappa
   viva, si clicca, si conferma dal popup. La convalida arriva da qui e si
   RESTA sulla carta: tornare indietro per premere un pulsante che si è già
   di fatto premuto è un giro a vuoto. */
async function posizionaSuMappa(){
  vaiAScheda('carta');
  let p = await attendiClic(t('posClicMappa'));
  while (p){
    const scelta = await popupPosizione(p);
    if (scelta === 'ok'){
      await scriviPosizione(p, null, {posa:1});
      convalida();
      return;
    }
    p = await attendiClic(t('posClicMappa'));
  }
  vaiAScheda('dati');
  stato(t('posAnnullata'));
}

/* Reverse geocoding: da Nominatim si prende ISO3166-2-lvl6, che è la sigla
   della provincia ("IT-BO"). `county` e `state_district` in Italia si
   scambiano di posto a seconda della regione, e il nome del comune non è
   mai quello della provincia: è la confusione già vista nel convertitore. */
async function cercaProvincia(latlng){
  const boxP = q('#sitac-provincia'), boxC = q('#sitac-comando');
  boxP.textContent = '\u2026';
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2`
      + `&lat=${latlng.lat}&lon=${latlng.lng}&zoom=10&addressdetails=1`;
    const r = await fetch(u, {headers:{'Accept':'application/json'}});
    if (!r.ok) throw new Error('nominatim ' + r.status);
    const a = (await r.json()).address || {};
    const iso = a['ISO3166-2-lvl6'] || '';
    const sigla = iso.split('-')[1] || '';
    const nome = a.county || a.state_district || a.province || '';
    if (!sigla && !nome) throw new Error('provincia assente');
    provinciaDos = {sigla, nome};
    boxP.innerHTML = `<b>${esc(sigla)}</b> ${esc(nome)}`;
    mostraComandoAfferente(sigla, nome);
    stato(t('geoFatto', {p: nome || sigla}));
  } catch(e){
    provinciaDos = null;
    boxP.textContent = '\u2014';
    boxC.textContent = '\u2014';
    stato(t('geoErrore', {e: e.message}));
  }
  aggiornaPassi();
}

/* Il Comando resta LOCALE alla SITAC: non si tocca window.FireOpsComandoAttivo
   né si emette l'evento condiviso. Una SITAC su un incendio in provincia
   confinante non deve cambiare il Comando di tutta l'applicazione. */
let comandoSitac = null;
function mostraComandoAfferente(sigla, nome){
  const boxC = q('#sitac-comando');
  const trova = NS.comandoPerProvincia;
  comandoSitac = (typeof trova === 'function') ? trova(sigla, nome) : null;
  if (!comandoSitac){
    boxC.textContent = '\u2014';
    boxC.classList.remove('cliccabile-comando');
    boxC.onclick = null;
    return;
  }
  /* Il canale radio sta in vista accanto al nome: è il dato che si cerca
     per primo quando l'incendio è fuori dal proprio Comando. */
  const ch = comandoSitac['Canale Radio Comando'];
  boxC.innerHTML = `<b>${esc(comandoSitac.Comando)}</b>`
    + (ch ? ` \u00b7 CH ${esc(ch)}` : '');
  boxC.classList.add('cliccabile-comando');
  boxC.onclick = ev => {
    if (typeof NS.apriPopupComando === 'function')
      NS.apriPopupComando(comandoSitac, ev, boxC);
  };
}

  /* =======================================================================
     3. MAPPA
     OSM come predefinito: è lo sfondo con cui si lavora normalmente in SO.
     Topografico per quota e sentieri, satellite per la vegetazione.
     ===================================================================== */
  const sfondi = [
    {k:'sfStrada', l:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {maxZoom:19, attribution:'OpenStreetMap'})},
    {k:'sfTopo', l:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        {maxZoom:17, attribution:'OpenTopoMap'})},
    {k:'sfSat', l:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {maxZoom:19, attribution:'Esri'})}
  ];
  let iSfondo = 0;

  /* All'apertura si parte dal Comando attivo, non dal centro d'Italia: una
     SITAC si apre quasi sempre su un incendio del proprio territorio.
     `window.FireOpsComandoAttivo` è lo stesso globale condiviso che usano
     script.js e convertitore.js; l'evento più sotto copre il cambio di
     Comando a modulo già avviato. */
  /* I campi di comandi.json hanno l'iniziale maiuscola e tipi non uniformi:
     Latitudine è un numero, Longitudine una stringa con lo zero davanti
     ("012.061362"). Si cerca per forma invece che per nome esatto, e si
     passa sempre da String prima di parseFloat.
     Il ripiego su "Coordinate" copre le righe dove le due colonne separate
     sono vuote: quella c'è sempre. */
  function centroComando(){
    const c = window.FireOpsComandoAttivo;
    if (!c) return null;
    const num = v => parseFloat(String(v == null ? '' : v).trim().replace(',', '.'));
    const perNome = re => {
      const k = Object.keys(c).find(x => re.test(x));
      return k ? num(c[k]) : NaN;
    };
    let la = perNome(/^lat/i), lo = perNome(/^(lon|lng)/i);
    if (isNaN(la) || isNaN(lo)){
      const p = String(c.Coordinate || '').split(/[;\s]*,[;\s]*/);
      if (p.length >= 2){ la = num(p[0]); lo = num(p[1]); }
    }
    return (!isNaN(la) && !isNaN(lo)) ? [la, lo] : null;
  }

  const partenza = centroComando();
  const map = L.map(q('#sitac-mappa'), {center: partenza || [42.74, 12.74],
    zoom: partenza ? 12 : 6, zoomControl:true, layers:[sfondi[0].l]});
        L.control.scale({imperial:false, maxWidth:220, position:'bottomright'}).addTo(map);

    /* Gli agganci della misura vivono qui e non accanto alle sue funzioni:
       `map` esiste solo da questa riga in poi. */
    map.on('pm:drawstart', e => {
      clicPassante(true); 
      if (e.shape !== 'Line' && e.shape !== 'Polygon') return;
      misuraPoligono = e.shape === 'Polygon';
      misuraPunti = [];
      if (!misuraBox){
        misuraBox = document.createElement('div');
        misuraBox.className = 'sitac-misura';
        misuraBox.hidden = true;
        const wrap = q('.sitac-mapwrap');
        if (wrap) wrap.appendChild(misuraBox);
      }
      /* I vertici li annuncia il layer provvisorio, non la mappa. */
      /* Pendenza e vento sono un SEGMENTO: origine e punta, niente altro.
         Una spezzata a cinque vertici con una freccia in fondo non dice da
         dove a dove, e in export porterebbe una lunghezza che nessuno ha
         misurato. Geoman non sa limitare i vertici, quindi si chiude la
         forma appena il secondo è posato. Il setTimeout lascia finire il
         giro di eventi in corso: chiudere dentro pm:vertexadded significa
         far arrivare pm:create mentre Geoman sta ancora aggiornando. */
      /* Due vertici e basta anche per i tracciati che vogliono un lato:
         il lato si sceglie DOPO aver chiuso la linea, e con la linea
         ancora aperta si finiva per posare vertici in attesa di un doppio
         clic che nessuno aveva detto di fare. Al secondo punto si chiude e
         parte subito "Scegli il lato". */
      const defL = strumento && strumento.genere === 'linea' && LIN[strumento.chiave];
      const soloDue = !!(defL && (defL.punti2 || defL.lato));
      e.workingLayer.on('pm:vertexadded', ev => {
        misuraPunti.push(ev.latlng);
        if (soloDue && misuraPunti.length >= 2) setTimeout(chiudiFormaAperta, 0);
      });
    });
      map.on('mousemove', e => {
      misuraMostra(e.latlng, e.containerPoint);
      suggSegui(e.containerPoint);
    });
    map.on('pm:drawend', () => { clicPassante(false); misuraSpegni(); });

  const disegni = L.featureGroup().addTo(map);   // esportabile
  const decori  = L.layerGroup().addTo(map);     // motivi, maniglie, coni: mai esportati
  map.pm.setGlobalOptions({layerGroup: disegni, snappable:true, snapDistance:15,
    templineStyle:{color:COL.rosso}, hintlineStyle:{color:COL.rosso, dashArray:'5,5'}});

  /* All'apertura si va sulla posizione reale: una SITAC si disegna dove si
     sta operando. Se il GPS non risponde resta il centro del Comando, che
     arriva dall'evento condiviso, o l'Italia centrale. */
  let posizioneOttenuta = false;
  let cerchioPosizione = null;

    /* `setView:true` di Leaflet fa un fitBounds sul cerchio di accuratezza, e
     su un contenitore ancora nascosto — la scheda 2 nasce display:none —
     getBoundsZoom misura zero pixel e risponde zoom 0, il mondo intero.
     La vista la si imposta a mano, con uno zoom scelto da noi. */
  function centraSuGps(annuncia){
    if (annuncia) stato(t('localizzo'));
    map.locate({setView:false, enableHighAccuracy:true});
  }
  map.on('locationfound', e => {
    posizioneOttenuta = true;
    if (cerchioPosizione) decori.removeLayer(cerchioPosizione);
    cerchioPosizione = L.circleMarker(e.latlng, {radius:7, color:'#fff', weight:2,
      fillColor:'#0070c0', fillOpacity:1, interactive:false}).addTo(decori);
    /* Non si sposta la vista se c'è già qualcosa disegnato: il GPS può
       rispondere con dieci secondi di ritardo, e strappare la carta sotto
       le mani è peggio di una vista imprecisa. */
    if (!disegni.getLayers().length) map.setView(e.latlng, 15);
      /* Il GPS risponde con secondi di ritardo, a interfaccia già disegnata:
       senza questo il pulsante resta sull'etichetta di quando la posizione
       non c'era, e la scorciatoia da un clic non la vede nessuno. */
    mostraBlocco();
  });

  map.on('locationerror', () => {
    if (posizioneOttenuta) stato(t('posErrore'));
    tornaAlComando();
  });

  /* Ripiego: usato quando il GPS non risponde, o quando il Comando viene
     scelto dopo l'avvio del modulo. Non tocca nulla se l'utente ha già
     disegnato — spostargli la vista sotto le mani è peggio di una vista
     imprecisa. */
  function tornaAlComando(){
    const c = centroComando();
    if (c && !posizioneOttenuta && !disegni.getLayers().length)
      map.setView(c, 12);
  }

  /* =======================================================================
     4. MOTIVI RIPETUTI LUNGO LE LINEE
     Metà della tavola sono tracciati con un simbolo ripetuto: i triangoli
     della difesa in linea, i rombi della linea di sicurezza, la scaletta
     del fronte. PolylineDecorator li ripete e li orienta lungo il percorso.
     ===================================================================== */

  /* I disegni dei motivi stanno in sitac-simboli.js insieme al resto della
     tavola: lì c'è la convenzione (la linea attraversa il glifo in verticale,
     il verso di percorrenza è in alto, il centro dell'icona sta sul tracciato
     ed è il centro di rotazione), e lì si aggiungono i motivi nuovi senza
     toccare questo file. Qui resta solo la scelta di DOVE posarli. */
  function motivo(def, dc, stato, lato, giro){
    if (!dc) return null;
    /* `sempre` sono i motivi che NON cambiano faccia con lo stato: la punta
       di un asse di sviluppo è piena sempre — lo stato dell'asse non
       esiste — e quella dell'accensione per linee va piena comunque, perché
       è già il tracciato tratteggiato a dire che l'azione è prevista. */
    const pieno = dc.sempre ? !!dc.pieno
      : (dc.pieno && !(def.stati && stato === 'previsto'));
    const col = dc.col || def.bordo || def.color || COL.rosso;

    /* Tutto passa dal glifo, punte comprese. `L.Symbol.arrowHead` ancorava
       il triangolo per l'apice e non offriva alternative: il tratto arrivava
       fin sulla punta e sporgeva oltre. Il glifo lo ancora per il baricentro
       e il vertice finale resta coperto dalla figura. */
    const g = NS.SITAC_DECO(dc.tipo,
      {col, pieno, n: dc.n, forma: dc.forma, dim: dc.dim, testo: dc.testo,
       aperta: dc.aperta, incl: dc.incl, lato, giro});

    /* `passo:'auto'` sono i motivi che si toccano fra loro — i triangoli
       della difesa in linea, la greca della ricognizione, i denti del fronte:
       il passo è l'ingombro del glifo lungo la linea, e lo sa il glifo. */
    const unaSola = dc.tipo === 'punta' || dc.tipo === 'fine';
    const passo = unaSola ? 0
      : dc.passo === 'auto' ? g.h : dc.passo;
    const offset = dc.offset != null ? dc.offset
      : unaSola ? '100%'
      : dc.tipo === 'freccia' ? '12%'
      : (NS.SITAC_DECO_CONTIGUI.indexOf(dc.tipo) >= 0 ? 0 : 8);

    return {offset, repeat: passo,
      symbol: L.Symbol.marker({rotate: !dc.dritto,
        markerOptions:{interactive:false,
          icon: L.divIcon({
            className: 'sitac-deco' + (dc.classe ? ' ' + dc.classe : ''),
            iconSize:[g.w, g.h],
            /* `g.fuori` sposta il glifo di traverso al tracciato spostando
               l'ancora: il disegno resta dentro il proprio riquadro — una
               traslazione interna lo taglierebbe — e a muoversi è il punto
               che va a finire sulla linea. */
            iconAnchor:[g.w / 2 + (g.fuori || 0), g.h / 2],
            html: NS.SITAC_DECO_SVG(g)})}})};
  }

    /* Da che parte del tracciato sta il punto cliccato. Si misura in pixel
     schermo e non in gradi: alle nostre latitudini un grado di longitudine
     è mezzo grado di latitudine, e il prodotto vettoriale su lat/lng
     darebbe il lato sbagliato sulle linee quasi diagonali.
     y cresce verso il basso, quindi il prodotto positivo è la destra del
     verso di percorrenza — lo stesso +1 con cui il glifo si disegna. */
  function latoDi(layer, p){
    const v = layer.getLatLngs && layer.getLatLngs();
    if (!v || v.length < 2) return 1;
    const a = map.latLngToContainerPoint(v[0]);
    const b = map.latLngToContainerPoint(v[v.length - 1]);
    const c = map.latLngToContainerPoint(p);
    return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) >= 0 ? 1 : -1;
  }

    /* Riquadro dell'istruzione "scegli il lato": vive vicino al quadro del
     vento, non nella barra di stato in fondo. Niente pulsanti — la conferma
     è il clic sulla mappa, un OK qui sarebbe un secondo gesto per una cosa
     già decisa col primo. */
  function avvisoLato(msg){
    let box = q('#sitac-avviso-lato');
    if (!box){
      box = document.createElement('div');
      box.id = 'sitac-avviso-lato';
      box.className = 'sitac-avviso-lato';
      const wrap = q('.sitac-mapwrap');
      if (wrap) wrap.appendChild(box);
    }
    box.textContent = msg;
    box.hidden = false;
    return box;
  }
  function nascondiAvvisoLato(){
    const box = q('#sitac-avviso-lato');
    if (box) box.hidden = true;
  }

  /* Il lato si chiede DOPO aver chiuso la linea: prima non c'è ancora un
     tracciato rispetto a cui stare da una parte. Annullando resta il lato
     predefinito, che è meglio di un tracciato senza frecce. */
  async function chiediLato(layer){
    const def = LIN[layer._tipo];
    if (!def || !def.lato) return;
    if (layer._lato == null) layer._lato = 1;
    const prima = layer._lato;
    decora(layer);
    fermaTutto(); spegniPulsanti(); stato(''); cursore('mirino'); clicPassante(true);
    avvisoLato(t('scegliLato'));
    /* Le frecce si spostano da una parte all'altra mentre si muove il
       puntatore: il lato si SCEGLIE guardandolo, non si indovina cliccando.
       Si ridecora solo quando il lato cambia davvero — `decora` ricostruisce
       il decoratore da zero, e rifarlo a ogni pixel di movimento vuol dire
       sessanta ricostruzioni al secondo per un dato che cambia due o tre
       volte in tutto. */
    const anteprima = e => {
      const l = latoDi(layer, e.latlng);
      if (l === layer._lato) return;
      layer._lato = l;
      decora(layer);
    };
    map.on('mousemove', anteprima);
    /* Non passa da attendiClic: quello accende il fumetto agganciato al
       puntatore, giusto per i passi del cono ma non qui — il lato lo si
       decide guardando il tracciato, e il messaggio deve stare fermo
       accanto al riquadro del vento. */
    const p = await new Promise(risolvi => { attesaClic = risolvi; });
    map.off('mousemove', anteprima);
    nascondiAvvisoLato();
    /* Annullando con Esc si torna al lato di partenza: l'anteprima l'ha
       riscritto a ogni movimento, e restare sull'ultimo sfiorato sarebbe
       una scelta che nessuno ha fatto. */
    layer._lato = p ? latoDi(layer, p) : prima;
    decora(layer);
    aggiornaStato();
    fermaTutto(); spegniPulsanti();
    stato(t('latoScelto'));
  }

  /* Alcuni motivi stanno da una parte sola del tracciato, e quale sia non è
     una scelta operativa — è solo dove stanno più comodi. Si sceglie fra le
     due perpendicolari quella che punta più vicino a un quadrante fissato:
     nordovest per il quadro della bonifica, perché su una carta orientata a
     nord è il lato che resta più libero dalle etichette di OSM; sudest per i
     seggiolini, così non finiscono addosso ai bolli quando una funivia corre
     accanto a una linea di bonifica.
     In entrambi i casi il vantaggio è la costanza: motivi tutti dalla stessa
     parte si leggono come una fila, alternati sui due lati come rumore. */
  const distAng = (a, b) => { const d = Math.abs((a - b) % 360); return d > 180 ? 360 - d : d; };
  function bearingLinea(l){
    const v = l.getLatLngs && l.getLatLngs();
    if (!v || v.length < 2) return 0;
    return azimut(v[0], v[v.length - 1]);
  }
  const latoVerso = (b, meta) =>
    distAng(b + 90, meta) <= distAng(b - 90, meta) ? 1 : -1;

  function decora(layer){
    if (layer._deco){ decori.removeLayer(layer._deco); layer._deco = null; }
    if (layer._guaina){ decori.removeLayer(layer._guaina); layer._guaina = null; }
    const def = LIN[layer._tipo];
    if (!def) return;
    /* La guaina è la seconda linea sotto, più larga, che fa da contorno: è
       il solo modo di ottenere una freccia vuota bordata, perché una
       polilinea ha un colore e basta. `bringToBack` la manda dietro al
       tracciato bianco — i tile stanno in un altro pannello e non c'entrano. */
    if (def.guaina){
      layer._guaina = L.polyline(layer.getLatLngs(),
        Object.assign({interactive:false, pmIgnore:true,
          color: def.bordo || COL.rosso,
          weight: (def.weight || 3) + 4,
          lineCap: def.lineCap || 'round',
          dashArray: (def.stati && !def.vuota && layer._stato === 'previsto')
            ? '9,7' : (def.dashArray || null)},
          def.guaina)).addTo(decori);
      layer._guaina.bringToBack();
    }
    const patterns = [];
    /* Un tracciato può portare più motivi: la pendenza ha la punta a un capo
       e le codine all'altro, la bonifica la punta e il quadro con la B. Con
       un motivo solo le codine finivano appiccicate alla freccia e il
       simbolo diventava un grumo. */
    [].concat(def.deco || []).forEach(dc => {
      let lt = layer._lato, gi = 0;
      /* `nord` decide il lato da sé invece di chiederlo: non è una scelta
         operativa come il fianco d'attacco, è solo dove sta più comodo il
         bollo. L'azimut è quello fra primo e ultimo vertice — su un
         tracciato molto curvo la controrotazione della lettera è esatta
         solo in media, ma una bonifica si traccia quasi sempre dritta. */
      /* `verso` decide il lato da sé invece di chiederlo, a differenza del
         fianco d'attacco che è un dato operativo. L'azimut è quello fra
         primo e ultimo vertice: su un tracciato molto curvo la scelta è
         esatta solo in media, ma né una bonifica né una campata di funivia
         si tracciano a serpentina. */
      if (dc.verso != null){
        const b = bearingLinea(layer);
        lt = latoVerso(b, dc.verso);
        gi = -b;
      }
      const m = motivo(def, dc, layer._stato, lt, gi);
      if (m) patterns.push(m);
    });
    /* Il badge sta ai DUE capi. In una sola posizione lo si trovava solo
       imboccando la strada dal lato giusto, e da che mezzi è percorribile è
       la prima cosa che si guarda arrivando — da qualunque parte si arrivi. */
    if (def.badge){
      const bollo = () => L.Symbol.marker({rotate:false,
        markerOptions:{interactive:false, icon: L.divIcon({
          className: 'sitac-badge' + (def.badgeQuadro ? ' sitac-badge-q' : ''),
          html: esc(def.badge), iconSize:[26,18], iconAnchor:[13,9]})}});
      patterns.push({offset:0,      repeat:0, symbol: bollo()});
      patterns.push({offset:'100%', repeat:0, symbol: bollo()});
    }
    if (!patterns.length) return;
    layer._deco = L.polylineDecorator(layer, {patterns});
    decori.addLayer(layer._deco);
  }

  function scollega(layer){
    if (!layer) return;
    if (layer._deco){ decori.removeLayer(layer._deco); layer._deco = null; }
    if (layer._guaina){ decori.removeLayer(layer._guaina); layer._guaina = null; }
    if (layer._maniglia){ decori.removeLayer(layer._maniglia); layer._maniglia = null; }
    if (layer._asta){ decori.removeLayer(layer._asta); layer._asta = null; }
    if (layer._astaDeco){ decori.removeLayer(layer._astaDeco); layer._astaDeco = null; }
    if (layer._gruppo){ decori.removeLayer(layer._gruppo); layer._gruppo = null; }
    scollegaLancio(layer);
  }
  map.on('pm:remove', e => { scollega(e.layer); aggiornaStato(); });

  /* =======================================================================
     5. DIREZIONE: SECONDO PUNTO E MANIGLIA
     Digitare un azimut davanti a una carta non lo fa nessuno. Si clicca
     dove punta, e la maniglia resta lì da trascinare.
     ===================================================================== */
  const R_TERRA = 6378137;
  const rad = x => x * Math.PI / 180;
  const gra = x => x * 180 / Math.PI;

  function azimut(a, b){
    const dLon = rad(b.lng - a.lng);
    const y = Math.sin(dLon) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat))
            - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
    return (gra(Math.atan2(y, x)) + 360) % 360;
  }
  function puntoDaAzimut(c, gradi, metri){
    const d = metri / R_TERRA, br = rad(gradi), la = rad(c.lat), lo = rad(c.lng);
    const lat2 = Math.asin(Math.sin(la)*Math.cos(d) + Math.cos(la)*Math.sin(d)*Math.cos(br));
    const lon2 = lo + Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(la),
      Math.cos(d) - Math.sin(la)*Math.sin(lat2));
    return L.latLng(gra(lat2), gra(lon2));
  }
  /* La maniglia sta sempre a un dito di distanza sullo schermo, non a una
     distanza fissa sul terreno: a zoom 10 sarebbe sotto il simbolo. */
  function distanzaManiglia(){
    const c = map.getCenter();
    const a = map.latLngToContainerPoint(c);
    const b = map.containerPointToLatLng(L.point(a.x + 70, a.y));
    return Math.max(c.distanceTo(b), 30);
  }

  function creaManiglia(layer){
    if (layer._maniglia){ decori.removeLayer(layer._maniglia); }
    if (layer._asta){ decori.removeLayer(layer._asta); }
    /* Asta e decorazioni in un gruppo proprio, come la freccia del DOS:
       `creaManiglia` viene richiamata più volte sullo stesso layer — alla
       posa, al clic che ferma la direzione, dal menu — e ogni volta
       sovrascriveva `_astaDeco` senza buttare il precedente, lasciando in
       carta due marcatori per chiamata. Un gruppo si svuota tutto insieme
       e non lascia orfani per definizione. */
    if (!layer._gruppo) layer._gruppo = L.layerGroup().addTo(decori);
    layer._gruppo.clearLayers();
    layer._astaDeco = null;
    const c = layer.getLatLng();
    const tp = layer._tipo === 'tp';
    /* Pendenza e vento non hanno un'asta di servizio: il tracciato fra
       origine e maniglia È il simbolo. Disegnarlo come polilinea invece che
       come icona è quello che gli permette di allungarsi fino a dove si
       clicca — un divIcon ha una misura fissa e non si stira. */
    const senzAsta = /^(pend_|vento_)/.test(layer._tipo || '');
    /* Una pendenza ha un'estensione sul terreno: quel versante è ripido da
       lì a lì, e la freccia lo dice. Il vento no — non ha una lunghezza, e
       lasciarla tirare metterebbe nel file un numero che non significa
       niente ma che qualcuno prima o poi leggerà come se significasse. */
    const allungabile = !!(SIM[layer._tipo] && SIM[layer._tipo].lungo);
    /* `_lung` è la lunghezza in METRI, non in pixel: è un dato del terreno
       come la direzione, e a zoom diverso deve restare la stessa. */
    const p = puntoDaAzimut(c, layer._rotazione || 0,
      (allungabile && layer._lung) || distanzaManiglia());
    if (senzAsta){
      const rc = (NS.SITAC_CODINE || {})[layer._tipo] || {forma:'T', n:1};
      /* L'asta È il simbolo, quindi deve rispondere come un simbolo: il
         punto d'origine è invisibile e largo 22px, e cercarlo per aprire il
         menu su una freccia lunga mezzo schermo non lo fa nessuno.
         `weight` sottile per il disegno, `pmIgnore` perché Geoman non deve
         metterci vertici: la geometria la comanda la maniglia. */
      layer._asta = L.polyline([c, p],
        {color: COL.nero, weight: 2.8, pmIgnore: true,
         bubblingMouseEvents: false}).addTo(layer._gruppo);
      layer._asta.on('click', () => {
        if (attesaClic || attesaDirezione || attesaElemento) return;
        selezionaElemento(layer);
      });
      layer._asta.on('contextmenu', ev => {
        if (ev.originalEvent){
          L.DomEvent.preventDefault(ev.originalEvent);
          L.DomEvent.stopPropagation(ev.originalEvent);
        }
        if (attesaClic || attesaDirezione || attesaElemento) return;
        selezionaElemento(layer);
        apriMenu(ev.containerPoint, vociMenu(layer));
      });
      const finto = {color: COL.nero};
      layer._astaDeco = L.polylineDecorator(layer._asta, {patterns: [
        motivo(finto, {tipo:'punta', dim:20, pieno:1, passo:0, offset:'100%'}, 'attivo', 1),
        motivo(finto, {tipo:'codine', forma:rc.forma, n:rc.n, dim:20,
                       passo:0, offset:0}, 'attivo', 1)
      ]}).addTo(layer._gruppo);
    } else {
      /* Il TP sta SU una linea di transito: la strada attraversa il simbolo
         ed esce da entrambi i lati. */
      const coda = tp ? puntoDaAzimut(c, (layer._rotazione || 0) + 180,
        distanzaManiglia() * 0.55) : c;
      layer._asta = L.polyline([coda, p], tp
        ? {color:COL.rosso, weight:3.4, interactive:false}
        : {color:'#0070c0', weight:2.5, dashArray:'6,5', interactive:false}).addTo(layer._gruppo);
      if (tp) layer._asta.bringToBack();
    }
    /* PolylineDecorator riposiziona i marcatori ma non sempre butta quelli
       vecchi: dopo qualche movimento restano in carta le punte e le codine
       di tutte le direzioni provate. Si distrugge e si rifà il decoratore —
       l'unico modo sicuro — invece di chiamare setPaths. */
    const rifaiDeco = () => {
      if (!senzAsta) return;
      if (layer._astaDeco) layer._gruppo.removeLayer(layer._astaDeco);
      const rc = (NS.SITAC_CODINE || {})[layer._tipo] || {forma:'T', n:1};
      const finto = {color: COL.nero};
      layer._astaDeco = L.polylineDecorator(layer._asta, {patterns: [
        motivo(finto, {tipo:'punta', dim:20, pieno:1, passo:0, offset:'100%'}, 'attivo', 1),
        motivo(finto, {tipo:'codine', forma:rc.forma, n:rc.n, dim:20,
                       passo:0, offset:0}, 'attivo', 1)
      ]}).addTo(layer._gruppo);
    };
    layer._rifaiDeco = rifaiDeco;

    const puntaSvg = g => `<svg viewBox="0 0 26 26" style="transform:rotate(${g}deg)">`
      + `<path d="M13 2l9 22-9-6-9 6Z" fill="${COL.rosso}"/></svg>`;
    layer._maniglia = L.marker(p, {draggable:true, keyboard:false,
      icon: tp
        ? L.divIcon({className:'sitac-maniglia sitac-mn-tp',
            iconSize:[26,26], iconAnchor:[13,13],
            html: puntaSvg(layer._rotazione || 0)})
        : senzAsta
        /* Sulla punta della freccia non serve un pallino: la freccia c'è
           già. Resta un'area afferrabile, invisibile. */
        ? L.divIcon({className:'sitac-maniglia sitac-mn-dir',
            iconSize:[24,24], iconAnchor:[12,12], html:''})
        : L.divIcon({className:'sitac-maniglia', iconSize:[18,18],
            iconAnchor:[9,9], html:'<span></span>'})}).addTo(layer._gruppo);
        layer._maniglia.on('drag', () => {
      const m = layer._maniglia.getLatLng(), o = layer.getLatLng();
      layer._rotazione = Math.round(azimut(o, m));
      if (senzAsta){
        if (allungabile) layer._lung = Math.round(o.distanceTo(m));
        layer._asta.setLatLngs([o, m]);
        rifaiDeco();
      } else {
        layer.setIcon(iconaSimbolo(layer._tipo, {stato:layer._stato,
          testo:layer._testo, rotazione:layer._rotazione}));
        if (layer._asta) layer._asta.setLatLngs(tp
          ? [puntoDaAzimut(o, layer._rotazione + 180, distanzaManiglia() * 0.55), m]
          : [o, m]);
        const el = layer._maniglia.getElement();
        const svg = el && el.querySelector('svg');
        if (svg) svg.style.transform = `rotate(${layer._rotazione}deg)`;
      }
      etichettaElemento(layer);
    });

    /* Il simbolo si sposta, la maniglia lo segue mantenendo la direzione */
    layer.on('move', () => {
      if (!layer._maniglia) return;
      const o = layer.getLatLng();
      const np = puntoDaAzimut(o, layer._rotazione || 0,
        (allungabile && layer._lung) || distanzaManiglia());
      layer._maniglia.setLatLng(np);
      if (layer._asta) layer._asta.setLatLngs(senzAsta ? [o, np] : (tp
        ? [puntoDaAzimut(o, (layer._rotazione || 0) + 180, distanzaManiglia() * 0.55), np]
        : [o, np]));
      rifaiDeco();
    });
  }

  /* =======================================================================
     5ter. LANCI COME POLIGONI
     Il lancio è l'unico elemento della tavola che ha una dimensione vera
     sul terreno: qui il simbolo resta nella barra, ma sulla carta si
     disegna un'ellisse georeferenziata, orientabile e ridimensionabile.
     ===================================================================== */
  const PASSO_ELLISSE = 6;   // gradi fra due vertici: 60 per giro

  /* Ellisse per punti: `a` lungo l'asse di lancio, `b` di traverso. Il
     punto parametrico (a·cos t, b·sin t) si converte in azimut e distanza,
     così la forma resta corretta anche a latitudini alte. */
  function ellisse(centro, a, b, verso){
    const p = [];
    for (let g = 0; g < 360; g += PASSO_ELLISSE){
      const r = rad(g);
      const x = a * Math.cos(r), y = b * Math.sin(r);
      p.push(puntoDaAzimut(centro, verso + gra(Math.atan2(y, x)),
        Math.sqrt(x*x + y*y)));
    }
    return p;
  }

  /* Il ritardante è rosso e più coperto, l'acqua azzurra e leggera; il
     contorno tratteggiato dice "previsto", come nella tavola. */
  function stileLancio(k, stato){
    const rit = k.indexOf('ritardante') >= 0;
    const col = rit ? COL.rosso : COL.acqua;
    return {color: col, weight: 2.6, fillColor: col,
      fillOpacity: rit ? .35 : .18,
      dashArray: stato === 'attivo' ? null : '6,5'};
  }

  const ellisseDi = l => ellisse(l._centro, l._a, l._b, l._rotazione);

  function togliManiglieLancio(l){
    if (!l || !l._manig) return;
    l._manig.forEach(m => decori.removeLayer(m));
    l._manig = null;
  }
  function scollegaLancio(l){
    if (!l) return;
    if (l._glifo){ decori.removeLayer(l._glifo); l._glifo = null; }
    togliManiglieLancio(l);
  }

    /* Sotto i 40 px di asse lungo l'ellisse non si legge più: al suo posto
     il simbolo della tavola, a dimensione fissa come tutti gli altri.
     `_a` e `_b` NON si toccano — restano i metri veri, e l'export continua
     a portare l'ingombro reale invece di quello dello zoom corrente. */
  const LANCIO_MIN_PX = 40;

  function pxPerMetro(lat){
    const c = L.latLng(lat, 0);
    const a = map.latLngToLayerPoint(c);
    const b = map.latLngToLayerPoint(puntoDaAzimut(c, 90, 100));
    return Math.abs(b.x - a.x) / 100;
  }

  /* Il lancio si vede SEMPRE con l'ingombro vero, a qualunque zoom. La
     sostituzione col pittogramma a dimensione fissa faceva credere che il
     lancio coprisse quanto il simbolo: su una carta è esattamente il tipo
     di errore che non si scopre finché non serve. */
  function scalaLancio(l){
    if (l._glifo){ decori.removeLayer(l._glifo); l._glifo = null; }
    l.setStyle(stileLancio(l._tipo, l._stato));
  }
  const scalaLanci = () => disegni.eachLayer(l => {
    if (l._genere === 'lancio') scalaLancio(l);
  });
  map.on('zoomend', scalaLanci);

  function maniglieLancio(l){
    scollegaLancio(l);
    l._manig = [];
    const fai = (classe, dove, applica) => {
      const m = L.marker(dove(), {draggable:true, keyboard:false,
        icon: L.divIcon({className:'sitac-maniglia sitac-mn-' + classe,
          iconSize:[18,18], iconAnchor:[9,9], html:'<span></span>'})}).addTo(decori);
      m.on('drag', () => {
        applica(m.getLatLng());
        l.setLatLngs(ellisseDi(l));
        etichettaElemento(l);
      });
      /* A fine trascinamento le maniglie si rifanno: quella dell'asse ha
         spostato anche le altre, che altrimenti resterebbero indietro. */
      m.on('dragend', () => { maniglieLancio(l); aggiornaStato(); });
      l._manig.push(m);
    };
    /* Punta: direzione e lunghezza insieme — è il gesto con cui si dice
       "il lancio è andato di là, e arriva fin qui". */
    fai('asse', () => puntoDaAzimut(l._centro, l._rotazione, l._a), pt => {
      l._rotazione = Math.round(azimut(l._centro, pt));
      l._a = Math.max(15, Math.round(l._centro.distanceTo(pt)));
    });
    /* Fianco: solo la larghezza, l'asse non si tocca. */
    fai('largo', () => puntoDaAzimut(l._centro, l._rotazione + 90, l._b), pt => {
      l._b = Math.max(8, Math.round(l._centro.distanceTo(pt)));
    });
    fai('centro', () => l._centro, pt => { l._centro = pt; });
  }

  /* `pmIgnore` tiene Geoman fuori: in modalità modifica metterebbe un
     vertice trascinabile su ognuno dei sessanta punti dell'ellisse, e al
     primo strattone la forma non sarebbe più un'ellisse. L'eliminazione
     va quindi gestita a mano. */
  function creaLancio(k, centro, opz){
    const o = opz || {};
    const d = SIM[k].poly;
    const l = L.polygon([], Object.assign({pmIgnore:true, bubblingMouseEvents:false},
      stileLancio(k, o.stato || 'previsto')));
    l._tipo = k; l._genere = 'lancio'; l._stato = o.stato || 'previsto';
    l._centro = centro;
    l._a = o.a || d.a; l._b = o.b || d.b;
    l._rotazione = o.rotazione != null ? o.rotazione : 90;
    l.setLatLngs(ellisseDi(l));
    l.on('click', () => {
      if (map.pm.globalRemovalModeEnabled && map.pm.globalRemovalModeEnabled()){
        scollegaLancio(l);
        disegni.removeLayer(l);
        aggiornaStato();
      }
    });
    disegni.addLayer(l);
    etichettaElemento(l);
    scalaLancio(l);
    return l;
  }

  /* =======================================================================
     5bis. VENTO E CONI DI PROPAGAZIONE
     Si preme il pulsante del passo 4 e si risponde a tre domande: come si
     costruisce il cono, da dove viene la direzione del vento, quanto forte
     soffia. I coni NON sono rilievi ma stime, quindi stanno nei decori e
     non finiscono nel GeoJSON come geometrie: nel file viaggia il dato del
     vento, con l'ora in cui è stato letto, e da quello si ricostruiscono.
     ===================================================================== */
  let ventoCono = null;      // ultimo vento noto: quadro, export e stampa
  let attesaClic = null;
  let attesaLinea = null;

  /* Più coni sulla stessa carta: un incendio con due fronti attivi ne
     vuole due, e cancellare il precedente ogni volta impediva di
     confrontarli. Il vento è uno solo — lo rileva la stessa persona — ma
     ogni cono conserva il proprio, così una deroga locale è possibile. */
  const coni = [];
  let nCono = 0;

  function togliCono(id){
    const i = coni.findIndex(c => c.id === id);
    if (i < 0) return;
    if (selezionato === coni[i].layer) selezionaElemento(null);
    decori.removeLayer(coni[i].layer);
    coni.splice(i, 1);
    aggiornaStato();
  }
  function togliTuttiConi(){
    coni.forEach(c => decori.removeLayer(c.layer));
    coni.length = 0;
  }

  /* Attese: risolvono con null se qualcuno preme Esc o cambia strumento —
     fermaTutto() le chiude, così il percorso guidato non resta appeso. */
  /* Il suggerimento segue il puntatore: sul riquadro di stato, con lo
     sguardo sulla carta, non lo legge nessuno, e un modale da confermare
     mette un clic in mezzo a un gesto che ne vuole uno solo. Compare al
     primo movimento e sparisce al clic. */
  let suggBox = null;
  function suggMostra(testo){
    if (!suggBox){
      suggBox = document.createElement('div');
      suggBox.className = 'sitac-sugg';
      const wrap = q('.sitac-mapwrap');
      if (wrap) wrap.appendChild(suggBox);
    }
    suggBox.textContent = testo;
    suggBox.hidden = true;          // il primo mousemove lo accende
    suggBox._vivo = true;
  }
  function suggSegui(pt){
    if (!suggBox || !suggBox._vivo) return;
    suggBox.hidden = false;
    const w = suggBox.offsetWidth || 160;
    const dx = (pt.x + w + 26 > map.getSize().x) ? -(w + 16) : 16;
    suggBox.style.left = (pt.x + dx) + 'px';
    suggBox.style.top  = (pt.y + 18) + 'px';
  }
  function suggSpegni(){
    if (!suggBox) return;
    suggBox._vivo = false;
    suggBox.hidden = true;
  }

  function attendiClic(msg){
    fermaTutto(); spegniPulsanti(); stato(msg); cursore('mirino'); clicPassante(true);
    suggMostra(msg);
    return new Promise(risolvi => { attesaClic = risolvi; });
  }
  function attendiLinea(msg){
    fermaTutto(); spegniPulsanti(); stato(msg); cursore('mirino');
    return new Promise(risolvi => {
      attesaLinea = risolvi;
      map.pm.enableDraw('Line', {pathOptions:{color:COL.rosso, weight:3.5},
        continueDrawing:false});
    });
  }
  map.on('click', e => {
    if (!attesaClic) return;
    const f = attesaClic; attesaClic = null;
    clicPassante(false); cursore(null); suggSpegni();
    f(e.latlng);
  });

  const origineSullaCarta = () => {
    let m = null;
    disegni.eachLayer(x => { if (x._tipo === 'origine' && x.getLatLng) m = x; });
    return m;
  };

  /* Basi possibili per il cono: i poligoni che rappresentano fuoco — non
     le zone di gestione — e i fronti già tracciati. */
  const basiCono = () => disegni.getLayers().filter(x =>
    AREE_SUPERFICIE.indexOf(x._tipo) >= 0 || x._tipo === 'fronte');

  function evidenzia(lista, on){
    lista.forEach(l => {
      const el = l._path || (l.getElement && l.getElement());
      if (el && el.classList) el.classList.toggle('sitac-eleggibile', !!on);
    });
  }

  let attesaElemento = null;
  function attendiElemento(lista, msg){
    fermaTutto(); spegniPulsanti(); stato(msg);
    evidenzia(lista, true);
    return new Promise(risolvi => {
      attesaElemento = l => { evidenzia(lista, false); risolvi(l); };
    });
  }
    /* Il FeatureGroup inoltra i clic dei figli e mette il layer in e.layer:
     non serve agganciare un listener per elemento. */
  disegni.on('click', e => {
    if (attesaElemento){
      const f = attesaElemento; attesaElemento = null; f(e.layer);
      return;
    }
    /* In modalità elimina il clic lo consuma Geoman: selezionare qualcosa
       che sta per sparire non ha senso. */
    if (map.pm.globalRemovalModeEnabled && map.pm.globalRemovalModeEnabled()) return;
    selezionaElemento(e.layer);
  });

  /* SELEZIONE — Geoman offre solo la modalità "elimina a clic", che è
     un'altra cosa. Un elemento selezionato serve per Canc, per la × e per
     qualsiasi azione futura che agisca su uno solo.
     Un elemento può occupare più nodi nel DOM: un cono sono tre archi più
     le etichette. La selezione li marca tutti, o si illumina mezzo cono. */
  function nodiDi(l){
    if (!l) return [];
    if (l.eachLayer){
      const out = [];
      l.eachLayer(x => { out.push.apply(out, nodiDi(x)); });
      return out;
    }
    const el = l._path || (l.getElement && l.getElement());
    return el ? [el] : [];
  }

  /* La × sulla carta non c'è più: cancellare era un solo clic, e un solo clic
     su una carta piena di simboli è troppo poco per un gesto che non si
     annulla. L'eliminazione passa dal tasto destro, dove sopra la voce c'è
     scritto CHE COSA si sta per togliere e quanto misura. Il tasto Canc resta:
     lì la selezione l'ha già fatta chi preme. */
  let selezionato = null;
  function selezionaElemento(l){
    if (selezionato === l) return;
    nodiDi(selezionato).forEach(e => e.classList.remove('sitac-selezionato'));
    /* Le maniglie del lancio vivono con la selezione: sempre accese sarebbero
       tre pallini trascinabili per ogni lancio, e in modalità disegno le
       intercetta Geoman. */
    if (selezionato && selezionato._genere === 'lancio') togliManiglieLancio(selezionato);
    selezionato = l || null;
    nodiDi(selezionato).forEach(e => e.classList.add('sitac-selezionato'));
    if (selezionato && selezionato._genere === 'lancio' && !selezionato._glifo)
      maniglieLancio(selezionato);
  }

  /* getBounds esiste su FeatureGroup, non su LayerGroup: i coni arrivano da
     L.layerGroup e vanno misurati sui figli. */
  function estremiDi(l){
    if (!l) return null;
    if (l.getBounds) return l.getBounds();
    if (l.getLatLng) return L.latLngBounds([l.getLatLng()]);
    if (!l.eachLayer) return null;
    let b = null;
    l.eachLayer(x => {
      const e = estremiDi(x);
      if (!e || !e.isValid()) return;
      b = b ? b.extend(e) : L.latLngBounds(e.getSouthWest(), e.getNorthEast());
    });
    return b;
  }

  function eliminaSelezionato(){
    if (!selezionato) return;
    const l = selezionato;
    selezionaElemento(null);
    /* Un cono vive nei decori, non in `disegni`: va tolto dal suo elenco,
       o resta nel riepilogo e nella stampa dopo essere sparito dalla carta. */
    if (l._cono != null) return togliCono(l._cono);
    /* Chi cancella un'area cancella la previsione che ne discende: un cono
       orfano indica un fronte che non c'è più, ed è peggio di nessun cono.
       Il contrario no — togliere la previsione non tocca il rilievo. */
    coniDi(l).forEach(c => togliCono(c.id));
    scollega(l);              // motivi, maniglie, asta, maniglie del lancio
    disegni.removeLayer(l);
    aggiornaStato();
}
  /* Clic sul vuoto: si deseleziona. I clic sugli elementi non arrivano
     qui — Leaflet li ferma sul layer. */
  map.on('click', () => {
    if (!attesaClic && !attesaDirezione && !attesaElemento) selezionaElemento(null);
  });

  /* Il vento non è un simbolo posato sulla carta ma un quadro fisso in alto
     a sinistra, col nord accanto: sulla mappa finiva sotto agli altri
     elementi e si spostava con loro, mentre è un dato dell'intero
     scenario, non di un punto. */
  function mostraVento(vento){
    ventoCono = vento || null;
    const box = q('#sitac-vento');
    if (!box) return;
    if (!vento){ box.hidden = true; box.innerHTML = ''; return; }
    const V = NS.SitacVento;
    const k = V.simboloVento(vento.velocita);
    /* Sulla tavola il vento è diventato un tracciato, ma qui non c'è nulla da
       tracciare: è un dato di scenario in un riquadro fisso. Il glifo puntuale
       resta disponibile in SITAC_GLIFI apposta per questo. Il disegno punta a
       ovest, quindi 270 è la sua direzione naturale. */
    const glifo = (NS.SITAC_GLIFI || {})[k];
    box.hidden = false;
    box.innerHTML =
      `<span class="sitac-vento-nord"><svg viewBox="0 0 24 24">`
      + `<path d="M12 2l5 11h-10Z" fill="#cc0000"/>`
      + `<path d="M12 22l-5-9h10Z" fill="#888"/></svg><b>N</b></span>`
      + `<span class="sitac-vento-glifo" style="transform:rotate(`
      + `${((vento.verso - 270) % 360 + 360) % 360}deg)">`
      + `${glifo ? glifo({senzaTesto:1}) : ''}</span>`
      + `<span class="sitac-vento-dati">${esc(String(vento.velocita))} km/h<br>`
      + `${esc(String(vento.verso))}\u00b0</span>`;
  }

  /* Il vento lo si imposta una volta sola, al passo 2: qui si riusa. La
     domanda si fa lo stesso, perché un secondo fronte può avere un vento
     locale diverso — ma la risposta preimpostata è quella già nota, e
     un'occhiata basta a confermarla. */
  async function scegliVento(punto){
    const V = NS.SitacVento;

    if (ventoCono){
      const scelta = await scegli({testo: t('ventoQuale'), voci:[
        {k:'noto', et: t('ventoRiusa', {v: ventoCono.velocita, d: ventoCono.verso}),
          nota: t('ventoRiusaNota', {f: ventoCono.fonte})},
        {k:'altro', et: t('ventoAltro'), nota: t('ventoAltroNota')}
      ]});
      if (!scelta) return null;
      /* Copia: il cono conserva il vento con cui è stato disegnato, e
         cambiare lo slider dopo non deve riscrivergli sotto i piedi. */
      if (scelta === 'noto') return Object.assign({}, ventoCono);
    }

    return chiediVentoDaCapo(punto);
  }

  /* Il percorso a tre domande di prima: resta per il vento locale di un
     singolo cono e per il caso in cui il passo 2 sia stato saltato. */
  async function chiediVentoDaCapo(punto){
    const V = NS.SitacVento;
    let letto = null;
    const daWeb = async () => {
      if (letto) return letto;
      stato(t('ventoLeggo'));
      letto = await V.leggi(punto.lat, punto.lng);
      return letto;
    };

    const bussolaOk = V.bussolaDisponibile();
    const modo = await scegli({testo: t('conoDirezione'), voci:[
      {k:'web',     et:t('dirWeb'),     nota:t('dirWebNota')},
      {k:'bussola', et:t('dirBussola'),
        nota: bussolaOk ? t('dirBussolaNota') : t('dirBussolaNo'), off: !bussolaOk},
      {k:'mappa',   et:t('dirMappa'),   nota:t('dirMappaNota')}
    ]});
    if (!modo) return null;

    let verso = null, fonte = '';
    if (modo === 'web'){
      const v = await daWeb();
      verso = v.verso; fonte = v.fonte;
    } else if (modo === 'bussola'){
      stato(t('bussolaLeggo'));
      verso = await V.leggiBussola();
      fonte = t('dirBussola');
    } else {
      const p = await attendiClic(t('conoClicVento'));
      if (!p) return null;
      verso = Math.round(azimut(punto, p));
      fonte = t('dirMappa');
    }

    const modoV = await scegli({testo: t('conoIntensita'), voci:[
      {k:'web',   et:t('intWeb'),   nota:t('intWebNota')},
      {k:'scala', et:t('intScala'), nota:t('intScalaNota')}
    ]});
    if (!modoV) return null;

    let velocita;
    if (modoV === 'web'){
      const v = await daWeb();
      velocita = V.arrotondaDecine(v.velocita);
      fonte = (modo === 'web') ? v.fonte : `${fonte} + ${v.fonte}`;
    } else {
      velocita = await scegliVelocita();
      if (!velocita) return null;
    }

    const v = V.ventoDa(velocita, verso, fonte);
    v.letto = new Date().toISOString();
    return v;
  }

  /* La scala è la colonna sinistra della tabella 1: dieci in dieci fino a
     110, raggruppata nelle tre intensità della tavola. Accanto a ogni voce
     quanto avanza il fuoco in un'ora, che è il numero che si cerca. */
  function scegliVelocita(){
    const V = NS.SitacVento;
    const voci = [];
    let banda = null;
    V.SCALA.forEach(v => {
      const b = V.simboloVento(v);
      if (b !== banda){ banda = b; voci.push({titolo: t(b)}); }
      voci.push({k:String(v), et: v + ' km/h',
        nota: t('conoAvanza', {m: Math.round(V.distanzaFronte(v, 60))})});
    });
    return scegli({testo: t('conoIntensita'), voci}).then(x => x ? Number(x) : null);
  }

  async function creaCono(){
    const V = NS.SitacVento;
    if (!V) return stato('sitac-vento.js non caricato.');
    const voci = [];
    const basi = basiCono().length;
    if (coni.length) voci.push({k:'via', et:t('conoVia'), nota:t('conoViaNota')});
    voci.push({k:'elemento', et:t('conoElemento'), nota:t('conoElementoNota'), off: !basi});
    voci.push({k:'settore', et:t('conoSettore'), nota:t('conoSettoreNota')});
    voci.push({k:'fronte',   et:t('conoFronte'),   nota:t('conoFronteNota')});
    voci.push({k:'pendenza', et:t('conoPendenza'), nota:t('conoPendenzaNota')});
    voci.push({k:'terzo',    et:t('conoTerzo'),    nota:t('conoStandby'), off:1});
    try {
      const modo = await scegli({testo: t('conoModo'), voci});
      if (!modo) return stato(t('conoAnnullato'));
      if (modo === 'via'){ togliTuttiConi(); aggiornaStato(); return stato(t('conoTolto')); }
      if (modo === 'elemento') await conoDaElemento();
      else if (modo === 'settore') await conoSettore();
      else if (modo === 'pendenza') await conoPendenza();
      else await conoFronte();
    } catch(e){
      stato(t('ventoErrore', {e: e.message}));
    }
  }

  /* Il cono è un gruppo di archi ed etichette, e L.LayerGroup non inoltra i
     clic dei figli come fa un FeatureGroup: si aggancia foglia per foglia.
     Gli archi nascono decorativi, quindi l'interattività va accesa qui —
     prima dell'addLayer, o Leaflet non mette la classe che serve. */
  function agganciaCono(gruppo, id){
    gruppo._cono = id;
    const bind = x => {
      if (x.eachLayer) return x.eachLayer(bind);
      x.options.interactive = true;
      x.on('click', () => {
        if (attesaClic || attesaDirezione || attesaElemento) return;
        if (map.pm.globalRemovalModeEnabled && map.pm.globalRemovalModeEnabled())
          return togliCono(id);
        selezionaElemento(gruppo);
      });
      x.on('contextmenu', ev => {
        if (ev.originalEvent){
          L.DomEvent.preventDefault(ev.originalEvent);
          L.DomEvent.stopPropagation(ev.originalEvent);
        }
        selezionaElemento(gruppo);
        apriMenu(ev.containerPoint, vociMenu(gruppo));
      });
    };
    bind(gruppo);
  }

  const coniDi = l => coni.filter(c => c.base === l);

  /* Il rilievo si legge attorno al FRONTE e nella direzione in cui il
     fuoco andrà: il terreno già percorso non conta più, il fuoco lo
     attraversa nel prossimo quarto d'ora.
     Stava dentro conoSettore, cioè nel modo che in sala si usa di meno:
     l'area percorsa la si disegna comunque, quindi i coni che partono da
     lì sono la maggioranza, e proprio quelli facevano avanzare il fronte
     col solo vento. Su un versante ripido sottostimano, ed è l'errore che
     non si scopre finché non serve. */
  async function fattoriPendenza(base, verso, velocita){
    if (!NS.SitacRilievo) return {fattori:null, errore:null};
    const V = NS.SitacVento;
    const dist = V.MINUTI.map(x => V.distanzaFronte(velocita, x));
    /* Con distanze nulle il profilo degenera: passo zero, dislivello
       diviso zero, e la pendenza esce a 90° tagliata al massimo. */
    if (!(Math.max.apply(null, dist) > 50)) return {fattori:null, errore:null};
    try {
      stato(t('rilLeggo'));
      const r = await NS.SitacRilievo.analizza(base, verso, dist);
      return {fattori: r.fattori, errore:null};
    } catch(e){ return {fattori:null, errore:e.message}; }
  }

  /* Il riepilogo scrive SOTTO quello che c'è già: aggiornaStato lo
     riscriverebbe sopra se lo si mettesse prima. */
  function riferisciRilievo(fattori, errore){
    if (fattori) stato($('stato').textContent + '\n' + t('rilFatto', {
      k: fattori.map(f => '\u00d7' + f.k.toFixed(1)).join(' \u00b7 ')}));
    else if (errore) stato($('stato').textContent + '\n' + t('rilErrore', {e: errore}));
  }

  /* Modo 1: vertice sul punto d'innesco, secondo clic per dire dove sta il
     fronte adesso. Gli archi partono da lì, non dal vertice. */
  async function conoSettore(){
    const V = NS.SitacVento;
    const m = origineSullaCarta();
    const origine = m ? m.getLatLng() : await attendiClic(t('conoClicOrigine'));
    if (!origine) return stato(t('conoAnnullato'));
    const p0 = await attendiClic(t('conoClicFronte'));
    if (!p0) return stato(t('conoAnnullato'));
    const r0 = Math.round(origine.distanceTo(p0));
    const vento = await scegliVento(origine);
    if (!vento) return stato(t('conoAnnullato'));

    /* Il rilievo si legge PRIMA di disegnare. Un cono che si allunga da
       solo mezzo secondo dopo è peggio di mezzo secondo d'attesa: chi
       guarda ha già cominciato a leggerlo.
       Il profilo parte da dove sta il fronte ADESSO, non dal punto
       d'innesco: il terreno già percorso non conta più, il fuoco lo
       attraversa nel prossimo quarto d'ora. */
    const ril = await fattoriPendenza(
      V.puntoDaAzimut(origine, vento.verso, r0), vento.verso, vento.velocita);
    const fattori = ril.fattori, rilErrore = ril.errore;

    const opz = {colore: COL.rosso, raggio0: r0, etichetta0: t('conoT0'), fattori};
    const layer = V.disegnaCono(origine, vento, opz);
    const id = ++nCono;
    agganciaCono(layer, id);
    decori.addLayer(layer);
    coni.push({id, layer, vento, fattori, tipo:'settore', base: m || null});

    /* Spostando l'area d'origine la previsione la segue col vento e i
       fattori di prima: il terreno sotto però è cambiato. Per rileggere
       la pendenza si rifà il percorso. */
    if (m){
      m.off('move.sitacCono').on('move.sitacCono', () => {
        const c = coni.find(x => x.id === id);
        if (!c) return;
        decori.removeLayer(c.layer);
        c.layer = V.disegnaCono(m.getLatLng(), vento, opz);
        decori.addLayer(c.layer);
      });
      m.on('pm:remove', () => togliCono(id));
    }
    riassunto(vento);
    riferisciRilievo(fattori, rilErrore);
  }

  /* Modo 2: si disegna il fronte com'è adesso e lo si fa avanzare nel
     tempo, allargandolo di 15° per parte. Serve quando l'incendio è già
     lungo e il punto d'innesco non dice più dove sta la fiamma. */
  async function conoFronte(){
    const V = NS.SitacVento;
    const punti = await attendiLinea(t('conoDisegnaFronte'));
    if (!punti || punti.length < 2) return stato(t('conoAnnullato'));
    const centro = punti[Math.floor(punti.length / 2)];
    const vento = await scegliVento(centro);
    if (!vento) return stato(t('conoAnnullato'));
    const ril = await fattoriPendenza(centro, vento.verso, vento.velocita);
    const layer = V.disegnaFronti(punti, vento,
      {colore: COL.rosso, etichetta0: t('conoT0'), fattori: ril.fattori});
    const id = ++nCono;
    agganciaCono(layer, id);
    decori.addLayer(layer);
    coni.push({id, layer, vento, fattori: ril.fattori, tipo:'fronte'});
    riassunto(vento);
    riferisciRilievo(ril.fattori, ril.errore);
  }

  function riassunto(vento){
    const V = NS.SitacVento;
    aggiornaStato();   // prima, altrimenti riscrive sopra il riepilogo
    stato(t('conoFatto', {v: vento.velocita, d: vento.verso, f: vento.fonte,
      a: V.APERTURA, m: Math.round(V.distanzaFronte(vento.velocita, 60))}));
  }
  let attesaDirezione = null;

  /* Il simbolo gira sotto il puntatore fino al secondo clic. Digitare un
     azimut non lo fa nessuno, ma nemmeno cliccare al buio: la direzione si
     sceglie GUARDANDOLA, come su una carta di carta si gira la matita
     prima di tirare la riga. */
  function anteprimaDirezione(e){
    const l = attesaDirezione;
    if (!l || !l.getLatLng) return;
    const o = l.getLatLng();
    const senzAsta = /^(pend_|vento_)/.test(l._tipo || '');
    /* Una pendenza ha un'estensione sul terreno: quel versante è ripido da
      lì a lì, e la freccia lo dice. Il vento no — non ha una lunghezza, e
      lasciarla tirare metterebbe nel file un numero che non significa
      niente ma che qualcuno prima o poi leggerà come se significasse. */
    const allungabile = !!(SIM[l._tipo] && SIM[l._tipo].lungo);
    l._rotazione = Math.round(azimut(o, e.latlng));
    /* Sulla pendenza il puntatore non dà solo la direzione ma anche la
       lunghezza: si tira la freccia fin dove serve, come una riga a mano. */
    if (allungabile) l._lung = Math.round(o.distanceTo(e.latlng));
    else if (!senzAsta) l.setIcon(iconaSimbolo(l._tipo, {stato:l._stato,
      testo:l._testo, rotazione:l._rotazione, paese:l._paese}));
    if (!l._maniglia) return;
    const np = puntoDaAzimut(o, l._rotazione,
      (allungabile && l._lung) || distanzaManiglia());
    l._maniglia.setLatLng(np);
    if (l._asta) l._asta.setLatLngs(senzAsta ? [o, np]
      : (l._tipo === 'tp'
          ? [puntoDaAzimut(o, l._rotazione + 180, distanzaManiglia() * 0.55), np]
          : [o, np]));
    if (l._rifaiDeco) l._rifaiDeco();
    const el = l._maniglia.getElement();
    const svg = el && el.querySelector('svg');
    if (svg) svg.style.transform = `rotate(${l._rotazione}deg)`;
  }

  function avviaDirezione(layer){
    attesaDirezione = layer;
    clicPassante(true);
    map.on('mousemove', anteprimaDirezione);
  }

  map.on('click', e => {
    if (!attesaDirezione) return;
    const layer = attesaDirezione;
    attesaDirezione = null;
    map.off('mousemove', anteprimaDirezione);
    clicPassante(false);
    layer._rotazione = Math.round(azimut(layer.getLatLng(), e.latlng));
    layer.setIcon(iconaSimbolo(layer._tipo, {stato:layer._stato,
      testo:layer._testo, rotazione:layer._rotazione}));
    creaManiglia(layer);
    etichettaElemento(layer);
    aggiornaStato();
    if (strumento) riattivaStrumento();
  });

  /* Modo 3: da un'area percorsa o da un fronte già sulla carta. È il caso
     più frequente in sala operativa — l'area la si disegna comunque. */
  async function conoDaElemento(){
    const V = NS.SitacVento;
    const lista = basiCono();
    if (!lista.length) return stato(t('conoNienteBase'));
    const l = lista.length === 1 ? lista[0]
      : await attendiElemento(lista, t('conoScegliBase'));
    if (!l) return stato(t('conoAnnullato'));
    const anello = AREE[l._tipo] ? l.getLatLngs()[0] : l.getLatLngs();
    if (!anello || anello.length < 2) return stato(t('conoBaseCorta'));
    const centro = anello[Math.floor(anello.length / 2)];

    /* Il vento si chiede PRIMA: senza direzione non si sa quale bordo del
       poligono è il fronte e quale è la coda. */
    const vento = await scegliVento(centro);
    if (!vento) return stato(t('conoAnnullato'));

    const punti = AREE[l._tipo] ? V.fronteSottovento(anello, vento.verso) : anello;
    if (punti.length < 2) return stato(t('conoBaseCorta'));

    /* Il profilo si legge dal centro del fronte sottovento, che è il bordo
       da cui il fuoco riparte — non dal centro dell'area, che sta dentro
       il terreno già bruciato. */
    const ril = await fattoriPendenza(
      punti[Math.floor(punti.length / 2)], vento.verso, vento.velocita);
    const layer = V.disegnaFronti(punti, vento,
      {colore: COL.rosso, etichetta0: t('conoT0'), fattori: ril.fattori});
    const id = ++nCono;
    agganciaCono(layer, id);
    decori.addLayer(layer);
    coni.push({id, layer, vento, fattori: ril.fattori, tipo:'elemento', base: l});
    riassunto(vento);
    riferisciRilievo(ril.fattori, ril.errore);
  }

    /* =====================================================================
     5bis-bis. MENU DEL TASTO DESTRO
     Il sinistro posa e basta: è il gesto con cui si disegna, e non deve mai
     aprire finestre. Quello che si fa DOPO su un elemento già posato —
     correggerlo, spostarlo, toglierlo — sta tutto sul destro, dove il
     puntatore è già sopra la cosa da cambiare.
     Mentre si disegna il menu non compare: pm:drawstart accende
     clicPassante, e gli elementi non intercettano più il puntatore.
     =================================================================== */
  let menuBox = null;
  let elModifica = null;      // elemento lasciato in modifica o trascinabile

  function creaMenuBox(){
    if (menuBox) return menuBox;
    menuBox = document.createElement('div');
    menuBox.className = 'sitac-menu';
    menuBox.hidden = true;
    const wrap = q('.sitac-mapwrap');
    if (wrap) wrap.appendChild(menuBox);
    return menuBox;
  }
  const menuAperto = () => !!(menuBox && !menuBox.hidden);
  function chiudiMenu(){ if (menuBox){ menuBox.hidden = true; menuBox.innerHTML = ''; } }

  function apriMenu(pt, voci){
    const m = creaMenuBox();
    m.innerHTML = '';
    voci.forEach(v => {
      /* Le misure stanno IN CIMA al menu e non in un tooltip: quando si apre
         il destro su un'area il puntatore è già lì, e "quanti ettari" è la
         domanda che si fa mentre si decide se tenerla o rifarla. */
      if (v.info){
        const p = document.createElement('p');
        p.className = 'sitac-menu-info';
        p.textContent = v.info;
        m.appendChild(p);
        return;
      }
      if (v.titolo){
        const h = document.createElement('p');
        h.className = 'sitac-menu-tit';
        h.textContent = v.titolo;
        m.appendChild(h);
        return;
      }
      const b = document.createElement('button');
      b.type = 'button';
      if (v.rosso) b.className = 'rosso';
      b.textContent = v.et;
      b.onclick = () => { chiudiMenu(); v.fai(); };
      m.appendChild(b);
    });
    m.hidden = false;
    /* Si misura DOPO averlo mostrato: nascosto ha altezza zero e si
       piazzerebbe sempre in basso. Vicino al bordo si ribalta, o una voce
       finisce fuori dal riquadro della mappa e non si clicca. */
    const s = map.getSize(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(s.x - w - 4, pt.x + 2)) + 'px';
    m.style.top  = Math.max(4, Math.min(s.y - h - 4, pt.y + 2)) + 'px';
  }

  /* Chiude la modifica aperta dal menu. fermaTutto() spegne le modalità
     GLOBALI di Geoman, non un layer acceso da solo: senza questo un
     poligono resta coi vertici trascinabili per sempre. */
  function fermaMenuModifica(){
    const l = elModifica;
    elModifica = null;
    if (!l || !l.pm) return;
    if (l.pm.disable) l.pm.disable();
    if (l.pm.layerDragEnabled && l.pm.layerDragEnabled()) l.pm.disableLayerDrag();
  }

  function modificaVertici(l){
    fermaTutto(); spegniPulsanti();
    if (!l.pm) return;
    l.pm.enable({allowSelfIntersection:false});
    elModifica = l;
    stato(t('menuVerticiOn'));
  }

  function spostaElemento(l){
    fermaTutto(); spegniPulsanti();
    if (l.getLatLng){                       // simboli: già draggable dalla posa
      if (l.dragging) l.dragging.enable();
      stato(t('menuSpostaPunto'));
      return;
    }
    if (!l.pm || !l.pm.enableLayerDrag) return;
    l.pm.enableLayerDrag();
    elModifica = l;
    /* Trascinando la geometria intera i motivi ripetuti e le misure
       restano dov'erano: si rifanno a fine trascinamento. Il flag evita di
       impilare un listener a ogni apertura del menu. */
    if (!l._aggancioDrag){
      l._aggancioDrag = 1;
      l.on('pm:dragend', () => { decora(l); etichettaElemento(l); aggiornaStato(); });
    }
    stato(t('menuSpostaArea'));
  }

  async function rinominaElemento(l, def){
    const idm = NS.SITAC_ID_MAX || 4;
    const val = await chiedi(
      def.libero ? {campo:1, testo: t('chiediNota'), valore: l._testo || ''}
      : def.lbl  ? {campo:1, testo: def.lbl, max: idm, valore: l._testo || '',
                    filtro: v => v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, idm)}
      :            {campo:1, testo: t('chiediSigla'), valore: l._testo || ''});
    if (val === null) return;
    l._testo = val || null;
    l.setIcon(iconaSimbolo(l._tipo, {stato:l._stato, testo:l._testo,
      rotazione:l._rotazione, paese:l._paese}));
    etichettaElemento(l);
  }

  function ridaiDirezione(l){
    fermaTutto(); spegniPulsanti();
    if (l._rotazione == null) l._rotazione = 90;
    if (!l._maniglia) creaManiglia(l);
    avviaDirezione(l);
    stato(`${nm(SIM[l._tipo])}\n${t('dirSegui')}`);
  }

    /* Su pendenza e vento l'intensità NON è un campo: è il simbolo stesso —
     pend_lieve, pend_moderata, pend_forte sono tre voci di tavola distinte.
     Cambiarla vuol dire scambiare il tipo tenendo tutto il resto, che è
     quello che si vuole davvero quando si corregge una stima a vista.
     Il simbolo si ricostruisce da capo perché il numero di codine sta nel
     glifo del decoratore, non in un attributo. */
  async function cambiaIntensita(l){
    const fam = /^pend_/.test(l._tipo) ? 'pend_' : 'vento_';
    const voci = Object.keys(SIM)
      .filter(k => k.indexOf(fam) === 0)
      .map(k => ({k, et: nm(SIM[k]) + (k === l._tipo ? ' \u2713' : '')}));
    const nuovo = await scegli({testo: t('conoIntensita'), voci});
    if (!nuovo || nuovo === l._tipo) return;
    l._tipo = nuovo;
    l.setIcon(iconaSimbolo(nuovo, {stato:l._stato, testo:l._testo,
      rotazione:l._rotazione}));
    creaManiglia(l);          // il decoratore rinasce col numero giusto di codine
    etichettaElemento(l);
    aggiornaStato();
  }

  /* Lo stato si scambia sul singolo elemento, non sulla tavola: quando una
     squadra prevista entra in azione si cambia quella, non tutte. */
  function scambiaStatoElemento(l){
    const k = l._tipo;
    l._stato = l._stato === 'attivo' ? 'previsto' : 'attivo';
    if (l._genere === 'lancio'){
      l.setStyle(stileLancio(k, l._stato));
      if (l._glifo) l._glifo.setIcon(iconaSimbolo(k, {stato: l._stato}));
    } else if (LIN[k]){
      l.setStyle(stileLinea(LIN[k], l._stato));
      decora(l);
    } else if (l.setIcon){
      l.setIcon(iconaSimbolo(k, {stato:l._stato, testo:l._testo,
        rotazione:l._rotazione, paese:l._paese}));
    }
    etichettaElemento(l);
    aggiornaStato();
  }

    /* Un punto ha coordinate, una linea una lunghezza, un'area superficie e
     perimetro: sono i tre numeri che si leggono su una carta, e ognuno vale
     per la sua geometria. Il lancio porta anche l'ingombro, che è il dato
     per cui esiste come poligono invece che come simbolo. */
  function misureDi(l){
    if (!l) return null;
    if (l._genere === 'lancio')
      return t('lancioDi', {a: l._a * 2, b: l._b * 2,
        s: (areaMq(l) / 10000).toFixed(2)});
    if (l.getLatLng){
      const p = l.getLatLng();
      return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    }
    const pt = l.getLatLngs && l.getLatLngs();
    if (!pt || !pt.length) return null;
    /* Un poligono restituisce un elenco di anelli, una linea un elenco di
       vertici: è il modo più diretto per distinguerli senza consultare AREE,
       che non copre i perimetri importati da fuori. */
    if (Array.isArray(pt[0]))
      return t('areaDi', {a: (areaMq(l) / 10000).toFixed(2),
        p: (perimetroM(l) / 1000).toFixed(2)});
    return t('lunghezzaDi', {v: (lunghezzaM(l) / 1000).toFixed(2)});
  }

  /* Le voci cambiano con l'elemento: un simbolo non ha vertici, una linea
     non ha una sigla, un cono non è un rilievo e si tocca solo per toglierlo. */
  function vociMenu(l){
    const voci = [];
    if (l._cono != null){
      voci.push({titolo: t('menuCono', {n: l._cono})});
      voci.push({et: t('menuElimina'), rosso:1, fai: () => togliCono(l._cono)});
      return voci;
    }
    const k = l._tipo;
    const def = LIN[k] || AREE[k] || SIM[k] || (k === 'nota' ? NOTA : null);
    voci.push({titolo: nm(def) || k || ''});
    const mis = misureDi(l);
    if (mis) voci.push({info: mis});

    if (l._genere === 'lancio'){
      voci.push({et: t('menuManiglie'),
        fai: () => { maniglieLancio(l); stato(t('lancioManiglie')); }});
    } else if (l.getLatLng){
      if (def && (def.libero || def.e))
        voci.push({et: t('menuTesto'), fai: () => rinominaElemento(l, def)});
      if (def && def.paese)
        voci.push({et: t('menuPaese'), fai: () => cambiaPaese(l)});
      if (def && def.r)
        voci.push({et: t('menuSposta'), fai: () => spostaElemento(l)});
      if (def && def.r)
        voci.push({et: t('menuDirezione'), fai: () => ridaiDirezione(l)});
      /* Solo pendenza e vento: sugli altri orientabili — TP, lanci —
         l'intensità non esiste come concetto. */
      if (/^(pend_|vento_)/.test(l._tipo || ''))
        voci.push({et: t('menuVentoInt'), fai: () => cambiaIntensita(l)});
    } else {
      voci.push({et: t('menuVertici'), fai: () => modificaVertici(l)});
      voci.push({et: t('menuSposta'),  fai: () => spostaElemento(l)});
      if (LIN[k] && LIN[k].lato)
        voci.push({et: t('menuLato'), fai: () => chiediLato(l)});
    }
    if (def && (def.s || def.stati))
      voci.push({et: t('menuStato',
        {s: t(paroleStato(def)[l._stato === 'attivo' ? 0 : 1])}),
        fai: () => scambiaStatoElemento(l)});
    voci.push({et: t('menuElimina'), rosso:1,
      fai: () => { selezionaElemento(l); eliminaSelezionato(); }});
    return voci;
  }

    /* Chiude da codice il disegno in corso, come farebbe il doppio clic.
     `_finishShape` è interno a Geoman ma è l'unica via: si prova prima il
     nome pubblico, dove esiste. */
  function chiudiFormaAperta(){
    const D = map.pm && map.pm.Draw;
    if (!D || !map.pm.globalDrawModeEnabled || !map.pm.globalDrawModeEnabled())
      return false;
    const forma = D.getActiveShape ? D.getActiveShape() : null;
    const h = forma && D[forma];
    const chiudi = h && (h.finishShape || h._finishShape);
    if (typeof chiudi !== 'function') return false;
    chiudi.call(h);
    return true;
  }

    /* Il destro durante il disegno CHIUDE quello che c'è: un'area con i
     vertici già posati diventa un poligono, una linea si ferma lì, uno
     strumento a punti si spegne. È lo stesso esito del doppio clic, ma col
     dito già sul tasto — e su una carta il gesto di "basta così" è uno solo,
     non due a seconda di cosa si sta disegnando. */
  function chiudeDisegnoInCorso(){
    const D = map.pm && map.pm.Draw;
    if (!D || !map.pm.globalDrawModeEnabled || !map.pm.globalDrawModeEnabled())
      return false;
    const forma = D.getActiveShape ? D.getActiveShape() : null;
    const h = forma && D[forma];
    if (!h) return false;

    /* Marker: non c'è niente da chiudere — il simbolo o è posato o non
       esiste. Il destro spegne lo strumento e basta. */
    if (forma !== 'Line' && forma !== 'Polygon'){
      fermaTutto(); spegniPulsanti(); stato(t('spento'));
      return true;
    }

    /* I vertici posati stanno nel layer provvisorio; il segmento che segue
       il cursore è l'hintline, che è un'altra cosa e non conta. */
    const wl = h._layer;
    const p = (wl && wl.getLatLngs) ? wl.getLatLngs() : [];
    if (p.length < (forma === 'Polygon' ? 3 : 2)){
      /* Sotto il minimo non c'è geometria: un poligono di due vertici non è
         un poligono. Si annulla, invece di lasciare in carta un moncone. */
      fermaTutto(); spegniPulsanti(); stato(t('disegnoAnnullato'));
      return true;
    }
    /* `_finishShape` è interno a Geoman, ma è l'unica via per chiudere da
       codice: si prende prima il nome pubblico, dove esiste. */
    return chiudiFormaAperta();   // pm:create fa il resto, come col doppio clic
  }

  /* In cattura sul contenitore, non su map.on: mentre si disegna il puntatore
     sta sull'hintmarker di Geoman, e l'evento sintetico della mappa può non
     arrivare mai. Se non c'è un disegno aperto l'evento prosegue intatto e il
     menu del tasto destro funziona come prima. */
  map.getContainer().addEventListener('contextmenu', ev => {
    /* Prima di ogni altra cosa: se una modifica è aperta — i vertici di
       un'area, un trascinamento, la modalità globale — il destro la CHIUDE.
       È lo stesso "ho finito" con cui si chiude un disegno, e su una carta
       quel gesto deve essere uno solo. Aprire un menu sopra una geometria
       che si sta ancora spostando non serve a nessuno. */
    const inModifica = !!elModifica
      || !!(map.pm.globalEditModeEnabled && map.pm.globalEditModeEnabled());
    if (inModifica){
      fermaMenuModifica();
      if (map.pm.globalEditModeEnabled && map.pm.globalEditModeEnabled())
        map.pm.disableGlobalEditMode();
      spegniPulsanti();
      cursore(null);
      stato(t('modOff'));
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (!chiudeDisegnoInCorso()) return;
    ev.preventDefault();
    ev.stopPropagation();
  }, true);

  /* Il FeatureGroup inoltra anche il contextmenu dei figli, come fa col
     clic: un listener solo per tutto il disegno. */
  disegni.on('contextmenu', e => {
    if (e.originalEvent){
      L.DomEvent.preventDefault(e.originalEvent);
      L.DomEvent.stopPropagation(e.originalEvent);
    }
    /* A metà di un percorso guidato il destro non apre niente: il gesto
       atteso è un altro, e un menu sopra la carta lo interromperebbe. */
    if (attesaClic || attesaDirezione || attesaElemento) return;
    selezionaElemento(e.layer);
    apriMenu(e.containerPoint, vociMenu(e.layer));
  });

  map.on('contextmenu', e => {
    if (e.originalEvent) L.DomEvent.preventDefault(e.originalEvent);
    chiudiMenu();
  });
  map.on('movestart zoomstart', chiudiMenu);
  map.on('click', chiudiMenu);

  /* =====================================================================
     5bis-ter. CONO DA PENDENZA — fig. 4 della pubblicazione
     Senza vento la bisettrice non è la direzione del vento ma la linea di
     massima pendenza, e l'apertura resta 30°. La velocità NON si ricava
     dal 3%: quella regola parte dal vento, e con vento nullo darebbe zero
     mentre il fuoco in salita corre. Il PDF dice di stimarla sul posto.
     =================================================================== */
  const RAGGI_PENDENZA = 16;

  /* Open-Meteo accetta più coordinate in una chiamata sola: 17 punti sono
     una richiesta, non diciassette. */
  async function quote(punti){
    const la = punti.map(p => p.lat.toFixed(6)).join(',');
    const lo = punti.map(p => p.lng.toFixed(6)).join(',');
    const r = await fetch(`https://api.open-meteo.com/v1/elevation`
      + `?latitude=${la}&longitude=${lo}`);
    if (!r.ok) throw new Error('elevation ' + r.status);
    const d = await r.json();
    if (!d.elevation || d.elevation.length !== punti.length)
      throw new Error('quote incomplete');
    return d.elevation;
  }

  /* Piano ai minimi quadrati su una corona di 16 punti: la prima armonica
     delle quote dà direttamente il gradiente. Un solo profilo lungo una
     direzione non basterebbe — direbbe quanto sale DA QUELLA parte, non
     da quale parte sale di più. */
  async function massimaPendenza(centro, raggio){
    const az = [];
    for (let i = 0; i < RAGGI_PENDENZA; i++) az.push(i * 360 / RAGGI_PENDENZA);
    const z = await quote(az.map(a => puntoDaAzimut(centro, a, raggio)));
    const z0 = z.reduce((s, x) => s + x, 0) / z.length;
    let gx = 0, gy = 0;
    az.forEach((a, i) => {
      gx += (z[i] - z0) * Math.sin(rad(a));
      gy += (z[i] - z0) * Math.cos(rad(a));
    });
    const k = 2 / (RAGGI_PENDENZA * raggio);
    gx *= k; gy *= k;
    return {azimut: (gra(Math.atan2(gx, gy)) + 360) % 360,
            pendenza: Math.sqrt(gx*gx + gy*gy)};
  }

  /* Ore trascorse da un'ora dettata. Se l'ora è nel futuro l'incendio è
     partito ieri sera: un fuoco acceso alle 23 e guardato alle 2 non ha
     ventun ore. */
  function oreDa(hhmm){
    const p = String(hhmm).split(':').map(Number);
    if (p.length < 2 || isNaN(p[0]) || isNaN(p[1])) return 0;
    const ora = new Date(), inizio = new Date(ora);
    inizio.setHours(p[0], p[1], 0, 0);
    if (inizio > ora) inizio.setDate(inizio.getDate() - 1);
    return (ora - inizio) / 3600000;
  }

  async function scegliVelocitaSalita(dist){
    const modo = await scegli({testo: t('pendVelQuale'), voci: [
      {k:'percorso', et: t('pendVelPercorso'), nota: t('pendVelPercorsoNota', {d: dist})},
      {k:'vista',    et: t('pendVelVista'),    nota: t('pendVelVistaNota')}
    ]});
    if (!modo) return null;
    if (modo === 'percorso'){
      const h = await chiedi({campo:1, testo: t('chiediOraInnesco'), max:5,
        filtro: v => v.replace(/[^0-9:]/g, '').slice(0, 5)});
      if (!h) return null;
      const ore = oreDa(h);
      if (!(ore > 0)){ stato(t('oraErrata')); return null; }
      return Math.round(dist / ore);
    }
    const v = await chiedi({campo:1, testo: t('chiediMetriOra'), max:5,
      filtro: x => x.replace(/[^0-9]/g, '').slice(0, 5)});
    const n = Number(v);
    return n > 0 ? n : null;
  }

  async function conoPendenza(){
    const V = NS.SitacVento;
    const m = origineSullaCarta();
    const origine = m ? m.getLatLng() : await attendiClic(t('conoClicOrigine'));
    if (!origine) return stato(t('conoAnnullato'));
    const p0 = await attendiClic(t('conoClicFronte'));
    if (!p0) return stato(t('conoAnnullato'));
    const r0 = Math.round(origine.distanceTo(p0));

    /* Il rilievo si legge attorno al FRONTE, non attorno all'innesco: se
       l'incendio ha scavalcato un crinale, di là il fuoco scende, e una
       pendenza misurata sul punto di partenza manderebbe il cono in salita
       oltre il colmo. */
    stato(t('pendLeggo'));
    let pend;
    try { pend = await massimaPendenza(p0, Math.max(300, r0)); }
    catch(e){ return stato(t('rilErrore', {e: e.message})); }
    if (pend.pendenza < 0.02) return stato(t('pendPiatto'));
    stato(t('pendTrovata', {a: Math.round(pend.azimut),
      p: (pend.pendenza * 100).toFixed(0)}));

    const mh = await scegliVelocitaSalita(r0);
    if (!mh) return stato(t('conoAnnullato'));

    /* disegnaCono ricava i raggi da vento.velocita passando per il 3%.
       Qui la velocità del fronte è nota e il vento non c'è, quindi si
       inverte quella conversione invece di riscrivere la geometria: il
       fattore si chiede al modulo, così se un domani cambiasse là non
       resterebbe una costante sbagliata qui. */
    const perKmh = V.distanzaFronte(100, 60) / 100;
    const finto = V.ventoDa(mh / perKmh, pend.azimut, t('pendFonte'));
    finto.letto = new Date().toISOString();

    const layer = V.disegnaCono(origine, finto,
      {colore: COL.rosso, raggio0: r0, etichetta0: t('conoT0')});
    const id = ++nCono;
    agganciaCono(layer, id);
    decori.addLayer(layer);
    coni.push({id, layer, vento: finto, tipo:'pendenza', mh, pendenza: pend.pendenza,
      base: m || null});
    aggiornaStato();
    stato(t('conoPendFatto', {a: V.APERTURA, d: Math.round(pend.azimut),
      p: (pend.pendenza * 100).toFixed(0), m: Math.round(mh)}));
  }

  /* =====================================================================
     5quater. VENTO LOCALE — PASSO 2
     Direzione a due punti dal DOS: la linea tratteggiata e la punta
     trascinabile dicono dove VA il vento, e il quadro in alto a sinistra
     segue in tempo reale. È la stessa grammatica dei simboli orientabili.
     =================================================================== */
  let ventoAsta = null, ventoDeco = null;
  let ventoVelocita = 0, ventoVerso = 0;
  /* Asta e decorazioni vivono in un gruppo proprio dentro i decori. Serve a
     poterle buttare TUTTE con una chiamata sola: rimuovere i due riferimenti
     uno per uno lasciava in carta le punte delle direzioni già provate, e
     quali marcatori PolylineDecorator tenga vivi non è visibile da qui. */
  const ventoGruppo = L.layerGroup().addTo(decori);

  /* Il rosso sulla carta è il fuoco e il dispositivo VVF, il nero il terreno,
     l'azzurro l'acqua: una freccia che non è nessuna di quelle cose non può
     prendere in prestito nessuno di quei colori, o a colpo d'occhio si legge
     come un asse di sviluppo. Il viola non è di nessun altro. */
  const COL_VENTO_DOS = '#b515c9';

  function applicaVento(fonte, senzaRidisegno){
    /* Il ridisegno sta PRIMA della guardia: anche a zero la freccia deve
       seguire la direzione, ed è l'unica cosa che a zero ha ancora senso
       aggiornare. Il numero di codine lo decide l'intensità, quindi muovendo
       lo slider il simbolo si rifà da sé. */
    if (!senzaRidisegno && ventoAsta) disegnaFrecciaVento();
    if (!ventoVelocita){ mostraVento(null); aggiornaPassi(); return; }
    const v = NS.SitacVento.ventoDa(ventoVelocita, ventoVerso, fonte || 'manuale');
    v.letto = new Date().toISOString();
    mostraVento(v);
    aggiornaPassi();
    stato(t('ventoImpostato', {v:v.velocita, d:v.verso, f:v.fonte}));
  }

  /* Il vento del DOS ha la stessa grammatica del simbolo di tavola: punta a
     un capo, codine dell'intensità all'altro. Con tutto allo stesso capo non
     si distingueva più né la direzione né quante barbe ci fossero.
     E NON si trascina. Una freccia trascinabile in mezzo a una carta piena
     di simboli si sposta per sbaglio mentre si fa altro, e il vento è un
     dato di scenario: si cambia apposta, dal tasto destro, non per attrito.
     Il numero di codine lo legge dalla simbologia invece di riscriverlo qui,
     così le soglie di Beaufort restano dichiarate in un posto solo. */

  function codineVento(){
    const k = NS.SitacVento.simboloVento(ventoVelocita || 0);
    return (NS.SITAC_INTENSITA || {})[k] || 1;
  }

  function disegnaFrecciaVento(){
    ventoGruppo.clearLayers();
    ventoAsta = null; ventoDeco = null;
    if (!posDos) return;
    /* Il DOS sta a METÀ dell'asta: mezza da dove il vento viene, mezza verso
       dove va. Con la coda ancorata al simbolo le codine dell'intensità ci
       finivano sopra e non si contavano più. */
    const semi = distanzaManiglia() * 1.15;
    const coda = puntoDaAzimut(posDos, (ventoVerso + 180) % 360, semi);
    const p = puntoDaAzimut(posDos, ventoVerso, semi);
    ventoAsta = L.polyline([coda, p],
      {color: COL_VENTO_DOS, weight: 3, pmIgnore: true,
       bubblingMouseEvents: false}).addTo(ventoGruppo);

    const finto = {color: COL_VENTO_DOS};
    ventoDeco = L.polylineDecorator(ventoAsta, {patterns: [
      motivo(finto, {tipo:'punta', dim:20, pieno:1, passo:0, offset:'100%'}, 'attivo', 1),
      motivo(finto, {tipo:'codine', forma:'45', n: codineVento(), dim:20,
                     passo:0, offset:0}, 'attivo', 1)
    ]}).addTo(ventoGruppo);

    ventoAsta.on('contextmenu', ev => {
      if (ev.originalEvent){
        L.DomEvent.preventDefault(ev.originalEvent);
        L.DomEvent.stopPropagation(ev.originalEvent);
      }
      if (attesaClic || attesaDirezione || attesaElemento) return;
      apriMenu(ev.containerPoint, [
        {titolo: t('ventoTit')},
        {info: `${ventoVelocita} km/h \u2192 ${ventoVerso}\u00b0`},
        {et: t('menuVentoDir'), fai: ventoCambiaDirezione},
        {et: t('menuVentoInt'), fai: ventoCambiaIntensita}
      ]);
    });
    ventoAsta.on('click', () => stato(t('ventoBloccato')));
  }

  /* La freccia gira sotto il puntatore mentre si sceglie, come ogni altro
     simbolo orientabile. Si muove la sola geometria e si riaggancia il
     decoratore: ricostruire asta e motivi da zero a ogni mousemove vuol
     dire rifarli sessanta volte al secondo per un dato che cambia una
     volta sola. Il residuo delle punte non veniva da qui — era la
     maniglia di pendenza e vento, e si risolve in creaManiglia. */
  function anteprimaVento(e){
    if (!posDos || !ventoAsta) return;
    ventoVerso = Math.round(azimut(posDos, e.latlng));
    const semi = distanzaManiglia() * 1.15;
    ventoAsta.setLatLngs([
      puntoDaAzimut(posDos, (ventoVerso + 180) % 360, semi),
      puntoDaAzimut(posDos, ventoVerso, semi)]);
    if (ventoDeco && ventoDeco.setPaths) ventoDeco.setPaths(ventoAsta);
  }

  async function ventoCambiaDirezione(){
    if (!posDos) return stato(t('ventoNoDos'));
    if (!ventoAsta) disegnaFrecciaVento();
    /* L'azimut di partenza va conservato: l'anteprima lo riscrive a ogni
       movimento, e annullando con Esc resterebbe l'ultima direzione
       sfiorata invece di quella che c'era prima. */
    const prima = ventoVerso;
    /* attendiClic chiama fermaTutto() nel suo corpo sincrono: il listener si
       aggancia DOPO, o verrebbe staccato un istante dopo essere nato. */
    const attesa = attendiClic(t('ventoClicDir'));
    map.on('mousemove', anteprimaVento);
    const p = await attesa;
    map.off('mousemove', anteprimaVento);
    if (!p){ ventoVerso = prima; disegnaFrecciaVento(); return; }
    ventoVerso = Math.round(azimut(posDos, p));
    disegnaFrecciaVento();
    applicaVento('mappa');
  }

  async function ventoCambiaIntensita(){
    const v = await scegliVelocita();
    if (!v) return;
    ventoVelocita = v;
    q('#sitac-ventoScala').value = ventoVelocita;
    q('#sitac-ventoValore').textContent = ventoVelocita + ' km/h';
    disegnaFrecciaVento();
    applicaVento('scala');
  }
  /* La freccia sta a distanza fissa sullo SCHERMO: cambiando zoom va rifatta,
     o a zoom 10 finisce sotto il simbolo del DOS. */
  const aggiornaAncoraVento = () => { if (ventoAsta) disegnaFrecciaVento(); };

  /* Spostando il DOS la freccia lo segue mantenendo l'azimut: il vento è un
     dato di scenario, non del singolo punto, e 200 m non cambiano dove tira.
     Ma la direzione l'operatore può averla corretta a vista sul vecchio
     punto, quindi lo si avvisa invece di rileggere il servizio e
     sovrascrivergli la correzione. */
  function ventoSeguiDos(){
    if (!ventoAsta) return;
    disegnaFrecciaVento();
    stato(t('ventoRiancorato'));
  }

  map.on('zoomend', aggiornaAncoraVento);

  q('#sitac-bVentoDir').onclick = () => {
    if (!posDos) return stato(t('ventoNoDos'));
    /* Il pulsante si chiama "Direzione sulla mappa": deve far scegliere la
       direzione, non limitarsi a mostrare la freccia dov'era. */
    ventoCambiaDirezione();
  };

  q('#sitac-bVentoWeb').onclick = async () => {
    if (!posDos) return stato(t('ventoNoDos'));
    stato(t('ventoLeggo'));
    try {
      const v = await NS.SitacVento.leggi(posDos.lat, posDos.lng);
      ventoVerso = v.verso;
      /* Arrotondato a 5: la scala è a step di 5 e un 23,4 km/h dichiara
         una precisione che il dato non ha. */
      ventoVelocita = Math.min(110, Math.round(v.velocita / 5) * 5);
      q('#sitac-ventoScala').value = ventoVelocita;
      q('#sitac-ventoValore').textContent = ventoVelocita + ' km/h';
      disegnaFrecciaVento();
      applicaVento(v.fonte);
    } catch(e){ stato(t('ventoErrore', {e: e.message})); }
  };

  q('#sitac-ventoScala').oninput = function(){
    ventoVelocita = Number(this.value);
    q('#sitac-ventoValore').textContent = ventoVelocita + ' km/h';
    applicaVento('manuale');
  };

    /* =======================================================================
     5quinquies. NOTE
     Non un'annotazione sulla carta ma un diario dell'intervento: orario e
     testo libero, aggiunti col tempo con un pulsante "+", come i coni di
     propagazione — stesso elenco con la possibilità di togliere una voce.
     Viaggiano nel GeoJSON e sul foglio stampato.
     ===================================================================== */
  const note = [];
  let nNota = 0;
  const salvaNote = () => {
    try { sessionStorage.setItem(CHIAVE_NOTE,
      JSON.stringify(note.map(n => ({t:n.testo, q:n.quando.toISOString()})))); }
    catch(e){ }
  };
  try {
    JSON.parse(sessionStorage.getItem(CHIAVE_NOTE) || '[]').forEach(n => {
      note.push({id: ++nNota, testo: n.t, quando: new Date(n.q)}); });
  } catch(e){ }

  function aggiornaNote(){
    const lista = q('#sitac-note');
    salvaNote();
    if (!lista) return;
    lista.innerHTML = '';
    note.forEach(n => {
      const r = document.createElement('div');
      r.className = 'sitac-nota-voce';
      r.innerHTML = `<span class="sitac-nota-ora">${esc(fmtOra(n.quando))}</span>`
        + `<span class="sitac-nota-testo">${esc(n.testo)}</span>`;
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = '\u00d7';
      b.onclick = () => { note.splice(note.indexOf(n), 1); aggiornaNote(); };
      r.appendChild(b);
      lista.appendChild(r);
    });
    const conta = q('#sitac-stNote');
    if (conta) conta.textContent = note.length || '';
  }

  async function aggiungiNota(){
    const val = await chiedi({campo:1, testo: t('chiediNotaLibera')});
    if (!val) return;
    note.push({id: ++nNota, testo: val, quando: new Date()});
    aggiornaNote();
    stato(t('notaAggiunta'));
  }

  /* =======================================================================
     6. STRUMENTI E PASSI
     ===================================================================== */
  let strumento = null;
    /* Due stati indipendenti, uno per tavola: il dispositivo può essere in atto
    mentre le azioni sono ancora previste, ed è il caso normale. */
  const stati = {dispositivo:'previsto', azioni:'previsto'};
  const statoPer = def => stati[(def && def.g) || ''] || 'previsto';

  /* Uno alla volta: aprendo un passo si chiudono gli altri. Con dieci passi
     e 64 voci di tavola la barra sarebbe altrimenti un elenco lungo il
     doppio dello schermo. */
  function apriFisa(testa){
    const gia = testa.classList.contains('aperto');
    qq('#sitac-barra .sitac-fisa-testa').forEach(b => {
      b.classList.remove('aperto');
      b.setAttribute('aria-expanded', 'false');
      if (b.nextElementSibling) b.nextElementSibling.classList.remove('aperto');
    });
    if (!gia){
      testa.classList.add('aperto');
      testa.setAttribute('aria-expanded', 'true');
      if (testa.nextElementSibling) testa.nextElementSibling.classList.add('aperto');
    }
  }
  function agganciaFisa(dove){
    dove.querySelectorAll('.sitac-fisa-testa').forEach(b => { b.onclick = () => apriFisa(b); });
  }

  /* Stesso formato delle linee: swatch chiara a sinistra, descrizione a
     fianco. I simboli sono disegnati per la carta bianca, quindi la
     swatch resta chiara anche nel tema scuro — e la palette non mente su
     come il simbolo apparirà davvero in mappa. */
  function bottoneSimbolo(k, d){
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.genere = 'simbolo'; b.dataset.chiave = k;
    /* Per i lanci il titolo porta anche l'ingombro reale: il simbolo nel
       pulsante è per forza un'icona a dimensione fissa, e senza la misura
       scritta da qualche parte inganna — sembra un punto, non un'ellisse
       che in mappa può superare i cento metri. */
    b.title = d.poly ? `${nm(d)} — ${d.poly.a * 2}\u00d7${d.poly.b * 2} m` : nm(d);
    b.innerHTML = `<i class="sitac-swatch">${svgSimbolo(k, {stato: statoPer(d)})}</i>`
      + `<span>${esc(nm(d))}</span>`;
    b.onclick = () => attiva('simbolo', k, b);
    return b;
  }
  function bottoneLinea(k, d){
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.genere = 'linea'; b.dataset.chiave = k;
    /* Una barretta colorata diceva solo il colore, e mezza tavola è rossa:
       due tracciati dello stesso peso si distinguono SOLO per il motivo, e
       quello va visto prima di premere — il 4x4 delle sterrate compreso.
       La cornice resta chiara: la tavola è disegnata per la carta bianca. */
    b.innerHTML = `<i class="sitac-swatch sitac-swatch-linea">`
      + NS.SITAC_ANTEPRIMA(k, statoPer(d)) + `</i>`
      + `<span>${esc(nm(d))}</span>`;
    b.onclick = () => attiva('linea', k, b);
    return b;
  }
  function bottoneArea(k, d){
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.genere = 'area'; b.dataset.chiave = k;
    b.innerHTML = `<i class="sitac-swatch sitac-swatch-linea">`
      + `<span class="sitac-tratto" style="height:12px;border-radius:2px;`
      + `background:${d.fillColor};opacity:.85;border:1.5px solid ${d.color}"></span></i>`
      + `<span>${esc(nm(d))}</span>`;
    b.onclick = () => attiva('area', k, b);
    return b;
  }
  function bottoneAzione(genere, chiave, etichetta){
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.genere = genere; b.dataset.chiave = chiave;
    b.innerHTML = `<span>${esc(etichetta)}</span>`;
    b.onclick = () => attiva(genere, chiave, b);
    return b;
  }

  function creaPulsanti(){
    const tav = q('#sitac-tavola');
    tav.innerHTML = '';

    /* Un passo è una fisarmonica numerata con l'indicatore di stato sulla
       testata. `riempi` può restituire un conteggio fisso (le tavole); i
       passi 3-6 non restituiscono niente e la loro testata la scrive
       aggiornaPassi, perché cambia col disegno. */
    const passo = (n, titolo, id, riempi) => {
      const box = document.createElement('div');
      box.className = 'sitac-fisa';
      const testa = document.createElement('button');
      testa.type = 'button';
      testa.className = 'sitac-fisa-testa';
      testa.setAttribute('aria-expanded', 'false');
      testa.innerHTML = `<span class="freccia">▶</span>`
        + `<span class="sitac-passo-n">${n}</span>`
        + `<span class="sitac-passo-tit">${esc(titolo)}</span>`
        + `<span class="sitac-passo-stato" id="sitac-st${id}"></span>`;
      const corpo = document.createElement('div');
      corpo.className = 'sitac-fisa-corpo';
      const quante = riempi(corpo);
      box.appendChild(testa); box.appendChild(corpo);
      tav.appendChild(box);
      /* Il conteggio si scrive dopo l'append: dentro `riempi` il box non è
         ancora nel DOM, e cercarlo da lì significa trovare il passo prima. */
      if (quante != null)
        box.querySelector('.sitac-passo-stato').textContent = quante;
    };

    /* 3 — innesco e superficie insieme: il punto d'origine e l'area bruciata
       si rilevano nello stesso momento, e separarli obbligava a saltare
       avanti e indietro fra due passi. */
    passo(2, t('p3'), 3, corpo => {
      const el = document.createElement('div');
      el.className = 'sitac-strumenti';
      if (SIM.origine) el.appendChild(bottoneSimbolo('origine', SIM.origine));
      corpo.appendChild(el);
      const ar = document.createElement('div');
      ar.className = 'sitac-strumenti';
      Object.entries(AREE).forEach(([k, d]) => ar.appendChild(bottoneArea(k, d)));
      corpo.appendChild(ar);
      corpo.insertAdjacentHTML('beforeend',
        `<p class="sitac-conta" id="sitac-superficie"></p>`
        + `<p class="sitac-avviso">${esc(t('areeFuori'))}</p>`);
    });

    passo(3, t('p4'), 4, corpo => {
      const el = document.createElement('div');
      el.className = 'sitac-azioni';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'largo';
      b.innerHTML = `<span>${esc(t('bCono'))}</span>`;
      b.onclick = creaCono;
      el.appendChild(b);
      corpo.appendChild(el);
      const lista = document.createElement('div');
      lista.id = 'sitac-coni';
      corpo.appendChild(lista);
    });

    /* La riga di stato sta dentro la tavola a cui si applica: in cima alla
       barra valeva per tutto e scorrendo non la vedeva più nessuno. */
    const rigaStato = (tavola, corpo) => {
      const et = tavola === 'azioni' ? ['statoPrevista','statoEffettuata']
                                     : ['statoPrevisto','statoAttivo'];
      const box = document.createElement('div');
      box.className = 'sitac-stato-sez';
      const tit = document.createElement('span');
      tit.textContent = t(tavola === 'azioni' ? 'statoAzioni' : 'statoDispositivo');
      box.appendChild(tit);
      const g = document.createElement('div');
      g.className = 'sitac-stati';
      ['previsto','attivo'].forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sitac-stato-btn';
        b.dataset.stato = s; b.dataset.tavola = tavola;
        b.textContent = t(et[i]);
        if (stati[tavola] === s) b.classList.add('attivo');
        b.onclick = () => cambiaStato(tavola, s);
        g.appendChild(b);
      });
      box.appendChild(g);
      corpo.appendChild(box);
    };

    const perRiquadro = (fonte, tavola) => {
      const gruppi = new Map();
      Object.entries(fonte).filter(([, d]) => d.g === tavola).forEach(v => {
        const sg = v[1].sg || '';
        if (!gruppi.has(sg)) gruppi.set(sg, []);
        gruppi.get(sg).push(v);
      });
      return gruppi;
    };

    /* 5-8: le quattro tavole, nell'ordine della pubblicazione. */
    TAVOLE.forEach((tv, i) => {
      passo(4 + i, t('p' + (5 + i)), 'T' + tv.k, corpo => {
        if (stati[tv.k] !== undefined) rigaStato(tv.k, corpo);
        const gs = perRiquadro(SIM, tv.k);
        const gl = perRiquadro(LIN, tv.k);
        const chiavi = new Set([...gs.keys(), ...gl.keys()]);
        chiavi.forEach(sg => {
          if (sg) corpo.insertAdjacentHTML('beforeend',
            `<span class="sitac-riquadro">${esc(nmRiquadro(sg))}</span>`);
          const voci = gs.get(sg);
          if (voci){
            const griglia = document.createElement('div');
            griglia.className = 'sitac-strumenti';
            voci.forEach(([k, d]) => griglia.appendChild(bottoneSimbolo(k, d)));
            corpo.appendChild(griglia);
          }
          const linee = gl.get(sg);
          if (linee){
            const el = document.createElement('div');
            el.className = 'sitac-strumenti';
            linee.forEach(([k, d]) => el.appendChild(bottoneLinea(k, d)));
            corpo.appendChild(el);
          }
        });
        /* L'annotazione libera non è più uno strumento: quello che si
           scriveva a mano sulla carta adesso sta nel campo Note, dove
           finisce anche nel GeoJSON e sul foglio stampato invece di
           restare un'etichetta appesa a una coordinata.
           `NOTA` resta dichiarata più su, e con lei il ramo di
           iconaSimbolo: un GeoJSON vecchio con dentro delle annotazioni
           deve continuare a rientrare leggibile. */
      });
    });

    /* 8 — le note. Non è un'etichetta appesa a una coordinata ma un testo
       del foglio: chi lo legge lo cerca in fondo, insieme ai numeri, non
       sparso sulla carta accanto a un simbolo. */
    passo(8, t('p8note'), 'Note', corpo => {
      const el = document.createElement('div');
      el.className = 'sitac-azioni';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'largo'; b.id = 'sitac-bAggiungiNota';
      b.innerHTML = `<span>+ ${esc(t('bAggiungiNota'))}</span>`;
      b.onclick = aggiungiNota;
      el.appendChild(b);
      corpo.appendChild(el);
      const lista = document.createElement('div');
      lista.id = 'sitac-note';
      corpo.appendChild(lista);
      corpo.insertAdjacentHTML('beforeend',
        `<p class="sitac-avviso">${esc(t('noteAiuto'))}</p>`);
      aggiornaNote();
    });

    agganciaFisa(tav);
    aggiornaPassi();
    if (strumento) marcaAttivo(strumento.genere, strumento.chiave);
  }

  /* Gli indicatori sulle testate: dicono a colpo d'occhio cosa manca senza
     aprire i passi uno per uno. I passi 1 e 2 stanno nel markup fisso, gli
     altri li costruisce creaPulsanti: `segna` esce in silenzio se il
     bersaglio non c'è ancora. */
  function aggiornaPassi(){
    const segna = (id, testo, ok) => {
      const e = q('#sitac-st' + id);
      if (!e) return;
      e.textContent = testo;
      e.classList.toggle('fatto', !!ok);
      e.classList.toggle('manca', !ok);
    };

    const completo = datiCompleti();
    segna(1, completo ? `${t('pFatto')} ${inIntervento.value} \u00b7 ${dosCompleto()}`
      : t('pManca'), completo);
    segna(2, ventoCono ? `${t('pFatto')} ${ventoCono.velocita} km/h \u2192 ${ventoCono.verso}\u00b0`
      : t('pManca'), !!ventoCono);

    const sf = superfici();
    const nIn = disegni.getLayers().filter(x => x._tipo === 'origine').length;
    segna(3, (nIn || sf.totale)
      ? `${nIn ? t('pInneschi', {n:nIn}) : ''}${nIn && sf.totale ? ' \u00b7 ' : ''}`
        + `${sf.totale ? t('pEttari', {v: inHa(sf.totale)}) : ''}`
      : t('pNessuno'), nIn > 0 || sf.totale > 0);
    segna(4, coni.length ? t('pConi', {n:coni.length}) : t('pNessuno'), coni.length > 0);
    const nn = note.length;
    segna('Note', nn ? `${t('pFatto')} ${nn}` : t('pNessuno'), nn > 0);

    const box = q('#sitac-superficie');
    if (box){
      box.innerHTML = sf.totale
        ? `<span>${esc(t('supPercorsa', {v: inHa(sf.percorsa)}))}</span><br>`
          + `<span>${esc(t('supAttiva', {v: inHa(sf.attiva)}))}</span>`
        : '';
      box.classList.toggle('sitac-conta-cliccabile', sf.totale > 0);
      box.onclick = sf.totale ? mostraSuperfici : null;
    }

    const lista = q('#sitac-coni');
    if (lista){
      lista.innerHTML = '';
      coni.forEach(c => {
        const r = document.createElement('div');
        r.className = 'sitac-cono-voce';
                r.innerHTML = `<span>${c.id} — ` + (c.tipo === 'pendenza'
          ? `${esc(String(Math.round(c.mh)))} m/h \u2197 ${esc(String(c.vento.verso))}\u00b0`
          : `${esc(String(c.vento.velocita))} km/h \u2192 ${esc(String(c.vento.verso))}\u00b0`)
          + `</span>`;
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = '\u00d7';
        b.onclick = () => togliCono(c.id);
        r.appendChild(b);
        lista.appendChild(r);
      });
    }
  }

  function marcaAttivo(genere, chiave){
    const b = q(`#sitac-barra button[data-genere="${genere}"][data-chiave="${chiave}"]`);
    if (b){
      b.classList.add('attivo');
      /* se lo strumento sta in un passo chiuso, lo si apre */
      const corpo = b.closest('.sitac-fisa-corpo');
      if (corpo && !corpo.classList.contains('aperto')) apriFisa(corpo.previousElementSibling);
    }
  }
  /* I due pulsanti di stato non sono strumenti: restano accesi sempre. */
  function spegniPulsanti(){
    qq('#sitac-barra button:not(.sitac-stato-btn):not(.sitac-fisa-testa)')
      .forEach(b => b.classList.remove('attivo'));
  }

  function attiva(genere, chiave, bottone){
    /* Lo spegnimento si decide sullo STRUMENTO IN USO, non sulla classe del
       pulsante. La classe è una conseguenza dello stato, non lo stato: la
       scrivono e la cancellano in cinque punti diversi, e appena una resta
       indietro il primo clic su un simbolo NUOVO viene scambiato per un
       riclic su quello acceso — si spegne e basta, e ne serve un secondo.
       Con `strumento` la domanda è quella giusta: sto premendo di nuovo
       quello che sto già usando? */
    const gia = !!strumento && strumento.genere === genere
      && strumento.chiave === chiave;
    fermaTutto();                 // azzera `strumento`: `gia` va letto prima
    spegniPulsanti();
    if (gia){ stato(t('spento')); return; }
    if (bottone) bottone.classList.add('attivo');
    strumento = {genere, chiave};
    riattivaStrumento();
  }
  function riattivaStrumento(){
    if (!strumento) return;
    const {genere, chiave} = strumento;
    if (genere === 'linea'){
      const d = LIN[chiave];
      map.pm.enableDraw('Line', {pathOptions: stileLinea(d, statoPer(d)), continueDrawing:true});
      stato(`${nm(d)}${etichettaStato(d)}\n${t('suggLinea')}`);
      cursore('mirino');
    } else if (genere === 'area'){
      const d = AREE[chiave];
      map.pm.enableDraw('Polygon', {pathOptions: stileArea(d), continueDrawing:true});
      stato(`${nm(d)}\n${t('suggArea')}`);
      cursore('mirino');
    } else {
      const d = chiave === 'nota' ? NOTA : SIM[chiave];
      /* Sui lanci il simbolo appeso al puntatore inganna: quello che si sta
         per posare non è un pittogramma ma un'ellisse di centoventicinque
         metri d'asse. Resta un mirino, che dice dove cade il clic e non
         promette una dimensione. */
      const anteprima = (d && d.poly)
        ? L.divIcon({className:'sitac-deco', iconSize:[18,18], iconAnchor:[9,9],
            html:`<svg viewBox="0 0 18 18" width="18" height="18">`
              + `<circle cx="9" cy="9" r="6" fill="none" stroke="${COL.rosso}"`
              + ` stroke-width="2" stroke-dasharray="3,2.5"/></svg>`})
        : iconaSimbolo(chiave, {stato: statoPer(d)});
      map.pm.enableDraw('Marker', {
        markerStyle:{icon: anteprima, draggable:true},
        continueDrawing:true});
      stato(`${nm(d)}${etichettaStato(d)}\n${t('suggSimbolo')}`);
      /* Geoman tiene GIÀ il simbolo attaccato al puntatore mentre si sceglie
         dove posarlo: disegnarlo anche come cursore lo mostrava due volte, uno
         sopra l'altro e sfalsati. Resta il mirino, che dice dove cade il clic
         — che è l'unica cosa che il cursore deve dire. */
      cursore('mirino');
    }
  }

  /* La tavola usa tre coppie: previsto/attivo per i mezzi, prevista/attiva
     per il DOS e le squadre (flag `f`), prevista/effettuata per le azioni. */
  const paroleStato = d => (d && d.g === 'azioni') ? ['statoPrevista','statoEffettuata']
    : (d && d.f) ? ['statoPrevista','statoAttiva'] : ['statoPrevisto','statoAttivo'];
  const etichettaStato = d => (d && (d.s || d.stati))
    ? ` — ${t(paroleStato(d)[statoPer(d) === 'attivo' ? 1 : 0])}` : '';
  const statoDi = (d, s) => (d && (d.s || d.stati))
    ? ` — ${t(paroleStato(d)[s === 'attivo' ? 1 : 0])}` : '';

        /* =====================================================================
     6bis. MISURA IN CORSO DI DISEGNO
     Geoman disegna e basta: quanto è lungo il tracciato lo si scopre solo
     dopo aver chiuso. Su una carta operativa la domanda è l'opposto —
     "quanto manca al crinale" si chiede MENTRE si tira la linea. Il
     riquadro segue il cursore e sparisce alla chiusura.
     =================================================================== */
  let misuraBox = null, misuraPunti = [], misuraPoligono = false;

  const inKm = m => m < 1000 ? Math.round(m) + ' m' : (m/1000).toFixed(2) + ' km';

  function misuraMostra(latlng, pt){
    if (!misuraBox || !misuraPunti.length) return;
    const ultimo = misuraPunti[misuraPunti.length - 1];
    const seg = ultimo.distanceTo(latlng);
    let tot = seg;
    for (let i = 0; i < misuraPunti.length - 1; i++)
      tot += misuraPunti[i].distanceTo(misuraPunti[i+1]);
    let testo = inKm(seg);
    if (misuraPunti.length > 1) testo += ` · \u03a3 ${inKm(tot)}`;
    if (misuraPoligono && misuraPunti.length >= 2)
      testo += `\n${inHa(areaAnello(misuraPunti.concat(latlng)))} ha`;
    misuraBox.textContent = testo;
    misuraBox.hidden = false;
    /* A destra del cursore, tranne vicino al bordo: lì passa a sinistra,
       o il riquadro esce dal riquadro della mappa. */
    const w = misuraBox.offsetWidth || 120;
    const dx = (pt.x + w + 26 > map.getSize().x) ? -(w + 16) : 16;
    misuraBox.style.left = (pt.x + dx) + 'px';
    misuraBox.style.top  = (pt.y + 14) + 'px';
  }

  function misuraSpegni(){
    misuraPunti = [];
    if (misuraBox) misuraBox.hidden = true;
  }

  function fermaTutto(){
    map.pm.disableDraw();
    /* Solo se accese: Geoman prova a sganciare listener mai agganciati e
       Leaflet stampa "wrong listener type" in console. */
    if (map.pm.globalEditModeEnabled && map.pm.globalEditModeEnabled())
      map.pm.disableGlobalEditMode();
    if (map.pm.globalRemovalModeEnabled && map.pm.globalRemovalModeEnabled())
      map.pm.disableGlobalRemovalMode();
    attesaDirezione = null;
    map.off('mousemove', anteprimaDirezione);
    map.off('mousemove', anteprimaVento);
    if (attesaClic){ const f = attesaClic; attesaClic = null; f(null); }
    if (attesaLinea){ const f = attesaLinea; attesaLinea = null; f(null); }
    if (attesaElemento){ const f = attesaElemento; attesaElemento = null; f(null); }
    chiudiMenu();
    fermaMenuModifica();
    misuraSpegni();
    suggSpegni();
    nascondiAvvisoLato();
    cursore(null);
    clicPassante(false);
    strumento = null;
  }

    /* Cambiare stato tocca due cose sole: quale dei due pulsanti è acceso e
     come sono disegnati i simboli di QUELLA tavola. Ricostruire la barra
     faceva anche il resto — e richiudeva la fisarmonica sotto le mani di
     chi aveva appena premuto. Le swatch delle linee non cambiano: il
     tratteggio del previsto lo mette stileLinea al momento del disegno. */
  function cambiaStato(tavola, s){
    if (stati[tavola] === s) return;
    stati[tavola] = s;

    qq(`#sitac-barra .sitac-stato-btn[data-tavola="${tavola}"]`).forEach(b =>
      b.classList.toggle('attivo', b.dataset.stato === s));

    qq('#sitac-barra button[data-genere="simbolo"][data-chiave]').forEach(b => {
      const k = b.dataset.chiave, d = SIM[k];
      if (!d || d.g !== tavola) return;
      const sw = b.querySelector('.sitac-swatch');
      if (sw) sw.innerHTML = svgSimbolo(k, {stato: s});
    });

    /* Anche le linee cambiano faccia: tratteggiata e vuota quando è prevista,
       piena quando è fatta. Prima l'anteprima era una barretta e non aveva
       niente da dire, adesso sì. */
    qq('#sitac-barra button[data-genere="linea"][data-chiave]').forEach(b => {
      const k = b.dataset.chiave, d = LIN[k];
      if (!d || d.g !== tavola) return;
      const sw = b.querySelector('.sitac-swatch');
      if (sw) sw.innerHTML = NS.SITAC_ANTEPRIMA(k, s);
    });

    /* Lo strumento in uso va riacceso: l'icona del marcatore che Geoman
       tiene sotto il cursore è quella dello stato di prima. */
    if (strumento) riattivaStrumento();
  }

    /* =======================================================================
     6ter. CURSORE
     Il puntatore dice cosa succede al prossimo clic: mirino per i tracciati,
     il glifo stesso per i simboli, la croce per l'eliminazione. Davanti a una
     carta si guarda la carta, non la barra a sinistra.
     ===================================================================== */
  const CURSORI = ['mirino','simbolo','elimina','modifica'];
  const curCache = {};

  /* 32 px è il massimo che Windows accetta: oltre, il cursore viene
     scartato in silenzio e resta la freccia di sistema. */
  function cursoreGlifo(k, st){
    const key = k + '|' + st;
    if (key in curCache) return curCache[key];
    let s = svgSimbolo(k, {stato: st, senzaTesto:1});
    if (!s || s.trim().indexOf('<svg') !== 0) return (curCache[key] = null);
    if (!/xmlns=/.test(s))
      s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    s = s.replace(/\s(width|height)="[^"]*"/g, '')
         .replace('<svg', '<svg width="32" height="32"');
    return (curCache[key] =
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s));
  }

  function cursore(nome, chiave, st){
    const el = map.getContainer();
    CURSORI.forEach(c => el.classList.remove('sitac-cur-' + c));
    el.style.cursor = '';
    if (!nome) return;
    el.classList.add('sitac-cur-' + nome);
    if (nome !== 'simbolo' || !chiave) return;
    /* Il mirino resta come ripiego dietro al glifo: se il data-URI non passa
       si vede almeno la croce. */
    const u = cursoreGlifo(chiave, st || 'attivo');
    if (u) el.style.cursor = `url("${u}") 16 16, crosshair`;
  }

    /* =======================================================================
     6quater. CLIC PASSANTE
     Leaflet consegna il clic al layer e si ferma lì: alla mappa non arriva,
     e Geoman i vertici li prende da lì. Finché si disegna, quindi, il
     disegno non intercetta più il puntatore. Lo snap resta: è geometrico.
     ===================================================================== */
  let passanti = null;

  function ognunoDentro(gruppo, f){
    gruppo.eachLayer(l => { l.eachLayer ? ognunoDentro(l, f) : f(l); });
  }
  function passaAnche(l){
    const el = passanti && nodiDi(l)[0];
    if (!el) return;
    passanti.push([el, el.style.pointerEvents]);
    el.style.pointerEvents = 'none';
  }
  function clicPassante(on){
    if (on){
      if (passanti) return;              // già acceso: non si impila
      passanti = [];
      [disegni, decori].forEach(g => ognunoDentro(g, passaAnche));
    } else if (passanti){
      passanti.forEach(([el, v]) => { el.style.pointerEvents = v || ''; });
      passanti = null;
    }
  }

  /* =======================================================================
     7. CREAZIONE
     ===================================================================== */
  map.on('pm:create', async e => {
    const layer = e.layer;
    /* Il fronte del percorso guidato non è un elemento della tavola: si
       prendono i vertici e si butta via il tracciato provvisorio. */
    if (attesaLinea){
      const f = attesaLinea; attesaLinea = null;
      const punti = layer.getLatLngs();
      disegni.removeLayer(layer);
      map.pm.disableDraw();
      f(punti);
      return;
    }
    if (!strumento) return;
    layer._tipo = strumento.chiave;
    layer._genere = strumento.genere;
      /* I Path risalgono alla mappa e il clic finisce nel deseleziona; i Marker
    no, e infatti loro si cancellavano. Stesso default per tutti. */
    if (layer.options) layer.options.bubblingMouseEvents = false;
    passaAnche(layer); 
    const kk = strumento.chiave;
    layer._stato = statoPer(kk === 'nota' ? NOTA
      : (LIN[kk] || AREE[kk] || SIM[kk]));

    if (strumento.genere !== 'simbolo'){
      if (strumento.genere === 'linea'){
        decora(layer);
        layer.on('pm:edit', () => { decora(layer); etichettaElemento(layer); aggiornaStato(); });
        /* Fuori dal ramo sincrono: chiediLato aspetta un clic, e nel
           frattempo pm:create deve essere finito. */
        if (LIN[layer._tipo] && LIN[layer._tipo].lato){
          layer.on('pm:remove', () => scollega(layer));
          etichettaElemento(layer);
          aggiornaStato();
          /* Stessa ragione del simbolo orientabile: `continueDrawing`
             riaccende il disegno DOPO pm:create, quindi spegnerlo adesso
             non serve a niente — un istante dopo è già riacceso. Il clic
             del lato finiva a posare il primo vertice di un'altra linea, e
             il messaggio spariva sotto a quello dello strumento. */
          setTimeout(() => chiediLato(layer), 0);
          return;
        }
      } else {
        layer.on('pm:edit', () => { etichettaElemento(layer); aggiornaStato(); });
      }
      layer.on('pm:remove', () => scollega(layer));
      etichettaElemento(layer);
      aggiornaStato();
      return;
    }

    const k = strumento.chiave;
    const def = k === 'nota' ? NOTA : SIM[k];
    /* I lanci nascono come marcatore per avere il clic di posa, poi il
       marcatore si butta e resta il poligono. */
    if (def.poly){
      const centro = layer.getLatLng();
      disegni.removeLayer(layer);
      creaLancio(k, centro, {stato: statoPer(SIM[k])});
      aggiornaStato();
      /* Lo strumento NON si spegne più. Si spegneva perché il lancio nasceva
         con tre maniglie che in modalità disegno Geoman intercetta — ma il
         prezzo era tornare al pulsante dopo ogni lancio, e soprattutto: al
         cambio Prevista/Effettuata `strumento` era già null, riattivaStrumento
         non trovava niente da riaccendere e sembrava che il modulo si fosse
         piantato. Adesso le maniglie compaiono selezionando il lancio, e qui
         si continua a posare come con ogni altro simbolo. */
      stato(`${nm(def)}${etichettaStato(def)}\n${t('lancioPosato')}`);
      return;
    }

    /* Il testo va chiesto prima di mostrare il simbolo: la sigla ci sta
       dentro, e ridisegnarlo dopo farebbe lampeggiare il riquadro vuoto. */
    if (def.libero || def.e || def.paese){
      map.pm.disableDraw();
      /* Sul modulo internazionale la prima domanda è la nazione: la
         bandiera è l'etichetta del simbolo, e un numero senza bandiera non
         dice di chi è il modulo. Annullando resta il riquadro vuoto coi
         puntini, che si compila dal tasto destro. */
      if (def.paese) layer._paese = (await scegliPaese(null)) || null;
      if (def.libero || def.e){
        const idm = NS.SITAC_ID_MAX || 4;
        const val = await chiedi(
          def.libero ? {campo:1, testo: t('chiediNota')}
          : def.lbl  ? {campo:1, testo: def.lbl, max: idm,
                        filtro: v => v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, idm)}
          :            {campo:1, testo: t('chiediSigla')});
        if (def.libero && !val){ disegni.removeLayer(layer); riattivaStrumento(); return; }
        layer._testo = val || null;
      }
      layer.setIcon(iconaSimbolo(k, {stato:layer._stato, testo:layer._testo,
        paese:layer._paese}));
      if (!def.r) riattivaStrumento();
    }
    etichettaElemento(layer);
    aggiornaStato();
        if (def.r){
      /* Sul TP l'asta esiste già col simbolo: si vede che c'è una direzione
         da dare, invece di doverlo indovinare. Il clic la corregge. */
      /* La maniglia nasce con TUTTI gli orientabili, non solo col TP: è
         quella che si vede girare mentre si muove il puntatore, e senza
         resta solo il glifo — su cui la rotazione, prima del clic, non si
         legge. */
      layer._rotazione = layer._rotazione != null ? layer._rotazione : 90;
      creaManiglia(layer);
      /* Dopo aggiornaStato, che riscriverebbe sopra l'istruzione. Il
         setTimeout serve per due motivi: il clic che ha posato il simbolo
         è ancora in corso e verrebbe consumato subito come direzione con
         azimut nullo, e `continueDrawing` riaccende il disegno DOPO
         pm:create — spegnerlo prima non serve a niente. */
      setTimeout(() => {
        map.pm.disableDraw();
        avviaDirezione(layer);
      }, 0);
      stato(`${nm(def)}\n${t('dirSegui')}`);
    }
  });

  /* =======================================================================
     8. ETICHETTE SUGLI ELEMENTI
     Ogni cosa disegnata dice cosa è, nella lingua scelta. Per le aree
     anche superficie e perimetro, per le linee la lunghezza: sono i numeri
     che servono davvero mentre si guarda la carta.
     ===================================================================== */
    function etichettaElemento(layer){
    const k = layer._tipo;
    const def = LIN[k] || AREE[k] || SIM[k] || (k === 'nota' ? NOTA : null);
    if (!def || def.libero){ if (layer.unbindTooltip) layer.unbindTooltip(); return; }
    /* Nome, sigla digitata, e SOLO ALLA FINE lo stato: sulla carta si cerca
       prima quale mezzo è e con che matricola. Lo stato in mezzo spezzava
       "Canadair CAN1" in due pezzi che si leggono separati. */
    let testo = nm(def);
    if (layer._paese) testo += ` \u2014 ${nmStato(layer._paese)}`;
    if (layer._testo && !AREE[k] && !LIN[k]) testo += ` ${layer._testo}`;
    testo += statoDi(def, layer._stato);
    if (AREE[k]) testo += '\n' + t('areaDi', {a:(areaMq(layer)/10000).toFixed(2),
      p:(perimetroM(layer)/1000).toFixed(2)});
    else if (LIN[k]) testo += '\n' + t('lunghezzaDi', {v:(lunghezzaM(layer)/1000).toFixed(2)});
    if (layer._genere === 'lancio')
      testo += '\n' + t('lancioDi', {a: layer._a * 2, b: layer._b * 2,
        s: (areaMq(layer) / 10000).toFixed(2)});
    layer.unbindTooltip();
    layer.bindTooltip(testo, {direction:'top', offset:[0, LIN[k] || AREE[k] ? 0 : -29],
      className:'sitac-tip', sticky: !!(LIN[k] || AREE[k])});
  }

  /* =======================================================================
     9. AZIONI
     ===================================================================== */
  const $ = id => q('#sitac-' + id);

  agganciaFisa(q('#sitac-barra'));

  $('bModifica').onclick = function(){
    const on = this.classList.contains('attivo');
    fermaTutto(); spegniPulsanti();
    if (!on){ this.classList.add('attivo'); map.pm.enableGlobalEditMode();
            cursore('modifica'); stato(t('modOn')); }
    else stato(t('modOff'));
  };
  $('bElimina').onclick = function(){
    const on = this.classList.contains('attivo');
    fermaTutto(); spegniPulsanti();
    if (!on){ this.classList.add('attivo'); map.pm.enableGlobalRemovalMode();
            cursore('elimina'); stato(t('elimOn')); }
    else stato(t('elimOff'));
  };
  $('bAnnulla').onclick = () => {
    const l = disegni.getLayers().pop();
    if (!l) return stato(t('nienteAnnulla'));
    scollega(l);
    disegni.removeLayer(l);
    aggiornaStato();
  };
  $('bPulisci').onclick = async () => {
    if (!disegni.getLayers().length && !coni.length) return stato(t('giaVuota'));
    if (!await chiedi({testo: t('confPulisci')})) return;
    disegni.clearLayers(); decori.clearLayers();
    coni.length = 0;
    /* `decori.clearLayers()` porta via anche la freccia del vento, che vive
       lì insieme a motivi e maniglie. Ma il vento NON è un disegno: è un
       dato dello scenario, come l'intervento e il DOS, e chi svuota la carta
       per ridisegnarla non sta dicendo che il vento è cambiato. Si ridisegna
       da capo con i valori che ci sono già.
       I riferimenti vanno azzerati PRIMA: puntano a layer ormai staccati
       dalla mappa, e disegnaFrecciaVento proverebbe a rimuoverli da un
       gruppo che non li contiene più. */
    /* `decori.clearLayers()` ha già portato via la freccia insieme a motivi
       e maniglie, ma i riferimenti restano puntati a layer staccati dalla
       mappa: senza azzerarli il vento risulta ancora impostato per la
       legenda e per il passo 2, e disegnaFrecciaVento proverebbe a
       rimuoverli da un gruppo che non li contiene più.
       Cancella tutto vuol dire tutto: anche il vento se ne va, e con lui il
       quadro in alto a sinistra. I km/h e la direzione restano nei campi
       del passo 2, quindi ridisegnarlo è un clic, non una rilettura. */
    ventoAsta = null; ventoDeco = null;
    ventoGruppo.clearLayers();
    decori.addLayer(ventoGruppo);
    mostraVento(null);
    /* Il cerchio del GPS sparisce con gli altri decori: si azzera il
       riferimento, o il pulsante della posizione crede di averlo ancora. */
    cerchioPosizione = null;
    posizioneOttenuta = false;
    /* `posDos` NON si tocca: la posizione del DOS è un dato
       dell'intestazione, come il numero d'intervento e il nominativo —
       sta nel campo del passo 1, nel GeoJSON e sul foglio stampato.
       Cancella tutto parla del disegno; per svuotare l'intestazione c'è
       Pulisci campi.
       Il SIMBOLO invece se n'è andato con gli altri, e un dato senza il
       suo segno sulla carta è peggio di nessuno dei due: si riposa. */
    if (posDos) posaDos(posDos);
    /* Si torna alla scheda 1: quello che si fa dopo aver svuotato la carta
       è ricominciare, e ricominciare parte da lì. Il fuoco va dato DOPO il
       cambio scheda — su un elemento nascosto il browser lo ignora — e con
       un giro di ritardo, perché vaiAScheda rimisura la mappa in un
       setTimeout. */
    vaiAScheda('dati');
    setTimeout(() => inIntervento.focus(), 20);
    aggiornaStato();
  };
  function etichettaSfondo(){
    $('bSfondo').innerHTML = `<span>${esc(t('bSfondo', {n: t(sfondi[iSfondo].k)}))}</span>`;
    /* Il disco chiaro dietro i simboli serve dove il fondo è scuro e pieno
       di dettaglio — ortofoto, bosco fitto — e non sullo stradale, che è
       già chiaro e uniforme: lì diventa un bollo bianco che nasconde la
       carta senza aggiungere leggibilità.
       La classe la legge il CSS: quale sfondo abbia bisogno del disco è una
       questione di resa, non di logica. */
    app.classList.toggle('sitac-sfondo-scuro', sfondi[iSfondo].k === 'sfSat');
  }
  $('bSfondo').onclick = () => {
    map.removeLayer(sfondi[iSfondo].l);
    iSfondo = (iSfondo + 1) % sfondi.length;
    map.addLayer(sfondi[iSfondo].l);
    sfondi[iSfondo].l.bringToBack();
    etichettaSfondo();
  };
  $('bCentra').onclick = () => centraSuGps(true);
  $('bStampa').onclick = stampa;

  /* Legenda: si apre e si chiude, perché su un pannello stretto coprirebbe
     mezza mappa proprio mentre si disegna. */
  const legenda = q('#sitac-legenda');
  q('#sitac-legTesta').onclick = () => legenda.classList.toggle('chiusa');

  /* --- raccolta comune --- */
  function raccogli(){
    return disegni.getLayers().map(l => {
      const f = l.toGeoJSON();
      f.properties = {tipo:l._tipo || null, genere:l._genere || null,
        stato:l._stato || null, testo:l._testo || null, rotazione:l._rotazione || null,
        lato:l._lato || null, paese:l._paese || null};
      /* Il poligono viaggia come geometria — QGIS e Google Earth vedono
         l'ingombro vero — ma i parametri viaggiano accanto, così rientrando
         qui l'ellisse torna modificabile invece che come sessanta vertici. */
      if (l._genere === 'lancio')
        Object.assign(f.properties, {a:l._a, b:l._b,
          centro:[l._centro.lng, l._centro.lat]});
      if (l._lung && SIM[l._tipo] && SIM[l._tipo].lungo) f.properties.lung = l._lung;
      return f;
    });
  }
  const nomeFile = est =>
    `sitac${siglaFile()}_${new Date().toISOString().slice(0,16).replace(/[:T-]/g,'')}.${est}`;
  function scarica(testo, nome, mime){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([testo], {type:mime}));
    a.download = nome; a.click(); URL.revokeObjectURL(a.href);
  }

  $('bGeojson').onclick = () => {
    const feat = raccogli();
    if (!feat.length) return stato(t('nienteExport'));
    /* `apertura` e `quota` viaggiano col vento perché il cono si ricostruisce
       da quei numeri: se un domani cambiassero, un file vecchio va rifatto
       coi suoi. */
    const fc = {type:'FeatureCollection', features:feat,
      properties:Object.assign({applicazione:'FireOps VVF — SITAC',
        simbologia:'SI.TA.C. CNVVF 2021', lingua,
        creato:new Date().toISOString()}, intestazione(),
        ventoCono ? {vento:{velocita:ventoCono.velocita, verso:ventoCono.verso,
          provenienza:ventoCono.provenienza, fonte:ventoCono.fonte,
          letto:ventoCono.letto || null,
          apertura:NS.SitacVento.APERTURA, quota:NS.SitacVento.QUOTA_VENTO}} : {},
        note.length ? {note: note.map(n => ({testo:n.testo, quando:n.quando.toISOString()}))} : {})};
    scarica(JSON.stringify(fc,null,1), nomeFile('geojson'), 'application/geo+json');
    stato(t('geojsonFatto', {n:feat.length}));
  };
  $('bKml').onclick = () => {
    const feat = raccogli();
    if (!feat.length) return stato(t('nienteExport'));
    scarica(costruisciKml(feat), nomeFile('kml'), 'application/vnd.google-earth.kml+xml');
    stato(t('kmlFatto', {n:feat.length,
      a:feat.filter(f => f.geometry.type === 'Polygon').length}));
  };

  /* --- KML ---------------------------------------------------------------
     Il KML vuole i colori in aabbggrr: alfa davanti e i canali RGB invertiti.
     È l'errore classico che fa uscire tutto blu al posto del rosso.
     Fuori da qui la simbologia si perde: KML disegna una linea colorata,
     non i triangoli della difesa in linea. Per ritrovare la SITAC intatta
     serve il GeoJSON.                                                      */
  function kmlCol(hex, alfa){
    const h = String(hex || '#cc0000').replace('#','');
    const a = Math.round(Math.max(0, Math.min(1, alfa == null ? 1 : alfa)) * 255)
      .toString(16).padStart(2,'0');
    return a + h.slice(4,6) + h.slice(2,4) + h.slice(0,2);
  }
  const escX = s => String(s == null ? '' : s).replace(/[<>&'"]/g,
    c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));

  function costruisciKml(feat){
    const stili = [];
    Object.entries(LIN).forEach(([k,d]) => stili.push(
      `<Style id="${k}"><LineStyle><color>${kmlCol(d.bordo || d.color)}</color>`
      + `<width>${d.weight || 3}</width></LineStyle></Style>`));
    Object.entries(AREE).forEach(([k,d]) => stili.push(
      `<Style id="${k}"><LineStyle><color>${kmlCol(d.color)}</color>`
      + `<width>${d.weight || 2}</width></LineStyle>`
      + `<PolyStyle><color>${kmlCol(d.fillColor, d.fillOpacity)}</color>`
      + `<fill>1</fill><outline>1</outline></PolyStyle></Style>`));
    Object.keys(SIM).forEach(k => {
      const c = kmlCol(coloreSimbolo(k));
      stili.push(`<Style id="${k}"><IconStyle><color>${c}</color><scale>1.1</scale>`
        + `<Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>`
        + `</IconStyle><LabelStyle><color>${c}</color></LabelStyle></Style>`);
    });

    const segna = feat.map(f => {
      const tp = f.properties.tipo;
      const def = LIN[tp] || AREE[tp] || SIM[tp] || (tp === 'nota' ? NOTA : null);
      let nome = f.properties.testo || (def ? nm(def) : '') || tp || 'elemento';
      /* Le stesse tre coppie della tavola: un'azione è "effettuata", non
         "in atto". */
      if (def && (def.s || def.stati) && f.properties.stato)
        nome += ` (${t(paroleStato(def)[f.properties.stato === 'attivo' ? 1 : 0])})`;
      const g = f.geometry;
      let geom = '';
      if (g.type === 'Point'){
        geom = `<Point><coordinates>${g.coordinates[0]},${g.coordinates[1]},0</coordinates></Point>`;
      } else if (g.type === 'LineString'){
        geom = `<LineString><tessellate>1</tessellate><coordinates>`
          + g.coordinates.map(c => `${c[0]},${c[1]},0`).join(' ')
          + `</coordinates></LineString>`;
      } else if (g.type === 'Polygon'){
        const chiudi = r => {
          const p = r.slice(), a = p[0], z = p[p.length-1];
          if (a[0] !== z[0] || a[1] !== z[1]) p.push(a);   // il KML pretende l'anello chiuso
          return p.map(c => `${c[0]},${c[1]},0`).join(' ');
        };
        geom = `<Polygon><tessellate>1</tessellate>`
          + `<outerBoundaryIs><LinearRing><coordinates>${chiudi(g.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs>`
          + g.coordinates.slice(1).map(r =>
              `<innerBoundaryIs><LinearRing><coordinates>${chiudi(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('')
          + `</Polygon>`;
      }
      return `<Placemark><name>${escX(nome)}</name><styleUrl>#${escX(tp)}</styleUrl>`
        + `<ExtendedData><Data name="tipo"><value>${escX(tp)}</value></Data>`
        + `<Data name="genere"><value>${escX(f.properties.genere)}</value></Data>`
        + `<Data name="stato"><value>${escX(f.properties.stato)}</value></Data></ExtendedData>`
        + geom + `</Placemark>`;
    });
    const cartella = (titolo, filtro) => {
      const dentro = segna.filter((_, i) => filtro(feat[i]));
      return dentro.length ? `<Folder><name>${escX(titolo)}</name>${dentro.join('')}</Folder>` : '';
    };
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${escX(t('kmlDoc'))}</name>
<description>FireOps VVF — ${escX(new Date().toLocaleString(lingua))}</description>
${stili.join('\n')}
${cartella(t('kmlAree'),    f => AREE[f.properties.tipo])}
${cartella(t('kmlLinee'),   f => LIN[f.properties.tipo])}
${cartella(t('kmlSimboli'), f => SIM[f.properties.tipo] || f.properties.tipo === 'nota')}
</Document></kml>`;
  }

  $('bImporta').onclick = () => $('file').click();
  $('file').onchange = ev => {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { carica(JSON.parse(r.result)); }
      catch(err){ stato(t('fileErrato', {e:err.message})); }
      ev.target.value = '';
    };
    r.readAsText(f);
  };
  
    /* FORMATO ATTESO
     Una FeatureCollection. Ogni feature porta in `properties` la chiave
     tecnica del simbolo (`tipo`), il genere, lo stato previsto/attivo,
     l'eventuale testo e — per i lanci — i semiassi in metri e il centro:
     è esattamente quello che scrive il pulsante GeoJSON, e da lì rientra
     identico, simbologia compresa.
     Un file ALTRUI (perimetro da satellite, traccia di volo, confine
     comunale) non ha quelle properties: i suoi poligoni entrano come
     superficie percorsa, che è l'uso per cui si importa un perimetro, e
     punti e linee senza `tipo` restano fuori — sulla carta sarebbero
     geometrie mute, cliccabili e illeggibili.
     Le properties di testa (intervento, DOS, posizione, vento) si adottano
     se ci sono: un file altrui porta con sé il suo intervento. */
  function carica(fc){
    const tutte = (fc && fc.features) || (fc && fc.type === 'Feature' ? [fc] : []);
    if (!tutte.length) return stato(t('importNiente'));

    const p = fc && fc.properties;
    if (p){
      if (p.intervento) inIntervento.value = String(p.intervento).replace(/[^0-9]/g,'');
      if (p.dos)        inDos.value        = normalizzaDos(p.dos);
      if (p.qualifica)  inQualifica.value  = String(p.qualifica);
      if (p.nominativo) inNominativo.value = String(p.nominativo);
      if (p.telefono)   inTelefono.value   = String(p.telefono);
      if (Array.isArray(p.note))
        p.note.forEach(n => { if (n && n.testo)
          note.push({id: ++nNota, testo: String(n.testo),
            quando: n.quando ? new Date(n.quando) : new Date()}); });
      if (p.posizione){
        const c = String(p.posizione).split(/[,;\s]+/).map(Number)
          .filter(x => !isNaN(x));
        if (c.length >= 2){ posDos = L.latLng(c[0], c[1]); cercaProvincia(posDos); }
      }
      /* Il vento rientra come dato, non come disegno: i coni sono stime e si
         rifanno dal pulsante, ma il quadro dice subito con che vento la carta
         è stata redatta. */
      if (p.vento && p.vento.velocita != null && p.vento.verso != null)
        mostraVento(p.vento); 
      segnaIntestazione();
    }

    const gg = f => (f && f.geometry) || {};
    const latlng = c => L.latLng(c[1], c[0]);
    const verso = c => c.map(latlng);
    let n = 0, scarti = 0;

    const aggancia = layer => {
      if (layer.options) layer.options.bubblingMouseEvents = false;
      disegni.addLayer(layer);
      layer.on('pm:remove', () => scollega(layer));
      etichettaElemento(layer);
      n++;
    };

    tutte.forEach(f => {
      const g = gg(f), pr = f.properties || {};
      if (!g.type || !g.coordinates){ scarti++; return; }
      const tipo = (NS.SITAC_VECCHI && NS.SITAC_VECCHI[pr.tipo]) || pr.tipo || null;
      const st = pr.stato === 'attivo' ? 'attivo' : 'previsto';

      /* Il lancio viaggia come poligono perché QGIS e Google Earth devono
         vederne l'ingombro vero, ma i parametri viaggiano accanto: si
         ricostruisce l'ellisse invece di importarne i sessanta vertici. */
      if (pr.genere === 'lancio' && SIM[tipo] && SIM[tipo].poly && pr.centro){
        const l = creaLancio(tipo, latlng(pr.centro),
          {stato: st, a: pr.a, b: pr.b, rotazione: pr.rotazione});
        if (l) n++;
        return;
      }

      if (g.type === 'Point'){
        const def = tipo === 'nota' ? NOTA : SIM[tipo];
        if (!def){ scarti++; return; }
        const m = L.marker(latlng(g.coordinates), {draggable:true,
          icon: iconaSimbolo(tipo, {stato:st, testo:pr.testo || null,
            paese: pr.paese || null,
            rotazione: pr.rotazione != null ? pr.rotazione : undefined})});
        m._tipo = tipo; m._genere = 'simbolo'; m._stato = st;
        m._testo = pr.testo || null;
        m._paese = pr.paese || null;
        m._lung = pr.lung || null;
        m._rotazione = pr.rotazione != null ? pr.rotazione : null;
        aggancia(m);
        if (def.r && m._rotazione != null) creaManiglia(m);
        return;
      }

      if (g.type === 'LineString'){
        const def = LIN[tipo];
        if (!def){ scarti++; return; }
        const l = L.polyline(verso(g.coordinates), stileLinea(def, st));
        l._tipo = tipo; l._genere = 'linea'; l._stato = st;
        l._testo = pr.testo || null;
        l._lato = pr.lato === -1 ? -1 : 1;
        aggancia(l);
        decora(l);
        l.on('pm:edit', () => { decora(l); etichettaElemento(l); aggiornaStato(); });
        return;
      }

      if (g.type === 'Polygon' || g.type === 'MultiPolygon'){
        const anelli = g.type === 'Polygon' ? [g.coordinates]
          : g.coordinates;
        anelli.forEach(poly => {
          const k = AREE[tipo] ? tipo : 'percorsa';
          const l = L.polygon(poly.map(verso), stileArea(AREE[k]));
          l._tipo = k; l._genere = 'area'; l._stato = st;
          l._testo = pr.testo || null;
          aggancia(l);
          l.on('pm:edit', () => { etichettaElemento(l); aggiornaStato(); });
        });
        return;
      }

      scarti++;
    });

    /* La posizione del DOS rientra come dato vivo, non come testo: senza
       questo il passo 1 crede che il DOS non ci sia. Il simbolo, se c'era,
       è già arrivato con le feature. */
    if (posDos && !dosSullaCarta()) posaDos(posDos);
    aggiornaNote(); 
    if (n && disegni.getBounds().isValid())
      map.fitBounds(disegni.getBounds(), {padding:[40,40]});
    aggiornaStato();
    stato(t('importati', {n}) + (scarti ? t('importScarti', {n: scarti}) : ''));
  }

  /* =======================================================================
     10. MISURE
     Superficie con la formula sferica, perimetro e lunghezza sommando le
     distanze fra vertici: sono approssimazioni più che sufficienti alla
     scala di un incendio boschivo.
     ===================================================================== */
    /* La formula sferica lavora su un anello di punti: areaMq la richiama
     passandogli i vertici del layer, la misura in corso i vertici più il
     cursore. Una sola implementazione, due chiamanti. */
  function areaAnello(p){
    if (!p || p.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < p.length; i++){
      const j = (i+1) % p.length;
      s += rad(p[j].lng - p[i].lng) *
           (2 + Math.sin(rad(p[i].lat)) + Math.sin(rad(p[j].lat)));
    }
    return Math.abs(s * R_TERRA * R_TERRA / 2);
  }
  function areaMq(poly){
    return areaAnello(poly.getLatLngs && poly.getLatLngs()[0]);
  }
  function inHa(mq){ return (mq / 10000).toFixed(2); }
  function inMq(mq){ return Math.round(mq).toLocaleString('it-IT'); }

  /* Percorsa e attiva sono due dati operativi distinti: quanto è già
     bruciato e quanto sta bruciando adesso. Sommarli dà un numero che non
     dice niente a chi legge la carta. Le altre tre aree — minacciata,
     evacuata, bonificata — sono zone di gestione e restano fuori. */
  function superfici(){
    let percorsa = 0, attiva = 0;
    disegni.eachLayer(x => {
      if (x._tipo === 'percorsa') percorsa += areaMq(x);
      else if (x._tipo === 'attiva') attiva += areaMq(x);
    });
    return {percorsa, attiva, totale: percorsa + attiva};
  }
  /* Gli ettari sono l'unità con cui si ragiona in AIB e si parla per radio;
     i metri quadri servono sotto l'ettaro, dove "0,04 ha" non dice niente
     e "400 m²" sì. Stanno in un riquadro a parte per non affollare la barra. */
  function mostraSuperfici(){
    const sf = superfici();
    chiedi({testo:
        `${t('supPercorsa', {v: inHa(sf.percorsa)})} — ${inMq(sf.percorsa)} m²\n`
      + `${t('supAttiva',   {v: inHa(sf.attiva)})} — ${inMq(sf.attiva)} m²\n\n`
      + `${t('supTotale',   {v: inHa(sf.totale)})} — ${inMq(sf.totale)} m²`});
  }
  function perimetroM(poly){
    const p = poly.getLatLngs && poly.getLatLngs()[0];
    if (!p || p.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < p.length; i++) d += p[i].distanceTo(p[(i+1) % p.length]);
    return d;
  }
  function lunghezzaM(linea){
    const p = linea.getLatLngs && linea.getLatLngs();
    if (!p || p.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < p.length - 1; i++) d += p[i].distanceTo(p[i+1]);
    return d;
  }



  /* --- stato e legenda --- */
  function stato(x){ $('stato').textContent = x; }

  function aggiornaStato(){
    const l = disegni.getLayers();
    const linee = l.filter(x => LIN[x._tipo]).length;
    const aree  = l.filter(x => AREE[x._tipo]).length;
    const punti = l.length - linee - aree;
    let sup = 0, per = 0;
    l.filter(x => AREE[x._tipo]).forEach(x => { sup += areaMq(x); per += perimetroM(x); });
    stato(t('conteggio', {p:punti, l:linee, a:aree})
      + (sup ? t('superficie', {v:(sup/10000).toFixed(1)}) : '')
      + (per ? t('perimetro', {v:(per/1000).toFixed(2)}) : ''));
    aggiornaLegenda();
    aggiornaPassi();
  }

  /* La tavola ha 64 voci: una legenda con tutte sarebbe illeggibile.
     Si elencano solo i tipi effettivamente sulla mappa, una volta ciascuno. */
  function aggiornaLegenda(){
    const leg = q('#sitac-legVoci');
    if (!leg) return;
    leg.innerHTML = '';
    const visti = new Map();
    disegni.eachLayer(x => {
      if (!x._tipo) return;
      const chiave = x._tipo + '|' + (x._stato || '');
      if (!visti.has(chiave)) visti.set(chiave, x);
    });
    /* La freccia del vento non è un elemento disegnato ma sulla carta si
       vede, e chi legge il foglio deve trovarne il significato in legenda.
       Anche a 0 km/h: "zero" è un dato rilevato, non un dato mancante, e
       una freccia senza voce in legenda sembra un errore di disegno. */
    if (ventoAsta){
      const n = codineVento();
      let g = '';
      for (let i = 0; i < n; i++)
        g += `<line x1="${14 - i * 5}" y1="15" x2="${8 - i * 5}" y2="21"`
          + ` stroke="${COL_VENTO_DOS}" stroke-width="2.6" stroke-linecap="round"/>`;
      leg.insertAdjacentHTML('beforeend',
        `<div><i class="sitac-leg-lin"><svg viewBox="0 0 64 30">`
        + `<line x1="6" y1="15" x2="52" y2="15" stroke="${COL_VENTO_DOS}" stroke-width="3"/>`
        + `<path d="M61 15L47 9L47 21Z" fill="${COL_VENTO_DOS}"/>${g}</svg></i>`
        + `<span>${esc(t('legVento', {v: ventoVelocita, d: ventoVerso}))}</span></div>`);
    }

    const quanti = q('#sitac-legQuanti');
    if (quanti) quanti.textContent = visti.size || '';
    if (!visti.size && !ventoAsta){
      leg.innerHTML = `<div class="sitac-leg-vuota">${esc(t('legVuota'))}</div>`;
      return;
    }
    visti.forEach(x => {
      const k = x._tipo;
      if (LIN[k]){
        const d = LIN[k];
        /* Stessa anteprima del pulsante: una legenda che mostra un trattino
           rosso accanto a "Difesa in linea" e un trattino rosso identico
           accanto a "Ricognizione" non è una legenda. */
        leg.insertAdjacentHTML('beforeend',
          `<div><i class="sitac-leg-lin">${NS.SITAC_ANTEPRIMA(k, x._stato)}</i>`
          + `<span>${esc(nm(d) + statoDi(d, x._stato))}</span></div>`);
      } else if (AREE[k]){
        const d = AREE[k];
        leg.insertAdjacentHTML('beforeend',
          `<div><i class="sitac-tratto" style="height:11px;border-radius:2px;background:${d.fillColor};
            opacity:.85;border:1.5px solid ${d.color}"></i><span>${esc(nm(d))}</span></div>`);
      } else if (SIM[k]){
        const d = SIM[k];
        leg.insertAdjacentHTML('beforeend',
          `<div><span class="sitac-leg-sim">${svgSimbolo(k, {stato:x._stato})}</span>`
          + `<span>${esc(nm(d) + statoDi(d, x._stato))}</span></div>`);
      } else if (k === 'nota'){
        leg.insertAdjacentHTML('beforeend',
          `<div><span class="sitac-leg-sim">✎</span><span>${esc(nm(NOTA))}</span></div>`);
      }
    });
  }

  /* =======================================================================
     11. CAMBIO LINGUA
     Ridisegna solo le etichette: geometrie, strumento in uso e modalità
     di modifica restano dove sono. Anche i suggerimenti già posati sugli
     elementi vengono riscritti nella nuova lingua.
     ===================================================================== */
  function creaBandiere(){
    const box = q('#sitac-lingue');
    box.innerHTML = '';
    Object.keys(L10N).forEach(lg => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.lingua = lg;
      b.title = lg.toUpperCase();
      b.setAttribute('aria-label', lg.toUpperCase());
      b.innerHTML = BANDIERE[lg];
      if (lg === lingua) b.classList.add('attivo');
      b.onclick = () => cambiaLingua(lg);
      box.appendChild(b);
    });
  }
  function cambiaLingua(lg){
    if (!L10N[lg] || lg === lingua) return;
    lingua = lg;
    applicaLingua();
  }
  function applicaLingua(){
    radice.setAttribute('lang', lingua);
    qq('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
    qq('#sitac-lingue button').forEach(b =>
      b.classList.toggle('attivo', b.dataset.lingua === lingua));
    q('#sitac-bCentra').title = t('bCentra');
    inDos.title = t('dosAiuto');
    mostraBlocco();   // il ciclo su [data-t] ha appena riscritto "Convalida"
    creaPulsanti();
    etichettaSfondo();
    disegni.eachLayer(etichettaElemento);
    if (ventoCono) mostraVento(ventoCono);
    if (strumento){
      const d = strumento.genere === 'linea' ? LIN[strumento.chiave]
              : strumento.genere === 'area'  ? AREE[strumento.chiave]
              : (strumento.chiave === 'nota' ? NOTA : SIM[strumento.chiave]);
      const sugg = strumento.genere === 'linea' ? 'suggLinea'
                 : strumento.genere === 'area'  ? 'suggArea' : 'suggSimbolo';
      stato(`${nm(d)}${etichettaStato(d)}\n${t(sugg)}`);
    } else if (disegni.getLayers().length){
      aggiornaStato();
    } else {
      stato(t('pronto'));
      aggiornaLegenda();
    }
  }

  /* Esc annulla lo strumento corrente, o chiude il modale */
  document.addEventListener('keydown', e => {
    if (app.offsetParent === null) return;
    if (e.key !== 'Escape') return;
    if (chiudiModale){ chiudiModale(); return; }
    if (menuAperto()){ chiudiMenu(); return; }
    fermaTutto(); spegniPulsanti(); stato(t('spento'));
  });

  /* Canc e Backspace tolgono l'elemento selezionato. Il guardiano è il
     bersaglio dell'evento: dentro un campo di testo Backspace cancella una
     lettera, e intercettarlo lì significherebbe far sparire un fronte
     mentre si corregge il numero d'intervento. */
  document.addEventListener('keydown', e => {
    if (app.offsetParent === null) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (chiudiModale) return;
    if (!selezionato) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'
      || a.tagName === 'SELECT' || a.isContentEditable)) return;
    e.preventDefault();
    eliminaSelezionato();
  });

  creaBandiere();
  applicaLingua();
  stato(t('pronto'));
  aggiornaLegenda();
  centraSuGps(false);
  /* Il passo 1 si apre da solo: è il primo gesto di ogni SITAC, e trovarlo
     chiuso costa un clic a ogni apertura del modulo. */
  const testa1 = q('#sitac-barra .sitac-fisa-testa');
  if (testa1) apriFisa(testa1);

  /* -------------------------------------------------------------------
     Stampa: la sezione viene appesa al body per il tempo della stampa,
     poi torna esattamente dov'era. Senza questo passaggio il pannello
     resta annegato nel layout di index.html e la mappa esce tagliata.
     La testata (titolo, data, conteggi) esiste solo su carta: a video
     sarebbe una ripetizione del riquadro di stato.
     ----------------------------------------------------------------- */
    /* =======================================================================
   STAMPA — A3 ORIZZONTALE, DUE PAGINE

   Sostituisce l'intera funzione stampa() dentro avvia(), in sitac.js.
   Va incollato nello stesso punto (sezione 11, prima di adatta()): usa
   variabili di quella closure — map, disegni, coni, ventoCono, AREE, LIN,
   SIM, NOTA, comandoSitac, provinciaDos, intestazione(), fmtOra, areaMq,
   perimetroM, lunghezzaM, inMq, nm, t, esc, svgSimbolo, statoDi, sfondi,
   iSfondo, AREE_SUPERFICIE.

   #sitac-testata-stampa non serve più e resta inerte: il CSS di stampa
   mostra soltanto il foglio costruito qui.
   ===================================================================== */

let foglioStampa = null;
let segnoMappa = null;

function creaFoglioStampa(){
  if (foglioStampa) return foglioStampa;
  foglioStampa = document.createElement('div');
  foglioStampa.id = 'sitac-stampa-doc';
  document.body.appendChild(foglioStampa);
  return foglioStampa;
}

const sfCampo = (et, val) =>
  `<div class="sf-campo"><span class="sf-et">${esc(et)}</span>`
  + `<span class="sf-val">${val == null || val === '' ? '\u2014' : esc(String(val))}</span></div>`;

/* Il Comando è quello AFFERENTE alla posizione del DOS, non quello della
   sala che disegna: su un incendio in provincia confinante sono due cose
   diverse, e sulla carta stampata deve comparire chi ha la competenza.
   Se la provincia non è stata determinata resta il Comando attivo. */
function sfBloccoComando(){
  const c = comandoSitac || window.FireOpsComandoAttivo || null;
  if (!c) return sfCampo('Comando', '');
  return sfCampo('Comando', c.Comando)
    + sfCampo('CH VHF Comando', c['Canale Radio Comando'])
    + sfCampo('TEL SO Comando', c['Telefono SO Comando'])
    + sfCampo('Direzione', c['Direzione VVF'])
    + sfCampo('CH VHF Direzione', c['Canale Radio Direzione'])
    + sfCampo('Indirizzo', c['Indirizzo Completo']);
}

/* Erano otto campi in un riquadro solo, su due colonne, e la lettura si
   perdeva: il numero d'intervento finiva accanto al telefono del DOS. Sono
   due cose diverse — QUANDO e DOVE succede, e CHI lo dirige — e vanno lette
   separate, come separate le si detta per radio. */
function sfBloccoIntervento(){
  const i = intestazione();
  return sfCampo(t('nIntervento'), i.intervento)
    + sfCampo(t('dataOra'), fmtOra(oraRedazione || new Date()))
    + sfCampo(t('provincia'), provinciaDos
        ? `${provinciaDos.sigla || ''} ${provinciaDos.nome || ''}`.trim() : '')
    + sfCampo(t('posDos'), i.posizione);
}

function sfBloccoDos(){
  const i = intestazione();
  return sfCampo(t('nQualifica'), i.qualifica)
    + sfCampo(t('nNominativo'), i.nominativo)
    + sfCampo(t('nDos'), i.dos)
    + sfCampo(t('nTelefono'), i.telefono);
}

/* Il nome del file lo decide il titolo del documento: la finestra di stampa
   del browser lo propone così com'è. Senza, esce "FireOps VVF.pdf" per ogni
   SITAC di ogni intervento, e in una cartella di sala non si distinguono. */
function nomeStampa(){
  const i = intestazione();
  const d = oraRedazione || new Date();
  const dd = n => String(n).padStart(2, '0');
  const data = `${d.getFullYear()}${dd(d.getMonth()+1)}${dd(d.getDate())}`
    + `-${dd(d.getHours())}${dd(d.getMinutes())}`;
  const cmd = (comandoSitac || window.FireOpsComandoAttivo || {}).Comando || '';
  const puliscia = s => String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ['SITAC', i.intervento, data, puliscia(cmd),
          puliscia(i.dos), puliscia(i.nominativo)]
    .filter(Boolean).join('_');
}

/* Stessa scansione di aggiornaLegenda, ma il markup è quello del foglio:
   la legenda a schermo vive dentro .sitac-mapwrap, che in stampa finisce
   sotto la carta e verrebbe coperta. */
function sfLegenda(){
  const visti = new Map();
  disegni.eachLayer(x => {
    if (!x._tipo) return;
    const k = x._tipo + '|' + (x._stato || '');
    if (!visti.has(k)) visti.set(k, x);
  });
  if (!visti.size) return `<p class="sf-vuoto">${esc(t('legVuota'))}</p>`;

  const righe = [];
  visti.forEach(x => {
    const k = x._tipo;
    if (LIN[k]){
      const d = LIN[k];
      righe.push(`<div><i class="sf-tratto sf-tratto-lin">`
        + `${NS.SITAC_ANTEPRIMA(k, x._stato)}</i>`
        + `<span>${esc(nm(d) + statoDi(d, x._stato))}</span></div>`);
    } else if (AREE[k]){
      const d = AREE[k];
      righe.push(`<div><i class="sf-tratto" style="height:3mm;border-radius:.5mm;`
        + `background:${d.fillColor};opacity:.85;border:.4mm solid ${d.color}"></i>`
        + `<span>${esc(nm(d))}</span></div>`);
    } else if (SIM[k]){
      righe.push(`<div><span class="sf-sim">${svgSimbolo(k, {stato: x._stato})}</span>`
        + `<span>${esc(nm(SIM[k]) + statoDi(SIM[k], x._stato))}</span></div>`);
    } else if (k === 'nota'){
      righe.push(`<div><span class="sf-sim">\u270e</span>`
        + `<span>${esc(nm(NOTA))}</span></div>`);
    }
  });
  return righe.join('');
}

/* Ettari per la radio, metri quadri sotto l'ettaro, chilometri quadri per
   gli incendi grandi: sono tre letture della stessa misura e chi riceve il
   foglio non deve rifare la divisione a mano. */
function sfTabellaAree(){
  const per = new Map();
  disegni.eachLayer(x => {
    if (!AREE[x._tipo]) return;
    const r = per.get(x._tipo) || {n:0, mq:0, per:0};
    r.n++; r.mq += areaMq(x); r.per += perimetroM(x);
    per.set(x._tipo, r);
  });
  if (!per.size) return `<p class="sf-vuoto">\u2014</p>`;

  let righe = '', coinvolta = 0;
  per.forEach((r, k) => {
    if (AREE_SUPERFICIE.indexOf(k) >= 0) coinvolta += r.mq;
    righe += `<tr><td>${esc(nm(AREE[k]))}</td><td>${r.n}</td>`
      + `<td>${(r.mq / 10000).toFixed(2)}</td>`
      + `<td>${inMq(r.mq)}</td>`
      + `<td>${(r.mq / 1e6).toFixed(4)}</td>`
      + `<td>${(r.per / 1000).toFixed(2)}</td></tr>`;
  });
  righe += `<tr class="sf-tot"><td>Superficie coinvolta (percorsa + a fuoco attivo)</td>`
    + `<td>\u2014</td><td>${(coinvolta / 10000).toFixed(2)}</td>`
    + `<td>${inMq(coinvolta)}</td><td>${(coinvolta / 1e6).toFixed(4)}</td>`
    + `<td>\u2014</td></tr>`;

  return `<table class="sf-tab"><thead><tr><th>Area</th><th>N.</th><th>ha</th>`
    + `<th>m\u00b2</th><th>km\u00b2</th><th>perimetro km</th></tr></thead>`
    + `<tbody>${righe}</tbody></table>`;
}

function sfTabellaVento(){
  if (!ventoCono) return `<p class="sf-vuoto">\u2014</p>`;
  const V = NS.SitacVento;
  const ora = ventoCono.letto
    ? new Date(ventoCono.letto).toLocaleTimeString(lingua) : '\u2014';
  const avanza = m => Math.round(V.distanzaFronte(ventoCono.velocita, m)) + ' m';

  return `<table class="sf-tab"><tbody>`
    + `<tr><th>Intensit\u00e0</th><td>${esc(String(ventoCono.velocita))} km/h`
    + ` \u00b7 ${esc(t(V.simboloVento(ventoCono.velocita)))}</td></tr>`
    + `<tr><th>Direzione (verso cui va)</th><td>${esc(String(ventoCono.verso))}\u00b0</td></tr>`
    + `<tr><th>Provenienza</th><td>${esc(String(ventoCono.provenienza != null
        ? ventoCono.provenienza : (ventoCono.verso + 180) % 360))}\u00b0</td></tr>`
    + `<tr><th>Fonte del dato</th><td>${esc(String(ventoCono.fonte || '\u2014'))}</td></tr>`
    + `<tr><th>Rilevato alle</th><td>${esc(ora)}</td></tr>`
    + `<tr><th>Apertura del cono</th><td>${esc(String(V.APERTURA))}\u00b0`
    + `</td></tr>`
    + `<tr><th>Avanzamento del fronte</th><td>15 min ${avanza(15)}`
    + ` \u00b7 30 min ${avanza(30)} \u00b7 60 min ${avanza(60)}</td></tr>`
    + `</tbody></table>`;
}

function sfTabellaConi(){
  if (!coni.length) return `<p class="sf-vuoto">\u2014</p>`;
  const righe = coni.map(c => `<tr><td>${c.id}</td><td>${esc(c.tipo)}</td>`
    + `<td>${c.tipo === 'pendenza'
        ? esc(Math.round(c.mh) + ' m/h')
        : esc(c.vento.velocita + ' km/h')}</td>`
    + `<td>${esc(String(c.vento.verso))}\u00b0</td>`
    + `<td>${c.pendenza != null ? esc((c.pendenza * 100).toFixed(0) + '%')
        : c.fattori ? esc(c.fattori.map(f => '\u00d7' + f.k.toFixed(1)).join(' '))
        : '\u2014'}</td>`
    + `<td>${esc(String(c.vento.fonte || '\u2014'))}</td></tr>`).join('');
  return `<table class="sf-tab"><thead><tr><th>N.</th><th>Costruzione</th>`
    + `<th>Velocit\u00e0</th><th>Direzione</th><th>Pendenza</th><th>Fonte</th></tr></thead>`
    + `<tbody>${righe}</tbody></table>`;
}

function sfTabellaLinee(){
  const per = new Map();
  disegni.eachLayer(x => {
    if (!LIN[x._tipo]) return;
    const k = x._tipo + '|' + (x._stato || '');
    const r = per.get(k) || {tipo:x._tipo, stato:x._stato, n:0, m:0};
    r.n++; r.m += lunghezzaM(x);
    per.set(k, r);
  });
  if (!per.size) return `<p class="sf-vuoto">\u2014</p>`;
  let righe = '';
  per.forEach(r => {
    righe += `<tr><td>${esc(nm(LIN[r.tipo]) + statoDi(LIN[r.tipo], r.stato))}</td>`
      + `<td>${r.n}</td><td>${(r.m / 1000).toFixed(2)}</td></tr>`;
  });
  return `<table class="sf-tab"><thead><tr><th>Elemento</th><th>N.</th>`
    + `<th>lunghezza km</th></tr></thead><tbody>${righe}</tbody></table>`;
}

/* Gradi decimali per il copia-incolla in SO115, gradi primi secondi per
   dettarli via radio: sulla carta stampata servono tutti e due. */
function sfDms(v, pos, neg){
  const a = Math.abs(v);
  const g = Math.floor(a);
  const m = Math.floor((a - g) * 60);
  const s = ((a - g) * 60 - m) * 60;
  return `${g}° ${String(m).padStart(2, '0')}' ${s.toFixed(1)}" `
    + (v < 0 ? neg : pos);
}

function sfTabellaInneschi(){
  const punti = [];
  disegni.eachLayer(x => { if (x._tipo === 'origine' && x.getLatLng) punti.push(x); });
  if (!punti.length) return `<p class="sf-vuoto">\u2014</p>`;

  const righe = punti.map((x, i) => {
    const p = x.getLatLng();
    return `<tr><td>${i + 1}${x._testo ? ' \u2014 ' + esc(x._testo) : ''}</td>`
      + `<td>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</td>`
      + `<td>${esc(sfDms(p.lat, 'N', 'S'))}</td>`
      + `<td>${esc(sfDms(p.lng, 'E', 'O'))}</td></tr>`;
  }).join('');

  return `<table class="sf-tab"><thead><tr><th>Innesco</th>`
    + `<th>Gradi decimali</th><th>Latitudine</th><th>Longitudine</th>`
    + `</tr></thead><tbody>${righe}</tbody></table>`;
}

/* I tile della nuova inquadratura arrivano dopo il fitBounds: stampare
   subito darebbe una carta a mattonelle grigie. Si aspetta il `load` del
   fondo attivo, con un tetto perché su rete lenta o cache vuota quel
   segnale può non arrivare mai. */
function attendiTile(ms){
  return new Promise(risolvi => {
    let fatto = false;
    const fine = () => { if (!fatto){ fatto = true; risolvi(); } };
    sfondi[iSfondo].l.once('load', fine);
    setTimeout(fine, ms);
  });
}

/* Chi c'è a terra, previsto e in atto. Sulla carta i simboli si contano a
   occhio e si sbaglia; sul foglio è un elenco, con le sigle accanto — che
   sono poi i numeri che si chiamano per radio. Il DOS e il Posto di
   Comando entrano: fanno parte del dispositivo a terra tanto quanto le
   squadre, e chi riceve il foglio vuole sapere se il CP era già attivo. */
function sfTabellaSquadre(){
  const per = new Map();
  disegni.eachLayer(x => {
    const d = SIM[x._tipo];
    if (!d || d.sg !== 'sgTerra' || x._genere === 'lancio') return;
    const k = x._tipo + '|' + (x._stato || '');
    const r = per.get(k) || {tipo:x._tipo, stato:x._stato, n:0, id:[]};
    r.n++;
    const sig = [x._paese ? nmStato(x._paese) : '', x._testo || '']
      .filter(Boolean).join(' ');
    if (sig) r.id.push(sig);
    per.set(k, r);
  });
  if (!per.size) return `<p class="sf-vuoto">\u2014</p>`;

  let prev = 0, att = 0, righe = '';
  per.forEach(r => {
    if (r.stato === 'attivo') att += r.n; else prev += r.n;
    const d = SIM[r.tipo];
    righe += `<tr><td>${esc(nm(d))}</td>`
      + `<td>${esc(t(paroleStato(d)[r.stato === 'attivo' ? 1 : 0]))}</td>`
      + `<td>${r.n}</td>`
      + `<td>${r.id.length ? esc(r.id.join(' \u00b7 ')) : '\u2014'}</td></tr>`;
  });
  righe += `<tr class="sf-tot"><td>Totale</td>`
    + `<td>previste ${prev} \u00b7 attive ${att}</td>`
    + `<td>${prev + att}</td><td>\u2014</td></tr>`;

  return `<table class="sf-tab"><thead><tr><th>Squadra / mezzo a terra</th>`
    + `<th>Stato</th><th>N.</th><th>Sigle</th></tr></thead>`
    + `<tbody>${righe}</tbody></table>`;
}

/* I mezzi aerei sono quelli che si sentono per radio. Il volume è la
   capacità nominale di un lancio pieno: serve a dare un ordine di
   grandezza sul foglio, non a rendicontare. Zero = non si stima. */
const MEZZI_AEREI = [
  {k:'canadair', n:'Canadair CL-415',            l:6100},
  {k:'s64',      n:'Erickson S-64 Air Crane',    l:9500},
  {k:'fireboss', n:'Fire Boss AT-802F',          l:3100},
  {k:'drago',    n:'Elicottero VVF (Drago)',     l:1000},
  {k:'elireg',   n:'Elicottero regionale',       l:0},
  {k:'altro',    n:'Altro mezzo aereo',          l:0}
];
let lanciAerei = null;      // sopravvive fra due stampe: si ristampa senza ridigitare

/* Stessi elementi del modale, ma al posto del campo unico una riga per
   mezzo. Quello che resta vuoto non è intervenuto e non compare: la
   tabella dice chi ha lanciato, non l'elenco della flotta nazionale. */
function chiediLanci(){
  return new Promise(risolvi => {
    const testo = modale.querySelector('.sitac-modale-testo');
    const input = modale.querySelector('#sitac-modale-input');
    const ok = modale.querySelector('#sitac-modale-ok');
    const no = modale.querySelector('#sitac-modale-no');
    let chiuso = false;
    const fine = val => {
      if (chiuso) return;
      chiuso = true;
      modale.hidden = true; chiudiModale = null;
      input.style.display = ''; ok.style.display = ''; testo.textContent = '';
      risolvi(val);
    };

    modale.querySelector('.sitac-modale-titolo').textContent = t('titoloModale');
    testo.textContent = '';
    const p = document.createElement('p');
    p.textContent = t('lanciChiedi');
    testo.appendChild(p);

    const el = document.createElement('div');
    el.className = 'sitac-lanci';
    const campi = {};
    MEZZI_AEREI.forEach(m => {
      const r = document.createElement('label');
      r.className = 'sitac-lancio-riga';
      r.innerHTML = `<span>${esc(m.n)}</span>`;
      const i = document.createElement('input');
      i.type = 'text'; i.inputMode = 'numeric'; i.placeholder = '0';
      const gia = lanciAerei && lanciAerei[m.k];
      i.value = gia ? String(gia.lanci) : '';
      i.oninput = () => { i.value = i.value.replace(/[^0-9]/g, '').slice(0, 3); };
      r.appendChild(i);
      campi[m.k] = i;
      el.appendChild(r);
    });
    testo.appendChild(el);
    const nota = document.createElement('p');
    nota.className = 'sitac-lanci-nota';
    nota.textContent = t('lanciNota');
    testo.appendChild(nota);

    input.style.display = 'none';
    ok.style.display = '';
    ok.textContent = t('ok');
    no.textContent = t('annulla');
    ok.onclick = () => {
      const out = {};
      MEZZI_AEREI.forEach(m => {
        const n = Number(campi[m.k].value) || 0;
        if (n > 0) out[m.k] = {nome:m.n, lanci:n, litri: m.l ? n * m.l : 0};
      });
      fine(out);
    };
    no.onclick = () => fine(null);
    chiudiModale = () => fine(null);
    modale.hidden = false;
    setTimeout(() => { const f = el.querySelector('input'); if (f) f.focus(); }, 30);
  });
}

/* Niente mezzi aerei, niente sezione: un titolo con sotto una riga di
   trattini fa credere che il dato manchi, non che non ci sia stato. */
function sfBloccoLanci(){
  if (!lanciAerei) return '';
  let righe = '', tot = 0, litri = 0;
  MEZZI_AEREI.forEach(m => {
    const r = lanciAerei[m.k];
    if (!r) return;
    tot += r.lanci; litri += r.litri;
    righe += `<tr><td>${esc(r.nome)}</td><td>${r.lanci}</td>`
      + `<td>${r.litri ? r.litri.toLocaleString('it-IT') : '\u2014'}</td></tr>`;
  });
  if (!righe) return '';
  const disegnati = disegni.getLayers().filter(x => x._genere === 'lancio').length;
  return `<h2>Dispositivo aereo</h2>`
    + `<table class="sf-tab"><thead><tr><th>Mezzo</th><th>N. lanci</th>`
    + `<th>Volume stimato L</th></tr></thead><tbody>${righe}`
    + `<tr class="sf-tot"><td>${esc(t('lanciTot'))}</td><td>${tot}</td>`
    + `<td>${litri ? litri.toLocaleString('it-IT') : '\u2014'}</td></tr></tbody></table>`
    + `<p class="sf-nota">Volumi nominali a pieno carico.`
    + (disegnati ? ` Lanci riportati sulla carta: ${disegnati}.` : '') + `</p>`;
}

/* I pieni della tavola sono tarati per lo schermo. Su carta un grigio al 50%
   sopra l'ortofoto copre proprio il terreno che chi riceve il foglio deve
   leggere: si alleggerisce il riempimento e si tiene il contorno, che è
   quello che porta l'informazione. I metri veri non si toccano. */
const PIENO_STAMPA = 0.18;
let stiliPrima = null;

function alleggerisciPerStampa(){
  stiliPrima = [];
  disegni.eachLayer(l => {
    if (!l.setStyle || !l.options) return;
    if (l._glifo) return;              // lancio ridotto a simbolo: già trasparente
    const o = l.options;
    stiliPrima.push([l, {fillOpacity:o.fillOpacity, opacity:o.opacity, weight:o.weight}]);
    l.setStyle({
      fillOpacity: o.fillOpacity ? Math.min(o.fillOpacity, PIENO_STAMPA) : 0,
      opacity: 1,
      weight: Math.max(1.4, (o.weight || 2) * 0.75)});
  });
}
function ripristinaStile(){
  if (!stiliPrima) return;
  stiliPrima.forEach(([l, s]) => l.setStyle(s));
  stiliPrima = null;
}

function sfTabellaNote(){
  if (!note.length) return `<p class="sf-vuoto">\u2014</p>`;
  const righe = note.map(n => `<tr><td>${esc(fmtOra(n.quando))}</td>`
    + `<td>${esc(n.testo)}</td></tr>`).join('');
  return `<table class="sf-tab"><thead><tr><th>Ora</th><th>Nota</th>`
    + `</tr></thead><tbody>${righe}</tbody></table>`;
}

async function stampa(){
  /* I lanci non stanno sulla carta: si contano a voce lungo la giornata, e
     il numero lo sa solo chi ha tenuto il conto. Si chiede qui, una volta,
     prima di mandare il foglio in stampa. Annulla ferma la stampa: chi
     stava per firmare un foglio incompleto se ne accorge adesso. */
  const lanci = await chiediLanci();
  if (lanci === null) return stato(t('stampaAnnullata'));
  lanciAerei = Object.keys(lanci).length ? lanci : null;
  const f = creaFoglioStampa();
  const quando = fmtOra(oraRedazione || new Date());
  const i = intestazione();
  const avvertenza = coni.some(c => c.fattori) && NS.SitacRilievo
    ? `<p class="sf-avvertenza">${esc(NS.SitacRilievo.avvertenza[lingua]
        || NS.SitacRilievo.avvertenza.it)}</p>` : '';

  f.innerHTML =
    `<section class="sf-pagina sf-pagina-carta">
       <header class="sf-testata">
         <h1>${esc(t('stTitolo'))}</h1>
         <p>${esc(t('stData', {d: quando}))}</p>
       </header>
       <div class="sf-dati">
         <div class="sf-box"><h2>Intervento</h2>${sfBloccoIntervento()}</div>
         <div class="sf-box"><h2>Comando competente</h2>${sfBloccoComando()}</div>
         <div class="sf-box sf-box-dos"><h2>Direttore delle operazioni di spegnimento</h2>${sfBloccoDos()}</div>
       </div>
       <div class="sf-carta">
         <div class="sf-mappa" id="sitac-stampa-mappa"></div>
         <aside class="sf-legenda"><h2>${esc(t('legenda'))}</h2>${sfLegenda()}</aside>
       </div>
     </section>
     <section class="sf-pagina sf-pagina-dati">
       <header class="sf-testata">
         <h1>Riepilogo dei dati</h1>
         <p>${esc(t('stTitolo'))} \u00b7 ${esc(quando)}</p>
       </header>
        <h2>Punti d'innesco</h2>${sfTabellaInneschi()}
       <h2>Superfici</h2>${sfTabellaAree()}
       <h2>Vento</h2>${sfTabellaVento()}
       <h2>Coni di propagazione</h2>${sfTabellaConi()}${avvertenza}
       <h2>${esc(t('stSquadre'))}</h2>${sfTabellaSquadre()}
        ${sfBloccoLanci()}
       <h2>Linee tracciate</h2>${sfTabellaLinee()}
       <h2>${esc(t('stNote'))}</h2>${sfTabellaNote()}
     </section>`;

  /* La mappa viva si sposta dentro il foglio e poi torna esattamente dov'era:
     un secondo Leaflet solo per la stampa vorrebbe ricostruire ogni simbolo,
     ogni decorazione e ogni cono. */
  const wrap = q('.sitac-mapwrap');
  segnoMappa = document.createComment('sitac-mappa');
  wrap.parentNode.insertBefore(segnoMappa, wrap);
  f.querySelector('#sitac-stampa-mappa').appendChild(wrap);
  document.body.classList.add('sitac-stampa');

  /* Le maniglie sono comandi, non rilievo: stampate sembrano vertici veri, e
     chi legge il foglio non ha niente da trascinare. Anche la selezione se
     ne va, o un elemento resta evidenziato senza motivo. */
  selezionaElemento(null);
  alleggerisciPerStampa();

  const titoloPrima = document.title;
  document.title = nomeStampa();

  const vistaPrima = {c: map.getCenter(), z: map.getZoom()};
  map.invalidateSize();

  /* La carta stampata inquadra il DISEGNO, non quello che si stava
     guardando: chi la riceve vuole l'incendio intero, non la porzione su
     cui era rimasto lo zoom di chi l'ha redatta. I coni stanno nei decori,
     quindi entrano anche loro nel calcolo. */
  let b = disegni.getBounds();
  coni.forEach(c => {
    const e = estremiDi(c.layer);
    if (!e || !e.isValid()) return;
    b = b.isValid() ? b.extend(e) : L.latLngBounds(e.getSouthWest(), e.getNorthEast());
  });
  if (b.isValid()) map.fitBounds(b, {padding:[28, 28]});

  await attendiTile(2500);

  const ripristina = () => {
    window.removeEventListener('afterprint', ripristina);
    document.title = titoloPrima;
    ripristinaStile();
    document.body.classList.remove('sitac-stampa');
    segnoMappa.parentNode.insertBefore(wrap, segnoMappa);
    segnoMappa.remove();
    segnoMappa = null;
    setTimeout(() => {
      map.invalidateSize();
      map.setView(vistaPrima.c, vistaPrima.z);
      adatta();
    }, 60);
  };
  window.addEventListener('afterprint', ripristina);
  window.print();
}

  /* La sezione nasce nel magazzino e vive dentro un pannello che cambia
     larghezza: qui si fanno due cose insieme, il ridisegno della mappa e la
     classe .sitac-stretto (stesso criterio di .um-root.narrow, perche' in
     split-screen un pannello puo' essere stretto anche su schermo largo). */
  const LARGHEZZA_STRETTA = 620;
  function adatta(){
    if (app.offsetParent === null) return;          // in magazzino: niente da fare
    const stretto = app.clientWidth < LARGHEZZA_STRETTA;
    app.classList.toggle('sitac-stretto', stretto);
    radice.classList.toggle('sitac-sez-stretta', stretto);
    /* La mappa vive nella scheda 2: se è chiusa, invalidateSize la
       registrerebbe a zero e al rientro i tile restano grigi. */
    const carta = q('.sitac-pannello[data-scheda="carta"]');
    if (carta && carta.classList.contains('attivo')) map.invalidateSize();
  }
    /* Leaflet non sopporta di nascere o riapparire senza dimensioni: ogni
     volta che la carta torna a schermo va rimisurata. */
  function vaiAScheda(k){
    qq('.sitac-scheda-btn').forEach(b =>
      b.classList.toggle('attivo', b.dataset.scheda === k));
    qq('.sitac-pannello').forEach(p =>
      p.classList.toggle('attivo', p.dataset.scheda === k));
    if (k === 'carta') setTimeout(() => { map.invalidateSize(); adatta(); }, 0);
  }
  qq('.sitac-scheda-btn').forEach(b => {
    b.onclick = () => {
      /* Passare alla carta È la conferma. Chi ha compilato tutto e clicca
         sulla seconda linguetta ha già detto quello che direbbe premendo
         Convalida, e chiederglielo due volte è un passaggio a vuoto —
         vale anche dopo una Modifica, dove il pulsante resta necessario
         solo finché i campi non sono a posto. */
      if (b.dataset.scheda === 'carta' && !datiBloccati && datiCompleti())
        convalida({auto:1});
      vaiAScheda(b.dataset.scheda);
      if (b.dataset.scheda === 'carta' && !datiConvalidati) stato(t('cartaBloccata'));
    };
  });
  if (window.ResizeObserver) new ResizeObserver(adatta).observe(app);
  setTimeout(adatta, 150);

  /* comando attivo condiviso con script.js / convertitore.js: si sposta la
     vista solo se il GPS non ha risposto e non c'è ancora nulla disegnato */
  window.addEventListener('fireops:comando-attivo-cambiato', ev => {
    const d = ev.detail || {};
    const la = parseFloat(d.lat != null ? d.lat : d.latitudine);
    const lo = parseFloat(d.lon != null ? d.lon : d.longitudine);
    if (!isNaN(la) && !isNaN(lo)){
      if (!posizioneOttenuta && !disegni.getLayers().length) map.setView([la, lo], 12);
    } else tornaAlComando();
  });

  return {
    map, disegni, coni,
    lingua: lg => cambiaLingua(lg),
    stato: (tavola, s) => cambiaStato(tavola, s),
    esportaGeoJson: raccogli,
    vento: () => ventoCono,
    carica,
    pulisci: () => {
      disegni.clearLayers(); decori.clearLayers();
      coni.length = 0; mostraVento(null); cerchioPosizione = null; posizioneOttenuta = false;
      aggiornaStato();
    },
    ridisegna: adatta
  };
}

/* ---------------------------------------------------------------------
   Avvio
   ------------------------------------------------------------------- */
let istanza = null;

NS.Sitac = {
  /* Idempotente: il sistema pannelli sposta la sezione fra pannello e
     magazzino, quindi init() può essere richiamato quante volte serve. */
  init(){
    if (istanza) { istanza.ridisegna(); return istanza; }

    const app = document.getElementById('sitac-app');
    if (!app) return null;                       // sezione non ancora nel DOM
    const radice = app.closest('.page-section') || app;

    /* La guardia elenca TUTTO quello che avvia() tocca senza rete: se il
       markup è indietro rispetto al codice, si vede subito quale pezzo
       manca invece di un TypeError a metà costruzione. */
    for (const id of ['sitac-barra','sitac-mappa','sitac-tavola','sitac-stato',
                      'sitac-lingue','sitac-modale','sitac-legenda','sitac-legTesta',
                      'sitac-legVoci','sitac-vento','sitac-testata-stampa',
                      'sitac-nIntervento','sitac-nDos','sitac-nominativo',
                      'sitac-telefono','sitac-posizione','sitac-bPosizione',
                      'sitac-bConvalida','sitac-bCentra','sitac-bModifica',
                      'sitac-bElimina','sitac-bAnnulla','sitac-bPulisci',
                      'sitac-bSfondo','sitac-bImporta','sitac-bStampa',
                      'sitac-bGeojson','sitac-bKml','sitac-file',
                      'sitac-qualifica','sitac-dataOra','sitac-carta',
                      'sitac-bPulisciDati',
                      'sitac-provincia','sitac-comando','sitac-bVentoDir','sitac-bVentoWeb','sitac-ventoScala','sitac-ventoValore' ]){
      if (!radice.querySelector('#' + id)){
        console.error('[SITAC] manca #' + id + ' nel markup della sezione.');
        return null;
      }
    }
    const box = radice.querySelector('#sitac-stato');
    if (!NS.SITAC_SIMBOLI || !NS.SITAC_LINEE){
      box.textContent = 'Simbologia mancante: sitac-simboli.js deve precedere sitac.js.';
      console.error('[SITAC] sitac-simboli.js non caricato.');
      return null;
    }
    if (!NS.SitacVento){
      box.textContent = 'Modulo vento mancante: sitac-vento.js deve precedere sitac.js.';
      console.error('[SITAC] sitac-vento.js non caricato.');
      return null;
    }
    if (typeof L === 'undefined' || !L.PM || !L.Symbol || !L.Symbol.arrowHead){
      box.textContent = 'Librerie mancanti: servono Leaflet, Geoman e PolylineDecorator.';
      console.error('[SITAC] Geoman o PolylineDecorator non caricati.');
      return null;
    }
    istanza = avvia(app);
    return istanza;
  },
  get(){ return istanza; }
};

/* -----------------------------------------------------------------------
   Aggancio al sistema pannelli.

   La sezione #sitac-aib viaggia fra i due pannelli e il magazzino, e Leaflet
   non sopporta di riapparire senza dimensioni: serve un invalidateSize ogni
   volta che torna a schermo.

   L'osservazione e' limitata ai DUE contenitori dei pannelli, con childList
   e SENZA subtree: le sezioni sono figlie dirette di #corpo-sinistra e
   #corpo-destra, quindi tanto basta. Osservare .split-screen con subtree:true
   sembra piu' sicuro ma e' la scelta sbagliata: ogni tile che Leaflet inserisce
   nella mappa e' una mutazione dentro quel sottoalbero, e ogni spostamento
   della mappa scatenerebbe decine di invalidateSize inutili (misurati: 56 per
   otto spostamenti), ognuno dei quali forza un ricalcolo del layout.
   --------------------------------------------------------------------- */
function agganciaPannelli(){
  const sezione = document.getElementById('sitac-aib');
  if (!sezione) return;

  const risveglia = () => {
    if (sezione.offsetParent === null) return;   // ancora nel magazzino
    const i = NS.Sitac.init();                   // prima apertura: costruisce
    if (i) i.ridisegna();                        // gia' viva: solo ridisegno
  };

  ['corpo-sinistra','corpo-destra'].forEach(id => {
    const corpo = document.getElementById(id);
    if (corpo) new MutationObserver(risveglia).observe(corpo, { childList:true });
  });

  window.addEventListener('resize', () => {
    const i = NS.Sitac.get();
    if (i && sezione.offsetParent !== null) i.ridisegna();
  });

  risveglia();
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', agganciaPannelli);
else agganciaPannelli();

})();
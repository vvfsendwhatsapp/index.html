document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("modal-comando");
    const modalContent = modal.querySelector(".modal-content");
    const modalClose = modal.querySelector(".modal-close");
    const selectComando = document.getElementById("select-comando");
    const btnConferma = document.getElementById("btn-conferma-comando");
    const displayComando = document.getElementById("display-comando");
    const btnCambiaComando = document.getElementById("btn-cambia-comando");

    const CHIAVE_STORAGE = "fireops_comando_selezionato";
    let comandiData = [];
    let direzioniData = [];
    let conData = null;   // record singolo, nazionale
    let socavData = null; // record singolo, nazionale
    let prefissiData = []; // elenco prefissi internazionali
    let lingueData = [];   // elenco lingue disponibili per Messaggistica
    let moduliCMRData = []; // elenco moduli della Circolare EM-01/2020 (Colonne Mobili Regionali)
    let linkUtiliData = []; // elenco link utili organizzati per tema, per la pagina "Link Utili"
    let sostanzePericoloseData = []; // database locale schede ICSC (numero, nome, sinonimi)
    let modalChiudibile = false; // true solo quando riaperto manualmente col pulsante ☰

    Promise.all([
        fetch("/FireOps/db/comandi.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare comandi.json");
            return r.json();
        }),
        fetch("/FireOps/db/direzioni.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare direzioni.json");
            return r.json();
        }),
        fetch("/FireOps/db/CON.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare CON.json");
            return r.json();
        }),
        fetch("/FireOps/db/SOCAV.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare SOCAV.json");
            return r.json();
        }),
        fetch("/FireOps/db/prefissi.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare prefissi.json");
            return r.json();
        }),
        fetch("/FireOps/db/lingue.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare lingue.json");
            return r.json();
        }),
        fetch("/FireOps/db/moduliCMR.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare moduliCMR.json");
            return r.json();
        }),
        fetch("/FireOps/db/linkUtili.json").then(r => {
            if (!r.ok) throw new Error("Impossibile trovare linkUtili.json");
            return r.json();
        })
    ])
    .then(([comandi, direzioni, con, socav, prefissi, lingue, moduliCMR, linkUtili]) => {
        comandiData = comandi;
        window.FireOpsComandi = comandiData;
        direzioniData = direzioni;
        conData = Array.isArray(con) ? con[0] : con;
        socavData = Array.isArray(socav) ? socav[0] : socav;
        prefissiData = prefissi;
        lingueData = lingue;
        moduliCMRData = moduliCMR;
        linkUtiliData = linkUtili;

        selectComando.innerHTML = '<option value="" disabled selected>-- Seleziona Comando --</option>';
        comandi.forEach(c => {
            const option = document.createElement("option");
            option.value = c.Comando;
            option.textContent = c.Comando;
            selectComando.appendChild(option);
        });
        selectComando.disabled = false;

        // Popola i selettori della pagina Messaggistica (prefisso e lingua)
        popolaSelectPrefissoMsg(prefissiData);
        popolaSelectLinguaMsg(lingueData);

        // Popola il selettore ricercabile della pagina Moduli CMR
        popolaSelectModuloCMR(moduliCMRData);

        // Popola il selettore rapido della pagina "Info Altro Comando"
        try {
            popolaSelectAltroComando(comandiData);
        } catch (err) {
            console.error("Errore nel popolare il selettore Info Altro Comando:", err);
        }

        // Costruisce i pulsanti della pagina Link Utili
        renderLinkUtili(linkUtiliData);

        const comandoSalvato = sessionStorage.getItem(CHIAVE_STORAGE);
        if (comandoSalvato && comandiData.some(c => c.Comando === comandoSalvato)) {
            attivaComando(comandoSalvato);
            modal.style.display = "none";
        }
    })
    .catch(error => {
        console.error("Errore nel caricamento dei dati:", error);
        selectComando.innerHTML = '<option value="" disabled selected>Errore caricamento comandi</option>';
    });

    // Database locale delle schede ICSC: caricato separatamente e non bloccante.
    // Se questo file manca o fallisce, il resto dell'app (Comandi, Link Utili, ecc.)
    // continua a funzionare normalmente: la ricerca ICSC per nome resta solo "best-effort"
    fetch("/FireOps/db/sostanzepericolose.json")
        .then(r => {
            if (!r.ok) throw new Error("Impossibile trovare sostanzepericolose.json");
            return r.json();
        })
        .then(dati => {
            sostanzePericoloseData = dati;
            popolaComboSostanzePericolose(sostanzePericoloseData);
        })
        .catch(err => {
            console.error("Database sostanze pericolose non disponibile:", err);
        });

    function attivaComando(nomeComando) {
        sessionStorage.setItem(CHIAVE_STORAGE, nomeComando);
        displayComando.textContent = `Sala Operativa - Comando VVF ${nomeComando}`;

        const homeNomeComando = document.getElementById("home-nome-comando");
        if (homeNomeComando) homeNomeComando.textContent = nomeComando;

        const comandoSelezionato = comandiData.find(c => c.Comando === nomeComando);
        renderRiepilogoComando(comandoSelezionato, comandiData, direzioniData, conData, socavData);
        aggiornaMappaEMeteo(comandoSelezionato);
        // Il messaggio precompilato dipende dal Comando attivo: lo rigenero
        generaMessaggioMessaggistica();
        // I link mappa (Mappe > SAR) puntano alle coordinate del Comando attivo: li rigenero
        if (linkUtiliData.length > 0) renderLinkUtili(linkUtiliData);
        // NUOVO: unica fonte di verità del Comando attivo, condivisa con convertitore.js
        // (che non deve più rifare un proprio fetch indipendente, sempre a rischio di
        // disallineamento/timing rispetto a questo, l'unico punto che gestisce davvero la selezione)
        window.FireOpsComandoAttivo = comandoSelezionato || null;
        document.dispatchEvent(new CustomEvent("fireops:comando-attivo-cambiato", { detail: comandoSelezionato }));
}

    // Apre il modale in modalità "cambio comando" (chiudibile)
    function apriModaleCambioComando() {
        modalChiudibile = true;
        modalContent.classList.add("chiudibile");

        const comandoAttuale = sessionStorage.getItem(CHIAVE_STORAGE);
        if (comandoAttuale) {
            selectComando.value = comandoAttuale;
            btnConferma.disabled = false;
        }

        modal.style.display = "flex";
    }

    // Chiude il modale solo se è stato aperto manualmente (mai alla prima selezione obbligatoria)
    function chiudiModaleSeConsentito() {
        if (!modalChiudibile) return;
        modal.style.display = "none";
        modalContent.classList.remove("chiudibile");
        modalChiudibile = false;
    }

    btnCambiaComando.addEventListener("click", apriModaleCambioComando);
    modalClose.addEventListener("click", chiudiModaleSeConsentito);

    // Chiude cliccando sull'overlay fuori dal box (solo se chiudibile)
    modal.addEventListener("click", (e) => {
        if (e.target === modal) chiudiModaleSeConsentito();
    });

    // Chiude con ESC (solo se chiudibile)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") chiudiModaleSeConsentito();
    });

    selectComando.addEventListener("change", () => {
        if (selectComando.value) btnConferma.disabled = false;
    });

    btnConferma.addEventListener("click", () => {
        const scelto = selectComando.value;
        if (scelto) {
            attivaComando(scelto);
            modal.style.display = "none";
            modalContent.classList.remove("chiudibile");
            modalChiudibile = false;
        }
    });

    // Cerca un comando per nome esatto all'interno dell'elenco completo
    function trovaComandoPerNome(nome, lista) {
        return lista.find(c => c.Comando === nome);
    }

    // Cerca una direzione per nome esatto all'interno dell'elenco completo
    function trovaDirezionePerNome(nome, lista) {
        return lista.find(d => d["Direzione VVF"] === nome);
    }

    // ==========================================================
    // MAPPA E METEO DEL COMANDO ATTIVO (Leaflet + Open-Meteo, senza chiave API)
    // ==========================================================
    let mappaComandoLeaflet = null;
    let markerComandoLeaflet = null;
    let coordinateComandoAttivo = null; // ultime coordinate del Comando, per il pulsante "Torna al Comando"
    const ZOOM_VISTA_COMANDO = 11;   // zoom di dettaglio usato quando si seleziona/aggiorna il Comando
    const ZOOM_RITORNO_COMANDO = 11; // zoom più ampio usato dal pulsante "Torna al Comando"
    let layerBaseLeaflet = null;      // layer di sfondo attivo (grigia o OSM)
    let stileMappaAttuale = "chiara"; // stile di sfondo scelto dall'utente
    let crocinoCentroMappa = null;    // overlay fisso col mirino che indica il centro inquadratura
    let intervalloMeteo = null;

    // Interpretazione sintetica dei WMO Weather Code restituiti da Open-Meteo
    const METEO_CODICI = {
        0: ["☀️", "Sereno"],
        1: ["🌤️", "Prevalentemente sereno"],
        2: ["⛅", "Parzialmente nuvoloso"],
        3: ["☁️", "Nuvoloso"],
        45: ["🌫️", "Nebbia"],
        48: ["🌫️", "Nebbia con brina"],
        51: ["🌦️", "Pioviggine debole"],
        53: ["🌦️", "Pioviggine moderata"],
        55: ["🌧️", "Pioviggine intensa"],
        56: ["🌧️", "Pioviggine gelata debole"],
        57: ["🌧️", "Pioviggine gelata intensa"],
        61: ["🌧️", "Pioggia debole"],
        63: ["🌧️", "Pioggia moderata"],
        65: ["🌧️", "Pioggia forte"],
        66: ["🌧️", "Pioggia gelata debole"],
        67: ["🌧️", "Pioggia gelata forte"],
        71: ["🌨️", "Neve debole"],
        73: ["🌨️", "Neve moderata"],
        75: ["❄️", "Neve forte"],
        77: ["❄️", "Granelli di neve"],
        80: ["🌦️", "Rovesci di pioggia deboli"],
        81: ["🌧️", "Rovesci di pioggia moderati"],
        82: ["⛈️", "Rovesci di pioggia violenti"],
        85: ["🌨️", "Rovesci di neve deboli"],
        86: ["❄️", "Rovesci di neve forti"],
        95: ["⛈️", "Temporale"],
        96: ["⛈️", "Temporale con grandine debole"],
        99: ["⛈️", "Temporale con grandine forte"]
    };

    // Varianti notturne: servono solo per i codici la cui icona diurna contiene
    // il sole. Nuvoloso, nebbia, neve, temporale ecc. restano identici di notte.
    const METEO_CODICI_NOTTE = {
        0:  ["🌙",   "Sereno"],
        1:  ["🌙",   "Prevalentemente sereno"],
        2:  ["☁️", "Parzialmente nuvoloso"],
        51: ["🌧️",  "Pioviggine debole"],
        53: ["🌧️",  "Pioviggine moderata"],
        80: ["🌧️",  "Rovesci di pioggia deboli"],
        85: ["🌨️",  "Rovesci di neve deboli"]
    };

    function descrizioneMeteo(codice, isGiorno = true) {
        if (!isGiorno && METEO_CODICI_NOTTE[codice]) return METEO_CODICI_NOTTE[codice];
        return METEO_CODICI[codice] || ["🌡️", "Condizioni non disponibili"];
    }

    const ROSA_VENTI = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                    "S","SSO","SO","OSO","O","ONO","NO","NNO"];

    function settoreVento(gradi) {
        if (!Number.isFinite(gradi)) return "";
        return ROSA_VENTI[Math.round(gradi / 22.5) % 16];
    }

    // Open-Meteo restituisce is_day (1 = giorno, 0 = notte) allineato a hourly.time.
    // Se il campo mancasse (risposta parziale, cache vecchia), si ricade su una
    // stima grezza dall'ora locale invece di mostrare per forza il sole.
    function eOraDiGiorno(hourly, i) {
        if (Array.isArray(hourly.is_day)) return hourly.is_day[i] === 1;
        const ora = parseInt(String(hourly.time[i]).slice(11, 13), 10);
        return ora >= 7 && ora < 19;
    }

    // Estrae { lat, lng } dal campo "Coordinate" del comando (formato testuale "lat, lng")
    function estraiCoordinate(comando) {
        if (!comando || !comando["Coordinate"]) return null;
        const parti = comando["Coordinate"].split(",").map(s => parseFloat(s.trim()));
        if (parti.length !== 2 || parti.some(n => Number.isNaN(n))) return null;
        return { lat: parti[0], lng: parti[1] };
    }

// ==========================================================
    // VISTA PERSISTENTE: centro e zoom sopravvivono ai cambi di pagina
    // (i pannelli spostano la sezione nel magazzino, ma la mappa Leaflet
    // resta la stessa) e ai ricaricamenti dentro la stessa sessione.
    // ==========================================================
    const CHIAVE_STORAGE_VISTA = "fireops_vista_mappa";

    function salvaVistaMappa() {
        if (!mappaComandoLeaflet) return;
        const centro = mappaComandoLeaflet.getCenter();
        try {
            sessionStorage.setItem(CHIAVE_STORAGE_VISTA, JSON.stringify({
                lat: centro.lat,
                lng: centro.lng,
                zoom: mappaComandoLeaflet.getZoom()
            }));
        } catch (err) {}
    }

    function leggiVistaMappa() {
        try {
            const v = JSON.parse(sessionStorage.getItem(CHIAVE_STORAGE_VISTA));
            if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.zoom)) return v;
        } catch (err) {}
        return null;
    }

    // Crea la mappa Leaflet al primo utilizzo, altrimenti la ricentra sul nuovo Comando
    function aggiornaMappaComando(comando) {
        const contenitoreMappa = document.getElementById("mappa-comando");
        if (!contenitoreMappa || typeof L === "undefined") return;

        const coord = estraiCoordinate(comando);
        if (!coord) {
            contenitoreMappa.innerHTML = '<p class="pagina-nota">Coordinate del Comando non disponibili.</p>';
            return;
        }

        coordinateComandoAttivo = coord; // memorizzate per il pulsante "Torna al Comando"

        if (!mappaComandoLeaflet) {
            // All'apertura si riprende l'ultima inquadratura della sessione:
            // se la Sala stava guardando una zona precisa, un cambio pagina
            // non deve riportarla sulla caserma.
            const vista = leggiVistaMappa();
            mappaComandoLeaflet = vista
                ? L.map("mappa-comando").setView([vista.lat, vista.lng], vista.zoom)
                : L.map("mappa-comando").setView([coord.lat, coord.lng], ZOOM_VISTA_COMANDO);

            impostaStileMappa(stileEffettivo());
            markerComandoLeaflet = L.marker([coord.lat, coord.lng], { icon: iconaCasermaVVF() }).addTo(mappaComandoLeaflet);

            aggiornaCoordinateCentroMappa();
            // Coordinate aggiornate in tempo reale durante il trascinamento (leggero, solo testo)
            mappaComandoLeaflet.on("move", aggiornaCoordinateCentroMappa);

            // Centro e zoom sopravvivono ai cambi di pagina e ai ricaricamenti
            mappaComandoLeaflet.on("moveend zoomend", salvaVistaMappa);

            // Il meteo mostrato segue il centro della mappa: se l'utente la sposta,
            // le previsioni si aggiornano sulla nuova zona inquadrata
            mappaComandoLeaflet.on("moveend", () => {
                const centro = mappaComandoLeaflet.getCenter();
                aggiornaMeteoPerCoordinate({ lat: centro.lat, lng: centro.lng });
            });

            // Click sulla mappa: la ricentra dolcemente sul punto cliccato, senza cambiare zoom
            mappaComandoLeaflet.on("click", (e) => {
                mappaComandoLeaflet.panTo(e.latlng);
            });
        } else {
            mappaComandoLeaflet.setView([coord.lat, coord.lng], ZOOM_VISTA_COMANDO);
            markerComandoLeaflet.setLatLng([coord.lat, coord.lng]);
            // Se la mappa era nascosta (cambio pagina) le dimensioni interne vanno ricalcolate
            setTimeout(() => mappaComandoLeaflet.invalidateSize(), 100);
        }
        markerComandoLeaflet.bindPopup(`Comando VVF ${comando.Comando}`);
    }

    // Icona del marker: badge circolare col logo VVF, a forma di caserma/segnaposto
    function iconaCasermaVVF() {
        return L.divIcon({
            className: "marker-caserma",
            html: '<div class="marker-caserma-cerchio"><img src="images/logo.png" alt="Comando VVF"></div><div class="marker-caserma-punta"></div>',
            iconSize: [44, 56],
            iconAnchor: [22, 56],
            popupAnchor: [0, -52]
        });
    }

    //Effemeridi
        const displayEffemeridi = document.getElementById("display-effemeridi");
    let effemeridiComando = null;

    function aggiornaEffemeridi() {
        if (!displayEffemeridi || !coordinateComandoAttivo) return;
        effemeridiComando = FireOps.effemeridi(coordinateComandoAttivo.lat, coordinateComandoAttivo.lng);
        displayEffemeridi.textContent =
            `🌅 ${FireOps.oraBreve(effemeridiComando.alba)} 🌇 ${FireOps.oraBreve(effemeridiComando.tramonto)}`;
    }

    function apriPopupEffemeridi(event) {
        event.stopPropagation();
        const esistente = document.getElementById("popup-effemeridi-attivo");
        if (esistente) { esistente.remove(); return; }
        if (!effemeridiComando) return;

        const e = effemeridiComando;
        const g = v => `${Math.round(v)}°`;
        const popup = document.createElement("div");
        popup.id = "popup-effemeridi-attivo";
        popup.className = "popup-canali";
        popup.innerHTML = `
            <span class="popup-close" title="Chiudi">&times;</span>
            <h5>Effemeridi — Comando ${sessionStorage.getItem(CHIAVE_STORAGE) || "-"}</h5>
            <table><tbody>
                <tr><td class="nome">Prime luci (crep. civile)</td><td class="canale">${FireOps.oraBreve(e.crepuscoloInizio)}</td></tr>
                <tr><td class="nome">Alba</td><td class="canale">${FireOps.oraBreve(e.alba)}</td></tr>
                <tr><td class="nome">Mezzogiorno solare</td><td class="canale">${FireOps.oraBreve(e.mezzogiorno)}</td></tr>
                <tr><td class="nome">Tramonto</td><td class="canale">${FireOps.oraBreve(e.tramonto)}</td></tr>
                <tr><td class="nome">Ultime luci (crep. civile)</td><td class="canale">${FireOps.oraBreve(e.crepuscoloFine)}</td></tr>
                <tr><td class="nome">Ore di luce</td><td class="canale">${e.oreLuce ? e.oreLuce.toFixed(1) + " h" : "-"}</td></tr>
                <tr><td class="nome">Sole adesso (alt. / az.)</td><td class="canale">${g(e.sole.altezza)} / ${g(e.sole.azimut)}</td></tr>
                <tr><td class="nome">Luna illuminata</td><td class="canale">${Math.round(e.luna.illuminazione * 100)}%</td></tr>
            </tbody></table>
            <p class="pagina-nota" style="margin:8px 0 0;">${e.luna.nome} · orari in ora italiana</p>`;

        document.body.appendChild(popup);
        FireOps.ancoraPopup(popup, event.currentTarget);
        popup.querySelector(".popup-close").addEventListener("click", () => popup.remove());
        popup.addEventListener("click", ev => ev.stopPropagation());
    }

    if (displayEffemeridi) {
        displayEffemeridi.classList.add("cliccabile-canali");
        displayEffemeridi.addEventListener("click", apriPopupEffemeridi);
    }

    document.addEventListener("click", () => {
        const p = document.getElementById("popup-effemeridi-attivo");
        if (p) p.remove();
    });

    // ==========================================================
    // STILE DI SFONDO DELLA MAPPA (scura oppure OpenStreetMap classica)
    //
    // Entrambe le voci usano le tile OSM: la "grigia" è la stessa carta
    // rovesciata via CSS. Prima veniva da CARTO, che ha iniziato a chiedere
    // una API key per i basemap raster e li sta ritirando — e una chiave in
    // chiaro dentro un repo pubblico è di tutti tranne che nostra.
    // ==========================================================
    const STILI_MAPPA = {
        chiara: {
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            opzioni: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }
        },
        // Stesse tile, rovesciate via CSS
        scura: {
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            scura: true,
            opzioni: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }
        }
    };

    // Sostituisce il layer di sfondo mantenendo mirino/marker/radar sopra di esso
    function impostaStileMappa(stile) {
        if (!mappaComandoLeaflet || !STILI_MAPPA[stile]) return;

        if (layerBaseLeaflet) mappaComandoLeaflet.removeLayer(layerBaseLeaflet);
        const conf = STILI_MAPPA[stile];
        layerBaseLeaflet = L.tileLayer(conf.url, conf.opzioni).addTo(mappaComandoLeaflet);
        layerBaseLeaflet.bringToBack();

        // Il filtro va sul contenitore DI QUESTO layer, non sul tile-pane e
        // meno che mai sulla mappa: marker, crocino e radar stanno in pane
        // diversi e verrebbero rovesciati anche loro.
        const contenitoreTile = layerBaseLeaflet.getContainer();
        if (contenitoreTile) contenitoreTile.classList.toggle("tile-scure", !!conf.scura);

        stileMappaAttuale = stile;
    }

    const btnStileMappa = document.getElementById("btn-stile-mappa");
        // auto (segue alba/tramonto del Comando) → chiara → scura → auto
    const CHIAVE_TEMA_MAPPA = "fireops_tema_mappa";
    let temaScelto = sessionStorage.getItem(CHIAVE_TEMA_MAPPA) || "auto";

    function stileEffettivo() {
        if (temaScelto !== "auto") return temaScelto;
        if (!coordinateComandoAttivo) return "chiara";
        return FireOps.eGiorno(coordinateComandoAttivo.lat, coordinateComandoAttivo.lng) ? "chiara" : "scura";
    }

    function aggiornaPulsanteTema() {
        if (!btnStileMappa) return;
        const eff = stileEffettivo();
        btnStileMappa.textContent = temaScelto === "auto"
            ? (eff === "chiara" ? "🌗 Auto · chiara" : "🌗 Auto · scura")
            : (temaScelto === "chiara" ? "☀️ Chiara" : "🌙 Scura");
        btnStileMappa.title = temaScelto === "auto"
            ? "Segue alba e tramonto del Comando — clicca per fissare la carta"
            : "Clicca per cambiare (torna in automatico al terzo clic)";
    }

    function applicaTemaMappa() {
        const eff = stileEffettivo();
        if (eff !== stileMappaAttuale) impostaStileMappa(eff);
        aggiornaPulsanteTema();
    }

    if (btnStileMappa) {
        btnStileMappa.addEventListener("click", () => {
            temaScelto = temaScelto === "auto" ? "chiara" : temaScelto === "chiara" ? "scura" : "auto";
            try { sessionStorage.setItem(CHIAVE_TEMA_MAPPA, temaScelto); } catch (err) {}
            applicaTemaMappa();
        });
    }

    // Ricentra la mappa sul Comando attivo con uno zoom più ampio (vista d'insieme)
    const btnTornaComando = document.getElementById("btn-torna-comando");
    if (btnTornaComando) {
        btnTornaComando.addEventListener("click", () => {
            if (!mappaComandoLeaflet || !coordinateComandoAttivo) return;
            mappaComandoLeaflet.setView([coordinateComandoAttivo.lat, coordinateComandoAttivo.lng], ZOOM_RITORNO_COMANDO);
        });
    }

    // ==========================================================
    // VISTA WINDY: alternativa alla mappa Leaflet, centrata sul punto
    // attualmente inquadrato (che all'apertura è il Comando attivo).
    // L'iframe riceve un src solo alla prima attivazione: finché il
    // pulsante non viene premuto, Windy non viene mai contattata.
    // ==========================================================
    const btnWindy = document.getElementById("btn-windy");
    const contenitoreWindy = document.getElementById("windy-comando");
    const iframeWindy = document.getElementById("windy-iframe");
    let windyAttivo = false;

    function coordinateVistaCorrente() {
        if (mappaComandoLeaflet) {
            const centro = mappaComandoLeaflet.getCenter();
            return { lat: centro.lat, lng: centro.lng, zoom: mappaComandoLeaflet.getZoom() };
        }
        // Mappa non ancora creata: si parte dal Comando con lo zoom di default
        return coordinateComandoAttivo
            ? { ...coordinateComandoAttivo, zoom: ZOOM_VISTA_COMANDO }
            : null;
    }

    // Windy non arriva ai livelli di dettaglio di Leaflet: oltre ~11 le tile
    // meteo non esistono e l'embed si comporta in modo imprevedibile.
    // Lo zoom corrente si passa comunque, tagliato nell'intervallo che regge.
    function zoomWindy(livello) {
        return String(Math.min(11, Math.max(3, Math.round(livello))));
    }

    function urlWindy(coord, livelloZoom) {
        const parametri = new URLSearchParams({
            lat: coord.lat.toFixed(4),
            lon: coord.lng.toFixed(4),
            detailLat: coord.lat.toFixed(4),
            detailLon: coord.lng.toFixed(4),
            zoom: zoomWindy(livelloZoom),
            level: "surface",
            overlay: "radar",
            product: "radar",
            menu: "",
            message: "",
            marker: "true",
            calendar: "now",
            pressure: "",
            type: "map",
            location: "coordinates",
            detail: "",
            metricWind: "km/h",
            metricTemp: "°C",
            radarRange: "-1"
        });
        return `https://embed.windy.com/embed2.html?${parametri.toString()}`;
    }

    // Ricarica l'iframe solo se Windy è la vista attiva: cambiare Comando
    // con Windy spento non deve costare una richiesta di rete
    function aggiornaWindy() {
        if (!iframeWindy || !windyAttivo) return;
        const coord = coordinateVistaCorrente();
        if (!coord) return;
        iframeWindy.src = urlWindy(coord, coord.zoom);
    }

    if (btnWindy) {
        btnWindy.addEventListener("click", () => {
            windyAttivo = !windyAttivo;
            btnWindy.classList.toggle("attivo", windyAttivo);

            const contenitoreMappa = document.getElementById("mappa-comando");
            if (contenitoreMappa) contenitoreMappa.style.display = windyAttivo ? "none" : "block";
            if (contenitoreWindy) contenitoreWindy.style.display = windyAttivo ? "block" : "none";

            // I comandi della mappa Leaflet agiscono su qualcosa di nascosto:
            // spenti, non disabilitati a metà. Lookup diretto perché alcuni di
            // questi pulsanti sono dichiarati più in basso nel file.
            ["btn-stile-mappa", "btn-torna-comando"]
                .forEach(id => {
                    const b = document.getElementById(id);
                    if (b) b.disabled = windyAttivo;
                });

            if (windyAttivo) {
                aggiornaWindy();
            } else if (mappaComandoLeaflet) {
                // Rientrando, Leaflet era display:none: dimensioni da ricalcolare
                setTimeout(() => mappaComandoLeaflet.invalidateSize(), 100);
            }
        });
    }

    // ==========================================================
    // CROCINO CENTRALE: mirino fisso al centro della mappa con le coordinate inquadrate
    // ==========================================================
    function creaCrocinoCentroMappa() {
        if (crocinoCentroMappa) return crocinoCentroMappa;
        const contenitoreMappa = document.getElementById("mappa-comando");
        if (!contenitoreMappa) return null;

        crocinoCentroMappa = document.createElement("div");
        crocinoCentroMappa.className = "crocino-centro-mappa";
        crocinoCentroMappa.innerHTML = `
            <svg class="crocino-svg" width="26" height="26" viewBox="0 0 26 26">
                <line class="crocino-linea" x1="13" y1="0" x2="13" y2="9"></line>
                <line class="crocino-linea" x1="13" y1="17" x2="13" y2="26"></line>
                <line class="crocino-linea" x1="0" y1="13" x2="9" y2="13"></line>
                <line class="crocino-linea" x1="17" y1="13" x2="26" y2="13"></line>
                <circle class="crocino-cerchio" cx="13" cy="13" r="3"></circle>
            </svg>
            <div class="crocino-coordinate"></div>
        `;
        contenitoreMappa.appendChild(crocinoCentroMappa);
        return crocinoCentroMappa;
    }

    function aggiornaCoordinateCentroMappa() {
        if (!mappaComandoLeaflet) return;
        const crocino = creaCrocinoCentroMappa();
        if (!crocino) return;

        const centro = mappaComandoLeaflet.getCenter();
        const etichetta = crocino.querySelector(".crocino-coordinate");
        if (etichetta) etichetta.textContent = `${centro.lat.toFixed(5)}, ${centro.lng.toFixed(5)}`;
    }

    // Scarica e mostra il meteo in tempo reale per le coordinate del Comando attivo
    function aggiornaMeteoComando(comando) {
        const coord = estraiCoordinate(comando);
        if (!coord) {
            const contenitoreOrario = document.getElementById("meteo-orario");
            if (contenitoreOrario) contenitoreOrario.innerHTML = '<p class="pagina-nota">Coordinate del Comando non disponibili.</p>';
            return;
        }
        aggiornaMeteoPerCoordinate(coord);
    }

    // Scarica e mostra le previsioni orarie (12 ore) per una coppia di coordinate qualsiasi
    // (usata sia per il Comando attivo sia per il centro corrente della mappa)
    function aggiornaMeteoPerCoordinate(coord) {
        const contenitoreOrario = document.getElementById("meteo-orario");
        if (!contenitoreOrario || !coord) return;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lng}&hourly=temperature_2m,weather_code,precipitation_probability,is_day,wind_speed_10m,wind_direction_10m&forecast_hours=12&timezone=auto`;

        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error("Errore meteo");
                return r.json();
            })
            .then(dati => {
                if (!dati.hourly) throw new Error("Dati meteo non disponibili");
                renderMeteoOrario(dati.hourly);
            })
            .catch(() => {
                contenitoreOrario.innerHTML = '<p class="pagina-nota">Meteo non disponibile al momento.</p>';
            });
    }


    // Mostra la striscia con le previsioni orarie per le prossime 12 ore
    function renderMeteoOrario(hourly) {
        const container = document.getElementById("meteo-orario");
        if (!container) return;

        if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
            container.innerHTML = "";
            return;
        }

        let html = "";
        hourly.time.forEach((iso, i) => {
            const ora = iso.slice(11, 16); // estrae "HH:MM" dal formato ISO restituito da Open-Meteo
            const [icona] = descrizioneMeteo(hourly.weather_code[i], eOraDiGiorno(hourly, i));
            const temp = Math.round(hourly.temperature_2m[i]);
            const probabilitaPioggia = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability[i] : null;

            const ventoKmh = Array.isArray(hourly.wind_speed_10m) ? Math.round(hourly.wind_speed_10m[i]) : null;
            const ventoGradi = Array.isArray(hourly.wind_direction_10m) ? hourly.wind_direction_10m[i] : null;
            const settore = settoreVento(ventoGradi);

            // La freccia punta DOVE VA il vento, non da dove viene: Open-Meteo
            // dà la provenienza (convenzione meteo), quindi +180°.
            const cellaVento = ventoKmh === null ? "" : `
                <div class="meteo-ora-vento" title="Vento da ${settore} (${Math.round(ventoGradi)}°) — ${ventoKmh} km/h">
                    <svg class="meteo-freccia" viewBox="0 0 24 24" aria-hidden="true"
                         style="transform:rotate(${(Math.round(ventoGradi) + 180) % 360}deg)">
                        <path d="M12 21V4M12 3l-5 6M12 3l5 6" fill="none" stroke="currentColor"
                              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>${ventoKmh}<small> km/h</small></span>
                </div>`;

            html += `
                <div class="meteo-ora-card">
                    <div class="meteo-ora-etichetta">${ora}</div>
                    <div class="meteo-ora-icona">${icona}</div>
                    <div class="meteo-ora-temp">${temp}°</div>
                    <div class="meteo-ora-pioggia">${probabilitaPioggia !== null ? `💧${probabilitaPioggia}%` : ""}</div>
                    ${cellaVento || '<div class="meteo-ora-vento"></div>'}
                </div>`;
        });

        container.innerHTML = html;
    }

    // Aggiorna mappa e meteo per il Comando attivo, e avvia il refresh periodico del meteo
    function aggiornaMappaEMeteo(comando) {
        aggiornaMappaComando(comando);
        aggiornaMeteoComando(comando);
        aggiornaWindy();
        aggiornaEffemeridi();
        applicaTemaMappa();

        if (intervalloMeteo) clearInterval(intervalloMeteo);
        intervalloMeteo = setInterval(() => {
            const centro = mappaComandoLeaflet ? mappaComandoLeaflet.getCenter() : null;
            if (centro) {
                aggiornaMeteoPerCoordinate({ lat: centro.lat, lng: centro.lng });
            } else {
                aggiornaMeteoComando(comando);
            }
        }, 10 * 60 * 1000); // ogni 10 minuti
    }

    // Costruisce un link "naviga con Google Maps" a partire da un indirizzo testuale e una stringa di coordinate "lat, lng"
    function creaLinkMaps(testoIndirizzo, coordinate) {
        if (!testoIndirizzo) return "-";
        if (!coordinate) return testoIndirizzo;

        const coords = coordinate.split(",").map(s => s.trim()).join(",");
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords)}&travelmode=driving&dir_action=navigate`;
        return `<a href="${url}" target="_blank" rel="noopener" class="indirizzo-link">${testoIndirizzo}</a>`;
    }

    // Genera l'HTML per un campo email o telefono copiabile
    function creaCampoCopiabile(valore, tipo) {
        if (!valore || valore === '-') return '-';

        const classeCss = tipo === 'telefono' ? 'telefono-cliccabile' : 'email-cliccabile';

        // Se è un telefono, formatta con '0' iniziale e senza spazi per la copia
        const valoreCopia = tipo === 'telefono' ? formattaTelefonoPerCopia(valore) : valore;

        return `<span class="${classeCss}" data-copia="${valoreCopia}">${valore}</span>`;
    }

    // Chiude qualsiasi popup aperto
    function chiudiPopupDati() {
        const esistente = document.getElementById("popup-dati-attivo");
        if (esistente) esistente.remove();
    }

    // Mostra un popup con dati di un comando o direzione, ancorato vicino al click
    function mostraPopupDati(event, titolo, righeHTML) {
        event.stopPropagation();
        chiudiPopupDati();

        const popup = document.createElement("div");
        popup.className = "popup-dati";
        popup.id = "popup-dati-attivo";

        const rect = event.target.getBoundingClientRect();
        // Ancorato dal basso: si apre "crescendo" verso l'alto sopra l'elemento cliccato,
        // senza bisogno di conoscere in anticipo l'altezza del popup
        let bottom = window.innerHeight - rect.top + 8;
        let left = rect.left;

        const larghezzaStimata = 300;
        if (left + larghezzaStimata > window.innerWidth) {
            left = window.innerWidth - larghezzaStimata - 10;
        }

        popup.style.bottom = `${bottom}px`;
        popup.style.left = `${left}px`;

        popup.innerHTML = `
            <span class="popup-close" title="Chiudi">&times;</span>
            <h5>${titolo}</h5>
            ${righeHTML}
        `;

        document.body.appendChild(popup);

        /* Il listener si aggancia qui e non con onclick nel markup: la
           funzione vive dentro questa closure e da un attributo HTML, che
           risolve solo su window, non è raggiungibile. */
        const chiusura = popup.querySelector(".popup-close");
        if (chiusura) chiusura.addEventListener("click", chiudiPopupDati);
    }

    // Chiude il popup cliccando fuori o con ESC
    document.addEventListener("click", chiudiPopupDati);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") chiudiPopupDati();
    });

    // I due popup mostrano gli stessi cinque campi nello stesso ordine: chi
    // li apre in sequenza (es. scorrendo i Comandi Limitrofi) trova sempre
    // il dato nella stessa posizione, senza doverlo cercare.
    //
    // Il canale radio sta fuori dalla tabella, in evidenza: è il dato per cui
    // il popup viene aperto nove volte su dieci, e in una riga di tabella
    // avrebbe lo stesso peso della PEC.
    function corpoPopupContatti({ canale, telefono, email, pec, indirizzo, coordinate }) {
        const canaleHtml = `
            <div class="popup-canale">
                <span class="popup-canale-etichetta">CH VHF</span>
                <span class="popup-canale-valore">${canale || "-"}</span>
            </div>`;

        const righe = `
            <tr><th>TEL SO</th><td>${creaCampoCopiabile(telefono, 'telefono')}</td></tr>
            <tr><th>EMAIL SO</th><td>${creaCampoCopiabile(email, 'email')}</td></tr>
            <tr><th>PEC SO</th><td>${creaCampoCopiabile(pec, 'email')}</td></tr>
            <tr><th>Indirizzo</th><td>${creaLinkMaps(indirizzo, coordinate)}</td></tr>
        `;

        return canaleHtml + `<table>${righe}</table>`;
    }

    function popupDatiComando(event, c) {
        mostraPopupDati(event, `Comando: ${c.Comando}`, corpoPopupContatti({
            canale: c["Canale Radio Comando"],
            telefono: c["Telefono SO Comando"],
            email: c["email SO Comando"],
            pec: c["PEC SO Comando"],
            indirizzo: c["Indirizzo Completo"],
            coordinate: c["Coordinate"]
        }));
    }

    function popupDatiDirezione(event, c, tutteDirezioni) {
        const direzioneCollegata = trovaDirezionePerNome(c["Direzione VVF"], tutteDirezioni);

        mostraPopupDati(event, `Direzione: ${c["Direzione VVF"]}`, corpoPopupContatti({
            canale: c["Canale Radio Direzione"],
            telefono: c["Telefono SO Direzione"],
            email: c["email SO Direzione"],
            pec: c["PEC SO Direzione"],
            indirizzo: c["Indirizzo Direzione"],
            coordinate: direzioneCollegata ? direzioneCollegata["Coordinate DIR"] : null
        }));
    }

    // ==========================================================
    // API PER I MODULI ESTERNI (sitac.js)
    // comandiData e i popup vivono dentro questa closure: senza queste due
    // esportazioni nessun altro file può arrivarci. Restano funzioni, non
    // riferimenti all'array, così chi le chiama legge sempre il dato di
    // adesso e non una copia presa prima del fetch.
    // ==========================================================
    window.FireOps = window.FireOps || {};

    /* La sigla arriva da Nominatim come "IT-AG": si toglie il prefisso e si
       confronta col campo Provincia. Il nome esteso è la riserva per le
       province in cui l'ISO manca o è cambiato (Sud Sardegna, ex CI/VS). */
    window.FireOps.comandoPerProvincia = function (sigla, nome) {
        if (!Array.isArray(comandiData) || comandiData.length === 0) return null;

        const s = String(sigla || "").toUpperCase().replace(/^IT-/, "").trim();
        if (s) {
            const perSigla = comandiData.find(c => String(c.Provincia || "").toUpperCase() === s);
            if (perSigla) return perSigla;
        }

        const n = String(nome || "").toLowerCase().trim();
        if (!n) return null;
        return comandiData.find(c =>
            String(c.Comando || "").toLowerCase() === n ||
            String(c.Comune || "").toLowerCase() === n) || null;
    };

    /* Stesso popup dei Comandi Limitrofi, aperto da un elemento qualsiasi.
       L'evento vero serve per due motivi: fermare la propagazione (il
       listener su document chiuderebbe il popup nello stesso click che lo
       apre) e ancorarlo. `elemento` sovrascrive il bersaglio perché dentro
       un <div> con del <b> il target è il grassetto, non il riquadro. */
    window.FireOps.apriPopupComando = function (comando, evento, elemento) {
        if (!comando) return;
        const ancora = elemento
            || (evento && evento.currentTarget)
            || (evento && evento.target);
        if (!ancora) return;
        popupDatiComando({
            stopPropagation: () => { if (evento && evento.stopPropagation) evento.stopPropagation(); },
            target: ancora
        }, comando);
    };

    // Copia un testo negli appunti e mostra un feedback visivo
    function copiaTesto(event, testo) { return FireOps.copiaTesto(event, testo); }

    // Mostra un piccolo badge temporaneo vicino al punto cliccato
    function mostraFeedbackCopia(event, testo) { return FireOps.mostraFeedbackCopia(event, testo); }

    // Apre/chiude una sezione comprimibile
    function toggleSezione(header, contenuto) {
        header.classList.toggle("aperta");
        contenuto.classList.toggle("aperta");
    }

    // Costruisce e inserisce il riepilogo dati del comando nella dashboard
    function renderRiepilogoComando(comando, tuttiComandi, tutteDirezioni, con, socav, idContenitore = "riepilogo-comando", accentoAlternativo = false) {
        const container = document.getElementById(idContenitore);
        if (!container) return;

        if (!comando) {
            container.innerHTML = "<p>Dati comando non disponibili.</p>";
            return;
        }

        // Prefisso usato per rendere univoci gli ID interni (sezioni comprimibili):
        // necessario perché lo stesso riepilogo può comparire in più contenitori insieme
        // (es. un pannello sullo split-screen e un altro), e gli ID devono restare unici nel DOM
        const p = idContenitore;

        const direzioneCollegata = trovaDirezionePerNome(comando["Direzione VVF"], tutteDirezioni);
        const coordinateDirezione = direzioneCollegata ? direzioneCollegata["Coordinate DIR"] : null;
        const coordinateCon = con ? con["Coordinate"] : null;
        const coordinateSocav = socav ? socav["Coordinate"] : null;

        const limitrofiNomi = (comando["Concatena Comandi Confinanti"] || "")
            .split(";")
            .map(n => n.trim())
            .filter(n => n.length > 0);

        const limitrofiRighe = limitrofiNomi.map(nome => {
            const c = trovaComandoPerNome(nome, tuttiComandi);
            if (!c) {
                return `<tr><td>${nome}</td><td colspan="3">Dati non trovati</td></tr>`;
            }
            return `
                <tr>
                    <td class="cliccabile" data-comando="${c.Comando}">${c.Comando}</td>
                    <td>${c["Canale Radio Comando"] || "-"}</td>
                    <td class="cliccabile" data-direzione-di="${c.Comando}">${c["Direzione VVF"] || "-"}</td>
                    <td>${c["Canale Radio Direzione"] || "-"}</td>
                </tr>`;
        }).join("");

        const sitoWeb = comando["sito web Comando"]
            ? `<a href="${comando["sito web Comando"]}" target="_blank" rel="noopener">Apri sito</a>` : "-";
        const intranet = comando["Intranet Comando"]
            ? `<a href="${comando["Intranet Comando"]}" target="_blank" rel="noopener">Apri intranet</a>` : "-";

        const classeBox = accentoAlternativo ? "riepilogo-box riepilogo-box-consultazione" : "riepilogo-box";

        container.innerHTML = `
            <div class="${classeBox}">
                <h4 class="sezione-toggle" data-target="${p}-sezione-comando">Info Comando ${comando.Comando}</h4>
                <table id="${p}-sezione-comando" class="riepilogo-tabella sezione-contenuto">
                    <tbody>
                        <tr><th>Indirizzo</th><td>${creaLinkMaps(comando["Indirizzo Completo"], comando["Coordinate"])}</td></tr>
                        <tr><th>TEL SO COM</th><td>${creaCampoCopiabile(comando["Telefono SO Comando"], 'telefono')}</td></tr>
                        <tr><th>CH VHF COM</th><td>${comando["Canale Radio Comando"] || "-"}</td></tr>
                        <tr><th>CHS SO COM</th><td>${comando["CHS Comando"] || "-"}</td></tr>
                        <tr><th>Email SO Comando</th><td>${creaCampoCopiabile(comando["email SO Comando"], 'email')}</td></tr>
                        <tr><th>PEC SO Comando</th><td>${creaCampoCopiabile(comando["PEC SO Comando"], 'email')}</td></tr>
                        <tr><th>Email Comando</th><td>${creaCampoCopiabile(comando["email Comando"], 'email')}</td></tr>
                        <tr><th>PEC Comando</th><td>${creaCampoCopiabile(comando["PEC Comando"], 'email')}</td></tr>
                        <tr><th>Sito WEB</th><td>${sitoWeb}</td></tr>
                        <tr><th>Intranet</th><td>${intranet}</td></tr>
                    </tbody>
                </table>

                <h4 class="sezione-toggle" data-target="${p}-sezione-direzione">Info Direzione ${comando["Direzione VVF"] || "-"}</h4>
                <table id="${p}-sezione-direzione" class="riepilogo-tabella sezione-contenuto">
                    <tbody>
                        <tr><th>Indirizzo</th><td>${creaLinkMaps(comando["Indirizzo Direzione"], coordinateDirezione)}</td></tr>
                        <tr><th>TEL SO DIR</th><td>${creaCampoCopiabile(comando["Telefono SO Direzione"], 'telefono')}</td></tr>
                        <tr><th>CH VHF DIR</th><td>${comando["Canale Radio Direzione"] || "-"}</td></tr>
                        <tr><th>CHS SO DIR</th><td>${comando["CHS Direzione"] || "-"}</td></tr>
                        <tr><th>Email SO Direzione</th><td>${creaCampoCopiabile(comando["email SO Direzione"], 'email')}</td></tr>
                        <tr><th>PEC SO Direzione</th><td>${creaCampoCopiabile(comando["PEC SO Direzione"], 'email')}</td></tr>
                        <tr><th>Email Direzione</th><td>${creaCampoCopiabile(comando["email Direzione"], 'email')}</td></tr>
                        <tr><th>PEC Direzione</th><td>${creaCampoCopiabile(comando["PEC Direzione"], 'email')}</td></tr>
                    </tbody>
                </table>

                <h4 class="sezione-toggle" data-target="${p}-sezione-con">Info CON - Centro Operativo Nazionale</h4>
                <table id="${p}-sezione-con" class="riepilogo-tabella sezione-contenuto">
                    <tbody>
                        <tr><th>Indirizzo</th><td>${creaLinkMaps(comando["Indirizzo CON"], coordinateCon)}</td></tr>
                        <tr><th>TEL SO CON</th><td>${creaCampoCopiabile(comando["Telefono SO CON"], 'telefono')}</td></tr>
                        <tr><th>CH VHF CON</th><td>${comando["Canale Radio CON"] || "-"}</td></tr>
                        <tr><th>CHS CON</th><td>${comando["CHS CON"] || "-"}</td></tr>
                        <tr><th>Email SO CON</th><td>${creaCampoCopiabile(comando["email SO CON"], 'email')}</td></tr>
                    </tbody>
                </table>

                <h4 class="sezione-toggle" data-target="${p}-sezione-socav">Info SOCAV - Assistenza al Volo</h4>
                <table id="${p}-sezione-socav" class="riepilogo-tabella sezione-contenuto">
                    <tbody>
                        <tr><th>Indirizzo</th><td>${creaLinkMaps(comando["Indirizzo SOCAV"], coordinateSocav)}</td></tr>
                        <tr><th>TEL SOCAV</th><td>${creaCampoCopiabile(comando["Telefono SOCAV"], 'telefono')}</td></tr>
                        <tr><th>Email SOCAV</th><td>${creaCampoCopiabile(comando["email SOCAV"], 'email')}</td></tr>
                    </tbody>
                </table>

                <h4>Comandi Limitrofi</h4>
                <table id="${p}-sezione-limitrofi" class="riepilogo-tabella-limitrofi sezione-contenuto aperta">
                    <thead>
                        <tr>
                            <th>Comando</th>
                            <th>CH VHF COM</th>
                            <th>Direzione</th>
                            <th>CH VHF DIR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${limitrofiRighe || '<tr><td colspan="4">Nessun comando limitrofo disponibile</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        // Delegazione eventi click nel riepilogo
        container.querySelectorAll("[data-comando]").forEach(el => {
            el.addEventListener("click", (e) => {
                const nome = el.dataset.comando;
                const c = trovaComandoPerNome(nome, tuttiComandi);
                if (c) popupDatiComando(e, c);
            });
        });

        container.querySelectorAll("[data-direzione-di]").forEach(el => {
            el.addEventListener("click", (e) => {
                const nome = el.dataset.direzioneDi;
                const c = trovaComandoPerNome(nome, tuttiComandi);
                if (c) popupDatiDirezione(e, c, tutteDirezioni);
            });
        });

        // Gestisce la copia sia per i telefoni che per le email
        container.querySelectorAll(".telefono-cliccabile, .email-cliccabile").forEach(el => {
            el.addEventListener("click", (e) => copiaTesto(e, el.dataset.copia));
        });

        // Sezioni comprimibili
        container.querySelectorAll(".sezione-toggle").forEach(header => {
            const contenuto = document.getElementById(header.dataset.target);
            if (contenuto) {
                header.addEventListener("click", () => toggleSezione(header, contenuto));
            }
        });
    }

    // ==========================================================
    // PAGINA "INFO ALTRO COMANDO": consultazione rapida dei dati di un
    // qualsiasi Comando dall'elenco a tendina, senza toccare il Comando
    // attivo di sessione (quello impostato dal menu ☰)
    // ==========================================================
    function popolaSelectAltroComando(lista) {
        const select = document.getElementById("altro-comando-select");
        if (!select) return;

        select.innerHTML = '<option value="" disabled selected>-- Seleziona un Comando --</option>';
        (lista || [])
            .filter(c => c && c.Comando) // scarta eventuali righe senza nome Comando valido
            .slice()
            .sort((a, b) => String(a.Comando).localeCompare(String(b.Comando), "it"))
            .forEach(c => {
                const opzione = document.createElement("option");
                opzione.value = c.Comando;
                opzione.textContent = c.Comando;
                select.appendChild(opzione);
            });

        select.addEventListener("change", () => {
            const comandoScelto = trovaComandoPerNome(select.value, comandiData);
            renderRiepilogoComando(comandoScelto, comandiData, direzioniData, conData, socavData, "riepilogo-altro-comando", true);
        });
    }

    // ==========================================================
    // SPLIT SCREEN: due pannelli indipendenti, ciascuno mostra una pagina.
    // Le sezioni esistono una sola volta nel DOM (niente ID duplicati): vengono
    // spostate (appendChild) dentro il pannello che le mostra, o parcheggiate
    // nel "magazzino" nascosto quando non sono assegnate a nessun pannello.
    // Selezionare in un pannello una pagina già aperta nell'altro fa scambiare
    // automaticamente le due pagine, così restano sempre univoche.
    // ==========================================================
    // Elenco, ordine, etichette e stato 🚧 vivono in schede.js
    const CATALOGO_PAGINE = (window.FireOpsSchede && window.FireOpsSchede.pagine) || [];
    if (CATALOGO_PAGINE.length === 0) {
        console.error("schede.js non caricato: i selettori dei pannelli resteranno vuoti.");
    }

    const magazzinoPagine = document.getElementById("magazzino-pagine");
    const selectPannelloSinistra = document.getElementById("select-pannello-sinistra");
    const selectPannelloDestra = document.getElementById("select-pannello-destra");
    const corpoSinistra = document.getElementById("corpo-sinistra");
    const corpoDestra = document.getElementById("corpo-destra");

const CHIAVE_STORAGE_PANNELLI = "fireops_pagine_pannelli";

    let paginePannelliSalvate = null;
    try { paginePannelliSalvate = JSON.parse(sessionStorage.getItem(CHIAVE_STORAGE_PANNELLI)); } catch (err) {}

    const PREDEFINITE = (window.FireOpsSchede && window.FireOpsSchede.predefinite)
        || { sinistra: "homepage", destra: "messaggistica" };

    let paginaSinistra = (paginePannelliSalvate && document.getElementById(paginePannelliSalvate.sinistra))
        ? paginePannelliSalvate.sinistra : PREDEFINITE.sinistra;
    let paginaDestra = (paginePannelliSalvate && document.getElementById(paginePannelliSalvate.destra))
        ? paginePannelliSalvate.destra : PREDEFINITE.destra;

    // Cosa ha spostato ogni pagina esclusiva per prendersi il pannello.
    // È una pila e non una variabile sola perché le esclusive si possono
    // incatenare (Convertitore → SITAC): chiudendo si torna indietro di un
    // passo per volta, senza rimbalzare fra le due all'infinito.
    let pilaEsclusiva = (paginePannelliSalvate && Array.isArray(paginePannelliSalvate.pila))
        ? paginePannelliSalvate.pila.filter(v => v && document.getElementById(v.idPagina))
        : [];

    function salvaPaginePannelli() {
        try {
            sessionStorage.setItem(CHIAVE_STORAGE_PANNELLI, JSON.stringify({
                sinistra: paginaSinistra,
                destra: paginaDestra,
                pila: pilaEsclusiva
            }));
        } catch (err) {}
    }

    // Pagina di servizio con cui riempire un pannello rimasto senza
    // contenuto. Diverse per lato: a sinistra la Home, a destra il meteo —
    // le due di partenza. Se il ripiego è proprio la pagina da evitare si
    // prende quello dell'altro lato.
    const PAGINA_RIPIEGO = (window.FireOpsSchede && window.FireOpsSchede.ripiego)
        || { sinistra: "homepage", destra: "mappa-meteo" };

    function ripiegoPer(lato, idDaEvitare) {
        const scelta = PAGINA_RIPIEGO[lato];
        if (scelta !== idDaEvitare) return scelta;
        return lato === "sinistra" ? PAGINA_RIPIEGO.destra : PAGINA_RIPIEGO.sinistra;
    }

    function altroLatoDi(lato) { return lato === "sinistra" ? "destra" : "sinistra"; }
    function paginaDelLato(lato) { return lato === "sinistra" ? paginaSinistra : paginaDestra; }
    function impostaPagina(lato, idPagina) {
        if (lato === "sinistra") paginaSinistra = idPagina;
        else paginaDestra = idPagina;
    }

    function contenitorePerLato(lato) {
        if (lato === "sinistra") return corpoSinistra;
        if (lato === "destra") return corpoDestra;
        return magazzinoPagine;
    }

    // Sposta la sezione (esistente una sola volta nel DOM) dentro il contenitore del lato indicato
    function spostaSezione(idPagina, lato) {
        const sezione = document.getElementById(idPagina);
        const contenitore = contenitorePerLato(lato);
        if (sezione && contenitore) contenitore.appendChild(sezione);
    }

    function etichettaScheda(pagina) {
        return pagina.lavori ? `${pagina.label} 🚧 Pagina in costruzione! 🚧` : pagina.label;
    }

    function popolaSelettorePannello(select) {
        if (!select) return;
        select.innerHTML = "";
        CATALOGO_PAGINE.forEach(pagina => {
            const opzione = document.createElement("option");
            opzione.value = pagina.id;
            opzione.textContent = etichettaScheda(pagina);
            if (pagina.lavori) opzione.classList.add("scheda-wip");
            select.appendChild(opzione);
        });
    }

    function aggiornaSelettori() {
        if (selectPannelloSinistra) selectPannelloSinistra.value = paginaSinistra;
        if (selectPannelloDestra) selectPannelloDestra.value = paginaDestra;
    }

    // Effetti collaterali dovuti al comparire di una pagina in un pannello
    // (stesso comportamento che prima aveva il cambio scheda unico)
    function eseguiEffettiPagina(idPagina) {
        chiudiPopupDati();

        if (idPagina === "messaggistica") {
            const inputNumero = document.getElementById("msg-numero");
            if (inputNumero) setTimeout(() => inputNumero.focus(), 50);
            validaCampiMessaggistica();
        }

        // La mappa Leaflet potrebbe essere stata inizializzata mentre il suo pannello
        // era nel magazzino nascosto: ricalcola le dimensioni, altrimenti resta rotta
        if (idPagina === "mappa-meteo" && mappaComandoLeaflet) {
            setTimeout(() => mappaComandoLeaflet.invalidateSize(), 100);
        }
    }

        // Assegna una pagina a un pannello ("sinistra"/"destra"). Tre strade
    // diverse, e vanno tenute separate: entrare in esclusiva, uscirne,
    // oppure il normale scambio fra due colonne.
    function assegnaPagina(lato, nuovoId, opzioni = {}) {
        if (!document.getElementById(nuovoId)) return;

        const idAttualeLato = paginaDelLato(lato);
        if (nuovoId === idAttualeLato) return;

        const eraEsclusiva = !!idPaginaEsclusiva;
        const altro = altroLatoDi(lato);

        if (PAGINE_ESCLUSIVE[nuovoId]) {
            // Prende il pannello da sola. L'ALTRA COLONNA NON SI TOCCA:
            // resta com'è, nascosta, e si ritrova identica alla chiusura.
            if (!opzioni.daChiusura) {
                pilaEsclusiva.push({ lato, idPagina: idAttualeLato });
                if (pilaEsclusiva.length > 10) pilaEsclusiva.shift();
            }
            smontaEsclusiva();
            spostaSezione(idAttualeLato, "magazzino");
            spostaSezione(nuovoId, lato);
            impostaPagina(lato, nuovoId);
            entraInEsclusiva(nuovoId, lato);

        } else if (eraEsclusiva) {
            // Si torna a due colonne. L'altro pannello ha ancora la pagina
            // di prima: se è proprio quella scelta qui non può stare in due
            // posti, quindi quel lato ripiega su una pagina di servizio.
            esciDaFullscreen();
            pilaEsclusiva.length = 0;
            spostaSezione(idAttualeLato, "magazzino");
            spostaSezione(nuovoId, lato);
            impostaPagina(lato, nuovoId);

            if (paginaDelLato(altro) === nuovoId) {
                const ripiego = ripiegoPer(altro, nuovoId);
                spostaSezione(ripiego, altro);
                impostaPagina(altro, ripiego);
                eseguiEffettiPagina(ripiego);
            }

        } else {
            // Due colonne: una pagina già aperta nell'altro pannello non si
            // duplica, le due si scambiano di posto.
            esciDaFullscreen();
            if (nuovoId === paginaDelLato(altro)) {
                spostaSezione(idAttualeLato, altro);
                spostaSezione(nuovoId, lato);
                impostaPagina(altro, idAttualeLato);
                impostaPagina(lato, nuovoId);
            } else {
                spostaSezione(idAttualeLato, "magazzino");
                spostaSezione(nuovoId, lato);
                impostaPagina(lato, nuovoId);
            }
        }

        aggiornaSelettori();
        salvaPaginePannelli();
        eseguiEffettiPagina(nuovoId);
    }

    if (selectPannelloSinistra) {
        popolaSelettorePannello(selectPannelloSinistra);
        selectPannelloSinistra.addEventListener("change", () => {
            assegnaPagina("sinistra", selectPannelloSinistra.value);
        });
    }

    if (selectPannelloDestra) {
        popolaSelettorePannello(selectPannelloDestra);
        selectPannelloDestra.addEventListener("change", () => {
            assegnaPagina("destra", selectPannelloDestra.value);
        });
    }

// ==========================================================
    // FULLSCREEN PER PAGINA (solo Convertitore Coordinate, per ora)
    // ==========================================================
    function toggleFullscreenPagina(pulsante) {
        const pannello = pulsante.closest(".pannello");
        if (!pannello) return;

        const splitScreenEl = document.querySelector(".split-screen");
        const inFullscreen = pannello.classList.toggle("pannello-fullscreen");

        if (splitScreenEl) splitScreenEl.classList.toggle("ha-pannello-fullscreen", inFullscreen);
        document.body.classList.toggle("fullscreen-attivo", inFullscreen);

        pulsante.textContent = inFullscreen ? "🗗 Riduci" : "⛶ Espandi";
        pulsante.title = inFullscreen ? "Riduci a schermo normale" : "Espandi a schermo intero";

        setTimeout(() => window.dispatchEvent(new Event("resize")), 150);
    }

    // Uscita forzata dal fullscreen, indipendente dal pulsante che l'aveva
    // attivato: il pulsante "Riduci" viaggia insieme alla sezione, quindi
    // non si può contare su di lui per ripulire il pannello che resta.
    function esciDaFullscreen() {
        const pannelloEspanso = document.querySelector(".pannello.pannello-fullscreen");
        if (pannelloEspanso) pannelloEspanso.classList.remove("pannello-fullscreen");

        const splitScreenEl = document.querySelector(".split-screen");
        if (splitScreenEl) splitScreenEl.classList.remove("ha-pannello-fullscreen");
        document.body.classList.remove("fullscreen-attivo");

        document.querySelectorAll(".btn-fullscreen-pagina").forEach(pulsante => {
            pulsante.textContent = "⛶ Espandi";
            pulsante.title = "Espandi a schermo intero";
        });

        smontaEsclusiva();
        setTimeout(() => window.dispatchEvent(new Event("resize")), 150);
    }

    // Spegne SOLO lo stato "pagina esclusiva", lasciando il pannello
    // espanso dov'è. Passando da SITAC a Convertitore lo schermo resta
    // pieno: senza questa separazione ci sarebbe un fotogramma a mezza
    // pagina in mezzo, con Leaflet che si ridimensiona due volte.
    function smontaEsclusiva() {
        document.body.classList.remove("sitac-esclusiva", "pagina-esclusiva");
        idPaginaEsclusiva = null;
        latoEsclusiva = null;
        aggiornaPulsanteEsclusiva();
        aggiornaSubheader();
    }

    // ==========================================================
    // SITAC IN MODALITÀ ESCLUSIVA
    //
    // La SITAC non convive con un'altra pagina: la barra dei passi più la
    // mappa non stanno in mezzo pannello, e mentre si disegna un dispositivo
    // non si guarda altro. Quindi il pannello va a tutta larghezza da sé, e
    // il pulsante "Espandi" diventa l'unica uscita: "✖ Chiudi SITAC".
    //
    // Non si crea un secondo stato accanto a .pannello-fullscreen: si usa
    // QUELLO, con una classe in più sul body che ne cambia solo il comando.
    // Due meccanismi paralleli finirebbero prima o poi disallineati.
    // ==========================================================
        // ==========================================================
    // PAGINE IN MODALITÀ ESCLUSIVA
    //
    // Alcune pagine non convivono con un'altra in mezzo pannello: la SITAC
    // (barra dei passi + carta) e il Convertitore (tre colonne). Quando
    // vengono scelte prendono il pannello a tutta larghezza da sé, e il
    // pulsante "Espandi" diventa l'unica uscita.
    //
    // Non si crea un secondo stato accanto a .pannello-fullscreen: si usa
    // QUELLO, con una classe in più sul body che ne cambia solo il comando.
    // ==========================================================
    const ID_SITAC = "sitac-aib";
    const PAGINE_ESCLUSIVE = {
        "sitac-aib": {
            chiudi: "✖ Chiudi SITAC",
            titolo: "Chiudi la SITAC e torna alla vista a due colonne"
        },
        "convertitore": {
            chiudi: "✖ Chiudi convertitore",
            titolo: "Chiudi il convertitore e torna alla vista a due colonne"
        }
    };

    let idPaginaEsclusiva = null;    // quale pagina è esclusiva adesso
    let latoEsclusiva = null;        // "sinistra" | "destra"

    function aggiornaPulsanteEsclusiva() {
        Object.keys(PAGINE_ESCLUSIVE).forEach(id => {
            const btn = document.querySelector(`#${id} .btn-fullscreen-pagina`);
            if (!btn) return;
            const attiva = id === idPaginaEsclusiva;
            btn.textContent = attiva ? PAGINE_ESCLUSIVE[id].chiudi : "⛶ Espandi";
            btn.title = attiva ? PAGINE_ESCLUSIVE[id].titolo : "Espandi a schermo intero";
            btn.classList.toggle("btn-chiudi-esclusiva", attiva);
        });
    }

        // In esclusiva resta un solo selettore, quello del lato che ha preso lo
    // schermo. L'altro comanderebbe un pannello invisibile: sceglierci una
    // pagina già aperta faceva scattare lo scambio, e l'esclusiva
    // ricompariva in mezza colonna.
    function aggiornaSubheader() {
        [["sinistra", selectPannelloSinistra], ["destra", selectPannelloDestra]]
            .forEach(([lato, select]) => {
                const contenitore = select && select.closest(".subheader-pannello");
                if (!contenitore) return;
                contenitore.classList.toggle("subheader-pannello-nascosto",
                    !!idPaginaEsclusiva && lato !== latoEsclusiva);
            });
    }

    function entraInEsclusiva(idPagina, lato) {
        const sezione = document.getElementById(idPagina);
        const pannello = sezione && sezione.closest(".pannello");
        if (!pannello) return;

        idPaginaEsclusiva = idPagina;
        latoEsclusiva = lato;

        pannello.classList.add("pannello-fullscreen");
        const splitScreenEl = document.querySelector(".split-screen");
        if (splitScreenEl) splitScreenEl.classList.add("ha-pannello-fullscreen");
        document.body.classList.add("fullscreen-attivo", "pagina-esclusiva");
        // sitac.js legge ancora la vecchia classe: resta, ma solo quando la
        // pagina esclusiva è davvero la SITAC
        document.body.classList.toggle("sitac-esclusiva", idPagina === ID_SITAC);

        aggiornaPulsanteEsclusiva();
        aggiornaSubheader();
        // Leaflet crede ancora di essere largo mezzo pannello
        setTimeout(() => window.dispatchEvent(new Event("resize")), 150);
    }

    function chiudiEsclusiva() {
        if (!idPaginaEsclusiva) return;

        const lato = latoEsclusiva;
        const idUscita = idPaginaEsclusiva;

        // La pila dice cosa questa pagina aveva spostato: si torna
        // esattamente lì, fosse anche un'altra pagina esclusiva.
        let daRipristinare = "";
        while (pilaEsclusiva.length > 0 && !daRipristinare) {
            const voce = pilaEsclusiva.pop();
            if (voce && voce.lato === lato && voce.idPagina !== idUscita
                && document.getElementById(voce.idPagina)) {
                daRipristinare = voce.idPagina;
            }
        }
        if (!daRipristinare) daRipristinare = ripiegoPer(lato, idUscita);

        // Se nel frattempo quella pagina è nell'altra colonna, rimetterla
        // qui provocherebbe uno SCAMBIO e l'esclusiva si riaprirebbe
        // dall'altra parte.
        const idAltro = paginaDelLato(altroLatoDi(lato));
        if (daRipristinare === idAltro) daRipristinare = ripiegoPer(lato, idAltro);

        assegnaPagina(lato, daRipristinare, { daChiusura: true });
    }

    document.querySelectorAll(".btn-fullscreen-pagina").forEach(pulsante => {
        pulsante.addEventListener("click", () => {
            // In una pagina esclusiva il pulsante non espande mai a mano:
            // l'espansione è automatica, quindi qui può solo chiudere
            const sezione = pulsante.closest(".page-section");
            if (sezione && PAGINE_ESCLUSIVE[sezione.id]) { chiudiEsclusiva(); return; }
            toggleFullscreenPagina(pulsante);
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        // In SITAC l'ESC serve ad annullare il disegno in corso, non a
        // smontare il modulo: si esce solo dal pulsante
        if (idPaginaEsclusiva === ID_SITAC) return;
        if (idPaginaEsclusiva) { chiudiEsclusiva(); return; }
        const pannelloAttivo = document.querySelector(".pannello.pannello-fullscreen");
        if (!pannelloAttivo) return;
        const pulsanteAttivo = pannelloAttivo.querySelector(".btn-fullscreen-pagina");
        if (pulsanteAttivo) toggleFullscreenPagina(pulsanteAttivo);
    });

// ==========================================================
// MODALE AIUTO E CONTATTI
// ==========================================================
const btnHelp = document.getElementById("btn-help");
const modalHelp = document.getElementById("modal-help");
const modalHelpClose = document.getElementById("modal-help-close");

if (btnHelp && modalHelp) {
    btnHelp.addEventListener("click", () => { modalHelp.style.display = "flex"; });
}
if (modalHelpClose && modalHelp) {
    modalHelpClose.addEventListener("click", () => { modalHelp.style.display = "none"; });
}
if (modalHelp) {
    modalHelp.addEventListener("click", (e) => {
        if (e.target === modalHelp) modalHelp.style.display = "none";
    });
}
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalHelp && modalHelp.style.display === "flex") {
        modalHelp.style.display = "none";
    }
});

// ==========================================================
// MODALI A FISARMONICA ALIMENTATI DA JSON
//
// Stesso motore per il vademecum "Evento rilevante" (pulsante R) e per
// "Gli 8 Passi" (pulsante 8P): cambiano solo il file e gli elementi del
// modale. Il renderer non conosce i contenuti — legge le chiavi che trova,
// così i due JSON possono avere forme diverse e crescere nel tempo senza
// che il codice vada aggiornato.
// ==========================================================
function testoSicuroModale(valore) {
    return String(valore === null || valore === undefined ? "" : valore)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chipModale(voci) {
    if (!Array.isArray(voci) || voci.length === 0) return "";
    const elementi = voci
        .map(v => `<span class="evento-rilevante-chip">${testoSicuroModale(typeof v === "object" ? JSON.stringify(v) : v)}</span>`)
        .join("");
    return `<div class="evento-rilevante-elenco">${elementi}</div>`;
}

// L'elenco principale può chiamarsi in molti modi a seconda del file:
// si prende quello riconosciuto, altrimenti il primo array disponibile
function elencoPrincipale(dati) {
    const chiaviNote = ["categorie", "passi", "voci", "sezioni", "elenco", "steps"];
    for (const chiave of chiaviNote) {
        if (Array.isArray(dati[chiave])) return dati[chiave];
    }
    return Object.values(dati).find(Array.isArray) || [];
}

function primoValore(oggetto, chiavi) {
    for (const chiave of chiavi) {
        if (oggetto[chiave] !== undefined && oggetto[chiave] !== null && oggetto[chiave] !== "") {
            return oggetto[chiave];
        }
    }
    return "";
}

// Riferimento completo della sotto-voce: 1.a., 4.a., ...
function condizioneModale(condizione, riferimentoPadre) {
    const lettera = condizione.lettera
        ? `<span class="evento-rilevante-riferimento">${testoSicuroModale(riferimentoPadre)}.${testoSicuroModale(condizione.lettera)}.</span> `
        : "";
    const alternativa = condizione.alternativa
        ? `<div class="evento-rilevante-alternativa">In alternativa: ${testoSicuroModale(condizione.alternativa)}</div>`
        : "";
    const elenchi = [condizione.nuclei, condizione.elementi, condizione.attivita]
        .map(chipModale).join("");

    return `<div class="evento-rilevante-condizione">
        <span class="evento-rilevante-sintesi">${lettera}${testoSicuroModale(primoValore(condizione, ["sintesi", "titolo", "nome"]))}</span>
        <div class="evento-rilevante-testo">${testoSicuroModale(primoValore(condizione, ["testo", "descrizione", "dettaglio"]))}</div>
        ${elenchi}${alternativa}
    </div>`;
}

// Chiavi già usate altrove nella scheda: non vanno ripetute in coda
const CHIAVI_GIA_MOSTRATE = ["id", "numero", "codice", "sigla", "titolo", "nome", "condizioni",
    "testo", "descrizione", "dettaglio", "sintesi", "lettera", "alternativa",
    "nuclei", "elementi", "attivita", "soglia"];

function dettaglioVoceModale(voce, riferimento) {
    // Forma "vademecum": la voce contiene un elenco di condizioni
    if (Array.isArray(voce.condizioni) && voce.condizioni.length > 0) {
        return voce.condizioni.map(c => condizioneModale(c, riferimento)).join("");
    }

    // Forma libera: testo principale, poi eventuali elenchi, poi il resto
    const testo = primoValore(voce, ["testo", "descrizione", "dettaglio"]);
    const parti = [];
    if (testo) parti.push(`<div class="evento-rilevante-testo">${testoSicuroModale(testo)}</div>`);

    Object.entries(voce).forEach(([chiave, valore]) => {
        if (CHIAVI_GIA_MOSTRATE.includes(chiave)) return;
        if (Array.isArray(valore)) {
            parti.push(`<h5 style="margin:10px 0 4px;">${testoSicuroModale(chiave)}</h5>${chipModale(valore)}`);
        } else if (valore !== null && typeof valore === "object") {
            parti.push(`<div class="evento-rilevante-alternativa">${testoSicuroModale(chiave)}: ${testoSicuroModale(JSON.stringify(valore))}</div>`);
        } else if (valore !== "" && valore !== null && valore !== undefined) {
            parti.push(`<div class="evento-rilevante-alternativa">${testoSicuroModale(chiave)}: ${testoSicuroModale(valore)}</div>`);
        }
    });

    return parti.join("") || `<div class="evento-rilevante-testo">Nessun dettaglio disponibile per questa voce.</div>`;
}

// Apertura/chiusura delle voci: un solo listener sul contenitore, valido
// anche per le schede ricostruite da zero a ogni ricaricamento
function abilitaFisarmonica(contenitore) {
    if (!contenitore) return;
    contenitore.addEventListener("click", (e) => {
        const testata = e.target.closest(".evento-rilevante-testata");
        if (!testata) return;
        const dettaglio = testata.parentElement.querySelector(":scope > .evento-rilevante-dettaglio");
        if (!dettaglio) return;
        const aperto = dettaglio.classList.toggle("aperto");
        testata.setAttribute("aria-expanded", aperto ? "true" : "false");
        const freccia = testata.querySelector(".freccia");
        if (freccia) freccia.textContent = aperto ? "▼" : "▶";
    });
}

function disegnaFisarmonicaJson(dati, contenitore, elementoTitolo, prefissoTitolo) {
    if (elementoTitolo && dati.titolo) elementoTitolo.textContent = `${prefissoTitolo} ${dati.titolo}`;

    const logica = dati.logica
        ? ` Rif. nota DCEMER Prot. n. 4608/2016.`
        : "";
    const premessa = dati.premessa
        ? `<div class="evento-rilevante-premessa">${testoSicuroModale(dati.premessa)}${logica}</div>`
        : "";

    const voci = elencoPrincipale(dati).map((voce, indice) => {
        const riferimento = primoValore(voce, ["id", "numero"]) || (indice + 1);
        const codice = primoValore(voce, ["codice", "sigla"]);
        const distintivo = codice
            ? `<span class="evento-rilevante-codice">${testoSicuroModale(codice)}</span>`
            : "";
        const titolo = testoSicuroModale(primoValore(voce, ["titolo", "nome"]));

        return `<div class="evento-rilevante-voce">
            <button type="button" class="evento-rilevante-testata" aria-expanded="false">
                <span class="freccia">▶</span>
                ${distintivo}
                <span>${testoSicuroModale(riferimento)}. ${titolo}</span>
            </button>
            <div class="evento-rilevante-dettaglio">${dettaglioVoceModale(voce, riferimento)}</div>
        </div>`;
    }).join("");

    contenitore.innerHTML = premessa + voci;
}

// Collega pulsante, modale e file JSON. Il caricamento avviene alla prima
// apertura (non all'avvio) e passa dalla cache condivisa del core.
function collegaModaleJson({ idBottone, idModale, idChiusura, idContenuto, idTitolo, percorso, prefissoTitolo }) {
    const bottone = document.getElementById(idBottone);
    const modale = document.getElementById(idModale);
    const chiusura = document.getElementById(idChiusura);
    const contenuto = document.getElementById(idContenuto);
    const titolo = document.getElementById(idTitolo);
    if (!bottone || !modale || !contenuto) return;

    let giaCaricato = false;

    function chiudi() { modale.style.display = "none"; }

    bottone.addEventListener("click", () => {
        modale.style.display = "flex";
        if (giaCaricato) return;

        contenuto.innerHTML = `<p class="pagina-nota">Caricamento in corso…</p>`;
        FireOps.caricaJson(percorso)
            .then(dati => {
                giaCaricato = true;
                disegnaFisarmonicaJson(dati, contenuto, titolo, prefissoTitolo);
            })
            .catch(err => {
                console.error(`Contenuto non disponibile (${percorso}):`, err);
                contenuto.innerHTML = `<p class="pagina-nota" style="color:var(--danger-color);">Impossibile leggere <code>${testoSicuroModale(percorso)}</code>: ${testoSicuroModale(err.message)}</p>`;
            });
    });

    if (chiusura) chiusura.addEventListener("click", chiudi);
    modale.addEventListener("click", (e) => { if (e.target === modale) chiudi(); });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modale.style.display === "flex") chiudi();
    });

    abilitaFisarmonica(contenuto);
}

collegaModaleJson({
    idBottone: "btn-evento-rilevante",
    idModale: "modal-evento-rilevante",
    idChiusura: "modal-evento-rilevante-close",
    idContenuto: "evento-rilevante-contenuto",
    idTitolo: "evento-rilevante-titolo",
    percorso: "/FireOps/db/interventorilevante.json",
    prefissoTitolo: "🅁",
});

collegaModaleJson({
    idBottone: "btn-otto-passi",
    idModale: "modal-otto-passi",
    idChiusura: "modal-otto-passi-close",
    idContenuto: "otto-passi-contenuto",
    idTitolo: "otto-passi-titolo",
    percorso: "/FireOps/db/8passi.json",
    prefissoTitolo: "👣",
});

    // Una sola pagina per volta può essere esclusiva: se una sessione
    // salvata da una versione precedente ne ha due, la seconda ripiega.
    if (PAGINE_ESCLUSIVE[paginaSinistra] && PAGINE_ESCLUSIVE[paginaDestra]) {
        paginaDestra = ripiegoPer("destra", paginaSinistra);
    }

    CATALOGO_PAGINE.forEach(pagina => {
        if (pagina.id !== paginaSinistra && pagina.id !== paginaDestra && magazzinoPagine) {
            spostaSezione(pagina.id, "magazzino");
        }
    });
    spostaSezione(paginaSinistra, "sinistra");
    spostaSezione(paginaDestra, "destra");

    // Pagina esclusiva già in un pannello da sessione precedente: si riapre
    // esclusiva, altrimenti resterebbe schiacciata in mezza colonna
    if (PAGINE_ESCLUSIVE[paginaSinistra]) entraInEsclusiva(paginaSinistra, "sinistra");
    else if (PAGINE_ESCLUSIVE[paginaDestra]) entraInEsclusiva(paginaDestra, "destra");
    else aggiornaSubheader();

// ==========================================================
// REGOLAMENTO DI SERVIZIO (D.P.R. 64/2012)
// Albero Titolo > Capo > Sezione > Articolo > commi > lettere > numeri.
// Non passa da disegnaFisarmonicaJson: quello serve a elenchi piatti e qui
// prenderebbe 'preambolo' come elenco principale, sfarinandolo carattere
// per carattere in Object.entries().
// ==========================================================
function indicizzaArticoliDpr(articoli) {
    const mappa = new Map();
    (articoli || []).forEach(a => mappa.set(a.numero, a));
    return mappa;
}

// Nei commi con lettere, 'testo' contiene solo la frase introduttiva:
// lettere e numeri vanno resi a parte, senza rischio di duplicazione
function corpoArticoloDpr(articolo) {
    if (!articolo) return `<div class="evento-rilevante-testo">Testo non disponibile.</div>`;

    const commi = (articolo.commi || []).map(comma => {
        const lettere = (comma.lettere || []).map(l => {
            const numeri = (l.numeri || []).map(n =>
                `<div class="evento-rilevante-alternativa">${n.numero}) ${testoSicuroModale(n.testo)}</div>`
            ).join("");
            return `<div class="evento-rilevante-condizione">
                <span class="evento-rilevante-sintesi">${testoSicuroModale(l.lettera)})</span>
                <div class="evento-rilevante-testo">${testoSicuroModale(l.testo)}</div>
                ${numeri}
            </div>`;
        }).join("");

        return `<div class="evento-rilevante-condizione">
            <span class="evento-rilevante-riferimento">${testoSicuroModale(comma.numero)}.</span>
            <div class="evento-rilevante-testo">${testoSicuroModale(comma.testo)}</div>
            ${lettere}
        </div>`;
    }).join("");

    return commi || `<div class="evento-rilevante-testo">${testoSicuroModale(articolo.testo || "")}</div>`;
}

function voceFisarmonica(codice, titolo, contenuto, conteggio) {
    const badge = conteggio
        ? `<span class="evento-rilevante-conteggio">${testoSicuroModale(conteggio)}</span>`
        : "";
    return `<div class="evento-rilevante-voce">
        <button type="button" class="evento-rilevante-testata" aria-expanded="false">
            <span class="freccia">▶</span>
            <span class="evento-rilevante-codice">${testoSicuroModale(codice)}</span>
            <span class="evento-rilevante-rubrica">${testoSicuroModale(titolo)}</span>
            ${badge}
        </button>
        <div class="evento-rilevante-dettaglio">${contenuto}</div>
    </div>`;
}

// Un Titolo non ha articoli propri: li hanno i capi e le sezioni sotto.
// Il conteggio scende quindi fino alle foglie. NOTA: il JSON di Normattiva
// ripete gli articoli dei capi anche sul titolo padre, quindi contare
// nodo.articoli su un nodo che ha figli produrrebbe un doppione — per
// questo qui vale la stessa regola del rendering: se ci sono figli si
// guarda solo a loro.
function contaArticoliDpr(nodo) {
    const figli = nodo.figli || [];
    if (figli.length > 0) {
        return figli.reduce((somma, f) => somma + contaArticoliDpr(f), 0);
    }
    return (nodo.articoli || []).length;
}

function nodoStrutturaDpr(nodo, mappaArticoli) {
    const figli = nodo.figli || [];
    const contenuto = figli.length > 0
        ? figli.map(f => nodoStrutturaDpr(f, mappaArticoli)).join("")
        : (nodo.articoli || []).map(numero => {
              const art = mappaArticoli.get(numero);
              return voceFisarmonica(
                  art ? art.etichetta : `Art. ${numero}`,
                  art ? art.rubrica : "",
                  corpoArticoloDpr(art)
              );
          }).join("");

    const tipo = String(nodo.tipo || "").replace(/^./, c => c.toUpperCase());
    const quanti = contaArticoliDpr(nodo);

    return voceFisarmonica(
        `${tipo} ${nodo.numero}`,
        nodo.rubrica,
        contenuto || `<div class="evento-rilevante-testo">Nessun articolo in questa partizione.</div>`,
        quanti ? `${quanti} art.` : ""
    );
}

function disegnaRegolamentoDpr(dati) {
    const mappaArticoli = indicizzaArticoliDpr(dati.articoli);
    const fonte = dati.fonte
        ? ` — <a href="${dati.fonte}" target="_blank" rel="noopener">Normattiva</a>` : "";
    const premessa = `<div class="evento-rilevante-premessa">
        <strong>${testoSicuroModale(dati.titolo_breve || "")}</strong><br>
        ${testoSicuroModale(dati.rubrica || "")}<br>
        In vigore dal ${testoSicuroModale(dati.entrata_in_vigore || "-")} ·
        vigente al ${testoSicuroModale(dati.vigente_al || "-")}${fonte}
    </div>`;

    return premessa + (dati.struttura || [])
        .map(n => nodoStrutturaDpr(n, mappaArticoli))
        .join("");
}

// ==========================================================
// PAGINA NORMATIVE: un listener solo sul contenitore.
// Le testate con data-fonte caricano il file alla prima apertura;
// tutte le altre (titoli, capi, sezioni, articoli) si limitano ad aprirsi.
// ==========================================================
const RENDERER_NORMATIVE = {
    "/FireOps/db/dpr642012.json": disegnaRegolamentoDpr
};

const contenitoreNormative = document.getElementById("normative-contenuto");

if (contenitoreNormative) {
    contenitoreNormative.addEventListener("click", (e) => {
        const testata = e.target.closest(".evento-rilevante-testata");
        if (!testata || !contenitoreNormative.contains(testata)) return;

        const dettaglio = testata.parentElement.querySelector(":scope > .evento-rilevante-dettaglio");
        if (!dettaglio) return;

        const aperto = dettaglio.classList.toggle("aperto");
        testata.setAttribute("aria-expanded", aperto ? "true" : "false");
        const freccia = testata.querySelector(".freccia");
        if (freccia) freccia.textContent = aperto ? "▼" : "▶";

        const percorso = testata.dataset.fonte;
        if (!percorso || testata.dataset.caricato === "si") return;

        testata.dataset.caricato = "si";
        dettaglio.innerHTML = `<p class="pagina-nota">Caricamento in corso…</p>`;

        FireOps.caricaJson(percorso)
            .then(dati => {
                const disegna = RENDERER_NORMATIVE[percorso];
                dettaglio.innerHTML = disegna
                    ? disegna(dati)
                    : `<p class="pagina-nota">Nessun renderer per questa fonte.</p>`;
            })
            .catch(err => {
                testata.dataset.caricato = ""; // un errore non deve impedire un nuovo tentativo
                console.error(`Normativa non disponibile (${percorso}):`, err);
                dettaglio.innerHTML = `<p class="pagina-nota" style="color:var(--danger-color);">Impossibile leggere <code>${testoSicuroModale(percorso)}</code>: ${testoSicuroModale(err.message)}</p>`;
            });
    });
}

aggiornaSelettori();
salvaPaginePannelli();

    // ==========================================================
    // PAGINA MESSAGGISTICA: messaggio precompilato multilingua
    // + invio tramite WhatsApp Web, WhatsApp Desktop o Telegram
    // ==========================================================
    const inputPrefissoMsg = document.getElementById("msg-prefisso-input");
    const hiddenPrefissoMsg = document.getElementById("msg-prefisso");
    const dropdownPrefissoMsg = document.getElementById("msg-prefisso-dropdown");

    const inputLinguaMsg = document.getElementById("msg-lingua-input");
    const hiddenLinguaMsg = document.getElementById("msg-lingua");
    const dropdownLinguaMsg = document.getElementById("msg-lingua-dropdown");

    const inputNumeroMsg = document.getElementById("msg-numero");
    const textareaMsg = document.getElementById("msg-testo");
    const btnWhatsappWeb = document.getElementById("btn-whatsapp-web");
    const btnWhatsappApp = document.getElementById("btn-whatsapp-app");
    const btnInviaTelegram = document.getElementById("btn-invia-telegram");

    const PREFISSO_PREDEFINITO = "39";  // Italia
    const LINGUA_PREDEFINITA = "it";    // Italiano

    // ==========================================================
    // PAGINA MODULI CMR: ricerca modulo per Descrizione + riepilogo dati
    // ==========================================================
    const inputModuloCMR = document.getElementById("cmr-modulo-input");
    const hiddenModuloCMR = document.getElementById("cmr-modulo");
    const dropdownModuloCMR = document.getElementById("cmr-modulo-dropdown");

    // ==========================================================
    // COMBOBOX RICERCABILE: input di testo + lista filtrata a comparsa,
    // usato per Prefisso internazionale e Lingua messaggio (utile con
    // elenchi lunghi, specialmente su mobile).
    // ==========================================================
    function creaComboRicercabile(opzioni) { return FireOps.creaCombo(opzioni); }

    // Popola il campo ricercabile dei prefissi internazionali (default: 39 - Italia)
    function popolaSelectPrefissoMsg(listaPrefissi) {
        if (!inputPrefissoMsg) return;

        const comboPrefisso = creaComboRicercabile({
            input: inputPrefissoMsg,
            hidden: hiddenPrefissoMsg,
            dropdown: dropdownPrefissoMsg,
            elenco: listaPrefissi,
            cercaValore: p => p.Valore,
            mostraTesto: p => p.Prefissi,
            onScelta: validaCampiMessaggistica
        });

        if (listaPrefissi.some(p => p.Valore === PREFISSO_PREDEFINITO)) {
            comboPrefisso.impostaValore(PREFISSO_PREDEFINITO);
        }

        validaCampiMessaggistica();
    }
    window.popolaSelectPrefissoMsg = popolaSelectPrefissoMsg;

    // Popola il campo ricercabile delle lingue disponibili (default: Italiano)
    function popolaSelectLinguaMsg(listaLingue) {
        if (!inputLinguaMsg) return;

        const comboLingua = creaComboRicercabile({
            input: inputLinguaMsg,
            hidden: hiddenLinguaMsg,
            dropdown: dropdownLinguaMsg,
            elenco: listaLingue,
            cercaValore: l => l.code,
            mostraTesto: l => l.lingua,
            onScelta: generaMessaggioMessaggistica
        });

        if (listaLingue.some(l => l.code === LINGUA_PREDEFINITA)) {
            comboLingua.impostaValore(LINGUA_PREDEFINITA);
        }

        // Alla prima generazione disponibile, genera subito il messaggio
        generaMessaggioMessaggistica();
    }
    window.popolaSelectLinguaMsg = popolaSelectLinguaMsg;

    // Popola il campo ricercabile dei moduli CMR (cerca per Descrizione)
    function popolaSelectModuloCMR(listaModuli) {
        if (!inputModuloCMR) return;

        creaComboRicercabile({
            input: inputModuloCMR,
            hidden: hiddenModuloCMR,
            dropdown: dropdownModuloCMR,
            elenco: listaModuli,
            cercaValore: m => m["Numero progressivo del modulo pianificato"],
            mostraTesto: m => m["Descrizione"],
            placeholderOpzione: "-- Seleziona modulo --",
            onScelta: (modulo) => renderRiepilogoModuloCMR(modulo)
        });
    }
    window.popolaSelectModuloCMR = popolaSelectModuloCMR;

    // Costruisce la tabella di riepilogo del modulo CMR selezionato, cercandolo nel JSON.
    // Se nessun modulo è ancora selezionato, mostra comunque la tabella con le sole etichette.
    function renderRiepilogoModuloCMR(modulo) {
        const container = document.getElementById("riepilogo-modulo-cmr");
        if (!container) return;

        const campo = valore => (valore && String(valore).trim()) ? valore : "-";
        const get = chiave => modulo ? campo(modulo[chiave]) : "-";
        const coloreModulo = modulo ? (modulo["Colore"] || "var(--primary-color)") : "var(--border-color)";
        const codiceCompleto = modulo ? [modulo["Codice Tipologia Modulo"], modulo["Codice Modulo"]].filter(Boolean).join(".") : "";
        const titolo = modulo ? `${codiceCompleto} — ${campo(modulo["Denominazione modulo"])}` : "Nessun modulo selezionato";

        container.innerHTML = `
            <div class="riepilogo-box">
                <h4 class="cmr-titolo-modulo" style="border-left-color: ${coloreModulo};">
                    ${titolo}
                </h4>
                <table class="riepilogo-tabella">
                    <tbody>
                        <tr><th>Numero modulo</th><td>${get("Numero progressivo del modulo pianificato")}</td></tr>
                        <tr><th>Tipo modulo</th><td>${get("Tipo Modulo")}</td></tr>
                        <tr><th>Denominazione internazionale</th><td>${get("Denominazione internazionale secondo meccanismo europeo (se applicabile)")}</td></tr>
                        <tr><th>Compiti e funzioni</th><td>${get("Compiti e funzioni")}</td></tr>
                        <tr><th>Capacità</th><td>${get("Capacità")}</td></tr>
                        <tr><th>Componenti principali</th><td>${get("Componenti principali")}</td></tr>
                        <tr><th>Autosufficienza mobilitazione</th><td>${get("Autosufficienza mobilitazione")}</td></tr>
                        <tr><th>Automezzi predisposti</th><td>${get("Tipologia e numero di automezzi predisposti")}</td></tr>
                        <tr><th>Equipaggio</th><td>${get("Equipaggio (numero componenti)")}</td></tr>
                        <tr><th>Trasporto con mezzo aereo</th><td>${get("Pianificazione per trasporto con mezzo aereo")}</td></tr>
                        <tr><th>Approvvigionamento a regime</th><td>${get("Esigenze di approvvigionamento a regime")}</td></tr>
                        <tr><th>Dimensioni, pesi e ingombri</th><td>${get("Dimensioni, pesi e ingombri (utili per l’imbarco o il trasporto mediante mezzi aerei)")}</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    }
    window.renderRiepilogoModuloCMR = renderRiepilogoModuloCMR;

    // Mostra subito la tabella con le sole etichette, ancora prima che i dati siano caricati
    renderRiepilogoModuloCMR(null);

    // ==========================================================
    // PAGINA "SOSTANZE PERICOLOSE": ricerca sul database ICSC (ILO/OMS)
    // ==========================================================
    // Un unico campo di ricerca (come i Moduli CMR): si digita nome, sinonimo,
    // CAS o numero scheda, e selezionando un risultato si apre subito la scheda
    // esatta (pattern confermato affidabile: showcard.display?p_card_id=NNNN).
    const inputIcscCerca = document.getElementById("icsc-cerca-input");
    const hiddenIcscCerca = document.getElementById("icsc-cerca-hidden");
    const dropdownIcscCerca = document.getElementById("icsc-cerca-dropdown");
    const btnCercaIcscOnline = document.getElementById("btn-cerca-icsc-online");

    function apriSchedaIcsc(numero) {
        window.open(`https://chemicalsafety.ilo.org/dyn/icsc/showcard.display?p_lang=it&p_card_id=${numero}&p_version=2`, "_blank", "noopener");
    }

    // Popola il combo di ricerca unico: filtra su nome, sinonimi, CAS e numero scheda insieme.
    // Selezionando un risultato si apre subito la scheda, nessun pulsante "Cerca" necessario.
function popolaComboSostanzePericolose(lista) {
    if (!inputIcscCerca || !lista || lista.length === 0) return;
 
    creaComboRicercabile({
        input: inputIcscCerca,
        hidden: hiddenIcscCerca,
        dropdown: dropdownIcscCerca,
        elenco: lista,
        cercaValore: s => s.Numero,
        mostraTesto: s => {
            const cas = s.CAS ? ` [CAS ${s.CAS}]` : "";
            const base = `${s.Numero} — ${s.Nome}${cas}`;
            if (!s.Sinonimi) return base;
            const riga = `${base} — ${s.Sinonimi}`;
            return riga.length > 110 ? riga.slice(0, 107) + "…" : riga;
        },
        testoRicerca: s => `${s.Numero} ${s.Nome} ${s.CAS || ""} ${s.Sinonimi || ""}`,
        testoSelezionato: s => s.Nome,
        // Selezionata la sostanza: apre la scheda ILO E mostra il badge ONU/Kemler (se presente)
        onScelta: s => {
            apriSchedaIcsc(s.Numero);
            renderIcscSelezionata(s);
        }
    });
}
window.popolaComboSostanzePericolose = popolaComboSostanzePericolose;
 
// Mostra nome sostanza + chip ONU/Kemler/Classe ADR sotto la ricerca.
// Il campo "onu" è opzionale: se assente (sostanza non ancora abbinata a un
// numero ADR) mostra chip "assente" invece di lasciare uno spazio vuoto muto.
// "onu.verificato" distingue un match automatico (da controllare) da uno
// confermato a mano: non trattarli mai come equivalenti in UI.
function renderIcscSelezionata(sostanza) {
    const container = document.getElementById("icsc-scheda-selezionata");
    if (!container) return;
 
    if (!sostanza) {
        container.innerHTML = "";
        return;
    }
 
    const onu = sostanza.onu;
    let chipOnu, chipKemler, chipClasse = "";
 
    if (onu && onu.numero) {
        const stato = onu.verificato ? "verificato" : "da-verificare";
        const tooltip = onu.verificato
            ? `Verificato${onu.fonte ? " — " + onu.fonte : ""}`
            : `Importato automaticamente${onu.tipo_match ? " (" + onu.tipo_match + ")" : ""} — controllare prima dell'uso operativo`;
 
        chipOnu = `<span class="onu-kemler-chip ${stato}" title="${tooltip}">ONU <span class="val">${onu.numero}</span></span>`;
 
        chipKemler = onu.kemler
            ? `<span class="onu-kemler-chip ${stato}" title="${tooltip}">Kemler <span class="val">${onu.kemler}</span></span>`
            : `<span class="onu-kemler-chip da-verificare" title="Kemler non verificato — consultare Tabella A ADR colonna 20">Kemler <span class="val">?</span></span>`;
 
        if (onu.classe_adr) {
            chipClasse = `<span class="onu-kemler-chip ${stato}">Classe ADR <span class="val">${onu.classe_adr}</span></span>`;
        }
    } else {
        chipOnu = `<span class="onu-kemler-chip assente">ONU non disponibile</span>`;
        chipKemler = `<span class="onu-kemler-chip assente">Kemler non disponibile</span>`;
    }
 
    container.innerHTML = `
        <div class="icsc-scheda-nome">Selezionata: <strong>${sostanza.Nome}</strong> (scheda ${sostanza.Numero})</div>
        <div class="onu-kemler-block">${chipOnu}${chipKemler}${chipClasse}</div>
    `;
}
window.renderIcscSelezionata = renderIcscSelezionata;

    // Fallback: quando la sostanza digitata non è nel database locale (CAS non ancora
    // verificato, UN number, sinonimo non censito...), prova comunque la ricerca online
    if (btnCercaIcscOnline) {
        btnCercaIcscOnline.addEventListener("click", () => {
            const testo = (inputIcscCerca.value || "").trim();
            if (!testo) return;

            const parametri = new URLSearchParams({ p_lang: "it" });
            parametri.set("p_substance_name", testo);
            parametri.set("p_cas_no", testo);
            parametri.set("p_free_text", testo);

            window.open(`https://chemicalsafety.ilo.org/dyn/icsc/showcard.listcards3?${parametri.toString()}`, "_blank", "noopener");
        });
    }

    // ==========================================================
    // PAGINA LINK UTILI: pulsanti ai vari siti raggruppati per tema
    // ==========================================================

    // Raggruppa l'elenco piatto del JSON in { Categoria: { Sottocategoria: [voci] } },
    // preservando l'ordine di comparsa così come arrivano dal file
    function raggruppaLinkUtili(elenco) {
        const gruppi = new Map();
        elenco.forEach(voce => {
            const categoria = voce["Categoria"] || "Altro";
            const sottocategoria = voce["Sottocategoria"] || "";
            if (!gruppi.has(categoria)) gruppi.set(categoria, new Map());
            const sottogruppi = gruppi.get(categoria);
            if (!sottogruppi.has(sottocategoria)) sottogruppi.set(sottocategoria, []);
            sottogruppi.get(sottocategoria).push(voce);
        });
        return gruppi;
    }

    // Costruisce i pulsanti della pagina Link Utili, raggruppati per Categoria e Sottocategoria.
    // I link senza URL compilato vengono mostrati disabilitati (dato non ancora inserito nel JSON).
    // Sostituisce i segnaposto {{LAT}} e {{LNG}} nell'URL con le coordinate del Comando
    // attualmente attivo (letto da sessionStorage), così i link mappa puntano sempre
    // alla zona giusta invece di un punto fisso. Se non c'è ancora un Comando attivo
    // o l'URL non contiene segnaposto, restituisce l'URL invariato.
    function sostituisciCoordinateUrl(url) {
        if (!url || (!url.includes("{{LAT}}") && !url.includes("{{LNG}}"))) return url;

        const nomeComandoAttivo = sessionStorage.getItem(CHIAVE_STORAGE);
        const comandoAttivo = comandiData.find(c => c.Comando === nomeComandoAttivo);
        const coord = estraiCoordinate(comandoAttivo);
        if (!coord) return "";

        return url.split("{{LAT}}").join(coord.lat).split("{{LNG}}").join(coord.lng);
    }

    function renderLinkUtili(elenco) {
        const container = document.getElementById("link-utili-contenuto");
        if (!container) return;

        if (!elenco || elenco.length === 0) {
            container.innerHTML = "<p class=\"pagina-nota\">Nessun link disponibile.</p>";
            return;
        }

        const gruppi = raggruppaLinkUtili(elenco);
        let html = "";
        let indiceCategoria = 0;

        gruppi.forEach((sottogruppi, categoria) => {
            const idContenuto = `link-utili-categoria-${indiceCategoria++}`;
            html += `<h4 class="link-utili-categoria sezione-toggle" data-target="${idContenuto}">${categoria}</h4>`;
            html += `<div id="${idContenuto}" class="link-utili-categoria-contenuto">`;

            sottogruppi.forEach((voci, sottocategoria) => {
                if (sottocategoria) {
                    html += `<h5 class="link-utili-sottocategoria">${sottocategoria}</h5>`;
                }

                html += `<div class="link-utili-griglia">`;
                voci.forEach(voce => {
                    const url = sostituisciCoordinateUrl((voce["URL"] || "").trim());
                    if (url) {
                        html += `<a class="link-utili-pulsante" href="${url}" target="_blank" rel="noopener">${voce["Nome"]}</a>`;
                    } else {
                        html += `<span class="link-utili-pulsante link-utili-pulsante-disabilitato" title="URL non ancora inserito">${voce["Nome"]}</span>`;
                    }
                });
                html += `</div>`;
            });

            html += `</div>`;
        });

        container.innerHTML = html;

        // Ogni categoria si apre/chiude cliccando sul titolo (parte collassata di default)
        container.querySelectorAll(".sezione-toggle").forEach(header => {
            const contenuto = document.getElementById(header.dataset.target);
            if (contenuto) {
                header.addEventListener("click", () => toggleSezione(header, contenuto));
            }
        });
    }
    window.renderLinkUtili = renderLinkUtili;

    // ==========================================================
    // VALIDAZIONE CAMPI MESSAGGISTICA: evidenzia i campi mancanti
    // (prefisso, numero, lingua) e abilita/disabilita i pulsanti di invio
    // ==========================================================
    function validaCampiMessaggistica() {
        const prefissoOk = !!(hiddenPrefissoMsg && hiddenPrefissoMsg.value);
        const numeroOk = !!(inputNumeroMsg && inputNumeroMsg.value.trim());
        const linguaOk = !!(hiddenLinguaMsg && hiddenLinguaMsg.value);

        if (inputPrefissoMsg) inputPrefissoMsg.classList.toggle("campo-mancante", !prefissoOk);
        if (inputNumeroMsg) inputNumeroMsg.classList.toggle("campo-mancante", !numeroOk);
        if (inputLinguaMsg) inputLinguaMsg.classList.toggle("campo-mancante", !linguaOk);

        const tuttiCompilati = prefissoOk && numeroOk && linguaOk;
        [btnWhatsappWeb, btnWhatsappApp, btnInviaTelegram].forEach(btn => {
            if (btn) btn.disabled = !tuttiCompilati;
        });

        return { prefissoOk, numeroOk, linguaOk, tuttiCompilati };
    }
    window.validaCampiMessaggistica = validaCampiMessaggistica;

    if (inputNumeroMsg) {
        inputNumeroMsg.addEventListener("input", validaCampiMessaggistica);
    }

    // Testi del messaggio tradotti (solo il corpo istruttivo: il footer con
    // data/ora/turno resta sempre in italiano, essendo un dato operativo).
    // Lingue non presenti in questo elenco ricadono automaticamente sull'italiano.
    const TRADUZIONI_MESSAGGIO = {
        it: `🚒 *Vigili del Fuoco {{COMANDO}}* 🚒

Messaggio generato automaticamente.

Utilizzi questo numero per inviarci posizione, foto, video o altre informazioni dell'evento che ci ha comunicato.

*QUESTO NON È UN NUMERO PER LE EMERGENZE*
e NON lo utilizzi per altri scopi o in altre occasioni senza la nostra autorizzazione.

Per tutte le richieste di soccorso chiami il
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Per l'invio delle coordinate:
1. Clicchi sulla "graffetta" (Android) 📎 o sul "più" (Apple) ➕
2. Clicchi su "Posizione" ⛳
3. Se necessario segua le indicazioni del dispositivo per consentire a WhatsApp di accedere alla posizione 🆗️
4. Attenda qualche istante per aumentare la precisione ⏰
5. Clicchi su "Posizione attuale" 🎯

*Rimanga al sicuro, nella posizione che ci ha condiviso e lasci libera la linea telefonica.*`,

        en: `🚒 *Fire Brigade {{COMANDO}}* 🚒

Automatically generated message.

Please use this number to send us your location, photos, videos, or other information about the incident you reported.

*THIS IS NOT AN EMERGENCY NUMBER*
and DO NOT use it for any other purpose or occasion without our permission.

For all emergency requests, call
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

To send coordinates:
1. Click on the "paperclip" (Android) 📎 or the "plus" (Apple) ➕
2. Click on "Location" ⛳
3. If necessary, follow the device's prompts to allow WhatsApp to access your location 🆗️
4. Wait a few moments to increase accuracy ⏰
5. Click on "Current Location" 🎯

*Stay safe, in the location you shared with us, and keep your phone line free.*`,

        es: `🚒 *Bomberos {{COMANDO}}* 🚒

Mensaje generado automáticamente.

Utilice este número para enviarnos su ubicación, fotos, videos u otra información sobre el incidente que reportó.

*ESTE NO ES UN NÚMERO DE EMERGENCIA*
y NO lo utilice para ningún otro propósito o ocasión sin nuestra autorización.

Para cualquier solicitud de emergencia, llame al
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Para enviar coordenadas:
1. Haga clic en el icono del clip (Android) 📎 o en el signo más (+) (Apple) ➕
2. Haga clic en "Ubicación" ⛳
3. Si es necesario, siga las instrucciones del dispositivo para permitir que WhatsApp acceda a su ubicación 🆗️
4. Espere unos instantes para que la ubicación sea más precisa ⏰
5. Haga clic en "Ubicación actual" 🎯

*Manténgase a salvo en la ubicación que nos indicó y mantenga su línea telefónica libre.*`,

        fr: `🚒 *Sapeur Pompiers {{COMANDO}}* 🚒

Message automatique.

Veuillez utiliser ce numéro pour nous envoyer votre position, des photos, des vidéos ou toute autre information concernant l'incident que vous avez signalé.

*CECI N'EST PAS UN NUMÉRO D'URGENCE*

et NE L'UTILISEZ PAS à d'autres fins sans notre autorisation.

Pour toute urgence, appelez le
☎️🆘️

*{{NUM}}*

🇪🇺🇮🇹

Pour envoyer vos coordonnées :

1. Cliquez sur le trombone (Android) 📎 ou le plus (Apple) ➕

2. Cliquez sur « Position » ⛳

3. Si nécessaire, suivez les instructions de votre appareil pour autoriser WhatsApp à accéder à votre position 🆗️

4. Patientez quelques instants pour une meilleure précision ⏰

5. Cliquez sur « Position actuelle » 🎯

*Restez en sécurité à l'endroit que vous nous avez indiqué et assurez-vous que votre ligne téléphonique est libre.*

Crédit : VVFsendWhatsApp

Vendredi 31 juillet 2026, 12 h 04 - Équipe A3`,

        sq: `🚒 *Brigada e Zjarrfikësve {{COMANDO}}* 🚒

Mesazh i gjeneruar automatikisht.

Ju lutemi përdorni këtë numër për të na dërguar vendndodhjen tuaj, fotot, videot ose informacione të tjera në lidhje me incidentin që raportuat.

*KY NUK ËSHTË NJË NUMËR URGJENCE*
dhe MOS e përdorni për asnjë qëllim ose rast tjetër pa lejen tonë.

Për të gjitha kërkesat emergjente, telefononi
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Për të dërguar koordinatat:
1. Klikoni mbi "kapësen e letrës" (Android) 📎 ose "plus" (Apple) ➕
2. Klikoni mbi "Vendndodhjen" ⛳
3. Nëse është e nevojshme, ndiqni udhëzimet e pajisjes për të lejuar WhatsApp të hyjë në vendndodhjen tuaj 🆗️
4. Prisni disa momente për të rritur saktësinë ⏰
5. Klikoni mbi "Vendndodhja aktuale" 🎯

*Qëndroni të sigurt, në vendndodhjen që keni ndarë me ne, dhe mbajeni linjën tuaj telefonike të lirë.*`,

        ar: `🚒 *فرقة الإطفاء {{COMANDO}}* 🚒

رسالة مُولّدة تلقائيًا.

يُرجى استخدام هذا الرقم لإرسال موقعك، أو صورك، أو مقاطع الفيديو الخاصة بك، أو أي معلومات أخرى حول الحادث الذي أبلغت عنه.

*هذا ليس رقم طوارئ*
ولا تستخدمه لأي غرض آخر أو في أي مناسبة أخرى دون إذننا.


لجميع طلبات الطوارئ، اتصل على

☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

لإرسال الإحداثيات:

١. انقر على رمز المشبك (أندرويد) 📎 أو رمز الزائد (آبل) ➕

٢. انقر على "الموقع" ⛳

٣. إذا لزم الأمر، اتبع تعليمات جهازك للسماح لتطبيق واتساب بالوصول إلى موقعك 🆗️

٤. انتظر لحظات لزيادة دقة الموقع ⏰

٥. انقر على "الموقع الحالي" 🎯

*ابقَ آمنًا في الموقع الذي شاركته معنا، وتأكد من خلو خط هاتفك.*`,

        bg: `🚒 *Пожарна бригада {{COMANDO}}* 🚒

Автоматично генерирано съобщение.

Моля, използвайте този номер, за да ни изпратите вашето местоположение, снимки, видеоклипове или друга информация за инцидента, за който съобщихте.

*ТОВА НЕ Е НОМЕР ЗА СПЕШНИ СЛУЧАИ*
и НЕ го използвайте за други цели или случаи без наше разрешение.

За всички спешни заявки, обадете се на
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

За да изпратите координати:
1. Кликнете върху „кламер“ (Android) 📎 или „плюс“ (Apple) ➕
2. Кликнете върху „Местоположение“ ⛳
3. Ако е необходимо, следвайте инструкциите на устройството, за да позволите на WhatsApp достъп до вашето местоположение 🆗️
4. Изчакайте няколко минути, за да увеличите точността ⏰
5. Кликнете върху „Текущо местоположение“ 🎯

*Бъдете в безопасност, на мястото, което споделихте с нас, и дръжте телефонната си линия свободна.*`,

        cs: `🚒 *Hasičský sbor {{COMANDO}}* 🚒

Automaticky generovaná zpráva.

Použijte prosím toto číslo k zaslání vaší polohy, fotografií, videí nebo dalších informací o incidentu, který jste nahlásili.

*TOTO NENÍ ČÍSLO PRO NOUZOVÉ VOLITELNÉ SITUACE*
a NEPOUŽÍVEJTE ho k žádnému jinému účelu ani příležitosti bez našeho svolení.

V případě nouze volejte
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Odeslání souřadnic:
1. Klikněte na „sponku“ (Android) 📎 nebo „plus“ (Apple) ➕
2. Klikněte na „Poloha“ ⛳
3. V případě potřeby postupujte podle pokynů na zařízení, abyste povolili aplikaci WhatsApp přístup k vaší poloze 🆗️
4. Pro zvýšení přesnosti chvíli počkejte ⏰
5. Klikněte na „Aktuální poloha“ 🎯

*Zůstaňte v bezpečí, na místě, které jste s námi sdíleli, a mějte volnou telefonní linku.*`,

        "zh-CN": `🚒 *消 防 队 {{COMANDO}}* 🚒

自 动 生 成 的 消 息 。

使 用 此 号 码 向 我 们 发 送 您 与 我 们 交 流 的 活 动 的 位 置，照 片，视 频 或 其 他 信 息 。

*这 不 是 紧 急 号 码*
未 经 我 们 的 允 许，请 勿 将 其 用 于 任 何 其 他 目 的 或 在 其 他 场 合 使 用 。

对 于 所 有 遇 险 电 话，请 致 电
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

发 送 坐 标：
1. 单 击 “回 形 针”（Android）📎 或 “加 号”（Apple）➕
2. 单 击“位置” ⛳
3. 如 有 必 要，请 按 照 设 备 的 说 明 进 行 操 作，以 允 许 WhatsApp 访 问 您 的 位 置 location️
4. 等 待 片 刻 以 提 高 准 确 性 ⏰
5. 单 击 “当 前 位 置” 🎯

*请 确 保 与 您 共 享 的 位 置 安 全，并 保 持 电 话 线 畅 通 。*`,

        hr: `🚒 *Vatrogasna brigada {{COMANDO}}* 🚒

Automatski generirana poruka.

Molimo vas da nam na ovaj broj pošaljete svoju lokaciju, fotografije, videozapise ili druge informacije o incidentu koji ste prijavili.

*OVO NIJE BROJ ZA HITNE SLUČAJEVE*
i NE KORISTITE ga ni u koju drugu svrhu ili prigodu bez našeg dopuštenja.

Za sve hitne zahtjeve nazovite
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Za slanje koordinata:
1. Kliknite na "spajalicu" (Android) 📎 ili "plus" (Apple) ➕
2. Kliknite na "Lokacija" ⛳
3. Ako je potrebno, slijedite upute uređaja kako biste WhatsAppu omogućili pristup vašoj lokaciji 🆗️
4. Pričekajte nekoliko trenutaka kako biste povećali točnost ⏰
5. Kliknite na "Trenutna lokacija" 🎯

*Ostanite sigurni, na lokaciji koju ste podijelili s nama i neka vaša telefonska linija bude slobodna.*`,

        da: `🚒 *Brandvæsen {{COMANDO}}* 🚒

Automatisk genereret besked.

Brug venligst dette nummer til at sende os din placering, fotos, videoer eller andre oplysninger om den hændelse, du har rapporteret.

*DETTE ER IKKE ET NØDNUMMER*
og brug det IKKE til andre formål eller lejligheder uden vores tilladelse.

Ved alle nødsituationer, ring
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

S dan sender du koordinater:
1. Klik på "papirklipsen" (Android) 📎 eller "plusset" (Apple) ➕
2. Klik på "Placering" ⛳
3. Følg om nødvendigt enhedens instruktioner for at give WhatsApp adgang til din placering 🆗️
4. Vent et par øjeblikke for at øge nøjagtigheden ⏰
5. Klik på "Aktuel placering" 🎯

*Vær sikker på den placering, du delte med os, og hold din telefonlinje fri.*`,

        et: `🚒 *Tuletõrje {{COMANDO}}* 🚒

Automaatselt genereeritud sõnum.

Palun kasutage seda numbrit, et saata meile oma asukoht, fotod, videod või muu teave teatatud juhtumi kohta.

*SEE EI OLE HÄDAABINUMBER*
ja ÄRGE kasutage seda muul eesmärgil ega sündmusel ilma meie loata.

Kõikide hädaolukordade korral helistage numbril
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Koordinaatide saatmiseks:
1. Klõpsake kirjaklambril (Android) 📎 või plussmärgil (Apple) ➕
2. Klõpsake valikul „Asukoht" ⛳
3. Vajadusel järgige seadme juhiseid, et lubada WhatsAppil teie asukohale juurde pääseda 🆗️
4. Oodake täpsuse suurendamiseks paar hetke ⏰
5. Klõpsake valikul „Praegune asukoht" 🎯

*Jääge turvaliselt meiega jagatud asukohas ja hoidke oma telefoniliin vaba.*`,

        fi: `🚒 *Palokunta KKKKKKK* 🚒

Automaattisesti luotu viesti.

Käytä tätä numeroa lähettääksesi meille sijaintisi, valokuvia, videoita tai muita tietoja ilmoittamastasi tapahtumasta.

*TÄMÄ EI OLE HÄTÄNUMERO*
ÄLÄKÄ käytä sitä mihinkään muuhun tarkoitukseen tai tilanteeseen ilman lupaamme.

Hätätilanteissa soita numeroon
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Lähetä koordinaatit seuraavasti:
1. Napsauta "paperiliitintä" (Android) 📎 tai "plus"-merkkiä (Apple) ➕
2. Napsauta "Sijainti" ⛳
3. Tarvittaessa seuraa laitteen ohjeita, jotta WhatsApp voi käyttää sijaintiasi 🆗️
4. Odota hetki tarkkuuden lisäämiseksi ⏰
5. Napsauta "Nykyinen sijainti" 🎯

*Pysy turvassa jakamassasi sijainnissa ja pidä puhelinlinjasi vapaana.*`,

        el: `🚒 *Πυροσβεστική Υπηρεσία {{COMANDO}}* 🚒

Αυτόματα δημιουργημένο μήνυμα.

Χρησιμοποιήστε αυτόν τον αριθμό για να μας στείλετε την τοποθεσία σας, φωτογραφίες, βίντεο ή άλλες πληροφορίες σχετικά με το περιστατικό που αναφέρατε.

*ΑΥΤΟΣ ΔΕΝ ΕΙΝΑΙ ΑΡΙΘΜΟΣ ΕΚΤΑΚΤΗΣ ΑΝΑΓΚΗΣ*
και ΜΗΝ τον χρησιμοποιείτε για κανέναν άλλο σκοπό ή περίσταση χωρίς την άδειά μας.

Για όλα τα αιτήματα έκτακτης ανάγκης, καλέστε
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Για να στείλετε συντεταγμένες:
1. Κάντε κλικ στον "συνδετήρα" (Android) 📎 ή στο "συν" (Apple) ➕
2. Κάντε κλικ στην "Τοποθεσία" ⛳
3. Εάν είναι απαραίτητο, ακολουθήστε τις οδηγίες της συσκευής για να επιτρέψετε στο WhatsApp να έχει πρόσβαση στην τοποθεσία σας 🆗️
4. Περιμένετε λίγα λεπτά για να αυξήσετε την ακρίβεια ⏰
5. Κάντε κλικ στην "Τρέχουσα τοποθεσία" 🎯

*Μείνετε ασφαλείς, στην τοποθεσία που μας κοινοποιήσατε, και κρατήστε την τηλεφωνική σας γραμμή ελεύθερη.*`,

        ga: `🚒 *Briogáid Dóiteáin {{COMANDO}}* 🚒

Teachtaireacht a ghintear go huathoibríoch.

Úsáid an uimhir seo le do shuíomh, grianghraif, físeáin, nó faisnéis eile faoin eachtra a thuairiscigh tú a sheoladh chugainn.

*NÍ UIMHIR ÉIGEANDÁLA É SEO*
agus NÁ húsáid í chun aon chríche nó ócáide eile gan ár gcead.

I gcás gach iarratais éigeandála, glaoigh ar
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Chun comhordanáidí a sheoladh:
1. Cliceáil ar an "gearrthóg páipéir" (Android) 📎 nó an "móide" (Apple) ➕
2. Cliceáil ar "Suíomh" ⛳
3. Más gá, lean leideanna an fheiste chun ligean do WhatsApp rochtain a fháil ar do shuíomh 🆗️
4. Fan cúpla nóiméad chun cruinneas a mhéadú ⏰
5. Cliceáil ar "Suíomh Reatha" 🎯

*Fan sábháilte, sa suíomh a roinn tú linn, agus coinnigh do líne teileafóin saor.*`,

        lv: `🚒 *Ugunsdzēsības brigāde {{COMANDO}}* 🚒

Automātiski ģenerēts ziņojums.

Lūdzu, izmantojiet šo numuru, lai nosūtītu mums savu atrašanās vietu, fotoattēlus, videoklipus vai citu informāciju par ziņoto incidentu.

*ŠIS NAV ĀRKĀRTAS NUMURS*
un NEIZMANTOJIET to nekādiem citiem mērķiem vai gadījumiem bez mūsu atļaujas.

Visiem ārkārtas pieprasījumiem zvaniet uz numuru
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Lai nosūtītu koordinātas:
1. Noklikšķiniet uz "saspraudes" (Android) 📎 vai "plus" (Apple) ➕
2. Noklikšķiniet uz "Atrašanās vieta" ⛳
3. Ja nepieciešams, izpildiet ierīces norādījumus, lai atļautu WhatsApp piekļūt jūsu atrašanās vietai 🆗️
4. Uzgaidiet dažas minūtes, lai palielinātu precizitāti ⏰
5. Noklikšķiniet uz "Pašreizējā atrašanās vieta" 🎯

*Esiet drošībā, atrodieties atrašanās vietā, kuru kopīgojāt ar mums, un turiet tālruņa līniju brīvu.*`,

        lt: `🚒 *Ugniagesių brigada {{COMANDO}}* 🚒

Automatiškai sugeneruotas pranešimas.

Prašome naudoti šį numerį, jei norite atsiųsti mums savo buvimo vietą, nuotraukas, vaizdo įrašus ar kitą informaciją apie įvykį, apie kurį pranešėte.

*TAI NĖRA PAGALBOS NUMERIS*
ir NENAUDOKITE jo jokiais kitais tikslais ar progomis be mūsų leidimo.

Dėl visų skubių užklausų skambinkite
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Norėdami išsiųsti koordinates:
1. Spustelėkite „sąvaržėlę“ („Android“) 📎 arba „pliusą“ („Apple“) ➕
2. Spustelėkite „Vieta“ ⛳
3. Jei reikia, vykdykite įrenginio nurodymus, kad leistumėte „WhatsApp“ pasiekti jūsų buvimo vietą 🆗️
4. Palaukite kelias minutes, kad padidintumėte tikslumą ⏰
5. Spustelėkite „Dabartinė vieta“ 🎯

*Būkite saugūs, toje vietoje, kurią su mumis pasidalinote, ir palaikykite telefono liniją laisvą.*`,

        mt: `🚒 *Brigata tat-Tifi tan-Nar {{COMANDO}}C* 🚒

Messaġġ iġġenerat awtomatikament.

Jekk jogħġbok uża dan in-numru biex tibgħatilna l-post tiegħek, ritratti, vidjows, jew informazzjoni oħra dwar l-inċident li rrappurtajt.

*DAN MHUX NUMRU TA' EMERĠENZA*
u TUŻAHX għal xi skop jew okkażjoni oħra mingħajr il-permess tagħna.

Għal kull talba ta' emerġenza, ċempel
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Biex tibgħat koordinati:
1. Ikklikkja fuq il-"paperclip" (Android) 📎 jew il-"plus" (Apple) ➕
2. Ikklikkja fuq "Location" ⛳
3. Jekk meħtieġ, segwi l-istruzzjonijiet tal-apparat biex tippermetti lil WhatsApp jaċċessa l-lokazzjoni tiegħek 🆗️
4. Stenna ftit mumenti biex iżżid il-preċiżjoni ⏰
5. Ikklikkja fuq "Current Location" 🎯

*Ibqa' sigur, fil-lokazzjoni li qsamt magħna, u żomm il-linja tat-telefon tiegħek ħielsa.*`,

        nl: `🚒 *Brandweer {{COMANDO}}* 🚒

Automatisch gegenereerd bericht.

Gebruik dit nummer om ons uw locatie, foto's, video's of andere informatie over het gemelde incident te sturen.

*DIT IS GEEN NOODNUMMER*
en gebruik het NIET voor andere doeleinden of gelegenheden zonder onze toestemming.

Voor alle noodgevallen, bel
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Om coördinaten te verzenden:
1. Klik op het paperclip-icoon (Android) 📎 of het plusteken (Apple) ➕
2. Klik op 'Locatie' ⛳
3. Volg indien nodig de aanwijzingen van uw apparaat om WhatsApp toegang te geven tot uw locatie 🆗️
4. Wacht even voor een nauwkeurigere locatie ⏰
5. Klik op 'Huidige locatie' 🎯

*Blijf veilig op de locatie die u met ons hebt gedeeld en houd uw telefoonlijn vrij.*`,

        pl: `🚒 *Straż Pożarna {{COMANDO}}* 🚒

Wiadomość generowana automatycznie.

Użyj tego numeru, aby przesłać nam swoją lokalizację, zdjęcia, filmy lub inne informacje dotyczące zgłoszonego zdarzenia.

*TO NIE JEST NUMER ALARMOWY*
i NIE UŻYWAJ go w żadnym innym celu ani z żadnej innej okazji bez naszej zgody.

W nagłych wypadkach prosimy dzwonić pod numer
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Aby wysłać współrzędne:
1. Kliknij „spinacz” (Android) 📎 lub „plus” (Apple) ➕
2. Kliknij „Lokalizacja” ⛳
3. W razie potrzeby postępuj zgodnie z instrukcjami urządzenia, aby zezwolić WhatsApp na dostęp do Twojej lokalizacji 🆗️
4. Odczekaj chwilę, aby zwiększyć dokładność ⏰
5. Kliknij „Aktualna lokalizacja” 🎯

*Bądź bezpieczny w podanej nam lokalizacji i nie wyłączaj telefonu.*`,

        pt: `🚒 *Corpo de Bombeiros {{COMANDO}}* 🚒

Mensagem gerada automaticamente.

Por favor, utilize este número para nos enviar sua localização, fotos, vídeos ou outras informações sobre o incidente que você relatou.

*ESTE NÃO É UM NÚMERO DE EMERGÊNCIA*
e NÃO o utilize para qualquer outra finalidade ou ocasião sem nossa permissão.

Para todas as solicitações de emergência, ligue para
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Para enviar as coordenadas:
1. Clique no ícone de clipe de papel (Android) 📎 ou no ícone de mais (Apple) ➕
2. Clique em "Localização" ⛳
3. Se necessário, siga as instruções do dispositivo para permitir que o WhatsApp acesse sua localização 🆗️
4. Aguarde alguns instantes para aumentar a precisão ⏰
5. Clique em "Localização atual" 🎯

*Mantenha-se em segurança, no local que você compartilhou conosco, e mantenha sua linha telefônica livre.*`,

        ro: `🚒 *Brigada de Pompieri {{COMANDO}}C* 🚒

Mesaj generat automat.

Vă rugăm să folosiți acest număr pentru a ne trimite locația dvs., fotografii, videoclipuri sau alte informații despre incidentul pe care l-ați raportat.

*ACESTA NU ESTE UN NUMĂR DE URGENȚĂ*
și NU îl utilizați în niciun alt scop sau ocazie fără permisiunea noastră.

Pentru toate solicitările de urgență, sunați
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Pentru a trimite coordonate:
1. Faceți clic pe „agrafă” (Android) 📎 sau pe „plus” (Apple) ➕
2. Faceți clic pe „Locație” ⛳
3. Dacă este necesar, urmați instrucțiunile dispozitivului pentru a permite WhatsApp să acceseze locația dvs. 🆗️
4. Așteptați câteva momente pentru a crește precizia ⏰
5. Faceți clic pe „Locație curentă” 🎯

*Rămâneți în siguranță, în locația pe care ați partajat-o cu noi și păstrați-vă linia telefonică liberă.*`,

        ru: `🚒 *Номер телефона пожарной охраны* 🚒

Автоматически сгенерированное сообщение.

Пожалуйста, используйте этот номер, чтобы отправить нам ваше местоположение, фотографии, видео или другую информацию об инциденте, о котором вы сообщили.

*ЭТО НЕ НОМЕР ДЛЯ ЭКСТРЕННЫХ СИТУАЦИЙ*
и НЕ ИСПОЛЬЗУЙТЕ ЕГО ДЛЯ КАКИХ-ЛИБО ДРУГИХ ЦЕЛЕЙ БЕЗ НАШЕГО РАЗРЕШЕНИЯ.


Для всех экстренных случаев звоните:
☎️🆘️
*Н-Н-Н*
🇪🇺🇮🇹

Чтобы отправить координаты:
1. Нажмите на значок «скрепка» (Android) 📎 или «плюс» (Apple) ➕
2. Нажмите на «Местоположение» ⛳
3. При необходимости следуйте инструкциям устройства, чтобы разрешить WhatsApp доступ к вашему местоположению 🆗️
4. Подождите несколько минут для повышения точности ⏰
5. Нажмите на «Текущее местоположение» 🎯

*Оставайтесь в безопасности, в указанном вами местоположении, и держите телефонную линию свободной.*`,

        sk: `🚒 *Hasičský zbor {{COMANDO}}* 🚒

Automaticky vygenerovaná správa.

Použite toto číslo na zaslanie vašej polohy, fotografií, videí alebo iných informácií o incidente, ktorý ste nahlásili.

*TOTO NIE JE NÚDZOVÉ ČÍSLO*
a NEPOUŽÍVAJTE ho na žiadny iný účel ani príležitosť bez nášho súhlasu.

V prípade všetkých núdzových požiadaviek volajte na číslo
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Ak chcete odoslať súradnice:
1. Kliknite na „sponku“ (Android) 📎 alebo „plus“ (Apple) ➕
2. Kliknite na „Poloha“ ⛳
3. V prípade potreby postupujte podľa pokynov na zariadení, aby ste povolili aplikácii WhatsApp prístup k vašej polohe 🆗️
4. Počkajte chvíľu, aby ste zvýšili presnosť ⏰
5. Kliknite na „Aktuálna poloha“ 🎯

*Zostaňte v bezpečí, na mieste, ktoré ste s nami zdieľali, a majte voľnú telefónnu linku.*`,

        sl: `🚒 *Gasilska brigada {{COMANDO}}* 🚒

Samodejno ustvarjeno sporočilo.

Prosimo, uporabite to številko, da nam pošljete svojo lokacijo, fotografije, videoposnetke ali druge informacije o incidentu, ki ste ga prijavili.

*TO NI ŠTEVILKA ZA NUJNE PRIMERE*
in je NE uporabljajte za noben drug namen ali priložnost brez našega dovoljenja.

Za vse nujne primere pokličite
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Za pošiljanje koordinat:
1. Kliknite na "sponko za papir" (Android) 📎 ali "plus" (Apple) ➕
2. Kliknite na "Lokacija" ⛳
3. Po potrebi sledite navodilom naprave, da WhatsAppu omogočite dostop do vaše lokacije 🆗️
4. Počakajte nekaj trenutkov, da povečate natančnost ⏰
5. Kliknite na "Trenutna lokacija" 🎯

*Ostanite varni na lokaciji, ki ste jo delili z nami, in imejte telefonsko linijo prosto.*`,

        sv: `🚒 *Brandkåren {{COMANDO}}* 🚒

Automatiskt genererat meddelande.

Använd detta nummer för att skicka oss din plats, foton, videor eller annan information om den händelse du rapporterade.

*DETTA ÄR INTE ETT NÖDNUMMER*
och ANVÄND det INTE för något annat ändamål eller tillfälle utan vårt tillstånd.

För alla nödförfrågningar, ring
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

För att skicka koordinater:
1. Klicka på "gem" (Android) 📎 eller "plus" (Apple) ➕
2. Klicka på "Plats" ⛳
3. Om det behövs, följ enhetens anvisningar för att tillåta WhatsApp att komma åt din plats 🆗️
4. Vänta några ögonblick för att öka noggrannheten ⏰
5. Klicka på "Nuvarande plats" 🎯

*Var säker på den plats du delade med oss ​​och håll din telefonlinje ledig.*`,

        de: `🚒 *Feuerwehr {{COMANDO}}* 🚒

Automatisch generierte Nachricht.

Bitte nutzen Sie diese Nummer, um uns Ihren Standort, Fotos, Videos oder andere Informationen zu dem von Ihnen gemeldeten Vorfall zu senden.

*DIES IST KEINE NOTRUFNUMMER*
und verwenden Sie sie NICHT ohne unsere Genehmigung für andere Zwecke oder Anlässe.

Für alle Notfälle rufen Sie bitte an:

☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

So senden Sie Ihre Koordinaten:
1. Tippen Sie auf die Büroklammer (Android) 📎 oder das Pluszeichen (Apple) ➕.
2. Tippen Sie auf „Standort" ⛳.
3. Folgen Sie gegebenenfalls den Anweisungen Ihres Geräts, um WhatsApp den Zugriff auf Ihren Standort zu erlauben 🆗️.
4. Warten Sie einen Moment, um die Genauigkeit zu erhöhen ⏰.
5. Tippen Sie auf „Aktueller Standort" 🎯.

*Bleiben Sie an dem Ort, den Sie uns mitgeteilt haben, und halten Sie Ihre Telefonleitung frei.*`,

        hu: `🚒 *Tűzoltóság {{COMANDO}}* 🚒

Automatikusan generált üzenet.

Kérjük, ezt a számot használja, ha tartózkodási helyét, fotóit, videóit vagy egyéb információkat szeretne küldeni nekünk a jelentett incidensről.

*EZ NEM SÜRGŐSSÉGI SZÁM*
és NE használja semmilyen más célra vagy alkalomra az engedélyünk nélkül.

Minden vészhelyzeti kérés esetén hívja a következő számot:
☎️🆘️
*{{NUM}}*
🇪🇺🇮🇹

Koordináták küldéséhez:
1. Kattintson a "gemkapocs" (Android) 📎 vagy a "plusz" (Apple) ikonra ➕
2. Kattintson a "Helyszín" ⛳ elemre
3. Szükség esetén kövesse az eszköz utasításait, hogy engedélyezze a WhatsAppnak a tartózkodási helyének elérését 🆗️
4. Várjon néhány percet a pontosság növelése érdekében ⏰
5. Kattintson a "Jelenlegi tartózkodási hely" 🎯 elemre

*Maradjon biztonságban, a velünk megosztott helyen, és tartsa szabadon a telefonvonalát.*`
    };

    // Costruisce il corpo del messaggio sostituendo Comando e numero emergenza,
    // ricadendo sull'italiano se la lingua scelta non ha ancora una traduzione
    function costruisciCorpoMessaggio(codiceLingua, nomeComando, numeroEmergenzaFormattato) {
        const modello = TRADUZIONI_MESSAGGIO[codiceLingua] || TRADUZIONI_MESSAGGIO.it;
        return modello
            .split("{{COMANDO}}").join(nomeComando.toUpperCase())
            .split("{{NUM}}").join(numeroEmergenzaFormattato);
    }

    // Calcola lo scarto orario attuale di Roma rispetto a UTC (1 = CET, 2 = CEST)
    function calcolaOffsetRoma(data) { return FireOps.offsetOreRoma(data); }

    // Costruisce il piè di pagina (sempre in italiano): credito, data/ora/turno, fuso orario
    function costruisciPieDiPaginaMessaggio() {
        const adesso = new Date();
        const componenti = getComponentiRoma(adesso);
        const pad = n => String(n).padStart(2, "0");

        const nomeGiorno = new Intl.DateTimeFormat("it-IT", { weekday: "long", timeZone: "Europe/Rome" }).format(adesso);
        const nomeGiornoMaiuscolo = nomeGiorno.charAt(0).toUpperCase() + nomeGiorno.slice(1);

        const dataFormattata = `${pad(componenti.day)}.${pad(componenti.month)}.${componenti.year}`;
        const oraFormattata = `${pad(componenti.hour)}:${pad(componenti.minute)}:${pad(componenti.second)}`;
        const turno = calcolaTurnoVVF();

        const offsetOre = calcolaOffsetRoma(adesso);
        const etichettaFuso = offsetOre === 2 ? "CEST" : "CET";

        return `credit by VVFsendWhatsApp\n${nomeGiornoMaiuscolo} ${dataFormattata} ore ${oraFormattata} - Turno ${turno}\n(GMT+0${offsetOre}.00) Roma (${etichettaFuso})`;
    }

    // Rigenera il messaggio completo nella textarea, in base al Comando attivo e alla lingua scelta.
    // Se la lingua non è ancora stata scelta, l'anteprima resta vuota (non compare).
    function generaMessaggioMessaggistica() {
        if (!textareaMsg || !hiddenLinguaMsg) return;

        const stato = validaCampiMessaggistica();

        if (!stato.linguaOk) {
            textareaMsg.value = "";
            textareaMsg.placeholder = "Seleziona una lingua per generare l'anteprima del messaggio.";
            return;
        }

        const nomeComandoAttivo = sessionStorage.getItem(CHIAVE_STORAGE);
        const comandoAttivo = comandiData.find(c => c.Comando === nomeComandoAttivo);

        if (!comandoAttivo) {
            textareaMsg.value = "Seleziona prima un Comando dalla schermata iniziale per generare il messaggio.";
            return;
        }

        const codiceLingua = hiddenLinguaMsg.value || LINGUA_PREDEFINITA;
        const valoreEmergenza = comandoAttivo["115/NUE OUT"] || "112";
        const numeroEmergenzaFormattato = String(valoreEmergenza).split("").join(" ");

        const corpo = costruisciCorpoMessaggio(codiceLingua, comandoAttivo.Comando, numeroEmergenzaFormattato);
        const pieDiPagina = costruisciPieDiPaginaMessaggio();

        textareaMsg.value = `${corpo}\n${pieDiPagina}`;
    }
    window.generaMessaggioMessaggistica = generaMessaggioMessaggistica;

    // Compone il numero completo (prefisso + numero) ripulito da spazi/simboli
    function numeroCompletoPulito() {
        const prefisso = (hiddenPrefissoMsg && hiddenPrefissoMsg.value || "").replace(/\D/g, "");
        const numero = (inputNumeroMsg && inputNumeroMsg.value || "").replace(/\D/g, "");
        return { prefisso, numero };
    }

    if (btnWhatsappWeb) {
        btnWhatsappWeb.addEventListener("click", () => {
            if (!validaCampiMessaggistica().tuttiCompilati) return;
            generaMessaggioMessaggistica(); // aggiorna l'orario (con i secondi) al momento dell'invio
            const { prefisso, numero } = numeroCompletoPulito();
            if (!numero) {
                alert("Inserisci un numero di telefono valido.");
                return;
            }
            const testoCodificato = encodeURIComponent(textareaMsg.value);
            // WhatsApp vuole il prefisso senza "+" (es. 39...)
            const url = `https://web.whatsapp.com/send?phone=${prefisso}${numero}&text=${testoCodificato}`;
            window.open(url, "_blank", "noopener");
        });
    }

    if (btnWhatsappApp) {
        btnWhatsappApp.addEventListener("click", () => {
            if (!validaCampiMessaggistica().tuttiCompilati) return;
            generaMessaggioMessaggistica(); // aggiorna l'orario (con i secondi) al momento dell'invio
            const { prefisso, numero } = numeroCompletoPulito();
            if (!numero) {
                alert("Inserisci un numero di telefono valido.");
                return;
            }
            const testoCodificato = encodeURIComponent(textareaMsg.value);
            // WhatsApp Desktop (app installata) tramite protocollo whatsapp://
            window.location.href = `whatsapp://send?phone=${prefisso}${numero}&text=${testoCodificato}`;
        });
    }

    if (btnInviaTelegram) {
        btnInviaTelegram.addEventListener("click", () => {
            if (!validaCampiMessaggistica().tuttiCompilati) return;
            generaMessaggioMessaggistica(); // aggiorna l'orario (con i secondi) al momento dell'invio
            const testo = textareaMsg.value;
            if (!testo.trim()) {
                alert("Il messaggio è vuoto.");
                return;
            }

            // Copia sempre il testo negli appunti: Telegram non supporta
            // testo precompilato quando si apre una chat da numero di telefono
            navigator.clipboard.writeText(testo).catch(() => {});

            const { prefisso, numero } = numeroCompletoPulito();
            if (numero) {
                // Telegram richiede il "+" davanti al numero completo
                window.open(`https://t.me/+${prefisso}${numero}`, "_blank", "noopener");
            } else {
                // Nessun numero indicato: apre la condivisione generica con testo precompilato
                window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(testo)}`, "_blank", "noopener");
            }
        });
    }

    // Orologio in tempo reale e Turno VVF
    function updateClockAndShift() {
        const now = new Date();
        const c = getComponentiRoma(now);

        const pad = n => String(n).padStart(2, '0');

        const nomeGiorno = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "Europe/Rome" }).format(now);
        const nomeGiornoMaiuscolo = nomeGiorno.charAt(0).toUpperCase() + nomeGiorno.slice(1).replace(".", "");

        const offsetOre = calcolaOffsetRoma(now);
        const etichettaFuso = offsetOre === 2 ? "CEST" : "CET";

        const dataFormattata = `${nomeGiornoMaiuscolo} ${pad(c.day)}.${pad(c.month)}.${c.year} - ${pad(c.hour)}:${pad(c.minute)}:${pad(c.second)} ${etichettaFuso}`;

        document.getElementById("display-datetime").textContent = dataFormattata;
        document.getElementById("display-turno").textContent = `Turno ${calcolaTurnoVVF()}`;
    }

    // Sequenza dei turni: 32 giorni × 3 fasce giornaliere (8h + 12h + 4h)
    // Tabella turni, riferimento del ciclo e calcolo data/ora Roma vivono in
    // fireops-core.js: qui restano solo deleghe, così esiste una sola verità.
    function getComponentiRoma(date) { return FireOps.componentiRoma(date); }



    function calcolaTurnoVVF() { return FireOps.turnoVVF(); }

    setInterval(updateClockAndShift, 1000);
    updateClockAndShift();
        // La carta cambia da sola al tramonto; il minuto basta e avanza
    setInterval(() => { aggiornaEffemeridi(); applicaTemaMappa(); }, 60000);

    // ==========================================================
    // FOCUS INIZIALE SU "COMANDO" + CONFERMA CON INVIO (Enter)
    // ==========================================================
    // Alla prima apertura, e ogni volta che il modale viene riaperto per
    // cambiare comando, il focus va subito sul select in modo da poter
    // digitare le prime lettere del nome del Comando per trovarlo rapidamente.
    // Premendo Invio, se un Comando è selezionato, si conferma ed entra.
    function focusSelectComando() {
        setTimeout(() => selectComando.focus(), 50);
    }

    selectComando.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (!btnConferma.disabled) btnConferma.click();
        }
    });

    // Focus quando il modale compare/riappare (osserva i cambi di display inline)
    const osservatoreModale = new MutationObserver(() => {
        if (modal.style.display === "flex") focusSelectComando();
    });
    osservatoreModale.observe(modal, { attributes: true, attributeFilter: ["style"] });

    // Se il modale è già visibile al caricamento (nessun comando salvato in sessione), porta subito il focus
    if (modal.style.display !== "none") {
        focusSelectComando();
    }

    // ==========================================================
    // POPUP CANALI RADIO: cliccando l'intestazione del Comando attivo si
    // apre l'elenco dei Comandi limitrofi coi rispettivi canali VHF.
    //
    // È ancorato all'header, quindi raggiungibile da qualsiasi pagina: gli
    // stessi dati stanno anche nella Home, ma in Sala il canale del limitrofo
    // serve mentre si sta guardando tutt'altro.
    //
    // Nessun elemento cliccabile dentro: è una tabella da leggere, non un
    // punto di partenza per navigare. Il canale è il dato per cui si apre,
    // quindi è grande e monospaziato.
    // ==========================================================
    const ID_POPUP_CANALI = "popup-canali-attivo";

    function chiudiPopupCanali() {
        const esistente = document.getElementById(ID_POPUP_CANALI);
        if (esistente) esistente.remove();
    }

    function rigaCanali(c, attivo) {
        return `
            <tr${attivo ? ' class="popup-canali-attivo"' : ""}>
                <td class="nome">${c.Comando || "-"}</td>
                <td class="canale">${c["Canale Radio Comando"] || "-"}</td>
                <td class="nome">${c["Direzione VVF"] || "-"}</td>
                <td class="canale">${c["Canale Radio Direzione"] || "-"}</td>
            </tr>`;
    }

    function apriPopupCanali(event) {
        event.stopPropagation(); // il click che apre non deve anche richiudere
        if (document.getElementById(ID_POPUP_CANALI)) { chiudiPopupCanali(); return; }

        const nomeAttivo = sessionStorage.getItem(CHIAVE_STORAGE);
        const comandoAttivo = trovaComandoPerNome(nomeAttivo, comandiData);
        if (!comandoAttivo) return;

        const limitrofi = (comandoAttivo["Concatena Comandi Confinanti"] || "")
            .split(";").map(n => n.trim()).filter(Boolean)
            .map(nome => trovaComandoPerNome(nome, comandiData))
            .filter(Boolean);

        // Il Comando attivo apre l'elenco: è il riferimento rispetto al quale
        // si leggono tutti gli altri
        const righe = rigaCanali(comandoAttivo, true) +
            (limitrofi.length
                ? limitrofi.map(c => rigaCanali(c, false)).join("")
                : '<tr><td colspan="4" class="vuoto">Nessun comando limitrofo indicato</td></tr>');
                
        const popup = document.createElement("div");
        popup.id = ID_POPUP_CANALI;
        popup.className = "popup-canali";
        popup.innerHTML = `
            <span class="popup-close" id="popup-canali-close" title="Chiudi">&times;</span>
            <h5>Canali radio — Comando ${comandoAttivo.Comando} e limitrofi</h5>
            <table>
                <thead>
                    <tr><th>Comando</th><th>CH VHF</th><th>Direzione</th><th>CH VHF</th></tr>
                </thead>
                <tbody>${righe}</tbody>
            </table>`;

        document.body.appendChild(popup);
        FireOps.ancoraPopup(popup, event.currentTarget);

        const chiusura = document.getElementById("popup-canali-close");
        if (chiusura) chiusura.addEventListener("click", chiudiPopupCanali);
        popup.addEventListener("click", (e) => e.stopPropagation());
    }

    if (displayComando) {
        displayComando.classList.add("cliccabile-canali");
        displayComando.title = "Canali radio dei Comandi limitrofi";
        displayComando.addEventListener("click", apriPopupCanali);
    }

    document.addEventListener("click", chiudiPopupCanali);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") chiudiPopupCanali();
    });

    // Cambiando Comando l'elenco non è più quello giusto
    document.addEventListener("fireops:comando-attivo-cambiato", chiudiPopupCanali);

    // ==========================================================
    // CONTATORE ACCESSI
    // Il valore compare dentro il modale "Aiuto e contatti": non è un dato
    // operativo e non merita spazio fisso a schermo. Il conteggio si
    // incrementa a ogni caricamento della pagina, non all'apertura del modale.
    // ==========================================================
    (function contatoreAccessi() {
        const display = document.getElementById("display-contatore-accessi");
        if (!display) return;

        fetch("https://abacus.jasoncameron.dev/hit/fireops-vvf-pel/accessi")
            .then(r => r.json())
            .then(dati => {
                const valore = Number(dati.value);
                if (!Number.isFinite(valore)) throw new Error("Valore non numerico");
                display.textContent = String(valore);
            })
            .catch(() => {
                display.textContent = "N/D";
            });
    })();    
    /* La versione è quella con cui il browser ha scaricato i moduli: se
       qualcuno segnala un problema, dice subito su quale build.
       Sta in due posti perché servono a due letture diverse: in testata è
       sempre sott'occhio, nel modale "?" sta accanto ai contatti — che è
       dove si guarda quando si sta per scrivere una segnalazione. */
    (function mostraVersione(){
        const v = window.FIREOPS_VERSIONE;
        const leggibile = v
            ? String(v).replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)$/, "$3$2$1$4$5")
            : "n/d";
        const testata = document.getElementById("display-versione");
        if (testata){
            testata.textContent = "v. " + leggibile;
            if (v) testata.title = v;
        }
        const modale = document.getElementById("display-versione-modale");
        if (modale){
            modale.textContent = leggibile;
            if (v) modale.title = v;
        }
    })();
});

// Pulisce e formatta il numero di telefono per la copia:
// rimuove gli spazi e assicura che inizi con uno '0' (se non presente)
function formattaTelefonoPerCopia(telefono) {
    if (!telefono || telefono === '-') return '';

    // Rimuove tutti gli spazi
    let pulito = telefono.replace(/\s+/g, '');

    // Se non inizia già con '0' e non è un prefisso internazionale (+), aggiunge lo '0'
    if (!pulito.startsWith('0') && !pulito.startsWith('+')) {
        pulito = '0' + pulito;
    }

    return pulito;
}
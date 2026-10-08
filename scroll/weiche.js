/* ==========================================================================
   PERFORMANCE-WEICHE  (7. Oktober 2026)

   Entscheidet, ob eine Seite die bewegte Fassung zeigt (Video unter dem
   Finger, "voll") oder die leichte (Standbilder, die ueberblenden, "lite").

   WARUM NICHT NACH GERAET GEFRAGT WIRD
   Die naheliegende Loesung waere eine Liste: dieses Telefon ja, jenes nein.
   Sie funktioniert hier nicht. Das Ruckeln am 3. Oktober 2026 wurde auf einem
   iPhone 17 Pro Max gemessen, dem schnellsten Telefon am Markt -- eine
   Geraeteklassifizierung haette genau dieses Geraet als "schnell" eingestuft
   und ihm die Fassung gegeben, die darauf ruckelt. Dazu kommt, dass iOS das
   Modell im User-Agent nicht verraet (jedes iPhone meldet "iPhone") und dass
   die Dinge, die wirklich entscheiden, von aussen unsichtbar sind:
   Energiesparmodus, Drosselung bei Waerme, wie viele Hardware-Dekoder Safari
   gerade frei hat, was sonst noch offen ist. navigator.deviceMemory und
   navigator.connection gibt es nur in Chrome, auf dem iPhone also nicht.

   Deshalb wird gemessen, nicht geraten. Gemessen wird das, was der Nutzer
   fuehlt: die Bildrate waehrend er scrollt, verglichen mit der, die das Geraet
   in Ruhe schafft. Die Luecke zwischen beiden IST das Ruckeln. Das ist
   dasselbe Verfahren, mit dem diag.js am 3.10. die Ursachen gefunden hat, nur
   ohne Anzeige und mit einem Urteil am Ende.

   DREI STUFEN, KEIN SICHTBARER SPRUNG
   Ein harter Wechsel mitten im Scrollen waere ein Bildsprung: das Standbild
   ist das erste Bild des Clips, der Clip laeuft aber gerade in seiner Mitte.
   Also wird nach vorn abgebaut, nie zurueck:

     1. sofort   Das Scrubben haelt an. Das sichtbare Bild bleibt stehen, wo es
                 ist -- kein Sprung, aber die Dekoderlast pro Bild ist weg.
     2. ab hier  Kein weiterer Clip wird geholt. Die folgenden Etappen zeigen
                 ihr Standbild, das sie ohnehin zeigen, bis ein echtes
                 Videobild gemalt ist. Geladene, unsichtbare Clips werden
                 freigegeben (Dekoder).
     3. naechste Seite  Das Urteil liegt im localStorage. Die Erbschaftsseite
                 startet dann gleich leicht: rund 0,45 MB Standbilder statt
                 5,5 MB Video.

   ZWANG UND PRUEFUNG
     ?v=voll   erzwingt die bewegte Fassung   (auch gemerkt)
     ?v=lite   erzwingt die leichte Fassung   (auch gemerkt)
     ?v=frei   loescht das gemerkte Urteil und misst neu
   Das Urteil steht als data-sc-variante und data-sc-weiche am <html>-Element
   und ist ueber Weiche.bericht() abrufbar; diag.js zeigt es an. So sagt ein
   Screenshot vom Geraet, was dort entschieden wurde und warum.
   ========================================================================== */
(function (global) {
  'use strict';

  var html = document.documentElement;
  var LAGER = 'nagel-weiche-1';
  var FRIST = 14 * 24 * 3600 * 1000;   // gemerktes Urteil verfaellt nach 14 Tagen

  /* ---- Messparameter ------------------------------------------------------
     ANLAUF    Die ersten Bilder nach dem Laden sind zu Recht langsam (Layout,
               Schrift, der erste Clip wird geholt). Sie zaehlen nicht.
     MINBILDER Ein Urteil braucht eine Strecke, nicht einen Ruckler. 90 Bilder
               sind bei 60 Hz rund 1,5 s echtes Scrollen.
     UEBER     Anteil der Bilder, die laenger als das doppelte Budget
               gebraucht haben. Das doppelte Budget heisst: ein Bild
               ausgelassen. Ein Fuenftel ausgelassene Bilder ist der Punkt, an
               dem Scrollen nicht mehr glatt aussieht.
     BODEN     Unter 30 Bildern/s ist es unabhaengig vom Geraetebudget zaeh.
     ------------------------------------------------------------------------ */
  var ANLAUF = 1200;
  var MINBILDER = 90;
  var MINBILDER_SPAET = 40;
  var FRIST_MAX = 20000;
  var UEBER = 0.20;
  var BODEN = 30;
  var STUMM = 6000;        // ms: Clip geladen, aber kein Bild gemalt -> leicht

  var z = {
    variante: 'voll',
    grund: 'noch nicht entschieden',
    ruheFps: 0,
    fpsScroll: 0,
    anteilUeber: 0,
    schlimmstes: 0,
    bilder: 0,
    entschieden: false
  };

  function schreibeMarke() {
    html.setAttribute('data-sc-variante', z.variante);
    html.setAttribute('data-sc-weiche', z.grund);
  }

  function merken(variante, grund) {
    try {
      localStorage.setItem(LAGER, JSON.stringify({
        v: variante, g: grund, t: Date.now()
      }));
    } catch (e) {}
  }

  function gemerkt() {
    try {
      var r = JSON.parse(localStorage.getItem(LAGER) || 'null');
      if (!r || !r.v) return null;
      if (Date.now() - (r.t || 0) > FRIST) return null;
      return r;
    } catch (e) { return null; }
  }

  function motor() {
    var i = global.ScrollCraft && global.ScrollCraft.instances;
    return i && i.length ? i[0] : null;
  }

  /* Eigene Standbilder fuer die leichte Fassung.

     Das Standbild im Markup ist Bild 0 des Clips: in der vollen Fassung muss
     es das sein, sonst springt die Uebergabe, wenn das Video zu malen
     beginnt. Als alleiniges Bild einer Etappe ist Bild 0 aber oft das
     schwaechste -- die Kamera steht dort noch vor dem Motiv. Die leichte
     Fassung hat kein Video daneben, also darf sie ein besseres Bild nehmen:
     aus der Mitte des Clips, und mit einem eigenen Hochkantausschnitt. Der
     ist noetig, weil die Standbilder quer sind (1600x888) und object-fit sie
     auf dem Telefon mittig beschneidet -- bei der Treppen-Etappe fiel genau
     dadurch die Treppe aus dem Bild.

     Gewaehlt wird hier und nicht per <picture>/srcset, weil die Grenze
     dieselbe sein muss, an der die Engine den Handyclip waehlt. */
  function standbilder(nurUnsichtbare) {
    var mobil = matchMedia('(hover: none) and (pointer: coarse)').matches ||
                matchMedia('(max-width: 860px)').matches;
    var liste = document.querySelectorAll('[data-sc-lite]');
    for (var i = 0; i < liste.length; i++) {
      var el = liste[i];
      // Faellt das Urteil mitten im Scrollen, darf ein Standbild, das gerade
      // zu sehen ist, nicht ausgetauscht werden: der Wechsel von Bild 0 auf
      // die Clipmitte waere genau der Sprung, den die Weiche sonst vermeidet.
      // Es behaelt Bild 0 und scrollt damit raus, die folgenden bekommen das
      // bessere. Dasselbe Prinzip wie beim Clip: nach vorn abbauen.
      if (nurUnsichtbare) {
        var h = el.parentElement;
        if (parseFloat(getComputedStyle(el).opacity) > 0.01 &&
            (!h || getComputedStyle(h).visibility !== 'hidden')) continue;
      }
      var neu = (mobil && el.getAttribute('data-sc-lite-mobile')) ||
                el.getAttribute('data-sc-lite');
      if (neu && el.getAttribute('src') !== neu) el.setAttribute('src', neu);
    }
    return liste.length;
  }

  // Auf leicht umschalten. Vor mount() reicht die globale Marke, danach muss
  // die Instanz es erfahren -- sie haelt die Clips.
  function aufLeicht(grund, laufend) {
    z.variante = 'lite';
    z.grund = grund;
    global.SCROLLCRAFT_LITE = true;
    schreibeMarke();
    standbilder(laufend);
    var m = motor();
    if (m && m.lite) m.lite(true);
  }

  function aufVoll(grund) {
    z.variante = 'voll';
    z.grund = grund;
    global.SCROLLCRAFT_LITE = false;
    schreibeMarke();
  }

  /* ---- 1. Zwang per Adresse ---------------------------------------------- */
  var zwang = (/[?&]v=(voll|lite|frei)\b/.exec(location.search) ||
               /#(voll|lite|frei)\b/.exec(location.hash) || [])[1];
  if (zwang === 'frei') {
    try { localStorage.removeItem(LAGER); } catch (e) {}
    zwang = null;
  }

  /* ---- 2. Harte Regeln, die ohne Messung gelten -------------------------- */
  function vorab() {
    var n = navigator;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'Bewegung reduziert (Systemeinstellung)';
    }
    var c = n.connection || n.mozConnection || n.webkitConnection;
    if (c) {
      if (c.saveData === true) return 'Datensparmodus';
      if (/(^|-)2g$|^3g$/.test(c.effectiveType || '')) {
        return 'Verbindung ' + c.effectiveType;
      }
    }
    // Beide Angaben gibt es nur in Chrome-Browsern. Auf dem iPhone sind sie
    // undefined, dann greift die Regel nicht und es wird gemessen.
    if (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency > 0 &&
        n.hardwareConcurrency <= 2) {
      return 'nur ' + n.hardwareConcurrency + ' Kerne';
    }
    if (typeof n.deviceMemory === 'number' && n.deviceMemory > 0 &&
        n.deviceMemory <= 2) {
      return 'nur ' + n.deviceMemory + ' GB Speicher';
    }
    return null;
  }

  /* ---- Entscheidung treffen --------------------------------------------- */
  var messen = false;

  if (zwang === 'lite') {
    aufLeicht('erzwungen (?v=lite)');
    merken('lite', 'erzwungen');
    z.entschieden = true;
  } else if (zwang === 'voll') {
    aufVoll('erzwungen (?v=voll)');
    merken('voll', 'erzwungen');
    z.entschieden = true;
  } else {
    var g = gemerkt();
    var v = vorab();
    if (g) {
      if (g.v === 'lite') aufLeicht('gemerkt: ' + g.g);
      else aufVoll('gemerkt: ' + g.g);
      z.entschieden = true;
    } else if (v) {
      aufLeicht(v);
      merken('lite', v);
      z.entschieden = true;
    } else {
      aufVoll('wird gemessen');
      messen = true;
    }
  }

  // Falls die Entscheidung vor mount() fiel, holt der Motor sie sich selbst
  // ueber die globale Marke. Faellt sie trotzdem erst nach mount() (Reihenfolge
  // der Skripte), wird sie hier nachgereicht.
  if (z.variante === 'lite' && z.entschieden) {
    addEventListener('load', function () { aufLeicht(z.grund); }, { once: true });
  }

  /* ---- 3. Messen ---------------------------------------------------------
     Die Schleife rechnet nur mit Zahlen, schreibt nichts ins DOM und hoert
     mit dem Urteil auf. Sie messen zu lassen, waehrend sie selbst Last
     erzeugt, waere derselbe Fehler, den die Engine hatte.
     ---------------------------------------------------------------------- */
  if (messen) {
    var scrollBis = 0;
    addEventListener('scroll', function () {
      scrollBis = performance.now() + 350;   // Schwung nach dem Loslassen zaehlt mit
    }, { passive: true });

    var start = performance.now();
    var letztes = start;
    var ruheFenster = start, ruheBilder = 0;
    var bilder = 0, ueberBudget = 0, zeitScroll = 0, schlimmstes = 0;
    var budget = 0;

    function urteil(variante, grund) {
      z.bilder = bilder;
      z.schlimmstes = Math.round(schlimmstes);
      z.anteilUeber = bilder ? ueberBudget / bilder : 0;
      z.fpsScroll = zeitScroll ? Math.round(1000 * bilder / zeitScroll) : 0;
      z.entschieden = true;
      if (variante === 'lite') aufLeicht(grund, true); else aufVoll(grund);
      merken(variante, grund);
    }

    function schleife(t) {
      var d = t - letztes;
      letztes = t;
      if (z.entschieden) return;              // Schleife endet mit dem Urteil

      var seitStart = t - start;
      var bewegt = t < scrollBis;

      // Ruhebudget: hoechste Bildrate ueber ein halbsekuendiges Fenster. Aus
      // dem kuerzesten je gesehenen Bild zu schaetzen ergibt Unsinn -- ein
      // einzelner Ausreisser von 2 ms hiess in der Vorfassung von diag.js
      // "500 Hz".
      if (!bewegt) {
        ruheBilder++;
        if (t - ruheFenster >= 500) {
          var fps = ruheBilder / ((t - ruheFenster) / 1000);
          if (fps > z.ruheFps) {
            z.ruheFps = Math.round(fps);
            budget = 1000 / z.ruheFps;
          }
          ruheFenster = t; ruheBilder = 0;
        }
      } else {
        ruheFenster = t; ruheBilder = 0;
      }

      if (bewegt && seitStart > ANLAUF) {
        bilder++;
        zeitScroll += d;
        if (d > schlimmstes) schlimmstes = d;
        if (budget && d > budget * 2) ueberBudget++;
      }

      // Energiesparmodus und aehnliche Faelle: der Clip ist geladen, iOS malt
      // aber kein Bild. Dann zeigt die Seite ohnehin Standbilder und laedt
      // nur sinnlos die restlichen Megabyte nach.
      if (seitStart > STUMM) {
        var m = motor();
        if (m && m.clips && m.clips.length) {
          var geladen = 0, gemalt = 0;
          for (var i = 0; i < m.clips.length; i++) {
            if (m.clips[i].ready) geladen++;
            if (m.clips[i].painted) gemalt++;
          }
          if (geladen && !gemalt) {
            urteil('lite', 'Clip geladen, kein Bild gemalt');
            return;
          }
        }
      }

      var genug = bilder >= MINBILDER ||
                  (seitStart > FRIST_MAX && bilder >= MINBILDER_SPAET);
      if (genug) {
        var fpsS = zeitScroll ? 1000 * bilder / zeitScroll : 0;
        var anteil = ueberBudget / bilder;
        if (budget && anteil > UEBER) {
          urteil('lite', 'ruckelt: ' + Math.round(anteil * 100) + '% der Bilder ' +
                 'ueber Budget bei ' + z.ruheFps + ' Hz');
        } else if (fpsS && fpsS < BODEN) {
          urteil('lite', 'ruckelt: ' + Math.round(fpsS) + ' Bilder/s beim Scrollen');
        } else {
          urteil('voll', 'gemessen glatt: ' + Math.round(fpsS) + '/' +
                 (z.ruheFps || '?') + ' Bilder/s');
        }
        return;
      }

      // Nie ewig messen. Wer nach 40 s nicht genug gescrollt hat, bekommt die
      // Fassung, mit der er bisher gefahren ist, und nichts wird gemerkt.
      if (seitStart > FRIST_MAX * 2) {
        z.grund = 'zu wenig gescrollt, nicht entschieden';
        z.entschieden = true;
        schreibeMarke();
        return;
      }

      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  schreibeMarke();

  global.Weiche = {
    bericht: function () { return z; },
    zeile: function () {
      return 'Weiche ' + z.variante.toUpperCase() + ' (' + z.grund + ')' +
             (z.bilder ? '  gemessen ' + z.fpsScroll + '/' + z.ruheFps +
              ' Bilder/s, ' + Math.round(z.anteilUeber * 100) + '% ueber Budget, ' +
              'langsamstes ' + z.schlimmstes + ' ms' : '');
    },
    zwinge: function (variante) {
      if (variante === 'lite') { aufLeicht('erzwungen', true); merken('lite', 'erzwungen'); }
      else { aufVoll('erzwungen'); merken('voll', 'erzwungen'); }
      z.entschieden = true;
    },
    frei: function () { try { localStorage.removeItem(LAGER); } catch (e) {} }
  };
})(window);

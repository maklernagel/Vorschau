/* Wird nur geladen, wenn "#diag" in der Adresse steht.

   Zu lesen sind die zwei Zeilen "in Ruhe" und "beim Wischen". In Ruhe zeigt
   das Geraet, was es kann (ein iPhone Pro faehrt dort 120/s), beim Wischen,
   was die Seite davon uebrig laesst. Die Luecke zwischen beiden IST das
   Ruckeln, und sie braucht keine geratene Zielrate: die Vorfassung schaetzte
   sie aus dem kuerzesten je gesehenen Bild, und ein einzelner Ausreisser von
   2 ms ergab "500 Hz".

   TIPPEN schaltet das Video-Scrubbing ab und wieder an. Die Seite scrollt
   weiter, nur springt kein Clip mehr. Der Unterschied zwischen den beiden
   Messreihen ist genau der Anteil, den das Video am Ruckeln hat, und beide
   stehen gleichzeitig im Feld: ein Screenshot beantwortet die Frage.

   Das Feld schreibt sich viermal in der Sekunde. Jedes Bild zu schreiben
   erzeugt genau die Last, die hier gemessen werden soll. */
(function () {
  'use strict';

  var kasten = document.createElement('div');
  kasten.setAttribute('style', [
    'position:fixed', 'left:0', 'right:0', 'top:0', 'z-index:99999',
    'background:rgba(0,0,0,0.9)', 'color:#dfe6ff', 'padding:7px 9px',
    'font:11px/1.45 ui-monospace,Menlo,monospace', 'white-space:pre-wrap',
    'border-bottom:1px solid #556', 'transform:translateZ(0)', 'contain:strict',
    'height:120px', '-webkit-user-select:none', 'user-select:none'
  ].join(';'));
  (document.body || document.documentElement).appendChild(kasten);

  // ---- zwei Messreihen: mit Video und ohne ---------------------------------
  function reihe() {
    return { ruheBest: 0, wischFps: 0, wischSpitze: 0, spruenge: 0, proben: 0 };
  }
  var mit = reihe(), ohne = reihe();
  var videoAn = true;

  function engine() {
    var i = window.ScrollCraft && window.ScrollCraft.instances;
    return i && i.length ? i[0] : null;
  }

  kasten.style.pointerEvents = 'auto';
  kasten.addEventListener('click', function () {
    var e = engine();
    if (!e || !e.scrub) { melde('kein Schalter: alte Engine'); return; }
    videoAn = !videoAn;
    e.scrub(videoAn);
    melde(videoAn ? 'Video an' : 'Video aus');
  });

  var hinweis = '', hinweisBis = 0;
  function melde(t) { hinweis = t; hinweisBis = performance.now() + 2500; }

  // ---- Wischen erkennen ----------------------------------------------------
  var wischt = false, wischBis = 0, wische = 0, letzteWeite = 0, startScroll = 0;
  addEventListener('touchstart', function () {
    wischt = true; wische++; startScroll = scrollY;
  }, { passive: true });
  addEventListener('touchend', function () {
    letzteWeite = Math.round(scrollY - startScroll);
    // Der Schwung laeuft nach dem Loslassen weiter; das gehoert zum Wischen.
    wischBis = performance.now() + 1200;
    wischt = false;
  }, { passive: true });

  // ---- Clips ---------------------------------------------------------------
  var clips = [], spruengeRoh = 0;
  function clipsSammeln() {
    var da = document.querySelectorAll('video');
    if (da.length === clips.length) return;
    clips = [];
    Array.prototype.forEach.call(da, function (v) {
      clips.push(v);
      v.addEventListener('seeking', function () { spruengeRoh++; }, { passive: true });
    });
  }
  function clipLage() {
    var geladen = 0, bereit = 0, sichtbar = 0;
    for (var i = 0; i < clips.length; i++) {
      var v = clips[i];
      if (v.src) geladen++;
      if (v.readyState >= 2) bereit++;
      var el = v.parentElement;
      if (parseFloat(v.style.opacity || getComputedStyle(v).opacity) > 0.5 &&
          (!el || getComputedStyle(el).visibility !== 'hidden')) sichtbar++;
    }
    return clips.length + ' Clips, ' + geladen + ' geladen, ' + bereit +
           ' bereit, ' + sichtbar + ' im Bild';
  }

  // ---- Schleife ------------------------------------------------------------
  var rahmen = 0, ab = performance.now(), letztes = ab, spitzeF = 0;
  var fehler = [];
  addEventListener('error', function (e) {
    fehler.push(String(e.message || 'Fehler').slice(0, 50));
    if (fehler.length > 2) fehler.shift();
  });

  function zeile(r) {
    return 'in Ruhe ' + (r.ruheBest || '--') + '/s   beim Wischen ' +
           (r.wischFps || '--') + '/s   langsamstes ' +
           (r.wischSpitze ? r.wischSpitze.toFixed(0) + ' ms' : '--') +
           '   Spr/s ' + (r.spruenge || 0);
  }

  function schleife(t) {
    var dauer = t - letztes;
    letztes = t;
    rahmen++;
    if (dauer > spitzeF) spitzeF = dauer;

    if (t - ab > 250) {
      var sek = (t - ab) / 1000;
      var fps = Math.round(rahmen / sek);
      var spr = Math.round(spruengeRoh / sek);
      var r = videoAn ? mit : ohne;
      var bewegt = wischt || t < wischBis;

      if (bewegt) {
        // Beim Wischen zaehlt der schlechteste Fall, nicht der Durchschnitt:
        // ein Ruckler faellt auf, ein guter Abschnitt macht ihn nicht wett.
        if (!r.wischFps || fps < r.wischFps) r.wischFps = fps;
        if (spitzeF > r.wischSpitze) r.wischSpitze = spitzeF;
        if (spr > r.spruenge) r.spruenge = spr;
        r.proben++;
      } else if (fps > r.ruheBest) {
        r.ruheBest = fps;          // in Ruhe zaehlt, was das Geraet schafft
      }

      rahmen = 0; spruengeRoh = 0; spitzeF = 0; ab = t;
      clipsSammeln();

      kasten.textContent =
        'Schirm ' + innerWidth + 'x' + innerHeight + ' dpr ' + (devicePixelRatio || 1) +
        '   gescrollt ' + Math.round(scrollY) + '/' +
        Math.round(document.documentElement.scrollHeight - innerHeight) +
        '   Wische ' + wische + '\n' +
        'MIT Video  ' + zeile(mit) + '\n' +
        'OHNE Video ' + zeile(ohne) + '\n' +
        clipLage() + '   jetzt: Video ' + (videoAn ? 'AN' : 'AUS') + '\n' +
        (window.Weiche ? window.Weiche.zeile() : 'keine Weiche geladen') + '\n' +
        (t < hinweisBis ? '>> ' + hinweis
          : fehler.length ? 'FEHLER: ' + fehler.join(' | ')
          : 'TIPPEN schaltet das Video um. Beide Reihen vollwischen.');
    }
    requestAnimationFrame(schleife);
  }
  requestAnimationFrame(schleife);
})();

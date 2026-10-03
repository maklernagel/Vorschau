/* Wird nur geladen, wenn "#diag" in der Adresse steht. Beantwortet die eine
   Frage, die von einem Rechner aus nicht zu messen ist: wie rund laeuft das
   Scrollen auf diesem Geraet wirklich.

   Zu lesen ist die Zeile "Bildrate": davor das Ziel des Schirms (ein iPhone Pro
   faehrt 120), dahinter was tatsaechlich ankommt, und in Klammern das
   langsamste Bild der letzten Sekunden. Ruckeln heisst: wenige Bilder, oder
   eine hohe Spitze. 8 ms ist das Budget bei 120 Hz, 16 ms bei 60.

   Das Feld schreibt sich selbst nur viermal in der Sekunde. Die Vorfassung
   schrieb jedes Bild, und ein textContent pro Bild erzeugt genau die Last, die
   hier gemessen werden soll. */
(function () {
  'use strict';

  var kasten = document.createElement('div');
  kasten.setAttribute('style', [
    'position:fixed', 'left:0', 'right:0', 'top:0', 'z-index:99999',
    'background:rgba(0,0,0,0.88)', 'color:#dfe6ff', 'padding:7px 9px',
    'font:11px/1.45 ui-monospace,Menlo,monospace', 'white-space:pre-wrap',
    'pointer-events:none', 'border-bottom:1px solid #556',
    /* Eigener Layer: sonst zieht dieses Feld bei jeder Aktualisierung die
       Seite darunter mit ins Neuzeichnen. */
    'transform:translateZ(0)', 'contain:strict', 'height:86px'
  ].join(';'));
  (document.body || document.documentElement).appendChild(kasten);

  // ---- Bildrate und Spitzen ------------------------------------------------
  var ziel = 0;                 // was der Schirm kann, aus den schnellsten Bildern
  var rahmen = 0, fensterAb = performance.now(), letztes = fensterAb;
  var fps = 0, spitze = 0, spitzeFenster = 0, ueberBudget = 0, anteil = 0;
  var kurzestes = 999;

  // ---- Wische -------------------------------------------------------------
  var wische = 0, weite = 0, startScroll = 0;
  addEventListener('touchstart', function () {
    wische++; startScroll = scrollY;
  }, { passive: true });
  addEventListener('touchend', function () {
    weite = Math.round(scrollY - startScroll);
  }, { passive: true });

  // ---- Fehler -------------------------------------------------------------
  var fehler = [];
  addEventListener('error', function (e) {
    fehler.push(String(e.message || 'Fehler').slice(0, 54));
    if (fehler.length > 2) fehler.shift();
  });

  // ---- Clips --------------------------------------------------------------
  // Die Engine haengt alle Clips ins DOM, einer je Etappe. Interessant ist, wie
  // viele davon gleichzeitig einen Dekoder belegen und wie oft gesprungen wird:
  // ein Sprung, den der Dekoder nicht schafft, ist sichtbares Ruckeln.
  var clips = [];
  var spruenge = 0, spruengeFenster = 0;

  function clipsSammeln() {
    var gefunden = document.querySelectorAll('video');
    if (gefunden.length === clips.length) return;
    clips = [];
    Array.prototype.forEach.call(gefunden, function (v) {
      clips.push(v);
      v.addEventListener('seeking', function () { spruenge++; }, { passive: true });
    });
  }

  function clipLage() {
    var mit = 0, bereit = 0, sichtbar = 0, springt = 0;
    for (var i = 0; i < clips.length; i++) {
      var v = clips[i];
      if (v.src) mit++;
      if (v.readyState >= 2) bereit++;
      if (v.seeking) springt++;
      if (parseFloat(getComputedStyle(v).opacity) > 0.5 &&
          getComputedStyle(v.parentElement).visibility !== 'hidden') sichtbar++;
    }
    return clips.length + ' Clips: ' + mit + ' geladen, ' + bereit + ' bereit, ' +
           sichtbar + ' im Bild, ' + springt + ' springt gerade\n' +
           'Spruenge/s ' + spruengeFenster;
  }

  // ---- Schleife -----------------------------------------------------------
  // Messen ist billig: zwei Subtraktionen. Gezeichnet wird viermal pro Sekunde,
  // und die Clip-Lage (die getComputedStyle braucht) nur dann.
  var text = 'messe …';

  function schleife(t) {
    var dauer = t - letztes;
    letztes = t;
    rahmen++;
    if (dauer > spitzeFenster) spitzeFenster = dauer;
    if (dauer < kurzestes && dauer > 1) kurzestes = dauer;

    // Das Ziel des Schirms aus dem kuerzesten je gesehenen Bild: ~8,3 ms sind
    // 120 Hz, ~16,7 ms sind 60. Ein geratenes Budget waere hier sinnlos, weil
    // genau die Verdopplung auf 120 Hz das halbe Budget bedeutet.
    if (kurzestes < 999) ziel = Math.round(1000 / kurzestes / 10) * 10;
    var budget = ziel >= 100 ? 8.3 : 16.7;
    if (dauer > budget * 1.5) ueberBudget++;

    if (t - fensterAb > 250) {
      var s = (t - fensterAb) / 1000;
      fps = Math.round(rahmen / s);
      anteil = Math.round(ueberBudget / Math.max(rahmen, 1) * 100);
      spruengeFenster = Math.round(spruenge / s);
      spitze = Math.max(spitze * 0.6, spitzeFenster);   // haelt Spitzen kurz sichtbar
      rahmen = 0; ueberBudget = 0; spruenge = 0; spitzeFenster = 0; fensterAb = t;

      clipsSammeln();
      text =
        'Schirm ' + innerWidth + 'x' + innerHeight + ' dpr ' + (devicePixelRatio || 1) +
        '   Ziel ' + (ziel || '?') + ' Hz\n' +
        'Bildrate ' + fps + '/s   langsamstes Bild ' + spitze.toFixed(1) + ' ms' +
        '   ueber Budget ' + anteil + '%\n' +
        'gescrollt ' + Math.round(scrollY) + ' von ' +
        Math.round(document.documentElement.scrollHeight - innerHeight) +
        '   Wische ' + wische + ' (letzter ' + weite + ' px)\n' +
        clipLage() +
        (fehler.length ? '\nFEHLER: ' + fehler.join(' | ') : '');
      kasten.textContent = text;
    }
    requestAnimationFrame(schleife);
  }
  requestAnimationFrame(schleife);
})();

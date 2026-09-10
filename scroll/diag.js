/* Wird nur geladen, wenn "#diag" in der Adresse steht. Zeigt oben auf der
   Seite, was beim Wischen tatsaechlich passiert, damit ein Screenshot vom
   Geraet die Frage beantwortet, die von hier aus nicht zu messen ist. */
(function () {
  'use strict';
  var kasten = document.createElement('div');
  kasten.setAttribute('style', [
    'position:fixed', 'left:0', 'right:0', 'top:0', 'z-index:99999',
    'background:rgba(0,0,0,0.86)', 'color:#eaf', 'padding:8px 10px',
    'font:11px/1.4 ui-monospace,Menlo,monospace', 'white-space:pre-wrap',
    'pointer-events:none', 'border-bottom:1px solid #556'
  ].join(';'));
  (document.body || document.documentElement).appendChild(kasten);

  var wische = 0, letzteWischweite = 0, startY = 0, startScroll = 0;
  var bewegt = 0, still = 0, letzterScroll = -1;
  var rahmen = 0, fps = 0, fensterAb = performance.now();
  var fehler = [];

  addEventListener('error', function (e) {
    fehler.push((e.message || 'Fehler').slice(0, 60));
    if (fehler.length > 3) fehler.shift();
  });
  addEventListener('touchstart', function (e) {
    wische++; startY = e.touches[0].clientY; startScroll = scrollY;
  }, { passive: true });
  addEventListener('touchend', function () {
    letzteWischweite = Math.round(scrollY - startScroll);
  }, { passive: true });

  function clip() {
    var v = document.querySelector('video[data-sc-scrub], .sc-world__seg video');
    if (!v) return 'kein Clip';
    return 'bereit ' + v.readyState + ' / bei ' + (v.currentTime || 0).toFixed(2) + ' s' +
           (getComputedStyle(v).opacity > 0.5 ? ' / sichtbar' : ' / verdeckt');
  }

  function akt() {
    var a = document.querySelector('[data-sc-act]');
    var p = a && getComputedStyle(a).getPropertyValue('--sc-p');
    return p ? 'Akt bei ' + (parseFloat(p) || 0).toFixed(2) : 'Weltflug';
  }

  (function schleife(t) {
    rahmen++;
    if (t - fensterAb > 500) {
      fps = Math.round(rahmen * 1000 / (t - fensterAb));
      rahmen = 0; fensterAb = t;
    }
    var y = Math.round(scrollY);
    if (y !== letzterScroll) { bewegt++; letzterScroll = y; } else { still++; }
    kasten.textContent =
      'Fenster ' + innerWidth + 'x' + innerHeight + ' dpr ' + (devicePixelRatio || 1) +
      '   Bilder/s ' + fps + '\n' +
      'gescrollt ' + y + ' von ' + (document.body.scrollHeight - innerHeight) + '\n' +
      'Wische ' + wische + '   letzter brachte ' + letzteWischweite + ' px\n' +
      akt() + '   Video: ' + clip() + '\n' +
      (fehler.length ? 'FEHLER: ' + fehler.join(' | ') : 'keine Fehler');
    requestAnimationFrame(schleife);
  })(performance.now());
})();

document.getElementById('yr').textContent = new Date().getFullYear();

var form = document.getElementById('lead-form');
var errEl = document.getElementById('form-err');

form.addEventListener('submit', function (e) {
  e.preventDefault();
  errEl.hidden = true;

  var ok = true;
  ['company', 'email'].forEach(function (id) {
    var el = document.getElementById(id);
    var bad = !el.value.trim() || (id === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim()));
    if (bad) { el.style.borderColor = '#D93025'; ok = false; } else { el.style.borderColor = ''; }
  });
  if (!ok) return;

  var btn = form.querySelector('button[type="submit"]');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending...';

  fetch('/api/lead', { method: 'POST', body: new FormData(form) })
    .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
    .then(function () {
      document.getElementById('form-fields').style.display = 'none';
      document.getElementById('thanks').style.display = 'block';
    })
    .catch(function () {
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    });
});

/* Testimonial carousel: loops, auto-advances, pauses on hover/focus, respects reduced motion */
(function () {
  var track = document.getElementById('tc-track');
  if (!track) return;
  var cards = track.children, n = cards.length;
  var dotsEl = document.getElementById('tc-dots');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var idx = 0, timer = null, paused = false;

  function stepPx() {
    var gap = parseFloat(getComputedStyle(track).columnGap) || 22;
    return cards[0].offsetWidth + gap;
  }
  function perView() { return Math.max(1, Math.round(track.clientWidth / stepPx())); }
  function maxIdx() { return Math.max(0, n - perView()); }

  function drawDots() {
    dotsEl.textContent = '';
    for (var i = 0; i <= maxIdx(); i++) {
      (function (i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
        b.addEventListener('click', function () { go(i); restart(); });
        dotsEl.appendChild(b);
      })(i);
    }
    mark();
  }
  function mark() {
    var ds = dotsEl.children;
    for (var i = 0; i < ds.length; i++) ds[i].setAttribute('aria-current', i === idx ? 'true' : 'false');
  }
  function go(i) {
    var max = maxIdx();
    idx = i > max ? 0 : (i < 0 ? max : i);
    track.scrollTo({ left: idx * stepPx(), behavior: reduce ? 'auto' : 'smooth' });
    mark();
  }
  function start() {
    if (reduce || timer) return;
    timer = setInterval(function () { if (!paused && !document.hidden) go(idx + 1); }, 6000);
  }
  function restart() { clearInterval(timer); timer = null; start(); }

  document.getElementById('tc-prev').addEventListener('click', function () { go(idx - 1); restart(); });
  document.getElementById('tc-next').addEventListener('click', function () { go(idx + 1); restart(); });
  ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) { track.parentNode.addEventListener(ev, function () { paused = true; }, { passive: true }); });
  ['mouseleave', 'focusout', 'touchend'].forEach(function (ev) { track.parentNode.addEventListener(ev, function () { paused = false; }, { passive: true }); });

  var t;
  track.addEventListener('scroll', function () {
    clearTimeout(t);
    t = setTimeout(function () { idx = Math.min(maxIdx(), Math.round(track.scrollLeft / stepPx())); mark(); }, 120);
  }, { passive: true });
  window.addEventListener('resize', function () { idx = Math.min(idx, maxIdx()); drawDots(); });

  drawDots();
  start();
})();

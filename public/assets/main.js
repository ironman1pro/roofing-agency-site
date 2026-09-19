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
  if (!ok) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }

  var btn = form.querySelector('button[type="submit"]');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending...';

  fetch('/api/lead', { method: 'POST', body: new FormData(form) })
    .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
    .then(function () {
      document.getElementById('form-fields').style.display = 'none';
      var th = document.getElementById('thanks'); th.style.display = 'block'; th.classList.add('show');
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

/* Motion system: scroll reveal, header state, progress bar, active nav, count-up */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.querySelector('header');

  /* scroll progress bar + compact header (one rAF-throttled listener) */
  var bar = document.createElement('div');
  bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var tick = false;
  function onScroll() {
    if (tick) return; tick = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
      header.classList.toggle('scrolled', window.scrollY > 24);
      tick = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* active nav link follows the section in view */
  var links = {};
  document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var navIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('active', k === e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (k) { var el = document.getElementById(k); if (el) navIO.observe(el); });
  }

  /* reveal on scroll, staggered inside each group */
  var groups = ['.cards3', '.grid2', '.work-grid', '.steps', '.plans', '.specs-grid', '.faq-list'];
  var singles = 'section .center > *, .founding, .addon, .guarantee, .tc-track, .tc-ctrl, .work-note, .cta-grid > *:first-child, #lead-form';
  var targets = [];
  document.querySelectorAll(groups.join(',')).forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--d', Math.min(i, 5) * 0.08 + 's'); targets.push(c); });
  });
  document.querySelectorAll(singles).forEach(function (el) { if (targets.indexOf(el) < 0 && !el.closest('.hero')) targets.push(el); });

  if (reduce || !('IntersectionObserver' in window)) return;
  function done(el) { setTimeout(function () { el.removeAttribute('data-reveal'); el.classList.remove('in'); el.style.removeProperty('--d'); }, 1300); }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in'); io.unobserve(e.target); done(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach(function (el) { el.setAttribute('data-reveal', ''); io.observe(el); });

  /* count-up for the numeric stats */
  document.querySelectorAll('.spec b').forEach(function (b) {
    var m = b.textContent.match(/^(\d+)(\+|%)?$/);
    if (!m) return;
    var end = +m[1], suffix = m[2] || '', started = false;
    var cio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || started) return;
      started = true; cio.disconnect();
      var t0 = performance.now(), dur = 1100;
      (function step(t) {
        var p = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
        b.textContent = v + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.6 });
    b.textContent = '0' + suffix; cio.observe(b);
  });
})();

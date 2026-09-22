document.getElementById('yr').textContent = new Date().getFullYear();

var form = document.getElementById('lead-form');
var errEl = document.getElementById('form-err');

if (form) {
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

  var fd = new FormData(form);
  fd.append('_subject', 'New Adaptify lead: ' + document.getElementById('company').value.trim().slice(0, 80));
  var trap = document.querySelector('[name=website]');
  var send = (trap && trap.value.trim())
    ? Promise.resolve()
    : fetch('https://formspree.io/f/xvkgzgwd', { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (r.ok) return r.json();
          return r.json().catch(function () { return {}; }).then(function (j) {
            var m = (j && (j.error || (j.errors && j.errors[0] && j.errors[0].message))) || '';
            throw new Error(r.status + (m ? ' ' + m : ''));
          });
        });
  send
    .then(function () {
      document.getElementById('form-fields').style.display = 'none';
      var th = document.getElementById('thanks'); th.style.display = 'block'; th.classList.add('show');
    })
    .catch(function (e) {
      if (window.console) console.error('Form error:', e && e.message ? e.message : e);
      errEl.textContent = 'Something went wrong (' + (e && e.message ? e.message.slice(0, 80) : 'network error') + '). Please try again, or email us at info@adaptify.tech.';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    });
});
}

/* Testimonials: endless marquee. Cards are cloned once; CSS moves the strip left by exactly one set, so the loop is seamless. */
(function () {
  var track = document.getElementById('tc-track');
  if (!track) return;
  var cards = Array.prototype.slice.call(track.children);
  var set = document.createElement('div'); set.className = 'tc-set';
  cards.forEach(function (c) { set.appendChild(c); });
  var clone = set.cloneNode(true); clone.setAttribute('aria-hidden', 'true');
  var move = document.createElement('div'); move.className = 'tc-move';
  move.appendChild(set); move.appendChild(clone);
  track.textContent = ''; track.appendChild(move);
  track.classList.add('marquee');
  track.style.setProperty('--tc-dur', (cards.length * 12) + 's');
  // touch: hold to pause
  track.addEventListener('touchstart', function () { track.classList.add('held'); }, { passive: true });
  ['touchend', 'touchcancel'].forEach(function (ev) { track.addEventListener(ev, function () { setTimeout(function () { track.classList.remove('held'); }, 1500); }, { passive: true }); });
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

/* Mobile sticky CTA: hidden over the hero CTA and the form, visible in between */
(function () {
  var bar = document.getElementById('sticky'), hero = document.querySelector('.hero-cta'), form = document.getElementById('start');
  if (!bar || !hero || !form || !('IntersectionObserver' in window)) { if (bar) bar.classList.add('show'); return; }
  var heroSeen = true, formSeen = false;
  function update() { bar.classList.toggle('show', !heroSeen && !formSeen); }
  new IntersectionObserver(function (es) { heroSeen = es[0].isIntersecting; update(); }).observe(hero);
  new IntersectionObserver(function (es) { formSeen = es[0].isIntersecting; update(); }, { threshold: 0.15 }).observe(form);
})();

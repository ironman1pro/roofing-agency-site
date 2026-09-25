document.documentElement.classList.add('js');
var yr = document.getElementById('yr');
if (yr) yr.textContent = new Date().getFullYear();

/* Services dropdown: opens on hover (desktop), click/tap or keyboard; closes on outside click, Escape or tabbing away */
(function () {
  var dd = document.querySelector('.nav-dd'), b = dd && dd.querySelector('.nav-dd-btn');
  if (!b) return;
  function set(open) { dd.classList.toggle('open', open); b.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  b.addEventListener('click', function (e) { e.stopPropagation(); set(!dd.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!dd.contains(e.target)) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dd.classList.contains('open')) { set(false); b.focus(); } });
  dd.addEventListener('focusout', function (e) { if (!dd.contains(e.relatedTarget)) set(false); });
})();

/* Mobile menu: the toggle shows the service links under 960px */
(function () {
  var header = document.querySelector('header'), btn = header && header.querySelector('.nav-toggle');
  if (!btn) return;
  function set(open) {
    header.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  btn.addEventListener('click', function () { set(!header.classList.contains('nav-open')); });
  header.querySelectorAll('.nav-links a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('nav-open')) { set(false); btn.focus(); } });
  document.addEventListener('click', function (e) { if (!header.contains(e.target)) set(false); });
})();

var form = document.getElementById('lead-form');
var errEl = document.getElementById('form-err');

/* Inline field errors: message under the field, announced to screen readers, cleared as you type */
function setFieldError(el, msg) {
  var id = el.id + '-err', p = document.getElementById(id);
  if (msg) {
    if (!p) { p = document.createElement('p'); p.id = id; p.className = 'field-err'; el.insertAdjacentElement('afterend', p); }
    p.textContent = msg;
    el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', id);
  } else {
    if (p) p.remove();
    el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
  }
}

if (form) {
form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') setFieldError(e.target, ''); });
form.addEventListener('submit', function (e) {
  e.preventDefault();
  errEl.hidden = true;

  var firstBad = null;
  ['company', 'email'].forEach(function (id) {
    var el = document.getElementById(id);
    var v = el.value.trim();
    var msg = !v ? (id === 'email' ? 'Please enter your email.' : 'Please fill this in.')
      : (id === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) ? 'That email doesn\'t look right. Check for typos.' : '';
    setFieldError(el, msg);
    if (msg && !firstBad) firstBad = el;
  });
  if (firstBad) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); firstBad.focus(); return; }

  var btn = form.querySelector('button[type="submit"]');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending...';

  var fd = new FormData(form);
  // Every form posts to the same Formspree inbox; the subject line says which page it came from.
  var SUBJECTS = {
    'websites': 'Website preview request', 'receptionist': 'AI Receptionist demo request',
    'invoice-follow-up': 'Invoice Follow-Up call request', 'estimate-follow-up': 'Estimate Follow-Up call request',
    'reviews-updates': 'Reviews & Updates call request', 'storm-alerts': 'Storm Alerts call request',
    'contact': 'Contact form message'
  };
  var svc = (form.querySelector('[name=service]') || {}).value || '';
  fd.append('_subject', '[' + (SUBJECTS[svc] || 'Website lead') + '] ' + document.getElementById('company').value.trim().slice(0, 80));
  fd.append('page', location.pathname);
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
  if (!track || track.classList.contains('marquee')) return;
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
  var singles = 'section .center > *, .rv, .founding, .addon, .guarantee, .tc-track, .tc-ctrl, .work-note, .cta-grid > *:first-child, #lead-form';
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

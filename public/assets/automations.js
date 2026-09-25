/* Receptionist page: "Request a live demo" form in the hero. Sends to Formspree like the other lead forms. */
(function () {
  var form = document.getElementById('demo-form');
  var errEl = document.getElementById('demo-err');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.hidden = true;
    var ok = true;
    ['d-name', 'd-email'].forEach(function (id) {
      var el = document.getElementById(id);
      var bad = !el.value.trim() || (id === 'd-email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim()));
      if (bad) { el.style.borderColor = '#D93025'; ok = false; } else { el.style.borderColor = ''; }
    });
    if (!ok) return;
    var trap = form.querySelector('[name=website]');
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    var fd = new FormData(form);
    fd.append('_subject', 'Live demo request (receptionist): ' + document.getElementById('d-name').value.trim().slice(0, 80));
    var send = (trap && trap.value.trim()) ? Promise.resolve() :
      fetch('https://formspree.io/f/xvkgzgwd', { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); });
    send.then(function () {
      form.style.display = 'none';
      var th = document.getElementById('demo-thanks');
      th.style.display = 'block';
      th.classList.add('show');
    }).catch(function (e) {
      errEl.textContent = 'Something went wrong (' + (e && e.message ? e.message : 'network error') + '). Please try again, or email us at info@adaptify.tech.';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    });
  });
})();

/* Pricing: maintenance price follows the minutes dropdown ($299 incl. 500 min, +$100 per 300 min) */
(function () {
  var sel = document.getElementById('rx-minutes');
  if (!sel) return;
  var price = document.getElementById('rx-price'), li = document.getElementById('rx-min-li'), calls = document.getElementById('rx-calls-li');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shown = 299, raf = 0;
  function paint(v) { price.textContent = '$' + Math.round(v); }
  function upd() {
    var m = +sel.value, target = 299 + (m - 500) / 300 * 100;
    li.textContent = m.toLocaleString('en-US');
    calls.textContent = Math.round(m / 5).toLocaleString('en-US');
    cancelAnimationFrame(raf);
    if (reduce) { shown = target; paint(target); return; }
    price.classList.add('bump');
    var from = shown, t0 = performance.now();
    (function step(t) {
      var p = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - p, 3);
      shown = from + (target - from) * e; paint(shown);
      if (p < 1) raf = requestAnimationFrame(step); else setTimeout(function () { price.classList.remove('bump'); }, 250);
    })(t0);
  }
  sel.addEventListener('change', upd);
})();

/* Offer section: step through the after-hours call story while it's on screen */
(function () {
  var flow = document.getElementById('rx-flow');
  if (!flow) return;
  var steps = flow.querySelectorAll('.rx-steps li');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(i) {
    flow.setAttribute('data-s', i);
    Array.prototype.forEach.call(steps, function (li, k) {
      li.classList.toggle('on', k === i);
      li.classList.toggle('done', k < i);
    });
  }
  if (reduce) { show(3); return; }
  var i = 0, timer = 0, running = false;
  var hold = [2600, 2600, 2600, 4200];
  function tick() { show(i); timer = setTimeout(function () { i = (i + 1) % steps.length; tick(); }, hold[i]); }
  function start() { if (running) return; running = true; tick(); }
  function stop() { running = false; clearTimeout(timer); }
  show(0);
  if (!('IntersectionObserver' in window)) { start(); return; }
  new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }, { threshold: 0.35 }).observe(flow);
})();

/* Dashboard mock: click a call to see its transcript, play button animates the waveform */
(function () {
  var dash = document.querySelector('.rx-dash');
  if (!dash) return;
  var C = [
    { d: '3:12', l: [['c', "Hi, water's coming through my ceiling after the storm."], ['a', 'Sorry to hear that. Is it actively leaking right now?'], ['c', 'Yes, into the upstairs bedroom.'], ['a', "I'm alerting our on-call tech now, and I've booked you for an inspection tomorrow at 8 AM. Does that work?"]], f: ['⚑ On-call tech notified', '📅 Wed 8:00 AM inspection'] },
    { d: '4:40', l: [['c', 'A tree limb came down on my roof and there are shingles in the yard.'], ['a', 'Is anyone hurt, and is water getting inside?'], ['c', 'No one is hurt, but the attic is wet.'], ['a', "Understood. I'm sending this to our on-call crew now so they can call you back within 15 minutes."]], f: ['⚑ Escalated to Mike (on call)', '📞 Callback in 15 min'] },
    { d: '2:05', l: [['c', "I'd like a quote on replacing my roof, it's about 20 years old."], ['a', "Happy to help. Is this for a single-family home, and what's the address?"], ['c', '1820 Ridge Rd, single family.'], ['a', "Thanks. I've booked a free estimate for Monday at 10 AM."]], f: ['📅 Mon 10:00 AM estimate', '✉ Confirmation texted'] },
    { d: '1:18', l: [['c', 'Do you work with insurance claims for hail damage?'], ['a', 'Yes, we help with the inspection and the paperwork for your insurance claim.'], ['c', "Great, I'll call back Monday to set it up."], ['a', "Sounds good. I've noted your number so the office can follow up."]], f: ['ℹ Question answered', '📝 Follow-up noted'] }
  ];
  var lines = document.getElementById('rx-lines'), foot = document.getElementById('rx-foot');
  var dur = dash.querySelector('.rx-dur'), wave = dash.querySelector('.rx-wave'), play = dash.querySelector('.rx-play');
  var t = 0;
  function esc(x) { var d = document.createElement('div'); d.textContent = x; return d.innerHTML; }
  function stop() { clearInterval(t); t = 0; play.textContent = '▶'; play.setAttribute('aria-label', 'Play recording'); }
  function pick(el) {
    var c = C[+el.getAttribute('data-i')];
    dash.querySelectorAll('.rx-call').forEach(function (r) { r.classList.toggle('on', r === el); });
    lines.innerHTML = c.l.map(function (x) { return '<p' + (x[0] === 'a' ? ' class="ai"' : '') + '><b>' + (x[0] === 'a' ? 'Receptionist' : 'Caller') + '</b>' + esc(x[1]) + '</p>'; }).join('');
    foot.innerHTML = c.f.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
    dur.textContent = c.d; stop(); wave.style.setProperty('--p', '0%');
  }
  dash.querySelectorAll('.rx-call').forEach(function (r) {
    r.addEventListener('click', function () { pick(r); });
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r); } });
  });
  play.addEventListener('click', function () {
    if (t) { stop(); return; }
    var p = parseFloat(wave.style.getPropertyValue('--p')) || 0; if (p >= 100) p = 0;
    play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause recording');
    t = setInterval(function () { p += 1.5; wave.style.setProperty('--p', Math.min(p, 100) + '%'); if (p >= 100) stop(); }, 100);
  });
  var up = dash.querySelector('.rx-topup');
  up.addEventListener('click', function () { up.textContent = '✓ Request sent'; setTimeout(function () { up.textContent = '+ Request more minutes'; }, 2200); });
})();

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

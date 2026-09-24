/* Invoice follow-up page: calculator, timeline progress, page-specific reveals. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Calculator ---------- */
  var n = document.getElementById('iv-n'), amt = document.getElementById('iv-amt'), days = document.getElementById('iv-days');
  if (n && amt && days) {
    var fmt = function (v) { return '$' + Math.round(v).toLocaleString('en-US'); };
    var big = document.getElementById('iv-total'), shown = 0, raf = 0;
    function animateTo(target) {
      if (reduce) { big.textContent = fmt(target); shown = target; return; }
      cancelAnimationFrame(raf);
      var from = shown, t0 = performance.now(), dur = 450;
      (function step(t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        shown = from + (target - from) * e;
        big.textContent = fmt(shown);
        if (p < 1) raf = requestAnimationFrame(step);
      })(t0);
    }
    function calc() {
      var count = +n.value, avg = +amt.value, late = +days.value;
      document.getElementById('iv-n-o').textContent = count;
      document.getElementById('iv-amt-o').textContent = fmt(avg);
      document.getElementById('iv-days-o').textContent = late + ' days';
      animateTo(count * avg);
      document.getElementById('iv-msgs').textContent = (count * 4).toLocaleString('en-US');
      var hrs = Math.round(count * 25 / 60 * 10) / 10;
      document.getElementById('iv-hrs').textContent = hrs + ' hrs';
      document.getElementById('iv-late').textContent = late + ' days';
    }
    [n, amt, days].forEach(function (el) { el.addEventListener('input', calc); });
    calc();
  }

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.iv-tl').forEach(function (t) { t.classList.add('go'); });
    return;
  }

  /* ---------- Timeline progress ---------- */
  var tl = document.querySelector('.iv-tl');
  if (tl) {
    var tio = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { tl.classList.add('go'); tio.disconnect(); }
    }, { threshold: 0.35 });
    tio.observe(tl);
  }

  /* ---------- Reveals for page-specific blocks ---------- */
  if (reduce) return;
  var els = [];
  document.querySelectorAll('.iv-scen, .iv-tl, .featgrid, .intgrid, .hlrow').forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--d', Math.min(i, 5) * 0.08 + 's'); els.push(c); });
  });
  document.querySelectorAll('.iv-calc, .iv-vs, .iv-pilot, .ownbox, .iv-col').forEach(function (e) { els.push(e); });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in'); io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach(function (e) { e.classList.add('iv-r'); io.observe(e); });
})();

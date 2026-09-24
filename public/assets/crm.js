(function(){
  var form = document.getElementById('leadform');
  if(!form) return;
  var err = document.getElementById('lf-err');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    err.hidden = true;
    var ok = true;
    ['lf-name','lf-biz','lf-contact'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el.value.trim()) { el.style.borderColor = '#D93025'; ok = false; } else { el.style.borderColor = ''; }
    });
    if (!ok) return;
    var btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending...';
    var fd = new FormData(form);
    fd.append('_subject', 'New Adaptify CRM lead: ' + document.getElementById('lf-biz').value.trim().slice(0, 80));
    var trap = form.querySelector('[name=website]');
    var send = (trap && trap.value.trim()) ? Promise.resolve() :
      fetch('https://formspree.io/f/xvkgzgwd', { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function(r){ if (!r.ok) throw new Error(String(r.status)); });
    send.then(function(){
      form.hidden = true;
      document.getElementById('lf-thanks').hidden = false;
    }).catch(function(e){
      err.textContent = 'Something went wrong (' + (e && e.message ? e.message : 'network error') + '). Please try again, or email us at info@adaptify.tech.';
      err.hidden = false; btn.disabled = false; btn.textContent = label;
    });
  });
})();

(function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(el){
    var target = parseFloat(el.getAttribute('data-target'));
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion || isNaN(target)) { el.textContent = target + suffix; return; }
    var duration = 900, startTime = null;
    function step(ts){
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target + suffix;
    }
    requestAnimationFrame(step);
  }

  function activateFills(container){
    if (reduceMotion) { container.querySelectorAll('.countup').forEach(countUp); return; }
    container.querySelectorAll('.fillbar').forEach(function(el){
      var target = el.style.width;
      el.style.transition = 'none';
      el.style.width = '0%';
      el.getBoundingClientRect();
      el.style.transition = '';
      requestAnimationFrame(function(){ el.style.width = target; });
    });
    container.querySelectorAll('.ringfill').forEach(function(el){
      var target = el.getAttribute('stroke-dashoffset');
      var full = el.getAttribute('stroke-dasharray');
      el.style.transition = 'none';
      el.style.strokeDashoffset = full;
      el.getBoundingClientRect();
      el.style.transition = '';
      requestAnimationFrame(function(){ el.style.strokeDashoffset = target; });
    });
    container.querySelectorAll('.countup').forEach(countUp);
  }

  if (!('IntersectionObserver' in window)) { activateFills(document); return; }
  var els = document.querySelectorAll('.sechead, .feat, .step, .scopeprice, .scopefactors, .cpanel, .bitem, .fgitem, .intitem, .heroshot, .guaranteebar');
  els.forEach(function(el){ el.classList.add('reveal'); });
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting) {
        entry.target.classList.add('shown');
        activateFills(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, {threshold:0.12, rootMargin:"0px 0px -40px 0px"});
  els.forEach(function(el){ io.observe(el); });
})();

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
  track.addEventListener('touchstart', function () { track.classList.add('held'); }, { passive: true });
  ['touchend', 'touchcancel'].forEach(function (ev) { track.addEventListener(ev, function () { setTimeout(function () { track.classList.remove('held'); }, 1500); }, { passive: true }); });
})();

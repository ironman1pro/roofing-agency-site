(function(){
  var form = document.getElementById('leadform');
  if(!form) return;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name = document.getElementById('lf-name').value.trim();
    var biz = document.getElementById('lf-biz').value.trim();
    var tool = document.getElementById('lf-tool').value.trim();
    var contact = document.getElementById('lf-contact').value.trim();
    var pain = document.getElementById('lf-pain').value.trim();
    var lines = [
      "New Adaptify Builds call request",
      "Name: " + name,
      "Business: " + biz,
      "Currently using: " + (tool || "-"),
      "Reach me at: " + contact,
      "Biggest headache: " + (pain || "-")
    ];
    var msg = encodeURIComponent(lines.join("\n"));
    window.location.href = "mailto:contact.damir.1@gmail.com?subject=" + encodeURIComponent("Adaptify Builds call request from " + (biz || name)) + "&body=" + msg;
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
        entry.target.classList.add('in');
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
  track.addEventListener('touchstart', function () { track.classList.add('held'); }, { passive: true });
  ['touchend', 'touchcancel'].forEach(function (ev) { track.addEventListener(ev, function () { setTimeout(function () { track.classList.remove('held'); }, 1500); }, { passive: true }); });
})();

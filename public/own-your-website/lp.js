// Reveal sections as they scroll into view.
(function () {
  var els = document.querySelectorAll('.rv');
  if (!els.length || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

/* Own Your Website landing page: show the mobile buy bar once the hero button is off screen, hide it over pricing. */
(function () {
  var bar = document.getElementById('mbar'), hero = document.querySelector('.hero-cta'), price = document.getElementById('pricing');
  if (!bar || !hero || !price || !('IntersectionObserver' in window)) return;
  var heroSeen = true, priceSeen = false;
  function update() { var on = !heroSeen && !priceSeen; bar.classList.toggle('show', on); bar.setAttribute('aria-hidden', on ? 'false' : 'true'); }
  new IntersectionObserver(function (e) { heroSeen = e[0].isIntersecting; update(); }).observe(hero);
  new IntersectionObserver(function (e) { priceSeen = e[0].isIntersecting; update(); }, { threshold: 0.1 }).observe(price);
})();

// Showcase: open the large design in a dialog instead of leaving the page.
(function () {
  var links = document.querySelectorAll('.show');
  if (!links.length || typeof HTMLDialogElement !== 'function') return;
  var dlg = document.createElement('dialog'), img = new Image(), cap = document.createElement('p'), close = document.createElement('button');
  dlg.className = 'lb'; img.alt = ''; img.width = 1600; img.height = 1000;
  close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.textContent = '×';
  dlg.append(close, img, cap); document.body.appendChild(dlg);
  close.addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      img.src = a.getAttribute('href'); img.alt = a.querySelector('img').alt; cap.textContent = a.dataset.cap;
      dlg.showModal();
    });
  });
})();

// Launch list: sends the email to the shared Formspree inbox (form-action is locked to 'self' by the CSP, so this posts with fetch).
(function () {
  var form = document.getElementById('wl');
  if (!form) return;
  var input = document.getElementById('wl-email'), err = document.getElementById('wl-err'), ok = document.getElementById('wl-ok');
  var btn = form.querySelector('button[type="submit"]');
  function fail(msg) { err.textContent = msg; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Please enter a valid email address.');
    err.hidden = true; input.removeAttribute('aria-invalid');
    var label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Joining...';
    var fd = new FormData(form);
    fd.append('_subject', '[Own Your Website – launch list] ' + email.slice(0, 80));
    fd.append('page', location.pathname);
    var trap = form.querySelector('[name=website]');
    var send = trap && trap.value.trim() ? Promise.resolve() :
      fetch('https://formspree.io/f/xvkgzgwd', { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); });
    send.then(function () {
      form.hidden = true; ok.hidden = false;
    }).catch(function () {
      btn.disabled = false; btn.innerHTML = label;
      fail('Something went wrong. Please try again, or email us at info@adaptify.tech.');
    });
  });
})();

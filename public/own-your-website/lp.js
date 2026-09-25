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

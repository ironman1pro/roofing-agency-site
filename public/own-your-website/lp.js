/* Own Your Website landing page: show the mobile buy bar once the hero button is off screen, hide it over pricing. */
(function () {
  var bar = document.getElementById('mbar'), hero = document.querySelector('.hero-cta'), price = document.getElementById('pricing');
  if (!bar || !hero || !price || !('IntersectionObserver' in window)) return;
  var heroSeen = true, priceSeen = false;
  function update() { var on = !heroSeen && !priceSeen; bar.classList.toggle('show', on); bar.setAttribute('aria-hidden', on ? 'false' : 'true'); }
  new IntersectionObserver(function (e) { heroSeen = e[0].isIntersecting; update(); }).observe(hero);
  new IntersectionObserver(function (e) { priceSeen = e[0].isIntersecting; update(); }, { threshold: 0.1 }).observe(price);
})();

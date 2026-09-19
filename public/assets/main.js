document.getElementById('yr').textContent = new Date().getFullYear();

var form = document.getElementById('lead-form');
var errEl = document.getElementById('form-err');

form.addEventListener('submit', function (e) {
  e.preventDefault();
  errEl.hidden = true;

  var ok = true;
  ['name', 'company', 'phone'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el.value.trim()) { el.style.borderColor = '#D93025'; ok = false; } else { el.style.borderColor = ''; }
  });
  if (!ok) return;

  var btn = form.querySelector('button[type="submit"]');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending...';

  fetch('/api/lead', { method: 'POST', body: new FormData(form) })
    .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
    .then(function () {
      document.getElementById('form-fields').style.display = 'none';
      document.getElementById('thanks').style.display = 'block';
    })
    .catch(function () {
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    });
});

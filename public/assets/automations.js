/* Instant callback demo form. Submits name + phone to a backend endpoint that
   triggers an outbound AI call (Vapi / Retell / Bland AI + Twilio, or similar).
   NOTE for dev: /api/demo-call needs to be implemented server-side to actually
   place the call. This front-end is ready to wire up once that endpoint exists. */
(function () {
  var form = document.getElementById('demo-form');
  var errEl = document.getElementById('demo-err');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.hidden = true;
    var trap = form.querySelector('[name=website]');
    if (trap && trap.value.trim()) return;
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Calling you now...';
    var fd = new FormData(form);
    fetch('/api/demo-call', { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('Request failed'); return r.json().catch(function(){ return {}; }); })
      .then(function () {
        form.style.display = 'none';
        var th = document.getElementById('demo-thanks');
        th.style.display = 'block';
        th.classList.add('show');
      })
      .catch(function () {
        errEl.textContent = "Something went wrong placing the call. Please try again, or email us at info@adaptify.tech.";
        errEl.hidden = false;
        btn.disabled = false;
        btn.textContent = label;
      });
  });
})();

document.querySelectorAll('form.lead-form').forEach(function (f) {
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    f.querySelector('.fields').style.display = 'none';
    f.querySelector('.thanks').style.display = 'block';
  });
});

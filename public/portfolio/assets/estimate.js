(function () {
  var f = document.querySelector('form.calc');
  if (!f) return;
  var out = document.getElementById('est-range');
  var lines = document.getElementById('est-lines');
  var sizeOut = document.getElementById('size-out');
  var round = parseInt(f.getAttribute('data-round'), 10) || 100;
  function money(n) { return '$' + (Math.round(n / round) * round).toLocaleString('en-US'); }
  function num(v) { return parseFloat(v) || 0; }
  function row(label, value) {
    var li = document.createElement('li');
    var a = document.createElement('span'); a.textContent = label;
    var b = document.createElement('span'); b.textContent = value;
    li.appendChild(a); li.appendChild(b); lines.appendChild(li);
  }
  function calc() {
    var size = num(f.elements.size.value);
    var foot = size * num(f.elements.stories.value);
    var area = Math.round(foot * num(f.elements.pitch.value) * 1.08 / 10) * 10;
    var mat = f.elements.material.options[f.elements.material.selectedIndex];
    var lo = area * num(mat.getAttribute('data-min'));
    var hi = area * num(mat.getAttribute('data-max'));
    sizeOut.textContent = size.toLocaleString('en-US') + ' sq ft';
    lines.textContent = '';
    row('Roof area (approx.)', area.toLocaleString('en-US') + ' sq ft');
    row(mat.getAttribute('data-name') || mat.textContent, money(lo) + ' – ' + money(hi));
    var boxes = f.querySelectorAll('input[type=checkbox]:checked');
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i], mn = num(b.getAttribute('data-min')), mx = num(b.getAttribute('data-max'));
      if (b.getAttribute('data-kind') === 'psf') { mn *= area; mx *= area; }
      lo += mn; hi += mx;
      row(b.getAttribute('data-name'), '+ ' + money(mn) + ' – ' + money(mx));
    }
    out.textContent = money(lo) + ' – ' + money(hi);
  }
  f.addEventListener('input', calc);
  f.addEventListener('change', calc);
  f.addEventListener('submit', function (e) { e.preventDefault(); });
  calc();
})();

/* Operator break-even calculator: contribution after variable journey costs, not gross fares. */
(function () {
  'use strict';
  var form = document.getElementById('calc');
  if (!form) return;

  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) {
    var sign = n < 0 ? '−' : '';
    return sign + '£' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var num = function (id) {
    var v = parseFloat($(id).value);
    return isFinite(v) && v >= 0 ? v : 0;
  };

  function update() {
    var fare = num('calc-fare');
    var cost = num('calc-cost');
    var sub = num('calc-sub');
    var n = Math.floor(num('calc-n'));

    var per = fare - cost;
    var gross = fare * n;
    var contrib = per * n;
    var net = contrib - sub;

    $('r-per').textContent = money(per);
    $('r-gross').textContent = money(gross);
    $('r-contrib').textContent = money(contrib);
    $('r-net').textContent = money(net);

    var breakEven;
    if (sub === 0) breakEven = '0';
    else if (per <= 0) breakEven = 'Not reachable';
    else breakEven = String(Math.ceil(sub / per - 1e-9));
    $('r-break').textContent = breakEven;

    var box = $('r-box');
    var msg = $('r-msg');
    box.classList.toggle('neg', net < 0);
    if (per <= 0) {
      msg.textContent = 'Your estimated cost per booking is at or above the average fare, so extra bookings would not recover the subscription.';
    } else if (net < 0) {
      msg.textContent = 'Below break-even: about ' + breakEven + ' extra bookings a week would be needed to recover the subscription.';
    } else {
      msg.textContent = 'After journey costs and the subscription, at ' + n + ' extra booking' + (n === 1 ? '' : 's') + ' a week.';
    }
  }

  form.addEventListener('input', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  update();
})();

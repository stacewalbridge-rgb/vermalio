/* WhyDrive site behaviour: header state, mobile menu, reveal-on-scroll, app showcase dots. */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var onScroll = function () {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu: a modal dialog with focus trap, Escape to close and scroll lock.
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');
  var closeBtn = menu && menu.querySelector('.menu-close');
  var lastFocus = null;

  function focusables() {
    return Array.prototype.filter.call(
      menu.querySelectorAll('a[href], button:not([disabled])'),
      function (el) { return el.offsetParent !== null; }
    );
  }

  function openMenu() {
    lastFocus = document.activeElement;
    menu.hidden = false;
    // Force a frame so the transition runs after display is restored.
    requestAnimationFrame(function () {
      menu.classList.add('is-open');
      document.body.classList.add('menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeMenu(restoreFocus) {
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    window.setTimeout(function () { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 260);
    if (restoreFocus !== false && lastFocus) lastFocus.focus();
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      if (menu.classList.contains('is-open')) closeMenu(); else openMenu();
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { closeMenu(); });
    menu.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (link) closeMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key === 'Tab') {
        var items = focusables();
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // The desktop navigation takes over at wide widths; never leave the overlay stuck open.
    var wide = window.matchMedia('(min-width: 1080px)');
    var onWide = function () { if (wide.matches && menu.classList.contains('is-open')) closeMenu(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else wide.addListener(onWide);
  }

  // Reveal sections as they enter the viewport.
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // Phone showcase: coverflow carousel on small screens (swipe, tap, dots, gentle auto-advance).
  var phones = document.querySelector('.phones');
  var dots = document.querySelector('.showcase-dots');
  if (phones && dots) {
    var items = Array.prototype.slice.call(phones.querySelectorAll('.phone-item'));
    var n = items.length;
    var active = 0;
    var small = window.matchMedia('(max-width: 1023px)');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var buttons = items.map(function (item, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show screen ' + (i + 1) + ' of ' + n);
      b.addEventListener('click', function () { go(i); stopAuto(); });
      dots.appendChild(b);
      return b;
    });

    function layout() {
      var on = small.matches;
      items.forEach(function (item, i) {
        var o = i - active;
        if (o > n / 2) o -= n;
        if (o < -n / 2) o += n;
        if (on) {
          item.style.setProperty('--o', o);
          item.style.setProperty('--abs', Math.abs(o));
          item.setAttribute('data-far', Math.abs(o) > 1 ? 'true' : 'false');
          item.setAttribute('aria-hidden', o === 0 ? 'false' : 'true');
        } else {
          item.style.removeProperty('--o');
          item.style.removeProperty('--abs');
          item.removeAttribute('data-far');
          item.style.removeProperty('opacity');
          item.removeAttribute('aria-hidden');
        }
        item.classList.toggle('is-active', o === 0);
      });
      buttons.forEach(function (b, i) { b.setAttribute('aria-current', i === active ? 'true' : 'false'); });
    }
    function go(i) { active = (i + n) % n; layout(); }

    var timer = null;
    function startAuto() { if (!reduce.matches && small.matches && !timer) timer = window.setInterval(function () { go(active + 1); }, 4200); }
    function stopAuto() { if (timer) { window.clearInterval(timer); timer = null; } }

    items.forEach(function (item, i) {
      item.addEventListener('click', function () { if (small.matches && i !== active) { go(i); stopAuto(); } });
    });
    var x0 = null, y0 = null;
    phones.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    phones.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(active + (dx < 0 ? 1 : -1)); stopAuto(); }
      x0 = y0 = null;
    }, { passive: true });
    var onChange = function () { layout(); if (small.matches) startAuto(); else stopAuto(); };
    if (small.addEventListener) small.addEventListener('change', onChange); else small.addListener(onChange);
    layout();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) startAuto(); else stopAuto(); });
      }).observe(phones);
    } else { startAuto(); }
  }
})();

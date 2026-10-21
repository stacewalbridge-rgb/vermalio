/* Join WhyDrive enquiry form: multi-vehicle records, validation and secure submission. */
(function () {
  'use strict';
  var form = document.getElementById('join-form');
  if (!form) return;

  var MAX_VEHICLES = 50;
  var list = document.getElementById('vehicles');
  var addBtn = document.getElementById('add-vehicle');
  var countNote = document.getElementById('vehicle-count');
  var alertBox = document.getElementById('form-error');
  var submitBtn = document.getElementById('submit-btn');
  var success = document.getElementById('join-success');
  var template = list.querySelector('[data-vehicle]').cloneNode(true);
  var DRAFT_KEY = 'whydrive-join-draft';

  document.getElementById('startedAt').value = String(Date.now());

  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  var POSTCODE_RE = /^(GIR ?0AA|[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2})$/i;
  var REG_RE = /^[A-Z0-9 ]{2,10}$/i;

  function phoneOk(raw) {
    var d = String(raw || '').replace(/[\s().-]/g, '');
    if (d.indexOf('+44') === 0) d = '0' + d.slice(3);
    else if (d.indexOf('0044') === 0) d = '0' + d.slice(4);
    return /^0\d{9,10}$/.test(d);
  }

  // Give each vehicle block unique ids and form names, and number it.
  function renumber() {
    var blocks = list.querySelectorAll('[data-vehicle]');
    blocks.forEach(function (block, i) {
      block.querySelector('[data-vehicle-title]').textContent = 'Vehicle ' + (i + 1);
      block.setAttribute('aria-label', 'Vehicle ' + (i + 1));
      block.querySelectorAll('[data-name]').forEach(function (input) {
        var key = input.getAttribute('data-name');
        var id = 'v' + i + '-' + key;
        input.id = id;
        input.name = 'vehicles[' + i + '][' + key + ']';
        var label = input.closest('.field').querySelector('label');
        if (label) label.setAttribute('for', id);
        var err = input.closest('.field').querySelector('.error');
        err.id = id + '-error';
        input.setAttribute('aria-describedby', err.id);
      });
      var remove = block.querySelector('[data-remove]');
      remove.hidden = blocks.length === 1;
      remove.setAttribute('aria-label', 'Remove vehicle ' + (i + 1));
    });
    addBtn.disabled = blocks.length >= MAX_VEHICLES;
    countNote.textContent = blocks.length + (blocks.length === 1 ? ' vehicle added.' : ' vehicles added.') + (blocks.length >= MAX_VEHICLES ? ' For larger fleets, mention the rest in your comments.' : '');
  }

  function addVehicle(focus) {
    var block = template.cloneNode(true);
    block.querySelectorAll('input, select').forEach(function (el) { el.value = ''; });
    block.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-error'); });
    list.appendChild(block);
    renumber();
    if (focus) block.querySelector('[data-name="make"]').focus();
    return block;
  }

  addBtn.addEventListener('click', function () { addVehicle(true); saveDraft(); });
  list.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove]');
    if (!btn) return;
    var block = btn.closest('[data-vehicle]');
    var next = block.nextElementSibling || block.previousElementSibling;
    block.remove();
    renumber();
    saveDraft();
    if (next) next.querySelector('[data-name="make"]').focus();
  });

  // Draft saved in this browser session so nothing is lost on a refresh or error.
  function collect() {
    var data = {};
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (!el.name || el.name === 'website' || el.name === 'startedAt') return;
      if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
      else if (el.type === 'checkbox') { data[el.name] = el.checked ? el.value : ''; }
      else data[el.name] = el.value;
    });
    var vehicles = [];
    list.querySelectorAll('[data-vehicle]').forEach(function (block) {
      var v = {};
      block.querySelectorAll('[data-name]').forEach(function (el) { v[el.getAttribute('data-name')] = el.value.trim(); });
      vehicles.push(v);
    });
    Object.keys(data).forEach(function (k) { if (k.indexOf('vehicles[') === 0) delete data[k]; });
    data.vehicles = vehicles;
    return data;
  }

  function saveDraft() {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(collect())); } catch (e) { /* storage unavailable */ }
  }

  function restoreDraft() {
    var data;
    try { data = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { data = null; }
    if (!data) return;
    (data.vehicles || []).forEach(function (v, i) {
      var block = list.querySelectorAll('[data-vehicle]')[i] || addVehicle(false);
      Object.keys(v).forEach(function (k) {
        var el = block.querySelector('[data-name="' + k + '"]');
        if (el) el.value = v[k];
      });
    });
    Object.keys(data).forEach(function (name) {
      if (name === 'vehicles') return;
      var els = form.querySelectorAll('[name="' + name + '"]');
      els.forEach(function (el) {
        if (el.type === 'radio') el.checked = el.value === data[name];
        else if (el.type === 'checkbox') el.checked = data[name] === el.value;
        else el.value = data[name];
      });
    });
  }

  renumber();
  restoreDraft();
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);

  function fieldFor(key) {
    var m = key.match(/^vehicles\.(\d+)\.(\w+)$/);
    if (m) {
      var block = list.querySelectorAll('[data-vehicle]')[Number(m[1])];
      return block ? block.querySelector('[data-name="' + m[2] + '"]') : null;
    }
    return form.querySelector('[name="' + key + '"]');
  }

  function clearErrors() {
    form.querySelectorAll('.field.has-error').forEach(function (f) { f.classList.remove('has-error'); });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    alertBox.classList.remove('show');
    alertBox.innerHTML = '';
  }

  function showErrors(errors, message) {
    var keys = Object.keys(errors);
    var items = [];
    var first = null;
    keys.forEach(function (key) {
      var el = fieldFor(key);
      if (!el) { items.push('<li>' + escapeHtml(errors[key]) + '</li>'); return; }
      var field = el.closest('.field');
      field.classList.add('has-error');
      var err = field.querySelector('.error');
      if (err) err.textContent = errors[key];
      if (el.type !== 'radio' && el.type !== 'checkbox') el.setAttribute('aria-invalid', 'true');
      var id = el.id || (field.querySelector('input') || {}).id;
      items.push('<li><a href="#' + id + '">' + escapeHtml(errors[key]) + '</a></li>');
      if (!first) first = el;
    });
    alertBox.innerHTML = '<strong>' + escapeHtml(message || 'Please check the highlighted fields.') + '</strong>' + (items.length ? '<ul>' + items.join('') + '</ul>' : '');
    alertBox.classList.add('show');
    alertBox.focus();
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showMessage(message) {
    alertBox.innerHTML = '<strong>' + escapeHtml(message) + '</strong>';
    alertBox.classList.add('show');
    alertBox.focus();
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function validate(d) {
    var e = {};
    var need = function (k, msg) { if (!String(d[k] || '').trim()) e[k] = msg; };
    need('companyName', 'Please enter your taxi company or trading name.');
    need('contactName', 'Please enter the main contact name.');
    if (!d.email.trim()) e.email = 'Please enter a contact email address.';
    else if (!EMAIL_RE.test(d.email.trim())) e.email = 'Please enter a valid email address, like name@example.co.uk.';
    if (!d.phone.trim()) e.phone = 'Please enter a contact telephone number.';
    else if (!phoneOk(d.phone)) e.phone = 'Please enter a valid UK phone number, like 07700 900123.';
    if (!d.postcode.trim()) e.postcode = 'Please enter your business postcode.';
    else if (!POSTCODE_RE.test(d.postcode.trim())) e.postcode = 'Please enter a valid UK postcode, like EX23 8LG.';
    need('area', 'Please enter your main operating town or area.');
    need('licensingAuthority', 'Please enter your licensing authority.');
    if (!d.licenceType) e.licenceType = 'Please choose Hackney Carriage, Private Hire or Both.';
    var total = Number(d.totalVehicles);
    if (!Number.isInteger(total) || total < 1 || total > 500) e.totalVehicles = 'Please enter the total number of vehicles (1–500).';
    else if (d.vehicles.length > total) e.totalVehicles = "You've added " + d.vehicles.length + ' vehicles — please check the fleet total.';
    d.vehicles.forEach(function (v, i) {
      var p = 'vehicles.' + i + '.';
      if (!v.make) e[p + 'make'] = 'Please enter the vehicle make.';
      if (!v.model) e[p + 'model'] = 'Please enter the vehicle model.';
      if (v.registration && !REG_RE.test(v.registration)) e[p + 'registration'] = 'Registration can only contain letters, numbers and spaces.';
      if (!v.type) e[p + 'type'] = 'Please choose a vehicle type.';
      var seats = Number(v.seats);
      if (!Number.isInteger(seats) || seats < 1 || seats > 16) e[p + 'seats'] = 'Please enter passenger seats (1–16).';
      if (!v.luggage) e[p + 'luggage'] = 'Please choose a luggage capacity.';
      if (!v.licenceCategory) e[p + 'licenceCategory'] = 'Please choose a licensing category.';
    });
    need('currentBooking', 'Please tell us how you currently take bookings.');
    need('operatingAreas', 'Please tell us the areas you usually cover.');
    if (!d.interestLocal) e.interestLocal = 'Please choose an option.';
    if (!d.interestLong) e.interestLong = 'Please choose an option.';
    if (d.privacyAck !== 'yes') e.privacyAck = 'Please confirm you have read the Privacy Policy.';
    if (d.contactConsent !== 'yes') e.contactConsent = 'Please agree to us contacting you about this enquiry.';
    return e;
  }

  var sending = false;
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (sending) return;
    clearErrors();
    var data = collect();
    var errors = validate(data);
    if (Object.keys(errors).length) { showErrors(errors); return; }

    data.website = form.querySelector('[name="website"]').value;
    data.startedAt = document.getElementById('startedAt').value;
    sending = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.querySelector('[data-label]').textContent = 'SENDING…';

    var controller = 'AbortController' in window ? new AbortController() : null;
    var timeout = window.setTimeout(function () { if (controller) controller.abort(); }, 25000);

    fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
      signal: controller ? controller.signal : undefined,
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().catch(function () { return { ok: false, message: 'Unexpected response from the server.' }; }).then(function (body) { return { status: res.status, body: body }; });
    }).then(function (r) {
      if (r.body && r.body.ok) {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
        form.hidden = true;
        document.getElementById('join-ref').textContent = 'Reference: ' + r.body.reference;
        document.getElementById('join-ack').textContent = r.body.acknowledgement === 'sent'
          ? 'We have also emailed a confirmation to ' + data.email + '.'
          : 'Please keep your reference. If you need to add anything, email driver@whydrive.co.uk.';
        success.hidden = false;
        success.focus();
        success.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (r.body && r.body.errors) showErrors(r.body.errors, r.body.message);
      else showMessage((r.body && r.body.message) || 'Sorry — we could not send your enquiry. Your details are still on the form. Please try again, or email driver@whydrive.co.uk.');
    }).catch(function () {
      showMessage('We could not reach the server. Please check your connection and try again — your details are still on the form. You can also email driver@whydrive.co.uk.');
    }).then(function () {
      window.clearTimeout(timeout);
      sending = false;
      submitBtn.removeAttribute('aria-busy');
      submitBtn.querySelector('[data-label]').textContent = 'SEND ENQUIRY TO WHYDRIVE';
    });
  });
})();

/* I-way public site behaviour. No dependencies, no cookies. See docs/CONVERSION_EVENTS.md for the event contract. */
(function () {
  'use strict';
  var CFG = window.IWAY_CONFIG || {};
  var AN = CFG.analytics || {};

  /* ---------- Conversion events (no PII, ever) ---------- */
  function track(name, props) {
    if (AN.enabled === false) return;
    var evt = { event: name, page: location.pathname.split('/').pop() || 'index.html' };
    for (var k in (props || {})) evt[k] = props[k];
    (window.dataLayer = window.dataLayer || []).push(evt);
    try { document.dispatchEvent(new CustomEvent('iway:track', { detail: evt })); } catch (e) {}
    if (AN.debug && CFG.env !== 'production' && window.console) console.debug('[iway:track]', evt);
  }
  window.iwayTrack = track;

  /* ---------- Navigation toggle ---------- */
  var toggle = document.querySelector('.nav-toggle'), nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.setAttribute('data-open', open ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      toggle.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
    };
    toggle.addEventListener('click', function () { setOpen(nav.getAttribute('data-open') !== 'true'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); toggle.focus(); } });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  }

  /* ---------- CTA + nav click tracking ---------- */
  document.addEventListener('click', function (e) {
    var cta = e.target.closest('[data-cta]');
    if (cta) track('cta_click', { cta_id: cta.getAttribute('data-cta'), location: cta.getAttribute('data-loc') || 'unknown' });
    var n = e.target.closest('[data-track="nav"]');
    if (n) track('nav_click', { target: (n.getAttribute('href') || '').split('#')[1] || '' });
  });

  /* ---------- FAQ tracking ---------- */
  document.querySelectorAll('.faq details').forEach(function (d, i) {
    d.addEventListener('toggle', function () { if (d.open) track('faq_toggle', { question_index: i + 1 }); });
  });

  /* ---------- Section views + reveal ---------- */
  if ('IntersectionObserver' in window) {
    var seen = {};
    var secObs = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting && !seen[en.target.id]) { seen[en.target.id] = 1; track('section_view', { section: en.target.id }); }
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('main section[id]').forEach(function (s) { secObs.observe(s); });
    var revObs = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); revObs.unobserve(en.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { revObs.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Sign-in chooser ---------- */
  var portalEls = document.querySelectorAll('[data-portal]');
  if (portalEls.length) {
    var anyLive = false;
    portalEls.forEach(function (a) {
      var url = (CFG.portals || {})[a.getAttribute('data-portal')];
      if (url) { a.setAttribute('href', url); anyLive = true; }
      else {
        a.setAttribute('aria-disabled', 'true');
        a.querySelector('.go').textContent = 'Not open yet';
        a.addEventListener('click', function (e) { e.preventDefault(); track('signin_portal_select', { portal: a.getAttribute('data-portal'), available: false }); var s = document.getElementById('signin-status'); if (s) { s.hidden = false; s.focus && s.setAttribute('tabindex', '-1'); s.focus(); } });
        return;
      }
      a.addEventListener('click', function () { track('signin_portal_select', { portal: a.getAttribute('data-portal'), available: true }); });
    });
  }

  /* ---------- Contact page ---------- */
  var ce = document.getElementById('contact-email');
  if (ce && CFG.supportEmail) {
    ce.textContent = CFG.supportEmail; ce.href = 'mailto:' + CFG.supportEmail;
    document.getElementById('contact-email-block').hidden = false;
    document.getElementById('contact-fallback').hidden = true;
  }

  /* ---------- Early access form ---------- */
  var form = document.getElementById('ea-form');
  if (form) {
    var DRAFT = 'iway.ea.draft';
    var errBox = document.getElementById('form-error'), errText = document.getElementById('form-error-text');
    var submit = document.getElementById('ea-submit'), label = document.getElementById('ea-submit-label');
    var okPanel = document.getElementById('ea-success'), step1 = document.getElementById('step-1'), step2 = document.getElementById('step-2');
    var started = false, isPreview = !CFG.earlyAccessEndpoint;
    if (isPreview) document.getElementById('preview-banner').hidden = false;

    // Preview inputs stay in the form only; clear any draft left by an older build.
    if (isPreview) { try { sessionStorage.removeItem(DRAFT); } catch (e) {} }
    // A configured live form may recover a draft within the same browser session.
    try {
      var saved = isPreview ? {} : JSON.parse(sessionStorage.getItem(DRAFT) || '{}');
      Object.keys(saved).forEach(function (k) { if (form.elements[k] && !form.elements[k].value) form.elements[k].value = saved[k]; });
    } catch (e) {}
    function saveDraft() { if (isPreview) return; try { var o = {}; ['name', 'email', 'company', 'role', 'notes'].forEach(function (k) { o[k] = form.elements[k].value; }); sessionStorage.setItem(DRAFT, JSON.stringify(o)); } catch (e) {} }
    form.addEventListener('input', function () { if (!started) { started = true; track('signup_form_start', { form: 'early_access' }); } saveDraft(); });

    function setErr(name, bad) {
      var f = form.querySelector('[data-field="' + name + '"]'); if (!f) return;
      f.classList.toggle('invalid', bad);
      var inp = f.querySelector('input,select,textarea'); if (inp) inp.setAttribute('aria-invalid', bad ? 'true' : 'false');
    }
    function validate() {
      var bad = [];
      var n = form.elements.name.value.trim(), em = form.elements.email.value.trim();
      var okName = n.length > 0, okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
      setErr('name', !okName); setErr('email', !okEmail);
      if (!okName) bad.push('name'); if (!okEmail) bad.push('email');
      return bad;
    }
    form.addEventListener('focusout', function (e) { if (e.target.name === 'email' && e.target.value) setErr('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.target.value.trim())); });

    function showSuccess(preview) {
      form.hidden = true; errBox.hidden = true;
      document.getElementById('preview-banner').hidden = true;
      document.getElementById('ea-name').textContent = form.elements.name.value.trim().split(' ')[0];
      document.getElementById('ea-email').textContent = form.elements.email.value.trim();
      document.getElementById('ea-success-ok').hidden = !!preview;
      document.getElementById('ea-success-preview').hidden = !preview;
      okPanel.hidden = false; step1.classList.add('done'); step1.removeAttribute('aria-current'); step2.setAttribute('aria-current', 'step');
      okPanel.focus();
    }
    document.getElementById('ea-edit').addEventListener('click', function () {
      okPanel.hidden = true; form.hidden = false; step2.removeAttribute('aria-current'); step1.classList.remove('done'); step1.setAttribute('aria-current', 'step');
      if (isPreview) document.getElementById('preview-banner').hidden = false;
      form.elements.name.focus();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault(); errBox.hidden = true;
      var bad = validate();
      if (bad.length) { bad.forEach(function (b) { track('signup_field_error', { field: b }); }); form.elements[bad[0]].focus(); return; }
      track('signup_submit', { form: 'early_access', role: form.elements.role.value || 'unspecified' });
      submit.setAttribute('data-loading', 'true'); submit.disabled = true; label.textContent = 'Sending…';
      var done = function () { submit.removeAttribute('data-loading'); submit.disabled = false; label.textContent = 'Get Started'; };

      if (isPreview) { // Honest preview mode: nothing is transmitted.
        setTimeout(function () { done(); track('signup_success', { form: 'early_access', mode: 'preview' }); showSuccess(true); }, 500);
        return;
      }
      var payload = { name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), company: form.elements.company.value.trim(), role: form.elements.role.value, notes: form.elements.notes.value.trim(), source: 'website' };
      var ctl = ('AbortController' in window) ? new AbortController() : null; var t = setTimeout(function () { ctl && ctl.abort(); }, 12000);
      fetch(CFG.earlyAccessEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http_' + r.status); done(); track('signup_success', { form: 'early_access', mode: 'live' }); try { sessionStorage.removeItem(DRAFT); } catch (e) {} showSuccess(false); })
        .catch(function (err) { clearTimeout(t); done(); track('signup_error', { form: 'early_access', reason: String(err && err.message || 'network').slice(0, 24) }); errText.textContent = 'We couldn’t send that just now. Your details are still here. Please try again.'; errBox.hidden = false; errBox.scrollIntoView({ block: 'nearest' }); });
    });
  }
})();

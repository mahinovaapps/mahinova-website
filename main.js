document.documentElement.classList.add('js');

// Installable app: offline support, and on phones a bar that offers to install it
// (Chrome, Edge and Samsung Internet). The bar can be closed for a week.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
}
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  var closed = 0;
  try { closed = Number(localStorage.getItem('installClosed') || 0); } catch (err) { /* ignore */ }
  if (!window.matchMedia('(max-width: 760px)').matches || Date.now() - closed < 7 * 864e5 || document.querySelector('.install-bar')) return;
  var label = { bn: 'অ্যাপ ইনস্টল', hi: 'ऐप इंस्टॉल' }[document.documentElement.lang] || 'Install app';
  var icon = document.querySelector('link[rel="apple-touch-icon"]').href.replace('icon-512', 'icon-192');
  var bar = document.createElement('div');
  bar.className = 'install-bar';
  bar.innerHTML = '<img src="' + icon + '" alt="" width="40" height="40"><strong>mahinova</strong>' +
    '<button type="button" class="install-go">' + label + '</button><button type="button" class="install-x" aria-label="Close">✕</button>';
  bar.querySelector('.install-go').addEventListener('click', function () {
    e.prompt();
    e.userChoice.then(function () { bar.remove(); });
  });
  bar.querySelector('.install-x').addEventListener('click', function () {
    try { localStorage.setItem('installClosed', String(Date.now())); } catch (err) { /* ignore */ }
    bar.remove();
  });
  document.body.appendChild(bar);
});

document.addEventListener('DOMContentLoaded', function () {
  // Mobile menu
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  // Enquiry form: there is no server, so the form opens WhatsApp or email
  // with the details already written in.
  var form = document.getElementById('enquiry-form');
  if (!form) return;

  var WHATSAPP = '917797923329';
  var EMAIL = 'hello@mahinova.in';
  var error = document.getElementById('form-error');

  function buildMessage() {
    var data = new FormData(form);
    var lines = ['Hi mahinova, I have a project enquiry.', ''];
    lines.push('Name: ' + data.get('name'));
    if (data.get('phone')) lines.push('Phone: ' + data.get('phone'));
    lines.push('Project: ' + data.get('project'));
    if (data.get('budget')) lines.push('Budget: ' + data.get('budget'));
    lines.push('', data.get('message'));
    return lines.join('\n');
  }

  function send(channel) {
    if (!form.checkValidity()) {
      form.reportValidity();
      if (error) error.hidden = false;
      return;
    }
    if (error) error.hidden = true;
    var text = buildMessage();
    if (channel === 'whatsapp') {
      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    } else {
      var subject = 'Project enquiry from ' + new FormData(form).get('name');
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    send(event.submitter && event.submitter.value === 'email' ? 'email' : 'whatsapp');
  });
});

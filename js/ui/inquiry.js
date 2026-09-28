import { submitInquiry } from '../lib/api.js';
import { h, render } from '../lib/dom.js';

let uid = 0;

/** Request-information form → lib/api.js submitInquiry(). */
export function createInquiryForm(apt, onBack) {
  const id = `inq-${++uid}`;
  const root = h('div');
  const field = (name, label, type = 'text', autocomplete) =>
    h('div', { className: 'field', 'data-field': name }, h('label', { for: `${id}-${name}` }, label), h('input', { id: `${id}-${name}`, name, type, autocomplete }));

  const setError = (name, message) => {
    const wrap = form.querySelector(`[data-field="${name}"]`);
    wrap.querySelector('.field__error')?.remove();
    const input = wrap.querySelector('input');
    if (message) {
      wrap.setAttribute('data-invalid', '');
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${id}-${name}-err`);
      wrap.append(h('span', { className: 'field__error', id: `${id}-${name}-err` }, message));
    } else {
      wrap.removeAttribute('data-invalid');
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  };

  const submit = h('button', { type: 'submit', className: 'btn btn--solid' }, 'Send request');
  const status = h('p', { className: 'field__error', hidden: true });
  const message = h('textarea', { id: `${id}-message`, name: 'message', rows: 3 });
  message.value = `I'm interested in Apartment ${apt.number}, Floor ${apt.floor}.`;

  const form = h(
    'form',
    {
      className: 'inquiry',
      novalidate: true,
      'aria-label': `Request information about apartment ${apt.number}`,
      onSubmit: async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const v = Object.fromEntries(['name', 'email', 'phone', 'message'].map((k) => [k, String(data.get(k) ?? '').trim()]));
        const nameErr = v.name ? null : 'Please enter your name';
        const phoneErr = v.phone || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ? null : 'Please enter a phone number or a valid email';
        setError('name', nameErr);
        setError('phone', phoneErr);
        if (nameErr || phoneErr) return;
        submit.disabled = true;
        submit.textContent = 'Sending…';
        status.hidden = true;
        try {
          const result = await submitInquiry({ apartmentId: apt.id, ...v });
          render(
            root,
            h(
              'div',
              { className: 'inquiry inquiry--sent', role: 'status' },
              h('p', { className: 'eyebrow' }, 'Request received'),
              h('p', { className: 'inquiry__lead' }, `Thank you. A sales advisor will contact you about Apartment ${apt.number} shortly.`),
              h('p', { className: 'inquiry__ref' }, `Reference ${result.reference}`),
              h('button', { type: 'button', className: 'btn btn--ghost', onClick: onBack }, 'Back to apartment'),
            ),
          );
        } catch {
          status.textContent = 'Something went wrong. Please try again or call the hotline.';
          status.hidden = false;
          submit.disabled = false;
          submit.textContent = 'Send request';
        }
      },
    },
    h('p', { className: 'eyebrow' }, 'Request information'),
    field('name', 'Full name', 'text', 'name'),
    field('phone', 'Phone', 'tel', 'tel'),
    field('email', 'Email (optional)', 'email', 'email'),
    h('div', { className: 'field' }, h('label', { for: `${id}-message` }, 'Message (optional)'), message),
    status,
    h('div', { className: 'details__actions' }, h('button', { type: 'button', className: 'btn btn--ghost', onClick: onBack }, 'Cancel'), submit),
  );
  root.append(form);
  return root;
}

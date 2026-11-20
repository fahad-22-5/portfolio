import React, { useState } from 'react';
import useReveal from '../useReveal';
import { profile } from '../data';

// Web3Forms access keys are public by design (they can only deliver to the owner's inbox).
const WEB3FORMS_ACCESS_KEY = '7362192a-fc0a-4a07-b6ee-0d3c3feefc64';

export default function Contact() {
  const ref = useReveal();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          ...form,
          subject: `New Portfolio Message from ${form.name}`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStatus('sent');
        setForm({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <section className="contact" id="contact" ref={ref}>
      <div className="container contact__grid">
        <div className="contact__intro reveal">
          <p className="caption"><span>Chapter 05</span><span>Dispatch</span></p>
          <h2 className="contact__title">Let's ship something.</h2>
          <p className="contact__lede">
            Got a project, a role, or a gnarly throughput problem? Send it over.
          </p>
          <ul className="contact__links">
            <li>
              <a href={`mailto:${profile.email}`}>
                <span className="mono">Email</span>
                {profile.email}
              </a>
            </li>
            <li>
              <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">
                <span className="mono">LinkedIn</span>
                {profile.linkedinHandle} ↗
              </a>
            </li>
          </ul>
        </div>

        <form className="form reveal" onSubmit={handleSubmit}>
          <span className="sfx sfx--form" aria-hidden="true">Ping!</span>
          <div className="form__head">
            <span className="badge badge--cyan">Incoming transmission</span>
            <span className="shift__order">To: FEH</span>
          </div>
          <label className="field">
            <span className="mono">Name</span>
            <input type="text" value={form.name} onChange={update('name')} placeholder="Your name" required autoComplete="name" />
          </label>
          <label className="field">
            <span className="mono">Email</span>
            <input type="email" value={form.email} onChange={update('email')} placeholder="you@company.com" required autoComplete="email" />
          </label>
          <label className="field">
            <span className="mono">Message</span>
            <textarea rows="5" value={form.message} onChange={update('message')} placeholder="Hey Fahad, let's build something…" required />
          </label>
          <button type="submit" className="btn btn--primary btn--block" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
          <p className="form__status mono" role="status" aria-live="polite">
            {status === 'sent' && '✓ Delivered. Thanks, I will be in touch soon.'}
            {status === 'error' && 'Something went wrong. Try again, or email me directly.'}
          </p>
        </form>
      </div>
    </section>
  );
}

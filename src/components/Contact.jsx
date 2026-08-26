import React, { useEffect, useRef, useState } from 'react';
import './Contact.css';

const WEB3FORMS_ACCESS_KEY = "7362192a-fc0a-4a07-b6ee-0d3c3feefc64";

function Contact() {
  const sectionRef = useRef(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll('.reveal').forEach((el) => {
              el.classList.add('visible');
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !msg) return;

    setSending(true);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          name: name,
          email: email,
          message: msg,
          subject: `New Portfolio Message from ${name}`,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSent(true);
        setName('');
        setEmail('');
        setMsg('');
        setTimeout(() => setSent(false), 4000);
      } else {
        alert("Something went wrong. Please try again.");
      }
    } catch (error) {
      alert("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="contact noise-bg" id="contact" ref={sectionRef}>
      <div className="contact-container section-container">
        
        <div className="contact-content">
          {/* Form */}
          <form className="contact-form brutal-card reveal" onSubmit={handleSubmit} style={{ '--card-color': 'var(--max-neon-blue)', transform: 'rotate(-1deg)' }}>
            <h2 className="contact-title">PING ME</h2>
            
            <div className="contact-field">
              <label className="contact-label" htmlFor="contact-name">WHO</label>
              <input
                id="contact-name"
                className="contact-input"
                type="text"
                placeholder="YOUR NAME"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="contact-field">
              <label className="contact-label" htmlFor="contact-email">WHERE</label>
              <input
                id="contact-email"
                className="contact-input"
                type="email"
                placeholder="YOUR EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="contact-field">
              <label className="contact-label" htmlFor="contact-msg">WHAT</label>
              <textarea
                id="contact-msg"
                className="contact-input contact-textarea"
                placeholder="YOUR MESSAGE"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows="5"
                required
              />
            </div>

            <button
              type="submit"
              className="max-btn max-btn-primary"
              disabled={sending}
              style={{ width: '100%', marginTop: '1rem', border: '3px solid var(--max-black)' }}
            >
              {sending ? 'SENDING...' : sent ? 'SENT!' : 'SEND MESSAGE'}
            </button>
          </form>

          {/* Socials */}
          <div className="contact-socials reveal">
            <h3 className="contact-socials-title">OR STALK ME</h3>

            <div className="contact-social-cards">
              <a
                href="mailto:eqbalfahad@gmail.com"
                className="contact-social-card brutal-card"
                target="_blank"
                rel="noopener noreferrer"
                style={{ '--card-color': 'var(--max-neon-pink)', padding: '1.5rem', transform: 'rotate(1deg)' }}
              >
                <span className="contact-social-icon">✉</span>
                <div>
                  <p className="contact-social-label">EMAIL</p>
                  <p className="contact-social-value">eqbalfahad@gmail.com</p>
                </div>
              </a>

              <a
                href="https://www.linkedin.com/in/fahadeqbalhashmi"
                className="contact-social-card brutal-card"
                target="_blank"
                rel="noopener noreferrer"
                style={{ '--card-color': 'var(--max-neon-yellow)', padding: '1.5rem', transform: 'rotate(-1deg)' }}
              >
                <span className="contact-social-icon">IN</span>
                <div>
                  <p className="contact-social-label">LINKEDIN</p>
                  <p className="contact-social-value">fahadeqbalhashmi</p>
                </div>
              </a>

              <a
                href="tel:+917250864992"
                className="contact-social-card brutal-card"
                style={{ '--card-color': 'var(--max-neon-green)', padding: '1.5rem', transform: 'rotate(1deg)' }}
              >
                <span className="contact-social-icon">☎</span>
                <div>
                  <p className="contact-social-label">PHONE</p>
                  <p className="contact-social-value">+91 7250864992</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Contact;

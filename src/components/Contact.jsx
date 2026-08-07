import React, { useEffect, useRef, useState } from 'react';
import './Contact.css';
// Web3Forms API Key goes here
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

    if (WEB3FORMS_ACCESS_KEY === "YOUR_ACCESS_KEY_HERE") {
      alert("Please configure your Web3Forms access key first!");
      return;
    }

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
    <section className="contact" id="contact" ref={sectionRef}>
      <div className="contact__container section-container">
        <div className="contact__header reveal">
          <h2 className="contact__title comic-heading">
            <span className="contact__title-accent">Get In</span> Touch!
          </h2>
          <div className="contact__title-line"></div>
          <p className="contact__subtitle">
            Got a project in mind, want to collaborate, or just want to say hey? Drop me a message!
          </p>
        </div>

        <div className="contact__content">
          {/* Form */}
          <form className="contact__form reveal" onSubmit={handleSubmit}>
            <div className="contact__field">
              <label className="contact__label" htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                className="contact__input"
                type="text"
                placeholder="Peter Parker"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="contact__field">
              <label className="contact__label" htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                className="contact__input"
                type="email"
                placeholder="spider@verse.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="contact__field">
              <label className="contact__label" htmlFor="contact-msg">Message</label>
              <textarea
                id="contact-msg"
                className="contact__input contact__textarea"
                placeholder="Hey Fahad, let's build something amazing..."
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows="5"
                required
              />
            </div>

            <button
              type="submit"
              className="hero__btn hero__btn--primary"
              disabled={sending}
              style={{ width: '100%', marginTop: '1rem', border: '3px solid #000' }}
            >
              {sending ? 'SENDING...' : sent ? 'SENT!' : 'SEND MESSAGE'}
            </button>
          </form>

          {/* Socials */}
          <div className="contact__socials reveal">
            <h3 className="contact__socials-title comic-heading">Or Find Me At</h3>

            <div className="contact__social-cards">
              <a
                href="mailto:eqbalfahad@gmail.com"
                className="contact__social-card"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="contact__social-icon">✉</span>
                <div>
                  <p className="contact__social-label">Email</p>
                  <p className="contact__social-value">eqbalfahad@gmail.com</p>
                </div>
              </a>

              <a
                href="https://www.linkedin.com/in/fahadeqbalhashmi"
                className="contact__social-card"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="contact__social-icon">in</span>
                <div>
                  <p className="contact__social-label">LinkedIn</p>
                  <p className="contact__social-value">fahadeqbalhashmi</p>
                </div>
              </a>

              <a
                href="tel:+917250864992"
                className="contact__social-card"
              >
                <span className="contact__social-icon">☎</span>
                <div>
                  <p className="contact__social-label">Phone</p>
                  <p className="contact__social-value">+91 7250864992</p>
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

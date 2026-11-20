import React, { useEffect, useState } from 'react';
import { profile } from '../data';

const links = [
  { id: 'work', label: 'Work' },
  { id: 'skills', label: 'Skills' },
  { id: 'research', label: 'Research' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

function istTime() {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

function readTheme() {
  try {
    return localStorage.getItem('theme');
  } catch (e) {
    return null;
  }
}

export default function Nav() {
  const [time, setTime] = useState(istTime);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('');
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const t = setInterval(() => setTime(istTime()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      let current = '';
      links.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) current = id;
      });
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const toggleTheme = () => {
    const isDark = theme
      ? theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      /* storage unavailable */
    }
  };

  return (
    <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`} aria-label="Primary">
      <div className="nav__inner container">
        <a href="#top" className="nav__brand" onClick={() => setOpen(false)}>
          <span className="nav__mark" aria-hidden="true">{profile.short}</span>
          <span className="nav__name">{profile.name}</span>
        </a>

        <ul className={`nav__links ${open ? 'nav__links--open' : ''}`}>
          {links.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                className={active === l.id ? 'is-active' : ''}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="nav__tools">
          <span className="nav__clock mono" title="Local time in Noida">
            <span className="dot dot--live" aria-hidden="true" /> Noida {time} IST
          </span>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle colour theme">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="icon-btn nav__burger"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              {open
                ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
                : <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="2" />}
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

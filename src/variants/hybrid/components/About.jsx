import React from 'react';
import SectionHead from './SectionHead';
import Barcode from './Barcode';
import useReveal from '../useReveal';
import { highlights, education, offShift } from '../data';

const colors = ['amber', 'red', 'cyan', 'purple'];

export default function About() {
  const ref = useReveal();
  return (
    <section className="section section--alt halftone" id="about" ref={ref}>
      <div className="container">
        <SectionHead index="04" label="The person behind the packets" title="Hi, I'm Fahad." />

        <div className="about">
          <figure className="about__portrait idcard reveal" aria-label="Staff badge">
            <div className="idcard__card">
              <div className="idcard__top">
                <span>Staff badge</span>
                <span>Falcon Autotech</span>
              </div>
              <div className="idcard__mono" aria-hidden="true">FEH</div>
              <p className="idcard__name">Fahad Eqbal Hashmi</p>
              <p className="idcard__role">Software Engineer · Noida, India</p>
              <div className="idcard__code"><Barcode value="FAHAD-EQBAL-HASHMI" height={40} /></div>
            </div>
            <figcaption className="caption caption--small"><span>Engineer by day, comic-book nerd by night.</span></figcaption>
          </figure>

          <div className="about__body reveal">
            <p className="about__intro bubble">
              Ok, let's do this one last time! My name is <strong>Fahad Eqbal Hashmi</strong>. I'm a
              backend-focused software engineer with 2.5 years of real-world experience building
              high-throughput, critical backend systems in <strong>.NET/C#</strong>.
            </p>
            <p>
              Today I architect core sortation services processing over <strong>100,000 parcels a
              day</strong> (peaks of 10,000+ an hour) — PLC communication layers, PTL (Put-to-Light)
              systems, conveyors, RESTful APIs, RabbitMQ and optimised SQL data flows.
            </p>
            <p>
              I don't stop at the merge. I've delivered automation across India and 2+ systems
              internationally for major FMCG/quick-commerce, e-commerce, retail and logistics players —
              and I've usually been there for the go-live: running integration tests and UAT with the
              client's team, training the people who'll use it, and fixing things on the spot when the
              floor shows us something the spec didn't. That includes <strong>2.5 months on-site in
              Madrid</strong>.
            </p>
            <p>
              I also work with AI-assisted workflows — <strong>Claude Code, Antigravity, Cursor and
              Codex</strong> — to ship faster.
            </p>

            <dl className="facts">
              {highlights.map((h, i) => (
                <div key={h.label} className={`cmd cmd--${colors[i]}`}>
                  <dt className="cmd__label"><span>{h.label}</span></dt>
                  <dd className="cmd__sub">{h.detail}</dd>
                </div>
              ))}
            </dl>

            <h3 className="sub caption caption--small"><span>Education</span></h3>
            <ul className="edu">
              {education.map((e) => (
                <li key={e.school}>
                  <span className="mono">{e.period}</span>
                  <div>
                    <p className="edu__school">{e.school}</p>
                    <p className="edu__detail">{e.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="offshift">
          <h3 className="sub caption caption--small reveal"><span>Off shift</span></h3>
          <div className="offshift__grid">
            {offShift.map((f, i) => (
              // Command-card layout from the warehouse game
              <article className={`cmd cmd--${colors[i]} offshift__card reveal`} key={f.title}>
                <div className="cmd__label">
                  <span>Side quest</span>
                  <span className="cmd__badge-sub">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h4 className="cmd__val cmd__val--sm">{f.title}</h4>
                <p className="cmd__sub">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

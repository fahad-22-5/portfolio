import React from 'react';
import SectionHead from './SectionHead';
import Segments from './Segments';
import useReveal from '../useReveal';
import { skillBins, softSkills } from '../data';

const colors = ['amber', 'cyan', 'purple', 'green'];
const maxUnits = Math.max(...skillBins.map((b) => b.skills.length));

// Each skill group is a data-centre rack; each skill is a 1U unit with a status LED.
export default function Skills() {
  const ref = useReveal();
  return (
    <section className="section section--alt" id="skills" ref={ref}>
      <div className="container">
        <SectionHead index="02" label="Inventory" title="What's on the shelves." />
        <div className="racks">
          {skillBins.map((bin, b) => (
            <article className={`rack rack--${colors[b]} reveal`} key={bin.bin}>
              <header className="rack__head">
                <span className="rack__id">Rack {bin.bin}</span>
                <span className="rack__lights" aria-hidden="true"><i /><i /><i /></span>
              </header>
              <h3 className="rack__title">{bin.title}</h3>
              <p className="rack__count">{bin.skills.length} units online</p>
              <ul className="rack__units">
                {bin.skills.map((s, i) => (
                  <li className="rack__unit" key={s} style={{ '--d': `${((i * 0.37 + b * 0.21) % 1.4).toFixed(2)}s` }}>
                    <span className="rack__led" aria-hidden="true" />
                    <span className="rack__name">{s}</span>
                    <span className="rack__u" aria-hidden="true">U{String(i + 1).padStart(2, '0')}</span>
                  </li>
                ))}
              </ul>
              <footer className="rack__foot">
                <span>Load</span>
                <Segments total={maxUnits} done={bin.skills.length} label={`${bin.skills.length} of ${maxUnits} units`} />
              </footer>
            </article>
          ))}
        </div>
        <div className="soft reveal">
          <p className="caption caption--small"><span>Also known for</span></p>
          <ul className="chips">
            {softSkills.map((s) => <li className="chip chip--outline" key={s}>{s}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

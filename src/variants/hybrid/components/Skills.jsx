import React from 'react';
import SectionHead from './SectionHead';
import useReveal from '../useReveal';
import { skillBins, softSkills } from '../data';

// Each skill group is a hardware module; each skill is a status tile.
// Hovering a module brings its tiles online one after another.
export default function Skills() {
  const ref = useReveal();
  return (
    <section className="section section--alt" id="skills" ref={ref}>
      <div className="container">
        <SectionHead index="02" label="Inventory" title="What's on the shelves." />
        <div className="modules">
          {skillBins.map((bin) => (
            <article className="module reveal" key={bin.bin}>
              <header className="module__head">
                <span className="module__tag">MOD-{bin.bin}</span>
                <span className="module__status">
                  <span className="module__pulse" aria-hidden="true" />
                  {bin.skills.length} online
                </span>
              </header>
              <h3 className="module__title">{bin.title}</h3>
              <ul className="module__tiles">
                {bin.skills.map((s, i) => (
                  <li className="tile" key={s} style={{ '--i': i }}>
                    <span className="tile__led" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="soft reveal">
          <span className="soft__label">Also known for</span>
          <ul className="chips">
            {softSkills.map((s) => <li className="chip" key={s}>{s}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

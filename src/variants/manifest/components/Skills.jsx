import React from 'react';
import SectionHead from './SectionHead';
import useReveal from '../useReveal';
import { skillBins, softSkills } from '../data';

export default function Skills() {
  const ref = useReveal();
  return (
    <section className="section section--alt" id="skills" ref={ref}>
      <div className="container">
        <SectionHead index="02" label="Inventory" title="What's on the shelves." />
        <div className="bins">
          {skillBins.map((bin) => (
            <article className="bin reveal" key={bin.bin}>
              <header className="bin__head">
                <span className="bin__code">{bin.bin}</span>
                <div>
                  <h3 className="bin__title">{bin.title}</h3>
                  <p className="mono bin__count">{bin.skills.length} SKUs</p>
                </div>
              </header>
              <ul className="bin__list">
                {bin.skills.map((s, i) => (
                  <li key={s}>
                    <span className="mono">{bin.bin}-{String(i + 1).padStart(2, '0')}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="soft reveal">
          <p className="mono">Also known for</p>
          <ul className="chips">
            {softSkills.map((s) => <li className="chip chip--outline" key={s}>{s}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

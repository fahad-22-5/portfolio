import React from 'react';
import SectionHead from './SectionHead';
import Segments from './Segments';
import useReveal from '../useReveal';
import { skillBins, softSkills } from '../data';

const colors = ['amber', 'cyan', 'purple', 'green'];

export default function Skills() {
  const ref = useReveal();
  return (
    <section className="section section--alt halftone" id="skills" ref={ref}>
      <div className="container">
        <SectionHead index="02" label="Inventory" title="What's on the shelves." />
        <div className="bins">
          {skillBins.map((bin, b) => (
            // Shift-card layout from the warehouse game
            <article className={`shift bin shift--${colors[b]}`} key={bin.bin}>
              <div className="shift__top">
                <span className={`badge badge--${colors[b]}`}>Bin {bin.bin}</span>
                <span className="shift__order">{bin.skills.length} SKUs</span>
              </div>
              <h3 className="shift__title">{bin.title}</h3>
              <ul className="bin__list">
                {bin.skills.map((s, i) => (
                  <li key={s}>
                    <span className="mono">{bin.bin}-{String(i + 1).padStart(2, '0')}</span>
                    {s}
                  </li>
                ))}
              </ul>
              <Segments total={Math.max(...skillBins.map((b) => b.skills.length))} done={bin.skills.length} label={`${bin.skills.length} items`} />
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

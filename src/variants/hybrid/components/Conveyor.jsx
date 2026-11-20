import React from 'react';
import { conveyorItems } from '../data';

function Parcels({ hidden }) {
  return conveyorItems.map((item, i) => (
    <li className="parcel" key={`${hidden ? 'dup-' : ''}${item}`} aria-hidden={hidden || undefined}>
      <span className="mono parcel__id">{String(i + 1).padStart(3, '0')}</span>
      {item}
    </li>
  ));
}

export default function Conveyor() {
  return (
    <div className="conveyor" aria-label="Technologies I work with">
      <div className="conveyor__shift">
        <ul className="conveyor__track">
          <Parcels />
          <Parcels hidden />
        </ul>
      </div>
      <div className="conveyor__belt" aria-hidden="true" />
    </div>
  );
}

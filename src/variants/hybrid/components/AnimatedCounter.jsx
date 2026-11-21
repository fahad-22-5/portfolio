import React, { forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';

// Odometer counter: each digit is a wheel that rolls to its next face.
// Ported from rare-ui's animated-counter (swamimalode07/rare-ui) to plain
// JSX + CSS for this CRA project; styles live under `.ac` in index.css.

const FACES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
// the trailing 0 makes the wrap from 9 back to 0 land on an identical face
const WHEEL = [...FACES, 0];

const LINE = 1.5;
const FADE = `linear-gradient(to bottom,
  rgba(0,0,0,0) 0%,
  rgba(0,0,0,0.06) 5.5%,
  rgba(0,0,0,0.5) 11%,
  rgba(0,0,0,0.94) 16.5%,
  #000 22%,
  #000 78%,
  rgba(0,0,0,0.94) 83.5%,
  rgba(0,0,0,0.5) 89%,
  rgba(0,0,0,0.06) 94.5%,
  rgba(0,0,0,0) 100%)`;

const EASE = [0.22, 1, 0.36, 1];
const BOUNCE = 0.18;
const LEAVE = { duration: 0.18, ease: EASE };
const INSTANT = { duration: 0 };
const spring = (duration) => ({ type: 'spring', visualDuration: duration, bounce: BOUNCE });

const MAX_DECIMALS = 15;
const MAX_PAD = 24;

const mod = (n, m) => ((n % m) + m) % m;
const clamp = (n, low, high) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
const isDigit = (c) => c >= '0' && c <= '9';

const SIZER = FACES.map((face) => (
  <span key={face} aria-hidden="true" className="ac__sizer">{face}</span>
));
const STACK = WHEEL.map((face, i) => (
  <span key={i} className="ac__face" style={{ height: `${LINE}em` }}>{face}</span>
));

const EVERY_THREE = /\B(?=(\d{3})+(?!\d))/g;
const EVERY_TWO = /\B(?=(\d{2})+(?!\d))/g;

function group(whole, separator, grouping) {
  if (!separator) return whole;
  if (grouping !== 'indian') return whole.replace(EVERY_THREE, separator);
  const head = whole.slice(0, -3);
  if (!head) return whole;
  return `${head.replace(EVERY_TWO, separator)}${separator}${whole.slice(-3)}`;
}

function measure(value, decimals, padStart, duration) {
  const amount = Number.isFinite(value) ? value : 0;
  const places = clamp(Math.trunc(decimals), 0, MAX_DECIMALS);
  const pad = clamp(Math.trunc(padStart), 1, MAX_PAD);
  const scaled = Math.min(Number.MAX_SAFE_INTEGER, Math.round(Math.abs(amount) * 10 ** places));
  return {
    amount,
    scaled,
    places,
    pace: clamp(duration, 0.01, 60),
    width: Math.max(String(scaled).length, places + pad),
  };
}

function format({ scaled, places, width }, separator, decimalSeparator, grouping) {
  const raw = String(scaled).padStart(width, '0');
  const whole = group(raw.slice(0, raw.length - places) || '0', separator, grouping);
  return places ? `${whole}${decimalSeparator}${raw.slice(raw.length - places)}` : whole;
}

// keyed by distance from the right, so gaining a place moves columns rather than remounting them
function toCells(chars, width) {
  const cells = [];
  let seen = 0;
  let run = 0;
  for (const char of chars) {
    if (isDigit(char)) {
      run = 0;
      cells.push({ kind: 'digit', key: width - seen++, digit: Number(char) });
    } else {
      cells.push({ kind: 'mark', key: `mark-${width - seen}-${run++}`, char });
    }
  }
  return cells;
}

function useWheel(from, digit, dir, duration, reduced) {
  const pos = useMotionValue(from);
  const goal = useRef(from);
  const heading = useRef(dir);
  useEffect(() => { heading.current = dir; }, [dir]);

  useEffect(() => {
    if (reduced) {
      goal.current = digit;
      pos.set(digit);
      return undefined;
    }
    if (mod(goal.current, 10) !== digit) {
      const at = pos.get();
      goal.current = heading.current < 0 ? at - mod(at - digit, 10) : at + mod(digit - at, 10);
    }
    const roll = animate(pos, goal.current, spring(duration));
    return () => roll.stop();
  }, [digit, duration, reduced, pos]);

  return useTransform(pos, (p) => `${(-mod(p, 10) * 100) / WHEEL.length}%`);
}

const shifts = ({ reduced, dep, shift }) => ({ layout: !reduced, layoutDependency: dep, transition: shift });
const fades = (reduced) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: reduced ? INSTANT : LEAVE },
});

function Fixed({ children, reduced, dep, shift }) {
  return <motion.span {...shifts({ reduced, dep, shift })} className="ac__fixed">{children}</motion.span>;
}

const Mark = forwardRef(function Mark({ char, reduced, dep, shift }, ref) {
  return (
    <motion.span ref={ref} {...shifts({ reduced, dep, shift })} {...fades(reduced)} className="ac__fixed">
      {char}
    </motion.span>
  );
});

const Digit = memo(forwardRef(function Digit({ digit, from, dir, duration, reduced, dep, shift }, ref) {
  const y = useWheel(from, digit, dir, duration, reduced);
  return (
    <motion.span
      ref={ref}
      {...shifts({ reduced, dep, shift })}
      {...fades(reduced)}
      className="ac__digit"
      style={{ height: `${LINE}em`, lineHeight: LINE, maskImage: FADE, WebkitMaskImage: FADE }}
    >
      {SIZER}
      <motion.span style={{ y }} className="ac__stack">{STACK}</motion.span>
    </motion.span>
  );
}));

export default function AnimatedCounter({
  value,
  decimals = 0,
  duration = 0.6,
  padStart = 1,
  separator = ',',
  decimalSeparator = '.',
  grouping = 'western',
  prefix,
  suffix,
  className = '',
  ...props
}) {
  const reduced = useReducedMotion() ?? false;

  const shape = measure(value, decimals, padStart, duration);
  const chars = format(shape, separator, decimalSeparator, grouping);
  const cells = toCells(chars, shape.width);
  const negative = shape.amount < 0 && shape.scaled > 0;

  const [previous, setPrevious] = useState(shape.amount);
  const [dir, setDir] = useState(1);
  if (previous !== shape.amount) {
    setDir(shape.amount >= previous ? 1 : -1);
    setPrevious(shape.amount);
  }

  const [seed] = useState(() => {
    const faces = {};
    cells.forEach((c) => { if (c.kind === 'digit') faces[c.key] = c.digit; });
    return faces;
  });

  const shift = useMemo(() => (reduced ? INSTANT : spring(shape.pace)), [reduced, shape.pace]);
  const slot = { reduced, dep: chars.length, shift };

  return (
    <span className={`ac ${className}`.trim()} {...props}>
      {prefix != null && <Fixed {...slot}>{prefix}</Fixed>}
      <span className="sr-only">{negative ? '-' : ''}{chars}</span>
      <span aria-hidden="true" className="ac__row">
        {negative && <Fixed {...slot}>-</Fixed>}
        <AnimatePresence mode="popLayout" initial={false}>
          {cells.map((cell) => (cell.kind === 'digit' ? (
            <Digit
              key={cell.key}
              {...slot}
              digit={cell.digit}
              from={seed[cell.key] ?? 0}
              dir={dir}
              duration={shape.pace}
            />
          ) : (
            <Mark key={cell.key} {...slot} char={cell.char} />
          )))}
        </AnimatePresence>
      </span>
      {suffix != null && <Fixed {...slot}>{suffix}</Fixed>}
    </span>
  );
}

// The visitor's own digit grouping (1,234,567 vs 12,34,567 vs 1.234.567).
export function localeGrouping() {
  try {
    const parts = new Intl.NumberFormat().formatToParts(1234567);
    const sep = (parts.find((p) => p.type === 'group') || {}).value ?? ',';
    const ints = parts.filter((p) => p.type === 'integer').map((p) => p.value);
    return { separator: sep, grouping: ints.length === 3 && ints[1].length === 2 ? 'indian' : 'western' };
  } catch (e) {
    return { separator: ',', grouping: 'western' };
  }
}

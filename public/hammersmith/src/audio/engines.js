/**
 * Bus engines: two synthesised voices that follow the two nearest buses.
 *
 * Each voice is a low sawtooth with a square an octave up (the diesel's beat), a little filtered noise (the
 * fan and the road), through a low-pass that opens as the bus pulls away, then a gain for distance and a
 * stereo pan for where it is relative to the camera. Pitch follows road speed; a bus standing still idles.
 * Everything is set with short time constants, so nothing clicks as voices hand over from bus to bus.
 */
const RANGE = 48;

export function createEngines(audio) {
  const master = audio.createGain(); master.gain.value = 0.16; master.connect(audio.destination);
  const noiseBuf = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  { const d = noiseBuf.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } }   // brown noise
  const voices = [0, 1].map(() => {
    const o1 = audio.createOscillator(), o2 = audio.createOscillator(), n = audio.createBufferSource(), nb = audio.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'square'; n.buffer = noiseBuf; n.loop = true; nb.type = 'bandpass'; nb.frequency.value = 420; nb.Q.value = 0.7;
    const g2 = audio.createGain(); g2.gain.value = 0.28; const gn = audio.createGain(); gn.gain.value = 0.5;
    const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; lp.Q.value = 0.9;
    const vol = audio.createGain(); vol.gain.value = 0; const pan = audio.createStereoPanner();
    o1.connect(lp); o2.connect(g2).connect(lp); n.connect(nb).connect(gn).connect(lp); lp.connect(vol).connect(pan).connect(master);
    o1.start(); o2.start(); n.start();
    return { o1, o2, lp, vol, pan };
  });

  /** cars: the traffic's active vehicles; at: the listener (camera) position; yaw: the way the camera faces. */
  function update(cars, at, yaw) {
    const t = audio.currentTime, near = [];
    for (const v of cars) {
      if (v.car.kind !== 'bus') continue;
      const d = Math.hypot(v.x - at.x, v.z - at.z); if (d < RANGE) near.push([d, v]);
    }
    near.sort((a, b) => a[0] - b[0]);
    voices.forEach((vo, i) => {
      const e = near[i];
      if (!e) { vo.vol.gain.setTargetAtTime(0, t, 0.25); return; }
      const [d, v] = e, k = 1 - d / RANGE, speed = Math.min(1, v.v / 8);
      const f = 33 + speed * 26;
      vo.o1.frequency.setTargetAtTime(f, t, 0.3); vo.o2.frequency.setTargetAtTime(f * 2.01, t, 0.3);
      vo.lp.frequency.setTargetAtTime(170 + speed * 380, t, 0.3);
      vo.vol.gain.setTargetAtTime(k * k * (0.45 + 0.55 * speed), t, 0.2);
      const ang = Math.atan2(v.x - at.x, v.z - at.z) - yaw;
      vo.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, -Math.sin(ang))), t, 0.15);
    });
  }
  return { update, dispose() { voices.forEach((v) => { v.o1.stop(); v.o2.stop(); }); master.disconnect(); } };
}

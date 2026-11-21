/**
 * Real bodies for everyone in the mall.
 *
 * The shop staff and the shoppers keep their existing brains (staff.js walks
 * people between work stations; shoppers.js runs the queue / sit / browse
 * state machine). This module gives each of those people a rigged, skinned,
 * textured body (Microsoft Rocketbox, MIT; see ASSETS_LICENSES.md) and plays
 * motion-captured clips that match what the brain says they are doing. Until
 * the assets have loaded, the old jointed mannequin stands in.
 *
 * Cost control, since the scene is short of draw calls and CPU, not triangles:
 *   - one mesh, one atlas material, one draw call per person
 *   - people out of range are taken out of the scene graph altogether
 *   - animation is evaluated every frame up close, every 2nd or 4th frame
 *     further off, and not at all behind the camera
 *   - clips carry only the 23 body bones; fingers get one relaxed pose
 *
 * No foot-skating: a walk clip's playback rate is the person's measured
 * ground speed over the speed the clip was captured at, and the walk is
 * cross-weighted against the standing clip by that same speed.
 *
 * Things in hands (cups, trays, bags, phones) are the same prop meshes as
 * before, re-homed to a holder that follows the skinned hand and stays
 * upright. Some shoppers also get a carrier bag, a backpack, a handbag, a
 * wheeled case, a pram or a scooter.
 *
 * Clothes the avatar library does not have are added as a garment shell: the
 * triangles of the torso (and arms) are copied, pushed out a centimetre or
 * two along their normals and skinned to the same skeleton. Staff get a top
 * in their outlet's colour, a bib apron where the outlet has one, and a cap;
 * some shoppers get a quilted, padded jacket for the season.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, FONT } from '../util.js';
import { paint, blackSteel } from './finishes.js';

const BASE = new URL('../../assets/people/', import.meta.url).href;

/** What each activity looks like. Anything not listed stands idle. */
const ACT = {
  phone: 'phone', chat: 'talk', browse: 'look', wave: 'wave', drink: 'drink', sip: 'drink', eat: 'drink',
  type: 'work', tap: 'work', grind: 'work', tamp: 'work', brew: 'work', steam: 'work', pour: 'work', handover: 'work', restock: 'work', fries: 'work', scoop: 'work', flip: 'work', bag: 'work', wipe: 'work',
};
const CLIP = {
  walkA: 'walk_neutral_01', walkB: 'walk_slow_01', walkC: 'walk_stroll_01', walkD: 'walk_fast_01',
  idle: 'idle_neutral_01', idle2: 'idle_neutral_02', look: 'idle_look_around_01', phone: 'cell_phone_textmessage', talk: 'gestic_talk_neutral_01',
  wave: 'wave_01', drink: 'drink_drinking', work: 'work_mid', sit: 'sit_table_idle_neutral_01', sitBench: 'sit_chair_idle_neutral_01', arm: 'drink_idle',
};
const WALKS = ['walkA', 'walkB', 'walkC', 'walkD'];
/** Who plays whom. Shoppers: everyday clothes, hi-vis and security among them. Staff: plainer work clothes. */
const POOL = {
  shopper: ['f06', 'm18', 'f04', 'm12', 'f09', 'm04', 'f14', 'm03', 'f10', 'm10', 'cf01', 'm07', 'f11', 'cm07', 'f02', 'm17', 'f17', 'm13', 'f08', 'sm01', 'f15', 'm20'],
  staff: ['bf02', 'bm05', 'f07', 'm08', 'f13', 'm14', 'bm02', 'f15', 'm06', 'f08', 'm02', 'f17', 'm20', 'f02'],
  cleaner: ['cf01', 'cm07'],
};
/** Shoppers in these everyday tops get a padded jacket over them. */
const PUFFER = new Set(['m07', 'f02', 'f17', 'm13', 'f08', 'm20', 'f11']);
const COATS = [0x1b1d22, 0x1f2a44, 0x4a5236, 0x5b1f2a, 0x595e66, 0x8a2a22, 0x2e4a5a];
const SEAT = 0.46;            // the chair height the sitting clips were captured on (m)

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _f = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0);

export function createBodies(ctx, scene, { contact } = {}) {
  const wanted = [], bodies = [];
  let clips = null, cast = null, hands = null, feet = null, frame = 0, started = false;
  const loader = new GLTFLoader(), tl = new THREE.TextureLoader(), libs = new Map();
  const props = new THREE.Group(); props.userData.dynamic = true; scene.add(props);        // held things live here, in world space
  let seed = 4242; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  /** crew: the people from createStaff(). pool: 'staff' | 'shopper'. pace: their usual walking speed (m/s). */
  function adopt(crew, { pool = 'staff', pace = 1.05, offset = 0, range = 45, deck = false } = {}) { crew.forEach((p, i) => wanted.push({ p, id: POOL[pool][(i + offset) % POOL[pool].length], pace, pool, range, deck })); }   // deck: up on the bus station, drawn only from up there   // range: drawn within this many metres (streets have longer views than the mall)

  async function loadClips() {
    const out = { f: {}, m: {} }, jobs = [];
    for (const sex of ['f', 'm']) for (const key in CLIP) jobs.push(fetch(`${BASE}clips/${sex}_${CLIP[key]}.json`).then((r) => r.json()).then((j) => {
      const tracks = j.tracks.map((t) => (t.type === 'quaternion' ? new THREE.QuaternionKeyframeTrack(t.name, t.times, t.values) : new THREE.VectorKeyframeTrack(t.name, t.times, t.values)));
      const root = j.tracks.find((t) => t.name === 'Bip01.position');
      // the arm overlay is only the right arm of a "holding a drink" pose, laid over whatever the legs are doing
      const used = key === 'arm' ? tracks.filter((t) => /_R_(Clavicle|UpperArm|Forearm|Hand)\./.test(t.name)) : tracks;
      out[sex][key] = { clip: new THREE.AnimationClip(`${sex}_${key}`, j.duration, used), speed: j.speed, rootY: root ? root.values[1] : 0, sit: key.startsWith('sit') };
    }));
    await Promise.all(jobs); return out;
  }

  /** One avatar's shared parts: the rig to clone, and the single material everyone wearing it shares. */
  function lib(id) {
    if (!libs.has(id)) libs.set(id, loader.loadAsync(`${BASE}${id}.glb`).then((gltf) => {
      const tex = tl.load(`${BASE}${id}.webp`); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, alphaTest: 0.5, side: THREE.DoubleSide });   // the hair cards need the alpha test and both faces
      gltf.scene.traverse((o) => { if (o.isMesh) o.material = mat; if (hands[o.name]) o.quaternion.fromArray(hands[o.name]); });
      return gltf.scene;
    }));
    return libs.get(id);
  }

  /* ---------- garment shells ---------- */
  const shells = new Map();
  /**
   * The avatar's torso triangles, copied and pushed out along their normals. kind 'staff': a top (u = 0.25) with a
   * bib apron panel on the front (u = 0.75), coloured from a two-texel texture. kind 'puffer': torso, arms and hips,
   * with v running down the body and along the arms for the quilting.
   */
  function shellGeometry(id, src, kind, long) {
    const key = `${id}|${kind}|${long}`; if (shells.has(key)) return shells.get(key);
    let mesh = null; src.traverse((o) => { if (o.isSkinnedMesh) mesh = o; }); src.updateMatrixWorld(true);
    const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, idx = g.index;
    const names = mesh.skeleton.bones.map((b) => b.name.replace('Bip01_', '')), yOf = (n) => src.getObjectByName('Bip01_' + n).getWorldPosition(_v).y;
    const pelY = yOf('Pelvis'), neckY = yOf('Neck'), n = P.count, part = new Int8Array(n).fill(-1), quilt = new Float32Array(n);
    const sh = src.getObjectByName('Bip01_L_UpperArm').getWorldPosition(_v), shX = Math.abs(sh.x), shY = sh.y;
    for (let i = 0; i < n; i++) {
      if (U.getX(i) >= 0.5) continue;                                          // the head and hair halves of the atlas
      let bi = 0, bw = -1, arm = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k), j = SI.getComponent(i, k); if (w > bw) { bw = w; bi = j; } if (/UpperArm|Forearm|Hand/.test(names[j])) arm += w; }
      const nm = names[bi], x = P.getX(i), y = P.getY(i), torso = /^(Spine\d?|[LR]_Clavicle)$/.test(nm), upper = /UpperArm/.test(nm), fore = /Forearm/.test(nm), pel = nm === 'Pelvis';
      // hip length; the quilting runs down the body and carries on down each arm from the shoulder, blended by how much the arm owns the vertex
      if (kind === 'puffer') { if (torso || upper || fore || ((pel || /Thigh/.test(nm)) && y > pelY - 15)) { part[i] = 0; quilt[i] = (y * (1 - arm) + (shY - (Math.abs(x) - shX)) * arm) / 9; } }
      else if ((torso || pel) && N.getZ(i) > 0.3 && Math.abs(x) < 15 && y < neckY - 9 && y > pelY - 5) part[i] = 1;
      else if (torso || upper || (long && fore)) part[i] = 0;
    }
    const pos = [], nor = [], uv = [], si = [], sw = [], out = kind === 'puffer' ? [2.6, 2.6] : [1.0, 2.2];
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (part[a] < 0 || part[b] < 0 || part[c] < 0) continue;
      const pt = part[a] && part[b] && part[c] ? 1 : 0;
      for (const i of [a, b, c]) {
        const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
        pos.push(P.getX(i) + nx * out[pt], P.getY(i) + ny * out[pt], P.getZ(i) + nz * out[pt]); nor.push(nx, ny, nz);
        uv.push(kind === 'puffer' ? 0.5 : pt ? 0.75 : 0.25, kind === 'puffer' ? quilt[i] : 0.5);
        for (let k = 0; k < 4; k++) { si.push(SI.getComponent(i, k)); sw.push(SW.getComponent(i, k)); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    shells.set(key, geo); return geo;
  }
  function wear(b, geo, mat) {
    const m = new THREE.SkinnedMesh(geo, mat); m.position.copy(b.mesh.position); m.quaternion.copy(b.mesh.quaternion); m.scale.copy(b.mesh.scale);
    m.bind(b.mesh.skeleton, b.mesh.bindMatrix); m.castShadow = false; m.receiveShadow = false; m.boundingSphere = b.mesh.boundingSphere;
    b.mesh.parent.add(m); b.parts.push(m);
  }
  let quiltTex = null;
  const quilting = () => quiltTex || (quiltTex = (() => {
    const t = canvasTex(8, 64, (c) => { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#5c5c5c'); g.addColorStop(0.12, '#c9c9c9'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.88, '#b4b4b4'); g.addColorStop(1, '#4a4a4a'); c.fillStyle = g; c.fillRect(0, 0, 8, 64); });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })());
  const capGeo = (() => { const dome = new THREE.SphereGeometry(0.108, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.47), brim = new THREE.BoxGeometry(0.15, 0.012, 0.1).translate(0, 0.008, 0.135); return mergeGeometries([dome.toNonIndexed(), brim.toNonIndexed()]); })();
  /** Staff: a top in the outlet's colour, its apron if it has one, and its cap. Shoppers in PUFFER: a padded jacket. */
  function dress(b, rec, src) {
    const look = rec.p.look || {};
    if (rec.pool === 'staff' && look.uniform != null) {
      const cols = new Uint8Array(8), c = new THREE.Color();
      [look.uniform, look.apron != null ? look.apron : look.uniform].forEach((hex, i) => { c.set(hex).convertLinearToSRGB(); cols.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4); });
      const tex = new THREE.DataTexture(cols, 2, 1); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
      wear(b, shellGeometry(rec.id, src, 'staff', look.sleeves === 'long'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
      if (look.hat) {
        // made upright at the head's rest pose, then handed to the head bone so it follows every nod
        const cap = new THREE.Mesh(capGeo, paint(look.hatColor != null ? look.hatColor : 0x1b1d22, 0.8)), head = b.model.getObjectByName('Bip01_Head'), k = b.scale / 0.0098;
        b.model.updateMatrixWorld(true); head.getWorldPosition(_v);
        cap.position.set(_v.x, _v.y + 0.085 * k, _v.z + 0.012 * k); cap.scale.setScalar(k); cap.castShadow = false; head.attach(cap); b.parts.push(cap);
      }
    } else if (rec.pool === 'shopper' && PUFFER.has(rec.id)) {
      wear(b, shellGeometry(rec.id, src, 'puffer', true), new THREE.MeshStandardMaterial({ color: COATS[b.k % COATS.length], map: quilting(), bumpMap: quilting(), bumpScale: 2.5, roughness: 0.5 }));
    }
  }

  /* ---------- extras some shoppers carry ---------- */
  const bagMats = [
    () => new THREE.MeshStandardMaterial({ roughness: 0.55, map: canvasTex(256, 256, (c) => { c.fillStyle = '#f7f7f5'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#00539f'; c.font = `900 58px ${FONT}`; c.textAlign = 'center'; c.fillText('TESCO', 128, 132); c.fillStyle = '#ee1c2e'; for (let i = 0; i < 5; i++) c.fillRect(38 + i * 38, 146, 28, 8); }) }),
    () => new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(256, 256, (c) => { c.fillStyle = '#b89268'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#1b8fc4'; c.font = `700 44px ${FONT}`; c.textAlign = 'center'; c.fillText('PRIMARK', 128, 140); }) }),
  ].map((f) => { let m = null; return () => (m || (m = f())); });
  function extras(b, k) {
    const group = () => { const g = new THREE.Group(); g.visible = false; props.add(g); return g; };
    const part = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const black = blackSteel();
    if (k % 4 === 1) { b.bagL = group(); part(b.bagL, new THREE.BoxGeometry(0.3, 0.36, 0.1), bagMats[(k >> 2) % 2](), 0, -0.24, 0); }
    if (k % 5 === 2) { b.pack = group(); part(b.pack, new THREE.BoxGeometry(0.28, 0.4, 0.13), paint([0x1d2733, 0x3a3f46, 0x6f1d2a, 0x23262b][k % 4], 0.85), 0, 0, 0); }
    else if (b.sex === 'f' && k % 3 === 0) {                                          // shoulder bag at the left hip, on a strap
      b.purse = group(); const leather = paint([0x2a1c14, 0x1b1b1d, 0x6b3b22, 0x7a1f2a][k % 4], 0.45);
      part(b.purse, new THREE.BoxGeometry(0.1, 0.19, 0.27), leather, 0, 0, 0); part(b.purse, new THREE.BoxGeometry(0.015, 0.46, 0.03), leather, -0.03, 0.31, 0);
    }
    if (k % 11 === 6) {                                                               // pram, pushed ahead
      b.pram = group(); const fabric = paint([0x1f2a44, 0x3a3f46, 0x4a5236][k % 3], 0.9);
      part(b.pram, new THREE.BoxGeometry(0.5, 0.26, 0.74), fabric, 0, 0.62, 0.02); part(b.pram, new THREE.BoxGeometry(0.5, 0.3, 0.32), fabric, 0, 0.84, 0.22);
      part(b.pram, new THREE.BoxGeometry(0.46, 0.025, 0.025), black, 0, 1.0, -0.5);
      for (const sx of [-1, 1]) { part(b.pram, new THREE.BoxGeometry(0.02, 0.56, 0.02), black, sx * 0.23, 0.76, -0.42).rotation.x = 0.5; for (const sz of [-0.3, 0.32]) part(b.pram, new THREE.CylinderGeometry(0.1, 0.1, 0.035, 14).rotateZ(Math.PI / 2), black, sx * 0.27, 0.1, sz); }
      part(b.pram, new THREE.BoxGeometry(0.5, 0.03, 0.62), black, 0, 0.3, 0);
    } else if (k % 13 === 8) {                                                        // kick scooter, wheeled along by the handlebar
      b.scoot = group(); const alu = paint(0xaab2bd, 0.35);
      part(b.scoot, new THREE.BoxGeometry(0.11, 0.025, 0.56), alu, 0, 0.09, 0); part(b.scoot, new THREE.BoxGeometry(0.03, 0.82, 0.03), alu, 0, 0.5, 0.26); part(b.scoot, new THREE.BoxGeometry(0.34, 0.03, 0.03), black, 0, 0.92, 0.26);
      for (const sz of [-0.27, 0.3]) part(b.scoot, new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12).rotateZ(Math.PI / 2), black, 0, 0.055, sz);
    } else if (k % 9 === 4) {                                                         // wheeled case, pulled behind
      b.caseG = group(); part(b.caseG, new THREE.BoxGeometry(0.38, 0.58, 0.24), paint([0x20242a, 0x2f5f8a, 0x8a2f3a][k % 3], 0.5), 0, 0.33, 0); part(b.caseG, new THREE.BoxGeometry(0.2, 0.36, 0.02), black, 0, 0.8, 0.1);
    }
  }

  async function attach(rec, k) {
    const { p } = rec, c = cast.get(rec.id), model = cloneRig(await lib(rec.id));
    model.userData.dynamic = true;
    let mesh = null; model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 95, 0), 135);   // covers every pose, in the rig's centimetres
    const h = c.sex === 'f' ? 1.58 + rnd() * 0.13 : 1.71 + rnd() * 0.15, scale = h / c.src;                                       // source units are centimetres: this is metres per unit
    model.scale.setScalar(scale);
    const bone = (n) => model.getObjectByName(n), set = clips[c.sex], mixer = new THREE.AnimationMixer(model);
    // the walk captured nearest this person's usual pace
    const wk = WALKS.reduce((a, q) => (Math.abs(set[q].speed * scale - rec.pace) < Math.abs(set[a].speed * scale - rec.pace) ? q : a));
    const b = {
      p, model, mesh, mixer, set, scale, sex: c.sex, k, bip: bone('Bip01'), restY: bone('Bip01').position.y,
      handR: bone('Bip01_R_Hand'), fingR: bone('Bip01_R_Finger2'), handL: bone('Bip01_L_Hand'), fingL: bone('Bip01_L_Finger2'), spine: bone('Bip01_Spine2'), footL: bone('Bip01_L_Foot'), footR: bone('Bip01_R_Foot'),
      actions: new Map(), walk: null, walkSpeed: set[wk].speed * scale, cur: null, prev: null, key: '', fade: 1, arm: null, armW: 0, ww: 0, v: 0, lx: p.root.position.x, lz: p.root.position.z, acc: 0, shown: false,
      alt: k % 3 === 1, holder: new THREE.Object3D(), held: [], bagL: null, pack: null, caseG: null, purse: null, pram: null, scoot: null, parts: [mesh],
      head: bone('Bip01_Head'), look: 0, deck: !!rec.deck, rIn: rec.range * rec.range, rOut: (rec.range + 5) * (rec.range + 5),
    };
    b.walk = action(b, wk);
    // everything this person can hold moves from the mannequin's hand to a holder that follows the skinned hand
    for (const name in p.held) { b.holder.add(p.held[name]); b.held.push(p.held[name]); }
    b.holder.visible = false; props.add(b.holder);
    if (rec.pool === 'shopper') extras(b, k);
    dress(b, rec, await lib(rec.id));
    if (p.hips && p.hips.parent) p.hips.parent.remove(p.hips);                 // the mannequin's joints are no longer needed in the scene graph
    p.body = true;
    if (ctx.zones) ctx.zones.applyTo(model);                                   // lit by where they stand, like everything else
    if (ctx.floorRefl && ctx.floorRefl.addMover) ctx.floorRefl.addMover(model, b.parts, 1.0);
    bodies.push(b);
  }
  function action(b, key) {
    let e = b.actions.get(key);
    if (!e) { const c = b.set[key], a = b.mixer.clipAction(c.clip); a.play(); a.setEffectiveWeight(0); a.time = rnd() * c.clip.duration; e = { a, rootY: c.rootY, sit: c.sit }; b.actions.set(key, e); }
    return e;
  }

  /** Call once, after every adopt(). Loads in the background; people switch over as their bodies arrive. */
  function start() {
    if (started) return ready; started = true;
    if (contact) feet = contact.dynamic(wanted.length * 3);
    ready = Promise.all([loadClips(), fetch(`${BASE}cast.json`).then((r) => r.json()), fetch(`${BASE}hands.json`).then((r) => r.json())]).then(async ([cl, cs, hd]) => {
      clips = cl; hands = hd; cast = new Map(cs.map((c) => [c.id, c]));
      for (let k = 0; k < wanted.length; k++) await attach(wanted[k], k).catch((e) => console.warn('bodies: could not load', wanted[k].id, e));
    });
    return ready;
  }
  let ready = Promise.resolve();

  function show(b, on) {
    b.shown = on; b.holder.visible = on;
    if (on) scene.add(b.model); else { scene.remove(b.model); for (const g of [b.bagL, b.pack, b.caseG, b.purse, b.pram, b.scoot]) if (g) g.visible = false; if (feet) for (let j = 0; j < 3; j++) feet.set(b.k * 3 + j, 0, -50, 0, 0); }
  }

  function animate(b, p, dt, near) {
    const act = p.manual ? p.act : p.tasks[p.i].act, key = p.seated ? (p.bench ? 'sitBench' : 'sit') : (ACT[act] || (b.alt ? 'idle2' : 'idle'));
    b.ww += ((p.seated ? 0 : Math.min(1, b.v / 0.5)) - b.ww) * Math.min(1, dt * 7);
    if (key !== b.key) { b.prev = b.cur; b.cur = action(b, key); b.key = key; b.fade = b.prev && b.prev !== b.cur ? 0 : 1; if (b.prev === b.cur) b.prev = null; }
    b.fade = Math.min(1, b.fade + dt / 0.35);
    const base = 1 - b.ww, w1 = base * b.fade, w0 = b.prev ? base * (1 - b.fade) : 0;
    b.walk.a.setEffectiveWeight(b.ww); b.walk.a.timeScale = Math.min(1.5, Math.max(0.6, b.v / b.walkSpeed));
    b.cur.a.setEffectiveWeight(w1);
    if (b.prev) { b.prev.a.setEffectiveWeight(w0); if (b.fade >= 1) b.prev = null; }
    // something carried: the right forearm comes up, whatever the rest of the body is doing
    const carry = !p.seated && (b.pram || (p.manual ? p.carry : !!(p.prop && p.prop.visible))) ? 1 : 0;
    b.armW += (carry - b.armW) * Math.min(1, dt * 5);
    if (b.armW > 0.01 || b.arm) { b.arm = b.arm || action(b, 'arm'); b.arm.a.setEffectiveWeight(b.armW * 6); }
    b.mixer.update(dt);
    // the clips' root height is the capture actor's: put this person's own leg length (or the seat) back
    const seat = ((p.seatH || SEAT) - SEAT) / b.scale, lift = (e) => (e.sit ? seat : b.restY - e.rootY);
    b.bip.position.y += b.ww * lift(b.walk) + w1 * lift(b.cur) + (w0 ? w0 * lift(b.prev || b.cur) : 0);

    // a glance at the cat: the head turns about the vertical (and tips down), whatever the clip is doing
    b.look += ((p.lookYaw == null ? 0 : p.lookYaw * 0.75) - b.look) * Math.min(1, dt * 6);
    if (Math.abs(b.look) > 0.02) {
      const ry = b.model.rotation.y, tip = Math.min(1, Math.abs(b.look) * 3) * 0.3;
      b.head.parent.getWorldQuaternion(_q);                                       // the neck's orientation in the world
      _q2.setFromAxisAngle(_UP, b.look).multiply(_q3.setFromAxisAngle(_w.set(Math.cos(ry), 0, -Math.sin(ry)), tip));   // turn, then tip forward about the person's own left-right axis
      b.head.quaternion.premultiply(_q).premultiply(_q2).premultiply(_q.invert());   // applied in world terms, written back in the neck's
    }

    // things in hands and on backs follow the bones, but stay upright
    let holding = false; for (let j = 0; j < b.held.length; j++) if (b.held[j].visible) { holding = true; break; }
    const yaw = b.model.rotation.y, standing = !p.seated;
    if (holding || b.bagL || b.pack || b.caseG || b.purse || b.pram || b.scoot) {
      b.fingR.updateWorldMatrix(true, false);
      if (holding) { _v.setFromMatrixPosition(b.handR.matrixWorld); _w.setFromMatrixPosition(b.fingR.matrixWorld); b.holder.position.lerpVectors(_v, _w, 0.75); b.holder.rotation.y = yaw; }
      if (b.caseG) { b.caseG.visible = standing; _v.setFromMatrixPosition(b.handR.matrixWorld); b.caseG.position.set(_v.x - Math.sin(yaw) * 0.38, b.model.position.y, _v.z - Math.cos(yaw) * 0.38); b.caseG.rotation.y = yaw; }
      if (b.scoot) { b.scoot.visible = standing; _v.setFromMatrixPosition(b.handR.matrixWorld); b.scoot.position.set(_v.x + Math.sin(yaw) * 0.02, b.model.position.y, _v.z + Math.cos(yaw) * 0.02); b.scoot.rotation.y = yaw; }
      if (b.pram) { b.pram.visible = standing; b.pram.position.set(b.model.position.x + Math.sin(yaw) * 0.92, b.model.position.y, b.model.position.z + Math.cos(yaw) * 0.92); b.pram.rotation.y = yaw; }
      if (b.bagL || b.pack || b.purse) b.fingL.updateWorldMatrix(true, false);
      if (b.bagL) { b.bagL.visible = standing; _v.setFromMatrixPosition(b.handL.matrixWorld); _w.setFromMatrixPosition(b.fingL.matrixWorld); b.bagL.position.lerpVectors(_v, _w, 0.75); b.bagL.rotation.y = yaw + Math.PI / 2; }
      if (b.purse) { b.purse.visible = true; b.spine.updateWorldMatrix(true, false); _v.setFromMatrixPosition(b.spine.matrixWorld); b.purse.position.set(_v.x + Math.cos(yaw) * 0.2, _v.y - 0.36, _v.z - Math.sin(yaw) * 0.2); b.purse.rotation.y = yaw; }
      if (b.pack) { b.pack.visible = true; b.spine.updateWorldMatrix(true, false); _v.setFromMatrixPosition(b.spine.matrixWorld); b.pack.position.set(_v.x - Math.sin(yaw) * 0.19, _v.y - 0.13, _v.z - Math.cos(yaw) * 0.19); b.pack.rotation.y = yaw; }
    }
    // grounding: a soft decal under each foot that shrinks as the foot lifts, and a faint one under the body
    if (feet) {
      const y0 = b.model.position.y, r = (y) => (near ? 0.17 * (1 - Math.min(1, Math.max(0, ((y - y0) / b.scale - 11) / 14))) : 0);     // ankle height in cm: planted ~9, swinging ~25
      _v.setFromMatrixPosition(b.footL.matrixWorld); feet.set(b.k * 3, _v.x, y0 - 0.05, _v.z, r(_v.y));
      _v.setFromMatrixPosition(b.footR.matrixWorld); feet.set(b.k * 3 + 1, _v.x, y0 - 0.05, _v.z, r(_v.y));
      feet.set(b.k * 3 + 2, b.model.position.x, y0 - 0.05, b.model.position.z, near ? 0.27 : 0);
    }
  }

  /** Every frame. camera: for range and facing. */
  function update(dt, camera) {
    if (!bodies.length) return;
    frame++;
    const c = camera.position; camera.getWorldDirection(_f);
    const level = c.y > -1.5 && c.y < 6.2;                               // nobody is drawn from the platforms or the bus deck
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], p = b.p, pos = p.root.position, dx = pos.x - c.x, dz = pos.z - c.z, d2 = dx * dx + dz * dz;
      const want = (b.deck ? c.y > 5.6 && c.y < 40 : level) && !p.hidden && d2 < (b.shown ? b.rOut : b.rIn);   // in at its range (45 m in the mall), out 5 m further
      if (want !== b.shown) show(b, want);
      // ground speed, from how far they actually moved (a jump of metres is a teleport, not a sprint)
      const sp = Math.hypot(pos.x - b.lx, pos.z - b.lz) / Math.max(dt, 1e-3); b.lx = pos.x; b.lz = pos.z;
      b.v += ((sp > 8 ? 0 : sp) - b.v) * Math.min(1, dt * 6);
      if (!want) continue;
      b.model.position.set(pos.x, pos.y + 0.03, pos.z); b.model.rotation.y = p.root.rotation.y;
      b.acc = Math.min(0.25, b.acc + dt);
      if (dx * _f.x + dz * _f.z < -4) continue;                           // behind the camera: hold the pose
      if ((frame + i) % (d2 < 196 ? 1 : d2 < 784 ? 2 : 4)) continue;      // 14 m: every frame; 28 m: every other; beyond: every fourth
      animate(b, p, b.acc, d2 < 900); b.acc = 0;
    }
    if (feet) feet.commit();
  }

  return { adopt, start, update, bodies, get ready() { return ready; }, get count() { return wanted.length; } };
}

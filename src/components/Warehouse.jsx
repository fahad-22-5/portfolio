import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import './Warehouse.css';
import { trackEvent } from '../utils/analytics';

/* ──────────────────────────────────────
   HELPER — rounded-box geometry
   ────────────────────────────────────── */
function createRoundedBox(w, h, d, r, s) {
  const shape = new THREE.Shape();
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  shape.moveTo(-hw, -h / 2);
  shape.lineTo(hw, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  shape.lineTo(w / 2, hh);
  shape.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
  shape.lineTo(-hw, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh);
  shape.lineTo(-w / 2, -hh);
  shape.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const extrudeSettings = { depth: d, bevelEnabled: true, bevelSize: r * 0.3, bevelThickness: r * 0.3, bevelSegments: s || 3 };
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/* ──────────────────────────────────────
   HELPER — 3D Text Sprite Label
   ────────────────────────────────────── */
function createLabelSprite(text, textColor = '#fbbf24', borderColor = '#f59e0b', bgColor = 'rgba(15, 23, 42, 0.92)') {
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 85;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(6, 6, 328, 73, 18);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 22px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 170, 42.5);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(5.2, 1.3, 1);
  return sprite;
}

/* ──────────────────────────────────────
   COLLISION — AABB helpers
   ────────────────────────────────────── */
function makeAABB(cx, cz, hw, hd) {
  return { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd };
}
function testAABB(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/* ──────────────────────────────────────
   COLOR DEFINITIONS FOR CODED BOXES & ZONES
   ────────────────────────────────────── */
const COLOR_TYPES = {
  RED: { name: 'RED', hex: 0xef4444, css: '#ef4444', icon: '🔴' },
  BLUE: { name: 'BLUE', hex: 0x3b82f6, css: '#3b82f6', icon: '🔵' },
  GREEN: { name: 'GREEN', hex: 0x10b981, css: '#10b981', icon: '🟢' },
  YELLOW: { name: 'YELLOW', hex: 0xf59e0b, css: '#f59e0b', icon: '🟡' },
  PURPLE: { name: 'PURPLE', hex: 0x8b5cf6, css: '#8b5cf6', icon: '🟣' },
};

/* ──────────────────────────────────────
   WAREHOUSE COMPONENT
   ────────────────────────────────────── */
export default function Warehouse() {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const keysRef = useRef({});
  const gameRef = useRef({ score: 0, carried: null, totalCollected: 0 });

  const [cameraMode, setCameraMode] = useState('third');
  const [isNight, setIsNight] = useState(false);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [carried, setCarried] = useState(false);
  const [carriedColor, setCarriedColor] = useState(null);
  const [canDrop, setCanDrop] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const cameraModeRef = useRef('third');
  const nightRef = useRef(false);
  const messageTimerRef = useRef(null);
  const canDropRef = useRef(false);

  const wrongKeyCountRef = useRef(0);
  const autoHideControlsTimerRef = useRef(null);

  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => { nightRef.current = isNight; }, [isNight]);

  const showMessage = useCallback((msg, duration = 2800) => {
    setMessage(msg);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage(''), duration);
  }, []);

  const revealControlsBriefly = useCallback((duration = 5000) => {
    setShowControls(true);
    if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current);
    autoHideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, duration);
  }, []);

  // Initial load auto-hide controls after 6 seconds
  useEffect(() => {
    revealControlsBriefly(6000);
    return () => {
      if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current);
    };
  }, [revealControlsBriefly]);

  const collidersRef = useRef([]);

  /* ────────────────────────────────────
     MAIN THREE.JS SCENE SETUP & ANIMATION
     ──────────────────────────────────── */
  useEffect(() => {
    trackEvent('warehouse_simulation_started');
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.Fog(0x7dd3fc, 130, 240);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 450);
    camera.position.set(0, 30, 80);
    camera.lookAt(0, 5, 0);

    collidersRef.current = [];
    const colliders = collidersRef.current;

    // ─── 1. Expanded Warehouse Floor (220 x 150 Footprint) ───
    const floorGeo = new THREE.PlaneGeometry(220, 150);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xdbe2e9,
      roughness: 0.35,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid Navigation Line Decals
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    for (let z = -60; z <= 60; z += 30) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.4), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, z);
      scene.add(line);
    }
    for (let x = -80; x <= 80; x += 40) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 130), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, 0);
      scene.add(line);
    }

    // Outer Safety Perimeter Hazard Decals
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    for (let x = -105; x <= 105; x += 6) {
      const stripe1 = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.6), hazardMat);
      stripe1.rotation.x = -Math.PI / 2;
      stripe1.position.set(x, 0.03, -72);
      scene.add(stripe1);
      const stripe2 = stripe1.clone();
      stripe2.position.set(x, 0.03, 72);
      scene.add(stripe2);
    }

    // ─── 2. Expanded Building Structure ───
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide,
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const roofBeamMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(220, 25), wallMat);
    backWall.position.set(0, 12.5, -75); backWall.receiveShadow = true; scene.add(backWall);
    const trimBack = new THREE.Mesh(new THREE.BoxGeometry(220, 1.2, 0.2), trimMat);
    trimBack.position.set(0, 0.6, -74.9); scene.add(trimBack);

    const frontLeft = new THREE.Mesh(new THREE.PlaneGeometry(85, 25), wallMat);
    frontLeft.position.set(-67.5, 12.5, 75); frontLeft.rotation.y = Math.PI; scene.add(frontLeft);
    const frontRight = new THREE.Mesh(new THREE.PlaneGeometry(85, 25), wallMat);
    frontRight.position.set(67.5, 12.5, 75); frontRight.rotation.y = Math.PI; scene.add(frontRight);

    const doorTop = new THREE.Mesh(new THREE.PlaneGeometry(50, 7), wallMat);
    doorTop.position.set(0, 21.5, 75); doorTop.rotation.y = Math.PI; scene.add(doorTop);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(150, 25), wallMat);
    leftWall.position.set(-110, 12.5, 0); leftWall.rotation.y = Math.PI / 2; scene.add(leftWall);
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(150, 25), wallMat);
    rightWall.position.set(110, 12.5, 0); rightWall.rotation.y = -Math.PI / 2; scene.add(rightWall);

    const pillarGeo = new THREE.BoxGeometry(1.8, 25, 1.8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.3 });
    [
      [-108, 12.5, -73], [108, 12.5, -73], [-108, 12.5, 73], [108, 12.5, 73],
      [-50, 12.5, -73], [50, 12.5, -73], [-50, 12.5, 73], [50, 12.5, 73],
    ].forEach(([x, y, z]) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, y, z); pillar.castShadow = true; scene.add(pillar);
      colliders.push(makeAABB(x, z, 1.4, 1.4));
    });

    for (let z = -60; z <= 60; z += 30) {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(220, 1.0, 0.8), roofBeamMat);
      truss.position.set(0, 24, z); scene.add(truss);
    }

    const skylightGeo = new THREE.PlaneGeometry(45, 30);
    const skylightMat = new THREE.MeshStandardMaterial({
      color: 0xa5f3fc, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.9, side: THREE.DoubleSide,
    });
    [[-55, -30], [55, -30], [-55, 30], [55, 30]].forEach(([x, z]) => {
      const skylight = new THREE.Mesh(skylightGeo, skylightMat);
      skylight.position.set(x, 24.5, z); skylight.rotation.x = Math.PI / 2; scene.add(skylight);
    });

    // ─── 3. Industrial Racking System ───
    const shelfFrameMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5, roughness: 0.3 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.4 });

    const createRackRow = (startX, startZ, width, depth, height, shelvesCount) => {
      const group = new THREE.Group();
      const numPosts = Math.floor(width / 7);

      for (let i = 0; i <= numPosts; i++) {
        const px = -width / 2 + i * 7;
        const postFront = new THREE.Mesh(new THREE.BoxGeometry(0.35, height, 0.35), shelfFrameMat);
        postFront.position.set(px, height / 2, depth / 2); postFront.castShadow = true; group.add(postFront);
        const postBack = new THREE.Mesh(new THREE.BoxGeometry(0.35, height, 0.35), shelfFrameMat);
        postBack.position.set(px, height / 2, -depth / 2); postBack.castShadow = true; group.add(postBack);
      }

      for (let s = 1; s <= shelvesCount; s++) {
        const sy = s * (height / (shelvesCount + 1));
        const beamFront = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, 0.25), beamMat);
        beamFront.position.set(0, sy, depth / 2); group.add(beamFront);
        const beamBack = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, 0.25), beamMat);
        beamBack.position.set(0, sy, -depth / 2); group.add(beamBack);

        for (let i = 0; i < numPosts; i++) {
          const sectionX = -width / 2 + i * 7 + 3.5;
          const boxCount = Math.floor(Math.random() * 3) + 1;
          for (let b = 0; b < boxCount; b++) {
            const bx = sectionX - 2.2 + b * 2.2;
            const bh = 1.0 + Math.random() * 0.7;
            const bw = 1.4 + Math.random() * 0.4;
            const bd = depth * 0.75;
            const boxGeo = createRoundedBox(bw, bh, bd, 0.04, 2);
            const boxMesh = new THREE.Mesh(boxGeo, crateMat);
            boxMesh.position.set(bx, sy + bh / 2 + 0.1, 0);
            boxMesh.castShadow = true; boxMesh.receiveShadow = true;
            group.add(boxMesh);
          }
        }
      }

      group.position.set(startX, 0, startZ);
      scene.add(group);
      colliders.push(makeAABB(startX, startZ, width / 2 + 0.5, depth / 2 + 0.5));
    };

    createRackRow(75, -45, 36, 4, 12, 3);
    createRackRow(75, 0, 36, 4, 12, 3);
    createRackRow(75, 45, 36, 4, 12, 3);

    // ─── 4. High-Tech 4-Aisle 3D ASRS Matrix with Cross-Transfer Tracks & 4 Bots ───
    const createASRS = () => {
      const asrsGroup = new THREE.Group();

      const railMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.2 });
      const gearTrackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.3 });
      const asrsBeamMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
      const baseRailMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });

      const rackW = 32;
      const rackH = 22;
      const numCols = 7;
      const numRows = 6;
      const aisleZs = [10.5, 3.5, -3.5, -10.5]; // 4 Distinguishable Parallel Aisles with wide gaps

      const colPostsX = [];
      for (let c = 0; c <= numCols; c++) {
        colPostsX.push(-rackW / 2 + c * (rackW / numCols));
      }

      const slotXs = [];
      for (let c = 0; c < numCols; c++) {
        slotXs.push(-rackW / 2 + c * (rackW / numCols) + (rackW / numCols) / 2);
      }

      // 1. Double-Sided Vertical Structural Posts & Central Climbing Columns
      const rackFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
      const shelfPlateMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });

      colPostsX.forEach((rx) => {
        aisleZs.forEach((az) => {
          // Central Bot Climbing Guide Column (Z = az)
          const centerPost = new THREE.Mesh(new THREE.BoxGeometry(0.35, rackH, 0.35), railMat);
          centerPost.position.set(rx, rackH / 2, az); centerPost.castShadow = true; asrsGroup.add(centerPost);

          const track = new THREE.Mesh(new THREE.BoxGeometry(0.15, rackH, 0.15), gearTrackMat);
          track.position.set(rx, rackH / 2, az + 0.2); asrsGroup.add(track);

          // Left Rack Upright Post (Z = az - 1.5)
          const postL = new THREE.Mesh(new THREE.BoxGeometry(0.3, rackH, 0.3), rackFrameMat);
          postL.position.set(rx, rackH / 2, az - 1.5); postL.castShadow = true; asrsGroup.add(postL);

          // Right Rack Upright Post (Z = az + 1.5)
          const postR = new THREE.Mesh(new THREE.BoxGeometry(0.3, rackH, 0.3), rackFrameMat);
          postR.position.set(rx, rackH / 2, az + 1.5); postR.castShadow = true; asrsGroup.add(postR);

          // Top Overhead Cross-Brace Beam connecting Left and Right rack frames across the aisle
          const topBrace = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.2), rackFrameMat);
          topBrace.position.set(rx, rackH + 0.1, az); asrsGroup.add(topBrace);
        });
      });

      // 2. Base Longitudinal Floor Rails for all 4 Aisles (Dual Steel Guide Rails + Magnetic Central Track)
      aisleZs.forEach((az) => {
        const baseRailOuterL = new THREE.Mesh(new THREE.BoxGeometry(58, 0.14, 0.15), baseRailMat);
        baseRailOuterL.position.set(9, 0.07, az - 0.4); asrsGroup.add(baseRailOuterL);

        const baseRailOuterR = new THREE.Mesh(new THREE.BoxGeometry(58, 0.14, 0.15), baseRailMat);
        baseRailOuterR.position.set(9, 0.07, az + 0.4); asrsGroup.add(baseRailOuterR);

        const magTrack = new THREE.Mesh(new THREE.BoxGeometry(58, 0.18, 0.25), gearTrackMat);
        magTrack.position.set(9, 0.09, az); asrsGroup.add(magTrack);
      });

      // 3. Complete 2D Grid Floor Rail Track Network (Perpendicular Cross-Transfer Tracks & Intersections)
      const crossRailXs = [...colPostsX, -20, 16, 36]; // Track cross-rails at column posts & station infeed/outfeed nodes (No track at X=26 under workstation desk!)
      const gridJunctionMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
      const ledDotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

      crossRailXs.forEach((rx) => {
        const crossRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 26), baseRailMat);
        crossRail.position.set(rx, 0.08, 0); asrsGroup.add(crossRail);

        // Junction Plates & LED Indicators at Grid Rail Intersections
        aisleZs.forEach((az) => {
          const junction = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), gridJunctionMat);
          junction.position.set(rx, 0.11, az); asrsGroup.add(junction);

          const ledDot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), ledDotMat);
          ledDot.position.set(rx, 0.15, az); asrsGroup.add(ledDot);
        });
      });

      // 4. Double-Sided Rack Shelf Levels & Storage Tote Grid (ALL BINS UNIFORM INDUSTRIAL BLUE)
      const gridTotes = {};
      const rowYs = [];
      const sides = [-1, 1]; // -1: Left Rack Face (Z = az - 1.5), +1: Right Rack Face (Z = az + 1.5)
      const blueToteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.2 });

      for (let r = 1; r <= numRows; r++) {
        const ry = r * (rackH / (numRows + 1));
        rowYs.push(ry);

        aisleZs.forEach((az, aIdx) => {
          sides.forEach((side) => {
            const shelfZ = az + side * 1.5;

            // Longitudinal Shelf Support Beams
            const beam = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.18, 0.18), asrsBeamMat);
            beam.position.set(0, ry, shelfZ); asrsGroup.add(beam);

            // Metallic Shelf Surface Plate
            const shelfPlate = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.05, 1.4), shelfPlateMat);
            shelfPlate.position.set(0, ry + 0.08, shelfZ); asrsGroup.add(shelfPlate);

            // Storage Totes (ALL BINS UNIFORM BLUE) resting on shelf plates
            for (let c = 0; c < numCols; c++) {
              const slotX = slotXs[c];
              
              const isFilled = (c + r * 2 + (side > 0 ? 1 : 0) + aIdx) % 4 !== 0;
              if (isFilled) {
                const tote = new THREE.Mesh(createRoundedBox(1.9, 1.1, 1.6, 0.05, 2), blueToteMat);
                tote.position.set(slotX, ry + 0.65, shelfZ); tote.castShadow = true; asrsGroup.add(tote);

                const toteKey = `aisle_${aIdx}_side_${side}_col_${c}_row_${r}`;
                gridTotes[toteKey] = tote;
              }
            }
          });
        });
      }

      // Workstation & Middle Station Conveyor System
      const stationGroup = new THREE.Group();
      
      // Station Powered Roller Conveyor (Centered at Z = 0)
      const conveyorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
      const conveyorBed = new THREE.Mesh(new THREE.BoxGeometry(22, 0.35, 2.2), conveyorFrameMat);
      conveyorBed.position.set(0, 1.0, 0); conveyorBed.castShadow = true; stationGroup.add(conveyorBed);

      // Rollers along the conveyor
      const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.1, 12);
      const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
      for (let rx = -10; rx <= 10; rx += 1.2) {
        const roller = new THREE.Mesh(rollerGeo, rollerMat);
        roller.rotation.x = Math.PI / 2; roller.position.set(rx, 1.2, 0); stationGroup.add(roller);
      }

      // Workstation Operator Desk (Positioned at Z = -1.8, clear of any floor tracks)
      const deskMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 });
      const desk = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.3, 2.2), deskMat);
      desk.position.set(0, 0.65, -1.8); desk.castShadow = true; stationGroup.add(desk);

      // Order Screen Monitor
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x38bdf8, emissiveIntensity: 0.6 }));
      monitor.position.set(-1.5, 1.8, -1.8); monitor.rotation.y = 0.25; stationGroup.add(monitor);

      // Pick Status Light Bar
      const lightBarMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 0.15), lightBarMat);
      lightBar.position.set(0, 2.5, -1.8); stationGroup.add(lightBar);

      // Human Operator Worker
      const workerGroup = new THREE.Group();
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const vestMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.8 });
      const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 });

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.5), pantsMat);
      legs.position.set(0, 0.6, 0); workerGroup.add(legs);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.3, 0.55), vestMat);
      torso.position.set(0, 1.85, 0); workerGroup.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), skinMat);
      head.position.set(0, 2.7, 0); workerGroup.add(head);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
      helmet.position.set(0, 2.72, 0); workerGroup.add(helmet);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), vestMat);
      armL.position.set(-0.55, 1.8, 0.3); armL.rotation.x = -Math.PI / 4; workerGroup.add(armL);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), vestMat);
      armR.position.set(0.55, 1.8, 0.3); armR.rotation.x = -Math.PI / 4; workerGroup.add(armR);

      workerGroup.position.set(0, 0, -2.8); stationGroup.add(workerGroup);

      const stationLight = new THREE.PointLight(0x10b981, 1.8, 10);
      stationLight.position.set(0, 3.5, 0); stationGroup.add(stationLight);

      // Station Tote Bin (Industrial Blue, centered on top of conveyor bed at Z = 0)
      const stationToteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
      const stationTote = new THREE.Mesh(createRoundedBox(1.8, 0.95, 1.9, 0.04, 2), stationToteMat);
      stationTote.position.set(-10, 1.80, 0); stationTote.castShadow = true; stationGroup.add(stationTote);

      stationGroup.position.set(26, 0, 0); asrsGroup.add(stationGroup);

      // Helper function to build 3D Rack Climbing Bot
      const createClimbingBot = (mainColorHex, ledColorHex) => {
        const botGroup = new THREE.Group();
        const chassisMat = new THREE.MeshStandardMaterial({ color: mainColorHex, metalness: 0.7, roughness: 0.3 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 2.0), chassisMat);
        body.position.set(0, 0.28, 0); body.castShadow = true; botGroup.add(body);

        // Side Climbing Gear Brackets
        const gearMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
        const gearL1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), gearMat);
        gearL1.rotation.z = Math.PI / 2; gearL1.position.set(-1.25, 0.28, -0.7); botGroup.add(gearL1);
        const gearL2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), gearMat);
        gearL2.rotation.z = Math.PI / 2; gearL2.position.set(-1.25, 0.28, 0.7); botGroup.add(gearL2);
        const gearR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), gearMat);
        gearR1.rotation.z = Math.PI / 2; gearR1.position.set(1.25, 0.28, -0.7); botGroup.add(gearR1);
        const gearR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), gearMat);
        gearR2.rotation.z = Math.PI / 2; gearR2.position.set(1.25, 0.28, 0.7); botGroup.add(gearR2);

        // Front LED Strip Light & Status Beacon
        const ledMat = new THREE.MeshBasicMaterial({ color: ledColorHex });
        const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), ledMat);
        ledStrip.position.set(0, 0.45, 1.01); botGroup.add(ledStrip);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), ledMat);
        beacon.position.set(-0.9, 0.65, -0.7); botGroup.add(beacon);

        // Telescopic Gripper Extractor Arms
        const armGroup = new THREE.Group();
        const forkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
        const fork1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.8), forkMat);
        fork1.position.set(-0.6, 0.62, 0); armGroup.add(fork1);
        const fork2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.8), forkMat);
        fork2.position.set(0.6, 0.62, 0); armGroup.add(fork2);
        botGroup.add(armGroup);

        // Carried Tote Bin (Industrial Blue, attached to armGroup centered dead-on top of bot at Y = 1.10)
        const toteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
        const botTote = new THREE.Mesh(createRoundedBox(1.8, 0.95, 1.9, 0.04, 2), toteMat);
        botTote.position.set(0, 1.10, 0); botTote.castShadow = true;
        armGroup.add(botTote);

        return { botGroup, armGroup, botTote, beacon, gearL1, gearL2, gearR1, gearR2 };
      };

      // 4 AUTONOMOUS CLIMBING BOTS (ALL BOTS NON-BLUE for high visual contrast against blue bins)
      const bot1 = createClimbingBot(0xeab308, 0xfef08a); // Safety Amber / Gold
      bot1.botGroup.position.set(-9.14, 0, aisleZs[1]); asrsGroup.add(bot1.botGroup);

      const bot2 = createClimbingBot(0xf97316, 0xffedd5); // Vivid Safety Orange
      bot2.botGroup.position.set(36, 0, aisleZs[1]); asrsGroup.add(bot2.botGroup);

      const bot3 = createClimbingBot(0x10b981, 0xa7f3d0); // Industrial Emerald Green
      bot3.botGroup.position.set(-4.57, 0, aisleZs[2]); asrsGroup.add(bot3.botGroup);

      const bot4 = createClimbingBot(0x8b5cf6, 0xddd6fe); // High-Vis Neon Purple
      bot4.botGroup.position.set(4.57, 0, aisleZs[3]); asrsGroup.add(bot4.botGroup);

      const asrsState = {
        stage: 0,
        timer: 0,
        srcAisleIdx: 0,
        srcAisleZ: aisleZs[0],
        srcSide: -1,
        srcColIdx: 1,
        srcRowIdx: 4,
        srcColX: slotXs[1],
        srcRowY: rowYs[3],

        dstAisleIdx: 3,
        dstAisleZ: aisleZs[3],
        dstSide: 1,
        dstColIdx: 5,
        dstRowIdx: 5,
        dstColX: slotXs[5],
        dstRowY: rowYs[4],

        toteHex: 0x0284c7,
      };

      asrsGroup.position.set(-75, 0, 0);
      scene.add(asrsGroup);
      colliders.push(makeAABB(-75, 0, 24, 15));

      return { asrsGroup, bot1, bot2, bot3, bot4, stationTote, armL, armR, stationLight, lightBarMat, asrsState, gridTotes, slotXs, rowYs };
    };

    const asrsData = createASRS();

    // ─── 5. Color-Coded Interactable Floor Boxes ───
    const interactableBoxes = [];
    const boxDefinitions = [
      { x: -30, z: -35, colorType: COLOR_TYPES.RED },
      { x: -20, z: -35, colorType: COLOR_TYPES.BLUE },
      { x: 30, z: -35, colorType: COLOR_TYPES.GREEN },
      { x: 20, z: -35, colorType: COLOR_TYPES.YELLOW },
      { x: -30, z: 35, colorType: COLOR_TYPES.PURPLE },
      { x: -20, z: 35, colorType: COLOR_TYPES.RED },
      { x: 30, z: 35, colorType: COLOR_TYPES.BLUE },
      { x: 20, z: 35, colorType: COLOR_TYPES.GREEN },
      { x: 0, z: -15, colorType: COLOR_TYPES.YELLOW },
      { x: 0, z: 15, colorType: COLOR_TYPES.PURPLE },
    ];

    boxDefinitions.forEach(({ x, z, colorType }, idx) => {
      const containerGroup = new THREE.Group();

      const boxGeo = createRoundedBox(1.8, 1.4, 1.8, 0.05, 2);
      const mat = new THREE.MeshStandardMaterial({
        color: colorType.hex, roughness: 0.4, metalness: 0.1,
      });
      const box = new THREE.Mesh(boxGeo, mat);
      box.position.set(0, 0.7, 0);
      box.castShadow = true; box.receiveShadow = true;
      containerGroup.add(box);

      const labelSprite = createLabelSprite(`${colorType.icon} ${colorType.name} CARGO [E]`, colorType.css, colorType.css);
      labelSprite.position.set(0, 3.5, 0);
      containerGroup.add(labelSprite);

      const ringGeo = new THREE.RingGeometry(1.3, 1.6, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.04, 0);
      containerGroup.add(ring);

      containerGroup.position.set(x, 0, z);
      containerGroup.userData = {
        interactable: true, pickedUp: false, id: idx, height: 1.4,
        colorType: colorType, labelSprite, ringMat, boxMesh: box
      };
      scene.add(containerGroup);
      interactableBoxes.push(containerGroup);
    });

    // ─── 6. Side Conveyors ───
    const conveyors = [];
    const createSideConveyor = (x, z, length, rotation) => {
      const group = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
      const legGeo = new THREE.BoxGeometry(0.3, 1.5, 0.3);
      for (let i = -length / 2; i <= length / 2; i += 4) {
        const legL = new THREE.Mesh(legGeo, frameMat); legL.position.set(i, 0.75, -0.7); group.add(legL);
        const legR = new THREE.Mesh(legGeo, frameMat); legR.position.set(i, 0.75, 0.7); group.add(legR);
      }
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      const belt = new THREE.Mesh(new THREE.BoxGeometry(length, 0.2, 1.6), beltMat);
      belt.position.set(0, 1.5, 0); group.add(belt);

      const pkgColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b];
      const packages = [];
      for (let i = 0; i < 4; i++) {
        const pw = 0.6 + Math.random() * 0.4;
        const ph = 0.4 + Math.random() * 0.3;
        const pd = 0.5 + Math.random() * 0.4;
        const pkgGeo = createRoundedBox(pw, ph, pd, 0.04, 2);
        const pkgMat = new THREE.MeshStandardMaterial({ color: pkgColors[i % 4], roughness: 0.5 });
        const pkg = new THREE.Mesh(pkgGeo, pkgMat);
        const sx = -length / 2 + i * (length / 4) + Math.random();
        pkg.position.set(sx, 1.6 + ph / 2, 0); pkg.castShadow = true;
        pkg.userData = { speed: 0.6 + Math.random() * 0.4, startX: sx, halfLength: length / 2 };
        packages.push(pkg); group.add(pkg);
      }

      group.position.set(x, 0, z); group.rotation.y = rotation || 0;
      scene.add(group);
      conveyors.push({ group, packages, length });

      if (Math.abs(rotation) < 0.01) {
        colliders.push(makeAABB(x, z, length / 2 + 1, 1.5));
      } else {
        colliders.push(makeAABB(x, z, 1.5, length / 2 + 1));
      }
    };

    createSideConveyor(-100, 0, 24, Math.PI / 2);
    createSideConveyor(100, 0, 24, Math.PI / 2);

    // ─── 6.5 Autonomous Ground AMR Mini-Bots with Obstacle Proximity Safety Stop ───
    const miniBots = [];
    const createMiniBot = (startX, startZ, waypoints, bodyHex) => {
      const group = new THREE.Group();

      // Sleek Compact AMR Chassis Body
      const chassisMat = new THREE.MeshStandardMaterial({ color: bodyHex, metalness: 0.8, roughness: 0.2 });
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.4), chassisMat);
      chassis.position.set(0, 0.22, 0); chassis.castShadow = true; group.add(chassis);

      // Top Deck Protective Rubber Pad
      const padMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.2), padMat);
      pad.position.set(0, 0.41, 0); group.add(pad);

      // Carried Mini Cargo Box (Industrial Blue)
      const toteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
      const tote = new THREE.Mesh(createRoundedBox(1.1, 0.6, 0.9, 0.04, 2), toteMat);
      tote.position.set(0, 0.74, 0); tote.castShadow = true; group.add(tote);

      // Rubber All-Terrain AMR Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      [[-0.82, 0.18, -0.5], [0.82, 0.18, -0.5], [-0.82, 0.18, 0.5], [0.82, 0.18, 0.5]].forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, wy, wz); wheel.castShadow = true; group.add(wheel);
      });

      // LiDAR Safety Sensor & Front LED Strip
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const ledBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), ledMat);
      ledBar.position.set(0, 0.32, 0.71); group.add(ledBar);

      // Safety Warning Beacon Light Dome
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.8 });
      const beaconDome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), beaconMat);
      beaconDome.position.set(0.6, 0.52, -0.5); group.add(beaconDome);

      group.position.set(startX, 0, startZ);
      scene.add(group);

      const botData = {
        group, ledMat, beaconMat,
        waypoints, currentWaypointIdx: 0,
        isStopped: false, speed: 6.0, bodyHex
      };
      miniBots.push(botData);
      return botData;
    };

    // 100% Obstacle-Free Open Floor Highways (Clear of ASRS, Industrial Racks, and Conveyors)
    createMiniBot(30, -50, [[30, -50], [30, 50], [30, -50]], 0xeab308); // East Open Corridor Highway
    createMiniBot(-25, 30, [[-25, 30], [45, 30], [-25, 30]], 0xf97316); // Front Open Highway
    createMiniBot(45, -30, [[45, -30], [-25, -30], [45, -30]], 0x10b981); // Back Open Highway
    createMiniBot(35, 30, [[35, 30], [35, -30], [-25, -30], [-25, 30], [35, 30]], 0x8b5cf6); // Outer Perimeter Ring Highway

    // ─── 7. Forklift Vehicle ───
    const forklift = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.8, 3.5), bodyMat);
    body.position.set(0, 1.5, 0); body.castShadow = true; forklift.add(body);

    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.6 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 1.8), cabinMat);
    cabin.position.set(0, 3.2, -0.4); cabin.castShadow = true; forklift.add(cabin);

    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, roughness: 0.1 });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.5), glassMat);
    windshield.position.set(0, 3.3, 0.52); forklift.add(windshield);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 2.2), bodyMat);
    roof.position.set(0, 4.15, -0.4); forklift.add(roof);

    // Mast & Forks
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    const mastL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 4, 0.15), mastMat);
    mastL.position.set(-0.5, 2.6, 1.8); forklift.add(mastL);
    const mastR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 4, 0.15), mastMat);
    mastR.position.set(0.5, 2.6, 1.8); forklift.add(mastR);

    const forkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 2.5), forkMat);
    forkL.position.set(-0.4, 0.6, 3); forklift.add(forkL);
    const forkR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 2.5), forkMat);
    forkR.position.set(0.4, 0.6, 3); forklift.add(forkR);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    [[-1.1, 0.5, -1.2], [1.1, 0.5, -1.2], [-1.1, 0.5, 1.2], [1.1, 0.5, 1.2]].forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, y, z); wheel.rotation.z = Math.PI / 2; wheel.castShadow = true;
      forklift.add(wheel);
    });

    // Warning Beacon
    const beaconGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8);
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.9 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 4.45, -0.4); forklift.add(beacon);

    // Dual LED Projector Headlights
    const hlHousingGeo = new THREE.BoxGeometry(0.35, 0.35, 0.4);
    const hlHousingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const hlRimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.9, roughness: 0.1 });
    const hlLensMatL = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffaed, emissiveIntensity: 1.5 });
    const hlLensMatR = hlLensMatL.clone();

    const headL = new THREE.Mesh(hlHousingGeo, hlHousingMat); headL.position.set(-0.95, 2.3, 1.75); forklift.add(headL);
    const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.05), hlRimMat); rimL.position.set(0, 0, 0.18); headL.add(rimL);
    const lensL = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), hlLensMatL); lensL.position.set(0, 0, 0.21); headL.add(lensL);

    const headR = new THREE.Mesh(hlHousingGeo, hlHousingMat); headR.position.set(0.95, 2.3, 1.75); forklift.add(headR);
    const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.05), hlRimMat); rimR.position.set(0, 0, 0.18); headR.add(rimR);
    const lensR = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), hlLensMatR); lensR.position.set(0, 0, 0.21); headR.add(lensR);

    const spotL = new THREE.SpotLight(0xfffaed, 2.5, 55, Math.PI / 5, 0.5, 1);
    spotL.position.set(-0.95, 2.3, 1.85); spotL.target.position.set(-0.95, 0, 25); forklift.add(spotL); forklift.add(spotL.target);

    const spotR = new THREE.SpotLight(0xfffaed, 2.5, 55, Math.PI / 5, 0.5, 1);
    spotR.position.set(0.95, 2.3, 1.85); spotR.target.position.set(0.95, 0, 25); forklift.add(spotR); forklift.add(spotR.target);

    const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.3 });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), tailMat); tailL.position.set(-1.0, 1.5, -1.76); forklift.add(tailL);
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), tailMat); tailR.position.set(1.0, 1.5, -1.76); forklift.add(tailR);

    forklift.position.set(0, 0, 10);
    scene.add(forklift);

    // ─── 8. Color-Coded Delivery Drop Zones ───
    const deliveryZones = [];
    const zoneDefinitions = [
      { x: -50, z: -55, colorType: COLOR_TYPES.RED },
      { x: 50, z: -55, colorType: COLOR_TYPES.BLUE },
      { x: -50, z: 55, colorType: COLOR_TYPES.GREEN },
      { x: 50, z: 55, colorType: COLOR_TYPES.YELLOW },
      { x: 0, z: -60, colorType: COLOR_TYPES.PURPLE },
    ];

    zoneDefinitions.forEach(({ x, z, colorType }) => {
      const padGroup = new THREE.Group();

      const padGeo = new THREE.PlaneGeometry(8, 8);
      const padMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.04, 0); padGroup.add(pad);

      const borderMat = new THREE.MeshBasicMaterial({ color: colorType.hex });
      const border = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.0, 32), borderMat);
      border.rotation.x = -Math.PI / 2; border.position.set(0, 0.05, 0); padGroup.add(border);

      const beamGeo = new THREE.CylinderGeometry(3.7, 3.7, 22, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 11, 0); padGroup.add(beam);

      const arrowMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.9 });
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), arrowMat);
      arrow.position.set(0, 3.8, 0); arrow.rotation.x = Math.PI; padGroup.add(arrow);

      const defaultLabelSprite = createLabelSprite(`${colorType.icon} ${colorType.name} ZONE`, colorType.css, colorType.css);
      defaultLabelSprite.position.set(0, 6.0, 0);
      padGroup.add(defaultLabelSprite);

      const readyLabelSprite = createLabelSprite(`✅ PRESS [E] TO UNLOAD HERE!`, '#ffffff', colorType.css, 'rgba(15, 23, 42, 0.95)');
      readyLabelSprite.position.set(0, 6.0, 0);
      readyLabelSprite.scale.set(6.4, 1.6, 1);
      readyLabelSprite.visible = false;
      padGroup.add(readyLabelSprite);

      padGroup.position.set(x, 0, z);
      scene.add(padGroup);

      deliveryZones.push({ x, z, colorType, padMat, borderMat, beamMat, arrow, padGroup, defaultLabelSprite, readyLabelSprite });
    });

    // ─── 9. Collectible Orbs ───
    const collectibles = [];
    [
      [-40, 2, -20], [40, 2, -20], [-40, 2, 20], [40, 2, 20],
      [0, 2, -40], [0, 2, 40], [-80, 2, 0], [80, 2, 0]
    ].forEach(([x, y, z], i) => {
      const group = new THREE.Group();
      const orbGeo = new THREE.IcosahedronGeometry(0.55, 2);
      const orbColor = new THREE.Color(0x38bdf8);
      const orbMat = new THREE.MeshStandardMaterial({
        color: orbColor, emissive: orbColor, emissiveIntensity: 0.8, roughness: 0.1
      });
      const orb = new THREE.Mesh(orbGeo, orbMat); group.add(orb);

      const ringGeo = new THREE.TorusGeometry(0.8, 0.04, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
      const ring = new THREE.Mesh(ringGeo, ringMat); group.add(ring);

      const labelSprite = createLabelSprite('⭐ +25 PTS', '#38bdf8', '#0284c7');
      labelSprite.position.set(0, 1.8, 0);
      labelSprite.scale.set(3.2, 0.8, 1);
      group.add(labelSprite);

      group.position.set(x, y, z);
      group.userData = { collected: false, baseY: y, index: i };
      scene.add(group);
      collectibles.push(group);
    });

    // ─── 10. Lighting ───
    const ambient = new THREE.AmbientLight(0xffffff, 1.2); scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xecfeff, 0xa3a3a3, 1.0); scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
    sunLight.position.set(40, 60, 30); sunLight.target.position.set(0, 0, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5; sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -110; sunLight.shadow.camera.right = 110;
    sunLight.shadow.camera.top = 80; sunLight.shadow.camera.bottom = -80;
    scene.add(sunLight); scene.add(sunLight.target);

    const overheadLights = [];
    const bulbs = [];
    const lightPositions = [
      [-60, 22, -30], [0, 22, -30], [60, 22, -30],
      [-60, 22, 0], [0, 22, 0], [60, 22, 0],
      [-60, 22, 30], [0, 22, 30], [60, 22, 30],
    ];

    lightPositions.forEach(([x, y, z]) => {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 }));
      housing.position.set(x, y, z); scene.add(housing);

      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb, transparent: true, opacity: 0.9 });
      const bulb = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), bulbMat);
      bulb.position.set(x, y - 0.16, z); bulb.rotation.x = -Math.PI / 2; scene.add(bulb);
      bulbs.push(bulbMat);

      const spot = new THREE.SpotLight(0xfffbeb, 1.2, 45, 0.8, 0.5, 1);
      spot.position.set(x, y, z); spot.target.position.set(x, 0, z);
      scene.add(spot); scene.add(spot.target);
      overheadLights.push(spot);
    });

    const doorLight = new THREE.DirectionalLight(0xe0f2fe, 1.2);
    doorLight.position.set(0, 18, 80); doorLight.target.position.set(0, 0, 30);
    scene.add(doorLight); scene.add(doorLight.target);

    const skyGeo = new THREE.SphereGeometry(180, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);

    const forkliftState = { speed: 0, rotSpeed: 0, maxSpeed: 0.45 };

    sceneRef.current = {
      scene, camera, renderer, forklift, beacon, conveyors, miniBots,
      overheadLights, bulbs, ambient, hemi, sunLight, doorLight,
      spotL, spotR, hlLensMatL, hlLensMatR, tailMat,
      sky, skyMat, interactableBoxes, deliveryZones, collectibles, forkliftState, asrsData,
    };

    const forkliftHalfW = 1.8;
    const forkliftHalfD = 2.5;

    const validControlKeys = ['w', 'a', 's', 'd', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;

      if (validControlKeys.includes(key)) {
        wrongKeyCountRef.current = 0;
        e.preventDefault();
      } else if (key.length === 1 || ['space', 'tab', 'enter', 'shift', 'control'].includes(key)) {
        wrongKeyCountRef.current += 1;
        if (wrongKeyCountRef.current >= 3) {
          wrongKeyCountRef.current = 0;
          revealControlsBriefly(6000);
          showMessage('💡 Controls revealed! W/A/S/D to drive, E to pick/drop!');
        }
      }
    };

    const onKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let interactCooldown = 0;
    const clock = new THREE.Clock();
    let animId;
    const speedFillEl = document.getElementById('speed-fill');

    // ─── Animation Loop ───
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      const keys = keysRef.current;
      const night = nightRef.current;

      // ─── Autonomous 4-Aisle 5D Multi-Bot ASRS System State Machine ───
      if (asrsData) {
        const { bot1, bot2, bot3, bot4, stationTote, armL, armR, stationLight, lightBarMat, asrsState, gridTotes, slotXs, rowYs } = asrsData;
        asrsState.timer += delta;

        const aisleZs = [10.5, 3.5, -3.5, -10.5];

        const lerpAngle = (a, b, t) => {
          let diff = (b - a) % (Math.PI * 2);
          if (diff < -Math.PI) diff += Math.PI * 2;
          if (diff > Math.PI) diff -= Math.PI * 2;
          return a + diff * Math.max(0, Math.min(1, t));
        };

        // Constant speed settings (units / sec & turn times)
        const SPEED_X = 14.0;
        const SPEED_Z = 14.0;
        const SPEED_CLIMB = 8.0;
        const TURN_TIME = 0.25;

        // Constant-speed linear roaming for Bot 3 and Bot 4
        const trackLen3 = 13.71 - (-13.71); // 27.42 units
        const b3Time = (elapsed * 10.0) % (trackLen3 * 2);
        const b3X = -13.71 + (b3Time <= trackLen3 ? b3Time : trackLen3 * 2 - b3Time);
        const b3Rot = b3Time <= trackLen3 ? 0 : Math.PI;
        bot3.botGroup.position.set(b3X, 0, aisleZs[2]);
        bot3.botGroup.rotation.y = lerpAngle(bot3.botGroup.rotation.y, b3Rot, delta * 10);
        bot3.botTote.visible = false;

        const trackLen4 = 13.71 - (-9.14); // 22.85 units
        const b4Time = ((elapsed * 10.0) + trackLen4) % (trackLen4 * 2);
        const b4X = -9.14 + (b4Time <= trackLen4 ? b4Time : trackLen4 * 2 - b4Time);
        const b4Rot = b4Time <= trackLen4 ? 0 : Math.PI;
        bot4.botGroup.position.set(b4X, 0, aisleZs[3]);
        bot4.botGroup.rotation.y = lerpAngle(bot4.botGroup.rotation.y, b4Rot, delta * 10);
        bot4.botTote.visible = false;

        const stationZ = aisleZs[1]; // Inner aisle near the workstation conveyor (Z = 3.5)

        switch (asrsState.stage) {
          // STAGE 0: BOT 1 DRIVES ON INNER AISLE GRID FROM STANDBY NODE (-9.14, 0, stationZ) TO TARGET AISLE & COLUMN AT CONSTANT SPEED
          case 0: {
            const d1 = Math.abs(16 - (-9.14));
            const t1 = d1 / SPEED_X;
            const t2 = TURN_TIME;
            const dz = Math.abs(asrsState.srcAisleZ - stationZ);
            const t3 = dz > 0.01 ? dz / SPEED_Z : 0;
            const t4 = dz > 0.01 ? TURN_TIME : 0;
            const dx = Math.abs(asrsState.srcColX - 16);
            const t5 = dx / SPEED_X;

            const timer = asrsState.timer;

            if (timer < t1) {
              const p = timer / t1;
              bot1.botGroup.position.set(THREE.MathUtils.lerp(-9.14, 16, p), 0, stationZ);
              bot1.botGroup.rotation.y = 0;
            } else if (timer < t1 + t2) {
              const p = (timer - t1) / t2;
              const targetZAngle = asrsState.srcAisleZ < stationZ ? -Math.PI / 2 : Math.PI / 2;
              bot1.botGroup.position.set(16, 0, stationZ);
              bot1.botGroup.rotation.y = lerpAngle(0, targetZAngle, p);
            } else if (timer < t1 + t2 + t3) {
              const p = (timer - t1 - t2) / t3;
              const targetZAngle = asrsState.srcAisleZ < stationZ ? -Math.PI / 2 : Math.PI / 2;
              bot1.botGroup.position.set(16, 0, THREE.MathUtils.lerp(stationZ, asrsState.srcAisleZ, p));
              bot1.botGroup.rotation.y = targetZAngle;
            } else if (timer < t1 + t2 + t3 + t4) {
              const p = (timer - t1 - t2 - t3) / t4;
              const targetZAngle = asrsState.srcAisleZ < stationZ ? -Math.PI / 2 : Math.PI / 2;
              bot1.botGroup.position.set(16, 0, asrsState.srcAisleZ);
              bot1.botGroup.rotation.y = lerpAngle(targetZAngle, Math.PI, p);
            } else if (timer < t1 + t2 + t3 + t4 + t5) {
              const p = (timer - t1 - t2 - t3 - t4) / t5;
              bot1.botGroup.position.set(THREE.MathUtils.lerp(16, asrsState.srcColX, p), 0, asrsState.srcAisleZ);
              bot1.botGroup.rotation.y = Math.PI;
            } else {
              asrsState.stage = 1;
              asrsState.timer = 0;
            }

            bot1.armGroup.position.z = 0;
            bot1.botTote.visible = false;
            stationTote.visible = false;

            bot2.botGroup.position.set(36, 0, stationZ);
            bot2.botGroup.rotation.y = -Math.PI / 2;
            bot2.botTote.visible = false;
            break;
          }

          // STAGE 1: BOT 1 CLIMBS VERTICAL TRACK, EXTRACTS BIN FROM RACK, ROTATES & DESCENDS
          case 1: {
            const side = asrsState.srcSide || -1;
            const srcToteKey = `aisle_${asrsState.srcAisleIdx}_side_${side}_col_${asrsState.srcColIdx}_row_${asrsState.srcRowIdx}`;
            const targetSlotTote = gridTotes[srcToteKey];

            const t1 = asrsState.srcRowY / SPEED_CLIMB;
            const t2 = 0.4;
            const t3 = TURN_TIME;
            const t4 = asrsState.srcRowY / SPEED_CLIMB;

            const timer = asrsState.timer;

            if (timer < t1) {
              const p = timer / t1;
              bot1.botGroup.position.set(asrsState.srcColX, p * asrsState.srcRowY, asrsState.srcAisleZ);
              bot1.gearL1.rotation.x = elapsed * 15;
              bot1.gearR1.rotation.x = elapsed * 15;
              bot1.botTote.visible = false;
            } else if (timer < t1 + t2) {
              const p = (timer - t1) / t2;
              bot1.botGroup.position.set(asrsState.srcColX, asrsState.srcRowY, asrsState.srcAisleZ);
              bot1.armGroup.position.z = Math.sin(p * Math.PI) * (side * 1.5);
              if (p >= 0.5) {
                if (targetSlotTote) targetSlotTote.visible = false;
                bot1.botTote.visible = true;
                bot1.botTote.material.color.setHex(asrsState.toteHex);
              }
            } else if (timer < t1 + t2 + t3) {
              const p = (timer - t1 - t2) / t3;
              bot1.botGroup.position.set(asrsState.srcColX, asrsState.srcRowY, asrsState.srcAisleZ);
              bot1.armGroup.position.z = 0;
              bot1.botTote.visible = true;
              bot1.botGroup.rotation.y = lerpAngle(Math.PI, 0, p);
            } else if (timer < t1 + t2 + t3 + t4) {
              const p = (timer - t1 - t2 - t3) / t4;
              bot1.botGroup.position.set(asrsState.srcColX, asrsState.srcRowY * (1 - p), asrsState.srcAisleZ);
              bot1.gearL1.rotation.x = -elapsed * 15;
              bot1.gearR1.rotation.x = -elapsed * 15;
              bot1.armGroup.position.z = 0;
              bot1.botTote.visible = true;
            } else {
              asrsState.stage = 2;
              asrsState.timer = 0;
            }

            bot2.botGroup.position.set(36, 0, stationZ);
            bot2.botGroup.rotation.y = -Math.PI / 2;
            break;
          }

          // STAGE 2: BOT 1 DRIVES ALONG GRID TO INNER AISLE NEAR STATION (X = 16, Z = stationZ)
          case 2: {
            const dx = Math.abs(16 - asrsState.srcColX);
            const t1 = dx / SPEED_X;
            const dz = Math.abs(stationZ - asrsState.srcAisleZ);
            const t2 = dz > 0.01 ? TURN_TIME : 0;
            const t3 = dz > 0.01 ? dz / SPEED_Z : 0;
            const t4 = 0.4;

            const timer = asrsState.timer;

            if (timer < t1) {
              const p = timer / t1;
              bot1.botGroup.position.set(THREE.MathUtils.lerp(asrsState.srcColX, 16, p), 0, asrsState.srcAisleZ);
              bot1.botGroup.rotation.y = 0;
            } else if (timer < t1 + t2) {
              const p = (timer - t1) / t2;
              const targetZAngle = stationZ < asrsState.srcAisleZ ? -Math.PI / 2 : Math.PI / 2;
              bot1.botGroup.position.set(16, 0, asrsState.srcAisleZ);
              bot1.botGroup.rotation.y = lerpAngle(0, targetZAngle, p);
            } else if (timer < t1 + t2 + t3) {
              const p = (timer - t1 - t2) / t3;
              const targetZAngle = stationZ < asrsState.srcAisleZ ? -Math.PI / 2 : Math.PI / 2;
              bot1.botGroup.position.set(16, 0, THREE.MathUtils.lerp(asrsState.srcAisleZ, stationZ, p));
              bot1.botGroup.rotation.y = targetZAngle;
            } else if (timer < t1 + t2 + t3 + t4) {
              const p = (timer - t1 - t2 - t3) / t4;
              bot1.botGroup.position.set(16, 0, stationZ);
              bot1.botGroup.rotation.y = -Math.PI / 2;
              bot1.armGroup.position.z = Math.sin(p * Math.PI) * 1.0;
              if (p >= 0.5) {
                bot1.botTote.visible = false;
                stationTote.material.color.setHex(asrsState.toteHex);
                stationTote.position.set(-10, 1.80, 0);
                stationTote.visible = true;
              }
            } else {
              asrsState.stage = 3;
              asrsState.timer = 0;
            }

            bot2.botGroup.position.set(36, 0, stationZ);
            bot2.botGroup.rotation.y = -Math.PI / 2;
            break;
          }

          // STAGE 3: CONVEYOR SLIDES BIN TO WORKSTATION DESK; BOT 1 DRIVES TO INNER AISLE STANDBY NODE
          case 3: {
            const t1 = Math.abs(16 - (-9.14)) / SPEED_X;
            const timer = asrsState.timer;

            const slideP = Math.min(1, timer / 1.2);
            stationTote.position.set(THREE.MathUtils.lerp(-10, 0, slideP), 1.80, 0);
            stationTote.visible = true;
            bot1.botTote.visible = false;
            bot1.armGroup.position.z = 0;

            const b1P = Math.min(1, timer / t1);
            bot1.botGroup.position.set(THREE.MathUtils.lerp(16, -9.14, b1P), 0, stationZ);
            bot1.botGroup.rotation.y = Math.PI;

            bot2.botGroup.position.set(36, 0, stationZ);
            bot2.botGroup.rotation.y = -Math.PI / 2;

            if (timer >= Math.max(t1, 1.2)) {
              asrsState.stage = 4;
              asrsState.timer = 0;
            }
            break;
          }

          // STAGE 4: WORKSTATION 2-SECOND PAUSE & GTP ITEM PICK
          case 4: {
            stationTote.position.set(0, 1.80, 0);
            stationTote.visible = true;

            armL.rotation.x = -Math.PI / 4 + Math.sin(elapsed * 6) * 0.45;
            armR.rotation.x = -Math.PI / 4 - Math.sin(elapsed * 6) * 0.45;
            stationLight.intensity = 2.8;
            lightBarMat.color.setHex(0x10b981);

            bot1.botGroup.position.set(-9.14, 0, stationZ);
            bot1.botGroup.rotation.y = Math.PI;

            bot2.botGroup.position.set(36, 0, stationZ);
            bot2.botGroup.rotation.y = -Math.PI / 2;

            if (asrsState.timer >= 2.0) {
              asrsState.stage = 5;
              asrsState.timer = 0;
            }
            break;
          }

          // STAGE 5: CONVEYOR SLIDES BIN TO OUTFEED EXIT NODE (X = 36, Z = stationZ)
          case 5: {
            const p = Math.min(1, asrsState.timer / 1.0);
            stationTote.position.set(THREE.MathUtils.lerp(0, 10, p), 1.80, 0);
            stationTote.visible = true;

            stationLight.intensity = 0.8;
            lightBarMat.color.setHex(0x0284c7);

            bot1.botGroup.position.set(-9.14, 0, stationZ);
            bot1.botGroup.rotation.y = Math.PI;

            bot2.botGroup.position.set(36, 0, stationZ);
            bot2.botGroup.rotation.y = -Math.PI / 2;

            if (p >= 1) {
              asrsState.stage = 6;
              asrsState.timer = 0;
            }
            break;
          }

          // STAGE 6: BOT 2 PICKS BIN OFF CONVEYOR EXIT NODE ON INNER AISLE & ROTATES SMOOTHLY
          case 6: {
            const t1 = 0.4;
            const t2 = TURN_TIME;
            const timer = asrsState.timer;

            bot1.botGroup.position.set(-9.14, 0, stationZ);
            bot2.botGroup.position.set(36, 0, stationZ);

            if (timer < t1) {
              const p = timer / t1;
              bot2.armGroup.position.z = Math.sin(p * Math.PI) * 1.0;
              bot2.botGroup.rotation.y = -Math.PI / 2;
              if (p >= 0.5) {
                stationTote.visible = false;
                bot2.botTote.visible = true;
                bot2.botTote.material.color.setHex(asrsState.toteHex);
              }
            } else if (timer < t1 + t2) {
              const p = (timer - t1) / t2;
              bot2.armGroup.position.z = 0;
              bot2.botTote.visible = true;
              const targetZAngle = asrsState.dstAisleZ < stationZ ? -Math.PI / 2 : Math.PI / 2;
              bot2.botGroup.rotation.y = lerpAngle(-Math.PI / 2, targetZAngle, p);
            } else {
              asrsState.stage = 7;
              asrsState.timer = 0;
            }
            break;
          }

          // STAGE 7: BOT 2 TRANSITS ALONG INNER AISLE GRID TRACK TO DESTINATION AISLE & COLUMN AT CONSTANT SPEED
          case 7: {
            bot1.botGroup.position.set(-9.14, 0, stationZ);

            const dz = Math.abs(asrsState.dstAisleZ - stationZ);
            const t1 = dz > 0.01 ? dz / SPEED_Z : 0;
            const t2 = dz > 0.01 ? TURN_TIME : 0;
            const dx = Math.abs(asrsState.dstColX - 36);
            const t3 = dx / SPEED_X;

            const timer = asrsState.timer;

            if (timer < t1) {
              const p = timer / t1;
              const targetZAngle = asrsState.dstAisleZ < stationZ ? -Math.PI / 2 : Math.PI / 2;
              bot2.botGroup.position.set(36, 0, THREE.MathUtils.lerp(stationZ, asrsState.dstAisleZ, p));
              bot2.botGroup.rotation.y = targetZAngle;
            } else if (timer < t1 + t2) {
              const p = (timer - t1) / t2;
              const targetZAngle = asrsState.dstAisleZ < stationZ ? -Math.PI / 2 : Math.PI / 2;
              bot2.botGroup.position.set(36, 0, asrsState.dstAisleZ);
              bot2.botGroup.rotation.y = lerpAngle(targetZAngle, Math.PI, p);
            } else if (timer < t1 + t2 + t3) {
              const p = (timer - t1 - t2) / t3;
              bot2.botGroup.position.set(THREE.MathUtils.lerp(36, asrsState.dstColX, p), 0, asrsState.dstAisleZ);
              bot2.botGroup.rotation.y = Math.PI;
            } else {
              asrsState.stage = 8;
              asrsState.timer = 0;
            }

            bot2.armGroup.position.z = 0;
            bot2.botTote.visible = true;
            break;
          }

          // STAGE 8: BOT 2 CLIMBS VERTICAL TRACK, DEPOSITS BIN INTO RACK SLOT, ROTATES, DESCENDS & RETURNS TO INNER AISLE
          case 8: {
            bot1.botGroup.position.set(-9.14, 0, stationZ);

            const side = asrsState.dstSide || 1;
            const dstToteKey = `aisle_${asrsState.dstAisleIdx}_side_${side}_col_${asrsState.dstColIdx}_row_${asrsState.dstRowIdx}`;
            const destSlotTote = gridTotes[dstToteKey];

            const t1 = asrsState.dstRowY / SPEED_CLIMB;
            const t2 = 0.4;
            const t3 = TURN_TIME;
            const t4 = asrsState.dstRowY / SPEED_CLIMB;
            const dx = Math.abs(36 - asrsState.dstColX);
            const t5 = dx / SPEED_X;
            const dz = Math.abs(stationZ - asrsState.dstAisleZ);
            const t6 = dz > 0.01 ? TURN_TIME : 0;
            const t7 = dz > 0.01 ? dz / SPEED_Z : 0;

            const timer = asrsState.timer;

            if (timer < t1) {
              const p = timer / t1;
              bot2.botGroup.position.set(asrsState.dstColX, p * asrsState.dstRowY, asrsState.dstAisleZ);
              bot2.gearL1.rotation.x = elapsed * 15;
              bot2.gearR1.rotation.x = elapsed * 15;
              bot2.botTote.visible = true;
            } else if (timer < t1 + t2) {
              const p = (timer - t1) / t2;
              bot2.botGroup.position.set(asrsState.dstColX, asrsState.dstRowY, asrsState.dstAisleZ);
              bot2.armGroup.position.z = Math.sin(p * Math.PI) * (side * 1.5);
              if (p >= 0.5) {
                bot2.botTote.visible = false;
                if (destSlotTote) {
                  destSlotTote.visible = true;
                  destSlotTote.material.color.setHex(asrsState.toteHex);
                }
              }
            } else if (timer < t1 + t2 + t3) {
              const p = (timer - t1 - t2) / t3;
              bot2.botGroup.position.set(asrsState.dstColX, asrsState.dstRowY, asrsState.dstAisleZ);
              bot2.armGroup.position.z = 0;
              bot2.botTote.visible = false;
              bot2.botGroup.rotation.y = lerpAngle(Math.PI, 0, p);
            } else if (timer < t1 + t2 + t3 + t4) {
              const p = (timer - t1 - t2 - t3) / t4;
              bot2.botGroup.position.set(asrsState.dstColX, asrsState.dstRowY * (1 - p), asrsState.dstAisleZ);
              bot2.gearL1.rotation.x = -elapsed * 15;
              bot2.gearR1.rotation.x = -elapsed * 15;
              bot2.armGroup.position.z = 0;
              bot2.botTote.visible = false;
            } else if (timer < t1 + t2 + t3 + t4 + t5) {
              const p = (timer - t1 - t2 - t3 - t4) / t5;
              bot2.botGroup.position.set(THREE.MathUtils.lerp(asrsState.dstColX, 36, p), 0, asrsState.dstAisleZ);
              bot2.botGroup.rotation.y = 0;
            } else if (timer < t1 + t2 + t3 + t4 + t5 + t6) {
              const p = (timer - t1 - t2 - t3 - t4 - t5) / t6;
              const targetZAngle = stationZ < asrsState.dstAisleZ ? -Math.PI / 2 : Math.PI / 2;
              bot2.botGroup.position.set(36, 0, asrsState.dstAisleZ);
              bot2.botGroup.rotation.y = lerpAngle(0, targetZAngle, p);
            } else if (timer < t1 + t2 + t3 + t4 + t5 + t6 + t7) {
              const p = (timer - t1 - t2 - t3 - t4 - t5 - t6) / t7;
              const targetZAngle = stationZ < asrsState.dstAisleZ ? -Math.PI / 2 : Math.PI / 2;
              bot2.botGroup.position.set(36, 0, THREE.MathUtils.lerp(asrsState.dstAisleZ, stationZ, p));
              bot2.botGroup.rotation.y = targetZAngle;
            } else {
              const srcAisleIdx = Math.floor(Math.random() * 4);
              const srcSide = Math.random() < 0.5 ? -1 : 1;
              const srcColIdx = Math.floor(Math.random() * 7);
              const srcRowIdx = Math.floor(Math.random() * 6) + 1;

              const dstAisleIdx = Math.floor(Math.random() * 4);
              const dstSide = Math.random() < 0.5 ? -1 : 1;
              const dstColIdx = Math.floor(Math.random() * 7);
              const dstRowIdx = Math.floor(Math.random() * 6) + 1;

              asrsState.srcAisleIdx = srcAisleIdx;
              asrsState.srcAisleZ = aisleZs[srcAisleIdx];
              asrsState.srcSide = srcSide;
              asrsState.srcColIdx = srcColIdx;
              asrsState.srcRowIdx = srcRowIdx;
              asrsState.srcColX = slotXs[srcColIdx];
              asrsState.srcRowY = rowYs[srcRowIdx - 1];

              asrsState.dstAisleIdx = dstAisleIdx;
              asrsState.dstAisleZ = aisleZs[dstAisleIdx];
              asrsState.dstSide = dstSide;
              asrsState.dstColIdx = dstColIdx;
              asrsState.dstRowIdx = dstRowIdx;
              asrsState.dstColX = slotXs[dstColIdx];
              asrsState.dstRowY = rowYs[dstRowIdx - 1];

              asrsState.toteHex = 0x0284c7;

              asrsState.stage = 0;
              asrsState.timer = 0;
            }
            break;
          }
          default:
            asrsState.stage = 0;
            asrsState.timer = 0;
        }
      }

      // Accelerate / Decelerate
      if (keys['w'] || keys['arrowup']) {
        forkliftState.speed = Math.min(forkliftState.maxSpeed, forkliftState.speed + 0.9 * delta);
      } else if (keys['s'] || keys['arrowdown']) {
        forkliftState.speed = Math.max(-forkliftState.maxSpeed * 0.7, forkliftState.speed - 0.9 * delta);
      } else {
        forkliftState.speed *= 0.90;
      }

      // Responsive Steering
      const turnRate = 2.4 * delta;
      if (keys['a'] || keys['arrowleft']) {
        forkliftState.rotSpeed = turnRate;
      } else if (keys['d'] || keys['arrowright']) {
        forkliftState.rotSpeed = -turnRate;
      } else {
        forkliftState.rotSpeed = 0;
      }

      // Interacting with box (E key)
      interactCooldown -= delta;
      if (keys['e'] && interactCooldown <= 0) {
        interactCooldown = 0.5;
        const game = gameRef.current;
        const forkTip = new THREE.Vector3(0, 0.6, 3);
        forkTip.applyMatrix4(forklift.matrixWorld);

        if (!game.carried) {
          let nearest = null;
          let nearDist = 6.5;
          interactableBoxes.forEach((boxGroup) => {
            if (boxGroup.userData.pickedUp) return;
            const d = forkTip.distanceTo(boxGroup.position);
            if (d < nearDist) { nearDist = d; nearest = boxGroup; }
          });
          if (nearest) {
            nearest.userData.pickedUp = true;
            scene.remove(nearest);

            const boxMesh = nearest.userData.boxMesh;
            nearest.remove(boxMesh);
            boxMesh.position.set(0, 1, 3);
            boxMesh.rotation.set(0, 0, 0);
            forklift.add(boxMesh);
            game.carried = boxMesh;
            game.carriedGroup = nearest;
            setCarried(true);
            setCarriedColor(nearest.userData.colorType);
            showMessage(`📦 Picked up ${nearest.userData.colorType.icon} ${nearest.userData.colorType.name} Cargo! Deliver to the matching zone.`);
          }
        } else {
          const boxMesh = game.carried;
          const containerGroup = game.carriedGroup;
          const boxColor = containerGroup.userData.colorType;
          forklift.remove(boxMesh);

          const worldPos = new THREE.Vector3();
          const forkDrop = new THREE.Vector3(0, 0.5, 5);
          forkDrop.applyMatrix4(forklift.matrixWorld);
          worldPos.copy(forkDrop);

          boxMesh.position.set(0, 0.7, 0);
          boxMesh.rotation.set(0, 0, 0);
          containerGroup.add(boxMesh);
          containerGroup.position.set(worldPos.x, 0, worldPos.z);
          scene.add(containerGroup);

          game.carried = null;
          game.carriedGroup = null;
          setCarried(false);
          setCarriedColor(null);

          let delivered = false;
          deliveryZones.forEach((zone) => {
            const dx = Math.abs(worldPos.x - zone.x);
            const dz = Math.abs(worldPos.z - zone.z);
            if (dx < 4.5 && dz < 4.5) {
              delivered = true;
              if (boxColor.name === zone.colorType.name) {
                game.score += 100;
                setScore(game.score);
                showMessage(`🎉 PERFECT MATCH! Delivered ${boxColor.icon} ${boxColor.name} Cargo to ${zone.colorType.name} Zone (+100 PTS)!`);
              } else {
                game.score += 30;
                setScore(game.score);
                showMessage(`📦 Delivered to ${zone.colorType.name} Zone (+30 PTS)! Tip: Match colors for +100 PTS!`);
              }
              containerGroup.userData.pickedUp = false;
              containerGroup.position.set(-40 + Math.random() * 80, 0, -35 + Math.random() * 70);
            }
          });
          if (!delivered) {
            containerGroup.userData.pickedUp = false;
            showMessage(`📦 Unloaded cargo. Drive to matching ${boxColor.icon} ${boxColor.name} Zone for points!`);
          }
        }
      }

      // Movement & Collision
      const prevX = forklift.position.x;
      const prevZ = forklift.position.z;

      if (Math.abs(forkliftState.speed) > 0.001) {
        const moveDir = Math.sign(forkliftState.speed);
        forklift.rotation.y += forkliftState.rotSpeed * moveDir;
      } else if (forkliftState.rotSpeed !== 0) {
        forklift.rotation.y += forkliftState.rotSpeed * 0.75;
      }

      const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), forklift.rotation.y);
      forklift.position.add(dir.multiplyScalar(forkliftState.speed));

      forklift.position.x = Math.max(-104, Math.min(104, forklift.position.x));
      forklift.position.z = Math.max(-68, Math.min(68, forklift.position.z));

      const fAABB = makeAABB(forklift.position.x, forklift.position.z, forkliftHalfW, forkliftHalfD);
      let collided = false;
      for (let i = 0; i < colliders.length; i++) {
        if (testAABB(fAABB, colliders[i])) {
          collided = true;
          break;
        }
      }
      if (collided) {
        forklift.position.x = prevX;
        forklift.position.z = prevZ;
        forkliftState.speed *= -0.3;
      }

      // Speed gauge
      if (speedFillEl) {
        const pct = Math.abs(forkliftState.speed) / forkliftState.maxSpeed * 100;
        speedFillEl.style.width = pct + '%';
      }

      // Beacon animation
      beacon.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 6) * 0.5;

      // Animate Interactable Box Indicators
      interactableBoxes.forEach((boxGroup) => {
        if (boxGroup.userData.pickedUp) return;
        const { labelSprite, ringMat } = boxGroup.userData;
        labelSprite.position.y = 3.5 + Math.sin(elapsed * 3) * 0.25;
        ringMat.opacity = 0.5 + Math.sin(elapsed * 4) * 0.3;
      });

      // Collectible Orbs
      collectibles.forEach((orb) => {
        if (orb.userData.collected) return;
        orb.position.y = orb.userData.baseY + Math.sin(elapsed * 2.5 + orb.userData.index) * 0.35;
        orb.rotation.y = elapsed * 2 + orb.userData.index;
        if (orb.children[1]) orb.children[1].rotation.x = elapsed * 2.5;

        const d = forklift.position.distanceTo(orb.position);
        if (d < 3.2) {
          orb.userData.collected = true;
          orb.visible = false;
          gameRef.current.score += 25;
          setScore(gameRef.current.score);
          const remaining = collectibles.filter(c => !c.userData.collected).length;
          showMessage(`⭐ Orb collected! +25 Points (${collectibles.length - remaining}/${collectibles.length})`);

          setTimeout(() => {
            orb.userData.collected = false;
            orb.visible = true;
          }, 12000);
        }
      });

      // Delivery Zones Proximity & Color Matching Highlights
      let inDropProximity = false;
      deliveryZones.forEach((zone) => {
        const dx = Math.abs(forklift.position.x - zone.x);
        const dz = Math.abs(forklift.position.z - zone.z);
        const isNear = dx < 4.5 && dz < 4.5;
        const isReadyToDrop = isNear && gameRef.current.carried;

        if (isReadyToDrop) {
          inDropProximity = true;
          zone.padMat.opacity = 0.85 + Math.sin(elapsed * 8) * 0.15;
          zone.beamMat.opacity = 0.5 + Math.sin(elapsed * 8) * 0.2;
          zone.arrow.position.y = 2.2 + Math.sin(elapsed * 8) * 0.4;
          zone.arrow.rotation.y = elapsed * 5;

          zone.defaultLabelSprite.visible = false;
          zone.readyLabelSprite.visible = true;
          zone.readyLabelSprite.position.y = 6.0 + Math.sin(elapsed * 6) * 0.3;
        } else {
          zone.padMat.opacity = 0.35 + Math.sin(elapsed * 2) * 0.15;
          zone.beamMat.opacity = 0.18;
          zone.arrow.position.y = 3.8 + Math.sin(elapsed * 3) * 0.4;
          zone.arrow.rotation.y = elapsed * 2;

          zone.defaultLabelSprite.visible = true;
          zone.readyLabelSprite.visible = false;
        }
      });

      if (inDropProximity !== canDropRef.current) {
        canDropRef.current = inDropProximity;
        setCanDrop(inDropProximity);
      }

      // Day / Night Lighting Targets
      const targetAmbient = night ? 0.12 : 1.2;
      const targetHemi = night ? 0.15 : 1.0;
      const targetSun = night ? 0.05 : 2.8;
      const targetOverhead = night ? 2.5 : 1.2;
      const targetDoor = night ? 0.05 : 1.2;
      const targetHeadlight = night ? 14.0 : 2.5;
      const targetHeadEmissive = night ? 4.5 : 1.5;
      const targetExposure = night ? 0.75 : 1.25;

      const lerpSpeed = 2.5 * delta;
      ambient.intensity += (targetAmbient - ambient.intensity) * lerpSpeed;
      hemi.intensity += (targetHemi - hemi.intensity) * lerpSpeed;
      sunLight.intensity += (targetSun - sunLight.intensity) * lerpSpeed;
      doorLight.intensity += (targetDoor - doorLight.intensity) * lerpSpeed;
      renderer.toneMappingExposure += (targetExposure - renderer.toneMappingExposure) * lerpSpeed;

      overheadLights.forEach((light) => {
        light.intensity += (targetOverhead - light.intensity) * lerpSpeed;
      });
      bulbs.forEach((mat) => {
        const tgt = night ? 0.9 : 0.4;
        mat.opacity += (tgt - mat.opacity) * lerpSpeed;
      });

      spotL.intensity += (targetHeadlight - spotL.intensity) * lerpSpeed;
      spotR.intensity += (targetHeadlight - spotR.intensity) * lerpSpeed;
      hlLensMatL.emissiveIntensity += (targetHeadEmissive - hlLensMatL.emissiveIntensity) * lerpSpeed;
      hlLensMatR.emissiveIntensity += (targetHeadEmissive - hlLensMatR.emissiveIntensity) * lerpSpeed;
      tailMat.emissiveIntensity += ((night ? 1.2 : 0.3) - tailMat.emissiveIntensity) * lerpSpeed;

      const dayBg = new THREE.Color(0x7dd3fc);
      const nightBg = new THREE.Color(0x050515);
      const targetBg = night ? nightBg : dayBg;
      scene.background.lerp(targetBg, lerpSpeed);
      scene.fog.color.lerp(targetBg, lerpSpeed);
      scene.fog.near += ((night ? 40 : 130) - scene.fog.near) * lerpSpeed;
      scene.fog.far += ((night ? 110 : 240) - scene.fog.far) * lerpSpeed;
      skyMat.color.lerp(targetBg, lerpSpeed);

      // Side Conveyors animation
      conveyors.forEach(({ packages, length }) => {
        packages.forEach((pkg) => {
          pkg.position.x += pkg.userData.speed * delta;
          if (pkg.position.x > length / 2) pkg.position.x = -length / 2;
        });
      });

      // ─── Autonomous Ground AMR Mini-Bots Proximity Safety Stop ───
      miniBots.forEach((bot) => {
        const botPos = bot.group.position;
        const distToPlayer = botPos.distanceTo(forklift.position);

        // Check if player forklift is in front or nearby (Proximity threshold < 7.0 units)
        const isPlayerNearby = distToPlayer < 7.0;

        if (isPlayerNearby) {
          // 🛑 SAFETY PROXIMITY STOP!
          bot.isStopped = true;

          // Flash high-intensity red hazard warning lights
          const flash = Math.sin(elapsed * 16) > 0 ? 2.5 : 0.2;
          bot.beaconMat.color.setHex(0xef4444);
          bot.beaconMat.emissive.setHex(0xef4444);
          bot.beaconMat.emissiveIntensity = flash;
          bot.ledMat.color.setHex(0xef4444);
        } else {
          // 🟢 SAFE TRANSIT ON WAREHOUSE FLOOR
          bot.isStopped = false;
          bot.beaconMat.color.setHex(0xf59e0b);
          bot.beaconMat.emissive.setHex(0xf59e0b);
          bot.beaconMat.emissiveIntensity = 0.8;
          bot.ledMat.color.setHex(0x38bdf8);

          // Move along assigned waypoints route
          const targetWp = bot.waypoints[bot.currentWaypointIdx];
          const targetVec = new THREE.Vector3(targetWp[0], 0, targetWp[1]);
          const dir = targetVec.clone().sub(botPos);
          const distToWp = dir.length();

          if (distToWp < 0.8) {
            bot.currentWaypointIdx = (bot.currentWaypointIdx + 1) % bot.waypoints.length;
          } else {
            dir.normalize();
            const moveStep = Math.min(distToWp, bot.speed * delta);
            botPos.add(dir.multiplyScalar(moveStep));

            // Smoothly rotate to face direction of travel
            const targetAngle = Math.atan2(dir.x, dir.z);
            let diff = (targetAngle - bot.group.rotation.y) % (Math.PI * 2);
            if (diff < -Math.PI) diff += Math.PI * 2;
            if (diff > Math.PI) diff -= Math.PI * 2;
            bot.group.rotation.y += diff * Math.min(1, delta * 10);
          }
        }
      });

      // Camera follow
      const mode = cameraModeRef.current;
      if (mode === 'third') {
        const cameraOffset = new THREE.Vector3(0, 14, -22);
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), forklift.rotation.y);
        const targetPos = forklift.position.clone().add(cameraOffset);
        camera.position.lerp(targetPos, 0.08);
        camera.lookAt(forklift.position.clone().add(new THREE.Vector3(0, 3, 0)));
      } else {
        const fpOffset = new THREE.Vector3(0, 4, 1);
        fpOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), forklift.rotation.y);
        camera.position.lerp(forklift.position.clone().add(fpOffset), 0.15);
        const lookDir = new THREE.Vector3(0, 2.5, 10);
        lookDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), forklift.rotation.y);
        camera.lookAt(forklift.position.clone().add(lookDir));
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [showMessage, revealControlsBriefly]);

  const toggleCamera = () => setCameraMode((p) => (p === 'third' ? 'first' : 'third'));
  const toggleDayNight = () => setIsNight((p) => !p);

  const resetGame = () => {
    const { forklift, forkliftState, scene } = sceneRef.current;
    if (forklift) {
      forklift.position.set(0, 0, 10);
      forklift.rotation.set(0, 0, 0);
    }
    if (forkliftState) {
      forkliftState.speed = 0;
      forkliftState.rotSpeed = 0;
    }
    const game = gameRef.current;
    if (game.carried && forklift && scene) {
      forklift.remove(game.carried);
      if (game.carriedGroup) {
        game.carriedGroup.add(game.carried);
        scene.add(game.carriedGroup);
        game.carriedGroup.position.set(0, 0, 15);
        game.carriedGroup.userData.pickedUp = false;
      }
      game.carried = null;
      game.carriedGroup = null;
      setCarried(false);
      setCarriedColor(null);
      setCanDrop(false);
    }
    game.score = 0;
    setScore(0);
    showMessage('🔄 Position & Score Reset!');
  };

  return (
    <div className="warehouse-page">
      <div className="warehouse-canvas" ref={mountRef} />

      {/* Notification Toast */}
      {message && <div className="warehouse-toast">{message}</div>}

      {/* Top-Right Header Bar (Score & Back to Portfolio) */}
      <div className="warehouse-top-right">
        {/* Score Counter Badge */}
        <div className="warehouse-score">
          <span className="warehouse-score__icon">⭐</span>
          <div className="warehouse-score__details">
            <span className="warehouse-score__value">{score}</span>
            <span className="warehouse-score__label">POINTS</span>
          </div>
        </div>

        {/* Back to Portfolio Link */}
        <a href="/" className="warehouse-back-btn">
          ← Back to Portfolio
        </a>
      </div>

      {/* HUD Overlay */}
      <div className="warehouse-hud">
        <div className="warehouse-hud__title">
          <span className="warehouse-hud__icon">🏭</span>
          <h1>Warehouse Simulator</h1>
          <button
            className="warehouse-hud__help-btn"
            onClick={() => revealControlsBriefly(6000)}
            title="Toggle Controls Panel"
          >
            ⌨️ Controls
          </button>
        </div>

        <div className={`warehouse-hud__controls ${showControls ? 'warehouse-hud__controls--visible' : 'warehouse-hud__controls--hidden'}`}>
          <div className="warehouse-hud__key-group">
            <span className="warehouse-hud__label">Move</span>
            <div className="warehouse-hud__keys">
              <kbd>W</kbd>
              <div className="warehouse-hud__key-row">
                <kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
              </div>
            </div>
          </div>
          <div className="warehouse-hud__key-group">
            <span className="warehouse-hud__label">Interact</span>
            <kbd>E</kbd>
          </div>
          <div className="warehouse-hud__key-group">
            <span className="warehouse-hud__label">Camera</span>
            <button className="warehouse-hud__cam-btn" onClick={toggleCamera}>
              {cameraMode === 'third' ? '👁 Third' : '🎯 First'}
            </button>
          </div>
          <div className="warehouse-hud__key-group">
            <span className="warehouse-hud__label">Lights</span>
            <button className={`warehouse-hud__light-btn ${isNight ? 'warehouse-hud__light-btn--night' : ''}`} onClick={toggleDayNight}>
              {isNight ? '🌙 Night' : '☀️ Day'}
            </button>
          </div>
          <div className="warehouse-hud__key-group">
            <span className="warehouse-hud__label">Reset</span>
            <button className="warehouse-hud__reset-btn" onClick={resetGame}>
              🔄 Reset
            </button>
          </div>
        </div>
      </div>

      {/* On-screen Objective HUD Banner */}
      <div className={`warehouse-objective ${canDrop ? 'warehouse-objective--ready' : (carried ? 'warehouse-objective--deliver' : '')}`}>
        <span className="warehouse-objective__icon">{canDrop ? '✅' : (carried ? (carriedColor?.icon || '📦') : '📦')}</span>
        <span className="warehouse-objective__text">
          {canDrop ? (
            <>READY TO UNLOAD! Press <kbd>E</kbd> to deliver parcel</>
          ) : carried ? (
            <>OBJECTIVE: Deliver {carriedColor?.icon} <strong style={{ color: carriedColor?.css }}>{carriedColor?.name}</strong> Cargo to matching {carriedColor?.icon} Drop Zone!</>
          ) : (
            <>OBJECTIVE: Find a color-coded cargo box (🔴 🔵 🟢 🟡 🟣) & press <kbd>E</kbd></>
          )}
        </span>
      </div>

      {/* Carried Indicator */}
      {carried && (
        <div className="warehouse-carried" style={{ borderColor: carriedColor?.css }}>
          <span>{carriedColor?.icon} Carrying {carriedColor?.name} Cargo</span>
          <small>Deliver to matching {carriedColor?.icon} {carriedColor?.name} Zone (+100 PTS)</small>
        </div>
      )}

      {/* Speed Indicator */}
      <div className="warehouse-speed">
        <div className="warehouse-speed__label">FORKLIFT</div>
        <div className="warehouse-speed__bar">
          <div className="warehouse-speed__fill" id="speed-fill" />
        </div>
      </div>
    </div>
  );
}

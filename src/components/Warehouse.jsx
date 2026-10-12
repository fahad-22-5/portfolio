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
function createLabelSprite(text, textColor = '#fbbf24', borderColor = '#f59e0b', bgColor = 'rgba(15, 23, 42, 0.94)') {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(8, 8, 544, 94, 22);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Subtle inner highlight frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(14, 14, 532, 82, 18);
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 28px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, 280, 55);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(8.4, 1.68, 1);
  return sprite;
}

/* ──────────────────────────────────────
   HELPER — Branded Tech Crate Canvas Texture Generator
   ────────────────────────────────────── */
function createBrandedCrateTexture(crateInfo, faceType = 'side') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Container base body color
  ctx.fillStyle = crateInfo.css;
  ctx.fillRect(0, 0, 512, 512);

  // Heavy industrial metallic frame around edge
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 32;
  ctx.strokeRect(16, 16, 480, 480);

  // Dark inner bevel
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, 440, 440);

  // Industrial Corner brackets (L-plates)
  ctx.fillStyle = '#1e293b';
  const cSize = 75;
  const cThick = 28;
  ctx.fillRect(0, 0, cSize, cThick);
  ctx.fillRect(0, 0, cThick, cSize);
  ctx.fillRect(512 - cSize, 0, cSize, cThick);
  ctx.fillRect(512 - cThick, 0, cThick, cSize);
  ctx.fillRect(0, 512 - cThick, cSize, cThick);
  ctx.fillRect(0, 512 - cSize, cThick, cSize);
  ctx.fillRect(512 - cSize, 512 - cThick, cSize, cThick);
  ctx.fillRect(512 - cThick, 512 - cSize, cThick, cSize);

  // Steel bolt rivets
  ctx.fillStyle = '#cbd5e1';
  [[48, 48], [464, 48], [48, 464], [464, 464], [256, 24], [256, 488], [24, 256], [488, 256]].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#475569';
    ctx.stroke();
  });

  if (faceType === 'top') {
    // Top face: Caution stripes & Handling markings
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(60, 60, 392, 392, 16);
    ctx.fill();
    ctx.strokeStyle = crateInfo.css;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬆  ⬆', 256, 170);

    ctx.fillStyle = crateInfo.css;
    ctx.font = 'bold 32px "Space Grotesk", sans-serif';
    ctx.fillText(crateInfo.shortName.toUpperCase(), 256, 260);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('DO NOT STACK > 3 UNITS', 256, 310);

    for (let i = 80; i < 432; i += 32) {
      ctx.fillStyle = (i / 32) % 2 === 0 ? '#fbbf24' : '#0f172a';
      ctx.fillRect(i, 360, 24, 30);
    }
  } else {
    // Front & Side face: High-tech stencil display plate
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(50, 70, 412, 372, 16);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Header badge strip
    ctx.fillStyle = crateInfo.css;
    ctx.fillRect(50, 70, 412, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(crateInfo.badge, 256, 91);

    // Big Icon
    ctx.font = '76px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillText(crateInfo.subIcon || crateInfo.icon, 256, 185);

    // Brand Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.fillText(crateInfo.shortName, 256, 255);

    // Stencil Tagline
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(crateInfo.tagline.toUpperCase(), 256, 295);

    // Serial & Barcode
    ctx.fillStyle = '#64748b';
    ctx.font = '14px monospace';
    ctx.fillText(`SN: ${crateInfo.id.toUpperCase()}-2026-X99`, 256, 335);

    // Barcode lines
    const barcodeY = 360;
    ctx.fillStyle = '#ffffff';
    let bx = 110;
    while (bx < 402) {
      const barW = (bx % 8 === 0 || bx % 12 === 0) ? 6 : (bx % 5 === 0 ? 4 : 2);
      ctx.fillRect(bx, barcodeY, barW, 45);
      bx += barW + 4;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const crateTextureCache = {};
function getCrateTextures(crateInfo) {
  if (!crateTextureCache[crateInfo.id]) {
    const sideTex = createBrandedCrateTexture(crateInfo, 'side');
    const topTex = createBrandedCrateTexture(crateInfo, 'top');
    crateTextureCache[crateInfo.id] = { sideTex, topTex };
  }
  return crateTextureCache[crateInfo.id];
}

/* ──────────────────────────────────────
   HELPER — 12x12 Drop Zone Graphic Landing Pad Texture
   ────────────────────────────────────── */
function createDropPadTexture(colorType) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark industrial concrete floor background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  // Outer border with diagonal hazard zebra stripes
  const stripeWidth = 28;
  for (let i = -512; i < 1024; i += 40) {
    ctx.fillStyle = colorType.css;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 20, 0);
    ctx.lineTo(i + 20 - 512, 512);
    ctx.lineTo(i - 512, 512);
    ctx.closePath();
    ctx.fill();
  }

  // Inner pad mask
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(stripeWidth, stripeWidth, 512 - stripeWidth * 2, 512 - stripeWidth * 2);

  // Glowing neon frame
  ctx.strokeStyle = colorType.css;
  ctx.lineWidth = 10;
  ctx.strokeRect(stripeWidth + 6, stripeWidth + 6, 512 - (stripeWidth + 6) * 2, 512 - (stripeWidth + 6) * 2);

  // Concentric target circles
  ctx.beginPath();
  ctx.arc(256, 256, 190, 0, Math.PI * 2);
  ctx.strokeStyle = colorType.css;
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(256, 256, 130, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Crosshairs
  ctx.strokeStyle = colorType.css;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(256, 50); ctx.lineTo(256, 462);
  ctx.moveTo(50, 256); ctx.lineTo(462, 256);
  ctx.stroke();

  // Center solid disc
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.arc(256, 256, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Big Icon in center
  ctx.font = '70px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(colorType.subIcon || colorType.icon, 256, 228);

  // Big Zone Name stencil
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Space Grotesk", sans-serif';
  ctx.fillText(colorType.shortName.toUpperCase(), 256, 298);

  // Stenciled "▼ UNLOAD BAY ▼" banner
  ctx.fillStyle = colorType.css;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('▼ UNLOAD BAY ▼', 256, 328);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const dropPadTextureCache = {};
function getDropPadTexture(colorType) {
  if (!dropPadTextureCache[colorType.id]) {
    dropPadTextureCache[colorType.id] = createDropPadTexture(colorType);
  }
  return dropPadTextureCache[colorType.id];
}

/* ──────────────────────────────────────
   HELPER — Authentic Polished Epoxy Concrete Warehouse Floor Texture
   ────────────────────────────────────── */
function createWarehouseFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // 1. Base Dark Industrial Concrete (sealed, hardened epoxy finish)
  ctx.fillStyle = '#1e2532';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Realistic concrete mottled texture & fine aggregate noise
  for (let y = 0; y < 1024; y += 8) {
    for (let x = 0; x < 1024; x += 8) {
      const rand = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = rand - Math.floor(rand);
      if (noise > 0.65) {
        ctx.fillStyle = noise > 0.85 ? 'rgba(56, 68, 88, 0.22)' : 'rgba(15, 20, 28, 0.25)';
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }

  // 3. Concrete Slab Expansion Joints (4 major slabs per tile: 512x512 each)
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0d131d'; // deep sealant groove
  ctx.beginPath();
  ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
  ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; // bevel highlight
  ctx.beginPath();
  ctx.moveTo(514, 0); ctx.lineTo(514, 1024);
  ctx.moveTo(0, 514); ctx.lineTo(1024, 514);
  ctx.stroke();

  // Outer slab seam edges
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0d131d';
  ctx.strokeRect(0, 0, 1024, 1024);

  // 4. Heavy-Duty Painted Transit Lines & Forklift Highways
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(160, 0, 16, 1024); // Left lane line
  ctx.fillRect(848, 0, 16, 1024); // Right lane line

  // Dashed white center line for two-way forklift traffic
  ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  for (let y = 30; y < 1024; y += 90) {
    ctx.fillRect(504, y, 16, 50);
  }

  // 5. Diagonal Yellow & Black Safety Hazard Chevrons (Staging buffer zone)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 470, 160, 84);
  ctx.clip();
  for (let i = -160; i < 300; i += 32) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(i, 470);
    ctx.lineTo(i + 16, 470);
    ctx.lineTo(i - 84 + 16, 554);
    ctx.lineTo(i - 84, 554);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(i + 16, 470);
    ctx.lineTo(i + 32, 470);
    ctx.lineTo(i - 84 + 32, 554);
    ctx.lineTo(i - 84 + 16, 554);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Right side hazard buffer
  ctx.save();
  ctx.beginPath();
  ctx.rect(864, 470, 160, 84);
  ctx.clip();
  for (let i = 700; i < 1100; i += 32) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(i, 470);
    ctx.lineTo(i + 16, 470);
    ctx.lineTo(i - 84 + 16, 554);
    ctx.lineTo(i - 84, 554);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(i + 16, 470);
    ctx.lineTo(i + 32, 470);
    ctx.lineTo(i - 84 + 32, 554);
    ctx.lineTo(i - 84 + 16, 554);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 6. Industrial Floor Stencils (Crisp painted lettering on epoxy)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Stencil 1: Speed limit roundel
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(330, 260, 68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.beginPath();
  ctx.arc(330, 260, 63, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Space Grotesk", monospace';
  ctx.fillText('MAX', 330, 242);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 34px "Space Grotesk", monospace';
  ctx.fillText('10', 330, 278);

  // Stencil 2: Directional Transit Arrows
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  // Arrow north on right lane
  ctx.beginPath();
  ctx.moveTo(680, 210);
  ctx.lineTo(730, 270);
  ctx.lineTo(700, 270);
  ctx.lineTo(700, 320);
  ctx.lineTo(660, 320);
  ctx.lineTo(660, 270);
  ctx.lineTo(630, 270);
  ctx.closePath();
  ctx.fill();

  // Arrow south on left lane
  ctx.beginPath();
  ctx.moveTo(330, 780);
  ctx.lineTo(380, 720);
  ctx.lineTo(350, 720);
  ctx.lineTo(350, 670);
  ctx.lineTo(310, 670);
  ctx.lineTo(310, 720);
  ctx.lineTo(280, 720);
  ctx.closePath();
  ctx.fill();

  // Stencil 3: Painted Text Markings
  ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('⚡ FORKLIFT TRANSIT ONLY ⚡', 680, 750);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('KEEP CLEAR • 24/7 SORTATION', 680, 785);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 5);
  texture.needsUpdate = true;
  return texture;
}

let warehouseFloorTextureCache = null;
function getWarehouseFloorTexture() {
  if (!warehouseFloorTextureCache) {
    warehouseFloorTextureCache = createWarehouseFloorTexture();
  }
  return warehouseFloorTextureCache;
}

/* ──────────────────────────────────────
   HELPER — Industrial Corrugated Metal Sandwich Cladding Wall Texture
   ────────────────────────────────────── */
function createWarehouseWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 1. Upper Wall Base: Industrial Corrugated Architectural Metal Cladding
  ctx.fillStyle = '#2b3544';
  ctx.fillRect(0, 0, 1024, 380);

  // 2. Vertical Corrugated Cladding Ribs (Realistic 3D light & shadow lines every 16px)
  for (let x = 0; x < 1024; x += 16) {
    // shadow rib
    ctx.fillStyle = '#1e2633';
    ctx.fillRect(x, 0, 4, 380);
    // highlight rib
    ctx.fillStyle = '#3e4d61';
    ctx.fillRect(x + 4, 0, 4, 380);
    // panel face
    ctx.fillStyle = '#2d3848';
    ctx.fillRect(x + 8, 0, 8, 380);
  }

  // 3. Horizontal Structural Girts & Fastener Rivet Lines
  [90, 190, 290].forEach((gy) => {
    ctx.fillStyle = '#161d28';
    ctx.fillRect(0, gy, 1024, 8);
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, gy + 8, 1024, 2);
    // Rivets / Fastener bolts
    ctx.fillStyle = '#94a3b8';
    for (let rx = 8; rx < 1024; rx += 32) {
      ctx.beginPath();
      ctx.arc(rx, gy + 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 4. Distribution Center High-Bay Signage Band (across middle)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(60, 40, 904, 110);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 40, 904, 110);

  // Top header in safety cyan
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(60, 40, 904, 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Space Grotesk", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('  ● LOGISTICS DISTRIBUTION CENTER • SECTOR 04 • ZONE HIGH-BAY', 70, 54);

  // Main bold Facility Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Space Grotesk", sans-serif';
  ctx.fillText('AUTOMATED LOGISTICS SORTATION HUB', 85, 100);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('AUTOMATED DIGITAL TWIN FACILITY', 940, 130);

  // Safety Placards & Warning Signs
  // Sign 1: AGV Warning
  ctx.fillStyle = '#facc15';
  ctx.fillRect(80, 215, 260, 60);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.strokeRect(80, 215, 260, 60);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚠️ CAUTION: FORKLIFTS & AGVs', 210, 235);
  ctx.font = '12px monospace';
  ctx.fillText('AUTOMATED TRAFFIC PRIORITY', 210, 258);

  // Sign 2: Fire Hose Reel & First Aid
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(400, 215, 200, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('🧯 FIRE HOSE REEL', 500, 240);
  ctx.font = '12px monospace';
  ctx.fillText('STATION #04', 500, 260);

  // Sign 3: Emergency Exit
  ctx.fillStyle = '#10b981';
  ctx.fillRect(660, 215, 240, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('EMERGENCY EXIT 🚪 →', 780, 240);
  ctx.font = '12px monospace';
  ctx.fillText('KEEP PASSAGEWAY CLEAR', 780, 260);

  // 5. Lower Impact Wainscot (bottom 132px, y = 380 to 512)
  ctx.fillStyle = '#131b26';
  ctx.fillRect(0, 380, 1024, 132);

  // Heavy Yellow & Black Safety Impact Crash Rail (y = 380 to 420)
  for (let i = -100; i < 1124; i += 40) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(i, 380);
    ctx.lineTo(i + 20, 380);
    ctx.lineTo(i + 20 - 40, 420);
    ctx.lineTo(i - 40, 420);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(i + 20, 380);
    ctx.lineTo(i + 40, 380);
    ctx.lineTo(i + 40 - 40, 420);
    ctx.lineTo(i + 20 - 40, 420);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 376, 1024, 4); // Top yellow trim
  ctx.fillRect(0, 420, 1024, 3); // Bottom yellow trim

  // Stencil along base
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CRASH PROTECTION BARRIER • RATED 50 kN • DO NOT OBSTRUCT PERIMETER', 40, 460);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

let warehouseWallTextureCache = null;
function getWarehouseWallTexture() {
  if (!warehouseWallTextureCache) {
    warehouseWallTextureCache = createWarehouseWallTexture();
  }
  return warehouseWallTextureCache;
}

/* ──────────────────────────────────────
   HELPER — Commercial Loading Dock Roll-Up Sectional Door Texture
   ────────────────────────────────────── */
function createLoadingDockDoorTexture(dockNumber) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark industrial garage door frame
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  // Portal clearance header
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(20, 15, 472, 45);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "Space Grotesk", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`▲ DOCK BAY 0${dockNumber} • CLEARANCE 4.8M ▲`, 256, 37);

  // Overhead roll-up sectional door (ribbed metal slats)
  const slatHeight = 22;
  for (let y = 70; y < 500; y += slatHeight) {
    ctx.fillStyle = y % 44 === 0 ? '#1e293b' : '#273549';
    ctx.fillRect(25, y, 462, slatHeight - 2);
    // Highlight top of slat
    ctx.fillStyle = '#475569';
    ctx.fillRect(25, y, 462, 2);
    // Dark shadow groove
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(25, y + slatHeight - 2, 462, 2);
  }

  // Large Stenciled Bay Number in middle of the door
  ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
  ctx.font = 'bold 72px "Space Grotesk", sans-serif';
  ctx.fillText(`0${dockNumber}`, 256, 260);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('OUTBOUND FREIGHT', 256, 320);

  // Yellow and black bottom bumper seal
  for (let i = 25; i < 487; i += 24) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(i, 490, 12, 18);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(i + 12, 490, 12, 18);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const dockDoorTextureCache = {};
function getDockDoorTexture(dockNum) {
  if (!dockDoorTextureCache[dockNum]) {
    dockDoorTextureCache[dockNum] = createLoadingDockDoorTexture(dockNum);
  }
  return dockDoorTextureCache[dockNum];
}

/* ──────────────────────────────────────
   HELPER — Proximity-based Header Popups
   ────────────────────────────────────── */
function updateHeaderProximity(sprite, isNear, delta, baseScale = { x: 7.5, y: 1.5 }) {
  if (!sprite) return;
  const targetX = isNear ? baseScale.x : 0;
  const targetY = isNear ? baseScale.y : 0;

  if (isNear && !sprite.visible) {
    sprite.visible = true;
  }

  sprite.scale.x = THREE.MathUtils.lerp(sprite.scale.x, targetX, Math.min(1, delta * 9));
  sprite.scale.y = THREE.MathUtils.lerp(sprite.scale.y, targetY, Math.min(1, delta * 9));
  sprite.scale.z = 1;

  if (!isNear && sprite.scale.x < 0.05) {
    sprite.visible = false;
    sprite.scale.set(0, 0, 0);
  }
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
   TECH STACK CRATES (Interactive Resume Deliveries)
   ────────────────────────────────────── */
const TECH_CRATES = {
  DOTNET: {
    id: 'dotnet',
    name: '.NET / C#',
    title: '.NET / C# Crate',
    shortName: '.NET / C#',
    hex: 0x8b5cf6,
    css: '#8b5cf6',
    icon: '🟣',
    subIcon: '🟣',
    badge: '.NET / C# CRATE',
    zoneName: '.NET / C# ARCHITECTURE ZONE',
    tagline: 'High-Concurrency Backend',
    reveal: 'Built high-concurrency Windows services, REST APIs, and backend automation.',
    milestoneTitle: 'HIGH-CONCURRENCY .NET / C# ARCHITECT',
    milestoneStat: '100,000+ Parcels/Day • Peak 10,000/hr',
    tech: ['.NET 8', 'C#', 'Windows Services', 'REST APIs', 'High-Concurrency'],
    points: 200,
  },
  RABBITMQ: {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    title: 'RabbitMQ Message Box',
    shortName: 'RabbitMQ',
    hex: 0xf97316,
    css: '#f97316',
    icon: '🟠',
    subIcon: '🐇',
    badge: 'RABBITMQ MESSAGE BOX',
    zoneName: 'RABBITMQ EVENT BUS STATION',
    tagline: 'Async Message Pipeline',
    reveal: 'Engineered asynchronous message pipelines for real-time warehouse sortation.',
    milestoneTitle: 'DISTRIBUTED RABBITMQ EVENT PIPELINES',
    milestoneStat: 'Zero-Loss Message Queues • Real-Time Sortation',
    tech: ['RabbitMQ', 'Event-Driven Architecture', 'Message Queues', 'Async Pipelines'],
    points: 350,
  },
  PLC: {
    id: 'plc',
    name: 'PLC Hardware',
    title: 'PLC Hardware Crate',
    shortName: 'PLC Hardware',
    hex: 0x0284c7,
    css: '#0284c7',
    icon: '🔵',
    subIcon: '⚙️',
    badge: 'PLC HARDWARE CRATE',
    zoneName: 'PLC HARDWARE CONVEYOR BAY',
    tagline: 'Conveyor Hardware Controls',
    reveal: 'Wrote PLC communication layers directly interfacing software with warehouse sortation conveyor belts.',
    milestoneTitle: 'LOW-LATENCY PLC HARDWARE BRIDGE',
    milestoneStat: '<5ms Latency • Conveyor Sensors & Diverters',
    tech: ['PLC Layer', 'Industrial Automation', 'Conveyor Controls', 'Hardware Protocols'],
    points: 300,
  },
  MADRID: {
    id: 'madrid',
    name: 'Madrid Deployment',
    title: 'Madrid Deployment Cargo',
    shortName: 'Madrid Cargo',
    hex: 0xf59e0b,
    css: '#f59e0b',
    icon: '🟡',
    subIcon: '🇪🇸',
    badge: 'MADRID DEPLOYMENT CARGO',
    zoneName: 'MADRID E-COMMERCE LOGISTICS HUB',
    tagline: '2.5 Mo. European Deployment',
    reveal: 'Managed a 2.5-month on-site European deployment in Madrid, Spain for last-mile logistics.',
    milestoneTitle: 'MADRID ON-SITE EUROPEAN DEPLOYMENT',
    milestoneStat: '2.5 Months On-Site (Spain) • Cross-Border Hub',
    tech: ['On-Site Deployment', 'Madrid, Spain', 'Last-Mile Logistics', 'Cross-Border'],
    points: 250,
  },
  PTL: {
    id: 'ptl',
    name: 'PTL Restock',
    title: 'PTL Restock Crate',
    shortName: 'PTL Restock',
    hex: 0x10b981,
    css: '#10b981',
    icon: '🟢',
    subIcon: '📦',
    badge: 'PUT-TO-LIGHT RESTOCK',
    zoneName: 'PUT-TO-LIGHT RESTOCK BAY',
    tagline: 'Light-Guided Sortation',
    reveal: 'Delivered complete Put-to-Light sorting workflows, digital LED light guidance, and optimized SQL stored procedures.',
    milestoneTitle: 'END-TO-END PUT-TO-LIGHT (PTL) AUTOMATION',
    milestoneStat: 'Digital LED Picking • 99.9% Order Accuracy',
    tech: ['Put-to-Light (PTL)', 'Pick-to-Light', 'SQL Stored Procedures', 'Fulfillment'],
    points: 400,
  },
};


/* ──────────────────────────────────────
   THE 100K SHIFT — CAREER ORDERS & MILESTONES
   ────────────────────────────────────── */
const SHIFT_ORDERS = [
  {
    id: 1,
    orderCode: "ORD-101",
    title: ".NET / C# Core Sortation Engine",
    client: "Tier-1 High-Volume Supply Chain",
    targetColor: TECH_CRATES.DOTNET,
    targetZoneName: TECH_CRATES.DOTNET.zoneName,
    icon: "🟣",
    badge: "Core Architecture Lead",
    milestoneTitle: "HIGH-CONCURRENCY .NET / C# ARCHITECT",
    milestoneStat: "100,000+ Parcels/Day Peak",
    milestoneStory: "Built high-concurrency Windows services, REST APIs, and backend automation.",
    tech: [".NET 8", "C#", "Windows Services", "REST APIs", "High-Concurrency"],
    points: 200,
  },
  {
    id: 2,
    orderCode: "ORD-102",
    title: "European Last-Mile Logistics (Madrid)",
    client: "Madrid E-Commerce Cross-Border Hub",
    targetColor: TECH_CRATES.MADRID,
    targetZoneName: TECH_CRATES.MADRID.zoneName,
    icon: "🇪🇸",
    badge: "International Deployer",
    milestoneTitle: "MADRID ON-SITE INTEGRATION",
    milestoneStat: "2.5 Months On-Site (Spain)",
    milestoneStory: "Managed a 2.5-month on-site European deployment in Madrid, Spain for last-mile logistics.",
    tech: ["On-Site Deployment", "Madrid, Spain", "Cross-Border Logistics", "REST APIs"],
    points: 250,
  },
  {
    id: 3,
    orderCode: "ORD-103",
    title: "Hardware PLC Interface Layer",
    client: "Physical Industrial Sortation Lines",
    targetColor: TECH_CRATES.PLC,
    targetZoneName: TECH_CRATES.PLC.zoneName,
    icon: "⚙️",
    badge: "Hardware-Software Bridge",
    milestoneTitle: "LOW-LATENCY PLC CONTROLS",
    milestoneStat: "<5ms Response Time",
    milestoneStory: "Wrote PLC communication layers directly interfacing software with warehouse sortation conveyor belts.",
    tech: ["PLC Layer", "Conveyor Automation", "Low Latency", "Hardware I/O"],
    points: 300,
  },
  {
    id: 4,
    orderCode: "ORD-104",
    title: "Distributed RabbitMQ Event Bus",
    client: "FMCG & Quick Commerce Networks",
    targetColor: TECH_CRATES.RABBITMQ,
    targetZoneName: TECH_CRATES.RABBITMQ.zoneName,
    icon: "🐇",
    badge: "Distributed Systems Pro",
    milestoneTitle: "RABBITMQ ASYNC PIPELINES",
    milestoneStat: "Zero-Loss Message Queues",
    milestoneStory: "Engineered asynchronous message pipelines for real-time warehouse sortation.",
    tech: ["RabbitMQ", "Event-Driven", "Optimized SQL", "Message Queues"],
    points: 350,
  },
  {
    id: 5,
    orderCode: "ORD-105",
    title: "Put-to-Light (PTL) System Restock",
    client: "Omnichannel Fulfillment Hub",
    targetColor: TECH_CRATES.PTL,
    targetZoneName: TECH_CRATES.PTL.zoneName,
    icon: "📦",
    badge: "Senior Systems Specialist",
    milestoneTitle: "END-TO-END PTL AUTOMATION",
    milestoneStat: "LED Pick & Place Systems",
    milestoneStory: "Delivered complete Put-to-Light sorting workflows, digital LED light guidance, and optimized SQL stored procedures.",
    tech: ["Put-to-Light (PTL)", "LED Guidance", "Pick-to-Tote", "Stored Procedures"],
    points: 400,
  },
];

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

  // Loading Screen State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(15);
  const [loadingStage, setLoadingStage] = useState('Initializing Digital Twin Telemetry...');
  const [isLoaderMounted, setIsLoaderMounted] = useState(true);

  // The 100k Shift State
  const [shiftIndex, setShiftIndex] = useState(0);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [shiftCompleted, setShiftCompleted] = useState(false);
  const [showShiftCard, setShowShiftCard] = useState(true);

  const shiftIndexRef = useRef(0);
  const completedOrdersRef = useRef([]);
  const shiftCompletedRef = useRef(false);
  useEffect(() => { shiftIndexRef.current = shiftIndex; }, [shiftIndex]);
  useEffect(() => { completedOrdersRef.current = completedOrders; }, [completedOrders]);
  useEffect(() => { shiftCompletedRef.current = shiftCompleted; }, [shiftCompleted]);

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

  const handleCompleteShiftOrder = useCallback((order) => {
    setActiveMilestone(order);
    setCompletedOrders((prev) => {
      if (prev.includes(order.id)) return prev;
      return [...prev, order.id];
    });

    setShiftIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex >= SHIFT_ORDERS.length) {
        setShiftCompleted(true);
        return prevIndex;
      }
      return nextIndex;
    });

    showMessage(`🏆 MILESTONE UNLOCKED: ${order.milestoneTitle} (+${order.points} PTS)!`, 5000);
  }, [showMessage]);

  const restartShift = useCallback(() => {
    setShiftIndex(0);
    setCompletedOrders([]);
    setActiveMilestone(null);
    setShiftCompleted(false);
    showMessage('⚡ New Shift Started: Order #1 Active!');
  }, [showMessage]);

  // Reveal controls when loading completes
  useEffect(() => {
    if (!isLoading) {
      revealControlsBriefly(6000);
    }
    return () => {
      if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current);
    };
  }, [isLoading, revealControlsBriefly]);

  const collidersRef = useRef([]);

  /* ────────────────────────────────────
     MAIN THREE.JS SCENE SETUP & ANIMATION
     ──────────────────────────────────── */
  useEffect(() => {
    trackEvent('warehouse_simulation_started');
    const mount = mountRef.current;
    if (!mount) return;

    let isDisposed = false;
    const startTime = Date.now();
    let isFirstFrame = true;

    const LOADING_MESSAGES = [
      "Spinning up conveyor belts & sortation lines...",
      "Calibrating electric forklift kinematics...",
      "Synthesizing high-bay storage racks...",
      "Configuring Put-to-Light (PTL) sortation...",
      "Connecting ASRS automated shuttle matrices...",
      "Stacking .NET & RabbitMQ tech crates...",
      "Powering overhead warehouse lights...",
      "Establishing PLC telemetry connection...",
      "Preparing warehouse floor • Launching simulation...",
    ];

    let currentProgress = 15;
    let messageIdx = 0;
    setLoadingStage(LOADING_MESSAGES[0]);

    const progressTimer = setInterval(() => {
      currentProgress = Math.min(currentProgress + Math.floor(Math.random() * 5 + 3), 95);
      setLoadingProgress(currentProgress);
    }, 90);

    const messageTimer = setInterval(() => {
      messageIdx = (messageIdx + 1) % (LOADING_MESSAGES.length - 1);
      setLoadingStage(LOADING_MESSAGES[messageIdx]);
    }, 550);

    let animId = null;
    let onKeyDown = null;
    let onKeyUp = null;
    let onResize = null;
    let renderer = null;

    // Defer heavy Three.js construction to the next frame/tick
    // so the browser paints the loading screen immediately without freezing the main page!
    const initTimer = setTimeout(() => {
      if (isDisposed || !mountRef.current) return;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131a26);
    scene.fog = new THREE.Fog(0x131a26, 95, 230);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 450);
    camera.position.set(0, 30, 80);
    camera.lookAt(0, 5, 0);

    collidersRef.current = [];
    const colliders = collidersRef.current;

    // ─── 1. Authentic Polished Epoxy Concrete Warehouse Floor (220 x 150 Footprint) ───
    const floorGeo = new THREE.PlaneGeometry(220, 150);
    const floorTex = getWarehouseFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.28,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ─── 2. Industrial Architectural Cladding Building Structure ───
    const wallTexLong = getWarehouseWallTexture().clone();
    wallTexLong.wrapS = THREE.RepeatWrapping;
    wallTexLong.repeat.set(5.5, 1);
    wallTexLong.needsUpdate = true;

    const wallTexShort = getWarehouseWallTexture().clone();
    wallTexShort.wrapS = THREE.RepeatWrapping;
    wallTexShort.repeat.set(3.8, 1);
    wallTexShort.needsUpdate = true;

    const wallMatLong = new THREE.MeshStandardMaterial({
      map: wallTexLong,
      roughness: 0.45,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });

    const wallMatShort = new THREE.MeshStandardMaterial({
      map: wallTexShort,
      roughness: 0.45,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 });
    const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.3 });

    // Back Wall (Z = -75)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(220, 25), wallMatLong);
    backWall.position.set(0, 12.5, -75); backWall.receiveShadow = true; scene.add(backWall);
    const trimBack = new THREE.Mesh(new THREE.BoxGeometry(220, 1.2, 0.4), trimMat);
    trimBack.position.set(0, 0.6, -74.8); scene.add(trimBack);

    // Left and Right Corrugated Walls
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(150, 25), wallMatShort);
    leftWall.position.set(-110, 12.5, 0); leftWall.rotation.y = Math.PI / 2; scene.add(leftWall);
    const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 150), trimMat);
    trimLeft.position.set(-109.8, 0.6, 0); scene.add(trimLeft);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(150, 25), wallMatShort);
    rightWall.position.set(110, 12.5, 0); rightWall.rotation.y = -Math.PI / 2; scene.add(rightWall);
    const trimRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 150), trimMat);
    trimRight.position.set(109.8, 0.6, 0); scene.add(trimRight);

    // Front Wall with Commercial Loading Docks (Z = 75)
    const frontLeft = new THREE.Mesh(new THREE.PlaneGeometry(75, 25), wallMatShort);
    frontLeft.position.set(-72.5, 12.5, 75); frontLeft.rotation.y = Math.PI; scene.add(frontLeft);
    const frontRight = new THREE.Mesh(new THREE.PlaneGeometry(75, 25), wallMatShort);
    frontRight.position.set(72.5, 12.5, 75); frontRight.rotation.y = Math.PI; scene.add(frontRight);

    // Overhead Header Wall above loading bays
    const dockHeaderWall = new THREE.Mesh(new THREE.PlaneGeometry(70, 7), wallMatShort);
    dockHeaderWall.position.set(0, 21.5, 75); dockHeaderWall.rotation.y = Math.PI; scene.add(dockHeaderWall);

    // 4 Functional 3D Loading Dock Bays (Docks 01 to 04)
    [-24, -8, 8, 24].forEach((dockX, idx) => {
      const dockNum = idx + 1;
      const dockDoorTex = getDockDoorTexture(dockNum);
      const dockDoorMat = new THREE.MeshStandardMaterial({
        map: dockDoorTex,
        roughness: 0.4,
        metalness: 0.35,
        side: THREE.DoubleSide,
      });

      // Sectional Roll-up Door Mesh
      const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 17.5), dockDoorMat);
      doorMesh.position.set(dockX, 9.0, 74.9);
      doorMesh.rotation.y = Math.PI;
      scene.add(doorMesh);

      // Yellow Portal Clearance Frame
      const frameBeam = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.8, 0.6), safetyYellowMat);
      frameBeam.position.set(dockX, 18.0, 74.7);
      scene.add(frameBeam);

      const framePostL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 18.0, 0.6), safetyYellowMat);
      framePostL.position.set(dockX - 7.0, 9.0, 74.7);
      scene.add(framePostL);

      const framePostR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 18.0, 0.6), safetyYellowMat);
      framePostR.position.set(dockX + 7.0, 9.0, 74.7);
      scene.add(framePostR);

      // Dual Dock Signal Lights (Red top, Green bottom)
      const sigHousing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
      sigHousing.position.set(dockX + 7.6, 12.0, 74.5);
      scene.add(sigHousing);

      const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      redLight.position.set(dockX + 7.6, 12.35, 74.3);
      scene.add(redLight);

      const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
      greenLight.position.set(dockX + 7.6, 11.65, 74.3);
      scene.add(greenLight);

      // Heavy Rubber Dock Bumpers at floor level
      [-6.5, 6.5].forEach((bx) => {
        const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }));
        bumper.position.set(dockX + bx, 0.7, 75.2);
        scene.add(bumper);
      });
    });

    // ─── 3. Roof Deck, Steel Trusses & Air Ducts ───
    // Dark Corrugated Steel Ceiling Deck (encloses warehouse)
    const roofGeo = new THREE.PlaneGeometry(220, 150);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x141d28,
      roughness: 0.7,
      metalness: 0.4,
      side: THREE.DoubleSide,
    });
    const warehouseRoofDeck = new THREE.Mesh(roofGeo, roofMat);
    warehouseRoofDeck.position.set(0, 25, 0);
    warehouseRoofDeck.rotation.x = Math.PI / 2;
    scene.add(warehouseRoofDeck);

    // Structural Open-Web Steel Lattice Trusses (across span)
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35 });
    [-60, -35, -10, 15, 40, 65].forEach((tz) => {
      // Top chord
      const topChord = new THREE.Mesh(new THREE.BoxGeometry(220, 0.5, 0.5), trussMat);
      topChord.position.set(0, 24.6, tz); scene.add(topChord);
      // Bottom chord
      const botChord = new THREE.Mesh(new THREE.BoxGeometry(220, 0.4, 0.4), trussMat);
      botChord.position.set(0, 21.2, tz); scene.add(botChord);
      // Diagonal lattice web struts
      for (let tx = -105; tx < 105; tx += 10) {
        const strut1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), trussMat);
        strut1.position.set(tx + 2.5, 22.9, tz);
        strut1.rotation.z = Math.PI / 4;
        scene.add(strut1);
        const strut2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), trussMat);
        strut2.position.set(tx + 7.5, 22.9, tz);
        strut2.rotation.z = -Math.PI / 4;
        scene.add(strut2);
      }
    });

    // Overhead Galvanized Air Conditioning Ventilation Ducts
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.25 });
    const ductHangerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
    [-45, 45].forEach((dx) => {
      const ductGeo = new THREE.CylinderGeometry(0.85, 0.85, 210, 20);
      const duct = new THREE.Mesh(ductGeo, ductMat);
      duct.rotation.z = Math.PI / 2;
      duct.position.set(0, 22.2, dx);
      scene.add(duct);

      for (let dz = -90; dz <= 90; dz += 15) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.08, 8, 20), ductMat);
        ring.position.set(dz, 22.2, dx);
        ring.rotation.y = Math.PI / 2;
        scene.add(ring);

        const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6), ductHangerMat);
        hanger.position.set(dz, 23.6, dx);
        scene.add(hanger);

        if (dz % 30 === 0) {
          const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), ductMat);
          diffuser.position.set(dz, 21.2, dx);
          scene.add(diffuser);
        }
      }
    });

    // Two-Tone Structural Columns with Safety Yellow Base & Impact Bollards
    const colUpperMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const colBaseMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.3 });
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.3 });
    const bollardBandMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    [
      [-108, -73], [108, -73], [-108, 73], [108, 73],
      [-50, -73], [50, -73], [-50, 73], [50, 73],
      [-50, 0], [50, 0], [0, -35], [0, 35],
    ].forEach(([x, z]) => {
      const colUpper = new THREE.Mesh(new THREE.BoxGeometry(1.6, 22, 1.6), colUpperMat);
      colUpper.position.set(x, 14, z); colUpper.castShadow = true; scene.add(colUpper);
      const colBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.0, 2.0), colBaseMat);
      colBase.position.set(x, 1.5, z); colBase.castShadow = true; scene.add(colBase);

      // Yellow safety bollards in front of pillars
      [-1.6, 1.6].forEach((bx) => {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 12), bollardMat);
        bollard.position.set(x + bx, 0.7, z + (z < 0 ? 1.8 : -1.8));
        scene.add(bollard);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.2, 12), bollardBandMat);
        band.position.set(x + bx, 1.0, z + (z < 0 ? 1.8 : -1.8));
        scene.add(band);
      });

      colliders.push(makeAABB(x, z, 1.5, 1.5));
    });

    // Translucent Roof Skylights with steel frames
    const skylightGeo = new THREE.PlaneGeometry(35, 20);
    const skylightMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.8, side: THREE.DoubleSide,
    });
    [[-55, -25], [55, -25], [-55, 25], [55, 25]].forEach(([x, z]) => {
      const skylight = new THREE.Mesh(skylightGeo, skylightMat);
      skylight.position.set(x, 25.1, z); skylight.rotation.x = Math.PI / 2; scene.add(skylight);
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

    createRackRow(75, -22, 36, 4, 12, 3);
    createRackRow(75, 12, 36, 4, 12, 3);
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

      // ASRS Station Overhead Signage
      const asrsStationSign = createLabelSprite('🤖 ASRS PICK STATION', '#38bdf8', '#0284c7');
      asrsStationSign.position.set(0, 4.8, -1.8);
      asrsStationSign.scale.set(0, 0, 0);
      asrsStationSign.visible = false;
      stationGroup.add(asrsStationSign);

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

      // Overhead ASRS signage
      const asrsSign = createLabelSprite('🤖 ASRS MATRIX SYSTEM', '#38bdf8', '#0284c7');
      asrsSign.position.set(0, rackH + 2.5, 0);
      asrsSign.scale.set(0, 0, 0);
      asrsSign.visible = false;
      asrsGroup.add(asrsSign);

      asrsGroup.position.set(-75, 0, 0);
      scene.add(asrsGroup);
      colliders.push(makeAABB(-75, 0, 24, 15));

      return { asrsGroup, bot1, bot2, bot3, bot4, stationTote, armL, armR, stationLight, lightBarMat, asrsState, gridTotes, slotXs, rowYs, asrsSign, asrsStationSign };
    };

    const asrsData = createASRS();

    // ─── 4.5 PTL (Put-to-Light) Station — Back-Right Corner ───
    const createPTL = () => {
      const ptlGroup = new THREE.Group();

      // Materials
      const rackFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
      const shelfMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
      const slotBinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
      const trolleyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });

      // C-shape rack configuration: Left rack, Back rack, Right rack
      // Scaled up to 9.6m height & 4 tiers to match neighboring 12m high-bay racks
      const RACK_HEIGHT = 9.6;
      const SHELF_COUNT = 4;
      const SLOT_W = 2.2;
      const SLOT_H = 1.9;
      const SLOT_D = 1.8;
      const RACK_DEPTH = 2.0;

      const parcelColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xf97316, 0x06b6d4, 0xec4899];

      // Helper: create one rack segment
      const createRack = (slotCount, rackW) => {
        const rackGroup = new THREE.Group();
        const slots = [];

        // Vertical posts
        for (let i = 0; i <= slotCount; i++) {
          const postX = -rackW / 2 + i * (rackW / slotCount);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, RACK_HEIGHT, 0.25), rackFrameMat);
          post.position.set(postX, RACK_HEIGHT / 2, 0);
          post.castShadow = true;
          rackGroup.add(post);
          // Back post
          const postBack = new THREE.Mesh(new THREE.BoxGeometry(0.25, RACK_HEIGHT, 0.25), rackFrameMat);
          postBack.position.set(postX, RACK_HEIGHT / 2, -RACK_DEPTH);
          postBack.castShadow = true;
          rackGroup.add(postBack);
        }

        // Shelves and slots
        for (let row = 0; row < SHELF_COUNT; row++) {
          const shelfY = 0.4 + row * (RACK_HEIGHT / SHELF_COUNT);

          // Shelf plate
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.1, RACK_DEPTH), shelfMat);
          shelf.position.set(0, shelfY, -RACK_DEPTH / 2);
          rackGroup.add(shelf);

          // Cross beam
          const beam = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.15, 0.15), rackFrameMat);
          beam.position.set(0, shelfY + SLOT_H + 0.06, 0);
          rackGroup.add(beam);

          for (let col = 0; col < slotCount; col++) {
            const slotX = -rackW / 2 + col * (rackW / slotCount) + (rackW / slotCount) / 2;

            // Slot bin (empty container outline)
            const binGeo = new THREE.BoxGeometry(SLOT_W * 0.85, SLOT_H * 0.8, SLOT_D * 0.85);
            const bin = new THREE.Mesh(binGeo, slotBinMat.clone());
            bin.position.set(slotX, shelfY + SLOT_H * 0.45, -RACK_DEPTH / 2);
            bin.material.transparent = true;
            bin.material.opacity = 0.28;
            rackGroup.add(bin);

            // LED indicator light (mounted above each slot)
            const ledGeo = new THREE.BoxGeometry(SLOT_W * 0.7, 0.14, 0.14);
            const ledMat = new THREE.MeshBasicMaterial({ color: 0x334155 }); // off state
            const led = new THREE.Mesh(ledGeo, ledMat);
            led.position.set(slotX, shelfY + SLOT_H + 0.15, 0.08);
            rackGroup.add(led);

            // Small circular indicator dot
            const dotGeo = new THREE.CircleGeometry(0.12, 12);
            const dotMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.set(slotX, shelfY + SLOT_H + 0.15, 0.16);
            rackGroup.add(dot);

            // Point light for glow effect (initially off)
            const slotLight = new THREE.PointLight(0x10b981, 0, 3.5);
            slotLight.position.set(slotX, shelfY + SLOT_H * 0.5, 0.6);
            rackGroup.add(slotLight);

            slots.push({
              row, col, x: slotX, y: shelfY,
              bin, led, ledMat, dot, dotMat, slotLight,
              hasParcel: false, parcelMesh: null
            });
          }
        }

        // Top beam
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.18, RACK_DEPTH + 0.4), rackFrameMat);
        topBeam.position.set(0, RACK_HEIGHT + 0.08, -RACK_DEPTH / 2);
        rackGroup.add(topBeam);

        return { rackGroup, slots };
      };

      // Left rack (5 slots wide, facing right along +X)
      const leftRack = createRack(5, 5 * SLOT_W);
      leftRack.rackGroup.position.set(-7.5, 0, 0);
      leftRack.rackGroup.rotation.y = Math.PI / 2;
      ptlGroup.add(leftRack.rackGroup);

      // Back rack (6 slots wide, facing forward along +Z)
      const backRack = createRack(6, 6 * SLOT_W);
      backRack.rackGroup.position.set(0, 0, -7.5);
      backRack.rackGroup.rotation.y = 0;
      ptlGroup.add(backRack.rackGroup);

      // Right rack (5 slots wide, facing left along -X)
      const rightRack = createRack(5, 5 * SLOT_W);
      rightRack.rackGroup.position.set(7.5, 0, 0);
      rightRack.rackGroup.rotation.y = -Math.PI / 2;
      ptlGroup.add(rightRack.rackGroup);

      // Combine all slots with rack identifiers
      const allSlots = [];
      leftRack.slots.forEach((s, i) => allSlots.push({ ...s, rackId: 'left', slotIdx: i }));
      backRack.slots.forEach((s, i) => allSlots.push({ ...s, rackId: 'back', slotIdx: i }));
      rightRack.slots.forEach((s, i) => allSlots.push({ ...s, rackId: 'right', slotIdx: i }));

      // ─── Trolley with parcels ───
      const trolleyGroup = new THREE.Group();

      // Trolley frame/platform
      const trolleyBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 2.4), trolleyMat);
      trolleyBase.position.set(0, 1.1, 0);
      trolleyBase.castShadow = true;
      trolleyGroup.add(trolleyBase);

      // Trolley legs
      const legGeo = new THREE.BoxGeometry(0.14, 1.1, 0.14);
      [[-1.6, 0.55, -1.0], [1.6, 0.55, -1.0], [-1.6, 0.55, 1.0], [1.6, 0.55, 1.0]].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, trolleyMat);
        leg.position.set(lx, ly, lz);
        trolleyGroup.add(leg);
      });

      // Trolley wheels
      const tWheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12);
      const tWheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
      [[-1.6, 0.15, -1.0], [1.6, 0.15, -1.0], [-1.6, 0.15, 1.0], [1.6, 0.15, 1.0]].forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(tWheelGeo, tWheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, wy, wz);
        trolleyGroup.add(wheel);
      });

      // Handle
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
      const handleVert = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), handleMat);
      handleVert.position.set(0, 1.8, 1.25);
      trolleyGroup.add(handleVert);
      const handleHorz = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), handleMat);
      handleHorz.position.set(0, 2.45, 1.25);
      trolleyGroup.add(handleHorz);

      // Side rails
      const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 2.4), trolleyMat);
      sideRailL.position.set(-1.75, 1.35, 0);
      trolleyGroup.add(sideRailL);
      const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 2.4), trolleyMat);
      sideRailR.position.set(1.75, 1.35, 0);
      trolleyGroup.add(sideRailR);

      // Parcels stacked on the trolley
      const trolleyParcels = [];
      for (let tp = 0; tp < 8; tp++) {
        const pw = 0.65 + Math.random() * 0.25;
        const ph = 0.42 + Math.random() * 0.18;
        const pd = 0.52 + Math.random() * 0.2;
        const parcelGeo = createRoundedBox(pw, ph, pd, 0.03, 2);
        const parcelColor = parcelColors[tp % parcelColors.length];
        const parcelMat = new THREE.MeshStandardMaterial({ color: parcelColor, roughness: 0.5 });
        const parcel = new THREE.Mesh(parcelGeo, parcelMat);
        const stackRow = Math.floor(tp / 4);
        const stackCol = tp % 4;
        parcel.position.set(-1.1 + stackCol * 0.74, 1.25 + stackRow * 0.5, -0.4 + Math.random() * 0.5);
        parcel.rotation.y = Math.random() * 0.3 - 0.15;
        parcel.castShadow = true;
        trolleyGroup.add(parcel);
        trolleyParcels.push({ mesh: parcel, color: parcelColor });
      }

      trolleyGroup.position.set(0, 0, 3.2);
      ptlGroup.add(trolleyGroup);

      // ─── Scanner device on desk beside trolley ───
      const scannerDeskGroup = new THREE.Group();
      const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });
      const scanDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.9), deskTopMat);
      scanDesk.position.set(0, 0.45, 0);
      scanDesk.castShadow = true;
      scannerDeskGroup.add(scanDesk);

      // Scanner device
      const scannerBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.45, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
      );
      scannerBody.position.set(0, 1.1, 0);
      scannerDeskGroup.add(scannerBody);

      // Scanner screen
      const scanScreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const scanScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), scanScreenMat);
      scanScreen.position.set(0, 1.15, 0.135);
      scannerDeskGroup.add(scanScreen);

      // Scanner beam (laser line — initially invisible)
      const scanBeamMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0 });
      const scanBeam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.4), scanBeamMat);
      scanBeam.position.set(0, 1.1, 0.8);
      scannerDeskGroup.add(scanBeam);

      scannerDeskGroup.position.set(3.0, 0, 1.8);
      ptlGroup.add(scannerDeskGroup);

      // ─── PTL Worker ───
      const ptlWorkerGroup = new THREE.Group();
      const workerPantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const workerVestMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 });
      const workerSkinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.8 });
      const workerHelmetMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2 });

      const wLegs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.45), workerPantsMat);
      wLegs.position.set(0, 0.55, 0);
      ptlWorkerGroup.add(wLegs);

      const wTorso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.5), workerVestMat);
      wTorso.position.set(0, 1.65, 0);
      ptlWorkerGroup.add(wTorso);

      const wHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), workerSkinMat);
      wHead.position.set(0, 2.45, 0);
      ptlWorkerGroup.add(wHead);

      const wHelmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        workerHelmetMat
      );
      wHelmet.position.set(0, 2.47, 0);
      ptlWorkerGroup.add(wHelmet);

      // Arms
      const wArmL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), workerVestMat);
      wArmL.position.set(-0.5, 1.6, 0);
      ptlWorkerGroup.add(wArmL);

      const wArmR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), workerVestMat);
      wArmR.position.set(0.5, 1.6, 0);
      ptlWorkerGroup.add(wArmR);

      // Carried parcel (initially invisible — shown when worker carries one)
      const carriedParcelMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
      const carriedParcel = new THREE.Mesh(createRoundedBox(0.55, 0.35, 0.45, 0.03, 2), carriedParcelMat);
      carriedParcel.position.set(0, 1.25, 0.4);
      carriedParcel.visible = false;
      ptlWorkerGroup.add(carriedParcel);

      ptlWorkerGroup.position.set(0, 0, 1.8); // Positioned between racks and trolley, facing warehouse center
      ptlGroup.add(ptlWorkerGroup);

      // ─── PTL overhead signage ───
      const ptlSign = createLabelSprite('📦 PUT-TO-LIGHT SORTATION STATION', '#10b981', '#10b981');
      ptlSign.position.set(0, RACK_HEIGHT + 2.8, -2.5);
      ptlSign.scale.set(0, 0, 0);
      ptlSign.visible = false;
      ptlGroup.add(ptlSign);

      // Overhead LED strip around the station
      const stripMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.6 });
      const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 16), stripMat);
      stripL.position.set(-8.0, RACK_HEIGHT + 0.5, -2.0);
      ptlGroup.add(stripL);
      const stripR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 16), stripMat);
      stripR.position.set(8.0, RACK_HEIGHT + 0.5, -2.0);
      ptlGroup.add(stripR);
      const stripB = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 0.1), stripMat);
      stripB.position.set(0, RACK_HEIGHT + 0.5, -8.0);
      ptlGroup.add(stripB);

      // Floor marking for PTL zone
      const ptlFloorMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
      const ptlFloor = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), ptlFloorMat);
      ptlFloor.rotation.x = -Math.PI / 2;
      ptlFloor.position.set(0, 0.03, -1.5);
      ptlGroup.add(ptlFloor);

      // Floor border
      const borderLineMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const flBorderFront = new THREE.Mesh(new THREE.BoxGeometry(18, 0.04, 0.18), borderLineMat);
      flBorderFront.position.set(0, 0.04, 6.5);
      ptlGroup.add(flBorderFront);
      const flBorderBack = new THREE.Mesh(new THREE.BoxGeometry(18, 0.04, 0.18), borderLineMat);
      flBorderBack.position.set(0, 0.04, -9.5);
      ptlGroup.add(flBorderBack);
      const flBorderL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 16), borderLineMat);
      flBorderL.position.set(-9.0, 0.04, -1.5);
      ptlGroup.add(flBorderL);
      const flBorderR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 16), borderLineMat);
      flBorderR.position.set(9.0, 0.04, -1.5);
      ptlGroup.add(flBorderR);

      // Position the entire PTL station in the back-right corner, angled so operator faces warehouse center
      ptlGroup.position.set(75, 0, -50);
      ptlGroup.rotation.y = Math.atan2(-75, 50); // ~ -56° towards warehouse center (0, 0)
      scene.add(ptlGroup);
      colliders.push(makeAABB(75, -50, 9.5, 9.5));

      // PTL animation state machine
      const ptlState = {
        stage: 0,      // 0=idle/pick from trolley, 1=scanning, 2=light blinks, 3=walk to slot, 4=place parcel, 5=walk back
        timer: 0,
        currentSlotIdx: 0,
        currentParcelColor: parcelColors[0],
        trolleyParcelIdx: 0,
        workerStartPos: new THREE.Vector3(0, 0, 2.5),
        targetSlotWorldPos: new THREE.Vector3(),
        blinkCount: 0,
      };

      return {
        ptlGroup, allSlots, ptlWorkerGroup, carriedParcel, carriedParcelMat,
        scanBeamMat, scanScreenMat, trolleyParcels, ptlState, wArmL, wArmR, stripMat,
        ptlSign
      };
    };

    const ptlData = createPTL();

    // ─── 5. Branded "Tech Stack" Interactable Containers ───
    const interactableBoxes = [];
    const boxDefinitions = [
      { x: -30, z: -35, colorType: TECH_CRATES.DOTNET },
      { x: 30, z: -35, colorType: TECH_CRATES.MADRID },
      { x: -30, z: 35, colorType: TECH_CRATES.PLC },
      { x: 30, z: 35, colorType: TECH_CRATES.RABBITMQ },
      { x: 0, z: -15, colorType: TECH_CRATES.PTL },
      { x: -20, z: -35, colorType: TECH_CRATES.DOTNET },
      { x: 20, z: -35, colorType: TECH_CRATES.MADRID },
      { x: -20, z: 35, colorType: TECH_CRATES.PLC },
      { x: 20, z: 35, colorType: TECH_CRATES.RABBITMQ },
      { x: 0, z: 15, colorType: TECH_CRATES.PTL },
    ];

    boxDefinitions.forEach(({ x, z, colorType }, idx) => {
      const containerGroup = new THREE.Group();

      // Retrieve cached canvas textures for sides & top
      const { sideTex, topTex } = getCrateTextures(colorType);

      // 6-face Box materials
      const boxMaterials = [
        new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.35, metalness: 0.2 }),
        new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.35, metalness: 0.2 }),
        new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.4, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.3 }),
        new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.35, metalness: 0.2 }),
        new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.35, metalness: 0.2 }),
      ];

      // Physical Crate Carrier Group
      const boxCarrier = new THREE.Group();

      const boxGeo = new THREE.BoxGeometry(1.9, 1.4, 1.9);
      const box = new THREE.Mesh(boxGeo, boxMaterials);
      box.position.set(0, 0.85, 0);
      box.castShadow = true;
      box.receiveShadow = true;
      boxCarrier.add(box);

      // Forklift Pallet Skid Runners underneath
      const skidMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.4 });
      const skidGeo = new THREE.BoxGeometry(0.2, 0.15, 1.9);
      const skidL = new THREE.Mesh(skidGeo, skidMat);
      skidL.position.set(-0.7, 0.08, 0);
      skidL.castShadow = true;
      boxCarrier.add(skidL);

      const skidR = new THREE.Mesh(skidGeo, skidMat);
      skidR.position.set(0.7, 0.08, 0);
      skidR.castShadow = true;
      boxCarrier.add(skidR);

      // Top Deck Status LED Beacon
      const ledMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.9 });
      const ledMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12), ledMat);
      ledMesh.position.set(0.75, 1.62, 0.75);
      boxCarrier.add(ledMesh);

      containerGroup.add(boxCarrier);

      // Overhead Floating Sprite Label
      const labelText = `${colorType.subIcon || colorType.icon} ${colorType.title.toUpperCase()} [E]`;
      const labelSprite = createLabelSprite(labelText, colorType.css, colorType.css);
      labelSprite.position.set(0, 4.2, 0);
      labelSprite.scale.set(0, 0, 0);
      labelSprite.visible = false;
      containerGroup.add(labelSprite);

      // Floor Hologram Ring
      const ringGeo = new THREE.RingGeometry(1.4, 1.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.04, 0);
      containerGroup.add(ring);

      containerGroup.position.set(x, 0, z);
      containerGroup.userData = {
        interactable: true,
        pickedUp: false,
        id: idx,
        height: 1.5,
        colorType: colorType,
        labelSprite,
        ringMat,
        ledMat,
        boxMesh: boxCarrier
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

    // ─── 8. Tech Stack Delivery Drop Zones ───
    const deliveryZones = [];
    const zoneDefinitions = [
      { x: -50, z: -55, colorType: TECH_CRATES.DOTNET },
      { x: 50, z: -55, colorType: TECH_CRATES.MADRID },
      { x: -50, z: 55, colorType: TECH_CRATES.PLC },
      { x: 50, z: 55, colorType: TECH_CRATES.RABBITMQ },
      { x: 0, z: -60, colorType: TECH_CRATES.PTL },
    ];

    zoneDefinitions.forEach(({ x, z, colorType }) => {
      const padGroup = new THREE.Group();

      // 1. High-Tech 12x12 Graphic Landing Pad
      const padTex = getDropPadTexture(colorType);
      const padGeo = new THREE.PlaneGeometry(12, 12);
      const padMat = new THREE.MeshStandardMaterial({
        map: padTex,
        roughness: 0.6,
        metalness: 0.2,
        side: THREE.DoubleSide
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(0, 0.04, 0);
      pad.receiveShadow = true;
      padGroup.add(pad);

      // 2. Concentric Pulsing Radar Sonar Floor Rings
      const sonarRingGeo = new THREE.RingGeometry(3.5, 4.0, 32);
      const sonarRingMat1 = new THREE.MeshBasicMaterial({
        color: colorType.hex,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const sonarRing1 = new THREE.Mesh(sonarRingGeo, sonarRingMat1);
      sonarRing1.rotation.x = -Math.PI / 2;
      sonarRing1.position.set(0, 0.06, 0);
      padGroup.add(sonarRing1);

      const sonarRingMat2 = new THREE.MeshBasicMaterial({
        color: colorType.hex,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      });
      const sonarRing2 = new THREE.Mesh(sonarRingGeo, sonarRingMat2);
      sonarRing2.rotation.x = -Math.PI / 2;
      sonarRing2.position.set(0, 0.06, 0);
      padGroup.add(sonarRing2);

      // 3. Sky-High Laser Light Pillar (Height 32 - Shoots to ceiling!)
      const beamCoreGeo = new THREE.CylinderGeometry(1.6, 1.6, 32, 24, 1, true);
      const beamCoreMat = new THREE.MeshBasicMaterial({
        color: colorType.hex,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const beamCore = new THREE.Mesh(beamCoreGeo, beamCoreMat);
      beamCore.position.set(0, 16, 0);
      padGroup.add(beamCore);

      const beamAuraGeo = new THREE.CylinderGeometry(4.2, 4.2, 32, 24, 1, true);
      const beamAuraMat = new THREE.MeshBasicMaterial({
        color: colorType.hex,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const beamAura = new THREE.Mesh(beamAuraGeo, beamAuraMat);
      beamAura.position.set(0, 16, 0);
      padGroup.add(beamAura);

      // 4. Point Light on the zone floor (illuminates surrounding area!)
      const zoneLight = new THREE.PointLight(colorType.hex, 0.8, 30);
      zoneLight.position.set(0, 5.0, 0);
      padGroup.add(zoneLight);

      // 5. Giant Hologram Target Arrow / Chevrons
      const chevronGroup = new THREE.Group();
      const arrowMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.95 });
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 4), arrowMat);
      arrow.position.set(0, 5.0, 0);
      arrow.rotation.x = Math.PI;
      chevronGroup.add(arrow);

      const arrowRing = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 2.0, 24),
        new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      );
      arrowRing.rotation.x = -Math.PI / 2;
      arrowRing.position.set(0, 6.2, 0);
      chevronGroup.add(arrowRing);
      padGroup.add(chevronGroup);

      // 6. High-Altitude Overhead Billboard (Always visible from anywhere in warehouse!)
      const zoneTitle = `${colorType.subIcon || colorType.icon} ${colorType.zoneName}`;
      const defaultLabelSprite = createLabelSprite(zoneTitle, colorType.css, colorType.css, 'rgba(15, 23, 42, 0.95)');
      defaultLabelSprite.position.set(0, 12.2, 0);
      defaultLabelSprite.scale.set(10.2, 2.04, 1);
      defaultLabelSprite.visible = true; // Always visible!
      padGroup.add(defaultLabelSprite);

      // 7. Flashing "TARGET DROP POINT" Prompt Sprite (shown when carrying matching crate)
      const targetLabelSprite = createLabelSprite(
        `🎯 DELIVER ${colorType.shortName.toUpperCase()} HERE! ⬇️`,
        '#ffffff',
        '#fbbf24',
        'rgba(234, 88, 12, 0.96)'
      );
      targetLabelSprite.position.set(0, 15.6, 0);
      targetLabelSprite.scale.set(0, 0, 0);
      targetLabelSprite.visible = false;
      padGroup.add(targetLabelSprite);

      // 8. Close Proximity Unload Prompt Sprite
      const readyLabelSprite = createLabelSprite(
        `✅ PRESS [E] TO UNLOAD ${colorType.shortName.toUpperCase()}!`,
        '#ffffff',
        '#10b981',
        'rgba(15, 23, 42, 0.98)'
      );
      readyLabelSprite.position.set(0, 6.8, 0);
      readyLabelSprite.scale.set(0, 0, 0);
      readyLabelSprite.visible = false;
      padGroup.add(readyLabelSprite);

      padGroup.position.set(x, 0, z);
      scene.add(padGroup);

      deliveryZones.push({
        x, z, colorType, padGroup,
        sonarRing1, sonarRingMat1, sonarRing2, sonarRingMat2,
        beamCore, beamCoreMat, beamAura, beamAuraMat, zoneLight,
        chevronGroup, defaultLabelSprite, targetLabelSprite, readyLabelSprite
      });
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
      labelSprite.position.set(0, 2.2, 0);
      labelSprite.scale.set(0, 0, 0);
      labelSprite.visible = false;
      group.add(labelSprite);

      group.position.set(x, y, z);
      group.userData = { collected: false, baseY: y, index: i };
      scene.add(group);
      collectibles.push(group);
    });

    // ─── 10. Lighting ───
    const ambient = new THREE.AmbientLight(0xfff7ed, 1.15); scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.0); scene.add(hemi);

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

    const ufoBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.8 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });

    lightPositions.forEach(([x, y, z]) => {
      // Commercial UFO High-Bay Housing
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.35, 16), ufoBodyMat);
      housing.position.set(x, y, z); scene.add(housing);

      // Steel suspension hanger cable up to truss
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6), cableMat);
      cable.position.set(x, y + 1.3, z); scene.add(cable);

      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 });
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.06, 16), bulbMat);
      bulb.position.set(x, y - 0.18, z); scene.add(bulb);
      bulbs.push(bulbMat);

      const spot = new THREE.SpotLight(0xfffaed, 1.4, 55, 0.85, 0.5, 1);
      spot.position.set(x, y, z); spot.target.position.set(x, 0, z);
      scene.add(spot); scene.add(spot.target);
      overheadLights.push(spot);
    });

    const doorLight = new THREE.DirectionalLight(0xe0f2fe, 1.2);
    doorLight.position.set(0, 18, 80); doorLight.target.position.set(0, 0, 30);
    scene.add(doorLight); scene.add(doorLight.target);

    const skyGeo = new THREE.SphereGeometry(180, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x131a26, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);

    const forkliftState = { speed: 0, rotSpeed: 0, maxSpeed: 0.45 };

    sceneRef.current = {
      scene, camera, renderer, forklift, beacon, conveyors, miniBots,
      overheadLights, bulbs, ambient, hemi, sunLight, doorLight,
      spotL, spotR, hlLensMatL, hlLensMatR, tailMat,
      sky, skyMat, interactableBoxes, deliveryZones, collectibles, forkliftState, asrsData, ptlData,
    };

    const forkliftHalfW = 1.8;
    const forkliftHalfD = 2.5;

    const validControlKeys = ['w', 'a', 's', 'd', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

    onKeyDown = (e) => {
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

    onKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let interactCooldown = 0;
    const clock = new THREE.Clock();
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

      // ASRS Overhead Signs Proximity Popups
      if (asrsData) {
        const { asrsStationSign, asrsSign } = asrsData;
        const distToAsrsStation = forklift.position.distanceTo(new THREE.Vector3(-49, 0, 0));
        const isNearStation = distToAsrsStation < 30;
        if (asrsStationSign) {
          updateHeaderProximity(asrsStationSign, isNearStation, delta, { x: 8.6, y: 2.15 });
          if (asrsStationSign.visible) {
            asrsStationSign.position.y = 5.4 + Math.sin(elapsed * 2) * 0.2;
          }
        }
        if (asrsSign) {
          const distToMatrix = forklift.position.distanceTo(new THREE.Vector3(-75, 0, 0));
          const isNearMatrix = distToMatrix < 38;
          updateHeaderProximity(asrsSign, isNearMatrix, delta, { x: 10.0, y: 2.5 });
          if (asrsSign.visible) {
            asrsSign.position.y = 25.0 + Math.sin(elapsed * 2) * 0.2;
          }
        }
      }

      // ─── PTL (Put-to-Light) Station Animation State Machine ───
      if (ptlData) {
        const {
          ptlGroup, allSlots, ptlWorkerGroup, carriedParcel, carriedParcelMat,
          scanBeamMat, scanScreenMat, trolleyParcels, ptlState, wArmL, wArmR, stripMat,
          ptlSign
        } = ptlData;

        // PTL Overhead Sign Proximity Popup
        const distToPTL = forklift.position.distanceTo(new THREE.Vector3(75, 0, -50));
        const isNearPTL = distToPTL < 38;
        updateHeaderProximity(ptlSign, isNearPTL, delta, { x: 11.2, y: 2.8 });
        if (ptlSign.visible) {
          ptlSign.position.y = 12.8 + Math.sin(elapsed * 2) * 0.25;
        }

        ptlState.timer += delta;

        // Overhead strip gentle pulse
        stripMat.opacity = 0.4 + Math.sin(elapsed * 2) * 0.2;

        const getWorkerTargetForSlot = (slot) => {
          const worldPos = new THREE.Vector3();
          slot.bin.getWorldPosition(worldPos);
          const localBin = ptlGroup.worldToLocal(worldPos.clone());
          const toCenter = new THREE.Vector3(-localBin.x, 0, -localBin.z).normalize();
          return new THREE.Vector3(localBin.x + toCenter.x * 2.2, 0, localBin.z + toCenter.z * 2.2);
        };

        const workerLocalPos = ptlWorkerGroup.position;
        const trolleyLocalPos = new THREE.Vector3(0, 0, 1.8); // Trolley pick position for worker
        const scanLocalPos = new THREE.Vector3(3.0, 0, 1.8);   // Scanner desk position

        switch (ptlState.stage) {
          // STAGE 0: Worker at trolley, picks up a parcel (facing middle of warehouse)
          case 0: {
            workerLocalPos.set(trolleyLocalPos.x, 0, trolleyLocalPos.z);
            ptlWorkerGroup.rotation.y = 0; // Faces local +Z (towards trolley & middle of warehouse!)

            // Arm reach animation
            const reachP = Math.min(1, ptlState.timer / 1.0);
            wArmL.rotation.x = -Math.sin(reachP * Math.PI) * 1.2;
            wArmR.rotation.x = -Math.sin(reachP * Math.PI) * 1.2;

            if (reachP >= 0.5) {
              const colorIdx = ptlState.currentSlotIdx % trolleyParcels.length;
              ptlState.currentParcelColor = trolleyParcels[colorIdx].color;
              carriedParcelMat.color.setHex(ptlState.currentParcelColor);
              carriedParcel.visible = true;
              trolleyParcels[colorIdx].mesh.visible = false;
            }

            if (ptlState.timer >= 1.2) {
              ptlState.stage = 1;
              ptlState.timer = 0;
              wArmL.rotation.x = 0;
              wArmR.rotation.x = 0;
            }
            break;
          }

          // STAGE 1: Worker walks to scanner and scans the parcel
          case 1: {
            const walkDur = 0.6;
            const scanDur = 0.8;

            if (ptlState.timer < walkDur) {
              const p = ptlState.timer / walkDur;
              workerLocalPos.lerpVectors(trolleyLocalPos, scanLocalPos, p);
              ptlWorkerGroup.rotation.y = Math.PI / 2; // turns right towards scanner desk
              ptlWorkerGroup.position.y = Math.sin(p * Math.PI * 4) * 0.05;
            } else if (ptlState.timer < walkDur + scanDur) {
              const sp = (ptlState.timer - walkDur) / scanDur;
              workerLocalPos.copy(scanLocalPos);
              ptlWorkerGroup.rotation.y = 0; // faces scanner
              ptlWorkerGroup.position.y = 0;

              wArmR.rotation.x = -Math.sin(sp * Math.PI) * 0.8;
              scanBeamMat.opacity = sp < 0.7 ? 0.9 : 0;
              scanBeamMat.color.setHex(0xef4444);
              scanScreenMat.color.setHex(sp > 0.4 && sp < 0.8 ? 0x10b981 : 0x1e293b);
            } else {
              scanBeamMat.opacity = 0;
              scanScreenMat.color.setHex(0x10b981);
              wArmR.rotation.x = 0;
              ptlState.stage = 2;
              ptlState.timer = 0;
              ptlState.blinkCount = 0;
              ptlState.currentSlotIdx = ptlState.currentSlotIdx % allSlots.length;
            }
            break;
          }

          // STAGE 2: Target slot LED blinks rapidly to guide worker
          case 2: {
            const blinkDuration = 2.0;
            const slot = allSlots[ptlState.currentSlotIdx];

            const blinkOn = Math.sin(elapsed * 18) > 0;
            slot.ledMat.color.setHex(blinkOn ? 0x10b981 : 0x064e3b);
            slot.dotMat.color.setHex(blinkOn ? 0x10b981 : 0x064e3b);
            slot.slotLight.intensity = blinkOn ? 2.5 : 0.3;
            slot.slotLight.color.setHex(0x10b981);

            workerLocalPos.copy(scanLocalPos);

            if (ptlState.timer >= blinkDuration) {
              slot.ledMat.color.setHex(0x10b981);
              slot.dotMat.color.setHex(0x10b981);
              slot.slotLight.intensity = 2.0;

              ptlState.stage = 3;
              ptlState.timer = 0;
              ptlState.targetSlotWorldPos.copy(getWorkerTargetForSlot(slot));
            }
            break;
          }

          // STAGE 3: Worker walks from scanner to the lit-up slot
          case 3: {
            const walkDur = 1.2;
            const startPos = scanLocalPos;
            const endPos = ptlState.targetSlotWorldPos;

            const p = Math.min(1, ptlState.timer / walkDur);
            workerLocalPos.lerpVectors(startPos, endPos, p);
            ptlWorkerGroup.position.y = Math.sin(p * Math.PI * 6) * 0.04;

            const walkDir = endPos.clone().sub(startPos);
            if (walkDir.length() > 0.1) {
              ptlWorkerGroup.rotation.y = Math.atan2(walkDir.x, walkDir.z);
            }

            const slot = allSlots[ptlState.currentSlotIdx];
            slot.ledMat.color.setHex(0x10b981);
            slot.slotLight.intensity = 2.0;

            if (p >= 1) {
              ptlState.stage = 4;
              ptlState.timer = 0;
              ptlWorkerGroup.position.y = 0;
            }
            break;
          }

          // STAGE 4: Worker places parcel into slot (arm animation)
          case 4: {
            const placeDur = 1.0;
            const p = Math.min(1, ptlState.timer / placeDur);
            const slot = allSlots[ptlState.currentSlotIdx];

            const worldPos = new THREE.Vector3();
            slot.bin.getWorldPosition(worldPos);
            const localBin = ptlGroup.worldToLocal(worldPos.clone());
            const faceDir = localBin.clone().sub(workerLocalPos);
            ptlWorkerGroup.rotation.y = Math.atan2(faceDir.x, faceDir.z);

            wArmL.rotation.x = -Math.sin(p * Math.PI) * 1.0;
            wArmR.rotation.x = -Math.sin(p * Math.PI) * 1.0;

            if (p >= 0.6) {
              carriedParcel.visible = false;
              slot.hasParcel = true;
              slot.bin.material.color.setHex(ptlState.currentParcelColor);
              slot.bin.material.opacity = 0.85;

              slot.ledMat.color.setHex(0xf59e0b);
              slot.dotMat.color.setHex(0xf59e0b);
              slot.slotLight.intensity = 1.0;
              slot.slotLight.color.setHex(0xf59e0b);
            }

            if (p >= 1) {
              wArmL.rotation.x = 0;
              wArmR.rotation.x = 0;
              slot.ledMat.color.setHex(0x334155);
              slot.dotMat.color.setHex(0x334155);
              slot.slotLight.intensity = 0;

              ptlState.stage = 5;
              ptlState.timer = 0;
            }
            break;
          }

          // STAGE 5: Worker walks back to trolley
          case 5: {
            const walkDur = 1.0;
            const startPos = ptlState.targetSlotWorldPos.clone();
            const endPos = trolleyLocalPos.clone();

            const p = Math.min(1, ptlState.timer / walkDur);
            workerLocalPos.lerpVectors(startPos, endPos, p);
            ptlWorkerGroup.position.y = Math.sin(p * Math.PI * 6) * 0.04;

            const walkDir = endPos.clone().sub(startPos);
            if (walkDir.length() > 0.1) {
              ptlWorkerGroup.rotation.y = Math.atan2(walkDir.x, walkDir.z);
            }

            if (p >= 1) {
              ptlWorkerGroup.position.y = 0;
              ptlWorkerGroup.rotation.y = 0; // face trolley & middle of warehouse!

              const colorIdx = ptlState.currentSlotIdx % trolleyParcels.length;
              trolleyParcels[colorIdx].mesh.visible = true;

              ptlState.currentSlotIdx = (ptlState.currentSlotIdx + 1) % allSlots.length;
              ptlState.stage = 0;
              ptlState.timer = 0;
            }
            break;
          }

          default:
            ptlState.stage = 0;
            ptlState.timer = 0;
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
            boxMesh.position.set(0, 0.4, 3.2);
            boxMesh.rotation.set(0, 0, 0);
            forklift.add(boxMesh);
            game.carried = boxMesh;
            game.carriedGroup = nearest;
            setCarried(true);
            setCarriedColor(nearest.userData.colorType);
            showMessage(`📦 Loaded ${nearest.userData.colorType.subIcon || nearest.userData.colorType.icon} ${nearest.userData.colorType.title}! Deliver to matching zone.`);
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

          boxMesh.position.set(0, 0, 0);
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
              const isMatch = (boxColor.id === zone.colorType.id) || (boxColor.name === zone.colorType.name);
              const currentOrder = SHIFT_ORDERS[shiftIndexRef.current];
              const isShiftObjective = currentOrder && (
                boxColor.id === currentOrder.targetColor.id ||
                boxColor.name === currentOrder.targetColor.name
              );

              if (isShiftObjective) {
                game.score += currentOrder.points;
                setScore(game.score);
                handleCompleteShiftOrder(currentOrder);
              } else if (isMatch) {
                game.score += 150;
                setScore(game.score);
                setActiveMilestone({
                  icon: boxColor.subIcon || boxColor.icon,
                  badge: boxColor.badge,
                  milestoneTitle: boxColor.milestoneTitle,
                  milestoneStat: boxColor.milestoneStat,
                  milestoneStory: boxColor.reveal,
                  tech: boxColor.tech,
                  points: 150,
                });
                showMessage(`🎉 TECH DELIVERED! Unlocked ${boxColor.title} (+150 PTS)!`);
              } else {
                game.score += 30;
                setScore(game.score);
                showMessage(`📦 Delivered to ${zone.colorType.shortName} Zone (+30 PTS)! Tip: Match crates to zones for Resume reveals!`);
              }
              containerGroup.userData.pickedUp = false;
              containerGroup.position.set(-40 + Math.random() * 80, 0, -35 + Math.random() * 70);
            }
          });
          if (!delivered) {
            containerGroup.userData.pickedUp = false;
            showMessage(`📦 Unloaded container. Drive to matching ${boxColor.subIcon || boxColor.icon} ${boxColor.zoneName} for Resume reveal!`);
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

      // Animate Interactable Box Indicators (Proximity Popups)
      interactableBoxes.forEach((boxGroup) => {
        const { labelSprite, ringMat, ledMat } = boxGroup.userData;
        if (boxGroup.userData.pickedUp) {
          if (labelSprite) labelSprite.visible = false;
          return;
        }
        const distToBox = forklift.position.distanceTo(boxGroup.position);
        const isNearBox = distToBox < 20;
        updateHeaderProximity(labelSprite, isNearBox, delta, { x: 8.4, y: 1.68 });
        if (labelSprite.visible) {
          labelSprite.position.y = 4.2 + Math.sin(elapsed * 3) * 0.25;
        }
        ringMat.opacity = isNearBox ? (0.55 + Math.sin(elapsed * 4) * 0.3) : 0.15;
        if (ledMat) {
          ledMat.opacity = 0.5 + Math.sin(elapsed * 6) * 0.5;
        }
      });

      // Collectible Orbs (Proximity Popups)
      collectibles.forEach((orb) => {
        if (orb.userData.collected) {
          if (orb.children[2]) orb.children[2].visible = false;
          return;
        }
        orb.position.y = orb.userData.baseY + Math.sin(elapsed * 2.5 + orb.userData.index) * 0.35;
        orb.rotation.y = elapsed * 2 + orb.userData.index;
        if (orb.children[1]) orb.children[1].rotation.x = elapsed * 2.5;

        const d = forklift.position.distanceTo(orb.position);
        const orbLabel = orb.children[2];
        if (orbLabel) {
          updateHeaderProximity(orbLabel, d < 15, delta, { x: 4.8, y: 1.2 });
        }
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

      // Delivery Zones Dynamic Visibility, Sonar Rings & Beacon Highlights
      let inDropProximity = false;
      const carriedCrate = gameRef.current.carried && gameRef.current.carriedGroup
        ? gameRef.current.carriedGroup.userData.colorType
        : null;

      deliveryZones.forEach((zone) => {
        const distToZone = forklift.position.distanceTo(new THREE.Vector3(zone.x, 0, zone.z));
        const isMatchingTarget = carriedCrate && (zone.colorType.id === carriedCrate.id);
        const isReadyToDrop = distToZone < 4.8 && isMatchingTarget;

        // Animate Sonar Rings expanding on floor
        const s1 = 1.0 + ((elapsed * 2.5) % 2.5);
        zone.sonarRing1.scale.set(s1, s1, 1);
        zone.sonarRingMat1.opacity = isMatchingTarget ? Math.max(0, (2.5 - s1) * 0.4) : 0.12;

        const s2 = 1.0 + (((elapsed * 2.5) + 1.25) % 2.5);
        zone.sonarRing2.scale.set(s2, s2, 1);
        zone.sonarRingMat2.opacity = isMatchingTarget ? Math.max(0, (2.5 - s2) * 0.35) : 0.08;

        // Bouncing Chevron Arrow
        zone.chevronGroup.rotation.y = elapsed * (isMatchingTarget ? 4.0 : 1.5);
        zone.chevronGroup.position.y = (isMatchingTarget ? 2.5 : 3.8) + Math.sin(elapsed * (isMatchingTarget ? 8.0 : 3.0)) * 0.5;

        if (isReadyToDrop) {
          inDropProximity = true;
          zone.beamCoreMat.opacity = 0.95;
          zone.beamAuraMat.opacity = 0.5;
          zone.zoneLight.intensity = 3.5;

          updateHeaderProximity(zone.readyLabelSprite, true, delta, { x: 10.0, y: 2.0 });
          updateHeaderProximity(zone.targetLabelSprite, false, delta, { x: 11.5, y: 2.3 });
          zone.defaultLabelSprite.visible = false;
        } else if (isMatchingTarget) {
          // TARGET HIGHLIGHT (Flaring sky-beam, point light & target prompt!)
          zone.beamCoreMat.opacity = 0.8 + Math.sin(elapsed * 6) * 0.18;
          zone.beamAuraMat.opacity = 0.35 + Math.sin(elapsed * 6) * 0.15;
          zone.zoneLight.intensity = 2.4 + Math.sin(elapsed * 6) * 0.8;

          updateHeaderProximity(zone.targetLabelSprite, true, delta, { x: 11.5, y: 2.3 });
          updateHeaderProximity(zone.readyLabelSprite, false, delta, { x: 10.0, y: 2.0 });
          zone.defaultLabelSprite.visible = true;
          zone.defaultLabelSprite.scale.set(11.5, 2.3, 1);
        } else {
          // Normal state (always legible overhead)
          zone.beamCoreMat.opacity = carriedCrate ? 0.2 : 0.45;
          zone.beamAuraMat.opacity = carriedCrate ? 0.08 : 0.18;
          zone.zoneLight.intensity = carriedCrate ? 0.3 : 0.8;

          updateHeaderProximity(zone.targetLabelSprite, false, delta, { x: 11.5, y: 2.3 });
          updateHeaderProximity(zone.readyLabelSprite, false, delta, { x: 10.0, y: 2.0 });
          zone.defaultLabelSprite.visible = true;
          zone.defaultLabelSprite.scale.set(9.8, 1.96, 1);
        }
      });

      if (inDropProximity !== canDropRef.current) {
        canDropRef.current = inDropProximity;
        setCanDrop(inDropProximity);
      }



      // Real-Time Radar Minimap Canvas Rendering
      const radarCanvas = document.getElementById('wh-radar-canvas');
      const radarCoordsEl = document.getElementById('wh-radar-coords');
      if (radarCoordsEl) {
        radarCoordsEl.textContent = `X:${Math.round(forklift.position.x)} Z:${Math.round(forklift.position.z)}`;
      }
      if (radarCanvas) {
        const rCtx = radarCanvas.getContext('2d');
        const rw = radarCanvas.width;
        const rh = radarCanvas.height;

        rCtx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        rCtx.fillRect(0, 0, rw, rh);

        // Grid lines
        rCtx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
        rCtx.lineWidth = 1;
        for (let gx = 20; gx < rw; gx += 30) {
          rCtx.beginPath(); rCtx.moveTo(gx, 0); rCtx.lineTo(gx, rh); rCtx.stroke();
        }
        for (let gy = 20; gy < rh; gy += 30) {
          rCtx.beginPath(); rCtx.moveTo(0, gy); rCtx.lineTo(rw, gy); rCtx.stroke();
        }

        // Warehouse boundary
        rCtx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        rCtx.strokeRect(6, 6, rw - 12, rh - 12);

        const toRadarX = (wx) => ((wx + 105) / 210) * (rw - 24) + 12;
        const toRadarY = (wz) => ((wz + 70) / 140) * (rh - 24) + 12;

        // Draw delivery drop zones
        deliveryZones.forEach((z) => {
          const zx = toRadarX(z.x);
          const zy = toRadarY(z.z);
          const isTarget = carriedCrate && (z.colorType.id === carriedCrate.id);

          if (isTarget) {
            // Pulsing target beacon wave on radar
            const pulseR = 7 + Math.sin(elapsed * 8) * 3.5;
            rCtx.beginPath();
            rCtx.arc(zx, zy, pulseR, 0, Math.PI * 2);
            rCtx.strokeStyle = z.colorType.css;
            rCtx.lineWidth = 2;
            rCtx.stroke();

            // Guidance line from rover to destination
            const fx = toRadarX(forklift.position.x);
            const fy = toRadarY(forklift.position.z);
            rCtx.setLineDash([4, 4]);
            rCtx.strokeStyle = z.colorType.css;
            rCtx.lineWidth = 1.5;
            rCtx.beginPath();
            rCtx.moveTo(fx, fy);
            rCtx.lineTo(zx, zy);
            rCtx.stroke();
            rCtx.setLineDash([]);
          }

          rCtx.beginPath();
          rCtx.arc(zx, zy, isTarget ? 6 : 4, 0, Math.PI * 2);
          rCtx.fillStyle = z.colorType.css;
          rCtx.fill();
          rCtx.strokeStyle = '#ffffff';
          rCtx.lineWidth = 1;
          rCtx.stroke();
        });

        // Draw Crate locations on floor
        interactableBoxes.forEach((b) => {
          if (!b.userData.pickedUp) {
            const bx = toRadarX(b.position.x);
            const by = toRadarY(b.position.z);
            rCtx.fillStyle = b.userData.colorType.css;
            rCtx.fillRect(bx - 2, by - 2, 4, 4);
          }
        });

        // Draw Rover (Forklift)
        const rx = toRadarX(forklift.position.x);
        const ry = toRadarY(forklift.position.z);
        rCtx.save();
        rCtx.translate(rx, ry);
        rCtx.rotate(forklift.rotation.y);

        rCtx.fillStyle = '#38bdf8';
        rCtx.beginPath();
        rCtx.arc(0, 0, 4, 0, Math.PI * 2);
        rCtx.fill();

        rCtx.strokeStyle = '#ffffff';
        rCtx.lineWidth = 2;
        rCtx.beginPath();
        rCtx.moveTo(0, 0);
        rCtx.lineTo(0, 7);
        rCtx.stroke();
        rCtx.restore();
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

      const dayBg = new THREE.Color(0x131a26);
      const nightBg = new THREE.Color(0x060913);
      const targetBg = night ? nightBg : dayBg;
      scene.background.lerp(targetBg, lerpSpeed);
      scene.fog.color.lerp(targetBg, lerpSpeed);
      scene.fog.near += ((night ? 35 : 95) - scene.fog.near) * lerpSpeed;
      scene.fog.far += ((night ? 100 : 230) - scene.fog.far) * lerpSpeed;
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
      camera.updateMatrixWorld();

      // Real-Time GPS Compass & Distance Pill (Active Waypoint Tracker)
      const gpsNavEl = document.getElementById('wh-gps-nav');
      const gpsArrowEl = document.getElementById('wh-gps-arrow');
      const gpsIconEl = document.getElementById('wh-gps-icon');
      const gpsDistEl = document.getElementById('wh-gps-dist');

      // Waypoint Navigation: ONLY show when cargo is actively carried on the forklift
      let navTarget = null;
      if (carriedCrate) {
        const targetZone = deliveryZones.find(z => z.colorType.id === carriedCrate.id);
        if (targetZone) {
          navTarget = {
            x: targetZone.x,
            z: targetZone.z,
            colorType: targetZone.colorType,
            isDropZone: true,
          };
        }
      }

      if (navTarget && gpsNavEl && gpsArrowEl && gpsDistEl) {
        const dx = navTarget.x - forklift.position.x;
        const dz = navTarget.z - forklift.position.z;
        const distMeters = Math.round(Math.hypot(dx, dz));

        // Vehicle-Relative Heading Projection:
        // In the 3D model, the forklift's forks face +Z (forward = (sin(rotY), cos(rotY))).
        // When facing +Z, the vehicle's right side is along -X (-cos(rotY), sin(rotY)).
        const rotY = forklift.rotation.y;
        const forwardDist = dx * Math.sin(rotY) + dz * Math.cos(rotY);
        const rightDist = -dx * Math.cos(rotY) + dz * Math.sin(rotY);

        // Relative angle from the forklift's heading:
        // 0 deg = drop point is directly ahead of the forklift (UP)
        // +90 deg = drop point is directly to the right of the forklift (RIGHT)
        // -90 deg = drop point is directly to the left of the forklift (LEFT)
        // 180 deg = drop point is directly behind the forklift (DOWN)
        const relAngle = Math.atan2(rightDist, forwardDist);
        const deg = Math.round((relAngle * 180) / Math.PI);

        gpsArrowEl.style.transform = `rotate(${deg}deg)`;
        gpsArrowEl.style.fill = navTarget.colorType.css;

        if (gpsIconEl) {
          gpsIconEl.textContent = navTarget.colorType.subIcon || navTarget.colorType.icon;
        }

        if (distMeters <= 4) {
          gpsDistEl.textContent = 'UNLOAD [E]';
          gpsDistEl.style.color = '#10b981';
          gpsDistEl.style.borderColor = 'rgba(16, 185, 129, 0.6)';
        } else {
          gpsDistEl.textContent = `${distMeters}m`;
          gpsDistEl.style.color = '#38bdf8';
          gpsDistEl.style.borderColor = 'rgba(255, 255, 255, 0.18)';
        }

        gpsNavEl.style.borderColor = navTarget.colorType.css;
        gpsNavEl.style.boxShadow = `0 4px 18px rgba(0, 0, 0, 0.65), 0 0 16px ${navTarget.colorType.css}66`;
        gpsNavEl.style.display = 'flex';
      } else if (gpsNavEl) {
        gpsNavEl.style.display = 'none';
      }

      renderer.render(scene, camera);

      if (isFirstFrame) {
        isFirstFrame = false;
        const elapsedLoad = Date.now() - startTime;
        const minDisplayTime = 700;
        const remaining = Math.max(0, minDisplayTime - elapsedLoad);

        setTimeout(() => {
          if (progressTimer) clearInterval(progressTimer);
          if (messageTimer) clearInterval(messageTimer);
          setLoadingProgress(100);
          setLoadingStage('Warehouse Ready • Entering Facility...');
          setTimeout(() => {
            if (!isDisposed) {
              setIsLoading(false);
              setTimeout(() => {
                if (!isDisposed) setIsLoaderMounted(false);
              }, 600);
            }
          }, 260);
        }, remaining);
      }
    };
    animate();

    onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);
  }, 40);

  return () => {
    isDisposed = true;
    if (initTimer) clearTimeout(initTimer);
    if (progressTimer) clearInterval(progressTimer);
    if (messageTimer) clearInterval(messageTimer);
    if (animId) cancelAnimationFrame(animId);
    if (onKeyDown) window.removeEventListener('keydown', onKeyDown);
    if (onKeyUp) window.removeEventListener('keyup', onKeyUp);
    if (onResize) window.removeEventListener('resize', onResize);
    if (renderer) {
      renderer.dispose();
      if (mount && renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    }
  };
}, [showMessage, revealControlsBriefly, handleCompleteShiftOrder]);

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
    restartShift();
    showMessage('🔄 Position & Shift Reset!');
  };

  const currentOrder = SHIFT_ORDERS[shiftIndex] || null;

  return (
    <div className="warehouse-page">
      <div className="warehouse-canvas" ref={mountRef} />

      {/* ── Simplified Fast Loading Screen with Rotating Messages ── */}
      {isLoaderMounted && (
        <div className={`warehouse-loader ${!isLoading ? 'warehouse-loader--fade-out' : ''}`}>
          <div className="warehouse-loader__card">
            {/* Animated Forklift Emblem */}
            <div className="warehouse-loader__emblem-container">
              <div className="warehouse-loader__radar-ring" />
              <div className="warehouse-loader__emblem-icon">🚜</div>
            </div>

            {/* Header branding */}
            <div className="warehouse-loader__header">
              <span className="warehouse-loader__badge">⚡ 3D DIGITAL TWIN</span>
              <h2 className="warehouse-loader__title">WAREHOUSE SIMULATOR</h2>
            </div>

            {/* Live Progress Bar & Rotating Status Message */}
            <div className="warehouse-loader__progress-section">
              <div className="warehouse-loader__status-row">
                <span className="warehouse-loader__status-text" key={loadingStage}>
                  <span className="warehouse-loader__status-pulse" />
                  {loadingStage}
                </span>
                <span className="warehouse-loader__percent">{loadingProgress}%</span>
              </div>
              <div className="warehouse-loader__progress-bar">
                <div
                  className="warehouse-loader__progress-fill"
                  style={{ width: `${loadingProgress}%` }}
                >
                  <div className="warehouse-loader__progress-glow" />
                </div>
              </div>
            </div>

            {/* Simple one-liner controls hint */}
            <div className="warehouse-loader__quick-hint">
              <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Drive</span>
              <span>•</span>
              <span><kbd>E</kbd> Pick / Deliver</span>
              <span>•</span>
              <span><kbd>C</kbd> Camera</span>
            </div>
          </div>
        </div>
      )}

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

      {/* Real-Time Compact GPS Compass & Distance Pill */}
      <div id="wh-gps-nav" className="warehouse-gps-pill">
        <div className="warehouse-gps-pill__compass">
          <svg
            id="wh-gps-arrow"
            className="warehouse-gps-pill__arrow"
            viewBox="0 0 24 24"
            width="18"
            height="18"
          >
            <polygon points="12,2 21,20 12,16 3,20" />
          </svg>
        </div>
        <span id="wh-gps-icon" className="warehouse-gps-pill__icon">📦</span>
        <span id="wh-gps-dist" className="warehouse-gps-pill__dist">45m</span>
      </div>

      {/* Warehouse Radar Minimap */}
      <div className="warehouse-minimap-container">
        <div className="warehouse-minimap-header">
          <span>📡 FACILITY RADAR</span>
          <span className="warehouse-minimap-coords" id="wh-radar-coords">X:0 Z:0</span>
        </div>
        <canvas id="wh-radar-canvas" width="190" height="130" className="warehouse-radar-canvas" />
        <div className="warehouse-minimap-legend">
          <span>🟣 .NET</span>
          <span>🇪🇸 MAD</span>
          <span>⚙️ PLC</span>
          <span>🐇 MQ</span>
          <span>🟢 PTL</span>
        </div>
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
          <button
            className="warehouse-hud__help-btn"
            onClick={() => setShowShiftCard((p) => !p)}
            title="Toggle 100k Shift Quest Card"
            style={{ borderColor: showShiftCard ? 'rgba(245, 158, 11, 0.6)' : 'rgba(100, 116, 139, 0.4)', color: showShiftCard ? '#fbbf24' : '#94a3b8' }}
          >
            ⚡ Shift
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

        {/* ── The 100k Shift Mission Card ── */}
        {currentOrder && !shiftCompleted && showShiftCard && (
          <div className="warehouse-shift-card">
            <div className="warehouse-shift-card__top">
              <span className="warehouse-shift-card__badge">⚡ THE 100K SHIFT</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="warehouse-shift-card__order-num">ORDER {shiftIndex + 1}/5</span>
                <button
                  onClick={() => setShowShiftCard(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '0 4px',
                    lineHeight: '1',
                  }}
                  title="Minimize Shift Card"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="warehouse-shift-card__title">
              {currentOrder.targetColor.subIcon || currentOrder.icon} {currentOrder.title}
            </div>
            <div className="warehouse-shift-card__client">
              Client: {currentOrder.client}
            </div>
            <div className="warehouse-shift-card__target">
              <span>Target: {currentOrder.targetColor.subIcon || currentOrder.targetColor.icon} <strong>{currentOrder.targetZoneName}</strong></span>
              <span className="warehouse-shift-card__reward">+{currentOrder.points} PTS</span>
            </div>
            <div className="warehouse-shift-card__progress-bar">
              {SHIFT_ORDERS.map((ord, idx) => (
                <div
                  key={ord.id}
                  className={`warehouse-shift-card__progress-seg ${
                    completedOrders.includes(ord.id)
                      ? 'warehouse-shift-card__progress-seg--done'
                      : idx === shiftIndex
                      ? 'warehouse-shift-card__progress-seg--active'
                      : ''
                  }`}
                  title={ord.title}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* On-screen Objective HUD Banner */}
      <div className={`warehouse-objective ${canDrop ? 'warehouse-objective--ready' : (carried ? 'warehouse-objective--deliver' : '')}`}>
        <span className="warehouse-objective__icon">{canDrop ? '✅' : (carried ? (carriedColor?.subIcon || carriedColor?.icon || '📦') : '📦')}</span>
        <span className="warehouse-objective__text">
          {canDrop ? (
            <>READY TO UNLOAD! Press <kbd>E</kbd> to deliver {carriedColor?.title || carriedColor?.name}</>
          ) : carried ? (
            carriedColor?.id === currentOrder?.targetColor.id ? (
              <>MATCHING SHIFT CRATE! Deliver {carriedColor?.subIcon || carriedColor?.icon} <strong style={{ color: carriedColor?.css }}>{carriedColor?.title || carriedColor?.name}</strong> to {carriedColor?.zoneName} to unlock Experience!</>
            ) : (
              <>OBJECTIVE: Deliver {carriedColor?.subIcon || carriedColor?.icon} <strong style={{ color: carriedColor?.css }}>{carriedColor?.title || carriedColor?.name}</strong> to {carriedColor?.zoneName}!</>
            )
          ) : currentOrder ? (
            <>ORDER #{currentOrder.id}/5: Pick up {currentOrder.targetColor.subIcon || currentOrder.targetColor.icon} <strong style={{ color: currentOrder.targetColor.css }}>{currentOrder.targetColor.title}</strong> & deliver to {currentOrder.targetColor.zoneName}</>
          ) : (
            <>TECH CRATES: Pick up any branded container (🟣 🟠 🔵 🟡 🟢) & deliver to matching zone to unlock Resume details!</>
          )}
        </span>
      </div>

      {/* Milestone Achievement Popup Modal */}
      {activeMilestone && (
        <div className="warehouse-milestone-overlay">
          <div className="warehouse-milestone-card">
            <div className="warehouse-milestone-card__header">
              <span className="warehouse-milestone-card__icon">{activeMilestone.icon}</span>
              <div>
                <span className="warehouse-milestone-card__badge">{activeMilestone.badge}</span>
                <h2 className="warehouse-milestone-card__title">{activeMilestone.milestoneTitle}</h2>
              </div>
            </div>
            <div className="warehouse-milestone-card__stat">
              <span>⚡ KEY METRIC:</span> <strong>{activeMilestone.milestoneStat}</strong>
            </div>
            <div className="warehouse-milestone-card__reveal-box">
              <span className="warehouse-milestone-card__reveal-label">🎯 RESUME EXPERIENCE UNLOCKED</span>
              <p className="warehouse-milestone-card__reveal-quote">"{activeMilestone.milestoneStory}"</p>
            </div>
            <div className="warehouse-milestone-card__tech">
              {activeMilestone.tech.map((t, idx) => (
                <span key={idx} className="warehouse-milestone-card__tag">{t}</span>
              ))}
            </div>
            <div className="warehouse-milestone-card__footer">
              <span className="warehouse-milestone-card__points">+{activeMilestone.points} PTS AWARDED</span>
              <button
                className="warehouse-milestone-card__btn"
                onClick={() => setActiveMilestone(null)}
              >
                {shiftCompleted ? 'Close' : (shiftIndex < SHIFT_ORDERS.length ? 'Continue Sorting →' : 'Complete Shift 🏆')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Complete Celebration Modal */}
      {shiftCompleted && (
        <div className="warehouse-milestone-overlay">
          <div className="warehouse-milestone-card warehouse-milestone-card--complete">
            <div className="warehouse-milestone-card__header">
              <span className="warehouse-milestone-card__icon">🏆</span>
              <div>
                <span className="warehouse-milestone-card__badge">MISSION ACCOMPLISHED</span>
                <h2 className="warehouse-milestone-card__title">PROMOTED: LEAD SYSTEMS ARCHITECT</h2>
              </div>
            </div>
            <div className="warehouse-milestone-card__stat">
              <span>⚡ SHIFT PERFORMANCE:</span> <strong>100,000+ PARCELS/DAY SORTATION COMPLETED</strong>
            </div>
            <p className="warehouse-milestone-card__story">
              Congratulations! You have successfully mastered all 5 core automated warehouse systems: from high-speed .NET sortation engines and Madrid cross-border deployments to low-latency PLC hardware layers, RabbitMQ event buses, and Put-to-Light stations.
            </p>
            <div className="warehouse-milestone-card__footer">
              <a
                href={process.env.REACT_APP_RESUME_URL || "https://www.linkedin.com/in/fahadeqbalhashmi/overlay/1790103866659/single-media-viewer/?profileId=ACoAADJh0a0BT_CnkPTMzrP9xiyEZhro7LKg7Io"}
                target="_blank"
                rel="noopener noreferrer"
                className="warehouse-milestone-card__btn warehouse-milestone-card__btn--portfolio"
                style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}
              >
                📄 View My Resume
              </a>
              <button
                className="warehouse-milestone-card__btn"
                onClick={restartShift}
              >
                🔄 Start Another Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carried Indicator */}
      {carried && (
        <div className="warehouse-carried" style={{ borderColor: carriedColor?.css }}>
          <span>{carriedColor?.subIcon || carriedColor?.icon} Carrying {carriedColor?.title || carriedColor?.name}</span>
          <small>Deliver to {carriedColor?.zoneName || carriedColor?.name}</small>
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

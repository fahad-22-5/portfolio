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
  // Strip regional flag emojis (which render as broken red bars on Canvas 2D)
  const cleanText = text
    .replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '')
    .replace(/🇪🇸|🇸🇦/g, '')
    .trim();

  const isMadrid = cleanText.toUpperCase().includes('MADRID');
  const isRiyadh = cleanText.toUpperCase().includes('RIYADH');
  const isPlc = cleanText.toUpperCase().includes('PLC');

  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(8, 8, 704, 94, 22);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Subtle inner highlight frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(14, 14, 692, 82, 18);
  ctx.stroke();

  // If it's Madrid or Riyadh Gate, draw crisp vector flag ribbons on both sides
  if (isMadrid) {
    [-1, 1].forEach((dir) => {
      const fx = dir === -1 ? 28 : 656;
      const fy = 38;
      ctx.fillStyle = '#aa151b';
      ctx.fillRect(fx, fy, 36, 8);
      ctx.fillStyle = '#f1bf00';
      ctx.fillRect(fx, fy + 8, 36, 18);
      ctx.fillStyle = '#aa151b';
      ctx.fillRect(fx, fy + 26, 36, 8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, fy, 36, 34);
    });
  } else if (isRiyadh) {
    [-1, 1].forEach((dir) => {
      const fx = dir === -1 ? 28 : 656;
      const fy = 38;
      ctx.fillStyle = '#047857';
      ctx.fillRect(fx, fy, 36, 34);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx + 6, fy + 15, 24, 4);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, fy, 36, 34);
    });
  } else if (isPlc) {
    [-1, 1].forEach((dir) => {
      const fx = dir === -1 ? 28 : 656;
      const fy = 38;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(fx, fy, 36, 34);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, fy, 36, 34);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', fx + 18, fy + 17);
    });
  }

  // Dynamically scale font size so text NEVER clips or overflows
  let fontSize = 28;
  ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`;
  const maxAllowedWidth = (isMadrid || isRiyadh || isPlc) ? 560 : 640;
  while (ctx.measureText(cleanText).width > maxAllowedWidth && fontSize > 16) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`;
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(cleanText, 360, 55);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(9.8, 1.5, 1);
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

  const isPlc = crateInfo.id === 'plc';
  const isRiyadh = crateInfo.id === 'riyadh';
  const isMadrid = crateInfo.id === 'madrid';

  // 1. Container base body color
  ctx.fillStyle = crateInfo.css;
  ctx.fillRect(0, 0, 512, 512);

  // If Riyadh: Draw 2 bold golden air-cargo ratchet tie-down straps running vertically
  if (isRiyadh) {
    [80, 400].forEach((strapX) => {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(strapX - 4, 0, 36, 512);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(strapX, 0, 28, 512);
      // Strap stitching lines
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(strapX + 4, 0); ctx.lineTo(strapX + 4, 512);
      ctx.moveTo(strapX + 24, 0); ctx.lineTo(strapX + 24, 512);
      ctx.stroke();
    });
  }

  // If PLC: Draw industrial yellow & black safety hazard chevron borders at top & bottom
  if (isPlc) {
    [0, 480].forEach((barY) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, barY, 512, 32);
      for (let i = -32; i < 544; i += 36) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(i, barY);
        ctx.lineTo(i + 18, barY);
        ctx.lineTo(i + 36, barY + 32);
        ctx.lineTo(i + 18, barY + 32);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  // 2. Heavy industrial metallic frame around edge
  ctx.strokeStyle = isRiyadh ? '#78350f' : (isPlc ? '#0f172a' : '#0f172a');
  ctx.lineWidth = 32;
  ctx.strokeRect(16, 16, 480, 480);

  // Inner bevel
  ctx.strokeStyle = isRiyadh ? 'rgba(251, 191, 36, 0.45)' : (isPlc ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.28)');
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, 440, 440);

  // 3. Industrial Corner brackets (L-plates)
  ctx.fillStyle = isRiyadh ? '#92400e' : (isPlc ? '#1e293b' : '#1e293b');
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

  // Bolt rivets
  ctx.fillStyle = isRiyadh ? '#fde047' : '#cbd5e1';
  [[48, 48], [464, 48], [48, 464], [464, 464], [256, 24], [256, 488], [24, 256], [488, 256]].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isRiyadh ? '#b45309' : '#475569';
    ctx.stroke();
  });

  if (faceType === 'top') {
    // ── TOP FACE ──
    ctx.fillStyle = isRiyadh ? 'rgba(6, 46, 28, 0.94)' : (isPlc ? 'rgba(11, 19, 43, 0.94)' : 'rgba(15, 23, 42, 0.88)');
    ctx.beginPath();
    ctx.roundRect(60, 60, 392, 392, 16);
    ctx.fill();
    ctx.strokeStyle = isRiyadh ? '#f59e0b' : (isPlc ? '#38bdf8' : crateInfo.css);
    ctx.lineWidth = 4;
    ctx.stroke();

    if (isPlc) {
      // High-voltage warning on top of PLC
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡  ⚙️', 256, 160);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 30px "Space Grotesk", sans-serif';
      ctx.fillText('PLC HARDWARE I/O', 256, 245);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('⚠️ 24V DC • HIGH-SPEED BUS', 256, 290);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('DO NOT STACK > 3 UNITS', 256, 325);

      // Bottom warning stripes
      for (let i = 80; i < 432; i += 32) {
        ctx.fillStyle = (i / 32) % 2 === 0 ? '#fbbf24' : '#0f172a';
        ctx.fillRect(i, 360, 24, 30);
      }
    } else if (isRiyadh) {
      // Air cargo markings on top of Riyadh crate
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✈️  ⬆', 256, 160);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 30px "Space Grotesk", sans-serif';
      ctx.fillText('PRIORITY AIR CARGO', 256, 245);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('DESTINATION: RUH (KSA)', 256, 290);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('★ GCC CUSTOMS CLEARED ★', 256, 325);

      // Bottom gold stripes
      for (let i = 80; i < 432; i += 32) {
        ctx.fillStyle = (i / 32) % 2 === 0 ? '#10b981' : '#f59e0b';
        ctx.fillRect(i, 360, 24, 30);
      }
    } else {
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
    }
  } else {
    // ── FRONT & SIDE FACE ──
    ctx.fillStyle = isRiyadh ? 'rgba(4, 35, 21, 0.95)' : (isPlc ? 'rgba(10, 18, 38, 0.95)' : 'rgba(15, 23, 42, 0.92)');
    ctx.beginPath();
    ctx.roundRect(50, 70, 412, 372, 16);
    ctx.fill();
    ctx.strokeStyle = isRiyadh ? '#fbbf24' : (isPlc ? '#38bdf8' : '#ffffff');
    ctx.lineWidth = 3;
    ctx.stroke();

    // Header badge strip
    ctx.fillStyle = isRiyadh ? '#065f46' : (isPlc ? '#1d4ed8' : crateInfo.css);
    ctx.fillRect(50, 70, 412, 42);
    ctx.fillStyle = isRiyadh ? '#fbbf24' : '#ffffff';
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPlc ? '⚡ INDUSTRIAL PLC CONTROLLER ⚡' : (isRiyadh ? '✈️ GCC AIR FREIGHT — RUH ✈️' : crateInfo.badge), 256, 91);

    if (isPlc) {
      // ── PLC Hardware Controller Graphic ──
      // Left: PLC CPU & I/O Module Rack with 4 status LEDs
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(75, 130, 95, 95, 8);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rack title
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('I/O BUS', 122, 142);

      // Diagnostic LEDs
      const leds = [
        { label: 'PWR', color: '#22c55e', y: 158 },
        { label: 'RUN', color: '#22c55e', y: 174 },
        { label: 'BUS', color: '#38bdf8', y: 190 },
        { label: 'I/O', color: '#fbbf24', y: 206 },
      ];
      leds.forEach((ld) => {
        ctx.fillStyle = ld.color;
        ctx.beginPath();
        ctx.arc(95, ld.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(ld.label, 106, ld.y + 3);
      });

      // Center: Big Stencil Gear & Lightning
      ctx.textAlign = 'center';
      ctx.font = '54px "Segoe UI Emoji", sans-serif';
      ctx.fillText('⚙️', 260, 168);
      ctx.font = '32px sans-serif';
      ctx.fillText('⚡', 295, 150);

      // Sub-label for PLC module
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px "Space Grotesk", sans-serif';
      ctx.fillText('SIEMENS S7 / BUS', 260, 212);

      // Right: Circuit trace graphics
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(345, 145); ctx.lineTo(395, 145); ctx.lineTo(415, 165);
      ctx.moveTo(345, 175); ctx.lineTo(385, 175); ctx.lineTo(405, 195); ctx.lineTo(430, 195);
      ctx.moveTo(345, 205); ctx.lineTo(375, 205); ctx.lineTo(395, 220);
      ctx.stroke();
      [ [415, 165], [430, 195], [395, 220] ].forEach(([cx, cy]) => {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Brand Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillText('PLC HARDWARE', 256, 255);

      // Tagline
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('CONVEYOR CONTROLS (<5ms)', 256, 295);

      // Serial
      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.fillText('SN: PLC-S7-CONV-2026-X99', 256, 335);
    } else if (isRiyadh) {
      // ── Riyadh International Air Cargo Graphic ──
      // Left: Saudi Flag Ribbon
      const fx = 75;
      const fy = 138;
      ctx.fillStyle = '#047857';
      ctx.fillRect(fx, fy, 55, 36);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx + 8, fy + 16, 39, 4);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, fy, 55, 36);

      // Right: ZATCA Customs clearance round stamp
      const sx = 410;
      const sy = 156;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ZATCA', sx, sy - 6);
      ctx.fillText('CLEARED', sx, sy + 6);
      ctx.fillText('★ KSA ★', sx, sy + 17);

      // Center: Giant "✈️ RUH" Flight Code Box
      ctx.fillStyle = 'rgba(6, 95, 70, 0.85)';
      ctx.beginPath();
      ctx.roundRect(148, 130, 216, 75, 10);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 36px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✈️ RUH', 256, 166);

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('KING KHALID INT\'L AIRPORT', 256, 192);

      // Brand Name
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillText('RIYADH CARGO', 256, 255);

      // Tagline
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('MIDDLE EAST LOGISTICS HUB', 256, 295);

      // Air Waybill Serial
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px monospace';
      ctx.fillText('AWB: 065-RUH-2026-GCC', 256, 335);
    } else if (isMadrid) {
      const fx = 256 - 45;
      const fy = 152;
      ctx.fillStyle = '#aa151b';
      ctx.fillRect(fx, fy, 90, 16);
      ctx.fillStyle = '#f1bf00';
      ctx.fillRect(fx, fy + 16, 90, 32);
      ctx.fillStyle = '#aa151b';
      ctx.fillRect(fx, fy + 48, 90, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, 90, 64);

      ctx.fillStyle = '#aa151b';
      ctx.font = '900 24px "Space Grotesk", sans-serif';
      ctx.fillText('✈️ MAD', 256, fy + 33);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillText(crateInfo.shortName, 256, 255);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(crateInfo.tagline.toUpperCase(), 256, 295);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.fillText(`SN: ${crateInfo.id.toUpperCase()}-2026-X99`, 256, 335);
    } else {
      ctx.font = '76px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(crateInfo.subIcon || crateInfo.icon, 256, 185);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillText(crateInfo.shortName, 256, 255);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(crateInfo.tagline.toUpperCase(), 256, 295);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.fillText(`SN: ${crateInfo.id.toUpperCase()}-2026-X99`, 256, 335);
    }

    // Barcode lines
    const barcodeY = 360;
    ctx.fillStyle = isRiyadh ? '#fbbf24' : '#ffffff';
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

  // 2. Realistic concrete mottled texture & fine aggregate noise (stride 16 for fast startup)
  for (let y = 0; y < 1024; y += 16) {
    for (let x = 0; x < 1024; x += 16) {
      const rand = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = rand - Math.floor(rand);
      if (noise > 0.65) {
        ctx.fillStyle = noise > 0.85 ? 'rgba(56, 68, 88, 0.22)' : 'rgba(15, 20, 28, 0.25)';
        ctx.fillRect(x, y, 16, 16);
      }
    }
  }

  // 3. Concrete Slab Expansion Joints (4 major slabs per tile: 512x512 each)
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0d131d';
  ctx.beginPath();
  ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
  ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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
    ctx.fillStyle = '#1e2633';
    ctx.fillRect(x, 0, 4, 380);
    ctx.fillStyle = '#3e4d61';
    ctx.fillRect(x + 4, 0, 4, 380);
    ctx.fillStyle = '#2d3848';
    ctx.fillRect(x + 8, 0, 8, 380);
  }

  // 3. Horizontal Structural Girts & Fastener Rivet Lines
  [90, 190, 290].forEach((gy) => {
    ctx.fillStyle = '#161d28';
    ctx.fillRect(0, gy, 1024, 8);
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, gy + 8, 1024, 2);
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

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(60, 40, 904, 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Space Grotesk", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('  ● LOGISTICS DISTRIBUTION CENTER • SECTOR 04 • ZONE HIGH-BAY', 70, 54);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Space Grotesk", sans-serif';
  ctx.fillText('AUTOMATED LOGISTICS SORTATION HUB', 85, 100);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('AUTOMATED DIGITAL TWIN FACILITY', 940, 130);

  // Safety Placards & Warning Signs
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

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(400, 215, 200, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('🧯 FIRE HOSE REEL', 500, 240);
  ctx.font = '12px monospace';
  ctx.fillText('STATION #04', 500, 260);

  ctx.fillStyle = '#10b981';
  ctx.fillRect(660, 215, 240, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('EMERGENCY EXIT 🚪 →', 780, 240);
  ctx.font = '12px monospace';
  ctx.fillText('KEEP PASSAGEWAY CLEAR', 780, 260);

  // 5. Lower Impact Wainscot
  ctx.fillStyle = '#131b26';
  ctx.fillRect(0, 380, 1024, 132);

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
  ctx.fillRect(0, 376, 1024, 4);
  ctx.fillRect(0, 420, 1024, 3);

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

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(20, 15, 472, 45);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "Space Grotesk", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`▲ DOCK BAY 0${dockNumber} • CLEARANCE 4.8M ▲`, 256, 37);

  const slatHeight = 22;
  for (let y = 70; y < 500; y += slatHeight) {
    ctx.fillStyle = y % 44 === 0 ? '#1e293b' : '#273549';
    ctx.fillRect(25, y, 462, slatHeight - 2);
    ctx.fillStyle = '#475569';
    ctx.fillRect(25, y, 462, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(25, y + slatHeight - 2, 462, 2);
  }

  ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
  ctx.font = 'bold 72px "Space Grotesk", sans-serif';
  ctx.fillText(`0${dockNumber}`, 256, 260);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('OUTBOUND FREIGHT', 256, 320);

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
   HELPER — Forklift Industrial Horn Audio Synthesizer (Web Audio API)
   ────────────────────────────────────── */
function playForkliftHorn() {
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return;
    if (!window._whAudioCtx) {
      window._whAudioCtx = new AudioCtxClass();
    }
    const ctx = window._whAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Dual-tone industrial forklift horn (420 Hz & 528 Hz)
    [420, 528].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      // Honk 1 (0.13s)
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.setValueAtTime(0.18, now + 0.13);
      gain.gain.linearRampToValueAtTime(0, now + 0.16);

      // Honk 2 (0.26s)
      gain.gain.setValueAtTime(0, now + 0.22);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.24);
      gain.gain.setValueAtTime(0.22, now + 0.46);
      gain.gain.linearRampToValueAtTime(0, now + 0.50);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.52);
    });
  } catch (e) {
    // Graceful fallback
  }
}

/* ──────────────────────────────────────
   HELPER — Madrid Gate Roll-Up Door Texture
   ────────────────────────────────────── */
let madridDoorTextureCache = null;
function getMadridDockDoorTexture() {
  if (madridDoorTextureCache) return madridDoorTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Obsidian industrial background
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, 512, 512);

  // Spanish Flag Header Stripe
  ctx.fillStyle = '#aa151b';
  ctx.fillRect(20, 12, 472, 14);
  ctx.fillStyle = '#f1bf00';
  ctx.fillRect(20, 26, 472, 24);
  ctx.fillStyle = '#aa151b';
  ctx.fillRect(20, 50, 472, 14);

  // Header Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✈️ MADRID GATE • BAY 04 • EUROPEAN LOGISTICS', 256, 38);

  // Roll-Up Horizontal Industrial Slats
  const slatHeight = 22;
  for (let y = 72; y < 490; y += slatHeight) {
    ctx.fillStyle = y % 44 === 0 ? '#1e293b' : '#172033';
    ctx.fillRect(25, y, 462, slatHeight - 2);
    ctx.fillStyle = '#38bdf8';
    ctx.globalAlpha = 0.15;
    ctx.fillRect(25, y, 462, 1);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#050811';
    ctx.fillRect(25, y + slatHeight - 2, 462, 2);
  }

  // European Logistics / Customs Stamp Seal in Center
  ctx.strokeStyle = 'rgba(241, 191, 0, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(256, 260, 110, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(256, 260, 125, 0, Math.PI * 2);
  ctx.stroke();

  // Upper callsign
  ctx.fillStyle = '#f1bf00';
  ctx.font = '900 80px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAD', 256, 235);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('SPAIN // CROSS-BORDER AIR & ROAD', 256, 280);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('ADUANA ESPAÑA • CUSTOMS CLEARANCE VERIFIED', 256, 305);

  // ✈️ MASSIVE BOLD "MAD" ON THE VISIBLE LOWER HANGING SLATS (Y: 335 - 475)
  // High-contrast industrial dark slate plaque with amber border
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(70, 335, 372, 130, 16);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  // Subtle inner accent border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(78, 343, 356, 114);

  // Spanish flag ribbons flanking MAD
  // Left Flag
  ctx.fillStyle = '#aa151b';
  ctx.fillRect(92, 380, 24, 7);
  ctx.fillStyle = '#f1bf00';
  ctx.fillRect(92, 387, 24, 14);
  ctx.fillStyle = '#aa151b';
  ctx.fillRect(92, 401, 24, 7);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(92, 380, 24, 28);

  // Right Flag
  ctx.fillStyle = '#aa151b';
  ctx.fillRect(396, 380, 24, 7);
  ctx.fillStyle = '#f1bf00';
  ctx.fillRect(396, 387, 24, 14);
  ctx.fillStyle = '#aa151b';
  ctx.fillRect(396, 401, 24, 7);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(396, 380, 24, 28);

  // Massive, bold golden MAD
  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 105px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillText('MAD', 256, 396);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Sub-badge: GATE 04
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('● GATE 04 • EUROPEAN DISPATCH ●', 256, 442);

  // Bottom Spanish Red & Gold Hazard Stripes
  for (let i = 25; i < 487; i += 28) {
    ctx.fillStyle = '#f1bf00';
    ctx.fillRect(i, 486, 14, 20);
    ctx.fillStyle = '#aa151b';
    ctx.fillRect(i + 14, 486, 14, 20);
  }

  madridDoorTextureCache = new THREE.CanvasTexture(canvas);
  madridDoorTextureCache.needsUpdate = true;
  return madridDoorTextureCache;
}

/* ──────────────────────────────────────
   HELPER — Madrid Gate Overhead Signboard Texture
   ────────────────────────────────────── */
let madridSignTextureCache = null;
function getMadridGateSignboardTexture() {
  if (madridSignTextureCache) return madridSignTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Deep obsidian frame
  ctx.fillStyle = '#060a17';
  ctx.fillRect(0, 0, 1024, 256);

  // Glowing neon amber frame
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 1008, 240);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 992, 224);

  // Spanish Flag Stripes on left and right
  [-1, 1].forEach((dir) => {
    const xBase = dir === -1 ? 30 : 934;
    ctx.fillStyle = '#aa151b';
    ctx.fillRect(xBase, 35, 60, 45);
    ctx.fillStyle = '#f1bf00';
    ctx.fillRect(xBase, 80, 60, 96);
    ctx.fillStyle = '#aa151b';
    ctx.fillRect(xBase, 176, 60, 45);
  });

  // Main Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 58px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 18;
  ctx.fillText('✈️ MADRID GATE — EUROPEAN LOGISTICS', 512, 95);
  ctx.shadowBlur = 0;

  // Subtitle / Clearance Info
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('CROSS-BORDER DISPATCH BAY 04 • MADRID-BARAJAS AIR CARGO', 512, 162);

  // Flashing status pill
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('● CUSTOMS AUTOMATED CLEARANCE: ACTIVE (02H 30M DISPATCH WINDOW)', 512, 202);

  madridSignTextureCache = new THREE.CanvasTexture(canvas);
  madridSignTextureCache.needsUpdate = true;
  return madridSignTextureCache;
}

/* ──────────────────────────────────────
   HELPER — Riyadh Gate Shutter Door Texture (RUH)
   ────────────────────────────────────── */
let riyadhDoorTextureCache = null;
function getRiyadhDockDoorTexture() {
  if (riyadhDoorTextureCache) return riyadhDoorTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Obsidian industrial background
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, 512, 512);

  // Saudi Flag Green Header Stripe
  ctx.fillStyle = '#047857';
  ctx.fillRect(20, 12, 472, 44);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(20, 56, 472, 8);

  // Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✈️ RIYADH GATE • BAY 01 • MIDDLE EAST LOGISTICS', 256, 34);

  // Roll-Up Horizontal Industrial Slats
  const slatHeight = 22;
  for (let y = 72; y < 490; y += slatHeight) {
    ctx.fillStyle = y % 44 === 0 ? '#1e293b' : '#172033';
    ctx.fillRect(25, y, 462, slatHeight - 2);
    ctx.fillStyle = '#10b981';
    ctx.globalAlpha = 0.15;
    ctx.fillRect(25, y, 462, 1);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#050811';
    ctx.fillRect(25, y + slatHeight - 2, 462, 2);
  }

  // Middle East / Customs Stamp Seal in Center
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(256, 260, 110, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(256, 260, 125, 0, Math.PI * 2);
  ctx.stroke();

  // Upper callsign
  ctx.fillStyle = '#10b981';
  ctx.font = '900 80px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RUH', 256, 235);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('KSA // GCC CROSS-BORDER AIR & ROAD', 256, 280);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('ZATCA SAUDI CUSTOMS • CLEARANCE VERIFIED', 256, 305);

  // ✈️ MASSIVE BOLD "RUH" ON THE VISIBLE LOWER HANGING SLATS (Y: 335 - 475)
  // High-contrast industrial dark slate plaque with emerald border
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(70, 335, 372, 130, 16);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#10b981';
  ctx.stroke();

  // Subtle inner gold accent border
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(78, 343, 356, 114);

  // Saudi flag ribbons flanking RUH
  // Left Flag
  ctx.fillStyle = '#047857';
  ctx.fillRect(92, 380, 26, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(96, 393, 18, 3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(92, 380, 26, 28);

  // Right Flag
  ctx.fillStyle = '#047857';
  ctx.fillRect(394, 380, 26, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(398, 393, 18, 3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(394, 380, 26, 28);

  // Massive, bold emerald RUH
  ctx.fillStyle = '#10b981';
  ctx.font = '900 105px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillText('RUH', 256, 396);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Sub-badge: GATE 01
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('● GATE 01 • MIDDLE EAST DISPATCH ●', 256, 442);

  // Bottom Emerald & Gold Hazard Stripes
  for (let i = 25; i < 487; i += 28) {
    ctx.fillStyle = '#10b981';
    ctx.fillRect(i, 486, 14, 20);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(i + 14, 486, 14, 20);
  }

  riyadhDoorTextureCache = new THREE.CanvasTexture(canvas);
  riyadhDoorTextureCache.needsUpdate = true;
  return riyadhDoorTextureCache;
}

/* ──────────────────────────────────────
   HELPER — Riyadh Gate Overhead Signboard Texture
   ────────────────────────────────────── */
let riyadhSignTextureCache = null;
function getRiyadhGateSignboardTexture() {
  if (riyadhSignTextureCache) return riyadhSignTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Deep obsidian frame
  ctx.fillStyle = '#060a17';
  ctx.fillRect(0, 0, 1024, 256);

  // Glowing neon emerald frame
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 1008, 240);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 992, 224);

  // Saudi Flag Stripes on left and right
  [-1, 1].forEach((dir) => {
    const xBase = dir === -1 ? 30 : 934;
    ctx.fillStyle = '#047857';
    ctx.fillRect(xBase, 35, 60, 186);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(xBase + 10, 125, 40, 6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(xBase, 35, 60, 186);
  });

  // Main Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 58px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 18;
  ctx.fillText('✈️ RIYADH GATE — MIDDLE EAST LOGISTICS', 512, 95);
  ctx.shadowBlur = 0;

  // Subtitle / Clearance Info
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('GCC CROSS-BORDER DISPATCH BAY 01 • KING KHALID CARGO TERMINAL', 512, 162);

  // Flashing status pill
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('● ZATCA / SAUDI CUSTOMS AUTOMATED CLEARANCE: ACTIVE (01H 45M WINDOW)', 512, 202);

  riyadhSignTextureCache = new THREE.CanvasTexture(canvas);
  riyadhSignTextureCache.needsUpdate = true;
  return riyadhSignTextureCache;
}

/* ──────────────────────────────────────
   HELPER — Riyadh Trailer Wall Texture
   ────────────────────────────────────── */
let riyadhTrailerWallTexCache = null;
function getRiyadhTrailerWallTexture() {
  if (riyadhTrailerWallTexCache) return riyadhTrailerWallTexCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Corrugated off-white aluminum wall panel
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 512, 512);

  // Vertical corrugation ribs
  for (let x = 0; x < 512; x += 16) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x, 0, 6, 512);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x + 6, 0, 2, 512);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, 0, 3, 512);
  }

  // Horizontal galvanized E-Track cargo tie-down rails
  [140, 280].forEach((trackY) => {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, trackY, 512, 36);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, trackY + 2, 512, 4);
    ctx.fillRect(0, trackY + 30, 512, 4);

    for (let sx = 10; sx < 512; sx += 32) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx, trackY + 8, 14, 20);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, trackY + 8, 14, 20);
    }
  });

  // Lower impact scuff liner
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 420, 512, 92);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(0, 416, 512, 4);

  // Trailer internal placard
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(20, 40, 240, 60);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 40, 240, 60);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 13px "Space Grotesk", sans-serif';
  ctx.fillText('RIYADH LOGISTICS HUB (KSA)', 30, 64);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.fillText('GCC EXPRESS • SEMI-TRAILER #SA-1088', 30, 84);

  riyadhTrailerWallTexCache = new THREE.CanvasTexture(canvas);
  riyadhTrailerWallTexCache.wrapS = THREE.RepeatWrapping;
  riyadhTrailerWallTexCache.wrapT = THREE.RepeatWrapping;
  riyadhTrailerWallTexCache.repeat.set(4, 1);
  riyadhTrailerWallTexCache.needsUpdate = true;
  return riyadhTrailerWallTexCache;
}

/* ──────────────────────────────────────
   HELPER — Riyadh Trailer Open Door Texture
   ────────────────────────────────────── */
let riyadhTrailerDoorTexCache = null;
function getRiyadhTrailerDoorTexture() {
  if (riyadhTrailerDoorTexCache) return riyadhTrailerDoorTexCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  // Black rubber weather gasket border
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 494, 512, 18);
  ctx.fillRect(0, 0, 18, 512);
  ctx.fillRect(494, 0, 18, 512);

  // Vertical stainless cam-lock pipe & keeper
  ctx.fillStyle = '#64748b';
  ctx.fillRect(240, 0, 32, 512);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(246, 0, 20, 512);

  // Door locking handle
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(230, 280, 52, 16);
  ctx.fillRect(210, 284, 25, 45);

  // Heavy steel hinges on edge
  [60, 256, 440].forEach((hy) => {
    ctx.fillStyle = '#334155';
    ctx.fillRect(8, hy - 18, 38, 36);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(26, hy, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Saudi national logistics banner
  ctx.fillStyle = '#047857'; ctx.fillRect(45, 80, 170, 46);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(55, 102, 150, 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "Space Grotesk", sans-serif';
  ctx.fillText('RIYADH K.S.A.', 58, 96);

  // Reflective Chevron tape along bottom (Green / White)
  for (let i = 20; i < 490; i += 32) {
    ctx.fillStyle = (i / 32) % 2 === 0 ? '#10b981' : '#ffffff';
    ctx.fillRect(i, 450, 32, 38);
  }

  // Speed roundel
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(100, 360, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('90', 100, 369);

  // GCC Badge Plate
  ctx.fillStyle = '#047857';
  ctx.fillRect(320, 335, 80, 50);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(320, 335, 80, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('GCC', 360, 370);

  riyadhTrailerDoorTexCache = new THREE.CanvasTexture(canvas);
  riyadhTrailerDoorTexCache.needsUpdate = true;
  return riyadhTrailerDoorTexCache;
}

/* ──────────────────────────────────────
   HELPER — Docked Shipping Trailer Textures & Assets
   ────────────────────────────────────── */
let trailerFloorTexCache = null;
function getTrailerFloorTexture() {
  if (trailerFloorTexCache) return trailerFloorTexCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Hardwood cargo floor planks
  const plankH = 32;
  const colors = ['#713f12', '#854d0e', '#78350f', '#92400e', '#6e380f'];
  for (let y = 0; y < 512; y += plankH) {
    ctx.fillStyle = colors[Math.floor(y / plankH) % colors.length];
    ctx.fillRect(0, y, 512, plankH - 2);

    // Plank seam
    ctx.fillStyle = '#2c1404';
    ctx.fillRect(0, y + plankH - 2, 512, 2);

    // Grain streaks
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let g = 0; g < 4; g++) {
      ctx.fillRect((y * 13 + g * 128) % 512, y + 4 + g * 6, 80, 2);
    }

    // Steel screws
    ctx.fillStyle = '#94a3b8';
    for (let x = 40; x < 512; x += 110) {
      ctx.beginPath();
      ctx.arc(x, y + plankH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Steel threshold wear plate
  ctx.fillStyle = 'rgba(71, 85, 105, 0.5)';
  ctx.fillRect(0, 480, 512, 32);

  trailerFloorTexCache = new THREE.CanvasTexture(canvas);
  trailerFloorTexCache.wrapS = THREE.RepeatWrapping;
  trailerFloorTexCache.wrapT = THREE.RepeatWrapping;
  trailerFloorTexCache.repeat.set(2, 4);
  trailerFloorTexCache.needsUpdate = true;
  return trailerFloorTexCache;
}

let trailerWallTexCache = null;
function getTrailerWallTexture() {
  if (trailerWallTexCache) return trailerWallTexCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Insulated white trailer wall panels
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  // Vertical corrugation ribbing
  for (let x = 0; x < 512; x += 32) {
    ctx.fillStyle = x % 64 === 0 ? '#cbd5e1' : '#f8fafc';
    ctx.fillRect(x, 0, 28, 512);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 28, 0, 4, 512);

    // Rivet dots
    ctx.fillStyle = '#64748b';
    for (let y = 20; y < 512; y += 45) {
      ctx.beginPath();
      ctx.arc(x + 14, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Horizontal galvanized E-Track cargo tie-down rails
  [140, 280].forEach((trackY) => {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, trackY, 512, 36);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, trackY + 4, 512, 28);
    for (let sx = 10; sx < 512; sx += 32) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx, trackY + 8, 14, 20);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, trackY + 8, 14, 20);
    }
  });

  // Lower impact scuff liner (brushed steel)
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 420, 512, 92);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 416, 512, 4);

  // Trailer internal placard
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(20, 40, 230, 60);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 40, 230, 60);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 13px "Space Grotesk", sans-serif';
  ctx.fillText('MADRID LOGISTICS S.A.', 30, 64);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.fillText('SEMI-TRAILER #E-4028 • MAX 24T', 30, 84);

  trailerWallTexCache = new THREE.CanvasTexture(canvas);
  trailerWallTexCache.wrapS = THREE.RepeatWrapping;
  trailerWallTexCache.wrapT = THREE.RepeatWrapping;
  trailerWallTexCache.repeat.set(4, 1);
  trailerWallTexCache.needsUpdate = true;
  return trailerWallTexCache;
}

let trailerDoorTexCache = null;
function getTrailerDoorTexture() {
  if (trailerDoorTexCache) return trailerDoorTexCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  // Black rubber weather gasket border
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 494, 512, 18);
  ctx.fillRect(0, 0, 18, 512);
  ctx.fillRect(494, 0, 18, 512);

  // Vertical stainless cam-lock pipe & keeper
  ctx.fillStyle = '#64748b';
  ctx.fillRect(240, 0, 32, 512);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(246, 0, 20, 512);

  // Door locking handle
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(230, 280, 52, 16);
  ctx.fillRect(210, 284, 25, 45);

  // Heavy steel hinges on edge
  [60, 256, 440].forEach((hy) => {
    ctx.fillStyle = '#334155';
    ctx.fillRect(8, hy - 18, 38, 36);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(26, hy, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Spanish national logistics banner
  ctx.fillStyle = '#aa151b'; ctx.fillRect(45, 80, 170, 12);
  ctx.fillStyle = '#f1bf00'; ctx.fillRect(45, 92, 170, 22);
  ctx.fillStyle = '#aa151b'; ctx.fillRect(45, 114, 170, 12);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Space Grotesk", sans-serif';
  ctx.fillText('MADRID ESPAÑA', 58, 108);

  // ECE-104 Chevron reflective tape along bottom
  for (let i = 20; i < 490; i += 32) {
    ctx.fillStyle = (i / 32) % 2 === 0 ? '#ef4444' : '#ffffff';
    ctx.fillRect(i, 450, 32, 38);
  }

  // European Speed roundel & TIR badge
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(100, 360, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('90', 100, 369);

  // TIR Blue Plate
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(320, 335, 80, 50);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(320, 335, 80, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('TIR', 360, 372);

  trailerDoorTexCache = new THREE.CanvasTexture(canvas);
  trailerDoorTexCache.needsUpdate = true;
  return trailerDoorTexCache;
}

let cardboardBoxTexCache = null;
function getCardboardBoxTexture() {
  if (cardboardBoxTexCache) return cardboardBoxTexCache;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Kraft brown cardboard
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, 256, 256);

  // Box seam line
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 126, 256, 4);

  // Clear packing tape across middle
  ctx.fillStyle = 'rgba(253, 230, 138, 0.45)';
  ctx.fillRect(0, 116, 256, 24);

  // White shipping label with barcode
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(30, 30, 95, 65);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('MAD-BARAJAS', 35, 45);
  let bx = 35;
  while (bx < 118) {
    const w = (bx % 6 === 0) ? 3 : 1.5;
    ctx.fillRect(bx, 52, w, 32);
    bx += w + 2;
  }

  // "THIS SIDE UP" arrows
  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('⬆ ⬆', 170, 60);
  ctx.font = 'bold 9px monospace';
  ctx.fillText('FRAGILE', 165, 80);

  cardboardBoxTexCache = new THREE.CanvasTexture(canvas);
  cardboardBoxTexCache.needsUpdate = true;
  return cardboardBoxTexCache;
}

/* ──────────────────────────────────────
   HELPER — Dock Worker 3D Builder
   ────────────────────────────────────── */
function createDockWorker({ vestColor = 0x84cc16, hatColor = 0xfacc15, holdingBox = false, skinHex = 0xfcd34d, pantsHex = 0x1e293b }) {
  const group = new THREE.Group();

  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.7 });
  const vestMat = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.35, metalness: 0.1 });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.6 });
  const hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.3, metalness: 0.2 });

  // Boots
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.52), bootMat);
  bootL.position.set(-0.25, 0.1, 0.05);
  group.add(bootL);

  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.52), bootMat);
  bootR.position.set(0.25, 0.1, 0.05);
  group.add(bootR);

  // Legs / Work Pants
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), pantsMat);
  legL.position.set(-0.25, 0.7, 0);
  group.add(legL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), pantsMat);
  legR.position.set(0.25, 0.7, 0);
  group.add(legR);

  // Torso / Hi-Vis Safety Vest
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.25, 0);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.95, 0.46), vestMat);
  torso.position.set(0, 0.48, 0);
  torso.castShadow = true;
  torsoGroup.add(torso);

  // Reflective silver safety stripes across chest & waist
  const stripeChest = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.48), stripeMat);
  stripeChest.position.set(0, 0.62, 0);
  torsoGroup.add(stripeChest);

  const stripeWaist = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.48), stripeMat);
  stripeWaist.position.set(0, 0.32, 0);
  torsoGroup.add(stripeWaist);

  // Head, Neck & Safety Helmet
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 10), skinMat);
  neck.position.set(0, 1.05, 0);
  torsoGroup.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), skinMat);
  head.position.set(0, 1.32, 0);
  torsoGroup.add(head);

  // Hard Hat with brim
  const helmetDome = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.22, 16), hatMat);
  helmetDome.position.set(0, 1.56, 0);
  torsoGroup.add(helmetDome);

  const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 16), hatMat);
  helmetBrim.position.set(0, 1.48, 0.04);
  torsoGroup.add(helmetBrim);

  // Arms
  const armMat = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.4 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });

  if (holdingBox) {
    // Both arms reaching forward to hold a box
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), armMat);
    armL.position.set(-0.48, 0.45, 0.25);
    armL.rotation.x = -Math.PI / 4;
    torsoGroup.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), armMat);
    armR.position.set(0.48, 0.45, 0.25);
    armR.rotation.x = -Math.PI / 4;
    torsoGroup.add(armR);

    // Hands / Gloves holding box
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), gloveMat);
    handL.position.set(-0.44, 0.25, 0.55);
    torsoGroup.add(handL);

    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), gloveMat);
    handR.position.set(0.44, 0.25, 0.55);
    torsoGroup.add(handR);

    // The box held in worker's hands!
    const heldBoxMat = new THREE.MeshStandardMaterial({ map: getCardboardBoxTexture(), roughness: 0.6 });
    const heldBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.7), heldBoxMat);
    heldBox.position.set(0, 0.42, 0.65);
    heldBox.castShadow = true;
    torsoGroup.add(heldBox);
  } else {
    // Resting arms or clipboard
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), armMat);
    armL.position.set(-0.48, 0.45, 0.05);
    armL.rotation.x = -Math.PI / 12;
    torsoGroup.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), armMat);
    armR.position.set(0.48, 0.48, 0.15);
    armR.rotation.x = -Math.PI / 3;
    torsoGroup.add(armR);

    const clipboardMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
    const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.04), clipboardMat);
    clipboard.position.set(0.48, 0.48, 0.45);
    clipboard.rotation.x = -Math.PI / 4;
    torsoGroup.add(clipboard);
  }

  group.add(torsoGroup);
  return { group, torsoGroup, holdingBox };
}

/* ──────────────────────────────────────
   HELPER — Wooden Euro-Pallet & Pallet Jack Builders
   ────────────────────────────────────── */
function createEuroPalletMesh() {
  const palletGroup = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85, metalness: 0.05 });
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });

  // Top deck boards
  for (let i = 0; i < 5; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 1.8), woodMat);
    board.position.set(-0.7 + i * 0.35, 0.22, 0);
    palletGroup.add(board);
  }
  // 3 Stringer cross runners
  [-0.65, 0, 0.65].forEach((sx) => {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 1.8), woodMat);
    stringer.position.set(sx, 0.18, 0);
    palletGroup.add(stringer);
  });
  // 9 Solid spacer blocks
  [-0.65, 0, 0.65].forEach((bx) => {
    [-0.75, 0, 0.75].forEach((bz) => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.2), blockMat);
      block.position.set(bx, 0.09, bz);
      palletGroup.add(block);
    });
  });
  // Bottom deck boards
  [-0.65, 0, 0.65].forEach((bx) => {
    const bottomBoard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 1.8), woodMat);
    bottomBoard.position.set(bx, 0.015, 0);
    palletGroup.add(bottomBoard);
  });
  return palletGroup;
}

function createPalletCargoStack(numTiers = 2) {
  const stackGroup = new THREE.Group();
  const pallet = createEuroPalletMesh();
  stackGroup.add(pallet);

  const boxTex = getCardboardBoxTexture();
  const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.6 });
  const boxGeos = [
    new THREE.BoxGeometry(0.7, 0.55, 0.8),
    new THREE.BoxGeometry(0.65, 0.5, 0.75),
    new THREE.BoxGeometry(0.75, 0.6, 0.82),
  ];

  for (let tier = 0; tier < numTiers; tier++) {
    const ty = 0.24 + tier * 0.58;
    [[-0.38, -0.42], [0.38, -0.42], [-0.38, 0.42], [0.38, 0.42]].forEach(([bx, bz], idx) => {
      const bMesh = new THREE.Mesh(boxGeos[(tier * 4 + idx) % boxGeos.length], boxMat);
      bMesh.position.set(bx, ty + 0.28, bz);
      bMesh.rotation.y = (idx % 2 === 0 ? 0 : Math.PI / 2) + (Math.sin(idx + tier) * 0.05);
      bMesh.castShadow = true;
      stackGroup.add(bMesh);
    });
  }

  // Black nylon cargo tie-down ratchet straps
  const strapMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, numTiers * 0.6 + 0.1, 1.84), strapMat);
  strap1.position.set(-0.35, 0.24 + (numTiers * 0.58) / 2, 0);
  stackGroup.add(strap1);

  const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, numTiers * 0.6 + 0.1, 1.84), strapMat);
  strap2.position.set(0.35, 0.24 + (numTiers * 0.58) / 2, 0);
  stackGroup.add(strap2);

  return stackGroup;
}

function createPalletJackMesh() {
  const jackGroup = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4, roughness: 0.3 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });

  // Two long steel forks
  [-0.32, 0.32].forEach((fx) => {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 2.0), yellowMat);
    fork.position.set(fx, 0.12, 0.8);
    jackGroup.add(fork);

    // Front tandem rollers under tips
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12), wheelMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(fx, 0.08, 1.6);
    jackGroup.add(roller);
  });

  // Hydraulic pump body at rear
  const pumpBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.45), yellowMat);
  pumpBody.position.set(0, 0.32, -0.2);
  jackGroup.add(pumpBody);

  // Steer wheels
  [-0.2, 0.2].forEach((wx) => {
    const steerWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), wheelMat);
    steerWheel.rotation.z = Math.PI / 2;
    steerWheel.position.set(wx, 0.12, -0.2);
    jackGroup.add(steerWheel);
  });

  // Steering handle / tiller angled up toward worker
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 10), handleMat);
  tiller.position.set(0, 0.9, -0.6);
  tiller.rotation.x = 0.55;
  jackGroup.add(tiller);

  // T-grip handle
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), handleMat);
  handleBar.position.set(0, 1.38, -0.92);
  handleBar.rotation.z = Math.PI / 2;
  jackGroup.add(handleBar);

  return jackGroup;
}


/* ──────────────────────────────────────
   HELPER — Mezzanine Giant LED Telemetry Canvas & Texture
   ────────────────────────────────────── */
function createFacadeSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Dark metallic cyber background
  ctx.fillStyle = '#060d19';
  ctx.fillRect(0, 0, 1024, 256);

  // Border with glowing neon trim
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 1004, 236);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 984, 216);

  // Corner brackets
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(6, 6, 40, 10);
  ctx.fillRect(6, 6, 10, 40);
  ctx.fillRect(978, 6, 40, 10);
  ctx.fillRect(1008, 6, 10, 40);
  ctx.fillRect(6, 240, 40, 10);
  ctx.fillRect(6, 210, 10, 40);
  ctx.fillRect(978, 240, 40, 10);
  ctx.fillRect(1008, 210, 10, 40);

  // Text with drop glow
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 18;
  ctx.fillText('FACILITY COMMAND CENTER', 512, 90);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('● 24/7 SORTATION TELEMETRY • PLC ACTIVE ●', 512, 175);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createMezzanineTelemetryCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  return canvas;
}

function updateMezzanineTelemetryCanvas(canvas, parcelsCount = 104820, elapsed = 0, plcLatency = 85, isPlcOnline = true) {
  const ctx = canvas.getContext('2d');
  const plcOnline = isPlcOnline && plcLatency > 0;

  // 1. Futuristic Cyber Command Center Deep Obsidian Background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, 1024, 512);

  // Digital grid lines with subtle glow
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.09)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1024; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y < 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Header Banner
  ctx.fillStyle = 'rgba(10, 18, 36, 0.95)';
  ctx.fillRect(20, 14, 984, 58);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(20, 14, 984, 58);

  // Pulsing Live Indicator
  const pulse = Math.sin(elapsed * 4) > 0;
  ctx.fillStyle = pulse ? '#10b981' : '#047857';
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = pulse ? 12 : 4;
  ctx.beginPath();
  ctx.arc(46, 43, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 21px "Space Grotesk", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(6, 182, 212, 0.7)';
  ctx.shadowBlur = 8;
  ctx.fillText('SIMULATED LIVE TELEMETRY // CENTRAL FACILITY CONTROL SYSTEM', 68, 43);
  ctx.shadowBlur = 0;

  ctx.fillStyle = plcOnline ? '#10b981' : '#ef4444';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(plcOnline ? `ALL HARDWARE ONLINE • ${plcLatency} MS LATENCY` : `HARDWARE OFFLINE • ${plcLatency} MS LATENCY`, 985, 43);

  // 4 Core KPI Cards across the middle
  const cards = [
    {
      label: 'PARCELS SORTED TODAY',
      value: parcelsCount.toLocaleString(),
      subtext: '▲ 100k Shift Target Met (104.8%)',
      color: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.8)',
      bg: 'rgba(14, 24, 46, 0.95)',
      border: 'rgba(56, 189, 248, 0.55)',
      icon: '📦'
    },
    {
      label: 'PEAK SORT RATE',
      value: '10,250 / hr',
      subtext: 'Continuous Sortation Velocity',
      color: '#fbbf24',
      glow: 'rgba(251, 191, 36, 0.8)',
      bg: 'rgba(28, 25, 18, 0.95)',
      border: 'rgba(245, 158, 11, 0.55)',
      icon: '⚡'
    },
    {
      label: 'PLC STATUS',
      value: `${plcLatency} ms`,
      subtext: plcOnline ? 'Hardware Protocol: ACTIVE' : 'Hardware Protocol: OFFLINE',
      color: plcOnline ? '#34d399' : '#ef4444',
      glow: plcOnline ? 'rgba(52, 211, 153, 0.8)' : 'rgba(239, 68, 68, 0.8)',
      bg: plcOnline ? 'rgba(14, 28, 24, 0.95)' : 'rgba(28, 14, 14, 0.95)',
      border: plcOnline ? 'rgba(16, 185, 129, 0.55)' : 'rgba(239, 68, 68, 0.55)',
      icon: '⚙️',
      isPlc: true,
      online: plcOnline
    },
    {
      label: 'ASRS BOTS ACTIVE',
      value: '4 / 4',
      subtext: 'Automated Matrix Shuttles',
      color: '#c084fc',
      glow: 'rgba(192, 132, 252, 0.8)',
      bg: 'rgba(24, 18, 36, 0.95)',
      border: 'rgba(192, 132, 252, 0.55)',
      icon: '🤖'
    }
  ];

  const cardW = 230;
  const cardH = 175;
  const startX = 26;
  const gap = 18;
  const cardY = 88;

  cards.forEach((c, i) => {
    const cx = startX + i * (cardW + gap);

    // Card Box
    ctx.fillStyle = c.bg;
    ctx.fillRect(cx, cardY, cardW, cardH);

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cardY, cardW, cardH);

    // Sci-Fi Corner Brackets
    ctx.fillStyle = c.color;
    ctx.fillRect(cx, cardY, 12, 3);
    ctx.fillRect(cx, cardY, 3, 12);
    ctx.fillRect(cx + cardW - 12, cardY, 12, 3);
    ctx.fillRect(cx + cardW - 3, cardY, 3, 12);
    ctx.fillRect(cx, cardY + cardH - 3, 12, 3);
    ctx.fillRect(cx, cardY + cardH - 12, 3, 12);
    ctx.fillRect(cx + cardW - 12, cardY + cardH - 3, 12, 3);
    ctx.fillRect(cx + cardW - 3, cardY + cardH - 12, 3, 12);

    // Top indicator line
    ctx.fillRect(cx + 12, cardY, cardW - 24, 3);

    // Icon + Label
    ctx.font = 'bold 12px "Space Grotesk", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`${c.icon} ${c.label}`, cx + 14, cardY + 28);

    // Status Indicator Dot for PLC Card
    if (c.isPlc) {
      const dotX = cx + cardW - 22;
      const dotY = cardY + 24;
      ctx.fillStyle = c.online ? '#10b981' : '#ef4444';
      ctx.shadowColor = c.online ? '#10b981' : '#ef4444';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Main Value with glowing drop shadow
    ctx.font = 'bold 32px "Space Grotesk", sans-serif';
    ctx.fillStyle = c.color;
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 10;
    ctx.fillText(c.value, cx + 14, cardY + 84);
    ctx.shadowBlur = 0;

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 14, cardY + 120);
    ctx.lineTo(cx + cardW - 14, cardY + 120);
    ctx.stroke();

    // Subtext
    ctx.font = '11px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(c.subtext, cx + 14, cardY + 145);
  });

  // Bottom Panels: Left = Live Sortation Waveform, Right = Subsystem Terminal Logs
  // Left Panel: Live Waveform (x: 26, y: 282, w: 478, h: 205)
  ctx.fillStyle = 'rgba(10, 18, 36, 0.95)';
  ctx.fillRect(26, 282, 478, 205);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 282, 478, 205);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('📈 REAL-TIME SORTATION THROUGHPUT OSCILLOSCOPE (PARCELS/SEC)', 40, 306);

  // Draw animated waveform with gradient fill underneath
  const graphBaseY = 415;
  const graphPoints = 32;

  // Waveform Path
  ctx.beginPath();
  for (let pt = 0; pt <= graphPoints; pt++) {
    const gx = 42 + (pt / graphPoints) * 440;
    const wave1 = Math.sin(pt * 0.45 + elapsed * 3.5) * 28;
    const wave2 = Math.cos(pt * 0.9 - elapsed * 2.5) * 14;
    const gy = graphBaseY + wave1 + wave2;
    if (pt === 0) ctx.moveTo(gx, gy);
    else ctx.lineTo(gx, gy);
  }

  // Stroke line with bright cyan glow
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Gradient fill under waveform
  ctx.lineTo(482, 470);
  ctx.lineTo(42, 470);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 350, 0, 470);
  grad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
  grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Target Baseline
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(42, graphBaseY);
  ctx.lineTo(482, graphBaseY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('SUSTAINED: 2.85 / SEC (10,250/HR)', 280, graphBaseY - 8);

  // Right Panel: Subsystem Status Console (x: 522, y: 282, w: 478, h: 205)
  ctx.fillStyle = 'rgba(10, 18, 36, 0.95)';
  ctx.fillRect(522, 282, 478, 205);
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(522, 282, 478, 205);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('🖥️ CENTRAL SUB-SYSTEM TELEMETRY STREAMS', 536, 306);

  const logs = [
    { text: `● [PLC-HARDWARE] ${plcLatency}ms latency interface bus: OPTIMAL`, color: '#10b981' },
    { text: '● [RABBITMQ-BUS] Async event queues active: 0 dropped', color: '#f97316' },
    { text: '● [ASRS-MATRIX] 4 climbing shuttles synchronized 100%', color: '#c084fc' },
    { text: '● [MADRID-GATEWAY] European cross-border hub transmitting', color: '#fbbf24' },
    { text: '● [PTL-PICK-LIGHT] Put-to-Light sort accuracy: 99.98%', color: '#38bdf8' },
    { text: '● [CAREER-TERMINAL] Resume download & LinkedIn ready', color: '#ffffff' },
  ];

  logs.forEach((lg, li) => {
    ctx.font = '11px monospace';
    ctx.fillStyle = lg.color;
    ctx.fillText(lg.text, 536, 335 + li * 24);
  });

  // Glowing Outer Neon Border
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 1016, 504);
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
    reveal: 'Architected high-throughput asynchronous messaging pipelines to power scalable, low-latency APIs and reliable real-time data processing.',    
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
    hex: 0x1d4ed8,
    css: '#1d4ed8',
    icon: '🔵',
    subIcon: '⚙️',
    badge: '⚡ PLC HARDWARE & I/O BUS ⚡',
    zoneName: 'PLC HARDWARE CONVEYOR BAY',
    tagline: 'Low-Latency Conveyor Controls',
    reveal: 'Wrote PLC communication layers directly interfacing software with warehouse sortation conveyor belts.',
    milestoneTitle: 'LOW-LATENCY PLC HARDWARE BRIDGE',
    milestoneStat: '<5ms Latency • Conveyor Sensors & Diverters',
    tech: ['PLC Layer', 'Industrial Automation', 'Conveyor Controls', 'Hardware Protocols'],
    points: 300,
  },
  MADRID: {
    id: 'madrid',
    name: 'Madrid Deployment',
    title: 'Madrid International Cargo',
    shortName: 'Madrid Gate',
    hex: 0xf59e0b,
    css: '#f59e0b',
    icon: '🟡',
    subIcon: '✈️',
    badge: 'MADRID GATE — EUROPEAN LOGISTICS',
    zoneName: 'MADRID GATE — EUROPEAN LOGISTICS',
    tagline: '2.5 Mo. European Deployment',
    reveal: 'Honoring 2.5 months on-site in Madrid, Spain: managed high-throughput European cross-border sortation systems, automated logistics software, and last-mile dispatch.',
    milestoneTitle: 'MADRID INTERNATIONAL DISPATCH BAY',
    milestoneStat: '2.5 Months On-Site in Madrid, Spain • Cross-Border EU Hub',
    tech: ['On-Site Deployment', 'Madrid, Spain', 'Cross-Border Logistics', 'Customs Clearance', 'REST APIs'],
    points: 500,
  },
  RIYADH: {
    id: 'riyadh',
    name: 'Riyadh Hub',
    title: 'Riyadh Middle East Cargo',
    shortName: 'Riyadh Gate',
    hex: 0x047857,
    css: '#047857',
    icon: '🟢',
    subIcon: '✈️',
    badge: '✈️ GCC AIR FREIGHT — RUH',
    zoneName: 'RIYADH GATE — MIDDLE EAST LOGISTICS',
    tagline: 'Middle East Cross-Border Cargo',
    reveal: 'Deployed and remotely tested high-throughput Put-to-Light (PTL) and conveyor automation systems supporting B2B and B2C fulfillment operations for a leading Middle Eastern apparel brand.',
    milestoneTitle: 'RIYADH INTERNATIONAL DISPATCH BAY',
    milestoneStat: 'King Khalid Cargo Hub • Middle East Fulfillment',
    tech: ['Middle East Logistics', 'Riyadh, KSA', 'PTL Sortation', 'ZATCA Clearance', 'REST APIs'],
    points: 500,
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
    reveal: 'Delivered complete Put-to-Light sorting workflows, digital light+displayed guidance for India\'s biggest retail and logistics operators.',    
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
    icon: "✈️",
    badge: "International Deployer",
    milestoneTitle: "MADRID GATE — EUROPEAN LOGISTICS",
    milestoneStat: "2.5 Months On-Site (Spain)",
    milestoneStory: "Honoring 2.5 months on-site in Madrid, Spain: managed high-throughput European cross-border sortation systems, automated logistics software, and last-mile dispatch.",
    tech: ["On-Site Deployment", "Madrid, Spain", "Cross-Border Logistics", "REST APIs"],
    points: 500,
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
    milestoneStory: "Architected high-throughput asynchronous messaging pipelines to power scalable, low-latency APIs and reliable real-time data processing.",
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
    milestoneStory: "Delivered complete Put-to-Light sorting workflows, digital light+displayed guidance for India's biggest retail and logistics operators.",
    tech: ["Put-to-Light (PTL)", "LED Guidance", "Pick-to-Tote", "Stored Procedures"],
    points: 400,
  },
  {
    id: 6,
    orderCode: "ORD-106",
    title: "Middle East Logistics Deployment (Riyadh)",
    client: "Riyadh GCC Cross-Border Fulfillment Hub",
    targetColor: TECH_CRATES.RIYADH,
    targetZoneName: TECH_CRATES.RIYADH.zoneName,
    icon: "✈️",
    badge: "GCC Logistics Specialist",
    milestoneTitle: "RIYADH INTERNATIONAL DISPATCH BAY",
    milestoneStat: "King Khalid Cargo Hub • Middle East Fulfillment",
    milestoneStory: "Deployed and remotely tested high-throughput Put-to-Light (PTL) and conveyor automation systems supporting B2B and B2C fulfillment operations for a leading Middle Eastern apparel brand.",
    tech: ["Middle East Logistics", "Riyadh, KSA", "PTL Sortation", "ZATCA Clearance", "REST APIs"],
    points: 500,
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

  const RESUME_URL = process.env.REACT_APP_RESUME_URL || `${process.env.PUBLIC_URL || ''}/FAHAD_NEW.pdf`;
  const LINKEDIN_URL = "https://www.linkedin.com/in/fahadeqbalhashmi/";

  const [cameraMode, setCameraMode] = useState('third'); // 'third' | 'first' | 'command'
  const [commandView, setCommandView] = useState('screen'); // 'screen' | 'window'
  const [isNearMezzanine, setIsNearMezzanine] = useState(false);
  const isNearMezzanineRef = useRef(false);
  const [liveParcels, setLiveParcels] = useState(104820);
  const [plcLatency, setPlcLatency] = useState(85);
  const madridGateDataRef = useRef(null);
  const riyadhGateDataRef = useRef(null);

  const [isNight, setIsNight] = useState(false);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [carried, setCarried] = useState(false);
  const [carriedColor, setCarriedColor] = useState(null);
  const [canDrop, setCanDrop] = useState(false);
  const [mismatchedZone, setMismatchedZone] = useState(null);
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
  const commandViewRef = useRef('screen');
  const nightRef = useRef(false);
  const messageTimerRef = useRef(null);
  const canDropRef = useRef(false);
  const mismatchedZoneRef = useRef(null);

  const wrongKeyCountRef = useRef(0);
  const autoHideControlsTimerRef = useRef(null);

  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => { commandViewRef.current = commandView; }, [commandView]);
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
    const initTimer = setTimeout(() => {
      if (isDisposed || !mountRef.current) return;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
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

      // Shared matrix helper for InstancedMesh setups
      const _instDummy = new THREE.Object3D();

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
      const dockDoorGeo = new THREE.PlaneGeometry(13.5, 17.5);
      const frameBeamGeo = new THREE.BoxGeometry(14.5, 0.8, 0.6);
      const framePostGeo = new THREE.BoxGeometry(0.6, 18.0, 0.6);
      const sigHousingGeo = new THREE.BoxGeometry(0.4, 1.2, 0.3);
      const sigHousingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const sigLightGeo = new THREE.SphereGeometry(0.14, 12, 12);
      const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const bumperGeo = new THREE.BoxGeometry(0.8, 1.4, 0.6);
      const bumperMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

      [-24, -8, 8, 24].forEach((dockX, idx) => {
        const dockNum = idx + 1;
        const isMadridGate = dockX === 24;
        const isRiyadhGate = dockX === -24;
        const dockDoorTex = isMadridGate
          ? getMadridDockDoorTexture()
          : (isRiyadhGate ? getRiyadhDockDoorTexture() : getDockDoorTexture(dockNum));
        const dockDoorMat = new THREE.MeshStandardMaterial({
          map: dockDoorTex,
          roughness: 0.4,
          metalness: 0.35,
          side: THREE.DoubleSide,
        });

        const doorMesh = new THREE.Mesh(dockDoorGeo, dockDoorMat);
        doorMesh.position.set(dockX, 9.0, 74.9);
        doorMesh.rotation.y = Math.PI;
        scene.add(doorMesh);

        // Frame styling (Spanish Red/Gold for Madrid Gate; Saudi Emerald/Gold for Riyadh Gate)
        const frameMat = isMadridGate
          ? new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xaa151b, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3 })
          : (isRiyadhGate
              ? new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x047857, emissiveIntensity: 0.28, metalness: 0.5, roughness: 0.3 })
              : safetyYellowMat);

        const frameBeam = new THREE.Mesh(frameBeamGeo, frameMat);
        frameBeam.position.set(dockX, 18.0, 74.7);
        scene.add(frameBeam);

        const framePostL = new THREE.Mesh(framePostGeo, frameMat);
        framePostL.position.set(dockX - 7.0, 9.0, 74.7);
        scene.add(framePostL);

        const framePostR = new THREE.Mesh(framePostGeo, frameMat);
        framePostR.position.set(dockX + 7.0, 9.0, 74.7);
        scene.add(framePostR);

        const sigHousing = new THREE.Mesh(sigHousingGeo, sigHousingMat);
        sigHousing.position.set(dockX + 7.6, 12.0, 74.5);
        scene.add(sigHousing);

        const redLight = new THREE.Mesh(sigLightGeo, redLightMat);
        redLight.position.set(dockX + 7.6, 12.35, 74.3);
        scene.add(redLight);

        const greenLight = new THREE.Mesh(sigLightGeo, greenLightMat);
        greenLight.position.set(dockX + 7.6, 11.65, 74.3);
        scene.add(greenLight);

        [-6.5, 6.5].forEach((bx) => {
          const bumper = new THREE.Mesh(bumperGeo, bumperMat);
          bumper.position.set(dockX + bx, 0.7, 75.2);
          scene.add(bumper);
        });

        if (isMadridGate) {
          // Large Illuminated 3D Overhead Signboard: 🇪🇸 MADRID GATE — EUROPEAN LOGISTICS
          const madridSignTex = getMadridGateSignboardTexture();
          const madridSignGeo = new THREE.BoxGeometry(15.2, 2.6, 0.4);
          const madridSignMat = new THREE.MeshStandardMaterial({
            map: madridSignTex,
            emissive: 0xffffff,
            emissiveMap: madridSignTex,
            emissiveIntensity: 0.42,
            roughness: 0.25,
            metalness: 0.3,
          });
          const madridSign = new THREE.Mesh(madridSignGeo, madridSignMat);
          madridSign.position.set(dockX, 20.0, 74.3);
          madridSign.rotation.y = Math.PI;
          scene.add(madridSign);

          const madridSignNeon = new THREE.Mesh(
            new THREE.BoxGeometry(15.4, 2.8, 0.08),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b })
          );
          madridSignNeon.position.set(dockX, 20.0, 74.28);
          scene.add(madridSignNeon);

          const madridBeaconMat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x10b981,
            emissiveIntensity: 0.8,
          });
          const madridBeacon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16),
            madridBeaconMat
          );
          madridBeacon.position.set(dockX, 21.6, 74.3);
          scene.add(madridBeacon);

          // ─── 🚚 DOCKED FREIGHT TRUCK ("Ass of the Truck") & ACTIVE LOADING BAY ───
          const truckGroup = new THREE.Group();

          // 1. Dock Leveler / Bridge Ramp (Threshold between warehouse & truck floor)
          const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
          const rampHazardMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
          const dockRamp = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 2.6), rampMat);
          dockRamp.position.set(dockX, 0.08, 75.0);
          dockRamp.receiveShadow = true;
          truckGroup.add(dockRamp);

          // Yellow safety hazard bevel edges on dock leveler
          [-2.2, 2.2].forEach((bx) => {
            const hazardStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 2.6), rampHazardMat);
            hazardStripe.position.set(dockX + bx, 0.09, 75.0);
            truckGroup.add(hazardStripe);
          });

          // Heavy rubber loading dock bumpers on sides of ramp
          const bumperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
          [-4.8, 4.8].forEach((bx) => {
            const dockBumper = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.5), bumperMat);
            dockBumper.position.set(dockX + bx, 0.8, 74.8);
            truckGroup.add(dockBumper);
          });

          // 2. Semi-Trailer Shell (Extending into exterior truck bay Z: 75.2 to 97.2)
          const trailerFloorTex = getTrailerFloorTexture();
          const trailerFloorMat = new THREE.MeshStandardMaterial({
            map: trailerFloorTex,
            roughness: 0.5,
            metalness: 0.15,
          });
          const trailerFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 22.0), trailerFloorMat);
          trailerFloor.position.set(dockX, 0.12, 86.2);
          trailerFloor.rotation.x = -Math.PI / 2;
          trailerFloor.receiveShadow = true;
          truckGroup.add(trailerFloor);

          // Corrugated Insulated Trailer Side Walls
          const trailerWallTex = getTrailerWallTexture();
          const trailerWallMat = new THREE.MeshStandardMaterial({
            map: trailerWallTex,
            roughness: 0.45,
            metalness: 0.25,
            side: THREE.DoubleSide,
          });

          const trailerWallL = new THREE.Mesh(new THREE.PlaneGeometry(22.0, 7.8), trailerWallMat);
          trailerWallL.position.set(dockX - 4.4, 4.02, 86.2);
          trailerWallL.rotation.y = Math.PI / 2;
          truckGroup.add(trailerWallL);

          const trailerWallR = new THREE.Mesh(new THREE.PlaneGeometry(22.0, 7.8), trailerWallMat);
          trailerWallR.position.set(dockX + 4.4, 4.02, 86.2);
          trailerWallR.rotation.y = -Math.PI / 2;
          truckGroup.add(trailerWallR);

          // Trailer Aluminum Roof
          const trailerRoofMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.6, metalness: 0.4 });
          const trailerRoof = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 22.0), trailerRoofMat);
          trailerRoof.position.set(dockX, 7.92, 86.2);
          trailerRoof.rotation.x = Math.PI / 2;
          truckGroup.add(trailerRoof);

          // Front Bulkhead wall (Deep inside truck)
          const frontBulkheadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 });
          const frontBulkhead = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 7.8), frontBulkheadMat);
          frontBulkhead.position.set(dockX, 4.02, 97.2);
          frontBulkhead.rotation.y = Math.PI;
          truckGroup.add(frontBulkhead);

          // 3. Trailer Rear Frame (The "Ass of the Truck" Aperture at Z: 75.3)
          const frameMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
          const trailerHeader = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, 0.4), frameMetalMat);
          trailerHeader.position.set(dockX, 7.8, 75.3);
          truckGroup.add(trailerHeader);

          const trailerPostL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.8, 0.4), frameMetalMat);
          trailerPostL.position.set(dockX - 4.45, 4.0, 75.3);
          truckGroup.add(trailerPostL);

          const trailerPostR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.8, 0.4), frameMetalMat);
          trailerPostR.position.set(dockX + 4.45, 4.0, 75.3);
          truckGroup.add(trailerPostR);

          // Alternating red/white ECE-104 conspicuity safety tape along rear posts & header
          const tapeRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          const tapeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          for (let ty = 1.0; ty < 7.6; ty += 0.8) {
            const isRed = (Math.round(ty / 0.8)) % 2 === 0;
            const tapeMat = isRed ? tapeRedMat : tapeWhiteMat;
            const blockL = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.04), tapeMat);
            blockL.position.set(dockX - 4.45, ty, 75.12);
            truckGroup.add(blockL);
            const blockR = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.04), tapeMat);
            blockR.position.set(dockX + 4.45, ty, 75.12);
            truckGroup.add(blockR);
          }

          // Swung-Open Dual Rear Trailer Doors pinned back flat against exterior walls
          const doorTex = getTrailerDoorTexture();
          const openDoorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.4, side: THREE.DoubleSide });

          const leftDoorOpen = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.4), openDoorMat);
          leftDoorOpen.position.set(dockX - 4.65, 4.0, 73.2);
          leftDoorOpen.rotation.y = Math.PI / 2;
          truckGroup.add(leftDoorOpen);

          const rightDoorOpen = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.4), openDoorMat);
          rightDoorOpen.position.set(dockX + 4.65, 4.0, 73.2);
          rightDoorOpen.rotation.y = -Math.PI / 2;
          truckGroup.add(rightDoorOpen);

          // Lower Truck ICC Underride Bar under dock sill with taillights and Spanish plate
          const iccBar = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 0.25), frameMetalMat);
          iccBar.position.set(dockX, -0.35, 75.4);
          truckGroup.add(iccBar);

          // 4. Warm Industrial Overhead Ceiling Work Lights inside trailer
          const workLight1 = new THREE.PointLight(0xffedd5, 1.4, 15);
          workLight1.position.set(dockX, 7.0, 81.0);
          truckGroup.add(workLight1);

          const workLight2 = new THREE.PointLight(0xffedd5, 1.4, 15);
          workLight2.position.set(dockX, 7.0, 90.0);
          truckGroup.add(workLight2);

          // 5. Cargo Stacks & Euro-Pallets inside truck
          // Deep stack 1 (3 tiers of cartons strapped down)
          const deepStack = createPalletCargoStack(3);
          deepStack.position.set(dockX + 2.2, 0.12, 92.5);
          truckGroup.add(deepStack);

          // Mid stack 2 (Active stack being built by Worker 1)
          const activeStack = createPalletCargoStack(1);
          activeStack.position.set(dockX + 2.4, 0.12, 85.8);
          truckGroup.add(activeStack);

          // Loose shipping boxes around active stack
          const singleBoxTex = getCardboardBoxTexture();
          const singleBoxMat = new THREE.MeshStandardMaterial({ map: singleBoxTex, roughness: 0.6 });
          const looseBox1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), singleBoxMat);
          looseBox1.position.set(dockX + 1.2, 0.42, 86.8);
          looseBox1.rotation.y = 0.35;
          truckGroup.add(looseBox1);

          // Pallet Jack carrying loaded Euro-pallet near entrance ramp
          const palletJack = createPalletJackMesh();
          palletJack.position.set(dockX - 1.8, 0.12, 78.5);
          palletJack.rotation.y = 0;
          truckGroup.add(palletJack);

          const jackCargoStack = createPalletCargoStack(2);
          jackCargoStack.position.set(dockX - 1.8, 0.12, 79.2);
          truckGroup.add(jackCargoStack);

          // Upright empty Euro-pallets leaning against left trailer wall
          const emptyPallet1 = createEuroPalletMesh();
          emptyPallet1.position.set(dockX - 4.15, 0.9, 81.5);
          emptyPallet1.rotation.z = Math.PI / 2;
          emptyPallet1.rotation.y = 0.1;
          truckGroup.add(emptyPallet1);

          const emptyPallet2 = createEuroPalletMesh();
          emptyPallet2.position.set(dockX - 4.15, 0.9, 83.5);
          emptyPallet2.rotation.z = Math.PI / 2;
          emptyPallet2.rotation.y = -0.08;
          truckGroup.add(emptyPallet2);

          // 6. Dock Workers actively loading cargo and setting up boxes
          // Worker 1: Setting up boxes inside the truck
          const worker1 = createDockWorker({ vestColor: 0x84cc16, hatColor: 0xfacc15, holdingBox: true });
          worker1.group.position.set(dockX + 2.4, 0.12, 84.0);
          worker1.group.rotation.y = -Math.PI * 0.15;
          truckGroup.add(worker1.group);

          // Worker 2: Pulling pallet jack with cargo into truck
          const worker2 = createDockWorker({ vestColor: 0xf97316, hatColor: 0xffffff, holdingBox: false });
          worker2.group.position.set(dockX - 1.8, 0.12, 77.0);
          worker2.group.rotation.y = 0;
          truckGroup.add(worker2.group);

          // Worker 3: Checking cargo manifest with clipboard deep in truck
          const worker3 = createDockWorker({ vestColor: 0x0284c7, hatColor: 0xfacc15, holdingBox: false });
          worker3.group.position.set(dockX - 1.6, 0.12, 89.5);
          worker3.group.rotation.y = Math.PI * 0.28;
          truckGroup.add(worker3.group);

          scene.add(truckGroup);

          // Permanently roll up Bay 04 door above opening (door never closes)
          doorMesh.position.set(dockX, 18.0, 74.9);

          // Dynamic traffic signal materials (Permanently GREEN for active loading dock)
          const madridRedMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
          const madridGreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          redLight.material = madridRedMat;
          greenLight.material = madridGreenMat;

          madridGateDataRef.current = {
            dockX,
            doorMesh,
            worker1,
            worker2,
            worker3,
            redMat: madridRedMat,
            greenMat: madridGreenMat,
            beacon: madridBeacon,
            beaconMat: madridBeaconMat,
            doorTargetY: 18.0,
            doorCurY: 18.0,
            isCustomsCleared: false,
            departureTimer: 0,
            departingCrateGroup: null,
          };
        }

        if (isRiyadhGate) {
          // Large Illuminated 3D Overhead Signboard: ✈️ RIYADH GATE — MIDDLE EAST LOGISTICS
          const riyadhSignTex = getRiyadhGateSignboardTexture();
          const riyadhSignGeo = new THREE.BoxGeometry(15.2, 2.6, 0.4);
          const riyadhSignMat = new THREE.MeshStandardMaterial({
            map: riyadhSignTex,
            emissive: 0xffffff,
            emissiveMap: riyadhSignTex,
            emissiveIntensity: 0.42,
            roughness: 0.25,
            metalness: 0.3,
          });
          const riyadhSign = new THREE.Mesh(riyadhSignGeo, riyadhSignMat);
          riyadhSign.position.set(dockX, 20.0, 74.3);
          riyadhSign.rotation.y = Math.PI;
          scene.add(riyadhSign);

          const riyadhSignNeon = new THREE.Mesh(
            new THREE.BoxGeometry(15.4, 2.8, 0.08),
            new THREE.MeshBasicMaterial({ color: 0x10b981 })
          );
          riyadhSignNeon.position.set(dockX, 20.0, 74.28);
          scene.add(riyadhSignNeon);

          const riyadhBeaconMat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x10b981,
            emissiveIntensity: 0.8,
          });
          const riyadhBeacon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16),
            riyadhBeaconMat
          );
          riyadhBeacon.position.set(dockX, 21.6, 74.3);
          scene.add(riyadhBeacon);

          // ─── 🚚 DOCKED FREIGHT TRUCK & ACTIVE LOADING BAY 01 ───
          const truckGroup = new THREE.Group();

          // 1. Dock Leveler / Bridge Ramp
          const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
          const rampHazardMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          const dockRamp = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 2.6), rampMat);
          dockRamp.position.set(dockX, 0.08, 75.0);
          dockRamp.receiveShadow = true;
          truckGroup.add(dockRamp);

          [-2.2, 2.2].forEach((bx) => {
            const hazardStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 2.6), rampHazardMat);
            hazardStripe.position.set(dockX + bx, 0.09, 75.0);
            truckGroup.add(hazardStripe);
          });

          // Heavy rubber loading dock bumpers on sides of ramp
          const bumperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
          [-4.8, 4.8].forEach((bx) => {
            const dockBumper = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.5), bumperMat);
            dockBumper.position.set(dockX + bx, 0.8, 74.8);
            truckGroup.add(dockBumper);
          });

          // 2. Semi-Trailer Shell (Z: 75.2 to 97.2)
          const trailerFloorTex = getTrailerFloorTexture();
          const trailerFloorMat = new THREE.MeshStandardMaterial({
            map: trailerFloorTex,
            roughness: 0.5,
            metalness: 0.15,
          });
          const trailerFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 22.0), trailerFloorMat);
          trailerFloor.position.set(dockX, 0.12, 86.2);
          trailerFloor.rotation.x = -Math.PI / 2;
          trailerFloor.receiveShadow = true;
          truckGroup.add(trailerFloor);

          const trailerWallTex = getRiyadhTrailerWallTexture();
          const trailerWallMat = new THREE.MeshStandardMaterial({
            map: trailerWallTex,
            roughness: 0.45,
            metalness: 0.25,
            side: THREE.DoubleSide,
          });

          const trailerWallL = new THREE.Mesh(new THREE.PlaneGeometry(22.0, 7.8), trailerWallMat);
          trailerWallL.position.set(dockX - 4.4, 4.02, 86.2);
          trailerWallL.rotation.y = Math.PI / 2;
          truckGroup.add(trailerWallL);

          const trailerWallR = new THREE.Mesh(new THREE.PlaneGeometry(22.0, 7.8), trailerWallMat);
          trailerWallR.position.set(dockX + 4.4, 4.02, 86.2);
          trailerWallR.rotation.y = -Math.PI / 2;
          truckGroup.add(trailerWallR);

          const trailerRoofMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.6, metalness: 0.4 });
          const trailerRoof = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 22.0), trailerRoofMat);
          trailerRoof.position.set(dockX, 7.92, 86.2);
          trailerRoof.rotation.x = Math.PI / 2;
          truckGroup.add(trailerRoof);

          const frontBulkheadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 });
          const frontBulkhead = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 7.8), frontBulkheadMat);
          frontBulkhead.position.set(dockX, 4.02, 97.2);
          frontBulkhead.rotation.y = Math.PI;
          truckGroup.add(frontBulkhead);

          // 3. Trailer Rear Frame
          const frameMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
          const trailerHeader = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, 0.4), frameMetalMat);
          trailerHeader.position.set(dockX, 7.8, 75.3);
          truckGroup.add(trailerHeader);

          const trailerPostL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.8, 0.4), frameMetalMat);
          trailerPostL.position.set(dockX - 4.45, 4.0, 75.3);
          truckGroup.add(trailerPostL);

          const trailerPostR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.8, 0.4), frameMetalMat);
          trailerPostR.position.set(dockX + 4.45, 4.0, 75.3);
          truckGroup.add(trailerPostR);

          const tapeGreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          const tapeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          for (let ty = 1.0; ty < 7.6; ty += 0.8) {
            const isGreen = (Math.round(ty / 0.8)) % 2 === 0;
            const tapeMat = isGreen ? tapeGreenMat : tapeWhiteMat;
            const blockL = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.04), tapeMat);
            blockL.position.set(dockX - 4.45, ty, 75.12);
            truckGroup.add(blockL);
            const blockR = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.04), tapeMat);
            blockR.position.set(dockX + 4.45, ty, 75.12);
            truckGroup.add(blockR);
          }

          // Swung-Open Dual Rear Trailer Doors
          const doorTex = getRiyadhTrailerDoorTexture();
          const openDoorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.4, side: THREE.DoubleSide });

          const leftDoorOpen = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.4), openDoorMat);
          leftDoorOpen.position.set(dockX - 4.65, 4.0, 73.2);
          leftDoorOpen.rotation.y = Math.PI / 2;
          truckGroup.add(leftDoorOpen);

          const rightDoorOpen = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.4), openDoorMat);
          rightDoorOpen.position.set(dockX + 4.65, 4.0, 73.2);
          rightDoorOpen.rotation.y = -Math.PI / 2;
          truckGroup.add(rightDoorOpen);

          // Lower ICC Underride Bar
          const iccBar = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 0.25), frameMetalMat);
          iccBar.position.set(dockX, -0.35, 75.4);
          truckGroup.add(iccBar);

          // 4. Overhead Work Lights inside trailer
          const workLight1 = new THREE.PointLight(0xffedd5, 1.4, 15);
          workLight1.position.set(dockX, 7.0, 81.0);
          truckGroup.add(workLight1);

          const workLight2 = new THREE.PointLight(0xffedd5, 1.4, 15);
          workLight2.position.set(dockX, 7.0, 90.0);
          truckGroup.add(workLight2);

          // 5. Cargo Stacks & Euro-Pallets inside truck
          const deepStack = createPalletCargoStack(3);
          deepStack.position.set(dockX - 2.2, 0.12, 92.5);
          truckGroup.add(deepStack);

          const activeStack = createPalletCargoStack(1);
          activeStack.position.set(dockX - 2.4, 0.12, 85.8);
          truckGroup.add(activeStack);

          const singleBoxTex = getCardboardBoxTexture();
          const singleBoxMat = new THREE.MeshStandardMaterial({ map: singleBoxTex, roughness: 0.6 });
          const looseBox1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), singleBoxMat);
          looseBox1.position.set(dockX - 1.2, 0.42, 86.8);
          looseBox1.rotation.y = -0.35;
          truckGroup.add(looseBox1);

          const palletJack = createPalletJackMesh();
          palletJack.position.set(dockX + 1.8, 0.12, 78.5);
          palletJack.rotation.y = 0;
          truckGroup.add(palletJack);

          const jackCargoStack = createPalletCargoStack(2);
          jackCargoStack.position.set(dockX + 1.8, 0.12, 79.2);
          truckGroup.add(jackCargoStack);

          const emptyPallet1 = createEuroPalletMesh();
          emptyPallet1.position.set(dockX + 4.15, 0.9, 81.5);
          emptyPallet1.rotation.z = -Math.PI / 2;
          emptyPallet1.rotation.y = 0.1;
          truckGroup.add(emptyPallet1);

          // 6. Dock Workers actively loading cargo in Riyadh trailer
          const worker1 = createDockWorker({ vestColor: 0x059669, hatColor: 0xfacc15, holdingBox: true });
          worker1.group.position.set(dockX - 2.4, 0.12, 84.0);
          worker1.group.rotation.y = Math.PI * 0.15;
          truckGroup.add(worker1.group);

          const worker2 = createDockWorker({ vestColor: 0xf97316, hatColor: 0xffffff, holdingBox: false });
          worker2.group.position.set(dockX + 1.8, 0.12, 77.0);
          worker2.group.rotation.y = 0;
          truckGroup.add(worker2.group);

          const worker3 = createDockWorker({ vestColor: 0x0284c7, hatColor: 0xfacc15, holdingBox: false });
          worker3.group.position.set(dockX + 1.6, 0.12, 89.5);
          worker3.group.rotation.y = -Math.PI * 0.28;
          truckGroup.add(worker3.group);

          scene.add(truckGroup);

          // Permanently roll up Bay 01 door above opening
          doorMesh.position.set(dockX, 18.0, 74.9);

          // Dynamic traffic signal materials (Permanently GREEN for active loading dock)
          const riyadhRedMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
          const riyadhGreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          redLight.material = riyadhRedMat;
          greenLight.material = riyadhGreenMat;

          riyadhGateDataRef.current = {
            dockX,
            doorMesh,
            worker1,
            worker2,
            worker3,
            redMat: riyadhRedMat,
            greenMat: riyadhGreenMat,
            beacon: riyadhBeacon,
            beaconMat: riyadhBeaconMat,
            doorTargetY: 18.0,
            doorCurY: 18.0,
            isCustomsCleared: false,
            departureTimer: 0,
            departingCrateGroup: null,
          };
        }
      });

      // ─── 3. Roof Deck, Instanced Steel Trusses & Air Ducts ───
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

      // Structural Open-Web Steel Lattice Trusses (Instanced diagonal struts: 252 meshes -> 1 draw call)
      const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35 });
      const trussTopGeo = new THREE.BoxGeometry(220, 0.5, 0.5);
      const trussBotGeo = new THREE.BoxGeometry(220, 0.4, 0.4);
      const strutGeo = new THREE.BoxGeometry(0.2, 3.6, 0.2);

      const trussZs = [-60, -35, -10, 15, 40, 65];
      const strutInstanced = new THREE.InstancedMesh(strutGeo, trussMat, trussZs.length * 21 * 2);
      let strutIdx = 0;

      trussZs.forEach((tz) => {
        const topChord = new THREE.Mesh(trussTopGeo, trussMat);
        topChord.position.set(0, 24.6, tz); scene.add(topChord);
        const botChord = new THREE.Mesh(trussBotGeo, trussMat);
        botChord.position.set(0, 21.2, tz); scene.add(botChord);

        for (let tx = -105; tx < 105; tx += 10) {
          _instDummy.position.set(tx + 2.5, 22.9, tz);
          _instDummy.rotation.set(0, 0, Math.PI / 4);
          _instDummy.updateMatrix();
          strutInstanced.setMatrixAt(strutIdx++, _instDummy.matrix);

          _instDummy.position.set(tx + 7.5, 22.9, tz);
          _instDummy.rotation.set(0, 0, -Math.PI / 4);
          _instDummy.updateMatrix();
          strutInstanced.setMatrixAt(strutIdx++, _instDummy.matrix);
        }
      });
      strutInstanced.instanceMatrix.needsUpdate = true;
      scene.add(strutInstanced);

      // Overhead Galvanized Air Conditioning Ventilation Ducts (Instanced rings & hangers)
      const ductMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.25 });
      const ductHangerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
      const ductGeo = new THREE.CylinderGeometry(0.85, 0.85, 210, 16);
      const ringGeo = new THREE.TorusGeometry(0.92, 0.08, 6, 16);
      const hangerGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6);
      const diffuserGeo = new THREE.BoxGeometry(1.2, 0.3, 1.2);

      const ringInstanced = new THREE.InstancedMesh(ringGeo, ductMat, 26);
      const hangerInstanced = new THREE.InstancedMesh(hangerGeo, ductHangerMat, 26);
      let rhIdx = 0;

      [-45, 45].forEach((dx) => {
        const duct = new THREE.Mesh(ductGeo, ductMat);
        duct.rotation.z = Math.PI / 2;
        duct.position.set(0, 22.2, dx);
        scene.add(duct);

        for (let dz = -90; dz <= 90; dz += 15) {
          _instDummy.position.set(dz, 22.2, dx);
          _instDummy.rotation.set(0, Math.PI / 2, 0);
          _instDummy.updateMatrix();
          ringInstanced.setMatrixAt(rhIdx, _instDummy.matrix);

          _instDummy.position.set(dz, 23.6, dx);
          _instDummy.rotation.set(0, 0, 0);
          _instDummy.updateMatrix();
          hangerInstanced.setMatrixAt(rhIdx, _instDummy.matrix);
          rhIdx++;

          if (dz % 30 === 0) {
            const diffuser = new THREE.Mesh(diffuserGeo, ductMat);
            diffuser.position.set(dz, 21.2, dx);
            scene.add(diffuser);
          }
        }
      });
      ringInstanced.instanceMatrix.needsUpdate = true;
      hangerInstanced.instanceMatrix.needsUpdate = true;
      scene.add(ringInstanced);
      scene.add(hangerInstanced);

      // Two-Tone Structural Columns with Safety Yellow Base & Impact Bollards
      const colUpperMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
      const colBaseMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.3 });
      const bollardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.3 });
      const bollardBandMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

      const colUpperGeo = new THREE.BoxGeometry(1.6, 22, 1.6);
      const colBaseGeo = new THREE.BoxGeometry(2.0, 3.0, 2.0);
      const bollardGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.4, 12);
      const bollardBandGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.2, 12);

      [
        [-108, -73], [108, -73], [-108, 73], [108, 73],
        [-50, -73], [50, -73], [-50, 73], [50, 73],
        [-50, 0], [50, 0],
      ].forEach(([x, z]) => {
        const colUpper = new THREE.Mesh(colUpperGeo, colUpperMat);
        colUpper.position.set(x, 14, z); colUpper.castShadow = true; scene.add(colUpper);
        const colBase = new THREE.Mesh(colBaseGeo, colBaseMat);
        colBase.position.set(x, 1.5, z); colBase.castShadow = true; scene.add(colBase);

        [-1.6, 1.6].forEach((bx) => {
          const bollard = new THREE.Mesh(bollardGeo, bollardMat);
          bollard.position.set(x + bx, 0.7, z + (z < 0 ? 1.8 : -1.8));
          scene.add(bollard);
          const band = new THREE.Mesh(bollardBandGeo, bollardBandMat);
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

      // ─── 3.5 Industrial Racking System ───
      const shelfFrameMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.3 });
      const beamMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5, roughness: 0.3 });
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.4 });

      const createRackRow = (startX, startZ, width, depth, height, shelvesCount) => {
        const group = new THREE.Group();
        const numPosts = Math.floor(width / 7);
        const postGeo = new THREE.BoxGeometry(0.35, height, 0.35);
        const beamGeo = new THREE.BoxGeometry(width, 0.25, 0.25);
        const rackBoxGeos = [
          createRoundedBox(1.5, 1.2, depth * 0.75, 0.04, 1),
          createRoundedBox(1.7, 1.4, depth * 0.75, 0.04, 1),
          createRoundedBox(1.4, 1.0, depth * 0.75, 0.04, 1),
        ];

        for (let i = 0; i <= numPosts; i++) {
          const px = -width / 2 + i * 7;
          const postFront = new THREE.Mesh(postGeo, shelfFrameMat);
          postFront.position.set(px, height / 2, depth / 2); postFront.castShadow = true; group.add(postFront);
          const postBack = new THREE.Mesh(postGeo, shelfFrameMat);
          postBack.position.set(px, height / 2, -depth / 2); postBack.castShadow = true; group.add(postBack);
        }

        for (let s = 1; s <= shelvesCount; s++) {
          const sy = s * (height / (shelvesCount + 1));
          const beamFront = new THREE.Mesh(beamGeo, beamMat);
          beamFront.position.set(0, sy, depth / 2); group.add(beamFront);
          const beamBack = new THREE.Mesh(beamGeo, beamMat);
          beamBack.position.set(0, sy, -depth / 2); group.add(beamBack);

          for (let i = 0; i < numPosts; i++) {
            const sectionX = -width / 2 + i * 7 + 3.5;
            const boxCount = Math.floor(Math.random() * 3) + 1;
            for (let b = 0; b < boxCount; b++) {
              const bx = sectionX - 2.2 + b * 2.2;
              const bh = 1.2;
              const boxMesh = new THREE.Mesh(rackBoxGeos[b % rackBoxGeos.length], crateMat);
              boxMesh.position.set(bx, sy + bh / 2 + 0.1, 0);
              boxMesh.receiveShadow = true;
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

      // ─── 4. High-Tech 4-Aisle 3D ASRS Matrix with Instanced Structural Framing & 4 Bots ───
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
        const aisleZs = [10.5, 3.5, -3.5, -10.5];

        const colPostsX = [];
        for (let c = 0; c <= numCols; c++) {
          colPostsX.push(-rackW / 2 + c * (rackW / numCols));
        }

        const slotXs = [];
        for (let c = 0; c < numCols; c++) {
          slotXs.push(-rackW / 2 + c * (rackW / numCols) + (rackW / numCols) / 2);
        }

        // 1. Instanced Double-Sided Vertical Structural Posts & Central Climbing Columns
        const rackFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
        const shelfPlateMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });

        const postInstancesCount = colPostsX.length * aisleZs.length; // 32
        const centerPostInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, rackH, 0.35), railMat, postInstancesCount);
        const trackInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, rackH, 0.15), gearTrackMat, postInstancesCount);
        const sidePostInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, rackH, 0.3), rackFrameMat, postInstancesCount * 2);
        const topBraceInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 3.2), rackFrameMat, postInstancesCount);
        centerPostInst.castShadow = true;
        sidePostInst.castShadow = true;

        let pIdx = 0;
        let spIdx = 0;
        colPostsX.forEach((rx) => {
          aisleZs.forEach((az) => {
            _instDummy.rotation.set(0, 0, 0);

            _instDummy.position.set(rx, rackH / 2, az);
            _instDummy.updateMatrix();
            centerPostInst.setMatrixAt(pIdx, _instDummy.matrix);

            _instDummy.position.set(rx, rackH / 2, az + 0.2);
            _instDummy.updateMatrix();
            trackInst.setMatrixAt(pIdx, _instDummy.matrix);

            _instDummy.position.set(rx, rackH + 0.1, az);
            _instDummy.updateMatrix();
            topBraceInst.setMatrixAt(pIdx, _instDummy.matrix);
            pIdx++;

            _instDummy.position.set(rx, rackH / 2, az - 1.5);
            _instDummy.updateMatrix();
            sidePostInst.setMatrixAt(spIdx++, _instDummy.matrix);

            _instDummy.position.set(rx, rackH / 2, az + 1.5);
            _instDummy.updateMatrix();
            sidePostInst.setMatrixAt(spIdx++, _instDummy.matrix);
          });
        });
        centerPostInst.instanceMatrix.needsUpdate = true;
        trackInst.instanceMatrix.needsUpdate = true;
        sidePostInst.instanceMatrix.needsUpdate = true;
        topBraceInst.instanceMatrix.needsUpdate = true;
        asrsGroup.add(centerPostInst, trackInst, sidePostInst, topBraceInst);

        // 2. Base Longitudinal Floor Rails for all 4 Aisles
        const baseRailGeo = new THREE.BoxGeometry(58, 0.14, 0.15);
        const magTrackGeo = new THREE.BoxGeometry(58, 0.18, 0.25);
        aisleZs.forEach((az) => {
          const baseRailOuterL = new THREE.Mesh(baseRailGeo, baseRailMat);
          baseRailOuterL.position.set(9, 0.07, az - 0.4); asrsGroup.add(baseRailOuterL);

          const baseRailOuterR = new THREE.Mesh(baseRailGeo, baseRailMat);
          baseRailOuterR.position.set(9, 0.07, az + 0.4); asrsGroup.add(baseRailOuterR);

          const magTrack = new THREE.Mesh(magTrackGeo, gearTrackMat);
          magTrack.position.set(9, 0.09, az); asrsGroup.add(magTrack);
        });

        // 3. Complete 2D Grid Floor Rail Track Network
        const crossRailXs = [...colPostsX, -20, 16, 36];
        const gridJunctionMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
        const ledDotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const crossRailGeo = new THREE.BoxGeometry(0.3, 0.15, 26);
        const junctionGeo = new THREE.BoxGeometry(0.95, 0.06, 0.95);
        const ledDotGeo = new THREE.BoxGeometry(0.2, 0.02, 0.2);

        crossRailXs.forEach((rx) => {
          const crossRail = new THREE.Mesh(crossRailGeo, baseRailMat);
          crossRail.position.set(rx, 0.08, 0); asrsGroup.add(crossRail);

          aisleZs.forEach((az) => {
            const junction = new THREE.Mesh(junctionGeo, gridJunctionMat);
            junction.position.set(rx, 0.11, az); asrsGroup.add(junction);

            const ledDot = new THREE.Mesh(ledDotGeo, ledDotMat);
            ledDot.position.set(rx, 0.15, az); asrsGroup.add(ledDot);
          });
        });

        // 4. Double-Sided Rack Shelf Levels & Storage Tote Grid
        const gridTotes = {};
        const rowYs = [];
        const sides = [-1, 1];
        const blueToteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.2 });
        const asrsToteGeo = createRoundedBox(1.9, 1.1, 1.6, 0.05, 1);
        const asrsShelfBeamGeo = new THREE.BoxGeometry(rackW, 0.18, 0.18);
        const asrsShelfPlateGeo = new THREE.BoxGeometry(rackW, 0.05, 1.4);

        for (let r = 1; r <= numRows; r++) {
          const ry = r * (rackH / (numRows + 1));
          rowYs.push(ry);

          aisleZs.forEach((az, aIdx) => {
            sides.forEach((side) => {
              const shelfZ = az + side * 1.5;

              const beam = new THREE.Mesh(asrsShelfBeamGeo, asrsBeamMat);
              beam.position.set(0, ry, shelfZ); asrsGroup.add(beam);

              const shelfPlate = new THREE.Mesh(asrsShelfPlateGeo, shelfPlateMat);
              shelfPlate.position.set(0, ry + 0.08, shelfZ); asrsGroup.add(shelfPlate);

              for (let c = 0; c < numCols; c++) {
                const slotX = slotXs[c];
                const isFilled = (c + r * 2 + (side > 0 ? 1 : 0) + aIdx) % 4 !== 0;
                if (isFilled) {
                  const tote = new THREE.Mesh(asrsToteGeo, blueToteMat);
                  tote.position.set(slotX, ry + 0.65, shelfZ); asrsGroup.add(tote);

                  const toteKey = `aisle_${aIdx}_side_${side}_col_${c}_row_${r}`;
                  gridTotes[toteKey] = tote;
                }
              }
            });
          });
        }

        // Workstation & Middle Station Conveyor System
        const stationGroup = new THREE.Group();

        const conveyorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
        const conveyorBed = new THREE.Mesh(new THREE.BoxGeometry(22, 0.35, 2.2), conveyorFrameMat);
        conveyorBed.position.set(0, 1.0, 0); conveyorBed.castShadow = true; stationGroup.add(conveyorBed);

        const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.1, 12);
        const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
        for (let rx = -10; rx <= 10; rx += 1.2) {
          const roller = new THREE.Mesh(rollerGeo, rollerMat);
          roller.rotation.x = Math.PI / 2; roller.position.set(rx, 1.2, 0); stationGroup.add(roller);
        }

        const deskMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.3, 2.2), deskMat);
        desk.position.set(0, 0.65, -1.8); desk.castShadow = true; stationGroup.add(desk);

        const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x38bdf8, emissiveIntensity: 0.6 }));
        monitor.position.set(-1.5, 1.8, -1.8); monitor.rotation.y = 0.25; stationGroup.add(monitor);

        const lightBarMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const lightBar = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 0.15), lightBarMat);
        lightBar.position.set(0, 2.5, -1.8); stationGroup.add(lightBar);

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

          const gearMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
          const gearGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12);
          const gearL1 = new THREE.Mesh(gearGeo, gearMat);
          gearL1.rotation.z = Math.PI / 2; gearL1.position.set(-1.25, 0.28, -0.7); botGroup.add(gearL1);
          const gearL2 = new THREE.Mesh(gearGeo, gearMat);
          gearL2.rotation.z = Math.PI / 2; gearL2.position.set(-1.25, 0.28, 0.7); botGroup.add(gearL2);
          const gearR1 = new THREE.Mesh(gearGeo, gearMat);
          gearR1.rotation.z = Math.PI / 2; gearR1.position.set(1.25, 0.28, -0.7); botGroup.add(gearR1);
          const gearR2 = new THREE.Mesh(gearGeo, gearMat);
          gearR2.rotation.z = Math.PI / 2; gearR2.position.set(1.25, 0.28, 0.7); botGroup.add(gearR2);

          const ledMat = new THREE.MeshBasicMaterial({ color: ledColorHex });
          const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), ledMat);
          ledStrip.position.set(0, 0.45, 1.01); botGroup.add(ledStrip);

          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), ledMat);
          beacon.position.set(-0.9, 0.65, -0.7); botGroup.add(beacon);

          const armGroup = new THREE.Group();
          const forkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
          const fork1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.8), forkMat);
          fork1.position.set(-0.6, 0.62, 0); armGroup.add(fork1);
          const fork2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.8), forkMat);
          fork2.position.set(0.6, 0.62, 0); armGroup.add(fork2);
          botGroup.add(armGroup);

          const toteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
          const botTote = new THREE.Mesh(createRoundedBox(1.8, 0.95, 1.9, 0.04, 2), toteMat);
          botTote.position.set(0, 1.10, 0); botTote.castShadow = true;
          armGroup.add(botTote);

          return { botGroup, armGroup, botTote, beacon, gearL1, gearL2, gearR1, gearR2 };
        };

        const bot1 = createClimbingBot(0xeab308, 0xfef08a);
        bot1.botGroup.position.set(-9.14, 0, aisleZs[1]); asrsGroup.add(bot1.botGroup);

        const bot2 = createClimbingBot(0xf97316, 0xffedd5);
        bot2.botGroup.position.set(36, 0, aisleZs[1]); asrsGroup.add(bot2.botGroup);

        const bot3 = createClimbingBot(0x10b981, 0xa7f3d0);
        bot3.botGroup.position.set(-4.57, 0, aisleZs[2]); asrsGroup.add(bot3.botGroup);

        const bot4 = createClimbingBot(0x8b5cf6, 0xddd6fe);
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

      // ─── 4.5 PTL (Put-to-Light) Station — Back-Right Corner (1 Shared Dynamic PointLight) ───
      const createPTL = () => {
        const ptlGroup = new THREE.Group();

        const rackFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
        const slotBinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
        const trolleyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });

        const RACK_HEIGHT = 9.6;
        const SHELF_COUNT = 4;
        const SLOT_W = 2.2;
        const SLOT_H = 1.9;
        const SLOT_D = 1.8;
        const RACK_DEPTH = 2.0;

        const parcelColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xf97316, 0x06b6d4, 0xec4899];

        // 1 Shared PointLight for the active PTL slot (Replaces 64 individual PointLights!)
        const activeSlotLight = new THREE.PointLight(0x10b981, 0, 4.5);
        ptlGroup.add(activeSlotLight);

        const createRack = (slotCount, rackW) => {
          const rackGroup = new THREE.Group();
          const slots = [];
          const postGeo = new THREE.BoxGeometry(0.25, RACK_HEIGHT, 0.25);
          const shelfGeo = new THREE.BoxGeometry(rackW, 0.1, RACK_DEPTH);
          const beamGeo = new THREE.BoxGeometry(rackW, 0.15, 0.15);
          const binGeo = new THREE.BoxGeometry(SLOT_W * 0.85, SLOT_H * 0.8, SLOT_D * 0.85);
          const ledGeo = new THREE.BoxGeometry(SLOT_W * 0.7, 0.14, 0.14);
          const dotGeo = new THREE.CircleGeometry(0.12, 8);

          for (let i = 0; i <= slotCount; i++) {
            const postX = -rackW / 2 + i * (rackW / slotCount);
            const post = new THREE.Mesh(postGeo, rackFrameMat);
            post.position.set(postX, RACK_HEIGHT / 2, 0);
            post.castShadow = true;
            rackGroup.add(post);

            const postBack = new THREE.Mesh(postGeo, rackFrameMat);
            postBack.position.set(postX, RACK_HEIGHT / 2, -RACK_DEPTH);
            postBack.castShadow = true;
            rackGroup.add(postBack);
          }

          for (let row = 0; row < SHELF_COUNT; row++) {
            const shelfY = 0.4 + row * (RACK_HEIGHT / SHELF_COUNT);

            const shelf = new THREE.Mesh(shelfGeo, shelfMat);
            shelf.position.set(0, shelfY, -RACK_DEPTH / 2);
            rackGroup.add(shelf);

            const beam = new THREE.Mesh(beamGeo, rackFrameMat);
            beam.position.set(0, shelfY + SLOT_H + 0.06, 0);
            rackGroup.add(beam);

            for (let col = 0; col < slotCount; col++) {
              const slotX = -rackW / 2 + col * (rackW / slotCount) + (rackW / slotCount) / 2;

              const bin = new THREE.Mesh(binGeo, slotBinMat.clone());
              bin.position.set(slotX, shelfY + SLOT_H * 0.45, -RACK_DEPTH / 2);
              bin.material.transparent = true;
              bin.material.opacity = 0.28;
              rackGroup.add(bin);

              const ledMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
              const led = new THREE.Mesh(ledGeo, ledMat);
              led.position.set(slotX, shelfY + SLOT_H + 0.15, 0.08);
              rackGroup.add(led);

              const dotMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
              const dot = new THREE.Mesh(dotGeo, dotMat);
              dot.position.set(slotX, shelfY + SLOT_H + 0.15, 0.16);
              rackGroup.add(dot);

              slots.push({
                row, col, x: slotX, y: shelfY,
                bin, led, ledMat, dot, dotMat,
                hasParcel: false, parcelMesh: null
              });
            }
          }

          const topBeam = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.18, RACK_DEPTH + 0.4), rackFrameMat);
          topBeam.position.set(0, RACK_HEIGHT + 0.08, -RACK_DEPTH / 2);
          rackGroup.add(topBeam);

          return { rackGroup, slots };
        };

        const leftRack = createRack(5, 5 * SLOT_W);
        leftRack.rackGroup.position.set(-7.5, 0, 0);
        leftRack.rackGroup.rotation.y = Math.PI / 2;
        ptlGroup.add(leftRack.rackGroup);

        const backRack = createRack(6, 6 * SLOT_W);
        backRack.rackGroup.position.set(0, 0, -7.5);
        backRack.rackGroup.rotation.y = 0;
        ptlGroup.add(backRack.rackGroup);

        const rightRack = createRack(5, 5 * SLOT_W);
        rightRack.rackGroup.position.set(7.5, 0, 0);
        rightRack.rackGroup.rotation.y = -Math.PI / 2;
        ptlGroup.add(rightRack.rackGroup);

        const allSlots = [];
        leftRack.slots.forEach((s, i) => allSlots.push({ ...s, rackId: 'left', slotIdx: i }));
        backRack.slots.forEach((s, i) => allSlots.push({ ...s, rackId: 'back', slotIdx: i }));
        rightRack.slots.forEach((s, i) => allSlots.push({ ...s, rackId: 'right', slotIdx: i }));

        // ─── Trolley with parcels ───
        const trolleyGroup = new THREE.Group();

        const trolleyBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 2.4), trolleyMat);
        trolleyBase.position.set(0, 1.1, 0);
        trolleyBase.castShadow = true;
        trolleyGroup.add(trolleyBase);

        const legGeo = new THREE.BoxGeometry(0.14, 1.1, 0.14);
        [[-1.6, 0.55, -1.0], [1.6, 0.55, -1.0], [-1.6, 0.55, 1.0], [1.6, 0.55, 1.0]].forEach(([lx, ly, lz]) => {
          const leg = new THREE.Mesh(legGeo, trolleyMat);
          leg.position.set(lx, ly, lz);
          trolleyGroup.add(leg);
        });

        const tWheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12);
        const tWheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
        [[-1.6, 0.15, -1.0], [1.6, 0.15, -1.0], [-1.6, 0.15, 1.0], [1.6, 0.15, 1.0]].forEach(([wx, wy, wz]) => {
          const wheel = new THREE.Mesh(tWheelGeo, tWheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, wy, wz);
          trolleyGroup.add(wheel);
        });

        const handleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
        const handleVert = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), handleMat);
        handleVert.position.set(0, 1.8, 1.25);
        trolleyGroup.add(handleVert);
        const handleHorz = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), handleMat);
        handleHorz.position.set(0, 2.45, 1.25);
        trolleyGroup.add(handleHorz);

        const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 2.4), trolleyMat);
        sideRailL.position.set(-1.75, 1.35, 0);
        trolleyGroup.add(sideRailL);
        const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 2.4), trolleyMat);
        sideRailR.position.set(1.75, 1.35, 0);
        trolleyGroup.add(sideRailR);

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

        const scannerBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.45, 0.25),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
        );
        scannerBody.position.set(0, 1.1, 0);
        scannerDeskGroup.add(scannerBody);

        const scanScreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const scanScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), scanScreenMat);
        scanScreen.position.set(0, 1.15, 0.135);
        scannerDeskGroup.add(scanScreen);

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

        const wArmL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), workerVestMat);
        wArmL.position.set(-0.5, 1.6, 0);
        ptlWorkerGroup.add(wArmL);

        const wArmR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), workerVestMat);
        wArmR.position.set(0.5, 1.6, 0);
        ptlWorkerGroup.add(wArmR);

        const carriedParcelMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
        const carriedParcel = new THREE.Mesh(createRoundedBox(0.55, 0.35, 0.45, 0.03, 2), carriedParcelMat);
        carriedParcel.position.set(0, 1.25, 0.4);
        carriedParcel.visible = false;
        ptlWorkerGroup.add(carriedParcel);

        ptlWorkerGroup.position.set(0, 0, 1.8);
        ptlGroup.add(ptlWorkerGroup);

        const ptlSign = createLabelSprite('📦 PUT-TO-LIGHT SORTATION STATION', '#10b981', '#10b981');
        ptlSign.position.set(0, RACK_HEIGHT + 2.8, -2.5);
        ptlSign.scale.set(0, 0, 0);
        ptlSign.visible = false;
        ptlGroup.add(ptlSign);

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

        const ptlFloorMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
        const ptlFloor = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), ptlFloorMat);
        ptlFloor.rotation.x = -Math.PI / 2;
        ptlFloor.position.set(0, 0.03, -1.5);
        ptlGroup.add(ptlFloor);

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

        ptlGroup.position.set(75, 0, -50);
        ptlGroup.rotation.y = Math.atan2(-75, 50);
        scene.add(ptlGroup);
        colliders.push(makeAABB(75, -50, 9.5, 9.5));

        const ptlState = {
          stage: 0,
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
          ptlSign, activeSlotLight
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
        { x: 0, z: 15, colorType: TECH_CRATES.PTL },
        { x: -20, z: -35, colorType: TECH_CRATES.DOTNET },
        { x: 20, z: -35, colorType: TECH_CRATES.MADRID },
        { x: -20, z: 35, colorType: TECH_CRATES.PLC },
        { x: 20, z: 35, colorType: TECH_CRATES.RABBITMQ },
        { x: -35, z: -15, colorType: TECH_CRATES.RIYADH },
        { x: -25, z: -15, colorType: TECH_CRATES.RIYADH },
        { x: -35, z: 20, colorType: TECH_CRATES.RIYADH },
        { x: -15, z: 25, colorType: TECH_CRATES.RIYADH },
        { x: -45, z: 0, colorType: TECH_CRATES.RIYADH },
        { x: -10, z: -40, colorType: TECH_CRATES.RIYADH },
      ];

      const sharedBoxGeo = new THREE.BoxGeometry(1.9, 1.4, 1.9);
      const sharedSkidGeo = new THREE.BoxGeometry(0.2, 0.15, 1.9);
      const sharedSkidMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.4 });
      const sharedBottomMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.3 });
      const sharedLedGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12);
      const sharedRingGeo = new THREE.RingGeometry(1.4, 1.8, 32);

      boxDefinitions.forEach(({ x, z, colorType }, idx) => {
        const containerGroup = new THREE.Group();
        const { sideTex, topTex } = getCrateTextures(colorType);

        const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.35, metalness: 0.2 });
        const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.4, metalness: 0.1 });

        const boxMaterials = [sideMat, sideMat, topMat, sharedBottomMat, sideMat, sideMat];

        const boxCarrier = new THREE.Group();

        const box = new THREE.Mesh(sharedBoxGeo, boxMaterials);
        box.position.set(0, 0.85, 0);
        box.castShadow = true;
        box.receiveShadow = true;
        boxCarrier.add(box);

        const skidL = new THREE.Mesh(sharedSkidGeo, sharedSkidMat);
        skidL.position.set(-0.7, 0.08, 0);
        boxCarrier.add(skidL);

        const skidR = new THREE.Mesh(sharedSkidGeo, sharedSkidMat);
        skidR.position.set(0.7, 0.08, 0);
        boxCarrier.add(skidR);

        const ledMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.9 });
        const ledMesh = new THREE.Mesh(sharedLedGeo, ledMat);
        ledMesh.position.set(0.75, 1.62, 0.75);
        boxCarrier.add(ledMesh);

        // 3D physical differentiation for PLC Hardware & Riyadh Air Cargo
        if (colorType.id === 'plc') {
          // Additional amber diagnostic LED for industrial rack look
          const ledAmberMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 });
          const ledAmberMesh = new THREE.Mesh(sharedLedGeo, ledAmberMat);
          ledAmberMesh.position.set(0.75, 1.62, 0.52);
          boxCarrier.add(ledAmberMesh);

          // Industrial metal antenna / sensor module on opposite corner
          const antGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8);
          const antMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
          const antMesh = new THREE.Mesh(antGeo, antMat);
          antMesh.position.set(-0.75, 1.68, -0.75);
          boxCarrier.add(antMesh);
        } else if (colorType.id === 'riyadh') {
          // Additional gold LED beacon for international air cargo look
          const ledGoldMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 });
          const ledGoldMesh = new THREE.Mesh(sharedLedGeo, ledGoldMat);
          ledGoldMesh.position.set(0.52, 1.62, 0.75);
          boxCarrier.add(ledGoldMesh);
        }

        containerGroup.add(boxCarrier);

        const labelText = `${colorType.subIcon || colorType.icon} ${colorType.title.toUpperCase()} [E]`;
        const labelSprite = createLabelSprite(
          labelText,
          colorType.id === 'plc' ? '#38bdf8' : (colorType.id === 'riyadh' ? '#fde047' : colorType.css),
          colorType.id === 'plc' ? '#2563eb' : (colorType.id === 'riyadh' ? '#fbbf24' : colorType.css)
        );
        labelSprite.position.set(0, 4.2, 0);
        labelSprite.scale.set(0, 0, 0);
        labelSprite.visible = false;
        containerGroup.add(labelSprite);

        const ringMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(sharedRingGeo, ringMat);
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
      const amrWheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
      const amrWheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      const amrToteGeo = createRoundedBox(1.1, 0.6, 0.9, 0.04, 2);
      const amrToteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });

      const createMiniBot = (startX, startZ, waypoints, bodyHex) => {
        const group = new THREE.Group();

        const chassisMat = new THREE.MeshStandardMaterial({ color: bodyHex, metalness: 0.8, roughness: 0.2 });
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.4), chassisMat);
        chassis.position.set(0, 0.22, 0); chassis.castShadow = true; group.add(chassis);

        const padMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
        const pad = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.2), padMat);
        pad.position.set(0, 0.41, 0); group.add(pad);

        const tote = new THREE.Mesh(amrToteGeo, amrToteMat);
        tote.position.set(0, 0.74, 0); tote.castShadow = true; group.add(tote);

        [[-0.82, 0.18, -0.5], [0.82, 0.18, -0.5], [-0.82, 0.18, 0.5], [0.82, 0.18, 0.5]].forEach(([wx, wy, wz]) => {
          const wheel = new THREE.Mesh(amrWheelGeo, amrWheelMat);
          wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, wy, wz); group.add(wheel);
        });

        const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const ledBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), ledMat);
        ledBar.position.set(0, 0.32, 0.71); group.add(ledBar);

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

      createMiniBot(30, -50, [[30, -50], [30, 50], [30, -50]], 0xeab308);
      createMiniBot(-25, 30, [[-25, 30], [45, 30], [-25, 30]], 0xf97316);
      createMiniBot(45, -30, [[45, -30], [-25, -30], [45, -30]], 0x10b981);
      createMiniBot(35, 30, [[35, 30], [35, -30], [-25, -30], [-25, 30], [35, 30]], 0x8b5cf6);

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

      const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      [[-1.1, 0.5, -1.2], [1.1, 0.5, -1.2], [-1.1, 0.5, 1.2], [1.1, 0.5, 1.2]].forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, y, z); wheel.rotation.z = Math.PI / 2;
        forklift.add(wheel);
      });

      const beaconGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8);
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.9 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 4.45, -0.4); forklift.add(beacon);

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
        { x: -24, z: 62, colorType: TECH_CRATES.RIYADH },
        { x: 24, z: 62, colorType: TECH_CRATES.MADRID },
        { x: -50, z: 55, colorType: TECH_CRATES.PLC },
        { x: 50, z: 55, colorType: TECH_CRATES.RABBITMQ },
        { x: 60, z: -40, colorType: TECH_CRATES.PTL },
      ];

      const padGeo = new THREE.PlaneGeometry(12, 12);
      const arrowConeGeo = new THREE.ConeGeometry(1.4, 2.2, 4);
      const arrowRingGeo = new THREE.RingGeometry(1.6, 2.0, 24);

      zoneDefinitions.forEach(({ x, z, colorType }) => {
        const padGroup = new THREE.Group();

        const padTex = getDropPadTexture(colorType);
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

        const chevronGroup = new THREE.Group();
        const arrowMat = new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.95 });
        const arrow = new THREE.Mesh(arrowConeGeo, arrowMat);
        arrow.position.set(0, 5.0, 0);
        arrow.rotation.x = Math.PI;
        chevronGroup.add(arrow);

        const arrowRing = new THREE.Mesh(
          arrowRingGeo,
          new THREE.MeshBasicMaterial({ color: colorType.hex, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
        );
        arrowRing.rotation.x = -Math.PI / 2;
        arrowRing.position.set(0, 6.2, 0);
        chevronGroup.add(arrowRing);
        padGroup.add(chevronGroup);

        const isSpecialGateZone = colorType.id === 'madrid' || colorType.id === 'riyadh';
        const zoneTitle = `${colorType.subIcon || colorType.icon} ${colorType.zoneName}`;
        const defaultLabelSprite = createLabelSprite(zoneTitle, colorType.css, colorType.css, 'rgba(15, 23, 42, 0.95)');
        defaultLabelSprite.position.set(0, isSpecialGateZone ? 6.2 : 12.2, 0);
        defaultLabelSprite.scale.set(9.8, 1.5, 1);
        defaultLabelSprite.visible = true;
        padGroup.add(defaultLabelSprite);

        const targetLabelSprite = createLabelSprite(
          `🎯 DELIVER ${colorType.shortName.toUpperCase()} HERE! ⬇️`,
          '#ffffff',
          '#fbbf24',
          'rgba(234, 88, 12, 0.96)'
        );
        targetLabelSprite.position.set(0, isSpecialGateZone ? 7.8 : 15.6, 0);
        targetLabelSprite.scale.set(0, 0, 0);
        targetLabelSprite.visible = false;
        padGroup.add(targetLabelSprite);

        const readyLabelSprite = createLabelSprite(
          `✅ PRESS [E] TO UNLOAD ${colorType.shortName.toUpperCase()}!`,
          '#ffffff',
          '#10b981',
          'rgba(15, 23, 42, 0.98)'
        );
        readyLabelSprite.position.set(0, isSpecialGateZone ? 4.8 : 6.8, 0);
        readyLabelSprite.scale.set(0, 0, 0);
        readyLabelSprite.visible = false;
        padGroup.add(readyLabelSprite);

        padGroup.position.set(x, 0, z);
        scene.add(padGroup);

        deliveryZones.push({
          x, z, colorType, padGroup,
          chevronGroup, defaultLabelSprite, targetLabelSprite, readyLabelSprite
        });
      });

      // ─── 8B. Elevated Mezzanine Control Room ("Command Center") ───
      const createMezzanine = () => {
        const mezzanineGroup = new THREE.Group();

        // 1. Elevated Floor Platform Deck (Y = 7.75, width 34m, depth 16.5m, centered at X: 0, Z: -66.25)
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.55 });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 16.5), deckMat);
        deck.position.set(0, 7.75, -66.25);
        deck.receiveShadow = true;
        mezzanineGroup.add(deck);

        // Under-deck structural yellow edge trim
        const deckTrimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.4 });
        const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(34.2, 0.25, 0.35), deckTrimMat);
        frontTrim.position.set(0, 7.5, -58.0);
        mezzanineGroup.add(frontTrim);

        // Laser neon amber strip along lower deck trim
        const amberNeonMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const lowerStrip = new THREE.Mesh(new THREE.BoxGeometry(34.4, 0.08, 0.08), amberNeonMat);
        lowerStrip.position.set(0, 7.5, -57.8);
        mezzanineGroup.add(lowerStrip);

        // 2. Ceiling Deck (Y = 14.4)
        const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 });
        const ceiling = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 16.5), ceilingMat);
        ceiling.position.set(0, 14.4, -66.25);
        mezzanineGroup.add(ceiling);

        // 3. Side & Back Acoustic Cladding Walls
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.25, 16.5), wallMat);
        leftWall.position.set(-17, 11.12, -66.25);
        mezzanineGroup.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.25, 16.5), wallMat);
        rightWall.position.set(17, 11.12, -66.25);
        mezzanineGroup.add(rightWall);

        const backWallMez = new THREE.Mesh(new THREE.BoxGeometry(34, 6.25, 0.5), wallMat);
        backWallMez.position.set(0, 11.12, -74.5);
        mezzanineGroup.add(backWallMez);

        // 4. Giant LED Wall Displaying Simulated Live Telemetry
        const telemetryCanvas = createMezzanineTelemetryCanvas();
        updateMezzanineTelemetryCanvas(telemetryCanvas, 104820, 0, 85);
        const telemetryTexture = new THREE.CanvasTexture(telemetryCanvas);
        telemetryTexture.minFilter = THREE.LinearFilter;
        telemetryTexture.magFilter = THREE.LinearFilter;

        const ledWallMat = new THREE.MeshBasicMaterial({ map: telemetryTexture });
        const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 5.0), ledWallMat);
        ledWall.position.set(0, 11.2, -74.2);
        mezzanineGroup.add(ledWall);

        // 5. Ultra-Clear Panoramic Front Glass Windows
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.10,
          roughness: 0.02,
          metalness: 0.08,
          side: THREE.DoubleSide
        });
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(33.8, 5.8), glassMat);
        glass.position.set(0, 11.0, -58.0);
        mezzanineGroup.add(glass);

        // Glowing Cyan Perimeter Frame around Glass
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const frameTop = new THREE.Mesh(new THREE.BoxGeometry(34.0, 0.08, 0.08), neonCyanMat);
        frameTop.position.set(0, 13.9, -57.95);
        mezzanineGroup.add(frameTop);

        const frameBot = new THREE.Mesh(new THREE.BoxGeometry(34.0, 0.08, 0.08), neonCyanMat);
        frameBot.position.set(0, 8.1, -57.95);
        mezzanineGroup.add(frameBot);

        // Architectural Steel Mullions & Transoms
        const mullionMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.25 });
        const topMullion = new THREE.Mesh(new THREE.BoxGeometry(34, 0.35, 0.4), mullionMat);
        topMullion.position.set(0, 14.0, -58.0);
        mezzanineGroup.add(topMullion);

        const botMullion = new THREE.Mesh(new THREE.BoxGeometry(34, 0.35, 0.4), mullionMat);
        botMullion.position.set(0, 8.1, -58.0);
        mezzanineGroup.add(botMullion);

        [-17, -10.2, -3.4, 3.4, 10.2, 17].forEach((mx) => {
          const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.0, 0.35), mullionMat);
          vMullion.position.set(mx, 11.0, -58.0);
          mezzanineGroup.add(vMullion);
        });

        // Interior Safety Handrail along the glass
        const railMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 });
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(33, 0.08, 0.08), railMat);
        topRail.position.set(0, 9.1, -58.8);
        mezzanineGroup.add(topRail);

        for (let rx = -16; rx <= 16; rx += 3.2) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), railMat);
          post.position.set(rx, 8.55, -58.8);
          mezzanineGroup.add(post);
        }

        // 6. Ground Support Structural Columns (7.5m clearance beneath mezzanine, open central span)
        const colGeo = new THREE.BoxGeometry(1.2, 7.8, 1.2);
        const colMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
        const colBaseGeo = new THREE.BoxGeometry(1.8, 2.0, 1.8);
        const colBaseMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.3 });

        const columnCoords = [
          [-16, -60], [16, -60],
          [-16, -72], [16, -72]
        ];
        columnCoords.forEach(([cx, cz]) => {
          const colMesh = new THREE.Mesh(colGeo, colMat);
          colMesh.position.set(cx, 3.9, cz);
          colMesh.castShadow = true;
          mezzanineGroup.add(colMesh);

          const baseMesh = new THREE.Mesh(colBaseGeo, colBaseMat);
          baseMesh.position.set(cx, 1.0, cz);
          baseMesh.castShadow = true;
          mezzanineGroup.add(baseMesh);

          colliders.push(makeAABB(cx, cz, 1.0, 1.0));
        });

        // 7. Mezzanine Underglow Spotlights (High-tech illumination of transit floor beneath)
        const underSpotL = new THREE.SpotLight(0x06b6d4, 3.8, 24, Math.PI / 3, 0.45, 1);
        underSpotL.position.set(-8, 7.5, -66);
        underSpotL.target.position.set(-8, 0, -66);
        mezzanineGroup.add(underSpotL);
        mezzanineGroup.add(underSpotL.target);

        const underSpotR = new THREE.SpotLight(0x06b6d4, 3.8, 24, Math.PI / 3, 0.45, 1);
        underSpotR.position.set(8, 7.5, -66);
        underSpotR.target.position.set(8, 0, -66);
        mezzanineGroup.add(underSpotR);
        mezzanineGroup.add(underSpotR.target);

        // 8. Interior Cyan Command Lighting
        const mezLightL = new THREE.PointLight(0x38bdf8, 2.0, 30);
        mezLightL.position.set(-8, 13.8, -66);
        mezzanineGroup.add(mezLightL);

        const mezLightR = new THREE.PointLight(0x38bdf8, 2.0, 30);
        mezLightR.position.set(8, 13.8, -66);
        mezzanineGroup.add(mezLightR);

        // 9. Interior Operator Consoles Facing the Panoramic Windows (Flanking Left & Right)
        const deskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        [-8.5, 8.5].forEach((dx) => {
          const desk = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.8, 1.4), deskMat);
          desk.position.set(dx, 8.4, -60.8);
          mezzanineGroup.add(desk);

          [-1.0, 1.0].forEach((mx) => {
            const stand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mullionMat);
            stand.position.set(dx + mx, 9.0, -60.8);
            mezzanineGroup.add(stand);

            const mon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.08), mullionMat);
            mon.position.set(dx + mx, 9.45, -60.8);
            mon.rotation.y = mx < 0 ? 0.15 : -0.15;
            mezzanineGroup.add(mon);

            const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), screenMat);
            scr.position.set(dx + mx, 9.45, -60.75);
            scr.rotation.y = (mx < 0 ? 0.15 : -0.15) + Math.PI;
            mezzanineGroup.add(scr);
          });

          const chair = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 1.0), mullionMat);
          chair.position.set(dx, 8.6, -62.5);
          mezzanineGroup.add(chair);
        });

        // 10. Central Holographic Command Pedestal with 3D Holographic Wireframe Core
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 });
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 1.1, 16), pedMat);
        ped.position.set(0, 8.55, -66);
        mezzanineGroup.add(ped);

        const coreLight = new THREE.PointLight(0x38bdf8, 2.2, 10);
        coreLight.position.set(0, 9.4, -66);
        mezzanineGroup.add(coreLight);

        const holoRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        const holoRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 24), holoRingMat);
        holoRing.rotation.x = -Math.PI / 2;
        holoRing.position.set(0, 9.2, -66);
        mezzanineGroup.add(holoRing);

        const holoCoreMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.85 });
        const holoCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), holoCoreMat);
        holoCore.position.set(0, 9.8, -66);
        mezzanineGroup.add(holoCore);

        // 11. Aerodynamic Cantilever Canopy Visor with Laser Neon Edge Strip
        const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.3 });
        const visor = new THREE.Mesh(new THREE.BoxGeometry(34.4, 0.25, 2.2), visorMat);
        visor.position.set(0, 14.45, -57.2);
        visor.rotation.x = 0.22;
        mezzanineGroup.add(visor);

        const laserStrip = new THREE.Mesh(new THREE.BoxGeometry(34.6, 0.08, 0.08), neonCyanMat);
        laserStrip.position.set(0, 14.22, -56.1);
        mezzanineGroup.add(laserStrip);

        // 12. Physical Illuminated 3D Fascia Signboard (Integrated in Roof Canopy)
        // Multi-material 3D box eliminates overlapping planes and prevents any Z-fighting/flicker
        const facadeSignTex = createFacadeSignTexture();
        const signHousingMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          metalness: 0.85,
          roughness: 0.3
        });
        const facadeSignMat = new THREE.MeshBasicMaterial({
          map: facadeSignTex
        });

        const signMaterials = [
          signHousingMat, // +X
          signHousingMat, // -X
          signHousingMat, // +Y
          signHousingMat, // -Y
          facadeSignMat,  // +Z (front face)
          signHousingMat  // -Z
        ];
        const signMesh = new THREE.Mesh(new THREE.BoxGeometry(16.0, 2.6, 0.4), signMaterials);
        signMesh.position.set(0, 15.65, -57.3);
        mezzanineGroup.add(signMesh);

        // Cyber neon trim along the top and bottom edges (non-overlapping)
        const signTrimMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
        const signTrimTop = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.08, 0.08), signTrimMat);
        signTrimTop.position.set(0, 16.98, -57.08);
        mezzanineGroup.add(signTrimTop);

        const signTrimBot = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.08, 0.08), signTrimMat);
        signTrimBot.position.set(0, 14.32, -57.08);
        mezzanineGroup.add(signTrimBot);

        // 13. Corner Aerospace Strobe Beacons (Flashing dual warning lights)
        const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 12);
        const beaconMats = [];
        [-17, 17].forEach((bx) => {
          const bHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.3, 12), mullionMat);
          bHousing.position.set(bx, 14.65, -58.0);
          mezzanineGroup.add(bHousing);

          const bMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xf59e0b,
            emissiveIntensity: 1.0,
            roughness: 0.2
          });
          const beaconMesh = new THREE.Mesh(beaconGeo, bMat);
          beaconMesh.position.set(bx, 15.0, -58.0);
          mezzanineGroup.add(beaconMesh);
          beaconMats.push(bMat);
        });

        // 15. Quantum Holographic Elevator Column (Beam of Light & Energy Rings)
        const accessPortalGroup = new THREE.Group();
        accessPortalGroup.position.set(0, 0.04, -53.5);

        // Ground Platform with Hazard Border
        const portalPadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 });
        const portalPad = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), portalPadMat);
        portalPad.rotation.x = -Math.PI / 2;
        portalPad.receiveShadow = true;
        accessPortalGroup.add(portalPad);

        const portalRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
        const portalRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 32), portalRingMat);
        portalRing.rotation.x = -Math.PI / 2;
        portalRing.position.set(0, 0.02, 0);
        accessPortalGroup.add(portalRing);

        // Vertical Translucent Elevator Beam Column
        const beamGeo = new THREE.CylinderGeometry(2.3, 2.3, 7.6, 24, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0x06b6d4,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const beamMesh = new THREE.Mesh(beamGeo, beamMat);
        beamMesh.position.set(0, 3.8, 0);
        accessPortalGroup.add(beamMesh);

        // 4 Animated Rising Quantum Energy Rings
        const ringGeo = new THREE.RingGeometry(1.95, 2.3, 24);
        const liftRings = [];
        for (let ri = 0; ri < 4; ri++) {
          const rMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          const ring = new THREE.Mesh(ringGeo, rMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(0, 0.5 + ri * 1.8, 0);
          accessPortalGroup.add(ring);
          liftRings.push(ring);
        }

        const accessSign = createLabelSprite('⚡ COMMAND CENTER LIFT [E]', '#38bdf8', '#0284c7', 'rgba(15, 23, 42, 0.96)');
        accessSign.position.set(0, 2.2, 0);
        accessSign.scale.set(7.5, 1.5, 1);
        accessPortalGroup.add(accessSign);

        scene.add(accessPortalGroup);
        scene.add(mezzanineGroup);

        return {
          mezzanineGroup,
          telemetryCanvas,
          telemetryTexture,
          holoRing,
          holoCore,
          portalRing,
          liftRings,
          beaconMats,
          accessSign,
          portalPos: new THREE.Vector3(0, 0, -53.5)
        };
      };

      const mezzanineData = createMezzanine();

      // ─── 9. Collectible Orbs ───
      const collectibles = [];
      const orbGeo = new THREE.IcosahedronGeometry(0.55, 2);
      const orbColor = new THREE.Color(0x38bdf8);
      const orbMat = new THREE.MeshStandardMaterial({
        color: orbColor, emissive: orbColor, emissiveIntensity: 0.8, roughness: 0.1
      });
      const orbRingGeo = new THREE.TorusGeometry(0.8, 0.04, 8, 24);
      const orbRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });

      [
        [-40, 2, -20], [40, 2, -20], [-40, 2, 20], [40, 2, 20],
        [0, 2, -40], [0, 2, 40], [-80, 2, 0], [80, 2, 0]
      ].forEach(([x, y, z], i) => {
        const group = new THREE.Group();
        const orb = new THREE.Mesh(orbGeo, orbMat); group.add(orb);
        const ring = new THREE.Mesh(orbRingGeo, orbRingMat); group.add(ring);

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

      // ─── 10. Lighting (Optimized: 9 ceiling UFO meshes + 3 wide-radius aisle PointLights) ───
      const ambient = new THREE.AmbientLight(0xfff7ed, 1.15); scene.add(ambient);
      const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.0); scene.add(hemi);

      const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
      sunLight.position.set(40, 60, 30); sunLight.target.position.set(0, 0, 0);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024; sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.bias = -0.0005;
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
      const ufoHousingGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.35, 16);
      const ufoCableGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6);
      const ufoBulbGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.06, 16);

      lightPositions.forEach(([x, y, z]) => {
        const housing = new THREE.Mesh(ufoHousingGeo, ufoBodyMat);
        housing.position.set(x, y, z); scene.add(housing);

        const cable = new THREE.Mesh(ufoCableGeo, cableMat);
        cable.position.set(x, y + 1.3, z); scene.add(cable);

        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 });
        const bulb = new THREE.Mesh(ufoBulbGeo, bulbMat);
        bulb.position.set(x, y - 0.18, z); scene.add(bulb);
        bulbs.push(bulbMat);

        // Create actual PointLight only along the central spine (3 lights instead of 9 SpotLights)
        if (z === 0) {
          const aisleLight = new THREE.PointLight(0xfffaed, 1.4, 95, 1);
          aisleLight.position.set(x, y - 0.5, z);
          scene.add(aisleLight);
          overheadLights.push(aisleLight);
        }
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
        sky, skyMat, interactableBoxes, deliveryZones, collectibles, forkliftState, asrsData, ptlData, mezzanineData,
      };

      const forkliftHalfW = 1.8;
      const forkliftHalfD = 2.5;

      const validControlKeys = ['w', 'a', 's', 'd', 'e', 'c', 'v', 'h', 'escape', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

      onKeyDown = (e) => {
        const key = e.key.toLowerCase();
        keysRef.current[key] = true;

        if (key === 'h' && !e.repeat) {
          playForkliftHorn();
          showMessage('📯 Honk Honk!');
        }

        if (key === 'c' && !e.repeat) {
          setCameraMode((p) => (p === 'third' ? 'first' : p === 'first' ? 'command' : 'third'));
        }

        if (key === 'v' && cameraModeRef.current === 'command' && !e.repeat) {
          setCommandView((prev) => (prev === 'screen' ? 'window' : 'screen'));
        }

        if (key === 'escape' && cameraModeRef.current === 'command') {
          setCameraMode('third');
          showMessage('🚜 Returned to Forklift Rover');
        }

        if (key === 'e' && cameraModeRef.current === 'command') {
          setCameraMode('third');
          showMessage('🚜 Returned to Forklift Rover');
        }

        if (validControlKeys.includes(key)) {
          wrongKeyCountRef.current = 0;
          e.preventDefault();
        } else if (key.length === 1 || ['space', 'tab', 'enter', 'shift', 'control'].includes(key)) {
          wrongKeyCountRef.current += 1;
          if (wrongKeyCountRef.current >= 3) {
            wrongKeyCountRef.current = 0;
            revealControlsBriefly(6000);
            showMessage('💡 Controls revealed! W/A/S/D to drive, E to pick/drop, C for camera!');
          }
        }
      };

      onKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      let interactCooldown = 0;
      let lastMezzanineTick = 0;
      let liveParcelsCount = 104820;
      const clock = new THREE.Clock();
      let speedFillEl = null;

      // Pre-allocated math objects for animate loop (Zero per-frame GC allocations)
      const _asrsStationPos = new THREE.Vector3(-49, 0, 0);
      const _asrsMatrixPos = new THREE.Vector3(-75, 0, 0);
      const _ptlPos = new THREE.Vector3(75, 0, -50);
      const _trolleyLocalPos = new THREE.Vector3(0, 0, 1.8);
      const _scanLocalPos = new THREE.Vector3(3.0, 0, 1.8);
      const _tempVec1 = new THREE.Vector3();
      const _tempVec2 = new THREE.Vector3();
      const _forkTipVec = new THREE.Vector3();
      const _forkDropVec = new THREE.Vector3();
      const _upAxis = new THREE.Vector3(0, 1, 0);
      const _camOffset = new THREE.Vector3(0, 14, -22);
      const _fpOffset = new THREE.Vector3(0, 4, 1);
      const _lookDir = new THREE.Vector3(0, 2.5, 10);
      const _targetPos = new THREE.Vector3();
      const _lookTarget = new THREE.Vector3();
      const _dayBg = new THREE.Color(0x131a26);
      const _nightBg = new THREE.Color(0x060913);

      // Cached HUD DOM element references
      let radarCanvas = null;
      let radarCoordsEl = null;
      let gpsNavEl = null;
      let gpsArrowEl = null;
      let gpsIconEl = null;
      let gpsDistEl = null;
      let radarLastDrawn = 0;
      let lastCoordUpdate = 0;
      let lastCoordX = null;
      let lastCoordZ = null;
      let lastGpsUpdate = 0;

      const lerpAngle = (a, b, t) => {
        let diff = (b - a) % (Math.PI * 2);
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI) diff -= Math.PI * 2;
        return a + diff * Math.max(0, Math.min(1, t));
      };

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

          const SPEED_X = 14.0;
          const SPEED_Z = 14.0;
          const SPEED_CLIMB = 8.0;
          const TURN_TIME = 0.25;

          const trackLen3 = 27.42;
          const b3Time = (elapsed * 10.0) % (trackLen3 * 2);
          const b3X = -13.71 + (b3Time <= trackLen3 ? b3Time : trackLen3 * 2 - b3Time);
          const b3Rot = b3Time <= trackLen3 ? 0 : Math.PI;
          bot3.botGroup.position.set(b3X, 0, aisleZs[2]);
          bot3.botGroup.rotation.y = lerpAngle(bot3.botGroup.rotation.y, b3Rot, delta * 10);
          bot3.botTote.visible = false;

          const trackLen4 = 22.85;
          const b4Time = ((elapsed * 10.0) + trackLen4) % (trackLen4 * 2);
          const b4X = -9.14 + (b4Time <= trackLen4 ? b4Time : trackLen4 * 2 - b4Time);
          const b4Rot = b4Time <= trackLen4 ? 0 : Math.PI;
          bot4.botGroup.position.set(b4X, 0, aisleZs[3]);
          bot4.botGroup.rotation.y = lerpAngle(bot4.botGroup.rotation.y, b4Rot, delta * 10);
          bot4.botTote.visible = false;

          const stationZ = aisleZs[1];

          switch (asrsState.stage) {
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
          const distToAsrsStation = forklift.position.distanceTo(_asrsStationPos);
          const isNearStation = distToAsrsStation < 30;
          if (asrsStationSign) {
            updateHeaderProximity(asrsStationSign, isNearStation, delta, { x: 8.6, y: 2.15 });
            if (asrsStationSign.visible) {
              asrsStationSign.position.y = 5.4 + Math.sin(elapsed * 2) * 0.2;
            }
          }
          if (asrsSign) {
            const distToMatrix = forklift.position.distanceTo(_asrsMatrixPos);
            const isNearMatrix = distToMatrix < 38;
            updateHeaderProximity(asrsSign, isNearMatrix, delta, { x: 10.0, y: 2.5 });
            if (asrsSign.visible) {
              asrsSign.position.y = 25.0 + Math.sin(elapsed * 2) * 0.2;
            }
          }
        }

        // ─── PTL (Put-to-Light) Station Animation State Machine (Zero Allocations) ───
        if (ptlData) {
          const {
            ptlGroup, allSlots, ptlWorkerGroup, carriedParcel, carriedParcelMat,
            scanBeamMat, scanScreenMat, trolleyParcels, ptlState, wArmL, wArmR, stripMat,
            ptlSign, activeSlotLight
          } = ptlData;

          const distToPTL = forklift.position.distanceTo(_ptlPos);
          const isNearPTL = distToPTL < 38;
          updateHeaderProximity(ptlSign, isNearPTL, delta, { x: 11.2, y: 2.8 });
          if (ptlSign.visible) {
            ptlSign.position.y = 12.8 + Math.sin(elapsed * 2) * 0.25;
          }

          ptlState.timer += delta;
          stripMat.opacity = 0.4 + Math.sin(elapsed * 2) * 0.2;

          const workerLocalPos = ptlWorkerGroup.position;
          const trolleyLocalPos = _trolleyLocalPos;
          const scanLocalPos = _scanLocalPos;

          switch (ptlState.stage) {
            case 0: {
              workerLocalPos.set(trolleyLocalPos.x, 0, trolleyLocalPos.z);
              ptlWorkerGroup.rotation.y = 0;

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

            case 1: {
              const walkDur = 0.6;
              const scanDur = 0.8;

              if (ptlState.timer < walkDur) {
                const p = ptlState.timer / walkDur;
                workerLocalPos.lerpVectors(trolleyLocalPos, scanLocalPos, p);
                ptlWorkerGroup.rotation.y = Math.PI / 2;
                ptlWorkerGroup.position.y = Math.sin(p * Math.PI * 4) * 0.05;
              } else if (ptlState.timer < walkDur + scanDur) {
                const sp = (ptlState.timer - walkDur) / scanDur;
                workerLocalPos.copy(scanLocalPos);
                ptlWorkerGroup.rotation.y = 0;
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

                // Position the shared activeSlotLight at the current target slot
                const slot = allSlots[ptlState.currentSlotIdx];
                slot.led.getWorldPosition(_tempVec1);
                ptlGroup.worldToLocal(_tempVec1);
                activeSlotLight.position.set(_tempVec1.x, _tempVec1.y - 0.5, _tempVec1.z);
              }
              break;
            }

            case 2: {
              const blinkDuration = 2.0;
              const slot = allSlots[ptlState.currentSlotIdx];

              const blinkOn = Math.sin(elapsed * 18) > 0;
              slot.ledMat.color.setHex(blinkOn ? 0x10b981 : 0x064e3b);
              slot.dotMat.color.setHex(blinkOn ? 0x10b981 : 0x064e3b);
              activeSlotLight.intensity = blinkOn ? 2.5 : 0.3;
              activeSlotLight.color.setHex(0x10b981);

              workerLocalPos.copy(scanLocalPos);

              if (ptlState.timer >= blinkDuration) {
                slot.ledMat.color.setHex(0x10b981);
                slot.dotMat.color.setHex(0x10b981);
                activeSlotLight.intensity = 2.0;

                ptlState.stage = 3;
                ptlState.timer = 0;

                // Compute target slot position in-place without allocating new Vector3
                slot.bin.getWorldPosition(_tempVec1);
                ptlGroup.worldToLocal(_tempVec1);
                const toCenterX = -_tempVec1.x;
                const toCenterZ = -_tempVec1.z;
                const len = Math.hypot(toCenterX, toCenterZ) || 1;
                ptlState.targetSlotWorldPos.set(
                  _tempVec1.x + (toCenterX / len) * 2.2,
                  0,
                  _tempVec1.z + (toCenterZ / len) * 2.2
                );
              }
              break;
            }

            case 3: {
              const walkDur = 1.2;
              const startPos = scanLocalPos;
              const endPos = ptlState.targetSlotWorldPos;

              const p = Math.min(1, ptlState.timer / walkDur);
              workerLocalPos.lerpVectors(startPos, endPos, p);
              ptlWorkerGroup.position.y = Math.sin(p * Math.PI * 6) * 0.04;

              const walkDir = _tempVec1.copy(endPos).sub(startPos);
              if (walkDir.lengthSq() > 0.01) {
                ptlWorkerGroup.rotation.y = Math.atan2(walkDir.x, walkDir.z);
              }

              const slot = allSlots[ptlState.currentSlotIdx];
              slot.ledMat.color.setHex(0x10b981);
              activeSlotLight.intensity = 2.0;

              if (p >= 1) {
                ptlState.stage = 4;
                ptlState.timer = 0;
                ptlWorkerGroup.position.y = 0;
              }
              break;
            }

            case 4: {
              const placeDur = 1.0;
              const p = Math.min(1, ptlState.timer / placeDur);
              const slot = allSlots[ptlState.currentSlotIdx];

              slot.bin.getWorldPosition(_tempVec1);
              const localBin = ptlGroup.worldToLocal(_tempVec1);
              const faceDir = _tempVec2.copy(localBin).sub(workerLocalPos);
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
                activeSlotLight.intensity = 1.0;
                activeSlotLight.color.setHex(0xf59e0b);
              }

              if (p >= 1) {
                wArmL.rotation.x = 0;
                wArmR.rotation.x = 0;
                slot.ledMat.color.setHex(0x334155);
                slot.dotMat.color.setHex(0x334155);
                activeSlotLight.intensity = 0;

                ptlState.stage = 5;
                ptlState.timer = 0;
              }
              break;
            }

            case 5: {
              const walkDur = 1.0;
              const startPos = ptlState.targetSlotWorldPos;
              const endPos = trolleyLocalPos;

              const p = Math.min(1, ptlState.timer / walkDur);
              workerLocalPos.lerpVectors(startPos, endPos, p);
              ptlWorkerGroup.position.y = Math.sin(p * Math.PI * 6) * 0.04;

              const walkDir = _tempVec1.copy(endPos).sub(startPos);
              if (walkDir.lengthSq() > 0.01) {
                ptlWorkerGroup.rotation.y = Math.atan2(walkDir.x, walkDir.z);
              }

              if (p >= 1) {
                ptlWorkerGroup.position.y = 0;
                ptlWorkerGroup.rotation.y = 0;

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

        // Interacting with box or Mezzanine Portal (E key)
        interactCooldown -= delta;
        if (keys['e'] && interactCooldown <= 0) {
          interactCooldown = 0.5;
          const game = gameRef.current;

          // Check if near Mezzanine elevator portal without carrying a crate
          if (isNearMezzanineRef.current && !game.carried) {
            setCameraMode((p) => {
              const next = p === 'command' ? 'third' : 'command';
              if (next === 'command') setCommandView('screen');
              return next;
            });
            if (cameraModeRef.current === 'command') {
              showMessage('🚜 Returned to Forklift Rover');
            }
            return;
          }

          _forkTipVec.set(0, 0.6, 3).applyMatrix4(forklift.matrixWorld);

          if (!game.carried) {
            let nearest = null;
            let nearDist = 6.5;
            interactableBoxes.forEach((boxGroup) => {
              if (boxGroup.userData.pickedUp) return;
              const d = _forkTipVec.distanceTo(boxGroup.position);
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

            // Calculate where the crate would land in front of the forks
            _forkDropVec.set(0, 0.5, 5).applyMatrix4(forklift.matrixWorld);

            // Check if player or the drop position is in or near ANY delivery zone
            let nearZone = null;
            for (let i = 0; i < deliveryZones.length; i++) {
              const zone = deliveryZones[i];
              const dx = Math.abs(_forkDropVec.x - zone.x);
              const dz = Math.abs(_forkDropVec.z - zone.z);
              const distForklift = Math.hypot(forklift.position.x - zone.x, forklift.position.z - zone.z);
              if ((dx < 5.2 && dz < 5.2) || distForklift < 5.2) {
                nearZone = zone;
                break;
              }
            }

            // STRICT ENFORCEMENT: DO NOT allow different type of cargos to be dropped at drop zone!
            if (nearZone) {
              const isMatch = (boxColor.id === nearZone.colorType.id) || (boxColor.name === nearZone.colorType.name);
              if (!isMatch) {
                // Reject drop completely! Keep cargo on forklift
                showMessage(`🚫 Wrong Zone! Requires ${nearZone.colorType.shortName}`);
                return;
              }
            }

            forklift.remove(boxMesh);

            boxMesh.position.set(0, 0, 0);
            boxMesh.rotation.set(0, 0, 0);
            containerGroup.add(boxMesh);
            containerGroup.position.set(_forkDropVec.x, 0, _forkDropVec.z);
            scene.add(containerGroup);

            game.carried = null;
            game.carriedGroup = null;
            setCarried(false);
            setCarriedColor(null);

            let delivered = false;
            if (nearZone) {
              const zone = nearZone;
              const isMatch = (boxColor.id === zone.colorType.id) || (boxColor.name === zone.colorType.name);
              if (isMatch) {
                delivered = true;
                const currentOrder = SHIFT_ORDERS[shiftIndexRef.current];
                const isShiftObjective = currentOrder && (
                  boxColor.id === currentOrder.targetColor.id ||
                  boxColor.name === currentOrder.targetColor.name
                );

                // Specific check for Madrid Gate International Departure!
                if (zone.colorType.id === 'madrid') {
                  playForkliftHorn();
                  if (madridGateDataRef.current) {
                    const mg = madridGateDataRef.current;
                    mg.isCustomsCleared = true;
                    mg.departureTimer = 4.5;
                    mg.departingCrateGroup = containerGroup;
                    containerGroup.position.set(24, 0.7, 62);
                    if (mg.customsHoloMat) {
                      mg.customsHoloMat.opacity = 0.85;
                    }
                  }

                  const ptsAwarded = 500;
                  game.score += ptsAwarded;
                  setScore(game.score);

                  if (isShiftObjective) {
                    handleCompleteShiftOrder(currentOrder);
                  }

                  setActiveMilestone({
                    icon: '✈️',
                    badge: '🇪🇸 MADRID GATE — CUSTOMS CLEARED',
                    milestoneTitle: 'MADRID INTERNATIONAL DISPATCH BAY',
                    milestoneStat: '2.5 Months On-Site (Spain) • Cross-Border EU Hub',
                    milestoneStory: 'Honoring 2.5 months on-site in Madrid, Spain: managed high-throughput European cross-border sortation systems, automated logistics software, and last-mile dispatch.',
                    tech: ['Madrid, Spain', 'On-Site Deployment', 'European Logistics', 'High-throughput Systems', 'REST APIs'],
                    points: ptsAwarded,
                  });
                  showMessage('✈️ CUSTOMS CLEARED! 🇪🇸 Madrid International Cargo Dispatched (+500 PTS)!');
                } else if (zone.colorType.id === 'riyadh') {
                  playForkliftHorn();
                  if (riyadhGateDataRef.current) {
                    const rg = riyadhGateDataRef.current;
                    rg.isCustomsCleared = true;
                    rg.departureTimer = 4.5;
                    rg.departingCrateGroup = containerGroup;
                    containerGroup.position.set(-24, 0.7, 62);
                    if (rg.customsHoloMat) {
                      rg.customsHoloMat.opacity = 0.85;
                    }
                  }

                  const ptsAwarded = 500;
                  game.score += ptsAwarded;
                  setScore(game.score);

                  if (isShiftObjective) {
                    handleCompleteShiftOrder(currentOrder);
                  }

                  setActiveMilestone({
                    icon: '✈️',
                    badge: '🇸🇦 RIYADH GATE — CUSTOMS CLEARED',
                    milestoneTitle: 'RIYADH INTERNATIONAL DISPATCH BAY',
                    milestoneStat: 'King Khalid Cargo Hub • Middle East Fulfillment',
                    milestoneStory: 'Deployed and remotely tested high-throughput Put-to-Light (PTL) and conveyor automation systems supporting B2B and B2C fulfillment operations for a leading Middle Eastern apparel brand.',
                    tech: ['Middle East Logistics', 'Riyadh, KSA', 'PTL Sortation', 'B2B & B2C workflows', 'REST APIs'],
                    points: ptsAwarded,
                  });
                  showMessage('✈️ CUSTOMS CLEARED! 🇸🇦 Riyadh Middle East Cargo Dispatched (+500 PTS)!');
                } else if (isShiftObjective) {
                  game.score += currentOrder.points;
                  setScore(game.score);
                  handleCompleteShiftOrder(currentOrder);
                  containerGroup.userData.pickedUp = false;
                  containerGroup.position.set(-40 + Math.random() * 80, 0, -35 + Math.random() * 70);
                } else {
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
                  containerGroup.userData.pickedUp = false;
                  containerGroup.position.set(-40 + Math.random() * 80, 0, -35 + Math.random() * 70);
                }
              }
            }
            if (!delivered) {
              containerGroup.userData.pickedUp = false;
              showMessage(`📦 Unloaded container on floor. Drive to matching ${boxColor.subIcon || boxColor.icon} ${boxColor.zoneName} for Resume reveal!`);
            }
          }
        }

        // Movement & Collision (Zero Vector3 allocations)
        const prevX = forklift.position.x;
        const prevZ = forklift.position.z;

        if (Math.abs(forkliftState.speed) > 0.001) {
          const moveDir = Math.sign(forkliftState.speed);
          forklift.rotation.y += forkliftState.rotSpeed * moveDir;
        } else if (forkliftState.rotSpeed !== 0) {
          forklift.rotation.y += forkliftState.rotSpeed * 0.75;
        }

        forklift.position.x += Math.sin(forklift.rotation.y) * forkliftState.speed;
        forklift.position.z += Math.cos(forklift.rotation.y) * forkliftState.speed;

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
        if (cameraModeRef.current !== 'command') {
          if (!speedFillEl) speedFillEl = document.getElementById('speed-fill');
          if (speedFillEl) {
            const pct = (Math.abs(forkliftState.speed) / forkliftState.maxSpeed) * 100;
            speedFillEl.style.width = pct + '%';
          }
        } else {
          speedFillEl = null;
        }

        // Beacon animation
        beacon.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 6) * 0.5;

        const carriedCrate = gameRef.current.carried && gameRef.current.carriedGroup
          ? gameRef.current.carriedGroup.userData.colorType
          : null;

        // ─── 🚚 Animate Docked Truck Workers & Active Loading Operation ───
        if (madridGateDataRef.current) {
          const mg = madridGateDataRef.current;

          // Door stays permanently open above aperture (never closes)
          mg.doorTargetY = 18.0;
          mg.doorMesh.position.y = 18.0;
          mg.greenMat.color.setHex(0x10b981);
          mg.redMat.color.setHex(0x334155);
          if (mg.beaconMat) {
            mg.beaconMat.emissiveIntensity = 0.6 + Math.sin(elapsed * 3.5) * 0.3;
          }

          // Worker 1: Stacking and setting up boxes inside truck
          if (mg.worker1) {
            mg.worker1.torsoGroup.rotation.x = Math.sin(elapsed * 2.2) * 0.18;
            mg.worker1.torsoGroup.rotation.y = -0.3 + Math.sin(elapsed * 1.5) * 0.24;
            mg.worker1.group.position.y = 0.12 + Math.max(0, Math.sin(elapsed * 2.2) * 0.04);
          }

          // Worker 2: Guiding pallet jack with cargo into truck
          if (mg.worker2) {
            mg.worker2.torsoGroup.rotation.y = Math.sin(elapsed * 1.4) * 0.08;
            mg.worker2.torsoGroup.rotation.x = 0.08 + Math.sin(elapsed * 1.8) * 0.04;
          }

          // Worker 3: Checking manifest with clipboard deep in truck
          if (mg.worker3) {
            mg.worker3.torsoGroup.rotation.x = -0.12 + Math.sin(elapsed * 1.0) * 0.09;
            mg.worker3.torsoGroup.rotation.y = 0.4 + Math.sin(elapsed * 0.8) * 0.15;
          }

          // Animate delivered cargo gliding through dock ramp into the trailer
          if (mg.isCustomsCleared) {
            if (mg.departingCrateGroup) {
              mg.departingCrateGroup.position.z += delta * 6.0;
              if (mg.departingCrateGroup.position.z > 84.0) {
                // Safely loaded into truck! Respawn in warehouse
                mg.departingCrateGroup.userData.pickedUp = false;
                mg.departingCrateGroup.position.set(-40 + Math.random() * 80, 0, -35 + Math.random() * 70);
                mg.departingCrateGroup = null;
              }
            }

            mg.departureTimer -= delta;
            if (mg.departureTimer <= 0) {
              mg.isCustomsCleared = false;
            }
          }
        }

        if (riyadhGateDataRef.current) {
          const rg = riyadhGateDataRef.current;

          // Door stays permanently open above aperture (never closes)
          rg.doorTargetY = 18.0;
          rg.doorMesh.position.y = 18.0;
          rg.greenMat.color.setHex(0x10b981);
          rg.redMat.color.setHex(0x334155);
          if (rg.beaconMat) {
            rg.beaconMat.emissiveIntensity = 0.6 + Math.sin(elapsed * 3.5 + 1.2) * 0.3;
          }

          // Worker 1: Stacking and setting up boxes inside truck
          if (rg.worker1) {
            rg.worker1.torsoGroup.rotation.x = Math.sin(elapsed * 2.1 + 0.8) * 0.18;
            rg.worker1.torsoGroup.rotation.y = -0.3 + Math.sin(elapsed * 1.6 + 0.5) * 0.24;
            rg.worker1.group.position.y = 0.12 + Math.max(0, Math.sin(elapsed * 2.1 + 0.8) * 0.04);
          }

          // Worker 2: Guiding pallet jack with cargo into truck
          if (rg.worker2) {
            rg.worker2.torsoGroup.rotation.y = Math.sin(elapsed * 1.3 + 0.3) * 0.08;
            rg.worker2.torsoGroup.rotation.x = 0.08 + Math.sin(elapsed * 1.7 + 0.6) * 0.04;
          }

          // Worker 3: Checking manifest with clipboard deep in truck
          if (rg.worker3) {
            rg.worker3.torsoGroup.rotation.x = -0.12 + Math.sin(elapsed * 1.1 + 0.4) * 0.09;
            rg.worker3.torsoGroup.rotation.y = 0.4 + Math.sin(elapsed * 0.7 + 0.7) * 0.15;
          }

          // Animate delivered cargo gliding through dock ramp into the trailer
          if (rg.isCustomsCleared) {
            if (rg.departingCrateGroup) {
              rg.departingCrateGroup.position.z += delta * 6.0;
              if (rg.departingCrateGroup.position.z > 84.0) {
                // Safely loaded into truck! Respawn in warehouse
                rg.departingCrateGroup.userData.pickedUp = false;
                rg.departingCrateGroup.position.set(-40 + Math.random() * 80, 0, -35 + Math.random() * 70);
                rg.departingCrateGroup = null;
              }
            }

            rg.departureTimer -= delta;
            if (rg.departureTimer <= 0) {
              rg.isCustomsCleared = false;
            }
          }
        }

        // Animate Interactable Box Indicators
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

        // Collectible Orbs
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

        // Delivery Zones Dynamic Proximity & Floating Chevron Highlights (Zero allocations, No glowy rings)
        let inDropProximity = false;
        let mismatchedZoneNearby = null;

        deliveryZones.forEach((zone) => {
          const distToZone = Math.hypot(forklift.position.x - zone.x, forklift.position.z - zone.z);
          const isMatchingTarget = carriedCrate && (zone.colorType.id === carriedCrate.id);
          const isReadyToDrop = distToZone < 4.8 && isMatchingTarget;
          const isMismatchNearby = carriedCrate && !isMatchingTarget && distToZone < 5.2;

          if (isMismatchNearby) {
            mismatchedZoneNearby = zone;
          }

          const isSpecialGate = zone.colorType.id === 'madrid' || zone.colorType.id === 'riyadh';
          zone.chevronGroup.rotation.y = elapsed * (isMatchingTarget ? 4.0 : 1.5);
          const baseChevronY = isSpecialGate ? (isMatchingTarget ? 1.5 : 2.4) : (isMatchingTarget ? 2.5 : 3.8);
          zone.chevronGroup.position.y = baseChevronY + Math.sin(elapsed * (isMatchingTarget ? 8.0 : 3.0)) * 0.4;

          if (isReadyToDrop) {
            inDropProximity = true;
            updateHeaderProximity(zone.readyLabelSprite, true, delta, { x: 10.0, y: 1.53 });
            updateHeaderProximity(zone.targetLabelSprite, false, delta, { x: 11.5, y: 1.76 });
            zone.defaultLabelSprite.visible = false;
          } else if (isMatchingTarget) {
            updateHeaderProximity(zone.targetLabelSprite, true, delta, { x: 11.5, y: 1.76 });
            updateHeaderProximity(zone.readyLabelSprite, false, delta, { x: 10.0, y: 1.53 });
            zone.defaultLabelSprite.visible = true;
            zone.defaultLabelSprite.scale.set(11.5, 1.76, 1);
          } else {
            updateHeaderProximity(zone.targetLabelSprite, false, delta, { x: 11.5, y: 1.76 });
            updateHeaderProximity(zone.readyLabelSprite, false, delta, { x: 10.0, y: 1.53 });
            zone.defaultLabelSprite.visible = true;
            zone.defaultLabelSprite.scale.set(9.8, 1.5, 1);
          }
        });

        if (inDropProximity !== canDropRef.current) {
          canDropRef.current = inDropProximity;
          setCanDrop(inDropProximity);
        }

        const mismatchId = mismatchedZoneNearby ? mismatchedZoneNearby.colorType.id : null;
        const currentMismatchId = mismatchedZoneRef.current ? mismatchedZoneRef.current.colorType.id : null;
        if (mismatchId !== currentMismatchId) {
          mismatchedZoneRef.current = mismatchedZoneNearby;
          setMismatchedZone(mismatchedZoneNearby);
        }

        // Real-Time Radar Minimap Canvas Rendering (Cached DOM + Throttled to 30 FPS)
        if (cameraModeRef.current !== 'command') {
          if (!radarCanvas) {
            radarCanvas = document.getElementById('wh-radar-canvas');
            radarCoordsEl = document.getElementById('wh-radar-coords');
          }
          if (radarCoordsEl && (elapsed - lastCoordUpdate > 0.08)) {
            lastCoordUpdate = elapsed;
            const curX = Math.round(forklift.position.x);
            const curZ = Math.round(forklift.position.z);
            if (curX !== lastCoordX || curZ !== lastCoordZ) {
              lastCoordX = curX;
              lastCoordZ = curZ;
              radarCoordsEl.textContent = `X:${curX} Z:${curZ}`;
            }
          }
          if (radarCanvas && (elapsed - radarLastDrawn >= 0.033)) {
            radarLastDrawn = elapsed;
            const rCtx = radarCanvas.getContext('2d');
            const rw = radarCanvas.width;
            const rh = radarCanvas.height;

            rCtx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            rCtx.fillRect(0, 0, rw, rh);

            rCtx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
            rCtx.lineWidth = 1;
            for (let gx = 20; gx < rw; gx += 30) {
              rCtx.beginPath(); rCtx.moveTo(gx, 0); rCtx.lineTo(gx, rh); rCtx.stroke();
            }
            for (let gy = 20; gy < rh; gy += 30) {
              rCtx.beginPath(); rCtx.moveTo(0, gy); rCtx.lineTo(rw, gy); rCtx.stroke();
            }

            rCtx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
            rCtx.strokeRect(6, 6, rw - 12, rh - 12);

            const toRadarX = (wx) => ((wx + 105) / 210) * (rw - 24) + 12;
            const toRadarY = (wz) => ((wz + 70) / 140) * (rh - 24) + 12;

            deliveryZones.forEach((z) => {
              const zx = toRadarX(z.x);
              const zy = toRadarY(z.z);
              const isTarget = carriedCrate && (z.colorType.id === carriedCrate.id);

              if (isTarget) {
                const pulseR = 7 + Math.sin(elapsed * 8) * 3.5;
                rCtx.beginPath();
                rCtx.arc(zx, zy, pulseR, 0, Math.PI * 2);
                rCtx.strokeStyle = z.colorType.css;
                rCtx.lineWidth = 2;
                rCtx.stroke();

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

            // Mezzanine Command Center on Radar
            const mezX = toRadarX(0);
            const mezY = toRadarY(-64.5);
            rCtx.fillStyle = 'rgba(6, 182, 212, 0.25)';
            rCtx.strokeStyle = '#06b6d4';
            rCtx.lineWidth = 1;
            rCtx.strokeRect(mezX - 14, mezY - 5, 28, 10);
            rCtx.fillRect(mezX - 14, mezY - 5, 28, 10);
            rCtx.fillStyle = '#06b6d4';
            rCtx.font = 'bold 8px monospace';
            rCtx.textAlign = 'center';
            rCtx.fillText('CMD', mezX, mezY + 3);

            // Riyadh International Gate on Radar (Bay 01 at x=-24, z=73)
            const ruhX = toRadarX(-24);
            const ruhY = toRadarY(73);
            rCtx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            rCtx.strokeStyle = '#10b981';
            rCtx.lineWidth = 1;
            rCtx.strokeRect(ruhX - 10, ruhY - 4, 20, 8);
            rCtx.fillRect(ruhX - 10, ruhY - 4, 20, 8);
            rCtx.fillStyle = '#10b981';
            rCtx.font = 'bold 7px monospace';
            rCtx.textAlign = 'center';
            rCtx.fillText('RUH', ruhX, ruhY + 2.5);

            // Madrid International Gate on Radar (Bay 04 at x=24, z=73)
            const madX = toRadarX(24);
            const madY = toRadarY(73);
            rCtx.fillStyle = 'rgba(245, 158, 11, 0.25)';
            rCtx.strokeStyle = '#f59e0b';
            rCtx.lineWidth = 1;
            rCtx.strokeRect(madX - 10, madY - 4, 20, 8);
            rCtx.fillRect(madX - 10, madY - 4, 20, 8);
            rCtx.fillStyle = '#f59e0b';
            rCtx.font = 'bold 7px monospace';
            rCtx.textAlign = 'center';
            rCtx.fillText('MAD', madX, madY + 2.5);

            interactableBoxes.forEach((b) => {
              if (!b.userData.pickedUp) {
                const bx = toRadarX(b.position.x);
                const by = toRadarY(b.position.z);
                rCtx.fillStyle = b.userData.colorType.css;
                rCtx.fillRect(bx - 2, by - 2, 4, 4);
              }
            });

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
        } else {
          radarCanvas = null;
          radarCoordsEl = null;
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

        const targetBg = night ? _nightBg : _dayBg;
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
          const isPlayerNearby = distToPlayer < 7.0;

          if (isPlayerNearby) {
            bot.isStopped = true;
            const flash = Math.sin(elapsed * 16) > 0 ? 2.5 : 0.2;
            bot.beaconMat.color.setHex(0xef4444);
            bot.beaconMat.emissive.setHex(0xef4444);
            bot.beaconMat.emissiveIntensity = flash;
            bot.ledMat.color.setHex(0xef4444);
          } else {
            bot.isStopped = false;
            bot.beaconMat.color.setHex(0xf59e0b);
            bot.beaconMat.emissive.setHex(0xf59e0b);
            bot.beaconMat.emissiveIntensity = 0.8;
            bot.ledMat.color.setHex(0x38bdf8);

            const targetWp = bot.waypoints[bot.currentWaypointIdx];
            _tempVec1.set(targetWp[0], 0, targetWp[1]);
            const dir = _tempVec2.copy(_tempVec1).sub(botPos);
            const distToWp = dir.length();

            if (distToWp < 0.8) {
              bot.currentWaypointIdx = (bot.currentWaypointIdx + 1) % bot.waypoints.length;
            } else {
              dir.normalize();
              const moveStep = Math.min(distToWp, bot.speed * delta);
              botPos.add(dir.multiplyScalar(moveStep));

              const targetAngle = Math.atan2(dir.x, dir.z);
              let diff = (targetAngle - bot.group.rotation.y) % (Math.PI * 2);
              if (diff < -Math.PI) diff += Math.PI * 2;
              if (diff > Math.PI) diff -= Math.PI * 2;
              bot.group.rotation.y += diff * Math.min(1, delta * 10);
            }
          }
        });

        // ─── Mezzanine Control Room & Simulated Live Telemetry Updates ───
        if (mezzanineData) {
          // Subtle rotation of holographic ring & 3D wireframe core in control room
          if (mezzanineData.holoRing) mezzanineData.holoRing.rotation.z = elapsed * 1.5;
          if (mezzanineData.holoCore) {
            mezzanineData.holoCore.rotation.x = elapsed * 1.2;
            mezzanineData.holoCore.rotation.y = elapsed * 1.8;
          }

          // Quantum Holographic Elevator Column: Animated Rising Energy Rings
          if (mezzanineData.liftRings) {
            mezzanineData.liftRings.forEach((ring, idx) => {
              const ringY = ((elapsed * 2.8 + idx * 1.85) % 7.4) + 0.2;
              ring.position.y = ringY;
              const p = (ringY - 0.2) / 7.4;
              ring.material.opacity = Math.sin(p * Math.PI) * 0.75;
            });
          }

          // Gentle rhythmic warning pulse for corner beacons (smooth sine wave, zero flicker)
          if (mezzanineData.beaconMats) {
            const beaconPulse = 0.8 + Math.sin(elapsed * 3.0) * 0.45;
            mezzanineData.beaconMats.forEach((mat) => { mat.emissiveIntensity = beaconPulse; });
          }

          // Pulse ground elevator portal pad ring
          if (mezzanineData.portalRing) {
            const pScale = 1.0 + Math.sin(elapsed * 3) * 0.12;
            mezzanineData.portalRing.scale.set(pScale, pScale, 1);
          }

          // Proximity detection for elevator portal pad
          const distToMez = forklift.position.distanceTo(mezzanineData.portalPos);
          const isNearMez = distToMez < 6.5;
          if (isNearMezzanineRef.current !== isNearMez) {
            isNearMezzanineRef.current = isNearMez;
            setIsNearMezzanine(isNearMez);
          }
          if (mezzanineData.accessSign) {
            updateHeaderProximity(mezzanineData.accessSign, isNearMez, delta, { x: 9.0, y: 1.8 });
          }

          // Simulated live telemetry tick every ~1.6s
          if (elapsed - lastMezzanineTick > 1.6) {
            lastMezzanineTick = elapsed;
            liveParcelsCount += Math.floor(Math.random() * 3 + 1);

            // Dynamic industrial PLC latency fluctuation between 50ms and 200ms
            const wave = Math.sin(elapsed * 1.5) * 60;
            const jitter = Math.floor(Math.random() * 30 - 15);
            const currentLatency = Math.min(200, Math.max(50, Math.round(125 + wave + jitter)));

            updateMezzanineTelemetryCanvas(mezzanineData.telemetryCanvas, liveParcelsCount, elapsed, currentLatency);
            mezzanineData.telemetryTexture.needsUpdate = true;
            setLiveParcels(liveParcelsCount);
            setPlcLatency(currentLatency);
          }
        }

        // Camera follow (zero GC allocations)
        const mode = cameraModeRef.current;
        if (mode === 'third') {
          cabin.visible = true;
          roof.visible = true;
          windshield.visible = true;
          beacon.visible = true;
          _camOffset.set(0, 14, -22).applyAxisAngle(_upAxis, forklift.rotation.y);
          _targetPos.copy(forklift.position).add(_camOffset);
          camera.position.lerp(_targetPos, 0.08);
          _lookTarget.copy(forklift.position);
          _lookTarget.y += 3;
          camera.lookAt(_lookTarget);
        } else if (mode === 'command') {
          cabin.visible = true;
          roof.visible = true;
          windshield.visible = true;
          beacon.visible = true;
          const cView = commandViewRef.current;
          if (cView === 'window') {
            // Looking out panoramic window over the warehouse floor
            _targetPos.set(0, 11.2, -61.0);
            camera.position.lerp(_targetPos, 0.06);
            _lookTarget.set(0, 3.5, 15);
            camera.lookAt(_lookTarget);
          } else {
            // Default: Look directly at the Giant LED Telemetry Wall inside the Command Center
            _targetPos.set(0, 11.0, -60.2);
            camera.position.lerp(_targetPos, 0.06);
            _lookTarget.set(0, 11.2, -74.2);
            camera.lookAt(_lookTarget);
          }
        } else {
          // First-person POV: Hide cabin & roof to ensure zero occlusion
          cabin.visible = false;
          roof.visible = false;
          windshield.visible = false;
          beacon.visible = false;
          // Rigidly sync camera position without lag so full speed cannot drag camera backwards into meshes
          _fpOffset.set(0, 3.2, 0.9).applyAxisAngle(_upAxis, forklift.rotation.y);
          _targetPos.copy(forklift.position).add(_fpOffset);
          camera.position.copy(_targetPos);
          _lookDir.set(0, 2.7, 10).applyAxisAngle(_upAxis, forklift.rotation.y);
          _lookTarget.copy(forklift.position).add(_lookDir);
          camera.lookAt(_lookTarget);
        }
        camera.updateMatrixWorld();

        // Real-Time GPS Compass & Distance Pill (Cached DOM + Throttled)
        if (cameraModeRef.current !== 'command') {
          if (!gpsNavEl) {
            gpsNavEl = document.getElementById('wh-gps-nav');
            gpsArrowEl = document.getElementById('wh-gps-arrow');
            gpsIconEl = document.getElementById('wh-gps-icon');
            gpsDistEl = document.getElementById('wh-gps-dist');
          }

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
            if (elapsed - lastGpsUpdate > 0.033) {
              lastGpsUpdate = elapsed;
              const dx = navTarget.x - forklift.position.x;
              const dz = navTarget.z - forklift.position.z;
              const distMeters = Math.round(Math.hypot(dx, dz));

              const rotY = forklift.rotation.y;
              const forwardDist = dx * Math.sin(rotY) + dz * Math.cos(rotY);
              const rightDist = -dx * Math.cos(rotY) + dz * Math.sin(rotY);

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
            }
          } else if (gpsNavEl) {
            gpsNavEl.style.display = 'none';
          }
        } else {
          gpsNavEl = null;
          gpsArrowEl = null;
          gpsIconEl = null;
          gpsDistEl = null;
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

      // Full scene traversal cleanup to prevent VRAM memory leaks
      if (sceneRef.current?.scene) {
        sceneRef.current.scene.traverse((obj) => {
          if (obj.geometry) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              if (obj.isSprite && m.map) {
                m.map.dispose();
              }
              m.dispose();
            });
          }
        });
      }

      if (renderer) {
        renderer.dispose();
        if (mount && renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      }
    };
  }, [showMessage, revealControlsBriefly, handleCompleteShiftOrder]);

  const toggleCamera = () => setCameraMode((p) => (p === 'third' ? 'first' : p === 'first' ? 'command' : 'third'));
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
      setMismatchedZone(null);
      canDropRef.current = false;
      mismatchedZoneRef.current = null;
    }
    game.score = 0;
    setScore(0);
    restartShift();
    showMessage('🔄 Position & Shift Reset!');
  };

  const currentOrder = SHIFT_ORDERS[shiftIndex] || null;

  return (
    <div className={`warehouse-page ${cameraMode === 'command' ? 'warehouse-page--command' : ''}`}>
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
              <span><kbd>H</kbd> Horn</span>
              <span>•</span>
              <span><kbd>C</kbd> Camera</span>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {message && cameraMode !== 'command' && <div className="warehouse-toast">{message}</div>}

      {/* Top-Right Header Bar (Score & Back to Portfolio) */}
      <div className="warehouse-top-right">
        {/* Score Counter Badge */}
        {cameraMode !== 'command' && (
          <div className="warehouse-score">
            <span className="warehouse-score__icon">⭐</span>
            <div className="warehouse-score__details">
              <span className="warehouse-score__value">{score}</span>
              <span className="warehouse-score__label">POINTS</span>
            </div>
          </div>
        )}

        {/* Back to Portfolio Link */}
        <a href="/" className="warehouse-back-btn">
          ← Back to Portfolio
        </a>
      </div>

      {/* Real-Time Compact GPS Compass & Distance Pill */}
      {cameraMode !== 'command' && (
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
      )}

      {/* Warehouse Radar Minimap */}
      {cameraMode !== 'command' && (
        <div className="warehouse-minimap-container">
          <div className="warehouse-minimap-header">
            <span>📡 FACILITY RADAR</span>
            <span className="warehouse-minimap-coords" id="wh-radar-coords">X:0 Z:0</span>
          </div>
          <canvas id="wh-radar-canvas" width="190" height="130" className="warehouse-radar-canvas" />
          <div className="warehouse-minimap-legend">
            <span>🟣 .NET</span>
            <span style={{ color: '#f59e0b' }}>✈️ MAD</span>
            <span style={{ color: '#60a5fa' }}>⚙️ PLC</span>
            <span>🐇 MQ</span>
            <span style={{ color: '#10b981' }}>📦 PTL</span>
            <span style={{ color: '#34d399' }}>✈️ RUH</span>
          </div>
        </div>
      )}

      {/* HUD Overlay */}
      {cameraMode !== 'command' && (
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
              <button className="warehouse-hud__cam-btn" onClick={toggleCamera} title="Cycle Camera Views (C)">
                {cameraMode === 'third' ? '👁 Third' : cameraMode === 'first' ? '🎯 First' : '📊 Mezzanine'}
              </button>
            </div>
            <div className="warehouse-hud__key-group">
              <span className="warehouse-hud__label">Horn</span>
              <button className="warehouse-hud__cam-btn" onClick={playForkliftHorn} title="Honk Industrial Horn (H)">
                📯 Honk [H]
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
                  <span className="warehouse-shift-card__order-num">ORDER {shiftIndex + 1}/{SHIFT_ORDERS.length}</span>
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
      )}

      {/* On-screen Objective HUD Banner */}
      {cameraMode !== 'command' && (
        <div className={`warehouse-objective ${canDrop ? 'warehouse-objective--ready' : (mismatchedZone ? 'warehouse-objective--mismatch' : (carried ? 'warehouse-objective--deliver' : ''))}`}>
          <span className="warehouse-objective__icon">{canDrop ? '✅' : (mismatchedZone ? '🚫' : (carried ? (carriedColor?.subIcon || carriedColor?.icon || '📦') : '📦'))}</span>
          <span className="warehouse-objective__text">
            {canDrop ? (
              <>READY TO UNLOAD! Press <kbd>E</kbd> to deliver {carriedColor?.title || carriedColor?.name}</>
            ) : mismatchedZone ? (
              <>WRONG ZONE — Requires {mismatchedZone.colorType.shortName}</>
            ) : carried ? (
              carriedColor?.id === currentOrder?.targetColor.id ? (
                <>MATCHING SHIFT CRATE! Deliver {carriedColor?.subIcon || carriedColor?.icon} <strong style={{ color: carriedColor?.css }}>{carriedColor?.title || carriedColor?.name}</strong> to {carriedColor?.zoneName} to unlock Experience!</>
              ) : (
                <>OBJECTIVE: Deliver {carriedColor?.subIcon || carriedColor?.icon} <strong style={{ color: carriedColor?.css }}>{carriedColor?.title || carriedColor?.name}</strong> to {carriedColor?.zoneName}!</>
              )
            ) : currentOrder ? (
              <>ORDER #{currentOrder.id}/{SHIFT_ORDERS.length}: Pick up {currentOrder.targetColor.subIcon || currentOrder.targetColor.icon} <strong style={{ color: currentOrder.targetColor.css }}>{currentOrder.targetColor.title}</strong> & deliver to {currentOrder.targetColor.zoneName}</>
            ) : (
              <>TECH CRATES: Pick up any branded container (🟣 🟠 🔵 🟡 🟢) & deliver to matching zone to unlock Resume details!</>
            )}
          </span>
        </div>
      )}

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
              Congratulations! You have successfully mastered all 6 core automated warehouse systems: from high-speed .NET sortation engines and Madrid & Riyadh international cross-border hubs to low-latency PLC hardware layers, RabbitMQ event buses, and Put-to-Light stations.
            </p>
            <div className="warehouse-milestone-card__footer">
              <a
                href={RESUME_URL}
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


      {/* Mezzanine Ground Entrance Prompt */}
      {isNearMezzanine && cameraMode !== 'command' && (
        <div
          className="warehouse-mezzanine-prompt"
          onClick={() => {
            setCameraMode('command');
            setCommandView('screen');
          }}
        >
          <span className="warehouse-mezzanine-prompt__icon">📊</span>
          <span className="warehouse-mezzanine-prompt__text">
            ELEVATED MEZZANINE CONTROL ROOM • Press <kbd>E</kbd> to Enter
          </span>
        </div>
      )}

      {/* ── Elevated Mezzanine Command Center Terminal HUD ── */}
      {cameraMode === 'command' && (
        <div className="warehouse-command-terminal">
          <div className="warehouse-command-terminal__header">
            <div className="warehouse-command-terminal__title-row">
              <span className="warehouse-command-terminal__badge">
                <span className="warehouse-command-terminal__pulse" />
                SIMULATED LIVE TELEMETRY
              </span>
              <span className="warehouse-command-terminal__sub">ELEVATED MEZZANINE CONTROL ROOM</span>
            </div>
            <div className="warehouse-command-terminal__status">
              <span className="warehouse-command-terminal__stat-pill">PARCELS: <strong>{liveParcels.toLocaleString()}</strong></span>
              <span className="warehouse-command-terminal__stat-pill">
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: plcLatency > 0 ? '#10b981' : '#ef4444',
                    boxShadow: plcLatency > 0 ? '0 0 6px #10b981' : '0 0 6px #ef4444',
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                PLC: <strong style={{ color: plcLatency > 0 ? '#10b981' : '#ef4444' }}>{plcLatency} ms</strong>
              </span>
              <button
                className="warehouse-command-terminal__view-btn"
                onClick={() => setCommandView((v) => (v === 'screen' ? 'window' : 'screen'))}
                title="Toggle View (V)"
              >
                {commandView === 'screen' ? '🪟 Look Out Window [V]' : '🖥️ Look at Screen [V]'}
              </button>
              <button
                className="warehouse-command-terminal__close-btn"
                onClick={() => setCameraMode('third')}
                title="Return to Forklift Rover (ESC)"
              >
                ✕ Exit [ESC]
              </button>
            </div>
          </div>

          {/* Interactive Actions Dock */}
          <div className="warehouse-command-actions">
            <a
              href={RESUME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="warehouse-command-btn warehouse-command-btn--resume"
              onClick={() => trackEvent('command_terminal_resume_clicked')}
            >
              <span className="warehouse-command-btn__icon">📄</span>
              <div className="warehouse-command-btn__text">
                <strong>Download Resume (PDF)</strong>
                <small>View Lead Systems Architect Credentials</small>
              </div>
            </a>

            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="warehouse-command-btn warehouse-command-btn--linkedin"
              onClick={() => trackEvent('command_terminal_linkedin_clicked')}
            >
              <span className="warehouse-command-btn__icon">💼</span>
              <div className="warehouse-command-btn__text">
                <strong>Visit LinkedIn Profile</strong>
                <small>Connect with Fahad Eqbal Hashmi</small>
              </div>
            </a>

            <button
              className="warehouse-command-btn warehouse-command-btn--return"
              onClick={() => setCameraMode('third')}
            >
              <span className="warehouse-command-btn__icon">🚜</span>
              <div className="warehouse-command-btn__text">
                <strong>Return to Rover</strong>
                <small>Resume Forklift Driving [ESC]</small>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Speed Indicator */}
      {cameraMode !== 'command' && (
        <div className="warehouse-speed">
          <div className="warehouse-speed__label">FORKLIFT</div>
          <div className="warehouse-speed__bar">
            <div className="warehouse-speed__fill" id="speed-fill" />
          </div>
        </div>
      )}
    </div>
  );
}
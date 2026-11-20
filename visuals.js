/**
 * Interactive SVG Visualizers for PPI Handbook Chapter 6
 *   1. renderBurialScene: Live Trench, Surface Load Vehicle (H20 / Cooper E80 / Draggable Boussinesq Wheel),
 *      Boussinesq Stress Cone, Groundwater Table, Soil Embedment, and Live Ovalizing PE Pipe Ring
 *   2. renderDepthSensitivityChart: Clickable Cover-Depth H vs. Earth/Live Load & Ring Deflection Chart
 *   3. renderPipeCutaway: High-Precision Scaled OD/ID/DR Wall Cutaway with +12% Tolerance Band & Hoop Stress
 *   4. renderWprGauge: Radial WPR Derating & 1.5x / 2.0x Surge Ceiling Gauge
 *   5. renderFigure11: Interactive PPI Figure 1-1 Surge Curves (All SDRs + Live Operating Points)
 *   6. renderTempCurves: Ch. 3 Appendix Table A.2 (F_T) & Table B.1.2 (M_E) Temperature Curves
 */
(function (root) {
  'use strict';

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtUnits(val, kind, units) {
    const C = root.PPIEngine.CONSTANTS;
    if (units === 'SI') {
      if (kind === 'psi') return `${(val * C.PSI_TO_KPA).toFixed(1)} kPa`;
      if (kind === 'psi_bar') return `${(val * C.PSI_TO_MPA * 10).toFixed(2)} bar`;
      if (kind === 'psf') return `${(val * C.PSF_TO_KPA).toFixed(2)} kPa`;
      if (kind === 'ft') return `${(val * C.FT_TO_M).toFixed(2)} m`;
      if (kind === 'in') return `${(val * C.IN_TO_MM).toFixed(1)} mm`;
      if (kind === 'fps') return `${(val * C.FPS_TO_MS).toFixed(2)} m/s`;
      if (kind === 'temp') return `${(((val - 32) * 5) / 9).toFixed(1)} °C`;
      if (kind === 'pcf') return `${(val * C.PCF_TO_KNM3).toFixed(1)} kN/m³`;
    }
    if (kind === 'psi' || kind === 'psi_bar') return `${val.toFixed(1)} psi`;
    if (kind === 'psf') return `${Math.round(val).toLocaleString()} psf`;
    if (kind === 'ft') return `${val.toFixed(1)} ft`;
    if (kind === 'in') return `${val.toFixed(2)} in`;
    if (kind === 'fps') return `${val.toFixed(1)} fps`;
    if (kind === 'temp') return `${val.toFixed(1)} °F`;
    if (kind === 'pcf') return `${val.toFixed(0)} pcf`;
    return String(val);
  }

  /**
   * 1. Interactive Buried Pipe & Surface Load Cross-Section (Section 3)
   */
  function renderBurialScene(s3, params, units) {
    const W = 760;
    const H_SVG = 410;
    const groundY = 108;
    const bottomY = 382;
    const cx = 380;

    // Map cover depth (0.5..25 ft) + pipe OD to vertical visual coordinates
    const coverFt = s3.coverDepthFt;
    const pipeOdFt = s3.geometry.odIn / 12;
    // Keep pipe visually clear and large enough to show ovalization & wall thickness
    const pipeR = Math.max(36, Math.min(62, 34 + pipeOdFt * 8));
    const maxCoverVisualPx = 152;
    const minCoverVisualPx = 46;
    const coverPx = minCoverVisualPx + (Math.min(coverFt, 22) / 22) * (maxCoverVisualPx - minCoverVisualPx);

    const crownY = groundY + coverPx;
    const pipeCy = crownY + pipeR;
    const invertY = pipeCy + pipeR;
    const beddingBottomY = Math.min(bottomY - 8, invertY + 26);

    // Wall thickness visual scaling (proportional to 1/DR, clamped for visibility)
    const wallPx = Math.max(4.5, Math.min(pipeR * 0.36, (pipeR * 2) / s3.geometry.effectiveDr * 1.15));

    // Visual ovalization: exaggerate gently (~2.2x) so deflections 1%..10% read clearly
    const deflFrac = Math.min(0.22, (s3.deflectionPct / 100) * 2.2);
    const rx = pipeR * (1 + deflFrac);
    const ry = pipeR * (1 - deflFrac);
    const innerRx = Math.max(10, rx - wallPx);
    const innerRy = Math.max(10, ry - wallPx);

    // Trench width
    const trenchHalfW = Math.max(pipeR + 48, Math.min(210, pipeR * 1.75 + 24));
    const trenchLeft = cx - trenchHalfW;
    const trenchRight = cx + trenchHalfW;

    // Groundwater table position
    const hasWater = s3.waterHeightAboveCrownFt > 0.01;
    const waterRatio = coverFt > 0 ? Math.min(1, s3.waterHeightAboveCrownFt / coverFt) : 0;
    const waterY = crownY - waterRatio * coverPx;

    // Load vehicle X offset (only shifted for Boussinesq wheel mode)
    const isBouss = params.liveLoadType === 'boussinesq';
    const pxPerFtHoriz = 30;
    const offsetFt = isBouss ? (Number(params.wheelOffsetFt) || 0) : 0;
    const loadX = Math.max(120, Math.min(W - 120, cx + offsetFt * pxPerFtHoriz));

    const statusColor = s3.overallPass ? '#16a34a' : '#dc2626';
    const statusSoft = s3.overallPass ? 'rgba(22,163,74,0.16)' : 'rgba(220,38,38,0.18)';

    // Stress cone geometry (radiates from loadX at surface down to crownY)
    const coneTopHalf = params.liveLoadType === 'cooper_e80' ? 54 : (params.liveLoadType === 'h20_rigid' ? 68 : 26);
    const spreadSlope = params.liveLoadType === 'h20_rigid' ? 1.15 : 0.72;
    const coneBotHalf = coneTopHalf + coverPx * spreadSlope;
    const liveIntensity = Math.min(1, s3.liveLoadPsi / 18);

    // Pavement / Roadway surface layer
    let surfaceLayer = '';
    if (params.liveLoadType === 'h20_rigid') {
      surfaceLayer = `
        <rect x="24" y="${groundY - 14}" width="${W - 48}" height="14" fill="rgba(148,163,184,0.55)" stroke="var(--border-strong)" stroke-width="1"/>
        <text x="42" y="${groundY - 3}" font-size="10" font-weight="700" fill="var(--text)">12" RIGID CONCRETE PAVEMENT (PPI Table 3-3)</text>`;
    } else if (params.liveLoadType === 'h20_flexible') {
      surfaceLayer = `
        <rect x="24" y="${groundY - 9}" width="${W - 48}" height="9" fill="rgba(71,85,105,0.55)" stroke="var(--border-strong)" stroke-width="1"/>
        <text x="42" y="${groundY - 14}" font-size="10" font-weight="700" fill="var(--text-muted)">FLEXIBLE / UNPAVED SURFACE (PPI Table 3-4)</text>`;
    } else if (params.liveLoadType === 'cooper_e80') {
      surfaceLayer = `
        <polygon points="${cx - 95},${groundY} ${cx - 72},${groundY - 14} ${cx + 72},${groundY - 14} ${cx + 95},${groundY}" fill="rgba(120,113,108,0.45)" stroke="var(--border-strong)"/>
        <rect x="${cx - 56}" y="${groundY - 21}" width="112" height="7" rx="1.5" fill="rgba(120,76,40,0.75)"/>
        <rect x="${cx - 38}" y="${groundY - 30}" width="7" height="9" fill="#475569"/>
        <rect x="${cx + 31}" y="${groundY - 30}" width="7" height="9" fill="#475569"/>
        <text x="42" y="${groundY - 14}" font-size="10" font-weight="700" fill="var(--text-muted)">RAILROAD BALLAST &amp; TIES (Cooper E80)</text>`;
    } else if (isBouss) {
      surfaceLayer = `
        <line x1="24" y1="${groundY}" x2="${W - 24}" y2="${groundY}" stroke="var(--border-strong)" stroke-width="2"/>
        <text x="42" y="${groundY - 10}" font-size="10" font-weight="700" fill="var(--accent)">BOUSSINESQ POINT LOAD — DRAG WHEEL HORIZONTALLY (r = ${fmtUnits(offsetFt, 'ft', units)})</text>`;
    } else {
      surfaceLayer = `
        <line x1="24" y1="${groundY}" x2="${W - 24}" y2="${groundY}" stroke="var(--border-strong)" stroke-width="2"/>
        <text x="42" y="${groundY - 10}" font-size="10" font-weight="700" fill="var(--text-muted)">NATURAL GRADE (EARTH PRISM LOAD ONLY)</text>`;
    }

    // Vehicle graphic
    let vehicleSvg = '';
    const vBaseY = params.liveLoadType === 'h20_rigid' ? groundY - 14 : (params.liveLoadType === 'h20_flexible' ? groundY - 9 : (params.liveLoadType === 'cooper_e80' ? groundY - 30 : groundY));
    if (params.liveLoadType === 'h20_flexible' || params.liveLoadType === 'h20_rigid') {
      vehicleSvg = `
        <g transform="translate(${cx}, ${vBaseY})">
          <rect x="-64" y="-56" width="92" height="36" rx="4" fill="rgba(11,107,203,0.22)" stroke="var(--accent)" stroke-width="1.8"/>
          <path d="M 28 -48 L 54 -48 L 65 -28 L 65 -16 L 28 -16 Z" fill="rgba(11,107,203,0.32)" stroke="var(--accent)" stroke-width="1.8"/>
          <rect x="34" y="-43" width="20" height="12" rx="2" fill="rgba(255,255,255,0.45)"/>
          <circle cx="-38" cy="-10" r="10" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
          <circle cx="-38" cy="-10" r="3.5" fill="#cbd5e1"/>
          <circle cx="4" cy="-10" r="10" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
          <circle cx="4" cy="-10" r="3.5" fill="#cbd5e1"/>
          <circle cx="46" cy="-10" r="10" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
          <circle cx="46" cy="-10" r="3.5" fill="#cbd5e1"/>
          <text x="-18" y="-40" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text)">AASHTO H20</text>
          <text x="-18" y="-26" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--text-muted)">32 kip Axle</text>
        </g>`;
    } else if (params.liveLoadType === 'cooper_e80') {
      vehicleSvg = `
        <g transform="translate(${cx}, ${vBaseY})">
          <rect x="-56" y="-50" width="112" height="38" rx="6" fill="rgba(180,83,9,0.22)" stroke="#d97706" stroke-width="2"/>
          <rect x="-42" y="-42" width="32" height="14" rx="2" fill="rgba(255,255,255,0.4)"/>
          <rect x="10" y="-42" width="32" height="14" rx="2" fill="rgba(255,255,255,0.4)"/>
          <circle cx="-34" cy="-6" r="7" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/>
          <circle cx="34" cy="-6" r="7" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/>
          <text x="0" y="-15" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text)">COOPER E80 RAIL</text>
        </g>`;
    } else if (isBouss) {
      vehicleSvg = `
        <g id="draggableWheel" data-draggable="wheel" style="cursor: ew-resize;" transform="translate(${loadX}, ${vBaseY})">
          <circle cx="0" cy="-18" r="17" fill="#1e293b" stroke="var(--accent)" stroke-width="2.5"/>
          <circle cx="0" cy="-18" r="7" fill="#cbd5e1"/>
          <line x1="0" y1="-58" x2="0" y2="-38" stroke="var(--accent)" stroke-width="3"/>
          <polygon points="0,-34 -6,-44 6,-44" fill="var(--accent)"/>
          <rect x="-60" y="-82" width="120" height="22" rx="6" fill="var(--bg-surface)" stroke="var(--accent)" stroke-width="1.5"/>
          <text x="0" y="-67" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--accent)">W = ${Number(params.wheelLoadLb || 16000).toLocaleString()} lb</text>
        </g>`;
    }

    // Stress cone + pressure arrows
    let stressConeSvg = '';
    if (s3.liveLoadPsi > 0.02) {
      const topL = loadX - coneTopHalf;
      const topR = loadX + coneTopHalf;
      const botL = Math.max(28, loadX - coneBotHalf);
      const botR = Math.min(W - 28, loadX + coneBotHalf);
      const alphaTop = (0.14 + 0.34 * liveIntensity).toFixed(2);
      const alphaBot = (0.04 + 0.16 * liveIntensity).toFixed(2);
      stressConeSvg = `
        <defs>
          <linearGradient id="stressConeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="${alphaTop}"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="${alphaBot}"/>
          </linearGradient>
        </defs>
        <polygon points="${topL},${groundY} ${topR},${groundY} ${botR},${crownY + 12} ${botL},${crownY + 12}" fill="url(#stressConeGrad)"/>
        <line x1="${topL}" y1="${groundY}" x2="${botL}" y2="${crownY + 12}" stroke="rgba(217,119,6,0.55)" stroke-dasharray="5 4" stroke-width="1.3"/>
        <line x1="${topR}" y1="${groundY}" x2="${botR}" y2="${crownY + 12}" stroke="rgba(217,119,6,0.55)" stroke-dasharray="5 4" stroke-width="1.3"/>`;
    }

    // Soil reaction passive arrows on left & right of pipe (proportional to E')
    const soilArrowScale = Math.min(1, s3.ePrimePsi / 3000);
    const arrowLen = 18 + 26 * soilArrowScale;
    const soilSupportArrows = s3.ePrimePsi > 0 ? `
      <g stroke="var(--accent-2)" stroke-width="2" fill="var(--accent-2)">
        <line x1="${cx - rx - arrowLen - 10}" y1="${pipeCy}" x2="${cx - rx - 8}" y2="${pipeCy}"/>
        <polygon points="${cx - rx - 4},${pipeCy} ${cx - rx - 12},${pipeCy - 4} ${cx - rx - 12},${pipeCy + 4}"/>
        <line x1="${cx + rx + arrowLen + 10}" y1="${pipeCy}" x2="${cx + rx + 8}" y2="${pipeCy}"/>
        <polygon points="${cx + rx + 4},${pipeCy} ${cx + rx + 12},${pipeCy - 4} ${cx + rx + 12},${pipeCy + 4}"/>
      </g>
      <text x="${cx - rx - arrowLen - 14}" y="${pipeCy - 8}" text-anchor="end" font-size="10.5" font-weight="700" fill="var(--accent-2)">E' = ${Math.round(s3.ePrimePsi)} psi</text>
      <text x="${cx - rx - arrowLen - 14}" y="${pipeCy + 6}" text-anchor="end" font-size="9.5" fill="var(--text-muted)">Soil Share ${s3.soilSupportSharePct.toFixed(0)}%</text>
    ` : `
      <text x="${cx - rx - 14}" y="${pipeCy}" text-anchor="end" font-size="10.5" font-weight="700" fill="#dc2626">E' = 0 (Unconstrained)</text>
    `;

    // Vertical crown load arrows
    const crownArrows = `
      <g stroke="#d97706" stroke-width="2" fill="#d97706">
        <line x1="${cx - 24}" y1="${crownY - 26}" x2="${cx - 24}" y2="${crownY - 4}"/>
        <polygon points="${cx - 24},${crownY - 1} ${cx - 28},${crownY - 9} ${cx - 20},${crownY - 9}"/>
        <line x1="${cx}" y1="${crownY - 30}" x2="${cx}" y2="${crownY - 4}"/>
        <polygon points="${cx},${crownY - 1} ${cx - 4},${crownY - 9} ${cx + 4},${crownY - 9}"/>
        <line x1="${cx + 24}" y1="${crownY - 26}" x2="${cx + 24}" y2="${crownY - 4}"/>
        <polygon points="${cx + 24},${crownY - 1} ${cx + 20},${crownY - 9} ${cx + 28},${crownY - 9}"/>
      </g>`;

    // Groundwater overlay
    const waterSvg = hasWater ? `
      <rect x="24" y="${waterY}" width="${W - 48}" height="${bottomY - waterY}" fill="var(--water-fill)"/>
      <line x1="24" y1="${waterY}" x2="${W - 24}" y2="${waterY}" stroke="#0284c7" stroke-width="1.8" stroke-dasharray="7 4"/>
      <polygon points="74,${waterY} 68,${waterY - 9} 80,${waterY - 9}" fill="#0284c7"/>
      <text x="86" y="${waterY - 4}" font-size="10.5" font-weight="700" fill="#0284c7">GW Table Hw = ${fmtUnits(s3.waterHeightAboveCrownFt, 'ft', units)} (${fmtUnits(s3.hydroCrownPsi, 'psi', units)})</text>
    ` : '';

    // Dimension line for Cover Depth H on right side
    const dimX = W - 64;
    const coverDimSvg = `
      <g stroke="var(--text-muted)" stroke-width="1.2">
        <line x1="${dimX}" y1="${groundY}" x2="${dimX}" y2="${crownY}"/>
        <line x1="${dimX - 7}" y1="${groundY}" x2="${dimX + 7}" y2="${groundY}"/>
        <line x1="${dimX - 7}" y1="${crownY}" x2="${dimX + 7}" y2="${crownY}"/>
      </g>
      <rect x="${dimX - 46}" y="${(groundY + crownY) / 2 - 11}" width="92" height="22" rx="5" fill="var(--bg-surface)" stroke="var(--border)"/>
      <text x="${dimX}" y="${(groundY + crownY) / 2 + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">H = ${fmtUnits(coverFt, 'ft', units)}</text>
    `;

    // Surcharge bars if > 0
    const surchargeSvg = s3.live.surchargePsf > 0 ? `
      <rect x="24" y="${groundY - 24}" width="110" height="14" rx="3" fill="rgba(180,83,9,0.22)" stroke="#b45309"/>
      <text x="79" y="${groundY - 14}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#b45309">+Surcharge ${fmtUnits(s3.live.surchargePsf, 'psf', units)}</text>
    ` : '';

    // Vacuum badge inside pipe if > 0
    const vacuumText = s3.vacuumPsi > 0
      ? `<text x="${cx}" y="${pipeCy + 16}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#dc2626">Vac −${fmtUnits(s3.vacuumPsi, 'psi', units)}</text>`
      : `<text x="${cx}" y="${pipeCy + 16}" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">${esc(s3.material.id)} · DR ${s3.geometry.dr}</text>`;

    return `
      <svg viewBox="0 0 ${W} ${H_SVG}" id="burialSceneSvg" role="img" aria-label="Buried PE Pipe and Surface Load Cross-Section">
        <defs>
          <pattern id="soilHatch" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.1" fill="var(--text-subtle)" fill-opacity="0.28"/>
            <circle cx="9" cy="8" r="1.3" fill="var(--text-subtle)" fill-opacity="0.22"/>
          </pattern>
        </defs>

        <!-- Native Soil Background -->
        <rect x="24" y="${groundY}" width="${W - 48}" height="${bottomY - groundY}" fill="var(--soil-native)"/>
        <rect x="24" y="${groundY}" width="${W - 48}" height="${bottomY - groundY}" fill="url(#soilHatch)"/>

        <!-- Trench Excavation & Embedment Zone -->
        <rect x="${trenchLeft}" y="${groundY}" width="${trenchRight - trenchLeft}" height="${beddingBottomY - groundY}" fill="var(--soil-embed)" stroke="var(--border-strong)" stroke-dasharray="6 4" stroke-width="1.2"/>
        <text x="${trenchLeft + 8}" y="${beddingBottomY - 6}" font-size="10" font-weight="600" fill="var(--text-muted)">Embedment: ${esc(s3.soilClass.id.toUpperCase())} (${esc(s3.compactionId)}) · Bd = ${fmtUnits(s3.trenchWidthFt, 'ft', units)}</text>

        <!-- Groundwater Overlay -->
        ${waterSvg}

        <!-- Surface Load Stress Distribution Cone -->
        ${stressConeSvg}

        <!-- Road / Grade Surface -->
        ${surfaceLayer}
        ${surchargeSvg}
        ${vehicleSvg}

        <!-- Crown Load Arrows -->
        ${crownArrows}

        <!-- Soil Passive Reaction Arrows -->
        ${soilSupportArrows}

        <!-- Pipe Status Aura -->
        <ellipse cx="${cx}" cy="${pipeCy}" rx="${rx + 8}" ry="${ry + 8}" fill="${statusSoft}"/>

        <!-- Undeformed Reference Circle -->
        <circle cx="${cx}" cy="${pipeCy}" r="${pipeR}" fill="none" stroke="var(--text-subtle)" stroke-width="1.3" stroke-dasharray="4 4"/>

        <!-- Deformed PE Pipe Outer & Inner Wall -->
        <ellipse cx="${cx}" cy="${pipeCy}" rx="${rx}" ry="${ry}" fill="var(--pipe-fill)" stroke="${statusColor}" stroke-width="2.5"/>
        <ellipse cx="${cx}" cy="${pipeCy}" rx="${innerRx}" ry="${innerRy}" fill="var(--bg-surface)" stroke="var(--border-strong)" stroke-width="1"/>

        <!-- Center Pipe Labels -->
        <text x="${cx}" y="${pipeCy - 8}" text-anchor="middle" font-size="11.5" font-weight="800" fill="${statusColor}">ΔY/D = ${s3.deflectionPct.toFixed(2)}%</text>
        <text x="${cx}" y="${pipeCy + 5}" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--text)">Limit ≤ ${s3.deflectionLimitPct.toFixed(1)}%</text>
        ${vacuumText}

        <!-- Right-side Crown Pressure Readout Pill -->
        <g transform="translate(${cx + rx + 18}, ${crownY - 12})">
          <rect x="0" y="-14" width="150" height="58" rx="7" fill="var(--bg-surface)" stroke="var(--border)"/>
          <text x="8" y="1" font-size="10" font-weight="700" fill="var(--text)">Crown Pressures</text>
          <text x="8" y="15" font-size="10" fill="var(--text-muted)">Earth PE: ${fmtUnits(s3.earthLoadPsi, 'psi', units)}</text>
          <text x="8" y="28" font-size="10" fill="#d97706" font-weight="700">Live PL: ${fmtUnits(s3.liveLoadPsi, 'psi', units)}</text>
          <text x="8" y="40" font-size="10" fill="var(--accent)" font-weight="700">Total: ${fmtUnits(s3.totalExternalPressurePsi, 'psi', units)}</text>
        </g>

        <!-- Cover Depth Dimension -->
        ${coverDimSvg}

        <!-- Overall Status Pill (Top Right) -->
        <g transform="translate(${W - 188}, 14)">
          <rect x="0" y="0" width="164" height="30" rx="8" fill="${statusSoft}" stroke="${statusColor}" stroke-width="1.5"/>
          <text x="82" y="19" text-anchor="middle" font-size="12" font-weight="800" fill="${statusColor}">${s3.overallPass ? 'BURIAL CHECK: PASS' : 'BURIAL CHECK: FAIL'}</text>
        </g>
      </svg>`;
  }

  /**
   * 2. Interactive Cover Depth Sensitivity Chart (Click to set H!)
   */
  function renderDepthSensitivityChart(sweep, activeH, deflectionLimitPct, units) {
    const W = 760;
    const H = 240;
    const padL = 56;
    const padR = 56;
    const padT = 26;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxDepth = 25;
    const maxLoad = sweep.reduce((m, p) => Math.max(m, p.totalVerticalLoadPsi), 10) * 1.15;
    const maxDefl = Math.max(deflectionLimitPct * 1.4, sweep.reduce((m, p) => Math.max(m, p.deflectionPct), 2) * 1.15);

    const xOf = (d) => padL + ((d - 1) / (maxDepth - 1)) * plotW;
    const yLoad = (p) => padT + plotH - (p / maxLoad) * plotH;
    const yDefl = (d) => padT + plotH - (Math.min(d, maxDefl) / maxDefl) * plotH;

    const poly = (fn) => sweep.map((pt) => `${xOf(pt.depthFt).toFixed(1)},${fn(pt).toFixed(1)}`).join(' ');

    const earthPts = poly((pt) => yLoad(pt.earthLoadPsi));
    const livePts = poly((pt) => yLoad(pt.liveLoadPsi));
    const totalPts = poly((pt) => yLoad(pt.totalVerticalLoadPsi));
    const deflPts = poly((pt) => yDefl(pt.deflectionPct));

    const limitY = yDefl(deflectionLimitPct);
    const activeX = xOf(Math.max(1, Math.min(maxDepth, activeH)));

    // Grid lines
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * plotH;
      const loadVal = maxLoad * (1 - i / 4);
      const deflVal = maxDefl * (1 - i / 4);
      grid += `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${units === 'SI' ? (loadVal * 6.895).toFixed(0) : loadVal.toFixed(1)}</text>
        <text x="${W - padR + 8}" y="${y + 4}" text-anchor="start" font-size="10" fill="#dc2626">${deflVal.toFixed(1)}%</text>`;
    }

    const xTicks = [1, 2, 4, 6, 8, 10, 15, 20, 25];
    let xAxisLabels = '';
    for (const d of xTicks) {
      const x = xOf(d);
      xAxisLabels += `
        <line x1="${x}" y1="${padT + plotH}" x2="${x}" y2="${padT + plotH + 5}" stroke="var(--border-strong)"/>
        <text x="${x}" y="${padT + plotH + 18}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${units === 'SI' ? (d * 0.3048).toFixed(1) + 'm' : d + 'ft'}</text>`;
    }

    return `
      <svg viewBox="0 0 ${W} ${H}" id="depthChartSvg" data-pad-l="${padL}" data-plot-w="${plotW}" data-max-d="${maxDepth}" style="cursor: crosshair;" role="img" aria-label="Cover Depth Sensitivity Chart">
        <!-- Safe Deflection Band -->
        <rect x="${padL}" y="${limitY}" width="${plotW}" height="${padT + plotH - limitY}" fill="rgba(22,163,74,0.08)"/>
        ${grid}
        ${xAxisLabels}

        <!-- Deflection Limit Line -->
        <line x1="${padL}" y1="${limitY}" x2="${W - padR}" y2="${limitY}" stroke="#dc2626" stroke-dasharray="5 4" stroke-width="1.4"/>
        <text x="${W - padR - 6}" y="${limitY - 5}" text-anchor="end" font-size="10" font-weight="700" fill="#dc2626">Deflection Limit (${deflectionLimitPct.toFixed(1)}%)</text>

        <!-- Curves -->
        <polyline points="${earthPts}" fill="none" stroke="#64748b" stroke-width="1.8" stroke-dasharray="4 3"/>
        <polyline points="${livePts}" fill="none" stroke="#d97706" stroke-width="2.2"/>
        <polyline points="${totalPts}" fill="none" stroke="var(--accent)" stroke-width="2.6"/>
        <polyline points="${deflPts}" fill="none" stroke="#dc2626" stroke-width="2.2"/>

        <!-- Active Depth Cursor -->
        <line x1="${activeX}" y1="${padT}" x2="${activeX}" y2="${padT + plotH}" stroke="var(--accent-2)" stroke-width="2" stroke-dasharray="3 3"/>
        <circle cx="${activeX}" cy="${padT}" r="4.5" fill="var(--accent-2)"/>
        <rect x="${Math.min(W - padR - 86, Math.max(padL, activeX - 42))}" y="4" width="84" height="17" rx="4" fill="var(--accent-2)"/>
        <text x="${Math.min(W - padR - 44, Math.max(padL + 42, activeX))}" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">H = ${fmtUnits(activeH, 'ft', units)}</text>

        <!-- Axis Titles -->
        <text x="14" y="${padT + plotH / 2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--accent)" transform="rotate(-90 14 ${padT + plotH / 2})">Load (${units === 'SI' ? 'kPa' : 'psi'})</text>
        <text x="${W - 12}" y="${padT + plotH / 2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#dc2626" transform="rotate(90 ${W - 12} ${padT + plotH / 2})">Deflection (%)</text>
        <text x="${padL + plotW / 2}" y="${H - 4}" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--text-muted)">Depth of Cover H (Click chart to set H)</text>

        <!-- Legend -->
        <g transform="translate(${padL + 10}, ${padT + 8})" font-size="10" font-weight="600">
          <rect x="-4" y="-8" width="370" height="20" rx="5" fill="var(--bg-surface)" fill-opacity="0.86" stroke="var(--border)"/>
          <line x1="2" y1="2" x2="18" y2="2" stroke="var(--accent)" stroke-width="2.5"/><text x="22" y="5" fill="var(--text)">Total Load</text>
          <line x1="88" y1="2" x2="104" y2="2" stroke="#d97706" stroke-width="2.2"/><text x="108" y="5" fill="var(--text)">Live PL</text>
          <line x1="158" y1="2" x2="174" y2="2" stroke="#64748b" stroke-width="1.8" stroke-dasharray="4 3"/><text x="178" y="5" fill="var(--text)">Earth PE</text>
          <line x1="238" y1="2" x2="254" y2="2" stroke="#dc2626" stroke-width="2.2"/><text x="258" y="5" fill="var(--text)">Ring Deflection %</text>
        </g>
      </svg>`;
  }

  /**
   * 3. Interactive Pipe Cross-Section Cutaway (Section 1: OD/ID/DR/Hoop Stress)
   */
  function renderPipeCutaway(s1, units) {
    const W = 436;
    const H = 310;
    const cx = 186;
    const cy = 158;
    const outerR = 110;
    const tRatio = Math.max(0.03, Math.min(0.40, s1.geometry.tMinIn / s1.geometry.odIn));
    const wallPx = Math.max(9, outerR * 2 * tRatio);
    const tolPx = Math.max(2.5, wallPx * 0.12);
    const innerMaxR = outerR - wallPx;
    const innerAvgR = Math.max(22, outerR - wallPx - tolPx * 0.5);

    const util = Math.min(1.3, s1.allowableStressPsi > 0 ? s1.hoopStressPsi / s1.allowableStressPsi : 1);
    const wallStroke = s1.overallPass ? (util > 0.85 ? '#d97706' : '#0b6bcb') : '#dc2626';

    // Radial internal pressure arrows (8 vectors)
    let pressureArrows = '';
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const r1 = innerAvgR * 0.38;
      const r2 = innerAvgR - 7;
      if (r2 > r1 + 8) {
        const x1 = cx + Math.cos(ang) * r1;
        const y1 = cy + Math.sin(ang) * r1;
        const x2 = cx + Math.cos(ang) * r2;
        const y2 = cy + Math.sin(ang) * r2;
        pressureArrows += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--accent)" stroke-width="1.8" marker-end="url(#pArrow)"/>`;
      }
    }

    return `
      <svg viewBox="0 0 ${W} ${H}" id="pipeCutawaySvg" role="img" aria-label="PE Pipe Cross-Section Cutaway">
        <defs>
          <marker id="pArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent)"/>
          </marker>
          <radialGradient id="hoopGrad" cx="50%" cy="50%" r="50%">
            <stop offset="${Math.round((innerAvgR / outerR) * 100)}%" stop-color="${wallStroke}" stop-opacity="0.72"/>
            <stop offset="100%" stop-color="${wallStroke}" stop-opacity="0.32"/>
          </radialGradient>
        </defs>

        <!-- Outer Diameter Ring -->
        <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="url(#hoopGrad)" stroke="${wallStroke}" stroke-width="2.5"/>
        <!-- +12% Wall Tolerance Band -->
        <circle cx="${cx}" cy="${cy}" r="${innerMaxR}" fill="var(--pipe-tol)" stroke="var(--accent-2)" stroke-width="1.2" stroke-dasharray="4 3"/>
        <!-- Average Bore -->
        <circle cx="${cx}" cy="${cy}" r="${innerAvgR}" fill="var(--bg-surface)" stroke="var(--border-strong)" stroke-width="1.4"/>

        <!-- Internal Pressure Vectors -->
        ${pressureArrows}

        <!-- Center Readout -->
        <circle cx="${cx}" cy="${cy}" r="${Math.min(34, innerAvgR * 0.56)}" fill="var(--bg-surface)" fill-opacity="0.92"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="11.5" font-weight="800" fill="var(--accent)">Pop ${fmtUnits(s1.operatingPressurePsi, 'psi_bar', units)}</text>
        <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">σh ${fmtUnits(s1.hoopStressPsi, 'psi', units)}</text>
        <text x="${cx}" y="${cy + 21}" text-anchor="middle" font-size="9" fill="var(--text-muted)">Allow ${fmtUnits(s1.allowableStressPsi, 'psi', units)}</text>

        <!-- OD Dimension Top -->
        <line x1="${cx - outerR}" y1="24" x2="${cx + outerR}" y2="24" stroke="var(--text)" stroke-width="1.3"/>
        <line x1="${cx - outerR}" y1="19" x2="${cx - outerR}" y2="${cy - 4}" stroke="var(--border-strong)" stroke-dasharray="3 3"/>
        <line x1="${cx + outerR}" y1="19" x2="${cx + outerR}" y2="${cy - 4}" stroke="var(--border-strong)" stroke-dasharray="3 3"/>
        <rect x="${cx - 56}" y="12" width="112" height="20" rx="5" fill="var(--bg-surface)" stroke="var(--border)"/>
        <text x="${cx}" y="26" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--text)">OD = ${fmtUnits(s1.geometry.odIn, 'in', units)}</text>

        <!-- Average ID Dimension Bottom -->
        <line x1="${cx - innerAvgR}" y1="${H - 22}" x2="${cx + innerAvgR}" y2="${H - 22}" stroke="var(--accent-2)" stroke-width="1.3"/>
        <rect x="${cx - 58}" y="${H - 33}" width="116" height="20" rx="5" fill="var(--bg-surface)" stroke="var(--border)"/>
        <text x="${cx}" y="${H - 19}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--accent-2)">Avg ID = ${fmtUnits(s1.geometry.idAvgIn, 'in', units)}</text>

        <!-- Right Callouts: Wall Thickness & DR -->
        <g transform="translate(310, 62)">
          <rect x="0" y="0" width="114" height="176" rx="8" fill="var(--bg-surface)" stroke="var(--border)"/>
          <text x="10" y="18" font-size="9.5" font-weight="700" fill="var(--text-muted)">${s1.geometry.controlMode}-CONTROLLED</text>
          <text x="10" y="36" font-size="14" font-weight="800" fill="var(--accent)">${s1.geometry.controlMode === 'ID' ? 'IDR' : 'DR'} ${s1.geometry.dr}</text>
          <line x1="10" y1="46" x2="104" y2="46" stroke="var(--border)"/>
          <text x="10" y="62" font-size="9.5" fill="var(--text-muted)">Min Wall t</text>
          <text x="10" y="76" font-size="11.5" font-weight="700" fill="var(--text)">${fmtUnits(s1.geometry.tMinIn, 'in', units)}</text>
          <text x="10" y="96" font-size="9.5" fill="var(--text-muted)">Avg Wall (+6%)</text>
          <text x="10" y="110" font-size="11.5" font-weight="700" fill="var(--accent-2)">${fmtUnits(s1.geometry.tAvgIn, 'in', units)}</text>
          <text x="10" y="130" font-size="9.5" fill="var(--text-muted)">HDS (73°F)</text>
          <text x="10" y="144" font-size="11.5" font-weight="700" fill="var(--text)">${fmtUnits(s1.effectiveHdsPsi, 'psi', units)}</text>
          <text x="10" y="164" font-size="9.5" font-weight="700" fill="${wallStroke}">FT=${s1.ft.toFixed(2)} · AF=${s1.af.toFixed(1)}</text>
        </g>
      </svg>`;
  }

  /**
   * 4. WPR Derating & 1.5x / 2.0x Surge Ceiling Gauge (Section 1)
   */
  function renderWprGauge(s1, units) {
    const W = 452;
    const H = 310;
    const maxScale = Math.max(s1.maxTotalOccPsi * 1.15, s1.totalMomentaryOccPsi * 1.15, s1.prBaseWaterPsi * 1.2, 50);
    const barX = 122;
    const barW = 246;

    const rows = [
      { label: 'Base PR (73°F)', val: s1.prBaseWaterPsi, color: '#64748b', note: 'Water AF=1, FT=1' },
      { label: 'Design PR (Eq. 1-1)', val: s1.prPsi, color: '#0b6bcb', note: s1.isCodeCapped ? 'Code Capped' : `FT=${s1.ft.toFixed(2)}, AF=${s1.af.toFixed(1)}` },
      { label: 'Working PR (WPR)', val: s1.wprPsi, color: '#0f766e', note: s1.wprPsi < s1.prPsi - 0.1 ? 'Surge Derated' : 'Full Rated PR' },
      { label: 'Sustained Op. P', val: s1.operatingPressurePsi, color: s1.sustainedPass ? '#16a34a' : '#dc2626', note: s1.sustainedPass ? '≤ PR PASS' : '> PR FAIL' },
      { label: 'Op + Rec. Surge', val: s1.totalMomentaryRecPsi, color: s1.recSurgePass ? '#0ea5e9' : '#dc2626', note: `Limit 1.5×PR = ${fmtUnits(s1.maxTotalRecPsi, 'psi_bar', units)}` },
      { label: 'Op + Occ. Surge', val: s1.totalMomentaryOccPsi, color: s1.occSurgePass ? '#d97706' : '#dc2626', note: `Limit 2.0×PR = ${fmtUnits(s1.maxTotalOccPsi, 'psi_bar', units)}` },
    ];

    const xOf = (v) => barX + Math.min(1, v / maxScale) * barW;
    const x15 = xOf(s1.maxTotalRecPsi);
    const x20 = xOf(s1.maxTotalOccPsi);

    let barsSvg = '';
    rows.forEach((r, idx) => {
      const y = 44 + idx * 41;
      const w = Math.max(2, Math.min(barW, (r.val / maxScale) * barW));
      barsSvg += `
        <text x="${barX - 8}" y="${y + 12}" text-anchor="end" font-size="10.5" font-weight="700" fill="var(--text)">${esc(r.label)}</text>
        <text x="${barX - 8}" y="${y + 24}" text-anchor="end" font-size="9" fill="var(--text-muted)">${esc(r.note)}</text>
        <rect x="${barX}" y="${y + 2}" width="${barW}" height="20" rx="5" fill="var(--bg-surface)" stroke="var(--border)"/>
        <rect x="${barX}" y="${y + 2}" width="${w.toFixed(1)}" height="20" rx="5" fill="${r.color}" fill-opacity="0.82"/>
        <text x="${Math.min(W - 8, barX + w + 6)}" y="${y + 16}" font-size="10.5" font-weight="800" fill="var(--text)">${fmtUnits(r.val, 'psi_bar', units)}</text>
      `;
    });

    return `
      <svg viewBox="0 0 ${W} ${H}" id="wprGaugeSvg" role="img" aria-label="WPR Derating and Surge Allowance Bars">
        <text x="14" y="22" font-size="12" font-weight="800" fill="var(--text)">WPR Derating &amp; Surge Ceilings (AWWA / PPI pp. 162–163)</text>

        <!-- 1.5x and 2.0x PR Vertical Reference Lines -->
        <line x1="${x15.toFixed(1)}" y1="36" x2="${x15.toFixed(1)}" y2="288" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="4 3"/>
        <text x="${x15.toFixed(1)}" y="301" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0ea5e9">1.5×PR</text>

        <line x1="${x20.toFixed(1)}" y1="36" x2="${x20.toFixed(1)}" y2="288" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4 3"/>
        <text x="${x20.toFixed(1)}" y="301" text-anchor="middle" font-size="9.5" font-weight="700" fill="#dc2626">2.0×PR</text>

        ${barsSvg}
      </svg>`;
  }

  /**
   * 5. Interactive Figure 1-1: Sudden Velocity Change vs. Pressure Surge (All SDRs)
   */
  function renderFigure11(s1, params, units) {
    const W = 760;
    const H = 290;
    const padL = 56;
    const padR = 72;
    const padT = 26;
    const padB = 42;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxDv = 8.0;
    const maxPs = 150;
    const xOf = (dv) => padL + (dv / maxDv) * plotW;
    const yOf = (ps) => padT + plotH - (Math.min(ps, maxPs) / maxPs) * plotH;

    let grid = '';
    for (let p = 0; p <= 150; p += 30) {
      const y = yOf(p);
      grid += `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${units === 'SI' ? (p * 6.895).toFixed(0) : p}</text>`;
    }
    for (let dv = 0; dv <= maxDv; dv += 1) {
      const x = xOf(dv);
      grid += `
        <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="var(--border)" stroke-opacity="0.5"/>
        <text x="${x}" y="${padT + plotH + 16}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${units === 'SI' ? (dv * 0.3048).toFixed(1) : dv}</text>`;
    }

    const drs = root.PPIEngine.STANDARD_DRS;
    let curves = '';
    for (const dr of drs) {
      const a = 4660 / Math.sqrt(1 + (s1.kBulkPsi / s1.edPsi) * (dr - 2));
      const psAtMax = (a * maxDv) / (2.31 * 32.2);
      const isSelected = Math.abs(dr - s1.geometry.dr) < 0.25;
      const stroke = isSelected ? 'var(--accent)' : 'var(--text-subtle)';
      const sw = isSelected ? 3.2 : 1.3;
      const dash = isSelected ? '' : '5 4';
      const yEnd = yOf(psAtMax);
      curves += `
        <line x1="${xOf(0)}" y1="${yOf(0)}" x2="${xOf(maxDv)}" y2="${yEnd.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
        <text x="${W - padR + 6}" y="${Math.max(padT + 8, Math.min(padT + plotH - 2, yEnd + 3))}" font-size="${isSelected ? '11' : '9.5'}" font-weight="${isSelected ? '800' : '600'}" fill="${isSelected ? 'var(--accent)' : 'var(--text-muted)'}">SDR ${dr}</text>`;
    }

    // Operating markers (Recurring & Occasional)
    const dvOcc = Math.min(maxDv, Number(params.deltaVOccFps) || 0);
    const dvRec = Math.min(maxDv, Number(params.deltaVRecFps) || 0);
    const occX = xOf(dvOcc);
    const occY = yOf(s1.psOccPsi);
    const recX = xOf(dvRec);
    const recY = yOf(s1.psRecPsi);

    return `
      <svg viewBox="0 0 ${W} ${H}" id="figure11Svg" role="img" aria-label="PPI Figure 1-1 Surge Pressure vs Sudden Velocity Change">
        ${grid}
        ${curves}

        <!-- Operating Markers -->
        <line x1="${occX}" y1="${padT + plotH}" x2="${occX}" y2="${occY}" stroke="#d97706" stroke-dasharray="3 3" stroke-width="1.3"/>
        <circle cx="${occX}" cy="${occY}" r="6" fill="#d97706" stroke="#fff" stroke-width="2"/>
        <rect x="${Math.max(padL, occX - 66)}" y="${Math.max(padT, occY - 26)}" width="132" height="19" rx="5" fill="var(--bg-surface)" stroke="#d97706"/>
        <text x="${Math.max(padL + 66, occX)}" y="${Math.max(padT + 13, occY - 13)}" text-anchor="middle" font-size="10" font-weight="700" fill="#d97706">Occ: ${fmtUnits(s1.psOccPsi, 'psi', units)}</text>

        <circle cx="${recX}" cy="${recY}" r="5.5" fill="#0ea5e9" stroke="#fff" stroke-width="2"/>
        <rect x="${recX + 9}" y="${recY - 10}" width="102" height="19" rx="5" fill="var(--bg-surface)" fill-opacity="0.92" stroke="#0ea5e9"/>
        <text x="${recX + 60}" y="${recY + 3}" text-anchor="middle" font-size="10" font-weight="700" fill="#0ea5e9">Rec: ${fmtUnits(s1.psRecPsi, 'psi', units)}</text>

        <!-- Axis Labels -->
        <text x="15" y="${padT + plotH / 2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--text)" transform="rotate(-90 15 ${padT + plotH / 2})">Surge Pressure Ps (${units === 'SI' ? 'kPa' : 'psig'})</text>
        <text x="${padL + plotW / 2}" y="${H - 6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--text)">Sudden Velocity Change ΔV (${units === 'SI' ? 'm/s' : 'ft/sec'}) — Ed = ${Math.round(s1.edPsi).toLocaleString()} psi</text>
      </svg>`;
  }

  /**
   * 6. Chapter 3 Appendix Temperature Curves: F_T (Table A.2) & M_E (Table B.1.2)
   */
  function renderTempCurves(s1, units) {
    const W = 420;
    const H = 175;
    const padL = 44;
    const padR = 20;
    const padT = 22;
    const padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const xOf = (t) => padL + ((t - 40) / 100) * plotW;
    const yOf = (v) => padT + plotH - ((v - 0.3) / 1.3) * plotH;

    const ftPts = s1.material.ftCurve.map(([t, v]) => `${xOf(t).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
    const mePts = root.PPIEngine.MODULUS_TEMP_MULTIPLIER_CURVE.map(([t, v]) => `${xOf(t).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

    const curT = Math.max(40, Math.min(140, s1.tempF));
    const curX = xOf(curT);
    const curFtY = yOf(Math.max(0.3, Math.min(1.6, s1.ft)));
    const curMeY = yOf(Math.max(0.3, Math.min(1.6, s1.mEAuto)));

    let grid = '';
    for (const v of [0.4, 0.7, 1.0, 1.3, 1.5]) {
      const y = yOf(v);
      grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)"/>
               <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9.5" fill="var(--text-muted)">${v.toFixed(1)}</text>`;
    }
    for (const t of [40, 60, 73.4, 100, 120, 140]) {
      const x = xOf(t);
      const lbl = units === 'SI' ? `${Math.round(((t - 32) * 5) / 9)}°C` : `${Math.round(t)}°F`;
      grid += `<text x="${x}" y="${padT + plotH + 15}" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">${lbl}</text>`;
    }

    return `
      <svg viewBox="0 0 ${W} ${H}" id="tempCurvesSvg" role="img" aria-label="Chapter 3 Temperature Factors FT and Modulus Multiplier ME">
        ${grid}
        <polyline points="${ftPts}" fill="none" stroke="var(--accent)" stroke-width="2.3"/>
        <polyline points="${mePts}" fill="none" stroke="var(--accent-2)" stroke-width="2.3" stroke-dasharray="5 3"/>
        <line x1="${curX}" y1="${padT}" x2="${curX}" y2="${padT + plotH}" stroke="var(--text-subtle)" stroke-dasharray="3 3"/>
        <circle cx="${curX}" cy="${curFtY}" r="4.5" fill="var(--accent)" stroke="#fff" stroke-width="1.5"/>
        <circle cx="${curX}" cy="${curMeY}" r="4.5" fill="var(--accent-2)" stroke="#fff" stroke-width="1.5"/>
        <text x="${padL + 6}" y="14" font-size="10" font-weight="700" fill="var(--accent)">— FT (Table A.2: ${s1.ft.toFixed(2)})</text>
        <text x="${padL + 165}" y="14" font-size="10" font-weight="700" fill="var(--accent-2)">-- ME (Table B.1.2: ${s1.mEAuto.toFixed(2)})</text>
      </svg>`;
  }

  root.PPIVisuals = {
    fmtUnits,
    renderBurialScene,
    renderDepthSensitivityChart,
    renderPipeCutaway,
    renderWprGauge,
    renderFigure11,
    renderTempCurves,
  };
})(typeof window !== 'undefined' ? window : globalThis);

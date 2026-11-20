/**
 * PPI Handbook of Polyethylene Pipe (2nd Ed.) — Chapter 6 Calculation Engine
 * Covers:
 *   - Chapter 3 Appendix: Table A.2 (F_T) & Table B.1.2 (Apparent Modulus Temp Multipliers)
 *   - Chapter 6 Section 1: ISO Pressure Rating (Eq. 1-1 to 1-4), Fuel Gas Codes,
 *     Surge Celerity (Eq. 1-5), Transient Surge (Eq. 1-6), Critical Time (Eq. 1-7),
 *     AWWA/PPI WPR Derating (2.0x Occasional, 1.5x Recurring)
 *   - Chapter 6 Section 3: Buried PE Pipe vs. Earth Load & Surface Live Load
 *     (H20 Rigid Table 3-3, H20 Unpaved/Flexible Table 3-4, Cooper E80, Boussinesq),
 *     Modified Iowa Ring Deflection, Luscher Constrained Buckling, Timoshenko
 *     Unconstrained Buckling, Ring Wall Crushing, and Negative Vacuum Check.
 *
 * Pure JS, zero dependencies. Works in Browser (window.PPIEngine) and Node (module.exports).
 */
(function (root) {
  'use strict';

  const GRAVITY_FT_S2 = 32.2;
  const WATER_UNIT_WEIGHT_PCF = 62.4;
  const POISSON_PE = 0.45;
  const PSI_TO_KPA = 6.894757293;
  const PSI_TO_MPA = 0.006894757293;
  const IN_TO_MM = 25.4;
  const FT_TO_M = 0.3048;
  const FPS_TO_MS = 0.3048;
  const PSF_TO_KPA = 0.047880259;
  const PCF_TO_KNM3 = 0.15708746;

  // PPI Chapter 6 Table 1-1 + Chapter 3 Appendix material properties at 73.4°F (23°C)
  const MATERIALS = {
    PE4710: {
      id: 'PE4710',
      label: 'PE 4710 / PE 3710 (High-Perf HDPE)',
      family: 'HDPE',
      hdsPsi: 1000,
      hdbPsi: 1600,
      maxTempPressureF: 140,
      maxTempNonPressureF: 180,
      edPsi: 150000,          // Dynamic instantaneous effective modulus at 73°F (Eq. 1-5)
      eShortPsi: 110000,      // Short-term apparent modulus at 73°F
      eLongPsi: 29000,        // 50-yr long-term apparent modulus at 73°F (Ch. 3)
      allowCompStressPsi: 1150, // Allowable long-term compressive stress at 73°F
      ftCurve: [
        [40, 1.00], [73, 1.00], [80, 1.00],
        [90, 0.90], [100, 0.80], [120, 0.70], [140, 0.60],
      ],
    },
    PE3608: {
      id: 'PE3608',
      label: 'PE 3608 / PE 3708 / PE 4608 (HDPE)',
      family: 'HDPE',
      hdsPsi: 800,
      hdbPsi: 1600,
      maxTempPressureF: 140,
      maxTempNonPressureF: 180,
      edPsi: 150000,
      eShortPsi: 110000,
      eLongPsi: 28200,
      allowCompStressPsi: 1000,
      ftCurve: [
        [40, 1.00], [73, 1.00], [80, 1.00],
        [90, 0.90], [100, 0.80], [120, 0.63], [140, 0.50],
      ],
    },
    PE2708: {
      id: 'PE2708',
      label: 'PE 2708 (High-Perf MDPE)',
      family: 'MDPE',
      hdsPsi: 800,
      hdbPsi: 1250,
      maxTempPressureF: 140,
      maxTempNonPressureF: 180,
      edPsi: 150000,
      eShortPsi: 95000,
      eLongPsi: 24000,
      allowCompStressPsi: 800,
      ftCurve: [
        [40, 1.00], [73, 1.00], [80, 1.00],
        [90, 0.90], [100, 0.80], [120, 0.63], [140, 0.50],
      ],
    },
    PE2706: {
      id: 'PE2706',
      label: 'PE 2606 / PE 2706 (MDPE)',
      family: 'MDPE',
      hdsPsi: 630,
      hdbPsi: 1250,
      maxTempPressureF: 140,
      maxTempNonPressureF: 180,
      edPsi: 150000,
      eShortPsi: 87000,
      eLongPsi: 22000,
      allowCompStressPsi: 800,
      ftCurve: [
        [40, 1.00], [73, 1.00], [80, 1.00],
        [90, 0.90], [100, 0.80], [120, 0.63], [140, 0.50],
      ],
    },
  };

  // Chapter 3 Appendix Table B.1.2 — Temperature Compensating Multipliers for Apparent Modulus E(T)
  const MODULUS_TEMP_MULTIPLIER_CURVE = [
    [40, 1.49],
    [60, 1.18],
    [73.4, 1.00],
    [100, 0.73],
    [120, 0.58],
    [140, 0.43],
  ];

  // Chapter 6 Table 1-2 & Fuel Gas Codes (pp. 159-161)
  const SERVICE_ENVIRONMENTS = {
    water: {
      id: 'water',
      label: 'Water / Wastewater / Aqueous Salts, Acids, Bases, Glycols',
      af: 1.0,
      mode: 'standard',
      note: 'PPI Table 1-2: AF = 1.0 at 73°F (23°C).',
    },
    dry_gas_unreg: {
      id: 'dry_gas_unreg',
      label: 'Non-Regulated Dry Natural Gas / N2 / CO2 / Methane / Class 1 Gathering',
      af: 1.0,
      mode: 'standard',
      note: 'PPI Table 1-2 & p. 161: AF = 1.0 (Class 1 gathering, ASTM F2619 / API 15LE).',
    },
    hydrocarbons: {
      id: 'hydrocarbons',
      label: 'Hydrocarbons ≥2% / Crude, Fuel Oil, Condensates, Wet Gas Gathering',
      af: 0.5,
      mode: 'standard',
      note: 'PPI Table 1-2: AF = 0.5 for solvating/permeating chemicals & hydrocarbons ≥2%.',
    },
    gas_49cfr192: {
      id: 'gas_49cfr192',
      label: 'US Federally Regulated Gas Distribution (49 CFR Part 192)',
      af: 1.0,
      mode: 'cfr192',
      dfOnHdb: 0.32,
      note: '49 CFR 192: DF = 0.32 × HDB (HDPE HDS=500, MDPE=400 psi); Cap 125 psi (≤12") / 100 psi (>12"–24").',
    },
    gas_csa_z662: {
      id: 'gas_csa_z662',
      label: 'Canada Regulated Gas Distribution (CSA Z662-07)',
      af: 1.0,
      mode: 'csa_z662',
      dfOnHdb: 0.40,
      note: 'CSA Z662-07 (p. 160): DF = 0.40 applied to HDB.',
    },
    lpg_nfpa58: {
      id: 'lpg_nfpa58',
      label: 'Regulated LPG Vapors — Propane / Butane (ASTM D2513 / NFPA 58)',
      af: 0.8,
      mode: 'lpg',
      maxOpPsig: 30,
      note: 'NFPA/ANSI 58 (pp. 160-161): AF = 0.8, HDS capped at 800 (HDPE) / 630 (MDPE) psi, max 30 psig.',
    },
  };

  const STANDARD_DRS = [7.3, 9, 11, 13.5, 17, 21, 26, 32.5];

  // Standard Pipe Outside Diameters (in.) — IPS & DIPS
  const PIPE_SIZES = {
    IPS: [
      { nominal: 2, od: 2.375 },
      { nominal: 3, od: 3.500 },
      { nominal: 4, od: 4.500 },
      { nominal: 6, od: 6.625 },
      { nominal: 8, od: 8.625 },
      { nominal: 10, od: 10.750 },
      { nominal: 12, od: 12.750 },
      { nominal: 14, od: 14.000 },
      { nominal: 16, od: 16.000 },
      { nominal: 18, od: 18.000 },
      { nominal: 20, od: 20.000 },
      { nominal: 24, od: 24.000 },
      { nominal: 30, od: 30.000 },
      { nominal: 36, od: 36.000 },
      { nominal: 42, od: 42.000 },
      { nominal: 48, od: 48.000 },
    ],
    DIPS: [
      { nominal: 4, od: 4.80 },
      { nominal: 6, od: 6.90 },
      { nominal: 8, od: 9.05 },
      { nominal: 10, od: 11.10 },
      { nominal: 12, od: 13.20 },
      { nominal: 14, od: 15.30 },
      { nominal: 16, od: 17.40 },
      { nominal: 18, od: 19.50 },
      { nominal: 20, od: 21.60 },
      { nominal: 24, od: 25.80 },
      { nominal: 30, od: 32.00 },
      { nominal: 36, od: 38.30 },
      { nominal: 42, od: 44.50 },
      { nominal: 48, od: 50.80 },
    ],
  };

  // Howard (1977) / ASTM D2321 Modulus of Soil Reaction E' (psi)
  const HOWARD_SOIL_TABLE = {
    class1: {
      id: 'class1',
      label: 'Class I — Angular Crushed Rock / Gravel',
      uscs: 'Manufactured angular aggregates',
      ePrime: { dumped: 1000, slight: 3000, moderate: 3000, high: 3000 },
    },
    class2: {
      id: 'class2',
      label: 'Class II — Coarse-Grained Sands & Gravels (<12% fines)',
      uscs: 'GW, GP, SW, SP',
      ePrime: { dumped: 200, slight: 1000, moderate: 2000, high: 3000 },
    },
    class3: {
      id: 'class3',
      label: 'Class III — Coarse Soils w/ Fines (>12%) or Fine Soils (>25% coarse)',
      uscs: 'GM, GC, SM, SC; CL/ML (>25% coarse)',
      ePrime: { dumped: 100, slight: 400, moderate: 1000, high: 2000 },
    },
    class4: {
      id: 'class4',
      label: 'Class IV — Fine-Grained Silts & Clays (LL < 50, <25% coarse)',
      uscs: 'CL, ML, ML-CL',
      ePrime: { dumped: 50, slight: 200, moderate: 400, high: 1000 },
    },
  };

  const COMPACTION_LEVELS = {
    dumped: { id: 'dumped', label: 'Dumped / Uncompacted (<85% Proctor)' },
    slight: { id: 'slight', label: 'Slight Compaction (~85% Proctor)' },
    moderate: { id: 'moderate', label: 'Moderate Compaction (85–95% Proctor)' },
    high: { id: 'high', label: 'High Compaction (>95% Proctor)' },
  };

  // PPI Chapter 6 Table 3-3: H20 Load under 12" Rigid Pavement (includes impact), psf
  const H20_RIGID_TABLE = [
    [1.0, 1800],
    [1.5, 1400],
    [2.0, 800],
    [3.0, 600],
    [4.0, 400],
    [5.0, 250],
    [6.0, 200],
    [7.0, 175],
    [8.0, 100],
    [8.5, 0],
  ];

  // PPI Chapter 6 Table 3-4: H20 Load under Unpaved / Flexible Pavement (two passing H20 trucks, no impact), psf
  const H20_FLEXIBLE_TABLE = [
    [1.5, 2000],
    [2.0, 1340],
    [2.5, 1000],
    [3.0, 710],
    [3.5, 560],
    [4.0, 500],
    [6.0, 310],
    [8.0, 200],
    [10.0, 140],
    [12.0, 97],
    [15.0, 62],
    [20.0, 35],
    [30.0, 15],
  ];

  // PPI Chapter 6 / AWWA M55: Cooper E80 Railway Live Load (includes impact), psf
  const COOPER_E80_TABLE = [
    [2.0, 3800],
    [3.0, 3400],
    [4.0, 2650],
    [6.0, 2250],
    [8.0, 1600],
    [10.0, 1100],
    [12.0, 800],
    [15.0, 600],
    [20.0, 300],
    [25.0, 200],
    [30.0, 100],
    [35.0, 0],
  ];

  // AWWA M55 / PPI Design Deflection Limits (% of base diameter) by DR
  const DEFLECTION_LIMIT_TABLE = [
    [7.3, 3.0],
    [9.0, 4.0],
    [11.0, 5.0],
    [13.5, 6.0],
    [17.0, 6.0],
    [21.0, 7.5],
    [26.0, 7.5],
    [32.5, 7.5],
  ];

  function finite(val, fallback) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  function interpTable(table, x) {
    if (x <= table[0][0]) return table[0][1];
    const last = table[table.length - 1];
    if (x >= last[0]) return last[1];
    for (let i = 0; i < table.length - 1; i++) {
      const [x0, y0] = table[i];
      const [x1, y1] = table[i + 1];
      if (x >= x0 && x <= x1) {
        const frac = (x - x0) / (x1 - x0);
        return y0 + frac * (y1 - y0);
      }
    }
    return last[1];
  }

  function getServiceTempFactor(materialId, tempF) {
    const mat = MATERIALS[materialId] || MATERIALS.PE4710;
    const t = clamp(finite(tempF, 73.4), 40, 140);
    return interpTable(mat.ftCurve, t);
  }

  function getModulusTempMultiplier(tempF) {
    const t = clamp(finite(tempF, 73.4), 40, 140);
    return interpTable(MODULUS_TEMP_MULTIPLIER_CURVE, t);
  }

  function getDeflectionLimitPct(dr) {
    const d = Math.max(5, finite(dr, 17));
    return interpTable(DEFLECTION_LIMIT_TABLE, d);
  }

  function getPipeGeometry(params) {
    const controlMode = params.controlMode === 'ID' ? 'ID' : 'OD';
    const dr = Math.max(4, finite(params.dr, 17));
    const sizingSystem = params.sizingSystem || 'IPS';
    let odIn = finite(params.customOdIn, 12.75);
    let idControlledIn = finite(params.customIdIn, 11.25);

    if (controlMode === 'OD' && sizingSystem !== 'CUSTOM') {
      const list = PIPE_SIZES[sizingSystem] || PIPE_SIZES.IPS;
      const nom = finite(params.nominalSize, 12);
      const match = list.find((s) => s.nominal === nom) || list[0];
      odIn = match.od;
    }

    let tMinIn, tAvgIn, idAvgIn, idMaxIn, dmIn;
    if (controlMode === 'OD') {
      // Eq. 1-3: DR = Do / t
      tMinIn = odIn / dr;
      tAvgIn = tMinIn * 1.06; // +12% ASTM wall tolerance -> +6% average wall
      idAvgIn = Math.max(0.1, odIn - 2 * tAvgIn); // Do * (1 - 2.12/DR)
      idMaxIn = Math.max(0.1, odIn - 2 * tMinIn);
      dmIn = odIn - tMinIn;
    } else {
      // Eq. 1-4: IDR = Di / t
      tMinIn = idControlledIn / dr;
      tAvgIn = tMinIn * 1.06;
      odIn = idControlledIn + 2 * tMinIn;
      idAvgIn = idControlledIn;
      idMaxIn = idControlledIn;
      dmIn = idControlledIn + tMinIn;
    }

    const effectiveDr = odIn / tMinIn;
    return {
      controlMode,
      dr,
      effectiveDr,
      odIn,
      tMinIn,
      tAvgIn,
      tMaxIn: tMinIn * 1.12,
      idAvgIn,
      idMaxIn,
      dmIn,
      meanRadiusIn: dmIn / 2,
      areaFlowIn2: Math.PI * Math.pow(idAvgIn / 2, 2),
      areaWallIn2: Math.PI * (Math.pow(odIn / 2, 2) - Math.pow(idMaxIn / 2, 2)),
    };
  }

  /**
   * Section 1: Pressure Rating, Fuel Gas Regulations, Surge (Eq. 1-1 to 1-7) & WPR
   */
  function calcSection1(params) {
    const mat = MATERIALS[params.materialId] || MATERIALS.PE4710;
    const env = SERVICE_ENVIRONMENTS[params.environmentId] || SERVICE_ENVIRONMENTS.water;
    const geom = getPipeGeometry(params);
    const tempF = finite(params.tempF, 73.4);

    const ftAuto = getServiceTempFactor(mat.id, tempF);
    const ft = params.overrideFt ? clamp(finite(params.manualFt, ftAuto), 0.1, 1.5) : ftAuto;

    const mEAuto = getModulusTempMultiplier(tempF);
    const edAuto = mat.edPsi * mEAuto;
    const edPsi = params.overrideEd ? Math.max(10000, finite(params.manualEdPsi, edAuto)) : edAuto;
    const kBulkPsi = Math.max(10000, finite(params.kBulkPsi, 300000));

    // Effective HDS & AF under service environment / regulatory code
    let effectiveHdsPsi = mat.hdsPsi;
    let af = env.af;
    let regulatoryCapPsi = null;
    let codeWarning = null;

    if (env.mode === 'cfr192') {
      // 49 CFR Part 192 (p. 160): DF = 0.32 × HDB -> HDPE 500 psi, MDPE 400 psi
      effectiveHdsPsi = mat.family === 'HDPE' ? 500 : 400;
      af = 1.0;
      if (geom.odIn <= 13.5) {
        regulatoryCapPsi = 125;
      } else if (geom.odIn <= 26.0) {
        regulatoryCapPsi = 100;
      } else {
        regulatoryCapPsi = 100;
        codeWarning = '49 CFR 192 gas distribution generally restricts PE pipe diameter to ≤24 in.';
      }
    } else if (env.mode === 'csa_z662') {
      effectiveHdsPsi = mat.hdbPsi * env.dfOnHdb;
      af = 1.0;
    } else if (env.mode === 'lpg') {
      effectiveHdsPsi = Math.min(mat.hdsPsi, mat.family === 'HDPE' ? 800 : 630);
      af = 0.8;
      regulatoryCapPsi = 30;
    }

    const denom = geom.controlMode === 'OD' ? (geom.dr - 1) : (geom.dr + 1);
    // Base standard water PR at 73°F (AF = 1, FT = 1)
    const prBaseWaterPsi = (2 * mat.hdsPsi) / denom;
    // Temperature-adjusted water PR
    const prTempWaterPsi = (2 * mat.hdsPsi * ft) / denom;
    // Uncapped Equation 1-1 / 1-2 PR
    const prRawPsi = (2 * effectiveHdsPsi * ft * af) / denom;
    const prPsi = regulatoryCapPsi !== null ? Math.min(prRawPsi, regulatoryCapPsi) : prRawPsi;
    const isCodeCapped = regulatoryCapPsi !== null && prRawPsi > regulatoryCapPsi;

    if (tempF > mat.maxTempPressureF) {
      codeWarning = `Temperature (${tempF.toFixed(1)}°F) exceeds Table 1-1 max pressure service limit (${mat.maxTempPressureF}°F).`;
    }

    // Surge Pressure — Equations 1-5, 1-6, 1-7
    // Eq. 1-5: a = 4660 / sqrt(1 + (K_BULK / E_d) * (DR - 2))
    const drForSurge = Math.max(2.5, geom.effectiveDr);
    const waveCelerityFps = 4660 / Math.sqrt(1 + (kBulkPsi / edPsi) * (drForSurge - 2));

    const deltaVRecFps = Math.max(0, finite(params.deltaVRecFps, 1.5));
    const deltaVOccFps = Math.max(0, finite(params.deltaVOccFps, 4.0));
    const pipeLengthFt = Math.max(10, finite(params.pipeLengthFt, 1500));
    const valveClosureSec = Math.max(0.05, finite(params.valveClosureSec, 2.0));

    // Eq. 1-7: T_CR = 2L / a
    const criticalTimeSec = (2 * pipeLengthFt) / waveCelerityFps;
    const isSuddenClosure = valveClosureSec <= criticalTimeSec;
    const closureAttenuation = isSuddenClosure ? 1.0 : (criticalTimeSec / valveClosureSec);

    // Eq. 1-6: Ps = a * (dV / (2.31 * g))
    const psRecSuddenPsi = waveCelerityFps * (deltaVRecFps / (2.31 * GRAVITY_FT_S2));
    const psOccSuddenPsi = waveCelerityFps * (deltaVOccFps / (2.31 * GRAVITY_FT_S2));

    const psRecPsi = params.manualSurgeMode
      ? Math.max(0, finite(params.manualPsRecPsi, psRecSuddenPsi))
      : psRecSuddenPsi;
    const psOccPsi = params.manualSurgeMode
      ? Math.max(0, finite(params.manualPsOccPsi, psOccSuddenPsi))
      : psOccSuddenPsi;

    const psOccAttenuatedPsi = psOccPsi * closureAttenuation;

    // AWWA / PPI WPR Derating (pp. 162–163)
    const maxTotalRecPsi = 1.5 * prPsi;
    const maxTotalOccPsi = 2.0 * prPsi;
    const wprRecPsi = Math.min(prPsi, maxTotalRecPsi - psRecPsi);
    const wprOccPsi = Math.min(prPsi, maxTotalOccPsi - psOccPsi);
    const wprPsi = Math.max(0, Math.min(prPsi, wprRecPsi, wprOccPsi));
    const wprGoverning =
      wprPsi < prPsi - 1e-6
        ? (wprOccPsi <= wprRecPsi ? 'Occasional Surge (2.0×PR)' : 'Recurring Surge (1.5×PR)')
        : 'Sustained PR (No Surge Derating Required)';

    // Max allowable sudden dV without derating PR (Tables 1-3 A & 1-3 B basis)
    // Recurring allowance = 0.5 * PR; Occasional allowance = 1.0 * PR
    const surgePsiPerFps = waveCelerityFps / (2.31 * GRAVITY_FT_S2);
    const maxAllowableDvRecFps = (0.5 * prPsi) / surgePsiPerFps;
    const maxAllowableDvOccFps = (1.0 * prPsi) / surgePsiPerFps;

    // Operating pressure check & hoop stress
    const operatingPressurePsi = Math.max(0, finite(params.operatingPressurePsi, 80));
    const hoopStressPsi = (operatingPressurePsi * denom) / 2;
    const allowableStressPsi = effectiveHdsPsi * ft * af;
    const utilizationPct = wprPsi > 0 ? (operatingPressurePsi / wprPsi) * 100 : 999;

    const totalMomentaryRecPsi = operatingPressurePsi + psRecPsi;
    const totalMomentaryOccPsi = operatingPressurePsi + psOccPsi;

    const sustainedPass = operatingPressurePsi <= prPsi + 1e-6;
    const recSurgePass = totalMomentaryRecPsi <= maxTotalRecPsi + 1e-6;
    const occSurgePass = totalMomentaryOccPsi <= maxTotalOccPsi + 1e-6;
    const overallPass = sustainedPass && recSurgePass && occSurgePass && tempF <= mat.maxTempPressureF;

    return {
      material: mat,
      environment: env,
      geometry: geom,
      tempF,
      ft,
      ftAuto,
      mEAuto,
      edPsi,
      edAuto,
      kBulkPsi,
      effectiveHdsPsi,
      af,
      regulatoryCapPsi,
      isCodeCapped,
      codeWarning,
      prBaseWaterPsi,
      prTempWaterPsi,
      prRawPsi,
      prPsi,
      waveCelerityFps,
      surgePsiPerFps,
      criticalTimeSec,
      valveClosureSec,
      isSuddenClosure,
      closureAttenuation,
      psRecPsi,
      psOccPsi,
      psOccAttenuatedPsi,
      maxTotalRecPsi,
      maxTotalOccPsi,
      wprRecPsi,
      wprOccPsi,
      wprPsi,
      wprGoverning,
      maxAllowableDvRecFps,
      maxAllowableDvOccFps,
      operatingPressurePsi,
      hoopStressPsi,
      allowableStressPsi,
      utilizationPct,
      totalMomentaryRecPsi,
      totalMomentaryOccPsi,
      sustainedPass,
      recSurgePass,
      occSurgePass,
      overallPass,
    };
  }

  /**
   * Surface Live Load pressure P_L (psi) at cover depth H (ft)
   */
  function calcLiveLoad(params, depthOverrideFt) {
    const H = Math.max(0.5, finite(depthOverrideFt !== undefined ? depthOverrideFt : params.coverDepthFt, 3.0));
    const liveLoadType = params.liveLoadType || 'h20_flexible';
    const surchargePsf = Math.max(0, finite(params.surchargePsf, 0));
    const impactFactor = Math.max(1.0, finite(params.impactFactor, 1.0));
    let baseLivePsf = 0;
    let sourceLabel = '';
    let minCoverReqFt = 2.0;

    if (liveLoadType === 'none') {
      baseLivePsf = 0;
      sourceLabel = 'No Surface Traffic Load';
      minCoverReqFt = 2.0;
    } else if (liveLoadType === 'h20_flexible') {
      // PPI Table 3-4 (unpaved/flexible pavement, no impact included in base table)
      if (H < 1.5) {
        // Boussinesq scaling above 1.5 ft
        baseLivePsf = 2000 * Math.pow(1.5 / H, 2);
      } else {
        baseLivePsf = interpTable(H20_FLEXIBLE_TABLE, H);
      }
      baseLivePsf *= impactFactor;
      sourceLabel = `PPI Table 3-4 — AASHTO H20 Flexible/Unpaved (I_f = ${impactFactor.toFixed(2)})`;
      minCoverReqFt = 2.0;
    } else if (liveLoadType === 'h20_rigid') {
      // PPI Table 3-3 (12" rigid concrete pavement, impact already included)
      if (H < 1.0) {
        baseLivePsf = 1800 * Math.pow(1.0 / H, 2);
      } else if (H > 8.0) {
        baseLivePsf = 0;
      } else {
        baseLivePsf = interpTable(H20_RIGID_TABLE, H);
      }
      sourceLabel = 'PPI Table 3-3 — AASHTO H20 (12" Rigid Pavement, incl. impact)';
      minCoverReqFt = 2.0;
    } else if (liveLoadType === 'cooper_e80') {
      // Cooper E80 Railway (impact included in standard table)
      if (H < 2.0) {
        baseLivePsf = 3800 * Math.pow(2.0 / H, 2);
      } else if (H > 30.0) {
        baseLivePsf = 0;
      } else {
        baseLivePsf = interpTable(COOPER_E80_TABLE, H);
      }
      sourceLabel = 'PPI Ch. 6 / AREMA — Cooper E80 Railway (incl. impact)';
      minCoverReqFt = 3.0;
    } else if (liveLoadType === 'boussinesq') {
      // Custom point/wheel load via Boussinesq equation:
      // P_L = (3 * I_f * W) / (2 * pi * H^2) * [1 + (r/H)^2]^(-5/2)  [psf]
      const wheelLoadLb = Math.max(0, finite(params.wheelLoadLb, 16000));
      const offsetFt = Math.abs(finite(params.wheelOffsetFt, 0));
      const boussFactor = Math.pow(1 + Math.pow(offsetFt / H, 2), -2.5);
      baseLivePsf = ((3 * impactFactor * wheelLoadLb) / (2 * Math.PI * H * H)) * boussFactor;
      sourceLabel = `Boussinesq Point Load (W = ${wheelLoadLb.toLocaleString()} lb, r = ${offsetFt.toFixed(1)} ft, I_f = ${impactFactor.toFixed(2)})`;
      minCoverReqFt = 2.0;
    }

    const totalLivePsf = baseLivePsf + surchargePsf;
    return {
      depthFt: H,
      liveLoadType,
      baseLivePsf,
      surchargePsf,
      totalLivePsf,
      liveLoadPsi: totalLivePsf / 144,
      baseLivePsi: baseLivePsf / 144,
      surchargePsi: surchargePsf / 144,
      sourceLabel,
      minCoverReqFt,
    };
  }

  /**
   * Section 3: Buried PE Pipe Check Against Earth Load & Surface Load
   */
  function calcSection3(params, depthOverrideFt) {
    const mat = MATERIALS[params.materialId] || MATERIALS.PE4710;
    const geom = getPipeGeometry(params);
    const dr = geom.effectiveDr;
    const tempF = finite(params.tempF, 73.4);
    const ftAuto = getServiceTempFactor(mat.id, tempF);
    const ft = params.overrideFt ? clamp(finite(params.manualFt, ftAuto), 0.1, 1.5) : ftAuto;
    const mEAuto = getModulusTempMultiplier(tempF);

    const H = Math.max(0.5, finite(depthOverrideFt !== undefined ? depthOverrideFt : params.coverDepthFt, 3.0));
    const Hw = clamp(finite(params.waterHeightAboveCrownFt, 0), 0, H);
    const soilUnitWeightPcf = clamp(finite(params.soilUnitWeightPcf, 120), 65, 160);
    const trenchWidthFt = Math.max(geom.odIn / 12 + 0.5, finite(params.trenchWidthFt, Math.max(2.5, (geom.odIn / 12) * 1.5 + 1.0)));

    // Soil reaction modulus E' (Howard table or manual override)
    const soilClass = HOWARD_SOIL_TABLE[params.soilClassId] || HOWARD_SOIL_TABLE.class2;
    const compactionId = params.compactionId || 'moderate';
    const ePrimeTablePsi = soilClass.ePrime[compactionId] !== undefined ? soilClass.ePrime[compactionId] : 1000;
    const ePrimePsi = params.overrideEPrime ? Math.max(0, finite(params.manualEPrimePsi, ePrimeTablePsi)) : ePrimeTablePsi;

    // Apparent Modulus E (Short-term vs 50-yr Long-term, temperature compensated via Table B.1.2)
    const loadDuration = params.loadDuration || 'long_term';
    const eLongPsi = mat.eLongPsi * mEAuto;
    const eShortPsi = mat.eShortPsi * mEAuto;
    const eDynamicPsi = mat.edPsi * mEAuto;
    const eDesignPsi = loadDuration === 'short_term' ? eShortPsi : eLongPsi;

    // 1. Earth Prism Load (PPI Ch. 6 Sec. 3)
    // Dry soil above water table + buoyant submerged soil below water table
    const buoyantSoilWeightPcf = Math.max(20, soilUnitWeightPcf - WATER_UNIT_WEIGHT_PCF);
    const earthLoadPsf = soilUnitWeightPcf * (H - Hw) + buoyantSoilWeightPcf * Hw;
    const earthLoadPsi = earthLoadPsf / 144;

    // Hydrostatic groundwater pressure at pipe crown (and springline)
    const hydroCrownPsi = (WATER_UNIT_WEIGHT_PCF * Hw) / 144;
    const hydroSpringlinePsi = (WATER_UNIT_WEIGHT_PCF * (Hw + geom.odIn / 24)) / 144;

    // Marston narrow-trench comparison (K*mu' = 0.13 typical granular/clay average)
    const kMu = 0.13;
    const cd = (1 - Math.exp(-2 * kMu * (H / trenchWidthFt))) / (2 * kMu);
    const marstonPsf = cd * soilUnitWeightPcf * trenchWidthFt;
    const marstonPsi = Math.min(earthLoadPsi, marstonPsf / 144);

    // 2. Surface Live Load
    const live = calcLiveLoad(params, H);
    const liveLoadPsi = live.liveLoadPsi;

    // Internal vacuum (negative pressure)
    const vacuumPsi = clamp(finite(params.vacuumPsi, 0), 0, 14.7);

    // Total vertical soil + live pressure (for wall crushing)
    const totalVerticalLoadPsi = earthLoadPsi + hydroCrownPsi + liveLoadPsi;
    // Total external buckling pressure (earth + groundwater + live + internal vacuum)
    const totalExternalPressurePsi = earthLoadPsi + hydroCrownPsi + liveLoadPsi + vacuumPsi;

    // 3. Ring Deflection — Modified Iowa / Spangler Formula
    // %dY/Dm = 100 * K * (D_L * P_E + P_L) / [ 2*E / (3*(DR-1)^3) + 0.061 * E' ]
    const beddingK = clamp(finite(params.beddingK, 0.10), 0.08, 0.12);
    const lagFactorDL = clamp(finite(params.lagFactorDL, 1.0), 1.0, 2.0);

    const pipeStiffnessTermLong = (2 * eLongPsi) / (3 * Math.pow(dr - 1, 3));
    const pipeStiffnessTermShort = (2 * eShortPsi) / (3 * Math.pow(dr - 1, 3));
    const pipeStiffnessTermDesign = (2 * eDesignPsi) / (3 * Math.pow(dr - 1, 3));
    const pipeStiffnessPsi = pipeStiffnessTermDesign / 0.149; // ASTM D2412 PS = F/dY
    const soilStiffnessTerm = 0.061 * ePrimePsi;

    const deflectionPct =
      (100 * beddingK * (lagFactorDL * earthLoadPsi + liveLoadPsi)) /
      Math.max(1e-6, pipeStiffnessTermDesign + soilStiffnessTerm);
    const deflectionShortPct =
      (100 * beddingK * (earthLoadPsi + liveLoadPsi)) /
      Math.max(1e-6, pipeStiffnessTermShort + soilStiffnessTerm);
    const deflectionLongPct =
      (100 * beddingK * (lagFactorDL * earthLoadPsi + liveLoadPsi)) /
      Math.max(1e-6, pipeStiffnessTermLong + soilStiffnessTerm);

    const deflectionIn = (deflectionPct / 100) * geom.dmIn;
    const deflectionLimitPct = getDeflectionLimitPct(dr);
    const deflectionPass = deflectionPct <= deflectionLimitPct + 1e-6;
    const deflectionMarginPct = deflectionLimitPct - deflectionPct;

    // 4. Constrained Ring Buckling — Luscher's Equation (PPI Ch. 6 / AWWA M55)
    // P_wc = (5.65 / N) * sqrt( R_B * B' * E' * [ E / (12 * (DR - 1)^3) ] )
    const safetyFactorReq = clamp(finite(params.bucklingSafetyFactor, 2.0), 1.0, 4.0);
    const rB = clamp(1 - 0.33 * (Hw / H), 0.67, 1.0);
    const bPrime = 1 / (1 + 4 * Math.exp(-0.065 * H));

    const pCrConstrainedPsi =
      5.65 * Math.sqrt(rB * bPrime * ePrimePsi * (eDesignPsi / (12 * Math.pow(dr - 1, 3))));
    const pWcAllowablePsi = pCrConstrainedPsi / safetyFactorReq;

    // Unconstrained Buckling — Timoshenko / Levy (relevant if shallow cover <2ft or E'≈0)
    const ovalityDelta = clamp(deflectionPct / 100, 0, 0.25);
    const ovalityFo = Math.pow((1 - ovalityDelta) / (1 + ovalityDelta), 3);
    const pCrUnconstrainedPsi =
      ((2 * eDesignPsi) / (1 - POISSON_PE * POISSON_PE)) *
      Math.pow(1 / (dr - 1), 3) *
      ovalityFo;

    // Governing buckling capacity: constrained when soil support exists & H >= 2ft; blend warning if H < 2ft
    const constrainedValid = ePrimePsi > 0 && H >= 2.0;
    const pCrGoverningPsi = constrainedValid
      ? pCrConstrainedPsi
      : Math.max(pCrUnconstrainedPsi, ePrimePsi > 0 ? pCrConstrainedPsi * (H / 2.0) : pCrUnconstrainedPsi);
    const pAllowBucklingPsi = pCrGoverningPsi / safetyFactorReq;
    const bucklingSF = totalExternalPressurePsi > 0 ? pCrGoverningPsi / totalExternalPressurePsi : 999;
    const bucklingPass = bucklingSF >= safetyFactorReq - 1e-6;

    // Transient Vacuum Buckling Check (short-term surge vacuum, uses dynamic modulus E_d(T), p. 163)
    const pCrVacuumShortPsi =
      5.65 * Math.sqrt(rB * bPrime * Math.max(ePrimePsi, 1) * (eDynamicPsi / (12 * Math.pow(dr - 1, 3))));
    const pCrVacuumUnconstShortPsi =
      ((2 * eDynamicPsi) / (1 - POISSON_PE * POISSON_PE)) *
      Math.pow(1 / (dr - 1), 3) *
      ovalityFo;
    const pCrFullVacCapPsi = constrainedValid ? pCrVacuumShortPsi : pCrVacuumUnconstShortPsi;
    const fullVacLoadPsi = earthLoadPsi + hydroCrownPsi + 14.7;
    const fullVacuumSF = fullVacLoadPsi > 0 ? pCrFullVacCapPsi / fullVacLoadPsi : 999;
    const fullVacuumPass = fullVacuumSF >= 2.0;

    // 5. Pipe Wall Ring Compressive Stress (Wall Crushing)
    // S = (P_total * D_O) / (2 * t) = P_total * DR / 2
    const wallCompStressPsi = (totalVerticalLoadPsi * dr) / 2;
    const allowCompStressPsi = mat.allowCompStressPsi * ft;
    const crushingSF = wallCompStressPsi > 0 ? allowCompStressPsi / wallCompStressPsi : 999;
    const crushingPass = wallCompStressPsi <= allowCompStressPsi + 1e-6;

    // 6. Minimum Cover Check
    const minCoverFt = Math.max(live.minCoverReqFt, geom.odIn / 12);
    const minCoverPass = H >= minCoverFt - 1e-6;

    // Pipe/Soil Load Sharing Fraction
    const totalStiffness = pipeStiffnessTermDesign + soilStiffnessTerm;
    const soilSupportSharePct = totalStiffness > 0 ? (soilStiffnessTerm / totalStiffness) * 100 : 0;
    const pipeStiffnessSharePct = 100 - soilSupportSharePct;

    // Overall structural status
    const overallPass = deflectionPass && bucklingPass && crushingPass && minCoverPass;

    // Advisories / engineering findings
    const advisories = [];
    if (!minCoverPass) {
      advisories.push(`Depth of cover (${H.toFixed(1)} ft) is below recommended minimum cover (${minCoverFt.toFixed(1)} ft = max(${live.minCoverReqFt} ft, 1×OD)) for ${live.liveLoadType.toUpperCase()} loading.`);
    }
    if (!deflectionPass) {
      advisories.push(`Ring deflection (${deflectionPct.toFixed(2)}%) exceeds PPI/AWWA M55 DR ${dr.toFixed(1)} limit (${deflectionLimitPct.toFixed(1)}%). Increase embedment compaction (E'), increase cover depth, or choose a lower DR.`);
    }
    if (!bucklingPass) {
      advisories.push(`Buckling safety factor (${bucklingSF.toFixed(2)}) is below required N = ${safetyFactorReq.toFixed(1)}. Improve soil compaction (E'), lower DR, or mitigate groundwater/vacuum.`);
    }
    if (!crushingPass) {
      advisories.push(`Wall ring compressive stress (${wallCompStressPsi.toFixed(0)} psi) exceeds allowable (${allowCompStressPsi.toFixed(0)} psi). Select a lower DR pipe.`);
    }
    if (!constrainedValid && ePrimePsi > 0) {
      advisories.push(`Shallow burial (H < 2.0 ft): soil arching is reduced; Luscher constrained buckling is linearly attenuated toward unconstrained Timoshenko capacity.`);
    }
    if (Hw > 0 && vacuumPsi > 0) {
      advisories.push(`Combined groundwater (Hw = ${Hw.toFixed(1)} ft) and internal vacuum (${vacuumPsi.toFixed(1)} psi) govern external buckling check.`);
    }
    if (advisories.length === 0) {
      advisories.push(`All PPI Chapter 6 Section 3 burial & surface-load checks PASS with comfortable margins (Deflection ${deflectionPct.toFixed(2)}% ≤ ${deflectionLimitPct.toFixed(1)}%, Buckling SF = ${bucklingSF.toFixed(2)} ≥ ${safetyFactorReq.toFixed(1)}, Crushing SF = ${crushingSF.toFixed(1)}).`);
    }

    return {
      material: mat,
      geometry: geom,
      tempF,
      ft,
      mEAuto,
      coverDepthFt: H,
      waterHeightAboveCrownFt: Hw,
      soilUnitWeightPcf,
      trenchWidthFt,
      soilClass,
      compactionId,
      ePrimePsi,
      ePrimeTablePsi,
      loadDuration,
      eLongPsi,
      eShortPsi,
      eDynamicPsi,
      eDesignPsi,
      earthLoadPsf,
      earthLoadPsi,
      marstonPsi,
      hydroCrownPsi,
      hydroSpringlinePsi,
      live,
      liveLoadPsi,
      vacuumPsi,
      totalVerticalLoadPsi,
      totalExternalPressurePsi,
      beddingK,
      lagFactorDL,
      pipeStiffnessPsi,
      pipeStiffnessTermDesign,
      soilStiffnessTerm,
      soilSupportSharePct,
      pipeStiffnessSharePct,
      deflectionPct,
      deflectionShortPct,
      deflectionLongPct,
      deflectionIn,
      deflectionLimitPct,
      deflectionMarginPct,
      deflectionPass,
      safetyFactorReq,
      rB,
      bPrime,
      constrainedValid,
      pCrConstrainedPsi,
      pWcAllowablePsi,
      pCrUnconstrainedPsi,
      pCrGoverningPsi,
      pAllowBucklingPsi,
      bucklingSF,
      bucklingPass,
      fullVacuumSF,
      fullVacuumPass,
      wallCompStressPsi,
      allowCompStressPsi,
      crushingSF,
      crushingPass,
      minCoverFt,
      minCoverPass,
      overallPass,
      advisories,
    };
  }

  /**
   * Depth-of-Cover sweep for interactive sensitivity chart (H = 1..25 ft)
   */
  function sweepCoverDepth(params, depths) {
    const pts = depths || [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 25];
    return pts.map((h) => {
      // Scale Hw only up to h so groundwater stays physically below ground surface
      const subParams = Object.assign({}, params, {
        coverDepthFt: h,
        waterHeightAboveCrownFt: Math.min(finite(params.waterHeightAboveCrownFt, 0), h),
      });
      const r = calcSection3(subParams, h);
      return {
        depthFt: h,
        earthLoadPsi: r.earthLoadPsi,
        liveLoadPsi: r.liveLoadPsi,
        hydroCrownPsi: r.hydroCrownPsi,
        totalVerticalLoadPsi: r.totalVerticalLoadPsi,
        deflectionPct: r.deflectionPct,
        deflectionLimitPct: r.deflectionLimitPct,
        bucklingSF: Math.min(r.bucklingSF, 25),
        crushingSF: Math.min(r.crushingSF, 50),
        overallPass: r.overallPass,
      };
    });
  }

  /**
   * Multi-DR comparison matrix (reconstructs Tables 1-3 A/B + Section 3 burial status)
   */
  function calcDrMatrix(params) {
    return STANDARD_DRS.map((dr) => {
      const p = Object.assign({}, params, { dr, controlMode: 'OD' });
      const s1 = calcSection1(p);
      const s3 = calcSection3(p);
      return {
        dr,
        tMinIn: s1.geometry.tMinIn,
        idAvgIn: s1.geometry.idAvgIn,
        prPsi: s1.prPsi,
        wprPsi: s1.wprPsi,
        waveCelerityFps: s1.waveCelerityFps,
        maxDvRecFps: s1.maxAllowableDvRecFps,
        maxDvOccFps: s1.maxAllowableDvOccFps,
        deflectionPct: s3.deflectionPct,
        deflectionLimitPct: s3.deflectionLimitPct,
        bucklingSF: s3.bucklingSF,
        wallCompStressPsi: s3.wallCompStressPsi,
        sec1Pass: s1.overallPass,
        sec3Pass: s3.overallPass,
        overallPass: s1.overallPass && s3.overallPass,
      };
    });
  }

  const PRESETS = {
    highway_h20: {
      id: 'highway_h20',
      name: 'Highway Crossing (AASHTO H20)',
      badge: 'Sec 3',
      desc: '12" IPS PE4710 DR17 under flexible asphalt road, 3.0 ft cover, Class II moderate compaction.',
      params: {
        materialId: 'PE4710',
        environmentId: 'water',
        sizingSystem: 'IPS',
        nominalSize: 12,
        controlMode: 'OD',
        dr: 17,
        tempF: 73.4,
        overrideFt: false,
        overrideEd: false,
        operatingPressurePsi: 100,
        deltaVRecFps: 1.5,
        deltaVOccFps: 4.0,
        pipeLengthFt: 1500,
        valveClosureSec: 2.0,
        manualSurgeMode: false,
        coverDepthFt: 3.0,
        waterHeightAboveCrownFt: 0,
        soilUnitWeightPcf: 120,
        soilClassId: 'class2',
        compactionId: 'moderate',
        overrideEPrime: false,
        liveLoadType: 'h20_flexible',
        impactFactor: 1.25,
        surchargePsf: 0,
        wheelLoadLb: 16000,
        wheelOffsetFt: 0,
        vacuumPsi: 0,
        beddingK: 0.10,
        lagFactorDL: 1.0,
        loadDuration: 'long_term',
        bucklingSafetyFactor: 2.0,
      },
    },
    shallow_heavy: {
      id: 'shallow_heavy',
      name: 'Shallow Haul Road (Critical Check)',
      badge: 'Alert',
      desc: '24" IPS PE4710 DR26 at shallow 2.0 ft cover under unpaved construction traffic — demonstrates deflection & cover failure.',
      params: {
        materialId: 'PE4710',
        environmentId: 'water',
        sizingSystem: 'IPS',
        nominalSize: 24,
        controlMode: 'OD',
        dr: 26,
        tempF: 85,
        overrideFt: false,
        overrideEd: false,
        operatingPressurePsi: 65,
        deltaVRecFps: 1.5,
        deltaVOccFps: 3.5,
        pipeLengthFt: 1000,
        valveClosureSec: 1.5,
        manualSurgeMode: false,
        coverDepthFt: 2.0,
        waterHeightAboveCrownFt: 0.5,
        soilUnitWeightPcf: 125,
        soilClassId: 'class4',
        compactionId: 'slight',
        overrideEPrime: false,
        liveLoadType: 'h20_flexible',
        impactFactor: 1.5,
        surchargePsf: 0,
        wheelLoadLb: 20000,
        wheelOffsetFt: 0,
        vacuumPsi: 0,
        beddingK: 0.10,
        lagFactorDL: 1.25,
        loadDuration: 'long_term',
        bucklingSafetyFactor: 2.0,
      },
    },
    rail_e80: {
      id: 'rail_e80',
      name: 'Railroad Crossing (Cooper E80)',
      badge: 'E80',
      desc: '16" DIPS PE4710 DR11 buried 5.0 ft under heavy Cooper E80 railway with crushed rock embedment.',
      params: {
        materialId: 'PE4710',
        environmentId: 'water',
        sizingSystem: 'DIPS',
        nominalSize: 16,
        controlMode: 'OD',
        dr: 11,
        tempF: 73.4,
        overrideFt: false,
        overrideEd: false,
        operatingPressurePsi: 150,
        deltaVRecFps: 2.0,
        deltaVOccFps: 5.0,
        pipeLengthFt: 2400,
        valveClosureSec: 3.0,
        manualSurgeMode: false,
        coverDepthFt: 5.0,
        waterHeightAboveCrownFt: 1.0,
        soilUnitWeightPcf: 125,
        soilClassId: 'class1',
        compactionId: 'moderate',
        overrideEPrime: false,
        liveLoadType: 'cooper_e80',
        impactFactor: 1.0,
        surchargePsf: 0,
        wheelLoadLb: 16000,
        wheelOffsetFt: 0,
        vacuumPsi: 0,
        beddingK: 0.10,
        lagFactorDL: 1.0,
        loadDuration: 'long_term',
        bucklingSafetyFactor: 2.0,
      },
    },
    deep_groundwater: {
      id: 'deep_groundwater',
      name: 'Deep Burial + Water Table + Vacuum',
      badge: 'Buckling',
      desc: '36" IPS PE4710 DR17 at 18 ft cover with 12 ft groundwater head and 10 psi negative surge vacuum.',
      params: {
        materialId: 'PE4710',
        environmentId: 'water',
        sizingSystem: 'IPS',
        nominalSize: 36,
        controlMode: 'OD',
        dr: 17,
        tempF: 73.4,
        overrideFt: false,
        overrideEd: false,
        operatingPressurePsi: 95,
        deltaVRecFps: 1.5,
        deltaVOccFps: 4.0,
        pipeLengthFt: 3000,
        valveClosureSec: 4.0,
        manualSurgeMode: false,
        coverDepthFt: 18.0,
        waterHeightAboveCrownFt: 12.0,
        soilUnitWeightPcf: 125,
        soilClassId: 'class2',
        compactionId: 'high',
        overrideEPrime: false,
        liveLoadType: 'h20_flexible',
        impactFactor: 1.0,
        surchargePsf: 0,
        wheelLoadLb: 16000,
        wheelOffsetFt: 0,
        vacuumPsi: 10.0,
        beddingK: 0.10,
        lagFactorDL: 1.0,
        loadDuration: 'long_term',
        bucklingSafetyFactor: 2.0,
      },
    },
    ppi_book_surge: {
      id: 'ppi_book_surge',
      name: 'PPI Textbook Ex. (pp. 162–163 WPR)',
      badge: 'Sec 1',
      desc: 'Exact handbook example: PE4710 DR17 (PR = 125 psi) with 150 psi occasional surge -> WPR reduced to 100 psi.',
      params: {
        materialId: 'PE4710',
        environmentId: 'water',
        sizingSystem: 'IPS',
        nominalSize: 12,
        controlMode: 'OD',
        dr: 17,
        tempF: 73.4,
        overrideFt: false,
        overrideEd: false,
        operatingPressurePsi: 100,
        deltaVRecFps: 1.5,
        deltaVOccFps: 4.0,
        pipeLengthFt: 1500,
        valveClosureSec: 1.0,
        manualSurgeMode: true,
        manualPsRecPsi: 40,
        manualPsOccPsi: 150,
        coverDepthFt: 4.0,
        waterHeightAboveCrownFt: 0,
        soilUnitWeightPcf: 120,
        soilClassId: 'class2',
        compactionId: 'moderate',
        overrideEPrime: false,
        liveLoadType: 'h20_rigid',
        impactFactor: 1.0,
        surchargePsf: 0,
        wheelLoadLb: 16000,
        wheelOffsetFt: 0,
        vacuumPsi: 0,
        beddingK: 0.10,
        lagFactorDL: 1.0,
        loadDuration: 'long_term',
        bucklingSafetyFactor: 2.0,
      },
    },
  };

  const api = {
    CONSTANTS: {
      GRAVITY_FT_S2,
      WATER_UNIT_WEIGHT_PCF,
      POISSON_PE,
      PSI_TO_KPA,
      PSI_TO_MPA,
      IN_TO_MM,
      FT_TO_M,
      FPS_TO_MS,
      PSF_TO_KPA,
      PCF_TO_KNM3,
    },
    MATERIALS,
    MODULUS_TEMP_MULTIPLIER_CURVE,
    SERVICE_ENVIRONMENTS,
    STANDARD_DRS,
    PIPE_SIZES,
    HOWARD_SOIL_TABLE,
    COMPACTION_LEVELS,
    H20_RIGID_TABLE,
    H20_FLEXIBLE_TABLE,
    COOPER_E80_TABLE,
    DEFLECTION_LIMIT_TABLE,
    PRESETS,
    finite,
    clamp,
    interpTable,
    getServiceTempFactor,
    getModulusTempMultiplier,
    getDeflectionLimitPct,
    getPipeGeometry,
    calcSection1,
    calcLiveLoad,
    calcSection3,
    sweepCoverDepth,
    calcDrMatrix,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PPIEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

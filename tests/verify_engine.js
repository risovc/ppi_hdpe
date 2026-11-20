'use strict';

const assert = require('assert');
const E = require('../engine.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

function approx(actual, expected, tol, label) {
  const diff = Math.abs(actual - expected);
  assert(
    Number.isFinite(actual) && diff <= tol,
    `${label || 'value'}: got ${actual}, expected ${expected} ± ${tol} (diff=${diff})`
  );
}

console.log('PPI Chapter 6 Calculation Engine — Verification Suite\n');

// 1. Section 1: ISO Pressure Rating (Eq. 1-1, 1-2, 1-3, 1-4)
test('Eq. 1-1: PE4710 DR17 Water at 73°F -> PR = 125.0 psi (pp. 162-163)', () => {
  const r = E.calcSection1({ materialId: 'PE4710', environmentId: 'water', dr: 17, tempF: 73 });
  approx(r.prPsi, 125.0, 1e-6, 'PR');
  approx(r.ft, 1.0, 1e-6, 'FT');
  approx(r.af, 1.0, 1e-6, 'AF');
});

test('Eq. 1-1: PE4710 DR11 Water at 73°F -> PR = 200.0 psi', () => {
  const r = E.calcSection1({ materialId: 'PE4710', environmentId: 'water', dr: 11, tempF: 73 });
  approx(r.prPsi, 200.0, 1e-6, 'PR');
});

test('Eq. 1-2: ID-controlled PE3608 IDR 9 Water at 73°F -> PR = 160.0 psi', () => {
  const r = E.calcSection1({ materialId: 'PE3608', environmentId: 'water', controlMode: 'ID', dr: 9, customIdIn: 9, tempF: 73 });
  // PR = 2 * 800 * 1 * 1 / (9 + 1) = 160
  approx(r.prPsi, 160.0, 1e-6, 'ID-controlled PR');
  approx(r.geometry.tMinIn, 1.0, 1e-6, 't_min');
  approx(r.geometry.odIn, 11.0, 1e-6, 'OD');
});

test('Table 1-2: Hydrocarbons AF = 0.5 halves PR', () => {
  const r = E.calcSection1({ materialId: 'PE4710', environmentId: 'hydrocarbons', dr: 11, tempF: 73 });
  approx(r.af, 0.5, 1e-6, 'AF');
  approx(r.prPsi, 100.0, 1e-6, 'PR hydrocarbons');
});

test('Ch. 3 Table A.2: Temperature derating PE4710 at 100°F (0.80) & 140°F (0.60) + manual override', () => {
  const r100 = E.calcSection1({ materialId: 'PE4710', environmentId: 'water', dr: 11, tempF: 100 });
  approx(r100.ft, 0.80, 1e-6, 'FT@100F');
  approx(r100.prPsi, 160.0, 1e-6, 'PR@100F');
  const r140 = E.calcSection1({ materialId: 'PE4710', environmentId: 'water', dr: 11, tempF: 140 });
  approx(r140.ft, 0.60, 1e-6, 'FT@140F');
  approx(r140.prPsi, 120.0, 1e-6, 'PR@140F');
  const rOv = E.calcSection1({ materialId: 'PE4710', environmentId: 'water', dr: 11, tempF: 140, overrideFt: true, manualFt: 0.75 });
  approx(rOv.ft, 0.75, 1e-6, 'manual FT');
  approx(rOv.prPsi, 150.0, 1e-6, 'PR manual FT');
});

test('Fuel Gas Codes (pp. 160-161): 49 CFR 192 cap 125/100 psi, CSA Z662 DF=0.40, LPG NFPA 58 cap 30 psig', () => {
  const cfr12 = E.calcSection1({ materialId: 'PE4710', environmentId: 'gas_49cfr192', nominalSize: 8, dr: 7.3, tempF: 73 });
  // raw = 2*500/(7.3-1) = 158.73 -> capped at 125
  approx(cfr12.prRawPsi, 1000 / 6.3, 1e-3, '49CFR raw');
  approx(cfr12.prPsi, 125.0, 1e-6, '49CFR <=12" cap');
  assert.strictEqual(cfr12.isCodeCapped, true);

  const cfr16 = E.calcSection1({ materialId: 'PE4710', environmentId: 'gas_49cfr192', nominalSize: 16, dr: 9, tempF: 73 });
  // raw = 2*500/8 = 125 -> capped at 100 for >12"
  approx(cfr16.prPsi, 100.0, 1e-6, '49CFR >12" cap');

  const csa = E.calcSection1({ materialId: 'PE4710', environmentId: 'gas_csa_z662', dr: 11, tempF: 73 });
  // HDS = 0.40 * 1600 = 640 -> PR = 2*640/10 = 128
  approx(csa.prPsi, 128.0, 1e-6, 'CSA Z662 PR');

  const lpg = E.calcSection1({ materialId: 'PE4710', environmentId: 'lpg_nfpa58', dr: 11, tempF: 73 });
  // HDS capped 800, AF=0.8 -> raw = 2*800*0.8/10 = 128 -> NFPA 58 cap 30 psig
  approx(lpg.prPsi, 30.0, 1e-6, 'LPG NFPA 58 cap');
});

// 2. Section 1: Water Hammer / Surge & WPR Textbook Example (pp. 162-165)
test('PPI Handbook pp. 162-163 Example: PE4710 DR17, 120 psi vs 150 psi occasional surge', () => {
  const c1 = E.calcSection1({
    materialId: 'PE4710', environmentId: 'water', dr: 17, tempF: 73,
    manualSurgeMode: true, manualPsRecPsi: 30, manualPsOccPsi: 120,
  });
  approx(c1.wprPsi, 125.0, 1e-6, 'Case 1 WPR remains 125 psi');

  const c2 = E.calcSection1({
    materialId: 'PE4710', environmentId: 'water', dr: 17, tempF: 73,
    manualSurgeMode: true, manualPsRecPsi: 30, manualPsOccPsi: 150,
  });
  approx(c2.wprPsi, 100.0, 1e-6, 'Case 2 WPR reduced to 100 psi');
});

test('Eq. 1-5, 1-6, 1-7 & Figure 1-1: Wave celerity a, Surge Ps, Critical Time TCR for SDR 7.3 & SDR 17', () => {
  // SDR 7.3 at 73.4°F: K=300000, Ed=150000 -> K/Ed = 2 -> a = 4660/sqrt(1 + 2*5.3) = 4660/sqrt(11.6) = 1368.22 fps
  const r73 = E.calcSection1({ materialId: 'PE4710', dr: 7.3, tempF: 73.4, deltaVOccFps: 7.0, pipeLengthFt: 1368.22 });
  approx(r73.waveCelerityFps, 4660 / Math.sqrt(11.6), 0.1, 'a(SDR 7.3)');
  // Ps at dV=7 fps -> 1368.22 * 7 / (2.31*32.2) = 128.76 psi (matches Figure 1-1 p. 165 ~129 psig!)
  approx(r73.psOccPsi, 128.76, 0.3, 'Ps(SDR 7.3, 7 fps) matches Fig 1-1');
  approx(r73.criticalTimeSec, 2.0, 0.01, 'TCR = 2L/a');

  // SDR 17 at 73.4°F: a = 4660/sqrt(1 + 2*15) = 4660/sqrt(31) = 836.96 fps
  const r17 = E.calcSection1({ materialId: 'PE4710', dr: 17, tempF: 73.4, deltaVOccFps: 7.0 });
  approx(r17.waveCelerityFps, 4660 / Math.sqrt(31), 0.1, 'a(SDR 17)');
  // Ps at dV=7 fps -> 836.96 * 7 / 74.382 = 78.77 psig (matches Figure 1-1 p. 165 ~79 psig!)
  approx(r17.psOccPsi, 78.77, 0.3, 'Ps(SDR 17, 7 fps) matches Fig 1-1');
});

// 3. Section 3: Surface Live Loads (Tables 3-3, 3-4, Cooper E80, Boussinesq)
test('Table 3-3 (H20 Rigid 12" Pavement) & Table 3-4 (H20 Unpaved/Flexible) exact lookups', () => {
  const rigid3 = E.calcLiveLoad({ liveLoadType: 'h20_rigid', coverDepthFt: 3.0, surchargePsf: 0 });
  approx(rigid3.baseLivePsf, 600, 1e-6, 'Table 3-3 @ 3 ft');
  const rigid9 = E.calcLiveLoad({ liveLoadType: 'h20_rigid', coverDepthFt: 9.0, surchargePsf: 0 });
  approx(rigid9.baseLivePsf, 0, 1e-6, 'Table 3-3 @ >8 ft neglect');

  const flex2 = E.calcLiveLoad({ liveLoadType: 'h20_flexible', coverDepthFt: 2.0, impactFactor: 1.0, surchargePsf: 0 });
  approx(flex2.baseLivePsf, 1340, 1e-6, 'Table 3-4 @ 2 ft');
  const flex4 = E.calcLiveLoad({ liveLoadType: 'h20_flexible', coverDepthFt: 4.0, impactFactor: 1.0, surchargePsf: 0 });
  approx(flex4.baseLivePsf, 500, 1e-6, 'Table 3-4 @ 4 ft');

  const e80 = E.calcLiveLoad({ liveLoadType: 'cooper_e80', coverDepthFt: 4.0, surchargePsf: 0 });
  approx(e80.baseLivePsf, 2650, 1e-6, 'Cooper E80 @ 4 ft');
});

test('Boussinesq point wheel load & lateral offset attenuation (r=0 vs r=H)', () => {
  const b0 = E.calcLiveLoad({ liveLoadType: 'boussinesq', coverDepthFt: 3.0, wheelLoadLb: 16000, wheelOffsetFt: 0, impactFactor: 1.0 });
  const expected0 = (3 * 16000) / (2 * Math.PI * 9);
  approx(b0.baseLivePsf, expected0, 1e-3, 'Boussinesq r=0');

  const bH = E.calcLiveLoad({ liveLoadType: 'boussinesq', coverDepthFt: 3.0, wheelLoadLb: 16000, wheelOffsetFt: 3.0, impactFactor: 1.0 });
  approx(bH.baseLivePsf, expected0 * Math.pow(2, -2.5), 1e-3, 'Boussinesq r=H');
});

// 4. Section 3: Modified Iowa Deflection, Luscher Buckling, Wall Crushing
test('Modified Iowa deflection exact analytical verification (12" PE4710 DR17, H=3 ft, H20 flex)', () => {
  const r = E.calcSection3({
    materialId: 'PE4710', nominalSize: 12, dr: 17, tempF: 73.4,
    coverDepthFt: 3.0, waterHeightAboveCrownFt: 0, soilUnitWeightPcf: 120,
    soilClassId: 'class2', compactionId: 'moderate', // E' = 2000 psi
    liveLoadType: 'h20_flexible', impactFactor: 1.0, surchargePsf: 0,
    beddingK: 0.10, lagFactorDL: 1.0, loadDuration: 'long_term',
  });
  // PE = 120*3/144 = 2.5 psi; PL = 710/144 = 4.930556 psi
  // pipeTerm = 2*29000 / (3*16^3) = 58000 / 12288 = 4.720052 psi
  // soilTerm = 0.061 * 2000 = 122.0 psi
  // defl% = 100 * 0.10 * (2.5 + 4.930556) / (4.720052 + 122.0) = 74.30556 / 126.720052 = 0.586375%
  approx(r.earthLoadPsi, 2.5, 1e-6, 'P_E');
  approx(r.liveLoadPsi, 710 / 144, 1e-6, 'P_L');
  approx(r.deflectionPct, 0.586375, 1e-3, 'Modified Iowa deflection %');
  assert.strictEqual(r.deflectionPass, true);
  assert.strictEqual(r.overallPass, true);
});

test('Luscher Constrained Buckling exact analytical verification (DR17, H=18 ft, Hw=12 ft, E\'=3000)', () => {
  const r = E.calcSection3({
    materialId: 'PE4710', nominalSize: 36, dr: 17, tempF: 73.4,
    coverDepthFt: 18.0, waterHeightAboveCrownFt: 12.0, soilUnitWeightPcf: 125,
    soilClassId: 'class2', compactionId: 'high', // E' = 3000 psi
    liveLoadType: 'none', vacuumPsi: 10.0,
    loadDuration: 'long_term', bucklingSafetyFactor: 2.0,
  });
  const rB = 1 - 0.33 * (12 / 18); // 0.78
  const bPrime = 1 / (1 + 4 * Math.exp(-0.065 * 18));
  const pCr = 5.65 * Math.sqrt(rB * bPrime * 3000 * (29000 / (12 * Math.pow(16, 3))));
  approx(r.rB, rB, 1e-6, 'R_B');
  approx(r.bPrime, bPrime, 1e-6, "B'");
  approx(r.pCrConstrainedPsi, pCr, 1e-4, 'Luscher P_cr');
  approx(r.pWcAllowablePsi, pCr / 2.0, 1e-4, 'Luscher P_wc (N=2)');
});

test('Wall Crushing Stress S = P_total * DR / 2 and temperature-adjusted allowable', () => {
  const r = E.calcSection3({
    materialId: 'PE4710', dr: 17, tempF: 100, // FT = 0.80 -> S_allow = 1150 * 0.80 = 920 psi
    coverDepthFt: 10.0, waterHeightAboveCrownFt: 0, soilUnitWeightPcf: 120,
    liveLoadType: 'none', surchargePsf: 0,
  });
  // P_E = 1200/144 = 8.333333 psi -> S = 8.333333 * 17 / 2 = 70.8333 psi
  approx(r.wallCompStressPsi, (1200 / 144) * 17 / 2, 1e-4, 'Wall comp stress');
  approx(r.allowCompStressPsi, 1150 * 0.80, 1e-4, 'Allowable comp stress @ 100F');
  assert.strictEqual(r.crushingPass, true);
});

test('Falsy zero handling: vacuumPsi=0, waterHeightAboveCrownFt=0, surchargePsf=0, wheelOffsetFt=0, E\'=0 override', () => {
  const r = E.calcSection3({
    materialId: 'PE4710', dr: 17, coverDepthFt: 4.0,
    waterHeightAboveCrownFt: 0, surchargePsf: 0, vacuumPsi: 0,
    overrideEPrime: true, manualEPrimePsi: 0,
  });
  assert.strictEqual(r.ePrimePsi, 0);
  assert.strictEqual(r.waterHeightAboveCrownFt, 0);
  assert.strictEqual(r.vacuumPsi, 0);
  assert(r.pCrGoverningPsi > 0, 'Falls back to Timoshenko unconstrained when E\'=0');
  approx(r.pCrGoverningPsi, r.pCrUnconstrainedPsi, 1e-6, 'Unconstrained fallback');
});

test('Presets sanity: highway_h20 passes, shallow_heavy flags alerts, ppi_book_surge WPR=100', () => {
  const hw = E.calcSection3(E.PRESETS.highway_h20.params);
  assert.strictEqual(hw.overallPass, true, 'highway_h20 should PASS');

  const sh = E.calcSection3(E.PRESETS.shallow_heavy.params);
  assert.strictEqual(sh.overallPass, false, 'shallow_heavy should FAIL');

  const bk = E.calcSection1(E.PRESETS.ppi_book_surge.params);
  approx(bk.wprPsi, 100.0, 1e-6, 'ppi_book_surge WPR = 100 psi');
});

test('Sweep & Multi-DR matrix monotonicity', () => {
  const sweep = E.sweepCoverDepth(E.PRESETS.highway_h20.params);
  assert(sweep.length === 15);
  assert(sweep[0].liveLoadPsi > sweep[sweep.length - 1].liveLoadPsi, 'Live load decays with depth');
  assert(sweep[0].earthLoadPsi < sweep[sweep.length - 1].earthLoadPsi, 'Earth load grows with depth');

  const matrix = E.calcDrMatrix(E.PRESETS.highway_h20.params);
  assert.strictEqual(matrix.length, 8);
  assert(matrix[0].prPsi > matrix[7].prPsi, 'PR decreases as DR increases');
  assert(matrix[0].waveCelerityFps > matrix[7].waveCelerityFps, 'Celerity decreases as DR increases');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);

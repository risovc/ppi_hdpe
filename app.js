/**
 * PPI Chapter 6 Interactive Visualizer — UI Controller
 */
(function (root) {
  'use strict';

  const E = root.PPIEngine;
  const V = root.PPIVisuals;

  const state = {
    tab: 'burial',
    units: 'USC',
    theme: 'light',
    activePresetId: 'highway_h20',
    params: Object.assign({}, E.PRESETS.highway_h20.params),
  };

  function $(id) {
    return document.getElementById(id);
  }

  function populateSelects() {
    const matSel = $('inpMaterial');
    matSel.innerHTML = Object.values(E.MATERIALS)
      .map((m) => `<option value="${m.id}">${m.label} — HDS ${m.hdsPsi} psi</option>`)
      .join('');

    const envSel = $('inpEnvironment');
    envSel.innerHTML = Object.values(E.SERVICE_ENVIRONMENTS)
      .map((e) => `<option value="${e.id}">${e.label}</option>`)
      .join('');

    const drSel = $('inpDrPreset');
    drSel.innerHTML = E.STANDARD_DRS
      .map((d) => `<option value="${d}">Standard DR ${d}</option>`)
      .join('') + `<option value="custom">Custom DR (slider)</option>`;

    const soilSel = $('inpSoilClass');
    soilSel.innerHTML = Object.values(E.HOWARD_SOIL_TABLE)
      .map((s) => `<option value="${s.id}">${s.label}</option>`)
      .join('');

    const compSel = $('inpCompaction');
    compSel.innerHTML = Object.values(E.COMPACTION_LEVELS)
      .map((c) => `<option value="${c.id}">${c.label}</option>`)
      .join('');

    const strip = $('presetsStrip');
    strip.innerHTML = '<span class="presets-label">Presets:</span>' + Object.values(E.PRESETS)
      .map((p) => `<button type="button" class="preset-btn" data-preset="${p.id}" title="${p.desc}">${p.name}</button>`)
      .join('');

    populateNominalSizes();
  }

  function populateNominalSizes() {
    const sys = state.params.sizingSystem === 'DIPS' ? 'DIPS' : 'IPS';
    const list = E.PIPE_SIZES[sys];
    const sel = $('inpNominalSize');
    sel.innerHTML = list
      .map((s) => `<option value="${s.nominal}">${s.nominal}" ${sys} (OD ${s.od}")</option>`)
      .join('');
    if (!list.some((s) => s.nominal === Number(state.params.nominalSize))) {
      state.params.nominalSize = list[0].nominal;
    }
    sel.value = String(state.params.nominalSize);
  }

  function syncControlsFromState() {
    const p = state.params;
    $('inpMaterial').value = p.materialId;
    $('inpEnvironment').value = p.environmentId;
    $('inpSizingSystem').value = p.sizingSystem;
    $('wrapNominalSize').style.display = p.sizingSystem === 'CUSTOM' ? 'none' : '';
    $('wrapCustomOd').style.display = p.sizingSystem === 'CUSTOM' ? '' : 'none';
    if (p.sizingSystem !== 'CUSTOM') populateNominalSizes();
    $('inpCustomOd').value = E.finite(p.customOdIn, 12.75);

    $('inpDr').value = p.dr;
    $('inpDrPreset').value = E.STANDARD_DRS.includes(Number(p.dr)) ? String(p.dr) : 'custom';

    $('inpLiveLoadType').value = p.liveLoadType;
    $('wrapImpactFactor').style.display =
      (p.liveLoadType === 'h20_flexible' || p.liveLoadType === 'boussinesq') ? '' : 'none';
    $('wrapBoussinesq').style.display = p.liveLoadType === 'boussinesq' ? '' : 'none';

    $('inpCoverDepth').value = p.coverDepthFt;
    $('inpImpactFactor').value = p.impactFactor;
    $('inpWheelLoad').value = p.wheelLoadLb;
    $('inpWheelOffset').value = p.wheelOffsetFt;
    $('inpSurcharge').value = p.surchargePsf;

    $('inpSoilClass').value = p.soilClassId;
    $('inpCompaction').value = p.compactionId;
    $('chkOverrideEPrime').checked = Boolean(p.overrideEPrime);
    $('wrapManualEPrime').style.display = p.overrideEPrime ? '' : 'none';
    if (p.manualEPrimePsi !== undefined) $('inpManualEPrime').value = p.manualEPrimePsi;

    $('inpWaterHeight').max = String(Math.max(1, p.coverDepthFt));
    if (p.waterHeightAboveCrownFt > p.coverDepthFt) {
      p.waterHeightAboveCrownFt = p.coverDepthFt;
    }
    $('inpWaterHeight').value = p.waterHeightAboveCrownFt;
    $('inpSoilWeight').value = p.soilUnitWeightPcf;
    $('inpVacuum').value = p.vacuumPsi;
    $('inpTempF').value = p.tempF;
    $('inpTempF2').value = p.tempF;
    $('inpLoadDuration').value = p.loadDuration;
    $('inpSafetyN').value = p.bucklingSafetyFactor;
    $('inpBeddingK').value = p.beddingK;
    $('inpLagDL').value = p.lagFactorDL;

    // Section 1 controls
    $('inpControlMode').value = p.controlMode;
    $('wrapCustomId').style.display = p.controlMode === 'ID' ? '' : 'none';
    $('inpCustomId').value = E.finite(p.customIdIn, 10.0);
    $('inpOpPressure').value = p.operatingPressurePsi;

    $('chkOverrideFt').checked = Boolean(p.overrideFt);
    $('wrapManualFt').style.display = p.overrideFt ? '' : 'none';
    $('chkOverrideEd').checked = Boolean(p.overrideEd);
    $('wrapManualEd').style.display = p.overrideEd ? '' : 'none';

    $('chkManualSurge').checked = Boolean(p.manualSurgeMode);
    $('wrapVelocitySurge').style.display = p.manualSurgeMode ? 'none' : '';
    $('wrapDirectSurge').style.display = p.manualSurgeMode ? '' : 'none';
    $('inpDvRec').value = p.deltaVRecFps;
    $('inpDvOcc').value = p.deltaVOccFps;
    $('inpPsRecManual').value = E.finite(p.manualPsRecPsi, 40);
    $('inpPsOccManual').value = E.finite(p.manualPsOccPsi, 150);
    $('inpPipeLen').value = p.pipeLengthFt;
    $('inpValveTime').value = p.valveClosureSec;
    $('inpKBulk').value = E.finite(p.kBulkPsi, 300000);

    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === state.activePresetId);
    });
  }

  function setKpiState(cardId, badgeId, pass, warnCond) {
    const card = $(cardId);
    const badge = $(badgeId);
    card.classList.remove('pass', 'warn', 'fail');
    badge.classList.remove('pass', 'warn', 'fail');
    const cls = !pass ? 'fail' : (warnCond ? 'warn' : 'pass');
    card.classList.add(cls);
    badge.classList.add(cls);
    badge.textContent = !pass ? 'FAIL' : (warnCond ? 'MARGINAL' : 'PASS');
  }

  function render() {
    const u = state.units;
    const p = state.params;
    const s1 = E.calcSection1(p);
    const s3 = E.calcSection3(p);
    const sweep = E.sweepCoverDepth(p);
    const matrix = E.calcDrMatrix(p);

    // Update numeric readout badges next to sliders
    $('valDr').textContent = `DR ${Number(p.dr).toFixed(1).replace(/\.0$/, '')}`;
    $('lblPipeSummary').textContent =
      p.sizingSystem === 'CUSTOM'
        ? `${V.fmtUnits(s3.geometry.odIn, 'in', u)} OD · DR ${p.dr}`
        : `${p.nominalSize}" ${p.sizingSystem} · DR ${p.dr}`;

    $('valCoverDepth').textContent = V.fmtUnits(s3.coverDepthFt, 'ft', u);
    $('valImpactFactor').textContent = `${Number(p.impactFactor).toFixed(2)}×`;
    $('valWheelOffset').textContent = V.fmtUnits(Number(p.wheelOffsetFt) || 0, 'ft', u);
    $('valSurcharge').textContent = V.fmtUnits(s3.live.surchargePsf, 'psf', u);
    $('valWaterHeight').textContent = V.fmtUnits(s3.waterHeightAboveCrownFt, 'ft', u);
    $('valTempF').textContent = V.fmtUnits(s3.tempF, 'temp', u);
    $('valTempF2').textContent = V.fmtUnits(s1.tempF, 'temp', u);
    $('lblTempFactorsHint').textContent =
      `Ch. 3 Table A.2: FT = ${s1.ftAuto.toFixed(2)} · Table B.1.2: ME = ${s1.mEAuto.toFixed(2)} · E = ${Math.round(s3.eDesignPsi).toLocaleString()} psi`;
    $('lblEPrimeAuto').textContent = `Table: ${s3.ePrimeTablePsi} psi`;
    if (!p.overrideEPrime) $('inpManualEPrime').value = s3.ePrimeTablePsi;

    $('lblEnvNote').textContent = s1.environment.note;
    $('lblFtAuto').textContent = s1.ftAuto.toFixed(2);
    if (!p.overrideFt) $('inpManualFt').value = s1.ftAuto.toFixed(2);
    $('lblEdAuto').textContent = `${Math.round(s1.edAuto).toLocaleString()} psi`;
    if (!p.overrideEd) $('inpManualEd').value = Math.round(s1.edAuto);
    $('valDvRec').textContent = V.fmtUnits(Number(p.deltaVRecFps) || 0, 'fps', u);
    $('valDvOcc').textContent = V.fmtUnits(Number(p.deltaVOccFps) || 0, 'fps', u);

    // ===== TAB 1: SECTION 3 BURIAL =====
    setKpiState('kpiDeflection', 'badgeDeflection', s3.deflectionPass, s3.deflectionPct > s3.deflectionLimitPct * 0.85);
    $('valKpiDeflection').textContent = `${s3.deflectionPct.toFixed(2)}%`;
    $('metaKpiDeflection').textContent = `Limit ≤ ${s3.deflectionLimitPct.toFixed(1)}% (ΔY = ${V.fmtUnits(s3.deflectionIn, 'in', u)})`;

    setKpiState('kpiBuckling', 'badgeBuckling', s3.bucklingPass, s3.bucklingSF < s3.safetyFactorReq * 1.25);
    $('valKpiBuckling').textContent = s3.bucklingSF > 99 ? 'SF >99' : `SF ${s3.bucklingSF.toFixed(2)}`;
    $('metaKpiBuckling').textContent = `Pwc ${V.fmtUnits(s3.pAllowBucklingPsi, 'psi', u)} vs ${V.fmtUnits(s3.totalExternalPressurePsi, 'psi', u)}`;

    setKpiState('kpiCrushing', 'badgeCrushing', s3.crushingPass, s3.crushingSF < 2.0);
    $('valKpiCrushing').textContent = V.fmtUnits(s3.wallCompStressPsi, 'psi', u);
    $('metaKpiCrushing').textContent = `Allow ${V.fmtUnits(s3.allowCompStressPsi, 'psi', u)} (SF ${s3.crushingSF.toFixed(1)})`;

    setKpiState('kpiCover', 'badgeCover', s3.minCoverPass, !s3.fullVacuumPass);
    $('valKpiCover').textContent = V.fmtUnits(s3.coverDepthFt, 'ft', u);
    $('metaKpiCover').textContent = `Min ≥ ${V.fmtUnits(s3.minCoverFt, 'ft', u)} · Full Vac ${s3.fullVacuumPass ? 'OK' : 'CHECK'}`;

    $('lblLiveLoadSource').textContent = s3.live.sourceLabel;
    $('lblBurialHint').textContent =
      p.liveLoadType === 'boussinesq'
        ? 'Drag the wheel horizontally on the diagram to change offset r'
        : 'Switch load model to Boussinesq to drag a point wheel load across the surface';

    $('burialSceneContainer').innerHTML = V.renderBurialScene(s3, p, u);
    bindWheelDrag();

    $('burialLoadStrip').innerHTML = `
      <div class="mini-stat">
        <div class="mini-stat-label">Earth Prism Load (P_E)</div>
        <div class="mini-stat-val">${V.fmtUnits(s3.earthLoadPsi, 'psi', u)}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">Surface Live Load (P_L)</div>
        <div class="mini-stat-val">${V.fmtUnits(s3.liveLoadPsi, 'psi', u)}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">Pipe Stiffness (ASTM D2412)</div>
        <div class="mini-stat-val">${V.fmtUnits(s3.pipeStiffnessPsi, 'psi', u)}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">Soil vs. Pipe Load Share</div>
        <div class="mini-stat-val">${s3.soilSupportSharePct.toFixed(0)}% / ${s3.pipeStiffnessSharePct.toFixed(0)}%</div>
      </div>
    `;

    $('depthChartContainer').innerHTML = V.renderDepthSensitivityChart(sweep, s3.coverDepthFt, s3.deflectionLimitPct, u);
    bindDepthChartClick();

    const advEl = $('burialAdvisories');
    advEl.className = `advisory-box ${s3.overallPass ? 'pass' : 'fail'}`;
    advEl.innerHTML = `<strong>Engineering Assessment (PPI Ch. 6 Sec. 3):</strong><ul>${s3.advisories.map((a) => `<li>${a}</li>`).join('')}</ul>`;

    // ===== TAB 2: SECTION 1 PRESSURE & SURGE =====
    $('valKpiPR').textContent = V.fmtUnits(s1.prPsi, 'psi_bar', u);
    $('badgePR').textContent = s1.isCodeCapped ? 'CODE CAP' : 'RATED';
    $('metaKpiPR').textContent = `HDS ${s1.effectiveHdsPsi} · FT ${s1.ft.toFixed(2)} · AF ${s1.af.toFixed(1)}`;

    setKpiState('kpiWPR', 'badgeWPR', s1.overallPass, s1.wprPsi < s1.prPsi - 0.1);
    $('valKpiWPR').textContent = V.fmtUnits(s1.wprPsi, 'psi_bar', u);
    $('metaKpiWPR').textContent = s1.wprGoverning;

    $('valKpiCelerity').textContent = V.fmtUnits(s1.waveCelerityFps, 'fps', u);
    $('metaKpiCelerity').textContent = `${s1.surgePsiPerFps.toFixed(2)} psi/fps (Ed ${(s1.edPsi / 1000).toFixed(0)}k)`;

    $('valKpiTcr').textContent = `${s1.criticalTimeSec.toFixed(2)} s`;
    const tcrBadge = $('badgeTcr');
    tcrBadge.className = `badge ${s1.isSuddenClosure ? 'warn' : 'pass'}`;
    tcrBadge.textContent = s1.isSuddenClosure ? 'SUDDEN' : 'SLOW';
    $('metaKpiTcr').textContent = s1.isSuddenClosure
      ? `Tc ${s1.valveClosureSec.toFixed(1)}s ≤ T_CR (Full Joukowsky)`
      : `Tc ${s1.valveClosureSec.toFixed(1)}s > T_CR (Atten. ${V.fmtUnits(s1.psOccAttenuatedPsi, 'psi', u)})`;

    $('pipeCutawayContainer').innerHTML = V.renderPipeCutaway(s1, u);
    $('wprGaugeContainer').innerHTML = V.renderWprGauge(s1, u);
    $('figure11Container').innerHTML = V.renderFigure11(s1, p, u);
    $('tempCurvesContainer').innerHTML = V.renderTempCurves(s1, u);

    // ===== TAB 3: MULTI-DR MATRIX & LIVE FORMULAS =====
    $('drMatrixTbody').innerHTML = matrix
      .map((row) => {
        const isActive = Math.abs(row.dr - Number(p.dr)) < 0.05;
        const badgeCls = row.overallPass ? 'pass' : (row.sec3Pass ? 'warn' : 'fail');
        const badgeTxt = row.overallPass ? 'PASS' : (!row.sec3Pass ? 'BURIAL FAIL' : 'PRESS FAIL');
        return `
          <tr class="clickable-row ${isActive ? 'active-dr' : ''}" data-dr="${row.dr}">
            <td><strong>DR ${row.dr}</strong></td>
            <td>${V.fmtUnits(row.tMinIn, 'in', u)}</td>
            <td>${V.fmtUnits(row.idAvgIn, 'in', u)}</td>
            <td>${V.fmtUnits(row.prPsi, 'psi_bar', u)}</td>
            <td>${V.fmtUnits(row.wprPsi, 'psi_bar', u)}</td>
            <td>${V.fmtUnits(row.waveCelerityFps, 'fps', u)}</td>
            <td>${V.fmtUnits(row.maxDvRecFps, 'fps', u)}</td>
            <td>${V.fmtUnits(row.maxDvOccFps, 'fps', u)}</td>
            <td>${row.deflectionPct.toFixed(2)}% / ${row.deflectionLimitPct.toFixed(1)}%</td>
            <td>${row.bucklingSF > 99 ? '>99' : row.bucklingSF.toFixed(2)}</td>
            <td>${V.fmtUnits(row.wallCompStressPsi, 'psi', u)}</td>
            <td><span class="badge ${badgeCls}">${badgeTxt}</span></td>
          </tr>`;
      })
      .join('');

    document.querySelectorAll('#drMatrixTbody tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        state.params.dr = Number(tr.dataset.dr);
        state.activePresetId = null;
        syncControlsFromState();
        render();
      });
    });

    $('liveEquationsGrid').innerHTML = `
      <div class="eq-card">
        <h4>Eq. (1-1 / 1-2) ISO Pressure Rating</h4>
        <div class="eq-formula">PR = (2 · HDS · F_T · A_F) / (${p.controlMode === 'ID' ? 'IDR + 1' : 'DR − 1'})</div>
        <div class="eq-sub">= (2 × ${s1.effectiveHdsPsi} × ${s1.ft.toFixed(2)} × ${s1.af.toFixed(1)}) / ${p.controlMode === 'ID' ? (s1.geometry.dr + 1).toFixed(1) : (s1.geometry.dr - 1).toFixed(1)} = <strong>${s1.prRawPsi.toFixed(1)} psi</strong>${s1.isCodeCapped ? ` → Capped at ${s1.prPsi.toFixed(1)} psi` : ''}</div>
      </div>
      <div class="eq-card">
        <h4>Eq. (1-5, 1-6, 1-7) Surge Celerity, Ps &amp; Critical Time</h4>
        <div class="eq-formula">a = 4660 / √[1 + (K_BULK / E_d)(DR − 2)] · Ps = a·ΔV / (2.31g)</div>
        <div class="eq-sub">a = <strong>${s1.waveCelerityFps.toFixed(1)} fps</strong> · Ps(occ) = <strong>${s1.psOccPsi.toFixed(1)} psi</strong> · T_CR = 2(${p.pipeLengthFt})/${s1.waveCelerityFps.toFixed(0)} = <strong>${s1.criticalTimeSec.toFixed(2)} s</strong></div>
      </div>
      <div class="eq-card">
        <h4>Sec. 3 — Modified Iowa Ring Deflection</h4>
        <div class="eq-formula">ΔY/D_M (%) = 100·K·(D_L·P_E + P_L) / [ 2E/(3(DR−1)³) + 0.061·E' ]</div>
        <div class="eq-sub">= 100(${s3.beddingK})(${s3.lagFactorDL}×${s3.earthLoadPsi.toFixed(2)} + ${s3.liveLoadPsi.toFixed(2)}) / (${s3.pipeStiffnessTermDesign.toFixed(2)} + ${s3.soilStiffnessTerm.toFixed(1)}) = <strong>${s3.deflectionPct.toFixed(2)}%</strong> (Limit ${s3.deflectionLimitPct.toFixed(1)}%)</div>
      </div>
      <div class="eq-card">
        <h4>Sec. 3 — Luscher Constrained Buckling &amp; Wall Crushing</h4>
        <div class="eq-formula">P_wc = (5.65/N)·√[ R_B·B'·E'·E / (12(DR−1)³) ] · S = P_tot·DR / 2</div>
        <div class="eq-sub">R_B = ${s3.rB.toFixed(3)}, B' = ${s3.bPrime.toFixed(3)} → P_wc = <strong>${s3.pAllowBucklingPsi.toFixed(1)} psi</strong> (SF ${s3.bucklingSF.toFixed(2)}) · S = <strong>${s3.wallCompStressPsi.toFixed(1)} psi</strong> ≤ ${s3.allowCompStressPsi.toFixed(0)} psi</div>
      </div>
    `;
  }

  function bindDepthChartClick() {
    const svg = $('depthChartSvg');
    if (!svg) return;
    svg.addEventListener('click', (ev) => {
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const svgX = ((ev.clientX - rect.left) / rect.width) * vb.width;
      const padL = Number(svg.dataset.padL);
      const plotW = Number(svg.dataset.plotW);
      const maxD = Number(svg.dataset.maxD);
      const frac = E.clamp((svgX - padL) / plotW, 0, 1);
      const newH = Math.round((1 + frac * (maxD - 1)) * 4) / 4;
      state.params.coverDepthFt = newH;
      state.activePresetId = null;
      syncControlsFromState();
      render();
    });
  }

  function bindWheelDrag() {
    const wheel = $('draggableWheel');
    const svg = $('burialSceneSvg');
    if (!wheel || !svg) return;
    let dragging = false;

    const updateFromClientX = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const svgX = ((clientX - rect.left) / rect.width) * vb.width;
      const offsetFt = E.clamp(Math.round(((svgX - 380) / 30) * 4) / 4, -8, 8);
      state.params.wheelOffsetFt = offsetFt;
      state.activePresetId = null;
      $('inpWheelOffset').value = offsetFt;
      render();
    };

    wheel.addEventListener('pointerdown', (ev) => {
      dragging = true;
      ev.preventDefault();
      if (wheel.setPointerCapture) wheel.setPointerCapture(ev.pointerId);
    });
    window.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      updateFromClientX(ev.clientX);
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });
  }

  function switchTab(tabId) {
    state.tab = tabId;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `pane-${tabId}`);
    });
  }

  function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    $('btnUnitUSC').addEventListener('click', () => {
      state.units = 'USC';
      $('btnUnitUSC').classList.add('active');
      $('btnUnitSI').classList.remove('active');
      render();
    });

    $('btnUnitSI').addEventListener('click', () => {
      state.units = 'SI';
      $('btnUnitSI').classList.add('active');
      $('btnUnitUSC').classList.remove('active');
      render();
    });

    $('btnThemeToggle').addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', state.theme);
      $('btnThemeToggle').textContent = state.theme === 'light' ? 'Dark Theme' : 'Light Theme';
    });

    $('btnResetDefaults').addEventListener('click', () => {
      applyPreset('highway_h20');
    });

    $('presetsStrip').addEventListener('click', (ev) => {
      const btn = ev.target.closest('.preset-btn');
      if (!btn) return;
      applyPreset(btn.dataset.preset);
      if (btn.dataset.preset === 'ppi_book_surge') switchTab('pressure');
      else switchTab('burial');
    });

    const bindNum = (id, key, post) => {
      $(id).addEventListener('input', (ev) => {
        const v = parseFloat(ev.target.value);
        if (!Number.isFinite(v)) return;
        state.params[key] = v;
        state.activePresetId = null;
        if (post) post(v);
        syncControlsFromState();
        render();
      });
    };

    const bindStr = (id, key, post) => {
      $(id).addEventListener('change', (ev) => {
        state.params[key] = ev.target.value;
        state.activePresetId = null;
        if (post) post(ev.target.value);
        syncControlsFromState();
        render();
      });
    };

    const bindChk = (id, key) => {
      $(id).addEventListener('change', (ev) => {
        state.params[key] = ev.target.checked;
        state.activePresetId = null;
        syncControlsFromState();
        render();
      });
    };

    bindStr('inpMaterial', 'materialId');
    bindStr('inpEnvironment', 'environmentId');
    bindStr('inpSizingSystem', 'sizingSystem');
    bindNum('inpNominalSize', 'nominalSize');
    bindNum('inpCustomOd', 'customOdIn');
    bindNum('inpDr', 'dr');
    $('inpDrPreset').addEventListener('change', (ev) => {
      if (ev.target.value !== 'custom') {
        state.params.dr = Number(ev.target.value);
        state.activePresetId = null;
        syncControlsFromState();
        render();
      }
    });

    bindStr('inpLiveLoadType', 'liveLoadType');
    bindNum('inpCoverDepth', 'coverDepthFt');
    bindNum('inpImpactFactor', 'impactFactor');
    bindNum('inpWheelLoad', 'wheelLoadLb');
    bindNum('inpWheelOffset', 'wheelOffsetFt');
    bindNum('inpSurcharge', 'surchargePsf');

    bindStr('inpSoilClass', 'soilClassId');
    bindStr('inpCompaction', 'compactionId');
    bindChk('chkOverrideEPrime', 'overrideEPrime');
    bindNum('inpManualEPrime', 'manualEPrimePsi');
    bindNum('inpWaterHeight', 'waterHeightAboveCrownFt');
    bindNum('inpSoilWeight', 'soilUnitWeightPcf');
    bindNum('inpVacuum', 'vacuumPsi');
    bindNum('inpTempF', 'tempF');
    bindNum('inpTempF2', 'tempF');
    bindStr('inpLoadDuration', 'loadDuration');
    bindNum('inpSafetyN', 'bucklingSafetyFactor');
    bindNum('inpBeddingK', 'beddingK');
    bindNum('inpLagDL', 'lagFactorDL');

    bindStr('inpControlMode', 'controlMode');
    bindNum('inpCustomId', 'customIdIn');
    bindNum('inpOpPressure', 'operatingPressurePsi');
    bindChk('chkOverrideFt', 'overrideFt');
    bindNum('inpManualFt', 'manualFt');
    bindChk('chkOverrideEd', 'overrideEd');
    bindNum('inpManualEd', 'manualEdPsi');
    bindChk('chkManualSurge', 'manualSurgeMode');
    bindNum('inpDvRec', 'deltaVRecFps');
    bindNum('inpDvOcc', 'deltaVOccFps');
    bindNum('inpPsRecManual', 'manualPsRecPsi');
    bindNum('inpPsOccManual', 'manualPsOccPsi');
    bindNum('inpPipeLen', 'pipeLengthFt');
    bindNum('inpValveTime', 'valveClosureSec');
    bindNum('inpKBulk', 'kBulkPsi');
  }

  function applyPreset(presetId) {
    const preset = E.PRESETS[presetId];
    if (!preset) return;
    state.activePresetId = presetId;
    state.params = Object.assign({}, preset.params);
    syncControlsFromState();
    render();
  }

  function init() {
    populateSelects();
    syncControlsFromState();
    bindEvents();
    render();
  }

  root.PPIApp = {
    state,
    applyPreset,
    switchTab,
    render,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);

# PPI Chapter 6 — PE Pipe Burial & Pressure Visualizer

Zero-dependency, offline-ready interactive engineering web app grounded in the **Plastics Pipe Institute (PPI) Handbook of Polyethylene Pipe (2nd Ed.) — Chapter 6 (Sections 1 & 3)**, **Chapter 3 Appendix (Tables A.2 & B.1.2)**, and **AWWA M55**.

## Features
- **Buried Pipe vs. Surface Load (Ch. 6 Sec. 3)**: AASHTO H20 Flexible/Unpaved (Table 3-4), AASHTO H20 12" Rigid Pavement (Table 3-3), Cooper E80 Railway, draggable Boussinesq point wheel load, Howard $E'$ table (ASTM D2321 Class I–IV + override), groundwater table ($H_w$), Modified Iowa ring deflection, Luscher constrained & Timoshenko unconstrained buckling, wall crushing stress, minimum cover/vacuum check, and clickable cover-depth sensitivity chart.
- **Pipe Cutaway, Pressure Rating & Water Hammer Surge (Ch. 6 Sec. 1)**: Scaled OD/ID/DR/+12% wall tolerance & hoop stress cutaway, WPR derating & $1.5\times / 2.0\times PR$ surge ceiling gauge, live Figure 1-1 SDR surge curves (Eq. 1-5 to 1-7), Fuel Gas regulatory codes (49 CFR 192, CSA Z662-07, NFPA 58 LPG), and Ch. 3 Table A.2 ($F_T$) & Table B.1.2 ($M_E$) curves with manual override toggles.
- **Multi-DR Matrix & Live Substituted Formulas**: Clickable SDR 7.3–32.5 comparison table + USC/SI unit toggle + Light/Dark theme.

## Deploy to Cloudflare Pages (via GitHub)
1. Unzip this archive and upload/push all files directly to the root of a GitHub repository.
2. In the **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**, select your repository.
3. Use these build settings:
   - **Framework preset**: `None`
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/`
4. Click **Save and Deploy** — Cloudflare Pages will host the app immediately with no build step.

## Run & Verify Locally
```bash
# Start local dev server (default port 8092)
node server.js

# Run independent engineering formula verification tests (16 checks)
node tests/verify_engine.js
```

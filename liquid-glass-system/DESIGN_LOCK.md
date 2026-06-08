# Design Lock Checklist

This document ensures the Liquid Glass design system remains deterministic and idempotent.

## ✅ Pre-Build Checklist

- [ ] **Node Version**: Using Node v18.19.0 (check `.nvmrc`)
- [ ] **Dependencies**: All versions pinned (no ^ or ~)
- [ ] **Lockfile**: `package-lock.json` committed and up-to-date
- [ ] **Tokens Only**: Design changes made only in `src/styles/tokens.css`
- [ ] **No Randomness**: No `Math.random()`, `random()`, or time-based styling
- [ ] **No Hardcoded Values**: All colors/blur/radii reference tokens
- [ ] **Deterministic Animations**: Fixed keyframes, no runtime generation

## ✅ Build Process

- [ ] **Install**: `npm ci --legacy-peer-deps` (not `npm install`)
- [ ] **Build**: `npm run build` produces identical output
- [ ] **Fingerprint**: `npm run postbuild` computes design hash
- [ ] **No Drift**: Fingerprint matches previous build
- [ ] **Visual Tests**: `npm run test:visual` passes

## ✅ Code Quality

- [ ] **ESLint**: `npm run lint` passes with no warnings
- [ ] **No Hardcoded Colors**: All values reference CSS variables
- [ ] **No Random Functions**: No `Math.random()` in UI code
- [ ] **Token References**: Components use `var(--token-name)`
- [ ] **Deterministic Animations**: Fixed durations from tokens

## ✅ Visual Stability

- [ ] **Screenshots**: Visual regression tests pass
- [ ] **No Drift**: < 0.5% pixel difference from baseline
- [ ] **Cross-Browser**: Chrome, Firefox, Safari screenshots match
- [ ] **Responsive**: Mobile/tablet layouts stable
- [ ] **Themes**: Light/dark theme transitions work

## ✅ Documentation

- [ ] **README**: Updated with deterministic workflow
- [ ] **Tokens**: All design values documented
- [ ] **Components**: Props and usage documented
- [ ] **Tests**: Visual test baselines updated if needed

## 🚨 Failure Conditions

**Build fails if:**
- Fingerprint changes without `tokens.css` changes
- Visual drift > 0.5% pixels detected
- Hardcoded values found in components
- Random functions used in UI code
- Dependencies not pinned to exact versions

**Only these changes are allowed:**
- Modifying `src/styles/tokens.css`
- Updating visual test baselines
- Regenerating design fingerprint

## 🔧 Troubleshooting

**Design drift detected:**
1. Check for hardcoded values in components
2. Verify no `Math.random()` usage
3. Ensure all animations use tokens
4. Check dependency versions are pinned

**Visual tests failing:**
1. Run `npm run test:visual:update` to update baselines
2. Review changes are intentional
3. Commit updated baselines with clear message

**Build not deterministic:**
1. Use `npm ci` instead of `npm install`
2. Check Node version matches `.nvmrc`
3. Verify all dependencies are pinned
4. Clear node_modules and reinstall

## 📋 Maintenance

**Weekly:**
- [ ] Run `npm run test:visual` to check for drift
- [ ] Verify fingerprint hasn't changed unexpectedly
- [ ] Check for dependency updates that might affect builds

**Before releases:**
- [ ] Update visual test baselines if design changed
- [ ] Regenerate design fingerprint
- [ ] Run full test suite
- [ ] Document any design token changes

**Emergency fixes:**
- [ ] Only modify `tokens.css` for design changes
- [ ] Never bypass fingerprint checks
- [ ] Always update baselines for intentional changes
- [ ] Document all design decisions

# Regression Test Checklist: Static Asset Serving & Proxy Logic

_Last updated: 2025-04-14_

## Purpose
Ensure all static asset and proxy bugs are resolved, and recent patches did not introduce regressions.

---

## 1. Directory Structure Verification
- [ ] All static JS files are in `public/js/` (served at `/js/`)
- [ ] All static CSS files are in `public/` (served at `/styles.css`)
- [ ] All images and favicon are in `assets/` (served at `/assets/`)
- [ ] SASS source is in `scss/` (not served directly)

---

## 2. Static Asset Endpoints
- [ ] `/assets/js/randomSentence.js` returns 200
- [ ] `/js/main.js` returns 200
- [ ] `/styles.css` returns 200
- [ ] `/favicon.ico` returns 200
- [ ] Requesting a missing asset (e.g., `/js/doesnotexist.js`) returns 404

---

## 3. SPA Fallback Logic
- [ ] Requesting `/not-a-real-page` returns `index.html` (SPA fallback)
- [ ] Requesting `/js/main.js` or `/assets/js/randomSentence.js` does NOT return `index.html`

---

## 4. Proxy Logic
- [ ] `/service/:encodedUrl` visually renders the proxied page
- [ ] Asset requests with referer set to a proxied page are correctly proxied
- [ ] Protocol-less URLs are automatically prepended with `https://`

---

## 5. Error Handling
- [ ] No double responses or "Can't set headers after they are sent" errors in logs
- [ ] No unexpected 404s for valid static assets
- [ ] Asset proxy returns 502 or 404 for truly missing or unreachable resources

---

## 6. Security
- [ ] No directory traversal is possible via asset URLs
- [ ] No static asset leakage from outside `public/` or `assets/`

---

## 7. Cross-Platform (Windows/Linux)
- [ ] SASS builds and assets serve correctly on both platforms

---

## 8. Notes & Issues Found
- [ ] Document any new bugs, edge cases, or regressions here

---

*Complete this checklist after each major change to static or proxy logic. Update as new issues are discovered or fixed.*

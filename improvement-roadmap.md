# Project Improvement Roadmap

_Last updated: 2025-04-15_

---
NOTES:
all files are in backup_root_package but still retain there original paths from there
Were CONVERTING files so as little changes as possible 
## 1. **Current State Overview**

### **Architecture**
- **Backend:** Node.js (Express) server with Socket.IO, CORS, dotenv, EJS, Prisma, and Python proxy integration (FastAPI).
- **Frontend:** React + TypeScript (Vite), modular components, SASS-compiled CSS (legacy SCSS integrated as global styles). Static HTML and vanilla JS being migrated out.
- **Proxy:** Python FastAPI service (in `python-proxy/`) for advanced proxying and AI chat.
- **Assets:** Served from `/assets`, `/js`, `/public`, and `/scss` for SASS source. SCSS imported via Vite in React app.
- **Authentication:** JWT-based, with session management.
- **Testing:** Jest for JS, some Python tests.

### **File/Directory Structure**
- **`server.js`**: Main Express server, static middleware, SPA fallback, asset proxy, error handling, Socket.IO setup.
- **`routes/`**: Express routers (AI, user, proxy, index).
- **`python-proxy/`**: FastAPI app, routers, utils, requirements.
- **`public/`**: Main static assets (HTML, JS, CSS).
- **`assets/`**: Favicon, JS, images.
- **`js/`**: Core client JS modules (proxy, chat, auth, integration).
- **`scss/`**: SASS source, using modern `@use` and `math.div`.
- **`views/`**: EJS templates for server-rendered pages.
- **`games/`**: Game HTML files.
- **`db/`, `prisma/`**: Database models and setup.
- **`socket/`**: Socket.IO server logic.
- **`start-servers.js`**: Orchestrates starting Node and Python servers.

---

## 2. **Known Bugs & Issues**

### **Static Asset Serving**
- Overlapping static middleware caused double responses and `Can't set headers after they are sent` errors. _**[Patched, needs regression testing]**_
- Some assets may return 404 if not in the correct directory (e.g., `/js` must be in `public/js`).

### **Proxy & Health Checks**
- Health check route could send multiple responses. _**[Patched]**_
- Proxying assets sometimes fails if referer is not a proxied page.
- Protocol-less URLs to proxy cause Python errors. _**[Patched: protocol is now prepended]**_
- Asset proxy logic is complex and may not cover all edge cases (e.g., non-Google assets, custom domains).

### **Frontend/UX**
- Proxied content was previously dumped as raw HTML/JSON. _**[Patched: now visually rendered]**_
- SPA fallback could serve `index.html` for asset requests. _**[Patched]**_
- **React + TypeScript migration in progress:**
  - HomePage fully migrated, pixel-perfect to legacy.
  - NavBar, LoginPage, LoginForm modularized.
  - Vite build tool in use; all legacy SCSS integrated via main.tsx.
  - Font Awesome and all legacy class names preserved for perfect style match.
  - Old frontend configs and files cleaned up.

### **Cross-Platform Issues**
- SASS: Fixed for Windows/Linux by using `sass` package and modern syntax.

### **Testing**
- Coverage is partial; more integration and regression tests needed post-refactor.

---

## 3. **Detailed File Analysis**

---

## 4. **Recent Progress (2025-04-15)**

- **Backend Conversion Begins (2025-04-15):**
  - Starting migration of backend (Node.js/Express, Socket.IO, API, etc.) to modern, modular TypeScript.
  - All backend changes will be tracked here and the roadmap will be updated after every change.
  - `server.js` has been converted to `server.ts` as a minimal TypeScript port. All logic is preserved as in the original; further modularization and refactoring will be addressed in future steps.
  - Middleware, proxy, and server logic (lines 60–260 of legacy server.js) have been migrated to server.ts with minimal change. Some TypeScript linter issues (e.g., variable redeclaration, type overloads) are present and will be addressed in the next step.
  - /bare-info, legacy bare redirects, HTML/static file handlers, SPA fallback, and bare WebSocket logic (lines 460–660 of legacy server.js) have now been migrated to server.ts. Remaining linter issues only relate to legacy router imports and signatures involving unconverted code.

- **React + TypeScript + Vite migration underway:**
  - HomePage, NavBar, LoginPage, LoginForm converted to React components.
  - HomePage is now pixel-perfect to legacy HTML/CSS.
  - All legacy SCSS is loaded globally via Vite, using the same class names for seamless style transfer.
  - Font Awesome icons and structure preserved.
  - Project cleaned: old frontend directory/configs removed, tsconfig/app.json updated.
  - Linter warnings resolved (unused imports, config cleanup).
- **Next up:**
  - Continue migrating additional pages (chat, AI chat, games, etc.)
  - Modularize more JS logic (dynamic fact, proxy behavior, etc.)
  - Refactor styles to CSS Modules if needed for component isolation.
  - Expand/modernize UI as desired while preserving legacy look.

### **Key Files**
- **server.js**: Central logic for static serving, proxying, SPA fallback, error handling, Socket.IO, and environment config. _Complex, monolithic, needs modularization._
- **routes/python-proxy-routes.js**: Handles proxy endpoints, health checks, and error handling for Python proxy. _Has improved error handling._
- **python-proxy/main.py**: FastAPI app entry. Handles proxying, AI chat, and health checks. _Mostly stable, but error handling could be more robust._
- **js/proxy.js, js/proxy-integration.js, js/proxy-adapter.js**: Proxy logic on frontend, URL encoding, and integration with Python proxy. _Some duplicated logic._
- **js/python-proxy-client.js**: Handles client requests to Python proxy. _Uses localStorage for JWT._
- **public/index.html, login.html, chat.html, ai-chat.html**: Main pages. Scripts loaded as modules. _No React components._
- **scss/**: SASS modules using modern syntax. _No CSS-in-JS yet._
- **start-servers.js**: Starts both Node and Python proxies. _Some platform-specific code._
- **socket/chat-socket.js**: Socket.IO server logic. _Handles rooms, messages, error handling._
- **package.json**: Up-to-date dependencies, uses `sass` not `node-sass`.
- **python-proxy/routers/**: Modular FastAPI routers for proxy, AI, etc.

### **Other Notable Files**
- **.env, .env.sample, .env.test**: Environment configs for Node and Python.
- **README.md, Focus.md, TESTING.md**: Docs, but may need updating after migration.
- **jest.config.js, jest.setup.js**: Jest setup for JS tests.
- **prisma/**: DB schema and client setup.
- **assets/js/randomSentence.js**: JS for homepage random fact.

---

## 4. **React & TypeScript Migration Plan**

### **A. Preparation**
- [ ] Audit all JS modules for ES6+ compatibility and side effects.
- [ ] Identify reusable UI components (forms, chat, proxy input, game launcher, etc.).
- [ ] Clean up unused or duplicated code.
- [ ] Ensure all SASS is modular and ready for CSS Modules or CSS-in-JS.
- [ ] Document API endpoints (Node + Python).

### **B. Backend Migration (Node.js)**
- [ ] Convert `server.js` and `routes/` to TypeScript (`.ts`).
- [ ] Add type definitions for Express, Socket.IO, Axios, etc.
- [ ] Modularize server logic (static serving, proxy, sockets, API routes).
- [ ] Use `ts-node` or compile to JS for production.
- [ ] Add stricter error handling and types for proxy logic.
- [ ] Update tests for TypeScript compatibility.

### **C. Frontend Migration (React + TypeScript)**
- [ ] Bootstrap new React app in `frontend/` or `src/` (using Vite or CRA).
- [ ] Move static HTML (index, login, chat, AI chat, games) to React components.
- [ ] Convert JS modules to TypeScript (`.tsx` for React, `.ts` for logic).
- [ ] Integrate proxy logic via React hooks and context.
- [ ] Use React Router for SPA routing.
- [ ] Integrate Socket.IO client with React context/provider.
- [ ] Migrate SASS to CSS Modules or styled-components.
- [ ] Add unit and integration tests with React Testing Library and Jest.

### **D. Integration & Testing**
- [ ] Run side-by-side with legacy app, route `/react` to new frontend for gradual migration.
- [ ] Ensure all proxy/AI/chat/game features work in React app.
- [ ] Incrementally deprecate legacy HTML/JS as React coverage grows.
- [ ] Update documentation and onboarding.

### **E. Finalization**
- [ ] Remove unused legacy files.
- [ ] Harden security (CSRF, XSS, CORS, JWT).
- [ ] Optimize performance (lazy loading, code splitting, caching).
- [ ] Complete full test coverage.

---

## 5. **Immediate Next Steps**
- [ ] Regression test static asset serving and proxy logic.
- [ ] Document all API endpoints and data flows.
- [ ] Draft initial React component tree and TypeScript interfaces.
- [ ] Prepare dev environment for TypeScript and React (add configs, linters, etc.).

---

## 6. **References**
- See `Focus.md`, `.cursorcontext.json` for deep technical/project docs.
- See `README.md` and `TESTING.md` for setup and testing instructions.

---

*This roadmap will be updated as bugs are fixed and migration progresses. Please add issues or suggestions as you encounter them.*

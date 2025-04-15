# Project Improvement Roadmap

_Last updated: 2025-04-14_

---
NOTES:
all files are in backup_root_package but still retain there original paths from there
## 1. **Current State Overview**

### **Architecture**
- **Backend:** Node.js (Express) server with Socket.IO, CORS, dotenv, EJS, Prisma, and Python proxy integration (FastAPI).
- **Frontend:** Static HTML, vanilla JS modules, SASS-compiled CSS. No React yet.
- **Proxy:** Python FastAPI service (in `python-proxy/`) for advanced proxying and AI chat.
- **Assets:** Served from `/assets`, `/js`, `/public`, and `/scss` for SASS source.
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
- No React or TypeScript yet; codebase is harder to maintain and scale.

### **Cross-Platform Issues**
- SASS: Fixed for Windows/Linux by using `sass` package and modern syntax.

### **Testing**
- Coverage is partial; more integration and regression tests needed post-refactor.

---

## 3. **Detailed File Analysis**

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

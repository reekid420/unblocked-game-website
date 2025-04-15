# React Frontend Setup & Conventions

_Last updated: 2025-04-14_

---

## Installed Core Dependencies
- `react-router-dom` + `@types/react-router-dom` — Routing (SPA)
- `socket.io-client` + `@types/socket.io-client` — Real-time features (chat, AI chat)
- `sass` — SASS support (for styles, compatible with legacy SASS)
- `axios` — HTTP client for API/proxy requests

---

## Next Steps
1. **Configure SASS/CSS Modules**
   - Use `.module.scss` for component-scoped styles
   - Legacy SASS can be imported and incrementally migrated
2. **Set Up Routing**
   - Use `react-router-dom` for SPA navigation
   - Scaffold pages: Home, Login, Signup, Chat, AI Chat, Game Launcher, Proxy Input, Proxy Result, NotFound
3. **Add Context Providers**
   - Auth, Proxy, Socket, Theme
4. **Integrate with Backend**
   - Configure Vite dev server proxy for `/api`, `/proxy`, etc.
5. **Incremental Migration**
   - Move features/pages from legacy app as React components

---

## Conventions
- All new documentation goes in `/docs` unless otherwise specified by the user.
- Use TypeScript for all new components and logic (`.tsx`, `.ts`).
- Use SASS for styling, prefer CSS Modules or styled-components for new code.
- Keep React code in `/frontend/src`.

---

*Update this file as the frontend evolves.*

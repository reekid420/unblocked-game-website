# Initial React Component Tree & TypeScript Interface Draft

_Last updated: 2025-04-14_

---

## Component Tree Proposal

```
<App>
  ├── <Router>
  │     ├── <HomePage />
  │     ├── <LoginPage />
  │     ├── <SignupPage />
  │     ├── <ChatPage />
  │     ├── <AiChatPage />
  │     ├── <GameLauncherPage />
  │     ├── <ProxyInputPage />
  │     ├── <ProxyResultPage />
  │     ├── <NotFoundPage />
  │
  ├── <NavBar />
  ├── <Footer />
  ├── <SocketProvider />
  ├── <AuthProvider />
  ├── <ProxyProvider />
  ├── <ThemeProvider />
```

### **Component Details**
- **App**: Root, global providers
- **Router**: React Router (SPA)
- **HomePage**: Landing page, random fact, proxy input
- **LoginPage/SignupPage**: Auth forms
- **ChatPage/AiChatPage**: Chat UI, Socket.IO integration, AI chat
- **GameLauncherPage**: Select/play games
- **ProxyInputPage**: Enter URL to proxy
- **ProxyResultPage**: Visually renders proxied content
- **NotFoundPage**: 404 fallback
- **NavBar/Footer**: Navigation, branding
- **SocketProvider/AuthProvider/ProxyProvider/ThemeProvider**: Context for sockets, auth, proxy state, theming

---

## TypeScript Interface Drafts

```ts
// User Auth
interface User {
  id: string;
  username: string;
  email?: string;
  token?: string;
}

// Chat Message
interface ChatMessage {
  messageId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

// AI Chat Response
interface AiChatResponse {
  response: string;
  timestamp: string;
}

// Proxy Request
interface ProxyRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

// Proxy Response
interface ProxyResponse {
  data: string | Blob;
  contentType: string;
  status: number;
}

// Game
interface Game {
  id: string;
  name: string;
  url: string;
  description?: string;
}
```

---

*Update and expand these interfaces as new features/components are added.*

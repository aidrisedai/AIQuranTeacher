# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Frontend-only React 18 + TypeScript app built with Vite. It renders a chat UI alongside a virtual blackboard that “writes” the assistant’s responses with a typewriter animation. See README.md for user-facing details and screenshots.

Core commands
- Install dependencies: npm install
- Configure secrets: copy .env.example to .env and set OPENAI_API_KEY
- Start API server (Express): npm run server  # reads from .env, runs on http://localhost:8787
- Start dev server (Vite): npm run dev        # serves on http://localhost:5173 with /api proxy
- Start both (dev): npm run dev:all
- Production build: npm run build       # runs tsc then vite build
- Preview production build: npm run preview
- Type-check only (no emit): npm run typecheck
- Tests (Vitest):
  - Run all: npm test -- --run
  - Watch: npm run test:watch
  - Single file: npm test -- src/components/ChatInterface.test.tsx --run
- Linting: not configured in this repo (no ESLint/formatter config present)

High-level architecture
- Entry and bootstrapping
  - index.html mounts the React root.
  - src/main.tsx creates the root and renders <App /> inside React.StrictMode.
- Application shell and state orchestration (src/App.tsx)
  - Defines the Message shape and holds the primary state:
    - messages: Message[] — chat transcript rendered by ChatInterface.
    - blackboardContent: string — concatenated assistant responses for the blackboard.
  - handleSendMessage(content):
    - Appends a user Message to messages.
    - Simulates an assistant response via generateAIResponse with a setTimeout.
    - Appends the assistant Message to messages and accumulates blackboardContent with blank-line separators.
  - handleClearBlackboard(): clears blackboardContent.
  - Layout: two-pane UI — Blackboard on the left, ChatInterface on the right.
- Chat interface (src/components/ChatInterface.tsx)
  - Stateless with respect to messages (controlled by App). Accepts:
    - messages: Message[] and onSendMessage(content).
  - Renders a scrollable message list with simple avatars and timestamps.
  - Autoscrolls to the latest message using a ref and useEffect.
  - Input form triggers onSendMessage and clears the input.
- Blackboard with typewriter effect (src/components/Blackboard.tsx)
  - Props: content (string), onClear().
  - Internal state displayedContent and isWriting.
  - When content grows, uses setInterval (~20ms) to reveal characters progressively; shows a blinking cursor while writing; auto-scrolls to bottom as text grows.
  - Clear button calls onClear, which resets content in App.
- Styling
  - Plain CSS files colocated with components and imported directly (e.g., App.css, components/*.css).
- Build and tooling
  - vite.config.ts uses @vitejs/plugin-react; no custom aliases or proxies.
  - tsconfig.json is strict with bundler moduleResolution and isolatedModules; noEmit is true (type-checking only).

Extensibility notes
- AI integration point: generateAIResponse in src/App.tsx is a placeholder for rules-based replies. Replace it (and the setTimeout) with an async call to your AI provider as needed, then update message/blackboard updates upon completion.

# AI Quran Teacher - Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API Key

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI API Key

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

**Important:** Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

### 3. Start the Application

Run both the backend server and frontend dev server:

```bash
npm run dev:all
```

Or run them separately:

```bash
# Terminal 1 - Backend API server
npm run dev:server

# Terminal 2 - Frontend Vite dev server
npm run dev
```

### 4. Open the Application

Navigate to: `http://localhost:5173`

## How to Use the Drawing Feature

The chatbot can now draw on the Excalidraw blackboard! Try these commands:

### Basic Drawing Commands

- **"Draw a circle"** - Draws a circle
- **"Draw a red circle"** - Draws a red circle
- **"Draw an arrow"** - Draws an arrow
- **"Draw a rectangle"** - Draws a rectangle
- **"Write 'Hello'"** - Writes text on the board

### Advanced Drawing

- **"Draw a tree"** - AI will sketch a tree
- **"Draw a star"** - AI will sketch a star
- **"Draw a house"** - AI will sketch a house
- **"Draw anything!"** - AI interprets and draws custom objects

### Arabic Text

- **"Write 'بسم الله الرحمن الرحيم'"** - Writes Arabic text (RTL supported)

## Architecture

```
User Message
    ↓
ChatInterface → App.tsx → Backend APIs
                            ↓
                    ┌───────┴────────┐
                    ↓                ↓
                /api/chat      /api/plan
                    ↓                ↓
                (response)      (actions)
                                     ↓
                            /api/draw (if freehand)
                                     ↓
                                 (strokes)
                                     ↓
                            BlackboardExcalidraw
                                     ↓
                            Renders on canvas
```

## Features

✓ **Real-time AI responses** - Powered by OpenAI GPT-4o-mini
✓ **Excalidraw integration** - Professional drawing canvas
✓ **Smart action planning** - Converts natural language to drawing actions
✓ **Freehand drawing** - AI generates vector strokes for complex shapes
✓ **Loading states** - User-friendly feedback during API calls
✓ **Error handling** - Clear error messages with recovery suggestions
✓ **RTL support** - Arabic text rendering
✓ **Fallback parsing** - Local command parsing if API fails

## Troubleshooting

### "Server missing OPENAI_API_KEY" Error

**Cause:** The `.env` file is not configured or the API key is missing.

**Solution:**
1. Create a `.env` file from `.env.example`
2. Add your OpenAI API key: `OPENAI_API_KEY=sk-...`
3. Restart the server

### Drawing Not Appearing

**Cause:** API key issue or network error.

**Solution:**
1. Check browser console for errors
2. Verify `.env` file is configured
3. Check server logs for warnings
4. Try a simpler command like "Draw a circle"

### Port Already in Use

**Cause:** Port 8787 (backend) or 5173 (frontend) is already in use.

**Solution:**
1. Stop other processes using these ports
2. Or change the port in `.env` (backend) or `vite.config.ts` (frontend)

## Development

### Project Structure

```
AIQuranTeacher/
├── src/
│   ├── App.tsx                    # Main orchestrator
│   ├── components/
│   │   ├── ChatInterface.tsx      # Chat UI
│   │   └── BlackboardExcalidraw.tsx  # Excalidraw board
│   └── ...
├── server/
│   └── index.mjs                  # Express API server
├── .env                           # Environment variables (create this)
├── .env.example                   # Example env file
└── package.json
```

### API Endpoints

- `POST /api/chat` - Conversational responses
- `POST /api/plan` - Action planning (text → drawing actions)
- `POST /api/draw` - Stroke generation (instruction → vector strokes)
- `GET /api/health` - Health check

### Testing Drawing Flow

1. Start the app with `npm run dev:all`
2. Open browser to `http://localhost:5173`
3. Type: "Draw a red circle"
4. You should see:
   - Loading indicator in chat
   - Response: "Drawing on the board."
   - Circle appears on blackboard

## Need Help?

- Check the server console for startup warnings
- Verify OpenAI API key is valid and has credits
- Check browser console for frontend errors
- Ensure all dependencies are installed: `npm install`

## Credits

Built with:
- React + TypeScript
- Excalidraw
- Express.js
- OpenAI API
- Vite

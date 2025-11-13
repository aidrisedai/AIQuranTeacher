# Deployment Guide

## Local Development

The app is now running locally at:
- Frontend: http://localhost:5173
- API Server: http://localhost:8787

To run it again:
```bash
npm run dev:all
```

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variable in Vercel dashboard:
   - Go to your project settings
   - Add `OPENAI_API_KEY` environment variable
   - Redeploy

### Option 2: Docker

1. Build the image:
```bash
docker build -t ai-quran-teacher .
```

2. Run the container:
```bash
docker run -p 8787:8787 -e OPENAI_API_KEY=your_key_here ai-quran-teacher
```

3. Access at http://localhost:8787

### Option 3: Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and initialize:
```bash
railway login
railway init
```

3. Set environment variable:
```bash
railway variables set OPENAI_API_KEY=your_key_here
```

4. Deploy:
```bash
railway up
```

### Option 4: Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Use these settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `node server/index.mjs`
   - Add `OPENAI_API_KEY` environment variable

### Option 5: Manual VPS Deployment

1. Build the production assets:
```bash
npm run build
```

2. Copy to your server:
```bash
rsync -avz --exclude node_modules --exclude .git . user@your-server:/path/to/app
```

3. On the server:
```bash
cd /path/to/app
npm install --production
PORT=8787 OPENAI_API_KEY=your_key node server/index.mjs
```

4. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server/index.mjs --name ai-quran-teacher
pm2 save
pm2 startup
```

## Environment Variables

Required:
- `OPENAI_API_KEY` - Your OpenAI API key

Optional:
- `PORT` - Server port (default: 8787)

## Post-Deployment

After deploying, test the health endpoint:
```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{"ok": true}
```

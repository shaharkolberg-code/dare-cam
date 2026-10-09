# Dare Cam — Deploying Online Multiplayer

Local hotseat play needs nothing — just open `public/index.html` (or the redirect at `index.html`) in a browser.

**Online Room** play needs the server in this folder running somewhere reachable from the internet. Easiest free option: **Render**.

## Deploy to Render (free tier)

1. Put this `dare-cam` folder in its own git repo (or a subfolder of one) and push it to GitHub.
2. Go to [render.com](https://render.com) → New → Web Service → connect that repo.
3. Settings:
   - **Root directory**: `dare-cam` (if it's a subfolder of a bigger repo; otherwise leave blank)
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Instance type**: Free
4. Deploy. Render gives you a URL like `https://dare-cam-xyz.onrender.com`.
5. Open that URL in a browser → choose **Online Room** → **Create Room**. Because the page is served from that same address, the "Server Address" field already defaults to it — players just need the room code, not a URL to type in.
6. Send the link + room code to whoever's playing. Everyone opens the same URL on their own device, enters their name, and either creates or joins.

Render's free tier spins down when idle, so the first connection after a quiet period can take ~30 seconds to wake up — normal, not a bug.

## Other hosts

Any Node.js host works the same way (Railway, Fly.io, a VPS, etc.) — the requirements are just:
- Run `npm install` then `npm start` (or `node server.js`)
- Expose the `PORT` the server listens on (reads `process.env.PORT`, defaults to 3000)
- Support WebSocket connections (nearly all modern hosts do)

## What the server actually sees

Only text: player names, room codes, which prompt category/level/source was picked, and whatever text someone typed for a Crowd Prompt. **No video or audio ever reaches the server** — recording, preview, save, and email-sending all happen entirely on each player's own device, exactly like local mode.

## Running it yourself for testing

```
npm install
npm start
```

Then open `http://localhost:3000` in a couple of browser tabs/windows to test multiplayer locally before deploying.

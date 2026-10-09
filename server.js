// Dare Cam — online multiplayer server
// Plain Node.js + express (static hosting) + ws (WebSocket rooms).
// Keeps all video/audio local to each player's own device — the server only
// ever sees text: names, room codes, chosen modes, and typed prompts.

const path = require('path');
const http = require('http');
const express = require('express');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ---- Dare content (mirrors the client's local-mode bank) ----
const dareBank = {
  mild: {
    pose: [
      "Finger guns + a wink 🔫😉",
      "Dramatic hair flip in slow motion",
      "The 'shocked Pikachu' face",
      "One eyebrow raised, arms crossed, judging everyone",
      "Jazz hands + a gasp",
      "The classic 'royal wave'",
      "Strike a yoga tree pose (wobbling allowed)"
    ],
    line: [
      "\"I am... the chosen snack.\"",
      "\"You can't handle this much sparkle.\"",
      "\"This is my final form.\"",
      "\"Behold my majestic nonsense.\"",
      "\"Respect the pose or leave.\"",
      "\"This is a certified moment.\""
    ],
    confession: [
      "Confess your weirdest snack combo.",
      "Confess your most-used emoji.",
      "Confess a food you pretend to like but don't.",
      "Confess what you Google at 2am.",
      "Confess your go-to karaoke song.",
      "Confess the dumbest thing you believed as a kid."
    ]
  },
  medium: {
    pose: [
      "Superhero landing pose (on the floor is fine)",
      "Flex both arms like a bodybuilder mid-competition",
      "Point dramatically at the camera like a soap opera villain",
      "Slow-motion villain laugh while flexing",
      "Pose like you just won an award you didn't earn",
      "The 'caught red-handed' freeze frame"
    ],
    line: [
      "\"I didn't choose the party life, the party life chose me.\"",
      "\"I came, I saw, I overdramatized.\"",
      "\"I was born for this exact camera angle.\"",
      "\"I am objectively correct and extremely humble about it.\"",
      "\"Legends will speak of this pose.\"",
      "\"This is my villain origin story.\""
    ],
    confession: [
      "Confess the longest you've gone without doing laundry.",
      "Confess your most irrational fear.",
      "Confess the most unhinged text you've sent a friend.",
      "Confess a nickname you've secretly given yourself.",
      "Confess your most chaotic browser tab count right now.",
      "Confess a lie you told to get out of plans."
    ]
  },
  spicy: {
    pose: [
      "Full dramatic soap-opera forehead slap",
      "Pose like you just won an Oscar you absolutely did not deserve",
      "Recreate your most awkward school photo pose, on purpose",
      "The 'I just got dumped in a music video' stare into the distance",
      "Ugly-cry laugh combo, as exaggerated as possible",
      "Strike a pose like you're on the cover of a tabloid scandal"
    ],
    line: [
      "\"I am a disaster wrapped in glitter and I regret nothing.\"",
      "\"This is the moment my biopic begins.\"",
      "\"I peaked in a group chat screenshot once and I'm still coasting on it.\"",
      "\"Everything about this is a cry for help and I'm thriving.\"",
      "\"I would like to formally apologize to no one.\"",
      "\"This is my TED talk and nobody asked for it.\""
    ],
    confession: [
      "Confess the most embarrassing thing you've said to a crush.",
      "Confess a time you lied about liking something to fit in.",
      "Confess your weirdest conspiracy theory you kinda believe.",
      "Confess the most dramatic overreaction you've had this year.",
      "Confess a time you got caught talking about someone and had to recover.",
      "Confess your most unhinged 'ick' that makes zero sense."
    ]
  }
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---- Room state ----
// rooms[code] = { players: [{id, name, ws}], hostId, game }
const rooms = {};
let idCounter = 1;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms[code]);
  return code;
}

function defaultGameState() {
  return {
    phase: 'lobby',     // lobby | choosing | writing | countdown | performing | recap
    order: [],          // player ids in turn order
    turnIndex: 0,
    category: null,     // 'pose' | 'line' | 'confession'
    source: null,       // 'random' | 'crowd'
    level: null,        // 'mild' | 'medium' | 'spicy'
    writerId: null,
    currentText: null,
    history: []          // [{name, category, status}]
  };
}

function publicPlayers(room) {
  return room.players.map(p => ({ id: p.id, name: p.name }));
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(roomCode, msg) {
  const room = rooms[roomCode];
  if (!room) return;
  const data = JSON.stringify(msg);
  room.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  });
}

function sendRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  broadcast(roomCode, {
    type: 'room_state',
    players: publicPlayers(room),
    hostId: room.hostId,
    game: room.game
  });
}

function currentPlayerId(room) {
  return room.game.order[room.game.turnIndex] || null;
}

function startCountdown(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.game.phase = 'countdown';
  sendRoomState(roomCode);
  setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.game.phase !== 'countdown') return;
    r.game.phase = 'performing';
    sendRoomState(roomCode);
  }, 2600);
}

function handleGameMessage(room, ws, msg) {
  const game = room.game;
  const code = ws.roomCode;

  switch (msg.type) {
    case 'start_game': {
      if (ws.id !== room.hostId) return;
      if (room.players.length < 1) return;
      const ids = room.players.map(p => p.id);
      // shuffle
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      room.game = defaultGameState();
      room.game.order = ids;
      room.game.phase = 'choosing';
      sendRoomState(code);
      break;
    }

    case 'choose_mode': {
      // Only the current turn player may choose.
      if (ws.id !== currentPlayerId(room)) return;
      if (game.phase !== 'choosing') return;
      const { category, source, level } = msg;
      if (!['pose', 'line', 'confession'].includes(category)) return;
      if (!['random', 'crowd'].includes(source)) return;

      game.category = category;
      game.source = source;

      if (source === 'random') {
        const lvl = ['mild', 'medium', 'spicy'].includes(level) ? level : 'mild';
        game.level = lvl;
        game.currentText = pick(dareBank[lvl][category]);
        game.writerId = null;
        startCountdown(code);
      } else {
        // Pick a random OTHER connected player to write the prompt.
        const others = room.players.filter(p => p.id !== ws.id);
        if (others.length === 0) {
          // No one else to write — fall back to random.
          game.source = 'random';
          const lvl = 'mild';
          game.level = lvl;
          game.currentText = pick(dareBank[lvl][category]);
          startCountdown(code);
        } else {
          const writer = others[Math.floor(Math.random() * others.length)];
          game.writerId = writer.id;
          game.level = null;
          game.currentText = null;
          game.phase = 'writing';
          sendRoomState(code);
        }
      }
      break;
    }

    case 'submit_crowd_text': {
      if (ws.id !== game.writerId) return;
      if (game.phase !== 'writing') return;
      const text = (msg.text || '').toString().slice(0, 200).trim();
      game.currentText = text || "Do literally anything you want. Shocking twist: nobody gave you a real prompt.";
      startCountdown(code);
      break;
    }

    case 'finish_turn': {
      if (ws.id !== currentPlayerId(room)) return;
      if (game.phase !== 'performing') return;
      const performer = room.players.find(p => p.id === ws.id);
      game.history.push({
        name: performer ? performer.name : 'Unknown',
        category: game.category,
        status: (msg.status || 'done')
      });
      game.turnIndex++;
      game.category = null;
      game.source = null;
      game.level = null;
      game.writerId = null;
      game.currentText = null;
      if (game.turnIndex >= game.order.length) {
        game.phase = 'recap';
      } else {
        game.phase = 'choosing';
      }
      sendRoomState(code);
      break;
    }

    case 'play_again': {
      if (ws.id !== room.hostId) return;
      room.game = defaultGameState();
      sendRoomState(code);
      break;
    }

    default:
      break;
  }
}

wss.on('connection', (ws) => {
  ws.id = 'p' + (idCounter++);
  ws.roomCode = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create_room') {
      const code = genCode();
      rooms[code] = {
        players: [{ id: ws.id, name: (msg.name || 'Host').toString().slice(0, 24), ws }],
        hostId: ws.id,
        game: defaultGameState()
      };
      ws.roomCode = code;
      send(ws, { type: 'joined', roomCode: code, selfId: ws.id });
      sendRoomState(code);
      return;
    }

    if (msg.type === 'join_room') {
      const code = (msg.code || '').toString().toUpperCase().trim();
      const room = rooms[code];
      if (!room) {
        send(ws, { type: 'error', message: 'Room not found. Double-check the code.' });
        return;
      }
      room.players.push({ id: ws.id, name: (msg.name || 'Player').toString().slice(0, 24), ws });
      ws.roomCode = code;
      send(ws, { type: 'joined', roomCode: code, selfId: ws.id });
      sendRoomState(code);
      return;
    }

    const room = rooms[ws.roomCode];
    if (!room) return;
    handleGameMessage(room, ws, msg);
  });

  ws.on('close', () => {
    const room = rooms[ws.roomCode];
    if (!room) return;
    room.players = room.players.filter(p => p.id !== ws.id);
    if (room.players.length === 0) {
      delete rooms[ws.roomCode];
      return;
    }
    if (room.hostId === ws.id) room.hostId = room.players[0].id;
    // Remove the departed player from turn order if a game is in progress.
    room.game.order = room.game.order.filter(id => id !== ws.id);
    sendRoomState(ws.roomCode);
  });
});

server.listen(PORT, () => {
  console.log(`Dare Cam server listening on port ${PORT}`);
});

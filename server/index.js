
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PUBLIC_DIR = path.join(__dirname, 'public');
// const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.static(PUBLIC_DIR));

// ---- Game State (single session simple) ----
let players = new Map(); // socketId -> {name, groupId, contribution, payout}
let groups = new Map();  // groupId -> {memberIds: [], started: false, finished: false}
let gamePhase = 'lobby'; // 'lobby' | 'contribute' | 'results'
let baseEndowment = 15;
let multiplier = 2;

// Utility: shuffle array
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function broadcastLobby() {
  const count = players.size;
  io.to('hosts').emit('lobby:update', { count });
}

function formGroups(size=4) {
  groups.clear();
  const ids = Array.from(players.keys());
  shuffle(ids);
  let gid = 1;
  for (let i=0; i<ids.length; i+=size) {
    const slice = ids.slice(i, i+size);
    groups.set(String(gid), { memberIds: slice, started: false, finished: false });
    slice.forEach(sid => {
      const p = players.get(sid);
      if (p) {
        p.groupId = String(gid);
        p.contribution = null;
        p.payout = null;
      }
    });
    gid++;
  }
}

function allGroupsFinished() {
  for (const g of groups.values()) {
    if (!g.finished) return false;
  }
  return true;
}

io.on('connection', (socket) => {
  const role = socket.handshake.query.role || 'player';
  if (role === 'host') {
    socket.join('hosts');
    socket.emit('host:hello', { phase: gamePhase, baseEndowment, multiplier });
    broadcastLobby();
  } else {
    // Player joins lobby
    players.set(socket.id, { name: null, groupId: null, contribution: null, payout: null });
    broadcastLobby();
    // tell hosts student joined
    io.to('hosts').emit('player:joined', { id: socket.id });
    // tell player current phase
    socket.emit('player:hello', { phase: gamePhase, baseEndowment, multiplier });
  }

  socket.on('player:register', ({ name }) => {
    const p = players.get(socket.id);
    if (p) {
      p.name = (name && String(name).trim()) || null;
    }
    broadcastLobby();
  });

  socket.on('host:start', () => {
    if (!socket.rooms.has('hosts')) return; // only host
    if (players.size === 0) {
      socket.emit('host:error', { message: 'No players connected.' });
      return;
    }
    formGroups(4);
    gamePhase = 'contribute';
    // Notify each player of their group
    for (const [gid, g] of groups.entries()) {
      g.started = true;
      for (const sid of g.memberIds) {
        io.to(sid).emit('round:start', { groupId: gid, baseEndowment, multiplier });
      }
    }
    io.to('hosts').emit('round:started', { groups: summaryGroups() });
  });

  socket.on('player:contribute', ({ amount }) => {
    const p = players.get(socket.id);
    if (!p || gamePhase !== 'contribute') return;
    let a = parseInt(amount, 10);
    if (isNaN(a) || a < 0) a = 0;
    if (a > baseEndowment) a = baseEndowment;
    p.contribution = a;

    // check if group complete
    const g = groups.get(p.groupId);
    if (g) {
      const allDone = g.memberIds.every(id => {
        const pp = players.get(id);
        return pp && pp.contribution !== null;
      });
      if (allDone) {
        // compute payouts
        const contribs = g.memberIds.map(id => players.get(id)?.contribution || 0);
        const groupSum = contribs.reduce((s,v)=>s+v,0);
        const groupSize = g.memberIds.length;
        const doubled = groupSum * multiplier;
        const share = doubled / groupSize;

        g.memberIds.forEach(id => {
          const pp = players.get(id);
          if (pp) {
            pp.payout = (baseEndowment - pp.contribution) + share;
            io.to(id).emit('round:result', {
              groupId: p.groupId,
              groupSum,
              doubled,
              share,
              yourContribution: pp.contribution,
              yourPayout: pp.payout
            });
          }
        });
        g.finished = true;
        io.to('hosts').emit('group:finished', {
          groupId: p.groupId,
          groupSum, doubled, share,
          members: g.memberIds.map(id => ({
            id, name: players.get(id)?.name || null,
            contribution: players.get(id)?.contribution ?? null,
            payout: players.get(id)?.payout ?? null
          }))
        });

        if (allGroupsFinished()) {
          gamePhase = 'results';
          io.to('hosts').emit('round:all_finished', { groups: summaryGroups(true) });
        }
      } else {
        // update host on partial progress
        io.to('hosts').emit('group:update', {
          groupId: p.groupId,
          received: g.memberIds.filter(id => players.get(id)?.contribution !== null).length,
          total: g.memberIds.length
        });
      }
    }
  });

  socket.on('host:reset', () => {
    if (!socket.rooms.has('hosts')) return;
    // reset contributions/payouts; keep players in lobby
    for (const p of players.values()) {
      p.groupId = null;
      p.contribution = null;
      p.payout = null;
    }
    groups.clear();
    gamePhase = 'lobby';
    io.to('hosts').emit('host:hello', { phase: gamePhase, baseEndowment, multiplier });
    for (const id of players.keys()) {
      io.to(id).emit('player:hello', { phase: gamePhase, baseEndowment, multiplier });
    }
    broadcastLobby();
  });

  socket.on('disconnect', () => {
    if (socket.rooms.has('hosts')) {
      // host left — do nothing special
    } else {
      // player left
      const hadPlayer = players.delete(socket.id);
      if (hadPlayer) {
        broadcastLobby();
        io.to('hosts').emit('player:left', { id: socket.id });
      }
    }
  });
});

function summaryGroups(includeMembers=false) {
  const out = [];
  for (const [gid, g] of groups.entries()) {
    const group = {
      groupId: gid,
      size: g.memberIds.length,
      finished: g.finished
    };
    if (includeMembers) {
      group.members = g.memberIds.map(id => ({
        id, name: players.get(id)?.name || null,
        contribution: players.get(id)?.contribution ?? null,
        payout: players.get(id)?.payout ?? null
      }));
    }
    out.push(group);
  }
  return out;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`PGG classroom server running on http://localhost:${PORT}`);
  console.log(`Host dashboard: http://localhost:${PORT}/host.html`);
  console.log(`Join page:     http://localhost:${PORT}/join.html`);
});

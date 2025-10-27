
const socket = io({ query: { role: 'host' } });

const playerCountEl = document.getElementById('player-count');
const groupsEl = document.getElementById('groups');
const resultsEl = document.getElementById('results');
const joinUrlEl = document.getElementById('join-url');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const endBtn = document.getElementById('end-btn');


// Build join URL from current origin
const joinUrl = `${location.origin}/join.html`;
joinUrlEl.textContent = joinUrl;

// QR code
new QRCode(document.getElementById("qr"), {
  text: joinUrl,
  width: 180,
  height: 180
});

startBtn.addEventListener('click', () => socket.emit('host:start'));
resetBtn.addEventListener('click', () => {
  groupsEl.innerHTML = '';
  resultsEl.innerHTML = '';
  socket.emit('host:reset');
});
endBtn.addEventListener('click', () => socket.emit('host:end'));


socket.on('host:hello', ({ phase }) => {
  // nothing extra for now
});

socket.on('lobby:update', ({ count }) => {
  playerCountEl.textContent = count;
});

socket.on('round:started', ({ groups }) => {
  groupsEl.innerHTML = renderGroups(groups);
  resultsEl.innerHTML = '';
});

socket.on('group:update', ({ groupId, received, total }) => {
  const row = document.querySelector(`[data-group="${groupId}"] .progress`);
  if (row) row.textContent = `${received}/${total} submitted`;
});

socket.on('group:finished', ({ groupId, groupSum, doubled, share, members }) => {
  const card = document.querySelector(`[data-group="${groupId}"]`);
  if (card) {
    card.querySelector('.summary').innerHTML = `
      <p><strong>Group Sum:</strong> ${groupSum} | <strong>Doubled:</strong> ${doubled} | <strong>Share:</strong> ${share.toFixed(2)}</p>
    `;
    const table = card.querySelector('table tbody');
    table.innerHTML = members.map(m => `
      <tr>
        <td>${m.name ? m.name : '(anon)'}</td>
        <td>${m.contribution}</td>
        <td>${m.payout.toFixed(2)}</td>
      </tr>
    `).join('');
  }
});

socket.on('host:end', () => {
  if (!socket.rooms.has('hosts')) return;
  if (gamePhase !== 'contribute') return;

  // Compute and send results for every group once, now.
  for (const [gid, g] of groups.entries()) {
    if (g.finished) continue;

    const memberIds = g.memberIds;
    const contribs = memberIds.map(id => players.get(id)?.contribution ?? 0);
    const groupSum = contribs.reduce((s, v) => s + v, 0);
    const groupSize = memberIds.length;
    const doubled = groupSum * multiplier;
    const share = groupSize > 0 ? doubled / groupSize : 0;

    memberIds.forEach(id => {
      const pp = players.get(id);
      if (!pp) return;
      // If someone never submitted, treat as 0 contribution:
      const c = (pp.contribution ?? 0);
      pp.payout = (baseEndowment - c) + share;

      io.to(id).emit('round:result', {
        groupId: gid,
        groupSum,
        doubled,
        share,
        yourContribution: c,
        yourPayout: pp.payout
      });
    });

    g.finished = true;

    io.to('hosts').emit('group:finished', {
      groupId: gid,
      groupSum, doubled, share,
      members: memberIds.map(id => ({
        id,
        name: players.get(id)?.name || null,
        contribution: players.get(id)?.contribution ?? 0,
        payout: players.get(id)?.payout ?? null
      }))
    });
  }

  gamePhase = 'results';
  io.to('hosts').emit('round:all_finished', { groups: summaryGroups(true) });
});


socket.on('player:contribute', ({ amount }) => {
  const p = players.get(socket.id);
  if (!p || gamePhase !== 'contribute') return;

  let a = parseInt(amount, 10);
  if (isNaN(a) || a < 0) a = 0;
  if (a > baseEndowment) a = baseEndowment;
  p.contribution = a;

  const g = groups.get(p.groupId);
  if (g) {
    const received = g.memberIds.filter(id => players.get(id)?.contribution !== null).length;
    const total = g.memberIds.length;

    // notify host on progress
    io.to('hosts').emit('group:update', { groupId: p.groupId, received, total });

    // mark "ready" once group has all contributions
    if (received === total) g.ready = true; // NEW FLAG
  }
});


socket.on('round:all_finished', ({ groups }) => {
  resultsEl.innerHTML = `
    <h3>All Groups Finished</h3>
    ${groups.map(g => `
      <div class="card" style="margin: 8px 0;">
        <h4>Group ${g.groupId}</h4>
        <table>
          <thead><tr><th>Name</th><th>Contribution</th><th>Payout</th></tr></thead>
          <tbody>
            ${g.members.map(m => `
              <tr>
                <td>${m.name ? m.name : '(anon)'}</td>
                <td>${m.contribution}</td>
                <td>${(m.payout ?? 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('')}
  `;
});

function renderGroups(groups) {
  return groups.map(g => `
    <div class="card" data-group="${g.groupId}">
      <h3>Group ${g.groupId} <span class="muted">(${g.size} players)</span></h3>
      <p class="progress">0/${g.size} submitted</p>
      <div class="summary"></div>
      <table>
        <thead><tr><th>Name</th><th>Contribution</th><th>Payout</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `).join('');
}

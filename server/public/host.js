
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
//joinUrlEl.textContent = joinUrl;

// QR code
new QRCode(document.getElementById("qr"), {
  text: joinUrl,
  width: 250,
  height: 250
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


const socket = io({ query: { role: 'host' } });

const playerCountEl = document.getElementById('player-count');
const groupsEl = document.getElementById('groups');
const resultsEl = document.getElementById('results');
const joinUrlEl = document.getElementById('join-url');
const startBtn = document.getElementById('start-btn');
const start2Btn= document.getElementById('start2-btn');
// const resetBtn = document.getElementById('reset-btn');
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
start2Btn.addEventListener('click', () => {
  start2Btn.style.display = 'none';
  resultsEl.innerHTML = '<p><strong>Round 2 starting…</strong> You have <span id="t">60</span> seconds to discuss.</p>';
  socket.emit('host:start_again', { keepGroups: true });

  let secs = 60;
  const tEl = () => document.getElementById('t');
  const iv = setInterval(() => {
    secs -= 1;
    if (tEl()) tEl().textContent = secs;
    if (secs <= 0) clearInterval(iv);
  }, 1000);
});
/* resetBtn.addEventListener('click', () => {
  groupsEl.innerHTML = '';
  resultsEl.innerHTML = '';
  socket.emit('host:reset');
}); */
endBtn.addEventListener('click', () => socket.emit('host:end'));


socket.on('host:hello', ({ phase }) => {
  // Set initial button visibility based on phase
  if (phase === 'lobby') {
    startBtn.style.display = 'inline-block';
    endBtn.style.display = 'none';
  } else if (phase === 'round') {
    startBtn.style.display = 'none';
    endBtn.style.display = 'inline-block';
  } else {
    // Finished or other states
    startBtn.style.display = 'none';
    endBtn.style.display = 'none';
  }
});

socket.on('lobby:update', ({ count }) => {
  playerCountEl.textContent = count;
});

socket.on('round:started', ({ groups }) => {
  groupsEl.innerHTML = renderGroups(groups);
  resultsEl.innerHTML = '';
  
  // Hide start button and show end button when round starts
  startBtn.style.display = 'none';
  endBtn.style.display = 'inline-block';
});

socket.on('group:update', ({ groupId, received, total }) => {
  const row = document.querySelector(`[data-group="${groupId}"] .progress`);
  if (row) row.textContent = `${received}/${total} submitted`;
});

socket.on('group:finished', ({ groupId, groupSum, doubled, share, members }) => {
  const card = document.querySelector(`[data-group="${groupId}"]`);
  if (!card) return;

  card.querySelector('.summary').innerHTML = `
    <p><strong>Group Sum:</strong> ${groupSum} | <strong>Doubled:</strong> ${doubled} | <strong>Share:</strong> ${share.toFixed(2)}</p>
  `;

  const tableBody = card.querySelector('table tbody');

  const rows = members.map(m => `
    <tr>
      <td>${m.name ? m.name : '(anon)'}</td>
      <td>${m.contribution}</td>
      <td>${(m.payout ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const payoutSum = members.reduce((s, m) => s + (m.payout ?? 0), 0);

  tableBody.innerHTML = rows + `
    <tr class="totals">
      <td><strong>Totals</strong></td>
      <td><strong>${groupSum}</strong></td>
      <td><strong>${payoutSum.toFixed(2)}</strong></td>
    </tr>
  `;
});


socket.on('round:all_finished', ({ round, groups, previous }) => {
  // Default: show current round results (as before)
  
  resultsEl.innerHTML = `
    <h3>All Groups Finished — Round ${round}</h3>
    ${groups.map(g => {
      const payoutSum = (g.members || []).reduce((s, m) => s + (m.payout ?? 0), 0);
      return `
        <div class="card" style="margin: 8px 0;">
          <h4>Group ${g.groupId}</h4>
          <p><strong>Group Sum:</strong> ${g.groupSum} | <strong>Doubled:</strong> ${g.doubled} | <strong>Share:</strong> ${g.share.toFixed(2)}</p>
          <table>
            <thead>
              <tr><th>Name</th><th>Contribution (R${round})</th><th>Payout (R${round})</th></tr>
            </thead>
            <tbody>
              ${g.members.map(m => `
                <tr>
                  <td>${m.name ? m.name : '(anon)'}</td>
                  <td>${m.contribution}</td>
                  <td>${(m.payout ?? 0).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="totals">
                <td><strong>Totals</strong></td>
                <td><strong>${g.groupSum}</strong></td>
                <td><strong>${payoutSum.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('')}
  `;

  // Show start button and hide end button when round finishes
  // (unless we're showing comparison results)
  if (!previous || !Array.isArray(previous.groups)) {
    startBtn.style.display = 'inline-block';
    endBtn.style.display = 'none';
  }

  // If there is a previous round, render a comparison block under it
if (previous && Array.isArray(previous.groups)) {
  // Hide all buttons when both rounds are complete
  startBtn.style.display = 'none';
  start2Btn.style.display = 'none';
  endBtn.style.display = 'none';

  const prevById = new Map(previous.groups.map(pg => [String(pg.groupId), pg]));

  const compRows = groups.map(curr => {
    const prev = prevById.get(String(curr.groupId));

    const prevContribSum = prev ? prev.groupSum : 0;
    const currContribSum = curr.groupSum;

    const prevPayoutSum = prev
      ? (prev.members || []).reduce((s, m) => s + (m.payout ?? 0), 0)
      : 0;

    const currPayoutSum =
      (curr.members || []).reduce((s, m) => s + (m.payout ?? 0), 0);

    return `
      <tr>
        <td>Group ${curr.groupId}</td>
        <td><strong>${prevContribSum}</strong></td>
        <td><strong>${currContribSum}</strong></td>
        <td>${prevPayoutSum.toFixed(2)}</td>
        <td>${currPayoutSum.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  resultsEl.insertAdjacentHTML('beforeend', `
    <div class="card" style="margin-top:12px">
      <h3>Round ${previous.round} vs Round ${round}: Group Cooperation Comparison</h3>
      <table>
        <thead>
          <tr>
            <th>Group</th>
            <th>Contribution Sum (R${previous.round})</th>
            <th>Contribution Sum (R${round})</th>
            <th>Total Payout (R${previous.round})</th>
            <th>Total Payout (R${round})</th>
          </tr>
        </thead>
        <tbody>${compRows}</tbody>
      </table>
    </div>
  `);
}

  // Show the “Start Round 2” button (if you’re on Round 1 just ended)
  // const start2Btn = document.getElementById('start2-btn');
  if (start2Btn && round === 1) {
    start2Btn.style.display = 'inline-block';
  }
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


const socket = io({ query: { role: 'player' } });

let phase = 'lobby';
let baseEndowment = 15;

const registerCard = document.getElementById('register-card');
const waitCard = document.getElementById('wait-card');
const contribCard = document.getElementById('contrib-card');
const resultCard = document.getElementById('result-card');
const endowmentEl = document.getElementById('endowment');
const resultEl = document.getElementById('result');

function show(id) {
  [registerCard, waitCard, contribCard, resultCard].forEach(el => el.style.display = 'none');
  id.style.display = 'block';
}

document.getElementById('register').addEventListener('click', () => {
  const name = document.getElementById('name').value.trim();
  socket.emit('player:register', { name });
  show(waitCard);
});

document.getElementById('submit').addEventListener('click', () => {
  const val = parseInt(document.getElementById('amount').value, 10);
  socket.emit('player:contribute', { amount: val });
  // lock UI
  document.getElementById('submit').disabled = true;
});

socket.on('player:hello', ({ phase: p, baseEndowment: b }) => {
  phase = p; baseEndowment = b; endowmentEl.textContent = b;
  if (phase === 'lobby') show(registerCard);
  else if (phase === 'contribute') show(contribCard);
  else if (phase === 'results') show(resultCard);
});

socket.on('round:start', ({ groupId, baseEndowment: b }) => {
  baseEndowment = b; endowmentEl.textContent = b;
  show(contribCard);
});

socket.on('round:result', ({ groupSum, doubled, share, yourContribution, yourPayout }) => {
  resultEl.innerHTML = `
    <p><strong>Your contribution:</strong> ${yourContribution}</p>
    <p><strong>Group total contribution:</strong> ${groupSum}</p>
    <p><strong>Doubled pot:</strong> ${doubled}</p>
    <p><strong>Each member's share:</strong> ${share.toFixed(2)}</p>
    <p><strong>Your payout:</strong> <span style="font-size:1.2em">${yourPayout.toFixed(2)}</span></p>
  `;
  show(resultCard);
});

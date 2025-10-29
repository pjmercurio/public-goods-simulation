
const socket = io({ query: { role: 'player' } });

let phase = 'lobby';
let baseEndowment = 15;

const registerCard = document.getElementById('register-card');
const waitCard = document.getElementById('wait-card');
const contribCard = document.getElementById('contrib-card');
const pendingCard = document.getElementById('pending-card');
const resultCard = document.getElementById('result-card');
const endowmentEl = document.getElementById('endowment');
const resultEl = document.getElementById('result');
const playerNameDisplay = document.getElementById('player-name-display');

function show(id) {
  [registerCard, waitCard, contribCard, resultCard, pendingCard].forEach(el => el.style.display = 'none');
  id.style.display = 'block';
}

function setAndShowPlayerName(name) {
  const trimmed = (name || '').trim();
  if (trimmed) {
    try { sessionStorage.setItem('playerName', trimmed); } catch (e) {}
    if (playerNameDisplay) {
      playerNameDisplay.textContent = trimmed;
      playerNameDisplay.style.display = 'block';
    }
  }
}

document.getElementById('register').addEventListener('click', () => {
  const name = document.getElementById('name').value.trim();
  socket.emit('player:register', { name });
  setAndShowPlayerName(name);
  show(waitCard);
});

// Update display when slider moves
document.getElementById('amount').addEventListener('input', (e) => {
  document.getElementById('amount-value').textContent = e.target.value;
});

document.getElementById('submit').addEventListener('click', () => {
  const submitBtn = document.getElementById('submit');
  if (submitBtn.disabled) return;
  const val = parseInt(document.getElementById('amount').value, 10);
  socket.emit('player:contribute', { amount: val });
  submitBtn.disabled = true; // prevent double-submits
  submitBtn.textContent = 'Submitting…';
});



socket.on('player:hello', ({ phase: p, baseEndowment: b }) => {
  phase = p; baseEndowment = b; endowmentEl.textContent = b;

  // ✅ ensure clean state between rounds/resets
  const submitBtn = document.getElementById('submit');
  if (submitBtn) submitBtn.disabled = false;
  document.getElementById('amount').value = 0;
  document.getElementById('amount-value').textContent = '0';
  resultEl.innerHTML = '';

  // show stored name if available (helps across reloads)
  try {
    const stored = sessionStorage.getItem('playerName');
    if (stored) setAndShowPlayerName(stored);
  } catch (e) {}

  // Optional: if you want to keep students past the name step after resets:
  // show(waitCard);  // instead of show(registerCard) below

  if (phase === 'lobby') show(registerCard);   // or show(waitCard) if you prefer
  else if (phase === 'contribute') show(contribCard);
  else if (phase === 'results') show(resultCard);
});


socket.on('round:start', ({ baseEndowment: b }) => {
  baseEndowment = b; endowmentEl.textContent = b;
  document.getElementById('amount').value = 0;
  document.getElementById('amount-value').textContent = '0';
  resultEl.innerHTML = '';
  const submitBtn = document.getElementById('submit');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit';
  show(contribCard);
});


socket.on('round:result', ({ groupSum, doubled, share, yourContribution, yourPayout }) => {
  resultEl.innerHTML = `
    <p><strong>Your contribution:</strong> ${yourContribution}</p>
    <p><strong>Group total contribution:</strong> ${groupSum}</p>
    <p><strong>Each member's share:</strong> ${share.toFixed(2)}</p>
    <p><strong>Your payout:</strong> <span style="font-size:1.2em">${yourPayout.toFixed(2)}</span></p>
  `;
  show(resultCard);
});

// ✅ when the server ACKs, switch to pending screen
socket.on('player:submitted', ({ ok }) => {
  if (!ok) return;
  show(pendingCard);
});


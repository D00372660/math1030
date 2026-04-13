'use strict';

const COST      = 2;
const PRIZE     = 3;
const START_BAL = 5;
const WIN_BAL   = 10;

let state = {
  balance  : START_BAL,
  wins     : 0,
  losses   : 0,
  round    : 1,
  history  : [],
  done     : false,
  phase    : 'idle',   // idle | picking | revealing | resolved
  pool     : [],       // color for each hopper ball, index-matched
  picks    : [],       // indices of picked balls (max 2)
};

/* ── DOM helpers ── */
const $  = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

function makeColorBall(color, size) {
  const b = el('div', `ball ${color}-ball`);
  b.textContent = color === 'white' ? 'W' : 'O';
  if (size) { b.style.width = b.style.height = size + 'px'; b.style.fontSize = (size * 0.24) + 'px'; }
  return b;
}

function makeMysteryBall(index) {
  const b = el('div', 'ball mystery-ball');
  b.id = `hball-${index}`;
  b.dataset.index = index;
  b.textContent = '?';
  b.addEventListener('click', () => onBallClick(index));
  return b;
}

function renderHopper() {
  const grid = $('hopper-balls');
  grid.innerHTML = '';

  state.pool = [...Array(5).fill('white'), ...Array(5).fill('orange')];
  for (let i = state.pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.pool[i], state.pool[j]] = [state.pool[j], state.pool[i]];
  }

  state.pool.forEach((_, i) => {
    const b = makeMysteryBall(i);
    b.classList.add('ball-pop');
    b.style.animationDelay = (i * 0.04) + 's';
    grid.appendChild(b);
  });

  $('hopper-count').textContent = '10 balls';
}

function updateHUD() {
  const b = state.balance;
  const bEl = $('balance-display');
  bEl.textContent = '$' + b;
  bEl.className = 'hud-val' + (b > START_BAL ? ' good' : b < START_BAL ? ' bad' : '');
  $('round-display').textContent = state.round;
  $('record-display').textContent = `${state.wins} – ${state.losses}`;

  const pct = Math.max(0, Math.min(100, (b / WIN_BAL) * 100));
  $('progress-fill').style.width = pct + '%';
  $('progress-thumb').style.left = pct + '%';
  $('progress-label').textContent = '$' + b;
}

function showBanner(type, icon, title, sub) {
  const banner = $('result-banner');
  banner.className = `result-banner ${type} banner-in`;
  $('result-icon').textContent  = icon;
  $('result-title').textContent = title;
  $('result-sub').textContent   = sub;
}

function hideBanner() {
  $('result-banner').className = 'result-banner hidden';
}

function addDot(win) {
  $('history-section').style.display = 'flex';
  const d = el('div', `h-dot ${win ? 'win' : 'lose'}-dot`);
  d.title = (win ? 'Win' : 'Loss') + ' · round ' + state.round;
  $('history-dots').appendChild(d);
}

function fillSlot(slotId, color) {
  const slot = $(slotId);
  slot.innerHTML = '';
  const b = makeColorBall(color, 60);
  b.classList.add('slot-reveal');
  slot.appendChild(b);
}

function fillSlotMystery(slotId) {
  const slot = $(slotId);
  slot.innerHTML = '';
  const b = el('div', 'ball mystery-ball mystery-picked');
  b.style.cssText = 'width:60px;height:60px;font-size:14px;cursor:default;pointer-events:none;';
  b.textContent = '?';
  slot.appendChild(b);
}

function clearSlots() {
  ['slot-1','slot-2'].forEach(id => {
    $(id).innerHTML = '<span class="slot-q">?</span>';
  });
}

function setHopperClickable(on) {
  document.querySelectorAll('#hopper-balls .mystery-ball').forEach(b => {
    b.style.pointerEvents = on ? 'auto' : 'none';
    if (on) b.classList.add('clickable');
    else    b.classList.remove('clickable');
  });
}

function startRound() {
  if (state.done || state.balance < COST) return;

  state.balance -= COST;
  state.picks = [];
  state.phase = 'picking';
  updateHUD();
  hideBanner();
  clearSlots();
  renderHopper();
  setHopperClickable(true);

  $('draw-btn').disabled = true;
  $('draw-btn').querySelector('.btn-inner').textContent = 'Pick your balls…';
  $('draw-hint').textContent = 'Click any ball — pick 1 of 2';
}

function onBallClick(index) {
  if (state.phase !== 'picking') return;
  if (state.picks.includes(index)) return;

  state.picks.push(index);

  const hopperBall = $(`hball-${index}`);
  if (hopperBall) hopperBall.classList.add('mystery-selected');

  if (state.picks.length === 1) {
    fillSlotMystery('slot-1');
    $('draw-hint').textContent = 'Good — now pick your second ball';
    $('hopper-count').textContent = '9 balls remaining';
  }

  if (state.picks.length === 2) {
    fillSlotMystery('slot-2');
    $('draw-hint').textContent = 'Both picked — revealing…';
    $('hopper-count').textContent = '8 balls remaining';
    state.phase = 'revealing';
    setHopperClickable(false);
    revealResults();
  }
}

function revealResults() {
  const color1 = state.pool[state.picks[0]];
  const color2 = state.pool[state.picks[1]];
  const matched = color1 === color2;

  /* flip the picked hopper balls to their true color */
  state.picks.forEach(idx => {
    const b = $(`hball-${idx}`);
    if (!b) return;
    const c = state.pool[idx];
    b.className = `ball ${c}-ball revealing`;
    b.style.pointerEvents = 'none';
    b.textContent = c === 'white' ? 'W' : 'O';
    setTimeout(() => b && b.classList.remove('revealing'), 500);
  });

  setTimeout(() => fillSlot('slot-1', color1), 200);
  setTimeout(() => {
    fillSlot('slot-2', color2);
    $('draw-hint').textContent =
      color1[0].toUpperCase() + color1.slice(1) + ' + ' +
      color2[0].toUpperCase() + color2.slice(1);
  }, 500);

  setTimeout(() => {
    state.phase = 'resolved';

    if (matched) {
      state.balance += PRIZE;
      state.wins++;
      addDot(true);
    } else {
      state.losses++;
      addDot(false);
    }

    updateHUD();

    if (state.balance >= WIN_BAL) {
      showBanner('over', '🏆', 'You win the game!', `Reached $${WIN_BAL} — cash out and walk away a winner!`);
      endGame(); return;
    }
    if (state.balance < COST) {
      showBanner('bust', '💀', 'Busted.', 'You ran out of money. Better luck next game.');
      endGame(); return;
    }

    if (matched) {
      showBanner('win', '✓', `Match! Both ${color1}.`, `+$${PRIZE} added to your balance.`);
    } else {
      showBanner('lose', '✗', 'No match — one of each.', 'Better luck next draw.');
    }

    state.round++;
    updateHUD();
    $('draw-btn').disabled = false;
    $('draw-btn').querySelector('.btn-inner').textContent = `Draw 2 balls · $${COST}`;
    $('draw-hint').textContent = 'Press Draw to start a new round';
  }, 950);
}

function endGame() {
  state.done = true;
  $('draw-btn').disabled = true;
  $('draw-btn').querySelector('.btn-inner').textContent = 'Game Over';
}

function draw() { startRound(); }

function resetGame() {
  state = {
    balance: START_BAL, wins: 0, losses: 0, round: 1,
    history: [], done: false, phase: 'idle', pool: [], picks: [],
  };
  renderHopper();
  setHopperClickable(false);
  clearSlots();
  hideBanner();
  updateHUD();
  $('history-section').style.display = 'none';
  $('history-dots').innerHTML = '';
  $('draw-btn').disabled = false;
  $('draw-btn').querySelector('.btn-inner').textContent = `Draw 2 balls · $${COST}`;
  $('draw-hint').textContent = 'Press Draw to pick two balls';
}

renderHopper();
updateHUD();

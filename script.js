'use strict';

/* ── Config ── */
const COST      = 2;
const PRIZE     = 3;
const START_BAL = 5;
const WIN_BAL   = 10;

/* Replace this URL with your deployed Google Apps Script web app URL */
const SHEETS_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

/* ── State ── */
let player = { name: '', initial: '' };

let state = {
  balance  : START_BAL,
  wins     : 0,
  losses   : 0,
  round    : 1,
  history  : [],
  done     : false,
  phase    : 'idle',
  pool     : [],
  picks    : [],
  startTime: null,
};

/* ── DOM helpers ── */
const $  = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

/* ── Splash / name gate ── */
function startGame() {
  const first   = $('input-firstname').value.trim();
  const initial = $('input-lastinitial').value.trim().toUpperCase();

  if (!first || !initial || !/^[A-Za-z]$/.test(initial)) {
    $('splash-error').classList.remove('hidden');
    if (!first) $('input-firstname').focus();
    else        $('input-lastinitial').focus();
    return;
  }

  $('splash-error').classList.add('hidden');
  player.name    = first;
  player.initial = initial;

  $('splash').classList.add('hidden');
  const app = $('app');
  app.classList.remove('hidden');
  app.classList.add('fade-in');

  $('player-name-display').textContent = first + ' ' + initial + '.';
  state.startTime = Date.now();

  renderHopper();
  updateHUD();
}

/* Allow Enter key to submit splash form */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !$('splash').classList.contains('hidden')) startGame();
});

/* ── Ball builders ── */
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

/* ── Render hopper ── */
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

/* ── HUD ── */
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

/* ── Banners ── */
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

/* ── History dots ── */
function addDot(win) {
  $('history-section').style.display = 'flex';
  const d = el('div', `h-dot ${win ? 'win' : 'lose'}-dot`);
  d.title = (win ? 'Win' : 'Loss') + ' · round ' + state.round;
  $('history-dots').appendChild(d);
}

/* ── Slots ── */
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

/* ── Hopper clickability ── */
function setHopperClickable(on) {
  document.querySelectorAll('#hopper-balls .mystery-ball').forEach(b => {
    b.style.pointerEvents = on ? 'auto' : 'none';
    if (on) b.classList.add('clickable');
    else    b.classList.remove('clickable');
  });
}

/* ── Round start ── */
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

/* ── Ball click ── */
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

/* ── Reveal ── */
function revealResults() {
  const color1 = state.pool[state.picks[0]];
  const color2 = state.pool[state.picks[1]];
  const matched = color1 === color2;

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
      recordSession('won');
      endGame(); return;
    }
    if (state.balance < COST) {
      showBanner('bust', '💀', 'Busted.', 'You ran out of money. Better luck next game.');
      recordSession('bust');
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

/* ── End game ── */
function endGame() {
  state.done = true;
  $('draw-btn').disabled = true;
  $('draw-btn').querySelector('.btn-inner').textContent = 'Game Over';
}

/* ── Google Sheets data submission ── */
function recordSession(outcome) {
  if (!SHEETS_URL || SHEETS_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;

  const totalRounds = state.wins + state.losses;
  const winRate     = totalRounds > 0 ? ((state.wins / totalRounds) * 100).toFixed(1) : '0.0';
  const duration    = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;

  const payload = {
    playerName   : player.name + ' ' + player.initial + '.',
    outcome      : outcome,          // 'won' or 'bust'
    totalRounds  : totalRounds,
    roundWins    : state.wins,
    roundLosses  : state.losses,
    winRate      : winRate,
    finalBalance : state.balance,
    durationSecs : duration,
    timestamp    : new Date().toISOString(),
  };

  fetch(SHEETS_URL, {
    method : 'POST',
    mode   : 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(payload),
  }).catch(() => { /* silently fail — don't disrupt the player */ });
}

/* ── Public draw() ── */
function draw() { startRound(); }

/* ── Reset ── */
function resetGame() {
  state = {
    balance: START_BAL, wins: 0, losses: 0, round: 1,
    history: [], done: false, phase: 'idle', pool: [], picks: [],
    startTime: Date.now(),
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

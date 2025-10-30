const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const bestEl = document.getElementById('bestVal');
const hiEl = document.getElementById('hiVal');

// ----- HiDPI scaling
function fitHiDPI() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitHiDPI();
addEventListener('resize', fitHiDPI);

// ----- Layout
const W = () => canvas.getBoundingClientRect().width;
const H = () => canvas.getBoundingClientRect().height;
const FLOOR = () => H() - 24 - 90 - 8;

// Hoop setup
const hoop = {
  bx: () => W()/2 - 60,
  by: () => 60,
  bw: 120,
  bh: 90,
  rimY: () => 130,
  rimW: 80,
  rimT: 6,
  gateH: 18,
  scoredLatch: false
};

// Ball setup
const ball = {
  r: 28,
  x: () => W()/2,
  y: () => FLOOR() - 40, // lifted slightly above tray
  px: 0, py: 0,
  vx: 0, vy: 0,
  moving: false,
  restitution: 0.5,
  air: 0.995,
  color1: '#ff8a00',
  color2: '#ffb453'
};

// Charge mechanic
let charging = false;
let chargeStart = 0;
let chargePower = 0;
const CHARGE_TIME_FULL = 700;
const MIN_VY = -14;
const MAX_VY = -28;
const SIDE_DRIFT = 0; // randomness

// Game state
const GRAV = 0.55;
let best = 0;
let hi = 0;

// Reset ball
function resetBall(hard=false) {
  ball.px = ball.x();
  ball.py = ball.y();
  ball.vx = 0; 
  ball.vy = 0;
  ball.moving = false;
  hoop.scoredLatch = false;
  charging = false;
  chargePower = 0;
  if (hard) { 
    best = 0; 
    bestEl.textContent = best; 
  }
}

// Draw hoop
function drawHoop() {
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#c9ced6';
  ctx.strokeRect(hoop.bx(), hoop.by(), hoop.bw, hoop.bh);

  ctx.fillStyle = '#c9ced6';
  ctx.fillRect(W()/2 - 18, hoop.rimY() + 18, 36, 8);

  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--rim') || '#ff3b30';
  ctx.lineWidth = hoop.rimT;
  ctx.beginPath();
  ctx.moveTo(W()/2 - hoop.rimW/2, hoop.rimY());
  ctx.lineTo(W()/2 + hoop.rimW/2, hoop.rimY());
  ctx.stroke();
}

// Draw floor
function drawFloor() {
  ctx.strokeStyle = '#e6e9ee';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, FLOOR());
  ctx.lineTo(W()-10, FLOOR());
  ctx.stroke();
}

// Draw ball
function drawBall() {
  const x = ball.px, y = ball.py, r = ball.r;

  // shadow
  const trayTop = FLOOR();
  const t = Math.min(1, Math.max(0, (y - trayTop) / 140));
  const shadowY = trayTop + 70 * t;
  const shadowScale = 1 + 0.8 * t;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(x, shadowY, r*0.9*shadowScale, r*0.35*shadowScale, 0, 0, Math.PI*2);
  ctx.fill();

  // body
  const g = ctx.createRadialGradient(x - r/3, y - r/3, r*0.2, x, y, r);
  g.addColorStop(0, ball.color2);
  g.addColorStop(1, ball.color1);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fill();

  // seams
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-r, y); ctx.lineTo(x+r, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y-r); ctx.lineTo(x, y+r); ctx.stroke();

  // charge ring
  if (charging && !ball.moving) {
    const pct = chargePower;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#2a6df3';
    ctx.beginPath();
    ctx.arc(x, y, r + 8, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
    ctx.stroke();
  }
}

// Physics
function physics() {
  if (!ball.moving) return;

  ball.vy += GRAV;
  ball.px += ball.vx;
  ball.py += ball.vy;

  ball.vx *= ball.air;
  ball.vy *= ball.air;

  // walls
  const left = 10 + ball.r, right = W() - 10 - ball.r;
  if (ball.px < left)  { ball.px = left;  ball.vx = -Math.abs(ball.vx)*ball.restitution; }
  if (ball.px > right) { ball.px = right; ball.vx =  Math.abs(ball.vx)*ball.restitution; }

  // floor bounce
  const floor = FLOOR();
  if (ball.py + ball.r > floor) {
    ball.py = floor - ball.r;
    if (ball.vy > 1.5) {
      ball.vy = -ball.vy * ball.restitution;
      ball.vx *= 0.96;
    } else {
      ball.vy = 0;
    }
  }

  // backboard
  const bbx = hoop.bx(), bby = hoop.by(), bbw = hoop.bw, bbh = hoop.bh;
  if (ball.px + ball.r > bbx && ball.px - ball.r < bbx + bbw &&
      ball.py + ball.r > bby && ball.py - ball.r < bby + bbh) {
    const fromLeft = ball.px < W()/2;
    if (fromLeft) {
      ball.px = bbx - ball.r;
      ball.vx = -Math.abs(ball.vx) * ball.restitution;
    } else {
      ball.px = bbx + bbw + ball.r;
      ball.vx =  Math.abs(ball.vx) * ball.restitution;
    }
  }

  // --- one-way rim (only when falling down) ---
  const rimY = hoop.rimY();
  const rimLeft = W()/2 - hoop.rimW/2;
  const rimRight = W()/2 + hoop.rimW/2;

  if (ball.vy > 0 && ball.py - ball.r < rimY && ball.py + ball.r > rimY) {
    if (ball.px > rimLeft && ball.px < rimRight) {
      ball.py = rimY - ball.r;
      ball.vy = -ball.vy * 0.4; // gentle bounce
    }
  }

  // scoring gate (detect downward cross)
  const gateL = W()/2 - hoop.rimW/2 + 8;
  const gateR = W()/2 + hoop.rimW/2 - 8;
  const top = hoop.rimY();
  const bot = top + hoop.gateH;
  const inX = ball.px > gateL + ball.r*0.35 && ball.px < gateR - ball.r*0.35;
  const crossDown = ball.vy > 0 && (ball.py - ball.r > top) && (ball.py - ball.r < bot);

  if (inX && crossDown && !hoop.scoredLatch) {
    hoop.scoredLatch = true;
    best += 1;
    bestEl.textContent = best;
    if (best > hi) { hi = best; hiEl.textContent = hi; }
  }

  // stop/miss detection
  const speed = Math.hypot(ball.vx, ball.vy);
  const outBottom = ball.py - ball.r > H() + 60;
  if (outBottom || (speed < 0.15 && ball.py + ball.r >= floor - 0.5)) {
    const made = hoop.scoredLatch;
    resetBall(hard = !made);
    if (made) setTimeout(() => resetBall(false), 140);
  }
}

// Render
function render() {
  ctx.clearRect(0, 0, W(), H());
  drawHoop();
  drawFloor();
  drawBall();
}

function loop() {
  if (charging && !ball.moving) {
    const elapsed = performance.now() - chargeStart;
    chargePower = Math.min(1, elapsed / CHARGE_TIME_FULL);
  }
  physics();
  render();
  requestAnimationFrame(loop);
}
resetBall();
loop();

// ----- Input -----
function isOnBall(x, y) {
  return Math.hypot(x - ball.px, y - ball.py) <= ball.r + 12;
}
function getLocalFromPointer(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function startChargeAt(e) {
  if (ball.moving) return;
  const { x, y } = getLocalFromPointer(e);
  if (!isOnBall(x, y)) return;
  canvas.setPointerCapture(e.pointerId);
  charging = true;
  chargePower = 0;
  chargeStart = performance.now();
}
function releaseShotFrom(e) {
  if (!charging || ball.moving) return;
  charging = false;
  const vy = MIN_VY + (MAX_VY - MIN_VY) * chargePower;
  const vx = (Math.random() * 2 - 1) * SIDE_DRIFT;
  ball.vx = vx;
  ball.vy = vy;
  ball.moving = true;
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  startChargeAt(e);
});
canvas.addEventListener('pointerup', (e) => {
  releaseShotFrom(e);
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
});
canvas.addEventListener('pointercancel', (e) => {
  releaseShotFrom(e);
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
});
window.addEventListener('blur', () => releaseShotFrom({pointerId:0}));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over');
const scoreElement = document.getElementById('score');
const finalScore = document.getElementById('final-score');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player, obstacles, score, gameInterval, spawnInterval;
const GRAVITY = 0.8;
const JUMP_FORCE = -12;

class Player {
  constructor() {
    this.width = 50;
    this.height = 50;
    this.x = 50;
    this.y = canvas.height - this.height;
    this.dy = 0;
    this.onGround = true;
  }

  jump() {
    if (this.onGround) {
      this.dy = JUMP_FORCE;
      this.onGround = false;
    }
  }

  update() {
    this.dy += GRAVITY;
    this.y += this.dy;

    if (this.y + this.height >= canvas.height) {
      this.y = canvas.height - this.height;
      this.dy = 0;
      this.onGround = true;
    }

    this.draw();
  }

  draw() {
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

class Obstacle {
  constructor() {
    this.width = 30 + Math.random() * 20;
    this.height = 30 + Math.random() * 20;
    this.x = canvas.width;
    this.y = canvas.height - this.height;
    this.speed = 5;
  }

  update() {
    this.x -= this.speed;
    this.draw();
  }

  draw() {
    ctx.fillStyle = 'green';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

function startGame() {
  mainMenu.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  player = new Player();
  obstacles = [];
  score = 0;
  scoreElement.textContent = score;

  document.addEventListener('keydown', handleInput);
  document.addEventListener('mousedown', handleInput);

  gameInterval = setInterval(gameLoop, 1000 / 60);
  spawnInterval = setInterval(spawnObstacle, 1500);
}

function gameOver() {
  clearInterval(gameInterval);
  clearInterval(spawnInterval);
  document.removeEventListener('keydown', handleInput);
  document.removeEventListener('mousedown', handleInput);

  finalScore.textContent = score;
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

function restartGame() {
  startGame();
}

function handleInput(e) {
  player.jump();
}

function spawnObstacle() {
  obstacles.push(new Obstacle());
}

function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  player.update();

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();

    if (checkCollision(player, obstacles[i])) {
      gameOver();
      return;
    }

    if (obstacles[i].x + obstacles[i].width < 0) {
      obstacles.splice(i, 1);
      score++;
      scoreElement.textContent = score;
    }
  }
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);
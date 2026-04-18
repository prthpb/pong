const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const modeSelect = document.getElementById('modeSelect');
const speedInput = document.getElementById('paddleSpeed');
const speedValue = document.getElementById('speedValue');
const maxScoreSelect = document.getElementById('maxScore');
const startBtn = document.getElementById('startBtn');
const gameOverScreen = document.getElementById('gameOverScreen');
const winnerText = document.getElementById('winnerText');
const restartBtn = document.getElementById('restartBtn');

// Audio Context (initialized on user interaction)
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'paddle') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'wall') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(250, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'score') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let hue = 0; // For colorful trail
let animId;

const keys = {
    w: false,
    s: false,
    ArrowUp: false,
    ArrowDown: false
};

// Entities
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 8,
    speed: 5,
    vx: 5,
    vy: 5,
    trail: []
};

const paddleProps = {
    width: 10,
    height: 80,
    speed: parseInt(speedInput.value)
};

const player1 = {
    x: 20,
    y: canvas.height / 2 - paddleProps.height / 2,
    score: 0
};

const player2 = {
    x: canvas.width - 30,
    y: canvas.height / 2 - paddleProps.height / 2,
    score: 0
};

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

speedInput.addEventListener('input', (e) => {
    speedValue.innerText = e.target.value;
    paddleProps.speed = parseInt(e.target.value);
});

startBtn.addEventListener('click', () => {
    initAudio();
    startGame();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startGame();
});

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = 5;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ball.vy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 3 + 2);
    ball.trail = [];
}

function startGame() {
    player1.score = 0;
    player2.score = 0;
    score1El.innerText = 0;
    score2El.innerText = 0;
    resetBall();
    gameState = 'PLAYING';
    if (animId) cancelAnimationFrame(animId);
    gameLoop();
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Move Player 1
    if (keys.w && player1.y > 0) player1.y -= paddleProps.speed;
    if (keys.s && player1.y < canvas.height - paddleProps.height) player1.y += paddleProps.speed;

    // Move Player 2 / AI
    const mode = modeSelect.value;
    if (mode === '2') {
        if (keys.ArrowUp && player2.y > 0) player2.y -= paddleProps.speed;
        if (keys.ArrowDown && player2.y < canvas.height - paddleProps.height) player2.y += paddleProps.speed;
    } else {
        // AI Logic
        const aiSpeed = paddleProps.speed * 0.85; // slightly slower than max to make it beatable
        const paddleCenter = player2.y + paddleProps.height / 2;
        if (ball.y < paddleCenter - 10 && player2.y > 0) {
            player2.y -= aiSpeed;
        } else if (ball.y > paddleCenter + 10 && player2.y < canvas.height - paddleProps.height) {
            player2.y += aiSpeed;
        }
    }

    // Ball Movement
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Trail Logic
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 15) {
        ball.trail.shift();
    }
    hue += 2;

    // Wall Collision (Top/Bottom)
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.vy *= -1;
        playSound('wall');
        // Prevent sticking
        ball.y = ball.y - ball.radius < 0 ? ball.radius : canvas.height - ball.radius;
    }

    // Paddle Collision
    // Player 1
    if (ball.x - ball.radius < player1.x + paddleProps.width &&
        ball.y > player1.y && ball.y < player1.y + paddleProps.height && ball.vx < 0) {
        ball.vx *= -1;
        ball.speed += 0.5; // Increase speed
        let relativeIntersect = (player1.y + (paddleProps.height / 2)) - ball.y;
        let normalizedIntersect = relativeIntersect / (paddleProps.height / 2);
        ball.vy = normalizedIntersect * -6; // Bounce angle
        
        // Apply speed vector calculation
        let currentSpeed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
        ball.vx = (ball.vx / currentSpeed) * ball.speed;
        ball.vy = (ball.vy / currentSpeed) * ball.speed;
        
        playSound('paddle');
    }

    // Player 2
    if (ball.x + ball.radius > player2.x &&
        ball.y > player2.y && ball.y < player2.y + paddleProps.height && ball.vx > 0) {
        ball.vx *= -1;
        ball.speed += 0.5; // Increase speed
        let relativeIntersect = (player2.y + (paddleProps.height / 2)) - ball.y;
        let normalizedIntersect = relativeIntersect / (paddleProps.height / 2);
        ball.vy = normalizedIntersect * -6;
        
        let currentSpeed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
        ball.vx = (ball.vx / currentSpeed) * ball.speed;
        ball.vy = (ball.vy / currentSpeed) * ball.speed;

        playSound('paddle');
    }

    // Scoring
    if (ball.x < 0) {
        player2.score++;
        score2El.innerText = player2.score;
        playSound('score');
        checkWin();
        if(gameState === 'PLAYING') resetBall();
    } else if (ball.x > canvas.width) {
        player1.score++;
        score1El.innerText = player1.score;
        playSound('score');
        checkWin();
        if(gameState === 'PLAYING') resetBall();
    }
}

function checkWin() {
    let max = maxScoreSelect.value;
    if (max === 'Infinity') return;
    
    max = max === '5' ? 3 : 10;
    
    if (player1.score >= max) {
        endGame('Player 1');
    } else if (player2.score >= max) {
        const mode = modeSelect.value;
        endGame(mode === '1' ? 'AI' : 'Player 2');
    }
}

function endGame(winner) {
    gameState = 'GAMEOVER';
    winnerText.innerText = `${winner} Wins!`;
    gameOverScreen.classList.remove('hidden');
}

function draw() {
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Slight transparency for trailing effect on paddles
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw center line
    ctx.strokeStyle = '#333';
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    if (gameState === 'PLAYING') {
        // Draw Ball Trail
        ball.trail.forEach((p, index) => {
            const alpha = index / ball.trail.length;
            ctx.fillStyle = `hsla(${hue + index * 5}, 100%, 50%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, ball.radius * alpha, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Ball
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Paddles
    ctx.fillStyle = '#fff';
    ctx.fillRect(player1.x, player1.y, paddleProps.width, paddleProps.height);
    ctx.fillRect(player2.x, player2.y, paddleProps.width, paddleProps.height);
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'PLAYING') {
        animId = requestAnimationFrame(gameLoop);
    }
}

// Initial draw to show the board
draw();

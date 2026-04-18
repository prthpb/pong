const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

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

let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'wall') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'score') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
}

let gameState = 'MENU'; 
let animId;
let hitPauseFrames = 0;
let shakeAmount = 0;
let hue = 0;

const keys = { w: false, s: false, ArrowUp: false, ArrowDown: false };

const ball = { x: 400, y: 250, radius: 6, speed: 6, vx: 6, vy: 6, trail: [] };
const paddleProps = { width: 8, height: 75, speed: 8 };

const player1 = { x: 30, y: 212.5, lastY: 212.5, score: 0, color: '#ff0055' };
const player2 = { x: 762, y: 212.5, lastY: 212.5, score: 0, color: '#00eeff' };

let particles = [];

window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

speedInput.addEventListener('input', (e) => {
    speedValue.innerText = e.target.value;
    paddleProps.speed = parseInt(e.target.value);
});

startBtn.addEventListener('click', () => { initAudio(); startGame(); });
restartBtn.addEventListener('click', () => { gameOverScreen.classList.add('hidden'); startGame(); });

function spawnParticles(x, y, color, count, speedModifier) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10 * speedModifier,
            vy: (Math.random() - 0.5) * 10 * speedModifier,
            life: 1,
            color: color,
            size: Math.random() * 3 + 1
        });
    }
}

function resetBall(scorer) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = 6;
    ball.vx = (scorer === 1 ? -1 : 1) * ball.speed;
    ball.vy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 3 + 2);
    ball.trail = [];
}

function startGame() {
    player1.score = 0; player2.score = 0;
    score1El.innerText = 0; score2El.innerText = 0;
    resetBall(Math.random() > 0.5 ? 1 : 2);
    particles = [];
    gameState = 'PLAYING';
    if (animId) cancelAnimationFrame(animId);
    gameLoop();
}

function triggerHitJuice(x, y, color) {
    playSound('hit');
    spawnParticles(x, y, color, 15, 1);
    hitPauseFrames = 4; // Freeze game for 4 frames
    shakeAmount = ball.speed * 0.8; // Screen shake scales with ball speed
}

function update() {
    if (gameState !== 'PLAYING') return;

    if (hitPauseFrames > 0) {
        hitPauseFrames--;
        return; 
    }

    player1.lastY = player1.y;
    player2.lastY = player2.y;

    if (keys.w && player1.y > 0) player1.y -= paddleProps.speed;
    if (keys.s && player1.y < canvas.height - paddleProps.height) player1.y += paddleProps.speed;

    const mode = modeSelect.value;
    if (mode === '2') {
        if (keys.ArrowUp && player2.y > 0) player2.y -= paddleProps.speed;
        if (keys.ArrowDown && player2.y < canvas.height - paddleProps.height) player2.y += paddleProps.speed;
    } else {
        // Natural AI Interpolation
        if (ball.vx > 0) {
            let targetY = ball.y - paddleProps.height / 2;
            player2.y += (targetY - player2.y) * 0.08; 
            // Clamp to screen
            if(player2.y < 0) player2.y = 0;
            if(player2.y > canvas.height - paddleProps.height) player2.y = canvas.height - paddleProps.height;
        } else {
            let targetY = canvas.height / 2 - paddleProps.height / 2;
            player2.y += (targetY - player2.y) * 0.03;
        }
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 10) ball.trail.shift();
    hue += 2;

    // Wall Collision
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.vy *= -1;
        playSound('wall');
        spawnParticles(ball.x, ball.y, '#ffffff', 5, 0.5);
        ball.y = ball.y - ball.radius < 0 ? ball.radius : canvas.height - ball.radius;
    }

    // Paddle 1 Collision
    if (ball.vx < 0 && ball.x - ball.radius < player1.x + paddleProps.width &&
        ball.x - ball.radius > player1.x && ball.y > player1.y && ball.y < player1.y + paddleProps.height) {
        
        ball.vx *= -1;
        ball.speed = Math.min(ball.speed + 0.5, 18); // Max speed cap
        
        let relativeIntersect = (player1.y + (paddleProps.height / 2)) - ball.y;
        let normalizedIntersect = relativeIntersect / (paddleProps.height / 2);
        
        // Add "English" (Spin) based on paddle movement
        let paddleVelocity = player1.y - player1.lastY;
        ball.vy = (normalizedIntersect * -5) + (paddleVelocity * 0.3);
        
        let currentSpeed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
        ball.vx = (ball.vx / currentSpeed) * ball.speed;
        ball.vy = (ball.vy / currentSpeed) * ball.speed;
        
        triggerHitJuice(ball.x, ball.y, player1.color);
    }

    // Paddle 2 Collision
    if (ball.vx > 0 && ball.x + ball.radius > player2.x &&
        ball.x + ball.radius < player2.x + paddleProps.width && ball.y > player2.y && ball.y < player2.y + paddleProps.height) {
        
        ball.vx *= -1;
        ball.speed = Math.min(ball.speed + 0.5, 18);
        
        let relativeIntersect = (player2.y + (paddleProps.height / 2)) - ball.y;
        let normalizedIntersect = relativeIntersect / (paddleProps.height / 2);
        
        let paddleVelocity = player2.y - player2.lastY;
        ball.vy = (normalizedIntersect * -5) + (paddleVelocity * 0.3);
        
        let currentSpeed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
        ball.vx = (ball.vx / currentSpeed) * ball.speed;
        ball.vy = (ball.vy / currentSpeed) * ball.speed;

        triggerHitJuice(ball.x, ball.y, player2.color);
    }

    // Scoring
    if (ball.x < -20) {
        player2.score++;
        score2El.innerText = player2.score;
        playSound('score');
        shakeAmount = 15; // Big shake on score
        checkWin();
        if(gameState === 'PLAYING') resetBall(2);
    } else if (ball.x > canvas.width + 20) {
        player1.score++;
        score1El.innerText = player1.score;
        playSound('score');
        shakeAmount = 15;
        checkWin();
        if(gameState === 'PLAYING') resetBall(1);
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function checkWin() {
    let max = maxScoreSelect.value;
    if (max === 'Infinity') return;
    max = parseInt(max);
    
    if (player1.score >= max) endGame('PLAYER 1');
    else if (player2.score >= max) endGame(modeSelect.value === '1' ? 'SYSTEM AI' : 'PLAYER 2');
}

function endGame(winner) {
    gameState = 'GAMEOVER';
    winnerText.innerText = `${winner} WINS`;
    gameOverScreen.classList.remove('hidden');
}

function draw() {
    ctx.save();

    // Apply Screen Shake
    if (shakeAmount > 0.5) {
        let dx = (Math.random() - 0.5) * shakeAmount;
        let dy = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(dx, dy);
        shakeAmount *= 0.9; 
    }

    // Clear background with trail fade
    ctx.fillStyle = 'rgba(10, 10, 12, 0.5)';
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

    // Draw center dashed line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 20]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    if (gameState === 'PLAYING') {
        // Draw Particles
        particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        ctx.globalAlpha = 1;

        // Draw Ball Trail
        ball.trail.forEach((p, index) => {
            const alpha = (index / ball.trail.length) * 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, ball.radius * (index / ball.trail.length), 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Ball
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Draw Paddles
    ctx.fillStyle = player1.color;
    ctx.shadowColor = player1.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(player1.x, player1.y, paddleProps.width, paddleProps.height);

    ctx.fillStyle = player2.color;
    ctx.shadowColor = player2.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(player2.x, player2.y, paddleProps.width, paddleProps.height);
    
    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'PLAYING' || gameState === 'GAMEOVER') {
        animId = requestAnimationFrame(gameLoop);
    }
}

draw(); // Initial render

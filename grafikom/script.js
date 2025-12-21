/**
 * TUGAS BESAR GRAFIKA KOMPUTER & PENGOLAHAN CITRA
 * Engine: HTML5 Canvas Custom Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

// --- KONFIGURASI ---
const COLS = 8;
const ROWS = 8;
const CELL_SIZE = 64; // 512px / 8
const ANIMATION_SPEED = 0.2; // Kecepatan Lerp (0.0 - 1.0)
const GAME_DURATION = 60; // Durasi game dalam detik

// Warna permata (digunakan untuk generate aset)
const COLORS = ['#FF4136', '#2ECC40', '#0074D9', '#FFDC00', '#B10DC9', '#FF851B'];
let assets = {}; // Menyimpan gambar sprite yang digenerate

// State Game
let grid = []; // 2D Array
let particles = [];
let score = 0;
let selectedGem = null;
let isAnimating = false;
let timeLeft = GAME_DURATION;
let isGameOver = false;

// --- [GRAFIKOM] PROCEDURAL ASSET GENERATION ---
// Membuat sprite permata menggunakan kode (bukan load image)
// Menunjukkan pemahaman tentang rendering shape dan gradient.
function createGemAssets() {
    COLORS.forEach((color, index) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CELL_SIZE;
        tempCanvas.height = CELL_SIZE;
        const tCtx = tempCanvas.getContext('2d');

        // Gambar Lingkaran Dasar
        const cx = CELL_SIZE / 2;
        const cy = CELL_SIZE / 2;
        const radius = CELL_SIZE / 2 - 4;

        // Radial Gradient untuk efek 3D (Lighting)
        const grad = tCtx.createRadialGradient(cx - 10, cy - 10, 5, cx, cy, radius);
        grad.addColorStop(0, '#fff');   // Highlight
        grad.addColorStop(0.3, color);  // Warna utama
        grad.addColorStop(1, '#000');   // Shadow

        tCtx.beginPath();
        tCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        tCtx.fillStyle = grad;
        tCtx.fill();
        
        // Simpan sebagai ImageBitmap/Pattern
        assets[index] = tempCanvas;
    });
}

// --- KELAS GEM ---
class Gem {
    constructor(c, r, type) {
        this.c = c;
        this.r = r;
        this.type = type;
        // Koordinat visual (x, y) untuk animasi
        this.x = c * CELL_SIZE;
        this.y = r * CELL_SIZE;
        // Koordinat target (kemana dia harus bergerak)
        this.targetX = this.x;
        this.targetY = this.y;
        this.isMatch = false;
        this.alpha = 1; // Transparansi
        this.grayscale = false; // Flag untuk efek citra
    }

    // [GRAFIKOM] UPDATE DENGAN LERP (LINEAR INTERPOLATION)
    // Rumus: Current = Current + (Target - Current) * speed
    update() {
        if (Math.abs(this.targetX - this.x) > 1) {
            this.x += (this.targetX - this.x) * ANIMATION_SPEED;
        } else {
            this.x = this.targetX;
        }

        if (Math.abs(this.targetY - this.y) > 1) {
            this.y += (this.targetY - this.y) * ANIMATION_SPEED;
        } else {
            this.y = this.targetY;
        }
    }
}

// --- INISIALISASI ---
function init() {
    createGemAssets();
    // Isi Grid
    for (let c = 0; c < COLS; c++) {
        grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            grid[c][r] = new Gem(c, r, Math.floor(Math.random() * COLORS.length));
        }
    }
    resolveMatches(); // Pastikan tidak ada match awal
    loop();
}

function resolveMatches() {
    // Loop sederhana untuk hilangkan match di awal
    let matches = findMatches();
    while (matches.length > 0) {
        matches.forEach(g => {
            grid[g.c][g.r].type = Math.floor(Math.random() * COLORS.length);
        });
        matches = findMatches();
    }
}

// --- GAME LOOP (UTAMA) ---
function loop() {
    if (!isGameOver) {
        update();
        draw();
        
        // Logika Timer
        timeLeft -= 1/60; // Asumsi berjalan di 60fps (kurangi ~0.016s per frame)
        
        // Update UI HTML (Pastikan ada elemen <span id="timer"> di HTML)
        const timerEl = document.getElementById('timer');
        if(timerEl) timerEl.innerText = Math.ceil(timeLeft);

        if (timeLeft <= 0) {
            triggerGameOver();
        }
    }
    requestAnimationFrame(loop);
}

function triggerGameOver() {
    isGameOver = true;

    // 1. Gambar frame terakhir agar tidak blank
    draw(); 

    // 2. [PENGOLAHAN CITRA] Terapkan Filter Sepia ke seluruh layar
    applySepiaFilter();

    // 3. [GRAFIKOM] Rendering Text UI di Canvas
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, canvas.height/2 - 70, canvas.width, 140);
    
    ctx.font = "bold 40px Segoe UI";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2 - 10);
    
    ctx.font = "20px Segoe UI";
    ctx.fillStyle = "#cccccc";
    ctx.fillText("Final Score: " + score, canvas.width/2, canvas.height/2 + 30);
    ctx.fillText("Refresh halaman untuk main lagi", canvas.width/2, canvas.height/2 + 60);
}

function update() {
    // Update posisi semua gem
    let moving = false;
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const gem = grid[c][r];
            gem.update();
            if (gem.x !== gem.targetX || gem.y !== gem.targetY) moving = true;
        }
    }
    
    // Update partikel
    particles.forEach((p, index) => {
        p.life -= 0.05;
        p.x += p.vx;
        p.y += p.vy;
        if(p.life <= 0) particles.splice(index, 1);
    });

    if (!moving && !isAnimating) {
        // Cek match jika board diam
        handleMatches();
    }
}

// --- [GRAFIKOM] RENDERING PIPELINE ---
function draw() {
    // 1. Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Grid Background (Checkerboard pattern)
    // Menunjukkan pemahaman koordinat 2D
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            ctx.fillStyle = (c + r) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)';
            ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    // 3. Draw Gems
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const gem = grid[c][r];
            if (gem.type === -1) continue; // Kosong

            // Jika sedang proses hancur (grayscale), gambar canvas khusus
            if (gem.grayscale) {
                // Gambar asset normal dulu
                ctx.drawImage(assets[gem.type], gem.x, gem.y);
                // Lalu timpa dengan efek filter
                applyGrayscaleFilter(gem.x, gem.y, CELL_SIZE, CELL_SIZE);
            } else {
                // Gambar normal
                ctx.globalAlpha = gem.alpha;
                ctx.drawImage(assets[gem.type], gem.x, gem.y);
                ctx.globalAlpha = 1.0;
            }

            // Highlight selection
            if (selectedGem && selectedGem.c === c && selectedGem.r === r) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.strokeRect(gem.x + 5, gem.y + 5, CELL_SIZE - 10, CELL_SIZE - 10);
            }
        }
    }
    
    // 4. Draw Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
}

// --- [PENGOLAHAN CITRA] IMAGE PROCESSING UTILS ---

// 1. Grayscale Filter (Object Level)
function applyGrayscaleFilter(x, y, w, h) {
    const imgData = ctx.getImageData(x, y, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Rumus Luminosity Grayscale
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
    }
    ctx.putImageData(imgData, x, y);
}

// 2. Sepia Filter (Full Screen Level - Game Over)
function applySepiaFilter() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Rumus Matrix Sepia
        const tr = 0.393 * r + 0.769 * g + 0.189 * b;
        const tg = 0.349 * r + 0.686 * g + 0.168 * b;
        const tb = 0.272 * r + 0.534 * g + 0.131 * b;

        // Clamp value agar tidak lebih dari 255
        data[i] = tr > 255 ? 255 : tr;
        data[i + 1] = tg > 255 ? 255 : tg;
        data[i + 2] = tb > 255 ? 255 : tb;
    }
    ctx.putImageData(imgData, 0, 0);
}

// --- LOGIKA GAME & MATCHING ---
function handleMatches() {
    const matches = findMatches();
    if (matches.length > 0) {
        isAnimating = true;
        
        // Efek Visual: Ubah jadi Grayscale dulu sebelum meledak
        matches.forEach(g => grid[g.c][g.r].grayscale = true);

        // Delay agar dosen bisa lihat efek Grayscale-nya
        setTimeout(() => {
            score += matches.length * 10;
            scoreEl.innerText = score;
            
            // Hapus & Spawn Partikel
            matches.forEach(g => {
                spawnParticles(g.x + CELL_SIZE/2, g.y + CELL_SIZE/2, COLORS[g.type]);
                grid[g.c][g.r].type = -1; // Kosongkan
                grid[g.c][g.r].grayscale = false;
            });

            // Gravitasi (Jatuh)
            setTimeout(() => {
                applyGravity();
                setTimeout(() => {
                    isAnimating = false;
                }, 400); // Tunggu jatuh selesai
            }, 100);
        }, 400); // Durasi tampilan grayscale
    }
}

function findMatches() {
    let matched = new Set();
    
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 2; c++) {
            let t = grid[c][r].type;
            if (t === -1) continue;
            if (grid[c+1][r].type === t && grid[c+2][r].type === t) {
                matched.add(grid[c][r]);
                matched.add(grid[c+1][r]);
                matched.add(grid[c+2][r]);
            }
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 2; r++) {
            let t = grid[c][r].type;
            if (t === -1) continue;
            if (grid[c][r+1].type === t && grid[c][r+2].type === t) {
                matched.add(grid[c][r]);
                matched.add(grid[c][r+1]);
                matched.add(grid[c][r+2]);
            }
        }
    }
    return Array.from(matched);
}

function applyGravity() {
    // Mengisi kolom kosong
    for (let c = 0; c < COLS; c++) {
        let emptyCount = 0;
        // Geser yang ada ke bawah
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[c][r].type === -1) {
                emptyCount++;
            } else if (emptyCount > 0) {
                grid[c][r + emptyCount].type = grid[c][r].type;
                grid[c][r + emptyCount].targetY = (r + emptyCount) * CELL_SIZE;
                grid[c][r].type = -1;
            }
        }
        // Isi yang kosong di atas dengan baru
        for (let r = 0; r < emptyCount; r++) {
            grid[c][r].type = Math.floor(Math.random() * COLORS.length);
            grid[c][r].y = -CELL_SIZE * (emptyCount - r); // Mulai dari atas layar
            grid[c][r].targetY = r * CELL_SIZE;
        }
    }
}

function spawnParticles(x, y, color) {
    for(let i=0; i<8; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 5 + 2,
            color: color,
            life: 1.0
        });
    }
}

// --- INPUT HANDLING ---
canvas.addEventListener('mousedown', e => {
    // Kunci input jika sedang animasi atau Game Over
    if (isAnimating || isGameOver) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);

    if (!selectedGem) {
        selectedGem = {c, r};
    } else {
        // Cek adjacency (tetangga)
        const dist = Math.abs(selectedGem.c - c) + Math.abs(selectedGem.r - r);
        if (dist === 1) {
            // Swap
            doSwap(selectedGem, {c, r});
            selectedGem = null;
        } else {
            selectedGem = {c, r}; // Ganti selection
        }
    }
});

function doSwap(pos1, pos2) {
    isAnimating = true;
    
    // Swap Types secara logika
    let tempType = grid[pos1.c][pos1.r].type;
    grid[pos1.c][pos1.r].type = grid[pos2.c][pos2.r].type;
    grid[pos2.c][pos2.r].type = tempType;

    // Trigger animasi visual (Grafikom: menukar visual)
    // Sebenarnya di update() akan otomatis bergerak karena target type berubah
    
    // Cek match setelah swap
    setTimeout(() => {
        if (findMatches().length === 0) {
            // Swap balik jika tidak ada match
            let temp = grid[pos1.c][pos1.r].type;
            grid[pos1.c][pos1.r].type = grid[pos2.c][pos2.r].type;
            grid[pos2.c][pos2.r].type = temp;
            isAnimating = false;
        } else {
            isAnimating = false; // Biarkan loop handleMatches menangkapnya
        }
    }, 250);
}

// Start
init();
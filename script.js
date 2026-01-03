/**
 * TUGAS BESAR GRAFIKA KOMPUTER & PENGOLAHAN CITRA
 * Engine: HTML5 Canvas Custom Engine
 * Fitur Utama: Texture Mapping & Geometric Transformation (Animation)
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

// [GRAFIKOM] TEXTURE MAPPING CONFIG
// Menggantikan warna solid dengan file texture (Bitmap Assets)
const TEXTURE_FILES = [
    'img/gem0.png', 
    'img/gem1.png', 
    'img/gem2.png', 
    'img/gem3.png', 
    'img/gem4.png', 
    'img/gem5.png'
];

// State Assets
let textures = []; // Array untuk menyimpan objek Image yang sudah di-load
let assetsLoaded = 0; // Counter loading

// State Game
let grid = []; // 2D Array
let particles = [];
let score = 0;
let selectedGem = null;
let isAnimating = false;
let timeLeft = GAME_DURATION;
let isGameOver = false;

// --- [GRAFIKOM] ASSET LOADING SYSTEM ---
// Fungsi ini memuat citra eksternal untuk digunakan sebagai Texture
function loadTextures(callback) {
    TEXTURE_FILES.forEach((src, index) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            assetsLoaded++;
            // Pastikan semua texture ter-load sebelum game mulai
            if (assetsLoaded === TEXTURE_FILES.length) {
                callback(); 
            }
        };
        // Error handling jika gambar tidak ditemukan
        img.onerror = () => {
            console.error("Gagal memuat texture:", src);
            alert("Texture " + src + " tidak ditemukan! Pastikan folder img dan file png sudah dibuat.");
        };
        textures[index] = img;
    });
}

// --- KELAS GEM ---
class Gem {
    constructor(c, r, type) {
        this.c = c;
        this.r = r;
        this.type = type;
        // Koordinat visual (x, y) untuk animasi posisi
        this.x = c * CELL_SIZE;
        this.y = r * CELL_SIZE;
        
        // Koordinat target (kemana dia harus bergerak)
        this.targetX = this.x;
        this.targetY = this.y;
        
        this.isMatch = false;
        this.alpha = 1; // Transparansi
        this.grayscale = false; // Flag untuk efek citra
        
        // [GRAFIKOM] ANIMATION PROPERTIES
        // Menambahkan properti sudut untuk transformasi rotasi
        this.angle = 0; 
        this.rotSpeed = (Math.random() * 0.005) + 0.002; // Kecepatan putar acak
    }

    // [GRAFIKOM] UPDATE PHYSICS & ANIMATION
    update() {
        // 1. Animasi Translasi (Perpindahan Posisi Linear Interpolation)
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

        // 2. Animasi Rotasi (Geometric Transformation)
        // Permata berputar terus menerus jika tidak sedang dalam efek grayscale
        if (!this.grayscale) {
            this.angle += this.rotSpeed;
            if (this.angle > Math.PI * 2) this.angle = 0;
        }
    }
}

// --- INISIALISASI ---
function init() {
    // Isi Grid
    for (let c = 0; c < COLS; c++) {
        grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            grid[c][r] = new Gem(c, r, Math.floor(Math.random() * TEXTURE_FILES.length));
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
            grid[g.c][g.r].type = Math.floor(Math.random() * TEXTURE_FILES.length);
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
        timeLeft -= 1/60; // Asumsi berjalan di 60fps
        
        // Update UI HTML
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

    // 1. Gambar frame terakhir
    draw(); 

    // 2. [PENGOLAHAN CITRA] Terapkan Filter Sepia ke seluruh layar
    applySepiaFilter();

    // 3. Render Text UI
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

    // 2. Draw Grid Background
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            ctx.fillStyle = (c + r) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)';
            ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    // 3. Draw Gems (Texture Mapping & Transformations)
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const gem = grid[c][r];
            if (gem.type === -1) continue; 

            // Save state canvas sebelum transformasi
            ctx.save();

            // [GRAFIKOM] TRANSFORMASI GEOMETRI
            // Pindahkan titik pusat (pivot) ke tengah sel grid untuk rotasi
            const centerX = gem.x + CELL_SIZE / 2;
            const centerY = gem.y + CELL_SIZE / 2;
            ctx.translate(centerX, centerY);
            
            // Lakukan Rotasi sesuai properti animasi
            ctx.rotate(gem.angle);

            // [GRAFIKOM] TEXTURE MAPPING
            // Menggambar image texture pada koordinat relatif terhadap pivot (-half, -half)
            // Jika dalam mode grayscale (match), kita gambar dulu lalu filter
            if (gem.grayscale) {
                // Gambar texture normal
                ctx.drawImage(textures[gem.type], -CELL_SIZE/2, -CELL_SIZE/2, CELL_SIZE, CELL_SIZE);
                
                // Restore dulu agar filter grayscale diterapkan pada posisi absolut layar
                ctx.restore(); 
                applyGrayscaleFilter(gem.x, gem.y, CELL_SIZE, CELL_SIZE);
            } else {
                // Rendering Normal dengan Alpha & Texture
                ctx.globalAlpha = gem.alpha;
                ctx.drawImage(textures[gem.type], -CELL_SIZE/2, -CELL_SIZE/2, CELL_SIZE, CELL_SIZE);
                ctx.globalAlpha = 1.0;
                
                // Restore state canvas (menghapus rotasi/translasi untuk objek berikutnya)
                ctx.restore();
            }

            // Highlight selection (Gambar kotak di posisi absolut, tidak ikut berputar)
            if (selectedGem && selectedGem.c === c && selectedGem.r === r) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.strokeRect(gem.x + 5, gem.y + 5, CELL_SIZE - 10, CELL_SIZE - 10);
            }
        }
    }
    
    // 4. Draw Particles
    particles.forEach(p => {
        // Ambil warna dari partikel (bisa disesuaikan hardcode warna jika perlu)
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
                // Warna partikel disesuaikan (putih/gold karena tekstur bisa berwarna-warni)
                spawnParticles(g.x + CELL_SIZE/2, g.y + CELL_SIZE/2, '#FFD700');
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
            grid[c][r].type = Math.floor(Math.random() * TEXTURE_FILES.length);
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

    // Trigger animasi visual 
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

// Start dengan meload texture terlebih dahulu
loadTextures(() => {
    init();
});

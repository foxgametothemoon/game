/**
 * Neon Forest Runner - FOX GAME P2E
 * A 2D neon-themed endless runner game with cryptocurrency integration
 */

// Game Constants
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const GRAVITY = 1.5;
const JUMP_FORCE = -30;
const RUN_SPEED = 6;
const INITIAL_OBSTACLE_SPACING = 1000; //make it 1000
const MIN_OBSTACLE_SPACING = 400;
const GROUND_HEIGHT = 100;
const PLAYER_WIDTH = 200;
const PLAYER_HEIGHT = 200;
const COLLECTIBLE_SIZE = 50;
const OBSTACLE_SCALE_FACTOR = 0.8; // Determines how quickly obstacles get closer together

let gameInitialized = false;

// Game State
let game = {
  canvas: null,
  ctx: null,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: 1,
  distance: 0,
  score: 0,
  foxCoins: 0,
  isRunning: false,
  isPaused: false,
  isGameOver: false,
  hasWallet: false,
  frameCount: 0,
  lastTimestamp: 0,
  deltaTime: 0,
  debug: false, // Set to true to see hitboxes
  backgroundLayers: [],
  obstacles: [],
  collectibles: [],
  player: null,
  animationFrameId: null,
  powerUps: [],
  activePowerUps: [],
  highScores: {
    distance: [],
    cherries: [],
    coins: [],
  },
};

// Asset Management
const assets = {
  images: {},
  audio: {},
  loaded: 0,
  total: 0,

  // Add an image to load
  loadImage: function (key, src) {
    this.total++;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      this.images[key] = img;
      this.loaded++;
      updateLoadingProgress();
    };
    img.onerror = () => {
      console.error("Error loading image:", src);
      this.loaded++;
      updateLoadingProgress();
    };
  },

  // Add an audio file to load
  loadAudio: function (key, src) {
    this.total++;
    const audio = new Audio();
    audio.src = src;
    audio.oncanplaythrough = () => {
      this.audio[key] = audio;
      this.loaded++;
      updateLoadingProgress();
    };
    audio.onerror = () => {
      console.error("Error loading audio:", src);
      this.loaded++;
      updateLoadingProgress();
    };
  },

  // Generate a placeholder image with the given color
  getPlaceholderImage: function (width, height, color) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas;
  },

  // Create placeholder images for development
  createPlaceholders: function () {
    // Create placeholders for missing assets
    if (!this.images.playerRun) {
      this.images.playerRun = this.getPlaceholderImage(
        PLAYER_WIDTH * 6,
        PLAYER_HEIGHT,
        "#00f3ff"
      );
    }
    if (!this.images.playerJump) {
      this.images.playerJump = this.getPlaceholderImage(
        PLAYER_WIDTH,
        PLAYER_HEIGHT,
        "#00f3ff"
      );
    }
    if (!this.images.playerSlide) {
      this.images.playerSlide = this.getPlaceholderImage(
        PLAYER_WIDTH,
        PLAYER_HEIGHT / 2,
        "#00f3ff"
      );
    }
    if (!this.images.cherry) {
      this.images.cherry = this.getPlaceholderImage(
        COLLECTIBLE_SIZE,
        COLLECTIBLE_SIZE,
        "#ff00ff"
      );
    }
    if (!this.images.foxCoin) {
      this.images.foxCoin = this.getPlaceholderImage(
        COLLECTIBLE_SIZE,
        COLLECTIBLE_SIZE,
        "#ffcc00"
      );
    }
    if (!this.images.obstacle1) {
      this.images.obstacle1 = this.getPlaceholderImage(100, 100, "#00ff9d");
    }
    if (!this.images.obstacle2) {
      this.images.obstacle2 = this.getPlaceholderImage(100, 200, "#c900ff");
    }
    if (!this.images.background1) {
      this.images.background1 = this.getPlaceholderImage(
        GAME_WIDTH,
        GAME_HEIGHT,
        "#050a1a"
      );
    }
    if (!this.images.background2) {
      this.images.background2 = this.getPlaceholderImage(
        GAME_WIDTH,
        GAME_HEIGHT,
        "#0a1529"
      );
    }
    if (!this.images.background3) {
      this.images.background3 = this.getPlaceholderImage(
        GAME_WIDTH,
        GAME_HEIGHT,
        "#112040"
      );
    }
    if (!this.images.speedBoost) {
      this.images.speedBoost = this.getPlaceholderImage(
        COLLECTIBLE_SIZE,
        COLLECTIBLE_SIZE,
        "#00ff9d"
      );
    }
    if (!this.images.shield) {
      this.images.shield = this.getPlaceholderImage(
        COLLECTIBLE_SIZE,
        COLLECTIBLE_SIZE,
        "#00f3ff"
      );
    }
    if (!this.images.coinMagnet) {
      this.images.coinMagnet = this.getPlaceholderImage(
        COLLECTIBLE_SIZE,
        COLLECTIBLE_SIZE,
        "#ffcc00"
      );
    }
  },
};

// Class definitions
class Player {
  constructor() {
    this.width = 100; // Adjusted width to match SVG
    this.height = 100; // Adjusted height to match SVG
    this.x = 200;
    this.y = GAME_HEIGHT - GROUND_HEIGHT - this.height;
    this.velocityY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.hasShield = false;
    this.magnetActive = false;
    this.magnetRadius = 200;
  }

  update() {
    // Apply gravity
    this.velocityY += GRAVITY;
    this.y += this.velocityY;

    // Ground collision
    const groundY =
      GAME_HEIGHT -
      GROUND_HEIGHT -
      (this.isSliding ? this.height / 2 : this.height);
    if (this.y > groundY) {
      this.y = groundY;
      this.velocityY = 0;
      this.isJumping = false;
    }

    // Update hitbox based on sliding state
    if (this.isSliding) {
      this.height = 50; // Adjusted height for sliding
    } else {
      this.height = 100; // Adjusted height for running/jumping
    }
  }

  draw(ctx) {
    const yOffset = 30; // Adjust this value to move the SVG down

    // Draw player sprite based on state
    if (this.isJumping) {
      ctx.drawImage(
        assets.images.playerJump,
        0,
        0,
        200,
        200,
        this.x,
        this.y + yOffset,
        this.width,
        this.height
      );
    } else if (this.isSliding) {
      ctx.drawImage(
        assets.images.playerSlide,
        0,
        0,
        200,
        200,
        this.x,
        this.y + yOffset,
        this.width,
        this.height
      );
    } else {
      // Running state
      ctx.drawImage(
        assets.images.playerRun,
        0,
        0,
        200,
        200,
        this.x,
        this.y + yOffset,
        this.width,
        this.height
      );
    }

    // Draw shield if active
    if (this.hasShield) {
      ctx.beginPath();
      ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2 + yOffset,
        this.width / 1.5,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "rgba(0, 243, 255, 0.8)";
      ctx.lineWidth = 5;
      ctx.stroke();

      // Add glow effect
      ctx.beginPath();
      ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2 + yOffset,
        this.width / 1.5 + 5,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "rgba(0, 243, 255, 0.3)";
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    // Draw magnet radius if active
    if (this.magnetActive && game.debug) {
      ctx.beginPath();
      ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2 + yOffset,
        this.magnetRadius,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "rgba(255, 204, 0, 0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Debug hitbox
    if (game.debug) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y + yOffset, this.width, this.height);
    }
  }

  jump() {
    if (!this.isJumping) {
      this.velocityY = JUMP_FORCE;
      this.isJumping = true;
      this.isSliding = false;
      playSound("jump");
    }
  }

  slide() {
    if (this.isJumping) {
      // Bring the player to the ground if jumping
      this.isJumping = false;
      this.y = GAME_HEIGHT - GROUND_HEIGHT - this.height;
    } else if (!this.isSliding) {
      // Slide if not already sliding
      this.isSliding = true;
      playSound("slide");

      // Reset sliding after a delay
      setTimeout(() => {
        this.isSliding = false;
      }, 1000);
    }
  }

  getHitBox() {
    return {
      x: this.x + 10, // Reduced hitbox width for better gameplay
      y: this.y + 5,
      width: this.width - 20,
      height: this.height - 10,
    };
  }
}

class BackgroundLayer {
  constructor(image, speed) {
    this.image = image;
    this.speed = speed;
    this.x = 0;
    this.width = GAME_WIDTH;
    this.height = GAME_HEIGHT;
  }

  update() {
    this.x -= this.speed * game.deltaTime;
    if (this.x <= -this.width) {
      this.x = 0;
    }
  }

  draw(ctx) {
    ctx.drawImage(this.image, this.x, 0, this.width, this.height);
    ctx.drawImage(this.image, this.x + this.width, 0, this.width, this.height);
  }
}

class Obstacle {
  constructor(x, type) {
    this.type = type;
    this.x = x;

    // Set properties based on type
    switch (type) {
      case "low":
        this.width = 70; // Reduced from 100
        this.height = 70; // Reduced from 100
        this.y = GAME_HEIGHT - GROUND_HEIGHT - this.height;
        this.image = assets.images.obstacle1;
        break;
      case "high":
        this.width = 70; // Reduced from 100
        this.height = 70; // Reduced from 200
        this.y = GAME_HEIGHT - GROUND_HEIGHT - this.height;
        this.image = assets.images.obstacle2;
        break;
      case "floating":
        this.width = 70; // Reduced from 100
        this.height = 70; // Reduced from 100
        this.y = GAME_HEIGHT - GROUND_HEIGHT - this.height - 150;
        this.image = assets.images.obstacle1;
        break;
      default:
        this.width = 70; // Reduced from 100
        this.height = 70; // Reduced from 100
        this.y = GAME_HEIGHT - GROUND_HEIGHT - this.height;
        this.image = assets.images.obstacle1;
    }
  }

  update() {
    this.x -= RUN_SPEED * game.deltaTime;
  }

  draw(ctx) {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);

    // // Add neon glow based on obstacle type
    // ctx.beginPath();
    // ctx.rect(this.x, this.y, this.width, this.height);

    // if (this.type === "low") {
    //   ctx.strokeStyle = "rgba(0, 255, 157, 0.8)";
    // } else if (this.type === "high") {
    //   ctx.strokeStyle = "rgba(201, 0, 255, 0.8)";
    // } else {
    //   ctx.strokeStyle = "rgba(0, 243, 255, 0.8)";
    // }

    // ctx.lineWidth = 4;
    // ctx.stroke();

    // Debug hitbox
    if (game.debug) {
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.x + 10,
        this.y + 10,
        this.width - 20,
        this.height - 20
      );
    }
  }

  getHitBox() {
    return {
      x: this.x + 10, // Reduced hitbox for better gameplay feel
      y: this.y + 10,
      width: this.width - 20,
      height: this.height - 20,
    };
  }

  isOutOfScreen() {
    return this.x + this.width < 0;
  }
}

class Collectible {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'cherry', 'foxCoin', or a power-up type
    this.width = COLLECTIBLE_SIZE;
    this.height = COLLECTIBLE_SIZE;
    this.oscillate = Math.random() * Math.PI * 2; // Random starting phase
    this.attractedToPlayer = false;
    this.attractionSpeed = 0;

    // Set image based on type
    switch (type) {
      case "cherry":
        this.image = assets.images.cherry;
        break;
      case "foxCoin":
        this.image = assets.images.foxCoin;
        break;
      case "speedBoost":
        this.image = assets.images.speedBoost;
        break;
      case "shield":
        this.image = assets.images.shield;
        break;
      case "coinMagnet":
        this.image = assets.images.coinMagnet;
        break;
      default:
        this.image = assets.images.cherry;
    }
  }

  update() {
    if (this.attractedToPlayer && game.player.magnetActive) {
      // Calculate direction to player
      const playerX = game.player.x + game.player.width / 2;
      const playerY = game.player.y + game.player.height / 2;
      const dx = playerX - (this.x + this.width / 2);
      const dy = playerY - (this.y + this.height / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < game.player.magnetRadius) {
        // Increase attraction speed the closer it gets
        this.attractionSpeed = Math.min(this.attractionSpeed + 0.5, 20);

        // Normalize direction and move toward player
        const moveX = (dx / distance) * this.attractionSpeed;
        const moveY = (dy / distance) * this.attractionSpeed;

        this.x += moveX;
        this.y += moveY;
      } else {
        // Regular movement
        this.x -= RUN_SPEED * game.deltaTime;
        this.oscillate += 0.05;
        this.y += Math.sin(this.oscillate) * 0.5;
      }
    } else {
      // Regular movement
      this.x -= RUN_SPEED * game.deltaTime;
      this.oscillate += 0.05;
      this.y += Math.sin(this.oscillate) * 0.5;
    }
  }

  draw(ctx) {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);

    // Add glow effect
    ctx.beginPath();
    ctx.arc(
      this.x + this.width / 2,
      this.y + this.height / 2,
      this.width / 2,
      0,
      Math.PI * 2
    );

    // Debug hitbox
    if (game.debug) {
      ctx.strokeStyle = "green";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.x + 10,
        this.y + 10,
        this.width - 20,
        this.height - 20
      );
    }
  }

  getHitBox() {
    return {
      x: this.x + 10,
      y: this.y + 10,
      width: this.width - 20,
      height: this.height - 20,
    };
  }

  isOutOfScreen() {
    return this.x + this.width < 0;
  }
}

class PowerUp {
  constructor(type, duration) {
    this.type = type;
    this.duration = duration;
    this.timeRemaining = duration;
    this.active = true;
  }

  update(deltaTime) {
    this.timeRemaining -= deltaTime / 60; // Convert frames to seconds approximately
    if (this.timeRemaining <= 0) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;

    // Remove effects based on type
    switch (this.type) {
      case "speedBoost":
        // Reset speed if needed (handled in game loop)
        break;
      case "shield":
        game.player.hasShield = false;
        break;
      case "coinMagnet":
        game.player.magnetActive = false;
        break;
    }

    hidePowerUpIndicator();
  }

  getPercentageRemaining() {
    return this.timeRemaining / this.duration;
  }
}

// Input Handler
const keys = {};
let touchStartY = 0;

function setupInput() {
  // Keyboard Events
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;

    // Handle key press actions
    if (game.isRunning && !game.isPaused && !game.isGameOver) {
      if (e.key === " " || e.key === "ArrowUp") {
        game.player.jump();
      } else if (e.key === "ArrowDown") {
        game.player.slide();
      }
    }

    // Pause game
    if (e.key === "p" && game.isRunning && !game.isGameOver) {
      togglePause();
    }

    // Debug mode toggle
    if (e.key === "d") {
      game.debug = !game.debug;
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  // Touch Events for mobile
  window.addEventListener("touchstart", (e) => {
    if (game.isRunning && !game.isPaused && !game.isGameOver) {
      touchStartY = e.touches[0].clientY;
    }
  });

  window.addEventListener("touchend", (e) => {
    if (game.isRunning && !game.isPaused && !game.isGameOver) {
      // Simple tap is jump
      if (e.changedTouches[0].clientY === touchStartY) {
        game.player.jump();
      }
    }
  });

  window.addEventListener("touchmove", (e) => {
    if (game.isRunning && !game.isPaused && !game.isGameOver) {
      const touchY = e.touches[0].clientY;
      const diffY = touchY - touchStartY;

      // Swipe down to slide
      if (diffY > 50) {
        game.player.slide();
        touchStartY = touchY;
      }
    }
  });

  // Button Events
  document.getElementById("startButton").addEventListener("click", startGame);
  document
    .getElementById("restartButton")
    .addEventListener("click", restartGame);
  document.getElementById("pauseButton").addEventListener("click", togglePause);
  document
    .getElementById("resumeButton")
    .addEventListener("click", togglePause);
  document.getElementById("quitButton").addEventListener("click", quitGame);
  document
    .getElementById("leaderboardButton")
    .addEventListener("click", showLeaderboard);
  document
    .getElementById("closeLeaderboardButton")
    .addEventListener("click", hideLeaderboard);
  document
    .getElementById("connectWalletButton")
    .addEventListener("click", connectWallet);
  document.getElementById("audioToggle").addEventListener("click", toggleAudio);

  // Tab buttons in leaderboard
  const tabButtons = document.querySelectorAll(".tab-button");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-tab");
      switchLeaderboardTab(tab);
    });
  });
}

// Initialize the game
function initGame() {
  // Setup canvas
  game.canvas = document.getElementById("gameCanvas");
  game.ctx = game.canvas.getContext("2d");

  // Set canvas size
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Load assets
  loadGameAssets();

  // Setup input handlers
  setupInput();

  // Start loading process
  showLoadingScreen();
}

// Load game assets
function loadGameAssets() {
  // Load images
  assets.loadImage("playerRun", "assets/images/player-run.svg");
  assets.loadImage("playerJump", "assets/images/player-jump.svg");
  assets.loadImage("playerSlide", "assets/images/player-slide.svg");
  assets.loadImage("cherry", "assets/images/cherry.svg");
  assets.loadImage("foxCoin", "assets/images/fox-coin.svg");
  assets.loadImage("obstacle1", "assets/images/obstacle1.svg");
  assets.loadImage("obstacle2", "assets/images/obstacle2.svg");
  assets.loadImage("background1", "assets/images/bg-layer1.jpg");
  assets.loadImage("background2", "assets/images/bg-layer1.jpg");
  assets.loadImage("background3", "assets/images/bg-layer1.jpg");
  assets.loadImage("speedBoost", "assets/images/speed-boost.svg");
  assets.loadImage("shield", "assets/images/shield.svg");
  assets.loadImage("coinMagnet", "assets/images/coin-magnet.svg");

  // Load audio
  assets.loadAudio("jump", "assets/audio/jump.wav");
  assets.loadAudio("slide", "assets/audio/slide.mp3");
  assets.loadAudio("collect", "assets/audio/collect.mp3");
  assets.loadAudio("powerup", "assets/audio/powerup.mp3");
  assets.loadAudio("death", "assets/audio/death.wav");
  assets.loadAudio("music", "assets/audio/music.mp3");
}

// Update loading progress
function updateLoadingProgress() {
  if (assets.loaded >= assets.total && !gameInitialized) {
    gameInitialized = true; // Ensure this runs only once
    assets.createPlaceholders();
    setTimeout(() => {
      showStartScreen();
    }, 1000);
  }
}

// Resize canvas to fit the window
function resizeCanvas() {
  // Maintain aspect ratio
  const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
  let newWidth, newHeight;

  if (window.innerWidth / window.innerHeight > aspectRatio) {
    newHeight = window.innerHeight;
    newWidth = newHeight * aspectRatio;
  } else {
    newWidth = window.innerWidth;
    newHeight = newWidth / aspectRatio;
  }

  game.canvas.width = GAME_WIDTH;
  game.canvas.height = GAME_HEIGHT;

  // Apply CSS sizing
  game.canvas.style.width = `${newWidth}px`;
  game.canvas.style.height = `${newHeight}px`;

  // Calculate scale factor for input handling
  game.scale = GAME_WIDTH / newWidth;
}

// Show loading screen
function showLoadingScreen() {
  document.getElementById("loadingScreen").classList.remove("hidden");
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("gameOverScreen").classList.add("hidden");
  document.getElementById("pauseMenu").classList.add("hidden");
  document.getElementById("gameUI").classList.add("hidden");
  document.getElementById("pauseButton").classList.add("hidden");
}

// Show start screen
function showStartScreen() {
  document.getElementById("loadingScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
  document.getElementById("gameOverScreen").classList.add("hidden");
  document.getElementById("pauseMenu").classList.add("hidden");
  document.getElementById("gameUI").classList.add("hidden");
  document.getElementById("pauseButton").classList.add("hidden");
}

// Show game over screen
function showGameOverScreen() {
  document.getElementById("gameOverScreen").classList.remove("hidden");
  document.getElementById("gameUI").classList.add("hidden");
  document.getElementById("pauseButton").classList.add("hidden");

  // Update final stats
  document.getElementById("finalDistance").textContent =
    Math.floor(game.distance) + "m";
  document.getElementById("finalCherries").textContent = game.score;
  document.getElementById("finalCoins").textContent = game.foxCoins;

  // Show wallet reward if connected
  if (game.hasWallet && game.foxCoins > 0) {
    document.getElementById("walletReward").classList.remove("hidden");
    // Here you would trigger the actual wallet transaction
  } else {
    document.getElementById("walletReward").classList.add("hidden");
  }

  // Update high scores
  updateHighScores();
}

// Toggle pause menu
function togglePause() {
  game.isPaused = !game.isPaused;
  if (game.isPaused) {
    document.getElementById("pauseMenu").classList.remove("hidden");
  } else {
    document.getElementById("pauseMenu").classList.add("hidden");
    // Resume game loop
    if (!game.animationFrameId) {
      game.lastTimestamp = performance.now();
      game.animationFrameId = requestAnimationFrame(gameLoop);
    }
  }
}

// Show leaderboard
function showLeaderboard() {
  document.getElementById("leaderboardPanel").classList.remove("hidden");
  populateLeaderboard("distance");
}

// Hide leaderboard
function hideLeaderboard() {
  document.getElementById("leaderboardPanel").classList.add("hidden");
}

// Switch leaderboard tab
function switchLeaderboardTab(tab) {
  // Update active tab
  document.querySelectorAll(".tab-button").forEach((button) => {
    if (button.getAttribute("data-tab") === tab) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });

  // Update leaderboard content
  populateLeaderboard(tab);
}

// Populate leaderboard with data
function populateLeaderboard(type) {
  const leaderboardList = document.getElementById("leaderboardList");
  leaderboardList.innerHTML = "";

  const scores = game.highScores[type]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (scores.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "leaderboard-entry";
    emptyMessage.innerHTML =
      '<span class="entry-name">No scores yet. Be the first!</span>';
    leaderboardList.appendChild(emptyMessage);
    return;
  }

  scores.forEach((entry, index) => {
    const scoreEntry = document.createElement("div");
    scoreEntry.className = "leaderboard-entry";

    let scoreText;
    if (type === "distance") {
      scoreText = `${entry.score}m`;
    } else {
      scoreText = entry.score;
    }

    scoreEntry.innerHTML = `
            <div class="entry-rank">${index + 1}</div>
            <div class="entry-name">${entry.name || "Runner"}</div>
            <div class="entry-score">${scoreText}</div>
        `;

    leaderboardList.appendChild(scoreEntry);
  });
}

// Update high scores with current game results
function updateHighScores() {
  // Get player name (in a real game you would have a name input)
  const playerName = "Runner";

  // Update distance high score
  game.highScores.distance.push({
    name: playerName,
    score: Math.floor(game.distance),
  });

  // Update cherries high score
  game.highScores.cherries.push({
    name: playerName,
    score: game.score,
  });

  // Update FOX coins high score
  game.highScores.coins.push({
    name: playerName,
    score: game.foxCoins,
  });

  // Sort and limit to top 10
  game.highScores.distance.sort((a, b) => b.score - a.score).slice(0, 10);
  game.highScores.cherries.sort((a, b) => b.score - a.score).slice(0, 10);
  game.highScores.coins.sort((a, b) => b.score - a.score).slice(0, 10);

  // In a real game, you would save these to localStorage or a server
  saveHighScores();
}

// Save high scores to localStorage
function saveHighScores() {
  localStorage.setItem(
    "neonForestRunner_highScores",
    JSON.stringify(game.highScores)
  );
}

// Game Loop Functions
function gameLoop(timestamp) {
  if (!game.lastTimestamp) game.lastTimestamp = timestamp;

  // Reset deltaTime if the game was just restarted
  if (game.isGameOver && game.isRunning) {
    game.lastTimestamp = timestamp;
  }

  game.deltaTime = (timestamp - game.lastTimestamp) / 16.66667; // Normalize to 60fps
  game.lastTimestamp = timestamp;
  game.frameCount++;

  if (!game.isPaused && game.isRunning && !game.isGameOver) {
    updateGame();
    checkCollisions();
    spawnObjects();
  }

  drawGame();
  game.animationFrameId = requestAnimationFrame(gameLoop);
}

function updateGame() {
  // Update game state
  game.distance += RUN_SPEED * game.deltaTime;

  // Update game objects
  game.player.update();
  game.backgroundLayers.forEach((layer) => layer.update());

  // Update obstacles and collectibles
  game.obstacles = game.obstacles.filter((obstacle) => {
    obstacle.update();
    return !obstacle.isOutOfScreen();
  });

  game.collectibles = game.collectibles.filter((collectible) => {
    collectible.update();
    return !collectible.isOutOfScreen();
  });

  // Update active power-ups
  game.activePowerUps = game.activePowerUps.filter((powerUp) => {
    powerUp.update(game.deltaTime);
    return powerUp.active;
  });

  // Difficulty scaling
  const difficulty = Math.min(game.distance / 10000, 1);
  const obstacleSpacing =
    INITIAL_OBSTACLE_SPACING -
    (INITIAL_OBSTACLE_SPACING - MIN_OBSTACLE_SPACING) * difficulty;
}

function drawGame() {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Draw background layers
  game.backgroundLayers.forEach((layer) => layer.draw(ctx));

  // Draw game objects
  game.obstacles.forEach((obstacle) => obstacle.draw(ctx));
  game.collectibles.forEach((collectible) => collectible.draw(ctx));
  game.player.draw(ctx);

  // Draw UI elements
  updateGameUI();
}

// Collision Detection
function checkCollisions() {
  // Player-obstacle collisions
  const playerHitBox = game.player.getHitBox();

  game.obstacles.forEach((obstacle) => {
    const obstacleHitBox = obstacle.getHitBox();
    if (checkAABBCollision(playerHitBox, obstacleHitBox)) {
      if (!game.player.hasShield) {
        endGame();
      } else {
        game.player.hasShield = false;
        removePowerUp("shield");
      }
    }
  });

  // Collectible collisions
  game.collectibles.forEach((collectible, index) => {
    const collectibleHitBox = collectible.getHitBox();
    if (checkAABBCollision(playerHitBox, collectibleHitBox)) {
      handleCollectible(collectible);
      game.collectibles.splice(index, 1);
    }
  });
}

function checkAABBCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Object Spawning
function spawnObjects() {
  // Spawn obstacles
  const lastObstacle = game.obstacles[game.obstacles.length - 1];
  const shouldSpawn =
    !lastObstacle || lastObstacle.x < GAME_WIDTH - getNextObstacleSpacing();

  if (shouldSpawn) {
    const types = ["low", "high", "floating"];
    const type = types[Math.floor(Math.random() * types.length)];
    game.obstacles.push(new Obstacle(GAME_WIDTH, type));
  }

  // Spawn collectibles
  if (Math.random() < 0.02) {
    const y =
      GAME_HEIGHT - GROUND_HEIGHT - COLLECTIBLE_SIZE - Math.random() * 200;
    const type = Math.random() < 0.7 ? "cherry" : "foxCoin";
    game.collectibles.push(new Collectible(GAME_WIDTH, y, type));
  }

  // Spawn power-ups
  if (Math.random() < 0.005) {
    const powerUpTypes = ["speedBoost", "shield", "coinMagnet"];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    const y =
      GAME_HEIGHT - GROUND_HEIGHT - COLLECTIBLE_SIZE - Math.random() * 200;
    game.collectibles.push(new Collectible(GAME_WIDTH, y, type));
  }
}

function getNextObstacleSpacing() {
  const base = INITIAL_OBSTACLE_SPACING * 1.5; // Increased spacing
  const min = MIN_OBSTACLE_SPACING * 1.5; // Increased spacing
  const progress = Math.min(game.distance / 10000, 1);
  return base - (base - min) * progress;
}

// Collectible Handling
function handleCollectible(collectible) {
  playSound("collect");

  switch (collectible.type) {
    case "cherry":
      game.score += 10;
      break;
    case "foxCoin":
      game.foxCoins += 1;
      break;
    case "speedBoost":
      addPowerUp(new PowerUp("speedBoost", 10));
      break;
    case "shield":
      addPowerUp(new PowerUp("shield", 15));
      game.player.hasShield = true;
      break;
    case "coinMagnet":
      addPowerUp(new PowerUp("coinMagnet", 12));
      game.player.magnetActive = true;
      break;
  }
}

// Power-Up Management
function addPowerUp(powerUp) {
  game.activePowerUps.push(powerUp);
  showPowerUpIndicator(powerUp);
  playSound("powerup");
}

function removePowerUp(type) {
  const index = game.activePowerUps.findIndex((p) => p.type === type);
  if (index !== -1) {
    game.activePowerUps.splice(index, 1);
  }
}

// Audio Functions
function playSound(soundKey) {
  if (!assets.audio[soundKey] || isAudioMuted()) return;
  const clone = assets.audio[soundKey].cloneNode();
  clone.play();
}

function toggleAudio() {
  const isMuted = document.documentElement.classList.toggle("audio-off");
  localStorage.setItem("audioMuted", isMuted);

  // Stop background music if muted
  if (isMuted) {
    stopBackgroundMusic();
  } else {
    // Play background music if unmuted
    playBackgroundMusic();
  }
}

function isAudioMuted() {
  return document.documentElement.classList.contains("audio-off");
}

// Wallet Integration
async function connectWallet() {
  try {
    if (window.solana && window.solana.isPhantom) {
      await window.solana.connect();
      game.hasWallet = true;
      document.getElementById("walletAddress").textContent =
        window.solana.publicKey.toString().slice(0, 6) + "...";
      showNotification("Wallet connected!");
    } else {
      showNotification("Please install Phantom Wallet!");
    }
  } catch (error) {
    console.error("Wallet connection error:", error);
    showNotification("Connection failed");
  }
}

// Game State Management
function startGame() {
  resetGameState();
  game.isRunning = true;
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("gameUI").classList.remove("hidden");
  document.getElementById("pauseButton").classList.remove("hidden");

  // Play background music
  playBackgroundMusic();

  // Initial spawn
  game.obstacles.push(new Obstacle(GAME_WIDTH * 0.5, "low"));
  game.backgroundLayers.push(
    new BackgroundLayer(assets.images.background1, 0.5),
    new BackgroundLayer(assets.images.background2, 1),
    new BackgroundLayer(assets.images.background3, 2)
  );

  gameLoop(performance.now());
}

function resetGameState() {
  // Reset game state
  game.distance = 0;
  game.score = 0;
  game.foxCoins = 0;
  game.isRunning = false; // Ensure running state is reset
  game.isGameOver = false;
  game.isPaused = false; // Ensure pause state is reset
  game.frameCount = 0;
  game.lastTimestamp = 0; // Reset timestamp
  game.deltaTime = 0; // Reset deltaTime

  // Clear and reset background layers
  game.backgroundLayers = [];
  game.backgroundLayers.push(
    new BackgroundLayer(assets.images.background1, 0.5),
    new BackgroundLayer(assets.images.background2, 1),
    new BackgroundLayer(assets.images.background3, 2)
  );

  // Clear game objects
  game.obstacles = [];
  game.collectibles = [];
  game.activePowerUps = [];

  // Reset player properties
  game.player = new Player();
  game.player.velocityY = 0; // Ensure velocity is reset
  game.player.isJumping = false; // Reset jumping state
  game.player.isSliding = false; // Reset sliding state
  game.player.hasShield = false; // Reset shield state
  game.player.magnetActive = false; // Reset magnet state
  game.player.y = GAME_HEIGHT - GROUND_HEIGHT - game.player.height; // Reset player position

  // Reset UI elements
  document.getElementById("distanceCounter").textContent = "0m";
  document.getElementById("cherryCounter").textContent = "0";
  document.getElementById("coinCounter").textContent = "0";
  document.getElementById("powerUpIndicator").classList.add("hidden");

  // Reset initial spawn
  game.obstacles.push(new Obstacle(GAME_WIDTH * 0.5, "low"));
}

function endGame() {
  game.isRunning = false;
  game.isGameOver = true;
  cancelAnimationFrame(game.animationFrameId);
  showGameOverScreen();
  playSound("death");
  stopBackgroundMusic(); // Stop background music
}

function restartGame() {
  // Hide game over screen
  document.getElementById("gameOverScreen").classList.add("hidden");

  // Reset game state
  resetGameState();

  // Show game UI and start the game
  document.getElementById("gameUI").classList.remove("hidden");
  document.getElementById("pauseButton").classList.remove("hidden");
  game.isRunning = true;

  // Play background music
  playBackgroundMusic();

  // Start game loop
  gameLoop(performance.now());
}

function quitGame() {
  endGame();
  showStartScreen();
}

// UI Updates
function updateGameUI() {
  document.getElementById("distanceCounter").textContent = `${Math.floor(
    game.distance
  )}m`;
  document.getElementById("cherryCounter").textContent = game.score;
  document.getElementById("coinCounter").textContent = game.foxCoins;
}

function showPowerUpIndicator(powerUp) {
  const indicator = document.getElementById("powerUpIndicator");
  indicator.classList.remove("hidden");
  indicator.querySelector(
    ".power-up-timer"
  ).style.animation = `timer ${powerUp.duration}s linear forwards`;
}

function hidePowerUpIndicator() {
  document.getElementById("powerUpIndicator").classList.add("hidden");
}

function showNotification(text) {
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = text;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

// Mobile-Specific Controls
function setupMobileControls() {
  if ("ontouchstart" in window) {
    const mobileControls = document.createElement("div");
    mobileControls.className = "mobile-controls";
    mobileControls.innerHTML = `
      <div class="left-area"></div>
      <div class="right-area"></div>
      <div class="hint-text">Swipe down to slide</div>
    `;
    document.querySelector(".game-container").appendChild(mobileControls);
  }
}

function playBackgroundMusic() {
  if (!assets.audio.music || isAudioMuted()) return;

  // Use the original audio element
  const music = assets.audio.music;
  music.loop = true; // Enable looping
  music.volume = 0.5; // Adjust volume (optional)
  music.play();
}

function stopBackgroundMusic() {
  if (assets.audio.music) {
    assets.audio.music.pause(); // Pause the music
    assets.audio.music.currentTime = 0; // Reset playback to the start
  }
}

// Initialize the game when loaded
window.addEventListener("load", () => {
  initGame();
  setupMobileControls();
  if (localStorage.getItem("audioMuted") === "true") {
    document.documentElement.classList.add("audio-off");
  }
});

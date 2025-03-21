const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Sound effects
const jumpSound = new Audio("assets/audio/jump.wav");
const deathSound = new Audio("assets/audio/death.wav");
const collectSound = new Audio("assets/audio/collect.mp3");
const powerupSound = new Audio("assets/audio/powerup.mp3");
const slideSound = new Audio("assets/audio/slide.mp3");

const welcomeScreen = document.getElementById("welcomeScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const leaderboardScreen = document.getElementById("leaderboardScreen");
const mobileViewScreen = document.getElementById("mobileViewScreen");

const startGameButton = document.getElementById("startGameButton");
const connectWalletButton = document.getElementById("connectWalletButton");
const walletStat = document.getElementById("walletStat");
const walletAddressDisplay = document.getElementById("walletAddressDisplay");
const restartButton = document.getElementById("restartButton");
const leaderboardButton = document.getElementById("leaderboardButton");
const closeLeaderboard = document.getElementById("closeLeaderboard");
const finalScoreDisplay = document.getElementById("finalScore");
const highScoresList = document.getElementById("highScoresList");
const currentScoreDisplay = document.getElementById("currentScore");
const powerupBar = document.getElementById("powerupBar");
const audioToggle = document.getElementById("audioToggle");

let coinMagnetImage = new Image();
coinMagnetImage.src = "assets/images/coin-magnet.svg";

// Define probabilities for each type of collectible
const cherryProbability = 0.6; // 60% chance
const coinProbability = 0.2; // 20% chance
const energyDrinkProbability = 0.1; // 10% chance
const coinMagnetProbability = 0.1; // 10% chance

// connect wallet to game
async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const response = await window.solana.connect();
      userPublicKey = response.publicKey.toString();
      console.log(userPublicKey);
      walletStat.style.display = "flex";
      walletAddressDisplay.textContent =
        userPublicKey.slice(0, 5) + "..." + userPublicKey.slice(-5);
      walletAddressDisplay.title = userPublicKey;
    } catch (error) {
      console.error("Connection failed", error);
    }
  } else {
    alert(
      "Phantom Wallet not found. Please install it from https://phantom.app/"
    );
  }
}
let userPublicKey = null;
connectWalletButton.addEventListener("click", connectWallet);

// Function to upload scores to backend API
async function uploadScores(scores) {
  const apiUrl = "https://foxgame.pythonanywhere.com/api/scores"; // Replace with your actual API URL

  if (!userPublicKey) {
    alert("Please connect your wallet before uploading scores.");
    return; // Exit the function if wallet is not connected
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(scores),
    });

    if (response.ok) {
      console.log("Scores uploaded successfully!");
      // Optionally, clear the local storage
      localStorage.removeItem("pendingScores");
    } else {
      console.error("Failed to upload scores:", response.status);
      alert("Failed to upload scores. Please try again later.");
    }
  } catch (error) {
    console.error("Error uploading scores:", error);
    alert("An error occurred while uploading scores. Please try again later.");
  }
}

// Function to handle beforeunload event
function handleBeforeUnload(event) {
  const pendingScores = JSON.parse(localStorage.getItem("pendingScores")) || [];

  if (pendingScores.length > 0) {
    event.preventDefault(); // Standard for most browsers
    event.returnValue =
      "You have unsaved scores. Do you want to upload them before leaving?"; // Chrome requires returnValue

    // Upload scores asynchronously
    uploadScores(pendingScores);
  }
}

// Example score saving (you'll need to adapt this to your game logic)
function saveScore(score, cherriesCollected, coinsCollected) {
  const scoreData = {
    publicKey: userPublicKey, // Use the stored public key
    score: score,
    cherriesCollected: cherriesCollected,
    coinsCollected: coinsCollected,
    timestamp: Date.now(),
  };

  let pendingScores = JSON.parse(localStorage.getItem("pendingScores")) || [];
  pendingScores.push(scoreData);
  localStorage.setItem("pendingScores", JSON.stringify(pendingScores));
}

window.addEventListener("beforeunload", handleBeforeUnload);

// Function to get the current audio state from localStorage
function getAudioState() {
  const storedState = localStorage.getItem("audioEnabled");
  if (storedState === null) {
    return true; // Default to true if not set
  }
  return storedState === "true";
}

// Function to save the audio state to localStorage
function setAudioState(enabled) {
  localStorage.setItem("audioEnabled", enabled.toString());
}

// Function to update the audio toggle UI based on the audio state
function updateAudioToggleUI(enabled) {
  if (enabled) {
    audioToggle.classList.remove("audio-off");
  } else {
    audioToggle.classList.add("audio-off");
  }
}

// Initialize audio state from localStorage or default to true
let audioEnabled = getAudioState();
updateAudioToggleUI(audioEnabled); // Apply initial state

function getCSSVariable(variableName) {
  return getComputedStyle(document.documentElement).getPropertyValue(
    variableName
  );
}

let groundColor = getCSSVariable("--neon-blue").trim();
let groundColorAlt = getCSSVariable("--neon-pink").trim();
let groundColorToggle = true;

let gameRunning = false;
let score = 0;
let highScores = JSON.parse(localStorage.getItem("highScores")) || [];

// Player properties
let player = {
  x: 50,
  y: canvas.height - 150 - 80, // Adjusted for larger player
  width: 80,
  height: 80,
  runImage: new Image(),
  jumpImage: new Image(),
  slideImage: new Image(),
  currentImage: null,
  isJumping: false,
  isSliding: false,
  jumpVelocity: 0,
};

player.runImage.src = "assets/images/player-run.png";
player.jumpImage.src = "assets/images/player-jump.png";
player.slideImage.src = "assets/images/player-slide.png";
player.currentImage = player.runImage;

// Collectibles properties
let collectibles = [];
let cherriesCollected = 0;
let coinsCollected = 0;
let distance = 0;
let coinMagnetActive = false;
let coinMagnetTimer = 0;
let gameSpeedBoostActive = false;
let gameSpeedBoostTimer = 0;
let originalObstacleSpawnInterval = 2000;
let originalObstacleSpeed = 5;
let cherryImage = new Image();
let coinImage = new Image();
let energyDrinkImage = new Image();

cherryImage.src = "assets/images/cherry.svg";
coinImage.src = "assets/images/fox-coin.svg";
energyDrinkImage.src = "assets/images/speed-boost.svg";

// Obstacle properties
let obstacles = [];

// Game loop variables
let lastTime = 0;
let obstacleSpawnTimer = 0;
let obstacleSpawnInterval = 2000; // Initial interval

// Powerup properties
let powerupTimer = 0;
let powerupDuration = 5000; // 5 seconds

// Add a flag for debug mode
let debugMode = false;

// Event Listeners
startGameButton.addEventListener("click", () => {
  welcomeScreen.style.display = "none";
  gameRunning = true;
  startGame();
});

restartButton.addEventListener("click", () => {
  gameOverScreen.style.display = "none";
  gameRunning = true;
  startGame();
});

leaderboardButton.addEventListener("click", () => {
  gameOverScreen.style.display = "none";
  leaderboardScreen.style.display = "block";
  displayHighScores();
});

closeLeaderboard.addEventListener("click", () => {
  leaderboardScreen.style.display = "none";
});

// Audio toggle event listener
audioToggle.addEventListener("click", () => {
  audioEnabled = !audioEnabled;
  setAudioState(audioEnabled);
  updateAudioToggleUI(audioEnabled);

  // Add your audio control logic here (e.g., mute/unmute audio)
  if (audioEnabled) {
    // Unmute audio
    console.log("Audio Unmuted");
  } else {
    // Mute audio
    console.log("Audio Muted");
  }
});

// Event listener to toggle debug mode
document.addEventListener("keydown", (event) => {
  if (event.code === "KeyD") {
    debugMode = !debugMode;
  }
});

// Update the existing event listener for player controls
document.addEventListener("keydown", (event) => {
  if (
    (event.code === "Space" || event.code === "ArrowUp") &&
    !player.isJumping
  ) {
    player.isJumping = true;
    player.jumpVelocity = -20; // Increased jump velocity
    player.currentImage = player.jumpImage;
    if (audioEnabled) jumpSound.play(); // Play jump sound
  } else if (event.code === "ArrowDown" && !player.isSliding) {
    player.isSliding = true;
    player.height = 50; // Adjusted slide height
    player.y = canvas.height - 150 - player.height; // Adjusted position for slide
    player.currentImage = player.slideImage;
    if (audioEnabled) slideSound.play(); // Play slide sound
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown") {
    player.isSliding = false;
    player.height = 80; // Reset height
    player.y = canvas.height - 150 - player.height; // Reset position to ground
    player.currentImage = player.runImage;
  }
  if (audioEnabled) slideSound.pause();
  slideSound.currentTime = 0;
});

function createCollectible() {
  let type;
  const randomValue = Math.random();
  if (gameSpeedBoostActive) {
    // Increase cherry occurrence during energy drink powerup
    type = randomValue < cherryProbability ? "cherry" : "coin";
  } else {
    if (randomValue < cherryProbability) {
      type = "cherry";
    } else if (randomValue < cherryProbability + coinProbability) {
      type = "coin";
    } else if (
      randomValue <
      cherryProbability + coinProbability + energyDrinkProbability
    ) {
      type = "energyDrink";
    } else {
      type = "coinMagnet";
    }
  }
  const y =
    Math.random() < 0.5 ? canvas.height - 150 - 60 : canvas.height - 150 - 160; // Adjusted for new player position
  const collectible = {
    x: canvas.width,
    y: y,
    type: type,
    width: 60, // Increased width
    height: 60, // Increased height
    speed: gameSpeedBoostActive
      ? originalObstacleSpeed * 2
      : originalObstacleSpeed,
  };

  if (type === "energyDrink") {
    // Check if there are already 2 energy drinks on the screen.
    let energyDrinkCount = collectibles.filter(
      (c) => c.type === "energyDrink"
    ).length;
    if (energyDrinkCount >= 2) {
      type = Math.random() < 0.5 ? "cherry" : "coin"; // Replace energy drink with another collectible
      collectible.type = type;
    }
  }

  collectibles.push(collectible);
}

// Function to control the overall spawn rate of collectibles
function spawnCollectibles() {
  const spawnRate = gameSpeedBoostActive ? 0.04 : 0.01; // Adjust spawn rate based on powerup state
  if (Math.random() < spawnRate) {
    createCollectible();
  }
}

function startGame() {
  score = 0;
  distance = 0;
  cherriesCollected = 0;
  coinsCollected = 0;
  obstacles = [];
  collectibles = [];
  player.x = 50; // Set player's initial x position
  player.y = canvas.height - 150 - player.height; // Set player's initial y position closer to the ground
  player.height = 80;
  player.color = "var(--neon-blue)";
  player.isJumping = false;
  player.isSliding = false;
  lastTime = performance.now();
  obstacleSpawnTimer = 0;
  powerupTimer = 0;
  document.getElementById("distanceCounter").textContent = `0m`;
  document.getElementById("cherryCounter").textContent = `0`;
  document.getElementById("coinCounter").textContent = `0`;
  coinMagnetActive = false;
  gameSpeedBoostActive = false;
  gameSpeedBoostTimer = 0;
  coinMagnetTimer = 0;
  powerupBar.style.width = `100px`;
  powerupWidget.textContent = `Powerup:`;
  powerupWidget.appendChild(powerupBar);
  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  finalScoreDisplay.textContent = score;
  gameOverScreen.style.display = "block";
  updateHighScores();
  saveScore(score, cherriesCollected, coinsCollected); // Save the score, cherries, and coins
  if (audioEnabled) deathSound.play(); // Play death sound
}

function updateHighScores() {
  highScores.push(score);
  highScores.sort((a, b) => b - a);
  highScores = highScores.slice(0, 5); // Keep top 5 scores
  localStorage.setItem("highScores", JSON.stringify(highScores));
}

function displayHighScores() {
  highScoresList.innerHTML = "";
  highScores.forEach((score, index) => {
    const listItem = document.createElement("li");
    listItem.textContent = `${index + 1}. ${score}`;
    highScoresList.appendChild(listItem);
  });
}

function createObstacle() {
  const obstacle = {
    x: canvas.width,
    y:
      Math.random() < 0.5
        ? canvas.height - 150 - 60
        : canvas.height - 150 - 120, // Adjusted for new player position
    width: 20,
    height: 60, // Increased obstacle height
    color: "gray",
    speed: gameSpeedBoostActive
      ? originalObstacleSpeed * 2
      : originalObstacleSpeed,
  };

  if (!gameSpeedBoostActive) {
    obstacles.push(obstacle);
  }
  obstacleSpawnInterval = 1000 + Math.random() * 2000;
}

function updateGame(deltaTime) {
  distance += deltaTime / 1000;
  score = Math.floor(distance); // Update score based on distance

  // Update stats panel
  document.getElementById("distanceCounter").textContent = `${score}m`;
  document.getElementById("cherryCounter").textContent = cherriesCollected;
  document.getElementById("coinCounter").textContent = coinsCollected;

  // Update player
  if (player.isJumping) {
    player.y += player.jumpVelocity;
    player.jumpVelocity += 1; // Adjusted gravity effect
    if (player.y >= canvas.height - 150 - player.height) {
      player.y = canvas.height - 150 - player.height;
      player.isJumping = false;
      player.currentImage = player.runImage;
    }
  }

  // Update collectibles
  collectibles.forEach((collectible, index) => {
    collectible.x -= gameSpeedBoostActive
      ? collectible.speed * 2
      : collectible.speed; // Apply speed boost to collectibles
    if (collectible.x + collectible.width < 0) {
      collectibles.splice(index, 1);
    }

    // Collision detection with collectibles
    if (
      player.x < collectible.x + collectible.width &&
      player.x + player.width > collectible.x &&
      player.y < collectible.y + collectible.height &&
      player.y + player.height > collectible.y
    ) {
      if (collectible.type === "cherry") {
        cherriesCollected++;
        if (audioEnabled) playSound(collectSound); // Play collect sound
      } else if (collectible.type === "coin") {
        coinsCollected++;
        if (audioEnabled) playSound(collectSound); // Play collect sound
      } else if (collectible.type === "energyDrink") {
        gameSpeedBoostActive = true;
        gameSpeedBoostTimer = 10000; // 10 seconds
        originalObstacleSpawnInterval = obstacleSpawnInterval;
        originalObstacleSpeed = obstacles.length > 0 ? obstacles[0].speed : 5;
        obstacleSpawnInterval /= 2;
        obstacles.forEach((obstacle) => (obstacle.speed *= 2));
        obstacles = []; // Remove all current obstacles
        if (audioEnabled) playSound(powerupSound); // Play powerup sound
      } else if (collectible.type === "coinMagnet") {
        coinMagnetActive = true;
        coinMagnetTimer = 10000; // 10 seconds
        if (audioEnabled) playSound(powerupSound); // Play powerup sound
      }
      collectibles.splice(index, 1);
    }

    // Coin magnet effect
    if (
      coinMagnetActive &&
      (collectible.type === "coin" || collectible.type === "cherry")
    ) {
      const dx =
        player.x + player.width / 2 - collectible.x - collectible.width / 2;
      const dy =
        player.y + player.height / 2 - collectible.y + collectible.height / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 200) {
        collectible.x += (dx / distance) * 5;
        collectible.y += (dy / distance) * 5;
      }
    }
  });

  spawnCollectibles();

  // Update obstacles
  obstacles.forEach((obstacle, index) => {
    obstacle.x -= obstacle.speed;
    if (obstacle.x + obstacle.width < 0) {
      obstacles.splice(index, 1);
    }

    // Collision detection
    if (
      player.x < obstacle.x + obstacle.width &&
      player.x + player.width > obstacle.x &&
      player.y < obstacle.y + obstacle.height &&
      player.y + player.height > obstacle.y
    ) {
      endGame();
    }
  });

  // Spawn obstacles
  obstacleSpawnTimer += deltaTime;
  if (obstacleSpawnTimer > obstacleSpawnInterval) {
    // Use random interval
    createObstacle();
    obstacleSpawnTimer = 0;
  }

  // Update powerup
  if (powerupTimer > 0) {
    powerupTimer -= deltaTime;
    powerupBar.style.width = `${(powerupTimer / powerupDuration) * 100}px`;
    if (powerupTimer <= 0) {
      powerupTimer = 0;
      powerupBar.style.width = "100px";
    }
  } else {
    powerupBar.style.width = "100px";
  }

  // Update powerup timers
  if (gameSpeedBoostActive) {
    gameSpeedBoostTimer -= deltaTime;
    powerupBar.style.width = `${(gameSpeedBoostTimer / 10000) * 100}px`;
    powerupWidget.textContent = `Energy Drink:`;
    powerupWidget.appendChild(powerupBar);
    if (gameSpeedBoostTimer <= 0) {
      gameSpeedBoostActive = false;
      obstacleSpawnInterval = originalObstacleSpawnInterval;
      obstacles.forEach((obstacle) => (obstacle.speed = originalObstacleSpeed));
      powerupWidget.textContent = `Powerup:`;
      powerupBar.style.width = `100px`;
    }
  } else if (coinMagnetActive) {
    coinMagnetTimer -= deltaTime;
    powerupBar.style.width = `${(coinMagnetTimer / 10000) * 100}px`;
    powerupWidget.textContent = `Coin Magnet:`;
    powerupWidget.appendChild(powerupBar);
    if (coinMagnetTimer <= 0) {
      coinMagnetActive = false;
      powerupWidget.textContent = `Powerup:`;
      powerupBar.style.width = `100px`;
    }
  } else {
    powerupBar.style.width = `100px`;
    powerupWidget.textContent = `Powerup:`;
    powerupWidget.appendChild(powerupBar);
  }
}

// Function to play sound with reset
function playSound(sound) {
  sound.pause();
  sound.currentTime = 0;
  sound.play();
}

// Offscreen canvas for static elements
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");
offscreenCanvas.width = canvas.width;
offscreenCanvas.height = canvas.height;

// Pre-render static elements
function preRenderStaticElements() {
  offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  // Draw ground
  offscreenCtx.strokeStyle = groundColorToggle ? groundColor : groundColorAlt;
  offscreenCtx.lineWidth = 3;
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(0, canvas.height - 150); // Adjusted ground position
  offscreenCtx.lineTo(canvas.width, canvas.height - 150);
  offscreenCtx.stroke();
}

// Call this function once to pre-render static elements
preRenderStaticElements();

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw pre-rendered static elements
  ctx.drawImage(offscreenCanvas, 0, 0);

  // Draw player
  ctx.drawImage(
    player.currentImage,
    player.x,
    player.y,
    player.width,
    player.height
  );

  // Draw obstacles
  obstacles.forEach((obstacle) => {
    ctx.fillStyle = obstacle.color;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  });

  // Draw collectibles
  collectibles.forEach((collectible) => {
    let image;
    if (collectible.type === "cherry") {
      image = cherryImage;
    } else if (collectible.type === "coin") {
      image = coinImage;
    } else if (collectible.type === "energyDrink") {
      image = energyDrinkImage;
    } else if (collectible.type === "coinMagnet") {
      image = coinMagnetImage;
    }
    ctx.drawImage(
      image,
      collectible.x,
      collectible.y,
      collectible.width,
      collectible.height
    );
  });

  // Draw debug boundaries if debug mode is active
  if (debugMode) {
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1;

    // Draw player boundary
    ctx.strokeRect(player.x, player.y, player.width, player.height);

    // Draw obstacle boundaries
    obstacles.forEach((obstacle) => {
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });

    // Draw collectible boundaries
    collectibles.forEach((collectible) => {
      ctx.strokeRect(
        collectible.x,
        collectible.y,
        collectible.width,
        collectible.height
      );
    });
  }
}

function gameLoop(timestamp) {
  if (!gameRunning) return;

  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  updateGame(deltaTime);
  drawGame();

  requestAnimationFrame(gameLoop);
}

// Check if the device is mobile and show the mobile view screen
if (window.innerWidth < 768) {
  mobileViewScreen.style.display = "block";
} else {
  welcomeScreen.style.display = "block";
}

// Disable right click
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

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

// --- NEW: Backend API URLs (Adjust these) ---
const API_BASE_URL = "https://foxgame.pythonanywhere.com/api"; // Or your actual base URL
const CHECK_USER_ENDPOINT = `${API_BASE_URL}/check-user/`; // e.g., /api/check-user/<publicKey>
const SIGNUP_ENDPOINT = `${API_BASE_URL}/signup`; // e.g., /api/signup (POST request)
const SCORE_UPLOAD_ENDPOINT = `${API_BASE_URL}/scores`; // Existing score upload endpoint

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
const usernamePromptModal = document.getElementById("usernamePromptModal");
const usernameInput = document.getElementById("usernameInput");
const submitUsernameButton = document.getElementById("submitUsernameButton");
const usernameError = document.getElementById("usernameError");
const userProfileButtonGameOver = document.getElementById(
  "userProfileButtonGameOver"
);
const userProfileButtonLeaderboard = document.getElementById(
  "userProfileButtonLeaderboard"
);
const userProfileModal = document.getElementById("userProfileModal");
const closeProfileModal = document.getElementById("closeProfileModal");

let userExists = false; // --- NEW: Flag to track if user exists on backend ---
let currentUsername = null; // --- NEW: Store username if exists ---

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

      const checkResult = await checkUserExists(userPublicKey);
      userExists = checkResult.exists;
      currentUsername = checkResult.username; // Store username if returned

      if (userExists) {
        console.log("User already registered. Username:", currentUsername);
        updateWalletDisplay(userPublicKey, currentUsername); // Update UI directly
        userProfileButtonGameOver.style.display = "block";
        userProfileButtonLeaderboard.style.display = "block";
      } else {
        console.log("New user detected. Prompting for username.");
        usernameError.style.display = "none"; // Hide any previous error
        usernameInput.value = ""; // Clear input field
        usernamePromptModal.style.display = "block";
        welcomeScreen.style.display = "none"; // Hide welcome screen if it was visible
        userProfileButtonGameOver.style.display = "none";
        userProfileButtonLeaderboard.style.display = "none";
      }
    } catch (error) {
      console.error("Connection failed", error);
    }
  } else {
    alert(
      "Phantom Wallet not found. Please install it from https://phantom.app/"
    );
  }
}

// Function to fetch and display user profile data
async function displayUserProfile(publicKey) {
  const apiUrl = `${API_BASE_URL}/scores/${publicKey}`; // Construct the API URL

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    if (response.ok) {
      const userData = await response.json();

      userProfileModal.querySelector(".profile-username").textContent =
        userData.username;

      userProfileModal.querySelector(".profile-cherries").textContent =
        userData.cherriesCollected;
      userProfileModal.querySelector(".profile-coins").textContent =
        userData.coinsCollected;
      userProfileModal.querySelector(".profile-score").textContent =
        userData.score;

      userProfileModal.style.display = "block";
    } else {
      console.error(
        "Failed to fetch user profile:",
        response.status,
        await response.text()
      );
      alert("Failed to fetch user profile.");
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    alert("An error occurred while fetching user profile.");
  }
}

async function checkUserExists(publicKey) {
  if (!publicKey) return { exists: false, username: null };
  console.log(`Checking existence for publicKey: ${publicKey}`);
  try {
    const response = await fetch(`${CHECK_USER_ENDPOINT}${publicKey}`, {
      // Use GET request
      method: "GET",
      headers: {
        Accept: "application/json", // Expect JSON response
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Check user response:", data);
      // Assuming backend returns { exists: boolean, username: string | null }
      return { exists: data.exists === true, username: data.username || null };
    } else if (response.status === 404) {
      console.log("User not found (404).");
      return { exists: false, username: null }; // Explicitly handle 404 as user not found
    } else {
      console.error(
        `Failed to check user: ${response.status} ${response.statusText}`
      );
      // Optional: alert user about the check failure
      return { exists: false, username: null }; // Treat other errors as user not existing for safety
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
    // Optional: alert user about the network error
    return { exists: false, username: null }; // Treat network errors as user not existing
  }
}

async function registerUser(publicKey, username) {
  if (!publicKey || !username) {
    console.error("Public key and username are required for registration.");
    return false;
  }
  console.log(`Registering user: ${username} with publicKey: ${publicKey}`);
  usernameError.style.display = "none"; // Hide error initially

  try {
    const response = await fetch(SIGNUP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publicKey: publicKey, username: username }), // Send as JSON
    });

    if (response.ok) {
      const data = await response.json(); // Assuming backend confirms registration
      console.log("User registered successfully:", data);
      currentUsername = username; // Store the new username
      userExists = true; // Update state
      return true;
    } else {
      // --- NEW: Handle backend validation errors ---
      const errorData = await response
        .json()
        .catch(() => ({ message: "Registration failed. Please try again." })); // Attempt to parse error response
      console.error(`Failed to register user: ${response.status}`, errorData);
      usernameError.textContent =
        errorData.message ||
        `Registration failed (${response.status}). Try a different username?`;
      usernameError.style.display = "block";
      // --- END NEW ---
      return false;
    }
  } catch (error) {
    console.error("Error registering user:", error);
    usernameError.textContent =
      "Network error during registration. Please check your connection and try again.";
    usernameError.style.display = "block";
    return false;
  }
}

function updateWalletDisplay(publicKey, username = null) {
  walletStat.style.display = "flex";
  // Display username if available, otherwise truncated public key
  const displayText = username
    ? username
    : publicKey.slice(0, 5) + "..." + publicKey.slice(-5);
  walletAddressDisplay.textContent = displayText;
  walletAddressDisplay.title = `Wallet: ${publicKey}${username ? ` | User: ${username}` : ""
    }`; // Add username to title tooltip
}

submitUsernameButton.addEventListener("click", async () => {
  const enteredUsername = usernameInput.value.trim();

  if (!enteredUsername) {
    usernameError.textContent = "Username cannot be empty.";
    usernameError.style.display = "block";
    return;
  }
  if (enteredUsername.length < 3 || enteredUsername.length > 15) {
    usernameError.textContent = "Username must be between 3 and 15 characters.";
    usernameError.style.display = "block";
    return;
  }
  // Basic alphanumeric check (adjust regex as needed)
  if (!/^[a-zA-Z0-9_]+$/.test(enteredUsername)) {
    usernameError.textContent =
      "Username can only contain letters, numbers, and underscores.";
    usernameError.style.display = "block";
    return;
  }

  // Disable button while processing
  submitUsernameButton.disabled = true;
  submitUsernameButton.textContent = "Saving...";

  const success = await registerUser(userPublicKey, enteredUsername);

  // Re-enable button
  submitUsernameButton.disabled = false;
  submitUsernameButton.textContent = "Save Username";

  if (success) {
    usernamePromptModal.style.display = "none"; // Hide prompt on success
    updateWalletDisplay(userPublicKey, currentUsername); // Update display with new username
    // Optional: Automatically start the game or return to welcome screen
    welcomeScreen.style.display = "block";
  } else {
    // Error message is displayed by registerUser function
    usernameInput.focus(); // Keep focus on input if error
  }
});

let userPublicKey = null;
connectWalletButton.addEventListener("click", connectWallet);

// Event listeners for the new buttons
userProfileButtonGameOver.addEventListener("click", () => {
  if (userPublicKey) {
    displayUserProfile(userPublicKey);
  }
});

userProfileButtonLeaderboard.addEventListener("click", () => {
  if (userPublicKey) {
    displayUserProfile(userPublicKey);
  }
});

closeProfileModal.addEventListener("click", () => {
  userProfileModal.style.display = "none";
  gameOverScreen.style.display = "block";
});

// Function to upload scores to backend API
async function uploadScores(scores) {
  const apiUrl = SCORE_UPLOAD_ENDPOINT; // Use constant

  if (!userPublicKey) {
    console.warn("Wallet not connected, cannot upload scores.");
    // alert("Please connect your wallet before uploading scores."); // Less intrusive just to log it
    return;
  }
  if (scores.length === 0) {
    console.log("No pending scores to upload.");
    return;
  }

  console.log(`Attempting to upload ${scores.length} scores...`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Ensure scores have publicKey attached correctly
      body: JSON.stringify(
        scores.map((score) => ({ ...score, publicKey: userPublicKey }))
      ),
    });

    if (response.ok) {
      console.log("Scores uploaded successfully!");
      localStorage.removeItem("pendingScores");
    } else {
      console.error(
        "Failed to upload scores:",
        response.status,
        await response.text()
      );
      // Don't alert here, as it might happen on page unload. Keep scores for next time.
      // alert("Failed to upload scores. They will be saved for the next session.");
    }
  } catch (error) {
    console.error("Error uploading scores:", error);
    // Don't alert here either.
    // alert("An network error occurred while uploading scores. They will be saved for the next session.");
  }
}

// Function to handle beforeunload event
function handleBeforeUnload(event) { }

// Example score saving (you'll need to adapt this to your game logic)
function saveScore(score, cherriesCollected, coinsCollected) {
  if (!userPublicKey) {
    console.warn("Cannot save score, user public key is not available.");
    return; // Don't save if wallet isn't connected/key missing
  }

  const scoreData = {
    publicKey: userPublicKey, // Use the currently connected public key
    score: score,
    cherriesCollected: cherriesCollected,
    coinsCollected: coinsCollected,
    timestamp: Date.now(),
  };

  let pendingScores = JSON.parse(localStorage.getItem("pendingScores")) || [];
  pendingScores.push(scoreData);
  localStorage.setItem("pendingScores", JSON.stringify(pendingScores));
  console.log("Score saved locally:", scoreData);

  if (pendingScores.length > 0) {
    // Upload scores asynchronously
    uploadScores(pendingScores);
  }
}

//window.addEventListener("beforeunload", handleBeforeUnload);

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
  if (!userPublicKey) {
    // If userPublicKey is null, it means the wallet is not connected
    const confirmStart = confirm(
      "Your score will not be stored if you play without connecting your wallet. Do you want to continue?"
    );
    if (!confirmStart) {
      return; // Stop the game from starting
    }
  }
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
  gameOverScreen.style.display = "block";
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
    listItem.textContent = `${score}`;
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

// // Disable right click
// document.addEventListener("contextmenu", (e) => {
//   e.preventDefault();
// });

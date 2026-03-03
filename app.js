(() => {
  const SW_VERSION = "2026-03-03-1";

  const COLOR_SCHEMES = {
    rainbow: {
      label: "Rainbow",
      colors: ["#ef4444", "#f59e0b", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6", "#ff2d95", "#ffffff"],
    },
    ice: {
      label: "Ice",
      colors: ["#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#082f49"],
    },
    fire: {
      label: "Fire",
      colors: ["#fff59d", "#ffe082", "#ffca28", "#ffb300", "#fb8c00", "#ef6c00", "#e64a19", "#c62828"],
    },
    forest: {
      label: "Forest",
      colors: ["#d9f99d", "#a3c853", "#4cbb17", "#2f8f2f", "#2e7d32", "#50c878", "#228b22", "#145a32"],
    },
    monochrome: {
      label: "Monochrome",
      colors: ["#f8fafc", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b"],
    },
    neon: {
      label: "Neon",
      colors: ["#39ff14", "#00e5ff", "#ff00f5", "#ffe600", "#ff5f1f", "#8a2be2", "#00ffa3", "#ffffff"],
    },
    pastel: {
      label: "Pastel",
      colors: ["#ffd6e0", "#ffe5b4", "#fff6a3", "#d9f7be", "#b5ead7", "#c7ceea", "#e2c2ff", "#f3f4f6"],
    },
  };

  const DIFFICULTIES = [
    { label: "Easy 10x10 (5 colors)", shortLabel: "Easy", size: 10, colorCount: 5 },
    { label: "Classic 12x12 (6 colors)", shortLabel: "Classic", size: 12, colorCount: 6 },
    { label: "Hard 14x14 (7 colors)", shortLabel: "Hard", size: 14, colorCount: 7 },
    { label: "Extreme 16x16 (8 colors)", shortLabel: "Extreme", size: 16, colorCount: 8 },
  ];

  const gameState = {
    size: 12,
    colorCount: 6,
    schemeKey: "rainbow",
    grid: [],
    moves: 0,
    floodedColor: 0,
    bestScore: null,
    hasWon: false,
  };

  const el = {
    board: document.getElementById("board"),
    colorBar: document.getElementById("colorBar"),
    movesValue: document.getElementById("movesValue"),
    bestValue: document.getElementById("bestValue"),
    modeValue: document.getElementById("modeValue"),
    newGameBtn: document.getElementById("newGameBtn"),
    newGameModal: document.getElementById("newGameModal"),
    setupDifficulty: document.getElementById("setupDifficulty"),
    setupScheme: document.getElementById("setupScheme"),
    startGameBtn: document.getElementById("startGameBtn"),
    schemePreview: document.getElementById("schemePreview"),
    updateBanner: document.getElementById("updateBanner"),
    updateNowBtn: document.getElementById("updateNowBtn"),
    winModal: document.getElementById("winModal"),
    winMessage: document.getElementById("winMessage"),
    restartBtn: document.getElementById("restartBtn"),
  };

  let waitingServiceWorker = null;
  let isRefreshingForUpdate = false;

  function randomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function createRandomGrid(size, colorCount) {
    return Array.from({ length: size }, () =>
      Array.from({ length: size }, () => randomInt(colorCount))
    );
  }

  function getSchemeColors(schemeKey) {
    const scheme = COLOR_SCHEMES[schemeKey] || COLOR_SCHEMES.rainbow;
    return scheme.colors;
  }

  function pickEvenlySpacedColors(colors, count) {
    if (count >= colors.length) {
      return colors.slice();
    }
    if (count <= 1) {
      return [colors[0]];
    }

    const selected = [];
    const maxIndex = colors.length - 1;
    for (let i = 0; i < count; i += 1) {
      const index = Math.round((i * maxIndex) / (count - 1));
      selected.push(colors[index]);
    }
    return selected;
  }

  function getActivePalette() {
    return pickEvenlySpacedColors(getSchemeColors(gameState.schemeKey), gameState.colorCount);
  }

  function getBestScoreKey(size, colorCount, schemeKey) {
    return `flood-fill-best-${size}x${size}-k${colorCount}-scheme-${schemeKey}`;
  }

  function loadBestScore(size, colorCount, schemeKey) {
    const raw = localStorage.getItem(getBestScoreKey(size, colorCount, schemeKey));
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function saveBestScoreIfBetter() {
    if (!gameState.hasWon) {
      return;
    }
    if (gameState.bestScore === null || gameState.moves < gameState.bestScore) {
      gameState.bestScore = gameState.moves;
      localStorage.setItem(
        getBestScoreKey(gameState.size, gameState.colorCount, gameState.schemeKey),
        String(gameState.moves)
      );
    }
  }

  function isWin() {
    const target = gameState.grid[0][0];
    for (let r = 0; r < gameState.size; r += 1) {
      for (let c = 0; c < gameState.size; c += 1) {
        if (gameState.grid[r][c] !== target) {
          return false;
        }
      }
    }
    return true;
  }

  // Iterative BFS flood fill from (0,0) replacing current flooded color with nextColor.
  function floodFillFromTopLeft(nextColor) {
    const originalColor = gameState.grid[0][0];
    if (originalColor === nextColor) {
      return false;
    }

    const size = gameState.size;
    const queue = [[0, 0]];
    let head = 0;

    gameState.grid[0][0] = nextColor;

    while (head < queue.length) {
      const [r, c] = queue[head];
      head += 1;

      if (r > 0) {
        const nr = r - 1;
        if (gameState.grid[nr][c] === originalColor) {
          gameState.grid[nr][c] = nextColor;
          queue.push([nr, c]);
        }
      }
      if (r < size - 1) {
        const nr = r + 1;
        if (gameState.grid[nr][c] === originalColor) {
          gameState.grid[nr][c] = nextColor;
          queue.push([nr, c]);
        }
      }
      if (c > 0) {
        const nc = c - 1;
        if (gameState.grid[r][nc] === originalColor) {
          gameState.grid[r][nc] = nextColor;
          queue.push([r, nc]);
        }
      }
      if (c < size - 1) {
        const nc = c + 1;
        if (gameState.grid[r][nc] === originalColor) {
          gameState.grid[r][nc] = nextColor;
          queue.push([r, nc]);
        }
      }
    }

    gameState.floodedColor = nextColor;
    return true;
  }

  function isLightHex(hex) {
    const value = hex.replace("#", "");
    const normalized = value.length === 3
      ? value.split("").map((ch) => ch + ch).join("")
      : value;

    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 190;
  }

  function renderBoard() {
    const palette = getActivePalette();
    el.board.style.gridTemplateColumns = `repeat(${gameState.size}, 1fr)`;
    el.board.innerHTML = "";

    const frag = document.createDocumentFragment();
    for (let r = 0; r < gameState.size; r += 1) {
      for (let c = 0; c < gameState.size; c += 1) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.style.backgroundColor = palette[gameState.grid[r][c]];
        frag.appendChild(tile);
      }
    }
    el.board.appendChild(frag);
  }

  function getCurrentDifficulty() {
    return DIFFICULTIES.find((d) => d.size === gameState.size && d.colorCount === gameState.colorCount) || DIFFICULTIES[1];
  }

  function renderHUD() {
    const difficulty = getCurrentDifficulty();
    const scheme = COLOR_SCHEMES[gameState.schemeKey] || COLOR_SCHEMES.rainbow;

    el.movesValue.textContent = String(gameState.moves);
    el.bestValue.textContent = gameState.bestScore === null ? "-" : String(gameState.bestScore);
    el.modeValue.textContent = `${difficulty.shortLabel} • ${scheme.label}`;
  }

  function renderColorButtons() {
    const palette = getActivePalette();
    el.colorBar.innerHTML = "";

    for (let i = 0; i < gameState.colorCount; i += 1) {
      const button = document.createElement("button");
      const color = palette[i];
      const lightColor = isLightHex(color);

      button.type = "button";
      button.className = "color-btn";
      button.style.backgroundColor = color;
      button.style.borderColor = lightColor ? "#0f172a" : "rgba(255, 255, 255, 0.8)";
      button.setAttribute("aria-label", `Choose color ${i + 1}`);
      button.dataset.colorIndex = String(i);

      if (i === gameState.floodedColor) {
        button.style.outline = `3px solid ${lightColor ? "#0f172a" : "#f8fafc"}`;
      }
      el.colorBar.appendChild(button);
    }
  }

  function renderSchemePreview() {
    const selectedDifficulty = DIFFICULTIES[Number(el.setupDifficulty.value)] || DIFFICULTIES[1];
    const schemeKey = el.setupScheme.value in COLOR_SCHEMES ? el.setupScheme.value : "rainbow";
    const colors = pickEvenlySpacedColors(getSchemeColors(schemeKey), selectedDifficulty.colorCount);

    el.schemePreview.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < colors.length; i += 1) {
      const chip = document.createElement("div");
      chip.className = "scheme-preview__chip";
      chip.style.backgroundColor = colors[i];
      if (isLightHex(colors[i])) {
        chip.style.borderColor = "#0f172a";
      }
      frag.appendChild(chip);
    }
    el.schemePreview.appendChild(frag);
  }

  function openWinModal() {
    el.winMessage.textContent = `Completed in ${gameState.moves} moves.`;
    el.winModal.classList.remove("hidden");
  }

  function closeWinModal() {
    el.winModal.classList.add("hidden");
  }

  function openNewGameModal() {
    el.newGameModal.classList.remove("hidden");
    renderSchemePreview();
  }

  function closeNewGameModal() {
    el.newGameModal.classList.add("hidden");
  }

  function renderAll() {
    renderBoard();
    renderHUD();
    renderColorButtons();
  }

  function newGame(size = gameState.size, colorCount = gameState.colorCount, schemeKey = gameState.schemeKey) {
    gameState.size = size;
    gameState.colorCount = colorCount;
    gameState.schemeKey = schemeKey;
    gameState.grid = createRandomGrid(size, colorCount);
    gameState.moves = 0;
    gameState.hasWon = false;
    gameState.floodedColor = gameState.grid[0][0];
    gameState.bestScore = loadBestScore(size, colorCount, schemeKey);

    closeWinModal();
    renderAll();
  }

  function handleColorPick(colorIndex) {
    if (gameState.hasWon) {
      return;
    }

    const changed = floodFillFromTopLeft(colorIndex);
    if (!changed) {
      return;
    }

    gameState.moves += 1;
    gameState.hasWon = isWin();
    if (gameState.hasWon) {
      saveBestScoreIfBetter();
      openWinModal();
    }

    renderAll();
  }

  function setupDifficultyOptions() {
    el.setupDifficulty.innerHTML = "";
    DIFFICULTIES.forEach((d, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = d.label;
      if (d.size === gameState.size && d.colorCount === gameState.colorCount) {
        opt.selected = true;
      }
      el.setupDifficulty.appendChild(opt);
    });
  }

  function setupSchemeOptions() {
    el.setupScheme.innerHTML = "";
    Object.entries(COLOR_SCHEMES).forEach(([key, scheme]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = scheme.label;
      if (key === gameState.schemeKey) {
        opt.selected = true;
      }
      el.setupScheme.appendChild(opt);
    });
  }

  function startGameFromSetup() {
    const selectedDifficulty = DIFFICULTIES[Number(el.setupDifficulty.value)] || DIFFICULTIES[1];
    const selectedScheme = el.setupScheme.value in COLOR_SCHEMES ? el.setupScheme.value : "rainbow";

    newGame(selectedDifficulty.size, selectedDifficulty.colorCount, selectedScheme);
    closeNewGameModal();
  }

  function bindEvents() {
    el.colorBar.addEventListener("click", (event) => {
      const button = event.target.closest(".color-btn");
      if (!button) {
        return;
      }
      const selected = Number(button.dataset.colorIndex);
      handleColorPick(selected);
    });

    el.newGameBtn.addEventListener("click", () => {
      openNewGameModal();
    });

    el.startGameBtn.addEventListener("click", () => {
      startGameFromSetup();
    });

    el.restartBtn.addEventListener("click", () => {
      newGame(gameState.size, gameState.colorCount, gameState.schemeKey);
    });

    el.winModal.addEventListener("click", (event) => {
      if (event.target === el.winModal) {
        closeWinModal();
      }
    });

    el.newGameModal.addEventListener("click", (event) => {
      if (event.target === el.newGameModal) {
        closeNewGameModal();
      }
    });

    el.setupDifficulty.addEventListener("change", () => {
      renderSchemePreview();
    });

    el.setupScheme.addEventListener("change", () => {
      renderSchemePreview();
    });

    el.updateNowBtn.addEventListener("click", () => {
      if (!waitingServiceWorker) {
        return;
      }
      waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    });

    document.addEventListener(
      "touchmove",
      (event) => {
        if (event.target.closest("select") || event.target.closest(".modal__content")) {
          return;
        }
        event.preventDefault();
      },
      { passive: false }
    );
  }

  // Small helper for manual verification in console: window.testFloodFill().
  function testFloodFill() {
    const testState = {
      size: 4,
      grid: [
        [0, 0, 1, 2],
        [0, 1, 1, 2],
        [2, 2, 1, 2],
        [3, 3, 3, 2],
      ],
    };

    const queue = [[0, 0]];
    let head = 0;
    const original = testState.grid[0][0];
    const replacement = 4;
    testState.grid[0][0] = replacement;

    while (head < queue.length) {
      const [r, c] = queue[head++];
      const neighbors = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (let i = 0; i < neighbors.length; i += 1) {
        const [nr, nc] = neighbors[i];
        if (nr >= 0 && nr < testState.size && nc >= 0 && nc < testState.size) {
          if (testState.grid[nr][nc] === original) {
            testState.grid[nr][nc] = replacement;
            queue.push([nr, nc]);
          }
        }
      }
    }

    const expected = [
      [4, 4, 1, 2],
      [4, 1, 1, 2],
      [2, 2, 1, 2],
      [3, 3, 3, 2],
    ];

    const pass = JSON.stringify(testState.grid) === JSON.stringify(expected);
    return {
      pass,
      resultGrid: testState.grid,
      expected,
      message: pass ? "Flood-fill test passed." : "Flood-fill test failed.",
    };
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    function showUpdateBanner(worker) {
      waitingServiceWorker = worker;
      el.updateBanner.classList.remove("hidden");
    }

    function handleRegistration(registration) {
      if (registration.waiting) {
        showUpdateBanner(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(installingWorker);
          }
        });
      });
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (isRefreshingForUpdate) {
        return;
      }
      isRefreshingForUpdate = true;
      window.location.reload();
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(`./service-worker.js?v=${SW_VERSION}`)
        .then((registration) => {
          handleRegistration(registration);
          setInterval(() => {
            registration.update();
          }, 60 * 1000);
        })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    });
  }

  function init() {
    setupDifficultyOptions();
    setupSchemeOptions();
    newGame(12, 6, "rainbow");
    renderSchemePreview();
    bindEvents();
    openNewGameModal();
    registerServiceWorker();
    window.testFloodFill = testFloodFill;
  }

  init();
})();

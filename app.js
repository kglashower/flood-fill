(() => {
  const PALETTE = ["#e74c3c", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6", "#e67e22", "#ff2d95", "#ffffff"];
  const DIFFICULTIES = [
    { label: "Easy 10x10 (5 colors)", size: 10, colorCount: 5 },
    { label: "Classic 12x12 (6 colors)", size: 12, colorCount: 6 },
    { label: "Hard 14x14 (7 colors)", size: 14, colorCount: 7 },
    { label: "Extreme 16x16 (8 colors)", size: 16, colorCount: 8 },
  ];

  const gameState = {
    size: 12,
    colorCount: 6,
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
    newGameBtn: document.getElementById("newGameBtn"),
    difficultySelect: document.getElementById("difficultySelect"),
    winModal: document.getElementById("winModal"),
    winMessage: document.getElementById("winMessage"),
    restartBtn: document.getElementById("restartBtn"),
  };

  function randomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function createRandomGrid(size, colorCount) {
    return Array.from({ length: size }, () =>
      Array.from({ length: size }, () => randomInt(colorCount))
    );
  }

  function getBestScoreKey(size, colorCount) {
    return `flood-fill-best-${size}x${size}-k${colorCount}`;
  }

  function loadBestScore(size, colorCount) {
    const raw = localStorage.getItem(getBestScoreKey(size, colorCount));
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
      localStorage.setItem(getBestScoreKey(gameState.size, gameState.colorCount), String(gameState.moves));
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
        const nc = c;
        if (gameState.grid[nr][nc] === originalColor) {
          gameState.grid[nr][nc] = nextColor;
          queue.push([nr, nc]);
        }
      }
      if (r < size - 1) {
        const nr = r + 1;
        const nc = c;
        if (gameState.grid[nr][nc] === originalColor) {
          gameState.grid[nr][nc] = nextColor;
          queue.push([nr, nc]);
        }
      }
      if (c > 0) {
        const nr = r;
        const nc = c - 1;
        if (gameState.grid[nr][nc] === originalColor) {
          gameState.grid[nr][nc] = nextColor;
          queue.push([nr, nc]);
        }
      }
      if (c < size - 1) {
        const nr = r;
        const nc = c + 1;
        if (gameState.grid[nr][nc] === originalColor) {
          gameState.grid[nr][nc] = nextColor;
          queue.push([nr, nc]);
        }
      }
    }

    gameState.floodedColor = nextColor;
    return true;
  }

  function renderBoard() {
    el.board.style.gridTemplateColumns = `repeat(${gameState.size}, 1fr)`;
    el.board.innerHTML = "";

    const frag = document.createDocumentFragment();
    for (let r = 0; r < gameState.size; r += 1) {
      for (let c = 0; c < gameState.size; c += 1) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.style.backgroundColor = PALETTE[gameState.grid[r][c]];
        frag.appendChild(tile);
      }
    }
    el.board.appendChild(frag);
  }

  function renderHUD() {
    el.movesValue.textContent = String(gameState.moves);
    el.bestValue.textContent = gameState.bestScore === null ? "-" : String(gameState.bestScore);
  }

  function renderColorButtons() {
    el.colorBar.innerHTML = "";
    for (let i = 0; i < gameState.colorCount; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-btn";
      button.style.backgroundColor = PALETTE[i];
      if (PALETTE[i].toLowerCase() === "#ffffff") {
        button.style.borderColor = "#0f172a";
      }
      button.setAttribute("aria-label", `Choose color ${i + 1}`);
      button.dataset.colorIndex = String(i);
      if (i === gameState.floodedColor) {
        button.style.outline = "3px solid #f8fafc";
      }
      el.colorBar.appendChild(button);
    }
  }

  function openWinModal() {
    el.winMessage.textContent = `Completed in ${gameState.moves} moves.`;
    el.winModal.classList.remove("hidden");
  }

  function closeWinModal() {
    el.winModal.classList.add("hidden");
  }

  function renderAll() {
    renderBoard();
    renderHUD();
    renderColorButtons();
  }

  function newGame(size = gameState.size, colorCount = gameState.colorCount) {
    gameState.size = size;
    gameState.colorCount = colorCount;
    gameState.grid = createRandomGrid(size, colorCount);
    gameState.moves = 0;
    gameState.hasWon = false;
    gameState.floodedColor = gameState.grid[0][0];
    gameState.bestScore = loadBestScore(size, colorCount);
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

  function setupDifficultySelect() {
    el.difficultySelect.innerHTML = "";
    DIFFICULTIES.forEach((d, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = d.label;
      if (d.size === gameState.size && d.colorCount === gameState.colorCount) {
        opt.selected = true;
      }
      el.difficultySelect.appendChild(opt);
    });
  }

  function selectDifficultyByState() {
    const index = DIFFICULTIES.findIndex(
      (d) => d.size === gameState.size && d.colorCount === gameState.colorCount
    );
    el.difficultySelect.value = String(index >= 0 ? index : 1);
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
      const selected = DIFFICULTIES[Number(el.difficultySelect.value)] || DIFFICULTIES[1];
      newGame(selected.size, selected.colorCount);
      selectDifficultyByState();
    });

    el.restartBtn.addEventListener("click", () => {
      newGame(gameState.size, gameState.colorCount);
      selectDifficultyByState();
    });

    el.winModal.addEventListener("click", (event) => {
      if (event.target === el.winModal) {
        closeWinModal();
      }
    });

    el.difficultySelect.addEventListener("change", () => {
      const selected = DIFFICULTIES[Number(el.difficultySelect.value)];
      if (!selected) {
        return;
      }
      newGame(selected.size, selected.colorCount);
    });

    document.addEventListener(
      "touchmove",
      (event) => {
        if (!event.target.closest("#difficultySelect")) {
          event.preventDefault();
        }
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
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    });
  }

  function init() {
    setupDifficultySelect();
    newGame(12, 6);
    selectDifficultyByState();
    bindEvents();
    registerServiceWorker();
    window.testFloodFill = testFloodFill;
  }

  init();
})();

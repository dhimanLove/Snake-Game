document.addEventListener("DOMContentLoaded", () => {

  /* ═══════════════════════════════════════════
     DOM REFERENCES
  ═══════════════════════════════════════════ */
  const board       = document.querySelector(".board");
  const highScoreEl = document.querySelector("#score");
  const scoreEl     = document.querySelector("#current-score");
  const timeEl      = document.querySelector("#time");

  /* overlays */
  const menuOverlay    = document.getElementById("menu-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");

  /* menu controls */
  const btnPlay    = document.getElementById("btn-play");
  const btnRules   = document.getElementById("btn-rules");
  const rulebook   = document.getElementById("rulebook");
  const diffGroup  = document.getElementById("diff-group");
  const hurdleGroup = document.getElementById("hurdle-group");

  /* game over controls */
  const goReason   = document.getElementById("go-reason");
  const modalScore = document.getElementById("modal-score");
  const modalBest  = document.getElementById("modal-best");
  const newBestBadge = document.getElementById("modal-new-best");
  const btnReplay  = document.getElementById("modal-replay");
  const btnMenu    = document.getElementById("modal-menu");


  /* ═══════════════════════════════════════════
     MENU STATE
     Reads which toggle buttons are active when
     Play is pressed — these become game params.
  ═══════════════════════════════════════════ */
  let selectedDiff   = "easy";   /* "easy" | "hard" */
  let selectedHurdles = 3;        /* 3 | 6 | 10      */

  /* toggle group logic — works for any .ov-toggles group */
  function bindToggleGroup(groupEl, onChange) {
    groupEl.querySelectorAll(".ov-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        groupEl.querySelectorAll(".ov-toggle").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        onChange(btn.dataset.val);
      });
    });
  }

  bindToggleGroup(diffGroup,   val => { selectedDiff    = val; });
  bindToggleGroup(hurdleGroup, val => { selectedHurdles = parseInt(val); });

  /* rulebook open/close */
  btnRules.addEventListener("click", () => {
    const isOpen = rulebook.classList.toggle("open");
    btnRules.textContent = isOpen ? "Hide rules" : "How to play";
  });

  /* Play button — hide menu, start game with chosen settings */
  btnPlay.addEventListener("click", () => {
    menuOverlay.style.display = "none";
    init(selectedDiff, selectedHurdles);
  });

  /* Replay — same settings, restart immediately */
  btnReplay.addEventListener("click", () => {
    gameoverOverlay.style.display = "none";
    init(selectedDiff, selectedHurdles);
  });

  /* Main menu — go back to the menu overlay */
  btnMenu.addEventListener("click", () => {
    gameoverOverlay.style.display = "none";
    menuOverlay.style.display     = "flex";
  });


  /* ═══════════════════════════════════════════
     SIZING HELPERS
  ═══════════════════════════════════════════ */
  function blockSize() {
    if (window.innerWidth < 480) return 28;
    if (window.innerWidth < 768) return 36;
    return 50;
  }

  /* Speed is driven by difficulty + level progression.
     Easy base: 110ms.  Hard base: 70ms.
     Each level shaves 5ms off (capped at 40ms min). */
  function baseSpeed(diff) {
    return diff === "hard" ? 70 : 110;
  }


  /* ═══════════════════════════════════════════
     GAME STATE
  ═══════════════════════════════════════════ */
  let SIZE, speed, level, obstacleTick;
  let rows, cols, cells;
  let snake, direction, score, seconds;
  let food, specialFood, obstacles;
  let boss, shield, ghost, magnet;
  let isPaused;
  let loop, timer;

  let highScore = parseInt(localStorage.getItem("highScore")) || 0;
  highScoreEl.textContent = highScore;


  /* ═══════════════════════════════════════════
     UTILITY
  ═══════════════════════════════════════════ */
  function rand(n) { return Math.floor(Math.random() * n); }


  /* ═══════════════════════════════════════════
     INIT — called from menu and replay
     diff: "easy" | "hard"
     hurdleCount: 3 | 6 | 10
  ═══════════════════════════════════════════ */
  function init(diff = "easy", hurdleCount = 3) {
    board.innerHTML = "";
    cells = {};

    SIZE  = blockSize();
    speed = baseSpeed(diff);
    level = 1;
    obstacleTick = 0;

    rows = Math.floor(board.clientHeight / SIZE);
    cols = Math.floor(board.clientWidth  / SIZE);

    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.className = "block";
        board.appendChild(cell);
        cells[`${r}-${c}`] = cell;
      }
    }

    snake     = [{ r:5, c:5 }, { r:5, c:6 }, { r:5, c:7 }];
    direction = "RIGHT";
    score     = 0;
    seconds   = 0;
    isPaused  = false;

    shield = false;
    ghost  = false;
    magnet = false;
    boss   = null;

    food         = createFood();
    specialFood  = null;
    /* scale obstacle count by chosen hurdle setting */
    obstacles    = [];
    for (let i = 0; i < hurdleCount; i++) {
      obstacles.push({ r: rand(rows), c: rand(cols) });
    }

    scoreEl.textContent = score;
    timeEl.textContent  = "00:00";

    render();

    clearInterval(loop);
    clearInterval(timer);
    loop  = setInterval(() => moveSnake(diff, hurdleCount), speed);
    timer = setInterval(updateTimer, 1000);
  }


  /* ═══════════════════════════════════════════
     TIMER
  ═══════════════════════════════════════════ */
  function updateTimer() {
    if (isPaused) return;
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    timeEl.textContent = `${m}:${s}`;
  }


  /* ═══════════════════════════════════════════
     FOOD
  ═══════════════════════════════════════════ */
  const foodColors = {
    normal:  "red",
    speed:   "cyan",
    slow:    "orange",
    double:  "magenta",
    poison:  "purple",
    golden:  "gold",
    shield:  "lime",
    ghost:   "white",
    magnet:  "#378ADD",
  };

  function createFood(type = "normal") {
    return { r: rand(rows), c: rand(cols), type, color: foodColors[type] };
  }


  /* ═══════════════════════════════════════════
     OBSTACLES
  ═══════════════════════════════════════════ */
  function addObstacles(count) {
    /* called on level-up — adds count more hurdles up to a cap */
    for (let i = 0; i < count; i++) {
      obstacles.push({ r: rand(rows), c: rand(cols) });
    }
  }

  function moveObstacles() {
    obstacles.forEach(o => {
      if (Math.random() < 0.4) {
        o.r = rand(rows);
        o.c = rand(cols);
      }
    });
  }


  /* ═══════════════════════════════════════════
     BOSS
  ═══════════════════════════════════════════ */
  function spawnBoss() { boss = { r: rand(rows), c: rand(cols) }; }

  function moveBoss() {
    if (!boss) return;
    const head = snake[snake.length - 1];
    boss.r += Math.sign(head.r - boss.r);
    boss.c += Math.sign(head.c - boss.c);
  }


  /* ═══════════════════════════════════════════
     RENDER — completely unchanged from original
  ═══════════════════════════════════════════ */
  function clearBoard() {
    Object.values(cells).forEach(c => {
      c.className = "block";
      c.style.backgroundColor = "";
    });
  }

  function paintFood(f) {
    const cell = cells[`${f.r}-${f.c}`];
    if (cell) cell.style.backgroundColor = f.color;
  }

  function render() {
    clearBoard();

    snake.forEach((s, i) => {
      const cell = cells[`${s.r}-${s.c}`];
      if (!cell) return;
      cell.classList.add("fill");
      /* head is slightly brighter — same as original */
      if (i === snake.length - 1) cell.style.backgroundColor = "#eee";
    });

    paintFood(food);
    if (specialFood) paintFood(specialFood);

    obstacles.forEach(o => {
      const cell = cells[`${o.r}-${o.c}`];
      if (cell) cell.style.backgroundColor = "#444";
    });

    if (boss) {
      const cell = cells[`${boss.r}-${boss.c}`];
      if (cell) cell.style.backgroundColor = "crimson";
    }
  }


  /* ═══════════════════════════════════════════
     MOVE — same logic as original, now accepts
     diff + hurdleCount so level-ups know the
     correct base hurdle count to add onto.
  ═══════════════════════════════════════════ */
  function moveSnake(diff, hurdleCount) {
    if (isPaused) return;

    obstacleTick++;
    if (obstacleTick % 8 === 0) moveObstacles();
    if (boss && obstacleTick % 5 === 0) moveBoss();

    const head    = snake[snake.length - 1];
    const newHead = { ...head };

    if (direction === "UP")    newHead.r--;
    if (direction === "DOWN")  newHead.r++;
    if (direction === "LEFT")  newHead.c--;
    if (direction === "RIGHT") newHead.c++;

    /* ── collision checks — each one now carries a reason string ── */

    if (newHead.r < 0 || newHead.c < 0 || newHead.r >= rows || newHead.c >= cols) {
      if (shield) { shield = false; return; }   /* shield absorbs one wall hit */
      return gameOver("You ran into a wall.");
    }

    if (!ghost && snake.some(s => s.r === newHead.r && s.c === newHead.c)) {
      return gameOver("You bit your own tail.");
    }

    if (!ghost && obstacles.some(o => o.r === newHead.r && o.c === newHead.c)) {
      return gameOver("You crashed into a moving obstacle.");
    }

    if (boss && boss.r === newHead.r && boss.c === newHead.c) {
      return gameOver("You were caught by the boss.");
    }

    snake.push(newHead);

    let ate = false;

    if (newHead.r === food.r && newHead.c === food.c) {
      applyEffect(food.type, diff, hurdleCount);
      food = createFood();
      ate  = true;
    }

    if (specialFood && newHead.r === specialFood.r && newHead.c === specialFood.c) {
      applyEffect(specialFood.type, diff, hurdleCount);
      specialFood = null;
      ate = true;
    }

    if (!ate) snake.shift();

    render();
  }


  /* ═══════════════════════════════════════════
     EFFECTS — same as original
  ═══════════════════════════════════════════ */
  function applyEffect(type, diff, hurdleCount) {
    let points = 1;

    if (type === "double")  points = 2;
    if (type === "golden")  points = 5;
    if (type === "poison") {
      snake.splice(0, 2);
      points = -1;
    }

    if (type === "shield") shield = true;
    if (type === "ghost")  ghost  = true;
    if (type === "magnet") magnet = true;

    /* speed tokens adjust the current loop interval */
    if (type === "speed") {
      clearInterval(loop);
      loop = setInterval(() => moveSnake(diff, hurdleCount), Math.max(40, speed - 20));
    }
    if (type === "slow") {
      clearInterval(loop);
      loop = setInterval(() => moveSnake(diff, hurdleCount), speed + 30);
      /* reset back to normal after 5s */
      setTimeout(() => {
        clearInterval(loop);
        loop = setInterval(() => moveSnake(diff, hurdleCount), speed);
      }, 5000);
    }

    score = Math.max(0, score + points);
    scoreEl.textContent = score;

    /* level-up every 6 points */
    if (score > 0 && score % 6 === 0) {
      level++;
      /* add level+hurdleCount/3 new obstacles — hard mode adds more */
      const extra = diff === "hard" ? 2 : 1;
      addObstacles(extra);
      if (level === 5) spawnBoss();
      shake();
    }

    /* 30% chance to spawn a power-up alongside normal food */
    if (!specialFood && Math.random() < 0.3) {
      const powers = ["shield", "ghost", "magnet"];
      specialFood = createFood(powers[rand(powers.length)]);
    }
  }


  /* ═══════════════════════════════════════════
     SHAKE — unchanged
  ═══════════════════════════════════════════ */
  function shake() {
    board.style.transform = "translateX(4px)";
    setTimeout(() => (board.style.transform = ""), 120);
  }


  /* ═══════════════════════════════════════════
     GAME OVER — now accepts a reason string
     and shows the game-over overlay instead of alert()
  ═══════════════════════════════════════════ */
  function gameOver(reason) {
    clearInterval(loop);
    clearInterval(timer);

    /* update high score */
    const isNewBest = score > highScore;
    if (isNewBest) {
      highScore = score;
      localStorage.setItem("highScore", highScore);
      highScoreEl.textContent = highScore;
    }

    /* populate overlay */
    goReason.textContent            = reason;
    modalScore.textContent          = score;
    modalBest.textContent           = highScore;
    newBestBadge.style.display      = isNewBest ? "inline-block" : "none";

    /* show overlay */
    gameoverOverlay.style.display = "flex";
  }


  /* ═══════════════════════════════════════════
     KEYBOARD — unchanged
  ═══════════════════════════════════════════ */
  document.addEventListener("keydown", e => {
    if (e.code === "Space") {
      isPaused = !isPaused;
      return;
    }
    if (isPaused) return;
    if (e.key === "ArrowUp"    && direction !== "DOWN")  direction = "UP";
    if (e.key === "ArrowDown"  && direction !== "UP")    direction = "DOWN";
    if (e.key === "ArrowLeft"  && direction !== "RIGHT") direction = "LEFT";
    if (e.key === "ArrowRight" && direction !== "LEFT")  direction = "RIGHT";
  });


  /* ═══════════════════════════════════════════
     RESIZE — re-init with same settings
  ═══════════════════════════════════════════ */
  window.addEventListener("resize", () => init(selectedDiff, selectedHurdles));


  /* ═══════════════════════════════════════════
     BOOT — show the menu first, don't auto-start
  ═══════════════════════════════════════════ */
  /* The menu overlay is already visible in the HTML.
     We still call init() so the board is drawn behind it,
     giving the player a preview of the game surface. */
  init(selectedDiff, selectedHurdles);

});
document.addEventListener("DOMContentLoaded", () => {
  const board = document.querySelector(".board");
  const highScoreEl = document.querySelector("#score");
  const infoEls = document.querySelectorAll("#time");

  function blockSize() {
    if (window.innerWidth < 480) return 28;
    if (window.innerWidth < 768) return 36;
    return 50;
  }

  let SIZE = blockSize();
  let speed = window.innerWidth < 480 ? 110 : 90;
  let level = 1;
  let obstacleTick = 0;

  let rows,
    cols,
    cells = {};

  let snake, direction, score, seconds;
  let food, specialFood, obstacles;

  /* 🆕 NEW STATE */
  let boss = null;
  let shield = false;
  let ghost = false;
  let magnet = false;

  let isPaused = false;
  let loop, timer;

  let highScore = localStorage.getItem("highScore") || 0;
  highScoreEl.textContent = highScore;

  function rand(n) {
    return Math.floor(Math.random() * n);
  }

  function init() {
    board.innerHTML = "";
    cells = {};

    SIZE = blockSize();
    rows = Math.floor(board.clientHeight / SIZE);
    cols = Math.floor(board.clientWidth / SIZE);

    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.className = "block";
        board.appendChild(cell);
        cells[`${r}-${c}`] = cell;
      }
    }

    snake = [
      { r: 5, c: 5 },
      { r: 5, c: 6 },
      { r: 5, c: 7 },
    ];

    direction = "RIGHT";
    score = 0;
    seconds = 0;
    level = 1;
    obstacleTick = 0;

    shield = false;
    ghost = false;
    magnet = false;
    boss = null;

    food = createFood();
    specialFood = null;
    obstacles = [];

    infoEls[0].textContent = score;
    infoEls[1].textContent = "00:00";

    createObstacles();
    render();

    clearInterval(loop);
    clearInterval(timer);

    loop = setInterval(moveSnake, speed);
    timer = setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    if (isPaused) return;
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    infoEls[1].textContent = `${m}:${s}`;
  }

  function createFood(type = "normal") {
    const colors = {
      normal: "red",
      speed: "cyan",
      slow: "orange",
      double: "magenta",
      poison: "purple",
      golden: "gold",
      shield: "lime",
      ghost: "white",
      magnet: "blue",
    };

    return {
      r: rand(rows),
      c: rand(cols),
      type,
      color: colors[type],
    };
  }

  function createObstacles() {
    obstacles = [];
    for (let i = 0; i < level + 2; i++) {
      obstacles.push({ r: rand(rows), c: rand(cols) });
    }
  }

  function moveObstacles() {
    obstacles.forEach((o) => {
      if (Math.random() < 0.4) {
        o.r = rand(rows);
        o.c = rand(cols);
      }
    });
  }

  /* 🆕 BOSS LOGIC */
  function spawnBoss() {
    boss = { r: rand(rows), c: rand(cols) };
  }

  function moveBoss() {
    if (!boss) return;
    const head = snake[snake.length - 1];
    boss.r += Math.sign(head.r - boss.r);
    boss.c += Math.sign(head.c - boss.c);
  }

  function clearBoard() {
    Object.values(cells).forEach((c) => {
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
      if (i === snake.length - 1) {
        cell.style.backgroundColor = "#eee";
      }
    });

    paintFood(food);
    if (specialFood) paintFood(specialFood);

    obstacles.forEach((o) => {
      const cell = cells[`${o.r}-${o.c}`];
      if (cell) cell.style.backgroundColor = "#444";
    });

    if (boss) {
      const cell = cells[`${boss.r}-${boss.c}`];
      if (cell) cell.style.backgroundColor = "crimson";
    }
  }

  function moveSnake() {
    if (isPaused) return;

    obstacleTick++;
    if (obstacleTick % 8 === 0) moveObstacles();
    if (boss && obstacleTick % 5 === 0) moveBoss();

    const head = snake[snake.length - 1];
    const newHead = { ...head };

    if (direction === "UP") newHead.r--;
    if (direction === "DOWN") newHead.r++;
    if (direction === "LEFT") newHead.c--;
    if (direction === "RIGHT") newHead.c++;

    if (
      newHead.r < 0 ||
      newHead.c < 0 ||
      newHead.r >= rows ||
      newHead.c >= cols
    ) {
      if (shield) shield = false;
      else return gameOver();
    }

    if (!ghost && snake.some((s) => s.r === newHead.r && s.c === newHead.c))
      return gameOver();

    if (!ghost && obstacles.some((o) => o.r === newHead.r && o.c === newHead.c))
      return gameOver();

    if (boss && boss.r === newHead.r && boss.c === newHead.c) return gameOver();

    snake.push(newHead);

    let ate = false;

    if (newHead.r === food.r && newHead.c === food.c) {
      applyEffect(food.type);
      food = createFood();
      ate = true;
    }

    if (
      specialFood &&
      newHead.r === specialFood.r &&
      newHead.c === specialFood.c
    ) {
      applyEffect(specialFood.type);
      specialFood = null;
      ate = true;
    }

    if (!ate) snake.shift();
    render();
  }

  function applyEffect(type) {
    let points = 1;

    if (type === "double") points = 2;
    if (type === "poison") {
      snake.splice(0, 2);
      points = -1;
    }
    if (type === "golden") points = 5;

    if (type === "shield") shield = true;
    if (type === "ghost") ghost = true;
    if (type === "magnet") magnet = true;

    score = Math.max(0, score + points);
    infoEls[0].textContent = score;

    if (score % 6 === 0) {
      level++;
      createObstacles();
      if (level === 5) spawnBoss();
      shake();
    }

    if (!specialFood && Math.random() < 0.3) {
      const powers = ["shield", "ghost", "magnet"];
      specialFood = createFood(powers[rand(powers.length)]);
    }
  }

  function shake() {
    board.style.transform = "translateX(4px)";
    setTimeout(() => (board.style.transform = ""), 120);
  }

  function gameOver() {
    clearInterval(loop);
    clearInterval(timer);

    if (score > highScore) {
      localStorage.setItem("highScore", score);
      highScoreEl.textContent = score;
    }

    alert("Game Over");
    init();
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      isPaused = !isPaused;
      return;
    }
    if (isPaused) return;
    if (e.key === "ArrowUp" && direction !== "DOWN") direction = "UP";
    if (e.key === "ArrowDown" && direction !== "UP") direction = "DOWN";
    if (e.key === "ArrowLeft" && direction !== "RIGHT") direction = "LEFT";
    if (e.key === "ArrowRight" && direction !== "LEFT") direction = "RIGHT";
  });

  window.addEventListener("resize", init);
  init();
});

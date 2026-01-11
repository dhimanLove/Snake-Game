document.addEventListener("DOMContentLoaded", () => {

  const board = document.querySelector(".board"); // main game container
  const highScoreEl = document.querySelector("#score"); // high score text
  const infoEls = document.querySelectorAll("#time"); // score + time spans

  function blockSize() {
    if (window.innerWidth < 480) return 28; // phone size
    if (window.innerWidth < 768) return 36; // tablet size
    return 50; // desktop size
  }

  let SIZE = blockSize(); // cell size based on screen
  let speed = window.innerWidth < 480 ? 110 : 90; // slower on phone
  let level = 1; // difficulty level
  let obstacleTick = 0; // controls obstacle movement rate

  let rows, cols, cells = {}; // grid dimensions and lookup table

  let snake, direction, score, seconds; // game state
  let food, specialFood, obstacles; // items on board
  let isPaused = false; // pause flag
  let loop, timer; // intervals

  let highScore = localStorage.getItem("highScore") || 0; // saved best
  highScoreEl.textContent = highScore; // show best score

  function init() {
    board.innerHTML = ""; // clear board
    cells = {}; // reset cell map

    SIZE = blockSize(); // recalc size on resize
    rows = Math.floor(board.clientHeight / SIZE); // how many rows fit
    cols = Math.floor(board.clientWidth / SIZE); // how many cols fit

    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`; // dynamic grid
    board.style.gridTemplateRows = `repeat(${rows}, 1fr)`; // dynamic grid

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div"); // one grid block
        cell.className = "block"; // base style
        board.appendChild(cell); // add to board
        cells[`${r}-${c}`] = cell; // store reference by position
      }
    }

    snake = [
      { r: 5, c: 5 },
      { r: 5, c: 6 },
      { r: 5, c: 7 }
    ]; // initial snake body

    direction = "RIGHT"; // default direction
    score = 0; // reset score
    seconds = 0; // reset timer
    food = createFood(); // spawn food
    specialFood = null; // no special food initially
    obstacles = []; // reset obstacles
    level = 1; // reset level
    obstacleTick = 0; // reset obstacle timer

    infoEls[0].textContent = score; // show score
    infoEls[1].textContent = "00:00"; // show time

    createObstacles(); // spawn obstacles
    render(); // draw everything

    clearInterval(loop); // stop old loop
    clearInterval(timer); // stop old timer

    loop = setInterval(moveSnake, speed); // main game loop
    timer = setInterval(updateTimer, 1000); // time counter
  }

  function updateTimer() {
    if (isPaused) return; // freeze timer when paused
    seconds++; // add second
    const m = String(Math.floor(seconds / 60)).padStart(2, "0"); // minutes
    const s = String(seconds % 60).padStart(2, "0"); // seconds
    infoEls[1].textContent = `${m}:${s}`; // update UI
  }

  function rand(n) {
    return Math.floor(Math.random() * n); // random number helper
  }

  function createFood(type = "normal") {
    const colors = {
      normal: "red",
      speed: "cyan",
      slow: "orange",
      double: "magenta",
      poison: "purple",
      golden: "gold"
    }; // color by food type

    return {
      r: rand(rows), // random row
      c: rand(cols), // random col
      type, // effect type
      color: colors[type] // visual color
    };
  }

  function createObstacles() {
    obstacles = []; // reset obstacles
    for (let i = 0; i < level + 2; i++) {
      obstacles.push({ r: rand(rows), c: rand(cols) }); // random blocks
    }
  }

  function moveObstacles() {
    obstacles.forEach(o => {
      if (Math.random() < 0.4) { // move rarely, not every frame
        o.r = rand(rows);
        o.c = rand(cols);
      }
    });
  }

  function clearBoard() {
    Object.values(cells).forEach(c => {
      c.className = "block"; // reset classes
      c.style.backgroundColor = ""; // reset color
    });
  }

  function paintFood(f) {
    const cell = cells[`${f.r}-${f.c}`]; // locate cell
    if (cell) cell.style.backgroundColor = f.color; // paint food
  }

  function render() {
    clearBoard(); // wipe previous frame

    snake.forEach((s, i) => {
      const cell = cells[`${s.r}-${s.c}`];
      if (!cell) return; // safety check
      cell.classList.add("fill"); // snake body
      if (i === snake.length - 1) {
        cell.style.backgroundColor = "#eee"; // head highlight
      }
    });

    paintFood(food); // draw normal food
    if (specialFood) paintFood(specialFood); // draw special food

    obstacles.forEach(o => {
      const cell = cells[`${o.r}-${o.c}`];
      if (cell) cell.style.backgroundColor = "#444"; // obstacle block
    });
  }

  function moveSnake() {
    if (isPaused) return; // stop movement when paused

    obstacleTick++; // count frames
    if (obstacleTick % 8 === 0) moveObstacles(); // slow obstacle move

    const head = snake[snake.length - 1]; // current head
    const newHead = { ...head }; // copy head

    if (direction === "UP") newHead.r--;
    if (direction === "DOWN") newHead.r++;
    if (direction === "LEFT") newHead.c--;
    if (direction === "RIGHT") newHead.c++;

    if (
      newHead.r < 0 || newHead.c < 0 ||
      newHead.r >= rows || newHead.c >= cols
    ) return gameOver(); // wall hit

    if (snake.some(s => s.r === newHead.r && s.c === newHead.c))
      return gameOver(); // self hit

    if (obstacles.some(o => o.r === newHead.r && o.c === newHead.c))
      return gameOver(); // obstacle hit

    snake.push(newHead); // move head forward

    let ate = false; // track food eating

    if (newHead.r === food.r && newHead.c === food.c) {
      applyEffect(food.type); // apply food effect
      food = createFood(); // spawn new food
      ate = true;
    }

    if (
      specialFood &&
      newHead.r === specialFood.r &&
      newHead.c === specialFood.c
    ) {
      applyEffect(specialFood.type); // apply special effect
      specialFood = null; // remove special food
      ate = true;
    }

    if (!ate) snake.shift(); // remove tail if no food eaten
    render(); // redraw board
  }

  function applyEffect(type) {
    let points = 1; // base score

    if (type === "double") points = 2; // bonus points
    if (type === "poison") {
      snake.splice(0, 2); // shorten snake
      points = -1;
    }
    if (type === "golden") points = 5; // big reward

    score += points; // update score
    if (score < 0) score = 0; // clamp
    infoEls[0].textContent = score; // update UI

    if (type === "speed" && speed > 60) updateSpeed(-10); // faster
    if (type === "slow" && speed < 200) updateSpeed(20); // slower

    if (score % 6 === 0) {
      level++; // increase difficulty
      createObstacles(); // add obstacles
      shake(); // visual feedback
    }

    if (!specialFood && Math.random() < 0.25) {
      specialFood = createFood("golden"); // rare bonus food
    }
  }

  function updateSpeed(d) {
    speed += d; // change speed
    clearInterval(loop); // reset loop
    loop = setInterval(moveSnake, speed); // apply new speed
  }

  document.addEventListener("keydown", e => {
    if (e.code === "Space") {
      isPaused = !isPaused; // toggle pause
      return;
    }

    if (isPaused) return; // block movement when paused

    if (e.key === "ArrowUp" && direction !== "DOWN") direction = "UP";
    if (e.key === "ArrowDown" && direction !== "UP") direction = "DOWN";
    if (e.key === "ArrowLeft" && direction !== "RIGHT") direction = "LEFT";
    if (e.key === "ArrowRight" && direction !== "LEFT") direction = "RIGHT";
  });

  let startX = 0, startY = 0; // touch start coords

  board.addEventListener("touchstart", e => {
    const t = e.touches[0];
    startX = t.clientX; // record start X
    startY = t.clientY; // record start Y
  });

  board.addEventListener("touchend", e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX; // horizontal swipe
    const dy = t.clientY - startY; // vertical swipe

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && direction !== "LEFT") direction = "RIGHT";
      else if (dx < 0 && direction !== "RIGHT") direction = "LEFT";
    } else {
      if (dy > 0 && direction !== "UP") direction = "DOWN";
      else if (dy < 0 && direction !== "DOWN") direction = "UP";
    }
  });

  function shake() {
    board.style.transform = "translateX(4px)"; // quick shake
    setTimeout(() => board.style.transform = "", 120);
  }

  function gameOver() {
    clearInterval(loop); // stop movement
    clearInterval(timer); // stop timer

    if (score > highScore) {
      localStorage.setItem("highScore", score); // save best
      highScoreEl.textContent = score;
    }

    alert("Game Over"); // notify player
    init(); // restart game
  }

  window.addEventListener("resize", () => {
    clearInterval(loop);
    clearInterval(timer);
    init(); // rebuild grid on resize
  });

  init(); // start game

});

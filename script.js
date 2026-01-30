// =====================================
// BASIC PIXI APP WITH RESIZE (KEEP GRID)
// =====================================

document.body.style.margin = "0";
document.body.style.overflow = "hidden";

const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x2c2c2c,
  resizeTo: window
});

document.body.appendChild(app.view);

// =====================================
// IMAGE SOURCES
// =====================================

const images = [
  "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png",
  "https://upload.wikimedia.org/wikipedia/commons/9/9e/Itunes-music-app-icon.png?20191024054655",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/App_Store_%28iOS%29.svg/512px-App_Store_%28iOS%29.svg.png"
];

// =====================================
// GRID SETTINGS
// =====================================

const ROWS = 3;
const COLS = 3;
const PADDING = 20;
const TILE_SIZE = 100;

let startX, startY;

// =====================================
// GRID & STATE
// =====================================

const tiles = [];
let grid = []; // 2D grid

// outline graphics
const hoverOutline = new PIXI.Graphics();
const selectedOutline = new PIXI.Graphics();
const candidateOutline = new PIXI.Graphics();

app.stage.addChild(hoverOutline);
app.stage.addChild(candidateOutline);
app.stage.addChild(selectedOutline);

// =====================================
// DRAG STATE
// =====================================

let selectedTile = null;
let dragStartPos = null;
let swapCandidate = null;
const DRAG_LIMIT = 100;

// =====================================
// CREATE GRID WITHOUT INITIAL MATCHES
// =====================================

function createGrid() {
  // clear previous
  tiles.forEach(t => app.stage.removeChild(t));
  tiles.length = 0;
  grid = [];

  const gridWidth = COLS * TILE_SIZE + (COLS - 1) * PADDING;
  const gridHeight = ROWS * TILE_SIZE + (ROWS - 1) * PADDING;

  startX = (app.screen.width - gridWidth) / 2;
  startY = (app.screen.height - gridHeight) / 2;

  for (let row = 0; row < ROWS; row++) {
    grid[row] = [];
    for (let col = 0; col < COLS; col++) {
      let texture;
      do {
        texture = PIXI.Texture.from(images[Math.floor(Math.random() * images.length)]);
      } while (
        (col >= 2 && texture === grid[row][col - 1]?.texture && texture === grid[row][col - 2]?.texture) ||
        (row >= 2 && texture === grid[row - 1][col]?.texture && texture === grid[row - 2][col]?.texture)
      );

      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;

      sprite.gridX = col;
      sprite.gridY = row;

      sprite.baseX = startX + col * (TILE_SIZE + PADDING) + TILE_SIZE / 2;
      sprite.baseY = startY + row * (TILE_SIZE + PADDING) + TILE_SIZE / 2;

      sprite.x = sprite.baseX;
      sprite.y = sprite.baseY;

      // jiggle
      sprite.jigglePhase = Math.random() * Math.PI * 2;
      sprite.jiggleSpeed = 0.03 + Math.random() * 0.02;

      sprite.interactive = true;
      sprite.cursor = "pointer";

      // HOVER
      sprite.on("pointerover", () => {
        if (!selectedTile && !swapCandidate) {
          hoverOutline.clear();
          hoverOutline.lineStyle(10, 0xffffff);
          hoverOutline.drawRoundedRect(
            sprite.x - sprite.width / 2,
            sprite.y - sprite.height / 2,
            sprite.width,
            sprite.height,
            30
          );
        }
      });
      sprite.on("pointerout", () => {
        if (!selectedTile && !swapCandidate) hoverOutline.clear();
      });

      // DRAG
      sprite
        .on("pointerdown", onDragStart)
        .on("pointerup", onDragEnd)
        .on("pointerupoutside", onDragEnd)
        .on("pointermove", onDragMove);

      grid[row][col] = sprite;
      tiles.push(sprite);
      app.stage.addChild(sprite);
    }
  }
}

createGrid();

// =======================================
// RECENTER GRID ON RESIZE
// =======================================
function recenterGrid() {
  const gridWidth = COLS * TILE_SIZE + (COLS - 1) * PADDING;
  const gridHeight = ROWS * TILE_SIZE + (ROWS - 1) * PADDING;

  const newStartX = (app.screen.width - gridWidth) / 2;
  const newStartY = (app.screen.height - gridHeight) / 2;

  // move each tile relative to new center
  tiles.forEach(tile => {
    const targetX = newStartX + tile.gridX * (TILE_SIZE + PADDING) + TILE_SIZE / 2;
    const targetY = newStartY + tile.gridY * (TILE_SIZE + PADDING) + TILE_SIZE / 2;

    // optional smooth animation
    tile.x = targetX;
    tile.y = targetY;

    // update base positions
    tile.baseX = targetX;
    tile.baseY = targetY;
  });

  startX = newStartX;
  startY = newStartY;
}

// =======================================
// JIGGLE LOOP
// =======================================

app.ticker.add(() => {
  if (!selectedTile) {
    tiles.forEach(sprite => {
      sprite.jigglePhase += sprite.jiggleSpeed;
      sprite.rotation = Math.sin(sprite.jigglePhase) * 0.05;
    });
  }
});

// =======================================
// DRAG HANDLERS
// =======================================

function onDragStart(event) {
  selectedTile = this;
  dragStartPos = event.data.getLocalPosition(this.parent);

  selectedOutline.clear();
  selectedOutline.lineStyle(10, 0xffff00);
  selectedOutline.drawRoundedRect(
    selectedTile.x - selectedTile.width / 2,
    selectedTile.y - selectedTile.height / 2,
    selectedTile.width,
    selectedTile.height,
    30
  );
}

function onDragMove(event) {
  if (!selectedTile) return;

  const pos = event.data.getLocalPosition(this.parent);
  const dx = pos.x - dragStartPos.x;
  const dy = pos.y - dragStartPos.y;

  swapCandidate = null;
  candidateOutline.clear();

  if (Math.abs(dx) >= DRAG_LIMIT || Math.abs(dy) >= DRAG_LIMIT) {
    let dir = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
    } else {
      dir = dy > 0 ? { dx: 0, dy: 1 } : { dx: 0, dy: -1 };
    }

    const targetX = selectedTile.gridX + dir.dx;
    const targetY = selectedTile.gridY + dir.dy;

    if (targetX >= 0 && targetX < COLS && targetY >= 0 && targetY < ROWS) {
      swapCandidate = grid[targetY][targetX];

      candidateOutline.clear();
      candidateOutline.lineStyle(10, 0x00ffff);
      candidateOutline.drawRoundedRect(
        swapCandidate.x - swapCandidate.width / 2,
        swapCandidate.y - swapCandidate.height / 2,
        swapCandidate.width,
        swapCandidate.height,
        30
      );
    }
  }
}

function onDragEnd() {
  if (selectedTile && swapCandidate) {
    swapTilesAnimated(selectedTile, swapCandidate);
  }

  selectedTile = null;
  swapCandidate = null;
  dragStartPos = null;
  selectedOutline.clear();
  candidateOutline.clear();
  hoverOutline.clear();
}

// =======================================
// SWAP WITH ANIMATION
// =======================================

function swapTilesAnimated(a, b) {
  const duration = 0.3;
  const startTime = performance.now();

  const aStart = { x: a.x, y: a.y };
  const bStart = { x: b.x, y: b.y };
  const aEnd = { x: bStart.x, y: bStart.y };
  const bEnd = { x: aStart.x, y: aStart.y };

  function animate() {
    const now = performance.now();
    let t = (now - startTime) / (duration * 1000);
    if (t > 1) t = 1;

    a.x = aStart.x + (aEnd.x - aStart.x) * t;
    a.y = aStart.y + (aEnd.y - aStart.y) * t;
    b.x = bStart.x + (bEnd.x - bStart.x) * t;
    b.y = bStart.y + (bEnd.y - bStart.y) * t;

    if (t < 1) requestAnimationFrame(animate);
    else {
      const tempX = a.gridX;
      const tempY = a.gridY;
      a.gridX = b.gridX;
      a.gridY = b.gridY;
      b.gridX = tempX;
      b.gridY = tempY;
      grid[a.gridY][a.gridX] = a;
      grid[b.gridY][b.gridX] = b;

      const matches = checkMatches();
      if (matches.length > 0) {
        triggerConfetti(matches);
        removeMatchedTiles(matches);
      }
    }
  }

  animate();
}

// =======================================
// CHECK MATCHES
// =======================================

function checkMatches() {
  const matched = [];

  // Horizontal
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS - 2; col++) {
      const a = grid[row][col];
      const b = grid[row][col + 1];
      const c = grid[row][col + 2];
      if (a.texture === b.texture && b.texture === c.texture) {
        matched.push(a, b, c);
      }
    }
  }

  // Vertical
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS - 2; row++) {
      const a = grid[row][col];
      const b = grid[row + 1][col];
      const c = grid[row + 2][col];
      if (a.texture === b.texture && b.texture === c.texture) {
        matched.push(a, b, c);
      }
    }
  }

  return [...new Set(matched)];
}

// =======================================
// REMOVE MATCHED TILES AND DROP NEW
// =======================================

function removeMatchedTiles(matches) {
  // remove visually
  matches.forEach(tile => {
    app.stage.removeChild(tile);
    tiles.splice(tiles.indexOf(tile), 1);
    grid[tile.gridY][tile.gridX] = null;
  });

  // drop tiles down
  for (let col = 0; col < COLS; col++) {
    let emptySpots = 0;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (!grid[row][col]) {
        emptySpots++;
      } else if (emptySpots > 0) {
        const tile = grid[row][col];
        grid[row + emptySpots][col] = tile;
        tile.gridY += emptySpots;
        tile.y = tile.gridY * (TILE_SIZE + PADDING) + TILE_SIZE / 2 + startY;
        grid[row][col] = null;
      }
    }

    // create new tiles at top (ensure unique in column)
    const usedTextures = [];
    for (let i = 0; i < emptySpots; i++) {
      let texture;
      do {
        texture = PIXI.Texture.from(images[Math.floor(Math.random() * images.length)]);
      } while (usedTextures.includes(texture));
      usedTextures.push(texture);

      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.gridX = col;
      sprite.gridY = i;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      sprite.x = startX + col * (TILE_SIZE + PADDING) + TILE_SIZE / 2;
      sprite.y = startY - (emptySpots - i) * (TILE_SIZE + PADDING);
      sprite.interactive = true;
      sprite.cursor = "pointer";

      sprite.jigglePhase = Math.random() * Math.PI * 2;
      sprite.jiggleSpeed = 0.03 + Math.random() * 0.02;

      sprite
        .on("pointerover", () => {
          if (!selectedTile && !swapCandidate) {
            hoverOutline.clear();
            hoverOutline.lineStyle(10, 0xffffff);
            hoverOutline.drawRoundedRect(
              sprite.x - sprite.width / 2,
              sprite.y - sprite.height / 2,
              sprite.width,
              sprite.height,
              30
            );
          }
        })
        .on("pointerout", () => {
          if (!selectedTile && !swapCandidate) hoverOutline.clear();
        })
        .on("pointerdown", onDragStart)
        .on("pointerup", onDragEnd)
        .on("pointerupoutside", onDragEnd)
        .on("pointermove", onDragMove);

      tiles.push(sprite);
      app.stage.addChild(sprite);

      // animate dropping
      const endY = startY + i * (TILE_SIZE + PADDING) + TILE_SIZE / 2;
      const startTime = performance.now();
      const duration = 300;
      function animateDrop() {
        const t = Math.min((performance.now() - startTime) / duration, 1);
        sprite.y = sprite.y + (endY - sprite.y) * t;
        if (t < 1) requestAnimationFrame(animateDrop);
      }
      animateDrop();

      grid[i][col] = sprite;
    }
  }

  // check again for new matches after dropping
  setTimeout(() => {
    const newMatches = checkMatches();
    if (newMatches.length > 0) {
      triggerConfetti(newMatches);
      removeMatchedTiles(newMatches);
    }
  }, 350);
}

// =======================================
// TRIGGER CONFETTI
// =======================================

function triggerConfetti(tilesMatched) {
  const confettiContainer = new PIXI.Container();
  app.stage.addChild(confettiContainer);

  const colors = [0xff0000, 0x00ff00, 0x0000ff];
  const particles = [];

  tilesMatched.forEach(tile => {
    for (let i = 0; i < 5; i++) {
      const p = new PIXI.Graphics();
      p.beginFill(colors[Math.floor(Math.random() * colors.length)]);
      p.drawRect(0, 0, 8, 8);
      p.endFill();
      p.x = tile.x;
      p.y = -10;
      p.vy = 2 + Math.random() * 3;
      p.vx = -1 + Math.random() * 2;
      confettiContainer.addChild(p);
      particles.push(p);
    }
  });

  const ticker = new PIXI.Ticker();
  ticker.add(() => {
    particles.forEach(p => {
      p.y += p.vy;
      p.x += p.vx;
    });
  });
  ticker.start();

  setTimeout(() => {
    ticker.stop();
    confettiContainer.destroy({ children: true });
  }, 1000);
}

// =======================================
// WINDOW RESIZE HANDLER
// =======================================

window.addEventListener("resize", () => {
  recenterGrid();
});

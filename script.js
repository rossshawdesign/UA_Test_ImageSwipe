// =====================================
// PIXI APP SETUP
// =====================================
document.body.style.margin = "0";
document.body.style.overflow = "hidden";

const app = new PIXI.Application({
  resizeTo: window,
  backgroundColor: 0x1e1e1e,
  antialias: true
});

document.body.appendChild(app.view);

// =====================================
// IMAGE SOURCES
// =====================================
const imageUrls = [
  "https://cdn.pixabay.com/photo/2025/11/28/14/40/sea-9983074_1280.jpg",
  "https://cdn.pixabay.com/photo/2023/10/20/17/52/banff-8329971_1280.jpg",
  "https://cdn.pixabay.com/photo/2026/01/18/10/16/parakeet-10074499_1280.jpg"
];

// =====================================
// CONSTANTS
// =====================================
const CORNER_RADIUS = 30;
const HEIGHT_RATIO = 0.5;
const ASPECT_RATIO = 1 / 1.6;

const MAX_ROTATION = 5 * (Math.PI / 180);
const MAX_SKEW = 0.05;
const SNAP_BACK_SPEED = 0.5;
const FLY_OUT_SPEED = 30;

const NEXT_CARD_SCALE = 0.95;
const SCALE_LERP_SPEED = 0.15;

const STROKE_THRESHOLD = 200; // distance to swipe off screen
const EDGE_COMMIT_RATIO = 0.2;

// =====================================
// ROOT CONTAINER
// =====================================
const carouselContainer = new PIXI.Container();
app.stage.addChild(carouselContainer);

let cards = [];
let activeCard = null;
let textures = [];

// =====================================
// LOAD TEXTURES (PIXI v7+)
// =====================================
PIXI.Assets.load(imageUrls).then(() => {
  textures = imageUrls.map(url => PIXI.Assets.get(url));

  // Initial stack (3 cards for visual depth)
  for (let i = 0; i < 3; i++) {
    const card = createCard(randomTexture());
    carouselContainer.addChild(card.container);
    cards.push(card);
  }

  setupStack();
  app.ticker.add(update);
  resize();
});

// =====================================
// CARD FACTORY
// =====================================
function createCard(texture) {
  const container = new PIXI.Container();

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);

  const mask = new PIXI.Graphics();
  sprite.mask = mask;

  const stroke = new PIXI.Graphics();

  container.addChild(sprite, mask, stroke);

  return {
    container,
    sprite,
    mask,
    stroke,
    targetX: 0,
    targetRotation: 0,
    targetSkew: 0,
    flyingOut: false,
    scaleTarget: NEXT_CARD_SCALE
  };
}

function randomTexture() {
  return textures[Math.floor(Math.random() * textures.length)];
}

// =====================================
// STACK SETUP
// =====================================
function setupStack() {
  cards.forEach((card, i) => {
    card.scaleTarget = i === cards.length - 1 ? 1 : NEXT_CARD_SCALE;
    card.container.scale.set(card.scaleTarget);
    card.container.zIndex = i;
  });

  carouselContainer.sortChildren();
  setActiveCard();
}

function setActiveCard() {
  if (activeCard) activeCard.container.interactive = false;

  activeCard = cards[cards.length - 1];
  activeCard.scaleTarget = 1;
  enableDrag(activeCard);
}

// =====================================
// DRAG LOGIC (DISTANCE-BASED SWIPE)
// =====================================
function enableDrag(card) {
  const container = card.container;
  container.interactive = true;
  container.cursor = "grab";

  let dragging = false;
  let pointerDownX = 0;
  let startDragX = 0;

  container
    .on("pointerdown", (e) => {
      dragging = true;
      card.flyingOut = false;
      container.cursor = "grabbing";

      pointerDownX = e.data.global.x;
      startDragX = card.targetX;
    })
    .on("pointermove", (e) => {
      if (!dragging) return;

      const currentX = e.data.global.x;
      const dx = currentX - pointerDownX;
      card.targetX = startDragX + dx;

      const progress = Math.max(-1, Math.min(1, card.targetX / 200));
      card.targetRotation = progress * MAX_ROTATION;
      card.targetSkew = progress * MAX_SKEW;

      updateStroke(card);
    })
    .on("pointerup", () => release(card))
    .on("pointerupoutside", () => release(card));

  function release(card) {
    dragging = false;
    container.cursor = "grab";

    if (Math.abs(card.targetX) > STROKE_THRESHOLD) {
      // Card flies off in direction of swipe
      card.flyingOut = true;
      card.velocityX = card.targetX > 0 ? FLY_OUT_SPEED : -FLY_OUT_SPEED;
    } else {
      // Snap back
      card.targetX = 0;
      card.targetRotation = 0;
      card.targetSkew = 0;
      clearStroke(card);
    }
  }
}

// =====================================
// UPDATE LOOP
// =====================================
function update() {
  cards.forEach(card => {
    const c = card.container;

    // Smooth scaling
    c.scale.x += (card.scaleTarget - c.scale.x) * SCALE_LERP_SPEED;
    c.scale.y = c.scale.x;

    if (card === activeCard) {
      if (card.flyingOut) {
        c.x += card.velocityX;

        if (Math.abs(c.x) > window.innerWidth * 1.2) {
          recycleCard(card);
        }
      } else {
        c.x += (card.targetX - c.x) * SNAP_BACK_SPEED;
        c.rotation += (card.targetRotation - c.rotation) * SNAP_BACK_SPEED;
        c.skew.x += (card.targetSkew - c.skew.x) * SNAP_BACK_SPEED;
      }
    }
  });
}

// =====================================
// RECYCLE CARD (ENDLESS STACK)
// =====================================
function recycleCard(card) {
  resetCard(card);

  card.sprite.texture = randomTexture();
  card.scaleTarget = NEXT_CARD_SCALE;

  // Move under stack
  cards.unshift(card);
  cards.pop();

  setupStack();
}

function resetCard(card) {
  card.targetX = 0;
  card.targetRotation = 0;
  card.targetSkew = 0;
  card.flyingOut = false;
  card.container.x = 0;
  card.container.rotation = 0;
  card.container.skew.set(0, 0);
  card.stroke.clear();
}

// =====================================
// STROKE FEEDBACK (VISUAL ONLY)
// =====================================
function updateStroke(card) {
  const { stroke, sprite, targetX } = card;
  stroke.clear();

  if (targetX < -STROKE_THRESHOLD) {
    drawStroke(stroke, sprite, 0x00ff66);
  } else if (targetX > STROKE_THRESHOLD) {
    drawStroke(stroke, sprite, 0xff4444);
  }
}

function clearStroke(card) {
  card.stroke.clear();
}

function drawStroke(g, sprite, color) {
  g.lineStyle(6, color, 1);
  g.drawRoundedRect(
    -sprite.width / 2,
    -sprite.height / 2,
    sprite.width,
    sprite.height,
    CORNER_RADIUS
  );
}

// =====================================
// RESIZE
// =====================================
function resize() {
  const imageHeight = window.innerHeight * HEIGHT_RATIO;
  const imageWidth = imageHeight * ASPECT_RATIO;

  carouselContainer.x = window.innerWidth / 2;
  carouselContainer.y = window.innerHeight / 2;

  cards.forEach((card, index) => {
    const { sprite, mask, container } = card;

    sprite.width = imageWidth;
    sprite.height = imageHeight;

    mask.clear();
    mask.beginFill(0xffffff);
    mask.drawRoundedRect(
      -imageWidth / 2,
      -imageHeight / 2,
      imageWidth,
      imageHeight,
      CORNER_RADIUS
    );
    mask.endFill();

    container.x = 0;
    container.y = 0;
    container.zIndex = index;
  });

  carouselContainer.sortChildren();
}

window.addEventListener("resize", resize);

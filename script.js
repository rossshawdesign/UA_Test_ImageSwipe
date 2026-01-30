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

const SWIPE_VELOCITY_THRESHOLD = 1.1;
const FLY_OUT_SPEED = 45;

const NEXT_CARD_SCALE = 0.95;
const SCALE_LERP_SPEED = 0.15;

const STROKE_THRESHOLD = 300;
const EDGE_COMMIT_RATIO = 0.2;

// =====================================
// ROOT CONTAINER
// =====================================
const carouselContainer = new PIXI.Container();
app.stage.addChild(carouselContainer);

let cards = [];
let activeCard = null;

// =====================================
// LOAD IMAGES
// =====================================
const loader = new PIXI.Loader();
imageUrls.forEach(url => loader.add(url));

loader.load(() => {
  imageUrls.forEach((url, index) => {
    const card = createCard(loader.resources[url].texture);
    carouselContainer.addChild(card.container);
    cards.push(card);
  });

  setupStack();
  app.ticker.add(update);
  resize();
});

// =====================================
// CARD FACTORY (IMPORTANT FIX)
// =====================================
function createCard(texture) {
  const container = new PIXI.Container();

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);

  const mask = new PIXI.Graphics();
  sprite.mask = mask;

  const stroke = new PIXI.Graphics();

  container.addChild(sprite);
  container.addChild(mask);
  container.addChild(stroke);

  return {
    container,
    sprite,
    mask,
    stroke,
    targetX: 0,
    targetRotation: 0,
    targetSkew: 0,
    velocityX: 0,
    flyingOut: false,
    scaleTarget: 1
  };
}

// =====================================
// STACK SETUP
// =====================================
function setupStack() {
  cards.forEach((card, i) => {
    card.scaleTarget = i === cards.length - 1 ? 1 : NEXT_CARD_SCALE;
    card.container.scale.set(card.scaleTarget);
  });

  setActiveCard();
}

function setActiveCard() {
  if (activeCard) activeCard.container.interactive = false;

  activeCard = cards[cards.length - 1];
  if (!activeCard) return;

  activeCard.scaleTarget = 1;
  enableDrag(activeCard);
}

// =====================================
// DRAG LOGIC
// =====================================
function enableDrag(card) {
  const container = card.container;
  container.interactive = true;
  container.cursor = "grab";

  let dragging = false;
  let lastX = 0;
  let lastTime = 0;

  container
    .on("pointerdown", (e) => {
      dragging = true;
      card.flyingOut = false;
      container.cursor = "grabbing";
      lastX = e.data.global.x;
      lastTime = performance.now();
    })
    .on("pointermove", (e) => {
      if (!dragging) return;

      const now = performance.now();
      const currentX = e.data.global.x;

      const dx = currentX - lastX;
      const dt = now - lastTime || 1;

      card.velocityX = dx / dt;
      card.targetX += dx;

      const progress = Math.max(-1, Math.min(1, card.targetX / 200));
      card.targetRotation = progress * MAX_ROTATION;
      card.targetSkew = progress * MAX_SKEW;

      updateStroke(card);

      lastX = currentX;
      lastTime = now;
    })
    .on("pointerup", () => release(card))
    .on("pointerupoutside", () => release(card));

  function release(card) {
    dragging = false;
    container.cursor = "grab";

    const absX = Math.abs(card.targetX);
    const edgeLimit = window.innerWidth * EDGE_COMMIT_RATIO;

    if (
      Math.abs(card.velocityX) > SWIPE_VELOCITY_THRESHOLD ||
      absX > edgeLimit
    ) {
      card.flyingOut = true;
      card.velocityX =
        Math.sign(card.targetX || card.velocityX) * FLY_OUT_SPEED;
    } else {
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
  cards.forEach((card) => {
    const { container } = card;

    container.scale.x +=
      (card.scaleTarget - container.scale.x) * SCALE_LERP_SPEED;
    container.scale.y = container.scale.x;

    if (card === activeCard) {
      if (card.flyingOut) {
        container.x += card.velocityX;

        if (Math.abs(container.x) > window.innerWidth * 1.2) {
          removeCard(card);
        }
      } else {
        container.x += (card.targetX - container.x) * SNAP_BACK_SPEED;
        container.rotation +=
          (card.targetRotation - container.rotation) * SNAP_BACK_SPEED;
        container.skew.x +=
          (card.targetSkew - container.skew.x) * SNAP_BACK_SPEED;
      }
    }
  });
}

// =====================================
// CARD REMOVAL
// =====================================
function removeCard(card) {
  carouselContainer.removeChild(card.container);
  cards.pop();

  if (cards.length > 0) {
    cards[cards.length - 1].scaleTarget = 1;
  }

  setActiveCard();
}

// =====================================
// STROKE FEEDBACK
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
// RESIZE (FIXED & CORRECT)
// =====================================
function resize() {
  const imageHeight = window.innerHeight * HEIGHT_RATIO;
  const imageWidth = imageHeight * ASPECT_RATIO;

  carouselContainer.x = window.innerWidth / 2;
  carouselContainer.y = window.innerHeight / 2;

  cards.forEach((card, index) => {
    const { sprite, mask, stroke, container } = card;

    sprite.width = imageWidth;
    sprite.height = imageHeight;

    sprite.x = 0;
    sprite.y = 0;

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

    stroke.clear();

    container.x = 0;
    container.y = 0;
    container.rotation = 0;
    container.skew.set(0, 0);

    container.zIndex = index;
  });

  carouselContainer.sortChildren();
}

window.addEventListener("resize", resize);

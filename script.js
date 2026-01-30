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
// IMAGE SOURCES (raw GitHub URLs)
// =====================================
const imageUrls = [
  "https://raw.githubusercontent.com/rossshawdesign/UA_Test_ImageSwipe/main/images/sea.jpg",
  "https://raw.githubusercontent.com/rossshawdesign/UA_Test_ImageSwipe/main/images/banff.jpg",
  "https://raw.githubusercontent.com/rossshawdesign/UA_Test_ImageSwipe/main/images/parakeet.jpg"
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
let textures = [];

// =====================================
// LOAD IMAGES
// =====================================
const loader = new PIXI.Loader();
imageUrls.forEach(url => loader.add(url));

loader.load(() => {
  textures = imageUrls.map(url => loader.resources[url].texture);

  // Initial stack (3 cards for illusion)
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
    velocityX: 0,
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
  if (!cards.length) return;

  activeCard = cards[cards.length - 1];
  activeCard.scaleTarget = 1;
  enableDrag(activeCard);
}

// =====================================
// DRAG LOGIC (FIXED SENSITIVITY)
// =====================================
function enableDrag(card) {
  const container = card.container;
  container.interactive = true;
  container.cursor = "grab";

  let dragging = false;
  let pointerDownX = 0;
  let startDragX = 0;
  let lastTime = 0;

  container
    .on("pointerdown", (e) => {
      dragging = true;
      card.flyingOut = false;
      container.cursor = "grabbing";

      pointerDownX = e.data.global.x;
      startDragX = card.targetX;
      lastTime = performance.now();
    })
    .on("pointermove", (e) => {
      if (!dragging) return;

      const now = performance.now();
      const currentX = e.data.global.x;

      const dx = currentX - pointerDownX;
      const dt = now - lastTime || 1;

      card.velocityX = dx / dt;
      card.targetX = startDragX + dx;

      const progress = Math.max(-1, Math.min(1, card.targetX / 200));
      card.targetRotation = progress * MAX_ROTATION;
      card.targetSkew = progress * MAX_SKEW;

      updateStroke(card);

      lastTime = now;
    })
    .on("pointerup", () => release(card))
    .on("pointerupoutside", () => release(card));

  function release(card) {
    dragging = false;
    container.cursor = "grab";

    const edgeLimit = window.innerWidth * EDGE_COMMIT_RATIO;

    if (
      Math.abs(card.velocityX) > SWIPE_VELOCITY_THRESHOLD ||
      Math.abs(card.targetX) > edgeLimit
    ) {
      card.flyingOut = true;
      card.velocityX =
        Math.sign(card.targetX || card.velocityX) * FLY_OUT_SPEED;

      // Immediately make next card active
      const nextCard = cards[cards.length - 2];
      if (nextCard) setActiveCard();
    } else {
      resetCard(card);
    }
  }
}

// =====================================
// UPDATE LOOP
// =====================================
function update() {
  cards.forEach(card => {
    const c = card.container;

    // scale animation
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
// CARD RESET / RECYCLE (ENDLESS)
// =====================================
function recycleCard(card) {
  resetCard(card);

  card.sprite.texture = randomTexture();
  card.scaleTarget = NEXT_CARD_SCALE;

  // Move recycled card under the stack
  cards.unshift(card);
  cards.pop();

  // Immediately make new top card active
  setActiveCard();

  // Update zIndex and scale for smooth visuals
  cards.forEach((c, i) => {
    c.scaleTarget = i === cards.length - 1 ? 1 : NEXT_CARD_SCALE;
    c.container.zIndex = i;
  });

  carouselContainer.sortChildren();
}

function resetCard(card) {
  card.targetX = 0;
  card.targetRotation = 0;
  card.targetSkew = 0;
  card.velocityX = 0;
  card.flyingOut = false;
  card.container.x = 0;
  card.container.rotation = 0;
  card.container.skew.set(0, 0);
  card.stroke.clear();
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

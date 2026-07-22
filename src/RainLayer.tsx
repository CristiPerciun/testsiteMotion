import { useEffect, useRef } from 'react';

const IMAGE_WIDTH = 1672;
const IMAGE_HEIGHT = 941;
const MAX_SURFACE_BEADS = 68;
const MAX_SPLASHES = 90;
const MAX_FREE_BEADS = 38;

type Point = { x: number; y: number };

type SourceEllipse = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

type ScreenEllipse = SourceEllipse;

type RainDrop = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  bucket: 0 | 1 | 2;
  active: boolean;
};

type CanopyBead = {
  ellipseIndex: number;
  side: -1 | 1;
  angle: number;
  speed: number;
  size: number;
  hold: number;
  detachAt: number;
  phase: number;
};

type TrunkBead = {
  pathIndex: number;
  distance: number;
  speed: number;
  size: number;
  hold: number;
};

type FreeBead = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
};

type Splash = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  life: number;
};

type Ripple = {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
};

type ScreenPath = {
  points: Point[];
  cumulative: number[];
  total: number;
  radius: number;
};

type Scene = {
  canopies: ScreenEllipse[];
  trunks: ScreenPath[];
  pot: { cx: number; cy: number; rx: number; ry: number };
  rock: { left: number; right: number; y: number };
};

type Hit = {
  kind: 'canopy' | 'trunk' | 'pot' | 'rock';
  index: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
};

// The shapes follow the photographed tree in source-image coordinates. They are
// deliberately split into foliage pads so rain can pass through the open spaces.
const CANOPY_SHAPES: SourceEllipse[] = [
  { cx: 0.607, cy: 0.136, rx: 0.102, ry: 0.083 },
  { cx: 0.706, cy: 0.192, rx: 0.093, ry: 0.062 },
  { cx: 0.556, cy: 0.258, rx: 0.073, ry: 0.052 },
  { cx: 0.756, cy: 0.304, rx: 0.083, ry: 0.052 },
  { cx: 0.511, cy: 0.371, rx: 0.105, ry: 0.064 },
  { cx: 0.617, cy: 0.489, rx: 0.112, ry: 0.074 },
  { cx: 0.540, cy: 0.615, rx: 0.090, ry: 0.057 },
  { cx: 0.425, cy: 0.674, rx: 0.107, ry: 0.078 },
];

const TRUNK_PATHS: Point[][] = [
  [
    { x: 0.638, y: 0.185 },
    { x: 0.650, y: 0.273 },
    { x: 0.690, y: 0.350 },
    { x: 0.716, y: 0.430 },
    { x: 0.688, y: 0.520 },
    { x: 0.708, y: 0.620 },
    { x: 0.731, y: 0.723 },
    { x: 0.761, y: 0.817 },
  ],
  [
    { x: 0.646, y: 0.292 },
    { x: 0.622, y: 0.392 },
    { x: 0.660, y: 0.474 },
    { x: 0.648, y: 0.575 },
    { x: 0.682, y: 0.686 },
    { x: 0.674, y: 0.802 },
  ],
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const random = (min: number, max: number) => Math.random() * (max - min) + min;

function makePath(points: Point[], radius: number): ScreenPath {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  return { points, cumulative, total: cumulative[cumulative.length - 1], radius };
}

function pointOnPath(path: ScreenPath, distance: number): Point & { tx: number; ty: number } {
  const target = clamp(distance, 0, path.total);
  let segment = 1;
  while (segment < path.cumulative.length - 1 && path.cumulative[segment] < target) segment += 1;

  const start = path.points[segment - 1];
  const end = path.points[segment];
  const segmentLength = path.cumulative[segment] - path.cumulative[segment - 1] || 1;
  const amount = clamp((target - path.cumulative[segment - 1]) / segmentLength, 0, 1);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: start.x + dx * amount,
    y: start.y + dy * amount,
    tx: dx / length,
    ty: dy / length,
  };
}

function nearestPointOnPath(path: ScreenPath, x: number, y: number) {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let pathDistance = 0;
  let nearestX = x;
  let nearestY = y;
  let normalX = 0;
  let normalY = -1;

  for (let index = 1; index < path.points.length; index += 1) {
    const start = path.points[index - 1];
    const end = path.points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const amount = clamp(((x - start.x) * dx + (y - start.y) * dy) / lengthSquared, 0, 1);
    const px = start.x + dx * amount;
    const py = start.y + dy * amount;
    const distance = Math.hypot(x - px, y - py);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      pathDistance = path.cumulative[index - 1] + Math.sqrt(lengthSquared) * amount;
      nearestX = px;
      nearestY = py;
      if (distance > 0.01) {
        normalX = (x - px) / distance;
        normalY = (y - py) / distance;
      } else {
        const length = Math.sqrt(lengthSquared);
        normalX = -dy / length;
        normalY = dx / length;
      }
    }
  }

  return { distance: nearestDistance, pathDistance, x: nearestX, y: nearestY, nx: normalX, ny: normalY };
}

function buildScene(width: number, height: number): Scene {
  const scale = Math.max(width / IMAGE_WIDTH, height / IMAGE_HEIGHT);
  const renderedWidth = IMAGE_WIDTH * scale;
  const renderedHeight = IMAGE_HEIGHT * scale;
  const positionX = width < 768 ? 0.67 : 0.62;
  const offsetX = (width - renderedWidth) * positionX;
  const offsetY = (height - renderedHeight) * 0.5;
  const mapPoint = (point: Point): Point => ({
    x: offsetX + point.x * renderedWidth,
    y: offsetY + point.y * renderedHeight,
  });

  const canopies = CANOPY_SHAPES.map((shape) => ({
    cx: offsetX + shape.cx * renderedWidth,
    cy: offsetY + shape.cy * renderedHeight,
    rx: shape.rx * renderedWidth,
    ry: shape.ry * renderedHeight,
  }));

  const trunks = TRUNK_PATHS.map((path, index) => makePath(path.map(mapPoint), renderedWidth * (index === 0 ? 0.017 : 0.011)));

  return {
    canopies,
    trunks,
    pot: {
      cx: offsetX + renderedWidth * 0.704,
      cy: offsetY + renderedHeight * 0.842,
      rx: renderedWidth * 0.174,
      ry: renderedHeight * 0.026,
    },
    rock: {
      left: offsetX + renderedWidth * 0.405,
      right: offsetX + renderedWidth * 0.955,
      y: offsetY + renderedHeight * 0.932,
    },
  };
}

function classifyPoint(scene: Scene, x: number, y: number): Hit | null {
  for (let index = 0; index < scene.canopies.length; index += 1) {
    const ellipse = scene.canopies[index];
    const ex = (x - ellipse.cx) / ellipse.rx;
    const ey = (y - ellipse.cy) / ellipse.ry;
    if (ex * ex + ey * ey <= 1) {
      const rawNx = (x - ellipse.cx) / (ellipse.rx * ellipse.rx);
      const rawNy = (y - ellipse.cy) / (ellipse.ry * ellipse.ry);
      const normalLength = Math.hypot(rawNx, rawNy) || 1;
      return { kind: 'canopy', index, x, y, nx: rawNx / normalLength, ny: rawNy / normalLength };
    }
  }

  for (let index = 0; index < scene.trunks.length; index += 1) {
    const nearest = nearestPointOnPath(scene.trunks[index], x, y);
    if (nearest.distance <= scene.trunks[index].radius) {
      return { kind: 'trunk', index, x, y, nx: nearest.nx, ny: nearest.ny };
    }
  }

  const potX = (x - scene.pot.cx) / scene.pot.rx;
  if (Math.abs(potX) <= 1) {
    const surfaceY = scene.pot.cy - scene.pot.ry * Math.sqrt(1 - potX * potX);
    if (y >= surfaceY && y <= surfaceY + 9) return { kind: 'pot', index: 0, x, y: surfaceY, nx: 0, ny: -1 };
  }

  if (x >= scene.rock.left && x <= scene.rock.right && y >= scene.rock.y) {
    return { kind: 'rock', index: 0, x, y: scene.rock.y, nx: 0, ny: -1 };
  }

  return null;
}

function sweptCollision(scene: Scene, fromX: number, fromY: number, toX: number, toY: number): Hit | null {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const steps = Math.max(1, Math.ceil(distance / 7));
  for (let step = 1; step <= steps; step += 1) {
    const amount = step / steps;
    const hit = classifyPoint(scene, fromX + (toX - fromX) * amount, fromY + (toY - fromY) * amount);
    if (hit) return hit;
  }
  return null;
}

export function RainLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const rain: RainDrop[] = [];
    const canopyBeads: CanopyBead[] = [];
    const trunkBeads: TrunkBead[] = [];
    const freeBeads: FreeBead[] = [];
    const splashes: Splash[] = [];
    const ripples: Ripple[] = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 1;
    let height = 1;
    let scene = buildScene(width, height);
    let frameId = 0;
    let lastTime = performance.now();
    let visible = true;
    let runoff = 0;

    const resetRainDrop = (drop: RainDrop, initial = false) => {
      const roll = Math.random();
      const bucket: 0 | 1 | 2 = roll < 0.43 ? 0 : roll < 0.88 ? 1 : 2;
      const speedRanges = [random(470, 650), random(720, 980), random(1050, 1420)];
      const depth = [0.45, 0.76, 1.08][bucket];
      drop.bucket = bucket;
      drop.x = random(-80, width + 40);
      drop.y = initial ? random(-height * 0.1, height) : random(-height * 0.32, -20);
      drop.vx = random(20, 45) * depth;
      drop.vy = speedRanges[bucket];
      drop.length = bucket === 0 ? random(8, 17) : bucket === 1 ? random(18, 32) : random(34, 62);
      drop.active = true;
    };

    const createSplash = (hit: Hit, energy: number) => {
      const particleCount = hit.kind === 'canopy' ? 2 : hit.kind === 'trunk' ? 1 : 3;
      for (let index = 0; index < particleCount && splashes.length < MAX_SPLASHES; index += 1) {
        const lateral = random(-75, 75) * energy;
        splashes.push({
          x: hit.x,
          y: hit.y,
          vx: lateral + hit.nx * random(18, 55),
          vy: random(-115, -38) * energy + hit.ny * random(12, 42),
          size: random(0.65, 1.65) * energy,
          age: 0,
          life: random(0.22, 0.48),
        });
      }
    };

    const createCanopyBead = (hit: Hit, bucket: number) => {
      if (canopyBeads.length >= MAX_SURFACE_BEADS) return;
      const ellipse = scene.canopies[hit.index];
      const offset = clamp((hit.x - ellipse.cx) / ellipse.rx, -0.97, 0.97);
      const side: -1 | 1 = Math.abs(offset) < 0.08 ? (Math.random() < 0.5 ? -1 : 1) : offset < 0 ? -1 : 1;
      const angle = Math.asin(Math.abs(offset));
      canopyBeads.push({
        ellipseIndex: hit.index,
        side,
        angle,
        speed: random(0.04, 0.12),
        size: random(1.25, 2.15) + bucket * 0.42,
        hold: random(0.08, 0.72),
        detachAt: random(Math.min(Math.max(angle + 0.24, 0.88), 1.42), 1.48),
        phase: random(0, Math.PI * 2),
      });
    };

    const createTrunkBead = (pathIndex: number, x: number, y: number, size = random(1.8, 3.1)) => {
      if (trunkBeads.length >= MAX_SURFACE_BEADS) return;
      const nearest = nearestPointOnPath(scene.trunks[pathIndex], x, y);
      trunkBeads.push({
        pathIndex,
        distance: nearest.pathDistance,
        speed: random(10, 22),
        size,
        hold: random(0.05, 0.5),
      });
    };

    const createFreeBead = (x: number, y: number, vx: number, vy: number, size: number) => {
      if (freeBeads.length >= MAX_FREE_BEADS) return;
      freeBeads.push({ x, y, vx, vy, size, life: random(1.4, 2.5) });
    };

    const handleImpact = (hit: Hit, drop: RainDrop) => {
      const energy = 0.65 + drop.bucket * 0.24;
      if (drop.bucket > 0 || Math.random() < 0.3) createSplash(hit, energy);

      if (hit.kind === 'canopy') {
        runoff += 0.11 + drop.bucket * 0.08;
        if (Math.random() < 0.18 + drop.bucket * 0.08) createCanopyBead(hit, drop.bucket);
      } else if (hit.kind === 'trunk') {
        if (Math.random() < 0.55) createTrunkBead(hit.index, hit.x, hit.y, random(1.6, 2.5) + drop.bucket * 0.3);
      } else if (Math.random() < 0.52 && ripples.length < 22) {
        ripples.push({ x: hit.x, y: hit.y + 1, radius: random(1, 2.5), age: 0, life: random(0.4, 0.8) });
      }
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      scene = buildScene(width, height);

      const targetCount = reducedMotion.matches ? 46 : Math.round(clamp((width * height) / 5600, 135, 380));
      rain.length = 0;
      for (let index = 0; index < targetCount; index += 1) {
        const drop = {} as RainDrop;
        resetRainDrop(drop, true);
        rain.push(drop);
      }
      canopyBeads.length = 0;
      trunkBeads.length = 0;
      freeBeads.length = 0;
      splashes.length = 0;
      ripples.length = 0;
    };

    const updateRain = (dt: number, time: number) => {
      const wind = width * 0.018 + Math.sin(time * 0.00033) * 22 + Math.sin(time * 0.00091) * 8;

      for (const drop of rain) {
        if (!drop.active) {
          resetRainDrop(drop);
          continue;
        }

        const oldX = drop.x;
        const oldY = drop.y;
        const depth = drop.bucket === 0 ? 0.42 : drop.bucket === 1 ? 0.76 : 1.08;
        drop.vx += (wind * depth - drop.vx) * dt * 0.72;
        const nextX = drop.x + drop.vx * dt;
        const nextY = drop.y + drop.vy * dt;

        // Distant rain remains behind the tree; mid and near layers strike it.
        const hit = drop.bucket === 0 ? null : sweptCollision(scene, oldX, oldY, nextX, nextY);
        if (hit) {
          drop.x = hit.x;
          drop.y = hit.y;
          drop.active = false;
          handleImpact(hit, drop);
        } else {
          drop.x = nextX;
          drop.y = nextY;
          if (drop.y > height + drop.length || drop.x > width + 90) resetRainDrop(drop);
        }
      }
    };

    const updateSurfaceWater = (dt: number) => {
      for (let index = canopyBeads.length - 1; index >= 0; index -= 1) {
        const bead = canopyBeads[index];
        const ellipse = scene.canopies[bead.ellipseIndex];
        bead.phase += dt * 3.2;
        if (bead.hold > 0) {
          bead.hold -= dt;
          continue;
        }

        bead.speed += (0.16 + Math.sin(bead.angle) * 1.95) * dt * (0.82 + bead.size * 0.12);
        bead.speed *= Math.pow(0.986, dt * 60);
        bead.angle += bead.speed * dt;

        if (bead.angle >= bead.detachAt) {
          const x = ellipse.cx + bead.side * ellipse.rx * Math.sin(bead.angle);
          const y = ellipse.cy - ellipse.ry * Math.cos(bead.angle);
          createFreeBead(x, y, bead.side * random(9, 34), random(38, 78), bead.size * 1.06);
          canopyBeads.splice(index, 1);
        }
      }

      if (runoff >= 2.25 && trunkBeads.length < MAX_SURFACE_BEADS) {
        const pathIndex = Math.random() < 0.76 ? 0 : 1;
        const path = scene.trunks[pathIndex];
        const startDistance = path.total * random(0.02, 0.2);
        const start = pointOnPath(path, startDistance);
        trunkBeads.push({ pathIndex, distance: startDistance, speed: random(8, 17), size: random(2.2, 3.5), hold: random(0.1, 0.65) });
        runoff -= 2.25;
      }

      for (let index = trunkBeads.length - 1; index >= 0; index -= 1) {
        const bead = trunkBeads[index];
        const path = scene.trunks[bead.pathIndex];
        if (bead.hold > 0) {
          bead.hold -= dt;
          continue;
        }
        const position = pointOnPath(path, bead.distance);
        bead.speed += (32 + 280 * Math.max(0.08, position.ty)) * dt;
        bead.speed *= Math.pow(0.982, dt * 60);
        bead.distance += bead.speed * dt;

        if (bead.distance >= path.total) {
          const end = pointOnPath(path, path.total);
          createFreeBead(end.x, end.y, end.tx * bead.speed * 0.24, Math.max(72, end.ty * bead.speed), bead.size * 1.08);
          trunkBeads.splice(index, 1);
        }
      }

      for (let left = trunkBeads.length - 1; left >= 0; left -= 1) {
        for (let right = left - 1; right >= 0; right -= 1) {
          const a = trunkBeads[left];
          const b = trunkBeads[right];
          if (a.pathIndex === b.pathIndex && Math.abs(a.distance - b.distance) < (a.size + b.size) * 1.2) {
            a.size = Math.min(5.2, Math.sqrt(a.size * a.size + b.size * b.size));
            a.speed = Math.max(a.speed, b.speed) * 1.05;
            trunkBeads.splice(right, 1);
            left -= 1;
            break;
          }
        }
      }
    };

    const updateSecondaryParticles = (dt: number) => {
      for (let index = freeBeads.length - 1; index >= 0; index -= 1) {
        const bead = freeBeads[index];
        const oldX = bead.x;
        const oldY = bead.y;
        bead.vy += 820 * dt;
        bead.vx += width * 0.0018 * dt;
        bead.x += bead.vx * dt;
        bead.y += bead.vy * dt;
        bead.life -= dt;
        const hit = sweptCollision(scene, oldX, oldY, bead.x, bead.y);
        if (hit && (hit.kind === 'pot' || hit.kind === 'rock')) {
          createSplash(hit, 0.8 + bead.size * 0.08);
          if (ripples.length < 22) ripples.push({ x: hit.x, y: hit.y, radius: 1, age: 0, life: random(0.45, 0.75) });
          freeBeads.splice(index, 1);
        } else if (bead.life <= 0 || bead.y > height + 20) {
          freeBeads.splice(index, 1);
        }
      }

      for (let index = splashes.length - 1; index >= 0; index -= 1) {
        const splash = splashes[index];
        splash.age += dt;
        splash.vy += 620 * dt;
        splash.x += splash.vx * dt;
        splash.y += splash.vy * dt;
        if (splash.age >= splash.life) splashes.splice(index, 1);
      }

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        ripple.age += dt;
        ripple.radius += 34 * dt;
        if (ripple.age >= ripple.life) ripples.splice(index, 1);
      }
    };

    const drawRain = () => {
      const colors = ['rgba(181, 213, 231, .42)', 'rgba(194, 226, 244, .66)', 'rgba(221, 241, 252, .84)'];
      const widths = [0.55, 0.9, 1.35];

      for (let bucket = 0; bucket < 3; bucket += 1) {
        context.save();
        context.beginPath();
        context.strokeStyle = colors[bucket];
        context.lineWidth = widths[bucket];
        context.globalAlpha = bucket === 0 ? 0.72 : 0.9;
        if (bucket === 2) {
          context.shadowBlur = 5;
          context.shadowColor = 'rgba(188, 228, 250, .42)';
        }
        for (const drop of rain) {
          if (drop.bucket !== bucket) continue;
          const ratio = drop.vx / drop.vy;
          context.moveTo(drop.x - ratio * drop.length, drop.y - drop.length);
          context.lineTo(drop.x, drop.y);
        }
        context.stroke();
        context.restore();
      }
    };

    const drawCanopyBeads = () => {
      for (const bead of canopyBeads) {
        const ellipse = scene.canopies[bead.ellipseIndex];
        const wobble = Math.sin(bead.phase) * 0.7;
        const x = ellipse.cx + bead.side * ellipse.rx * Math.sin(bead.angle) + wobble * bead.side;
        const y = ellipse.cy - ellipse.ry * Math.cos(bead.angle);
        const previousAngle = Math.max(0, bead.angle - 0.035 - bead.speed * 0.015);
        const tailX = ellipse.cx + bead.side * ellipse.rx * Math.sin(previousAngle);
        const tailY = ellipse.cy - ellipse.ry * Math.cos(previousAngle);

        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(x, y);
        context.strokeStyle = 'rgba(181, 224, 246, .58)';
        context.lineWidth = Math.max(0.8, bead.size * 0.55);
        context.stroke();
        context.beginPath();
        context.ellipse(x, y, bead.size * 0.62, bead.size, bead.side * 0.12, 0, Math.PI * 2);
        context.fillStyle = 'rgba(218, 241, 251, .74)';
        context.shadowBlur = 4;
        context.shadowColor = 'rgba(180, 225, 248, .65)';
        context.fill();
        context.shadowBlur = 0;
      }
    };

    const drawTrunkBeads = () => {
      for (const bead of trunkBeads) {
        const path = scene.trunks[bead.pathIndex];
        const position = pointOnPath(path, bead.distance);
        const tail = pointOnPath(path, Math.max(0, bead.distance - 5 - bead.speed * 0.045));
        context.beginPath();
        context.moveTo(tail.x, tail.y);
        context.lineTo(position.x, position.y);
        context.strokeStyle = 'rgba(169, 218, 241, .56)';
        context.lineWidth = Math.max(1, bead.size * 0.58);
        context.stroke();
        context.beginPath();
        context.ellipse(position.x, position.y, bead.size * 0.62, bead.size, -position.tx * 0.22, 0, Math.PI * 2);
        context.fillStyle = 'rgba(226, 245, 252, .8)';
        context.shadowBlur = 5;
        context.shadowColor = 'rgba(177, 222, 242, .7)';
        context.fill();
        context.shadowBlur = 0;
      }
    };

    const drawSecondaryParticles = () => {
      for (const bead of freeBeads) {
        const stretch = clamp(bead.vy / 260, 1, 2.8);
        context.beginPath();
        context.ellipse(bead.x, bead.y, bead.size * 0.55, bead.size * stretch, 0, 0, Math.PI * 2);
        context.fillStyle = 'rgba(219, 241, 251, .76)';
        context.fill();
      }

      for (const splash of splashes) {
        const alpha = 1 - splash.age / splash.life;
        context.beginPath();
        context.moveTo(splash.x, splash.y);
        context.lineTo(splash.x - splash.vx * 0.018, splash.y - splash.vy * 0.018);
        context.globalAlpha = alpha;
        context.strokeStyle = 'rgba(213, 239, 251, .8)';
        context.lineWidth = Math.max(0.65, splash.size * 0.72);
        context.stroke();
      }
      context.globalAlpha = 1;

      for (const ripple of ripples) {
        const alpha = 1 - ripple.age / ripple.life;
        context.beginPath();
        context.ellipse(ripple.x, ripple.y, ripple.radius, ripple.radius * 0.22, 0, 0, Math.PI * 2);
        context.strokeStyle = `rgba(201, 233, 247, ${alpha * 0.46})`;
        context.lineWidth = 0.75;
        context.stroke();
      }
    };

    const render = () => {
      context.clearRect(0, 0, width, height);
      drawRain();
      drawCanopyBeads();
      drawTrunkBeads();
      drawSecondaryParticles();
    };

    const frame = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;
      updateRain(dt, time);
      updateSurfaceWater(dt);
      updateSecondaryParticles(dt);
      render();
      frameId = window.requestAnimationFrame(frame);
    };

    const syncAnimation = () => {
      const shouldRun = visible && !document.hidden && !reducedMotion.matches;
      if (shouldRun && frameId === 0) {
        lastTime = performance.now();
        frameId = window.requestAnimationFrame(frame);
      } else if (!shouldRun && frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        render();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      render();
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncAnimation();
    }, { threshold: 0.01 });
    const onVisibilityChange = () => syncAnimation();
    const onMotionChange = () => {
      resize();
      syncAnimation();
    };

    resize();
    render();
    resizeObserver.observe(host);
    intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', onMotionChange);
    syncAnimation();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="rain-layer pointer-events-none absolute inset-0 z-[36]" aria-hidden="true" />;
}

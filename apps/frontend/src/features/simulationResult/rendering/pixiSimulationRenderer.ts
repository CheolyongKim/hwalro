import {
  Application,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  type Texture,
} from 'pixi.js';
import type {
  Bounds,
  DetectedBottleneck,
  HeatmapData,
  RiskZone,
  SimulationResultViewModel,
} from '../types';
import { interpolatePositions, selectFramePair } from '../utils/playback';

export interface PixiCameraTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PixiSimulationScene {
  app: Application;
  world: Container;
  heatmapLayer: Graphics;
  bottleneckLayer: Graphics;
  riskLayer: Graphics;
  agentLayer: ParticleContainer<Particle>;
  particles: Particle[];
  interpolationBuffer: Float32Array;
  agentTexture: Texture;
  lastHeatmapTime: number | null;
}

export function createCameraTransform(
  width: number,
  height: number,
  worldWidth: number,
  worldHeight: number,
  zoom: number,
  panX: number,
  panY: number,
): PixiCameraTransform {
  const padding = 34;
  const fitScale = Math.max(
    0.1,
    Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight),
  );
  return {
    scale: fitScale * zoom,
    offsetX: (width - worldWidth * fitScale) / 2 + panX,
    offsetY: (height - worldHeight * fitScale) / 2 + panY,
  };
}

export function pixiScreenToWorld(x: number, y: number, transform: PixiCameraTransform) {
  return {
    x: (x - transform.offsetX) / transform.scale,
    y: (y - transform.offsetY) / transform.scale,
  };
}

function drawFloorPlan(result: SimulationResultViewModel) {
  const { drawing } = result;
  const floor = new Graphics();
  floor.rect(0, 0, drawing.width, drawing.height).fill({ color: 0xf9fbfa });
  for (const wall of drawing.walls) {
    floor
      .moveTo(wall.startX, wall.startY)
      .lineTo(wall.endX, wall.endY)
      .stroke({ color: 0x214b45, width: 0.55, cap: 'round' });
  }
  for (const exit of drawing.exits) {
    floor
      .moveTo(exit.startX, exit.startY)
      .lineTo(exit.endX, exit.endY)
      .stroke({ color: 0x16a394, width: 1.5, cap: 'round' });
  }
  return floor;
}

function createAgentTexture(app: Application) {
  const source = new Graphics().circle(8, 8, 7).fill({ color: 0x0e9182 });
  const texture = app.renderer.generateTexture(source);
  source.destroy();
  return texture;
}

export async function createPixiSimulationScene(
  host: HTMLDivElement,
  result: SimulationResultViewModel,
): Promise<PixiSimulationScene> {
  const app = new Application();
  await app.init({
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    preference: 'webgl',
    autoStart: false,
  });
  app.canvas.className = 'simulation-pixi-canvas';
  app.canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(app.canvas);

  const world = new Container();
  const heatmapLayer = new Graphics();
  const bottleneckLayer = new Graphics();
  const riskLayer = new Graphics();
  const agentTexture = createAgentTexture(app);
  const particles = Array.from(
    { length: result.totalPeople },
    () =>
      new Particle({
        texture: agentTexture,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: 0.052,
        scaleY: 0.052,
        x: -10_000,
        y: -10_000,
      }),
  );
  const agentLayer = new ParticleContainer<Particle>({
    texture: agentTexture,
    particles,
    boundsArea: new Rectangle(0, 0, result.drawing.width, result.drawing.height),
    dynamicProperties: {
      position: true,
      rotation: false,
      vertex: false,
      color: false,
    },
  });
  agentLayer.update();
  world.addChild(drawFloorPlan(result), heatmapLayer, bottleneckLayer, agentLayer, riskLayer);
  app.stage.addChild(world);

  return {
    app,
    world,
    heatmapLayer,
    bottleneckLayer,
    riskLayer,
    agentLayer,
    particles,
    interpolationBuffer: new Float32Array(result.totalPeople * 2),
    agentTexture,
    lastHeatmapTime: null,
  };
}

function heatColor(density: number, maxDensity: number) {
  const ratio = Math.min(1, density / maxDensity);
  const red = Math.round(255 * Math.min(1, ratio * 1.7));
  const green = Math.round(205 * (1 - ratio * 0.72));
  const blue = Math.round(52 * (1 - ratio));
  return (red << 16) | (green << 8) | blue;
}

function updateHeatmap(layer: Graphics, heatmap: HeatmapData, timeSeconds: number) {
  const frame = selectFramePair(heatmap.frames, timeSeconds).previous;
  layer.clear();
  for (let row = 0; row < heatmap.rows; row += 1) {
    for (let column = 0; column < heatmap.columns; column += 1) {
      const density = frame.values[row * heatmap.columns + column];
      if (density < 0.16) continue;
      const ratio = Math.min(1, density / heatmap.maxDensity);
      layer
        .rect(
          column * heatmap.cellWidth,
          row * heatmap.cellHeight,
          heatmap.cellWidth + 0.05,
          heatmap.cellHeight + 0.05,
        )
        .fill({ color: heatColor(density, heatmap.maxDensity), alpha: 0.08 + ratio * 0.42 });
    }
  }
  return frame.timeSeconds;
}

function drawBounds(
  layer: Graphics,
  bounds: Bounds,
  strokeColor: number,
  fillColor: number,
  fillAlpha: number,
) {
  layer
    .rect(bounds.x, bounds.y, bounds.width, bounds.height)
    .fill({ color: fillColor, alpha: fillAlpha })
    .stroke({ color: strokeColor, alpha: 0.95, width: 0.5 });
}

function drawDashedLine(
  layer: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  dashLength = 2,
  gapLength = 1.25,
) {
  const length = Math.hypot(endX - startX, endY - startY);
  if (length === 0) return;
  const directionX = (endX - startX) / length;
  const directionY = (endY - startY) / length;
  for (let offset = 0; offset < length; offset += dashLength + gapLength) {
    const dashEnd = Math.min(offset + dashLength, length);
    layer
      .moveTo(startX + directionX * offset, startY + directionY * offset)
      .lineTo(startX + directionX * dashEnd, startY + directionY * dashEnd);
  }
}

function drawDashedBounds(
  layer: Graphics,
  bounds: Bounds,
  strokeColor: number,
  fillColor: number,
  fillAlpha: number,
) {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  layer.rect(bounds.x, bounds.y, bounds.width, bounds.height).fill({
    color: fillColor,
    alpha: fillAlpha,
  });
  drawDashedLine(layer, bounds.x, bounds.y, right, bounds.y);
  drawDashedLine(layer, right, bounds.y, right, bottom);
  drawDashedLine(layer, right, bottom, bounds.x, bottom);
  drawDashedLine(layer, bounds.x, bottom, bounds.x, bounds.y);
  layer.stroke({ color: strokeColor, alpha: 0.82, width: 0.45 });
}

function updateBottlenecks(
  layer: Graphics,
  bottlenecks: DetectedBottleneck[],
  selectedId: number | null,
  timeSeconds: number,
) {
  layer.clear();
  for (const bottleneck of bottlenecks) {
    const active =
      timeSeconds >= bottleneck.startTimeSeconds && timeSeconds <= bottleneck.endTimeSeconds;
    const fillAlpha = active ? 0.11 : 0.035;
    if (bottleneck.id === selectedId) {
      drawBounds(layer, bottleneck.geometry, 0xe44135, 0xef5734, fillAlpha);
    } else {
      drawDashedBounds(layer, bottleneck.geometry, 0xef6b43, 0xef5734, fillAlpha);
    }
  }
}

function updateRiskZones(layer: Graphics, riskZones: RiskZone[], draftZone: Bounds | null) {
  layer.clear();
  for (const zone of riskZones) {
    drawBounds(layer, zone, 0x5c75d9, 0x5c75d9, 0.1);
  }
  if (draftZone) drawBounds(layer, draftZone, 0x5c75d9, 0x5c75d9, 0.08);
}

export function updatePixiSimulationScene(
  scene: PixiSimulationScene,
  result: SimulationResultViewModel,
  currentTimeSeconds: number,
  selectedBottleneckId: number | null,
  showBottlenecks: boolean,
  riskZones: RiskZone[],
  draftZone: Bounds | null,
) {
  const heatmapFrame = selectFramePair(result.heatmap.frames, currentTimeSeconds).previous;
  if (scene.lastHeatmapTime !== heatmapFrame.timeSeconds) {
    scene.lastHeatmapTime = updateHeatmap(
      scene.heatmapLayer,
      result.heatmap,
      currentTimeSeconds,
    );
  }
  const pair = selectFramePair(result.agentFrames, currentTimeSeconds);
  interpolatePositions(
    pair.previous.positions,
    pair.next.positions,
    pair.ratio,
    scene.interpolationBuffer,
  );
  for (let index = 0; index < scene.particles.length; index += 1) {
    const offset = index * 2;
    scene.particles[index].x = scene.interpolationBuffer[offset];
    scene.particles[index].y = scene.interpolationBuffer[offset + 1];
  }
  if (showBottlenecks) {
    updateBottlenecks(
      scene.bottleneckLayer,
      result.bottlenecks,
      selectedBottleneckId,
      currentTimeSeconds,
    );
  } else {
    scene.bottleneckLayer.clear();
  }
  updateRiskZones(scene.riskLayer, riskZones, draftZone);
  scene.app.render();
}

export function applyPixiCamera(scene: PixiSimulationScene, transform: PixiCameraTransform) {
  scene.world.scale.set(transform.scale);
  scene.world.position.set(transform.offsetX, transform.offsetY);
  scene.app.render();
}

export function destroyPixiSimulationScene(scene: PixiSimulationScene) {
  scene.app.destroy({ removeView: true }, { children: true });
  scene.agentTexture.destroy(true);
}

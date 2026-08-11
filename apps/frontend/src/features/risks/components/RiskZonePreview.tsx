import { useEffect, useRef } from 'react';
import type { DrawingSegment, RiskDrawingContext } from '../types/risks';

interface ZoneBounds {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface Props {
  drawing: RiskDrawingContext['drawing'];
  zone: ZoneBounds;
  width?: number;
  height?: number;
}

const PIXEL_RATIO = 2;
const PADDING = 12;

function strokeSegment(
  context: CanvasRenderingContext2D,
  segment: DrawingSegment,
  scale: number,
  offsetX: number,
  offsetY: number,
) {
  context.beginPath();
  context.moveTo(offsetX + segment.startX * scale, offsetY + segment.startY * scale);
  context.lineTo(offsetX + segment.endX * scale, offsetY + segment.endY * scale);
  context.stroke();
}

function fillRotatedRect(
  context: CanvasRenderingContext2D,
  segment: DrawingSegment,
  scale: number,
  offsetX: number,
  offsetY: number,
) {
  const worldX = Math.min(segment.startX, segment.endX);
  const worldY = Math.min(segment.startY, segment.endY);
  const worldWidth = Math.abs(segment.endX - segment.startX);
  const worldHeight = Math.abs(segment.endY - segment.startY);
  const centerX = offsetX + (worldX + worldWidth / 2) * scale;
  const centerY = offsetY + (worldY + worldHeight / 2) * scale;
  const rotation = ((segment.rotation ?? 0) * Math.PI) / 180;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);
  context.fillRect(
    (-worldWidth * scale) / 2,
    (-worldHeight * scale) / 2,
    worldWidth * scale,
    worldHeight * scale,
  );
  context.restore();
}

export function RiskZonePreview({ drawing, zone, width = 240, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = width * PIXEL_RATIO;
    canvas.height = height * PIXEL_RATIO;
    context.scale(PIXEL_RATIO, PIXEL_RATIO);

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const drawingWidth = Math.max(drawing.width, 1);
    const drawingHeight = Math.max(drawing.height, 1);
    const scale = Math.min(
      (width - PADDING * 2) / drawingWidth,
      (height - PADDING * 2) / drawingHeight,
    );
    const offsetX = (width - drawingWidth * scale) / 2;
    const offsetY = (height - drawingHeight * scale) / 2;

    if (drawing.outsideBoundary.length > 0) {
      context.beginPath();
      context.moveTo(
        offsetX + drawing.outsideBoundary[0].x * scale,
        offsetY + drawing.outsideBoundary[0].y * scale,
      );
      for (const point of drawing.outsideBoundary.slice(1)) {
        context.lineTo(offsetX + point.x * scale, offsetY + point.y * scale);
      }
      context.closePath();
      context.fillStyle = 'rgba(226, 232, 230, 0.6)';
      context.fill();
      context.strokeStyle = '#94a3b8';
      context.lineWidth = 1;
      context.stroke();
    }

    context.strokeStyle = '#475569';
    context.lineWidth = 1.5;
    for (const wall of drawing.walls) strokeSegment(context, wall, scale, offsetX, offsetY);

    context.strokeStyle = '#16a34a';
    context.lineWidth = 2;
    for (const exit of drawing.exits) strokeSegment(context, exit, scale, offsetX, offsetY);

    context.fillStyle = 'rgba(148, 163, 184, 0.55)';
    for (const pillar of drawing.pillars) fillRotatedRect(context, pillar, scale, offsetX, offsetY);
    context.fillStyle = 'rgba(203, 213, 225, 0.75)';
    for (const fabric of drawing.fabrics) fillRotatedRect(context, fabric, scale, offsetX, offsetY);

    const zoneX = offsetX + Math.min(zone.startX, zone.endX) * scale;
    const zoneY = offsetY + Math.min(zone.startY, zone.endY) * scale;
    const zoneWidth = Math.abs(zone.endX - zone.startX) * scale;
    const zoneHeight = Math.abs(zone.endY - zone.startY) * scale;
    if (zoneWidth > 0 && zoneHeight > 0) {
      context.fillStyle = 'rgba(225, 29, 72, 0.18)';
      context.fillRect(zoneX, zoneY, zoneWidth, zoneHeight);
      context.strokeStyle = '#e11d48';
      context.lineWidth = 2;
      context.strokeRect(zoneX, zoneY, zoneWidth, zoneHeight);
    }
  }, [drawing, height, width, zone]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="위험 항목이 표시된 시뮬레이션 도면 구역 미리보기"
      style={{ width, height }}
      className="block"
    />
  );
}

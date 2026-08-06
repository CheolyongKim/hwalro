import { memo } from 'react';
import type { BackgroundImage, Fabric, LayoutText, Pillar, Wall } from '../types';
import { rectCenter } from '../utils/geometry';
import { ROTATE_HANDLE_OFFSET_PX, textFontPx, textWorldBox } from '../utils/hitTest';

export const MINOR_STEP = 50;
export const MAJOR_STEP = 250;

export const BackgroundLayer = memo(function BackgroundLayer({ bg }: { bg: BackgroundImage }) {
  return (
    <image
      href={bg.image}
      x={bg.x}
      y={bg.y}
      width={bg.width}
      height={bg.height}
      opacity={bg.opacity}
      preserveAspectRatio="none"
    />
  );
});

interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface GridLayerProps {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  zoom: number;
}

export const GridLayer = memo(function GridLayer({ minX, minY, maxX, maxY, zoom }: GridLayerProps) {
  const minor: GridLine[] = [];
  if (MINOR_STEP * zoom >= 6) {
    for (let x = Math.floor(minX / MINOR_STEP) * MINOR_STEP; x <= maxX; x += MINOR_STEP) {
      minor.push({ x1: x, y1: minY, x2: x, y2: maxY });
    }
    for (let y = Math.floor(minY / MINOR_STEP) * MINOR_STEP; y <= maxY; y += MINOR_STEP) {
      minor.push({ x1: minX, y1: y, x2: maxX, y2: y });
    }
  }
  const major: GridLine[] = [];
  for (let x = Math.floor(minX / MAJOR_STEP) * MAJOR_STEP; x <= maxX; x += MAJOR_STEP) {
    major.push({ x1: x, y1: minY, x2: x, y2: maxY });
  }
  for (let y = Math.floor(minY / MAJOR_STEP) * MAJOR_STEP; y <= maxY; y += MAJOR_STEP) {
    major.push({ x1: minX, y1: y, x2: maxX, y2: y });
  }
  return (
    <g>
      {minor.map((line, i) => (
        <line
          key={`m${i}`}
          {...line}
          stroke="var(--layout-grid-minor)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {major.map((line, i) => (
        <line
          key={`M${i}`}
          {...line}
          stroke="var(--layout-grid-major)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
});

interface WallViewProps {
  wall: Wall;
  selected: boolean;
  s: (px: number) => number;
}

export const WallView = memo(function WallView({ wall, selected, s }: WallViewProps) {
  const color = selected ? 'var(--layout-accent)' : 'var(--layout-ink)';
  return (
    <g>
      <line
        x1={wall.startX}
        y1={wall.startY}
        x2={wall.endX}
        y2={wall.endY}
        stroke={color}
        strokeWidth={selected ? 2.5 : 2}
        vectorEffect="non-scaling-stroke"
      />
      {selected && (
        <g>
          <circle
            cx={wall.startX}
            cy={wall.startY}
            r={s(5)}
            fill="var(--layout-canvas)"
            stroke="var(--layout-accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={wall.endX}
            cy={wall.endY}
            r={s(5)}
            fill="var(--layout-canvas)"
            stroke="var(--layout-accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={wall.startX} cy={wall.startY} r={s(3)} fill="var(--layout-accent)" />
          <circle cx={wall.endX} cy={wall.endY} r={s(3)} fill="var(--layout-accent)" />
        </g>
      )}
    </g>
  );
});

interface RectViewProps {
  selected: boolean;
  s: (px: number) => number;
  fill: string;
  stroke: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  rotation: number;
}

function RectShape({
  selected,
  s,
  fill,
  stroke,
  startX,
  startY,
  endX,
  endY,
  rotation,
}: RectViewProps) {
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const center = rectCenter({ startX, startY, endX, endY });
  return (
    <g transform={`rotate(${rotation} ${center.x} ${center.y})`}>
      <rect
        x={minX}
        y={minY}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
      {selected && (
        <g>
          <circle
            cx={startX}
            cy={startY}
            r={s(5)}
            fill="var(--layout-canvas)"
            stroke="var(--layout-accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={endX}
            cy={endY}
            r={s(5)}
            fill="var(--layout-canvas)"
            stroke="var(--layout-accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={startX} cy={startY} r={s(3)} fill="var(--layout-accent)" />
          <circle cx={endX} cy={endY} r={s(3)} fill="var(--layout-accent)" />
          <circle
            cx={center.x}
            cy={minY - s(ROTATE_HANDLE_OFFSET_PX)}
            r={s(5)}
            fill="var(--layout-canvas)"
            stroke="var(--layout-accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </g>
  );
}

interface PillarViewProps {
  pillar: Pillar;
  selected: boolean;
  s: (px: number) => number;
}

export const PillarView = memo(function PillarView({ pillar, selected, s }: PillarViewProps) {
  return (
    <RectShape
      selected={selected}
      s={s}
      fill="var(--layout-pillar-fill)"
      stroke={selected ? 'var(--layout-accent)' : 'var(--layout-pillar-stroke)'}
      startX={pillar.startX}
      startY={pillar.startY}
      endX={pillar.endX}
      endY={pillar.endY}
      rotation={pillar.rotation}
    />
  );
});

interface FabricViewProps {
  fabric: Fabric;
  selected: boolean;
  s: (px: number) => number;
}

export const FabricView = memo(function FabricView({ fabric, selected, s }: FabricViewProps) {
  return (
    <RectShape
      selected={selected}
      s={s}
      fill={selected ? 'var(--layout-fabric-selected-fill)' : 'var(--layout-fabric-fill)'}
      stroke={selected ? 'var(--layout-accent)' : 'var(--layout-fabric-stroke)'}
      startX={fabric.startX}
      startY={fabric.startY}
      endX={fabric.endX}
      endY={fabric.endY}
      rotation={fabric.rotation}
    />
  );
});

interface TextViewProps {
  text: LayoutText;
  selected: boolean;
  zoom: number;
}

export const TextView = memo(function TextView({ text, selected, zoom }: TextViewProps) {
  const fontPx = textFontPx(zoom);
  const box = textWorldBox(text, zoom);
  return (
    <g>
      {selected && (
        <rect
          x={box.x - fontPx / zoom / 4}
          y={box.y - fontPx / zoom / 4}
          width={box.w + fontPx / zoom / 2}
          height={box.h + fontPx / zoom / 2}
          fill="var(--layout-accent)"
          fillOpacity={0.08}
          stroke="var(--layout-accent)"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <text
        x={text.x}
        y={text.y}
        fontSize={fontPx}
        fontFamily="var(--layout-ui)"
        dominantBaseline="hanging"
        fill={selected ? 'var(--layout-accent)' : 'var(--layout-ink)'}
      >
        {text.text}
      </text>
    </g>
  );
});

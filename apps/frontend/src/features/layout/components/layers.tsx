import { memo, useEffect, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Line, Rect, Text as KonvaText } from 'react-konva';
import type { BackgroundImage, Exit, Fabric, LayoutText, Pillar, Wall } from '../types';
import { PX_PER_METER, rectCenter } from '../utils/geometry';
import { ROTATE_HANDLE_OFFSET_PX, TEXT_FONT_PX, textWorldBox } from '../utils/hitTest';
import { ACCENT_ALPHA_8, CANVAS_COLORS, FONT_UI } from '../utils/colors';

export const MINOR_STEP = 50;
export const MAJOR_STEP = 250;

const imageCache = new Map<string, HTMLImageElement>();

function useImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(() => imageCache.get(src) ?? null);

  useEffect(() => {
    const cached = imageCache.get(src);
    if (cached) {
      setImage(cached);
      return;
    }
    const el = new window.Image();
    el.onload = () => {
      imageCache.set(src, el);
      setImage(el);
    };
    el.src = src;
  }, [src]);

  return image;
}

export const BackgroundLayer = memo(function BackgroundLayer({ bg }: { bg: BackgroundImage }) {
  const image = useImage(bg.image);
  if (image === null) {
    return null;
  }
  return (
    <KonvaImage
      image={image}
      x={bg.x}
      y={bg.y}
      width={bg.width}
      height={bg.height}
      opacity={bg.opacity}
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
  const strokeWidth = 1 / (zoom * PX_PER_METER);
  const minor: GridLine[] = [];
  if (MINOR_STEP * zoom * PX_PER_METER >= 6) {
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
    <>
      {minor.map((line, i) => (
        <Line
          key={`m${i}`}
          points={[line.x1, line.y1, line.x2, line.y2]}
          stroke={CANVAS_COLORS.gridMinor}
          strokeWidth={strokeWidth}
        />
      ))}
      {major.map((line, i) => (
        <Line
          key={`M${i}`}
          points={[line.x1, line.y1, line.x2, line.y2]}
          stroke={CANVAS_COLORS.gridMajor}
          strokeWidth={strokeWidth}
        />
      ))}
    </>
  );
});

interface WallViewProps {
  wall: Wall;
  selected: boolean;
  s: (px: number) => number;
}

export const WallView = memo(function WallView({ wall, selected, s }: WallViewProps) {
  const color = selected ? CANVAS_COLORS.accent : CANVAS_COLORS.ink;
  return (
    <Group>
      <Line
        points={[wall.startX, wall.startY, wall.endX, wall.endY]}
        stroke={color}
        strokeWidth={selected ? s(2.5) : s(2)}
      />
      {selected && (
        <Group>
          <Circle
            x={wall.startX}
            y={wall.startY}
            radius={s(5)}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.accent}
            strokeWidth={s(1.5)}
          />
          <Circle
            x={wall.endX}
            y={wall.endY}
            radius={s(5)}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.accent}
            strokeWidth={s(1.5)}
          />
          <Circle x={wall.startX} y={wall.startY} radius={s(3)} fill={CANVAS_COLORS.accent} />
          <Circle x={wall.endX} y={wall.endY} radius={s(3)} fill={CANVAS_COLORS.accent} />
        </Group>
      )}
    </Group>
  );
});

interface ExitViewProps {
  exit: Exit;
  selected: boolean;
  s: (px: number) => number;
}

export const ExitView = memo(function ExitView({ exit, selected, s }: ExitViewProps) {
  const color = selected ? CANVAS_COLORS.exitStrong : CANVAS_COLORS.exit;
  return (
    <Group>
      <Line
        points={[exit.startX, exit.startY, exit.endX, exit.endY]}
        stroke={color}
        strokeWidth={selected ? s(3) : s(2.5)}
      />
      {selected && (
        <Group>
          <Circle
            x={exit.startX}
            y={exit.startY}
            radius={s(5)}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.exitStrong}
            strokeWidth={s(1.5)}
          />
          <Circle
            x={exit.endX}
            y={exit.endY}
            radius={s(5)}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.exitStrong}
            strokeWidth={s(1.5)}
          />
          <Circle x={exit.startX} y={exit.startY} radius={s(3)} fill={CANVAS_COLORS.exitStrong} />
          <Circle x={exit.endX} y={exit.endY} radius={s(3)} fill={CANVAS_COLORS.exitStrong} />
        </Group>
      )}
    </Group>
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
    <Group x={center.x} y={center.y} rotation={rotation}>
      <Rect
        x={minX - center.x}
        y={minY - center.y}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? s(2) : s(1)}
      />
      {selected && (
        <Group>
          <Circle
            x={startX - center.x}
            y={startY - center.y}
            radius={s(5)}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.accent}
            strokeWidth={s(1.5)}
          />
          <Circle
            x={endX - center.x}
            y={endY - center.y}
            radius={s(5)}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.accent}
            strokeWidth={s(1.5)}
          />
          <Circle
            x={startX - center.x}
            y={startY - center.y}
            radius={s(3)}
            fill={CANVAS_COLORS.accent}
          />
          <Circle
            x={endX - center.x}
            y={endY - center.y}
            radius={s(3)}
            fill={CANVAS_COLORS.accent}
          />
          <Circle
            x={0}
            y={minY - s(ROTATE_HANDLE_OFFSET_PX) - center.y}
            radius={s(5)}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.accent}
            strokeWidth={s(1.5)}
          />
        </Group>
      )}
    </Group>
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
      fill={CANVAS_COLORS.pillarFill}
      stroke={selected ? CANVAS_COLORS.accent : CANVAS_COLORS.pillarStroke}
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
      fill={selected ? CANVAS_COLORS.fabricSelectedFill : CANVAS_COLORS.fabricFill}
      stroke={selected ? CANVAS_COLORS.accent : CANVAS_COLORS.fabricStroke}
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
  const s = (px: number) => px / (zoom * PX_PER_METER);
  const box = textWorldBox(text, zoom);
  return (
    <Group>
      {selected && (
        <Rect
          x={box.x - s(TEXT_FONT_PX) / 4}
          y={box.y - s(TEXT_FONT_PX) / 4}
          width={box.w + s(TEXT_FONT_PX) / 2}
          height={box.h + s(TEXT_FONT_PX) / 2}
          fill={ACCENT_ALPHA_8}
          stroke={CANVAS_COLORS.accent}
          strokeWidth={s(1)}
          dash={[s(4), s(3)]}
        />
      )}
      <KonvaText
        x={text.x}
        y={text.y}
        text={text.text}
        fontSize={s(TEXT_FONT_PX)}
        fontFamily={FONT_UI}
        fill={selected ? CANVAS_COLORS.accent : CANVAS_COLORS.ink}
      />
    </Group>
  );
});

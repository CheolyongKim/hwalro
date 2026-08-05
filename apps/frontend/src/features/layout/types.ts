export interface Vec2 {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface LayoutText {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface BackgroundImage {
  id: string;
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  aspect: number;
}

export interface DrawingDocument {
  name: string;
  width: number;
  height: number;
  walls: Wall[];
  layoutTexts: LayoutText[];
  background: BackgroundImage | null;
}

export type Tool = 'select' | 'wall' | 'text' | 'erase' | 'background';

export interface Camera {
  zoom: number;
  panX: number;
  panY: number;
}

export interface PointSelection {
  wallIds: string[];
  textIds: string[];
}

export type WallHandle = 'start' | 'end';

export interface WallDraft {
  start: Vec2;
  end: Vec2;
  snappedToEndpoint: Vec2 | null;
  axisSnapped: boolean;
}

export interface TextDraft {
  point: Vec2;
}

export type DragState =
  | {
      kind: 'move';
      origin: Vec2;
      originDoc: DrawingDocument;
    }
  | {
      kind: 'reshape';
      origin: Vec2;
      originDoc: DrawingDocument;
      wallId: string;
      handle: WallHandle;
    }
  | {
      kind: 'backgroundMove';
      origin: Vec2;
      originBg: BackgroundImage;
      originDoc: DrawingDocument;
    };

export interface EditorState {
  doc: DrawingDocument;
  past: DrawingDocument[];
  future: DrawingDocument[];
  tool: Tool;
  selection: PointSelection;
  camera: Camera;
  draft: WallDraft | null;
  textDraft: TextDraft | null;
  drag: DragState | null;
  cursor: Vec2 | null;
  snapHint: Vec2 | null;
  error: string | null;
  cameraFitNonce: number;
}

export interface SerializedWall {
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface SerializedText {
  text: string;
  x: number;
  y: number;
}

export interface SerializedBackground {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  aspect: number;
}

export interface SerializedDocument {
  name: string;
  width: number;
  height: number;
  walls: SerializedWall[];
  layoutTexts: SerializedText[];
  background: SerializedBackground | null;
}

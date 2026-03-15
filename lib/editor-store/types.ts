export type Tool = 'select' | 'direct-select' | 'pen' | 'shape' | 'guide';
export type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line';

export type SelectionState = {
  layerIds: string[];
  pointIds: string[];
  guideIndexes?: number[];
};

export type ViewportState = {
  zoom: number;
  panX: number;
  panY: number;
};

export type PointTransformLabelState = {
  width: number;
  height: number;
};

export type PointMarqueeState = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type PendingPenHandleState = {
  layerId: string;
  pointKey: string;
  anchor: { x: number; y: number };
  handleIn: { x: number; y: number } | null;
  handleOut: { x: number; y: number } | null;
};

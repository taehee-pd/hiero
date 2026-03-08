export type Tool = 'select' | 'direct-select' | 'pen' | 'shape' | 'guide';
export type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line';

export type SelectionState = {
  layerIds: string[];
  pointIds: string[];
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

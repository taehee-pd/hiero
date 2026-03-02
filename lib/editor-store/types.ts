export type Tool = 'select' | 'direct-select' | 'pen' | 'shape' | 'guide';

export type SelectionState = {
  layerIds: string[];
  pointIds: string[];
};

export type ViewportState = {
  zoom: number;
  panX: number;
  panY: number;
};

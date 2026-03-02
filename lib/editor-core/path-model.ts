export type NodeType = 'smooth' | 'corner' | 'symmetric';

export type PathPoint = {
  id: string;
  position: { x: number; y: number };
  handleIn: { x: number; y: number } | null;
  handleOut: { x: number; y: number } | null;
  nodeType: NodeType;
};

export type SubPath = {
  id: string;
  points: PathPoint[];
  closed: boolean;
};

export type EditablePath = {
  id: string;
  subPaths: SubPath[];
};

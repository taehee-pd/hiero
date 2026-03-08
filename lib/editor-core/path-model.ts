export type NodeType = 'static' | 'smooth' | 'corner' | 'symmetric';

export type PathSegment =
  | { type: 'line' }
  | { type: 'cubic' }
  | { type: 'quadratic'; control: { x: number; y: number } }
  | {
      type: 'arc';
      rx: number;
      ry: number;
      xAxisRotation: number;
      largeArc: 0 | 1;
      sweep: 0 | 1;
    };

export type PathPoint = {
  id: string;
  position: { x: number; y: number };
  handleIn: { x: number; y: number } | null;
  handleOut: { x: number; y: number } | null;
  nodeType: NodeType;
  segment: PathSegment | null;
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

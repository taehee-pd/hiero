import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CorrespondencePinsOverlay } from './CorrespondencePinsOverlay';
import type {
  CorrespondenceHints,
  LayerSnapshot,
  PaintRef,
} from '@/lib/schema/types';

const FILL: PaintRef = { mode: 'fixed', value: '#000' };

function snapshotOf(d: string): LayerSnapshot {
  return {
    layers: {
      shape: {
        id: 'shape',
        path: { d },
        style: { fill: FILL },
        transform: { x: 0, y: 0 },
      },
    },
  };
}

const meta: Meta<typeof CorrespondencePinsOverlay> = {
  title: 'Feature/Editor/CorrespondencePinsOverlay',
  component: CorrespondencePinsOverlay,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};
export default meta;
type Story = StoryObj<typeof CorrespondencePinsOverlay>;

const SQUARE = 'M0 0 L10 0 L10 10 L0 10 Z';
const STAR = 'M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z';

const NO_HINTS: CorrespondenceHints = { subpath: [], vertex: [] };

const TWO_PINS: CorrespondenceHints = {
  subpath: [],
  vertex: [
    [
      { subpathId: 'subpath:0', vertexIndex: 0 },
      { subpathId: 'subpath:0', vertexIndex: 0 },
    ],
    [
      { subpathId: 'subpath:0', vertexIndex: 2 },
      { subpathId: 'subpath:0', vertexIndex: 4 },
    ],
  ],
};

export const Empty: Story = {
  args: {
    sourceSnapshot: snapshotOf(SQUARE),
    targetSnapshot: snapshotOf(STAR),
    hints: NO_HINTS,
    onChange: () => {},
  },
};

export const WithTwoPins: Story = {
  args: {
    sourceSnapshot: snapshotOf(SQUARE),
    targetSnapshot: snapshotOf(STAR),
    hints: TWO_PINS,
    onChange: () => {},
  },
};

export const HiddenWhenSourceEmpty: Story = {
  args: {
    sourceSnapshot: null,
    targetSnapshot: snapshotOf(STAR),
    hints: NO_HINTS,
    onChange: () => {},
  },
};

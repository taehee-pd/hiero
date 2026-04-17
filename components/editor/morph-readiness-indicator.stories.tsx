import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MorphReadinessIndicator } from './MorphReadinessIndicator';
import type { IconType, Transition } from '@/lib/schema/types';

const meta: Meta<typeof MorphReadinessIndicator> = {
  title: 'Feature/MorphReadinessIndicator',
  component: MorphReadinessIndicator,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MorphReadinessIndicator>;

const mockFromState: IconType = {
  id: 'default',
  layers: {
    'layer-1': {
      id: 'layer-1',
      path: { d: 'M10 10 L90 10 L90 90 L10 90 Z' },
      style: {
        fill: { mode: 'currentColor' },
      },
    },
  },
};

const mockToState: IconType = {
  id: 'active',
  layers: {
    'layer-1': {
      id: 'layer-1',
      path: { d: 'M50 10 L90 90 L10 90 Z' },
      style: {
        fill: { mode: 'currentColor' },
      },
    },
  },
};

const mockTransition: Transition = {
  id: 'transition-1',
  fromIconId: 'icon-1',
  toIconId: 'icon-1',
  fromVariantId: 'default',
  toVariantId: 'default',
  from: 'default',
  to: 'active',
  strategy: 'strictMorph',
  durationMs: 300,
  layerBindings: [
    { fromLayerId: 'layer-1', toLayerId: 'layer-1' },
  ],
};

export const Excellent: Story = {
  args: {
    fromState: mockFromState,
    toState: mockToState,
    transition: mockTransition,
    readiness: {
      score: 0.95,
      commandCompatibility: 0.9,
      subpathCompatibility: 1.0,
      closedCompatibility: 1.0,
      bboxSimilarity: 0.95,
      centroidSimilarity: 0.92,
      semanticRoleMatch: 1.0,
      recommendedStrategy: 'strictMorph',
      reasons: ['Good topology match'],
    },
  },
};

export const Good: Story = {
  args: {
    fromState: mockFromState,
    toState: mockToState,
    transition: mockTransition,
    readiness: {
      score: 0.65,
      commandCompatibility: 0.5,
      subpathCompatibility: 0.7,
      closedCompatibility: 1.0,
      bboxSimilarity: 0.6,
      centroidSimilarity: 0.7,
      semanticRoleMatch: 0.5,
      recommendedStrategy: 'bestGuessMorph',
      reasons: ['Command count mismatch', 'Different subpath topology'],
    },
  },
};

export const Poor: Story = {
  args: {
    fromState: mockFromState,
    toState: mockToState,
    transition: { ...mockTransition, strategy: 'replace' as const },
    readiness: {
      score: 0.3,
      commandCompatibility: 0.1,
      subpathCompatibility: 0.2,
      closedCompatibility: 0.5,
      bboxSimilarity: 0.3,
      centroidSimilarity: 0.4,
      semanticRoleMatch: 0.0,
      recommendedStrategy: 'fallback',
      reasons: ['Incompatible topology', 'Different layer count'],
    },
  },
};

export const NoReadiness: Story = {
  args: {
    fromState: mockFromState,
    toState: mockToState,
    transition: mockTransition,
  },
};

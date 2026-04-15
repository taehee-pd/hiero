import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './label';
import { RadioGroup, RadioGroupItem } from './radio-group';

function RadioFixture() {
  return (
    <RadioGroup defaultValue="stroke">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="fill" id="fill" />
        <Label htmlFor="fill">fill</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="stroke" id="stroke" />
        <Label htmlFor="stroke">stroke</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="both" id="both" />
        <Label htmlFor="both">both</Label>
      </div>
    </RadioGroup>
  );
}

const meta = {
  title: 'Primitives/RadioGroup',
  component: RadioFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof RadioFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

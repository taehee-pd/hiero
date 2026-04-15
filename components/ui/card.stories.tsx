import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

function CardFixture() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>arrow-right</CardTitle>
        <CardDescription>16 variants / 3 transitions</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost">
            open
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 13, color: 'var(--foreground-secondary)' }}>
          Editor icon with morph animation and on/off state.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="ghost">
          export
        </Button>
      </CardFooter>
    </Card>
  );
}

const meta = {
  title: 'Primitives/Card',
  component: CardFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof CardFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

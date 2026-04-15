import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: 'icon name' },
};

export const Disabled: Story = {
  args: { placeholder: 'disabled', disabled: true },
};

export const WithValue: Story = {
  args: { defaultValue: 'chevron-down' },
};

export const Invalid: Story = {
  args: { defaultValue: '', 'aria-invalid': true, placeholder: 'required field' },
};

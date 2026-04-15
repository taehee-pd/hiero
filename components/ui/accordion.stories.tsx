import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

function AccordionFixture() {
  return (
    <Accordion type="single" collapsible style={{ width: 320 }}>
      <AccordionItem value="layers">
        <AccordionTrigger>layers</AccordionTrigger>
        <AccordionContent>Layer panel contents go here.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="types">
        <AccordionTrigger>types</AccordionTrigger>
        <AccordionContent>Type catalog contents.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="transitions">
        <AccordionTrigger>transitions</AccordionTrigger>
        <AccordionContent>Transition list contents.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

const meta = {
  title: 'Primitives/Accordion',
  component: AccordionFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof AccordionFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

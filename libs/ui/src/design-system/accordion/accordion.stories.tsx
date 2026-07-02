import type { Meta, StoryObj } from '@storybook/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

const meta: Meta<typeof Accordion> = {
  title: 'Design System/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof Accordion>;

export const Single: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue="roles" className="w-96">
      <AccordionItem value="roles">
        <AccordionTrigger>How do roles work?</AccordionTrigger>
        <AccordionContent>
          Roles are collections of permissions assigned per organization
          membership.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="invite">
        <AccordionTrigger>Can I invite external members?</AccordionTrigger>
        <AccordionContent>
          Yes — invitations are scoped to the organization and expire after 7
          days.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="billing">
        <AccordionTrigger>Where is billing managed?</AccordionTrigger>
        <AccordionContent>
          Under the organization&rsquo;s settings, visible to owners only.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

import type { Meta, StoryObj } from '@storybook/react';
import { Toaster, toast } from './toaster';
import { Button } from '../button/button';

const meta: Meta<typeof Toaster> = {
  title: 'Design System/Toaster',
  component: Toaster,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof Toaster>;

/** Click a button to fire a toast (bottom-right). Themed via tokens, so it
 *  follows light/dark + brand. */
export const Playground: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button variant="outline" onClick={() => toast('Event created')}>
        Default
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.success('Organization switched', {
            description: "You're now acting in Globex Corp.",
          })
        }
      >
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error('Could not save changes', {
            description: 'Please try again in a moment.',
          })
        }
      >
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast('Invitation sent', {
            description: 'ana@acme.com',
            action: {
              label: 'Undo',
              onClick: () => toast('Invitation undone'),
            },
          })
        }
      >
        With action
      </Button>
    </div>
  ),
};

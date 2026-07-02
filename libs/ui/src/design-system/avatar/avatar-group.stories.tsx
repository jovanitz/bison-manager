import type { Meta, StoryObj } from '@storybook/react';
import { AvatarGroup } from './avatar-group';
import { Avatar } from './avatar';

const meta: Meta<typeof AvatarGroup> = {
  title: 'Design System/Avatar Group',
  component: AvatarGroup,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof AvatarGroup>;

const people = ['AB', 'CD', 'EF', 'GH', 'IJ', 'KL'];

export const Default: Story = {
  render: () => (
    <AvatarGroup max={4}>
      {people.map((p) => (
        <Avatar key={p} fallback={p} />
      ))}
    </AvatarGroup>
  ),
};

/** Fewer than `max` → no overflow chip. */
export const NoOverflow: Story = {
  render: () => (
    <AvatarGroup max={4}>
      <Avatar fallback="AB" />
      <Avatar fallback="CD" />
    </AvatarGroup>
  ),
};

export const Large: Story = {
  render: () => (
    <AvatarGroup max={3} size="lg">
      {people.map((p) => (
        <Avatar key={p} size="lg" fallback={p} />
      ))}
    </AvatarGroup>
  ),
};

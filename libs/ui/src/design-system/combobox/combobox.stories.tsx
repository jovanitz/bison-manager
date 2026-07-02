import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Combobox, type ComboboxOption } from './combobox';

const roles: readonly ComboboxOption[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'billing', label: 'Billing manager' },
  { value: 'viewer', label: 'Viewer' },
];

const meta: Meta<typeof Combobox> = {
  title: 'Design System/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof Combobox>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <Combobox
        options={roles}
        value={value}
        onChange={setValue}
        placeholder="Select a role…"
        searchPlaceholder="Search roles…"
      />
    );
  },
};

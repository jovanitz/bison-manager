import type { Meta, StoryObj } from '@storybook/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

const meta: Meta<typeof Select> = {
  title: 'Design System/Select',
  component: Select,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Scope: Story = {
  render: () => (
    <Select defaultValue="own">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select a scope" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="own">own — their account</SelectItem>
        <SelectItem value="any">any — every account</SelectItem>
      </SelectContent>
    </Select>
  ),
};

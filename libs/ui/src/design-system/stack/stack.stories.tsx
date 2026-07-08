import type { Meta, StoryObj } from '@storybook/react';
import { Stack } from './stack';

const meta: Meta<typeof Stack> = {
  title: 'Design System/Stack',
  component: Stack,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof Stack>;

const Box = ({ children }: { readonly children: string }) => (
  <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
    {children}
  </div>
);

/** The four rhythm steps, side by side — pick the one that names the relationship
 *  between the elements, not a pixel count. */
export const Scale: Story = {
  render: () => (
    <Stack gap="section" className="w-72">
      {(['tight', 'cozy', 'field', 'group', 'section'] as const).map((g) => (
        <Stack key={g} gap="tight">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {g}
          </p>
          <Stack gap={g}>
            <Box>First</Box>
            <Box>Second</Box>
          </Stack>
        </Stack>
      ))}
    </Stack>
  ),
};

/** `tight` binds a label to the single control it names. */
export const LabelAndControl: Story = {
  render: () => (
    <Stack gap="tight" className="w-72">
      <label className="text-sm font-medium">Display name</label>
      <input
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        placeholder="Pro"
      />
    </Stack>
  ),
};

import type { Meta, StoryObj } from '@storybook/react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';
import { Button } from '../button/button';

const meta: Meta<typeof Drawer> = {
  title: 'Design System/Drawer',
  component: Drawer,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Drawer>;

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Drag me down to close</DrawerTitle>
          <DrawerDescription>
            iOS-style bottom sheet — swipe the handle to dismiss.
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0 text-sm text-muted-foreground">
          Drawer content…
        </div>
      </DrawerContent>
    </Drawer>
  ),
};

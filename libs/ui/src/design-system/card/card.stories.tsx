import type { Meta, StoryObj } from '@storybook/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Button } from '../button/button';

const meta: Meta<typeof Card> = {
  title: 'Design System/Card',
  component: Card,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
        <CardDescription>They’ll get a one-time link.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        The invitation expires in 7 days.
      </CardContent>
      <CardFooter className="gap-2">
        <Button>Send invite</Button>
        <Button variant="ghost">Cancel</Button>
      </CardFooter>
    </Card>
  ),
};

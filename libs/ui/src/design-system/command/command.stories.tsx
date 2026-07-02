import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  ArrowLeftRight,
  LayoutDashboard,
  Moon,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command';
import { Button } from '../button/button';

const meta: Meta<typeof Command> = {
  title: 'Design System/Command',
  component: Command,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof Command>;

const Palette = () => (
  <>
    <CommandInput placeholder="Type a command or search…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Go to">
        <CommandItem>
          <LayoutDashboard />
          Directory
        </CommandItem>
        <CommandItem>
          <ShieldCheck />
          Access
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Organization">
        <CommandItem>
          <ArrowLeftRight />
          Switch to Globex Corp.
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Actions">
        <CommandItem>
          <UserPlus />
          Invite member
          <CommandShortcut>⌘I</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <Moon />
          Toggle theme
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </>
);

/** Inline palette (the workbench view; also what the ⌘K dialog renders inside). */
export const Inline: Story = {
  render: () => (
    <Command className="w-80 rounded-lg border shadow-md">
      <Palette />
    </Command>
  ),
};

/** The real ⌘K flow: press ⌘K / Ctrl+K (or click) to open the modal. */
export const CommandK: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setOpen((o) => !o);
        }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open palette
          <CommandShortcut>⌘K</CommandShortcut>
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <Palette />
        </CommandDialog>
      </>
    );
  },
};

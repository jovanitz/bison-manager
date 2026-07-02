import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { Input } from '../input/input';
import { Button } from '../button/button';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
});
type Values = z.infer<typeof schema>;

const Demo = () => {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => undefined)}
        className="w-80 space-y-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@acme.com" {...field} />
              </FormControl>
              <FormDescription>We&rsquo;ll never share it.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
};

const meta: Meta<typeof Form> = {
  title: 'Design System/Form',
  component: Form,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof Form>;

/** RHF + Zod: submit empty (or an invalid email) to see the error wiring —
 *  label turns destructive, message shows, aria-invalid/describedby update. */
export const Default: Story = { render: () => <Demo /> };

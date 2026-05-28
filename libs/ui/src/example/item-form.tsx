import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../design-system/button';
import { Input } from '../design-system/input';
import { useCreateItem } from './use-items';

/**
 * Create-item form: React Hook Form for state, Zod for the *UI-level* schema.
 *
 * Note the layering: this Zod schema validates input ergonomics at the edge,
 * but it is NOT the source of truth for business rules — the domain's value
 * objects (`makeItemName`) are. The two can coexist; the domain is the backstop
 * that protects invariants regardless of which UI submits the data.
 */
const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long'),
});

type FormValues = z.infer<typeof schema>;

export const ItemForm = () => {
  const create = useCreateItem();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await create.mutateAsync(values);
    reset();
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          aria-label="Item name"
          placeholder="New item name"
          {...register('name')}
        />
        <Button type="submit" disabled={isSubmitting}>
          Add
        </Button>
      </div>
      {errors.name && (
        <p role="alert" className="text-sm text-red-600">
          {errors.name.message}
        </p>
      )}
      {create.isError && (
        <p role="alert" className="text-sm text-red-600">
          {(create.error as Error).message}
        </p>
      )}
    </form>
  );
};

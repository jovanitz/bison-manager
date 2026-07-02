import { Button } from '../design-system/button/button';
import { Card, CardBody } from '../design-system/card/card';
import { ItemForm } from './item-form';
import { useArchiveItem, useItems } from './use-items';

/**
 * The example feature screen — the reusable, platform-independent unit of UI.
 *
 * It is pure presentation + use-case calls. It works identically in the web app,
 * the desktop app (Tauri webview) and the mobile app (Capacitor webview),
 * because all it depends on is the injected use cases.
 */
export const ItemScreen = () => {
  const { data: items, isLoading } = useItems();
  const archive = useArchiveItem();

  // Early returns instead of a nested ternary keep the three states readable.
  const body = () => {
    if (isLoading) {
      return <p className="text-sm text-slate-500">Loading…</p>;
    }
    if (!items || items.length === 0) {
      return (
        <p className="text-sm text-slate-500">No items yet. Add one above.</p>
      );
    }
    return (
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <Button
                    variant="ghost"
                    onClick={() => archive.mutate({ id: item.id })}
                  >
                    Archive
                  </Button>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Items</h1>
        <p className="text-sm text-slate-500">
          A generic example feature demonstrating the architecture.
        </p>
      </header>

      <ItemForm />

      {body()}
    </section>
  );
};

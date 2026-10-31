'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { approveBatch } from '../actions';

export type ReadyItem = { pick: string; name: string; group: string };

const selectedNow = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[data-pick]:checked')).map((el) => el.dataset.pick ?? '');

// The sticky bar at the bottom of /admin/review and the full-page confirm step. Tick boxes live on
// the server-rendered cards (input[data-pick], ready items only); this bar counts them. Neither
// button approves straight away: both open the confirm step, which lists every name.
export function ReviewBar({ locale, back, items, max }: { locale: string; back: string; items: ReadyItem[]; max: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<ReadyItem[] | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const update = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.dataset.pick !== undefined) setSelected(selectedNow());
    };
    // Browsers can restore ticks after going back; count them once the page has painted.
    const frame = requestAnimationFrame(() => setSelected(selectedNow()));
    document.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('change', update);
    };
  }, []);

  const close = useCallback(() => {
    setConfirming(null);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (!confirming) return;
    heading.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [confirming, close]);

  if (items.length === 0) return null;

  const open = (list: ReadyItem[], event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setConfirming(list.slice(0, max));
  };
  const chosen = items.filter((i) => selected.includes(i.pick));
  const clear = () => {
    document.querySelectorAll<HTMLInputElement>('input[data-pick]:checked').forEach((el) => {
      el.checked = false;
    });
    setSelected([]);
  };

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-3xl">
          {chosen.length > 0 ? (
            <>
              <p className="flex items-center gap-2 text-sm">
                {chosen.length} selected ·
                <button type="button" onClick={clear} className="min-h-11 font-semibold text-forest underline">
                  Clear
                </button>
              </p>
              <button type="button" onClick={(e) => open(chosen, e)} className="btn min-h-12 w-full">
                Approve selected ({chosen.length})
              </button>
              <button type="button" onClick={(e) => open(items, e)} className="mt-1 min-h-11 w-full font-semibold text-forest underline">
                Approve all ready on this page ({items.length})
              </button>
            </>
          ) : (
            <button type="button" onClick={(e) => open(items, e)} className="btn min-h-12 w-full">
              Approve all ready on this page ({items.length})
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 overflow-y-auto bg-surface">
          <form action={approveBatch} className="mx-auto flex min-h-full max-w-[560px] flex-col bg-white px-4 pt-8 sm:my-8 sm:min-h-0 sm:rounded-[5px] sm:border sm:border-line sm:px-6">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="back" value={back} />
            {confirming.map((item) => (
              <input key={item.pick} type="hidden" name="item" value={item.pick} />
            ))}
            <h1 id="confirm-title" ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
              Approve {confirming.length} {confirming.length === 1 ? 'item' : 'items'}?
            </h1>
            <p className="mt-2">Each one goes live and the owner gets the usual “approved” notice.</p>
            <ConfirmList items={confirming} />
            <p className="mt-6 text-sm text-muted">Kwetuly checks each one again before approving. Anything that changed is left waiting.</p>
            <div
              className="sticky bottom-0 mt-6 grid gap-2 border-t border-line bg-white pt-3 sm:grid-cols-2"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <SubmitButton className="btn min-h-12 w-full" pendingLabel="Approving…">
                Yes, approve {confirming.length}
              </SubmitButton>
              <button type="button" onClick={close} className="btn-outline min-h-12 w-full sm:order-first">
                Go back
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ConfirmList({ items }: { items: ReadyItem[] }) {
  const groups = new Map<string, ReadyItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return (
    <>
      {[...groups.entries()].map(([group, list]) => (
        <section key={group} className="mt-5">
          <h2 className="font-bold">
            {group} ({list.length})
          </h2>
          <ul className="mt-1">
            {list.slice(0, 10).map((item) => (
              <li key={item.pick} className="flex min-h-10 items-center border-b border-line text-[15px]">
                {item.name}
              </li>
            ))}
          </ul>
          {list.length > 10 && (
            <details className="mt-1">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold text-forest underline">
                Show all {list.length} {group.toLowerCase()}
              </summary>
              <ul>
                {list.slice(10).map((item) => (
                  <li key={item.pick} className="flex min-h-10 items-center border-b border-line text-[15px]">
                    {item.name}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
    </>
  );
}

/** Moves keyboard and screen-reader focus to the result line after a batch or a single action. */
export function FocusResult({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.focus();
  }, [id]);
  return null;
}

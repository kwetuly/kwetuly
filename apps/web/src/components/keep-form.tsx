'use client';

import { createContext, startTransition, use, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from 'react';

/** What a KeepForm server action returns when it refuses the form; success redirects instead. */
export type FormResult = { error: string } | null;

type KeepFormState = { result: FormResult; pending: boolean };

const KeepFormContext = createContext<KeepFormState>({ result: null, pending: false });

/** The current refusal and sending state of the KeepForm around a field or button (if any). */
export function useKeepForm(): KeepFormState {
  return use(KeepFormContext);
}

// A form whose server action answers a refusal with { error } instead of a redirect. The form is
// submitted without React's automatic reset, so everything typed stays in place (also files picked
// and numbers the server refused); the message appears at the top and fields with a matching
// `errorCode` mark themselves. Success still redirects from the action.
export function KeepForm({
  action,
  messages,
  fallback,
  className,
  children,
}: {
  action: (previous: FormResult, formData: FormData) => Promise<FormResult>;
  /** Message per error code; anything else shows `fallback`. */
  messages: Record<string, string>;
  fallback: string;
  className?: string;
  children: ReactNode;
}) {
  const [result, dispatch, pending] = useActionState(action, null);
  const banner = useRef<HTMLParagraphElement>(null);

  // A new refusal moves focus to its message, so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (result) banner.current?.focus();
  }, [result]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter instanceof HTMLElement ? submitter : undefined);
    startTransition(() => dispatch(data));
  }

  return (
    <KeepFormContext value={{ result, pending }}>
      {/* `action` gives the form a POST to the server action before the page's code has loaded, so a
          very early submit never puts the fields in the address bar as a GET; once loaded, onSubmit
          takes over. */}
      <form action={dispatch} onSubmit={onSubmit} className={className} aria-busy={pending || undefined}>
        {result && (
          <p ref={banner} tabIndex={-1} role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800 outline-none sm:col-span-full">
            {messages[result.error] ?? fallback}
          </p>
        )}
        {children}
      </form>
    </KeepFormContext>
  );
}

import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type SessionClient = ReturnType<typeof createServerClient>;

// Refreshes the Supabase session cookie on every request and returns the response to send.
// `check` may look something up as the signed-in visitor and return a different response (for
// example a 404 or a redirect); the refreshed session cookies are copied onto it.
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
  check?: (supabase: SessionClient, user: User | null) => Promise<NextResponse | null>,
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this revalidates the auth token and writes the refreshed cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const replacement = check ? await check(supabase, user) : null;
  if (!replacement) return response;
  response.cookies.getAll().forEach((cookie) => replacement.cookies.set(cookie));
  return replacement;
}

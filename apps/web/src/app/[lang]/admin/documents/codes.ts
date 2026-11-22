// Only short fixed codes go into the address (security review L1): the page maps each to a fixed text
// and ignores anything else, so a crafted link cannot show its own message and no database text is logged.
// Shared by the server actions and the file route ([id]/file/route.ts).
export function codeForError(message: string | undefined): string {
  const m = message ?? '';
  if (/already been decided/i.test(m)) return 'decided';
  if (/another admin/i.test(m)) return 'own_document';
  if (/missing/i.test(m)) return 'file_missing';
  if (/already expired/i.test(m)) return 'expired';
  if (/not found|no file|no current check/i.test(m)) return 'not_found';
  if (/admins only/i.test(m)) return 'not_admin';
  return 'failed';
}

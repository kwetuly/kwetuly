// Names that would make a person or business look like the platform itself ("Kwetuly: pay your
// deposit to..."). The database is the rule that counts (private.is_reserved_display_name, migration
// 20261025000100): it refuses such names on profiles, guide profiles, business listings, trip offers
// and group trips with the error 'display_name_reserved', unless the row belongs to an admin. This
// copy only lets forms show a clear message before sending. KEEP BOTH IN STEP, step by step:
//
// 1. Unicode compatibility decomposition (NFKD), then accents (combining marks U+0300..U+036F)
//    removed: fullwidth "Ｋ" becomes "K", a non-breaking space becomes a space, "ý" becomes "y".
//    (NFKD folds everything NFKC folds, and also splits off accents so they can be dropped.)
// 2. Cyrillic and Greek letters that look Latin become Latin (LOOKALIKES, both cases), then lower case.
// 3. "vv" reads as "w".
// 4. Invisible characters (soft hyphen, zero-width spaces and joiners, word joiner, BOM) are dropped;
//    every other character except a-z, 1, ! and | becomes a space. Punctuation therefore separates
//    words ("Kwetu-Lyimo" is two words), and spacing tricks are caught by step 5.
// 5. Refused:
//    - "kwetu" + one of i l 1 ! | + "y" anywhere ("KwetulyTeam", "KwetuIy", "Kwetu1y");
//    - the same letters with spaces between them, as a whole word ("Kwe tuly", "Kwe.tuly",
//      "kwetu_ly", "Kwetu ly"), while "Kwetu Lyimo" (a word plus a common surname) is fine;
//    - "rafr" + i l 1 ! | + "ka" at the start of a word ("Rafrika", "Safari-Rafrika"), or spaced
//      out as a whole word ("Ra.frika"); "Safarafrika" is fine.

const LOOKALIKES_FROM = 'АВЕКМНОРСТУХІӀЈЅԜҮавекмнорстухіӏјѕԝүԛΑΒΕΖΗΙΚΜΝΟΡΤΥΧαεικνορτυχγω';
const LOOKALIKES_TO = 'ABEKMHOPCTYXIlJSWYabekmhopctyxiljswyqABEZHIKMNOPTYXaeikvoptuxyw';
const LOOKALIKES = new Map([...LOOKALIKES_FROM].map((c, i) => [c, LOOKALIKES_TO[i]]));

const INVISIBLE = /[\u00ad\u200b-\u200f\u2060-\u2064\ufeff]/g;
const RESERVED =
  /kwetu[il1!|]y|(^|[^a-z])k *w *e *t *u *[il1!|] *y($|[^a-z])|(^|[^a-z])rafr[il1!|]ka|(^|[^a-z])r *a *f *r *[il1!|] *k *a($|[^a-z])/;

/** The name reduced to a-z, 1 ! | and spaces (steps 1 to 4 above). */
export function foldDisplayName(name: string): string {
  const decomposed = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const latin = [...decomposed].map((c) => LOOKALIKES.get(c) ?? c).join('');
  return latin
    .toLowerCase()
    .replace(/vv/g, 'w')
    .replace(INVISIBLE, '')
    .replace(/[^a-z1!|]/g, ' ');
}

/** True when a display or business name is kept for Kwetuly's own accounts. */
export function isReservedDisplayName(name: string | null | undefined): boolean {
  if (!name) return false;
  return RESERVED.test(foldDisplayName(name));
}

/** The database's error code for a refused name. */
export const DISPLAY_NAME_RESERVED = 'display_name_reserved';

/** True when a Supabase error is the database refusing a reserved name. */
export function isDisplayNameReservedError(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes(DISPLAY_NAME_RESERVED));
}

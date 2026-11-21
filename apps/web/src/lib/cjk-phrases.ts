/**
 * Splits a Chinese headline into phrases so it only wraps between them (render with <wbr> between the
 * phrases and `word-break: keep-all`). Uses the built-in word segmenter; a one-character word sticks to the
 * word before it (the first one to the word after it), and punctuation sticks to the word before it, so
 * 与坦桑尼亚人一起旅行。 becomes 与坦桑尼亚人 | 一起 | 旅行。
 */
export function cjkPhrases(text: string, locale: string): string[] {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return [text];
  const segments = [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)];
  const phrases: string[] = [];
  let carry = '';
  for (const { segment, isWordLike } of segments) {
    const short = !isWordLike || [...segment].length === 1;
    if (short && phrases.length > 0) phrases[phrases.length - 1] += segment;
    else if (short) carry += segment;
    else {
      phrases.push(carry + segment);
      carry = '';
    }
  }
  if (carry) phrases.push(carry);
  return phrases;
}

// Structured data for search engines (schema.org JSON-LD). Only real data from the database goes
// in here: no made-up ratings, prices or availability.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\u003c') }} />;
}

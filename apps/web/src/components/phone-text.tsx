import { Fragment } from 'react';
import { formatPhone } from '@kwetuly/shared';

/**
 * A sentence with a {phone} placeholder, with the formatted number kept on one line so it never
 * breaks between its digit groups on a narrow phone (+255 712 | 345 678). formatPhone itself is
 * unchanged, since form fields use its plain string as their starting value.
 */
export function PhoneText({ text, phone }: { text: string; phone: string | null | undefined }) {
  const parts = text.split('{phone}');
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="whitespace-nowrap">{formatPhone(phone)}</span>}
          {part}
        </Fragment>
      ))}
    </>
  );
}

import { CALL_TOPICS, JOB_ROLES } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';

export type CallStatus = 'requested' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export function topicName(id: string, locale: Locale) {
  return CALL_TOPICS.find((c) => c.id === id)?.[locale] ?? id;
}

export function jobRoleName(id: string, locale: Locale) {
  return JOB_ROLES.find((r) => r.id === id)?.[locale] ?? id;
}

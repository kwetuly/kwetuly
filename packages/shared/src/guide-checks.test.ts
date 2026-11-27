import { describe, expect, it } from 'vitest';
import { profileCompletion } from './guide-checks';

const full = {
  photo_url: 'https://example.test/p.jpg',
  headline: 'Kilimanjaro guide',
  bio: 'I grew up in Moshi.',
  specialties: ['kilimanjaro'],
  languages: ['sw', 'en'],
  regions: ['Kilimanjaro'],
  years_experience: 6,
  phone: '+255700000000',
  id_document_path: 'u/guide-id-1.jpg',
  license_document_path: 'u/guide-licence-1.jpg',
  first_aid_document_path: null,
  trip_count: 1,
};

describe('profileCompletion (six sign-up steps)', () => {
  it('is complete with steps 1-4 done, without the bio or first aid', () => {
    const { percent, items } = profileCompletion({ ...full, bio: '' });
    expect(percent).toBe(100);
    expect(items.find((i) => i.id === 'bio')).toMatchObject({ done: false, optional: true });
    expect(items.find((i) => i.id === 'firstAidDocument')).toMatchObject({ optional: true });
  });

  it('needs at least one trip', () => {
    const { percent, items } = profileCompletion({ ...full, trip_count: 0 });
    expect(percent).toBeLessThan(100);
    expect(items.find((i) => i.id === 'trips')).toMatchObject({ done: false, optional: false });
  });

  it('counts a missing trip count as no trip', () => {
    const { trip_count: _ignored, ...rest } = full;
    expect(profileCompletion(rest).items.find((i) => i.id === 'trips')?.done).toBe(false);
  });

  it('starts at 0 for an empty profile', () => {
    expect(profileCompletion({}).percent).toBe(0);
  });
});

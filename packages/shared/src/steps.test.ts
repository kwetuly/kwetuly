import { describe, expect, it } from 'vitest';
import { GUIDE_STEP_IDS, canSendForChecking, guideStepFrom, guideStepProgress, guideStepsDone, isGuideStepId, stepProgress, vipChange, vipHosting } from './steps';
import { guideProgressLine, guideProgressText } from './dictionaries/guide-progress';
import { guideSignupText } from './dictionaries/guide-signup';

const fullGuide = {
  display_name: 'Neema',
  base_region: 'Kilimanjaro',
  languages: ['sw', 'en'],
  photo_url: 'https://example.test/p.jpg',
  headline: 'Kilimanjaro guide',
  specialties: ['kilimanjaro'],
  bio: 'I grew up in Moshi.',
  call_enabled: true,
};

describe('stepProgress', () => {
  it('counts finished, left and required left', () => {
    const p = stepProgress([true, true, true, false, false, false], 4);
    expect(p).toMatchObject({ finished: 3, total: 6, left: 3, requiredLeft: 1 });
    expect(p.steps.map((s) => s.optional)).toEqual([false, false, false, false, true, true]);
  });

  it('treats every step as required by default', () => {
    expect(stepProgress([false, true]).requiredLeft).toBe(1);
  });
});

describe('guide steps', () => {
  it('has six steps with stable ids', () => {
    expect(GUIDE_STEP_IDS).toEqual(['basics', 'work', 'documents', 'trips', 'page', 'calls']);
    expect(isGuideStepId('trips')).toBe(true);
    expect(isGuideStepId('nope')).toBe(false);
  });

  it('opens your page from old story links', () => {
    expect(guideStepFrom('story')).toBe('page');
    expect(guideStepFrom('calls')).toBe('calls');
    expect(guideStepFrom('https://example.test')).toBeNull();
    expect(guideStepFrom(undefined)).toBeNull();
  });

  it('can be sent for checking once steps 1-4 are done, even without 5 and 6', () => {
    expect(canSendForChecking(stepProgress([true, true, true, true, false, false], 4))).toBe(true);
    expect(canSendForChecking(stepProgress([true, true, true, false, true, true], 4))).toBe(false);
  });

  it('counts nothing for a new guide', () => {
    const p = guideStepProgress({ guide: null, idDocument: false, licenceDocument: false, tripCount: 0 });
    expect(p).toMatchObject({ finished: 0, total: 6, requiredLeft: 4 });
  });

  it('needs a photo, region and languages for about you', () => {
    expect(guideStepsDone({ guide: { ...fullGuide, photo_url: null }, idDocument: true, licenceDocument: true, tripCount: 1 }).basics).toBe(false);
    expect(guideStepsDone({ guide: { ...fullGuide, languages: [] }, idDocument: true, licenceDocument: true, tripCount: 1 }).basics).toBe(false);
  });

  it('needs both documents and at least one trip', () => {
    const done = guideStepsDone({ guide: fullGuide, idDocument: true, licenceDocument: false, tripCount: 0 });
    expect(done.documents).toBe(false);
    expect(done.trips).toBe(false);
  });

  it('is complete when everything is there', () => {
    const p = guideStepProgress({ guide: fullGuide, idDocument: true, licenceDocument: true, tripCount: 2 });
    expect(p).toMatchObject({ finished: 6, left: 0, requiredLeft: 0 });
  });
});

describe('guideProgressLine', () => {
  it('reads like the approved example', () => {
    expect(guideProgressLine(stepProgress([true, true, true, false, false, false], 4), 'en')).toBe('You have finished 3 of 6. 3 more steps to finish.');
  });

  it('uses the singular for one step left', () => {
    expect(guideProgressLine(stepProgress([true, true, true, false, true, true], 4), 'en')).toBe('You have finished 5 of 6. 1 more step to finish.');
  });

  it('says only optional steps are left', () => {
    expect(guideProgressLine(stepProgress([true, true, true, true, false, false], 4), 'en')).toContain('2 optional steps');
  });

  it('thanks the guide when all is done, in Kiswahili too', () => {
    const all = stepProgress([true, true, true, true, true, true], 4);
    expect(guideProgressLine(all, 'en')).toBe(guideProgressText('en').allDone);
    expect(guideProgressLine(all, 'sw')).toBe(guideProgressText('sw').allDone);
  });

  it('falls back to English for traveller-only languages', () => {
    expect(guideProgressText('fr')).toBe(guideProgressText('en'));
  });

  it('has one name and one hint per step in both languages', () => {
    for (const locale of ['en', 'sw']) {
      expect(guideProgressText(locale).steps).toHaveLength(GUIDE_STEP_IDS.length);
      expect(guideProgressText(locale).stepHints).toHaveLength(GUIDE_STEP_IDS.length);
    }
  });

  it('never writes all caps or arrows', () => {
    for (const locale of ['en', 'sw']) {
      for (const value of Object.values(guideProgressText(locale)).flat()) {
        expect(value).not.toMatch(/[→←»]|\b[A-Z]{4,}\b/);
      }
    }
  });
});

describe('VIP hosting switch', () => {
  const host = (id: string, status: 'draft' | 'pending' | 'approved' | 'rejected') => ({ id, kind: 'personal_host', status });

  it('is on only with a personal_host package sent for checking or approved', () => {
    expect(vipHosting([]).on).toBe(false);
    expect(vipHosting([{ id: 'a', kind: 'cultural', status: 'approved' }]).on).toBe(false);
    expect(vipHosting([host('a', 'rejected')]).on).toBe(false);
    expect(vipHosting([host('a', 'pending')])).toMatchObject({ on: true, liveIds: ['a'] });
  });

  it('hides live packages when switched off and never deletes them', () => {
    expect(vipChange([host('a', 'approved'), host('b', 'pending')], false)).toEqual({ kind: 'hide', ids: ['a', 'b'] });
  });

  it('sends a hidden one again, or asks for a new one, when switched on', () => {
    expect(vipChange([host('a', 'draft')], true)).toEqual({ kind: 'resend', id: 'a' });
    expect(vipChange([host('a', 'rejected')], true)).toEqual({ kind: 'create' });
    expect(vipChange([], true)).toEqual({ kind: 'create' });
  });

  it('does nothing when the switch did not change', () => {
    expect(vipChange([host('a', 'approved')], true)).toEqual({ kind: 'none' });
    expect(vipChange([], false)).toEqual({ kind: 'none' });
  });
});

describe('guide sign-up texts', () => {
  it('has the same keys in English and Kiswahili, with no all caps or arrows', () => {
    const en = guideSignupText('en');
    const sw = guideSignupText('sw');
    expect(Object.keys(sw).sort()).toEqual(Object.keys(en).sort());
    for (const value of [...Object.values(en), ...Object.values(sw)]) {
      expect(value.trim()).not.toBe('');
      expect(value).not.toMatch(/[→←»]|\b[A-Z]{4,}\b/);
    }
    expect(guideSignupText('de')).toBe(en);
  });
});

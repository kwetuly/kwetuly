import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FEATURES,
  FEATURE_ID_PATTERN,
  FEATURE_PARTS,
  LOCKED_OFF_FEATURES,
  featureName,
  isFeatureOn,
  isFeatureVisible,
  isLockedOff,
  parseFeatureRows,
} from './features';
import { FEATURES_TEXT, featuresText } from './dictionaries/features';

const dir = new URL('../../../supabase/migrations/', import.meta.url);
const allSql = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(new URL(name, dir), 'utf8'))
  .join('\n');
const adminSql = readFileSync(new URL('20261126000000_feature_switch_admin.sql', dir), 'utf8');

describe('feature list', () => {
  it('ids are unique and match the database pattern', () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(FEATURE_ID_PATTERN);
  });

  it('every id is seeded by a migration', () => {
    for (const f of FEATURES) expect(allSql, f.id).toContain(`'feature.${f.id}'`);
  });

  it('seeded legal flag matches legalPending', () => {
    for (const f of FEATURES) {
      const legal = f.legalPending ? 'pending' : 'none';
      const inserted = new RegExp(`^\\s+\\('feature\\.${f.id}',\\s+'\\{`, 'm').test(adminSql)
        ? new RegExp(`\\('feature\\.${f.id}',\\s+'\\{"on": true, "legal": "${legal}"`).test(adminSql)
        : new RegExp(`\\('${f.id}',\\s+'${legal}'\\)`).test(adminSql);
      expect(inserted, f.id).toBe(true);
    }
  });

  it('legal questions go with the legal flag', () => {
    for (const f of FEATURES) {
      expect(f.legalPending, f.id).toBe(f.legalQuestion !== null);
      if (f.legalQuestion) expect(f.legalQuestion.length, f.id).toBeLessThan(400);
    }
  });

  it('the board legal-check-pending list is flagged', () => {
    const pending = ['vip_hosts', 'investment_hosts', 'driver_guide', 'service_consultant', 'crew_accounts', 'crew_verification_fees',
      'service_trip_runner', 'service_photographer', 'service_translator', 'family_updates', 'academy', 'price_alerts', 'marketplace',
      'tips', 'split_settlement', 'mobile_money', 'crew_payouts', 'instalments', 'insurance_rescue', 'meet_and_greet',
      'transfers_driving', 'sim_listings', 'operator_channel', 'ship_home', 'corporate_groups', 'jobs_contact_fees', 'spa_reservations', 'save_to_travel'];
    for (const id of pending) expect(FEATURES.find((f) => f.id === id)?.legalPending, id).toBe(true);
  });

  it('locked switches stay off and match the database lock', () => {
    expect([...LOCKED_OFF_FEATURES].sort()).toEqual(FEATURES.filter((f) => f.lockedOff).map((f) => f.id).sort());
    expect(adminSql).toContain(`p_id = 'payments_live'`);
    expect(adminSql).toContain(`new.key = 'feature.payments_live'`);
    expect(isLockedOff('payments_live')).toBe(true);
    expect(isLockedOff('stories')).toBe(false);
    expect(FEATURES.filter((f) => f.hidden)).toEqual([]);
    expect(adminSql).not.toMatch(/'feature\.save_to_travel'.*false/);
    expect(adminSql).not.toMatch(/'feature\.payments_live',\s+'\{"on": true/);
  });

  it('every part has a name and every feature a known part', () => {
    const parts = new Set(FEATURE_PARTS.map((p) => p.id));
    for (const f of FEATURES) expect(parts.has(f.part), f.id).toBe(true);
    for (const f of FEATURES) expect(f.name.en && f.name.sw, f.id).toBeTruthy();
  });

  it('names by locale', () => {
    expect(featureName('marketplace', 'sw')).toBe('Soko');
    expect(featureName('marketplace', 'fr')).toBe('Marketplace');
    expect(featureName('made_up', 'en')).toBe('made_up');
  });
});

describe('reading switches', () => {
  const rows = [
    { key: 'feature.stories', value: { on: true, legal: 'none', legal_checked_on: null, team_only: false } },
    { key: 'feature.farm_page', value: { on: false, legal: 'none', team_only: true } },
    { key: 'feature.marketplace', value: { on: true, legal: 'cleared', legal_checked_on: '2026-11-20' } },
    { key: 'feature.broken', value: { on: 'yes' } },
    { key: 'feature.Bad-Id', value: { on: true } },
    { key: 'badge_fee', value: { amount_usd: null } },
  ];
  const map = parseFeatureRows(rows);

  it('missing or broken rows read as off', () => {
    expect(isFeatureOn(map, 'stories')).toBe(true);
    expect(isFeatureOn(map, 'broken')).toBe(false);
    expect(isFeatureOn(map, 'no_row')).toBe(false);
    expect(Object.keys(map).sort()).toEqual(['farm_page', 'marketplace', 'stories']);
    expect(parseFeatureRows(null)).toEqual({});
  });

  it('team-only preview for admins only', () => {
    expect(isFeatureVisible(map, 'farm_page', false)).toBe(false);
    expect(isFeatureVisible(map, 'farm_page', true)).toBe(true);
    expect(isFeatureVisible(map, 'no_row', true)).toBe(false);
  });

  it('legal fields', () => {
    expect(map.marketplace).toEqual({ on: true, legal: 'cleared', legalCheckedOn: '2026-11-20', teamOnly: false });
    expect(map.farm_page.legal).toBe('none');
  });
});

describe('page texts', () => {
  it('Kiswahili has every English key', () => {
    expect(Object.keys(FEATURES_TEXT.sw).sort()).toEqual(Object.keys(FEATURES_TEXT.en).sort());
    expect(featuresText('sw')).toBe(FEATURES_TEXT.sw);
    expect(featuresText('de')).toBe(FEATURES_TEXT.en);
  });
});

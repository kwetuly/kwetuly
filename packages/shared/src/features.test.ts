import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as barrel from './index';
import {
  FEATURES,
  FEATURE_ID_PATTERN,
  FEATURE_PARTS,
  LOCKED_OFF_FEATURES,
  featureName,
  isFeatureOn,
  isLockedOff,
  parseFeatureRows,
} from './features';
import { FEATURE_ADMIN } from './admin/features-admin';
import { FEATURES_TEXT, featuresText } from './admin/features-text';

const dir = new URL('../../../supabase/migrations/', import.meta.url);
const allSql = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(new URL(name, dir), 'utf8'))
  .join('\n');
const adminSql = readFileSync(new URL('20261126000000_feature_switch_admin.sql', dir), 'utf8');
const MONEY_API = ['split_settlement', 'mobile_money', 'marketplace_checkout', 'instalments', 'crew_payouts', 'tips'];

describe('feature list', () => {
  it('ids are unique and match the database pattern', () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(FEATURE_ID_PATTERN);
  });

  it('every id is seeded by a migration, with its admin data', () => {
    for (const f of FEATURES) {
      expect(allSql, f.id).toContain(`'feature.${f.id}'`);
      const legal = f.legalPending ? 'pending' : 'none';
      expect(new RegExp(`^\\s+\\('${f.id}',\\s+'${legal}'\\)`, 'm').test(adminSql), f.id).toBe(true);
    }
  });

  it('new public rows are exactly {"on": true}', () => {
    const inserted = [...adminSql.matchAll(/^\s+\('feature\.([a-z0-9_]+)',\s+'(.*)'\)/gm)];
    expect(inserted.length).toBe(52);
    for (const [, id, value] of inserted) expect(value, id).toBe('{"on": true}');
    expect(inserted.map((m) => m[1])).not.toContain('payments_live');
    expect(inserted.map((m) => m[1])).not.toContain('reservation_commission_billing');
  });

  it('admin data: one entry per feature, a question exactly when legal is pending', () => {
    expect(Object.keys(FEATURE_ADMIN).sort()).toEqual(FEATURES.map((f) => f.id).sort());
    for (const f of FEATURES) {
      const q = FEATURE_ADMIN[f.id].legalQuestion;
      expect(f.legalPending, f.id).toBe(q !== null);
      if (q) expect(q.length, f.id).toBeLessThan(400);
    }
  });

  it('the board legal-check-pending list is flagged', () => {
    const pending = ['vip_hosts', 'investment_hosts', 'driver_guide', 'service_consultant', 'crew_accounts', 'crew_verification_fees',
      'service_trip_runner', 'service_photographer', 'service_translator', 'family_updates', 'academy', 'price_alerts', 'marketplace',
      'tips', 'split_settlement', 'mobile_money', 'crew_payouts', 'instalments', 'insurance_rescue', 'meet_and_greet',
      'transfers_driving', 'sim_listings', 'operator_channel', 'ship_home', 'corporate_groups', 'jobs_contact_fees', 'spa_reservations',
      'save_to_travel', 'payments_manual'];
    for (const id of pending) expect(FEATURES.find((f) => f.id === id)?.legalPending, id).toBe(true);
  });

  it('payments_live is the only lock and matches the database', () => {
    expect([...LOCKED_OFF_FEATURES]).toEqual(['payments_live']);
    expect(FEATURES.filter((f) => f.lockedOff).map((f) => f.id)).toEqual(['payments_live']);
    expect(adminSql).toContain(`if p_id = 'payments_live' and (p_on or coalesce(p_team_only, false)) then`);
    expect(adminSql).toContain(`new.key = 'feature.payments_live' and new.value is distinct from '{"on": false}'::jsonb`);
    expect(adminSql).toContain(`check (feature_id <> 'payments_live' or not team_only)`);
    expect(isLockedOff('payments_live')).toBe(true);
    expect(isLockedOff('save_to_travel')).toBe(false);
    expect(FEATURES.filter((f) => f.hidden)).toEqual([]);
  });

  it('money gates: API paths need payments_live, Lipa does not', () => {
    expect(adminSql).toContain(`select private.feature_on('payments_live') and private.feature_on(p_id);`);
    expect(adminSql).toContain(`select private.feature_on('payments_manual');`);
    for (const id of MONEY_API) expect(adminSql, id).toContain(id);
    for (const id of [...MONEY_API, 'payments_manual']) expect(FEATURES.find((f) => f.id === id)?.part, id).toMatch(/^(B|marketplace)$/);
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

describe('admin-only data stays out of the public barrel (security review M3)', () => {
  it('no questions, board references or admin texts in @kwetuly/shared', () => {
    const exported = barrel as Record<string, unknown>;
    expect(exported.FEATURE_ADMIN).toBeUndefined();
    expect(exported.FEATURES_TEXT).toBeUndefined();
    expect(exported.featuresText).toBeUndefined();
    const publicText = JSON.stringify(FEATURES);
    for (const info of Object.values(FEATURE_ADMIN)) {
      if (info.legalQuestion) expect(publicText).not.toContain(info.legalQuestion);
    }
    expect(publicText).not.toContain('boardRef');
    expect(publicText).not.toContain('legalQuestion');
  });
});

describe('reading switches', () => {
  const rows = [
    { key: 'feature.stories', value: { on: true } },
    { key: 'feature.farm_page', value: { on: false } },
    { key: 'feature.broken', value: { on: 'yes' } },
    { key: 'feature.Bad-Id', value: { on: true } },
    { key: 'badge_fee', value: { amount_usd: null } },
  ];
  const map = parseFeatureRows(rows);

  it('missing or broken rows read as off', () => {
    expect(isFeatureOn(map, 'stories')).toBe(true);
    expect(isFeatureOn(map, 'farm_page')).toBe(false);
    expect(isFeatureOn(map, 'broken')).toBe(false);
    expect(isFeatureOn(map, 'no_row')).toBe(false);
    expect(Object.keys(map).sort()).toEqual(['farm_page', 'stories']);
    expect(parseFeatureRows(null)).toEqual({});
  });
});

describe('page texts', () => {
  it('Kiswahili has every English key', () => {
    expect(Object.keys(FEATURES_TEXT.sw).sort()).toEqual(Object.keys(FEATURES_TEXT.en).sort());
    expect(featuresText('sw')).toBe(FEATURES_TEXT.sw);
    expect(featuresText('de')).toBe(FEATURES_TEXT.en);
  });
});

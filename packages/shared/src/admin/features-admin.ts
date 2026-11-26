// Admin-only feature data: the advocate's questions and the board references for /admin/features.
// Imported only by the server-side admin page (apps/web/src/app/[lang]/admin/features), never through the
// @kwetuly/shared barrel, so the questions do not reach the public website or app bundles (security
// review W1-1, M3). The questions are for the advocate (docs/legal); none of them is an answer.

export type FeatureLegal = 'pending' | 'cleared' | 'none';

export type FeatureAdminInfo = { boardRef: string; legalQuestion: string | null };

/** One admin row as returned by public.admin_feature_rows() (migration 20261126000000). */
export type FeatureAdminRow = {
  feature_id: string;
  has_row: boolean;
  on: boolean;
  legal: FeatureLegal;
  legal_checked_on: string | null;
  team_only: boolean;
};

export const FEATURE_ADMIN: Readonly<Record<string, FeatureAdminInfo>> = {
  experiences: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  stories: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  proposals: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  ai_drafts: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  ai_assistant: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  teams: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  projects: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  training_plans: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  footage: {
    boardRef: '2026-10-31',
    legalQuestion: null,
  },
  reservation_commission_billing: {
    boardRef: '2026-11-22 reservations',
    legalQuestion: null,
  },
  spa_reservations: {
    boardRef: '2026-11-26 legal check pending list',
    legalQuestion: 'Which licence spa and massage premises need, and what Kwetuly must check before a business takes reservations (licensed premises, adults, no home visits).',
  },
  booking_link: {
    boardRef: 'A5',
    legalQuestion: null,
  },
  family_updates: {
    boardRef: 'A10',
    legalQuestion: 'Consent and data rules for sharing a traveller\'s trip updates with family by link (who sees what, how long the link lives).',
  },
  academy: {
    boardRef: 'A13',
    legalQuestion: 'Written consent of every person filmed or photographed for lessons and stories, and how long it lasts.',
  },
  guide_invites: {
    boardRef: 'A6',
    legalQuestion: null,
  },
  google_checklist: {
    boardRef: 'A1',
    legalQuestion: null,
  },
  destination_pages: {
    boardRef: 'A2',
    legalQuestion: null,
  },
  rate_card: {
    boardRef: 'A3',
    legalQuestion: null,
  },
  verified_reviews: {
    boardRef: 'A4',
    legalQuestion: null,
  },
  quote_pdf: {
    boardRef: 'A7',
    legalQuestion: null,
  },
  availability: {
    boardRef: 'A8',
    legalQuestion: null,
  },
  refund_rules: {
    boardRef: 'A9',
    legalQuestion: null,
  },
  safety_basics: {
    boardRef: 'A10',
    legalQuestion: 'Liability for safety information and emergency numbers shown to travellers, and the consented share link.',
  },
  trip_planner: {
    boardRef: 'A11',
    legalQuestion: null,
  },
  group_matching: {
    boardRef: 'A12',
    legalQuestion: null,
  },
  farm_page: {
    boardRef: 'A14',
    legalQuestion: null,
  },
  price_alerts: {
    boardRef: 'A16',
    legalQuestion: 'Marketing consent for price alert sign-ups (how consent is asked, kept and withdrawn).',
  },
  offline_web: {
    boardRef: 'A17',
    legalQuestion: null,
  },
  cover_gallery: {
    boardRef: 'RP5',
    legalQuestion: null,
  },
  photo_share: {
    boardRef: 'RP6',
    legalQuestion: null,
  },
  profile_links: {
    boardRef: 'RP3',
    legalQuestion: null,
  },
  local_prices: {
    boardRef: 'decision 7',
    legalQuestion: null,
  },
  park_rules: {
    boardRef: '2026-11-24 Walter statements',
    legalQuestion: null,
  },
  library_picks: {
    boardRef: 'RP7',
    legalQuestion: null,
  },
  vip_hosts: {
    boardRef: 'W1-3',
    legalQuestion: 'Which licence a VIP host needs and what the service may include (docs/legal/vip-and-investment-hosts.md).',
  },
  investment_hosts: {
    boardRef: 'W1-3',
    legalQuestion: 'Which licence an investment visit host needs, and how to keep it logistics only, never advice (docs/legal/vip-and-investment-hosts.md).',
  },
  crew_accounts: {
    boardRef: 'RP9',
    legalQuestion: 'Porter employment, minimum wage and the 18+ rule; whether guides vouching for porters is allowed and enough.',
  },
  crew_porter: {
    boardRef: 'RP9',
    legalQuestion: 'Porter ID from an NGO as proof (Walter\'s statement, to confirm), employment and park rules for porters.',
  },
  crew_cook: {
    boardRef: 'RP9',
    legalQuestion: 'Employment rules and any food handling certificate for trip cooks.',
  },
  crew_camp_crew: {
    boardRef: 'RP9',
    legalQuestion: 'Employment rules for camp crew.',
  },
  crew_driver: {
    boardRef: 'RP9',
    legalQuestion: 'Which driving licence class and transport licence a driver needs.',
  },
  crew_assistant_guide: {
    boardRef: 'RP9',
    legalQuestion: 'Whether an assistant guide needs a guide licence, and from which body (TTB or TANAPA).',
  },
  crew_other: {
    boardRef: 'RP9',
    legalQuestion: 'Employment rules for other crew roles.',
  },
  driver_guide: {
    boardRef: 'RP8',
    legalQuestion: 'Which driving licence class a driver guide needs (Walter says class C, to verify) and whether driving guests needs a transport licence.',
  },
  hotel_reps: {
    boardRef: 'RP10',
    legalQuestion: 'Who is responsible for what a hotel representative says or agrees on the hotel\'s behalf.',
  },
  service_consultant: {
    boardRef: 'RP8, RP11',
    legalQuestion: 'Whether paid travel advice by call needs a licence.',
  },
  service_concierge: {
    boardRef: 'RP8',
    legalQuestion: 'Which licence a guide needs to offer a VIP host service (docs/legal/vip-and-investment-hosts.md).',
  },
  service_trip_runner: {
    boardRef: 'RP11',
    legalQuestion: 'Whether running a trip for others counts as tour operating (MNRT or TALA licence).',
  },
  service_photographer: {
    boardRef: 'RP11',
    legalQuestion: 'Consent for people in photos, and any filming permit in parks.',
  },
  service_translator: {
    boardRef: 'RP11',
    legalQuestion: 'Whether interpreting for travellers needs a licence or permit.',
  },
  marketplace: {
    boardRef: '2026-11-26 Marketplace',
    legalQuestion: 'Selling used goods and rentals, banned goods (wildlife products, gemstones), seller identity and commission disclosure.',
  },
  marketplace_rentals: {
    boardRef: '2026-11-26 Marketplace',
    legalQuestion: 'Consumer rules for rentals and the deposit note (Kwetuly holds no deposit).',
  },
  marketplace_checkout: {
    boardRef: '2026-11-26 Marketplace',
    legalQuestion: 'Taking payment for goods sold by others (needs B1 split settlement first).',
  },
  payments_live: {
    boardRef: 'B1',
    legalQuestion: null,
  },
  save_to_travel: {
    boardRef: 'B5',
    legalQuestion: 'Is saving money toward a trip a savings or e-money product that needs a BoT licence (2026-11-24 decision 9 had dropped it)?',
  },
  payments_manual: {
    boardRef: 'payments-engineer 2026-11-26',
    legalQuestion: 'Taking traveller payments to a Lipa number before company registration: who holds the money, BoT rules, receipts and refunds.',
  },
  split_settlement: {
    boardRef: 'B1',
    legalQuestion: 'Does a split through a licensed partner mean Kwetuly holds no funds (BoT)? Needs company registration and a live merchant account.',
  },
  mobile_money: {
    boardRef: 'B2',
    legalQuestion: 'Currency display and exchange-rate wording rules for mobile money payments.',
  },
  tips: {
    boardRef: 'B3',
    legalQuestion: 'Is a tipping QR with no fee and no holding outside payment rules; privacy of the guide\'s number.',
  },
  crew_payouts: {
    boardRef: 'B4',
    legalQuestion: 'Minimum wage order, employer status and payout licence.',
  },
  instalments: {
    boardRef: 'B5',
    legalQuestion: 'Instalments on one booked trip versus a savings product (BoT).',
  },
  insurance_rescue: {
    boardRef: 'B6',
    legalQuestion: 'TIRA licence of the partner and Kwetuly\'s role (agent or referral).',
  },
  meet_and_greet: {
    boardRef: 'B7',
    legalQuestion: 'MNRT transport licence; no airport pickup booking while transfers are off (2026-11-22 decision 9).',
  },
  transfers_driving: {
    boardRef: 'B7',
    legalQuestion: 'MNRT transport licence for transfers.',
  },
  sim_listings: {
    boardRef: 'B8',
    legalQuestion: 'Telco and eSIM terms, consumer rules, commission disclosure.',
  },
  operator_channel: {
    boardRef: 'B9',
    legalQuestion: 'Commission contract and the MNRT rule for foreign sellers.',
  },
  ship_home: {
    boardRef: 'B10',
    legalQuestion: 'Customs and export rules, banned goods (wildlife, gemstones).',
  },
  corporate_groups: {
    boardRef: 'B11',
    legalQuestion: 'Group and conference terms, minors\' safeguarding.',
  },
  jobs_contact_fees: {
    boardRef: 'B12',
    legalQuestion: 'Is charging for job contacts a placement fee; never paid by the job seeker.',
  },
  crew_verification_fees: {
    boardRef: 'B12',
    legalQuestion: 'Who may be charged for crew verification (the vouching guide or operator, not the porter) and the legal hold on job-seeker fees.',
  },
};

# Kwetuly

Guide-first travel platform for Africa, starting in Tanzania. Website: `apps/web` (Next.js). iOS/Android app: `apps/mobile` (Expo; read `apps/mobile/AGENTS.md` first). Shared code and the 7-language dictionaries: `packages/shared`. Database: Supabase, migrations in `supabase/migrations`.

## The AI team

Walter (founder) approves every decision. The team lives in `.claude/agents/`:

| Role | Agent | Does |
| --- | --- | --- |
| Supervisor | `chief-of-staff` | Plans multi-step work, assigns it to agents, keeps `docs/team/board.md`, brings decisions to Walter |
| | `business-manager` | Revenue, pricing, budgets, targets, unit economics, go/no-go from a business view |
| Technology | `tech-lead` | Understands the whole system, architecture, audits, priorities |
| | `frontend-engineer` | Website and app screens |
| | `backend-engineer` | Database, server rules, integrations |
| | `payments-engineer` | Deposits, refunds, payouts, commission, reconciliation |
| | `devops` | Hosting, app builds and releases, monitoring, backups |
| | `security-reviewer` | Independent security and privacy review |
| | `qa-tester` | Tests flows like real users, release readiness |
| | `designer` | Looks, icons, brand, Figma |
| | `localization` | The 7 languages, money, dates and phone formats |
| Operations | `operations-manager` | Approval queues, checklists, service levels, safety procedures |
| | `customer-care` | Replies, FAQs, complaints |
| Growth | `guide-success` | Guides: recruiting, onboarding, support |
| | `partnerships` | Hotels, apartments, shops, transport: listings, badges, agreements |
| | `marketing` | Strategy, campaigns, SEO, agency partnerships |
| | `conversion` | Where people give up, honest fixes and A/B tests |
| | `data-analyst` | Tracking, weekly scorecard, unit economics |
| | `social-media` | Posts and captions |
| Back office | `accounting` | Finance: statements, invoices, budgets |
| | `legal` | Drafts for a Tanzanian advocate, licences and rules |
| | `hr` | Hiring, vetting, codes of conduct |

Agents cannot call each other. The main conversation is the dispatcher:
1. When Walter asks for something that needs more than one role, or asks "what should we do next?", run `chief-of-staff` first for the plan.
2. Run the agents it names, in its order, passing each the inputs it listed. Run independent ones in parallel.
3. Stop at every "Waiting for Walter" point and ask him; never skip an approval.
4. Report back briefly: what each agent produced, the decisions needed, and the updated board.

Building and reviewing stay separate: engineers' work is checked by `qa-tester`, and by `security-reviewer` when it touches sign-in, personal data, uploads or money. No agent approves its own work.

## Rules for everyone

- Agents prepare; Walter decides. Nobody posts, sends, pays, signs, deletes real data or contacts real people or authorities without Walter.
- Never invent facts, prices, ratings, reviews or partners. Sample guides and listings (`is_sample`) are test data and are always labelled.
- The paid "Checked by Kwetuly" badge says what was checked and when, never "recommended". Commissions are disclosed to travellers. Visa and insurance link only to official sites.
- Brand: green `#1D951A` for actions, gold `#ffb627`, grey `#7F7F7F`, 5px corners, no all caps, no arrows on buttons. Traveller texts in all 7 languages; guide and owner texts in English and Kiswahili.
- Secrets only in `.env.local`. Test accounts in `supabase/test-accounts.local.md` (git-ignored); use only on localhost and never repeat them.
- Before declaring work done: `npx tsc --noEmit -p .` in `apps/web` and `apps/mobile`, `npx expo lint` in `apps/mobile`, `npm test --workspace packages/shared`.

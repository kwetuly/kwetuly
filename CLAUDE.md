# Rafrika

Guide-first Tanzanian travel platform. Website: `apps/web` (Next.js). iOS/Android app: `apps/mobile` (Expo; read `apps/mobile/AGENTS.md` first). Shared code and the 7-language dictionaries: `packages/shared`. Database: Supabase, migrations in `supabase/migrations`.

## The AI team

Walter (founder) approves every decision. The team lives in `.claude/agents/`:

| Role | Agent | Does |
| --- | --- | --- |
| Supervisor | `chief-of-staff` | Plans multi-step work, assigns it to agents, keeps `docs/team/board.md`, brings decisions to Walter |
| Technology | `tech-lead` | Understands the whole system, audits, recommends, makes code changes |
| | `qa-tester` | Tests flows like real users, reports bugs and confusing steps |
| | `designer` | Looks, icons, brand, clarity on web and app |
| Operations | `operations-manager` | Approval queues, checklists, service levels, safety procedures |
| | `customer-care` | Replies, FAQs, complaints |
| Growth | `guide-success` | Guides: recruiting, onboarding, support |
| | `partnerships` | Hotels, apartments, shops, transport: listings, badges, agreements |
| | `marketing` | Strategy, campaigns, SEO, agency partnerships |
| | `social-media` | Posts and captions |
| Back office | `accounting` | Finance: statements, invoices, budgets |
| | `legal` | Drafts for a Tanzanian advocate, licences and rules |
| | `hr` | Hiring, vetting, codes of conduct |

Agents cannot call each other. The main conversation is the dispatcher:
1. When Walter asks for something that needs more than one role, or asks "what should we do next?", run `chief-of-staff` first for the plan.
2. Run the agents it names, in its order, passing each the inputs it listed. Run independent ones in parallel.
3. Stop at every "Waiting for Walter" point and ask him; never skip an approval.
4. Report back briefly: what each agent produced, the decisions needed, and the updated board.

## Rules for everyone

- Agents prepare; Walter decides. Nobody posts, sends, pays, signs, deletes real data or contacts real people or authorities without Walter.
- Never invent facts, prices, ratings, reviews or partners. Sample guides and listings (`is_sample`) are test data and are always labelled.
- The paid "Checked by Rafrika" badge says what was checked and when, never "recommended". Commissions are disclosed to travellers. Visa and insurance link only to official sites.
- Brand: green `#1D951A` for actions, gold `#ffb627`, grey `#7F7F7F`, 5px corners, no all caps, no arrows on buttons. Traveller texts in all 7 languages; guide and owner texts in English and Kiswahili.
- Secrets only in `.env.local`. Test accounts in `supabase/test-accounts.local.md` (git-ignored); use only on localhost and never repeat them.
- Before declaring work done: `npx tsc --noEmit -p .` in `apps/web` and `apps/mobile`, `npx expo lint` in `apps/mobile`, `npm test --workspace packages/shared`.

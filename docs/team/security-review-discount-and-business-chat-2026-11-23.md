# Security review: group discount and business chat (d4c8f1c, 22d8e4d, 48a87f5), 2026-11-23

By `security-reviewer`, code reading only. Saved by the main session from the reviewer's report.

**Summary:** guide threads behave as before; no client can create a business thread; owner identity is server-side; the traveller shows by first name; the discount cannot push commission to zero. Two gaps break the rule that masking can never be turned off for business threads (H1, M1).

## High
**H1. Participants can write unmasked contact details into inbox fields.** `guard_conversation_update` does not freeze `last_message_preview`, `traveler_name` or `created_at`, and there are no column-level update grants. A business owner (or traveller) can put a phone number in the preview the other side sees. This also exists today for guide threads. Fix: freeze those columns for non-trusted callers, or grant update on the read-time columns only.

## Medium
- **M1.** Admins and the service role can turn a business thread into a guide thread (or another business's) and then unlock it. Fix: freeze `traveler_id`, `guide_id`, `provider_id` for every caller.
- **M2.** Business-thread messages are kept forever, undoing the 30-day note rule for the same data. Fix: a retention period for message bodies and a notice in the chat. [legal]
- **M3.** A request opens a permanent channel with no close or block. Fix: allow sending only while a reservation is open or for N days after it.
- **M4.** The owner-declared discount (up to 50%) can halve Kwetuly's commission. Fix options: lower cap, delayed changes, "Did you pay the price shown?", admin reporting. Business decision.

## Low
L1 business deletion deletes the traveller's chat; L2 a new owner inherits history; L3 the owner can read `traveler_id`; L4 admin moderation shows business threads with a blank name; L5 discount can be set on restaurant services directly; L6 shared arithmetic uses floating point while SQL uses numeric.

## Checked and fine
Client creation of business threads is impossible; threads are created only by `place_reservation`; owner identity is server-side; membership and message policies go through `in_conversation`; `mask_message` depends only on `contact_unlocked`; alerts match the guide alert shape and never carry the traveller's contact; discount is copied at request time, frozen, bounded and only applies to percent rates.

## Not checked
Live database, advisors, realtime publication, the chat screen changes in progress, npm audit.

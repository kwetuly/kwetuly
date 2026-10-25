#!/bin/sh
# Run ONLY AFTER migration 20261025000000_brand_rename_kwetuly.sql is applied to the database the code uses.
# Switches every code reference from the column rafrika_pct to kwetuly_pct (reads, admin form, types, test).
# Safe to run while other edits are in progress: it only rewrites the identifier rafrika_pct.
set -e
cd /c/Users/walte/Projects/rafrika
sed -i 's/rafrika_pct/kwetuly_pct/g' \
  "apps/web/src/app/[lang]/admin/actions.ts" \
  "apps/web/src/app/[lang]/admin/commissions/page.tsx" \
  "apps/web/src/app/[lang]/dashboard/business-sales.tsx" \
  apps/mobile/src/components/referral.tsx \
  apps/mobile/src/lib/businesses.ts \
  packages/shared/src/businesses.ts \
  packages/shared/src/shared.test.ts
grep -rn rafrika_pct apps packages --include=*.ts --include=*.tsx | grep -v node_modules || echo "No rafrika_pct left in code."

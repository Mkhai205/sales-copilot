#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  Sales Copilot - Commerce Subsystem Verification Suite"
echo "=========================================================="

run_step() {
    local name="$1"
    shift
    echo ""
    echo "[STEP] $name..."
    "$@"
    echo "[PASS] $name"
}

# 1. Typecheck and Test shared-contracts
run_step "Shared Contracts Typecheck" pnpm nx run shared-contracts:typecheck
run_step "Shared Contracts Unit Tests" pnpm nx test shared-contracts

# 2. Server Commerce Unit & Stress Tests
run_step "Commerce Shipping Carrier Service Unit Tests" node -r @swc-node/register --test apps/server/src/modules/commerce/shipping/__tests__/shipping.service.spec.ts
run_step "Commerce 3PL Carrier Adapters (GHTK/GHN/Custom) Tests" node -r @swc-node/register --test apps/server/src/modules/commerce/shipping/__tests__/carrier-adapters.spec.ts
run_step "Commerce Realtime Chat Receipt & Status Event Listener Tests" node -r @swc-node/register --test apps/server/src/modules/commerce/listeners/__tests__/commerce-event.listener.spec.ts
run_step "Commerce AI Order Extractor Tests" node -r @swc-node/register --test apps/server/src/modules/commerce/automation/__tests__/order-extractor.service.spec.ts
run_step "Commerce Concurrency Stress Tests (20 Parallel Threads)" node -r @swc-node/register --test apps/server/src/modules/commerce/orders/__tests__/commerce-concurrency.spec.ts
run_step "Commerce Multi-Tenancy Data Isolation Tests" node -r @swc-node/register --test apps/server/src/modules/commerce/orders/__tests__/commerce-multitenancy.spec.ts

# 3. Web Vector & Thermal Engine Tests
run_step "Web Code128 Barcode Vector Engine Tests" node -r @swc-node/register -r tsconfig-paths/register --test apps/web/src/features/commerce/lib/__tests__/code128-svg.spec.ts

# 4. Static Type Verification
run_step "Server TypeScript Typecheck" pnpm nx run server:typecheck
run_step "Web Frontend TypeScript Typecheck" pnpm nx run web:typecheck

echo ""
echo "=========================================================="
echo "  All Commerce Subsystem Verification Checks PASSED (100%)"
echo "=========================================================="

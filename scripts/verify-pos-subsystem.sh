#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  Sales Copilot - In-Chat POS Subsystem Verification Suite"
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

# 2. Server POS Unit & Stress Tests
run_step "POS Shipping Carrier Service Unit Tests" node -r @swc-node/register --test apps/server/src/modules/pos/shipping/__tests__/shipping.service.spec.ts
run_step "POS 3PL Carrier Adapters (GHTK/GHN/Custom) Tests" node -r @swc-node/register --test apps/server/src/modules/pos/shipping/__tests__/carrier-adapters.spec.ts
run_step "POS Realtime Chat Receipt & Status Event Listener Tests" node -r @swc-node/register --test apps/server/src/modules/pos/listeners/__tests__/pos-event.listener.spec.ts
run_step "POS AI Order Extractor Tests" node -r @swc-node/register --test apps/server/src/modules/pos/automation/__tests__/order-extractor.service.spec.ts
run_step "POS Concurrency Stress Tests (20 Parallel Threads)" node -r @swc-node/register --test apps/server/src/modules/pos/orders/__tests__/pos-concurrency.spec.ts
run_step "POS Multi-Tenancy Data Isolation Tests" node -r @swc-node/register --test apps/server/src/modules/pos/orders/__tests__/pos-multitenancy.spec.ts

# 3. Web Vector & Thermal Engine Tests
run_step "Web Code128 Barcode Vector Engine Tests" node -r @swc-node/register -r tsconfig-paths/register --test apps/web/src/features/pos/lib/__tests__/code128-svg.spec.ts

# 3. Static Type Verification
run_step "Server TypeScript Typecheck" pnpm nx run server:typecheck
run_step "Web Frontend TypeScript Typecheck" pnpm nx run web:typecheck

echo ""
echo "=========================================================="
echo "  All POS Subsystem Verification Checks PASSED (100%)"
echo "=========================================================="

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Sales Copilot - Commerce Subsystem Verification Suite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

function Run-Step {
    param(
        [string]$Name,
        [scriptblock]$Command
    )
    Write-Host "`n[STEP] $Name..." -ForegroundColor Yellow
    try {
        & $Command
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
            throw "Command failed with exit code $LASTEXITCODE"
        }
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    catch {
        Write-Host "[FAIL] ${Name}: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 1. Typecheck and Test shared-contracts
Run-Step "Shared Contracts Typecheck" {
    pnpm nx run shared-contracts:typecheck
}

Run-Step "Shared Contracts Unit Tests" {
    pnpm nx test shared-contracts
}

# 2. Server Commerce Unit & Stress Tests
Run-Step "Commerce Shipping Carrier Service Unit Tests" {
    node -r @swc-node/register --test apps/server/src/modules/commerce/shipping/__tests__/shipping.service.spec.ts
}

Run-Step "Commerce 3PL Carrier Adapters (GHTK/GHN/Custom) Tests" {
    node -r @swc-node/register --test apps/server/src/modules/commerce/shipping/__tests__/carrier-adapters.spec.ts
}

Run-Step "Commerce Realtime Chat Receipt & Status Event Listener Tests" {
    node -r @swc-node/register --test apps/server/src/modules/commerce/listeners/__tests__/commerce-event.listener.spec.ts
}

Run-Step "Commerce AI Order Extractor Tests" {
    node -r @swc-node/register --test apps/server/src/modules/commerce/automation/__tests__/order-extractor.service.spec.ts
}

Run-Step "Commerce Concurrency Stress Tests (20 Parallel Threads)" {
    node -r @swc-node/register --test apps/server/src/modules/commerce/orders/__tests__/commerce-concurrency.spec.ts
}

Run-Step "Commerce Multi-Tenancy Data Isolation Tests" {
    node -r @swc-node/register --test apps/server/src/modules/commerce/orders/__tests__/commerce-multitenancy.spec.ts
}

# 3. Web Vector & Thermal Engine Tests
Run-Step "Web Code128 Barcode Vector Engine Tests" {
    node -r @swc-node/register -r tsconfig-paths/register --test apps/web/src/features/commerce/lib/__tests__/code128-svg.spec.ts
}

# 4. Static Type Verification
Run-Step "Server TypeScript Typecheck" {
    pnpm nx run server:typecheck
}

Run-Step "Web Frontend TypeScript Typecheck" {
    pnpm nx run web:typecheck
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  All Commerce Subsystem Verification Checks PASSED (100%)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Sales Copilot - In-Chat POS Subsystem Verification Suite" -ForegroundColor Cyan
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

# 2. Server POS Unit & Stress Tests
Run-Step "POS Shipping Carrier Service Unit Tests" {
    node -r @swc-node/register --test apps/server/src/modules/pos/shipping/__tests__/shipping.service.spec.ts
}

Run-Step "POS 3PL Carrier Adapters (GHTK/GHN/Custom) Tests" {
    node -r @swc-node/register --test apps/server/src/modules/pos/shipping/__tests__/carrier-adapters.spec.ts
}

Run-Step "POS Realtime Chat Receipt & Status Event Listener Tests" {
    node -r @swc-node/register --test apps/server/src/modules/pos/listeners/__tests__/pos-event.listener.spec.ts
}

Run-Step "POS AI Order Extractor Tests" {
    node -r @swc-node/register --test apps/server/src/modules/pos/automation/__tests__/order-extractor.service.spec.ts
}

Run-Step "POS Concurrency Stress Tests (20 Parallel Threads)" {
    node -r @swc-node/register --test apps/server/src/modules/pos/orders/__tests__/pos-concurrency.spec.ts
}

Run-Step "POS Multi-Tenancy Data Isolation Tests" {
    node -r @swc-node/register --test apps/server/src/modules/pos/orders/__tests__/pos-multitenancy.spec.ts
}

# 3. Web Vector & Thermal Engine Tests
Run-Step "Web Code128 Barcode Vector Engine Tests" {
    node -r @swc-node/register -r tsconfig-paths/register --test apps/web/src/features/pos/lib/__tests__/code128-svg.spec.ts
}

# 3. Static Type Verification
Run-Step "Server TypeScript Typecheck" {
    pnpm nx run server:typecheck
}

Run-Step "Web Frontend TypeScript Typecheck" {
    pnpm nx run web:typecheck
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  All POS Subsystem Verification Checks PASSED (100%)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

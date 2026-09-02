import request from 'supertest';
import {
  createTestApp,
  seedTestData,
  cleanupTestData,
  loginAsAgent,
  TestAppContext,
  SeedTestContext,
} from './helpers';

describe('E2E Test Infrastructure Verification (Task 13 — Feature F-1.11.1)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    if (seedCtx && ctx?.prisma) {
      await cleanupTestData(ctx.prisma, seedCtx);
    }
    if (ctx) {
      await ctx.close();
    }
  });

  it('should successfully boot the full application and respond to health check (GET /api/v1/health)', async () => {
    const res = await request(ctx.httpServer).get('/api/v1/health').expect(200);

    const body = res.body;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(['ok', 'degraded']).toContain(body.data.status);
    expect(body.data.dependencies).toBeDefined();
    expect(body.data.dependencies.database.status).toBe('up');
  });

  it('should seed isolated multi-tenant test data into sales_copilot_test database', async () => {
    seedCtx = await seedTestData(ctx.prisma);

    expect(seedCtx.workspace).toBeDefined();
    expect(seedCtx.workspace.id).toBeDefined();
    expect(seedCtx.adminUser).toBeDefined();
    expect(seedCtx.agentUser).toBeDefined();
    expect(seedCtx.inbox).toBeDefined();
    expect(seedCtx.channel).toBeDefined();
    expect(seedCtx.contact).toBeDefined();
    expect(seedCtx.channelIdentity).toBeDefined();

    // Verify records exist directly in database
    const dbWorkspace = await ctx.prisma.client.workspace.findUnique({
      where: { id: seedCtx.workspace.id },
    });
    expect(dbWorkspace).not.toBeNull();
    expect(dbWorkspace?.slug).toBe(seedCtx.workspace.slug);

    const dbContact = await ctx.prisma.client.contact.findUnique({
      where: { id: seedCtx.contact.id },
    });
    expect(dbContact).not.toBeNull();
    expect(dbContact?.workspaceId).toBe(seedCtx.workspace.id);
  });

  it('should authenticate as agent and access protected endpoints using both Bearer token and Cookie', async () => {
    const loginResult = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });

    expect(loginResult.accessToken).toBeDefined();
    expect(loginResult.authHeader).toMatch(/^Bearer\s.+/);
    expect(loginResult.cookieHeader).toContain('access_token=');
    expect(loginResult.user.email).toBe(seedCtx.agentUser.email);

    // 1. Access protected route with Bearer Token header
    const bearerRes = await request(ctx.httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', loginResult.authHeader)
      .expect(200);

    expect(bearerRes.body.success).toBe(true);
    expect(bearerRes.body.data.email).toBe(seedCtx.agentUser.email);

    // 2. Access protected route with Cookie header
    const cookieRes = await request(ctx.httpServer)
      .get('/api/v1/auth/me')
      .set('Cookie', loginResult.cookieHeader)
      .expect(200);

    expect(cookieRes.body.success).toBe(true);
    expect(cookieRes.body.data.email).toBe(seedCtx.agentUser.email);
  });

  it('should cleanly purge seeded test data without foreign key violations', async () => {
    await cleanupTestData(ctx.prisma, seedCtx);

    // Verify workspace was removed
    const deletedWorkspace = await ctx.prisma.client.workspace.findUnique({
      where: { id: seedCtx.workspace.id },
    });
    expect(deletedWorkspace).toBeNull();

    // Verify users were removed
    const deletedAgent = await ctx.prisma.client.user.findUnique({
      where: { id: seedCtx.agentUser.id },
    });
    expect(deletedAgent).toBeNull();

    const deletedAdmin = await ctx.prisma.client.user.findUnique({
      where: { id: seedCtx.adminUser.id },
    });
    expect(deletedAdmin).toBeNull();
  });
});

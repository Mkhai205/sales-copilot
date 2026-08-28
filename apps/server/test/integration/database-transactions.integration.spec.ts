import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../src/infrastructure/database/generated/client';

describe('Database & Transaction Integration Tests (PostgreSQL — FINDING-P9-01)', () => {
  let pool: Pool;
  let prisma: PrismaClient;

  const testRunId = Date.now().toString(36);
  const testUserEmail = `integ-user-${testRunId}@salescopilot.io`;
  const testSlugBase = `integ-slug-${testRunId}`;

  let createdUserId: string;
  const createdWorkspaceIds: string[] = [];

  before(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required for integration tests');
    }

    pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    await prisma.$connect();

    // Create a base user for foreign keys
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforintegrationtesting',
        name: 'Integration Test User',
      },
    });
    createdUserId = user.id;
  });

  after(async () => {
    try {
      // Cleanup all created workspaces (cascades related records)
      if (createdWorkspaceIds.length > 0) {
        await prisma.workspace.deleteMany({
          where: { id: { in: createdWorkspaceIds } },
        });
      }

      // Cleanup test user
      if (createdUserId) {
        await prisma.user.deleteMany({
          where: { id: createdUserId },
        });
      }
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  });

  it('should enforce unique slug constraint and throw P2002 on collision', async () => {
    const slug = `${testSlugBase}-unique`;

    // 1. Create first workspace
    const ws1 = await prisma.workspace.create({
      data: {
        name: 'Workspace One',
        slug,
      },
    });
    createdWorkspaceIds.push(ws1.id);

    // 2. Attempt to create second workspace with identical slug -> must fail with P2002
    await assert.rejects(
      async () => {
        await prisma.workspace.create({
          data: {
            name: 'Workspace Two Duplicate',
            slug,
          },
        });
      },
      (err: any) => {
        assert.strictEqual(err instanceof Prisma.PrismaClientKnownRequestError, true);
        assert.strictEqual(err.code, 'P2002');
        return true;
      },
    );
  });

  it('should cleanly recover from unique slug collision and succeed on suffix retry', async () => {
    const slug = `${testSlugBase}-retry`;

    // 1. First workspace takes base slug
    const ws1 = await prisma.workspace.create({
      data: {
        name: 'Retry Test Original',
        slug,
      },
    });
    createdWorkspaceIds.push(ws1.id);

    // 2. Simulate collision retry flow: catch P2002 and retry with -2
    let ws2: any;
    try {
      ws2 = await prisma.workspace.create({
        data: {
          name: 'Retry Test Second',
          slug,
        },
      });
      createdWorkspaceIds.push(ws2.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        ws2 = await prisma.workspace.create({
          data: {
            name: 'Retry Test Second',
            slug: `${slug}-2`,
          },
        });
        createdWorkspaceIds.push(ws2.id);
      } else {
        throw err;
      }
    }

    assert.ok(ws2);
    assert.strictEqual(ws2.slug, `${slug}-2`);
  });

  it('should enforce multi-tenant isolation on contact identifiers across different workspaces', async () => {
    // 1. Create two isolated workspaces
    const wsA = await prisma.workspace.create({
      data: { name: 'Workspace A', slug: `${testSlugBase}-tenant-a` },
    });
    const wsB = await prisma.workspace.create({
      data: { name: 'Workspace B', slug: `${testSlugBase}-tenant-b` },
    });
    createdWorkspaceIds.push(wsA.id, wsB.id);

    const contactIdentifier = `external-crm-id-${testRunId}`;

    // 2. Create contact in Workspace A
    const contactA = await prisma.contact.create({
      data: {
        workspaceId: wsA.id,
        identifier: contactIdentifier,
        name: 'Customer In Workspace A',
      },
    });

    // 3. Create contact with SAME identifier in Workspace B -> must SUCCEED due to @@unique([workspaceId, identifier])
    const contactB = await prisma.contact.create({
      data: {
        workspaceId: wsB.id,
        identifier: contactIdentifier,
        name: 'Customer In Workspace B',
      },
    });

    assert.ok(contactA.id);
    assert.ok(contactB.id);
    assert.notStrictEqual(contactA.id, contactB.id);
    assert.strictEqual(contactA.workspaceId, wsA.id);
    assert.strictEqual(contactB.workspaceId, wsB.id);

    // 4. Duplicate identifier within the SAME workspace -> must FAIL with P2002
    await assert.rejects(
      async () => {
        await prisma.contact.create({
          data: {
            workspaceId: wsA.id,
            identifier: contactIdentifier,
            name: 'Duplicate In Workspace A',
          },
        });
      },
      (err: any) => {
        assert.strictEqual(err instanceof Prisma.PrismaClientKnownRequestError, true);
        assert.strictEqual(err.code, 'P2002');
        return true;
      },
    );
  });

  it('should prevent deleting contact with active conversation due to onDelete: Restrict (FINDING-P4-02)', async () => {
    const ws = await prisma.workspace.create({
      data: { name: 'Restrict Test WS', slug: `${testSlugBase}-restrict` },
    });
    createdWorkspaceIds.push(ws.id);

    const inbox = await prisma.inbox.create({
      data: {
        workspaceId: ws.id,
        name: 'Support Inbox',
      },
    });

    const contact = await prisma.contact.create({
      data: {
        workspaceId: ws.id,
        name: 'Protected Contact',
      },
    });

    await prisma.conversation.create({
      data: {
        workspaceId: ws.id,
        inboxId: inbox.id,
        contactId: contact.id,
        status: 'OPEN',
      },
    });

    // Attempting to delete contact while it has conversations must fail with P2003 (ForeignKeyConstraintViolation)
    await assert.rejects(
      async () => {
        await prisma.contact.delete({
          where: { id: contact.id },
        });
      },
      (err: any) => {
        assert.strictEqual(err instanceof Prisma.PrismaClientKnownRequestError, true);
        assert.strictEqual(err.code, 'P2003'); // Foreign key constraint failed
        return true;
      },
    );
  });

  it('should execute atomic transaction and rollback on failure', async () => {
    const ws = await prisma.workspace.create({
      data: { name: 'Tx Test WS', slug: `${testSlugBase}-tx` },
    });
    createdWorkspaceIds.push(ws.id);

    // Run transaction that creates a contact and then deliberately fails
    await assert.rejects(
      async () => {
        await prisma.$transaction(async tx => {
          await tx.contact.create({
            data: {
              workspaceId: ws.id,
              name: 'Temporary Contact',
              email: `temp-${testRunId}@example.com`,
            },
          });

          // Deliberately throw to trigger rollback
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        });
      },
      (err: any) => {
        assert.strictEqual(err.message, 'SIMULATED_TRANSACTION_FAILURE');
        return true;
      },
    );

    // Verify contact was NOT committed (atomic rollback)
    const contactsCount = await prisma.contact.count({
      where: {
        workspaceId: ws.id,
        email: `temp-${testRunId}@example.com`,
      },
    });
    assert.strictEqual(contactsCount, 0);
  });
});

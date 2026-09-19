import type { PrismaClient } from '../../src/infrastructure/database';

/**
 * Safely wipes mock data for a workspace in reverse foreign key order.
 * Only called when SEED_CLEAN=true or --clean is provided.
 */
export async function cleanWorkspaceData(
  prisma: PrismaClient,
  workspaceSlug: string = 'default-workspace',
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  });

  if (!workspace) {
    console.log(`ℹ️ [Clean] Workspace '${workspaceSlug}' does not exist yet. Skipping cleanup.`);
    return;
  }

  const workspaceId = workspace.id;
  console.log(
    `🧹 [Clean] Starting clean wipe of mock data for workspace: ${workspace.name} (${workspaceId})...`,
  );

  // 1. Delete Commerce Transactions & Orders (orders reference contacts/variants with Restrict)
  await prisma.inventoryTransaction.deleteMany({ where: { workspaceId } });
  await prisma.paymentTransaction.deleteMany({ where: { workspaceId } });
  await prisma.orderItem.deleteMany({ where: { workspaceId } });
  await prisma.order.deleteMany({ where: { workspaceId } });

  // 2. Delete Catalog (variants & products)
  await prisma.productVariant.deleteMany({ where: { workspaceId } });
  await prisma.product.deleteMany({ where: { workspaceId } });

  // 3. Delete Messaging & Conversations (conversations reference contacts with Restrict)
  await prisma.attachment.deleteMany({ where: { message: { workspaceId } } });
  await prisma.message.deleteMany({ where: { workspaceId } });
  await prisma.conversationLabel.deleteMany({ where: { conversation: { workspaceId } } });
  await prisma.conversation.deleteMany({ where: { workspaceId } });

  // 4. Delete Contacts & Channel Identities
  await prisma.channelIdentity.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });

  // 5. Delete Operations (labels, canned responses, audit logs)
  await prisma.cannedResponse.deleteMany({ where: { workspaceId } });
  await prisma.label.deleteMany({ where: { workspaceId } });
  await prisma.auditLog.deleteMany({ where: { workspaceId } });

  // 6. Delete Inboxes & Channels
  await prisma.channelEvent.deleteMany({ where: { channel: { workspaceId } } });
  await prisma.channel.deleteMany({ where: { workspaceId } });
  await prisma.inboxMember.deleteMany({ where: { inbox: { workspaceId } } });
  await prisma.inbox.deleteMany({ where: { workspaceId } });

  // 7. Delete Teams
  await prisma.teamMember.deleteMany({ where: { team: { workspaceId } } });
  await prisma.team.deleteMany({ where: { workspaceId } });

  console.log(`✅ [Clean] Successfully cleaned mock data for '${workspaceSlug}'.`);
}

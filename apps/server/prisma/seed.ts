import { getPrismaClient, closeDatabaseConnections } from '../src/infrastructure/database/client';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = getPrismaClient();

async function seed() {
  console.log('🌱 Starting database seed script (Omnichannel Conversation Core Baseline)...');

  // 1. Seed Users (SuperAdmin, Admin, Agent)
  const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'superadmin@salescopilot.io';
  const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'SalesCopilot@2026!';
  const passwordHash = await argon2.hash(defaultAdminPassword);

  const superAdmin = await prisma.user.upsert({
    where: { email: defaultAdminEmail },
    update: {
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email: defaultAdminEmail,
      passwordHash,
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=superadmin',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@salescopilot.io' },
    update: {
      name: 'Workspace Admin',
      role: 'USER',
      isActive: true,
    },
    create: {
      email: 'admin@salescopilot.io',
      passwordHash,
      name: 'Workspace Admin',
      role: 'USER',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
    },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: 'agent@salescopilot.io' },
    update: {
      name: 'Sarah Agent',
      role: 'USER',
      isActive: true,
    },
    create: {
      email: 'agent@salescopilot.io',
      passwordHash,
      name: 'Sarah Agent',
      role: 'USER',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarahagent',
    },
  });

  console.log(
    `👤 Users initialized: SuperAdmin (${superAdmin.email}), Admin (${adminUser.email}), Agent (${agentUser.email})`,
  );

  // 2. Seed Default Workspace (Tenant / Account)
  const defaultWorkspaceSlug = 'default-workspace';
  const defaultWorkspaceSettings = {
    currency: 'VND',
    features: {
      autoAssign: true,
      webhooks: true,
    },
    paymentSettings: {
      bankBin: '970422', // MBBank (Napas)
      bankCode: 'MB',
      bankName: 'MBBank',
      accountNumber: '0988123456',
      accountName: 'CONG TY SALES COPILOT',
      webhookSecret: 'sepay_test_secret_key_2026',
    },
  };

  const workspace = await prisma.workspace.upsert({
    where: { slug: defaultWorkspaceSlug },
    update: {
      name: 'Sales Copilot Default Workspace',
      billingPlan: 'ENTERPRISE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: defaultWorkspaceSettings,
    },
    create: {
      name: 'Sales Copilot Default Workspace',
      slug: defaultWorkspaceSlug,
      billingPlan: 'ENTERPRISE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: defaultWorkspaceSettings,
    },
  });

  console.log(`💼 Workspace initialized: ${workspace.name} (${workspace.id})`);

  // 3. Seed Workspace Memberships (OWNER, ADMIN, AGENT)
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: superAdmin.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      workspaceId: workspace.id,
      userId: superAdmin.id,
      role: 'OWNER',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: adminUser.id,
      },
    },
    update: { role: 'ADMIN' },
    create: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      role: 'ADMIN',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: agentUser.id,
      },
    },
    update: { role: 'AGENT' },
    create: {
      workspaceId: workspace.id,
      userId: agentUser.id,
      role: 'AGENT',
    },
  });

  // 4. Seed Default Team & Team Members
  const team = await prisma.team.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'Enterprise Support Team',
      },
    },
    update: {
      description: 'Dedicated team for omnichannel customer conversations and live support',
    },
    create: {
      workspaceId: workspace.id,
      name: 'Enterprise Support Team',
      description: 'Dedicated team for omnichannel customer conversations and live support',
    },
  });

  for (const user of [superAdmin, adminUser, agentUser]) {
    await prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        teamId: team.id,
        userId: user.id,
      },
    });
  }

  console.log(`👥 Team initialized: ${team.name} (${team.id}) with 3 members`);

  // 5. Seed Default Web Chat Inbox & Channel Connection (1:1 per Chatwoot model)
  let inbox = await prisma.inbox.findFirst({
    where: {
      workspaceId: workspace.id,
      name: 'Website Live Chat',
    },
  });

  if (!inbox) {
    inbox = await prisma.inbox.create({
      data: {
        workspaceId: workspace.id,
        name: 'Website Live Chat',
        isAutoAssignmentEnabled: true,
        settings: {
          greetingMessage: 'Xin chào! Em có thể hỗ trợ gì cho anh/chị hôm nay?',
        },
      },
    });
  }

  for (const user of [superAdmin, adminUser, agentUser]) {
    await prisma.inboxMember.upsert({
      where: {
        inboxId_userId: {
          inboxId: inbox.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        inboxId: inbox.id,
        userId: user.id,
      },
    });
  }

  let webChatChannel = await prisma.channel.findFirst({
    where: { inboxId: inbox.id },
  });

  if (!webChatChannel) {
    webChatChannel = await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        channelType: 'WEB_CHAT',
        providerAccountId: 'webchat_default',
        isConnected: true,
        settings: {
          widgetColor: '#2563eb',
          welcomeTitle: 'Hỗ trợ trực tuyến Sales Copilot',
        },
      },
    });
  }

  // Seed sample ChannelEvent for webhook idempotency
  await prisma.channelEvent.upsert({
    where: {
      channelId_externalEventId: {
        channelId: webChatChannel.id,
        externalEventId: 'evt_inbound_sample_001',
      },
    },
    update: {},
    create: {
      channelId: webChatChannel.id,
      externalEventId: 'evt_inbound_sample_001',
      eventType: 'message.incoming',
      payload: { text: 'Xin chào!', senderId: 'web_session_cust_001' },
      processedAt: new Date(),
    },
  });

  console.log(
    `📥 Inbox & Channel initialized: ${inbox.name} (${inbox.id}) ──► Channel (${webChatChannel.id}) [1:1 mapping]`,
  );

  // 6. Seed Sample Contact & ChannelIdentity (externalContactId scoped by channelId, unique identifier per workspace)
  let contact = await prisma.contact.findFirst({
    where: {
      workspaceId: workspace.id,
      identifier: 'CUST_VN_001',
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@example.com',
        phoneNumber: '+84988123456',
        identifier: 'CUST_VN_001',
        customAttributes: {
          company: 'Công ty Công nghệ Toàn Cầu',
          role: 'Giám đốc Kinh doanh (CCO)',
          employeesCount: 50,
        },
      },
    });
  }

  const channelIdentity = await prisma.channelIdentity.upsert({
    where: {
      channelId_externalContactId: {
        channelId: webChatChannel.id,
        externalContactId: 'web_session_cust_001',
      },
    },
    update: {},
    create: {
      contactId: contact.id,
      workspaceId: workspace.id,
      channelId: webChatChannel.id,
      externalContactId: 'web_session_cust_001',
      username: 'Nguyen Van A (Web)',
      metadata: {
        browser: 'Chrome 122',
        ip: '113.161.45.22',
        city: 'Ho Chi Minh City',
      },
    },
  });

  console.log(
    `👤 Contact & ChannelIdentity initialized: ${contact.name} ──► ${channelIdentity.externalContactId}`,
  );

  // 7. Seed Operations: Labels
  const labelsToSeed = [
    { title: 'VIP', color: '#f59e0b', description: 'Khách hàng trọng điểm' },
    { title: 'Support', color: '#ef4444', description: 'Cần hỗ trợ kỹ thuật gấp' },
    { title: 'Enterprise', color: '#6366f1', description: 'Khách hàng quy mô doanh nghiệp lớn' },
    { title: 'Báo giá', color: '#10b981', description: 'Đã gửi báo giá / Đang trao đổi dịch vụ' },
  ];

  const seededLabels: Record<string, string> = {};
  for (const labelData of labelsToSeed) {
    const label = await prisma.label.upsert({
      where: {
        workspaceId_title: {
          workspaceId: workspace.id,
          title: labelData.title,
        },
      },
      update: { color: labelData.color, description: labelData.description },
      create: {
        workspaceId: workspace.id,
        title: labelData.title,
        color: labelData.color,
        description: labelData.description,
      },
    });
    seededLabels[label.title] = label.id;
  }

  // 8. Seed Sample Conversation, Messages & ConversationLabel
  let conversation = await prisma.conversation.findFirst({
    where: {
      workspaceId: workspace.id,
      contactId: contact.id,
      inboxId: inbox.id,
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: contact.id,
        channelIdentityId: channelIdentity.id,
        assigneeId: superAdmin.id,
        teamId: team.id,
        status: 'OPEN',
        priority: 'HIGH',
        unreadMessagesCount: 0,
        customAttributes: { source: 'organic_search' },
      },
    });

    // Seed ConversationLabel relations (M:N source of truth)
    if (seededLabels['VIP']) {
      await prisma.conversationLabel.upsert({
        where: {
          conversationId_labelId: {
            conversationId: conversation.id,
            labelId: seededLabels['VIP'],
          },
        },
        update: {},
        create: {
          conversationId: conversation.id,
          labelId: seededLabels['VIP'],
        },
      });
    }

    if (seededLabels['Enterprise']) {
      await prisma.conversationLabel.upsert({
        where: {
          conversationId_labelId: {
            conversationId: conversation.id,
            labelId: seededLabels['Enterprise'],
          },
        },
        update: {},
        create: {
          conversationId: conversation.id,
          labelId: seededLabels['Enterprise'],
        },
      });
    }

    // Seed Messages with polymorphic sender & nullable senderId for SYSTEM
    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: contact.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Xin chào, tôi đang tìm kiếm giải pháp quản lý hội thoại đa kênh cho đội ngũ 50 nhân sự. Hệ thống có hỗ trợ tích hợp Zalo và Facebook không?',
          deliveryStatus: 'READ',
          externalId: 'msg_ext_incoming_001',
        },
        {
          conversationId: conversation.id,
          workspaceId: workspace.id,
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'ACTIVITY',
          contentType: 'TEXT',
          content:
            'Hội thoại được tự động gán cho Enterprise Support Team theo quy tắc Automation.',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_ext_activity_001',
        },
        {
          conversationId: conversation.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: superAdmin.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Chào anh Nguyễn Văn A! Nền tảng hội thoại đa kênh hỗ trợ kết nối trọn vẹn cả Zalo OA, Facebook Messenger, Telegram và Live Chat. Bên em có gói Enterprise rất phù hợp với quy mô 50 nhân sự. Em sẽ gửi tài liệu chi tiết qua email cho anh nhé!',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_ext_outgoing_002',
        },
      ],
    });
  }

  console.log(
    `💬 Conversation & Messages initialized: #${conversation.displayId} (${conversation.id})`,
  );

  // 9. Seed Operations: Canned Responses, Automation Rule & Webhooks
  const cannedResponsesToSeed = [
    {
      shortCode: '/chao',
      content: 'Dạ em chào anh/chị ạ! Em có thể hỗ trợ thông tin gì cho mình hôm nay ạ?',
    },
    {
      shortCode: '/baogia',
      content:
        'Dạ em gửi anh/chị thông tin báo giá gói Enterprise cho đội ngũ ạ. Anh/chị kiểm tra file đính kèm giúp em nhé!',
    },
    {
      shortCode: '/hotro',
      content:
        'Dạ đội ngũ kỹ thuật của bên em đã tiếp nhận thông tin và đang xử lý. Em sẽ phản hồi kết quả sớm nhất ạ!',
    },
  ];

  for (const canned of cannedResponsesToSeed) {
    await prisma.cannedResponse.upsert({
      where: {
        workspaceId_shortCode: {
          workspaceId: workspace.id,
          shortCode: canned.shortCode,
        },
      },
      update: { content: canned.content },
      create: {
        workspaceId: workspace.id,
        shortCode: canned.shortCode,
        content: canned.content,
      },
    });
  }

  const existingRule = await prisma.automationRule.findFirst({
    where: { workspaceId: workspace.id, name: 'Auto-assign Enterprise Conversations' },
  });
  if (!existingRule) {
    await prisma.automationRule.create({
      data: {
        workspaceId: workspace.id,
        name: 'Auto-assign Enterprise Conversations',
        description:
          'Tự động gán nhãn Enterprise và chuyển cho Support Team khi khách hỏi số lượng lớn',
        eventTrigger: 'MESSAGE_CREATED',
        conditions: [
          {
            attribute: 'message_content',
            filterOperator: 'contains',
            values: ['50 nhân sự', 'enterprise', 'báo giá'],
          },
        ],
        actions: [
          { actionName: 'add_label', actionParams: ['Enterprise', 'VIP'] },
          { actionName: 'assign_team', actionParams: [team.id] },
        ],
        isActive: true,
      },
    });
  }

  const existingWebhook = await prisma.webhookSubscription.findFirst({
    where: { workspaceId: workspace.id, url: 'https://webhook.site/sample-conversation-event' },
  });
  if (!existingWebhook) {
    const webhook = await prisma.webhookSubscription.create({
      data: {
        workspaceId: workspace.id,
        url: 'https://webhook.site/sample-conversation-event',
        subscriptions: ['conversation.created', 'message.created', 'conversation.status_updated'],
        isActive: true,
      },
    });

    await prisma.webhookDelivery.create({
      data: {
        subscriptionId: webhook.id,
        eventId: 'evt_sample_001',
        eventType: 'conversation.created',
        payload: { conversationId: conversation.id, status: 'OPEN' },
        status: 'DELIVERED',
        attemptCount: 1,
        responseStatus: 200,
        responseBody: '{"received": true}',
        deliveredAt: new Date(),
      },
    });
  }

  // 10. Seed POS Products and Variants
  const sampleProducts = [
    {
      name: 'Gói Bản Quyền Sales Copilot Enterprise (1 Năm)',
      slug: 'goi-ban-quyen-sales-copilot-enterprise-1-nam',
      description:
        'Gói giải pháp phần mềm quản trị bán hàng và hội thoại đa kênh AI dành cho doanh nghiệp vừa và lớn.',
      category: 'Phần mềm & Bản quyền',
      basePrice: 12000000,
      costPrice: 8000000,
      sku: 'SaaS-ENTERPRISE-1Y',
      barcode: '893850123001',
      imageUrl:
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&auto=format&fit=crop&q=60',
      variants: [
        {
          name: 'Tiêu chuẩn (50 Users)',
          sku: 'SaaS-ENTERPRISE-1Y-50U',
          barcode: '893850123002',
          price: 12000000,
          costPrice: 8000000,
          stockQuantity: 100,
          attributes: { users: '50', duration: '12 months' },
        },
        {
          name: 'Mở rộng (100 Users)',
          sku: 'SaaS-ENTERPRISE-1Y-100U',
          barcode: '893850123003',
          price: 20000000,
          costPrice: 14000000,
          stockQuantity: 50,
          attributes: { users: '100', duration: '12 months' },
        },
      ],
    },
    {
      name: 'Tai nghe Bluetooth Sony WH-1000XM5 Chống Ồn',
      slug: 'tai-nghe-bluetooth-sony-wh-1000xm5',
      description:
        'Tai nghe chụp tai không dây chống ồn đỉnh cao, thời lượng pin 30 giờ, đàm thoại sắc nét cho tư vấn viên.',
      category: 'Thiết bị & Phụ kiện',
      basePrice: 7990000,
      costPrice: 6200000,
      sku: 'SONY-WH1000XM5',
      barcode: '893850123004',
      imageUrl:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
      variants: [
        {
          name: 'Màu Đen (Black)',
          sku: 'SONY-WH1000XM5-BLK',
          barcode: '893850123005',
          price: 7990000,
          costPrice: 6200000,
          stockQuantity: 30,
          attributes: { color: 'Đen' },
        },
        {
          name: 'Màu Bạc (Silver)',
          sku: 'SONY-WH1000XM5-SLV',
          barcode: '893850123006',
          price: 7990000,
          costPrice: 6200000,
          stockQuantity: 25,
          attributes: { color: 'Bạc' },
        },
      ],
    },
    {
      name: 'Áo Polo Đồng Phục Doanh Nghiệp Sales Copilot',
      slug: 'ao-polo-dong-phuc-doanh-nghiep',
      description:
        'Áo thun polo chất liệu cotton co giãn 4 chiều cao cấp, thoáng khí và thấm hút mồ hôi tốt.',
      category: 'Đồng phục & Quà tặng',
      basePrice: 250000,
      costPrice: 150000,
      sku: 'POLO-CORP-2026',
      barcode: '893850123007',
      imageUrl:
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60',
      variants: [
        {
          name: 'Size L / Xanh Navy',
          sku: 'POLO-CORP-L-NAVY',
          barcode: '893850123008',
          price: 250000,
          costPrice: 150000,
          stockQuantity: 80,
          attributes: { size: 'L', color: 'Xanh Navy' },
        },
        {
          name: 'Size XL / Xanh Navy',
          sku: 'POLO-CORP-XL-NAVY',
          barcode: '893850123009',
          price: 250000,
          costPrice: 150000,
          stockQuantity: 60,
          attributes: { size: 'XL', color: 'Xanh Navy' },
        },
      ],
    },
  ];

  for (const prodData of sampleProducts) {
    const { variants, ...productFields } = prodData;
    const seededProduct = await prisma.product.upsert({
      where: {
        workspaceId_sku: {
          workspaceId: workspace.id,
          sku: productFields.sku,
        },
      },
      update: {
        name: productFields.name,
        basePrice: productFields.basePrice,
        costPrice: productFields.costPrice,
        description: productFields.description,
        category: productFields.category,
        imageUrl: productFields.imageUrl,
        barcode: productFields.barcode,
      },
      create: {
        workspaceId: workspace.id,
        name: productFields.name,
        slug: productFields.slug,
        description: productFields.description,
        category: productFields.category,
        basePrice: productFields.basePrice,
        costPrice: productFields.costPrice,
        sku: productFields.sku,
        barcode: productFields.barcode,
        imageUrl: productFields.imageUrl,
        isActive: true,
        trackInventory: true,
      },
    });

    for (const variant of variants) {
      const seededVariant = await prisma.productVariant.upsert({
        where: {
          workspaceId_sku: {
            workspaceId: workspace.id,
            sku: variant.sku,
          },
        },
        update: {
          name: variant.name,
          price: variant.price,
          costPrice: variant.costPrice,
          stockQuantity: variant.stockQuantity,
          barcode: variant.barcode,
          attributes: variant.attributes,
        },
        create: {
          workspaceId: workspace.id,
          productId: seededProduct.id,
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode,
          price: variant.price,
          costPrice: variant.costPrice,
          stockQuantity: variant.stockQuantity,
          reservedQuantity: 0,
          attributes: variant.attributes,
          isActive: true,
        },
      });

      // Seed initial stock transaction if none exists
      const existingTx = await prisma.inventoryTransaction.findFirst({
        where: { variantId: seededVariant.id, workspaceId: workspace.id },
      });
      if (!existingTx && variant.stockQuantity > 0) {
        await prisma.inventoryTransaction.create({
          data: {
            workspaceId: workspace.id,
            variantId: seededVariant.id,
            type: 'STOCK_IN',
            quantity: variant.stockQuantity,
            previousStock: 0,
            newStock: variant.stockQuantity,
            previousReserved: 0,
            newReserved: 0,
            reason: 'Khởi tạo tồn kho ban đầu từ hệ thống seed',
          },
        });
      }
    }
  }

  console.log(`📦 POS Products initialized: 3 sample catalog items with variants and stock`);

  console.log(`⚙️ Operations initialized: Canned Responses, Automation Rules, Webhook Deliveries`);
  console.log('✨ Database seeding completed successfully!');
}

seed()
  .catch(e => {
    console.error('❌ Seed execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabaseConnections();
  });

import type {
  PrismaClient,
  Workspace,
  Inbox,
  User,
  Team,
  Contact,
  ChannelIdentity,
  Label,
  Conversation,
} from '../../src/infrastructure/database';

export interface ConversationsSeedResult {
  conversations: Conversation[];
}

export async function seedConversations(
  prisma: PrismaClient,
  workspace: Workspace,
  inbox: Inbox,
  users: { superAdmin: User; admin: User; agent: User },
  team: Team,
  contacts: Contact[],
  channelIdentities: ChannelIdentity[],
  labels: Record<string, Label>,
): Promise<ConversationsSeedResult> {
  console.log(
    '💬 [06-Conversations] Seeding 7 rich conversations across all statuses and priorities...',
  );

  const findContact = (identifier: string) => contacts.find(c => c.identifier === identifier)!;
  const findIdentity = (contactId: string) =>
    channelIdentities.find(ci => ci.contactId === contactId);

  const seededConversations: Conversation[] = [];

  // Helper to link labels
  const linkLabel = async (conversationId: string, labelTitle: string) => {
    const label = labels[labelTitle];
    if (label) {
      await prisma.conversationLabel.upsert({
        where: {
          conversationId_labelId: {
            conversationId,
            labelId: label.id,
          },
        },
        update: {},
        create: {
          conversationId,
          labelId: label.id,
        },
      });
    }
  };

  // ===========================================================================
  // CONVERSATION 1: OPEN - HIGH - B2B SaaS Enterprise Consultation (Nguyễn Văn An)
  // ===========================================================================
  const cust1 = findContact('CUST_VN_001');
  const id1 = findIdentity(cust1.id);

  let conv1 = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, contactId: cust1.id },
  });

  if (!conv1) {
    conv1 = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: cust1.id,
        channelIdentityId: id1?.id,
        assigneeId: users.superAdmin.id,
        teamId: team.id,
        status: 'OPEN',
        priority: 'HIGH',
        unreadMessagesCount: 0,
        customAttributes: { source: 'organic_search', intent: 'enterprise_quote' },
      },
    });

    await linkLabel(conv1.id, 'VIP');
    await linkLabel(conv1.id, 'Khách sỉ');
    await linkLabel(conv1.id, 'Báo giá');

    await prisma.message.createMany({
      data: [
        {
          conversationId: conv1.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust1.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Xin chào Sales Copilot, tôi là An bên Công ty Công nghệ Toàn Cầu. Chúng tôi muốn triển khai giải pháp quản lý hội thoại đa kênh cho đội ngũ 50 nhân sự. Nhờ bên mình gửi báo giá gói Enterprise.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv1_01',
        },
        {
          conversationId: conv1.id,
          workspaceId: workspace.id,
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'ACTIVITY',
          contentType: 'TEXT',
          content:
            'Hội thoại được tự động gán cho Super Administrator theo quy tắc phân công thông minh.',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv1_02',
        },
        {
          conversationId: conv1.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.superAdmin.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Chào anh Nguyễn Văn An! Rất vui được hỗ trợ Toàn Cầu. Gói Enterprise cho 50 nhân sự bên em hiện có ưu đãi giảm 15% kèm hỗ trợ đào tạo 1-1. Em vừa gửi báo giá qua email nguyenvanan@toancau.vn, anh kiểm tra giúp em nhé!',
          deliveryStatus: 'READ',
          externalId: 'msg_conv1_03',
        },
        {
          conversationId: conv1.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust1.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Cảm ơn em, anh đã nhận được file báo giá rồi nhé. Bên anh đang trình ban giám đốc duyệt ký hợp đồng.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv1_04',
        },
      ],
    });
  }
  seededConversations.push(conv1);

  // ===========================================================================
  // CONVERSATION 2: OPEN - URGENT - Sony Headphone Closing (Trần Minh Tuấn)
  // ===========================================================================
  const cust2 = findContact('CUST_VN_002');
  const id2 = findIdentity(cust2.id);

  let conv2 = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, contactId: cust2.id },
  });

  if (!conv2) {
    conv2 = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: cust2.id,
        channelIdentityId: id2?.id,
        assigneeId: users.agent.id,
        teamId: team.id,
        status: 'OPEN',
        priority: 'URGENT',
        unreadMessagesCount: 0,
        customAttributes: { source: 'live_chat_widget', targetSku: 'SONY-WH1000XM5-BLK' },
      },
    });

    await linkLabel(conv2.id, 'Đã chốt đơn');

    await prisma.message.createMany({
      data: [
        {
          conversationId: conv2.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust2.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Shop ơi, chiếc tai nghe Sony WH-1000XM5 màu đen còn hàng sẵn ở Hà Nội không bạn?',
          deliveryStatus: 'READ',
          externalId: 'msg_conv2_01',
        },
        {
          conversationId: conv2.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.agent.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Dạ chào anh Tuấn! Tai nghe Sony WH-1000XM5 màu đen bên em đang sẵn hàng tại kho Hà Nội ạ. Giá niêm yết 7.990.000đ, miễn phí giao hàng hỏa tốc trong 2 giờ ạ!',
          deliveryStatus: 'READ',
          externalId: 'msg_conv2_02',
        },
        {
          conversationId: conv2.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust2.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Tuyệt vời, chốt cho anh 1 chiếc nhé. Anh nhận tại 18 Tam Trinh, Hoàng Mai. Thanh toán VietQR nhé.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv2_03',
        },
        {
          conversationId: conv2.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.agent.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Dạ em đã tạo đơn hàng ORD-20260905-0002 cho mình rồi ạ! Anh quét mã VietQR để thanh toán nhé, nhận được thông báo là bên em cho ship ngay ạ!',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv2_04',
        },
        {
          conversationId: conv2.id,
          workspaceId: workspace.id,
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'ACTIVITY',
          contentType: 'TEXT',
          content:
            'Đơn hàng ORD-20260905-0002 trị giá 7.990.000 VND đã được tạo và liên kết với hội thoại.',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv2_05',
        },
      ],
    });
  }
  seededConversations.push(conv2);

  // ===========================================================================
  // CONVERSATION 3: RESOLVED - MEDIUM - 20 Polo Uniforms Bulk Order (Lê Thanh Hương)
  // ===========================================================================
  const cust3 = findContact('CUST_VN_003');
  const id3 = findIdentity(cust3.id);

  let conv3 = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, contactId: cust3.id },
  });

  if (!conv3) {
    conv3 = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: cust3.id,
        channelIdentityId: id3?.id,
        assigneeId: users.agent.id,
        teamId: team.id,
        status: 'RESOLVED',
        priority: 'MEDIUM',
        unreadMessagesCount: 0,
        customAttributes: { orderId: 'ORD-20260908-0003' },
      },
    });

    await linkLabel(conv3.id, 'VIP');
    await linkLabel(conv3.id, 'Khách sỉ');
    await linkLabel(conv3.id, 'Đã chốt đơn');

    await prisma.message.createMany({
      data: [
        {
          conversationId: conv3.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust3.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Chào bạn, bên chuỗi Minh Phúc cần đặt 20 áo polo đồng phục màu xanh navy size L cho nhân viên khối văn phòng.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv3_01',
        },
        {
          conversationId: conv3.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.agent.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Dạ chào chị Hương! Áo polo size L màu xanh Navy bên em luôn có sẵn số lượng lớn ạ. 20 áo bên em tính giá ưu đãi sỉ 250.000đ/áo là 5.000.000đ ạ.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv3_02',
        },
        {
          conversationId: conv3.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust3.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Ok chốt nhé, bên chị cọc trước 2 triệu chuyển khoản, còn lại giao hàng thu COD tại Quận 3 nhé.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv3_03',
        },
        {
          conversationId: conv3.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.agent.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Dạ em đã nhận được tiền cọc 2.000.000đ từ MBBank rồi ạ. Đơn hàng đang được đóng gói và giao trong sáng mai chị nhé!',
          deliveryStatus: 'READ',
          externalId: 'msg_conv3_04',
        },
        {
          conversationId: conv3.id,
          workspaceId: workspace.id,
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'ACTIVITY',
          contentType: 'TEXT',
          content: 'Hội thoại đã được đánh dấu giải quyết xong (RESOLVED) bởi Lê Tư Vấn.',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv3_05',
        },
      ],
    });
  }
  seededConversations.push(conv3);

  // ===========================================================================
  // CONVERSATION 4: SNOOZED - LOW - Logitech Mouse Inquiry (Phạm Quốc Bảo)
  // ===========================================================================
  const cust4 = findContact('CUST_VN_004');
  const id4 = findIdentity(cust4.id);

  let conv4 = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, contactId: cust4.id },
  });

  if (!conv4) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    conv4 = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: cust4.id,
        channelIdentityId: id4?.id,
        assigneeId: users.admin.id,
        teamId: team.id,
        status: 'SNOOZED',
        priority: 'LOW',
        snoozedUntil: nextWeek,
        unreadMessagesCount: 0,
      },
    });

    await linkLabel(conv4.id, 'Hỗ trợ kỹ thuật');

    await prisma.message.createMany({
      data: [
        {
          conversationId: conv4.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust4.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Chào bạn, chuột Logitech MX Master 3S có kết nối mượt với cả MacBook M3 và máy bàn Windows không?',
          deliveryStatus: 'READ',
          externalId: 'msg_conv4_01',
        },
        {
          conversationId: conv4.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.admin.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Dạ chào anh Bảo! Chuột Logitech MX Master 3S hỗ trợ kết nối đồng thời tới 3 thiết bị qua Bluetooth và đầu thu Logi Bolt, có tính năng Logitech Flow copy paste mượt mà giữa macOS và Windows luôn ạ.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv4_02',
        },
        {
          conversationId: conv4.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust4.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Ok hay quá, hiện tại anh đang đi công tác Đà Nẵng, hẹn tuần sau về Hà Nội anh sẽ đặt mua nhé!',
          deliveryStatus: 'READ',
          externalId: 'msg_conv4_03',
        },
        {
          conversationId: conv4.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.admin.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Dạ vâng anh Bảo, em hẹn lại tuần sau sẽ liên hệ nhắc anh nhé. Chúc anh chuyến công tác tốt đẹp ạ!',
          deliveryStatus: 'READ',
          externalId: 'msg_conv4_04',
        },
        {
          conversationId: conv4.id,
          workspaceId: workspace.id,
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'ACTIVITY',
          contentType: 'TEXT',
          content: 'Hội thoại được tạm hoãn (SNOOZED) 7 ngày bởi Trần Quản Trị.',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv4_05',
        },
      ],
    });
  }
  seededConversations.push(conv4);

  // ===========================================================================
  // CONVERSATION 5: PENDING - URGENT - Unassigned Shipping Issue (Hoàng Thị Thuỳ Dương)
  // ===========================================================================
  const cust5 = findContact('CUST_VN_005');
  const id5 = findIdentity(cust5.id);

  let conv5 = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, contactId: cust5.id },
  });

  if (!conv5) {
    conv5 = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: cust5.id,
        channelIdentityId: id5?.id,
        assigneeId: null, // Unassigned for testing Takeover / Auto-assignment
        teamId: team.id,
        status: 'PENDING',
        priority: 'URGENT',
        unreadMessagesCount: 1,
      },
    });

    await linkLabel(conv5.id, 'Khiếu nại');

    await prisma.message.createMany({
      data: [
        {
          conversationId: conv5.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust5.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content:
            'Shop ơi kiểm tra giúp mình đơn hàng ORD-20260912-0005 với, mình đặt từ hôm kia mà tra mã vận đơn vẫn chưa thấy cập nhật chuyển phát ạ?',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv5_01',
        },
        {
          conversationId: conv5.id,
          workspaceId: workspace.id,
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'ACTIVITY',
          contentType: 'TEXT',
          content:
            'Hội thoại có mức ưu tiên KHẨN CẤP (URGENT), đang chờ nhân viên tiếp nhận hỗ trợ.',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv5_02',
        },
      ],
    });
  }
  seededConversations.push(conv5);

  // ===========================================================================
  // CONVERSATION 6: OPEN - MEDIUM - Image Attachment Gift Customization (Đặng Hữu Nam)
  // ===========================================================================
  const cust7 = findContact('CUST_VN_007');
  const id7 = findIdentity(cust7.id);

  let conv6 = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, contactId: cust7.id },
  });

  if (!conv6) {
    conv6 = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: cust7.id,
        channelIdentityId: id7?.id,
        assigneeId: users.agent.id,
        teamId: team.id,
        status: 'OPEN',
        priority: 'MEDIUM',
        unreadMessagesCount: 0,
      },
    });

    await linkLabel(conv6.id, 'Khách sỉ');
    await linkLabel(conv6.id, 'Báo giá');

    await prisma.message.create({
      data: {
        conversationId: conv6.id,
        workspaceId: workspace.id,
        senderType: 'CONTACT',
        senderId: cust7.id,
        messageType: 'INCOMING',
        contentType: 'TEXT',
        content:
          'Bên em có hỗ trợ in khắc logo công ty lên bình giữ nhiệt không shop? Anh muốn đặt 10 chiếc cho team.',
        deliveryStatus: 'READ',
        externalId: 'msg_conv6_01',
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conv6.id,
        workspaceId: workspace.id,
        senderType: 'USER',
        senderId: users.agent.id,
        messageType: 'OUTGOING',
        contentType: 'TEXT',
        content:
          'Dạ bên em có xưởng khắc laser trực tiếp theo yêu cầu ạ! Anh gửi em file logo để em dựng demo lên mẫu bình nhé ạ.',
        deliveryStatus: 'READ',
        externalId: 'msg_conv6_02',
      },
    });

    // Message with Image Attachment
    const imageMessage = await prisma.message.create({
      data: {
        conversationId: conv6.id,
        workspaceId: workspace.id,
        senderType: 'CONTACT',
        senderId: cust7.id,
        messageType: 'INCOMING',
        contentType: 'IMAGE',
        content:
          'Anh gửi ảnh mẫu bình giữ nhiệt màu đen nhám muốn khắc logo nhé, xem giúp anh có sắc nét không.',
        deliveryStatus: 'READ',
        externalId: 'msg_conv6_03',
      },
    });

    await prisma.attachment.create({
      data: {
        messageId: imageMessage.id,
        fileType: 'IMAGE',
        fileName: 'mockup-binh-giu-nhiet-fpt.jpg',
        fileSize: 245800,
        storagePath:
          'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=60',
        contentType: 'image/jpeg',
      },
    });
  }
  seededConversations.push(conv6);

  // ===========================================================================
  // CONVERSATION 7: RESOLVED - LOW - General FAQ Inquiry (Ngô Phương Linh)
  // ===========================================================================
  const cust10 = findContact('CUST_VN_010');
  const id10 = findIdentity(cust10.id);

  let conv7 = await prisma.conversation.findFirst({
    where: { workspaceId: workspace.id, contactId: cust10.id },
  });

  if (!conv7) {
    conv7 = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        contactId: cust10.id,
        channelIdentityId: id10?.id,
        assigneeId: users.superAdmin.id,
        teamId: team.id,
        status: 'RESOLVED',
        priority: 'LOW',
        unreadMessagesCount: 0,
      },
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conv7.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust10.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content: 'Chào bạn, showroom bên mình ở Hà Nội mở cửa đến mấy giờ thế?',
          deliveryStatus: 'READ',
          externalId: 'msg_conv7_01',
        },
        {
          conversationId: conv7.id,
          workspaceId: workspace.id,
          senderType: 'USER',
          senderId: users.superAdmin.id,
          messageType: 'OUTGOING',
          contentType: 'TEXT',
          content:
            'Dạ chào chị Linh! Showroom bên em mở cửa từ 8h30 đến 21h30 tất cả các ngày trong tuần, kể cả Thứ Bảy và Chủ Nhật ạ.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv7_02',
        },
        {
          conversationId: conv7.id,
          workspaceId: workspace.id,
          senderType: 'CONTACT',
          senderId: cust10.id,
          messageType: 'INCOMING',
          contentType: 'TEXT',
          content: 'Cảm ơn shop nhé, chiều nay mình ghé qua trải nghiệm tai nghe trực tiếp.',
          deliveryStatus: 'READ',
          externalId: 'msg_conv7_03',
        },
        {
          conversationId: conv7.id,
          workspaceId: workspace.id,
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'ACTIVITY',
          contentType: 'TEXT',
          content: 'Hội thoại đã hoàn thành và được giải quyết bởi Super Administrator.',
          deliveryStatus: 'DELIVERED',
          externalId: 'msg_conv7_04',
        },
      ],
    });
  }
  seededConversations.push(conv7);

  console.log(
    `   ✔ ${seededConversations.length} Conversations seeded with diverse statuses (OPEN, RESOLVED, SNOOZED, PENDING)`,
  );
  console.log(
    `   ✔ Realistic message flows seeded (including Image attachments, Activity logs, ConversationLabels)`,
  );

  return { conversations: seededConversations };
}

import type { PrismaClient, Workspace, Label } from '../../src/infrastructure/database';

export async function seedOperations(
  prisma: PrismaClient,
  workspace: Workspace,
): Promise<Record<string, Label>> {
  console.log('🏷️ [03-Operations] Seeding labels and canned responses...');

  // 1. Seed Labels
  const labelsToSeed = [
    { title: 'VIP', color: '#f59e0b', description: 'Khách hàng trọng điểm / doanh thu cao' },
    {
      title: 'Khách sỉ',
      color: '#8b5cf6',
      description: 'Khách mua số lượng lớn / doanh nghiệp B2B',
    },
    { title: 'Hỗ trợ kỹ thuật', color: '#ef4444', description: 'Cần xử lý kỹ thuật / bảo hành' },
    { title: 'Báo giá', color: '#10b981', description: 'Đang trao đổi báo giá dịch vụ / sản phẩm' },
    {
      title: 'Khiếu nại',
      color: '#dc2626',
      description: 'Khách khiếu nại giao hàng hoặc chất lượng',
    },
    { title: 'Đã chốt đơn', color: '#06b6d4', description: 'Đã hoàn tất lên đơn hàng qua chat' },
  ];

  const seededLabels: Record<string, Label> = {};
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
        showOnSidebar: true,
      },
    });
    seededLabels[label.title] = label;
  }

  // 2. Seed Canned Responses
  const cannedResponsesToSeed = [
    {
      shortCode: '/chao',
      content:
        'Dạ em chào anh/chị ạ! Em là chuyên viên hỗ trợ Sales Copilot, em có thể giúp gì cho mình hôm nay ạ?',
    },
    {
      shortCode: '/baogia',
      content:
        'Dạ em gửi anh/chị bảng giá chi tiết kèm ưu đãi hiện hành ạ. Anh/chị xem qua giúp em nhé!',
    },
    {
      shortCode: '/stk',
      content:
        'Dạ bên em nhận thanh toán qua MBBank - STK: 0988123456 - Tên: CONG TY SALES COPILOT. Nội dung chuyển khoản anh/chị ghi cú pháp DH kèm mã đơn hàng giúp em nhé!',
    },
    {
      shortCode: '/baohanh',
      content:
        'Dạ toàn bộ sản phẩm thiết bị điện tử bên em được bảo hành chính hãng 12 tháng, 1 đổi 1 trong 30 ngày đầu nếu phát sinh lỗi từ nhà sản xuất ạ.',
    },
    {
      shortCode: '/giaohang',
      content:
        'Dạ đơn hàng nội thành Hà Nội & TP.HCM sẽ được giao hỏa tốc trong ngày. Các tỉnh thành khác thời gian giao hàng từ 2-3 ngày làm việc ạ.',
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

  console.log(`   ✔ ${Object.keys(seededLabels).length} Labels seeded`);
  console.log(
    `   ✔ ${cannedResponsesToSeed.length} Canned responses seeded (/chao, /baogia, /stk, /baohanh, /giaohang)`,
  );

  return seededLabels;
}

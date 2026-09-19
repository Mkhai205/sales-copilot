import type {
  PrismaClient,
  Workspace,
  Product,
  ProductVariant,
} from '../../src/infrastructure/database';

export interface CatalogInventorySeedResult {
  products: Product[];
  variants: ProductVariant[];
}

export async function seedCatalogInventory(
  prisma: PrismaClient,
  workspace: Workspace,
): Promise<CatalogInventorySeedResult> {
  console.log('📦 [04-Catalog & Inventory] Seeding products, variants, and stock transactions...');

  const sampleProducts = [
    {
      name: 'Gói Bản Quyền Sales Copilot Enterprise',
      slug: 'goi-ban-quyen-sales-copilot-enterprise',
      description:
        'Gói giải pháp phần mềm quản trị bán hàng và hội thoại đa kênh AI dành cho doanh nghiệp vừa và lớn.',
      category: 'Phần mềm & Bản quyền',
      basePrice: 12000000,
      costPrice: 8000000,
      sku: 'SaaS-ENTERPRISE',
      barcode: '893850123001',
      trackInventory: false,
      imageUrl:
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&auto=format&fit=crop&q=60',
      variants: [
        {
          name: 'Gói 1 Năm (50 Users)',
          sku: 'SaaS-ENTERPRISE-50U',
          barcode: '893850123002',
          price: 12000000,
          costPrice: 8000000,
          stockQuantity: 0,
          attributes: { users: '50', duration: '12 tháng' },
        },
        {
          name: 'Gói 1 Năm (100 Users)',
          sku: 'SaaS-ENTERPRISE-100U',
          barcode: '893850123003',
          price: 20000000,
          costPrice: 14000000,
          stockQuantity: 0,
          attributes: { users: '100', duration: '12 tháng' },
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
      trackInventory: true,
      imageUrl:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
      variants: [
        {
          name: 'Màu Đen (Black)',
          sku: 'SONY-WH1000XM5-BLK',
          barcode: '893850123005',
          price: 7990000,
          costPrice: 6200000,
          stockQuantity: 25,
          attributes: { color: 'Đen' },
        },
        {
          name: 'Màu Bạc (Silver)',
          sku: 'SONY-WH1000XM5-SLV',
          barcode: '893850123006',
          price: 7990000,
          costPrice: 6200000,
          stockQuantity: 3, // Low-stock threshold (< 5)
          attributes: { color: 'Bạc' },
        },
      ],
    },
    {
      name: 'Áo Polo Đồng Phục Doanh Nghiệp Sales Copilot',
      slug: 'ao-polo-dong-phuc-doanh-nghiep',
      description:
        'Áo thun polo chất liệu cotton cá sấu co giãn 4 chiều cao cấp, thoáng khí và thấm hút mồ hôi tốt.',
      category: 'Thời trang & Đồng phục',
      basePrice: 250000,
      costPrice: 150000,
      sku: 'POLO-CORP-2026',
      barcode: '893850123007',
      trackInventory: true,
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
          stockQuantity: 0, // Out of stock (0)
          attributes: { size: 'XL', color: 'Xanh Navy' },
        },
      ],
    },
    {
      name: 'Chuột Không Dây Logitech MX Master 3S',
      slug: 'chuot-khong-day-logitech-mx-master-3s',
      description:
        'Chuột công thái học hàng đầu cho dân văn phòng và lập trình viên, cuộn siêu nhanh MagSpeed, click êm ái Quiet Clicks.',
      category: 'Thiết bị & Phụ kiện',
      basePrice: 2490000,
      costPrice: 1850000,
      sku: 'LOGI-MX3S',
      barcode: '893850123010',
      trackInventory: true,
      imageUrl:
        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500&auto=format&fit=crop&q=60',
      variants: [
        {
          name: 'Xám Than Chì (Graphite)',
          sku: 'LOGI-MX3S-GRPH',
          barcode: '893850123011',
          price: 2490000,
          costPrice: 1850000,
          stockQuantity: 15,
          attributes: { color: 'Graphite' },
        },
        {
          name: 'Trắng Ngọc Trai (Pale Gray)',
          sku: 'LOGI-MX3S-GRAY',
          barcode: '893850123012',
          price: 2490000,
          costPrice: 1850000,
          stockQuantity: 8,
          attributes: { color: 'Pale Gray' },
        },
      ],
    },
    {
      name: 'Bình Giữ Nhiệt Khắc Tên Doanh Nghiệp 500ml',
      slug: 'binh-giu-nhiet-khac-ten-doanh-nghiep-500ml',
      description:
        'Bình giữ nhiệt inox 304 hai lớp chân không cao cấp, giữ nóng 8 giờ và giữ lạnh 14 giờ, hỗ trợ in khắc laser logo doanh nghiệp.',
      category: 'Quà tặng & Gia dụng',
      basePrice: 180000,
      costPrice: 95000,
      sku: 'BGN-CORP-500ML',
      barcode: '893850123013',
      trackInventory: true,
      imageUrl:
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60',
      variants: [
        {
          name: 'Màu Bạc Kim Loại',
          sku: 'BGN-CORP-SLV',
          barcode: '893850123014',
          price: 180000,
          costPrice: 95000,
          stockQuantity: 50,
          attributes: { color: 'Bạc Kim Loại', capacity: '500ml' },
        },
        {
          name: 'Màu Đen Nhám (Matte Black)',
          sku: 'BGN-CORP-BLK',
          barcode: '893850123015',
          price: 180000,
          costPrice: 95000,
          stockQuantity: 40,
          attributes: { color: 'Đen Nhám', capacity: '500ml' },
        },
      ],
    },
  ];

  const seededProducts: Product[] = [];
  const seededVariants: ProductVariant[] = [];

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
        trackInventory: productFields.trackInventory,
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
        trackInventory: productFields.trackInventory,
      },
    });

    seededProducts.push(seededProduct);

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

      seededVariants.push(seededVariant);

      // Seed initial stock transaction if none exists
      if (variant.stockQuantity > 0) {
        const existingTx = await prisma.inventoryTransaction.findFirst({
          where: { variantId: seededVariant.id, workspaceId: workspace.id },
        });

        if (!existingTx) {
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
  }

  console.log(`   ✔ ${seededProducts.length} Products seeded`);
  console.log(
    `   ✔ ${seededVariants.length} Variants seeded (with Low Stock: SONY-WH1000XM5-SLV, Out of Stock: POLO-CORP-XL-NAVY)`,
  );

  return { products: seededProducts, variants: seededVariants };
}

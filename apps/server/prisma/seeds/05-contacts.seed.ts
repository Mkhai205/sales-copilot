import type {
  PrismaClient,
  Workspace,
  Channel,
  Contact,
  ChannelIdentity,
} from '../../src/infrastructure/database';

export interface ContactsSeedResult {
  contacts: Contact[];
  channelIdentities: ChannelIdentity[];
}

export async function seedContacts(
  prisma: PrismaClient,
  workspace: Workspace,
  channel: Channel,
): Promise<ContactsSeedResult> {
  console.log(
    '👥 [05-Contacts] Seeding 12 realistic Vietnamese customer profiles and channel identities...',
  );

  const sampleContactsData = [
    {
      identifier: 'CUST_VN_001',
      name: 'Nguyễn Văn An',
      email: 'nguyenvanan@toancau.vn',
      phoneNumber: '+84988123456',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nguyenvanan',
      customAttributes: {
        company: 'Công ty Cổ phần Công nghệ Toàn Cầu',
        role: 'Giám đốc Kinh doanh (CCO)',
        tier: 'VIP',
        segment: 'Doanh nghiệp B2B',
        addressStreet: '72 Lê Thánh Tôn',
        addressWard: 'Phường Bến Nghé',
        addressDistrict: 'Quận 1',
        addressProvince: 'Thành phố Hồ Chí Minh',
      },
    },
    {
      identifier: 'CUST_VN_002',
      name: 'Trần Minh Tuấn',
      email: 'tuan.tran@gmail.com',
      phoneNumber: '+84912345678',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tranminhtuan',
      customAttributes: {
        company: 'Freelance Software Engineer',
        role: 'Kỹ sư phần mềm',
        tier: 'STANDARD',
        segment: 'Khách hàng cá nhân',
        addressStreet: '18 Tam Trinh',
        addressWard: 'Phường Mai Động',
        addressDistrict: 'Quận Hoàng Mai',
        addressProvince: 'Thành phố Hà Nội',
      },
    },
    {
      identifier: 'CUST_VN_003',
      name: 'Lê Thanh Hương',
      email: 'huong.le@minhphuc.com.vn',
      phoneNumber: '+84903456789',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lethanhhuong',
      customAttributes: {
        company: 'Chuỗi Bán lẻ & Phân phối Minh Phúc',
        role: 'Trưởng phòng Nhân sự & Vận hành',
        tier: 'VIP',
        segment: 'Khách hàng doanh nghiệp',
        addressStreet: '142 Nguyễn Thị Minh Khai',
        addressWard: 'Phường 6',
        addressDistrict: 'Quận 3',
        addressProvince: 'Thành phố Hồ Chí Minh',
      },
    },
    {
      identifier: 'CUST_VN_004',
      name: 'Phạm Quốc Bảo',
      email: 'baopham.design@outlook.com',
      phoneNumber: '+84978901234',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=phamquocbao',
      customAttributes: {
        company: 'Sáng tạo Studio Creative Labs',
        role: 'Senior UI/UX Designer',
        tier: 'STANDARD',
        segment: 'Khách hàng công nghệ',
        addressStreet: '54 Liễu Giai',
        addressWard: 'Phường Cống Vị',
        addressDistrict: 'Quận Ba Đình',
        addressProvince: 'Thành phố Hà Nội',
      },
    },
    {
      identifier: 'CUST_VN_005',
      name: 'Hoàng Thị Thuỳ Dương',
      email: 'duonghoang96@gmail.com',
      phoneNumber: '+84934567890',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=hoangthithuyduong',
      customAttributes: {
        company: 'KOL / Digital Creator',
        role: 'Content Creator',
        tier: 'POTENTIAL',
        segment: 'Khách lẻ tiềm năng',
        addressStreet: '25 Đặng Dung',
        addressWard: 'Phường Tân Định',
        addressDistrict: 'Quận 1',
        addressProvince: 'Thành phố Hồ Chí Minh',
      },
    },
    {
      identifier: 'CUST_VN_006',
      name: 'Vũ Kim Ngân',
      email: 'ngan.vukim@vinatex.com.vn',
      phoneNumber: '+84967890123',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vukimngan',
      customAttributes: {
        company: 'Tập đoàn Dệt may Việt Nam',
        role: 'Quản lý thu mua vật tư',
        tier: 'VIP',
        segment: 'Khách sỉ lớn',
        addressStreet: '10 Tràng Thi',
        addressWard: 'Phường Hàng Trống',
        addressDistrict: 'Quận Hoàn Kiếm',
        addressProvince: 'Thành phố Hà Nội',
      },
    },
    {
      identifier: 'CUST_VN_007',
      name: 'Đặng Hữu Nam',
      email: 'nam.dang@fpt.com',
      phoneNumber: '+84982345678',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=danghuunam',
      customAttributes: {
        company: 'FPT Software Global',
        role: 'Project Delivery Manager',
        tier: 'STANDARD',
        segment: 'Quà tặng doanh nghiệp',
        addressStreet: 'Toà nhà FPT, Phố Duy Tân',
        addressWard: 'Phường Dịch Vọng Hậu',
        addressDistrict: 'Quận Cầu Giấy',
        addressProvince: 'Thành phố Hà Nội',
      },
    },
    {
      identifier: 'CUST_VN_008',
      name: 'Bùi Thị Mai',
      email: 'maibui.retail@gmail.com',
      phoneNumber: '+84908765432',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buithimai',
      customAttributes: {
        company: 'Mai Store Phụ Kiện Chính Hãng',
        role: 'Chủ chuỗi cửa hàng bán lẻ',
        tier: 'VIP',
        segment: 'Đại lý phân phối',
        addressStreet: '125 Chùa Bộc',
        addressWard: 'Phường Quang Trung',
        addressDistrict: 'Quận Đống Đa',
        addressProvince: 'Thành phố Hà Nội',
      },
    },
    {
      identifier: 'CUST_VN_009',
      name: 'Đỗ Hoàng Long',
      email: 'longdo.saas@viettel.vn',
      phoneNumber: '+84971234567',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dohoanglong',
      customAttributes: {
        company: 'Tổng Công ty Giải pháp Doanh nghiệp Viettel',
        role: 'Chuyên viên Vận hành Hệ thống',
        tier: 'POTENTIAL',
        segment: 'Khách hàng đối tác',
        addressStreet: '285 Cách Mạng Tháng 8',
        addressWard: 'Phường 12',
        addressDistrict: 'Quận 10',
        addressProvince: 'Thành phố Hồ Chí Minh',
      },
    },
    {
      identifier: 'CUST_VN_010',
      name: 'Ngô Phương Linh',
      email: 'linh.ngo@techcombank.com.vn',
      phoneNumber: '+84938765432',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ngophuonglinh',
      customAttributes: {
        company: 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)',
        role: 'Trợ lý Giám đốc Khối Khách hàng Cá nhân',
        tier: 'STANDARD',
        segment: 'Khách hàng văn phòng',
        addressStreet: '6 Quang Trung',
        addressWard: 'Phường Trần Hưng Đạo',
        addressDistrict: 'Quận Hoàn Kiếm',
        addressProvince: 'Thành phố Hà Nội',
      },
    },
    {
      identifier: 'CUST_VN_011',
      name: 'Phan Anh Dũng',
      email: 'dungphan.mkt@gmail.com',
      phoneNumber: '+84965432109',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=phananhdung',
      customAttributes: {
        company: 'Fintech Startup Growth Hub',
        role: 'Head of Growth Marketing',
        tier: 'POTENTIAL',
        segment: 'Khách hàng mới',
        addressStreet: '88 Hàm Nghi',
        addressWard: 'Phường Bến Nghé',
        addressDistrict: 'Quận 1',
        addressProvince: 'Thành phố Hồ Chí Minh',
      },
    },
    {
      identifier: 'CUST_VN_012',
      name: 'Nguyễn Thị Bích Ngọc',
      email: 'ngocnguyen.hr@shopee.vn',
      phoneNumber: '+84919876543',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nguyenthibichngoc',
      customAttributes: {
        company: 'Shopee Vietnam Logistics & HR',
        role: 'Chuyên viên Văn hoá Doanh nghiệp',
        tier: 'STANDARD',
        segment: 'Khách hàng doanh nghiệp',
        addressStreet: '29 Liễu Giai',
        addressWard: 'Phường Ngọc Khánh',
        addressDistrict: 'Quận Ba Đình',
        addressProvince: 'Thành phố Hà Nội',
      },
    },
  ];

  const seededContacts: Contact[] = [];
  const seededIdentities: ChannelIdentity[] = [];

  for (let index = 0; index < sampleContactsData.length; index++) {
    const contactData = sampleContactsData[index];
    const externalContactId = `web_session_cust_${String(index + 1).padStart(3, '0')}`;

    const contact = await prisma.contact.upsert({
      where: {
        workspaceId_identifier: {
          workspaceId: workspace.id,
          identifier: contactData.identifier,
        },
      },
      update: {
        name: contactData.name,
        email: contactData.email,
        phoneNumber: contactData.phoneNumber,
        avatarUrl: contactData.avatarUrl,
        customAttributes: contactData.customAttributes,
      },
      create: {
        workspaceId: workspace.id,
        identifier: contactData.identifier,
        name: contactData.name,
        email: contactData.email,
        phoneNumber: contactData.phoneNumber,
        avatarUrl: contactData.avatarUrl,
        customAttributes: contactData.customAttributes,
      },
    });

    seededContacts.push(contact);

    const channelIdentity = await prisma.channelIdentity.upsert({
      where: {
        channelId_externalContactId: {
          channelId: channel.id,
          externalContactId,
        },
      },
      update: {
        contactId: contact.id,
        username: `${contact.name} (Live Chat)`,
      },
      create: {
        contactId: contact.id,
        workspaceId: workspace.id,
        channelId: channel.id,
        externalContactId,
        username: `${contact.name} (Live Chat)`,
        metadata: {
          browser: index % 2 === 0 ? 'Chrome 122' : 'Safari 17',
          os: index % 2 === 0 ? 'Windows 11' : 'macOS Sonoma',
          city: contactData.customAttributes.addressProvince,
        },
      },
    });

    seededIdentities.push(channelIdentity);
  }

  console.log(
    `   ✔ ${seededContacts.length} Contacts seeded (with full 3-level Vietnamese administrative addresses)`,
  );
  console.log(`   ✔ ${seededIdentities.length} ChannelIdentities linked to Web Chat channel`);

  return { contacts: seededContacts, channelIdentities: seededIdentities };
}

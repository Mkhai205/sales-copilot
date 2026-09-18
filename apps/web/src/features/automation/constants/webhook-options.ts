import { WebhookDeliveryStatus, WebhookEventType } from '@sales-copilot/shared-contracts';

export interface WebhookEventMeta {
  type: WebhookEventType;
  label: string;
  description: string;
}

export interface WebhookEventCategory {
  id: string;
  name: string;
  description: string;
  events: WebhookEventMeta[];
}

export const WEBHOOK_EVENT_CATEGORIES: WebhookEventCategory[] = [
  {
    id: 'conversations',
    name: 'Hội thoại',
    description: 'Các sự kiện vòng đời cuộc hội thoại, thay đổi trạng thái và phân công.',
    events: [
      {
        type: WebhookEventType.CONVERSATION_CREATED,
        label: 'Hội thoại được tạo',
        description: 'Kích hoạt khi một cuộc hội thoại mới được bắt đầu.',
      },
      {
        type: WebhookEventType.CONVERSATION_UPDATED,
        label: 'Hội thoại được cập nhật',
        description: 'Kích hoạt khi thông tin hội thoại được sửa đổi.',
      },
      {
        type: WebhookEventType.CONVERSATION_STATUS_UPDATED,
        label: 'Trạng thái thay đổi',
        description: 'Kích hoạt khi chuyển đổi giữa Mở, Đang chờ, Đã giải quyết, hoặc Tạm hoãn.',
      },
      {
        type: WebhookEventType.CONVERSATION_REOPENED,
        label: 'Hội thoại mở lại',
        description: 'Kích hoạt khi cuộc hội thoại đã đóng nhận được tin nhắn mới từ khách hàng.',
      },
      {
        type: WebhookEventType.CONVERSATION_ASSIGNED,
        label: 'Phân công hội thoại',
        description: 'Kích hoạt khi nhân viên hoặc nhóm được phân công hoặc thay đổi.',
      },
      {
        type: WebhookEventType.CONVERSATION_PRIORITY_UPDATED,
        label: 'Độ ưu tiên thay đổi',
        description:
          'Kích hoạt khi độ ưu tiên của hội thoại thay đổi (Khẩn cấp/Cao/Trung bình/Thấp).',
      },
      {
        type: WebhookEventType.CONVERSATION_LABELS_UPDATED,
        label: 'Nhãn thay đổi',
        description: 'Kích hoạt khi nhãn được gắn hoặc gỡ khỏi hội thoại.',
      },
    ],
  },
  {
    id: 'messages',
    name: 'Tin nhắn',
    description: 'Các sự kiện tin nhắn đến và đi, ghi chú nội bộ và trạng thái chuyển phát.',
    events: [
      {
        type: WebhookEventType.MESSAGE_CREATED,
        label: 'Gửi / Nhận tin nhắn',
        description: 'Kích hoạt cho mỗi tin nhắn đến từ khách hàng hoặc phản hồi từ nhân viên.',
      },
      {
        type: WebhookEventType.MESSAGE_UPDATED,
        label: 'Tin nhắn được sửa',
        description: 'Kích hoạt khi nội dung hoặc dữ liệu tin nhắn được chỉnh sửa.',
      },
      {
        type: WebhookEventType.MESSAGE_DELETED,
        label: 'Tin nhắn bị xóa',
        description: 'Kích hoạt khi một tin nhắn bị xóa.',
      },
      {
        type: WebhookEventType.MESSAGE_DELIVERY_STATUS_UPDATED,
        label: 'Trạng thái chuyển phát cập nhật',
        description:
          'Kích hoạt khi trạng thái chuyển phát thay đổi (Đã gửi, Đã nhận, Đã đọc, Thất bại).',
      },
    ],
  },
  {
    id: 'contacts',
    name: 'Liên hệ',
    description: 'Quản trị hồ sơ khách hàng và các sự kiện hợp nhất liên hệ trùng lặp.',
    events: [
      {
        type: WebhookEventType.CONTACT_CREATED,
        label: 'Liên hệ được tạo',
        description: 'Kích hoạt khi một khách hàng mới được tạo trong không gian làm việc.',
      },
      {
        type: WebhookEventType.CONTACT_UPDATED,
        label: 'Liên hệ được cập nhật',
        description:
          'Kích hoạt khi thông tin liên hệ (tên, email, sđt, thuộc tính tùy chỉnh) thay đổi.',
      },
      {
        type: WebhookEventType.CONTACT_DELETED,
        label: 'Liên hệ bị xóa',
        description: 'Kích hoạt khi một liên hệ bị xóa.',
      },
      {
        type: WebhookEventType.CONTACT_MERGED,
        label: 'Hợp nhất liên hệ',
        description: 'Kích hoạt khi hai liên hệ trùng lặp được hợp nhất.',
      },
    ],
  },
  {
    id: 'channels',
    name: 'Kênh & Danh tính',
    description: 'Hộp thư, kết nối kênh và liên kết danh tính người dùng qua các kênh.',
    events: [
      {
        type: WebhookEventType.CHANNEL_CREATED,
        label: 'Kênh được tạo',
        description: 'Kích hoạt khi một hộp thư hoặc tích hợp kênh mới được kết nối.',
      },
      {
        type: WebhookEventType.CHANNEL_UPDATED,
        label: 'Kênh được cập nhật',
        description: 'Kích hoạt khi cài đặt hoặc thông tin xác thực kênh được cập nhật.',
      },
      {
        type: WebhookEventType.CHANNEL_DELETED,
        label: 'Kênh bị xóa',
        description: 'Kích hoạt khi một kênh bị ngắt kết nối.',
      },
      {
        type: WebhookEventType.CHANNEL_IDENTITY_CREATED,
        label: 'Liên kết danh tính kênh',
        description:
          'Kích hoạt khi danh tính mạng xã hội (vd: FB PSID, Telegram ID) liên kết với liên hệ.',
      },
      {
        type: WebhookEventType.CHANNEL_IDENTITY_DELETED,
        label: 'Hủy liên kết danh tính kênh',
        description: 'Kích hoạt khi liên kết danh tính bị gỡ bỏ.',
      },
    ],
  },
  {
    id: 'labels',
    name: 'Nhãn',
    description: 'Hệ thống nhãn và danh mục phân loại trong không gian làm việc.',
    events: [
      {
        type: WebhookEventType.LABEL_CREATED,
        label: 'Nhãn được tạo',
        description: 'Kích hoạt khi nhãn hội thoại mới được tạo.',
      },
      {
        type: WebhookEventType.LABEL_UPDATED,
        label: 'Nhãn được cập nhật',
        description: 'Kích hoạt khi tên hoặc màu sắc của nhãn thay đổi.',
      },
      {
        type: WebhookEventType.LABEL_DELETED,
        label: 'Nhãn bị xóa',
        description: 'Kích hoạt khi nhãn bị xóa khỏi không gian làm việc.',
      },
    ],
  },
];

export const ALL_WEBHOOK_EVENT_TYPES: WebhookEventType[] = WEBHOOK_EVENT_CATEGORIES.flatMap(
  category => category.events.map(e => e.type),
);

export interface DeliveryStatusMeta {
  status: WebhookDeliveryStatus;
  label: string;
  badgeStyle: string;
}

export const DELIVERY_STATUS_META: Record<WebhookDeliveryStatus, DeliveryStatusMeta> = {
  [WebhookDeliveryStatus.DELIVERED]: {
    status: WebhookDeliveryStatus.DELIVERED,
    label: 'Đã gửi thành công',
    badgeStyle: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  [WebhookDeliveryStatus.FAILED]: {
    status: WebhookDeliveryStatus.FAILED,
    label: 'Thất bại',
    badgeStyle: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  },
  [WebhookDeliveryStatus.EXHAUSTED]: {
    status: WebhookDeliveryStatus.EXHAUSTED,
    label: 'Hết lượt thử',
    badgeStyle: 'border-red-600/30 bg-red-600/10 text-red-400',
  },
  [WebhookDeliveryStatus.RETRYING]: {
    status: WebhookDeliveryStatus.RETRYING,
    label: 'Đang thử lại',
    badgeStyle: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  [WebhookDeliveryStatus.PENDING]: {
    status: WebhookDeliveryStatus.PENDING,
    label: 'Đang chờ gửi',
    badgeStyle: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  },
};

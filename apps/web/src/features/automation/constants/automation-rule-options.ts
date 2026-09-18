import {
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  AutomationOperator,
  ConversationPriority,
  ConversationStatus,
  SenderType,
} from '@sales-copilot/shared-contracts';

export interface TriggerOption {
  value: AutomationEventTrigger;
  label: string;
  description: string;
  badgeColor: string;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: AutomationEventTrigger.CONVERSATION_CREATED,
    label: 'Hội thoại mới được tạo',
    description: 'Chạy ngay khi có cuộc hội thoại mới được bắt đầu bởi khách hàng hoặc nhân viên.',
    badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
  },
  {
    value: AutomationEventTrigger.MESSAGE_CREATED,
    label: 'Tin nhắn mới được tạo',
    description: 'Chạy khi có tin nhắn đến hoặc tin nhắn gửi đi trong bất kỳ hội thoại nào.',
    badgeColor: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  },
  {
    value: AutomationEventTrigger.CONVERSATION_STATUS_CHANGED,
    label: 'Trạng thái hội thoại thay đổi',
    description: 'Chạy khi trạng thái cuộc hội thoại chuyển đổi (vd: Mở, Đang chờ, Đã giải quyết).',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  },
];

export type AttributeDataType =
  'string' | 'status' | 'priority' | 'inbox' | 'team' | 'agent' | 'sender_type';

export interface AttributeOption {
  value: AutomationAttribute;
  label: string;
  dataType: AttributeDataType;
  allowedOperators: AutomationOperator[];
}

export const ATTRIBUTE_OPTIONS: AttributeOption[] = [
  {
    value: AutomationAttribute.CONTENT,
    label: 'Nội dung tin nhắn',
    dataType: 'string',
    allowedOperators: [
      AutomationOperator.CONTAINS,
      AutomationOperator.NOT_CONTAINS,
      AutomationOperator.EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.STATUS,
    label: 'Trạng thái hội thoại',
    dataType: 'status',
    allowedOperators: [AutomationOperator.EQUAL, AutomationOperator.NOT_EQUAL],
  },
  {
    value: AutomationAttribute.PRIORITY,
    label: 'Độ ưu tiên',
    dataType: 'priority',
    allowedOperators: [AutomationOperator.EQUAL, AutomationOperator.NOT_EQUAL],
  },
  {
    value: AutomationAttribute.INBOX_ID,
    label: 'Hộp thư',
    dataType: 'inbox',
    allowedOperators: [
      AutomationOperator.EQUAL,
      AutomationOperator.NOT_EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.TEAM_ID,
    label: 'Nhóm phụ trách',
    dataType: 'team',
    allowedOperators: [
      AutomationOperator.EQUAL,
      AutomationOperator.NOT_EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.ASSIGNEE_ID,
    label: 'Nhân viên phụ trách',
    dataType: 'agent',
    allowedOperators: [
      AutomationOperator.EQUAL,
      AutomationOperator.NOT_EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.SENDER_TYPE,
    label: 'Loại người gửi',
    dataType: 'sender_type',
    allowedOperators: [AutomationOperator.EQUAL, AutomationOperator.NOT_EQUAL],
  },
];

export interface OperatorOption {
  value: AutomationOperator;
  label: string;
  requiresValue: boolean;
}

export const OPERATOR_OPTIONS: Record<AutomationOperator, OperatorOption> = {
  [AutomationOperator.EQUAL]: {
    value: AutomationOperator.EQUAL,
    label: 'bằng với',
    requiresValue: true,
  },
  [AutomationOperator.NOT_EQUAL]: {
    value: AutomationOperator.NOT_EQUAL,
    label: 'không bằng',
    requiresValue: true,
  },
  [AutomationOperator.CONTAINS]: {
    value: AutomationOperator.CONTAINS,
    label: 'chứa từ khóa',
    requiresValue: true,
  },
  [AutomationOperator.NOT_CONTAINS]: {
    value: AutomationOperator.NOT_CONTAINS,
    label: 'không chứa từ khóa',
    requiresValue: true,
  },
  [AutomationOperator.IS_PRESENT]: {
    value: AutomationOperator.IS_PRESENT,
    label: 'có giá trị / không trống',
    requiresValue: false,
  },
  [AutomationOperator.IS_NOT_PRESENT]: {
    value: AutomationOperator.IS_NOT_PRESENT,
    label: 'chưa có / để trống',
    requiresValue: false,
  },
};

export interface ActionTypeOption {
  value: AutomationActionType;
  label: string;
  description: string;
}

export const ACTION_TYPE_OPTIONS: ActionTypeOption[] = [
  {
    value: AutomationActionType.ASSIGN_AGENT,
    label: 'Phân công nhân viên',
    description: 'Phân công cuộc hội thoại cho một thành viên cụ thể trong không gian làm việc.',
  },
  {
    value: AutomationActionType.ASSIGN_TEAM,
    label: 'Phân công nhóm',
    description: 'Chuyển cuộc hội thoại vào hàng đợi của một nhóm cụ thể.',
  },
  {
    value: AutomationActionType.ADD_LABEL,
    label: 'Gắn nhãn',
    description: 'Gắn nhãn cho cuộc hội thoại (tự động tạo nhãn nếu chưa có).',
  },
  {
    value: AutomationActionType.REMOVE_LABEL,
    label: 'Gỡ nhãn',
    description: 'Gỡ bỏ nhãn khỏi cuộc hội thoại.',
  },
  {
    value: AutomationActionType.CHANGE_STATUS,
    label: 'Đổi trạng thái',
    description: 'Cập nhật trạng thái hội thoại: Mở, Đang chờ, Đã giải quyết, hoặc Tạm hoãn.',
  },
  {
    value: AutomationActionType.CHANGE_PRIORITY,
    label: 'Đổi độ ưu tiên',
    description: 'Thiết lập mức độ khẩn cấp: Khẩn cấp, Cao, Trung bình, Thấp.',
  },
  {
    value: AutomationActionType.SEND_WEBHOOK,
    label: 'Gửi Webhook',
    description: 'Gửi payload HTTP POST ngay lập tức đến một endpoint bên ngoài.',
  },
];

export const STATUS_SELECT_OPTIONS = [
  { value: ConversationStatus.OPEN, label: 'Đang mở' },
  { value: ConversationStatus.PENDING, label: 'Đang chờ' },
  { value: ConversationStatus.SNOOZED, label: 'Tạm hoãn' },
  { value: ConversationStatus.RESOLVED, label: 'Đã giải quyết' },
];

export const PRIORITY_SELECT_OPTIONS = [
  { value: ConversationPriority.URGENT, label: 'Khẩn cấp' },
  { value: ConversationPriority.HIGH, label: 'Cao' },
  { value: ConversationPriority.MEDIUM, label: 'Trung bình' },
  { value: ConversationPriority.LOW, label: 'Thấp' },
];

export const SENDER_TYPE_SELECT_OPTIONS = [
  { value: SenderType.CONTACT, label: 'Khách hàng' },
  { value: SenderType.USER, label: 'Nhân viên / Thành viên' },
  { value: SenderType.SYSTEM, label: 'Hệ thống' },
];

import { CustomerType, CustomerStatus, ServiceType, PaymentStatus, InquiryChannel, ResponseStatus, ReservationStatus, InvoiceStatus, UserRole } from '@prisma/client';

export const CustomerTypeLabel = {
  [CustomerType.INDIVIDUAL]: '個人',
  [CustomerType.TEMPLE]: '寺院',
  [CustomerType.OTHER]: 'その他'
} as const;

export const CustomerStatusLabel = {
  [CustomerStatus.PROSPECT]: '見込み',
  [CustomerStatus.ACTIVE]: '契約中',
  [CustomerStatus.INACTIVE]: '解約済'
} as const;

export const ServiceTypeLabel = {
  [ServiceType.FAMILY_GRAVE]: '家墓',
  [ServiceType.PERPETUAL_CARE]: '永代供養墓',
  [ServiceType.COLUMBARIUM]: '納骨堂・合祀',
  [ServiceType.TREE_BURIAL]: '樹木葬'
} as const;

export const PaymentStatusLabel = {
  [PaymentStatus.UNPAID]: '未払い',
  [PaymentStatus.PAID]: '支払済'
} as const;

export const InquiryChannelLabel = {
  [InquiryChannel.PHONE]: '電話',
  [InquiryChannel.WEB_FORM]: 'Webフォーム'
} as const;

export const ResponseStatusLabel = {
  [ResponseStatus.PENDING]: '未対応',
  [ResponseStatus.IN_PROGRESS]: '対応中',
  [ResponseStatus.COMPLETED]: '対応済'
} as const;

export const ReservationStatusLabel = {
  [ReservationStatus.RESERVED]: '予約済',
  [ReservationStatus.CANCELLED]: 'キャンセル'
} as const;

export const InvoiceStatusLabel = {
  [InvoiceStatus.ISSUED]: '発行済',
  [InvoiceStatus.SENT]: '送付済',
  [InvoiceStatus.PAID]: '入金済'
} as const;

export const UserRoleLabel = {
  [UserRole.ADMIN]: '管理者',
  [UserRole.STAFF]: 'スタッフ'
} as const; 
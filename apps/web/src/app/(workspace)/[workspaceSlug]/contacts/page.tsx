import Image from 'next/image';

export default function ContactsPage() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex items-center justify-center">
        <Image
          src="/empty-contacts.svg"
          alt="Contacts & Identities"
          width={220}
          height={160}
          priority
          style={{ width: 'auto', height: 'auto' }}
          className="max-h-44 w-auto object-contain drop-shadow-xs"
        />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {'Danh bạ & Hồ sơ khách hàng'}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
        {
          'Quản lý thông tin khách hàng, định danh đa kênh và lịch sử tương tác xuyên suốt các hộp thư.'
        }
      </p>
    </div>
  );
}

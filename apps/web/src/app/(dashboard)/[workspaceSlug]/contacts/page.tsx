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
          className="max-h-44 w-auto object-contain drop-shadow-xs"
        />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Contacts & Identities</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        Manage resolved contacts, cross-channel identities, and customer profiles across all your
        inboxes.
      </p>
    </div>
  );
}

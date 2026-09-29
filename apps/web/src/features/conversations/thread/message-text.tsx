import Link from 'next/link';

export function MessageText({ content }: { content: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <Link
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80 break-all text-primary font-medium"
            >
              {part}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}

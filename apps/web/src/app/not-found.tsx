import { GhostNotFound } from '@/components/ui/ghost-404-page-1';

export default function NotFound() {
  return (
    <GhostNotFound
      homeHref="/"
      homeText="Find shelter"
      title="Boo! Page missing!"
      subtitle="Whoops! This page must be a ghost - it's not here!"
    />
  );
}

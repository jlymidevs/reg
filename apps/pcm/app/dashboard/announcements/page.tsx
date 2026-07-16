import { redirect } from 'next/navigation';

type AnnouncementsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage({ searchParams }: AnnouncementsPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const suffix = query.toString();
  redirect(suffix ? `/dashboard/communications?${suffix}` : '/dashboard/communications');
}

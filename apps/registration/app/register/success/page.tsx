import Link from 'next/link';

export default async function SuccessPage({
  searchParams,
}: { searchParams: Promise<{ matched?: string; dup?: string }> }) {
  const { matched, dup } = await searchParams;
  const isDup = dup === '1';
  const isMatched = matched === 'true';

  return (
    <div className="mx-auto max-w-xl rounded-xl border bg-white p-8 text-center shadow-sm">
      <p className="text-4xl">🎉</p>
      <h1 className="mt-2 text-2xl font-bold text-[#1F8A8B]">
        {isDup ? "You're already registered!" : 'Registration received!'}
      </h1>
      <p className="mt-2 text-gray-600">
        {isDup
          ? 'We already have your registration for this event — see you there.'
          : isMatched
            ? "You're all set — see you at the event!"
            : 'Thank you! Our team will confirm your registration shortly.'}
      </p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-[#1F8A8B] px-6 py-3 font-semibold text-white">
        Back to events
      </Link>
    </div>
  );
}

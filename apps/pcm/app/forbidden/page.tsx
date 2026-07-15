import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="mx-auto mt-20 max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="font-heading text-2xl font-semibold text-rose-900">Access not allowed</h1>
      <p className="mt-3 text-sm text-gray-600">
        Your account is signed in, but it does not have PCM portal access yet. Ask an admin to assign a
        PCM, ministry head, network head, or admin role.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
      >
        Try dashboard again
      </Link>
    </main>
  );
}

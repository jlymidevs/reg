import { createClient } from '@jlycc/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MyQrPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from('members')
    .select('name, member_code, qr_code_value')
    .or(`auth_user_id.eq.${user?.id},email.eq.${user?.email}`)
    .maybeSingle();

  if (!member?.qr_code_value) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-xl border bg-white p-8 text-center">
        <h1 className="mb-2 text-xl font-bold">No member record linked</h1>
        <p className="text-sm text-gray-500">
          Your account ({user?.email}) is not linked to a member profile yet. Ask a PCM staff or
          admin to link it.
        </p>
      </div>
    );
  }

  // QR rendered via external chart service-free inline SVG endpoint is avoided;
  // use api.qrserver.com only as placeholder — swap to local lib (`qrcode`) when packaging.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    member.qr_code_value
  )}`;

  return (
    <div className="mx-auto mt-8 max-w-sm rounded-xl border bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold">{member.name}</h1>
      <p className="mb-4 text-sm text-gray-500">{member.member_code}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl} alt="Your check-in QR code" className="mx-auto rounded-lg" width={280} height={280} />
      <p className="mt-4 text-xs text-gray-400">
        Show this code at any event check-in station. Contains no personal data.
      </p>
    </div>
  );
}

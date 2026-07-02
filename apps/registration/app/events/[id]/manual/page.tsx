'use client';

import { use, useState } from 'react';
import { createClient } from '@jlycc/supabase/client';
import type { CheckinResponse, MemberSummary } from '@jlycc/types';

type Row = MemberSummary & { qr_code_value: string | null };

export default function ManualCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('members')
      .select('id, name, member_code, journey_status, qr_code_value')
      .or(`name.ilike.%${query}%,member_code.ilike.%${query}%`)
      .order('name')
      .limit(20);
    if (error) setMsg(error.message);
    setRows((data ?? []) as Row[]);
  }

  async function checkin(row: Row) {
    if (!row.qr_code_value) {
      setMsg(`${row.name} has no QR code — contact admin.`);
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<CheckinResponse>('qr-checkin', {
      body: { event_id: eventId, qr_code_value: row.qr_code_value, method: 'manual' },
    });
    setBusy(false);
    if (error || !data?.success) setMsg(error?.message ?? data?.error ?? 'Failed');
    else if (data.duplicate) setMsg(`${row.name} already checked in.`);
    else setMsg(`✓ ${row.name} checked in.`);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Manual Check-In</h1>
      <form onSubmit={search} className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or member code"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white">
          Search
        </button>
      </form>

      {msg && <p className="mb-3 rounded-lg bg-gray-100 p-3 text-sm font-medium">{msg}</p>}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg border bg-white p-3"
          >
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-gray-500">
                {r.member_code} · {r.journey_status ?? '—'}
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => void checkin(r)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Check in
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

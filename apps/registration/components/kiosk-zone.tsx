'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@jlycc/supabase/client';
import type { ChurchEvent, CheckinResponse } from '@jlycc/types';
import { findTodayEvents, findRegistrableEvents } from '../lib/kiosk/today';
import { registerByQr } from '../lib/kiosk/actions';
import { QrScanner } from './qr-scanner';

type Flash =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; title: string; detail?: string }
  | { kind: 'warn'; title: string; detail?: string }
  | { kind: 'err'; title: string };

const RESET_MS = 3000;

export function KioskZone({ events }: { events: ChurchEvent[] }) {
  const [canScan, setCanScan] = useState(false);
  const [tab, setTab] = useState<'checkin' | 'register'>('checkin');
  const [flash, setFlash] = useState<Flash>({ kind: 'idle' });
  const [checkinEventId, setCheckinEventId] = useState<string | null>(null);
  const [registerEventId, setRegisterEventId] = useState<string | null>(null);
  const lastScanned = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayEvents = findTodayEvents(events, new Date());
  const registrable = findRegistrableEvents(events, new Date());
  const activeCheckinEvent =
    todayEvents.length === 1 ? todayEvents[0] : todayEvents.find((e) => e.id === checkinEventId) ?? null;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) return;
      const { data: allowed } = await supabase.rpc('can_scan');
      if (allowed) setCanScan(true);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const showFlash = useCallback((f: Flash) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setFlash(f);
    if (f.kind !== 'busy' && f.kind !== 'idle') {
      resetTimer.current = setTimeout(() => setFlash({ kind: 'idle' }), RESET_MS);
    }
  }, []);

  const debounced = useCallback((value: string): boolean => {
    const now = Date.now();
    if (lastScanned.current.code === value && now - lastScanned.current.at < 5000) return true;
    lastScanned.current = { code: value, at: now };
    return false;
  }, []);

  const onCheckinScan = useCallback(
    async (value: string) => {
      if (!activeCheckinEvent || debounced(value)) return;
      showFlash({ kind: 'busy' });
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke<CheckinResponse>('qr-checkin', {
        body: { event_id: activeCheckinEvent.id, qr_code_value: value },
      });
      if (error || !data) return showFlash({ kind: 'err', title: error?.message ?? 'Check-in failed' });
      if (!data.success) return showFlash({ kind: 'err', title: data.error ?? 'Check-in failed' });
      if (data.duplicate)
        return showFlash({
          kind: 'warn',
          title: 'Already checked in',
          detail: data.member?.name,
        });
      showFlash({ kind: 'ok', title: `Welcome, ${data.member?.name ?? 'member'}!`, detail: 'Checked in' });
    },
    [activeCheckinEvent, debounced, showFlash]
  );

  const onRegisterScan = useCallback(
    async (value: string) => {
      if (!registerEventId || debounced(value)) return;
      showFlash({ kind: 'busy' });
      const res = await registerByQr(registerEventId, value);
      if (!res.ok) return showFlash({ kind: 'err', title: res.error });
      if (res.duplicate)
        return showFlash({ kind: 'warn', title: 'Already registered', detail: res.memberName });
      showFlash({ kind: 'ok', title: `Registered: ${res.memberName}`, detail: 'See you there!' });
    },
    [registerEventId, debounced, showFlash]
  );

  if (!canScan) return null;

  return (
    <section className="mt-10 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => {
            lastScanned.current = { code: '', at: 0 };
            setTab('checkin');
          }}
          className={`flex-1 rounded-lg px-4 py-3 font-semibold ${tab === 'checkin' ? 'bg-violet-700 text-white' : 'bg-gray-100'}`}
        >
          Check-in
        </button>
        <button
          onClick={() => {
            lastScanned.current = { code: '', at: 0 };
            setTab('register');
          }}
          className={`flex-1 rounded-lg px-4 py-3 font-semibold ${tab === 'register' ? 'bg-[#1F8A8B] text-white' : 'bg-gray-100'}`}
        >
          Register
        </button>
      </div>

      <div className="mb-3 min-h-20">
        {flash.kind === 'busy' && (
          <div className="rounded-xl bg-gray-200 p-4 text-center font-semibold">Working…</div>
        )}
        {flash.kind === 'ok' && (
          <div className="rounded-xl bg-green-600 p-4 text-center text-white">
            <p className="text-xl font-bold">✓ {flash.title}</p>
            {flash.detail && <p className="text-sm opacity-90">{flash.detail}</p>}
          </div>
        )}
        {flash.kind === 'warn' && (
          <div className="rounded-xl bg-amber-500 p-4 text-center text-white">
            <p className="text-xl font-bold">{flash.title}</p>
            {flash.detail && <p className="text-sm opacity-90">{flash.detail}</p>}
          </div>
        )}
        {flash.kind === 'err' && (
          <div className="rounded-xl bg-red-600 p-4 text-center text-white">
            <p className="font-bold">{flash.title}</p>
          </div>
        )}
      </div>

      {tab === 'checkin' &&
        (todayEvents.length === 0 ? (
          <p className="rounded-lg bg-gray-100 p-4 text-center text-gray-500">No event today.</p>
        ) : !activeCheckinEvent ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Which event?</p>
            {todayEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => setCheckinEventId(e.id)}
                className="w-full rounded-lg border p-3 text-left hover:bg-gray-50"
              >
                {e.title} — {new Date(e.starts_at).toLocaleTimeString()}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <p className="mb-2 text-center text-sm text-gray-500">
              Checking in: <span className="font-semibold">{activeCheckinEvent.title}</span>
            </p>
            <QrScanner onScan={onCheckinScan} />
          </div>
        ))}

      {tab === 'register' &&
        (registrable.length === 0 ? (
          <p className="rounded-lg bg-gray-100 p-4 text-center text-gray-500">
            No upcoming events open for registration.
          </p>
        ) : !registerEventId ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Register for which event?</p>
            {registrable.map((e) => (
              <button
                key={e.id}
                onClick={() => setRegisterEventId(e.id)}
                className="w-full rounded-lg border p-3 text-left hover:bg-gray-50"
              >
                {e.title} — {new Date(e.starts_at).toLocaleDateString()}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setRegisterEventId(null)}
              className="mb-2 text-sm text-[#1F8A8B] underline"
            >
              ← change event
            </button>
            <p className="mb-2 text-center text-sm text-gray-500">
              Scan member QR to register for{' '}
              <span className="font-semibold">{registrable.find((e) => e.id === registerEventId)?.title}</span>
            </p>
            <QrScanner onScan={onRegisterScan} />
          </div>
        ))}
    </section>
  );
}

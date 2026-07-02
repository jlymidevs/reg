'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@jlycc/supabase/client';
import type { CheckinResponse } from '@jlycc/types';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; res: CheckinResponse }
  | { kind: 'dup'; res: CheckinResponse }
  | { kind: 'err'; message: string };

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastScanned = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const checkin = useCallback(
    async (qrValue: string) => {
      // debounce: ignore same code within 5s (camera fires repeatedly)
      const now = Date.now();
      if (lastScanned.current.code === qrValue && now - lastScanned.current.at < 5000) return;
      lastScanned.current = { code: qrValue, at: now };

      setState({ kind: 'busy' });
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke<CheckinResponse>('qr-checkin', {
        body: { event_id: eventId, qr_code_value: qrValue },
      });
      if (error || !data) {
        setState({ kind: 'err', message: error?.message ?? 'Check-in failed' });
        return;
      }
      if (!data.success) {
        setState({ kind: 'err', message: data.error ?? 'Check-in failed' });
      } else if (data.duplicate) {
        setState({ kind: 'dup', res: data });
      } else {
        setState({ kind: 'ok', res: data });
      }
    },
    [eventId]
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!Detector) {
        setCameraError('This browser has no QR support — use manual entry below (Chrome on Android recommended).');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) void checkin(codes[0].rawValue);
          } catch {
            /* frame decode error — keep scanning */
          }
        }, 400);
      } catch {
        setCameraError('Camera unavailable or permission denied — use manual entry below.');
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [checkin]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">QR Check-In</h1>

      <div className="overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      {cameraError && <p className="mt-2 text-sm text-amber-700">{cameraError}</p>}

      <div className="mt-4 min-h-24">
        {state.kind === 'busy' && (
          <div className="rounded-xl bg-gray-200 p-4 text-center font-semibold">Checking in…</div>
        )}
        {state.kind === 'ok' && state.res.member && (
          <div className="rounded-xl bg-green-600 p-4 text-center text-white">
            <p className="text-xl font-bold">✓ {state.res.member.name}</p>
            <p className="text-sm opacity-90">
              {state.res.member.member_code} · {state.res.member.journey_status ?? '—'} · checked in
            </p>
          </div>
        )}
        {state.kind === 'dup' && state.res.member && (
          <div className="rounded-xl bg-amber-500 p-4 text-center text-white">
            <p className="text-xl font-bold">Already checked in</p>
            <p className="text-sm opacity-90">
              {state.res.member.name} at{' '}
              {state.res.checked_in_at ? new Date(state.res.checked_in_at).toLocaleTimeString() : ''}
            </p>
          </div>
        )}
        {state.kind === 'err' && (
          <div className="rounded-xl bg-red-600 p-4 text-center text-white">
            <p className="font-bold">{state.message}</p>
          </div>
        )}
      </div>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) void checkin(manualCode.trim());
        }}
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Paste QR code value manually"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white">
          Check in
        </button>
      </form>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};

/**
 * Continuous QR camera scanner with manual-entry fallback.
 * Fires onScan(value) for each detected code; caller handles debouncing duplicates.
 */
export function QrScanner({ onScan, disabled }: { onScan: (value: string) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (disabled) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) {
        setCameraError('This browser has no QR support — use manual entry below (Chrome on Android recommended).');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) onScan(codes[0].rawValue);
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
  }, [onScan, disabled]);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      {cameraError && <p className="mt-2 text-sm text-amber-700">{cameraError}</p>}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) {
            onScan(manualCode.trim());
            setManualCode('');
          }
        }}
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Paste QR code value manually"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white">Go</button>
      </form>
    </div>
  );
}

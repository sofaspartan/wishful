import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { CameraOff, Flashlight, FlashlightOff, Keyboard } from 'lucide-react';
import { isValidBarcode, normalizeBarcode } from '../../shared/barcode';
import { Button } from './ui/Button';
import { FormNote } from './ui/Field';

type CameraState = 'starting' | 'live' | 'denied' | 'unsupported' | 'error';

interface Props {
  /** When false, the camera stream is stopped (e.g. modal closed or leaving the step). */
  active: boolean;
  onDetected: (code: string) => void;
  disabled?: boolean;
}

/**
 * Live rear-camera UPC / EAN reader for in-store adds, with torch toggle when
 * available and a typed-digits fallback on the camera frame.
 */
export function BarcodeScanner({ active, onDetected, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const lastCode = useRef<string | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (!active || disabled) return;
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setCamera('unsupported');
      setMessage('Camera scanning needs HTTPS (or localhost). Type the digits under the bars instead.');
      setManualOpen(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      setMessage('This browser can’t use the camera. Type the barcode digits instead.');
      setManualOpen(true);
      return;
    }

    let cancelled = false;
    let controls: { stop: () => void } | null = null;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);

    setCamera('starting');
    setMessage(null);
    setManualOpen(false);
    setTorchOn(false);
    setTorchAvailable(false);
    lastCode.current = null;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video,
          (result) => {
            if (cancelled || !result) return;
            const raw = result.getText();
            const code = normalizeBarcode(raw);
            if (!isValidBarcode(code) || code === lastCode.current) return;
            lastCode.current = code;
            // Light haptic when supported — helpful with the phone held out in an aisle.
            try {
              navigator.vibrate?.(40);
            } catch {
              /* ignore */
            }
            onDetected(code);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        const stream = video.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(Boolean(caps?.torch));
        setCamera('live');
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCamera('denied');
          setMessage('Camera access was blocked. Allow the camera for this site, or type the digits.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCamera('error');
          setMessage('No camera found. Type the digits under the barcode instead.');
        } else {
          setCamera('error');
          setMessage('Couldn’t start the camera. Type the digits under the barcode instead.');
        }
        setManualOpen(true);
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
      trackRef.current = null;
      setTorchOn(false);
    };
  }, [active, disabled, onDetected]);

  useEffect(() => {
    if (!manualOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [manualOpen]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track || !torchAvailable) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeBarcode(manual);
    if (!isValidBarcode(code)) {
      setManualError('Use the 8–14 digits printed under the bars.');
      return;
    }
    setManualError(null);
    onDetected(code);
  };

  const showManualFab = camera === 'live' && !manualOpen;
  const showManualPanel = manualOpen || (camera !== 'live' && camera !== 'starting');

  return (
    <div className="barcode-scanner">
      <div className={`barcode-viewport${camera === 'live' ? ' is-live' : ''}`}>
        <video ref={videoRef} className="barcode-video" muted playsInline />
        {camera === 'live' ? (
          <div className="barcode-frame" aria-hidden>
            <span />
          </div>
        ) : (
          <div className="barcode-fallback">
            {camera === 'starting' ? (
              <p className="muted text-sm">Starting camera…</p>
            ) : (
              <>
                <CameraOff size={28} aria-hidden />
                <p className="text-sm">{message}</p>
              </>
            )}
          </div>
        )}
        {camera === 'live' && torchAvailable && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="barcode-torch"
            iconOnly
            icon={torchOn ? <FlashlightOff size={16} aria-hidden /> : <Flashlight size={16} aria-hidden />}
            aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            onClick={() => void toggleTorch()}
          />
        )}
        {showManualFab && (
          <button
            type="button"
            className="barcode-manual-fab"
            aria-label="Type barcode digits"
            disabled={disabled}
            onClick={() => setManualOpen(true)}
          >
            <Keyboard size={20} aria-hidden />
          </button>
        )}
        {showManualPanel && (
          <form className="barcode-manual-panel" onSubmit={submitManual}>
            <label className="sr-only" htmlFor="barcode-manual-input">
              Barcode digits
            </label>
            <input
              ref={inputRef}
              id="barcode-manual-input"
              className="input barcode-manual-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="012345678905"
              value={manual}
              disabled={disabled}
              aria-invalid={Boolean(manualError)}
              aria-describedby={manualError ? 'barcode-manual-error' : undefined}
              onChange={(e) => {
                setManual(e.target.value);
                setManualError(null);
              }}
            />
            <div className="barcode-manual-actions">
              {camera === 'live' && (
                <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setManualOpen(false)}>
                  Cancel
                </Button>
              )}
              <Button type="submit" size="sm" disabled={disabled || !manual.trim()}>
                Look up
              </Button>
            </div>
            {manualError && (
              <p id="barcode-manual-error" className="barcode-manual-error" role="alert">
                {manualError}
              </p>
            )}
          </form>
        )}
      </div>

      {camera === 'denied' && (
        <FormNote>In your browser site settings, allow Camera for Wishful, then try again.</FormNote>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ImagePlus, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { FormNote } from './ui/Field';

type CameraState = 'starting' | 'live' | 'denied' | 'unsupported' | 'error';

interface Props {
  active: boolean;
  onCapture: (file: File) => void | Promise<void>;
  /** Optional gallery pick — shown as a circular control on the camera frame. */
  onUpload?: (file: File) => void | Promise<void>;
  /** Lens mode emphasizes Vision search on the shutter. */
  variant?: 'camera' | 'lens';
  disabled?: boolean;
}

/** Live rear-camera preview with a shutter (and optional upload) for product matching. */
export function CameraCapture({ active, onCapture, onUpload, variant = 'camera', disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [message, setMessage] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const isLens = variant === 'lens';

  useEffect(() => {
    if (!active || disabled) return;
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setCamera('unsupported');
      setMessage('Camera needs HTTPS (or localhost). Use the upload button to pick a photo instead.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      setMessage('This browser can’t use the camera. Use the upload button to pick a photo instead.');
      return;
    }

    let cancelled = false;
    setCamera('starting');
    setMessage(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCamera('live');
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCamera('denied');
          setMessage('Camera access was blocked. Allow the camera for this site, or upload a photo.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCamera('error');
          setMessage('No camera found. Upload a photo instead.');
        } else {
          setCamera('error');
          setMessage('Couldn’t start the camera. Upload a photo instead.');
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [active, disabled]);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || camera !== 'live' || capturing || disabled) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture frame');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not capture frame');
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        navigator.vibrate?.(30);
      } catch {
        /* ignore */
      }
      await onCapture(file);
    } catch {
      setMessage('Couldn’t take the photo. Try again, or upload one.');
    } finally {
      setCapturing(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !onUpload || disabled) return;
    setCapturing(true);
    try {
      await onUpload(file);
    } finally {
      setCapturing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="camera-capture stack">
      <div className={`barcode-viewport camera-viewport${camera === 'live' ? ' is-live' : ''}`}>
        <video ref={videoRef} className="barcode-video" muted playsInline autoPlay />
        {camera !== 'live' && (
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
        {(camera === 'live' || onUpload) && (
          <div className="camera-controls">
            {onUpload && (
              <>
                <button
                  type="button"
                  className="camera-upload"
                  aria-label="Upload a photo"
                  disabled={disabled || capturing}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus size={20} aria-hidden />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={disabled || capturing}
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </>
            )}
            {camera === 'live' && (
              <button
                type="button"
                className="camera-shutter"
                aria-label={capturing ? (isLens ? 'Searching' : 'Taking photo') : isLens ? 'Search with Lens' : 'Take photo'}
                disabled={disabled || capturing}
                onClick={() => void takePhoto()}
              >
                <span className="camera-shutter-ring" aria-hidden />
                {isLens ? <Sparkles size={22} aria-hidden /> : <Camera size={22} aria-hidden />}
              </button>
            )}
            {onUpload && <span className="camera-controls-spacer" aria-hidden />}
          </div>
        )}
      </div>
      {camera === 'denied' && (
        <FormNote>In your browser site settings, allow Camera for Wishful, then try again.</FormNote>
      )}
      {camera !== 'live' && camera !== 'starting' && !onUpload && (
        <Button type="button" variant="ghost" disabled>
          Camera unavailable
        </Button>
      )}
    </div>
  );
}

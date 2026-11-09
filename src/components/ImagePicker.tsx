import { useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import { uploadImage } from '../lib/images';
import { isHttpUrl } from '../../shared/schemas';
import { Button } from './ui/Button';
import { Spinner } from './ui/misc';

interface ImagePickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  label?: string;
  compact?: boolean;
}

/** Upload from device / camera roll, or paste an image link. Shows a preview. */
export function ImagePicker({ value, onChange, onUploadingChange, label = 'Add an image', compact }: ImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlValue, setUrlValue] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    onUploadingChange?.(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  if (value) {
    return (
      <div className="image-preview" style={compact ? { aspectRatio: '16 / 9' } : undefined}>
        <img src={value} alt="Selected" referrerPolicy="no-referrer" />
        <div className="image-preview-actions">
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={14} aria-hidden /> Replace
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
          <Button size="sm" iconOnly aria-label="Remove image" onClick={() => onChange(null)} icon={<Trash2 size={14} />} />
        </div>
        {uploading && (
          <div className="image-uploading">
            <Spinner />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack-sm">
      {urlMode ? (
        <div className="row">
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://…/image.jpg"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            aria-label="Image link"
          />
          <Button
            onClick={() => {
              if (!isHttpUrl(urlValue.trim())) return setError('Enter a valid image link starting with https://');
              setError(null);
              onChange(urlValue.trim());
            }}
          >
            Use
          </Button>
        </div>
      ) : (
        <label
          className={`dropzone${dragging ? ' dragging' : ''}`}
          style={compact ? { minHeight: 110 } : undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          {uploading ? <Spinner /> : <ImagePlus size={24} aria-hidden />}
          <strong style={{ color: 'var(--ink)' }}>{uploading ? 'Uploading…' : label}</strong>
          <span className="text-xs">Drag & drop, or tap to choose from your photos. JPEG, PNG, WebP or GIF up to 5 MB.</span>
          <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} disabled={uploading} aria-label={label} />
        </label>
      )}
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setUrlMode((m) => !m)}>
        {urlMode ? <Upload size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
        {urlMode ? 'Upload a file instead' : 'Use an image link instead'}
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

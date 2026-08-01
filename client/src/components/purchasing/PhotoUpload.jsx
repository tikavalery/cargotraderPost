import { useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { normalizeImageFile } from '../../utils/imageUpload';

const MAX = 12;
const MAX_BYTES = 3 * 1024 * 1024;

export default function PhotoUpload({
  photos = [],
  onChange,
  compact = false,
  label = 'Photos',
  hint = '',
  max = MAX
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const { showToast } = useToast();
  const limit = Math.min(Math.max(Number(max) || MAX, 1), MAX);

  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    const room = limit - photos.length;
    if (room <= 0) return;

    const batch = files.slice(0, room);
    let skipped = files.length - batch.length;
    const valid = [];
    batch.forEach((file) => {
      if (file.size > MAX_BYTES) skipped += 1;
      else valid.push(file);
    });
    if (!valid.length) {
      if (skipped) showToast('Some images skipped (max 3 MB each)');
      return;
    }

    Promise.all(valid.map((file) => normalizeImageFile(file)))
      .then((results) => {
        onChange([...photos, ...results].slice(0, limit));
      })
      .catch(() => {
        showToast('Could not process one or more images');
      });

    if (skipped) showToast('Some images skipped (max 3 MB each)');
  };

  const removeAt = (idx) => onChange(photos.filter((_, i) => i !== idx));
  const defaultHint = compact
    ? 'Additional photos for this purchase. Use the AI section above for smart fill.'
    : 'Upload multiple images. The first photo appears in tables.';

  return (
    <div className={`pur-photo-block${compact ? ' pur-photo-block--compact' : ''}`}>
      <label className="form-label">{label}</label>
      <p className="photo-sub">{hint || defaultHint}</p>
      {!compact && (
      <div
        className={`photo-drop${dragOver ? ' dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <i className="fas fa-cloud-upload-alt" />
        <p>Choose images or drag here</p>
        <span>Up to {limit} images, 3 MB each</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      )}
      {compact && (
        <>
          <button type="button" className="pur-ai-btn pur-ai-btn-upload pur-photo-add-more" onClick={() => inputRef.current?.click()}>
            <i className="fas fa-plus" /> Add more photos
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      )}
      {photos.length > 0 && !compact && (
        <div className="photo-previews">
          {photos.map((src, i) => (
            <div key={`${i}-${String(src).slice(0, 24)}`} className="photo-thumb">
              <img src={src} alt="" />
              <button type="button" className="remove-photo" onClick={() => removeAt(i)} aria-label="Remove">
                <i className="fas fa-times" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

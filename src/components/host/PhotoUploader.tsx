import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { uploadListingImage } from '../../lib/listing';

export type PhotoUploaderProps = {
  images: string[];
  onChange: (images: string[]) => void;
};

export function PhotoUploader({ images, onChange }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadUnavailable, setUploadUnavailable] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const addUrl = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onChange([...images, trimmed]);
    setUrlInput('');
  }, [images, onChange, urlInput]);

  const removeImage = useCallback(
    (index: number) => {
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      setUploading(true);
      try {
        const urls: string[] = [];
        for (const file of imageFiles) {
          const url = await uploadListingImage(file);
          urls.push(url);
        }
        onChange([...images, ...urls]);
      } catch {
        setUploadUnavailable(true);
      } finally {
        setUploading(false);
      }
    },
    [images, onChange],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      if (uploading) return;
      void handleFiles(event.dataTransfer.files);
    },
    [handleFiles, uploading],
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Add at least 1 photo. 5+ high-quality photos get more bookings.
      </p>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition ${
          dragOver
            ? 'border-orange-400 bg-orange-50'
            : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'
        } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />

        {uploading ? (
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <ImagePlus className="h-7 w-7" />
          </div>
        )}

        <p className="mt-4 text-center text-sm font-semibold text-gray-900">
          {uploading ? 'Uploading photos…' : 'Drag photos here or click to browse'}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <Upload className="h-3.5 w-3.5" />
          JPG, PNG, WEBP — multiple files supported
        </p>
      </div>

      {uploadUnavailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Direct upload isn&apos;t available yet — paste an image URL instead.
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <label htmlFor="photo-url-input" className="block text-sm font-semibold text-gray-700">
          Or paste an image URL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="photo-url-input"
            type="url"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://example.com/photo.jpg"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!urlInput.trim()}
            className="rounded-xl border border-orange-200 bg-white px-5 py-2.5 text-sm font-bold text-orange-600 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add photo
          </button>
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
              <img src={url} alt={`Listing photo ${index + 1}`} className="h-full w-full object-cover" />
              {index === 0 && (
                <span className="absolute left-2 top-2 rounded-lg bg-white/95 px-2 py-0.5 text-xs font-bold text-gray-900 shadow-sm">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(index)}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

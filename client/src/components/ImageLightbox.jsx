import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

export function ImageLightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.filename || `nova-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center bg-[#0D0D15] border border-[#232332] rounded-2xl p-2 shadow-2xl purple-glow overflow-hidden"
      >
        {/* Top Controls */}
        <div className="w-full flex items-center justify-between px-3 py-2 border-b border-[#232332] text-zinc-300">
          <span className="text-xs font-semibold truncate max-w-xs sm:max-w-md text-zinc-200">
            {image.alt || image.filename || 'Hi Nova! Image'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              title="Download image"
              aria-label="Download image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              title="Close image preview"
              aria-label="Close image preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-2">
          <img
            src={image.url}
            alt={image.alt || 'Enlarged preview'}
            className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
          />
        </div>

        {/* Caption if present */}
        {image.caption && (
          <div className="w-full px-4 py-2 border-t border-[#232332] text-xs text-zinc-400 text-center">
            {image.caption}
          </div>
        )}
      </div>
    </div>
  );
}


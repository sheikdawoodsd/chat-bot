import { useState } from 'react';
import {
  X,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Download,
  ExternalLink,
  Search,
} from 'lucide-react';

const SUGGESTED_COSMIC_IMAGES = [
  {
    title: 'Iridescent Celestial Core',
    prompt: 'A luminous iridescent crystal planet core with neon violet rings drifting through a purple nebula, 8k render',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Cybernetic Orbit Station',
    prompt: 'Deep space orbital observatory station surrounded by glowing purple solar flares and cosmic stardust, hyperrealistic',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Cosmic Silk Nebula',
    prompt: 'Floating silky ribbons of purple and indigo aurora light undulating across a dark endless starfield, cinematic lighting',
    url: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Supernova Horizon',
    prompt: 'Breathtaking supernova explosion dispersing purple, magenta, and cyan energy filaments into deep cosmos, photorealistic 8k',
    url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80',
  },
];

export function LibraryModal({
  isOpen,
  onClose,
  chats = [],
  onSelectPrompt,
  onEnlargeImage,
}) {
  const [activeTab, setActiveTab] = useState('images'); // 'images' | 'files' | 'suggestions'
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  // Extract all generated images from current user chats
  const generatedImages = [];
  const attachedFiles = [];

  for (const chat of chats) {
    for (const msg of chat.messages || []) {
      if (msg.generatedImage?.url) {
        generatedImages.push({
          id: msg.id,
          url: msg.generatedImage.url,
          prompt: msg.generatedImage.prompt || 'Generated with Nova',
          timestamp: msg.timestamp,
          chatTitle: chat.title,
        });
      }
      for (const att of msg.attachments || []) {
        if (att.isImage && (att.url || att.dataUrl)) {
          generatedImages.push({
            id: att.id || msg.id,
            url: att.url || att.dataUrl,
            prompt: att.name,
            timestamp: msg.timestamp,
            chatTitle: chat.title,
            isUserUpload: true,
          });
        } else {
          attachedFiles.push({
            id: att.id || msg.id,
            name: att.name,
            size: att.size,
            type: att.type,
            url: att.url,
            chatTitle: chat.title,
            timestamp: msg.timestamp,
          });
        }
      }
    }
  }

  const handleDownload = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name || `nova-library-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[85vh] rounded-3xl bg-[#120B24] border border-purple-500/30 shadow-2xl p-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Cosmic Library</h2>
              <p className="text-xs text-zinc-400">
                All your attachments, generated images, and curated cosmic inspirations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 pb-2">
          <div className="flex items-center gap-1.5 p-1 bg-[#1A1232] rounded-2xl border border-purple-500/20">
            <button
              type="button"
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'images'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Created Images ({generatedImages.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'files'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Attached Files ({attachedFiles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('suggestions')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'suggestions'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Suggested Images</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter library..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#1A1232] border border-purple-500/20 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Tab Content Gallery */}
        <div className="flex-1 overflow-y-auto pt-3 pb-2 custom-scrollbar">
          {/* Tab 1: Created Images */}
          {activeTab === 'images' && (
            generatedImages.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 text-xs">
                No images generated yet. Use Image Studio to generate images with Nova!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {generatedImages
                  .filter((img) => !search || img.prompt.toLowerCase().includes(search.toLowerCase()))
                  .map((img, i) => (
                    <div
                      key={img.id || i}
                      className="group relative rounded-2xl overflow-hidden bg-[#18112C] border border-purple-500/30 shadow-md"
                    >
                      <img
                        src={img.url}
                        alt={img.prompt}
                        className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() =>
                          onEnlargeImage?.({
                            url: img.url,
                            filename: `nova-image-${Date.now()}.png`,
                            alt: img.prompt,
                            caption: img.prompt,
                          })
                        }
                      />
                      <div className="p-2 flex items-center justify-between bg-[#120B24]/90 border-t border-purple-500/20">
                        <span className="text-[10px] text-zinc-300 truncate max-w-[120px]">
                          {img.prompt}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownload(img.url, `nova-${img.id}.png`)}
                          className="p-1 rounded text-purple-400 hover:text-white"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )
          )}

          {/* Tab 2: Attached Files */}
          {activeTab === 'files' && (
            attachedFiles.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 text-xs">
                No documents or code files attached yet.
              </div>
            ) : (
              <div className="space-y-2">
                {attachedFiles
                  .filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()))
                  .map((file, idx) => (
                    <div
                      key={file.id || idx}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#1A1232] border border-purple-500/25 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-purple-400 shrink-0" />
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-zinc-200 truncate">{file.name}</h4>
                          <span className="text-[10px] text-zinc-500">From: {file.chatTitle}</span>
                        </div>
                      </div>
                      {file.url && (
                        <a
                          href={file.url}
                          download={file.name}
                          className="flex items-center gap-1 px-3 py-1 text-xs rounded-xl bg-purple-600/30 text-purple-200 hover:bg-purple-600/50 border border-purple-500/30"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            )
          )}

          {/* Tab 3: Suggested Cosmic Images */}
          {activeTab === 'suggestions' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SUGGESTED_COSMIC_IMAGES.map((sug, idx) => (
                <div
                  key={idx}
                  className="group rounded-2xl overflow-hidden bg-[#18112C] border border-purple-500/30 shadow-lg flex flex-col justify-between"
                >
                  <img
                    src={sug.url}
                    alt={sug.title}
                    className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-3 bg-[#120B24] border-t border-purple-500/20">
                    <h4 className="text-xs font-bold text-white mb-1">{sug.title}</h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                      &quot;{sug.prompt}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectPrompt(sug.prompt);
                      }}
                      className="w-full py-1.5 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold border border-purple-500/40 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Create Image with Nova</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


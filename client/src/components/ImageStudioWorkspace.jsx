import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  MessageSquare,
  MessageSquareOff,
  AlertCircle,
  Send,
  Maximize2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square' },
  { id: '16:9', label: '16:9 Wide' },
  { id: '9:16', label: '9:16 Portrait' },
  { id: '4:3', label: '4:3 Classic' },
];

const STYLES = [
  { id: 'Realistic', label: 'Photorealistic' },
  { id: 'Illustration', label: 'Illustration' },
  { id: '3D', label: '3D Render' },
  { id: 'Anime', label: 'Anime Style' },
  { id: 'Minimal', label: 'Minimalist' },
];

const INSPIRATION_PROMPTS = [
  'Futuristic cybernetic tiger with glowing blue circuits in a neon rainforest',
  'Cosmic crystal planet with violet aurora rings in deep starlit space',
  'Cinematic portrait of an astronaut exploring a bioluminescent alien cave',
  'Hyper-detailed cyberpunk Tokyo street at midnight in the pouring rain, 8k',
];

export function ImageStudioWorkspace({
  messages = [],
  isStreaming = false,
  onSendImagePrompt,
  onRegenerateImage,
  onEnlargeImage,
  isChatHidden = false,
  onToggleChat,
}) {
  const [promptInput, setPromptInput] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [style, setStyle] = useState('Realistic');
  const [toastMessage, setToastMessage] = useState('');
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Collect all generated images in the conversation
  const generatedImages = useMemo(() => {
    const list = [];
    messages.forEach((msg) => {
      if (msg.generatedImage && msg.generatedImage.url) {
        list.push({
          id: msg.id,
          url: msg.generatedImage.url,
          prompt: msg.generatedImage.prompt || 'Generated Image',
          promptUsed: msg.generatedImage.promptUsed || msg.generatedImage.prompt,
          geminiPrompt: msg.generatedImage.geminiPrompt || msg.content || msg.generatedImage.prompt,
          aspectRatio: msg.generatedImage.aspectRatio || '1:1',
          style: msg.generatedImage.style || 'Realistic',
          timestamp: msg.timestamp,
        });
      }
    });
    return list;
  }, [messages]);

  // Check if an image is currently in-flight
  const activeGeneratingMsg = useMemo(() => {
    return messages.find((m) => m.isGeneratingImage);
  }, [messages]);

  // Check if last image message had an error
  const lastErrorMsg = useMemo(() => {
    return messages.filter((m) => m.isError && m.failedPrompt).slice(-1)[0] || null;
  }, [messages]);

  // Active image to display in the main studio hero
  const activeImage = useMemo(() => {
    if (generatedImages.length === 0) return null;
    const idx = Math.min(selectedImageIndex, generatedImages.length - 1);
    return generatedImages[idx] || generatedImages[generatedImages.length - 1];
  }, [generatedImages, selectedImageIndex]);

  // Default to the latest image when new ones arrive
  useEffect(() => {
    if (generatedImages.length > 0) {
      setSelectedImageIndex(generatedImages.length - 1);
    }
  }, [generatedImages.length]);

  const copyToClipboard = async (text, successNotice) => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setToastMessage(successNotice || 'Copied to clipboard!');
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const handleOpenInGemini = (promptToCopy) => {
    copyToClipboard(
      promptToCopy,
      'Gemini prompt copied! Paste it into Gemini to generate your image.'
    );
    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
  };

  const handleDownload = (imageUrl, promptText) => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `nova-image-${(promptText || 'studio')
      .slice(0, 24)
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStudioSubmit = (e) => {
    e.preventDefault();
    if (!promptInput.trim() || isStreaming) return;
    const text = promptInput.trim();
    setPromptInput('');
    onSendImagePrompt?.({
      text,
      aspectRatio,
      style,
      isImageGen: true,
      workspaceMode: 'image',
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#080512] text-zinc-100 overflow-y-auto relative select-none">
      {/* Studio Header Toolbar */}
      <div className="shrink-0 w-full px-4 sm:px-6 py-3 border-b border-purple-500/20 bg-[#120B24]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600/25 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-100">
                Image Studio
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/30">
                AI Engine
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Photorealistic generation with 10-point Gemini AI prompt extraction
            </p>
          </div>
        </div>

        {/* Studio Controls: Show/Hide Chat Toggle */}
        <div className="flex items-center gap-2">
          {onToggleChat && (
            <button
              type="button"
              onClick={onToggleChat}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm active:scale-95 ${
                isChatHidden
                  ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.35)]'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-purple-200 border-purple-500/30'
              }`}
              title={isChatHidden ? 'Show Chat Box' : 'Hide Chat Box to expand visual workspace'}
            >
              {isChatHidden ? (
                <>
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                  <span>Show Chat</span>
                </>
              ) : (
                <>
                  <MessageSquareOff className="w-3.5 h-3.5 text-purple-300" />
                  <span>Hide Chat</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs shadow-2xl backdrop-blur-md animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Studio Visual Content */}
      <div className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col items-center justify-center">
        {/* State 1: Currently In-Flight Generating Image */}
        {activeGeneratingMsg ? (
          <div className="w-full max-w-2xl p-8 rounded-3xl bg-[#160E2E]/90 border border-purple-500/30 shadow-[0_0_40px_rgba(147,51,234,0.25)] flex flex-col items-center justify-center gap-5 text-center my-auto animate-pulse">
            <div className="relative w-20 h-20 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center shadow-lg">
              <Sparkles className="w-10 h-10 text-purple-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Crafting High-Resolution Visual with AI
              </h3>
              <p className="text-xs text-purple-300 mt-1 max-w-md">
                Refining details, lighting, textures, and generating full Gemini-compatible prompt...
              </p>
            </div>
            <div className="w-48 h-1.5 rounded-full bg-purple-950 overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 animate-[moveBg_2s_infinite]" />
            </div>
          </div>
        ) : lastErrorMsg && generatedImages.length === 0 ? (
          /* State 2: Error State with Retry Button */
          <div className="w-full max-w-xl p-6 rounded-3xl bg-rose-950/40 border border-rose-500/30 shadow-xl flex flex-col items-center text-center gap-3 my-auto animate-fade-in">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <h3 className="text-sm font-semibold text-rose-200">
              Visual Creation Paused
            </h3>
            <p className="text-xs text-rose-300 max-w-md leading-relaxed">
              {lastErrorMsg.content || 'Unable to generate image at this moment.'}
            </p>
            {onRegenerateImage && lastErrorMsg.failedPrompt && (
              <button
                type="button"
                onClick={() =>
                  onRegenerateImage(lastErrorMsg.id, lastErrorMsg.failedPrompt)
                }
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg transition-transform active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Generation</span>
              </button>
            )}
          </div>
        ) : activeImage ? (
          /* State 3: Active Image Display Canvas */
          <div className="w-full flex flex-col items-center gap-5 my-auto animate-fade-in">
            {/* Gallery Thumbnail Strip (if multiple images exist) */}
            {generatedImages.length > 1 && (
              <div className="w-full max-w-2xl flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-none">
                {generatedImages.map((img, i) => (
                  <button
                    key={img.id || i}
                    type="button"
                    onClick={() => setSelectedImageIndex(i)}
                    className={`relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImageIndex === i
                        ? 'border-purple-400 scale-105 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Hero Image Showcase Card */}
            <div className="w-full max-w-2xl rounded-3xl bg-[#120B24]/95 border border-purple-500/30 overflow-hidden shadow-[0_0_50px_rgba(139,92,246,0.25)] flex flex-col">
              <div
                onClick={() =>
                  onEnlargeImage?.({
                    url: activeImage.url,
                    filename: `nova-image-${Date.now()}.png`,
                    alt: activeImage.prompt,
                    caption: activeImage.prompt,
                  })
                }
                className="group relative cursor-pointer overflow-hidden bg-black/60 flex items-center justify-center max-h-[520px]"
              >
                <img
                  src={activeImage.url}
                  alt={activeImage.prompt}
                  className="w-full h-auto max-h-[520px] object-contain group-hover:scale-[1.01] transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                  <Maximize2 className="w-4 h-4 text-purple-300" />
                  <span>Click to view full resolution</span>
                </div>
              </div>

              {/* Card Meta & Control Actions */}
              <div className="p-4 sm:p-5 flex flex-col gap-3.5 bg-[#140C2A]">
                {/* Prompt Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider block">
                      Image Request
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-zinc-100 line-clamp-2 mt-0.5">
                      "{activeImage.prompt}"
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPromptDetails(!showPromptDetails)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-purple-300 transition-colors"
                  >
                    <span>Gemini Prompt</span>
                    {showPromptDetails ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Collapsible 10-Point Gemini Prompt Drawer */}
                {showPromptDetails && (
                  <div className="p-3.5 rounded-2xl bg-[#1C1434] border border-purple-500/30 text-xs text-zinc-200 space-y-2 animate-scale-in max-h-56 overflow-y-auto">
                    <div className="flex items-center justify-between pb-1 border-b border-purple-500/20 text-[11px] font-semibold text-purple-300">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Gemini AI Structured Prompt</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(activeImage.geminiPrompt, 'Gemini prompt copied!')
                        }
                        className="flex items-center gap-1 text-purple-400 hover:text-white font-mono text-[10px]"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed font-mono text-[11px] text-purple-100/90">
                      {activeImage.geminiPrompt}
                    </p>
                  </div>
                )}

                {/* Action Buttons Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-500/15">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Open in Gemini button */}
                    <button
                      type="button"
                      onClick={() => handleOpenInGemini(activeImage.geminiPrompt)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/45 border border-blue-500/40 text-blue-200 text-xs font-semibold transition-all shadow-sm active:scale-95"
                      title="Open Gemini AI in a new tab and copy this prompt to clipboard"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                      <span>Open in Gemini</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </button>

                    {/* Copy Gemini Prompt button */}
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          activeImage.geminiPrompt,
                          'Gemini prompt copied to clipboard!'
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/35 text-purple-200 text-xs font-medium transition-all active:scale-95"
                      title="Copy full Gemini-compatible prompt"
                    >
                      <Copy className="w-3.5 h-3.5 text-purple-300" />
                      <span>Copy Gemini Prompt</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {onRegenerateImage && (
                      <button
                        type="button"
                        onClick={() =>
                          onRegenerateImage(activeImage.id, activeImage.prompt)
                        }
                        className="p-2 rounded-xl text-purple-300 hover:text-white hover:bg-white/5 border border-purple-500/20 transition-all"
                        title="Retry / Regenerate this image"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(activeImage.url, activeImage.prompt)
                      }
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-transform active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* State 4: Welcome & Inspiration Starters (No images generated yet) */
          <div className="w-full max-w-2xl flex flex-col items-center text-center gap-6 my-auto animate-fade-in py-8">
            <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.2)]">
              <ImageIcon className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Nova Image Studio
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                Describe any visual scene to generate high-resolution art and receive complete Gemini AI prompts.
              </p>
            </div>

            {/* Inspiration Chips */}
            <div className="w-full flex flex-col items-center gap-2">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
                Quick Inspiration Starters
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
                {INSPIRATION_PROMPTS.map((text, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onSendImagePrompt?.({
                        text,
                        aspectRatio,
                        style,
                        isImageGen: true,
                        workspaceMode: 'image',
                      });
                    }}
                    className="p-3 rounded-2xl bg-[#140C2A]/80 hover:bg-[#1E123D] border border-purple-500/20 hover:border-purple-400/40 text-left text-xs text-zinc-300 hover:text-white transition-all shadow-sm group"
                  >
                    <span className="line-clamp-2">"{text}"</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Embedded Studio Input Bar (Prominently available when chat is hidden, or at the bottom of the studio) */}
        {isChatHidden && (
          <div className="w-full max-w-2xl mt-6 shrink-0 sticky bottom-4 z-20">
            <form
              onSubmit={handleStudioSubmit}
              className="p-2 sm:p-2.5 rounded-2xl bg-[#180E34]/95 border border-purple-500/40 shadow-[0_0_35px_rgba(139,92,246,0.35)] backdrop-blur-xl flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Describe the image you want Nova to generate..."
                  disabled={isStreaming}
                  className="flex-1 px-3 py-2 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!promptInput.trim() || isStreaming}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Generate</span>
                </button>
              </div>

              {/* Style & Aspect Ratio Pickers */}
              <div className="flex items-center justify-between border-t border-purple-500/20 pt-2 px-1 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-purple-300">Style:</span>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="bg-[#241748] border border-purple-500/30 rounded-lg px-2 py-0.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    {STYLES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-purple-300">Ratio:</span>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="bg-[#241748] border border-purple-500/30 rounded-lg px-2 py-0.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


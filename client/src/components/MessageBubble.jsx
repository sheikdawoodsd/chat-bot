import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  Download,
  Volume2,
  VolumeX,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { PresentationViewer } from './PresentationViewer';
import { UserAvatar } from './UserAvatar';
import { useAuth } from '../context/AuthContext';
import { audioPlayer } from '../services/audioPlayer';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime, name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (mime?.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  if (ext === 'csv') return FileSpreadsheet;
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'json', 'sql', 'cpp', 'java'].includes(ext)) {
    return FileCode;
  }
  return FileText;
}

/**
 * MessageBubble - Image 2 Layout Adaptation with Nova Cosmic Theme
 * Layout:
 * - Desktop: User prompt on the LEFT, AI generated text on the RIGHT
 * - Mobile: ALL messages on the LEFT
 */
export function MessageBubble({
  message,
  isStreaming = false,
  onRetry,
  onRegenerate,
  onRegenerateImage,
  onEnlargeImage,
}) {
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const isError = Boolean(message.isError);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(message.feedback || null);

  // Stop speech if unmounting
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        audioPlayer.stop();
      }
    };
  }, [isSpeaking]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      audioPlayer.stop();
      setIsSpeaking(false);
      return;
    }

    if (!message.content) return;

    setIsSpeaking(true);
    audioPlayer.speakText(message.content, {
      onDone: () => setIsSpeaking(false),
    });
  };

  const handleFeedback = async (val) => {
    const next = feedback === val ? null : val;
    setFeedback(next);
    if (message.id) {
      try {
        await fetch(`/api/messages/${message.id}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: next }),
        });
      } catch (e) {
        console.warn('[Nova] Feedback save error:', e);
      }
    }
  };

  const handleDownloadImage = (imageUrl, promptText) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `nova-${(promptText || 'image')
      .slice(0, 24)
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [toastMessage, setToastMessage] = useState('');
  const [showPromptDetails, setShowPromptDetails] = useState(false);

  const copyPromptText = async (text, msg) => {
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
      setToastMessage(msg || 'Copied to clipboard!');
      setTimeout(() => setToastMessage(''), 3500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleOpenInGemini = (promptToUse) => {
    copyPromptText(
      promptToUse,
      'Gemini prompt copied! Paste it into Gemini to generate your image.'
    );
    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
  };

  if (isError) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-3 flex justify-start animate-fade-in">
        <div className="flex items-start gap-3.5 p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-300 shadow-lg max-w-2xl">
          <div className="shrink-0 p-2 rounded-2xl bg-rose-500/20 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-rose-200 mb-1 flex items-center gap-1.5">
              <span>Nova Notice</span>
            </h4>
            <p className="text-sm text-rose-300 leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-md shadow-purple-600/30 purple-glow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-5xl mx-auto px-4 py-3 flex ${
        isUser
          ? 'justify-start items-start' // Desktop & Mobile: User on the LEFT
          : 'justify-start md:justify-end items-start' // Mobile: LEFT, Desktop: RIGHT (Image 2)
      } animate-fade-in`}
    >
      {/* User Message Bubble (Left side) */}
      {isUser ? (
        <div className="flex items-start gap-3 max-w-[92%] sm:max-w-xl md:max-w-2xl">
          {/* User Avatar */}
          <UserAvatar user={user} className="w-8 h-8 mt-1 shadow-md border border-purple-400/40" />

          {/* User Card Content */}
          <div className="p-4 rounded-3xl bg-[#18112C]/90 border border-purple-500/30 shadow-lg text-white">
            {/* User Attachments Display */}
            {Array.isArray(message.attachments) && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mb-2.5">
                {message.attachments.map((att, idx) => {
                  const Icon = getFileIcon(att.type || att.mimeType, att.name);
                  const isImg = (att.type || att.mimeType || '').startsWith('image/');
                  const previewSrc =
                    att.url ||
                    att.dataUrl ||
                    (att.data ? `data:${att.mimeType || 'image/png'};base64,${att.data}` : null);

                  if (isImg && previewSrc) {
                    return (
                      <div
                        key={att.id || idx}
                        onClick={() =>
                          onEnlargeImage?.({
                            url: previewSrc,
                            filename: att.name,
                            alt: att.name,
                          })
                        }
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-purple-500/30 shadow-sm"
                      >
                        <img
                          src={previewSrc}
                          alt={att.name}
                          className="w-24 h-24 sm:w-28 sm:h-28 object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    );
                  }

                  return (
                    <a
                      key={att.id || idx}
                      href={att.url || '#'}
                      download={att.name}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2 px-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs text-zinc-200"
                    >
                      <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate font-medium max-w-[140px]">{att.name}</span>
                    </a>
                  );
                })}
              </div>
            )}

            {/* User Text */}
            <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        </div>
      ) : (
        /* AI Response Card (Image 2: Right side on desktop, Left on mobile) */
        <div className="flex items-start gap-3 w-full max-w-[95%] sm:max-w-2xl md:max-w-3xl">
          {/* Nova Mascot Avatar */}
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 via-indigo-600 to-purple-400 p-0.5 shadow-md purple-glow-sm mt-1">
            <img
              src="/logo.png"
              alt="Nova"
              className="w-full h-full rounded-full object-cover"
            />
          </div>

          {/* AI Card (Image 2 Layout with Code Blocks & Actions) */}
          <div className="flex-1 min-w-0 p-5 rounded-3xl bg-[#120B24]/90 border border-purple-500/30 shadow-2xl purple-glow-sm">
            {/* Header: Nova AI + Action Toolbar */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs tracking-wide text-purple-200">
                  Nova AI
                </span>
                <span className="text-[10px] text-purple-400 font-medium bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  Cosmic Model
                </span>
              </div>

              {/* Action Buttons */}
              {!isStreaming && (
                <div className="flex items-center gap-1.5">
                  {/* Speak Aloud Button */}
                  {message.content && (
                    <button
                      type="button"
                      onClick={handleToggleSpeak}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg transition-colors ${
                        isSpeaking
                          ? 'bg-purple-500/20 text-purple-300 animate-pulse'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                      title={isSpeaking ? 'Stop speaking' : 'Read aloud with Nova voice'}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-purple-400">Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Speak</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Feedback Thumbs */}
                  <button
                    type="button"
                    onClick={() => handleFeedback('like')}
                    className={`p-1 rounded-md transition-colors ${
                      feedback === 'like'
                        ? 'text-purple-400 bg-purple-500/20'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Helpful"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback('dislike')}
                    className={`p-1 rounded-md transition-colors ${
                      feedback === 'dislike'
                        ? 'text-rose-400 bg-rose-500/20'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Needs improvement"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Regenerate Button */}
                  {onRegenerate && !message.generatedImage && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className="p-1 rounded-md text-zinc-400 hover:text-white"
                      title="Regenerate"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Copy Button */}
                  {message.content && (
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                      title="Copy response"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Image Generation Shimmer Loading Placeholder */}
            {message.isGeneratingImage && (
              <div className="w-full max-w-md p-4 rounded-2xl bg-[#1A1230] border border-purple-500/30 overflow-hidden relative shadow-lg my-2">
                <div className="aspect-square w-full rounded-xl bg-gradient-to-r from-purple-500/10 via-purple-500/25 to-purple-500/10 animate-pulse flex flex-col items-center justify-center gap-3">
                  <Sparkles className="w-8 h-8 text-purple-400 animate-spin" />
                  <span className="text-xs font-semibold text-purple-300">
                    Nova is creating your image...
                  </span>
                </div>
              </div>
            )}

            {/* Inline Generated Image Card */}
            {message.generatedImage && (
              <div className="my-2 w-full max-w-md rounded-2xl bg-[#160E2A] border border-purple-500/30 overflow-hidden shadow-xl">
                <div
                  onClick={() =>
                    onEnlargeImage?.({
                      url: message.generatedImage.url,
                      filename: `nova-image-${Date.now()}.png`,
                      alt: message.generatedImage.prompt || 'Generated by Nova',
                      caption: message.generatedImage.prompt,
                    })
                  }
                  className="group relative cursor-pointer overflow-hidden bg-black/40"
                >
                  <img
                    src={message.generatedImage.url}
                    alt={message.generatedImage.prompt || 'Nova generated image'}
                    className="w-full h-auto max-h-[380px] object-cover group-hover:scale-[1.02] transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                    Click to enlarge
                  </div>
                </div>

                <div className="p-3 flex flex-col gap-2.5 border-t border-purple-500/20 bg-[#120B24]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-300 font-medium truncate max-w-[200px]">
                      {message.generatedImage.prompt}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPromptDetails(!showPromptDetails)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 underline font-medium"
                    >
                      {showPromptDetails ? 'Hide Prompt' : 'View Gemini Prompt'}
                    </button>
                  </div>

                  {/* Collapsible Gemini Prompt Preview */}
                  {showPromptDetails && (
                    <div className="p-2.5 rounded-xl bg-[#1C1434] border border-purple-500/30 text-[11px] text-zinc-200 space-y-1.5 animate-fade-in max-h-44 overflow-y-auto">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-purple-300">
                        <span>Gemini AI Image Prompt</span>
                        <button
                          type="button"
                          onClick={() =>
                            copyPromptText(
                              message.generatedImage.geminiPrompt || message.generatedImage.prompt,
                              'Gemini prompt copied!'
                            )
                          }
                          className="flex items-center gap-1 text-purple-400 hover:text-purple-200 font-mono"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed font-mono text-[10px] text-purple-100/90">
                        {message.generatedImage.geminiPrompt || message.generatedImage.prompt}
                      </p>
                    </div>
                  )}

                  {/* Action Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-purple-500/10">
                    <div className="flex items-center gap-1.5">
                      {/* Open in Gemini button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenInGemini(
                            message.generatedImage.geminiPrompt || message.generatedImage.prompt
                          )
                        }
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/40 text-blue-200 font-medium transition-all shadow-sm active:scale-95"
                        title="Open in Google Gemini AI (prompt copied automatically)"
                      >
                        <Sparkles className="w-3 h-3 text-blue-300" />
                        <span>Open in Gemini</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                      </button>

                      {/* Copy Gemini Prompt button */}
                      <button
                        type="button"
                        onClick={() =>
                          copyPromptText(
                            message.generatedImage.geminiPrompt || message.generatedImage.prompt,
                            'Gemini prompt copied to clipboard!'
                          )
                        }
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 text-purple-200 transition-all active:scale-95"
                        title="Copy Gemini-compatible image prompt"
                      >
                        <Copy className="w-3 h-3 text-purple-300" />
                        <span>Copy Prompt</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onRegenerateImage && (
                        <button
                          type="button"
                          onClick={() => onRegenerateImage(message.id, message.generatedImage.prompt)}
                          className="p-1.5 rounded-lg text-purple-400 hover:text-purple-200 hover:bg-white/5 transition-colors"
                          title="Retry / Regenerate image"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadImage(
                            message.generatedImage.url,
                            message.generatedImage.prompt
                          )
                        }
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium shadow transition-transform active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Toast notification feedback */}
                  {toastMessage && (
                    <div className="mt-1 px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-[10px] flex items-center gap-1 animate-fade-in">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{toastMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Presentation Deck Carousel Viewer */}
            {message.content && !isStreaming && (
              <PresentationViewer content={message.content} />
            )}

            {/* Markdown Text Body */}
            {message.content && (
              <div className="prose-chat text-zinc-200 text-sm sm:text-[15px] leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ _node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');

                      if (!inline && (match || codeString.includes('\n'))) {
                        return (
                          <CodeBlock
                            language={match ? match[1] : 'plaintext'}
                            value={codeString}
                          />
                        );
                      }

                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    a({ _node, ...props }) {
                      return (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#A78BFA] hover:text-[#C4B5FD] underline font-medium"
                        />
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {isStreaming && <span className="animate-cursor" />}
              </div>
            )}

            {/* Google Search Grounding Sources */}
            {Array.isArray(message.sources) && message.sources.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-purple-500/20">
                <div className="text-[11px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sources</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {message.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[11px] font-medium transition-colors"
                    >
                      <span className="truncate max-w-[160px]">{src.title || src.domain}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Square,
  Paperclip,
  Mic,
  AudioWaveform,
  Image as ImageIcon,
  FileText,
  Sparkles,
  X,
  FileCode,
  FileSpreadsheet,
  AlertCircle,
  Sliders,
  BrainCircuit,
  ChevronDown,
  UploadCloud,
} from 'lucide-react';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { resizeImageIfNeeded } from '../services/imageOptimizer';
import { audioPlayer } from '../services/audioPlayer';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

const ALLOWED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'pdf',
  'txt',
  'md',
  'csv',
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'html',
  'css',
  'c',
  'cpp',
  'h',
  'hpp',
  'java',
  'go',
  'rs',
  'sql',
  'sh',
  'yaml',
  'yml',
];

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

export function MessageInput({
  onSend,
  onStop,
  onOpenVoiceMode,
  isStreaming = false,
  disabled = false,
  workspaceMode = 'general',
  onSelectWorkspaceMode,
}) {
  const [input, setInput] = useState(() => {
    try {
      // Clear any legacy localStorage drafts so fresh page opens are always clean
      localStorage.removeItem('nova_draft_' + workspaceMode);
      return sessionStorage.getItem('nova_draft_' + workspaceMode) || '';
    } catch {
      return '';
    }
  });
  const [attachments, setAttachments] = useState([]);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isDeepThinkingOpen, setIsDeepThinkingOpen] = useState(false);
  const [isImageMode, setIsImageMode] = useState(workspaceMode === 'image');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
  const [selectedStyle, setSelectedStyle] = useState('Realistic');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef(null);
  const attachMenuRef = useRef(null);
  const deepThinkingMenuRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync workspace mode & restore draft for the selected module (ChatGPT-style session persistence)
  useEffect(() => {
    if (workspaceMode === 'image') {
      setIsImageMode(true);
    } else {
      setIsImageMode(false);
    }
    try {
      const draft = sessionStorage.getItem('nova_draft_' + workspaceMode) || '';
      setInput(draft);
    } catch {}
  }, [workspaceMode]);

  // Real-time draft persistence within session
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    try {
      if (val) {
        sessionStorage.setItem('nova_draft_' + workspaceMode, val);
      } else {
        sessionStorage.removeItem('nova_draft_' + workspaceMode);
      }
    } catch {}
  };

  // Compute placeholder based on active workspace mode
  const getPlaceholder = () => {
    if (isImageMode || workspaceMode === 'image') {
      return 'Describe the image you want Nova to generate...';
    }
    if (workspaceMode === 'project') {
      return 'Type your project idea, architecture or goal...';
    }
    if (workspaceMode === 'presentation') {
      return 'Type your presentation topic or slide outline...';
    }
    if (workspaceMode === 'code') {
      return 'Describe the code, function, or bug you want Nova to solve...';
    }
    return 'How can I help you?';
  };

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${Math.max(newHeight, 44)}px`;
  }, [input]);

  // Click outside listener for popup menus
  useEffect(() => {
    function handleClickOutside(e) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setIsAttachOpen(false);
      }
      if (deepThinkingMenuRef.current && !deepThinkingMenuRef.current.contains(e.target)) {
        setIsDeepThinkingOpen(false);
      }
    }
    if (isAttachOpen || isDeepThinkingOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAttachOpen, isDeepThinkingOpen]);

  // Clear transient error after 5 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // Validate and read uploaded files
  const processFiles = useCallback(
    async (fileList) => {
      setErrorMessage('');
      const incoming = Array.from(fileList || []);
      if (incoming.length === 0) return;

      if (attachments.length + incoming.length > MAX_FILES) {
        setErrorMessage(`You can attach a maximum of ${MAX_FILES} files per message.`);
        return;
      }

      const newAttachments = [];

      for (const file of incoming) {
        const ext = file.name.split('.').pop().toLowerCase();
        const isSupportedExt = ALLOWED_EXTENSIONS.includes(ext);
        const isSupportedMime =
          file.type.startsWith('image/') ||
          file.type === 'application/pdf' ||
          file.type.startsWith('text/') ||
          file.type === 'application/json';

        if (!isSupportedExt && !isSupportedMime) {
          setErrorMessage(
            `"${file.name}" has an unsupported format. Supported: PNG, JPG, WEBP, PDF, TXT, MD, CSV, JSON, and code files.`
          );
          continue;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          setErrorMessage(`"${file.name}" exceeds the 10 MB size limit.`);
          continue;
        }

        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';

        const fileToUse = isImage ? await resizeImageIfNeeded(file, 2048, 0.88) : file;

        const attachmentObj = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          file: fileToUse,
          name: fileToUse.name,
          size: fileToUse.size,
          type: fileToUse.type || 'text/plain',
          isImage,
          isPdf,
        };

        if (isImage || isPdf) {
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.onerror = reject;
              reader.readAsDataURL(fileToUse);
            });
            attachmentObj.dataUrl = dataUrl;
          } catch {
            setErrorMessage(`Failed to read "${file.name}".`);
            continue;
          }
        } else {
          try {
            const textContent = await fileToUse.text();
            attachmentObj.textContent = textContent;
          } catch {
            setErrorMessage(`Failed to read text from "${file.name}".`);
            continue;
          }
        }

        newAttachments.push(attachmentObj);
      }

      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    },
    [attachments]
  );

  const handlePhotoSelect = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleFileSelect = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Paste handler
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) filesToProcess.push(file);
      }
    }

    if (filesToProcess.length > 0) {
      e.preventDefault();
      processFiles(filesToProcess);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const clean = input.trim();
    if ((!clean && attachments.length === 0) || disabled || isStreaming) return;

    onSend({
      text: clean,
      content: clean,
      attachments: attachments.map((a) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        dataUrl: a.dataUrl,
        textContent: a.textContent,
        isImage: a.isImage,
        isPdf: a.isPdf,
      })),
      isImageMode,
      workspaceMode,
      aspectRatio: selectedAspectRatio,
      style: selectedStyle,
    });

    try {
      sessionStorage.removeItem('nova_draft_' + workspaceMode);
      localStorage.removeItem('nova_draft_' + workspaceMode);
    } catch {}
    setInput('');
    setAttachments([]);
    if (workspaceMode !== 'image') {
      setIsImageMode(false);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Voice dictation audio sender
  const handleSendRecordedAudio = async (audioData) => {
    setIsRecordingVoice(false);
    if (!audioData) return;

    if (typeof audioData === 'string') {
      if (audioData.trim()) {
        onSend({
          content: audioData.trim(),
          attachments: [],
          isImageMode: false,
        });
      }
      return;
    }

    if (audioData.size < 500) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const formData = new FormData();
      const ext = audioData.type?.includes('mp4') ? 'mp4' : 'webm';
      formData.append('audio', audioData, `input_voice_${Date.now()}.${ext}`);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (data.success && data.text) {
        onSend({
          content: data.text.trim(),
          attachments: [],
          isImageMode: false,
        });
      } else {
        setErrorMessage(data.error || 'Could not transcribe speech. Please try again.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      setErrorMessage(`Voice error: ${err.name === 'AbortError' ? 'Transcription timed out.' : err.message}`);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="search-cosmic-backdrop w-full max-w-4xl mx-auto px-4 pb-4 select-none relative"
    >
      {/* Image 1 Ambient Dual Glow (Cosmic Purple on Left, Violet/Cyan on Right) */}
      <div className="search-cosmic-glow-left" />
      <div className="search-cosmic-glow-right" />

      {/* Hidden File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={handlePhotoSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.java,.cpp,.c,.sql,.yaml,.yml"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Notice */}
      {errorMessage && (
        <div className="mb-2 p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fade-in relative z-10">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-400 hover:text-rose-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Voice Recorder Bar Mode */}
      {isRecordingVoice ? (
        <div className="relative z-10">
          <VoiceRecorderBar
            onTranscribed={(text) => {
              setIsRecordingVoice(false);
              if (text && text.trim()) {
                onSend({
                  content: text.trim(),
                  attachments: [],
                  isImageMode: false,
                });
              }
            }}
            onSendAudio={handleSendRecordedAudio}
            onCancel={() => setIsRecordingVoice(false)}
          />
        </div>
      ) : (
        /* Image 1 Search Bar Layout with Cosmic Theme & Image 4 Subtle Line Circle */
        <div
          className={`border-beam-card border-beam-card-glow relative z-10 transition-all ${
            isDragging ? 'ring-2 ring-purple-400' : ''
          }`}
        >
          <div className="border-beam-inner bg-[#100B22]/95 border border-purple-500/30 shadow-2xl p-3 sm:p-4 flex flex-col justify-between">
            {/* Attached Files Preview Chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-purple-500/20">
                {attachments.map((att) => {
                  const Icon = getFileIcon(att.type, att.name);
                  return (
                    <div
                      key={att.id}
                      className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#1C1434] border border-purple-500/30 text-xs text-zinc-200 shadow-sm animate-scale-in"
                    >
                      {att.isImage && att.dataUrl ? (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-5 h-5 rounded object-cover"
                        />
                      ) : (
                        <Icon className="w-4 h-4 text-purple-400" />
                      )}
                      <div className="flex flex-col min-w-0 max-w-[120px]">
                        <span className="truncate font-medium text-[11px]">{att.name}</span>
                        <span className="text-[9px] text-zinc-400">{formatBytes(att.size)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="p-0.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Image Mode Controls */}
            {isImageMode && (
              <div className="mb-2 p-2 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" /> Image Mode
                  </span>
                  {/* Aspect Ratio */}
                  <div className="flex items-center gap-1 bg-[#1A1230] p-0.5 rounded-lg border border-purple-500/20">
                    {['1:1', '16:9', '9:16', '4:3'].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setSelectedAspectRatio(ratio)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          selectedAspectRatio === ratio
                            ? 'bg-purple-600 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Style Presets */}
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="py-0.5 px-1.5 rounded-lg bg-[#1A1230] border border-purple-500/30 text-[10px] text-zinc-200 focus:outline-none"
                  >
                    {['Realistic', 'Illustration', '3D', 'Anime', 'Minimal'].map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsImageMode(false)}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Text Area (Placeholder: How can I help you? - Image 1) */}
            <div className="flex items-start gap-2 px-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={disabled}
                placeholder={getPlaceholder()}
                rows={1}
                className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 text-sm sm:text-base resize-none focus:outline-none min-h-[44px] py-1 leading-relaxed"
              />
            </div>

            {/* Bottom Toolbar: Attach files, Deep thinking on Left; Mic & Glowing Send Button on Right */}
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-purple-500/20">
              {/* Left Action Buttons (Image 1: Attach files, Deep thinking) */}
              <div className="flex items-center gap-2">
                {/* 1. Attach Files Pill */}
                <div className="relative" ref={attachMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAttachOpen(!isAttachOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18112C] hover:bg-[#231840] border border-purple-500/30 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
                    title="Attach files or photos"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
                    <span>Attach files</span>
                  </button>

                  {/* Attach Popup */}
                  {isAttachOpen && (
                    <div className="absolute bottom-10 left-0 z-40 w-44 py-1 rounded-2xl bg-[#1A1232] border border-purple-500/30 shadow-2xl text-xs space-y-0.5 animate-scale-in">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachOpen(false);
                          photoInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 hover:text-purple-300 transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                        <span>Upload photos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 hover:text-purple-300 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Upload document</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Deep Thinking Pill (Image 1) */}
                <div className="relative" ref={deepThinkingMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsDeepThinkingOpen(!isDeepThinkingOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18112C] hover:bg-[#231840] border border-purple-500/30 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
                    title="Reasoning and task modes"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                    <span>Deep thinking</span>
                    <ChevronDown className="w-3 h-3 text-zinc-400" />
                  </button>

                  {/* Deep Thinking Modes Popup */}
                  {isDeepThinkingOpen && (
                    <div className="absolute bottom-10 left-0 z-40 w-52 py-1 rounded-2xl bg-[#1A1232] border border-purple-500/30 shadow-2xl text-xs space-y-0.5 animate-scale-in">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeepThinkingOpen(false);
                          onSelectWorkspaceMode?.('project');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>New Project Workspace</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeepThinkingOpen(false);
                          setIsImageMode(true);
                          onSelectWorkspaceMode?.('image');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                        <span>Image Studio Mode</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeepThinkingOpen(false);
                          onSelectWorkspaceMode?.('presentation');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                        <span>AI Presentation Mode</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeepThinkingOpen(false);
                          onSelectWorkspaceMode?.('code');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 transition-colors"
                      >
                        <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Dev Code Assistant</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Action Buttons: Mic, Voice mode, and Image 3 Glowing Send Button */}
              <div className="flex items-center gap-2">
                {/* Voice Dictation (Mic) Button */}
                <button
                  type="button"
                  onClick={() => setIsRecordingVoice(true)}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Voice dictation (Live waveform)"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Voice Assistant Waveform Button */}
                {onOpenVoiceMode && (
                  <button
                    type="button"
                    onClick={() => {
                      audioPlayer.unlockAudio();
                      onOpenVoiceMode();
                    }}
                    className="p-2 rounded-full text-purple-400 hover:text-purple-200 hover:bg-purple-900/30 transition-colors"
                    title="Open Full Voice Assistant"
                  >
                    <AudioWaveform className="w-4 h-4" />
                  </button>
                )}

                {/* Glowing Send Button (Image 3) */}
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="flex items-center gap-1 px-3 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-transform active:scale-95"
                    title="Stop Generating"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={(!input.trim() && attachments.length === 0) || disabled}
                    className="glowing-send-btn w-9 h-9 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                    title="Send (Enter)"
                  >
                    <div className="glowing-send-btn-inner">
                      <Send className="w-4 h-4 text-purple-200 transform translate-x-[-0.5px] translate-y-[-0.5px]" />
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-zinc-500 tracking-wide">
        Hi Nova! is powered by Google Gemini. Always verify critical code and data.
      </p>
    </div>
  );
}

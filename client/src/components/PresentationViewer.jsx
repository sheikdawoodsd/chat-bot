import { useState, useEffect, useMemo } from 'react';
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Check,
  Plus,
  ExternalLink,
  Sparkles,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  CheckCircle2,
  X,
  FileText,
  Sliders,
  Layers,
} from 'lucide-react';

export const GAMMA_GENERATION_URL = 'https://gamma.app/generate';
export const GEMINI_CHAT_URL = 'https://gemini.google.com/app';

/**
 * Universal clipboard copy helper with fallback
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard writeText failed, trying fallback:', err);
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-999999px';
    ta.style.top = '-999999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const success = document.execCommand('copy');
    document.body.removeChild(ta);
    return success;
  } catch (err) {
    console.error('All copy fallbacks failed:', err);
    return false;
  }
}

/**
 * Parses slides formatted as ### Slide [N]: [Title]
 * Extracts slide number, title, body, and dedicated image-generation prompts.
 */
export function parsePresentationSlides(content = '') {
  if (!content) return [];
  // Stop matching when hitting 🎨 or Master Generation Prompts
  const slideRegex =
    /#{2,3}\s*Slide\s*(\d+)[:\s-]*([^\n]*)([\s\S]*?)(?=(?:#{2,3}\s*Slide\s*\d+|#{2,3}\s*🎨|#{2,3}\s*Master|$))/gi;
  const slides = [];
  let match;

  while ((match = slideRegex.exec(content)) !== null) {
    const num = match[1];
    const title = match[2]?.trim() || `Slide ${num}`;
    const rawBody = match[3]?.trim() || '';

    // Extract dedicated image prompt if present
    const imgPromptMatch = rawBody.match(
      /(?:-\s*\*\*Image\s*Generation\s*Prompt[^:]*\*\*|-\s*\*\*Visual\s*Prompt[^:]*\*\*|-\s*\*\*Image\s*Prompt[^:]*\*\*):\s*([^\n]+(?:\n[^\n*-]+)*)/i
    );
    const imagePrompt = imgPromptMatch ? imgPromptMatch[1].trim() : '';

    // Extract headline if present
    const headlineMatch = rawBody.match(
      /(?:-\s*\*\*Headline\*\*|-\s*\*\*Executive\s*Headline\*\*):\s*([^\n]+)/i
    );
    const headline = headlineMatch ? headlineMatch[1].trim() : '';

    slides.push({
      number: parseInt(num, 10),
      title,
      body: rawBody,
      headline,
      imagePrompt,
    });
  }

  return slides;
}

/**
 * Extracts a clean topic name from slides or content
 */
export function extractTopicTitle(slides = [], defaultTopic = 'Presentation') {
  if (!slides || slides.length === 0) return defaultTopic;
  const first = slides[0]?.title || '';
  const cleaned = first.replace(/^slide\s*\d+[:\s-]*/i, '').trim();
  return cleaned || defaultTopic;
}

/**
 * Generates the complete, detailed prompt for Gamma AI matching Reference Image 1
 */
export function generateGammaPrompt(slides = [], topicTitle = 'Presentation') {
  const cleanTopic = extractTopicTitle(slides, topicTitle);
  const slideContent = slides
    .map((s, idx) => `Slide ${s.number || idx + 1}: ${s.title}\n${s.body}`)
    .join('\n\n');

  return `${cleanTopic}

**Important Design Instructions:**
- Use large, impactful headings.
- Avoid long paragraphs and unnecessary text.
- Include meaningful visuals on every slide.
- Use accurate, scientifically supported information.
- Include relevant statistics with sources wherever possible.
- Add charts and infographics instead of presenting too much text.
- Make the slides visually engaging and suitable for presenting in front of professors and students.
- Ensure the final presentation looks like it was designed by a professional presentation designer.

**Complete Slide-by-Slide Structure & Content:**
${slideContent}`;
}

/**
 * Generates the complete, detailed prompt for Google Gemini AI with slide-by-slide visual prompts
 */
export function generateGeminiPrompt(slides = [], topicTitle = 'Presentation') {
  const cleanTopic = extractTopicTitle(slides, topicTitle);
  const slideSections = slides
    .map((s, idx) => {
      const imgDesc =
        s.imagePrompt ||
        `High-resolution photorealistic imagery depicting ${s.title} with cinematic lighting, scientific realism, and professional presentation aesthetics.`;
      return `### Slide ${s.number || idx + 1}: ${s.title}
- Content & Key Takeaways:
${s.body}
- Dedicated Image & Visual Generation Prompt (for Gemini AI):
${imgDesc}`;
    })
    .join('\n\n');

  return `Act as an expert presentation designer, slide architect, and visual director. I need a comprehensive, professional presentation deck and matching slide imagery about "${cleanTopic}".

**Presentation Topic:** ${cleanTopic}

**Core Requirements:**
1. Ground the deck in high-impact visual narrative, authentic statistics, and authoritative structure.
2. For EVERY slide below, generate or suggest photorealistic imagery, diagrams, or infographics according to the dedicated visual instructions.
3. Provide professional speaker advice and transition tips.

**Complete Slide-by-Slide Outline, Content & Visual Generation Directives:**
${slideSections}

**Instructions for Gemini:**
1. Review and refine each slide's content for maximum audience engagement, factual depth, and clarity.
2. For each slide, generate or recommend high-quality, photorealistic visual descriptions and image prompts matching the topic.
3. Suggest the optimal layout and delivery cadence for presenting these slides.`;
}

/**
 * PresentationViewer Component
 * Dual integrations: Create with Gamma & Create with Gemini
 * Visual image prompts per slide, clipboard sync, live notifications, and slide editing/export.
 */
export function PresentationViewer({ content }) {
  const initialSlides = parsePresentationSlides(content);
  const [slides, setSlides] = useState(initialSlides);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Inline Slide Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  // Dual Action State
  const [gammaCopied, setGammaCopied] = useState(false);
  const [geminiCopied, setGeminiCopied] = useState(false);
  const [slideImageCopied, setSlideImageCopied] = useState(false);

  // Inspector Drawer State
  const [isPromptDrawerOpen, setIsPromptDrawerOpen] = useState(false);
  const [activePromptTab, setActivePromptTab] = useState('gamma'); // 'gamma' | 'gemini'
  const [drawerCopied, setDrawerCopied] = useState(false);

  // Toast / Banner Notification State
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const parsed = parsePresentationSlides(content);
    if (parsed.length > 0) {
      setSlides(parsed);
      setCurrentIdx(0);
    }
  }, [content]);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  if (slides.length < 2) return null;

  const currentSlide = slides[currentIdx] || slides[0];
  const topicTitle = extractTopicTitle(slides, slides[0]?.title);

  // Master Prompts
  const gammaPrompt = generateGammaPrompt(slides, topicTitle);
  const geminiPrompt = generateGeminiPrompt(slides, topicTitle);

  // --- Handlers ---
  const handleCreateWithGamma = async () => {
    const success = await copyToClipboard(gammaPrompt);
    if (success) {
      setGammaCopied(true);
      setTimeout(() => setGammaCopied(false), 3000);
      setNotification({
        type: 'gamma',
        message: 'Your presentation prompt is copied. Paste it into the AI input box.',
        subtext: 'Opening Gamma AI generation chat...',
      });
    }
    window.open(GAMMA_GENERATION_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCreateWithGemini = async () => {
    const success = await copyToClipboard(geminiPrompt);
    if (success) {
      setGeminiCopied(true);
      setTimeout(() => setGeminiCopied(false), 3000);
      setNotification({
        type: 'gemini',
        message: 'Your presentation prompt is copied. Paste it into the AI input box.',
        subtext: 'Opening Google Gemini AI with visual image prompts...',
      });
    }
    window.open(GEMINI_CHAT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyGammaPromptOnly = async () => {
    const success = await copyToClipboard(gammaPrompt);
    if (success) {
      setGammaCopied(true);
      setTimeout(() => setGammaCopied(false), 2500);
      setNotification({
        type: 'gamma',
        message: 'Your presentation prompt is copied. Paste it into the AI input box.',
        subtext: 'Gamma presentation prompt ready to paste.',
      });
    }
  };

  const handleCopyGeminiPromptOnly = async () => {
    const success = await copyToClipboard(geminiPrompt);
    if (success) {
      setGeminiCopied(true);
      setTimeout(() => setGeminiCopied(false), 2500);
      setNotification({
        type: 'gemini',
        message: 'Your presentation prompt is copied. Paste it into the AI input box.',
        subtext: 'Gemini presentation & visual prompts ready to paste.',
      });
    }
  };

  const handleCopyDrawerPrompt = async () => {
    const textToCopy = activePromptTab === 'gamma' ? gammaPrompt : geminiPrompt;
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setDrawerCopied(true);
      setTimeout(() => setDrawerCopied(false), 2000);
      setNotification({
        type: activePromptTab,
        message: 'Your presentation prompt is copied. Paste it into the AI input box.',
        subtext: `${activePromptTab === 'gamma' ? 'Gamma' : 'Gemini'} prompt copied to clipboard.`,
      });
    }
  };

  const handleGenerateSlideImageInGemini = async (slide) => {
    const imgPrompt =
      slide.imagePrompt ||
      `High-resolution photorealistic imagery depicting ${slide.title} with cinematic lighting, scientific realism, and presentation quality.`;
    const fullGeminiImageQuery = `Generate a photorealistic 4K presentation visual for slide "${slide.title}": ${imgPrompt}`;
    const success = await copyToClipboard(fullGeminiImageQuery);
    if (success) {
      setSlideImageCopied(true);
      setTimeout(() => setSlideImageCopied(false), 2500);
      setNotification({
        type: 'gemini',
        message: `Slide ${slide.number} image prompt copied! Paste into Gemini.`,
        subtext: 'Opening Google Gemini AI...',
      });
    }
    window.open(GEMINI_CHAT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopySlideImageOnly = async (slide) => {
    const imgPrompt =
      slide.imagePrompt ||
      `High-resolution photorealistic imagery depicting ${slide.title} with cinematic lighting, scientific realism, and presentation quality.`;
    const success = await copyToClipboard(imgPrompt);
    if (success) {
      setSlideImageCopied(true);
      setTimeout(() => setSlideImageCopied(false), 2000);
      setNotification({
        type: 'image',
        message: `Slide ${slide.number} image prompt copied to clipboard!`,
        subtext: 'Ready for any AI image generator.',
      });
    }
  };

  // --- Slide Editing Handlers ---
  const handleStartEdit = () => {
    setEditTitle(currentSlide.title || '');
    setEditBody(currentSlide.body || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    setSlides((prev) =>
      prev.map((s, idx) =>
        idx === currentIdx
          ? { ...s, title: editTitle.trim() || `Slide ${s.number}`, body: editBody.trim() }
          : s
      )
    );
    setIsEditing(false);
  };

  const handleAddSlide = () => {
    const nextNum = slides.length + 1;
    const newSlide = {
      number: nextNum,
      title: `Slide ${nextNum}: Strategic Overview`,
      body: `- **Headline**: Key strategic milestone for this topic.\n- **Key Content & Points**:\n  * In-depth analysis of core parameters.\n  * Real-world statistics and benchmark data.\n  * Actionable takeaways.\n- **Visuals & Layout**: Metric cards and 2-column comparative layout.\n- **Image Generation Prompt (Gemini / AI)**: High-resolution photorealistic visual illustrating strategic advancement with modern cinematic lighting.\n- **Presenter Speaking Notes**: Present this section smoothly highlighting key milestones.`,
      imagePrompt:
        'High-resolution photorealistic visual illustrating strategic advancement with modern cinematic lighting.',
    };
    setSlides((prev) => [...prev, newSlide]);
    setCurrentIdx(slides.length);
    setEditTitle(newSlide.title);
    setEditBody(newSlide.body);
    setIsEditing(true);
  };

  const handleDownloadDeck = () => {
    const deckMarkdown = slides
      .map((s, idx) => `### Slide ${idx + 1}: ${s.title}\n\n${s.body}\n`)
      .join('\n---\n\n');

    const blob = new Blob([deckMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova-presentation-deck.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 rounded-2xl bg-[#160E2A] border border-purple-500/30 overflow-hidden shadow-2xl animate-fade-in relative">
      {/* ── Dynamic Floating Notification Toast (Requirement 6) ── */}
      {notification && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-gradient-to-r from-[#20113B] via-[#2A164E] to-[#1E1138] border border-purple-400/50 shadow-xl flex items-center justify-between gap-3 animate-fade-in z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {notification.message}
              </p>
              {notification.subtext && (
                <p className="text-[11px] text-purple-300/80 truncate">
                  {notification.subtext}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Dual AI Generation Hub: Gamma AI + Gemini AI (Requirements 1, 2, 3, 5) ── */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-[#1A0F35] via-[#1C1040] to-[#160E2A] border-b border-purple-500/25">
        {/* Hub Header */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center shadow-md">
              <Presentation className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  AI Presentation Studio
                </h3>
                <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 rounded-full">
                  Gamma + Gemini Ready
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Complete slide deck, scientific data, and visual generation prompts prepared for <span className="text-purple-200 font-semibold">"{topicTitle}"</span>.
              </p>
            </div>
          </div>

          {/* Toggle Full Prompts Drawer */}
          <button
            type="button"
            onClick={() => setIsPromptDrawerOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-500/30 transition-colors"
            title="Inspect full presentation prompts for Gamma and Gemini"
          >
            {isPromptDrawerOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isPromptDrawerOpen ? 'Hide Prompts' : 'Inspect Prompts'}</span>
          </button>
        </div>

        {/* Dual Cards Grid: Gamma AI & Gemini AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card 1: Create with Gamma (Reference Image 1: 'Glad you're here' / 'Walls of text welcome') */}
          <div className="rounded-xl p-3.5 bg-gradient-to-br from-[#1E1138] to-[#170E2C] border border-amber-500/30 hover:border-amber-400/50 shadow-lg transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Create with Gamma</h4>
                    <span className="text-[10px] text-amber-400/90 font-medium">Gamma AI PPT Engine</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyGammaPromptOnly}
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    gammaCopied
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                  title="Copy full Gamma prompt to clipboard"
                >
                  {gammaCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
                Opens Gamma directly at the AI chat creation interface (Reference Image 1). Auto-copies complete slide outline &amp; design instructions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateWithGamma}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-amber-900/30 transition-all active:scale-[0.98] group"
              title="Open Gamma and copy presentation prompt"
            >
              {gammaCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Prompt Copied &bull; Opening Gamma...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span>Open Gamma &amp; Generate PPT</span>
                </>
              )}
            </button>
          </div>

          {/* Card 2: Create with Gemini (Section 3: Dedicated image prompts & Gemini chat) */}
          <div className="rounded-xl p-3.5 bg-gradient-to-br from-[#121A3B] to-[#140F2D] border border-blue-500/30 hover:border-blue-400/50 shadow-lg transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Create with Gemini</h4>
                    <span className="text-[10px] text-blue-400/90 font-medium">Gemini AI + Visual Images</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyGeminiPromptOnly}
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    geminiCopied
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                  title="Copy full Gemini prompt with image instructions"
                >
                  {geminiCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
                Opens Google Gemini AI chat. Auto-copies complete deck structure with dedicated, photorealistic image prompts for every slide.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateWithGemini}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-blue-900/30 transition-all active:scale-[0.98] group"
              title="Open Gemini and copy prompt with visual generation instructions"
            >
              {geminiCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Prompt Copied &bull; Opening Gemini...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span>Open Gemini &amp; Generate Visuals</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Collapsible Full Prompt Inspector (Requirement 6: Manual Fallback) ── */}
        {isPromptDrawerOpen && (
          <div className="mt-3.5 pt-3 border-t border-purple-500/20 animate-fade-in">
            {/* Tabs & Copy Action */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-purple-500/20">
                <button
                  type="button"
                  onClick={() => setActivePromptTab('gamma')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    activePromptTab === 'gamma'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Gamma Prompt (Design Rules)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePromptTab('gemini')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    activePromptTab === 'gemini'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Gemini Prompt (With Slide Images)
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyDrawerPrompt}
                className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                  drawerCopied
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/30'
                }`}
              >
                {drawerCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{drawerCopied ? 'Copied to Clipboard!' : 'Copy This Prompt'}</span>
              </button>
            </div>

            {/* Prompt Content Preview Box */}
            <div className="rounded-xl bg-black/50 border border-purple-500/30 p-3 max-h-56 overflow-y-auto custom-scrollbar font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed select-text">
              {activePromptTab === 'gamma' ? gammaPrompt : geminiPrompt}
            </div>
          </div>
        )}
      </div>

      {/* ── Slide Deck Header Bar ── */}
      <div className="px-4 py-2.5 bg-[#1B1135] border-b border-purple-500/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Presentation className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white tracking-wide">
            Interactive Slide Deck
          </span>
          <span className="text-[10px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
            {slides.length} Slides
          </span>
          <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> Ready to Present
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <button
              type="button"
              onClick={handleSaveEdit}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
            >
              <Check className="w-3 h-3" />
              <span>Save Slide</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartEdit}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-purple-200 border border-purple-500/30 transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAddSlide}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-purple-500/20 transition-colors"
            title="Add a new slide"
          >
            <Plus className="w-3 h-3 text-purple-400" />
            <span className="hidden sm:inline">Add</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadDeck}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/30 transition-colors"
            title="Download complete presentation outline in markdown"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── Slide Canvas ── */}
      <div className="p-5 bg-gradient-to-br from-[#120B24] via-[#160E2E] to-[#120B24] min-h-[260px] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-widest">
              Slide {currentSlide.number || currentIdx + 1} of {slides.length}
            </span>
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Slide Title..."
                className="w-full px-3 py-1.5 rounded-xl bg-[#1D1336] border border-purple-500/40 text-sm font-bold text-white focus:outline-none"
              />
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={6}
                placeholder="Slide content, bullet points, and speaker notes..."
                className="w-full px-3 py-2 rounded-xl bg-[#1D1336] border border-purple-500/40 text-xs text-zinc-200 font-mono focus:outline-none custom-scrollbar"
              />
            </div>
          ) : (
            <div>
              <h4 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight flex items-center gap-2">
                <span>{currentSlide.title}</span>
              </h4>
              <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-2 whitespace-pre-wrap font-sans">
                {currentSlide.body}
              </div>

              {/* ── Slide Image Prompt Direct Generation Card (Requirement 4) ── */}
              {currentSlide.imagePrompt && (
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-[#171936] to-[#191336] border border-blue-500/30 shadow-md">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 text-blue-300 text-[11px] font-semibold">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                      <span>Dedicated Slide Image Prompt (Gemini AI)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopySlideImageOnly(currentSlide)}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-lg transition-colors ${
                          slideImageCopied
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                        }`}
                        title="Copy this slide's visual prompt"
                      >
                        {slideImageCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateSlideImageInGemini(currentSlide)}
                        className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/30 transition-colors"
                        title="Generate this slide image in Google Gemini"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Generate in Gemini</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-300 font-mono leading-relaxed bg-black/30 p-2 rounded-lg border border-blue-500/20 select-text">
                    {currentSlide.imagePrompt}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Carousel Navigation Footer ── */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-purple-500/15">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => {
              if (isEditing) handleSaveEdit();
              setCurrentIdx((prev) => Math.max(0, prev - 1));
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (isEditing) handleSaveEdit();
                  setCurrentIdx(i);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIdx ? 'bg-purple-400 w-5' : 'bg-purple-900/60 hover:bg-purple-700'
                }`}
                title={`Jump to slide ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={currentIdx === slides.length - 1}
            onClick={() => {
              if (isEditing) handleSaveEdit();
              setCurrentIdx((prev) => Math.min(slides.length - 1, prev + 1));
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs text-white font-medium transition-colors shadow-md shadow-purple-600/30"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

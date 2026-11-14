import React from 'react';
import { Code2, Presentation, Image as ImageIcon, FolderPlus, Sparkles } from 'lucide-react';

/**
 * WelcomeScreen - Dynamic Cosmic Layout with Nova Mascot Orb
 * Adapts contextually based on the active workspace mode (Dev Code, Presentation, Image Studio, Project, General)
 * with zero clutter and clean centered focus.
 */
export function WelcomeScreen({ workspaceMode = 'general' }) {
  const getWorkspaceDetails = () => {
    switch (workspaceMode) {
      case 'code':
        return {
          icon: Code2,
          badge: 'Dev Code Assistant',
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          title: 'Dev Code Assistant',
          subtitle: 'Generate clean production-ready code, paste error messages to debug, or run live scripts in the sandbox.',
        };
      case 'presentation':
        return {
          icon: Presentation,
          badge: 'AI Presentation Studio',
          badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          title: 'AI Presentation Studio',
          subtitle: 'Create structured slide decks, outlines, visual suggestions, and speaker notes with interactive carousel preview.',
        };
      case 'image':
        return {
          icon: ImageIcon,
          badge: 'Image Studio',
          badgeColor: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
          title: 'Image Studio',
          subtitle: 'Describe any visual scene or concept to generate photorealistic images with Gemini 2.5 Flash Image.',
        };
      case 'project':
        return {
          icon: FolderPlus,
          badge: 'Project Workspace',
          badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
          title: 'Project Workspace',
          subtitle: 'Design technical architectures, milestone roadmaps, database schemas, and engineering specifications.',
        };
      default:
        return {
          icon: Sparkles,
          badge: 'Cosmic Assistant',
          badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
          title: 'Ready to Create Something New?',
          subtitle: 'Ask questions, generate photorealistic images, brainstorm architecture, or dictate thoughts naturally.',
        };
    }
  };

  const details = getWorkspaceDetails();
  const Icon = details.icon;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-3xl mx-auto w-full my-auto animate-fade-in select-none">
      {/* Centered Glowing Mascot Orb */}
      <div className="relative mb-5 sm:mb-7 group cursor-pointer">
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/30 via-indigo-600/25 to-purple-500/30 rounded-full blur-2xl group-hover:blur-3xl group-hover:opacity-100 opacity-70 transition duration-700 animate-pulse" />

        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-purple-700 via-indigo-600 to-purple-400 p-1 shadow-2xl purple-glow border border-purple-400/40 transform group-hover:scale-105 transition-transform duration-300">
          <img
            src="/logo.png"
            alt="Nova Orb"
            className="w-full h-full rounded-full object-cover shadow-inner pointer-events-none"
          />
        </div>
      </div>

      {/* Active Workspace Pill */}
      {workspaceMode !== 'general' && (
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${details.badgeColor} shadow-sm animate-fade-in`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{details.badge}</span>
          </span>
        </div>
      )}

      {/* Heading */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2.5">
        {details.title}
      </h2>
      <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto font-normal leading-relaxed">
        {details.subtitle}
      </p>

      {/* Presentation Workspace Quick Topic Starters */}
      {workspaceMode === 'presentation' && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
          {[
            'Global Warming',
            'Artificial Intelligence in Healthcare',
            'Clean Energy Revolution & Solar Tech',
            'Next-Gen Space Exploration',
          ].map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('nova:send-prompt', {
                    detail: { prompt: topic },
                  })
                );
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 border border-purple-500/25 hover:border-amber-400/50 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 group shadow-sm"
              title={`Generate presentation for "${topic}"`}
            >
              <Sparkles className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>{topic}</span>
            </button>
          ))}
        </div>
      )}

      {/* Image Studio Workspace Quick Inspiration Starters */}
      {workspaceMode === 'image' && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
          {[
            'Cyberpunk Tokyo street at midnight in pouring rain',
            'Cosmic crystal planet with violet aurora rings',
            'Futuristic cybernetic tiger with neon blue circuits',
            'Bioluminescent underwater alien reef, 8k',
          ].map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('nova:send-prompt', {
                    detail: { prompt: promptText },
                  })
                );
              }}
              className="px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-200 border border-pink-500/25 hover:border-pink-400/50 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 group shadow-sm"
              title={`Generate image: "${promptText}"`}
            >
              <Sparkles className="w-3 h-3 text-pink-400 group-hover:scale-110 transition-transform" />
              <span>{promptText}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

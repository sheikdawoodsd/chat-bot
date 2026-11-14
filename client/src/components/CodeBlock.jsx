import { useState, useEffect } from 'react';
import { Check, Copy, Terminal, Play, RotateCcw, AlertCircle, Wrench, Sparkles } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-sql.js';

export function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState('');
  const [executionOutput, setExecutionOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const lang = (language || 'plaintext').toLowerCase().replace('language-', '');
  const canRun = ['javascript', 'js', 'html', 'json', 'typescript', 'ts'].includes(lang);

  useEffect(() => {
    try {
      const grammar = Prism.languages[lang] || Prism.languages.plaintext;
      const html = Prism.highlight(value || '', grammar, lang);
      setHighlightedCode(html);
    } catch {
      setHighlightedCode(value || '');
    }
  }, [value, lang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDebugWithNova = (errDetails = '') => {
    const prompt = errDetails
      ? `Please debug and automatically fix this ${lang} code error. Identify the root cause and provide the corrected, complete runnable solution:\n\n\`\`\`${lang}\n${value}\n\`\`\`\n\nRuntime Error:\n${errDetails}`
      : `Please review, debug, and optimize this ${lang} code. Pinpoint any edge-case bugs, performance issues or syntax flaws and provide the improved solution:\n\n\`\`\`${lang}\n${value}\n\`\`\``;
    window.dispatchEvent(new CustomEvent('nova:send-prompt', { detail: { prompt } }));
  };

  // Live in-browser safe sandbox code execution
  const handleRunCode = () => {
    setIsRunning(true);
    setExecutionOutput(null);

    setTimeout(() => {
      try {
        if (lang === 'json') {
          JSON.parse(value);
          setExecutionOutput({
            type: 'success',
            output: 'Valid JSON format! Object structure parsed successfully.',
          });
          setIsRunning(false);
          return;
        }

        if (lang === 'html') {
          setExecutionOutput({
            type: 'html',
            output: value,
          });
          setIsRunning(false);
          return;
        }

        // JavaScript / TypeScript execution
        const logs = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        console.log = (...args) => {
          logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
        };
        console.warn = (...args) => {
          logs.push(`[WARN] ${args.join(' ')}`);
        };
        console.error = (...args) => {
          logs.push(`[ERROR] ${args.join(' ')}`);
        };

        try {
          // Safe evaluation using Function constructor
          const result = new Function(value)();
          if (result !== undefined) {
            logs.push(`Return Value: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}`);
          }
        } finally {
          console.log = originalLog;
          console.warn = originalWarn;
          console.error = originalError;
        }

        setExecutionOutput({
          type: 'success',
          output: logs.length > 0 ? logs.join('\n') : 'Code executed successfully (no console output returned).',
        });
      } catch (err) {
        setExecutionOutput({
          type: 'error',
          output: `Runtime Error: ${err.message}`,
        });
      } finally {
        setIsRunning(false);
      }
    }, 150);
  };

  return (
    <div className="relative my-4 rounded-2xl overflow-hidden border border-purple-500/30 bg-[#0E091D] shadow-xl text-sm group">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#170F2D] border-b border-purple-500/20 select-none">
        <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">{lang}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDebugWithNova()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all active:scale-95 shadow-sm"
            title="Ask Nova Dev Assistant to review and optimize this code"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Debug</span>
          </button>

          {canRun && (
            <button
              type="button"
              onClick={handleRunCode}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95 shadow-sm"
              title="Run code in live sandbox"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isRunning ? 'Running...' : 'Run Code'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body */}
      <pre className="p-4 overflow-x-auto text-zinc-100 font-mono text-[13px] leading-relaxed custom-scrollbar bg-[#0B0716]/90">
        {highlightedCode ? (
          <code
            className={`language-${lang}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        ) : (
          <code>{value}</code>
        )}
      </pre>

      {/* Live Sandbox Execution Output Console */}
      {executionOutput && (
        <div className="border-t border-purple-500/20 p-3.5 bg-[#080512] animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-semibold tracking-wide flex items-center gap-1.5 text-purple-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Console Output
            </span>
            <button
              type="button"
              onClick={() => setExecutionOutput(null)}
              className="text-[10px] text-zinc-400 hover:text-white"
            >
              Clear
            </button>
          </div>

          {executionOutput.type === 'error' ? (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <pre className="whitespace-pre-wrap">{executionOutput.output}</pre>
              </div>
              <button
                type="button"
                onClick={() => handleDebugWithNova(executionOutput.output)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Auto-Fix with Nova Dev Assistant</span>
              </button>
            </div>
          ) : executionOutput.type === 'html' ? (
            <div className="p-3 rounded-xl bg-white text-black text-xs overflow-auto max-h-48 border border-zinc-300">
              <div dangerouslySetInnerHTML={{ __html: executionOutput.output }} />
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-xs overflow-x-auto max-h-44 custom-scrollbar whitespace-pre-wrap">
              {executionOutput.output}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

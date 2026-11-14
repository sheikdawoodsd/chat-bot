import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  Mic,
  ArrowUp,
  X,
  Briefcase,
  Film,
  Newspaper,
  BookOpen,
  Music2,
  FileSpreadsheet,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Sparkles,
} from 'lucide-react';

const RECOMMENDED_SCHEDULES = [
  {
    id: 'job',
    title: 'Find a job',
    description: 'Send me new job matches every Monday and Thursday.',
    icon: Briefcase,
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    scheduleType: 'bi-weekly',
  },
  {
    id: 'movies',
    title: 'What to watch',
    description: 'Pick three movies or shows for me every Friday night.',
    icon: Film,
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    scheduleType: 'weekly',
  },
  {
    id: 'news',
    title: 'News updates',
    description: 'Send me a daily roundup of news on topics I care about.',
    icon: Newspaper,
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    scheduleType: 'daily',
  },
  {
    id: 'books',
    title: 'Recommend a book',
    description: 'Pick three books for me each month, based on my tastes.',
    icon: BookOpen,
    color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    scheduleType: 'monthly',
  },
  {
    id: 'concerts',
    title: 'Find concerts',
    description: 'Check weekly for new concerts that match my taste.',
    icon: Music2,
    color: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
    scheduleType: 'weekly',
  },
  {
    id: 'budget',
    title: 'Create a budget',
    description: 'Send me a fresh, blank budget template each month.',
    icon: FileSpreadsheet,
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    scheduleType: 'monthly',
  },
];

export function ScheduledTasksModal({ isOpen, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [addedNotice, setAddedNotice] = useState('');

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/scheduled-tasks');
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('[Nova Scheduled] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen, fetchTasks]);

  const showNotice = (msg) => {
    setAddedNotice(msg);
    setTimeout(() => setAddedNotice(''), 3000);
  };

  const handleCreateTask = async (title, prompt, scheduleType = 'weekly') => {
    if (!prompt) return;
    try {
      const res = await fetch('/api/scheduled-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || prompt.slice(0, 30),
          prompt,
          scheduleType,
        }),
      });
      const data = await res.json();
      if (data.success && data.task) {
        setTasks((prev) => [data.task, ...prev]);
        showNotice(`Scheduled: "${data.task.title}"`);
        setTaskInput('');
      }
    } catch (err) {
      console.error('[Nova Scheduled] Create error:', err);
    }
  };

  const handleToggleTask = async (taskId, currentActive) => {
    try {
      const res = await fetch(`/api/scheduled-tasks/${taskId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, isActive: !currentActive ? 1 : 0 } : t))
        );
      }
    } catch (err) {
      console.error('[Nova Scheduled] Toggle error:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const res = await fetch(`/api/scheduled-tasks/${taskId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        showNotice('Scheduled task deleted.');
      }
    } catch (err) {
      console.error('[Nova Scheduled] Delete error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0D081E] border border-purple-500/30 rounded-3xl shadow-2xl shadow-purple-950/50 flex flex-col max-h-[85vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="p-6 border-b border-purple-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Scheduled</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Ask Nova to schedule tasks, set reminders, or monitor for updates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-6 pb-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (taskInput.trim()) {
                handleCreateTask(taskInput.trim().slice(0, 30), taskInput.trim());
              }
            }}
            className="relative flex items-center"
          >
            <div className="absolute left-4 text-zinc-400">
              <Plus className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Schedule a task"
              className="w-full bg-[#181132] border border-purple-500/30 rounded-2xl pl-11 pr-24 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 transition-colors shadow-inner"
            />
            <div className="absolute right-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={!taskInput.trim()}
                className="w-8 h-8 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center text-white transition-colors shadow-md"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6 custom-scrollbar">
          {/* Active Tasks Section */}
          {tasks.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-3">
                Your Scheduled Tasks ({tasks.length})
              </div>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-2xl bg-[#140D2E]/80 border border-purple-900/40 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100 truncate">
                          {task.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-medium capitalize">
                          {task.scheduleType || 'weekly'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{task.prompt}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id, !!task.isActive)}
                        className={`p-1 rounded-lg transition-colors ${
                          task.isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                        title={task.isActive ? 'Active (Click to pause)' : 'Paused (Click to activate)'}
                      >
                        {task.isActive ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Section (Direct from Image 3) */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>Recommended</span>
            </div>

            <div className="space-y-2.5">
              {RECOMMENDED_SCHEDULES.map((rec) => {
                const IconComponent = rec.icon;
                const isAlreadyAdded = tasks.some((t) => t.title === rec.title);

                return (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-2xl bg-[#140D2E]/60 hover:bg-[#1A1238] border border-purple-900/30 hover:border-purple-500/40 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${rec.color}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                          {rec.title}
                        </h4>
                        <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                          {rec.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateTask(rec.title, rec.description, rec.scheduleType)}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isAlreadyAdded
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-zinc-800/60 hover:bg-purple-600 border-zinc-700/60 hover:border-purple-500 text-zinc-400 hover:text-white'
                      }`}
                      title={isAlreadyAdded ? 'Added to schedule' : 'Add to schedule'}
                    >
                      {isAlreadyAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notice Toast */}
        {addedNotice && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-2xl bg-purple-600 text-white text-xs font-semibold shadow-xl shadow-purple-950/80">
            <Check className="w-4 h-4" />
            <span>{addedNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
}


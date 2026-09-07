// src/components/ProjectSessionModal.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Save,
  FolderArchive,
  Download,
  Upload,
  Trash2,
  Check,
  Clock,
  Sparkles,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { SavedProjectSession } from '../types';
import { getAllProjectSessions, deleteProjectSession } from '../utils/storagePermission';
import { haptics } from '../utils/haptics';

interface ProjectSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSession: (name: string) => Promise<void>;
  onLoadSession: (session: SavedProjectSession) => Promise<void>;
  onExportFile: () => void;
  onImportFile: (file: File) => void;
  theme?: 'light' | 'dark';
  activeProjectName: string;
}

export const ProjectSessionModal: React.FC<ProjectSessionModalProps> = ({
  isOpen,
  onClose,
  onSaveSession,
  onLoadSession,
  onExportFile,
  onImportFile,
  theme = 'dark',
  activeProjectName,
}) => {
  const isLight = theme === 'light';
  const [sessions, setSessions] = useState<SavedProjectSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [sessionName, setSessionName] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllProjectSessions();
      setSessions(list);
    } catch (err) {
      console.warn('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refreshSessions();
      setSessionName(activeProjectName || 'Artwork Session');
      setFeedback(null);
    }
  }, [isOpen, refreshSessions, activeProjectName]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const name = sessionName.trim() || 'Untitled Session';
    setSaving(true);
    try {
      await onSaveSession(name);
      haptics.trigger('success');
      setFeedback('Session saved with full undo history!');
      await refreshSessions();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error(err);
      setFeedback('Failed to save session.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (session: SavedProjectSession) => {
    try {
      await onLoadSession(session);
      haptics.trigger('success');
      onClose();
    } catch (err) {
      console.error(err);
      setFeedback('Failed to load session.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved session?')) return;
    try {
      await deleteProjectSession(id);
      haptics.trigger('light');
      await refreshSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportFile(file);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project Sessions"
      className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        data-theme={theme}
        className={`pr-surface w-full max-w-md max-h-[calc(100dvh-24px)] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isLight
            ? 'bg-white text-neutral-900 border-neutral-200'
            : 'bg-[#18191d] text-white border-white/10'
        }`}
      >
        {/* Header */}
        <div
            className={`flex items-center justify-between px-4 py-3 border-b ${
            isLight ? 'border-neutral-200 bg-neutral-50/50' : 'border-neutral-800 bg-[#121316]'
          }`}
        >
            <div className="flex items-center gap-2.5">
            <div
                className={`p-1.5 rounded-lg ${
                isLight ? 'bg-neutral-200 text-neutral-800' : 'bg-white/10 text-white'
              }`}
            >
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Project Sessions</h2>
              <p className="text-xs text-neutral-400">Save and load with complete undo history</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-white/10 text-neutral-300'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedback.includes('Failed')
                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            }`}
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Quick Save Current Session */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Save Current Workspace
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Session Name (e.g. Concept 1)"
                className={`flex-1 px-3.5 py-2.5 rounded-xl text-sm font-medium border outline-none transition-all ${
                  isLight
                    ? 'bg-white border-neutral-300 focus:border-neutral-900 text-neutral-900'
                    : 'bg-white/5 border-white/10 focus:border-white/40 text-white'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSave();
                }}
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-98 cursor-pointer ${
                  isLight
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                    : 'bg-white text-zinc-950 hover:bg-neutral-200'
                } disabled:opacity-50`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Saving…' : 'Save Session'}</span>
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">
              Saves all raw 3D curves, layers, and full undo/redo history into your device storage.
            </p>
          </div>

          {/* 2. Saved Sessions List */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Saved Sessions ({sessions.length})
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading saved sessions…</span>
              </div>
            ) : sessions.length === 0 ? (
              <div
                className={`py-8 text-center rounded-2xl border border-dashed text-xs text-neutral-400 ${
                  isLight ? 'border-neutral-200 bg-neutral-50/50' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                No saved sessions yet. Type a name above and click "Save Session".
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const dateStr = new Date(s.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        isLight
                          ? 'bg-white hover:bg-neutral-50 border-neutral-200'
                          : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {s.thumbnail ? (
                          <img
                            src={s.thumbnail}
                            alt=""
                            className="w-11 h-11 rounded-xl object-cover border border-black/10 shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                              isLight ? 'bg-neutral-100 text-neutral-500' : 'bg-white/5 text-neutral-400'
                            }`}
                          >
                            <Sparkles className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate leading-tight">{s.name}</div>
                          <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {dateStr}
                            </span>
                            <span>•</span>
                            <span>{s.strokeCount || 0} strokes</span>
                            <span>•</span>
                            <span>{s.activeModelName || 'Canvas'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => void handleLoad(s)}
                          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            isLight
                              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                              : 'bg-white text-zinc-950 hover:bg-neutral-200'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Load</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleDelete(s.id, e)}
                          title="Delete saved session"
                          className={`min-h-[38px] w-9 grid place-items-center rounded-xl text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer ${
                            isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/10'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Physical File (.remix3d) Transfer */}
          <div className="pt-2 border-t border-dashed border-neutral-200 dark:border-white/10 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Physical Project File (.remix3d)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onExportFile();
                  haptics.trigger('success');
                }}
                className={`min-h-[44px] p-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all active:scale-98 cursor-pointer ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Export .remix3d File</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`min-h-[44px] p-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all active:scale-98 cursor-pointer ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Open .remix3d File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".remix3d,.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-[11px] text-neutral-400">
              Download a backup file to your computer or phone to transfer your project to another device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

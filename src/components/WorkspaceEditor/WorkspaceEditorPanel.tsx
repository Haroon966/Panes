'use client';

import Editor, { type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import {
  ChevronLeft,
  ChevronRight,
  File,
  FileCode2,
  Folder,
  FolderOpen,
  Pin,
  PinOff,
  Save,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  fetchWorkspaceFile,
  listWorkspaceDir,
  saveWorkspaceFile,
  type WorkspaceEditorContext,
  type WorkspaceListEntry,
} from '@/lib/workspaceEditorApi';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useWorkbenchStore } from '@/store/workbenchStore';
import { cn } from '@/lib/utils';
import { WorkspaceEditorFileSidebar } from './WorkspaceEditorFileSidebar';
import { WorkspaceMcpConfigBadge } from './WorkspaceMcpConfigBadge';

const WORKSPACE_AUTO_SAVE_INTERVAL_MS = 30_000;

let monacoThemeRegistered = false;

/** Dark + light Monaco chrome (token colors inherit vs-dark / vs). */
function registerTerminalaiMonacoThemes(m: typeof monaco) {
  if (monacoThemeRegistered) return;
  monacoThemeRegistered = true;
  m.editor.defineTheme('terminalai-vscode', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editorCursor.foreground': '#aeafad',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editorWhitespace.foreground': '#3b3a39',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      'editorGutter.background': '#1e1e1e',
      'editorBracketHighlight.foreground1': '#ffd700',
      'editorBracketHighlight.foreground2': '#da70d6',
      'editorBracketHighlight.foreground3': '#179fff',
      'minimap.background': '#1e1e1e',
      'scrollbarSlider.background': '#79797966',
      'scrollbarSlider.hoverBackground': '#646464b3',
      'scrollbarSlider.activeBackground': '#bfbfbf66',
    },
  });
  m.editor.defineTheme('terminalai-vscode-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#f8fafc',
      'editor.foreground': '#0f172a',
      'editorLineNumber.foreground': '#64748b',
      'editorLineNumber.activeForeground': '#334155',
      'editorCursor.foreground': '#6d28d9',
      'editor.selectionBackground': '#c4b5fd55',
      'editor.inactiveSelectionBackground': '#e2e8f0',
      'editorWhitespace.foreground': '#cbd5e1',
      'editorIndentGuide.background': '#e2e8f0',
      'editorIndentGuide.activeBackground': '#cbd5e1',
      'editorGutter.background': '#f8fafc',
      'minimap.background': '#f8fafc',
      'scrollbarSlider.background': '#94a3b866',
      'scrollbarSlider.hoverBackground': '#64748bb3',
      'scrollbarSlider.activeBackground': '#47556966',
    },
  });
}

function languageFromPath(p: string): string {
  const base = p.split('/').pop() ?? p;
  const ext = base.includes('.') ? base.split('.').pop()?.toLowerCase() ?? '' : '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    vue: 'html',
    svelte: 'html',
  };
  return map[ext] ?? 'plaintext';
}

function joinPath(dir: string, name: string): string {
  if (!dir || dir === '.') return name;
  return `${dir.replace(/\/$/, '')}/${name}`;
}

function pathsEqual(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').trim() === b.replace(/\\/g, '/').trim();
}

type EditorBuffer = {
  path: string;
  content: string;
  dirty: boolean;
};

function tabTitle(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path || 'untitled';
}

function BreadcrumbPath({
  path,
  onPrefixSelect,
}: {
  path: string;
  /** Parent segments set the quick-open field (Enter / Open) — not LSP symbol crumbs. */
  onPrefixSelect?: (prefix: string) => void;
}) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap" aria-label="File path">
      {parts.map((p, i) => {
        const prefix = parts.slice(0, i + 1).join('/');
        const isLast = i === parts.length - 1;
        const label = (
          <span
            className={cn(
              'font-mono text-[12px]',
              isLast ? 'text-terminalai-text' : 'text-terminalai-muted'
            )}
          >
            {p}
          </span>
        );
        return (
          <span key={`${i}-${p}`} className="flex shrink-0 items-center gap-0.5">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-terminalai-muted" aria-hidden />}
            {!isLast && onPrefixSelect ? (
              <button
                type="button"
                className="rounded-sm font-mono text-[12px] text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terminalai-processing"
                title={`Set quick-open to “${prefix}” (press Enter or Open)`}
                onClick={() => onPrefixSelect(prefix)}
              >
                {p}
              </button>
            ) : (
              label
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function WorkspaceEditorPanel({ onClose }: { onClose?: () => void }) {
  const workspaceRoot = useSettingsStore((s) => s.workspaceRoot);
  const effectiveTerminalTheme = useSettingsStore((s) => s.effectiveTerminalTheme);
  const codeFontSizePx = useSettingsStore((s) => s.codeFontSizePx);
  const agentPinnedPaths = useSettingsStore((s) => s.agentPinnedPaths);
  const toggleAgentPinnedPath = useSettingsStore((s) => s.toggleAgentPinnedPath);
  const workspaceFormatOnSave = useSettingsStore((s) => s.workspaceFormatOnSave);
  const terminalSessionId = useTerminalStore((s) => s.getShellConnectedSessionId());

  const ctx = useMemo<WorkspaceEditorContext>(
    () => ({
      workspaceRoot: workspaceRoot ?? '',
      terminalSessionId,
    }),
    [workspaceRoot, terminalSessionId]
  );
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const [pathInput, setPathInput] = useState('');
  const [tabs, setTabs] = useState<EditorBuffer[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const [tabSize, setTabSize] = useState(2);

  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseDir, setBrowseDir] = useState('.');
  const [browseEntries, setBrowseEntries] = useState<WorkspaceListEntry[]>([]);
  const [browseTruncated, setBrowseTruncated] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [fileSidebarCollapsed, setFileSidebarCollapsed] = useState(false);
  const [fileTreeEpoch, setFileTreeEpoch] = useState(0);
  const bumpFileTree = useCallback(() => setFileTreeEpoch((e) => e + 1), []);

  const fileExplorerToggleNonce = useWorkbenchStore((s) => s.fileExplorerToggleNonce);
  const prevExplorerBump = useRef(0);
  useEffect(() => {
    if (fileExplorerToggleNonce > prevExplorerBump.current) {
      setFileSidebarCollapsed((c) => !c);
      prevExplorerBump.current = fileExplorerToggleNonce;
    }
  }, [fileExplorerToggleNonce]);

  const saveFnRef = useRef<() => void>(() => {});
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const autoSaveBusyRef = useRef(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  const activeBuffer = useMemo(
    () => tabs.find((t) => t.path === activePath) ?? null,
    [tabs, activePath]
  );

  const setActiveWorkspaceEditorPath = useWorkbenchStore((s) => s.setActiveWorkspaceEditorPath);
  const setDirtyWorkspaceEditorPaths = useWorkbenchStore((s) => s.setDirtyWorkspaceEditorPaths);
  useEffect(() => {
    setActiveWorkspaceEditorPath(activeBuffer?.path ?? null);
    return () => setActiveWorkspaceEditorPath(null);
  }, [activeBuffer?.path, setActiveWorkspaceEditorPath]);

  useEffect(() => {
    const paths = tabs
      .filter((t) => t.dirty)
      .map((t) => t.path.trim().replace(/\\/g, '/'))
      .filter(Boolean);
    setDirtyWorkspaceEditorPaths(paths);
    return () => setDirtyWorkspaceEditorPaths([]);
  }, [tabs, setDirtyWorkspaceEditorPaths]);

  const loadFile = useCallback(
    async (rel: string) => {
      const trimmed = rel.trim();
      if (!trimmed) {
        setError('Enter a workspace-relative path.');
        return;
      }
      const existing = tabsRef.current.find((t) => pathsEqual(t.path, trimmed));
      if (existing) {
        setActivePath(existing.path);
        setPathInput(existing.path);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const r = await fetchWorkspaceFile(trimmed, ctx);
        setTabs((prev) => [...prev, { path: r.path, content: r.content, dirty: false }]);
        setActivePath(r.path);
        setPathInput(r.path);
        bumpFileTree();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [bumpFileTree, ctx]
  );

  const openEditorFileNonce = useWorkbenchStore((s) => s.openEditorFileNonce);
  const openEditorFilePath = useWorkbenchStore((s) => s.openEditorFilePath);
  const openEditorFileLine = useWorkbenchStore((s) => s.openEditorFileLine);
  const clearOpenEditorFileLine = useWorkbenchStore((s) => s.clearOpenEditorFileLine);
  const lastHandledOpenNonce = useRef(-1);
  useEffect(() => {
    const p = openEditorFilePath.trim();
    if (!p) return;
    if (openEditorFileNonce <= lastHandledOpenNonce.current) return;
    lastHandledOpenNonce.current = openEditorFileNonce;
    void loadFile(p);
  }, [openEditorFileNonce, openEditorFilePath, loadFile]);

  useEffect(() => {
    const line = openEditorFileLine;
    if (line == null || line < 1) return;
    const path = openEditorFilePath.trim();
    if (!path || !activePath || !pathsEqual(activePath, path)) return;
    let cancelled = false;
    let attempts = 0;
    const tryReveal = () => {
      if (cancelled) return;
      const ed = monacoEditorRef.current;
      if (ed) {
        ed.revealLineInCenter(line);
        ed.setPosition({ lineNumber: line, column: 1 });
        ed.focus();
        clearOpenEditorFileLine();
        return;
      }
      attempts += 1;
      if (attempts < 90) requestAnimationFrame(tryReveal);
    };
    requestAnimationFrame(tryReveal);
    return () => {
      cancelled = true;
    };
  }, [
    openEditorFileNonce,
    activePath,
    openEditorFilePath,
    openEditorFileLine,
    clearOpenEditorFileLine,
  ]);

  const save = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.path === activePath);
    if (!tab) {
      setError('Nothing to save — open a file first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let contentToSave = tab.content;
      if (workspaceFormatOnSave) {
        const ed = monacoEditorRef.current;
        if (ed && activePath === tab.path) {
          try {
            const action = ed.getAction('editor.action.formatDocument');
            if (action?.isSupported()) {
              await action.run();
              const model = ed.getModel();
              if (model) contentToSave = model.getValue();
            }
          } catch {
            /* keep previous buffer */
          }
        }
      }
      await saveWorkspaceFile(tab.path, contentToSave, ctx);
      setTabs((prev) =>
        prev.map((t) =>
          t.path === tab.path ? { ...t, content: contentToSave, dirty: false } : t
        )
      );
      setPathInput(tab.path);
      bumpFileTree();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [activePath, bumpFileTree, ctx, workspaceFormatOnSave]);

  const saveAllDirtyTabs = useCallback(async () => {
    if (autoSaveBusyRef.current) return;
    const dirtySnapshot = tabsRef.current.filter((t) => t.dirty);
    if (dirtySnapshot.length === 0) return;
    autoSaveBusyRef.current = true;
    try {
      const c = ctxRef.current;
      const results = await Promise.allSettled(
        dirtySnapshot.map((t) => saveWorkspaceFile(t.path, t.content, c))
      );
      const savedPaths = new Set<string>();
      const failedPaths: string[] = [];
      results.forEach((r, i) => {
        const p = dirtySnapshot[i]!.path;
        if (r.status === 'fulfilled') savedPaths.add(p);
        else failedPaths.push(p);
      });
      if (savedPaths.size > 0) {
        setTabs((prev) =>
          prev.map((t) => (savedPaths.has(t.path) ? { ...t, dirty: false } : t))
        );
        bumpFileTree();
      }
      if (failedPaths.length > 0) {
        const names = failedPaths.map((p) => tabTitle(p)).join(', ');
        setError(`Auto-save failed: ${names}`);
      }
    } finally {
      autoSaveBusyRef.current = false;
    }
  }, [bumpFileTree]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void saveAllDirtyTabs();
    }, WORKSPACE_AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [saveAllDirtyTabs]);

  const closeTab = useCallback(
    (pathToClose: string) => {
      const tab = tabs.find((t) => t.path === pathToClose);
      if (tab?.dirty && !window.confirm(`Discard unsaved changes in “${tabTitle(pathToClose)}”?`)) {
        return;
      }
      const idx = tabs.findIndex((t) => t.path === pathToClose);
      const next = tabs.filter((t) => t.path !== pathToClose);
      setTabs(next);
      if (activePath === pathToClose) {
        if (next.length === 0) {
          setActivePath(null);
          setPathInput('');
        } else {
          const ni = Math.min(idx, next.length - 1);
          const np = next[ni]!.path;
          setActivePath(np);
          setPathInput(np);
        }
      }
    },
    [activePath, tabs]
  );

  const closeTabRef = useRef(closeTab);
  closeTabRef.current = closeTab;

  const cycleTab = useCallback((dir: 1 | -1) => {
    const list = tabsRef.current;
    if (list.length < 2) return;
    const cur = activePathRef.current;
    const i = list.findIndex((t) => t.path === cur);
    if (i < 0) return;
    const ni = (i + dir + list.length) % list.length;
    const np = list[ni]!.path;
    setActivePath(np);
    setPathInput(np);
  }, []);

  const cycleTabRef = useRef(cycleTab);
  cycleTabRef.current = cycleTab;

  saveFnRef.current = () => {
    void save();
  };

  const refreshBrowse = useCallback(async () => {
    setBrowseLoading(true);
    setError(null);
    try {
      const r = await listWorkspaceDir(browseDir, ctx);
      setBrowseEntries(r.entries);
      setBrowseTruncated(r.truncated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBrowseEntries([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [browseDir, ctx]);

  useEffect(() => {
    if (!browseOpen) return;
    void refreshBrowse();
  }, [browseOpen, browseDir, refreshBrowse]);

  const openBrowseEntry = (e: WorkspaceListEntry) => {
    if (e.kind === 'dir') {
      setBrowseDir(joinPath(browseDir, e.name));
      return;
    }
    const full = joinPath(browseDir, e.name);
    setBrowseOpen(false);
    void loadFile(full);
  };

  const monacoThemeId =
    effectiveTerminalTheme === 'light' ? 'terminalai-vscode-light' : 'terminalai-vscode';

  const handleMount: OnMount = (editor, m) => {
    monacoEditorRef.current = editor;
    registerTerminalaiMonacoThemes(m);
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => saveFnRef.current());
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyW, () => {
      const p = activePathRef.current;
      if (p) closeTabRef.current(p);
    });
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.PageDown, () => cycleTabRef.current(1));
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.PageUp, () => cycleTabRef.current(-1));
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyK, () => {
      const path = activePathRef.current;
      if (!path) return;
      const model = editor.getModel();
      if (!model) return;
      const range = editor.getSelection();
      const raw =
        range && !range.isEmpty() ? model.getValueInRange(range) : '';
      const selection = raw.trim() ? raw : null;
      const fenceLang = model.getLanguageId();
      useChatStore.getState().openAgentWithWorkspaceEditorSelection({
        relativePath: path,
        selection,
        fenceLang,
      });
      useSettingsStore.getState().setAgentPanelOpen(true);
      useChatStore.getState().requestFocusChat();
    });
  };

  const editorOptions = useMemo(
    (): monaco.editor.IStandaloneEditorConstructionOptions => ({
      automaticLayout: true,
      minimap: {
        enabled: true,
        side: 'right',
        showSlider: 'mouseover',
        renderCharacters: false,
        maxColumn: 120,
      },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      folding: true,
      foldingHighlight: true,
      stickyScroll: {
        enabled: true,
        defaultModel: 'indentationModel',
        maxLineCount: 5,
      },
      lineNumbers: 'on',
      lineHeight: Math.max(18, Math.round(codeFontSizePx * 1.45)),
      renderLineHighlight: 'line',
      roundedSelection: false,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      wordWrap: wordWrap,
      tabSize,
      insertSpaces: true,
      detectIndentation: true,
      multiCursorModifier: 'alt',
      quickSuggestions: { other: true, comments: false, strings: true },
      parameterHints: { enabled: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      unicodeHighlight: {
        ambiguousCharacters: true,
        invisibleCharacters: true,
        nonBasicASCII: false,
      },
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 14,
        verticalSliderSize: 14,
        horizontalSliderSize: 14,
      },
      fontSize: codeFontSizePx,
      fontFamily: "'Cascadia Code', 'Segoe UI Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      padding: { top: 4, bottom: 4 },
      readOnly: !activeBuffer,
    }),
    [activeBuffer, codeFontSizePx, tabSize, wordWrap]
  );

  const lang = activeBuffer
    ? languageFromPath(activeBuffer.path)
    : languageFromPath(pathInput);

  const workbenchBtn =
    'h-7 w-7 shrink-0 rounded p-0 text-terminalai-text hover:bg-[var(--terminalai-editor-input-bg)] hover:text-terminalai-text focus-visible:ring-1 focus-visible:ring-terminalai-processing';

  const activeFilePinned =
    !!activeBuffer &&
    agentPinnedPaths.some((p) => pathsEqual(p, activeBuffer.path));

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col border-t border-[var(--terminalai-editor-border)] bg-[var(--terminalai-editor-chrome)] text-terminalai-text">
      {/* Title / quick open (VS Code–style) */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--terminalai-editor-border)] bg-[var(--terminalai-editor-tab-bar)] px-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={workbenchBtn}
              disabled={saving || !activeBuffer}
              onClick={() => void save()}
              aria-label="Save"
            >
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Save (Ctrl+S)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={workbenchBtn}
              disabled={!activeBuffer}
              onClick={() => activeBuffer && toggleAgentPinnedPath(activeBuffer.path)}
              aria-label={activeFilePinned ? 'Unpin file from agent context' : 'Pin file for agent context'}
              aria-pressed={activeFilePinned}
            >
              {activeFilePinned ? (
                <PinOff className="h-4 w-4 text-terminalai-processing" aria-hidden />
              ) : (
                <Pin className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {activeFilePinned
              ? 'Unpin from agent prompt'
              : 'Pin for agent (always include in system prompt)'}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={workbenchBtn}
              disabled={loading}
              onClick={() => {
                setBrowseDir('.');
                setBrowseOpen(true);
              }}
              aria-label="Open file picker"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Browse workspace</TooltipContent>
        </Tooltip>
        <div className="flex min-w-0 flex-1 items-center px-1">
          <Label htmlFor="workspace-editor-path" className="sr-only">
            Quick open path
          </Label>
          <input
            id="workspace-editor-path"
            className="h-7 w-full min-w-0 rounded-sm border-0 bg-[var(--terminalai-editor-input-bg)] px-2.5 font-mono text-[13px] text-terminalai-text outline-none ring-1 ring-transparent placeholder:text-terminalai-muted focus:ring-terminalai-processing"
            placeholder="Open file by path… (Enter)"
            value={pathInput}
            onChange={(ev) => setPathInput(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') void loadFile(pathInput);
            }}
            disabled={loading}
            spellCheck={false}
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={workbenchBtn}
              disabled={loading}
              onClick={() => void loadFile(pathInput)}
              aria-label="Open path"
            >
              <FileCode2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Open (Enter)</TooltipContent>
        </Tooltip>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 shrink-0 px-2 text-[12px] text-terminalai-text hover:bg-[var(--terminalai-editor-input-bg)] hover:text-terminalai-text',
            wordWrap === 'on' && 'bg-terminalai-overlay text-terminalai-text'
          )}
          onClick={() => setWordWrap((w) => (w === 'on' ? 'off' : 'on'))}
          aria-pressed={wordWrap === 'on'}
        >
          Wrap
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          <Label htmlFor="editor-tab-size" className="sr-only">
            Indent width
          </Label>
          <select
            id="editor-tab-size"
            className="h-7 cursor-pointer rounded-sm border-0 bg-[var(--terminalai-editor-input-bg)] px-2 text-[12px] text-terminalai-text outline-none focus:ring-1 focus:ring-terminalai-processing"
            value={tabSize}
            onChange={(ev) => setTabSize(Number(ev.target.value))}
          >
            <option value={2}>Spaces: 2</option>
            <option value={4}>Spaces: 4</option>
          </select>
        </div>
        <WorkspaceMcpConfigBadge ctx={ctx} />
        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={workbenchBtn}
                onClick={() => {
                  if (tabs.some((t) => t.dirty) && !window.confirm('Close editor with unsaved changes?')) {
                    return;
                  }
                  onClose();
                }}
                aria-label="Hide workspace editor"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hide editor</TooltipContent>
          </Tooltip>
        )}
      </div>
      {error && (
        <div className="shrink-0 border-b border-[var(--terminalai-editor-border)] bg-terminalai-danger/15 px-2 py-1.5 text-[12px] text-terminalai-danger">
          {error}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-row">
        <WorkspaceEditorFileSidebar
          key={`${ctx.workspaceRoot}|${ctx.terminalSessionId ?? ''}`}
          ctx={ctx}
          workspaceRootHint={workspaceRoot ?? ''}
          terminalLinked={Boolean(terminalSessionId)}
          collapsed={fileSidebarCollapsed}
          onToggleCollapse={() => setFileSidebarCollapsed((c) => !c)}
          onOpenFile={(rel) => void loadFile(rel)}
          selectedPath={activePath}
          fileTreeEpoch={fileTreeEpoch}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--terminalai-editor-chrome)]">
          {tabs.length > 0 && (
            <div
              className="flex h-9 shrink-0 overflow-x-auto border-b border-[var(--terminalai-editor-tab-bar)] bg-[var(--terminalai-editor-tab-bar)]"
              role="tablist"
              aria-label="Open editors"
            >
              {tabs.map((t) => {
                const isActive = t.path === activePath;
                return (
                  <div
                    key={t.path}
                    role="tab"
                    aria-selected={isActive}
                    title={t.path}
                    className={cn(
                      'group relative flex h-9 max-w-[220px] shrink-0 items-stretch border-r border-[var(--terminalai-editor-tab-bar)] font-sans text-[13px] transition-colors',
                      isActive
                        ? 'z-[1] bg-[var(--terminalai-editor-tab-active)] text-terminalai-text shadow-[inset_0_-1px_0_0_var(--terminalai-editor-tab-active)]'
                        : 'bg-[var(--terminalai-editor-tab-inactive)] text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text'
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 right-0 top-0 z-[2] h-0.5 bg-terminalai-processing"
                        aria-hidden
                      />
                    )}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-0 text-left"
                      onClick={() => {
                        setActivePath(t.path);
                        setPathInput(t.path);
                      }}
                    >
                      <File className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{tabTitle(t.path)}</span>
                      {t.dirty && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-terminalai-warning"
                          title="Unsaved"
                          aria-label="Unsaved"
                        />
                      )}
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'flex w-7 shrink-0 items-center justify-center rounded-sm text-terminalai-text hover:bg-terminalai-hover',
                            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          )}
                          aria-label={`Close ${tabTitle(t.path)}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            closeTab(t.path);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Close (Ctrl+W)</TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
          {activeBuffer && (
            <div className="flex h-7 shrink-0 items-center border-b border-[var(--terminalai-editor-border)] bg-[var(--terminalai-editor-chrome)] px-2">
              <BreadcrumbPath path={activeBuffer.path} onPrefixSelect={(prefix) => setPathInput(prefix)} />
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            {loading && tabs.length === 0 && (
              <div className="flex h-full items-center justify-center text-[13px] text-terminalai-muted">
                Loading…
              </div>
            )}
            {!loading && !activeBuffer && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <FileCode2 className="h-12 w-12 text-terminalai-borderBright" aria-hidden />
                <div className="max-w-sm space-y-1">
                  <p className="text-[15px] font-medium text-terminalai-text">No file open</p>
                  <p className="text-[13px] leading-relaxed text-terminalai-muted">
                    Open from Explorer, use Browse, or type a path above and press Enter. Tabs: Ctrl+W
                    close, Ctrl+PageUp / Ctrl+PageDown switch.
                  </p>
                </div>
              </div>
            )}
            {activeBuffer && (
              <div className="h-full min-h-0" data-terminalai-no-palette>
                <Editor
                  height="100%"
                  path={activePath ?? 'untitled'}
                  language={lang}
                  theme={monacoThemeId}
                  value={activeBuffer.content}
                  onChange={(v) => {
                    const c = v ?? '';
                    if (!activePath) return;
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.path === activePath ? { ...t, content: c, dirty: true } : t
                      )
                    );
                  }}
                  onMount={handleMount}
                  options={editorOptions}
                  loading={
                    <div className="flex h-full items-center justify-center text-[13px] text-terminalai-muted">
                      Loading editor…
                    </div>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-h-[min(80vh,520px)] border-terminalai-border bg-terminalai-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-terminalai-text">Workspace files</DialogTitle>
            <DialogDescription className="text-terminalai-muted">
              {browseLoading ? 'Loading…' : `In “${browseDir}”${browseTruncated ? ' (truncated)' : ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b border-terminalai-borderSubtle pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-2xs"
              disabled={browseDir === '.' || browseDir === ''}
              onClick={() => {
                const parts = browseDir.split('/').filter(Boolean);
                parts.pop();
                setBrowseDir(parts.length ? parts.join('/') : '.');
              }}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Up
            </Button>
            <span className="truncate font-mono text-2xs text-terminalai-muted">{browseDir}</span>
          </div>
          <div className="max-h-[280px] overflow-y-auto rounded-md border border-terminalai-border bg-terminalai-elevated">
            {browseEntries.map((e) => (
              <button
                key={e.name}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1.5 text-left text-2xs',
                  'hover:bg-terminalai-hover',
                  e.kind === 'dir' ? 'text-terminalai-accentText' : 'text-terminalai-text'
                )}
                onClick={() => openBrowseEntry(e)}
              >
                {e.kind === 'dir' ? (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-terminalai-accentText" />
                ) : (
                  <File className="h-3.5 w-3.5 shrink-0 text-terminalai-muted" />
                )}
                <span className="font-mono">{e.name}</span>
              </button>
            ))}
            {!browseLoading && browseEntries.length === 0 && (
              <p className="p-3 text-2xs text-terminalai-muted">Empty or unavailable.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-terminalai-border"
              onClick={() => setBrowseOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

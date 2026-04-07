import { create } from 'zustand';

/** Cross-component workbench shortcuts (e.g. global Cmd+B toggles file explorer). */
type WorkbenchState = {
  fileExplorerToggleNonce: number;
  requestToggleFileExplorer: () => void;
  /** Bumps when chat (or elsewhere) requests opening a path in the workspace editor. */
  openEditorFileNonce: number;
  openEditorFilePath: string;
  /** When set with `requestOpenEditorFile` / `openEditorFileNonce`, reveal this 1-based line after the file loads. */
  openEditorFileLine: number | null;
  requestOpenEditorFile: (relativePath: string, line?: number) => void;
  clearOpenEditorFileLine: () => void;
  /** Active tab path in `WorkspaceEditorPanel`, or null when closed / no file. Used for ⌘/Ctrl+L chat context. */
  activeWorkspaceEditorPath: string | null;
  setActiveWorkspaceEditorPath: (path: string | null) => void;
  /**
   * Workspace-relative paths with unsaved Monaco buffers (synced from editor tabs).
   * Sent with agent POST so mutating tools refuse overwriting in-memory edits.
   */
  dirtyWorkspacePaths: string[];
  setDirtyWorkspaceEditorPaths: (paths: string[]) => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  fileExplorerToggleNonce: 0,
  requestToggleFileExplorer: () =>
    set((s) => ({ fileExplorerToggleNonce: s.fileExplorerToggleNonce + 1 })),
  openEditorFileNonce: 0,
  openEditorFilePath: '',
  openEditorFileLine: null,
  requestOpenEditorFile: (relativePath, line) =>
    set((s) => ({
      openEditorFilePath: relativePath.trim(),
      openEditorFileLine:
        line != null && Number.isFinite(line) && line >= 1 ? Math.trunc(line) : null,
      openEditorFileNonce: s.openEditorFileNonce + 1,
    })),
  clearOpenEditorFileLine: () => set({ openEditorFileLine: null }),
  activeWorkspaceEditorPath: null,
  setActiveWorkspaceEditorPath: (path) =>
    set({ activeWorkspaceEditorPath: path && path.trim() ? path.trim().replace(/\\/g, '/') : null }),
  dirtyWorkspacePaths: [],
  setDirtyWorkspaceEditorPaths: (paths) =>
    set({
      dirtyWorkspacePaths: [...paths].map((p) => p.trim().replace(/\\/g, '/')).filter(Boolean),
    }),
}));

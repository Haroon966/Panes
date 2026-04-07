/**
 * Vite bundles Monaco language workers via `?worker` imports.
 * Must run once before any Monaco editor is created.
 */
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let done = false;

export function setupMonacoEnvironment(): void {
  if (done) return;
  done = true;

  const g = globalThis as typeof globalThis & {
    MonacoEnvironment: { getWorker(workerId: unknown, label: string): Worker };
  };
  g.MonacoEnvironment = {
    getWorker(_workerId: unknown, label: string): Worker {
      switch (label) {
        case 'json':
          return new jsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new htmlWorker();
        case 'typescript':
        case 'javascript':
          return new tsWorker();
        default:
          return new editorWorker();
      }
    },
  };
}


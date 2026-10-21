import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react';
import ReactDOM from 'react-dom/client';
import boardCss from '../src/entrypoints/proton-task.content/style.css?inline';
import { OverlayApp } from '../src/components/OverlayApp';
import { mergeLines } from '../src/lib/lineMerge';
import { getSettings, setSettings, syncLanguage } from '../src/lib/settings';
import type { ApplyResult, EditorOrigin, EditorStateMessage } from '../src/lib/bridgeProtocol';
import type { EditorClient } from '../src/lib/editorClient';
import type { Settings } from '../src/lib/types';

/** ISO date `days` from today, so due-date states stay meaningful over time. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SAMPLE = [
  '#!tasks Product launch',
  '@settings status todo "To Do" @category:todo',
  '@settings status doing "In Progress" @category:doing @color:blue @bg:blue',
  '@settings status review "In review" @category:doing @color:purple @bg:purple',
  '@settings status done "Done" @category:done @color:green @bg:green',
  '',
  '## Discovery',
  '- [x] User interviews @who:sam #research',
  '- [x] Competitive teardown @who:alex',
  `- [ ] Synthesize findings @status:doing @due:${inDays(-2)} !!`,
  '## Build',
  `- [ ] API: tasks endpoint @priority:high @due:${inDays(0)} #backend @@jo`,
  '- [ ] Board overlay @status:review #frontend @desc(Shadow-DOM overlay on top of the Lexical editor)',
  `- [ ] Options page #frontend @due:${inDays(5)}`,
  '- [ ] Empty + error states #frontend !',
  '## Launch',
  '- [ ] Write announcement @who:sam #marketing',
  `- [ ] Record demo video @due:${inDays(12)}`,
  '- [ ] Ship it 🚀 @priority:high',
  '## Later / icebox',
  '- [ ] Drag-and-drop between columns',
  '- [ ] Saved filters',
];

/**
 * Stands in for Proton's Lexical editor bridge: holds the document lines,
 * three-way merges board writes like the real bridge, and can simulate a
 * locked editor or an edit from a collaborator.
 */
class PlaygroundEditor implements EditorClient {
  lines: string[];
  editable = true;
  state: EditorStateMessage;
  readonly ready: Promise<EditorStateMessage>;
  private listeners = new Set<(state: EditorStateMessage) => void>();
  private pageListeners = new Set<() => void>();

  constructor(lines: string[]) {
    this.lines = lines;
    this.state = this.snapshot('initial');
    this.ready = Promise.resolve(this.state);
  }

  private snapshot(origin: EditorOrigin): EditorStateMessage {
    return { text: this.lines.join('\n'), editable: this.editable, origin };
  }

  private emit(origin: EditorOrigin) {
    this.state = this.snapshot(origin);
    this.listeners.forEach((fn) => fn(this.state));
    this.pageListeners.forEach((fn) => fn());
  }

  subscribe(listener: (state: EditorStateMessage) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** For the playground's own UI (document preview, controls). */
  onChange = (fn: () => void) => {
    this.pageListeners.add(fn);
    return () => void this.pageListeners.delete(fn);
  };

  getState = () => this.state;

  apply(base: string[], target: string[]): ApplyResult {
    if (!this.editable) return { ok: false, reason: 'readonly' };
    this.lines = mergeLines(base, target, this.lines);
    this.emit('self');
    return { ok: true, lines: this.lines };
  }

  type(text: string) {
    this.lines = text.split('\n');
    this.emit('local');
  }

  collaboratorEdit() {
    this.lines = [...this.lines, '- [ ] Added by a collaborator @who:alex'];
    this.emit('remote');
  }

  setEditable(editable: boolean) {
    this.editable = editable;
    this.emit('local');
  }

  stop() {}
}

const params = new URLSearchParams(location.search);
const editor = new PlaygroundEditor(params.has('empty') ? [''] : SAMPLE);

/** A minimal Proton Docs-like page: toolbar plus the document text. */
function DocsShell() {
  const state = useSyncExternalStore(editor.onChange, editor.getState);
  const [settings, setLocal] = useState<Settings | null>(null);

  useEffect(() => {
    void getSettings().then(setLocal);
    const open = () => document.getElementById('pg-settings')?.scrollIntoView();
    window.addEventListener('pdt-playground:open-options', open);
    return () => window.removeEventListener('pdt-playground:open-options', open);
  }, []);

  const patch = async (p: Partial<Settings>) => setLocal(await setSettings(p));

  return (
    <div className="pg">
      <header className="pg-bar">
        <strong>Proton Docs</strong>
        <span className="pg-muted">Playground — fake editor, real board overlay</span>
        <span className="pg-spacer" />
        <label>
          <input
            type="checkbox"
            checked={!state.editable}
            onChange={(e) => editor.setEditable(!e.target.checked)}
          />{' '}
          Editing locked (offline)
        </label>
        <button type="button" onClick={() => editor.collaboratorEdit()}>
          Simulate collaborator edit
        </button>
        <a href={params.has('empty') ? '?' : '?empty'}>
          {params.has('empty') ? 'Sample board' : 'Empty document'}
        </a>
      </header>
      <main className="pg-doc">
        <textarea
          aria-label="Document text"
          value={state.text}
          spellCheck={false}
          onChange={(e) => editor.type(e.target.value)}
        />
        {settings && (
          <section id="pg-settings" className="pg-settings">
            <h2>Settings (stand-in for the options page)</h2>
            <label>
              Theme{' '}
              <select
                value={settings.theme}
                onChange={(e) => void patch({ theme: e.target.value as Settings['theme'] })}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              Density{' '}
              <select
                value={settings.density}
                onChange={(e) => void patch({ density: e.target.value as Settings['density'] })}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label>
              Your name{' '}
              <input
                value={settings.userAssignee ?? ''}
                onChange={(e) => void patch({ userAssignee: e.target.value })}
              />
            </label>
          </section>
        )}
      </main>
    </div>
  );
}

async function boot() {
  ReactDOM.createRoot(document.getElementById('page')!).render(<DocsShell />);

  await syncLanguage();
  const settings = await getSettings();
  const shadowHost = document.getElementById('overlay')!;
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = boardCss;
  const host = document.createElement('div');
  host.className = 'pdt-host';
  shadow.append(style, host);
  ReactDOM.createRoot(host).render(
    <StrictMode>
      <OverlayApp
        client={editor}
        initialState={editor.state}
        host={host}
        initialSettings={settings}
      />
    </StrictMode>,
  );
}

void boot();

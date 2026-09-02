import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../../lib/settings';
import type { Settings, StatusKey } from '../../lib/types';

const STATUS_ORDER: StatusKey[] = ['todo', 'doing', 'done'];

export function App() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [markersText, setMarkersText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setLocal(s);
      setMarkersText(s.markers.join('\n'));
    })();
  }, []);

  async function persist(patch: Partial<Settings>) {
    const next = await setSettings(patch);
    setLocal(next);
    setMarkersText(next.markers.join('\n'));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function saveMarkers() {
    const markers = markersText
      .split('\n')
      .map((m) => m.trim())
      .filter(Boolean);
    void persist({ markers });
  }

  function updateColumnLabel(key: StatusKey, label: string) {
    if (!settings) return;
    const columns = settings.columns.map((c) => (c.key === key ? { ...c, label } : c));
    setLocal({ ...settings, columns });
  }

  function saveColumns() {
    if (!settings) return;
    void persist({ columns: settings.columns });
  }

  if (!settings) return <div className="op-loading">Loading…</div>;

  return (
    <div className="op">
      <header className="op-head">
        <span className="op-logo" aria-hidden="true">
          ✓
        </span>
        <div>
          <h1>Proton Docs as Task</h1>
          <p className="op-sub">Turn a Proton Docs document into an interactive task board.</p>
        </div>
        {saved && (
          <span className="pdt-badge pdt-badge-solid pdt-badge-solid-success op-saved">
            Saved ✓
          </span>
        )}
      </header>

      <section className="op-card pdt-card">
        <h2>General</h2>
        <label className="op-row">
          <div>
            <div className="op-row__label">Enable the extension</div>
            <div className="op-row__hint">Turn the whole board on or off.</div>
          </div>
          <input
            type="checkbox"
            className="pdt-native-check"
            checked={settings.enabled}
            onChange={(e) => persist({ enabled: e.target.checked })}
          />
        </label>

        <label className="op-row">
          <div>
            <div className="op-row__label">Show board automatically</div>
            <div className="op-row__hint">Open the board as soon as a document activates.</div>
          </div>
          <input
            type="checkbox"
            className="pdt-native-check"
            checked={settings.autoShow}
            onChange={(e) => persist({ autoShow: e.target.checked })}
          />
        </label>

        <label className="op-row">
          <div>
            <div className="op-row__label">Default grouping</div>
            <div className="op-row__hint">How cards are laid out into columns.</div>
          </div>
          <select
            className="pdt-select"
            value={settings.grouping}
            onChange={(e) => persist({ grouping: e.target.value as Settings['grouping'] })}
          >
            <option value="status">By status</option>
            <option value="section">By section</option>
          </select>
        </label>
      </section>

      <section className="op-card pdt-card">
        <h2>Activation markers</h2>
        <p className="op-hint">
          A document becomes a task board when its <strong>first non-empty line</strong> starts with
          one of these (one per line, case-insensitive). You can add a title after the marker, e.g.{' '}
          <code>#!tasks Sprint 42</code>.
        </p>
        <textarea
          className="pdt-textarea"
          rows={4}
          value={markersText}
          onChange={(e) => setMarkersText(e.target.value)}
          spellCheck={false}
        />
        <div className="op-actions">
          <button className="pdt-btn pdt-btn-primary" onClick={saveMarkers}>
            Save markers
          </button>
          <button
            className="pdt-btn"
            onClick={() => persist({ markers: DEFAULT_SETTINGS.markers })}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="op-card pdt-card">
        <h2>Column labels</h2>
        <p className="op-hint">Rename the status columns shown on the board.</p>
        <div className="op-cols">
          {STATUS_ORDER.map((key) => {
            const col = settings.columns.find((c) => c.key === key);
            return (
              <label key={key} className="pdt-field">
                <span className="pdt-field-label">{key}</span>
                <input
                  type="text"
                  className="pdt-input"
                  value={col?.label ?? ''}
                  onChange={(e) => updateColumnLabel(key, e.target.value)}
                />
              </label>
            );
          })}
        </div>
        <div className="op-actions">
          <button className="pdt-btn pdt-btn-primary" onClick={saveColumns}>
            Save labels
          </button>
          <button
            className="pdt-btn"
            onClick={() => persist({ columns: DEFAULT_SETTINGS.columns })}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="op-card pdt-card">
        <h2>Task syntax</h2>
        <p className="op-hint">
          Below the marker line, write your tasks as a checklist. The board updates live as you
          type.
        </p>
        <pre className="op-syntax">{SYNTAX_EXAMPLE}</pre>
        <ul className="op-legend">
          <li>
            <code>- [ ]</code> / <code>- [x]</code> — an open or done task
          </li>
          <li>
            <code>## Heading</code> — a section (used for “group by section”)
          </li>
          <li>
            <code>@status:doing</code> — todo · doing · done (also <code>@s:wip</code>)
          </li>
          <li>
            <code>@priority:high</code> — high · medium · low (also <code>!</code>/<code>!!</code>/
            <code>!!!</code>)
          </li>
          <li>
            <code>@due:2026-09-10</code> — a due date
          </li>
          <li>
            <code>@who:alex</code> or <code>@@alex</code> — an assignee
          </li>
          <li>
            <code>#label</code> — one or more labels
          </li>
        </ul>
      </section>

      <footer className="op-foot">
        <a
          href="https://github.com/josselinonduty/proton-docs-as-task"
          target="_blank"
          rel="noreferrer"
        >
          github.com/josselinonduty/proton-docs-as-task
        </a>
      </footer>
    </div>
  );
}

const SYNTAX_EXAMPLE = `#!tasks Sprint 42

## Backend
- [x] Design the schema @who:sam
- [ ] Build the API @status:doing @priority:high @due:2026-09-10 #api

## Frontend
- [ ] Wire up the board @@jo !!
- [ ] Polish styles #ui`;

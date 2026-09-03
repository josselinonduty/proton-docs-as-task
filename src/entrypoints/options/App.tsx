import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, markersAreValid, setSettings } from '../../lib/settings';
import type { CardFieldVisibility, Settings, StatusKey } from '../../lib/types';

const STATUS_ORDER: StatusKey[] = ['todo', 'doing', 'done'];

const CARD_FIELD_OPTIONS: { key: keyof CardFieldVisibility; label: string }[] = [
  { key: 'description', label: 'Description preview' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due date' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'labels', label: 'Labels' },
  { key: 'sectionInWorkflow', label: 'Section (in Workflow view)' },
  { key: 'statusInSections', label: 'Status (in Sections view)' },
];

export function App() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [markersText, setMarkersText] = useState('');
  const [markerError, setMarkerError] = useState('');
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
    if (!markersAreValid(markers)) {
      setMarkerError('Add at least one activation marker — an empty list is not allowed.');
      return;
    }
    setMarkerError('');
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
        <Toggle
          label="Enable the extension"
          hint="Turn the whole board on or off."
          checked={settings.enabled}
          onChange={(v) => persist({ enabled: v })}
        />
        <Toggle
          label="Open activated boards automatically"
          hint="Open the board as soon as a document activates."
          checked={settings.autoShow}
          onChange={(v) => persist({ autoShow: v })}
        />

        <Row label="Default view" hint="Which layout the board opens in.">
          <select
            className="pdt-select"
            value={settings.defaultView}
            onChange={(e) => persist({ defaultView: e.target.value as Settings['defaultView'] })}
          >
            <option value="workflow">Workflow (by status)</option>
            <option value="sections">Sections (by heading)</option>
            <option value="swimlane">Swimlane (status × section)</option>
          </select>
        </Row>

        <Row label="Theme" hint="Match the system, or force light / dark.">
          <select
            className="pdt-select"
            value={settings.theme}
            onChange={(e) => persist({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>

        <Row label="Card density" hint="How tightly cards are packed.">
          <select
            className="pdt-select"
            value={settings.density}
            onChange={(e) => persist({ density: e.target.value as Settings['density'] })}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </Row>
      </section>

      <section className="op-card pdt-card">
        <h2>Board behavior</h2>
        <Row label="New cards" hint="Where a quick-added card lands in its column.">
          <select
            className="pdt-select"
            value={settings.newCardsAtTop ? 'top' : 'bottom'}
            onChange={(e) => persist({ newCardsAtTop: e.target.value === 'top' })}
          >
            <option value="bottom">At the bottom</option>
            <option value="top">At the top</option>
          </select>
        </Row>
        <Toggle
          label="Show description preview"
          hint="Show a short snippet of the description on collapsed cards."
          checked={settings.showDescriptionPreview}
          onChange={(v) => persist({ showDescriptionPreview: v })}
        />
        <Row
          label="Completed tasks"
          hint="How done tasks are shown (never removed from the document)."
        >
          <select
            className="pdt-select"
            value={settings.completedDisplay}
            onChange={(e) =>
              persist({ completedDisplay: e.target.value as Settings['completedDisplay'] })
            }
          >
            <option value="show">Show normally</option>
            <option value="collapse">Collapse Done column</option>
            <option value="hide">Hide completed cards</option>
          </select>
        </Row>
        <Toggle
          label="Confirm card deletion"
          hint="Ask before deleting a card (you can always undo)."
          checked={settings.confirmDelete}
          onChange={(v) => persist({ confirmDelete: v })}
        />
        <Toggle
          label="Show progress bar"
          hint="Show the completion progress bar in the board header."
          checked={settings.showProgressBar}
          onChange={(v) => persist({ showProgressBar: v })}
        />
      </section>

      <section className="op-card pdt-card">
        <h2>Display preferences</h2>
        <Row label="Date format" hint="How due dates are written on cards.">
          <select
            className="pdt-select"
            value={settings.dateFormat}
            onChange={(e) => persist({ dateFormat: e.target.value as Settings['dateFormat'] })}
          >
            <option value="iso">ISO (2026-09-10)</option>
            <option value="medium">Medium (Sep 10, 2026)</option>
            <option value="us">US (9/10/2026)</option>
            <option value="euro">European (10/9/2026)</option>
          </select>
        </Row>

        <Row
          label="Your name"
          hint="Enables the “My open tasks” filter. Matched against assignees; no lookup is performed."
        >
          <input
            type="text"
            className="pdt-input"
            value={settings.userAssignee}
            placeholder="e.g. Sam Rivera"
            onChange={(e) => setLocal({ ...settings, userAssignee: e.target.value })}
            onBlur={(e) => persist({ userAssignee: e.target.value })}
          />
        </Row>

        <fieldset className="op-fieldset">
          <legend className="op-row__label">Visible card fields</legend>
          <p className="op-row__hint">The task title and completion control are always shown.</p>
          <div className="op-checks">
            {CARD_FIELD_OPTIONS.map(({ key, label }) => (
              <label key={key} className="op-check">
                <input
                  type="checkbox"
                  className="pdt-native-check"
                  checked={settings.cardFields[key]}
                  onChange={(e) =>
                    persist({ cardFields: { ...settings.cardFields, [key]: e.target.checked } })
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
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
        {markerError && (
          <p className="op-error" role="alert">
            {markerError}
          </p>
        )}
        <div className="op-actions">
          <button className="pdt-btn pdt-btn-primary" onClick={saveMarkers}>
            Save markers
          </button>
          <button
            className="pdt-btn"
            onClick={() => {
              setMarkerError('');
              void persist({ markers: DEFAULT_SETTINGS.markers });
            }}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="op-card pdt-card">
        <h2>Workflow labels</h2>
        <p className="op-hint">
          Rename the status columns shown on the board. The internal keys stay <code>todo</code>,{' '}
          <code>doing</code> and <code>done</code>, so renaming a label never changes any task's
          status or metadata.
        </p>
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
          type. Status and section are independent: a task's <code>@status</code> is its workflow
          stage, while its <code>## Heading</code> is the section it lives under.
        </p>
        <pre className="op-syntax">{SYNTAX_EXAMPLE}</pre>
        <ul className="op-legend">
          <li>
            <code>- [ ]</code> / <code>- [x]</code> — an open or done task
          </li>
          <li>
            <code>## Heading</code> — a section (the Sections view groups by these)
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

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="op-row">
      <div>
        <div className="op-row__label">{label}</div>
        <div className="op-row__hint">{hint}</div>
      </div>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <input
        type="checkbox"
        className="pdt-native-check"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Row>
  );
}

const SYNTAX_EXAMPLE = `#!tasks Sprint 42

## Backend
- [x] Design the schema @who:sam
- [ ] Build the API @status:doing @priority:high @due:2026-09-10 #api

## Frontend
- [ ] Wire up the board @@jo !!
- [ ] Polish styles #ui`;

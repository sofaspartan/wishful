import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface EditorTab<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  /** Shows a dot when a field on this tab has an error. */
  invalid?: boolean;
  content: ReactNode;
}

interface Props<T extends string> {
  label: string;
  tabs: Array<EditorTab<T>>;
  active: T;
  onTabChange: (tab: T) => void;
  preview: ReactNode;
  /** On small screens the preview only shows above these tabs. */
  previewTabs: readonly T[];
  /** Shown above every tab, e.g. a save error. */
  alert?: ReactNode;
}

/**
 * Tabbed settings for a modal form with a live preview. On desktop the preview stays in a column
 * on the right while only the settings scroll. Every panel stays mounted so hidden tabs keep their edits.
 */
export function EditorLayout<T extends string>({ label, tabs, active, onTabChange, preview, previewTabs, alert }: Props<T>) {
  const id = useId();
  const panelsRef = useRef<HTMLDivElement>(null);

  const select = (tab: T) => {
    if (tab === active) return;
    onTabChange(tab);
    const panels = panelsRef.current;
    if (!panels) return;
    panels.scrollTop = 0;
    const body = panels.closest<HTMLElement>('.modal-body');
    if (body) body.scrollTop = 0;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    select(tab.id);
    document.getElementById(`${id}-tab-${tab.id}`)?.focus({ preventScroll: true });
  };

  return (
    <div className={`editor${previewTabs.includes(active) ? ' editor-on-preview-tab' : ''}`}>
      <div className="editor-tabs tabs" role="tablist" aria-label={label}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${id}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            aria-controls={`${id}-panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => select(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.icon}
            {t.label}
            {t.invalid && <span className="editor-tab-alert" role="img" aria-label="Needs attention" />}
          </button>
        ))}
      </div>
      <aside className="editor-preview" aria-label="Preview">
        {preview}
      </aside>
      <div className="editor-panels" ref={panelsRef}>
        {alert}
        {tabs.map((t) => (
          <div
            key={t.id}
            id={`${id}-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${t.id}`}
            hidden={t.id !== active}
            className="editor-panel stack"
          >
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A captioned block inside the preview column. */
export function PreviewBlock({ caption, className, children }: { caption: string; className?: string; children: ReactNode }) {
  return (
    <div className={['editor-preview-block', className].filter(Boolean).join(' ')}>
      <span className="editor-preview-caption">{caption}</span>
      {children}
    </div>
  );
}

/** Whether any of these fields (or their nested fields, like `recipients.0.name`) has an error. */
export function hasFieldError(fields: readonly string[], errors: Record<string, string>): boolean {
  return Object.keys(errors).some((k) => fields.some((field) => k === field || k.startsWith(`${field}.`)));
}

/** The first tab with an error, for jumping to it when saving fails. */
export function firstInvalidTab<T extends string>(tabs: Record<T, readonly string[]>, errors: Record<string, string>): T | null {
  return (Object.keys(tabs) as T[]).find((tab) => hasFieldError(tabs[tab], errors)) ?? null;
}

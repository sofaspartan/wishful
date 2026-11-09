import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { AlertCircle, Info } from 'lucide-react';

interface FieldProps {
  label: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
}

/** Label + control + hint/error, wired up with ids and aria attributes. */
export function Field({ label, children, hint, error, optional, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: (children.props.id as string) ?? id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label className="field-label" htmlFor={(children.props.id as string) ?? id}>
        {label}
        {optional && <span className="field-optional">Optional</span>}
      </label>
      {control}
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="form-error" role="alert">
      <AlertCircle size={16} aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function FormNote({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="form-note">
      {icon ?? <Info size={16} aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Copy, Download, KeyRound } from 'lucide-react';
import { brand } from '../config/brand';
import { dismissRecoveryCode, useIssuedRecoveryCode, type IssuedRecoveryCode } from '../lib/recoveryCode';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

const FIRST_CODE = `If you ever forget your password, this code lets you set a new one. Write it down or save it in your password manager — it’s the only way back into your account.`;

const INTROS: Record<IssuedRecoveryCode['reason'], string> = {
  'new-account': FIRST_CODE,
  created: FIRST_CODE,
  recovered: 'Your old code has been used up. This new one replaces it — save it somewhere safe for next time.',
  replaced: 'Your previous code no longer works. Save this one somewhere safe.',
};

function download({ code, email }: IssuedRecoveryCode) {
  const text = [
    `${brand.name} recovery code`,
    '',
    `Account: ${email}`,
    `Code:    ${code}`,
    `Saved:   ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`,
    '',
    `Forgot your password? Go to ${window.location.origin}/forgot-password and enter this code to choose a new one.`,
    'Each code works once — you’ll get a new one after using it.',
    '',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${brand.name.toLowerCase()}-recovery-code.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shows a just-issued recovery code once, wherever the user lands next. */
export function RecoveryCodeDialog() {
  const issued = useIssuedRecoveryCode();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    setSaved(false);
    setNudge(false);
  }, [issued]);

  if (!issued) return null;

  const close = () => {
    if (saved) dismissRecoveryCode();
    else setNudge(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.code);
      toast.success('Recovery code copied');
    } catch {
      toast.error('Couldn’t copy — select the code and copy it instead');
    }
  };

  return (
    <Modal
      open
      onClose={close}
      size="sm"
      title="Save your recovery code"
      footer={
        <Button variant="primary" onClick={close} disabled={!saved}>
          Done
        </Button>
      }
    >
      <div className="stack recovery-dialog">
        <p className="muted">{INTROS[issued.reason]}</p>
        <div className="recovery-code" aria-label="Recovery code">
          <KeyRound size={18} aria-hidden />
          <code>{issued.code}</code>
        </div>
        <div className="row-wrap">
          <Button size="sm" icon={<Copy size={15} />} onClick={() => void copy()}>
            Copy
          </Button>
          <Button size="sm" icon={<Download size={15} />} onClick={() => download(issued)}>
            Download
          </Button>
        </div>
        <p className="muted text-sm">You won’t be able to see this code again. If you lose it, you can make a new one in Settings while you’re logged in.</p>
        <label className="check" style={{ alignSelf: 'flex-start' }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>I’ve saved my recovery code</span>
        </label>
        {nudge && !saved && (
          <p className="recovery-nudge-text text-sm" role="alert">
            Save the code first — you won’t see it again.
          </p>
        )}
      </div>
    </Modal>
  );
}

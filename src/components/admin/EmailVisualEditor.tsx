import {
  Bold,
  Eraser,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

export type EmailVisualEditorHandle = {
  insertToken: (token: string) => void;
};

type EmailVisualEditorProps = {
  /** Full HTML document string (as stored in email_templates.html_body). */
  html: string;
  /** Called with the serialized full HTML document whenever the user edits. */
  onChange: (html: string) => void;
  /**
   * Changes to this key re-seed the editable document from `html`
   * (e.g. selecting a different template, or switching back from HTML mode).
   * Edits made inside the editor do NOT change this key, so the caret is
   * preserved while typing.
   */
  docKey: string;
};

const DOCTYPE = '<!DOCTYPE html>';

function serializeDoc(doc: Document): string {
  return `${DOCTYPE}${doc.documentElement.outerHTML}`;
}

/**
 * WYSIWYG editor for StayLoop transactional emails.
 *
 * Templates are stored as complete HTML documents (the `stayloop_email_layout()`
 * wrapper emits `<!DOCTYPE html><html>…<body>…`), so we edit inside an iframe —
 * the iframe IS a document, which a contentEditable <div> cannot represent.
 * Formatting uses document.execCommand: it is deprecated but remains the only
 * broadly-supported, dependency-free rich-text primitive and is well suited to
 * simple email formatting (bold/italic/lists/links).
 */
const EmailVisualEditor = forwardRef<EmailVisualEditorHandle, EmailVisualEditorProps>(
  function EmailVisualEditor({ html, onChange, docKey }, ref) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    // Always read the freshest html at write-time without making the seeding
    // effect depend on `html` (which would reset the caret on every keystroke).
    const htmlRef = useRef(html);
    htmlRef.current = html;

    const getDoc = useCallback((): Document | null => {
      return iframeRef.current?.contentDocument ?? null;
    }, []);

    const emitChange = useCallback(() => {
      const doc = getDoc();
      if (doc) onChange(serializeDoc(doc));
    }, [getDoc, onChange]);

    const seedDocument = useCallback(() => {
      const doc = getDoc();
      if (!doc) return;
      doc.open();
      doc.write(htmlRef.current || '<!DOCTYPE html><html><head></head><body></body></html>');
      doc.close();

      const body = doc.body;
      if (body) {
        body.setAttribute('contenteditable', 'true');
        body.style.outline = 'none';
        body.style.minHeight = '320px';
        body.addEventListener('input', emitChange);
        body.addEventListener('blur', emitChange);
      }
    }, [emitChange, getDoc]);

    // Re-seed only when docKey changes (template switch / mode switch).
    useEffect(() => {
      seedDocument();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docKey]);

    const focusBody = useCallback(() => {
      const win = iframeRef.current?.contentWindow;
      const doc = getDoc();
      win?.focus();
      doc?.body?.focus();
    }, [getDoc]);

    const exec = useCallback(
      (command: string, value?: string) => {
        const doc = getDoc();
        if (!doc) return;
        focusBody();
        doc.execCommand(command, false, value);
        emitChange();
      },
      [emitChange, focusBody, getDoc]
    );

    const insertToken = useCallback(
      (token: string) => {
        const doc = getDoc();
        if (!doc) return;
        focusBody();
        const inserted = doc.execCommand('insertText', false, token);
        if (!inserted && doc.body) {
          // Fallback for browsers where insertText is unavailable.
          doc.body.appendChild(doc.createTextNode(token));
        }
        emitChange();
      },
      [emitChange, focusBody, getDoc]
    );

    useImperativeHandle(ref, () => ({ insertToken }), [insertToken]);

    const createLink = useCallback(() => {
      const url = window.prompt('Link URL (you can use a {{variable}}):', 'https://');
      if (url) exec('createLink', url);
    }, [exec]);

    const toolbarButtons: Array<{
      label: string;
      icon: typeof Bold;
      onClick: () => void;
    }> = [
      { label: 'Bold', icon: Bold, onClick: () => exec('bold') },
      { label: 'Italic', icon: Italic, onClick: () => exec('italic') },
      { label: 'Underline', icon: Underline, onClick: () => exec('underline') },
      { label: 'Heading', icon: Heading2, onClick: () => exec('formatBlock', 'H2') },
      { label: 'Bulleted list', icon: List, onClick: () => exec('insertUnorderedList') },
      { label: 'Numbered list', icon: ListOrdered, onClick: () => exec('insertOrderedList') },
      { label: 'Insert link', icon: Link2, onClick: createLink },
      { label: 'Clear formatting', icon: Eraser, onClick: () => exec('removeFormat') },
    ];

    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-100 px-2 py-2">
          {toolbarButtons.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              // Prevent the button from stealing the selection before execCommand runs.
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <iframe
          ref={iframeRef}
          title="Visual email editor"
          className="h-[520px] w-full bg-white"
        />
      </div>
    );
  }
);

export default EmailVisualEditor;

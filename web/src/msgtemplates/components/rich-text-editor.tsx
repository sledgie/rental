import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Pilcrow, RemoveFormatting } from "lucide-react";
import { sanitizeEditorHtml } from "../lib/client-sanitize";

export type RichTextEditorHandle = { insertText: (text: string) => void; focus: () => void };

export const RichTextEditor = forwardRef<RichTextEditorHandle, { value: string; onChange: (value: string) => void; onFocus?: () => void; invalid?: boolean }>(function RichTextEditor({ value, onChange, onFocus, invalid }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (!editorRef.current || document.activeElement === editorRef.current) return;
    const sanitized = sanitizeEditorHtml(value);
    if (editorRef.current.innerHTML !== sanitized) editorRef.current.innerHTML = sanitized;
  }, [value]);

  function saveRange() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) rangeRef.current = selection.getRangeAt(0).cloneRange();
  }
  function restoreRange() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (rangeRef.current) selection.addRange(rangeRef.current);
    else {
      const range = document.createRange();
      range.selectNodeContents(editor); range.collapse(false); selection.addRange(range);
    }
  }
  function command(name: string, argument?: string) {
    restoreRange();
    document.execCommand(name, false, argument);
    editorRef.current && onChange(editorRef.current.innerHTML);
    saveRange();
  }
  useImperativeHandle(ref, () => ({
    insertText(text: string) { command("insertText", text); },
    focus() { restoreRange(); },
  }));

  const tools = [
    { label: "Bold", icon: Bold, action: () => command("bold") },
    { label: "Italic", icon: Italic, action: () => command("italic") },
    { label: "Bulleted list", icon: List, action: () => command("insertUnorderedList") },
    { label: "Numbered list", icon: ListOrdered, action: () => command("insertOrderedList") },
    { label: "Paragraph", icon: Pilcrow, action: () => command("formatBlock", "p") },
  ];
  return <div className={`overflow-hidden rounded-b-lg border-x border-b bg-u-card ${invalid ? "border-u-danger/30" : "border-u-line2"}`}>
    <div className="flex flex-wrap items-center gap-0.5 border-b border-u-line bg-u-s2 px-2 py-1.5" role="toolbar" aria-label="Text formatting">
      {tools.map((tool) => <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} onMouseDown={(event) => event.preventDefault()} onClick={tool.action} className="rounded-md p-2 text-u-muted hover:bg-u-card hover:text-u-ink hover:shadow-sm"><tool.icon size={15} /></button>)}
      <span className="mx-1 h-5 w-px bg-u-line" />
      <button type="button" title="Insert link" aria-label="Insert link" onMouseDown={(event) => event.preventDefault()} onClick={() => { const url = window.prompt("Link URL (https:// or mailto:)"); if (url && /^(https?:\/\/|mailto:|tel:)/.test(url)) command("createLink", url); else if (url) window.alert("Use an http, https, mailto or tel URL."); }} className="rounded-md p-2 text-u-muted hover:bg-u-card hover:text-u-ink hover:shadow-sm"><Link2 size={15} /></button>
      <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")} className="rounded-md p-2 text-u-muted hover:bg-u-card hover:text-u-ink hover:shadow-sm"><RemoveFormatting size={15} /></button>
      <span className="ml-auto hidden px-2 text-[10px] text-u-muted sm:block">HTML is sanitized on preview and save</span>
    </div>
    <div ref={editorRef} className="rich-editor max-h-[480px]" contentEditable suppressContentEditableWarning data-placeholder="Write your message…" role="textbox" aria-multiline="true" aria-label="Rich text message body" aria-invalid={invalid}
      onPaste={(event) => { event.preventDefault(); const html = event.clipboardData.getData("text/html"); const text = event.clipboardData.getData("text/plain"); if (html) command("insertHTML", sanitizeEditorHtml(html)); else if (text) command("insertText", text); }}
      onDrop={(event) => { event.preventDefault(); const text = event.dataTransfer.getData("text/plain"); if (text) command("insertText", text); }}
      onInput={(event) => { onChange(event.currentTarget.innerHTML); saveRange(); }} onFocus={() => { onFocus?.(); saveRange(); }} onKeyUp={saveRange} onMouseUp={saveRange} onBlur={saveRange} />
  </div>;
});

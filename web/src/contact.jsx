// Compose dialogs for reaching a tenant. Nothing is sent from the server: each button opens the
// person's own email app, messaging app or WhatsApp with the message already filled in.
import { useState } from 'react';
import { Field, Modal } from './ui.jsx';

// Digits only, with Canada's +1 added to 10-digit numbers, as WhatsApp and SMS links need.
export const dialNumber = (phone) => {
  const d = (phone || '').replace(/\D/g, '');
  return d.length === 10 ? `1${d}` : d;
};

export function ContactDialog({ kind, tenant, onClose }) {
  const first = tenant.name.split(' ')[0];
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(`Hi ${first},\n\n`);
  const num = dialNumber(tenant.phone);
  const enc = encodeURIComponent;
  const go = (url, newTab) => { if (newTab) window.open(url, '_blank', 'noopener'); else window.location.href = url; onClose(); };

  if (kind === 'email') {
    return (
      <Modal title={`Email ${tenant.name}`} onClose={onClose} footer={<>
        <button className="btn pri" disabled={!body.trim()} onClick={() => go(`mailto:${tenant.email}?subject=${enc(subject)}&body=${enc(body)}`)}>Open in email app</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </>}>
        <Field label="To"><input className="inp" value={tenant.email} disabled /></Field>
        <Field label="Subject"><input className="inp" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Rent reminder" /></Field>
        <Field label="Message"><textarea className="inp" rows="6" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="sub">This opens your email app with the message filled in. Press send there.</div>
      </Modal>
    );
  }
  return (
    <Modal title={`Message ${tenant.name}`} onClose={onClose} footer={<>
      <button className="btn pri" disabled={!body.trim() || !num} onClick={() => go(`sms:+${num}?body=${enc(body)}`)}>Send SMS</button>
      <button className="btn" disabled={!body.trim() || !num} onClick={() => go(`https://wa.me/${num}?text=${enc(body)}`, true)}>Send on WhatsApp</button>
      <button className="btn link" onClick={onClose}>Cancel</button>
    </>}>
      <Field label="To"><input className="inp" value={tenant.phone} disabled /></Field>
      <Field label="Message"><textarea className="inp" rows="5" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <div className="sub">SMS opens your phone's messaging app. WhatsApp opens only if this number uses WhatsApp and the app or WhatsApp Web is available. Press send there.</div>
    </Modal>
  );
}

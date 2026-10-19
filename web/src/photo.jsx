// Picture helpers shared by the Properties and Tenants pages.
import { useState } from 'react';
import { Icon } from './icons.jsx';
import { Field } from './ui.jsx';

// Shrinks a chosen picture to at most `max` px wide (or a centred square of `max` px) and returns a JPEG data URL, so uploads stay small.
export function shrinkImage(file, { max = 1000, square = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); const ctx = c.getContext('2d');
      if (square) {
        const side = Math.min(img.width, img.height); const out = Math.min(max, side);
        c.width = out; c.height = out;
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
      } else {
        const k = Math.min(1, max / img.width);
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        ctx.drawImage(img, 0, 0, c.width, c.height);
      }
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as a picture.')); };
    img.src = url;
  });
}

// Round picture of a person; shows a default silhouette when there is no picture.
export function Avatar({ photo, size = 36, name = '' }) {
  const box = { width: size, height: size, borderRadius: '50%', flex: 'none', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  if (photo) return <img src={photo} alt={name} style={{ ...box, objectFit: 'cover' }} />;
  return <span role="img" aria-label={name || 'No picture'} style={{ ...box, background: 'linear-gradient(135deg,#5ecba2,#2c6b55)', color: '#fff' }}><Icon name="user" size={Math.round(size * 0.58)} /></span>;
}

export function PhotoField({ label = 'Picture', hint, value, name, onChange, error }) {
  const [msg, setMsg] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    try { onChange(await shrinkImage(file, { max: 400, square: true })); setMsg(''); } catch (x) { setMsg(x.message); }
  };
  return (
    <Field label={label} hint={hint} error={error || msg}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar photo={value} size={72} name={name} />
        <label className="btn sm" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{value ? 'Change picture' : 'Choose picture'}<input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} /></label>
        {value && <button type="button" className="btn link dng" onClick={() => onChange('')}>Remove</button>}
      </div>
    </Field>
  );
}

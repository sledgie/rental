// The tenants table: sticky header, pinned checkbox + Name, resizable / reorderable columns, header and row menus,
// and pagination in the footer. Rows arrive already filtered and sorted; this component pages them.
import { useRef, useState } from 'react';
import { Avatar } from '../photo.jsx';
import { Icon } from '../icons.jsx';
import { Badge } from '../ui.jsx';
import { COL, STATUS, ROLE, fmtCell } from './columns.js';
import ColumnMenu from './ColumnMenu.jsx';
import RowMenu from './RowMenu.jsx';
import { MenuItem, Pop } from './Pop.jsx';

const CHECK_W = 44; const MIN_W = 80;
const NA = <span className="tv-na">Not available</span>;

function Cell({ c, row, onPreview, onOpen, rowMenu }) {
  const v = c.value(row); const text = fmtCell(c, v);
  switch (c.key) {
    case 'name':
      return (
        <div className="tv-name">
          <Avatar photo={row.photo} size={28} name={c.value(row)} />
          <button type="button" className="tv-namebtn" onClick={() => onOpen(row)}>{text}</button>
          <button type="button" className="tv-ibtn tv-eye" aria-label={`Preview ${text}`} title="Quick preview" onClick={() => onPreview(row)}><Icon name="eye" size={14} /></button>
          <span className="tv-rowmenu">{rowMenu}</span>
        </div>
      );
    case 'email': return text ? <a className="tv-link" href={`mailto:${text}`}>{text}</a> : NA;
    case 'phone': return text ? <a className="tv-link" href={`tel:${text.replace(/[^+\d]/g, '')}`}>{text}</a> : NA;
    case 'status': return <Badge cls={STATUS[row.status][1]}>{STATUS[row.status][0]}</Badge>;
    case 'role': return row.role ? <Badge cls="b-sys">{ROLE[row.role]}</Badge> : NA;
    case 'balance': return text ? (v > 0 ? <b className="bad">{text}</b> : text) : NA;
    default: return text ?? NA;
  }
}

export default function DataGrid({ rows, total, cols, onCols, sort, onSort, selected, onSelect, page, pageSize, onPage, onPageSize, onPreview, onOpen, onEdit, onLease, onDeactivate, loading }) {
  const drag = useRef(null); const [over, setOver] = useState(null);
  const visible = cols.filter((s) => s.visible);
  const ordered = [...visible.filter((s) => s.pin === 'left'), ...visible.filter((s) => !s.pin), ...visible.filter((s) => s.pin === 'right')];
  const leftAt = {}; let acc = CHECK_W; ordered.forEach((s) => { if (s.pin === 'left') { leftAt[s.key] = acc; acc += s.width; } });
  const rightAt = {}; acc = 0; [...ordered].reverse().forEach((s) => { if (s.pin === 'right') { rightAt[s.key] = acc; acc += s.width; } });
  const lastLeft = [...ordered].filter((s) => s.pin === 'left').pop()?.key; const firstRight = ordered.find((s) => s.pin === 'right')?.key;
  const stick = (s) => (s.pin === 'left' ? { position: 'sticky', left: leftAt[s.key], zIndex: 2 } : s.pin === 'right' ? { position: 'sticky', right: rightAt[s.key], zIndex: 2 } : null);
  const edge = (s) => (s.key === lastLeft ? ' tv-edge-l' : s.key === firstRight ? ' tv-edge-r' : '');
  const width = CHECK_W + ordered.reduce((a, s) => a + s.width, 0);

  const patch = (key, p) => onCols(cols.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const move = (from, to) => { if (from === to) return; const next = cols.filter((s) => s.key !== from); const i = next.findIndex((s) => s.key === to); next.splice(i, 0, cols.find((s) => s.key === from)); onCols(next); };
  const addNear = (key, anchor, side) => {
    const item = { ...cols.find((s) => s.key === key), visible: true };
    const next = cols.filter((s) => s.key !== key); const i = next.findIndex((s) => s.key === anchor);
    next.splice(side === 'right' ? i + 1 : i, 0, { ...item, pin: next[i].pin });
    onCols(next);
  };
  const startResize = (e, s) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX; const w0 = s.width;
    const mv = (ev) => patch(s.key, { width: Math.max(MIN_W, w0 + ev.clientX - x0) });
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize)); const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * pageSize, cur * pageSize + pageSize);
  const allOnPage = slice.length > 0 && slice.every((r) => selected.has(r.id)); const some = slice.some((r) => selected.has(r.id));
  const toggleRow = (id) => onSelect((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectPage = (on) => onSelect((s) => { const n = new Set(s); slice.forEach((r) => (on ? n.add(r.id) : n.delete(r.id))); return n; });
  const from = total ? cur * pageSize + 1 : 0; const to = Math.min(total, cur * pageSize + pageSize);

  return (
    <div className="tv-gridwrap">
      <div className="tv-scroll">
        <table className="tv-table" style={{ width, minWidth: '100%' }}>
          <colgroup><col style={{ width: CHECK_W }} />{ordered.map((s) => <col key={s.key} style={{ width: s.width }} />)}</colgroup>
          <thead>
            <tr>
              <th className="tv-chk" style={{ position: 'sticky', left: 0, zIndex: 4 }}>
                <input type="checkbox" aria-label="Select this page" checked={allOnPage} ref={(el) => { if (el) el.indeterminate = some && !allOnPage; }} onChange={(e) => selectPage(e.target.checked)} />
                <Pop width={190} trigger={({ toggle }) => <button type="button" className="tv-hbtn" aria-label="Selection options" onClick={toggle}><Icon name="down" size={12} /></button>}>
                  {(close) => (<><MenuItem onClick={() => { selectPage(true); close(); }}>Select page</MenuItem><MenuItem onClick={() => { onSelect(new Set(rows.map((r) => r.id))); close(); }}>Select all {total} records</MenuItem></>)}
                </Pop>
              </th>
              {ordered.map((s) => {
                const c = COL[s.key];
                return (
                  <th key={s.key} className={`tv-th${edge(s)}${over === s.key ? ' tv-over' : ''}`} style={stick(s) ? { ...stick(s), zIndex: 3 } : undefined} draggable
                    onDragStart={() => { drag.current = s.key; }} onDragOver={(e) => { e.preventDefault(); setOver(s.key); }} onDragLeave={() => setOver(null)}
                    onDrop={() => { setOver(null); if (drag.current) move(drag.current, s.key); drag.current = null; }} onDragEnd={() => { setOver(null); drag.current = null; }}
                    aria-sort={sort.key === s.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <div className="tv-thin">
                      <button type="button" className="tv-thlabel" onClick={() => onSort(s.key, sort.key === s.key && sort.dir === 'asc' ? 'desc' : 'asc')} title="Sort">
                        {s.pin && <Icon name="pin" size={11} />}{c.label}{sort.key === s.key && <Icon name={sort.dir === 'asc' ? 'up' : 'down'} size={11} />}
                      </button>
                      <ColumnMenu col={s} cols={cols} sort={sort} onSort={onSort} onPin={(k, p) => patch(k, { pin: p })} onHide={(k) => patch(k, { visible: false })} onAdd={addNear} />
                    </div>
                    <span className="tv-resize" onMouseDown={(e) => startResize(e, s)} onDoubleClick={() => patch(s.key, { width: c.width })} role="separator" aria-label={`Resize ${c.label}`} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'tv-sel' : undefined}>
                <td className="tv-chk" style={{ position: 'sticky', left: 0, zIndex: 2 }}><input type="checkbox" aria-label={`Select ${r.first} ${r.last}`} checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                {ordered.map((s) => (
                  <td key={s.key} className={edge(s).trim()} style={stick(s) || undefined}>
                    <Cell c={COL[s.key]} row={r} onPreview={onPreview} onOpen={onOpen} rowMenu={<RowMenu row={r} onEdit={onEdit} onLease={onLease} onDeactivate={onDeactivate} />} />
                  </td>
                ))}
              </tr>
            ))}
            {!slice.length && <tr><td colSpan={ordered.length + 1} className="tv-none">{loading ? 'Loading...' : 'No tenants match.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="tv-foot">
        <span className="tv-range">{from}&ndash;{to} of {total}</span>
        <label className="tv-size">Rows per page
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>{[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <div className="tv-pager">
          <button type="button" disabled={cur === 0} onClick={() => onPage(0)}>First</button>
          <button type="button" disabled={cur === 0} onClick={() => onPage(cur - 1)}>Previous</button>
          <span>Page {cur + 1} of {pages}</span>
          <button type="button" disabled={cur >= pages - 1} onClick={() => onPage(cur + 1)}>Next</button>
          <button type="button" disabled={cur >= pages - 1} onClick={() => onPage(pages - 1)}>Last</button>
        </div>
      </div>
    </div>
  );
}

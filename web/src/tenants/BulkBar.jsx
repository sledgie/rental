// Shown above the grid while rows are ticked.
export default function BulkBar({ rows, onClear, onDeactivate }) {
  if (!rows.length) return null;
  const active = rows.filter((r) => r.status !== 'past');
  return (
    <div className="tv-bulk" role="region" aria-label="Bulk actions">
      <b>{rows.length} selected</b>
      <button type="button" className="tv-btn sm dng" disabled={!active.length} title={active.length ? undefined : 'Everyone selected is already a past tenant.'} onClick={() => onDeactivate(active)}>Deactivate{active.length ? ` (${active.length})` : ''}</button>
      <button type="button" className="tv-linkbtn" onClick={onClear}>Clear selection</button>
    </div>
  );
}

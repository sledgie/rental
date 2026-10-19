// The ⋮ menu on each row.
import { Icon } from '../icons.jsx';
import { MenuItem, Pop } from './Pop.jsx';

export default function RowMenu({ row, onEdit, onLease, onDeactivate }) {
  return (
    <Pop width={200} trigger={({ toggle }) => <button type="button" className="tv-ibtn" aria-label={`Actions for ${row.first} ${row.last}`} onClick={toggle}><Icon name="dots" size={14} style={{ transform: 'rotate(90deg)' }} /></button>}>
      {(close) => (
        <>
          <MenuItem onClick={() => { close(); onEdit(row); }}>Edit Tenant</MenuItem>
          <MenuItem disabled={!row.leaseId} title={row.leaseId ? undefined : 'This person is not on a lease.'} onClick={() => { close(); onLease(row); }}>View Lease</MenuItem>
          <MenuItem disabled title="Notes are not stored yet.">Add Note</MenuItem>
          <div className="tv-sep" />
          <MenuItem danger disabled={row.status === 'past'} title={row.status === 'past' ? 'Already a past tenant.' : undefined} onClick={() => { close(); onDeactivate([row]); }}>Deactivate Tenant</MenuItem>
        </>
      )}
    </Pop>
  );
}

// Quick-preview drawer opened by the eye icon next to a name.
import { Avatar } from '../photo.jsx';
import { Icon } from '../icons.jsx';
import { Badge } from '../ui.jsx';
import { money, money0 } from '../format.js';
import { ROLE, STATUS } from './columns.js';

const Row = ({ k, v }) => <div className="tv-prow"><span>{k}</span><b>{v || <span className="tv-na">Not available</span>}</b></div>;

export default function PreviewDrawer({ row, onClose, onEdit, onLease }) {
  return (
    <div className="tv-drawer" role="dialog" aria-label={`${row.first} ${row.last}`}>
      <div className="tv-dhead"><b>Tenant preview</b><button type="button" className="tv-ibtn" aria-label="Close" onClick={onClose}><Icon name="x" size={14} /></button></div>
      <div className="tv-dbody">
        <div className="tv-phead"><Avatar photo={row.photo} size={56} name={`${row.first} ${row.last}`} /><div><h2>{row.first} {row.last}</h2><Badge cls={STATUS[row.status][1]}>{STATUS[row.status][0]}</Badge></div></div>
        <Row k="Email" v={row.email && <a className="tv-link" href={`mailto:${row.email}`}>{row.email}</a>} />
        <Row k="Phone" v={row.phone && <a className="tv-link" href={`tel:${row.phone.replace(/[^+\d]/g, '')}`}>{row.phone}</a>} />
        <Row k="Property" v={row.propertyName} />
        <Row k="Unit" v={row.unitNumber} />
        <Row k="Role" v={row.role && ROLE[row.role]} />
        <Row k="Monthly rent" v={row.rent && row.role !== 'occupant' ? money0(row.rent) : null} />
        <Row k="Household balance" v={row.role === 'occupant' ? null : (row.balance > 0 ? <span className="bad">{money(row.balance)}</span> : money(row.balance))} />
        <Row k="Move-in date" v={row.moveIn} />
      </div>
      <div className="tv-dfoot"><button type="button" className="tv-btn pri" onClick={() => onEdit(row)}>Edit Tenant</button><button type="button" className="tv-btn" disabled={!row.leaseId} onClick={() => onLease(row)}>View Lease</button></div>
    </div>
  );
}

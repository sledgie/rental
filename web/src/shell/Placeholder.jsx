// One reusable "Coming soon" page for every navigation item that has no real module yet.
import { Icon } from '../icons.jsx';
import { BRAND, findNav } from './navConfig.js';

export default function Placeholder({ id }) {
  const item = findNav(id);
  if (!item) return null;
  return (
    <section className="tv-ph" aria-labelledby="tv-ph-title">
      <nav aria-label="Breadcrumb" className="tv-crumbs">
        <ol>
          <li><a href={`#/${BRAND.home}`}>Home</a></li>
          <li>{item.group.label}</li>
          {item.group.label !== item.label && <li aria-current="page">{item.label}</li>}
        </ol>
      </nav>
      <div className="tv-phcard">
        <span className="tv-phicon"><Icon name={item.icon} size={28} /></span>
        <span className="tv-soon">Coming Soon</span>
        <h1 id="tv-ph-title">{item.label}</h1>
        <p>{item.desc}</p>
        <p className="tv-phnote">This module will be available here.</p>
      </div>
    </section>
  );
}

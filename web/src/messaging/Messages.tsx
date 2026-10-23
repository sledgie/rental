import { isSupabaseConfigured } from '../lib/supabase';
import { useEffect } from 'react';
import { Mail, Plus, Search } from 'lucide-react';
import { AppProvider, useApp, type MessageFolder } from './context/AppContext';
import { FolderSidebar } from './components/FolderSidebar';
import { ConversationList } from './components/ConversationList';
import { ConversationDetail } from './components/ConversationDetail';
import { AnnouncementManager } from './components/AnnouncementManager';
import { TemplateManager } from './components/TemplateManager';
import { CommunicationMetrics } from './components/CommunicationMetrics';
import { CommunicationSettings } from './components/CommunicationSettings';
import { ComposeModal } from './components/ComposeModal';
import './messaging.css';

const FOLDERS: MessageFolder[] = ['inbox', 'unread', 'sent', 'assigned', 'internal', 'drafts', 'archived', 'announcements', 'templates', 'metrics', 'settings'];

function Page({ tab }: { tab?: string }) {
  const { activeFolder, setActiveFolder, users, currentUser, setCurrentUser, conversations, canAccessConversation, readTracker, openComposeModal, searchQuery, setSearchQuery } = useApp();

  // Follow the hash when another page links straight to a folder.
  useEffect(() => {
    if (tab && FOLDERS.includes(tab as MessageFolder)) setActiveFolder(tab as MessageFolder);
  }, [tab, setActiveFolder]);

  const unread = conversations.filter((c) => canAccessConversation(c) && !c.archivedAt && readTracker[c.id] === false).length;
  const manager = { announcements: <AnnouncementManager />, templates: <TemplateManager />, metrics: <CommunicationMetrics />, settings: <CommunicationSettings /> }[activeFolder as string];

  return (
    <div className="tn ms">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            {/* Outlook-style mail client: command bar, folder pane, message list, reading pane */}
            <section className="ms-client" aria-label="Mail">
              <div className="ms-topbar no-print">
                <span className="ms-brand"><Mail size={16} />Mail</span>
                <button type="button" className="ms-new" onClick={() => openComposeModal()}><Plus size={15} />New message</button>
                <label className="ms-search">
                  <Search size={14} />
                  <input type="search" placeholder="Search mail" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </label>
                <span className="ms-unread">{unread} unread</span>
                <label className="ms-field">
                  Viewing as
                  <select value={currentUser.id} onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (u) setCurrentUser(u); }}>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
                  </select>
                </label>
              </div>
              <div className="u-root ms-body">
                <div className="ms-split">
                  <FolderSidebar />
                  {manager ?? (
                    <>
                      <ConversationList />
                      <ConversationDetail />
                    </>
                  )}
                </div>
              </div>
            </section>
            <div className="directory-footnote no-print">
              <span>{isSupabaseConfigured ? 'Conversations are saved to your organization. SMS messages are sent through Twilio; email and WhatsApp delivery is not connected yet.' : 'Demonstration data held in memory for this visit. Nothing is delivered to real recipients.'}</span>
            </div>
          </main>
        </div>
      </div>
      <div className="u-root"><ComposeModal /></div>
    </div>
  );
}

export default function Messages({ params }: { params?: Record<string, string> }) {
  const tab = params?.tab;
  return (
    <AppProvider initialFolder={FOLDERS.includes(tab as MessageFolder) ? (tab as MessageFolder) : undefined}>
      <Page tab={tab} />
    </AppProvider>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mail, Inbox, Send, Trash2, PenSquare, Key, User, LogOut,
  ChevronDown, ShieldCheck, LayoutDashboard, Settings,
  Circle, Star, AlertOctagon, Archive, FileEdit, Users, FolderPlus, Tag, Folder, X
, Plus } from 'lucide-react'
import MailInbox from './workspaces/MailInbox'
import MailCompose from './workspaces/MailCompose'
import MailKeys from './workspaces/MailKeys'
import MailProfile from './workspaces/MailProfile'
import MailDrafts from './workspaces/MailDrafts'
import MailContacts from './workspaces/MailContacts'

const NAV = [
  { id: 'compose', label: 'Compose', icon: PenSquare },
  { id: 'inbox',   label: 'Inbox',   icon: Inbox },
  { id: 'important', label: 'Important', icon: Star },
  { id: 'sent',    label: 'Sent',    icon: Send },
  { id: 'drafts',  label: 'Drafts',  icon: FileEdit },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'spam',    label: 'Spam',    icon: AlertOctagon },
  { id: 'trash',   label: 'Trash',   icon: Trash2 },
  { id: 'contacts',label: 'Contacts',icon: Users },
  { id: 'keys',    label: 'Security Keys', icon: Key },
  { id: 'profile', label: 'Profile', icon: User },
]

function renderWorkspace(active, keyPair, setKeyPair, refreshTrigger, onCompose, composeData, onRead, folders) {
  if (['inbox', 'sent', 'trash', 'important', 'archive', 'spam'].includes(active)) {
    return <MailInbox keyPair={keyPair} folder={active} refreshTrigger={refreshTrigger} onCompose={onCompose} onRead={onRead} folders={folders} />
  }
  if (active.length === 36) { // UUID for custom folders
    return <MailInbox keyPair={keyPair} folder={active} refreshTrigger={refreshTrigger} onCompose={onCompose} onRead={onRead} folders={folders} />
  }
  switch (active) {
    case 'compose': return <MailCompose keyPair={keyPair} composeData={composeData} />
    case 'drafts':  return <MailDrafts keyPair={keyPair} />
    case 'contacts':return <MailContacts />
    case 'keys':    return <MailKeys keyPair={keyPair} onKeyChange={setKeyPair} />
    case 'profile': return <MailProfile />
    default:        return <MailInbox keyPair={keyPair} folder="inbox" refreshTrigger={refreshTrigger} onCompose={onCompose} onRead={onRead} folders={folders} />
  }
}

export default function MailDashboard() {
  const [active, setActive] = useState('inbox')
  const [userOpen, setUserOpen] = useState(false)
  const [keyPair, setKeyPair] = useState(null)
  const [folders, setFolders] = useState([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [composeData, setComposeData] = useState(null)
  const [toasts, setToasts] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropRef = useRef(null)
  const lastMsgId = useRef(null)

  function handleCompose(data) {
    setComposeData(data)
    setActive('compose')
  }

  function handleRead() {
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const userName  = window.memoryStorage.getItem('caspmail_user_name')  || window.memoryStorage.getItem('caspmail_user_name') || 'User'
  const userRole  = window.memoryStorage.getItem('caspmail_user_role')  || window.memoryStorage.getItem('caspmail_user_role') || 'User'
  const userEmail = window.memoryStorage.getItem('caspmail_user_email') || window.memoryStorage.getItem('caspmail_user_email') || ''

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = (window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))
      if (!token) return
      const rDash = await fetch('/api/me/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      if (rDash.ok) {
        const dashData = await rDash.json()
        if (dashData.data && dashData.data.inbox) {
          const count = parseInt(dashData.data.inbox.unread, 10)
          setUnreadCount(isNaN(count) ? 0 : count)
          return
        }
      }
      const rUnread = await fetch('/api/e2ee/messages?folder=inbox&unread=true&limit=99', { headers: { Authorization: `Bearer ${token}` } })
      if (rUnread.ok) {
        const unreadData = await rUnread.json()
        setUnreadCount(unreadData.data ? unreadData.data.length : 0)
      }
    } catch (e) { console.error('Unread fetch error:', e) }
  }, [])

  useEffect(() => {
    import('./crypto.js').then(({ loadKeyPair }) => {
      loadKeyPair().then(kp => setKeyPair(kp)).catch(() => {})
    })
    
    fetch('/api/e2ee/folders', {
      headers: { Authorization: `Bearer ${(window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))}` }
    })
      .then(r => r.json())
      .then(d => setFolders(d.data || []))
      .catch(e => console.error(e))

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().catch(() => {}) 
    }

    const checkNewMail = async () => {
      await fetchUnreadCount()
      try {
        const token = (window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))
        if (!token) return
        
        const rMsg = await fetch('/api/e2ee/messages?folder=inbox&limit=1', { headers: { Authorization: `Bearer ${token}` } })
        
        if (!rMsg.ok) return
        const data = await rMsg.json()
        if (data.data && data.data.length > 0) {
          const latest = data.data[0]
          if (lastMsgId.current && lastMsgId.current !== latest.id) {
            setRefreshTrigger(v => v + 1)
            
            let shownNative = false
            if (Notification.permission === 'granted') {
              try {
                new Notification('New Encrypted Message', { body: `From: ${latest.from_email}` })
                shownNative = true
              } catch (e) {}
            }

            const toastId = Date.now()
            setToasts(prev => [...prev, { id: toastId, message: `New message from ${latest.from_email}` }])
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== toastId))
            }, 5000)
          }
          lastMsgId.current = latest.id
        }
      } catch (e) {
        console.error('Mail poll error:', e)
      }
    }

    checkNewMail()
    const interval = setInterval(checkNewMail, 15000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  useEffect(() => {
    if (active === 'inbox') {
      fetchUnreadCount()
    }
  }, [active, fetchUnreadCount])

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

      function handleLogout() {
    const idToken = window.memoryStorage.getItem('caspmail_id_token')
    const clientId = window.memoryStorage.getItem('caspmail_client_id') || 'caspermail-web'
    window.memoryStorage.clear()
    const params = new URLSearchParams({ client_id: clientId, post_logout_redirect_uri: window.location.origin + '/console/login' })
    if (idToken && idToken !== 'null' && idToken !== 'undefined') params.set('id_token_hint', idToken)
    const ISSUER = window.__CASPERMAIL_CONFIG__?.keycloakIssuer || 'https://auth.caspmail.com/realms/caspermail'
    window.location.href = `${ISSUER}/protocol/openid-connect/logout?${params.toString()}`
  }

  const roles = userRole === 'Admin' || userRole === 'SOC Analyst' || userRole === 'SOC Manager'
  const customFolders = folders
  

  return (
    <div className="mail-shell">
      {/* Sidebar */}
      <aside className="mail-sidebar">
        <div className="mail-brand">
          <Mail size={18} className="mail-brand-icon" />
          <span className="mail-brand-name">CaspMail</span>
        </div>

        <nav className="mail-nav">
          {NAV.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`mail-nav-item${active === item.id ? ' active' : ''}`}
                onClick={() => setActive(item.id)}
                onDragEnter={(e) => e.preventDefault()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                onDrop={(e) => {
                  try {
                    e.preventDefault();
                    e.currentTarget.classList.remove('drag-over');
                    const payload = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
                    if (!payload) {
                      setToasts(prev => [...prev, { id: Date.now(), message: "Drag failed: payload vuoto" }]);
                      return;
                    }
                    const ids = payload.split(',');
                    const token = window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token');
                    if (!token) throw new Error("Token mancante");
                    
                    if (item.id === 'trash') {
                      fetch('/api/e2ee/messages/bulk/trash', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ ids })
                      }).then(r => {
                          if(!r.ok) throw new Error("Server error " + r.status);
                          setRefreshTrigger(t => t + 1);
                      }).catch(err => setToasts(prev => [...prev, { id: Date.now(), message: err.toString() }]));
                    } else {
                      let flags = {};
                      if (item.id === 'inbox') {
                          flags = { archived: false, spam: false, folder_id: null };
                      } else if (item.id === 'archive') {
                          flags = { archived: true, spam: false, folder_id: null };
                      } else if (item.id === 'spam') {
                          flags = { spam: true, archived: false, folder_id: null };
                      } else if (item.id === 'important') {
                          flags = { important: true };
                      }
                      fetch('/api/e2ee/messages/bulk/flags', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ ids, flags })
                      }).then(r => {
                          if(!r.ok) throw new Error("Server error " + r.status);
                          setRefreshTrigger(t => t + 1);
                      }).catch(err => setToasts(prev => [...prev, { id: Date.now(), message: err.toString() }]));
                    }
                  } catch (err) {
                    setToasts(prev => [...prev, { id: Date.now(), message: err.toString() }]);
                  }
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <Icon size={15} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'inbox' && unreadCount > 0 && (
                  <div className="mail-nav-badge">{unreadCount}</div>
                )}
              </button>
            )
          })}
          
          <div className="mail-nav-section">
            <div className="mail-nav-section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px'}}>
              <span className="mail-nav-section-title" style={{margin: 0}}>Folders</span>
              <button className="mail-icon-btn" onClick={() => {
                const name = prompt('Nome della nuova cartella:');
                if (name) {
                  fetch('/api/e2ee/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))}` },
                    body: JSON.stringify({ name })
                  }).then(r => r.json()).then(d => {
                    if (d.id) setFolders([...folders, d]);
                  });
                }
              }}>
                <Plus size={14} />
              </button>
            </div>
            {customFolders.map(f => (
              <div key={f.id} className={`mail-nav-item${active === f.id ? ' active' : ''}`} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}} onClick={() => setActive(f.id)}
 onDragEnter={(e) => e.preventDefault()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
 onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
 onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  const payload = e.dataTransfer.getData('text/plain');
                  if (!payload) return;
                  const ids = payload.split(',');
                  const token = window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token');
                  
                  fetch('/api/e2ee/messages/bulk/flags', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ ids, flags: { folder_id: f.id, archived: false, spam: false } })
                  }).then(() => setRefreshTrigger(t => t + 1));
                }}
 >
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <Folder size={14} color={f.color || '#888'} />
                  <span>{f.name}</span>
                </div>
                <button className="mail-icon-btn" style={{padding: '4px'}} onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Vuoi eliminare la cartella?')) {
                    fetch(`/api/e2ee/folders/${f.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${(window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))}` }
                    }).then(() => {
                      setFolders(folders.filter(x => x.id !== f.id));
                      if (active === f.id) setActive('inbox');
                    });
                  }
                }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </nav>

        <div className="mail-sidebar-footer">
          {roles && (
            <a href="/console/soc" className="mail-footer-link">
              <ShieldCheck size={13} /> SOC Dashboard
            </a>
          )}
          {userRole === 'Admin' && (
            <a href="/console/admin" className="mail-footer-link">
              <Settings size={13} /> Admin Dashboard
            </a>
          )}
          <div className="mail-user-info">
            <div className="mail-user-avatar"><User size={12} /></div>
            <div className="mail-user-meta">
              <span className="mail-user-name">{userName}</span>
              <span className="mail-user-email">{userEmail}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="mail-main">
        {/* Topbar */}
        <header className="mail-topbar">
          <div className="mail-topbar-left">
            <h1 className="mail-topbar-title">
              {NAV.find(n => n.id === active)?.label || folders.find(f => f.id === active)?.name || 'Mail'}
            </h1>
            {keyPair && (
              <div className="mail-e2ee-badge">
                <ShieldCheck size={11} />
                E2EE Active
              </div>
            )}
          </div>
          <div className="mail-topbar-right">
            <div className="mail-user-menu" ref={dropRef}>
              <button className="mail-user-btn" onClick={() => setUserOpen(v => !v)}>
                <div className="mail-avatar"><User size={13} /></div>
                <span className="mail-user-btn-name">{userName}</span>
                <ChevronDown size={13} className={`mail-chevron${userOpen ? ' open' : ''}`} />
              </button>
              {userOpen && (
                <div className="mail-dropdown">
                  <div className="mail-dropdown-header">
                    <p className="mail-dropdown-name">{userName}</p>
                    <p className="mail-dropdown-role">{userRole}</p>
                  </div>
                  <div className="mail-dropdown-divider" />
                  {roles && (
                    <a href="/console/soc" className="mail-dropdown-item">
                      <ShieldCheck size={13} /> SOC Dashboard
                    </a>
                  )}
                  {userRole === 'Admin' && (
                    <a href="/console/admin" className="mail-dropdown-item">
                      <Settings size={13} /> Admin Dashboard
                    </a>
                  )}
                  <button className="mail-dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mail-content">
          {renderWorkspace(active, keyPair, setKeyPair, refreshTrigger, handleCompose, composeData, handleRead, folders)}
        </main>
      </div>
      
      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="mail-toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className="mail-toast">
              <div className="mail-toast-content">
                <Mail size={16} />
                <span>{toast.message}</span>
              </div>
              <button className="mail-toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}




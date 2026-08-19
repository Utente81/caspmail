import React from 'react'
import { Mail, Lock, Star } from 'lucide-react'

function TimeAgo({ iso }) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return <span>just now</span>
  if (mins < 60) return <span>{mins}m ago</span>
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return <span>{hrs}h ago</span>
  return <span>{d.toLocaleDateString()}</span>
}

export default function MessageList({ messages, onSelect, selected, folder, checkedIds, setCheckedIds }) {
  if (!messages.length) {
    return (
      <div className="mail-empty">
        <Mail size={36} className="mail-empty-icon" />
        <p>{folder === 'trash' ? 'Trash is empty' : folder === 'sent' ? 'No sent messages' : 'Inbox is empty'}</p>
      </div>
    )
  }
  return (
    <ul className="mail-msg-list">
      {messages.map(msg => (
        <li
          key={msg.id}
          className={`mail-msg-item${selected?.id === msg.id ? ' selected' : ''}${(!msg.read_at && folder === 'inbox') ? ' unread' : ''}`}
          onClick={() => onSelect(msg)}
          draggable={true}
          onDragStart={(e) => {
            if (checkedIds.has(msg.id)) {
              e.dataTransfer.setData('text/plain', Array.from(checkedIds).join(','));
            } else {
              e.dataTransfer.setData('text/plain', String(msg.id));
            }
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          <input type="checkbox" onClick={(e) => e.stopPropagation()} onChange={(e) => { const newIds = new Set(checkedIds); if (e.target.checked) newIds.add(msg.id); else newIds.delete(msg.id); setCheckedIds(newIds); }} checked={checkedIds.has(msg.id)} style={{marginRight: '12px'}} /><div className="mail-msg-from">{folder === 'sent' ? `To: ${msg.to_email}` : `From: ${msg.from_email}`}</div>
          <div className="mail-msg-meta">
            <span className="mail-msg-subject">
              {(msg?.recipient_flags?.important || msg?.sender_flags?.important) && <Star size={12} fill="#fbbf24" color="#fbbf24" style={{marginRight: '4px'}} />}
              <Lock size={10} className="mail-lock-icon" />
              Encrypted
            </span>
            <TimeAgo iso={msg.created_at} />
          </div>
        </li>
      ))}
    </ul>
  )
}

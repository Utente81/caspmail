import React from 'react'
import { AlertOctagon, ShieldCheck } from 'lucide-react'

export default function Phished() {
  return (
    <div style={{
      minHeight: '100vh', background: '#060b14', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '20px'
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid #1e293b',
        borderRadius: 16, width: 600, maxWidth: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '30px 40px', background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid #ef444433', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ background: '#ef4444', color: '#fff', padding: 15, borderRadius: '50%' }}>
            <AlertOctagon size={36} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#f8fafc' }}>Oops! You've been phished.</h1>
            <p style={{ margin: '5px 0 0 0', color: '#fca5a5', fontSize: '0.9rem' }}>
              This was a simulated phishing attack conducted by your SOC team.
            </p>
          </div>
        </div>

        <div style={{ padding: '40px', lineHeight: 1.6 }}>
          <p>You clicked on a link in a simulated phishing email. In a real-world scenario, this action could have compromised your account or installed malware on your device.</p>
          
          <h3 style={{ marginTop: '25px', marginBottom: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} style={{ color: '#3b82f6' }} /> How to spot phishing emails
          </h3>
          
          <ul style={{ paddingLeft: '20px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li><strong>Check the sender address carefully:</strong> Attackers often spoof email addresses or use domains that look similar to legitimate ones (e.g., support@acme-corp.com instead of support@acme.com).</li>
            <li><strong>Look for urgency or threats:</strong> Phishing emails often create a false sense of urgency, pressuring you to act immediately (e.g., " Your password will expire in 2 hours\).</li>
 <li><strong>Hover before you click:</strong> Hover over links without clicking to see the actual destination URL at the bottom of your browser or mail client.</li>
 <li><strong>Use the \Report Phishing\ button:</strong> If you're unsure, always use the built-in reporting button in CaspMail to notify the SOC team.</li>
 </ul>

 <div style={{ marginTop: '40px', padding: '20px', background: '#0b1121', border: '1px solid #1e293b', borderRadius: '8px', textAlign: 'center' }}>
 <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
 Your response has been recorded. This exercise helps us improve our organization's security posture.
 </p>
 </div>

 <button 
 onClick={() => window.location.href = '/console/'}
 style={{
 marginTop: '30px', padding: '12px 24px', borderRadius: '6px',
 background: '#3b82f6', color: '#fff', border: 'none',
 cursor: 'pointer', fontWeight: 600, width: '100%', fontSize: '1rem'
 }}
 >
 Return to Inbox
 </button>
 </div>
 </div>
 </div>
 )
}

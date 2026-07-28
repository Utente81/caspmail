import React from 'react'
import MailApp from './mail/MailApp'
import Phished from './mail/workspaces/Phished'

export default function App() {
  if (window.location.pathname === '/phished') {
    return <Phished />
  }
  return <MailApp />
}

import React, { useState } from 'react';
import { generateCorporateMasterKey, unlockCorporateMasterKey } from '../../mail/crypto.js';

export default function SOCEDiscovery() {
  const [shares, setShares] = useState(['', '', '']);
  const [unlockedKey, setUnlockedKey] = useState(null);
  const [setupMode, setSetupMode] = useState(false);
  const [generatedShares, setGeneratedShares] = useState(null);

  async function handleSetup() {
    try {
      const { publicKeyPem, shares } = await generateCorporateMasterKey(3, 2);
      setGeneratedShares(shares);
      alert('Master Key generated! Save these shares securely.');
      // TODO: send publicKeyPem to backend
    } catch(e) {
      alert('Error: ' + e.message);
    }
  }

  async function handleUnlock() {
    try {
      const validShares = shares.filter(s => s.trim() !== '');
      if (validShares.length < 2) {
        alert('You need at least 2 shares to unlock the Master Key');
        return;
      }
      const masterKey = await unlockCorporateMasterKey(validShares);
      setUnlockedKey(masterKey);
      alert('Master Key successfully reconstructed in memory!');
    } catch(e) {
      alert('Error unlocking: ' + e.message);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-100 mb-6">eDiscovery & Key Escrow</h2>

      {setupMode ? (
        <div className="bg-gray-800 p-6 rounded-lg mb-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">Setup Corporate Master Key</h3>
          <button onClick={handleSetup} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold">
            Generate Master Key (Shamir 2-of-3)
          </button>
          
          {generatedShares && (
            <div className="mt-6">
              <p className="text-yellow-400 font-semibold mb-2">WARNING: The private key has been destroyed. Store these 3 shares securely. You will need at least 2 of them to perform eDiscovery.</p>
              {generatedShares.map((s, i) => (
                <div key={i} className="mb-2">
                  <label className="text-gray-400 block mb-1">Share {i+1}</label>
                  <input readOnly value={s} className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 p-6 rounded-lg mb-6 border border-gray-700">
           <h3 className="text-xl font-semibold text-white mb-4">Unlock Master Key for eDiscovery</h3>
           <p className="text-gray-400 mb-4">Enter at least 2 of the 3 Shamir Shares (Dual Control: CEO + Admin) to reconstruct the Corporate Master Key in memory.</p>
           
           <div className="space-y-4 mb-6">
             <input type="password" placeholder="Share 1 (CEO)" className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded" value={shares[0]} onChange={e => { const newS = [...shares]; newS[0] = e.target.value; setShares(newS); }} />
             <input type="password" placeholder="Share 2 (Admin)" className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded" value={shares[1]} onChange={e => { const newS = [...shares]; newS[1] = e.target.value; setShares(newS); }} />
             <input type="password" placeholder="Share 3 (DPO)" className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded" value={shares[2]} onChange={e => { const newS = [...shares]; newS[2] = e.target.value; setShares(newS); }} />
           </div>

           <button onClick={handleUnlock} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-bold">
             Reconstruct Key in Memory
           </button>
           <button onClick={() => setSetupMode(true)} className="ml-4 text-gray-500 hover:text-white">
             Or Setup New Key
           </button>
        </div>
      )}

      {unlockedKey && (
        <div className="bg-green-900 p-6 rounded-lg border border-green-700 mt-6">
          <h3 className="text-xl font-semibold text-white mb-4">Master Key Active ??</h3>
          <p className="text-green-300">You can now search and decrypt employee emails for eDiscovery.</p>
        </div>
      )}
    </div>
  );
}

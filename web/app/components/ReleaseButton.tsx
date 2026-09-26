'use client';

import { IDKitWidget, VerificationLevel, ISuccessResult } from '@worldcoin/idkit';
import { useState } from 'react';

export default function ReleaseButton({ recordId }: { recordId: string }) {
  const [status, setStatus] = useState<string>('');

  const handleVerify = async (proof: ISuccessResult) => {
    setStatus('Verifying with server...');
    const res = await fetch('/api/world/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        proof, 
        action: process.env.NEXT_PUBLIC_WLD_ACTION || 'release-record', 
        signal: recordId 
      }),
    });
    
    if (res.ok) {
      setStatus('Success: Record is now Approved.');
    } else {
      setStatus('Failed: Verification denied.');
      throw new Error('Verification failed'); 
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <IDKitWidget
        app_id={(process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}`) || ''}
        action={process.env.NEXT_PUBLIC_WLD_ACTION || 'release-record'}
        signal={recordId}
        onSuccess={() => console.log('Verification finished')}
        handleVerify={handleVerify}
        verification_level={VerificationLevel.Device}
      >
        {({ open }) => (
          <button 
            onClick={open}
            className="bg-black text-white px-4 py-2 rounded-md font-medium"
          >
            Release (Verify with World ID)
          </button>
        )}
      </IDKitWidget>
      {status && <p className="mt-2 text-sm text-gray-700">{status}</p>}
    </div>
  );
}

import React, { useState } from 'react';
import { BrandMark } from './BrandMark';
export interface LoginScreenProps {
  pending: boolean;
  error: string | null;
  onSubmit: (username: string, password: string) => Promise<void>;
  design?: boolean;
}
export function LoginScreen({ pending, error, onSubmit, design = false }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  return <main className="min-h-screen flex items-center justify-center px-5 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
    <form className="w-full max-w-sm p-6 rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-5"
      onSubmit={async event => { event.preventDefault(); if (!pending) { try { await onSubmit(username, password); } finally { setPassword(''); } } }}>
      <div className="flex items-center gap-3"><BrandMark size="lg"/><h1 className="text-xl font-semibold">Welcome to Mroya</h1></div>
      <p className="text-sm text-[var(--mroya-text-muted)]">{design ? 'Design preview. Use fictional credentials only.' : 'Sign in to your personal space.'}</p>
      <label className="block text-sm">Username<input name="username" autoComplete={design ? 'off' : 'username'} required value={username} onChange={e => setUsername(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3 py-2"/></label>
      <label className="block text-sm">Password<input name="password" type="password" autoComplete={design ? 'off' : 'current-password'} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3 py-2"/></label>
      {error && <p role="alert" className="text-sm text-[var(--mroya-error)]">{error}</p>}
      <button disabled={pending} className="w-full rounded-full py-2.5 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] disabled:opacity-50">{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>;
}

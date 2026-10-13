import React, { useState } from 'react';
import { BrandMark } from './BrandMark';

export interface LoginScreenProps {
  pending: boolean;
  error: string | null;
  onSubmit: (username: string, password: string) => Promise<void>;
  onGoogleSignIn?: () => Promise<void> | void;
  design?: boolean;
  embedded?: boolean;
}

export function LoginScreen({ pending, error, onSubmit, onGoogleSignIn, design = false, embedded = false }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [googlePending, setGooglePending] = useState(false);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (pending || googlePending) return;
    if (onGoogleSignIn) {
      setGooglePending(true);
      setGoogleNotice(null);
      try {
        await onGoogleSignIn();
      } catch (err) {
        setGoogleNotice(err instanceof Error ? err.message : 'Google authorization failed');
      } finally {
        setGooglePending(false);
      }
    } else {
      setGoogleNotice(
        design
          ? 'Google sign-in is unavailable in this preview.'
          : 'Google sign-in is not configured on this server.'
      );
    }
  };

  return (
    <main className={`${embedded ? "py-5" : "min-h-screen"} flex items-center justify-center px-5 bg-[var(--mroya-bg)] text-[var(--mroya-text)]`}>
      <form
        className="w-full max-w-sm p-6 rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!pending && !googlePending) {
            try {
              await onSubmit(username, password);
            } finally {
              setPassword('');
            }
          }
        }}
      >
        <div className="flex items-center gap-3">
          <BrandMark size="lg" />
          <h1 className="text-xl font-semibold">Welcome to Mroya</h1>
        </div>
        <p className="text-sm text-[var(--mroya-text-muted)]">
          {design ? 'Design preview. Use fictional credentials only.' : 'Sign in to your personal space.'}
        </p>

        {/* Google Authentication Section */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={pending || googlePending || !onGoogleSignIn}
            aria-describedby="google-availability"
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] active:scale-[0.99] text-sm font-medium text-[var(--mroya-text)] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            aria-label="Sign in with Google"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{googlePending ? 'Connecting to Google…' : 'Sign in with Google'}</span>
          </button>
        </div>

        {!onGoogleSignIn && <p id="google-availability" className="text-xs text-[var(--mroya-text-muted)] text-center">Google sign-in — coming soon.</p>}
        {/* Separator */}
        <div className="relative flex items-center justify-center">
          <div className="grow border-t border-[var(--mroya-divider)]" />
          <span className="shrink-0 px-3 text-xs uppercase tracking-wider text-[var(--mroya-text-muted)] bg-[var(--mroya-surface)]">
            or
          </span>
          <div className="grow border-t border-[var(--mroya-divider)]" />
        </div>

        <label className="block text-sm">
          Username
          <input
            autoFocus={embedded}
            name="username"
            autoComplete={design ? 'off' : 'username'}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3 py-2 text-sm text-[var(--mroya-text)] focus:outline-none focus:ring-1 focus:ring-[var(--mroya-primary)]"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete={design ? 'off' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3 py-2 text-sm text-[var(--mroya-text)] focus:outline-none focus:ring-1 focus:ring-[var(--mroya-primary)]"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-[var(--mroya-error)]">
            {error}
          </p>
        )}
        {googleNotice && (
          <p role="status" className="text-xs text-[var(--mroya-text-muted)] text-center">
            {googleNotice}
          </p>
        )}
        <button
          disabled={pending || googlePending}
          className="w-full rounded-full py-2.5 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-medium text-sm disabled:opacity-50 hover:bg-[var(--mroya-primary-hover)] active:scale-[0.99] transition-all cursor-pointer"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

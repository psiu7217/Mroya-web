export class ApiError extends Error {
  readonly status:number;
  readonly code:string;
  readonly fields?:Record<string,unknown>;
  constructor(status:number,code:string,message:string,fields?:Record<string,unknown>) { super(message); this.name='ApiError';this.status=status;this.code=code;this.fields=fields; }
}
export class StreamInterruptedError extends Error {
  constructor() { super('The response stream was interrupted. Reload turn/history before retrying the same submission.');this.name='StreamInterruptedError'; }
}

export const GOOGLE_AUTH_ERRORS: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: 'Google sign-in failed. Please try again.',
  google_account_conflict: 'An account with this email already exists. Please use its existing sign-in method.',
  google_already_authenticated: 'You are already signed in.',
};

export function readAndClearAuthError(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('auth_error');
    if (!code) return null;
    params.delete('auth_error');
    const query = params.toString();
    const cleanUrl = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    window.history.replaceState(window.history.state, '', cleanUrl);
    return Object.hasOwn(GOOGLE_AUTH_ERRORS, code) ? GOOGLE_AUTH_ERRORS[code] : null;
  } catch {
    return null;
  }
}

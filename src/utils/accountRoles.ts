import type {AccountRole} from '../types/api';

// Account roles control Mroya product features, not Django admin permissions.
// Unknown/missing role data is treated as free to fail closed for developer UI.
const RANK: Record<AccountRole,number> = {free:0,premium:1,admin:2};

export function hasAccountRole(role:AccountRole|undefined, minimum:AccountRole):boolean {
  return RANK[role ?? 'free'] >= RANK[minimum];
}

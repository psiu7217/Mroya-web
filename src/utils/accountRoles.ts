import type {AccountRole} from '../types/api';

// Account roles control Mroya product features, not Django admin permissions.
// Unknown/missing role data is treated as free to fail closed for developer UI.
const RANK: Record<AccountRole,number> = {free:0,premium:1,admin:2};

export function hasAccountRole(role:AccountRole|undefined, minimum:AccountRole):boolean {
  const rank = role && Object.hasOwn(RANK, role) ? RANK[role] : RANK.free;
  return rank >= RANK[minimum];
}

export type ProductFeature = 'google_calendar'|'technical_diagnostics'|'experimental_features'|'reminders';
const FEATURE_MINIMUM: Record<ProductFeature,AccountRole> = {google_calendar:'admin',technical_diagnostics:'admin',experimental_features:'admin',reminders:'admin'};
export function hasFeature(role:AccountRole|undefined, feature:ProductFeature):boolean {
  return hasAccountRole(role, FEATURE_MINIMUM[feature]);
}

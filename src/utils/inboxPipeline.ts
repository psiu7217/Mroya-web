import type {PipelineEventItem,PipelineStats} from '../types/inboxPipeline';
export function computePipelineStats(items: PipelineEventItem[]): PipelineStats {
  return {
    totalDetected: items.length,
    pendingCheck: items.filter(e => e.status === 'pending_check').length,
    fastApproved: items.filter(e => e.fastFilter.decision === 'APPROVE').length,
    fastRejected: items.filter(e => e.status === 'fast_rejected').length,
    inDeepQueue: items.filter(e => e.status === 'in_queue').length,
    awaitingConfirmation: items.filter(e => e.status === 'awaiting_confirmation').length,
    committed: items.filter(e => e.status === 'committed').length,
    userDeclined: items.filter(e => e.status === 'declined').length,
  };
}

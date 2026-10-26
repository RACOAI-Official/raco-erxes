// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import { handleTrigger } from '../executions/handleTrigger';
import type { Job } from 'bullmq';
import { debugError } from '../debugger';
import { IJobData } from './initMQWorkers';

// Type for trigger job data
interface ITriggerData {
  type: string;
  actionType: string;
  targets: unknown[]; // Replace with actual type if known
  recordType?: string;
  repeatOptions?: {
    executionId: string;
    actionId: string;
    optionalConnectId?: string;
  };
}

// Final job interfaces
type ITriggerJobData = IJobData<ITriggerData>;

export const triggerHandlerWorker = async (job: Job<ITriggerJobData>) => {
  const { subdomain, data } = job?.data ?? {};

  try {
    await handleTrigger(subdomain, data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    debugError(`Error processing job ${job.id}: ${message}`);
    // Error is logged but not thrown to prevent job retries
  }
};

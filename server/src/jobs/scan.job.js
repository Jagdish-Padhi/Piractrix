import { runPerceptionScheduling } from '../agents/perception.agent.js';

export async function runScheduledScanJob() {
  // Use perception agent to decide which assets to scan this run
  const result = await runPerceptionScheduling();
  return { status: 'queued', count: result.scheduled };
}

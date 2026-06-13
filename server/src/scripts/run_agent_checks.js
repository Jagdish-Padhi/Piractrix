import 'dotenv/config';
import { connectDatabase } from '../config/database.js';
import Organization from '../models/organization.model.js';
import * as AgentService from '../services/agent.service.js';

async function run() {
  try {
    await connectDatabase();

    const org = await Organization.findOneAndUpdate(
      { email: 'demo@local' },
      { orgName: 'Demo Org', email: 'demo@local', passwordHash: 'DEMO_HASH' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const orgId = org._id;

    const status = await AgentService.getAgentStatus(orgId);
    console.log('Agent status:', status);

    const stats = await AgentService.getStats({ orgId });
    console.log('Agent stats:', stats);

    process.exit(0);
  } catch (err) {
    console.error('Agent checks failed:', err);
    process.exit(1);
  }
}

run();

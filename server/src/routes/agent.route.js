import { Router } from 'express';
import * as AgentController from '../controllers/agent.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = Router();

// protect all agent endpoints
router.use(verifyToken);

router.get('/status', AgentController.getStatus);
router.get('/decisions', AgentController.listDecisions);
router.get('/decisions/:id', AgentController.getDecision);
router.get('/threat-memory', AgentController.listThreatMemory);
router.patch('/mode', AgentController.setMode);
router.post('/approve/:decisionId', AgentController.approveDecision);
router.get('/stats', AgentController.getStats);

export default router;

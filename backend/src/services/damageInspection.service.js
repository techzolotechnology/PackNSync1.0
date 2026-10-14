import { prisma } from '../utils/prisma.js';
import { prepareEvidence } from './inspectionImage.js';
import { createInspectionWorkflow } from '../../../Damage AI Inspection/workflow.js';
export const damageInspectionService = createInspectionWorkflow({ db: prisma, prepareEvidence });

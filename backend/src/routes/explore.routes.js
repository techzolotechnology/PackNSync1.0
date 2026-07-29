import { Router } from 'express';
import {
    chatExplore,
    clearExploreChat,
    getExploreChat,
    getExploreExamples,
    getExploreStatus,
    searchExplore,
} from '../controllers/explore.controller.js';
import {
    deleteExplorePlan,
    deleteExplorePlanStop,
    generateExplorePlan,
    getExplorePlan,
    getExplorePlannerMeta,
    listExplorePlans,
    regenerateExplorePlan,
    saveExplorePlan,
    updateExplorePlan,
    updateExplorePlanStop,
} from '../controllers/explorePlan.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const exploreRouter = Router();

exploreRouter.get('/examples', getExploreExamples);
exploreRouter.get('/status', getExploreStatus);
exploreRouter.get('/planner/meta', getExplorePlannerMeta);
exploreRouter.post('/search', searchExplore);
exploreRouter.post('/chat', chatExplore);
exploreRouter.post('/chat/clear', clearExploreChat);
exploreRouter.get('/chat/:sessionId', getExploreChat);

exploreRouter.get('/plans', authenticate, listExplorePlans);
exploreRouter.post('/plans/generate', authenticate, generateExplorePlan);
exploreRouter.get('/plans/:id', authenticate, getExplorePlan);
exploreRouter.put('/plans/:id', authenticate, updateExplorePlan);
exploreRouter.post('/plans/:id/regenerate', authenticate, regenerateExplorePlan);
exploreRouter.post('/plans/:id/save', authenticate, saveExplorePlan);
exploreRouter.delete('/plans/:id', authenticate, deleteExplorePlan);
exploreRouter.patch('/plans/:id/stops/:stopId', authenticate, updateExplorePlanStop);
exploreRouter.delete('/plans/:id/stops/:stopId', authenticate, deleteExplorePlanStop);

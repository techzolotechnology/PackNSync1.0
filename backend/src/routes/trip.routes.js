import { Router } from 'express';
import {
    getTrips, getMyOrganizedTrips, getCoverSuggestions, getTripById, getTripCarSuggestions,
    createTrip, updateTrip, deleteTrip,
    requestToJoin, updateMemberStatus, leaveTrip,
    createAnnouncement, deleteAnnouncement, getTripMessages, getChatUnread, markTripChatRead,
} from '../controllers/trip.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';

export const tripRouter = Router();

tripRouter.get('/', getTrips);
tripRouter.get('/mine', authenticate, getMyOrganizedTrips);
tripRouter.get('/cover-suggestions', authenticate, getCoverSuggestions);
tripRouter.get('/chat-unread', authenticate, getChatUnread);
tripRouter.get('/:id/car-suggestions', optionalAuth, getTripCarSuggestions);
tripRouter.get('/:id/messages', authenticate, getTripMessages);
tripRouter.post('/:id/messages/read', authenticate, markTripChatRead);
tripRouter.get('/:id', getTripById);
tripRouter.post('/', authenticate, createTrip);
tripRouter.put('/:id', authenticate, updateTrip);
tripRouter.delete('/:id', authenticate, deleteTrip);
tripRouter.post('/:id/join', authenticate, requestToJoin);
tripRouter.post('/:id/leave', authenticate, leaveTrip);
tripRouter.put('/:id/members/:userId', authenticate, updateMemberStatus);
tripRouter.post('/:id/announcements', authenticate, createAnnouncement);
tripRouter.delete('/:id/announcements/:announcementId', authenticate, deleteAnnouncement);

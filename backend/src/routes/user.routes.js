import { Router } from 'express';
import { getUserById, updateUser, deleteUser, getUserTrips, uploadAvatar, getMyReferral } from '../controllers/user.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { vehicleImageUpload } from '../middleware/vehicleUpload.middleware.js';

import { businessRouter } from './rentalBusiness.routes.js';

export const userRouter = Router();
userRouter.use('/me/business', authenticate, businessRouter);

userRouter.post('/avatar', authenticate, vehicleImageUpload.single('image'), uploadAvatar);
userRouter.get('/me/referral', authenticate, getMyReferral);
userRouter.get('/:id', optionalAuth, getUserById);
userRouter.get('/:id/trips', optionalAuth, getUserTrips);
userRouter.put('/:id', authenticate, updateUser);
userRouter.delete('/:id', authenticate, deleteUser);

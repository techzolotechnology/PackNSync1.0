import { Router } from 'express';
import { getUserById, updateUser, deleteUser, getUserTrips, uploadAvatar } from '../controllers/user.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { vehicleImageUpload } from '../middleware/vehicleUpload.middleware.js';

export const userRouter = Router();

userRouter.post('/avatar', authenticate, vehicleImageUpload.single('image'), uploadAvatar);
userRouter.get('/:id', optionalAuth, getUserById);
userRouter.get('/:id/trips', getUserTrips);
userRouter.put('/:id', authenticate, updateUser);
userRouter.delete('/:id', authenticate, deleteUser);

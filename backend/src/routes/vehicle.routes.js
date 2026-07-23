import { Router } from 'express';
import {
    registerVehicle,
    getMyVehicles,
    getVehicleById,
    updateVehicle,
    deleteVehicle,
    uploadVehicleImage,
} from '../controllers/vehicle.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { vehicleImageUpload } from '../middleware/vehicleUpload.middleware.js';

export const vehicleRouter = Router();

vehicleRouter.post('/upload-image', authenticate, vehicleImageUpload.single('image'), uploadVehicleImage);
vehicleRouter.post('/', authenticate, registerVehicle);
vehicleRouter.get('/my', authenticate, getMyVehicles);
vehicleRouter.get('/:id', authenticate, getVehicleById);
vehicleRouter.put('/:id', authenticate, updateVehicle);
vehicleRouter.delete('/:id', authenticate, deleteVehicle);

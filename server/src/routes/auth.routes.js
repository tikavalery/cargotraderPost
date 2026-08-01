import { Router } from 'express';
import { protect, attachUser } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimits.js';
import * as auth from '../controllers/authController.js';

const router = Router();

router.use(authRateLimiter);

router.post('/register', auth.registerValidators, auth.register);
router.post('/login', auth.loginValidators, auth.login);
router.get('/google/config', auth.googleConfig);
router.post('/google', auth.googleAuth);
router.post('/forgot-password', auth.forgotPasswordValidators, auth.forgotPassword);
router.get('/reset-password/:token', auth.validateResetToken);
router.post('/reset-password', auth.resetPasswordValidators, auth.resetPassword);
router.post('/refresh', auth.refresh);

router.get('/me', protect, attachUser, auth.me);
router.post('/logout', protect, attachUser, auth.logout);

export default router;

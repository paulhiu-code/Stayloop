import express from 'express';
import {
  confirmBookingPayment,
  createConnectAccount,
  createOnboardingLink,
  createPaymentIntent,
  getAccountStatus,
  releaseBookingPayout,
} from '../server/handlers/payments.js';

const router = express.Router();

function requireUser(req, res, next) {
  const userId = req.user?.id;
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ error: 'Authenticated user is required' });
  }
  return next();
}

function handle(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  };
}

router.post(
  '/api/stripe/connect/create-account',
  requireUser,
  handle((req) => createConnectAccount(req.user))
);

router.post(
  '/api/stripe/connect/create-onboarding-link',
  requireUser,
  handle((req) => createOnboardingLink(req.user, req.body))
);

router.get(
  '/api/stripe/connect/account-status',
  requireUser,
  handle((req) => getAccountStatus(req.user, req.query.accountId))
);

router.post(
  '/api/bookings/create-payment-intent',
  requireUser,
  handle((req) => createPaymentIntent(req.user, req.body))
);

router.post(
  '/api/bookings/:bookingId/confirm-payment',
  requireUser,
  handle((req) => confirmBookingPayment(req.user, req.params.bookingId, req.body.paymentIntentId))
);

router.post(
  '/api/bookings/:bookingId/release-payout',
  requireUser,
  handle((req) => releaseBookingPayout(req.user, req.params.bookingId))
);

export default router;

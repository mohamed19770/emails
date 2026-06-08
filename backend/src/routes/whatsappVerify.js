import express from 'express';
import { verifyWhatsAppNumber, getWhatsAppVerificationStatus } from '../services/phones/whatsappVerify.js';

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({ success: true, ...getWhatsAppVerificationStatus() });
});

router.post('/check', async (req, res) => {
  const { e164, phone } = req.body;
  const target = e164 || phone;
  if (!target) {
    return res.status(400).json({ success: false, error: 'e164 or phone required' });
  }

  const result = await verifyWhatsAppNumber(target);
  res.json({ success: true, e164: target, ...result });
});

export default router;

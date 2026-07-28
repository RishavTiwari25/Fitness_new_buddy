/**
 * =============================================
 * STRIPE PAYMENTS (payments_stripe.js)
 * =============================================
 * Real membership payments via Stripe Checkout (replaces the mock flow).
 *  - POST /api/payments/stripe/create-checkout-session  (auth) -> { url }
 *  - POST /api/payments/stripe/webhook                  (raw body, wired in index.js)
 *
 * Records a payment + rolls the membership due date forward, mirroring the
 * existing mock/confirm logic (dual SQLite / MongoDB). Configure with:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET  (set in backend env; never commit)
 */
const express = require('express');
const db = require('../db');
const mongo = require('../lib/mongo');
const { toObjectId } = mongo;
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

let _stripe = null;
function stripe() {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return null;
  if (!_stripe) _stripe = require('stripe')(key);
  return _stripe;
}

// Record a successful payment (mirrors /payments/mock/confirm, method 'stripe').
function recordPayment(userId, amount, txnRef) {
  return new Promise((resolve, reject) => {
    if (mongo.isEnabled()) {
      (async () => {
        await mongo.connect();
        const uid = toObjectId(String(userId));
        const me = await mongo.collection('users').findOne({ _id: uid }, { projection: { gym_id: 1 } });
        const gymId = me?.gym_id || null;
        await mongo.collection('payments').insertOne({ user_id: uid, gym_id: gymId, amount: Number(amount), method: 'stripe', txn_ref: txnRef, created_at: new Date() });
        const mb = await mongo.collection('memberships').findOne({ user_id: uid });
        const base = mb?.next_due_date ? new Date(mb.next_due_date) : new Date();
        const newDue = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate()).toISOString().slice(0, 10);
        await mongo.collection('memberships').updateOne(
          { user_id: uid },
          { $set: { user_id: uid, gym_id: gymId, monthly_fee: mb?.monthly_fee || Number(amount), next_due_date: newDue } },
          { upsert: true }
        );
        resolve();
      })().catch(reject);
    } else {
      db.get('SELECT gym_id FROM users WHERE id = ?', [userId], (e, me) => {
        if (e) return reject(e);
        const gymId = me?.gym_id || null;
        db.serialize(() => {
          db.run("INSERT INTO payments (user_id, gym_id, amount, method, txn_ref) VALUES (?, ?, ?, 'stripe', ?)", [userId, gymId, Number(amount), txnRef]);
          db.run("UPDATE memberships SET next_due_date = date(COALESCE(next_due_date, date('now')), '+1 month') WHERE user_id = ?", [userId]);
        });
        resolve();
      });
    }
  });
}

router.post('/payments/stripe/create-checkout-session', verifyToken, async (req, res) => {
  const s = stripe();
  if (!s) return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the backend environment.' });
  const userId = req.user.id;
  const amount = Number(req.body?.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'A positive amount is required' });

  const origin = req.headers.origin || process.env.PUBLIC_URL || 'http://localhost:5173';
  try {
    const session = await s.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: (process.env.STRIPE_CURRENCY || 'inr').toLowerCase(),
          product_data: { name: 'Gym Membership Fee' },
          unit_amount: Math.round(amount * 100), // smallest currency unit
        },
        quantity: 1,
      }],
      metadata: { userId: String(userId), amount: String(amount) },
      success_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/?payment=cancelled`,
    });
    res.json({ url: session.url, id: session.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Raw-body webhook handler (mounted in index.js BEFORE express.json()).
async function webhookHandler(req, res) {
  const s = stripe();
  if (!s) return res.status(503).end();
  const whSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  let event;
  try {
    if (whSecret) {
      event = s.webhooks.constructEvent(req.body, req.headers['stripe-signature'], whSecret);
    } else {
      // Dev fallback with no signature verification — DO NOT use in production.
      event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body);
    }
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const sess = event.data.object;
    const userId = sess.metadata?.userId;
    const amount = Number(sess.metadata?.amount || (sess.amount_total ? sess.amount_total / 100 : 0));
    if (userId && amount) {
      try { await recordPayment(userId, amount, sess.payment_intent || sess.id); } catch (_) { /* logged upstream */ }
    }
  }
  res.json({ received: true });
}

module.exports = { router, webhookHandler };

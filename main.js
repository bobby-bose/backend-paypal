const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// -------------------- CONFIG --------------------
const CLIENT_ID = 'SU2509011920199571786178';
const CLIENT_VERSION = '1';
const CLIENT_SECRET = 'fbf66a20-f2fc-4df8-b21b-242f5de3d741';

// -------------------- UTILITY: GET ACCESS TOKEN --------------------
async function getAccessToken() {
  console.log('[AccessToken]: Generating new access token...');
  const body = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&client_version=${CLIENT_VERSION}&grant_type=client_credentials`;

  const tokenResponse = await axios.post(
    'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
    body,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  console.log('[AccessToken]: Access token received:', tokenResponse.data.access_token);
  return tokenResponse.data.access_token;
}

// -------------------- START PAYMENT AND CHECK STATUS --------------------
app.post('/api/start-payment', async (req, res) => {
  console.log('[StartPayment]: Request received', req.body);
  const { amount, userId } = req.body;

  if (!amount || !userId) {
    console.log('[StartPayment]: ERROR - Amount or UserId missing!');
    return res.status(400).json({ error: 'Amount and userId are required.' });
  }

  try {
    const accessToken = await getAccessToken();
    console.log('[StartPayment]: Access token obtained.');

    const merchantOrderId = "TX" + Date.now();
    console.log('[StartPayment]: Generated merchantOrderId:', merchantOrderId);

    const paymentBody = {
      merchantOrderId,
      amount: parseInt(amount, 10) * 100, // Amount in paise
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Payment for goods",
        merchantUrls: {
          redirectUrl: 'https://www.google.com/', // local redirect for testing
          callbackUrl: 'https://backend-paypal.onrender.com/payment-callback' // local callback
        }
      }
    };

    console.log('[StartPayment]: Payment body prepared:', paymentBody);

    // Initiate payment
    const redirectResponse = await axios.post(
      'https://api.phonepe.com/apis/pg/checkout/v2/pay',
      paymentBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        }
      }
    );

    const redirectUrl = redirectResponse.data.redirectUrl;
    console.log('[StartPayment]: Redirect URL received:', redirectUrl);

    // Immediately poll payment status
    console.log('[StartPayment]: Polling payment status...');
    const statusResponse = await axios.get(
      `https://api.phonepe.com/apis/pg/checkout/v2/order/${merchantOrderId}/status?details=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        }
      }
    );

    const orderData = statusResponse.data;
    console.log('[StartPayment]: Status response:', orderData);

    const isPaid = orderData.paymentDetails?.some(p => p.state === 'COMPLETED');
    console.log('[StartPayment]: Payment COMPLETED?', isPaid);

    res.json({
      merchantOrderId,
      redirectUrl,
      status: isPaid ? 'SUCCESS' : 'PENDING',
      rawData: orderData
    });

  } catch (error) {
    console.error('[StartPayment]: API call failed:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to complete API sequence' });
  }
});

// -------------------- LOCAL CALLBACK HANDLER (for PhonePe simulation) --------------------
// -------------------- WEBHOOK HANDLER --------------------
app.post('/payment-callback', async (req, res) => {
  const webhookData = req.body;
  console.log('[Webhook]: Data received from PhonePe:', webhookData);

  // Extract common info
  const eventType = webhookData.eventType; // The webhook event type
  const merchantOrderId = webhookData.merchantOrderId || webhookData.orderId;

  // Handle different events
  switch (eventType) {
    case 'pg.order.completed':
    case 'paylink.order.completed':
    case 'subscription.redemption.order.completed':
      console.log(`[Webhook]: Payment SUCCESS for order ${merchantOrderId} ✅`);
      // TODO: update your DB/order status here
      break;

    case 'pg.order.failed':
    case 'paylink.order.failed':
    case 'subscription.redemption.order.failed':
    case 'subscription.notification.failed':
    case 'settlement.attempt.failed':
      console.log(`[Webhook]: Payment FAILED for order ${merchantOrderId} ❌`);
      // TODO: update your DB/order status here
      break;

    default:
      console.log(`[Webhook]: Unhandled event type ${eventType}`);
  }

  // Respond to PhonePe
  res.status(200).send('Webhook received successfully');
});


// -------------------- LOCAL REDIRECT HANDLER --------------------
app.get('/redirect', (req, res) => {
  console.log('[Redirect]: Redirect called by PhonePe.');
  res.send('Payment redirect hit.');
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

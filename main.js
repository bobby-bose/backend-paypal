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
  const tokenResponse = await axios.post(
    'https://api.phonepe.com/apis/pg/identity-manager/v1/oauth/token',
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      client_version: CLIENT_VERSION,
      grant_type: 'client_credentials',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return tokenResponse.data.access_token;
}

// -------------------- START PAYMENT --------------------
app.post('/api/start-payment', async (req, res) => {
  const { amount, userId } = req.body;
  if (!amount || !userId) {
    return res.status(400).json({ error: 'Amount and userId are required.' });
  }

  try {
    const accessToken = await getAccessToken();

    const merchantOrderId = "TX" + Date.now();
    const paymentBody = {
      merchantOrderId,
      amount: parseInt(amount, 10) * 100, // Amount in PAISA
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Payment for goods",
        merchantUrls: {
          redirectUrl: 'https://www.google.com/',
          callbackUrl: 'https://backend-demo-payment-kqut.onrender.com/api/payment-callback'
        }
      }
    };

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
    res.json({ redirectUrl, merchantOrderId });

    console.log(`[Payment Initiation]: User ${userId} tried a payment of ${amount} rupees. Order ID: ${merchantOrderId}`);
  } catch (error) {
    console.error('API call failed:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to complete API sequence' });
  }
});

// -------------------- CALLBACK --------------------
app.post('/api/payment-callback', async (req, res) => {
  const paymentData = req.body;
  const merchantOrderId = paymentData?.merchantOrderId || paymentData?.orderId;

  console.log(`[Callback Received]: Order ID ${merchantOrderId}`);

  try {
    const accessToken = await getAccessToken();

    // ✅ Check payment status using production v2 API
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
    const isPaid = orderData.paymentDetails?.some(p => p.state === 'COMPLETED');

    if (isPaid) {
      console.log(`[Final Confirmation]: Order ${merchantOrderId} SUCCESS ✅`);
      // 👉 Update your DB: mark as paid
    } else {
      console.log(`[Final Confirmation]: Order ${merchantOrderId} FAILED ❌`);
      // 👉 Update your DB: mark as failed or pending
    }

  } catch (err) {
    console.error('[Status Check Error]:', err.response ? err.response.data : err.message);
  }

  res.status(200).send('Callback processed.');
});

// -------------------- MANUAL CHECK --------------------
app.get('/api/check-status/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const accessToken = await getAccessToken();

    const statusResponse = await axios.get(
      `https://api.phonepe.com/apis/pg/checkout/v2/order/${orderId}/status?details=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        }
      }
    );

    const orderData = statusResponse.data;
    const isPaid = orderData.paymentDetails?.some(p => p.state === 'COMPLETED');

    res.json({
      orderId,
      status: isPaid ? 'SUCCESS' : 'FAILED',
      rawData: orderData
    });

  } catch (err) {
    console.error('[Manual Check Error]:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: err.response ? err.response.data : err.message });
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`✅ Production server running at http://localhost:${PORT}`);
});

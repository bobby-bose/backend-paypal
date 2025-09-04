import express from "express";
import bodyParser from "body-parser";
import { StandardCheckoutClient, Env } from "pg-sdk-node";

const app = express();
const PORT = 5000;

// ✅ Capture raw body (needed for validation)
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// -------------------- PRODUCTION CONFIG --------------------
const CLIENT_ID = "SU2509011920199571786178";
const CLIENT_SECRET = "fbf66a20-f2fc-4df8-b21b-242f5de3d741";
const CLIENT_VERSION = 1; // Check your PhonePe dashboard for correct version
const USERNAME = "admin"; // Merchant username configured with PhonePe
const PASSWORD = "password37"; // Merchant password configured with PhonePe
const ENV = Env.PRODUCTION; // ✅ PRODUCTION environment

// ✅ Initialize PhonePe client
const client = StandardCheckoutClient.getInstance(
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_VERSION,
  ENV
);

// -------------------- WEBHOOK ENDPOINT --------------------
app.post("/phonepe/webhook", (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const rawBody = req.rawBody;

    if (!authHeader || !rawBody) {
      return res.status(400).send("Missing authorization or body");
    }

    // ✅ Validate callback authenticity
    const callbackResponse = client.validateCallback(
      USERNAME,
      PASSWORD,
      authHeader,
      rawBody
    );

    // Extract details
    const { type, payload } = callbackResponse;
    console.log("📩 Webhook Received:", type);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    // ✅ Handle events
    switch (type) {
      case "CHECKOUT_ORDER_COMPLETED":
        console.log(`✅ Payment success for order ${payload.originalMerchantOrderId}`);
        // 👉 Update your DB (mark order as paid)
        break;

      case "CHECKOUT_ORDER_FAILED":
        console.log(`❌ Payment failed for order ${payload.originalMerchantOrderId}`);
        // 👉 Update your DB (mark order as failed)
        break;

      case "PG_REFUND_COMPLETED":
        console.log(`💸 Refund completed for refund ID ${payload.merchantRefundId}`);
        // 👉 Update DB refund status
        break;

      case "PG_REFUND_FAILED":
        console.log(`⚠️ Refund failed for refund ID ${payload.merchantRefundId}`);
        break;

      default:
        console.log("ℹ️ Unhandled webhook type:", type);
    }

    // ✅ Respond success to PhonePe
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook validation failed:", error.message);
    res.status(400).send("Invalid callback");
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT} (Production Mode)`);
});

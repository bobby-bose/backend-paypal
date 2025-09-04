import express from "express";
import bodyParser from "body-parser";
import { StandardCheckoutClient, Env } from "pg-sdk-node";

const app = express();
const PORT = 5000;

// Capture raw body (needed for PhonePe validation)
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// -------------------- PRODUCTION CONFIG --------------------
const CLIENT_ID = "SU2509011920199571786178";
const CLIENT_SECRET = "fbf66a20-f2fc-4df8-b21b-242f5de3d741";
const CLIENT_VERSION = 1;
const USERNAME = "admin";
const PASSWORD = "password37";
const ENV = Env.PRODUCTION;

// Initialize PhonePe client
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

    let callbackResponse;

    // ✅ Bypass validation if manual testing
    if (process.env.NODE_ENV === "development" || req.query.test === "true") {
      console.log("⚡ Manual test mode: skipping validation");
      callbackResponse = JSON.parse(rawBody);
    } else {
      if (!authHeader || !rawBody) {
        return res.status(400).send("Missing authorization or body");
      }
      // Validate callback authenticity
      callbackResponse = client.validateCallback(
        USERNAME,
        PASSWORD,
        authHeader,
        rawBody
      );
    }

    const { type, payload } = callbackResponse;
    console.log("📩 Webhook Received:", type);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    // Handle events
    switch (type) {
      case "CHECKOUT_ORDER_COMPLETED":
        console.log(`✅ Payment success for order ${payload.originalMerchantOrderId}`);
        break;
      case "CHECKOUT_ORDER_FAILED":
        console.log(`❌ Payment failed for order ${payload.originalMerchantOrderId}`);
        break;
      case "PG_REFUND_COMPLETED":
        console.log(`💸 Refund completed for refund ID ${payload.merchantRefundId}`);
        break;
      case "PG_REFUND_FAILED":
        console.log(`⚠️ Refund failed for refund ID ${payload.merchantRefundId}`);
        break;
      default:
        console.log("ℹ️ Unhandled webhook type:", type);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook processing failed:", error.message);
    res.status(400).send("Invalid callback");
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});

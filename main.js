import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { StandardCheckoutClient, StandardCheckoutPayRequest, Env } from "pg-sdk-node";
import { v4 as uuid } from "uuid";

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------- ENABLE CORS --------------------
app.use(cors({
  origin: "http://localhost:3000", // React frontend
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Capture raw body (needed for PhonePe validation)
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// -------------------- CONFIG --------------------
// ⚠️ Replace with your PhonePe credentials
const CLIENT_ID = "SU2509011920199571786178";
const CLIENT_SECRET = "fbf66a20-f2fc-4df8-b21b-242f5de3d741";
const CLIENT_VERSION = 1;
const USERNAME = "admin";
const PASSWORD = "password37";
const ENV = Env.PRODUCTION; // or Env.SANDBOX for testing

const client = StandardCheckoutClient.getInstance(
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_VERSION,
  ENV
);

// -------------------- CREATE PAYMENT ENDPOINT --------------------
app.post("/create-payment", async (req, res) => {
  try {
    const { amount } = req.body; // amount in paisa
    const merchantOrderId = uuid();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount)
      .redirectUrl("http://localhost:3000/payment-callback") // React frontend
      .build();

    const response = await client.pay(request);

    res.json({
      checkoutUrl: response.redirectUrl,
      merchantOrderId
    });
    console.log(`💳 Payment created: ${merchantOrderId}, amount: ${amount}`);
  } catch (error) {
    console.error("❌ Payment creation failed:", error);
    res.status(500).json({ message: "Payment creation failed", error: error.message });
  }
});

// -------------------- WEBHOOK ENDPOINT --------------------
app.post("/phonepe/webhook", (req, res) => {
  console.log("--------------------------------------------------");
  console.log("📌 Webhook called");
  console.log("Method:", req.method);
  console.log("Query:", req.query);
  console.log("Headers:", req.headers);
  console.log("Raw Body:", req.rawBody);

  try {
    const authHeader = req.headers["authorization"];
    const rawBody = req.rawBody;

    let callbackResponse;

    // ✅ Manual test mode
    if (process.env.NODE_ENV === "development" || req.query.test === "true") {
      console.log("⚡ Manual test mode: skipping validation");
      callbackResponse = JSON.parse(rawBody);
    } else {
      if (!authHeader || !rawBody) {
        console.warn("❌ Missing authorization or body");
        return res.status(400).send("Missing authorization or body");
      }
      // Validate callback authenticity
      try {
        callbackResponse = client.validateCallback(USERNAME, PASSWORD, authHeader, rawBody);
      } catch (err) {
        console.error("❌ SDK validation failed:", err.message);
        callbackResponse = JSON.parse(rawBody); // fallback for logging
      }
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

    // Always respond 200 to PhonePe
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
    console.error(error.stack);
    res.status(200).send("OK"); // Respond 200 even if processing fails
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

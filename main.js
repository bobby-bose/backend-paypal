// webhook.js
import express from "express";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 5000;

// Parse JSON payloads
app.use(bodyParser.json());

// PhonePe webhook endpoint
app.post("/phonepe/webhook", (req, res) => {
    console.log("📥 Webhook received:", req.body);

    // Example: extract payment status
    const { merchantOrderId, status, transactionId, amount } = req.body;

    console.log(`Order: ${merchantOrderId}, Status: ${status}, Transaction ID: ${transactionId}, Amount: ${amount}`);

    // TODO: Update your database here for your giveaway counter

    // Respond to PhonePe
    res.json({
        success: true,
        message: "Webhook received successfully"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

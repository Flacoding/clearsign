export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email." });
  }

  // Log to Vercel's built-in logs (visible in Vercel dashboard → Functions → Logs)
  console.log(`NEW_SUBSCRIBER: ${email} | ${new Date().toISOString()}`);

  // If you set a WEBHOOK_URL environment variable in Vercel, emails are
  // also sent there (e.g. a Make.com or Zapier webhook → Google Sheets).
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "ClearSign",
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      // Don't fail the user request if webhook errors
      console.error("Webhook error:", err.message);
    }
  }

  return res.status(200).json({ success: true });
}

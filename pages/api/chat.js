import Anthropic from "@anthropic-ai/sdk";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, contractText, history } = req.body;

  if (!question || !contractText) {
    return res.status(400).json({ error: "Missing question or contract text." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key not configured." });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build conversation history
    const messages = [
      ...(history || []),
      { role: "user", content: question },
    ];

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are a helpful assistant explaining a legal contract to someone with no legal background.
Answer questions clearly and concisely in plain English.
Never give formal legal advice — always suggest consulting a lawyer for important decisions.
Keep answers under 200 words unless a longer explanation is genuinely needed.

Here is the contract being discussed:
---
${contractText.slice(0, 40000)}
---`,
      messages,
    });

    const answer = response.content[0].text;

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

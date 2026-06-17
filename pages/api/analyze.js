import Anthropic from "@anthropic-ai/sdk";

// Allow up to 10MB file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

// Extract text from a PDF buffer
async function extractPdfText(buffer) {
  // Use the lib path directly to avoid Next.js test-file issue
  const pdfParse = require("pdf-parse/lib/pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

// Extract text from a DOCX buffer
async function extractDocxText(buffer) {
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

const SYSTEM_PROMPT = `You are an expert legal document analyst who specialises in explaining contracts to everyday people with no legal background. Your job is to read a contract and return a clear, honest analysis in plain English.

You must return ONLY valid JSON — no markdown, no explanation outside the JSON object.

Return this exact structure:
{
  "type": "string — the contract type, e.g. Lease Agreement, Employment Contract, NDA, Freelance Service Agreement, Terms of Service",
  "summary": "string — 2-3 sentence plain English overview of what this contract is and what it does",
  "verdict": "SAFE" | "REVIEW" | "LAWYER",
  "verdict_reason": "string — one sentence explaining the verdict",
  "obligations": [
    {
      "title": "string — short name for the obligation",
      "description": "string — plain English explanation of what you must do",
      "severity": "low" | "medium" | "high"
    }
  ],
  "deadlines": [
    {
      "event": "string — what happens or is due",
      "date": "string — when (exact date or description like '30 days after signing')",
      "consequence": "string — what happens if you miss it"
    }
  ],
  "red_flags": [
    {
      "flag": "string — short title of the concern",
      "explanation": "string — plain English explanation of why this is a concern and what it means for you",
      "severity": "medium" | "high"
    }
  ],
  "rights_waived": [
    {
      "right": "string — the right being waived",
      "explanation": "string — what this means in practice"
    }
  ],
  "auto_renewals": [
    {
      "description": "string — what renews automatically",
      "notice_period": "string — how much notice you need to give to cancel"
    }
  ]
}

Verdict guide:
- SAFE: Standard contract with no unusual clauses. Fine to sign as-is.
- REVIEW: Some clauses worth negotiating or understanding better before signing.
- LAWYER: Contains high-risk clauses, significant rights waivers, or unusual terms. Recommend professional review.

If a section has no items (e.g. no auto-renewals found), return an empty array [].
Be thorough but concise. Write as if explaining to a smart friend, not a court.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileData, fileName, fileType } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({ error: "No file provided." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key not configured. Add ANTHROPIC_API_KEY in Vercel environment variables." });
  }

  try {
    // Decode base64 to buffer
    const buffer = Buffer.from(fileData, "base64");

    // Extract text based on file type
    let contractText = "";
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith(".pdf") || fileType === "application/pdf") {
      contractText = await extractPdfText(buffer);
    } else if (
      lowerName.endsWith(".docx") ||
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      contractText = await extractDocxText(buffer);
    } else if (lowerName.endsWith(".txt") || fileType === "text/plain") {
      contractText = buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, Word (.docx), or text file." });
    }

    if (!contractText || contractText.trim().length < 100) {
      return res.status(400).json({ error: "Could not extract text from this file. Make sure it is not a scanned image PDF." });
    }

    // Truncate if extremely long (Claude handles ~200k tokens but let's keep cost low)
    const MAX_CHARS = 80000;
    const truncated = contractText.length > MAX_CHARS;
    const textToAnalyse = contractText.slice(0, MAX_CHARS);

    // Call Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please analyse this contract:\n\n${textToAnalyse}${truncated ? "\n\n[NOTE: Document was truncated at 80,000 characters due to length. Analysis based on available text.]" : ""}`,
        },
      ],
    });

    const rawContent = message.content[0].text;

    // Parse the JSON response
    let analysis;
    try {
      // Strip any accidental markdown code fences
      const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse analysis. Please try again." });
    }

    // Pass back the extracted text so follow-up chat can use it (client stores it in state)
    return res.status(200).json({ analysis, contractText: textToAnalyse });

  } catch (err) {
    console.error("Analysis error:", err);
    if (err.status === 401) {
      return res.status(500).json({ error: "Invalid API key. Check your Anthropic API key in Vercel settings." });
    }
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

import { Router } from "express";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.post("/receipt-scanner/scan", async (req, res): Promise<void> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: "ANTHROPIC_API_KEY is not configured. Please set it in your environment secrets to use the receipt scanner.",
      missing_key: true,
    });
    return;
  }

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageBase64 },
              },
              {
                type: "text",
                text: `Analyze this receipt/invoice image and extract all line items. Return a JSON array only (no explanation) in this exact format:
[{"name":"Item Name","quantity":1,"unitPrice":1000,"total":1000,"category":"Smartphone"}]
Category must be one of: Smartphone, Phone Accessories, Laptop, Laptop Accessories, Tablet, Gaming, Gaming Accessories, Smartwatches, Audio, Cameras, Camera Accessories, Others.
If you cannot read the receipt clearly, return an empty array [].`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).json({ error: `AI API error: ${response.status}`, detail: errText });
      return;
    }

    const data = await response.json() as any;
    const text = data?.content?.[0]?.text ?? "[]";

    let items: any[] = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) items = JSON.parse(match[0]);
    } catch {
      items = [];
    }

    res.json({ items, rawText: text });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

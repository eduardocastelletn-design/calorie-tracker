export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server." });
    return;
  }

  try {
    const { content, system } = req.body || {};

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({
        error: data?.error?.message || "Anthropic API returned an error.",
      });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error calling Claude: " + err.message });
  }
}

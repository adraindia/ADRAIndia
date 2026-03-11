// api/generate.js
// Vercel serverless function — proxies requests to Anthropic API.
// The ANTHROPIC_API_KEY is stored as a Vercel environment variable and
// never exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, data, photoBase64, photoMime } = req.body;

  if (!type || !data) {
    return res.status(400).json({ error: "Missing required fields: type, data" });
  }

  const prompt = buildPrompt(type, data);

  // Build message content — include photo if provided
  const content = photoBase64
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: photoMime || "image/jpeg", data: photoBase64 },
        },
        {
          type: "text",
          text: prompt + "\n\nA field photo has been provided. Incorporate a brief photo caption line into the story.",
        },
      ]
    : prompt;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || "Anthropic API error" });
    }

    const json = await response.json();
    const text = (json.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return res.status(200).json({ content: text });
  } catch (err) {
    console.error("Generate error:", err);
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────
function buildPrompt(type, data) {
  if (type === "case_story") {
    return `You are a skilled development communications writer for ADRA India, an international humanitarian NGO.

Write a compelling case story based on the field data below.

STRICT STYLE RULES:
- Clear narrative arc: situation before → specific challenge → ADRA's actions → change/outcome
- Write in third person
- Use the beneficiary's direct quote as a standalone pull-quote paragraph (mark it clearly)
- Specific and concrete — use names, places, numbers
- NEVER use: "beacon of hope", "resilience", "unwavering", "testament", "transformative journey", "empowerment", "empowered", "holistic", "impactful"
- Warm, journalistic, honest tone. Not salesy or over-dramatic.
- Length: 350–450 words
- End with a brief "Looking Ahead" sentence
- Start with a compelling headline

FIELD DATA:
Project: ${data.projectName}
Project Objective: ${data.projectObjective || "Not provided"}
Donor / Funder: ${data.projectDonor || "Not provided"}
Project Geography: ${data.projectGeography || data.location || "Not provided"}
Project Duration: ${data.projectDuration || "Not provided"}
Beneficiary: ${data.beneficiary}, Age: ${data.age}, Gender: ${data.gender}
Location: ${data.location}
Background (before ADRA): ${data.background}
Challenge/Barrier: ${data.challenge}
ADRA's Intervention: ${data.intervention}
Outcome/Change: ${data.outcome}
Beneficiary Quote: "${data.quote}"
Additional Notes: ${data.extraNotes || "None"}

Generate the case story now.`;
  }

  if (type === "newsletter") {
    return `You are a communications writer for ADRA India. Write a newsletter programme update.

STYLE RULES:
- Engaging, clear, donor-friendly tone
- Lead with the most impressive result
- Weave the human story naturally into the narrative
- Avoid jargon, buzzwords, and clichés
- Length: 250–350 words
- Include a bold section heading

DATA:
Project: ${data.projectName} | Period: ${data.reportingPeriod} | Geography: ${data.geography}
Achievement 1: ${data.achievement1}
Achievement 2: ${data.achievement2}
Achievement 3: ${data.achievement3 || "N/A"}
Human Story: ${data.humanStory}
Challenges: ${data.challenges}
Upcoming: ${data.upcoming}

Write the newsletter update now.`;
  }

  // report
  return `You are a development communications specialist for ADRA India. Write a concise Impact Snapshot for a donor report.

STYLE RULES:
- Professional, results-focused, evidence-based
- Lead with headline numbers
- Be honest about challenges — donors respect this
- Length: 300–400 words
- Format: Intro paragraph → Key Results (bullet list) → Highlights paragraph → Challenges & Learning → Next Steps

DATA:
Project: ${data.projectName} | Donor: ${data.donorName} | Period: ${data.reportingPeriod}
Geography: ${data.geography} | Beneficiaries: ${data.totalBeneficiaries}
Key Indicators: ${data.keyIndicators}
Highlight: ${data.highlight}
Challenges: ${data.challenges}
Lessons: ${data.lessons}
Next Steps: ${data.nextSteps}

Write the Impact Snapshot now.`;
}

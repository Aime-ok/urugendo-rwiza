const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

export async function askModel(prompt: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI ntiboneka: LOVABLE_API_KEY ibuze.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: [{ role: "user", content: prompt }],
      reasoning: { effort: "low" },
      store: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Ibibazo byinshi muri iki gihe. Ongera ugerageze nyuma.");
    if (res.status === 402) throw new Error("Amakuru ya AI yarangiye (credits). Ongeraho amakuru muri Lovable AI.");
    throw new Error(`AI yanze gukora (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    output_text?: string;
  };

  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;

  let out = "";
  for (const item of data.output ?? []) {
    for (const c of item.content ?? []) {
      if (typeof c.text === "string") out += c.text;
    }
  }
  return out;
}

export function extractJsonArray(raw: string): unknown[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI ntiyatanze ibibazo mu buryo bwemewe.");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("AI ntiyatanze urutonde rw'ibibazo.");
  return parsed;
}

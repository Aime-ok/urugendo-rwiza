/**
 * Reads questions out of a PDF in the browser, keeping the text exactly as printed.
 * Nothing here rewrites, translates or invents content.
 */
export type ParsedQuestion = {
  number: number;
  page: number;
  questionText: string;
  options: string[];
  correctIndex: number | null;
  explanation: string | null;
  imageBase64: string | null;
  needsReview: boolean;
  rawText: string;
};

type Line = { y: number; x: number; text: string };

const QUESTION_START = /^\s*(\d{1,3})\s*[).:\-–]?\s+(.*)$/;
const OPTION_START = /^\s*([A-Da-d])\s*[).:\-–]\s*(.+)$/;
const ANSWER_LINE = /(igisubizo\s*(nyacyo)?|answer|réponse|reponse)\s*[:\-–]?\s*([A-Da-d])\b/i;

function groupLines(items: Array<{ str: string; transform: number[] }>): Line[] {
  const raw = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => ({ y: Math.round(i.transform[5] ?? 0), x: i.transform[4] ?? 0, text: i.str }));

  const buckets = new Map<number, Line[]>();
  for (const item of raw) {
    // Tolerate small baseline differences within one visual line.
    const key = [...buckets.keys()].find((k) => Math.abs(k - item.y) <= 3) ?? item.y;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, parts]) => ({
      y,
      x: Math.min(...parts.map((p) => p.x)),
      text: parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    }));
}

async function cropBand(
  canvas: HTMLCanvasElement,
  viewportHeight: number,
  scale: number,
  topY: number,
  bottomY: number,
): Promise<string | null> {
  const top = Math.max(0, (viewportHeight - topY) * scale);
  const bottom = Math.min(canvas.height, (viewportHeight - bottomY) * scale);
  const height = Math.round(bottom - top);
  if (height < 40 * scale) return null;

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, Math.round(top), canvas.width, height, 0, 0, canvas.width, height);

  // Skip blank bands (pure white) so text-only questions get no image.
  const pixels = ctx.getImageData(0, 0, out.width, out.height).data;
  let ink = 0;
  for (let i = 0; i < pixels.length; i += 4 * 37) {
    if ((pixels[i] ?? 255) < 240) ink++;
  }
  if (ink < 30) return null;

  return out.toDataURL("image/png").split(",")[1] ?? null;
}

export async function parseQuestionsFromPdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<{ questions: ParsedQuestion[]; text: string }> {
  const { getDocumentProxy } = await import("unpdf");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);

  const questions: ParsedQuestion[] = [];
  let fullText = "";
  let current: (ParsedQuestion & { startY: number; firstOptionY: number | null }) | null = null;
  let currentPageCtx: { canvas: HTMLCanvasElement; height: number; scale: number } | null = null;

  const finish = async () => {
    if (!current) return;
    if (currentPageCtx && current.firstOptionY !== null) {
      current.imageBase64 = await cropBand(
        currentPageCtx.canvas,
        currentPageCtx.height,
        currentPageCtx.scale,
        current.startY,
        current.firstOptionY,
      );
    }
    current.needsReview = current.options.length < 2 || current.correctIndex === null;
    const { startY: _s, firstOptionY: _f, ...rest } = current;
    questions.push(rest);
    current = null;
  };

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = groupLines(content.items as Array<{ str: string; transform: number[] }>);
    fullText += lines.map((l) => l.text).join("\n") + "\n";

    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
    currentPageCtx = { canvas, height: viewport.height / scale, scale };

    for (const line of lines) {
      const answer = ANSWER_LINE.exec(line.text);
      const option = OPTION_START.exec(line.text);
      const start = QUESTION_START.exec(line.text);

      if (start && !option && Number(start[1]) === questions.length + 1) {
        await finish();
        current = {
          number: Number(start[1]),
          page: p,
          questionText: (start[2] ?? "").trim(),
          options: [],
          correctIndex: null,
          explanation: null,
          imageBase64: null,
          needsReview: false,
          rawText: line.text,
          startY: line.y,
          firstOptionY: null,
        };
        continue;
      }

      if (!current) continue;
      current.rawText += "\n" + line.text;

      if (answer) {
        const letter = (answer[3] ?? "").toUpperCase();
        const idx = "ABCD".indexOf(letter);
        if (idx >= 0) current.correctIndex = idx;
        continue;
      }

      if (option) {
        if (current.firstOptionY === null) current.firstOptionY = line.y;
        const text = (option[2] ?? "").trim();
        // A trailing marker such as "(*)" or a tick indicates the correct choice.
        const marked = /[*✓✔]\s*$/.test(text);
        current.options.push(text.replace(/[*✓✔]\s*$/, "").trim());
        if (marked) current.correctIndex = current.options.length - 1;
        continue;
      }

      if (current.options.length === 0) {
        current.questionText = `${current.questionText} ${line.text}`.trim();
      } else {
        const last = current.options.length - 1;
        current.options[last] = `${current.options[last]} ${line.text}`.trim();
      }
    }
  }

  await finish();
  return { questions, text: fullText };
}

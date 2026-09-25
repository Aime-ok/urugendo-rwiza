/**
 * Reads questions out of a PDF in the browser, keeping the text exactly as printed.
 * Nothing here rewrites, translates, reorders or invents content.
 *
 * Layout rules (taken from the real book):
 *  - "243. Question text" starts a question (text may wrap over several lines).
 *  - Answer choices start with a letter: "a) ...", "b. ...", "c)text".
 *  - The correct choice is printed in brackets: "(c) ..." or "(c.) ...".
 *  - Pictures (road signs, diagrams) sit between the question text and its choices,
 *    sometimes on the next page. They are cut from the page exactly as drawn.
 *  - Headings in capital letters (outside a question) are treated as lesson/topic names.
 */
export type ParsedQuestion = {
  /** Question number exactly as printed. */
  number: number;
  /** Position in the PDF (1, 2, 3...) — keeps the original order even if numbers repeat. */
  order: number;
  page: number;
  topic: string | null;
  questionText: string;
  options: string[];
  correctIndex: number | null;
  explanation: string | null;
  imageBase64: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  rawText: string;
};

export type ImportReport = {
  fileName: string;
  totalPages: number;
  detected: number;
  withImages: number;
  withoutImages: number;
  needsReview: number;
  pagesWithErrors: number[];
  topics: string[];
};

type TextLine = { kind: "line"; page: number; y: number; text: string; font: string };
type ImageBox = { kind: "image"; page: number; y: number; rect: [number, number, number, number] };
type Event = TextLine | ImageBox;

const NOISE = [/^RESTRICTED$/i, /^\d{1,4}$/];
const QUESTION_START = /^(\d{1,3})\s*[.)]\s*(.*)$/;
const OPTION_MARKED = /^\(\s*([a-f])\s*(?:\.\s*\)|\)|\.)\s*(.*)$/i;
const OPTION_PLAIN = /^([a-f])\s*[.)]\s*(.*)$/i;
const HEADING = /^[A-ZÀ-Ý’' \-]{3,60}$/;
const LETTERS = "abcdef";

type Item = { str: string; transform: number[]; fontName?: string };

function groupLines(page: number, items: Item[]): TextLine[] {
  const raw = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => ({ y: i.transform[5] ?? 0, x: i.transform[4] ?? 0, text: i.str, font: i.fontName ?? "" }));

  const buckets: Array<{ y: number; parts: typeof raw }> = [];
  for (const item of raw) {
    const b = buckets.find((k) => Math.abs(k.y - item.y) <= 3);
    if (b) b.parts.push(item);
    else buckets.push({ y: item.y, parts: [item] });
  }

  return buckets.map((b) => {
    const weight = new Map<string, number>();
    for (const part of b.parts) weight.set(part.font, (weight.get(part.font) ?? 0) + part.text.trim().length);
    const font = [...weight.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? "";
    return {
    kind: "line" as const,
    page,
    font,
    y: b.y,
    text: b.parts
      .sort((a, c) => a.x - c.x)
      .map((p) => p.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .trim(),
    };
  });
}

type Matrix = [number, number, number, number, number, number];
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findImages(page: any, pageNo: number, OPS: Record<string, number>): Promise<ImageBox[]> {
  const ops = await page.getOperatorList();
  const paint = new Set(
    [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat].filter(
      (v) => typeof v === "number",
    ),
  );
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const boxes: ImageBox[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (Array.isArray(args?.[0]) && args[0].length === 6) ctm = mul(ctm, args[0] as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (paint.has(fn)) {
      const pts = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([x, y]) => [ctm[0] * x! + ctm[2] * y! + ctm[4], ctm[1] * x! + ctm[3] * y! + ctm[5]]);
      const xs = pts.map((p) => p[0]!);
      const ys = pts.map((p) => p[1]!);
      const rect: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      // Ignore tiny decorations (bullets, lines).
      if (rect[2] - rect[0] < 15 || rect[3] - rect[1] < 15) continue;
      boxes.push({ kind: "image", page: pageNo, y: rect[3], rect });
    }
  }
  return boxes;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPage(page: any): Promise<{ canvas: HTMLCanvasElement; viewport: any } | null> {
  if (typeof document === "undefined") return null;
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { canvas, viewport };
}

function cropImages(crops: HTMLCanvasElement[]): string | null {
  if (crops.length === 0) return null;
  const width = Math.max(...crops.map((c) => c.width));
  const gap = 16;
  const height = crops.reduce((s, c) => s + c.height, 0) + gap * (crops.length - 1);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const c of crops) {
    ctx.drawImage(c, Math.round((width - c.width) / 2), y);
    y += c.height + gap;
  }
  return out.toDataURL("image/png").split(",")[1] ?? null;
}

type Working = Omit<ParsedQuestion, "imageBase64"> & {
  crops: HTMLCanvasElement[];
  imageCount: number;
  lateImage: boolean;
  optionFonts: string[][];
};
type Finished = ParsedQuestion & { optionFonts: string[][]; imageCount: number };

export async function parseQuestionsFromPdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<{ questions: ParsedQuestion[]; text: string; report: ImportReport }> {
  const { getDocumentProxy, getResolvedPDFJS } = await import("unpdf");
  const pdfjs = await getResolvedPDFJS();
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));

  const questions: Finished[] = [];
  const markedFonts = new Map<string, number>();
  const plainFonts = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  let fullText = "";
  let topic: string | null = null;
  let current: Working | null = null;
  let pendingCrops: HTMLCanvasElement[] = [];

  const finish = () => {
    if (!current) return;
    const reasons: string[] = [];
    if (current.lateImage) reasons.push("Ifoto yabonetse hagati y'ibisubizo");
    if (current.imageCount > 0 && current.crops.length === 0 && typeof document !== "undefined")
      reasons.push("Ifoto ntiyashoboye gukatwa");
    const { crops, lateImage: _l, ...rest } = current;
    questions.push({
      ...rest,
      imageBase64: typeof document !== "undefined" ? cropImages(crops) : null,
      reviewReason: reasons.length ? reasons.join("; ") : null,
    });
    current = null;
  };

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = groupLines(p, content.items as Item[]);
    const images = await findImages(page, p, OPS);
    const rendered = images.length > 0 ? await renderPage(page) : null;

    const events: Event[] = [...lines, ...images].sort((a, b) => b.y - a.y);
    fullText += lines
      .slice()
      .sort((a, b) => b.y - a.y)
      .map((l) => l.text)
      .join("\n") + "\n";

    for (const ev of events) {
      if (ev.kind === "image") {
        let crop: HTMLCanvasElement | null = null;
        if (rendered) {
          const [x1, y1, x2, y2] = rendered.viewport.convertToViewportRectangle(ev.rect) as number[];
          const left = Math.max(0, Math.floor(Math.min(x1!, x2!)));
          const top = Math.max(0, Math.floor(Math.min(y1!, y2!)));
          const w = Math.min(rendered.canvas.width - left, Math.ceil(Math.abs(x2! - x1!)));
          const h = Math.min(rendered.canvas.height - top, Math.ceil(Math.abs(y2! - y1!)));
          if (w > 0 && h > 0) {
            crop = document.createElement("canvas");
            crop.width = w;
            crop.height = h;
            crop.getContext("2d")?.drawImage(rendered.canvas, left, top, w, h, 0, 0, w, h);
          }
        }
        const w: Working | null = current;
        if (w && w.options.length === 0) {
          w.imageCount++;
          if (crop) w.crops.push(crop);
        } else if (w && w.options.length > 0 && w.options.length < 4 && w.correctIndex === null) {
          // Picture in the middle of the choices — keep it, but let the admin check.
          w.imageCount++;
          w.lateImage = true;
          if (crop) w.crops.push(crop);
        } else if (crop) {
          // Picture after a finished question: it belongs to the next one.
          pendingCrops.push(crop);
        }
        continue;
      }

      handleLine(ev.text, ev.font, p);
    }
  }

  function handleLine(text: string, font: string, p: number) {
      if (NOISE.some((r) => r.test(text))) return;

      const cur: Working | null = current;
      const nextLetter = LETTERS[cur?.options.length ?? 0];
      const marked = OPTION_MARKED.exec(text);
      const plain = OPTION_PLAIN.exec(text);
      const start = QUESTION_START.exec(text);
      const opt = cur && marked && marked[1]!.toLowerCase() === nextLetter ? marked : cur && plain && plain[1]!.toLowerCase() === nextLetter ? plain : null;

      if (cur && opt) {
        const isMarked = opt === marked;
        let rest = (opt[2] ?? "").trim();
        let spill: string | null = null;
        // "a) b) (c) d)" — letters printed under picture choices.
        const nextMarker = /^\(?\s*([a-f])\s*(?:\.\s*\)|\)|\.)/i.exec(rest);
        if (nextMarker && nextMarker[1]!.toLowerCase() === LETTERS[cur.options.length + 1]) {
          spill = rest;
          rest = "";
        } else {
          // Next question printed on the same line after an empty choice.
          const q = QUESTION_START.exec(rest);
          if (q && Number(q[1]) === cur.number + 1 && rest.length > 0 && /^\d/.test(rest)) {
            spill = rest;
            rest = "";
          }
        }
        cur.options.push(rest);
        cur.optionFonts.push([font]);
        if (isMarked) {
          bump(markedFonts, font);
          cur.correctIndex = cur.correctIndex === null ? cur.options.length - 1 : -1;
        } else bump(plainFonts, font);
        cur.rawText += "\n" + text;
        if (spill) handleLine(spill, font, p);
        return;
      }

      if (start && (!cur || cur.options.length >= 2 || Number(start[1]) === cur.number + 1)) {
        finish();
        current = {
          number: Number(start[1]),
          order: questions.length + 1,
          page: p,
          topic,
          questionText: (start[2] ?? "").trim(),
          options: [],
          correctIndex: null,
          explanation: null,
          needsReview: false,
          reviewReason: null,
          rawText: text,
          crops: pendingCrops,
          imageCount: pendingCrops.length,
          lateImage: false,
          optionFonts: [],
        };
        pendingCrops = [];
        return;
      }

      if (HEADING.test(text) && /[A-Z]{3}/.test(text) && (!cur || cur.options.length >= 2)) {
        finish();
        topic = text.trim();
        return;
      }

      if (!cur) return;
      cur.rawText += "\n" + text;
      if (cur.options.length === 0) cur.questionText = `${cur.questionText} ${text}`.trim();
      else {
        const last = cur.options.length - 1;
        cur.options[last] = `${cur.options[last]} ${text}`.trim();
        cur.optionFonts[last]!.push(font);
      }
  }
  finish();

  for (const q of questions) {
    if (q.correctIndex === -1) {
      q.correctIndex = null;
      q.needsReview = true;
      q.reviewReason = [q.reviewReason, "Ibisubizo birenze kimwe byagaragajwe nk'ukuri"].filter(Boolean).join("; ");
    }
  }

  const withImages = questions.filter((q) => q.imageBase64).length;
  const report: ImportReport = {
    fileName: file.name,
    totalPages: pdf.numPages,
    detected: questions.length,
    withImages,
    withoutImages: questions.length - withImages,
    needsReview: questions.filter((q) => q.needsReview).length,
    pagesWithErrors: [...new Set(questions.filter((q) => q.needsReview).map((q) => q.page))].sort((a, b) => a - b),
    topics: [...new Set(questions.map((q) => q.topic).filter((t): t is string => !!t))],
  };

  return {
    questions: questions.map(({ optionFonts: _f, imageCount: _i, ...q }) => q),
    text: fullText,
    report,
  };
}

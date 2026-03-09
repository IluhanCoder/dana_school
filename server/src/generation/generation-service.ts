import { PDFParse } from "pdf-parse";
import crypto from "crypto";
import https from "https";
import userService from "../user/user-service";
import journalModel from "../journal/journal-model";
import subjectModel from "../subject/subject-model";
import googleStorageService from "../services/google-storage.service";
import explanationCacheModel from "./explanation-cache-model";
import {
  IPodcastRequestInput,
  IMissedLessonInput,
  ITopicExplanationInput,
  ITopicExplanationResult,
  ITopicMaterialMatch,
} from "../types/generation.types";

interface MaterialText {
  title: string;
  text: string;
}

interface SubjectMaterialBundle {
  parsed: MaterialText[];
  rawMaterialTitles: string[];
}

interface ChunkCandidate {
  score: number;
  snippet: string;
  materialTitle: string | null;
}

const MAX_CHUNK_CHARS = 1200;
const CHUNK_SLIDE_STEP = 900;
const MIN_EXPLANATION_WORDS = 240;
const MAX_EXPLANATION_ATTEMPTS = 3;
const MAX_TTS_INPUT_CHARS = 3800;

function titleFromStoragePath(storagePath: string): string {
  const normalized = (storagePath || "").split("/").filter(Boolean);
  const fileName = normalized[normalized.length - 1] || "PDF матеріал";
  return decodeURIComponent(fileName);
}

const UK_STOP_WORDS = new Set([
  "та",
  "і",
  "й",
  "або",
  "на",
  "у",
  "в",
  "до",
  "з",
  "за",
  "про",
  "для",
  "по",
  "від",
  "що",
  "це",
  "як",
  "при",
  "над",
  "під",
  "із",
  "чи",
]);

function normalizeText(text: string): string {
  return (text || "")
    .replace(/\u00A0/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeModelText(text: string): string {
  return normalizeText(text)
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/[�]+/g, "")
    .replace(/[ÐÑÃÂ]{2,}/g, "")
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n]/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string): number {
  return sanitizeModelText(text)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function hasGarbledArtifacts(text: string): boolean {
  if (!text) return false;
  if (/[�]/.test(text)) return true;
  if (/(Ð|Ñ|Ã|Â){2,}/.test(text)) return true;
  return false;
}

function isExplanationQualitySufficient(text: string): boolean {
  return countWords(text) >= MIN_EXPLANATION_WORDS && !hasGarbledArtifacts(text);
}

function sanitizeFileBaseName(value: string): string {
  return (value || "podcast")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 64) || "podcast";
}

function ukrainianSectionLabel(index: number): string {
  const labels = [
    "Перша тема",
    "Друга тема",
    "Третя тема",
    "Четверта тема",
    "П'ята тема",
    "Шоста тема",
    "Сьома тема",
    "Восьма тема",
    "Дев'ята тема",
    "Десята тема",
    "Одинадцята тема",
    "Дванадцята тема",
  ];
  return labels[index] || `Наступна тема ${index + 1}`;
}

function enforceChunkSizeLimit(chunks: string[]): string[] {
  const normalized: string[] = [];

  for (const rawChunk of chunks) {
    const chunk = (rawChunk || "").trim();
    if (!chunk) continue;

    if (chunk.length <= MAX_CHUNK_CHARS) {
      normalized.push(chunk);
      continue;
    }

    // Split oversized chunks with overlap to keep context near boundaries.
    for (let i = 0; i < chunk.length; i += CHUNK_SLIDE_STEP) {
      const part = chunk.slice(i, i + MAX_CHUNK_CHARS).trim();
      if (part.length >= 45) {
        normalized.push(part);
      }
    }
  }

  return normalized;
}

function splitIntoChunks(text: string): string[] {
  const paragraphs = normalizeText(text)
    .split("\n\n")
    .map((part) => part.trim())
    .filter((part) => part.length >= 60 || (part.length >= 35 && part.split("\n").length >= 3));

  if (paragraphs.length) {
    return enforceChunkSizeLimit(paragraphs);
  }

  const compact = normalizeText(text);
  if (!compact) return [];

  const chunks: string[] = [];
  for (let i = 0; i < compact.length; i += 550) {
    chunks.push(compact.slice(i, i + 700));
  }
  return enforceChunkSizeLimit(chunks);
}

function expandKeywordForms(keywords: string[]): string[] {
  const forms = new Set<string>();
  for (const keyword of keywords) {
    forms.add(keyword);
    if (keyword.length >= 5) {
      forms.add(keyword.slice(0, 4));
    }
    if (keyword.length >= 7) {
      forms.add(keyword.slice(0, 5));
    }
  }
  return Array.from(forms);
}

function extractKeywordWindows(text: string, keywords: string[]): string[] {
  const normalized = normalizeText(text);
  if (!normalized || !keywords.length) return [];

  const lowered = normalized.toLowerCase();
  const forms = expandKeywordForms(keywords).filter((value) => value.length >= 3);
  const windows: string[] = [];
  const seen = new Set<string>();

  for (const form of forms) {
    let fromIndex = 0;
    while (fromIndex < lowered.length) {
      const idx = lowered.indexOf(form, fromIndex);
      if (idx === -1) break;

      const start = Math.max(0, idx - 320);
      const end = Math.min(normalized.length, idx + form.length + 480);
      const chunk = normalized.slice(start, end).trim();
      const key = chunk.slice(0, 140).toLowerCase();
      if (chunk.length >= 45 && !seen.has(key)) {
        seen.add(key);
        windows.push(chunk);
      }

      fromIndex = idx + Math.max(1, form.length);
      if (windows.length >= 40) break;
    }
    if (windows.length >= 40) break;
  }

  return enforceChunkSizeLimit(windows);
}

function topicKeywords(topic: string): string[] {
  const lowered = (topic || "").toLowerCase();
  const words = lowered
    .split(/[^a-zа-яіїєґ0-9']+/i)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !UK_STOP_WORDS.has(word));

  return Array.from(new Set(words));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-zа-яіїєґ0-9']+/i)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !UK_STOP_WORDS.has(word));
}

function wordSimilarity(keyword: string, candidate: string): number {
  if (!keyword || !candidate) return 0;
  if (keyword === candidate) return 1;

  const minStem = Math.min(4, keyword.length, candidate.length);
  if (minStem >= 3 && keyword.slice(0, minStem) === candidate.slice(0, minStem)) {
    return 0.82;
  }

  if (keyword.length >= 5 && candidate.includes(keyword.slice(0, 4))) {
    return 0.62;
  }

  const dist = levenshteinDistance(keyword, candidate);
  const maxLen = Math.max(keyword.length, candidate.length);
  if (maxLen >= 5) {
    const ratio = 1 - dist / maxLen;
    if (ratio >= 0.7) {
      return Math.max(0.4, ratio);
    }
  }

  return 0;
}

function scoreChunk(chunk: string, keywords: string[]): number {
  if (!keywords.length || !chunk) return 0;

  const lowered = chunk.toLowerCase();
  const chunkTokens = tokenize(lowered);
  const tokenSet = new Set(chunkTokens);
  let score = 0;
  let coveredKeywords = 0;

  for (const keyword of keywords) {
    if (!keyword) continue;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = lowered.match(new RegExp(escaped, "g"));
    const occurrences = matches ? matches.length : 0;
    score += occurrences > 0 ? occurrences * 2 : 0;
    if (occurrences > 0) {
      coveredKeywords += 1;
    }

    if (!occurrences && chunkTokens.length) {
      let bestKeywordSimilarity = 0;
      if (tokenSet.has(keyword)) {
        bestKeywordSimilarity = 1;
      } else {
        for (const token of chunkTokens) {
          const sim = wordSimilarity(keyword, token);
          if (sim > bestKeywordSimilarity) {
            bestKeywordSimilarity = sim;
          }
          if (bestKeywordSimilarity >= 0.95) break;
        }
      }

      if (bestKeywordSimilarity >= 0.75) {
        score += 1.25;
        coveredKeywords += 1;
      } else if (bestKeywordSimilarity >= 0.55) {
        score += 0.7;
      } else if (bestKeywordSimilarity >= 0.4) {
        score += 0.35;
      }
    }
  }

  if (lowered.length > 150 && lowered.length < 1200) {
    score += 1;
  }

  // Favor chunks covering multiple topic terms.
  if (coveredKeywords >= 2) {
    score += coveredKeywords * 0.9;
  }

  // Penalize table-of-contents style blocks with dotted leaders and page numbers.
  const dottedLeaders = (chunk.match(/\.{3,}/g) || []).length;
  const sectionMarkers = (chunk.match(/§\s*\d+/g) || []).length;
  const pageLikeNumbers = (chunk.match(/\b\d{1,3}\b/g) || []).length;
  if (dottedLeaders >= 2 && sectionMarkers >= 1) {
    score -= 2.2;
  } else if (dottedLeaders >= 2 && pageLikeNumbers >= 8) {
    score -= 1.6;
  }

  // Soft fallback so we still pick the closest snippet even for weak matches.
  if (score === 0 && chunkTokens.length > 0) {
    score = 0.1;
  }

  return score;
}

export default new (class GenerationService {
  private hashSnippet(snippet: string): string {
    return crypto.createHash("sha256").update(snippet || "").digest("hex");
  }

  private normalizeTopic(topic: string): string {
    return (topic || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  private async requestOpenAI(messages: Array<{ role: "system" | "user"; content: string }>, model: string, apiKey: string): Promise<string> {
    const body = JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1800,
      messages,
    });

    return await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.openai.com",
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            if (!res.statusCode || res.statusCode >= 300) {
              return reject(new Error(`OpenAI API error: ${res.statusCode || 500} ${data}`));
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed?.choices?.[0]?.message?.content;
              if (!content) {
                return reject(new Error("OpenAI API returned empty response"));
              }
              resolve(String(content));
            } catch (error: any) {
              reject(new Error(`OpenAI response parse error: ${error.message}`));
            }
          });
        }
      );

      req.on("error", (err) => reject(err));
      req.write(body);
      req.end();
    });
  }

  private async callOpenAIForExplanation(item: ITopicExplanationInput): Promise<Pick<ITopicExplanationResult, "explanation" | "usedExternalKnowledge">> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is not configured (OPENAI_API_KEY or OPEN_AI_API_KEY)");
    }

    const model = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || "gpt-4o-mini";

    const materialSnippet = sanitizeModelText((item.snippet || "").slice(0, 6000));
    const prompt = [
      "Ти вчитель-помічник для української школи.",
      "Завдання: пояснити тему учню простою українською мовою, відповідно до підходів НУШ.",
      "Спочатку опирайся на наданий фрагмент з підручника/матеріалу.",
      "Якщо у фрагменті бракує даних, обережно доповни базовими шкільними знаннями.",
      "Не вигадуй вузькі факти, яких не можна перевірити в шкільному курсі.",
      `Зроби пояснення змістовним і практичним: не менше ${MIN_EXPLANATION_WORDS} слів (оптимально 280-500).`,
      "Структура відповіді:",
      "1) Розгорнуте пояснення теми (4-8 речень)",
      "2) Ключові поняття і правила (5-8 пунктів)",
      "3) 2 короткі приклади застосування",
      "4) Типові помилки учнів і як їх уникнути",
      "5) Міні-перевірка: 3 простих питання для самоконтролю",
      "Пиши без дивних символів, квадратів, замінників кодування або 'сміттєвих' знаків.",
      "",
      `Предмет: ${item.subjectName}`,
      `Тема: ${item.topic}`,
      `Матеріал: ${item.materialTitle || "Невідомо"}`,
      "Фрагмент матеріалу:",
      materialSnippet || "(Фрагмент відсутній)",
      "",
      "Наприкінці додай окремий рядок: ExternalKnowledgeUsed: yes або ExternalKnowledgeUsed: no",
    ].join("\n");

    let currentPrompt = prompt;
    let bestText = "";
    let bestScore = -1;
    let bestUsedExternalKnowledge = false;

    for (let attempt = 1; attempt <= MAX_EXPLANATION_ATTEMPTS; attempt++) {
      const responseText = await this.requestOpenAI(
        [
          { role: "system", content: "Ти педагогічний асистент НУШ." },
          { role: "user", content: currentPrompt },
        ],
        model,
        apiKey
      );

      const extMarker = /ExternalKnowledgeUsed:\s*(yes|no)/i.exec(responseText);
      const usedExternalKnowledge = (extMarker?.[1] || "no").toLowerCase() === "yes";
      const cleaned = sanitizeModelText(
        responseText.replace(/\n?ExternalKnowledgeUsed:\s*(yes|no)\s*$/i, "")
      );

      const score = countWords(cleaned) - (hasGarbledArtifacts(cleaned) ? 1000 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestText = cleaned;
        bestUsedExternalKnowledge = usedExternalKnowledge;
      }

      if (isExplanationQualitySufficient(cleaned)) {
        bestText = cleaned;
        bestUsedExternalKnowledge = usedExternalKnowledge;
        break;
      }

      currentPrompt = [
        "Попередня відповідь не пройшла перевірку якості.",
        `Потрібно: МІНІМУМ ${MIN_EXPLANATION_WORDS} слів, без артефактів кодування.`,
        "Розшир відповідь суттєво: додай пояснення термінів, 2 приклади, типові помилки та способи виправлення.",
        "Залиш структуру з пунктами і напиши детальніше кожен пункт.",
        "Ось попередня версія (перепиши та доповни):",
        cleaned || "(порожньо)",
        "Наприкінці обов'язково додай: ExternalKnowledgeUsed: yes або ExternalKnowledgeUsed: no",
      ].join("\n");
    }

    return {
      explanation: sanitizeModelText(bestText),
      usedExternalKnowledge: bestUsedExternalKnowledge,
    };
  }

  async generateExplanations(userId: string, items: ITopicExplanationInput[]): Promise<ITopicExplanationResult[]> {
    const user = await userService.getUserById(userId);
    if (!user || user.role !== "student") {
      throw new Error("Forbidden");
    }

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const normalized = items
      .filter((item) => item?.subjectId && item?.topic)
      .slice(0, 12);

    const subjectIds = Array.from(new Set(normalized.map((item) => item.subjectId)));
    for (const subjectId of subjectIds) {
      const hasAccess = await (journalModel as any).exists({
        subject: subjectId,
        grade: user.grade,
        "entries.student": userId,
      });
      if (!hasAccess) {
        throw new Error("Forbidden");
      }
    }

    const output: ITopicExplanationResult[] = [];
    for (const item of normalized) {
      const topicKey = this.normalizeTopic(item.topic);
      const snippetHash = this.hashSnippet(item.snippet || "");
      const forceRegenerate = item.forceRegenerate === true;

      if (!forceRegenerate) {
        const cached = await explanationCacheModel.findOne({
          studentId: userId,
          subjectId: item.subjectId,
          topicKey,
          snippetHash,
        });

        const cachedText = sanitizeModelText(cached?.explanation || "");
        const cachedIsValid =
          !!cached && countWords(cachedText) >= MIN_EXPLANATION_WORDS && !hasGarbledArtifacts(cachedText);

        if (cached && cachedIsValid) {
          output.push({
            lessonDate: item.lessonDate,
            topic: item.topic,
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            materialTitle: item.materialTitle,
            explanation: cachedText,
            usedExternalKnowledge: cached.usedExternalKnowledge,
            cached: true,
          });
          continue;
        }
      }

      const ai = await this.callOpenAIForExplanation(item);

      await explanationCacheModel.findOneAndUpdate(
        {
          studentId: userId,
          subjectId: item.subjectId,
          topicKey,
          snippetHash,
        },
        {
          studentId: userId,
          subjectId: item.subjectId,
          lessonDate: item.lessonDate,
          topicKey,
          snippetHash,
          materialTitle: item.materialTitle || null,
          explanation: ai.explanation,
          usedExternalKnowledge: ai.usedExternalKnowledge,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      output.push({
        lessonDate: item.lessonDate,
        topic: item.topic,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        materialTitle: item.materialTitle,
        explanation: ai.explanation,
        usedExternalKnowledge: ai.usedExternalKnowledge,
        cached: false,
      });
    }

    return output;
  }

  async generatePodcastAudio(
    userId: string,
    payload: IPodcastRequestInput
  ): Promise<{ audioBuffer: Buffer; fileName: string; mimeType: string }> {
    const user = await userService.getUserById(userId);
    if (!user || user.role !== "student") {
      throw new Error("Forbidden");
    }

    const subjectId = (payload?.subjectId || "").trim();
    const subjectName = sanitizeModelText((payload?.subjectName || "Предмет").trim());
    const items = Array.isArray(payload?.items) ? payload.items : [];

    if (!subjectId) {
      throw new Error("subjectId is required");
    }

    const hasAccess = await (journalModel as any).exists({
      subject: subjectId,
      grade: user.grade,
      "entries.student": userId,
    });
    if (!hasAccess) {
      throw new Error("Forbidden");
    }

    const normalizedItems = items
      .filter((item) => item?.topic && item?.explanation)
      .slice(0, 12)
      .map((item, index) => {
        const topic = sanitizeModelText(item.topic || `Тема ${index + 1}`);
        const explanation = sanitizeModelText(item.explanation || "").slice(0, 1800);
        return { topic, explanation };
      })
      .filter((item) => item.explanation.length > 0);

    if (!normalizedItems.length) {
      throw new Error("No explanations available for podcast generation");
    }

    const intro = `Вітаю! Це короткий навчальний подкаст з предмету ${subjectName}. Розберемо пропущені теми послідовно і простими словами.`;
    const body = normalizedItems
      .map((item, index) => `${ukrainianSectionLabel(index)}. Назва: ${item.topic}. ${item.explanation}`)
      .join("\n\n");
    const outro = "Дякую за увагу! Прослухай подкаст ще раз і дай відповіді на питання для самоперевірки після кожної теми.";

    const rawPodcastText = sanitizeModelText(`${intro}\n\n${body}\n\n${outro}`);
    const input = rawPodcastText.length > MAX_TTS_INPUT_CHARS
      ? `${rawPodcastText.slice(0, MAX_TTS_INPUT_CHARS - 120)}\n\nПродовження тем доступне у текстових поясненнях на сторінці.`
      : rawPodcastText;

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is not configured (OPENAI_API_KEY or OPEN_AI_API_KEY)");
    }

    const preferredModel = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const fallbackModel = "tts-1";
    const voice = process.env.OPENAI_TTS_VOICE || "alloy";
    const instructions =
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      "Говори чіткою літературною українською мовою для учнів, з природною дикцією, без англійського акценту. Вимовляй українські слова м'яко та природно, правильно став наголоси у поширених шкільних термінах. Пауза між темами коротка, тон дружній і спокійний.";

    const requestTtsAudio = async (model: string): Promise<Buffer> => {
      const ttsPayload: Record<string, any> = {
        model,
        voice,
        input,
        response_format: "mp3",
        speed: 1,
      };

      // Instruction-aware model provides better pronunciation control.
      if (model.includes("gpt-4o-mini-tts")) {
        ttsPayload.instructions = instructions;
      }

      const bodyJson = JSON.stringify(ttsPayload);

      return await new Promise<Buffer>((resolve, reject) => {
        const req = https.request(
          {
            hostname: "api.openai.com",
            path: "/v1/audio/speech",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "Content-Length": Buffer.byteLength(bodyJson),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            res.on("end", () => {
              const full = Buffer.concat(chunks);
              if (!res.statusCode || res.statusCode >= 300) {
                return reject(
                  new Error(`OpenAI TTS error (${model}): ${res.statusCode || 500} ${full.toString("utf8")}`)
                );
              }
              resolve(full);
            });
          }
        );

        req.on("error", (err) => reject(err));
        req.write(bodyJson);
        req.end();
      });
    };

    let audioBuffer: Buffer;
    try {
      audioBuffer = await requestTtsAudio(preferredModel);
    } catch (error: any) {
      if (preferredModel !== fallbackModel) {
        audioBuffer = await requestTtsAudio(fallbackModel);
      } else {
        throw error;
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `podcast-${sanitizeFileBaseName(subjectName)}-${stamp}.mp3`;
    return {
      audioBuffer,
      fileName,
      mimeType: "audio/mpeg",
    };
  }

  async matchTopicsWithMaterials(userId: string, missedLessons: IMissedLessonInput[]): Promise<ITopicMaterialMatch[]> {
    const user = await userService.getUserById(userId);
    if (!user || user.role !== "student") {
      throw new Error("Forbidden");
    }

    if (!Array.isArray(missedLessons) || !missedLessons.length) {
      return [];
    }

    const lessons = missedLessons
      .filter((lesson) => lesson?.subjectId && lesson?.topic)
      .slice(0, 100);

    if (!lessons.length) {
      return [];
    }

    const bySubject = new Map<string, IMissedLessonInput[]>();
    for (const lesson of lessons) {
      const group = bySubject.get(lesson.subjectId) || [];
      group.push(lesson);
      bySubject.set(lesson.subjectId, group);
    }

    const subjectMaterialCache = new Map<string, SubjectMaterialBundle>();

    for (const subjectId of bySubject.keys()) {
      const hasAccess = await (journalModel as any).exists({
        subject: subjectId,
        grade: user.grade,
        "entries.student": userId,
      });

      if (!hasAccess) {
        subjectMaterialCache.set(subjectId, { parsed: [], rawMaterialTitles: [] });
        continue;
      }

      const subject = await subjectModel.findById(subjectId).select("name materials");
      const materials = ((subject as any)?.materials || []) as any[];

      const parsedMaterials: MaterialText[] = [];
      const rawMaterialTitles: string[] = [];
      const seenStoragePaths = new Set<string>();
      for (const material of materials) {
        rawMaterialTitles.push(material?.title || "PDF матеріал");
        const storagePath = material?.storagePath;
        if (!storagePath) continue;
        seenStoragePaths.add(storagePath);

        try {
          const pdfBuffer = await googleStorageService.downloadToBuffer(storagePath);
          const parser = new PDFParse({ data: pdfBuffer });
          const parsed = await parser.getText();
          await parser.destroy();
          const extractedText = normalizeText(parsed.text || "");
          if (!extractedText) continue;

          parsedMaterials.push({
            title: material?.title || "PDF матеріал",
            text: extractedText,
          });
        } catch {
          // Skip broken/unreachable files and continue matching with remaining materials.
        }
      }

      // Always scan bucket files by subject prefix to avoid DB metadata drift.
      try {
        const discoveredPaths = await googleStorageService.listFilesByPrefix(`subjects/${subjectId}/`);

        for (const storagePath of discoveredPaths) {
          if (seenStoragePaths.has(storagePath)) continue;

          const lower = storagePath.toLowerCase();
          if (!lower.endsWith(".pdf")) continue;

          const derivedTitle = titleFromStoragePath(storagePath);
          rawMaterialTitles.push(derivedTitle);
          seenStoragePaths.add(storagePath);

          try {
            const pdfBuffer = await googleStorageService.downloadToBuffer(storagePath);
            const parser = new PDFParse({ data: pdfBuffer });
            const parsed = await parser.getText();
            await parser.destroy();
            const extractedText = normalizeText(parsed.text || "");
            if (!extractedText) continue;

            parsedMaterials.push({
              title: derivedTitle,
              text: extractedText,
            });
          } catch {
            // Ignore individual file failures and continue with others.
          }
        }
      } catch {
        // Ignore listing failures and keep existing DB-based data only.
      }

      subjectMaterialCache.set(subjectId, {
        parsed: parsedMaterials,
        rawMaterialTitles,
      });
    }

    const result: ITopicMaterialMatch[] = [];

    for (const lesson of lessons) {
      const bundle = subjectMaterialCache.get(lesson.subjectId) || { parsed: [], rawMaterialTitles: [] };
      const materials = bundle.parsed;
      const keywords = topicKeywords(lesson.topic);

      let best: { score: number; snippet: string; materialTitle: string | null } = {
        score: 0,
        snippet: "",
        materialTitle: null,
      };
      const candidates: ChunkCandidate[] = [];

      for (const material of materials) {
        const keywordWindows = extractKeywordWindows(material.text, keywords);
        const coarseChunks = splitIntoChunks(material.text);
        const chunks = [...keywordWindows, ...coarseChunks];
        if (chunks.length > 0 && !best.snippet) {
          best = {
            score: 0.11,
            snippet: chunks[0].slice(0, 900),
            materialTitle: material.title,
          };
        }
        for (const chunk of chunks) {
          const score = scoreChunk(chunk, keywords);
          if (score >= 0.35) {
            candidates.push({
              score,
              snippet: chunk.slice(0, 700),
              materialTitle: material.title,
            });
          }
          if (score > best.score) {
            best = {
              score,
              snippet: chunk.slice(0, 900),
              materialTitle: material.title,
            };
          }
        }
      }

      let snippet = best.snippet;
      let materialTitle = best.materialTitle;

      if (candidates.length > 0) {
        const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
        const unique: ChunkCandidate[] = [];
        const seenSnippetKeys = new Set<string>();

        // 1) Diversity pass: pick best candidate from each material first.
        const bestByMaterial = new Map<string, ChunkCandidate>();
        for (const candidate of sortedCandidates) {
          const materialKey = candidate.materialTitle || "__unknown_material__";
          if (!bestByMaterial.has(materialKey)) {
            bestByMaterial.set(materialKey, candidate);
          }
        }

        for (const candidate of Array.from(bestByMaterial.values()).sort((a, b) => b.score - a.score)) {
          const key = candidate.snippet.slice(0, 120).toLowerCase();
          if (seenSnippetKeys.has(key)) continue;
          seenSnippetKeys.add(key);
          unique.push(candidate);
          if (unique.length >= 5) break;
        }

        // 2) Fill remaining slots with globally strongest snippets.
        if (unique.length < 5) {
          for (const candidate of sortedCandidates) {
            const key = candidate.snippet.slice(0, 120).toLowerCase();
            if (seenSnippetKeys.has(key)) continue;
            seenSnippetKeys.add(key);
            unique.push(candidate);
            if (unique.length >= 5) break;
          }
        }

        const titles = Array.from(new Set(unique.map((c) => c.materialTitle).filter(Boolean)));
        materialTitle = titles.length === 1 ? (titles[0] || null) : "Кілька матеріалів";
        snippet = unique
          .map((item, index) => {
            const header = item.materialTitle ? `[${index + 1}] ${item.materialTitle}` : `[${index + 1}] Фрагмент`;
            return `${header}\n${item.snippet}`;
          })
          .join("\n\n");
      }

      if (!materialTitle && bundle.rawMaterialTitles.length > 0) {
        materialTitle = bundle.rawMaterialTitles[0];
      }

      if (!snippet) {
        if (bundle.rawMaterialTitles.length === 0) {
          snippet = "Для цього предмета ще не завантажено PDF-матеріали.";
        } else if (materials.length === 0) {
          snippet = "PDF-матеріали знайдено, але не вдалося витягти з них текст. Спробуйте інший PDF або перевірте якість/формат файлу.";
        } else {
          snippet = "PDF-матеріал знайдено, але не вдалося виділити релевантний текстовий фрагмент для цієї теми.";
        }
      }

      result.push({
        lessonDate: lesson.date,
        topic: lesson.topic,
        subjectId: lesson.subjectId,
        subjectName: lesson.subjectName,
        materialTitle,
        snippet,
        score: best.score,
      });
    }

    return result;
  }
})();

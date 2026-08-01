import { EXPENSE_CATEGORIES, LEGACY_EXPENSE_CATEGORY_ALIASES } from '../constants/financeConstants.js';
import { VALID_CURRENCIES } from '../constants/currencies.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

const ANALYSIS_SCHEMA = `{
  "date": "string — receipt date as YYYY-MM-DD when visible, else empty string",
  "category": "string — must be one of the allowed expense categories",
  "description": "string — concise expense description for the ledger (merchant + what was paid for)",
  "amount": "number — total amount charged on the receipt (not unit price)",
  "currency": "string — ISO currency code visible on the receipt (e.g. XAF, USD, EUR)",
  "reference": "string — invoice, receipt, or PO number if visible, else empty string",
  "shipmentId": "string — shipment / tracking / container id if clearly present, else empty string"
}`;

function buildPrompt() {
  return `You are an expert bookkeeper for CargoTrader, an import and resale ERP in Central Africa (Cameroon).
Analyze this EXPENSE RECEIPT / INVOICE photo and extract fields to auto-fill a Record Expense form.

Return ONLY valid JSON matching this schema (no markdown):
${ANALYSIS_SCHEMA}

Allowed category values (pick the closest exact match):
${EXPENSE_CATEGORIES.join(', ')}

Allowed currency codes when visible (otherwise use XAF):
${VALID_CURRENCIES.join(', ')}

Guidelines:
- Prefer the final TOTAL / amount due, not subtotals or tax-only lines
- If multiple currencies appear, use the currency of the total paid
- description: short and practical for an expense ledger (e.g. "Douala port freight — Maersk invoice")
- category: map merchant/type to the closest allowed category (freight bills → Freight & Shipping, customs → Customs & Duties, rent → Rent / Storage, fuel/taxi → Vehicle / Delivery, etc.)
- date: use printed receipt date when readable; leave empty if unclear
- Never invent a shipment id — only fill when clearly printed`;
}

export function matchExpenseCategory(aiCategory) {
  if (!aiCategory || typeof aiCategory !== 'string') return 'Others (repairs, fees, misc.)';
  const normalized = aiCategory.trim();
  const aliased = LEGACY_EXPENSE_CATEGORY_ALIASES[normalized] || normalized;
  const lower = aliased.toLowerCase();
  const exact = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const partial = EXPENSE_CATEGORIES.find(
    (c) => lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)
  );
  return partial || 'Others (repairs, fees, misc.)';
}

function matchCurrency(code) {
  const raw = String(code || 'XAF').trim().toUpperCase();
  if (VALID_CURRENCIES.includes(raw)) return raw;
  return 'XAF';
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function readEnvKey(name) {
  const raw = process.env[name];
  if (!raw) return '';
  return String(raw).trim().replace(/^['"]|['"]$/g, '');
}

function invalidKeyHelp(provider) {
  if (provider === 'openai') {
    return 'Check OPENAI_API_KEY in server/.env — create a new key at https://platform.openai.com/api-keys, ensure billing is active, then restart the server.';
  }
  return 'Check GEMINI_API_KEY in server/.env — create a key at https://aistudio.google.com/apikey, then restart the server.';
}

function wrapProviderError(provider, err, status) {
  const msg = String(err?.message || err || 'Request failed');
  const isAuth =
    status === 401 ||
    status === 403 ||
    /api key|invalid.*key|incorrect.*key|permission|unauthorized/i.test(msg);
  if (isAuth) {
    return Object.assign(new Error(`${provider} rejected the API key. ${invalidKeyHelp(provider)}`), {
      statusCode: 503
    });
  }
  const isQuota =
    status === 429 ||
    /quota|rate.?limit|resource.?exhausted|limit:\s*0/i.test(msg);
  if (isQuota) {
    const hint =
      provider === 'Gemini'
        ? 'Try another GEMINI_VISION_MODEL (e.g. gemini-2.5-flash), wait a minute and retry, or enable billing at https://aistudio.google.com/apikey'
        : 'Check billing and usage limits on your OpenAI account.';
    return Object.assign(
      new Error(`${provider} quota or rate limit reached. ${hint}`),
      { statusCode: 429 }
    );
  }
  return Object.assign(new Error(`[${provider}] ${msg}`), { statusCode: status >= 500 ? 502 : 400 });
}

function geminiModelsToTry() {
  const preferred = process.env.GEMINI_VISION_MODEL || DEFAULT_GEMINI_MODEL;
  return [...new Set([preferred, ...GEMINI_MODEL_FALLBACKS])];
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data URL');
  return { mime: match[1], base64: match[2] };
}

function parseJsonResponse(text) {
  const trimmed = String(text).trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

function normalizeAnalysis(raw) {
  const amount = Math.max(0, Number(raw.amount) || 0);
  return {
    date: normalizeDate(raw.date),
    category: matchExpenseCategory(raw.category),
    description: String(raw.description || '').trim().slice(0, 200),
    amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
    currency: matchCurrency(raw.currency),
    reference: String(raw.reference || '').trim().slice(0, 80),
    shipmentId: String(raw.shipmentId || '').trim().slice(0, 80)
  };
}

async function analyzeWithOpenAI(imageDataUrl) {
  const apiKey = readEnvKey('OPENAI_API_KEY');
  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY is not configured'), { statusCode: 503 });
  if (!apiKey.startsWith('sk-')) {
    throw Object.assign(
      new Error('OPENAI_API_KEY looks invalid (must start with sk-). Use a key from https://platform.openai.com/api-keys'),
      { statusCode: 503 }
    );
  }

  const model = process.env.AI_VISION_MODEL || DEFAULT_OPENAI_MODEL;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt() },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 900
    })
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `OpenAI request failed (${res.status})`;
    throw wrapProviderError('OpenAI', new Error(msg), res.status);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');
  return normalizeAnalysis(parseJsonResponse(content));
}

async function callGeminiModel(apiKey, model, imageDataUrl) {
  const { mime, base64 } = parseDataUrl(imageDataUrl);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildPrompt() },
            { inline_data: { mime_type: mime, data: base64 } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    })
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `Gemini request failed (${res.status})`;
    const err = wrapProviderError('Gemini', new Error(msg), res.status);
    err.model = model;
    throw err;
  }

  const content = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty response from Gemini');
  return normalizeAnalysis(parseJsonResponse(content));
}

async function analyzeWithGemini(imageDataUrl) {
  const apiKey = readEnvKey('GEMINI_API_KEY');
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY is not configured'), { statusCode: 503 });

  const models = geminiModelsToTry();
  let lastError;

  for (const model of models) {
    try {
      return await callGeminiModel(apiKey, model, imageDataUrl);
    } catch (err) {
      lastError = err;
      const retryable =
        err.statusCode === 429 ||
        /quota|rate.?limit|limit:\s*0/i.test(err.message) ||
        /not found|not supported for generateContent/i.test(err.message);
      if (!retryable) throw err;
      console.warn(`Gemini model ${model} unavailable (${err.message?.slice(0, 100)}…), trying next…`);
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

/**
 * Analyze an expense receipt photo with AI vision.
 * Provider: AI_VISION_PROVIDER=openai|gemini|auto (default auto: OpenAI then Gemini)
 */
export async function analyzeExpenseImageFromDataUrl(imageDataUrl) {
  if (!imageDataUrl?.startsWith('data:image/')) {
    throw Object.assign(new Error('Image must be a base64 data URL (data:image/...)'), { statusCode: 400 });
  }

  const provider = (process.env.AI_VISION_PROVIDER || 'auto').toLowerCase();
  const tryOpenAI = provider === 'openai' || provider === 'auto';
  const tryGemini = provider === 'gemini' || provider === 'auto';

  let lastError;
  const openAiKey = readEnvKey('OPENAI_API_KEY');
  const geminiKey = readEnvKey('GEMINI_API_KEY');

  if (tryOpenAI && openAiKey) {
    try {
      return await analyzeWithOpenAI(imageDataUrl);
    } catch (err) {
      lastError = err;
      if (provider === 'openai') throw err;
    }
  }

  if (tryGemini && geminiKey) {
    try {
      return await analyzeWithGemini(imageDataUrl);
    } catch (err) {
      lastError = err;
      if (provider === 'gemini') throw err;
    }
  }

  if (!openAiKey && !geminiKey) {
    throw Object.assign(
      new Error('No AI API key configured. Set OPENAI_API_KEY or GEMINI_API_KEY in server/.env'),
      { statusCode: 503 }
    );
  }

  throw lastError || new Error('AI analysis failed');
}

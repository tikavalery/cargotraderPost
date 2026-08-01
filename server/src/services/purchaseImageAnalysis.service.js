import { INVENTORY_CATEGORIES } from '../constants/categories.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o';
/** Current stable vision model (gemini-1.5-* retired from v1beta) */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

const ANALYSIS_SCHEMA = `{
  "itemName": "string — concise product title for inventory",
  "category": "string — must be one of the allowed categories list",
  "subCategory": "string — more specific type, e.g. Sneakers, Smartphone",
  "condition": "string — grade like New, Like New, Good, Fair, Used, Damaged",
  "suggestedDescription": "string — 1-3 sentences for purchase notes",
  "estimatedPurchasePrice": "number — estimated wholesale/cost price in XAF (Central African CFA franc) for resale in Cameroon"
}`;

const RECEIPT_SCHEMA = `{
  "supplierNameHint": "string — merchant/store name if visible, else empty",
  "purchaseDateHint": "string — YYYY-MM-DD if a date is visible, else empty",
  "items": [
    {
      "itemName": "string — concise product title for inventory",
      "category": "string — must be one of the allowed categories list",
      "quantity": "number — line quantity (default 1)",
      "estimatedPurchasePrice": "number — UNIT cost in XAF (Central African CFA franc)",
      "condition": "string — New, Like New, Good, Fair, Used, or Damaged",
      "suggestedDescription": "string — short note from the receipt line"
    }
  ]
}`;

function buildPrompt() {
  return `You are an expert inventory analyst for CargoTrader, an import and resale ERP in Central Africa (Cameroon).
Analyze the product photo for a NEW PURCHASE record (items sourced abroad for resale).

Return ONLY valid JSON matching this schema (no markdown):
${ANALYSIS_SCHEMA}

Allowed category values (pick the closest exact match):
${INVENTORY_CATEGORIES.join(', ')}

Guidelines:
- itemName: specific brand/model when visible, otherwise descriptive name
- estimatedPurchasePrice: realistic XAF wholesale estimate for similar goods in Cameroon import/resale market
- condition: assess visible wear, packaging, defects
- Be practical for a thrift/import business buying mixed lots`;
}

function buildReceiptPrompt() {
  return `You are an expert purchase clerk for CargoTrader, an import and resale ERP in Central Africa (Cameroon).
Analyze this RECEIPT / INVOICE photo and extract EVERY distinct line item for bulk purchase entry.

Return ONLY valid JSON matching this schema (no markdown):
${RECEIPT_SCHEMA}

Allowed category values (pick the closest exact match for each line):
${INVENTORY_CATEGORIES.join(', ')}

Guidelines:
- Include one object in items[] per purchased product line (skip tax, shipping, totals, payment lines)
- quantity: use the receipt qty; default 1 if missing
- estimatedPurchasePrice: UNIT price converted to XAF (approx. 1 USD ≈ 600 XAF, 1 CNY ≈ 85 XAF if needed)
- If only a line total is shown, divide by quantity to get unit price
- itemName: clear inventory title (brand/model when visible)
- Prefer 1–40 line items; if the receipt is huge, prioritize the clearest lines
- If nothing readable, return { "supplierNameHint": "", "purchaseDateHint": "", "items": [] }`;
}

/** Map AI category text to a valid enum value */
export function matchInventoryCategory(aiCategory) {
  if (!aiCategory || typeof aiCategory !== 'string') return 'Miscellaneous';
  const normalized = aiCategory.trim().toLowerCase();
  const exact = INVENTORY_CATEGORIES.find((c) => c.toLowerCase() === normalized);
  if (exact) return exact;
  const partial = INVENTORY_CATEGORIES.find(
    (c) => normalized.includes(c.toLowerCase()) || c.toLowerCase().includes(normalized)
  );
  return partial || 'Miscellaneous';
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
  const purchasePrice = Math.max(0, Math.round(Number(raw.estimatedPurchasePrice) || 0));
  const category = matchInventoryCategory(raw.category);
  return {
    itemName: String(raw.itemName || '').trim().slice(0, 120),
    category,
    subCategory: String(raw.subCategory || '').trim().slice(0, 80),
    condition: String(raw.condition || 'Good').trim().slice(0, 40),
    suggestedDescription: String(raw.suggestedDescription || '').trim().slice(0, 500),
    estimatedPurchasePrice: purchasePrice,
    suggestedTargetPrice: purchasePrice > 0 ? Math.round(purchasePrice * 1.8) : 0
  };
}

function normalizeReceiptLine(raw) {
  const purchasePrice = Math.max(0, Math.round(Number(raw.estimatedPurchasePrice) || 0));
  const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
  return {
    itemName: String(raw.itemName || '').trim().slice(0, 120),
    category: matchInventoryCategory(raw.category),
    quantity,
    condition: String(raw.condition || 'New').trim().slice(0, 40),
    suggestedDescription: String(raw.suggestedDescription || '').trim().slice(0, 500),
    estimatedPurchasePrice: purchasePrice,
    suggestedTargetPrice: purchasePrice > 0 ? Math.round(purchasePrice * 1.8) : 0
  };
}

function normalizeReceiptAnalysis(raw) {
  const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const items = list
    .map(normalizeReceiptLine)
    .filter((row) => row.itemName)
    .slice(0, 40);
  return {
    supplierNameHint: String(raw?.supplierNameHint || '').trim().slice(0, 120),
    purchaseDateHint: String(raw?.purchaseDateHint || '').trim().slice(0, 10),
    items
  };
}

async function analyzeWithOpenAI(imageDataUrl, { prompt, normalize, maxTokens = 900 } = {}) {
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
            { type: 'text', text: prompt || buildPrompt() },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens
    })
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `OpenAI request failed (${res.status})`;
    throw wrapProviderError('OpenAI', new Error(msg), res.status);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');
  return (normalize || normalizeAnalysis)(parseJsonResponse(content));
}

async function callGeminiModel(apiKey, model, imageDataUrl, { prompt, normalize } = {}) {
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
            { text: prompt || buildPrompt() },
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
  return (normalize || normalizeAnalysis)(parseJsonResponse(content));
}

async function analyzeWithGemini(imageDataUrl, opts = {}) {
  const apiKey = readEnvKey('GEMINI_API_KEY');
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY is not configured'), { statusCode: 503 });

  const models = geminiModelsToTry();
  let lastError;

  for (const model of models) {
    try {
      return await callGeminiModel(apiKey, model, imageDataUrl, opts);
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

async function runVisionProviders(imageDataUrl, opts = {}) {
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
      return await analyzeWithOpenAI(imageDataUrl, opts);
    } catch (err) {
      lastError = err;
      if (provider === 'openai') throw err;
    }
  }

  if (tryGemini && geminiKey) {
    try {
      return await analyzeWithGemini(imageDataUrl, opts);
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

/**
 * Analyze a purchase product photo with AI vision.
 * Provider: AI_VISION_PROVIDER=openai|gemini|auto (default auto: OpenAI then Gemini)
 */
export async function analyzePurchaseImageFromDataUrl(imageDataUrl) {
  return runVisionProviders(imageDataUrl, {
    prompt: buildPrompt(),
    normalize: normalizeAnalysis,
    maxTokens: 900
  });
}

/** Analyze a receipt / invoice photo into multiple purchase line items. */
export async function analyzePurchaseReceiptFromDataUrl(imageDataUrl) {
  return runVisionProviders(imageDataUrl, {
    prompt: buildReceiptPrompt(),
    normalize: normalizeReceiptAnalysis,
    maxTokens: 2500
  });
}

function buildMatchPrompt(lines = []) {
  const catalog = lines
    .map(
      (line, i) =>
        `${i}. key=${line.key} | name=${line.itemName || 'Untitled'} | category=${line.category || ''} | notes=${String(line.notes || '').slice(0, 80)}`
    )
    .join('\n');

  return `You are matching product photos to purchase line items for CargoTrader inventory.

Catalog of purchase lines (match each photo to exactly one line key, or null if unclear):
${catalog || '(empty)'}

Images are provided in order as Photo 0, Photo 1, Photo 2, …

Return ONLY valid JSON (no markdown):
{
  "matches": [
    {
      "photoIndex": 0,
      "lineKey": "string — exact key from catalog, or empty if no good match",
      "confidence": 0.0,
      "identifiedAs": "string — short label of what you see in the photo"
    }
  ]
}

Rules:
- Prefer the best visual match for each photo
- Do not assign the same lineKey to two photos unless the catalog clearly has duplicates
- confidence is 0–1
- Include one entry per photo index`;
}

function normalizeMatchAnalysis(raw, photoCount, catalog = []) {
  const validKeys = new Set(catalog.map((l) => l.key));
  const list = Array.isArray(raw?.matches) ? raw.matches : [];
  const used = new Set();
  const matches = [];

  for (let i = 0; i < photoCount; i += 1) {
    const row = list.find((m) => Number(m?.photoIndex) === i) || list[i] || {};
    let lineKey = String(row.lineKey || '').trim();
    if (lineKey && !validKeys.has(lineKey)) {
      const asIdx = Number(lineKey);
      if (Number.isInteger(asIdx) && asIdx >= 0 && asIdx < catalog.length) {
        lineKey = catalog[asIdx]?.key || '';
      } else {
        lineKey = '';
      }
    }
    if (lineKey && used.has(lineKey)) lineKey = '';
    if (lineKey) used.add(lineKey);
    matches.push({
      photoIndex: i,
      lineKey,
      confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
      identifiedAs: String(row.identifiedAs || '').trim().slice(0, 120)
    });
  }
  return { matches };
}

async function analyzeWithOpenAIMulti(imageDataUrls, { prompt, normalize, maxTokens = 1600 } = {}) {
  const apiKey = readEnvKey('OPENAI_API_KEY');
  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY is not configured'), { statusCode: 503 });
  if (!apiKey.startsWith('sk-')) {
    throw Object.assign(
      new Error('OPENAI_API_KEY looks invalid (must start with sk-). Use a key from https://platform.openai.com/api-keys'),
      { statusCode: 503 }
    );
  }

  const model = process.env.AI_VISION_MODEL || DEFAULT_OPENAI_MODEL;
  const content = [
    { type: 'text', text: prompt },
    ...imageDataUrls.map((url, i) => ({
      type: 'image_url',
      image_url: { url, detail: i < 4 ? 'high' : 'low' }
    }))
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens
    })
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `OpenAI request failed (${res.status})`;
    throw wrapProviderError('OpenAI', new Error(msg), res.status);
  }
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenAI');
  return normalize(parseJsonResponse(text));
}

async function analyzeWithGeminiMulti(imageDataUrls, { prompt, normalize } = {}) {
  const apiKey = readEnvKey('GEMINI_API_KEY');
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY is not configured'), { statusCode: 503 });

  const models = geminiModelsToTry();
  let lastError;

  for (const model of models) {
    try {
      const parts = [{ text: prompt }];
      for (const dataUrl of imageDataUrls) {
        const { mime, base64 } = parseDataUrl(dataUrl);
        parts.push({ inline_data: { mime_type: mime, data: base64 } });
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
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
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      return normalize(parseJsonResponse(text));
    } catch (err) {
      lastError = err;
      const retryable =
        err.statusCode === 429 ||
        /quota|rate.?limit|limit:\s*0/i.test(err.message) ||
        /not found|not supported for generateContent/i.test(err.message);
      if (!retryable) throw err;
      console.warn(`Gemini model ${model} unavailable for match (${err.message?.slice(0, 100)}…), trying next…`);
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

async function runMultiVisionProviders(imageDataUrls, opts) {
  const provider = (process.env.AI_VISION_PROVIDER || 'auto').toLowerCase();
  const tryOpenAI = provider === 'openai' || provider === 'auto';
  const tryGemini = provider === 'gemini' || provider === 'auto';
  const openAiKey = readEnvKey('OPENAI_API_KEY');
  const geminiKey = readEnvKey('GEMINI_API_KEY');
  let lastError;

  if (tryOpenAI && openAiKey) {
    try {
      return await analyzeWithOpenAIMulti(imageDataUrls, opts);
    } catch (err) {
      lastError = err;
      if (provider === 'openai') throw err;
    }
  }
  if (tryGemini && geminiKey) {
    try {
      return await analyzeWithGeminiMulti(imageDataUrls, opts);
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
  throw lastError || new Error('AI matching failed');
}

/**
 * Match product photos to bulk purchase line items.
 * @param {string[]} photos data URLs
 * @param {{ key: string, itemName?: string, category?: string, notes?: string }[]} lines
 */
export async function matchBulkItemPhotosToLines(photos = [], lines = []) {
  const imageDataUrls = (photos || []).filter((p) => typeof p === 'string' && p.startsWith('data:image/'));
  if (!imageDataUrls.length) {
    throw Object.assign(new Error('Provide at least one product photo as a data URL'), { statusCode: 400 });
  }
  if (imageDataUrls.length > 12) {
    throw Object.assign(new Error('Match at most 12 product photos at a time'), { statusCode: 400 });
  }
  const catalog = (lines || [])
    .map((line) => ({
      key: String(line.key || '').trim(),
      itemName: String(line.itemName || '').trim(),
      category: String(line.category || '').trim(),
      notes: String(line.notes || '').trim()
    }))
    .filter((line) => line.key && line.itemName);
  if (!catalog.length) {
    throw Object.assign(new Error('Add purchase lines before matching photos'), { statusCode: 400 });
  }

  const prompt = buildMatchPrompt(catalog);

  // Chunk large sets to keep payloads manageable; merge results
  const chunkSize = 6;
  const allMatches = [];
  for (let offset = 0; offset < imageDataUrls.length; offset += chunkSize) {
    const chunk = imageDataUrls.slice(offset, offset + chunkSize);
    const chunkPrompt = `${prompt}\n\nFor THIS request, Photo 0 is global index ${offset}, Photo 1 is ${offset + 1}, etc. Still return photoIndex as 0..${chunk.length - 1} relative to this batch.`;
    const result = await runMultiVisionProviders(chunk, {
      prompt: chunkPrompt,
      normalize: (raw) => normalizeMatchAnalysis(raw, chunk.length, catalog),
      maxTokens: 1800
    });
    for (const m of result.matches) {
      allMatches.push({
        ...m,
        photoIndex: offset + Number(m.photoIndex)
      });
    }
  }

  // Re-resolve unique line assignments globally (first higher-confidence wins)
  const byPhoto = [...allMatches].sort((a, b) => b.confidence - a.confidence);
  const used = new Set();
  const final = Array.from({ length: imageDataUrls.length }, (_, i) => ({
    photoIndex: i,
    lineKey: '',
    confidence: 0,
    identifiedAs: ''
  }));
  for (const m of byPhoto) {
    const idx = Number(m.photoIndex);
    if (!final[idx]) continue;
    if (final[idx].lineKey) continue;
    let key = m.lineKey;
    if (key && used.has(key)) key = '';
    if (key) used.add(key);
    final[idx] = {
      photoIndex: idx,
      lineKey: key,
      confidence: m.confidence,
      identifiedAs: m.identifiedAs
    };
  }

  return { matches: final };
}

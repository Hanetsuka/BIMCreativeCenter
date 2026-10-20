/**
 * BIM CREATIVE HUB — AI Provider Abstraction Layer
 * Decouples UI & business workflows from specific external AI vendors (Gemini, OpenAI, Anthropic, Stability).
 * Strictly server-side: API keys are read from secret environment variables and never exposed to the client.
 */
export interface AIProviderConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'local-sandbox';
  textModel: string;
  imageModel: string;
  embeddingModel: string;
  timeoutMs: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: '1:1' | '4:5' | '3:4' | '9:16' | '16:9' | '3:2' | '2:3';
  quality: 'Standard' | 'High Quality' | 'HD / High Resolution' | 'Upscale';
}

export const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '4:5':  { width: 1024, height: 1280 },
  '3:4':  { width: 960,  height: 1280 },
  '9:16': { width: 1024, height: 1792 },
  '16:9': { width: 1792, height: 1024 },
  '3:2':  { width: 1536, height: 1024 },
  '2:3':  { width: 1024, height: 1536 }
};

export function sanitizeRagDocumentChunk(rawText: string): string {
  // Neutralize prompt injection patterns inside uploaded documents
  return rawText.replace(
    /ignore previous instructions|system override|abaikan instruksi sebelumnya|ambil alih aturan/gi,
    '[SANITIZED_REFERENCE_DATA]'
  );
}

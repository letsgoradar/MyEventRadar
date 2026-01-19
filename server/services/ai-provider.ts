import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface AiCompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface AiCompletionResult {
  success: boolean;
  content?: string;
  provider: 'gemini' | 'openai';
  error?: string;
}

export class AiProvider {
  private static readonly GEMINI_MODEL = "gemini-2.5-flash";
  private static readonly OPENAI_MODEL = "gpt-4o-mini";

  static async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const { systemPrompt, userPrompt, maxTokens = 500, temperature = 0.1, jsonMode = false } = options;

    try {
      const result = await this.tryGemini(systemPrompt, userPrompt, maxTokens, temperature, jsonMode);
      if (result.success) {
        return result;
      }
      console.log(`[AI Provider] Gemini failed: ${result.error}, trying OpenAI fallback...`);
    } catch (error: any) {
      console.log(`[AI Provider] Gemini error: ${error.message}, trying OpenAI fallback...`);
    }

    if (openai) {
      try {
        return await this.tryOpenAI(systemPrompt, userPrompt, maxTokens, temperature, jsonMode);
      } catch (error: any) {
        return {
          success: false,
          provider: 'openai',
          error: `Both AI providers failed. OpenAI: ${error.message}`,
        };
      }
    }

    return {
      success: false,
      provider: 'gemini',
      error: 'Gemini failed and OpenAI is not configured',
    };
  }

  private static async tryGemini(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number,
    jsonMode: boolean
  ): Promise<AiCompletionResult> {
    const fullPrompt = jsonMode 
      ? `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown or other text.\n\n${userPrompt}`
      : `${systemPrompt}\n\n${userPrompt}`;

    const response = await gemini.models.generateContent({
      model: this.GEMINI_MODEL,
      contents: fullPrompt,
      config: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      },
    });

    const content = response.text;
    if (!content) {
      return {
        success: false,
        provider: 'gemini',
        error: 'Empty response from Gemini',
      };
    }

    let cleanedContent = content;
    if (jsonMode) {
      cleanedContent = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
    }

    return {
      success: true,
      content: cleanedContent,
      provider: 'gemini',
    };
  }

  private static async tryOpenAI(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number,
    jsonMode: boolean
  ): Promise<AiCompletionResult> {
    if (!openai) {
      return {
        success: false,
        provider: 'openai',
        error: 'OpenAI not configured',
      };
    }

    const response = await openai.chat.completions.create({
      model: this.OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode && { response_format: { type: "json_object" as const } }),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        provider: 'openai',
        error: 'Empty response from OpenAI',
      };
    }

    return {
      success: true,
      content,
      provider: 'openai',
    };
  }
}

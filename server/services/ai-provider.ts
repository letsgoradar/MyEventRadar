import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

let openaiInstance: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!openaiInstance && process.env.OPENAI_API_KEY) {
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

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

    const openai = getOpenAI();
    if (openai) {
      try {
        console.log('[AI Provider] Attempting OpenAI fallback...');
        return await this.tryOpenAI(systemPrompt, userPrompt, maxTokens, temperature, jsonMode);
      } catch (error: any) {
        console.log(`[AI Provider] OpenAI fallback also failed: ${error.message}`);
        return {
          success: false,
          provider: 'openai',
          error: `Both AI providers failed. OpenAI: ${error.message}`,
        };
      }
    } else {
      console.log('[AI Provider] OpenAI not configured (no API key)');
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
    let fullPrompt: string;
    if (jsonMode) {
      fullPrompt = `${systemPrompt}

CRITICAL INSTRUCTIONS FOR JSON OUTPUT:
1. You MUST respond with ONLY a valid JSON object
2. Do NOT include any text before or after the JSON
3. Do NOT use markdown code blocks (\`\`\`json)
4. Ensure all strings are properly quoted with double quotes
5. Ensure all property names are quoted
6. Do NOT include trailing commas
7. Start your response with { and end with }

${userPrompt}`;
    } else {
      fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    }

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
      
      // Try to extract JSON object if response contains extra text
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      // Validate JSON before returning
      try {
        JSON.parse(cleanedContent);
      } catch (e) {
        console.log('[AI Provider] Gemini returned invalid JSON, attempting to fix...');
        // Try to fix common issues
        cleanedContent = cleanedContent
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
          .replace(/'/g, '"')       // Replace single quotes with double quotes
          .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys
        
        try {
          JSON.parse(cleanedContent);
        } catch (e2) {
          return {
            success: false,
            provider: 'gemini',
            error: `Invalid JSON from Gemini: ${(e as Error).message}`,
          };
        }
      }
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
    const openaiClient = getOpenAI();
    if (!openaiClient) {
      return {
        success: false,
        provider: 'openai',
        error: 'OpenAI not configured',
      };
    }

    const response = await openaiClient.chat.completions.create({
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

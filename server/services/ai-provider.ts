import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface AiCompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  model?: 'flash' | 'pro';
}

export interface AiCompletionResult {
  success: boolean;
  content?: string;
  provider: 'gemini';
  error?: string;
}

export class AiProvider {
  private static readonly GEMINI_MODEL_FLASH = "gemini-2.5-flash";
  private static readonly GEMINI_MODEL_PRO = "gemini-2.5-pro";
  private static retryCount = 0;
  private static readonly MAX_RETRIES = 1;
  
  private static callCount = 0;
  private static sessionStartTime = Date.now();
  private static readonly MAX_CALLS_PER_SESSION = 50;
  
  static getCallCount(): number {
    return this.callCount;
  }
  
  static getMaxCalls(): number {
    return this.MAX_CALLS_PER_SESSION;
  }
  
  static resetCallCount(): void {
    this.callCount = 0;
    this.sessionStartTime = Date.now();
  }
  
  static isAtLimit(): boolean {
    return this.callCount >= this.MAX_CALLS_PER_SESSION;
  }

  static async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const { systemPrompt, userPrompt, maxTokens = 500, temperature = 0.1, jsonMode = false, model = 'flash' } = options;

    if (this.callCount >= this.MAX_CALLS_PER_SESSION) {
      return {
        success: false,
        provider: 'gemini',
        error: `AI limiet bereikt (${this.MAX_CALLS_PER_SESSION} calls). Stop import om kosten te beheersen.`,
      };
    }

    let lastError = '';
    const maxRetries = model === 'pro' ? 3 : this.MAX_RETRIES;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.callCount++;
        const result = await this.tryGemini(systemPrompt, userPrompt, maxTokens, temperature, jsonMode, model);
        if (result.success) {
          return result;
        }
        lastError = result.error || 'Unknown error';
        
        if (attempt < maxRetries) {
          const delay = (model === 'pro' ? 500 : 250) * (attempt + 1);
          console.log(`[AI Provider] Gemini ${model} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error: any) {
        lastError = error.message;
        if (attempt < maxRetries) {
          const delay = (model === 'pro' ? 500 : 250) * (attempt + 1);
          console.log(`[AI Provider] Gemini ${model} error: ${error.message}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      provider: 'gemini',
      error: `Gemini failed after ${maxRetries + 1} attempts: ${lastError}`,
    };
  }

  private static async tryGemini(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number,
    jsonMode: boolean,
    modelType: 'flash' | 'pro' = 'flash'
  ): Promise<AiCompletionResult> {
    let fullPrompt: string;
    if (jsonMode) {
      fullPrompt = `${systemPrompt}

CRITICAL JSON FORMAT REQUIREMENTS:
- Respond with ONLY a valid JSON object, nothing else
- No markdown formatting, no \`\`\`json code blocks
- All property names must be in double quotes
- All string values must be in double quotes
- No trailing commas
- Keep string values SHORT and CONCISE to avoid truncation
- Your response must start with { and end with }

${userPrompt}`;
    } else {
      fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    }

    const selectedModel = modelType === 'pro' ? this.GEMINI_MODEL_PRO : this.GEMINI_MODEL_FLASH;
    const response = await gemini.models.generateContent({
      model: selectedModel,
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
      cleanedContent = this.cleanJsonResponse(content);
      
      try {
        JSON.parse(cleanedContent);
      } catch (e) {
        const repaired = this.repairTruncatedJson(cleanedContent);
        if (repaired) {
          cleanedContent = repaired;
        } else {
          return {
            success: false,
            provider: 'gemini',
            error: `Invalid JSON: ${(e as Error).message}`,
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

  private static repairTruncatedJson(json: string): string | null {
    const original = json.trim();
    let repaired = original;
    
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    
    let inString = false;
    let escaped = false;
    let lastValidPos = 0;
    
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        if (!inString) {
          lastValidPos = i;
        }
        continue;
      }
      if (!inString) {
        if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ',' || ch === ':') {
          lastValidPos = i;
        }
      }
    }
    
    if (inString) {
      repaired = repaired.substring(0, lastValidPos + 1);
      
      if (repaired.endsWith(':')) {
        repaired = repaired.slice(0, -1);
        const lastComma = repaired.lastIndexOf(',');
        if (lastComma > 0) {
          repaired = repaired.substring(0, lastComma);
        }
      }
      
      if (repaired.endsWith(',')) {
        repaired = repaired.slice(0, -1);
      }
    }
    
    repaired = repaired.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    
    const remainingOpenBraces = (repaired.match(/\{/g) || []).length;
    const remainingCloseBraces = (repaired.match(/\}/g) || []).length;
    const remainingOpenBrackets = (repaired.match(/\[/g) || []).length;
    const remainingCloseBrackets = (repaired.match(/\]/g) || []).length;
    
    for (let i = 0; i < remainingOpenBrackets - remainingCloseBrackets; i++) {
      repaired += ']';
    }
    for (let i = 0; i < remainingOpenBraces - remainingCloseBraces; i++) {
      repaired += '}';
    }
    
    try {
      JSON.parse(repaired);
      if (repaired !== original) {
        console.log('[AI Provider] Successfully repaired truncated JSON');
      }
      return repaired;
    } catch {
      return null;
    }
  }

  private static cleanJsonResponse(content: string): string {
    let cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
    
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    cleaned = cleaned
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ');
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    cleaned = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    cleaned = cleaned.replace(/'/g, '"');
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    cleaned = cleaned.replace(/"([^"]*)"([^:,}\]])/g, (match, p1, p2) => {
      if (p2 && !':,}]'.includes(p2.trim()[0])) {
        return `"${p1.replace(/"/g, '\\"')}"${p2}`;
      }
      return match;
    });
    
    return cleaned;
  }
}

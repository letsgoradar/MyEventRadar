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
}

export interface AiCompletionResult {
  success: boolean;
  content?: string;
  provider: 'gemini';
  error?: string;
}

export class AiProvider {
  private static readonly GEMINI_MODEL = "gemini-2.5-flash";
  private static retryCount = 0;
  private static readonly MAX_RETRIES = 1; // Reduced from 2 for faster failure
  
  // AI call tracking for cost control
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
    const { systemPrompt, userPrompt, maxTokens = 500, temperature = 0.1, jsonMode = false } = options;

    // Check AI call limit
    if (this.callCount >= this.MAX_CALLS_PER_SESSION) {
      return {
        success: false,
        provider: 'gemini',
        error: `AI limiet bereikt (${this.MAX_CALLS_PER_SESSION} calls). Stop import om kosten te beheersen.`,
      };
    }

    let lastError = '';
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.callCount++; // Count each API call attempt
        const result = await this.tryGemini(systemPrompt, userPrompt, maxTokens, temperature, jsonMode);
        if (result.success) {
          return result;
        }
        lastError = result.error || 'Unknown error';
        
        if (attempt < this.MAX_RETRIES) {
          const delay = 250 * (attempt + 1); // Faster: 250ms, 500ms
          console.log(`[AI Provider] Gemini attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error: any) {
        lastError = error.message;
        if (attempt < this.MAX_RETRIES) {
          const delay = 250 * (attempt + 1); // Faster: 250ms, 500ms
          console.log(`[AI Provider] Gemini error: ${error.message}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      provider: 'gemini',
      error: `Gemini failed after ${this.MAX_RETRIES + 1} attempts: ${lastError}`,
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

CRITICAL JSON FORMAT REQUIREMENTS:
- Respond with ONLY a valid JSON object, nothing else
- No markdown formatting, no \`\`\`json code blocks
- All property names must be in double quotes
- All string values must be in double quotes
- No trailing commas
- Your response must start with { and end with }

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
      cleanedContent = this.cleanJsonResponse(content);
      
      try {
        JSON.parse(cleanedContent);
      } catch (e) {
        return {
          success: false,
          provider: 'gemini',
          error: `Invalid JSON: ${(e as Error).message}`,
        };
      }
    }

    return {
      success: true,
      content: cleanedContent,
      provider: 'gemini',
    };
  }

  private static cleanJsonResponse(content: string): string {
    let cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
    
    // Extract JSON object if response contains extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    // Fix common JSON issues step by step
    cleaned = cleaned
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ');  // Multiple spaces to single
    
    // Try to parse, if fails, attempt fixes
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    // Fix 1: Remove trailing commas
    cleaned = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    // Fix 2: Quote unquoted property names (Gemini often outputs unquoted keys)
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    // Fix 3: Replace single quotes with double quotes
    cleaned = cleaned.replace(/'/g, '"');
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {}
    
    // Fix 4: Handle unescaped quotes in string values (complex fix)
    // Try to fix double-quoted strings that contain unescaped double quotes
    cleaned = cleaned.replace(/"([^"]*)"([^:,}\]])/g, (match, p1, p2) => {
      if (p2 && !':,}]'.includes(p2.trim()[0])) {
        return `"${p1.replace(/"/g, '\\"')}"${p2}`;
      }
      return match;
    });
    
    return cleaned;
  }
}

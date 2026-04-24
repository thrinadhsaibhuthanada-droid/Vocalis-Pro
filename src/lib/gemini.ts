import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface TranscriptionOptions {
  mappings?: string;
  tone?: 'default' | 'formal' | 'casual' | 'concise';
  format?: 'prose' | 'list' | 'email' | 'adaptive';
  translateTo?: string;
  inputLanguage?: string;
  waveformSensitivity?: number;
  waveformColor?: string;
  waveformStyle?: 'smooth' | 'sharp' | 'blocks';
  searchHighlightColor?: string;
  enableTTS?: boolean;
  ttsVoice?: string;
  ttsRate?: number;
  fontSize?: number;
  fontFamily?: 'sans' | 'serif' | 'mono';
}

export async function transcribeAudio(base64Audio: string, mimeType: string, options: TranscriptionOptions = {}) {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
You are a professional scribe and linguistic editor. Your goal is to transform SPOKEN audio into polished, high-quality WRITTEN text.

## 1. Disfluency & Filler Removal
- You MUST remove all linguistic disfluencies across all languages.
- Remove fillers: "um", "ah", "uh", "err", "like", "so...", "you know", "basically", etc.
- In Hindi/Telugu context, remove verbal placeholders like "achha", "matlab", "ante", "vachesi" if they are used as fillers rather than meaningful words.
- Explicitly ignore phonetic extensions like "aaa", "aaaah", "hmmm", "ooo" which are often spoken during thought pauses.
- Remove false starts (e.g., "I wanted to— we should go...").
- Remove stutters and repeated words.
- Maintain the natural flow of thought while removing the "noise" of natural speech.

## 2. Natural Pause & Rhythm Interpretation
- Spoken pauses of 1.5s or longer often signify a sentence break or a shift in topic.
- Do NOT create run-on sentences. Use full stops (.) effectively to terminate thoughts where natural pauses occur in the audio.
- If there is a very long silence, treat it as a paragraph break.

## 3. Multilingual Excellence (Hindi & Telugu Focus)
- Support all world languages (English, Telugu, Hindi, Spanish, French, Japanese, etc.).
- Transcribe in the NATIVE SCRIPT of the language spoken:
  - **Telugu**: Use Telugu script (తెలుగు లిపి).
  - **Hindi**: Use Devanagari script (देवనాగరి).
- **Code-Switching**: If the user uses English technical terms or common nouns inside a Hindi/Telugu sentence (e.g., "Meeting schedule చేయండి"), you should keep the English terms in Roman script IF it's common professional practice, otherwise transliterate phonetically to the native script if the user sounds like they are purely speaking the native language.
- Ensure grammatical correctness in the target script, correcting spoken grammatical slips common in rapid speech.

## 4. Intelligent Structuring
- Analyze the CONTENT of the speech to determine the best structure.
- **MEETINGS/PLANNING**: If the user is discussing tasks, action items, or distinct points, use clean bullet points or numbered lists.
- **PROSE/NARRATIVE**: If the user is telling a story or providing a long-form explanation, use well-structured paragraphs.
- **CONTEXTUAL HEADERS**: For longer transcriptions (over 100 words), you MAY add a very brief bold header at the top that describes the session (e.g., **Project Sync Notes** or **Initial Draft: Blog Post**) to provide instant context.
- Always use proper punctuation, capitalization, and paragraph breaks to ensure maximum readability.
- **MARKDOWN FORMATTING**: Use standard Markdown syntax for structuring:
  - Use '# Header' for the main title (if applicable).
  - Use '## Subheader' for sections.
  - Use '**Bold Text**' for emphasis or headers.
  - Use '- ' or '1. ' for lists.
  - **CRITICAL**: Never return raw formatting symbols like asterisks (*) or hashes (#) unless they are strictly part of standard Markdown that will be rendered. Do not add stray symbols before or after sentences. If the text should be bold, wrap it correctly in double asterisks, but ensure NO other stars are visible.

## 5. Personalization & Tone
- Respect the MAPPINGS provided for specific terminology.
- Adjust the final polish based on the requested TONE (Formal, Casual, etc.).

## 6. Output Format
- Return ONLY the final transcription.
- DO NOT add comments like "Here is your transcription" or "Transcribed:".
- DO NOT wrap the output in markdown code blocks unless the transcription itself is code.
`;

  let promptPrefix = "";
  if (options.mappings) {
    promptPrefix += `MAPPINGS block:\n${options.mappings}\n\n`;
  }
  
  if (options.inputLanguage && options.inputLanguage !== 'auto') {
    promptPrefix += `The user is speaking in: ${options.inputLanguage}. Please focus on this language for transcription.\n`;
  }

  if (options.tone && options.tone !== 'default') {
    promptPrefix += `Desired tone: ${options.tone}\n`;
  }
  if (options.format && options.format !== 'prose') {
    if (options.format === 'adaptive') {
      promptPrefix += `Desired format: Adaptive AI Structuring. Analyze the speech and decide if it should be list-based, email-style, or paragraph-prose based on content.\n`;
    } else {
      promptPrefix += `Desired format: ${options.format}\n`;
    }
  }
  if (options.translateTo) {
    promptPrefix += `Translate the final result to: ${options.translateTo}\n`;
  }

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: promptPrefix || "Transcribe this audio following the system rules." },
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType
            }
          }
        ]
      }
    ],
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.2, // Low temperature for transcription accuracy
    }
  });

  return response.text;
}

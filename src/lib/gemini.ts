import { GoogleGenAI, Modality } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please ensure your API key is correctly configured in your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

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

  const modelName = "gemini-3-flash-preview";
  const ai = getAI();

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
    model: modelName,
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

/**
 * Text to Speech using Gemini 3.1 Flash TTS model.
 * Includes chunking for long text to avoid API timeouts/errors.
 */
export async function textToSpeech(text: string, voiceName: string = 'Kore') {
  const ai = getAI();
  const modelName = "gemini-3.1-flash-tts-preview";
  
  // Chunk text if it's too long (Gemini TTS likes small chunks for stability in preview)
  const MAX_CHARS = 400; // Reduced from 800 for better reliability
  
  // Split text into sentences or chunks carefully
  const chunks: string[] = [];
  if (text.length <= MAX_CHARS) {
    chunks.push(text);
  } else {
    // Split by punctuation first, then by space if needed
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > MAX_CHARS && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
  }

  try {
    const audioResults: string[] = [];
    
    for (const chunk of chunks) {
      // Add a tiny delay between chunks if multiple
      if (chunks.indexOf(chunk) > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: `${chunk}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        audioResults.push(base64Audio);
      }
    }

    if (audioResults.length === 0) return null;
    if (audioResults.length === 1) return audioResults[0];

    // Combine PCM chunks
    // Since we are combining Base64 PCM, we need to decode them, join the bytes, then re-encode.
    const combinedBytes = concatenateBase64Pcm(audioResults);
    return combinedBytes;
  } catch (err) {
    console.error("Gemini TTS Error:", err);
    throw err;
  }
}

function concatenateBase64Pcm(base64Strings: string[]): string {
  const byteArrays = base64Strings.map(b64 => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  });

  const totalLength = byteArrays.reduce((acc, curr) => acc + curr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of byteArrays) {
    combined.set(array, offset);
    offset += array.length;
  }

  // Convert back to base64
  let binary = "";
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}


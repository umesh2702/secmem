import { GoogleGenAI } from '@google/genai';
import { Memory } from '@/types/database';

const apiKey = process.env.GEMINI_API_KEY;

export function isGeminiAvailable(): boolean {
  return !!apiKey && apiKey.trim() !== '' && apiKey !== 'your-gemini-api-key';
}

function getAiClient(): GoogleGenAI | null {
  if (!isGeminiAvailable()) return null;
  return new GoogleGenAI({ apiKey: apiKey! });
}

export async function generateImageDescription(
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  const ai = getAiClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || 'image/jpeg',
              },
            },
            {
              text: 'Provide a concise 1-sentence searchable description of this image for a private memory vault.',
            },
          ],
        },
      ],
    });

    return response.text || null;
  } catch (err) {
    console.warn('Gemini vision description failed:', err);
    return null;
  }
}

export async function askMemoryWithGemini(
  query: string,
  memories: Memory[]
): Promise<{ answer: string; citedMemoryIds: string[] }> {
  const ai = getAiClient();

  if (!memories || memories.length === 0) {
    return {
      answer: "I couldn't find anything relevant in our memories.",
      citedMemoryIds: [],
    };
  }

  // Build fallback response if AI unavailable or rate limited
  const topMem = memories[0];
  const fallbackAnswer = topMem
    ? `Based on our shared vault memory: "${topMem.content}"`
    : "I couldn't find anything relevant in our memories.";

  if (!ai) {
    return {
      answer: fallbackAnswer,
      citedMemoryIds: memories.slice(0, 3).map((m) => m.id),
    };
  }

  // Format retrieved memory context
  const memoryContextStr = memories
    .map((m) => {
      const authorName = m.author?.full_name || 'Member';
      const date = new Date(m.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const tags = m.tags?.map((t) => `#${t.name}`).join(' ') || '';
      return `[MEMORY ID: ${m.id}] (Date: ${date}, Author: ${authorName}, Type: ${m.type})
Title: ${m.title || 'Untitled'}
Content: ${m.content}
${tags ? `Tags: ${tags}` : ''}`;
    })
    .join('\n---\n');

  const systemPrompt = `You are "Our Memory AI", a helpful memory vault assistant.
STRICT ANTI-HALLUCINATION RULE:
- Answer the user's question ONLY based on the provided RETRIEVED MEMORIES below.
- Do NOT invent facts or assume outside details.
- If the retrieved memories do NOT contain relevant information to answer the question, reply exactly:
  "I couldn't find anything relevant in our memories."
- At the end of your answer, list the exact Memory IDs you cited in JSON bracket format, e.g. [CITED_IDS: ["id1", "id2"]].

RETRIEVED MEMORIES:
${memoryContextStr}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: `USER QUESTION: "${query}"` },
          ],
        },
      ],
    });

    const rawAnswer = response.text || fallbackAnswer;

    // Parse cited memory IDs
    const citedIds: string[] = [];
    const citedMatch = rawAnswer.match(/\[CITED_IDS:\s*(\[[^\]]*\])\]/);
    if (citedMatch && citedMatch[1]) {
      try {
        const parsed = JSON.parse(citedMatch[1]);
        if (Array.isArray(parsed)) {
          citedIds.push(...parsed);
        }
      } catch {
        // fallback
      }
    }

    const cleanAnswer = rawAnswer.replace(/\[CITED_IDS:[\s\S]*?\]/, '').trim();
    const finalCitedIds = citedIds.length > 0 ? citedIds : memories.slice(0, 3).map((m) => m.id);

    return {
      answer: cleanAnswer,
      citedMemoryIds: finalCitedIds,
    };
  } catch (err: unknown) {
    console.warn('Gemini API call warning (using vault fallback):', err instanceof Error ? err.message : err);
    return {
      answer: fallbackAnswer,
      citedMemoryIds: memories.slice(0, 3).map((m) => m.id),
    };
  }
}

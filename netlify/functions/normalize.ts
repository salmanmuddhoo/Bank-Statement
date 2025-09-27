/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { GoogleGenAI, GenerateContentResponse, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

const MODEL_NAME = "gemini-2.5-flash";

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    throw new Error("Gemini API Key not configured on the server.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "API key is not configured on the server. Please set the API_KEY environment variable in your Netlify site settings." }),
    };
  }

  try {
    const { clientNames } = JSON.parse(event.body || '{}');
    if (!clientNames || !Array.isArray(clientNames)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing or invalid clientNames in request body.' }),
      };
    }
    
    if (clientNames.length === 0) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nameMap: {} }),
        };
    }

    const currentAi = getAiInstance();

    const prompt = `Review the following list of client names. Some names might be variations of the same person (e.g., "Salman Muddhoo", "Mr Salman Muddhoo", "MUHAMMUD SALMAN MUDDHOO"). Group these similar names together under a single, standardized name. The standardized name should be the most complete and formal version available from the variations. Generic labels like "Bank Fee" or "Salary Deposit" should not be grouped with personal names and should remain as they are.

Client Names:
---
${clientNames.join('\n')}
---

Return the data as a JSON object that adheres to the provided schema. Each group should contain the standardized name and all the original name variations that belong to it. If a name has no variations, it should still be in its own group.`;

    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nameGroups: {
              type: Type.ARRAY,
              description: "A list of groups, where each group represents a single client entity.",
              items: {
                type: Type.OBJECT,
                properties: {
                  standardizedName: { type: Type.STRING, description: "The single, standardized name for this client (e.g., the most complete version)." },
                  originalNames: {
                    type: Type.ARRAY,
                    description: "A list of all original name variations that belong to this standardized name.",
                    items: { type: Type.STRING }
                  }
                },
                required: ["standardizedName", "originalNames"]
              }
            }
          },
          required: ["nameGroups"]
        }
      }
    });

    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);
    const nameMap = new Map<string, string>();

    if (result && Array.isArray(result.nameGroups)) {
      for (const group of result.nameGroups) {
        if(group.standardizedName && Array.isArray(group.originalNames)) {
          for (const originalName of group.originalNames) {
            nameMap.set(originalName, group.standardizedName);
          }
        }
      }
    } else {
       // Fallback: if normalization response is weird, use original names
       clientNames.forEach(name => nameMap.set(name, name));
    }

    // Convert Map to a plain object for JSON serialization
    const nameMapObject = Object.fromEntries(nameMap);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameMap: nameMapObject }),
    };

  } catch (error) {
    console.error("Error in /api/normalize function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Gemini API Error: ${errorMessage}` }),
    };
  }
};

export { handler };

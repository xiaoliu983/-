import { GoogleGenAI } from "@google/genai";

export interface GeminiSettings {
  apiKey: string;
  baseUrl?: string;
  modelName?: string;
}

/**
 * Expands a cropped image to a 3:4 aspect ratio using generative fill.
 * @param base64Image The source cropped image (base64 string)
 * @param settings API configuration settings
 * @returns The expanded image as a base64 string
 */
export const expandImageWithGemini = async (
  base64Image: string, 
  settings: GeminiSettings
): Promise<string> => {
  if (!settings.apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Initialize Gemini Client with dynamic settings
  // If baseUrl is provided (e.g., for a proxy), use it.
  const ai = new GoogleGenAI({ 
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl || undefined 
  });

  const model = settings.modelName || 'gemini-2.5-flash-image';

  try {
    // Remove header if present (e.g., "data:image/png;base64,")
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            text: "This is a cropped section of a larger image. Generate a new, complete high-quality version of this image that fits a 3:4 aspect ratio. Seamlessly extend the background and content to fill the new aspect ratio while preserving the original style, lighting, and details."
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: "3:4"
        }
      }
    });

    // Check for inline data (image) in the response
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image data returned from Gemini. Please check if the selected model supports image generation.");

  } catch (error) {
    console.error("Gemini expansion error:", error);
    throw error;
  }
};
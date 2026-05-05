import { GoogleGenAI, Type } from "@google/genai";
import { AIStrategySuggestion } from "../types";

// NOTE: In a real production app, this should be a backend call to protect the key.
// Since this is a client-side demo, we assume the environment variable or a placeholder.
// Ideally, the user enters their key in the Admin UI if env is missing.
const API_KEY = process.env.API_KEY || ''; 

let genAI: GoogleGenAI | null = null;

export const initGemini = (key?: string) => {
  const finalKey = key || API_KEY;
  if (finalKey) {
    genAI = new GoogleGenAI({ apiKey: finalKey });
  }
};

export const generateLoyaltyStrategy = async (businessDescription: string): Promise<AIStrategySuggestion> => {
  if (!genAI) throw new Error("API Key not configured");

  const prompt = `
    Eu sou dono de um negócio descrito como: "${businessDescription}".
    Crie uma estratégia rápida de programa de fidelidade para meus clientes.
    Eu preciso de um nome criativo para a recompensa, um número ideal de selos para completar a cartela (entre 5 e 12), e uma frase curta de marketing para atrair clientes.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rewardName: { type: Type.STRING, description: "Nome atrativo do prêmio final" },
            totalStamps: { type: Type.INTEGER, description: "Número total de selos para ganhar" },
            marketingCopy: { type: Type.STRING, description: "Uma frase curta e divertida convidando o cliente" }
          },
          required: ["rewardName", "totalStamps", "marketingCopy"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AIStrategySuggestion;
  } catch (error) {
    console.error("Gemini Error:", error);
    // Fallback if AI fails
    return {
      rewardName: "Prêmio Surpresa",
      totalStamps: 10,
      marketingCopy: "Junte selos e ganhe prêmios incríveis!"
    };
  }
};
// lib/ai.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

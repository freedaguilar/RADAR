import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 image uploads
  app.use(express.json({ limit: "15mb" }));

  // API Client Setup
  let geminiClient: GoogleGenAI | null = null;
  function getGeminiClient() {
    if (!geminiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("A variável de ambiente GEMINI_API_KEY não está configurada.");
      }
      geminiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return geminiClient;
  }

  // API endpoint for analyzing price and matching products
  app.post("/api/analyze-price", async (req, res) => {
    try {
      const { image, products } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Imagem é obrigatória para processamento." });
      }

      const client = getGeminiClient();

      // Parse image data (handle both base64 data URLs and raw base64)
      const matchesImg = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      let mimeType = "image/jpeg";
      let base64Data = image;

      if (matchesImg) {
        mimeType = matchesImg[1];
        base64Data = matchesImg[2];
      }

      // Format products catalog list for the model prompt
      const catalogText = Array.isArray(products) 
        ? products.map(p => `ID: "${p.id}", Name: "${p.name}", Brand: "${p.brand || ''}", Vol/Weight: "${p.weight || ''}", Category: "${p.category || ''}"`).join("\n")
        : "";

      const prompt = `
        Você é um auditor de gôndola inteligente de supermercado brasileiro.
        Sua tarefa é analisar a foto de uma etiqueta de preço ou produto na prateleira fornecida.
        Compare as informações visuais da foto com o catálogo de produtos fornecido abaixo e identifique o ID do produto correspondente e o preço de gôndola associado.

        Catálogo de Produtos disponível para mapeamento:
        ${catalogText}

        Siga as instruções estritas:
        1. Localize o preço numérico na imagem da etiqueta ou cartaz. Geralmente é o valor em destaque (em Reais, R$).
        2. Identifique quais palavras na foto correspondem ao nome do produto, marca ou peso no catálogo. Procure correspondências de marca (ex: Dr. Oetker, Mavalério, Royal, Dona Benta, Fleischmann) e peso ou volume relevantes.
        3. Selecione o "matchedProductId" correspondente da lista que representa o ID do melhor produto mapeado. Se não houver correspondência ideal, deixe vazio ou selecione o ID do produto mais provável.
        4. Retorne o preço como um número decimal (ex: 4.89 ou 22.90). Se o preço contiver centavos, mapeie de forma correspondente.
        5. Forneça um status curto da detecção em "detectedText".
      `;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              price: {
                type: Type.NUMBER,
                description: "O valor decimal do preço legível na etiqueta ou cartaz de gôndola.",
              },
              matchedProductId: {
                type: Type.STRING,
                description: "O ID do produto do catálogo que mais se adequa à marca/nome detectados. Se não houver correspondência ideal, retorne vazio.",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Nível de confiança da estimativa de 0.0 a 1.0.",
              },
              detectedText: {
                type: Type.STRING,
                description: "Breve explicação em português sobre qual texto de produto e preço foram detectados (Máximo uma linha).",
              }
            },
            required: ["price", "matchedProductId", "confidence", "detectedText"],
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Resposta do modelo Gemini vazia.");
      }

      const resultJson = JSON.parse(resultText.trim());
      res.json(resultJson);

    } catch (error: any) {
      console.error("Erro na análise de preço via Gemini:", error);
      res.status(500).json({ error: error.message || "Falha no processamento Inteligente de Preço." });
    }
  });

  // Serve static UI assets or mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

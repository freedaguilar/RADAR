import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  // Set CORS headers for Vercel
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { image, products } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Imagem é obrigatória para processamento." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "A variável de ambiente GEMINI_API_KEY não está configurada no Vercel. Por favor, configure-a nas configurações do seu projeto do Vercel." });
    }

    const client = new GoogleGenAI({ apiKey });

    // Parse image data
    const matchesImg = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    let mimeType = "image/jpeg";
    let base64Data = image;

    if (matchesImg) {
      mimeType = matchesImg[1];
      base64Data = matchesImg[2];
    }

    const catalogText = Array.isArray(products) 
      ? products.map(p => `ID: "${p.id}", Name: "${p.name}", Brand: "${p.brand || ''}", Vol/Weight: "${p.weight || ''}", Category: "${p.category || ''}"`).join("\n")
      : "";

    const prompt = `
      Você é um auditor de gôndola inteligente de supermercado brasileiro.
      Sua tarefa é analisar a foto de uma etiqueta de preço ou produto na prateleira fornecida.
      Compare as informações visuais da foto com o catálogo de produtos fornecido abaixo e identifique o ID do produto correspondente e o preço de gôndola associado.

      Catálogo de Produtos disponível para mapeamento:
      \n${catalogText}\n

      Siga as instruções estritas:
      1. Localize o preço numérico na imagem da etiqueta ou cartaz. Se a etiqueta contiver múltiplos preços (como atacado, clube, cliente, etc.), IGNORE-OS E IDENTIFIQUE EXCLUSIVAMENTE O PREÇO DE VAREJO (o preço base de venda para o consumidor final em quantidade unitária).
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
              description: "O valor decimal do preço legível na etiqueta ou cartas de gôndola.",
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
    return res.status(200).json(resultJson);

  } catch (error) {
    console.error("Erro na análise de preço via Gemini no Vercel:", error);
    return res.status(500).json({ error: error.message || "Falha no processamento Inteligente de Preço." });
  }
}

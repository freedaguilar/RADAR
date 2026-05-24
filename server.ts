import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // [CORS] Configuração do Middleware de CORS colocado no topo absoluto do servidor
  // Isso garante que requisições pré-vôo (OPTIONS preflight) vindas da Vercel sejam interceptadas e respondidas com sucesso imediatamente
  app.use(
    cors({
      origin: true, // Espelha dinamicamente a origem da requisição para permitir qualquer domínio da Vercel (com suporte a credentials)
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      optionsSuccessStatus: 200, // Retorna status 200 para requisições OPTIONS pré-vôo (altamente compatível com navegadores)
    })
  );

  // Aumentar o limite de payload para uploads de imagem em base64
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

  let supabaseClient: any = null;
  function getSupabaseClient() {
    if (!supabaseClient) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      }
    }
    return supabaseClient;
  }

  // API endpoint for analyzing price and matching products
  app.post("/api/analyze-price", async (req, res) => {
    try {
      const { image, imageBase64, products, chainId } = req.body;
      const targetImage = image || imageBase64;
      if (!targetImage) {
        return res.status(400).json({ error: "Imagem é obrigatória para processamento." });
      }

      const client = getGeminiClient();

      // Parse image data
      const matchesImg = targetImage.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      const mimeType = matchesImg ? matchesImg[1] : "image/jpeg";
      const base64Data = matchesImg ? matchesImg[2] : targetImage;

      // Format products catalog list for the model prompt
      const catalogText = Array.isArray(products) 
        ? products.map(p => `${p.id}|${p.name}|${p.brand || ''}`).join("\n")
        : "";

      // Fetch correction history for this chain for progressive learning context
      let contextPrompt = "";
      if (chainId) {
        const sClient = getSupabaseClient();
        if (sClient) {
          try {
            const { data: corrections, error } = await sClient
              .from("ai_corrections")
              .select("detected_text, correct_product_name")
              .eq("chain_id", chainId)
              .order("created_at", { ascending: false })
              .limit(30);

            if (error) {
              console.error("Error fetching ai_corrections from Supabase:", error);
            } else if (corrections && corrections.length > 0) {
              const seenDetected = new Set();
              const uniqueCorrections = [];
              for (const corr of corrections) {
                if (corr.detected_text && corr.correct_product_name) {
                  const trimmed = corr.detected_text.trim();
                  if (!seenDetected.has(trimmed)) {
                    seenDetected.add(trimmed);
                    uniqueCorrections.push(corr);
                  }
                }
              }

              if (uniqueCorrections.length > 0) {
                contextPrompt = `
Histórico de correções desta rede (aprenda com eles):
${uniqueCorrections.map(corr => `- Quando identificar "${corr.detected_text}", o produto correto é "${corr.correct_product_name}"`).join("\n")}
                `;
              }
            }
          } catch (dbErr) {
            console.error("Database error while fetching AI corrections:", dbErr);
          }
        }
      }

      const prompt = `
        ${contextPrompt}
        Você é um auditor de gôndola de supermercado altamente preciso. Sua principal missão é analisar a foto e identificar o PREÇO DE VAREJO UNITÁRIO.
        
        ATENÇÃO CRÍTICA (REGRAS DE PRIORIZAÇÃO DE PREÇO DO VAREJO AVULSO):
        1. Em etiquetas ou cartazes de supermercados (especialmente do tipo "atacarejo" ou "clube de compras"), o preço de atacado ou promocional em lote (por exemplo, "A partir de 3 unidades: R$ X cada") ou preço para membros de clube/aplicativo de vantagens costumam estar impressos em letras e números GIGANTES para atrair atenção.
        2. O PREÇO DE VAREJO UNITÁRIO padrão (para qualquer cliente comum comprar apenas 1 única unidade avulsa) costuma estar impresso em tamanho bem menor e com menor destaque, mas ele é o preço correto a ser registrado! Geralmente é identificado por palavras em minúsculo ou adjacentes como "Unidade", "Unitário", "Preço Normal", "Varejo", "1 UN", ou simplesmente o preço menor sem condicionais de quantidade.
        3. Você DEVE ignorar os números giants de atacado ou de clube de fidelidade se eles exigirem a compra de mais de 1 unidade ou cadastro especial, e focar ativamente em encontrar o preço unitário avulso comum.
        4. O valor numérico que você deve retornar no campo "price" é estritamente o PREÇO DE VAREJO UNITÁRIO comum (para compra de apenas 1 única unidade).
        5. Caso haja apenas um preço impresso na etiqueta sem qualquer condicional de atacado ou clube, retorne esse preço único.

        Retorne APENAS o JSON conforme o esquema do catálogo mapeado abaixo.
        
        Catálogo para mapeamento do produto: ID|Nome|Marca
        ${catalogText}
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
              },
              produto: {
                type: Type.STRING,
                description: "O nome ou texto do produto lido na gôndola ou etiqueta.",
              }
            },
            required: ["price", "matchedProductId", "confidence", "detectedText", "produto"],
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


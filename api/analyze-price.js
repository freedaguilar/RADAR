import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const { image, imageBase64, mediaType, products, chainId } = req.body;
    const targetImage = image || imageBase64;

    if (!targetImage) {
      return res.status(400).json({ error: 'Imagem ou imageBase64 ausente.' });
    }

    let finalImageBase64 = targetImage;
    let finalMediaType = mediaType || 'image/jpeg';

    if (targetImage.startsWith("http")) {
      try {
        const fetchRes = await fetch(targetImage);
        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        finalImageBase64 = buffer.toString("base64");
        const contentType = fetchRes.headers.get("content-type");
        if (contentType) {
          finalMediaType = contentType;
        }
      } catch (fetchErr) {
        console.error("Error fetching image URL:", fetchErr);
        return res.status(400).json({ error: 'Erro ao obter imagem a partir da URL fornecida.' });
      }
    } else {
      const matchesImg = targetImage.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (matchesImg) {
        finalMediaType = matchesImg[1];
        finalImageBase64 = matchesImg[2];
      }
    }

    // Try Gemini API first (Native in AI Studio setups)
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

    if (!geminiApiKey && !anthropicApiKey) {
      return res.status(500).json({ error: 'Nenhuma chave de API de IA (GEMINI_API_KEY ou ANTHROPIC_API_KEY) configurada.' });
    }

    // Supabase corrections context fetching
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    let contextPrompt = "";
    if (chainId && supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: corrections, error } = await supabase
          .from("ai_corrections")
          .select("detected_text, correct_product_name")
          .eq("chain_id", chainId)
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) {
          console.error("Error fetching ai_corrections in serverless:", error);
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
            contextPrompt = "\nHistórico de correções desta rede (aprenda com eles):\n" +
              uniqueCorrections.map(corr => `- Quando identificar "${corr.detected_text}", o produto correto é "${corr.correct_product_name}"`).join("\n") + "\n";
          }
        }
      } catch (dbErr) {
        console.error("Database error in serverless:", dbErr);
      }
    }

    if (geminiApiKey) {
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const catalogText = Array.isArray(products) 
        ? products.map(p => `${p.id}|${p.name}|${p.brand || ''}`).join("\n")
        : "";

      const prompt = `
        ${contextPrompt}
        Você é um auditor de gôndola de supermercado altamente preciso. Sua principal missão é analisar a foto e identificar o PREÇO DE VAREJO UNITÁRIO.
        
        ATENÇÃO CRÍTICA (REGRAS DE PRIORIZAÇÃO DE PREÇO DO VAREJO AVULSO):
        1. Em etiquetas ou cartazes de supermercados (especialmente do tipo "atacarejo" ou "clube de compras"), o preço de atacado ou promocional em lote (por exemplo, "A partir de 3 unidades: R$ X cada") ou preço para membros de clube/aplicativo de vantagens costumam estar impressos em letras e números GIGANTES para atrair atenção.
        2. O PREÇO DE VAREJO UNITÁRIO padrão (para qualquer cliente comum comprar apenas 1 única unidade avulsa) costuma estar impresso em tamanho bem menor e com menor destaque, mas ele é o preço correto a ser registrado! Geralmente é identificado por palavras em minúsculo ou adjacentes como "Unidade", "Unitário", "Preço Normal", "Varejo", "1 UN", ou simplesmente o preço menor sem condicionais de quantidade.
        3. Você DEVE ignorar os números gigantes de atacado ou de clube de fidelidade se eles exigirem a compra de mais de 1 unidade ou cadastro especial, e focar ativamente em encontrar o preço unitário avulso comum.
        4. O valor numérico que você deve retornar no campo "price" é estritamente o PREÇO DE VAREJO UNITÁRIO comum (para compra de apenas 1 única unidade).
        5. Caso haja apenas um preço impresso na etiqueta sem qualquer condicional de atacado ou clube, retorne esse preço único.

        Retorne APENAS o JSON conforme o esquema definido para o matchedProductId e price.
        
        Catálogo para mapeamento do produto: ID|Nome|Marca
        ${catalogText}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: finalMediaType,
              data: finalImageBase64,
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
      return res.status(200).json({
        price: resultJson.price,
        preco: resultJson.price,
        matchedProductId: resultJson.matchedProductId || null,
        confidence: resultJson.confidence || 1.0,
        produto: resultJson.produto || resultJson.detectedText,
        detectedText: resultJson.detectedText || null,
        observacao: resultJson.detectedText || null
      });
    }

    // Pathway 2: Claude Anthropic (fallback)
    let prompt = (contextPrompt ? contextPrompt + '\n' : '') + 'Analise esta etiqueta de preço de supermercado. Retorne APENAS JSON: { "produto": "nome", "preco": 0.00, "observacao": "info relevante ou null", "matchedProductId": "uuid ou null" }.' +
      '\n\nREGRAS CRÍTICAS DE PREÇO:' +
      '\n- SEMPRE priorize o maior preço presente na etiqueta (que normalmente é o preço unitário de varejo para compra avulsa de apenas 1 única unidade).' +
      '\n- NÃO REGISTRE preços promocionais vinculados a atacado, caixa fechada, lote, clubes de fidelidade, aplicativos de vantagens ou cartões da loja no campo "preco". O campo "preco" deve conter unicamente o preço unitário avulso padronizado para cliente comum sem condicionais.' +
      '\n- Se o preço unitário avulso comum estiver com fontes menores (termos como "Varejo", "Unidade", "unitário", "1 UN", ou "Preço Normal"), enquanto ofertas condicionais de atacado ("Lote", "Lave X Pague Y", "A partir de X unidades") estão gigantes, você DEVE ignorar o preço gigante do atacado e capturar o preço de varejo, que é o MAIOR preço da etiqueta.' +
      '\n- Coloque qualquer outra informação relevante — como as condições do preço de atacado ignorado (ex: "Preço atacado R$ X.XX a partir de Y unidades"), regulamento, promoções, datas de validade ou clube de fidelidade — dentro do campo de texto "observacao".';

    if (products && Array.isArray(products) && products.length > 0) {
      prompt += '\n\nCatálogo (id|nome|marca):\n' + products.map(p => `${p.id}|${p.name}|${p.brand || ''}`).join('\n');
    }

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        temperature: 0.0,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: finalMediaType,
                data: finalImageBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Erro Anthropic:', errorText);
      return res.status(apiResponse.status).json({ error: 'Falha na API da Anthropic.', details: errorText });
    }

    const responseData = await apiResponse.json();
    return res.status(200).json(responseData);

  } catch (err) {
    console.error('Erro interno:', err);
    return res.status(500).json({ error: 'Erro interno no servidor.', details: err.message });
  }
}

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const { imageBase64, mediaType, products, chainId } = req.body;

    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 ausente.' });

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada.' });

    // Supabase
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
        'x-api-key': apiKey,
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
                media_type: mediaType || 'image/jpeg',
                data: imageBase64
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
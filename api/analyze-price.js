export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const { imageBase64, mediaType, products } = req.body;

    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 ausente.' });

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada.' });

    let prompt = 'Analise esta etiqueta de preço de supermercado. Retorne APENAS JSON: { "produto": "nome", "preco": 0.00, "observacao": "info relevante ou null", "matchedProductId": "uuid ou null" }.' +
      '\n\nREGRAS DE PREÇO:' +
      '\n- Registre SEMPRE o preço unitário avulso (1 unidade, qualquer cliente).' +
      '\n- Ignore preços de atacado, lote, clube ou fidelidade (exigem quantidade mínima ou cadastro).' +
      '\n- O preço unitário costuma estar em tamanho menor, com termos como "unidade", "varejo" ou "1 UN".' +
      '\n- Se houver apenas um preço sem condicionais, registre esse.';

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
        max_tokens: 200,
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
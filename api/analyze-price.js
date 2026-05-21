// =========================================================================
// Vercel Serverless Function: Proxy de Análise de Preço com Claude Haiku
// =========================================================================
// Este endpoint serve como proxy seguro para a API da Anthropic.
// Ele elimina erros de CORS no navegador ao mesmo tempo que mantém a chave de 
// API (ANTHROPIC_API_KEY) protegida e oculta no lado do servidor da Vercel.
// =========================================================================

export default async function handler(req, res) {
  // Adiciona cabeçalhos CORS para permitir requisições de origens externas com segurança
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Trata requisições preflight do navegador (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceita requisições POST para a análise do preço
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize o método POST.' });
  }

  try {
    const { imageBase64, mediaType, products } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Parâmetro imageBase64 ausente ou inválido.' });
    }

    // Recupera a chave de API de ambiente segura (sem expor ao client-side)
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'A chave de API ANTHROPIC_API_KEY ou VITE_ANTHROPIC_API_KEY não foi configurada nas variáveis de ambiente da Vercel.'
      });
    }

    // Configurando instrução básica para o modelo
    let promptInstruction = 'Analise esta imagem de etiqueta de preço de supermercado e retorne APENAS um JSON com os campos: { "produto": "nome do produto", "preco": 0.00, "observacao": "qualquer informação relevante como promoção, validade etc" }. Se não conseguir identificar algum campo, deixe como null.';

    // Opcional: Anexar catálogo para matching guiado pela IA no servidor
    if (products && Array.isArray(products) && products.length > 0) {
      promptInstruction += `\n\nDispomos do seguinte catálogo de produtos cadastrados. Se identificar algum correspondente ideal na imagem, inclua o campo "matchedProductId" com o respectivo ID (UUID do produto).\n\nCatálogo local:\n`;
      promptInstruction += products.map(p => `${p.id}|${p.name}|${p.brand || ''}`).join('\n');
    }

    // Repassa os dados diretamente para a Anthropic para evitar problemas de CORS no cliente
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
        messages: [
          {
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
                text: promptInstruction
              }
            ]
          }
        ]
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Erro retornado pela API da Anthropic:', errorText);
      return res.status(apiResponse.status).json({
        error: 'A API da Anthropic recusou ou falhou na requisição.',
        details: errorText
      });
    }

    const responseData = await apiResponse.json();
    return res.status(200).json(responseData);
  } catch (err) {
    console.error('Exceção capturada na serverless function:', err);
    return res.status(500).json({
      error: 'Ocorreu um erro interno no servidor ao processar a análise inteligente.',
      details: err.message
    });
  }
}

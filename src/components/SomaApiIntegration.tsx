import React, { useState } from "react";
import {
  Globe,
  Key,
  Copy,
  Check,
  Play,
  Terminal,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Info,
} from "lucide-react";
import { Chain } from "../types";
import { DEFAULT_SOMA_API_KEY } from "../../api/status-rede";

interface SomaApiIntegrationProps {
  chains: Chain[];
}

export function SomaApiIntegration({ chains }: SomaApiIntegrationProps) {
  // Credentials & Config
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Live Tester State
  const [selectedChainId, setSelectedChainId] = useState(chains[0]?.id || "");
  const [customRedeInput, setCustomRedeInput] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [testState, setTestState] = useState("Todos");
  const [testDiasLimite, setTestDiasLimite] = useState(15);
  const [testUseAuth, setTestUseAuth] = useState(true);

  const [isLoadingTest, setIsLoadingTest] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testStatusCode, setTestStatusCode] = useState<number | null>(null);
  const [testLatencyMs, setTestLatencyMs] = useState<number | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"fetch" | "curl" | "python">("fetch");

  const priceHubBaseUrl = "https://pricehub.aquilas.tech";
  const somaBaseUrl = "https://soma.aquilas.tech";
  const apiEndpointPath = "/api/v1/status-rede";

  const targetRedeQuery = useCustomInput
    ? customRedeInput
    : chains.find((c) => c.id === selectedChainId)?.name || "";

  // Copiar chave
  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(DEFAULT_SOMA_API_KEY);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2500);
  };

  // Copiar URL do endpoint
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2500);
  };

  // Copiar JSON retornado
  const handleCopyJson = () => {
    if (!testResponse) return;
    navigator.clipboard.writeText(JSON.stringify(testResponse, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2500);
  };

  // Executar teste real contra a API do PriceHub
  const handleRunTest = async () => {
    setIsLoadingTest(true);
    setTestResponse(null);
    setTestStatusCode(null);
    setTestLatencyMs(null);

    const startTime = performance.now();

    try {
      const params = new URLSearchParams();
      if (targetRedeQuery) params.set("rede", targetRedeQuery);
      if (testState && testState !== "Todos") params.set("estado", testState);
      if (testDiasLimite && testDiasLimite !== 15) params.set("dias_limite", String(testDiasLimite));

      const queryUrl = `${apiEndpointPath}${params.toString() ? `?${params.toString()}` : ""}`;

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (testUseAuth) {
        headers["Authorization"] = `Bearer ${DEFAULT_SOMA_API_KEY}`;
      }

      const res = await fetch(queryUrl, {
        method: "GET",
        headers,
      });

      const endTime = performance.now();
      setTestLatencyMs(Math.round(endTime - startTime));
      setTestStatusCode(res.status);

      const data = await res.json();
      setTestResponse(data);
    } catch (err: any) {
      const endTime = performance.now();
      setTestLatencyMs(Math.round(endTime - startTime));
      setTestStatusCode(500);
      setTestResponse({
        sucesso: false,
        erro: "Falha de Conexão",
        mensagem: err.message || "Não foi possível conectar ao servidor PriceHub.",
      });
    } finally {
      setIsLoadingTest(false);
    }
  };

  // Exemplos de código
  const sampleFetchCode = `// No frontend ou backend do SOMA (https://soma.aquilas.tech/)
async function checarStatusRedePriceHub(nomeRede, estadoLoja) {
  const token = "${DEFAULT_SOMA_API_KEY}";
  const params = new URLSearchParams({
    rede: nomeRede,
    dias_limite: "15"
  });
  if (estadoLoja) params.append("estado", estadoLoja);

  const response = await fetch(\`${priceHubBaseUrl}${apiEndpointPath}?\${params.toString()}\`, {
    method: "GET",
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Accept": "application/json"
    }
  });

  const data = await response.json();
  
  if (data.sucesso) {
    if (data.precisa_pesquisa) {
      console.log(\`⚠️ Loja necessita de auditoria de preço: \${data.mensagem}\`);
      // Exemplo de ação no SOMA: exibir alerta ou botão de atalho para o PriceHub
    } else {
      console.log(\`✅ Preços em dia (\${data.dias_sem_atualizacao} dias sem atualização)\`);
    }
  }
  return data;
}`;

  const sampleCurlCode = `# Teste via Terminal cURL
curl -X GET "${priceHubBaseUrl}${apiEndpointPath}?rede=${encodeURIComponent(targetRedeQuery || "Carrefour Supermercado")}&dias_limite=15" \\
  -H "Authorization: Bearer ${DEFAULT_SOMA_API_KEY}" \\
  -H "Accept: application/json"`;

  const samplePythonCode = `# No backend Python do SOMA
import requests

url = "${priceHubBaseUrl}${apiEndpointPath}"
params = {
    "rede": "${targetRedeQuery || "Carrefour Supermercado"}",
    "dias_limite": 15
}
headers = {
    "Authorization": "Bearer ${DEFAULT_SOMA_API_KEY}",
    "Accept": "application/json"
}

response = requests.get(url, params=params, headers=headers)
data = response.json()

if data.get("precisa_pesquisa"):
    print(f"Alerta SOMA: {data.get('mensagem')}")
`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner de Apresentação da Integração */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 text-white rounded-3xl shadow-sm border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                API v1 Online & Pronta
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                CORS Habilitado
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-red-400" />
              API de Integração SOMA & PriceHub
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Permite que o sistema <strong className="text-white">SOMA</strong> (
              <a
                href={somaBaseUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-red-300 inline-flex items-center gap-0.5"
              >
                {somaBaseUrl}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              ) consulte se uma rede está com mais de <strong className="text-white">15 dias</strong> sem pesquisa de preço ou possui uma <strong className="text-white">pesquisa guiada prioritária ativa</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunTest}
              className="px-4 py-2 bg-[#D40511] hover:bg-[#b0040e] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Testar Agora</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid de 2 Colunas: Credenciais à esquerda, Detalhes de Requisição à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coluna 1: Credenciais & Headers (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
              <div className="p-1.5 bg-red-50 text-[#D40511] rounded-lg">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Chave de Autenticação (API Key)</h3>
                <p className="text-[11px] text-gray-500">Exclusiva para o SOMA consultar o PriceHub</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700">Token / API Key:</label>
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-250 rounded-xl p-2 font-mono text-xs">
                <span className="flex-1 text-gray-800 font-semibold truncate select-all">
                  {showKey ? DEFAULT_SOMA_API_KEY : "••••••••••••••••••••••••••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-900 font-sans cursor-pointer"
                >
                  {showKey ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  type="button"
                  onClick={handleCopyApiKey}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  title="Copiar token"
                >
                  {apiKeyCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 text-[11px]">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[11px]">Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <span className="font-bold text-gray-700 block text-[11px]">Formas de Envio aceitas:</span>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800">
                  <span className="text-gray-400">Header:</span> Authorization: Bearer {DEFAULT_SOMA_API_KEY}
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800">
                  <span className="text-gray-400">Header alternativo:</span> x-api-key: {DEFAULT_SOMA_API_KEY}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-gray-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Segurança e CORS Ativos</span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                As requisições originadas do domínio <code className="text-gray-800 bg-gray-100 px-1 py-0.5 rounded">https://soma.aquilas.tech/</code> possuem permissão imediata de leitura sem bloqueios de navegador.
              </p>
            </div>
          </div>

          {/* Card Resumo do Endpoint */}
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-600" />
              <span>Rota do Endpoint</span>
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 text-white rounded-xl text-xs font-mono">
                <div className="flex items-center gap-2 overflow-hidden truncate">
                  <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 font-black rounded text-[10px]">
                    GET
                  </span>
                  <span className="truncate">{priceHubBaseUrl}{apiEndpointPath}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyUrl(`${priceHubBaseUrl}${apiEndpointPath}`)}
                  className="p-1 hover:bg-slate-800 text-slate-300 rounded cursor-pointer shrink-0"
                  title="Copiar URL"
                >
                  {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-gray-800 text-[11px]">Parâmetros Query da URL:</span>
                <ul className="space-y-1.5 text-[11px] text-gray-600">
                  <li>
                    <code className="text-red-700 bg-red-50 px-1 py-0.5 rounded font-mono font-bold">rede</code> (obrigatório para consulta pontual):
                    <span className="block text-gray-500 mt-0.5">Nome da rede (ex: "Super ABC", "Carrefour") ou ID (ex: "chain-1").</span>
                  </li>
                  <li>
                    <code className="text-red-700 bg-red-50 px-1 py-0.5 rounded font-mono font-bold">dias_limite</code> (opcional, padrão 15):
                    <span className="block text-gray-500 mt-0.5">Tolerância de dias sem pesquisa. Caso passe desse limite, retorna `precos_atualizados: false`.</span>
                  </li>
                  <li>
                    <code className="text-red-700 bg-red-50 px-1 py-0.5 rounded font-mono font-bold">estado</code> (opcional):
                    <span className="block text-gray-500 mt-0.5">Filtro regional da loja (ex: "MG", "Minas Gerais", "GO", "DF").</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
                <span className="font-bold text-emerald-900 text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Vitrine de Últimos Preços Auditados (`ultimos_precos_coletados`)
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  A API agora retorna uma lista com os <strong>3 a 5 últimos produtos auditados</strong> nessa rede com nome, marca, foto, preço numérico e formatado (<code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">preco_formatado: "R$ 3,19"</code>), data e dias desde a coleta.
                </p>
              </div>
            </div>
          </div>

          {/* Card Link Direto de Pesquisa para Merchandising */}
          <div className="bg-gradient-to-br from-white to-red-50/30 border border-red-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-[#D40511]">
              <ExternalLink className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-bold text-gray-900">Link Direto de Pesquisa (SOMA ➜ PriceHub)</h3>
            </div>
            
            <p className="text-xs text-gray-600 leading-relaxed">
              O SOMA pode criar botões ou links diretos para que o promotor acesse a pesquisa daquela rede com um clique:
            </p>

            <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs font-mono break-all flex items-center justify-between gap-2">
              <span className="text-emerald-400">
                https://pricehub.aquilas.tech/?rede=SUPER%20ABC&estado=MG&origem=soma
              </span>
              <button
                type="button"
                onClick={() => handleCopyUrl("https://pricehub.aquilas.tech/?rede=SUPER%20ABC&estado=MG&origem=soma")}
                className="p-1 hover:bg-slate-800 text-slate-300 rounded cursor-pointer shrink-0"
                title="Copiar Link"
              >
                {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-3 bg-white/80 border border-red-100 rounded-xl text-[11px] text-gray-600 space-y-1.5">
              <span className="font-bold text-gray-800 block text-xs">Comportamento Inteligente de Acesso:</span>
              <p>
                • <strong>Usuário já logado:</strong> Entra direto na <strong>Etapa 3</strong> (fila de produtos e câmera) com a rede e estado selecionados.
              </p>
              <p>
                • <strong>Usuário não logado:</strong> O PriceHub exibe o aviso com o nome da rede. Assim que o usuário entrar como Convidado (apenas seu nome) ou Gestor, ele é <strong>imediatamente redirecionado para a pesquisa</strong> sem perder o destino!
              </p>
            </div>

            <a
              href={`${priceHubBaseUrl}/?rede=${encodeURIComponent(targetRedeQuery || "Hiper ABC")}&origem=soma`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-[#D40511] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              <span>Testar Abertura Direta para {targetRedeQuery || "Hiper ABC"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Coluna 2: Console de Teste Interativo (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Simulador de Consulta em Tempo Real</h3>
                  <p className="text-[11px] text-gray-500">
                    Teste o que o SOMA receberá ao consultar uma rede cadastrada
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunTest}
                disabled={isLoadingTest}
                className="px-3 py-1.5 bg-[#D40511] hover:bg-[#b0040e] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isLoadingTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Consultando...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Disparar GET</span>
                  </>
                )}
              </button>
            </div>

            {/* Configuração dos Parâmetros do Teste */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700">Rede da Loja:</label>
                  <button
                    type="button"
                    onClick={() => setUseCustomInput(!useCustomInput)}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                  >
                    {useCustomInput ? "Selecionar da lista" : "Digitar livremente"}
                  </button>
                </div>

                {useCustomInput ? (
                  <input
                    type="text"
                    placeholder="Ex: Super ABC"
                    value={customRedeInput}
                    onChange={(e) => setCustomRedeInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#D40511]/30 focus:border-[#D40511]"
                  />
                ) : (
                  <select
                    value={selectedChainId}
                    onChange={(e) => setSelectedChainId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#D40511]/30 focus:border-[#D40511] cursor-pointer"
                  >
                    {chains.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.states && c.states.length > 0 ? `(${c.states.join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Estado / UF da Loja (Opcional):</label>
                <select
                  value={testState}
                  onChange={(e) => setTestState(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#D40511]/30 focus:border-[#D40511] cursor-pointer"
                >
                  <option value="Todos">Todos os estados da rede</option>
                  <option value="Minas Gerais">Minas Gerais (MG)</option>
                  <option value="Goiás">Goiás (GO)</option>
                  <option value="Distrito Federal">Distrito Federal (DF)</option>
                  <option value="São Paulo">São Paulo (SP)</option>
                  <option value="Rio de Janeiro">Rio de Janeiro (RJ)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Limite de Dias Tolerado:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={testDiasLimite}
                    onChange={(e) => setTestDiasLimite(parseInt(e.target.value, 10) || 15)}
                    className="w-24 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#D40511]/30 focus:border-[#D40511]"
                  />
                  <span className="text-[11px] text-gray-500 font-medium">
                    dias sem auditoria (padrão: 15)
                  </span>
                </div>
              </div>

              <div className="space-y-1 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={testUseAuth}
                    onChange={(e) => setTestUseAuth(e.target.checked)}
                    className="w-4 h-4 rounded text-[#D40511] accent-[#D40511] cursor-pointer"
                  />
                  <span className="text-xs text-gray-700 font-medium">
                    Enviar Token de Autenticação
                  </span>
                </label>
                <span className="text-[10px] text-gray-400">
                  (Desmarque para testar a resposta de erro 401 Unauthorized)
                </span>
              </div>
            </div>

            {/* URL da Requisição em Tempo Real */}
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-mono text-gray-700 flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-gray-500 shrink-0 font-sans font-bold">Requisição:</span>
              <span className="text-slate-900 font-bold truncate">
                GET {apiEndpointPath}?rede={encodeURIComponent(targetRedeQuery || "")}
                {testState !== "Todos" ? `&estado=${encodeURIComponent(testState)}` : ""}
                {testDiasLimite !== 15 ? `&dias_limite=${testDiasLimite}` : ""}
              </span>
            </div>

            {/* Resposta do Teste */}
            {testResponse ? (
              <div className="space-y-3 pt-1 border-t border-gray-150">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                        testStatusCode === 200
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : testStatusCode === 401
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      HTTP {testStatusCode}
                    </span>
                    {testLatencyMs !== null && (
                      <span className="text-[11px] text-gray-500 font-mono">
                        {testLatencyMs}ms
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="px-2.5 py-1 text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    {jsonCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{jsonCopied ? "JSON Copiado" : "Copiar JSON"}</span>
                  </button>
                </div>

                {/* Cards Visuais de Destaque da Resposta */}
                {testResponse.sucesso && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between ${
                        testResponse.precos_atualizados
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                          : "bg-rose-50/70 border-rose-200 text-rose-900"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                        Status dos Preços
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 font-black text-sm">
                        {testResponse.precos_atualizados ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Atualizados</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Desatualizados</span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] opacity-80 mt-1">
                        {testResponse.dias_sem_atualizacao !== null
                          ? `${testResponse.dias_sem_atualizacao} dias sem pesquisa`
                          : "Sem histórico"}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between ${
                        testResponse.possui_pesquisa_guiada_ativa
                          ? "bg-red-50/70 border-red-200 text-red-950"
                          : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                        Pesquisa Guiada
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 font-black text-sm">
                        <Target className="w-4 h-4 text-[#D40511] shrink-0" />
                        <span>{testResponse.possui_pesquisa_guiada_ativa ? "Ativa" : "Nenhuma Ativa"}</span>
                      </div>
                      <span className="text-[11px] opacity-80 truncate mt-1" title={testResponse.pesquisa_guiada_ativa?.titulo}>
                        {testResponse.pesquisa_guiada_ativa?.titulo || "Segue fila tradicional"}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between ${
                        testResponse.precisa_pesquisa
                          ? "bg-amber-50/70 border-amber-200 text-amber-950"
                          : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                        Ação Recomendada
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 font-black text-sm">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{testResponse.precisa_pesquisa ? "Auditar no PDV" : "Fila em Dia"}</span>
                      </div>
                      <span className="text-[11px] opacity-80 mt-1">
                        {testResponse.precisa_pesquisa ? "Pesquisa prioritária" : "Não urgente"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bloco de Mensagem Contextual */}
                {testResponse.mensagem && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Mensagem Retornada:</span>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {testResponse.mensagem}
                      </p>
                    </div>
                  </div>
                )}

                {/* Visualizador de Código JSON Puro */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-gray-500 font-mono">Payload JSON:</span>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                    {JSON.stringify(testResponse, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-250 text-gray-500 space-y-2">
                <Terminal className="w-6 h-6 mx-auto text-gray-400" />
                <p className="text-xs font-bold text-gray-700">Nenhum teste executado ainda</p>
                <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                  Clique no botão <strong className="text-gray-800">"Disparar GET"</strong> acima para consultar a rede selecionada e ver o resultado imediato da API.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Snippets de Código Prontos para o Desenvolvedor do SOMA */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Código de Integração para a Equipe do SOMA
              </h3>
              <p className="text-[11px] text-gray-500">
                Copie e cole diretamente no código-fonte do painel SOMA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveCodeTab("fetch")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCodeTab === "fetch" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              JavaScript / Fetch
            </button>
            <button
              type="button"
              onClick={() => setActiveCodeTab("curl")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCodeTab === "curl" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              cURL
            </button>
            <button
              type="button"
              onClick={() => setActiveCodeTab("python")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCodeTab === "python" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Python
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 bg-slate-950 text-emerald-400 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 select-all">
            {activeCodeTab === "fetch"
              ? sampleFetchCode
              : activeCodeTab === "curl"
              ? sampleCurlCode
              : samplePythonCode}
          </pre>
          <button
            type="button"
            onClick={() => {
              const code =
                activeCodeTab === "fetch"
                  ? sampleFetchCode
                  : activeCodeTab === "curl"
                  ? sampleCurlCode
                  : samplePythonCode;
              navigator.clipboard.writeText(code);
            }}
            className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar Snippet</span>
          </button>
        </div>
      </div>
    </div>
  );
}

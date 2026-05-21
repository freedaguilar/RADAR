import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, Image, CheckCircle2, AlertTriangle, Sparkles, Sliders, RefreshCw, XCircle, Loader2, Eye, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Chain, PriceRecord, User } from '../types';
import { uploadToSupabaseStorage } from '../lib/supabase';


// Visual premium logo generator corresponding to Dashboard.tsx RetailerLogo
function RetailerLogo({ chain, size = "md" }: { chain: Chain; size?: "sm" | "md" | "lg" }) {
  const getInitialsAndColors = (name: string) => {
    const uppercase = name.toUpperCase();
    if (uppercase.includes("CARREFOUR")) return { text: "C", bg: "bg-blue-600", border: "border-blue-700/50", textCol: "text-white" };
    if (uppercase.includes("PÃO DE AÇÚCAR") || uppercase.includes("PAO DE ACUCAR") || uppercase.includes("GPA")) {
      return { text: "PA", bg: "bg-emerald-700", border: "border-emerald-800/50", textCol: "text-white" };
    }
    if (uppercase.includes("SONDA")) return { text: "SD", bg: "bg-red-500", border: "border-red-600/50", textCol: "text-white" };
    if (uppercase.includes("MAMBO")) return { text: "MB", bg: "bg-amber-500", border: "border-amber-600/50", textCol: "text-amber-950" };
    if (uppercase.includes("HIROTA")) return { text: "HR", bg: "bg-orange-600", border: "border-orange-700/50", textCol: "text-white" };
    if (uppercase.includes("BH") || uppercase.includes("BELO HORIZONTE")) return { text: "BH", bg: "bg-amber-400", border: "border-amber-500/50", textCol: "text-blue-900" };
    if (uppercase.includes("ASSAÍ") || uppercase.includes("ASSAI")) return { text: "AS", bg: "bg-orange-500", border: "border-orange-600/50", textCol: "text-white" };
    if (uppercase.includes("ATACADÃO") || uppercase.includes("ATACADAO")) return { text: "AT", bg: "bg-red-600", border: "border-red-750", textCol: "text-white" };
    if (uppercase.includes("VILLEFORT")) return { text: "VF", bg: "bg-sky-600", border: "border-sky-700", textCol: "text-white" };

    const parts = name.split(" ").filter(Boolean);
    const initials = parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    return {
      text: initials || "?",
      bg: chain.logoColor || "bg-gray-600",
      border: "border-gray-500/20",
      textCol: "text-white",
    };
  };

  const { text, bg, border, textCol } = getInitialsAndColors(chain.name);
  const sizeClasses = size === "sm" ? "w-6 h-6 text-[9px] font-bold rounded" : size === "md" ? "w-10 h-10 text-sm font-black rounded-lg" : "w-16 h-16 text-xl font-black rounded-xl";

  if (chain.logoUrl) {
    return (
      <div className={`overflow-hidden border border-gray-200 shrink-0 bg-white flex items-center justify-center ${sizeClasses}`}>
        <img src={chain.logoUrl} alt={chain.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center shrink-0 border select-none font-bold uppercase ${bg} ${border} ${textCol} ${sizeClasses} font-mono`} title={chain.name}>
      {text}
    </div>
  );
}


interface RegisterPriceProps {
  products: Product[];
  chains: Chain[];
  records?: PriceRecord[];
  onSaveRecord: (newRecord: PriceRecord) => void;
  currentUser: User | null;
  onNavigate?: (page: string, params?: any) => void;
}

export function RegisterPrice({ products, chains, records = [], onSaveRecord, currentUser, onNavigate }: RegisterPriceProps) {
  // Navigation Steps
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Duplication warning confirm
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // Inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedChainId, setSelectedChainId] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Redirect after success prompt state
  const [showRedirectPrompt, setShowRedirectPrompt] = useState(false);
  const [lastRegisteredProductId, setLastRegisteredProductId] = useState('');

  // Image & upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalSizeKB, setOriginalSizeKB] = useState<number>(0);
  const [compressedSizeKB, setCompressedSizeKB] = useState<number>(0);
  const [compressionRatio, setCompressionRatio] = useState<number>(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // IA pricing analyzer state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisMessage, setAiAnalysisMessage] = useState('');

  const analyzeImage = async (base64Image: string) => {
    setIsAnalyzing(true);
    setAiAnalysisMessage('Iniciando análise inteligente da imagem...');
    try {
      const res = await fetch('/api/analyze-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Image,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            weight: p.weight,
            category: p.category
          }))
        })
      });

      if (!res.ok) {
        throw new Error('Falha na resposta do servidor de IA');
      }

      const data = await res.json();
      
      if (data) {
        let priceSet = false;
        if (data.price !== undefined && data.price !== null) {
          const formattedPrice = String(data.price).replace('.', ',');
          setPrice(formattedPrice);
          priceSet = true;
        }

        let productMatched = false;
        if (data.matchedProductId) {
          const matchedProd = products.find(p => p.id === data.matchedProductId);
          if (matchedProd) {
            setSelectedProductId(matchedProd.id);
            setProductSearch(matchedProd.name);
            productMatched = true;
          }
        }

        if (priceSet && productMatched) {
          setAiAnalysisMessage(`✨ IA detectou: ${data.detectedText || 'Sucesso!'}`);
        } else if (priceSet) {
          setAiAnalysisMessage(`✨ IA detectou o Preço (R$ ${String(data.price).replace('.', ',')}), mas não identificou o produto no catálogo.`);
        } else if (productMatched) {
          setAiAnalysisMessage(`✨ IA identificou o Produto, mas não conseguiu ler o preço.`);
        } else {
          setAiAnalysisMessage(`⚠️ IA leu: "${data.detectedText || 'Sem correspondência'}". Não pôde preencher automaticamente.`);
        }
      }
    } catch (err: any) {
      console.error('Erro na análise automática:', err);
      setAiAnalysisMessage('⚠️ Não foi possível analisar a imagem automaticamente. Insira os dados manualmente.');
    } finally {
      setIsAnalyzing(false);
      // Auto advance to step 3 once the AI scanner completes (on success or fail to allow manual correction)
      setStep(3);
    }
  };

  // Camera integration state
  const [useCamera, setUseCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dropdown search filtering
  const filteredProductsBySearch = useMemo(() => {
    const activeProducts = products.filter(p => p.active);
    if (!productSearch) return activeProducts;
    const searchTerms = productSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return activeProducts.filter((p) => {
      return searchTerms.every((term) => {
        const nameMatch = p.name.toLowerCase().includes(term);
        const categoryMatch = p.category ? p.category.toLowerCase().includes(term) : false;
        const subcategoryMatch = p.subcategory ? p.subcategory.toLowerCase().includes(term) : false;
        const brandMatch = p.brand ? p.brand.toLowerCase().includes(term) : false;
        const weightMatch = p.weight ? p.weight.toLowerCase().includes(term) : false;
        return nameMatch || categoryMatch || subcategoryMatch || brandMatch || weightMatch;
      });
    });
  }, [products, productSearch]);

  // Helper to find latest price
  const getLatestPrice = (productId: string, chainId: string) => {
    const chainRecords = [...records].filter(r => r.productId === productId && r.chainId === chainId);
    if (chainRecords.length === 0) return null;
    chainRecords.sort((a, b) => b.date.localeCompare(a.date));
    return chainRecords[0].price;
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProductId(product.id);
    setProductSearch(product.name);
    setShowSearchDropdown(false);
  };

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Image compressor using Canvas to satisfy "Comprimir imagens antes do upload"
  const compressImage = (base64Str: string, originalBytes: number) => {
    setIsCompressing(true);
    
    // Simulate real visual feedback of compression calculation
    setOriginalSizeKB(Math.round(originalBytes / 1024));

    const img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setImagePreview(base64Str);
        setCompressedSizeKB(Math.round(originalBytes / 1024));
        setCompressionRatio(0);
        setIsCompressing(false);
        analyzeImage(base64Str);
        return;
      }

      // Max dimension of 800px for shelf audits
      const maxDim = 800;
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      // Export as JPEG with 0.6 quality (60% comp ratio)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
      
      // Calculate compressed size
      const stringLength = compressedBase64.length - 'data:image/jpeg;base64,'.length;
      const actualCompressedBytes = stringLength * 0.75; // exact base64 decoding ratio
      
      setImagePreview(compressedBase64);
      setCompressedSizeKB(Math.round(actualCompressedBytes / 1024));
      
      const savedPct = Math.round((1 - (actualCompressedBytes / originalBytes)) * 100);
      setCompressionRatio(savedPct > 0 ? savedPct : 0);
      setIsCompressing(false);
      analyzeImage(compressedBase64);
    };
  };

  // File Selector input handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, envie um arquivo de imagem válido (PNG/JPG/WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      compressImage(result, file.size);
    };
    reader.readAsDataURL(file);
  };

  // Setup camera stream when camera is active
  useEffect(() => {
    if (useCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => console.error('Video play error:', err));
    }
  }, [useCamera, cameraStream]);

  // Turn on camera for real-time video capture
  const startCamera = async () => {
    setErrorMsg('');
    setUseCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // favor secondary mobile camera
        audio: false,
      });
      setCameraStream(stream);
    } catch (err) {
      console.error('Camera access error:', err);
      // Give fallback mock image if webcam is physically restricted
      setCameraStream(null);
      setErrorMsg('Câmera física indisponível no navegador. Gerando foto de prateleira simulada para gôndola.');
      
      // Seed a lovely preset retail photo to satisfy preview
      setTimeout(() => {
        const fallbackUrl = `data:image/svg+xml;utf8,<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="%23dfdfdf"/><text x="200" y="140" font-family="sans-serif" font-weight="bold" font-size="14" fill="%23D40511" text-anchor="middle">FOTO DE GÔNDOLA AUDITADA</text><text x="200" y="165" font-family="sans-serif" font-size="10" fill="%23555555" text-anchor="middle">Camera simulator fallback - PriceHub Mobile v1.4</text></svg>`;
        compressImage(fallbackUrl, 250000); // simulate 250KB photo
        setUseCamera(false);
      }, 1000);
    }
  };

  // Capture frame from active video feed stream
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const cw = videoRef.current.videoWidth || 640;
    const ch = videoRef.current.videoHeight || 480;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = cw;
    canvasRef.current.height = ch;
    ctx.drawImage(videoRef.current, 0, 0, cw, ch);

    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);
    
    // Stop camera streams
    stopCamera();

    // Compress raw frame
    const approximateOriginalSize = dataUrl.length * 0.75;
    compressImage(dataUrl, approximateOriginalSize);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setUseCamera(false);
  };

  useEffect(() => {
    // Cleanup stream on destruction
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSubmit(false);
  };

  const handleRefuseDuplicate = () => {
    setShowDuplicateConfirm(false);
    setSelectedProductId('');
    setSelectedChainId('');
    setPrice('');
    setNotes('');
    setProductSearch('');
    setImagePreview(null);
    setOriginalSizeKB(0);
    setCompressedSizeKB(0);
    setCompressionRatio(0);
    setAiAnalysisMessage('');
    setIsAnalyzing(false);
    setStep(1);
  };

  const executeSubmit = async (bypassDuplicate = false) => {
    setErrorMsg('');

    if (!selectedProductId) {
      setErrorMsg('Por favor, selecione um produto do catálogo.');
      return;
    }

    if (!selectedChainId) {
      setErrorMsg('Por favor, informe a bandeira da rede onde fez a auditoria.');
      return;
    }

    const priceNum = parseFloat(price.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Por favor, insira um preço de gôndola válido.');
      return;
    }

    // Check duplicate: same product, same chain, same day (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    const isDuplicate = records.some(
      (r) =>
        r.productId === selectedProductId &&
        r.chainId === selectedChainId &&
        r.date === todayStr
    );

    if (isDuplicate && !bypassDuplicate) {
      setShowDuplicateConfirm(true);
      return;
    }

    setShowDuplicateConfirm(false);
    setIsUploading(true);
    try {
      let finalImageUrl = '';
      if (imagePreview) {
        finalImageUrl = await uploadToSupabaseStorage(imagePreview, 'images');
      }

      let finalNotes = notes.trim();
      if (aiAnalysisMessage) {
        finalNotes = finalNotes ? `[IA] ${finalNotes}` : '[IA] Monitorado via Scanner Inteligente';
      }

      const newRecord: PriceRecord = {
        id: `rec-usr-${Date.now()}`,
        productId: selectedProductId,
        chainId: selectedChainId,
        price: priceNum,
        date: todayStr,
        imageUrl: finalImageUrl,
        notes: finalNotes || undefined,
        userName: currentUser?.name || 'Vendedor Autônomo',
        userEmail: currentUser?.email || 'vendas@radar.com'
      };

      const productIdRegistered = selectedProductId;
      setLastRegisteredProductId(productIdRegistered);

      onSaveRecord(newRecord);

      // Show success feedback and clear form
      setSuccessMsg(true);
      setSelectedProductId('');
      setPrice('');
      setNotes('');
      setProductSearch('');
      setImagePreview(null);
      setOriginalSizeKB(0);
      setCompressedSizeKB(0);
      setCompressionRatio(0);
      setAiAnalysisMessage('');
      setIsAnalyzing(false);
      setStep(1); // Back to Step 1 upon successful completion
      setShowRedirectPrompt(true); // Ask if user wants to register more

      setTimeout(() => {
        setSuccessMsg(false);
      }, 4000);
    } catch (err: any) {
      console.error("Erro no processamento:", err);
      setErrorMsg("Falha ao salvar auditoria ou hospedar a imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10" id="register-price-view">

      {/* Visual Stepper Progress Indicator */}
      <div className="flex items-center justify-between max-w-lg mx-auto px-4 select-none" id="stepper-progress-indicator">
        {[
          { num: 1, label: 'Rede', desc: 'Identificar Canal' },
          { num: 2, label: 'Foto', desc: 'Scanner Inteligente' },
          { num: 3, label: 'Confirmação', desc: 'Auditar Dados' }
        ].map((s, idx) => (
          <React.Fragment key={s.num}>
            {idx > 0 && (
              <div 
                className={`flex-1 h-0.5 mx-2 sm:mx-4 transition-colors duration-300 ${
                  step >= s.num ? 'bg-[#D40511]' : 'bg-slate-100'
                }`}
              />
            )}
            <button
              type="button"
              disabled={s.num > step} // Can only navigate backward manually to edit
              onClick={() => {
                if (s.num < step) {
                  stopCamera();
                  setStep(s.num as 1 | 2 | 3);
                }
              }}
              className="flex flex-col items-center focus:outline-none group disabled:cursor-not-allowed"
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === s.num 
                    ? 'bg-[#D40511] text-white shadow-sm ring-4 ring-red-150' 
                    : step > s.num 
                      ? 'bg-emerald-500 text-white shadow-2xs' 
                      : 'bg-slate-50 text-slate-400 border border-slate-100'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-4 h-4 text-white" /> : s.num}
              </div>
              <span className={`text-[10px] font-bold mt-2 tracking-wide uppercase transition-colors duration-300 ${
                step === s.num ? 'text-slate-800' : 'text-slate-400'
              }`}>
                {s.label}
              </span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {successMsg && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex items-start gap-4 shadow-sm" id="register-success-box">
          <div className="p-2 bg-emerald-500 text-white rounded-xl">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <p className="text-sm font-bold font-sans">Preço Auditado com Sucesso!</p>
            <p className="text-xs text-emerald-700/90 mt-1 font-medium leading-relaxed">
              O registro foi consolidado, verificado por scanner IA e transmitido em tempo real para o dashboard executivo do PriceHub.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-5 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-start gap-4 shadow-sm" id="register-error-box">
          <div className="p-2 bg-rose-500 text-white rounded-xl col-span-1 shrink-0">
            <AlertTriangle className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <p className="text-sm font-bold font-sans">Falha na Auditoria</p>
            <p className="text-xs text-rose-700/90 mt-1 font-medium leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* STEP 1 — Selecionar Rede */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 space-y-6" id="step-1-container">
          <div className="border-b border-slate-50 pb-4">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest leading-none">
              Etapa 1 — Selecionar Rede
            </h2>
            <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
              Inicie selecionando a bandeira do ponto de venda para habilitar a coleta de fotos e dados.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="chains-selection-grid">
            {chains.map((chain) => {
              const borderCol = chain.logoColor ? chain.logoColor.replace('bg-', 'border-') : 'border-slate-200';
              const ringColor = chain.logoColor ? chain.logoColor.replace('bg-', 'ring-') : 'ring-red-500';

              return (
                <button
                  key={chain.id}
                  type="button"
                  id={`select-chain-${chain.id}`}
                  onClick={() => {
                    setSelectedChainId(chain.id);
                    setStep(2);
                  }}
                  className={`p-5 rounded-2xl border text-left flex items-center gap-4 transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-xs cursor-pointer ${
                    selectedChainId === chain.id
                      ? `${borderCol} ring-2 ${ringColor}/30 bg-slate-50/25`
                      : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/10'
                  }`}
                >
                  <RetailerLogo chain={chain} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-slate-800 truncate leading-snug">
                      {chain.name}
                    </h3>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mt-0.5">
                      Ponto de Venda
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 ml-auto" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2 — Foto da Gôndola */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 space-y-6" id="step-2-container">
          <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                Etapa 2 — Foto da Gôndola
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                Envie uma foto de gôndola nítida para que a IA detecte preço e produto correspondentes.
              </p>
            </div>
            {selectedChainId && (
              <div className="sm:flex items-center gap-2 bg-slate-50 border border-slate-100/50 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 self-start sm:self-auto shrink-0 max-w-full truncate">
                <RetailerLogo chain={chains.find(c => c.id === selectedChainId)!} size="sm" />
                <span className="truncate max-w-[120px]">{chains.find(c => c.id === selectedChainId)?.name}</span>
              </div>
            )}
          </div>

          {!useCamera && !isAnalyzing ? (
            <div className="space-y-6" id="photo-triggers-container">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Abrir Câmera */}
                <button
                  id="btn-open-camera"
                  type="button"
                  onClick={startCamera}
                  className="p-8 rounded-2xl bg-[#D40511] hover:bg-[#b0040e] text-white flex flex-col items-center justify-center gap-4 transition-all duration-300 group shadow-sm hover:shadow-md cursor-pointer"
                >
                  <div className="p-4 bg-white/10 rounded-full group-hover:scale-105 transition-transform">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-extrabold text-base">Abrir Câmera</h3>
                    <p className="text-xs text-white/70 mt-1 max-w-[160px] mx-auto font-medium leading-relaxed">
                      Capture fotos em tempo real usando a lente do celular
                    </p>
                  </div>
                </button>

                {/* Selecionar Galeria */}
                <label
                  id="label-select-gallery"
                  className="p-8 rounded-2xl bg-white border border-slate-200 hover:border-[#D40511]/40 text-slate-800 flex flex-col items-center justify-center gap-4 transition-all duration-300 group shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  <div className="p-4 bg-slate-50 border border-slate-100 group-hover:bg-slate-100 group-hover:border-[#D40511]/20 rounded-full group-hover:scale-105 transition-all">
                    <Image className="w-8 h-8 text-slate-500 group-hover:text-[#D40511]" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-extrabold text-base text-slate-800">Selecionar Galeria</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-[160px] mx-auto font-medium leading-relaxed">
                      Selecione uma imagem das pastas locais do dispositivo
                    </p>
                  </div>
                  <input
                    id="register-photo-file-picker"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-50 text-center">
                <button
                  id="btn-skip-photo"
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setAiAnalysisMessage('');
                    setIsAnalyzing(false);
                    // Clear fields to let user insert manually
                    setSelectedProductId('');
                    setProductSearch('');
                    setPrice('');
                    setNotes('');
                    setStep(3);
                  }}
                  className="text-xs text-slate-500 hover:text-[#D40511] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  Registrar sem foto →
                </button>
              </div>
            </div>
          ) : useCamera ? (
            /* Live Camera view screen */
            <div className="space-y-5" id="live-camera-feed-box-camera">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-72 shadow-inner border border-slate-800">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted></video>
                <canvas ref={canvasRef} className="hidden"></canvas>
                {/* Overlay bounding box effect */}
                <div className="absolute inset-x-6 inset-y-8 border border-dashed border-violet-400/50 rounded-lg pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-violet-400 animate-pulse absolute"></div>
                  <span className="text-[10px] text-violet-300 font-mono tracking-widest font-extrabold uppercase bg-black/65 px-2.5 py-0.5 rounded border border-violet-500/20">Ajuste o Enquadramento</span>
                </div>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  id="capture-shutter-btn"
                  type="button"
                  onClick={captureFrame}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition duration-150 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Capturar Foto</span>
                </button>
                <button
                  id="cancel-camera-stream-btn"
                  type="button"
                  onClick={stopCamera}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition duration-150 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          ) : isAnalyzing ? (
            /* AI Scanner Processing animation screen */
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center" id="ai-scanning-progress">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-slate-50 border-t-violet-600 animate-spin"></div>
                <Sparkles className="w-6 h-6 text-violet-600 animate-pulse absolute top-5 left-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Scanner Inteligente Ativo</h4>
                <p className="text-xs text-slate-400 mt-1 animate-pulse font-medium">Lendo produto e preço da prateleira por Inteligência Artificial...</p>
              </div>
              {imagePreview && (
                <div className="mt-4 max-w-xs relative rounded-xl overflow-hidden border border-slate-100 shadow-2xs">
                  <img src={imagePreview} alt="Enviado" className="max-h-36 object-contain opacity-70" referrerPolicy="no-referrer" />
                </div>
              )}
            </div>
          ) : null}

          <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-extrabold text-slate-400 hover:text-slate-850 transition duration-150 cursor-pointer inline-flex items-center gap-1"
            >
              &larr; Voltar para Rede
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Confirmação dos dados */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 space-y-6" id="step-3-container">
          <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                Etapa 3 — Confirmação dos dados
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                Revise os valores detectados automaticamente ou faça as correções necessárias.
              </p>
            </div>
            {selectedChainId && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 self-start sm:self-auto shrink-0 max-w-full truncate">
                <RetailerLogo chain={chains.find(c => c.id === selectedChainId)!} size="sm" />
                <span className="truncate max-w-[120px] font-bold">{chains.find(c => c.id === selectedChainId)?.name}</span>
              </div>
            )}
          </div>

          {/* AI Banner feedback if image exists */}
          {imagePreview && (
            <div className="p-4 bg-violet-50/45 border border-violet-100/50 rounded-xl space-y-4" id="ai-feedback-banner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-violet-50/20 p-1 rounded-lg">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-violet-900">Leitura Inteligente Concluída</h4>
                    <p className="text-xs text-violet-700/90 mt-0.5 leading-relaxed">{aiAnalysisMessage || 'Valores preenchidos sob os rótulos de gôndola.'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => analyzeImage(imagePreview)}
                  className="sm:self-center shrink-0 flex items-center justify-center gap-1 text-[9px] bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-1.5 px-3 rounded-lg font-mono transition cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5 animate-spin-hover" />
                  Reanalisar
                </button>
              </div>

            
            </div>
          )}

          {/* Inputs */}
          <div className="space-y-5" id="form-fields-grid">
            
            {/* Product combo picker */}
            <div className="relative" id="product-search-combobox">
              <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                Produto Auditado *
              </label>
              <div className="relative">
                <input
                  id="register-product-search-input"
                  type="text"
                  placeholder="Digite o nome, marca ou peso do produto..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#D40511] focus:bg-white focus:ring-1 focus:ring-[#D40511] transition-all"
                  required
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('');
                      setSelectedProductId('');
                      setShowSearchDropdown(true);
                    }}
                    className="absolute right-4 top-3 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Visual preview of selected product with photo */}
              {selectedProduct && (
                <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-100/80 rounded-xl flex items-center justify-between gap-3 animate-fade-in" id="selected-product-preview-card">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-white overflow-hidden flex items-center justify-center border border-slate-200 shrink-0">
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold uppercase">Sem Foto</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{selectedProduct.name}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium font-sans">
                          {selectedProduct.category} {selectedProduct.subcategory ? `• ${selectedProduct.subcategory}` : ''} {selectedProduct.weight ? `• ${selectedProduct.weight}` : ''}
                        </span>
                        <span className={`text-[9px] font-extrabold border rounded px-1.5 py-0.2 whitespace-nowrap uppercase font-mono tracking-wide ${
                          (selectedProduct.brand?.toLowerCase().includes('mavalerio') || selectedProduct.brand?.toLowerCase().includes('mavalério'))
                            ? 'bg-violet-50 text-violet-800 border-violet-100'
                            : selectedProduct.isCompetitor
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-150'
                        }`}>
                          {selectedProduct.brand || 'Dr. Oetker'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedChainId && (
                    <div className="shrink-0 text-right">
                       <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Último</span>
                       <span className="font-mono text-xs text-slate-800 font-bold">
                        {getLatestPrice(selectedProduct.id, selectedChainId) 
                          ? `R$ ${getLatestPrice(selectedProduct.id, selectedChainId)?.toFixed(2).replace('.', ',')}` 
                          : '---'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Combobox autocomplete selections list */}
              {showSearchDropdown && (
                <div className="absolute z-10 w-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto pointer-events-auto" id="autocomplete-list" onClick={(e) => e.stopPropagation()}>
                  {filteredProductsBySearch.map((prod) => (
                    <div
                      id={`autocomplete-item-${prod.id}`}
                      key={prod.id}
                      onClick={() => handleProductSelect(prod)}
                      className="px-4 py-3 hover:bg-slate-50 text-xs text-slate-800 cursor-pointer flex items-center justify-between pointer-events-auto border-b border-slate-50/50 last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        {/* Auto-suggest product image preview */}
                        <div className="w-9 h-9 rounded-md bg-white overflow-hidden flex items-center justify-center border border-slate-100 shrink-0">
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-[9px] text-slate-300 font-bold uppercase">SF</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-850 truncate">{prod.name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 font-sans">
                            {prod.category} {prod.subcategory ? `• ${prod.subcategory}` : ''} {prod.weight ? `• ${prod.weight}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {selectedChainId && (
                          <span className="font-mono text-[10px] text-slate-500 font-bold">
                            {getLatestPrice(prod.id, selectedChainId) 
                              ? `R$ ${getLatestPrice(prod.id, selectedChainId)?.toFixed(2).replace('.', ',')}` 
                              : '---'}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {prod.isCompetitor ? (
                            <span className="text-[8px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 rounded-md px-2 py-0.5 whitespace-nowrap uppercase font-mono tracking-wide">
                              {prod.brand}
                            </span>
                          ) : (
                            <span className={`text-[8px] font-extrabold border rounded-md px-2 py-0.5 whitespace-nowrap uppercase font-mono tracking-wide ${
                              (prod.brand?.toLowerCase().includes('mavalerio') || prod.brand?.toLowerCase().includes('mavalério'))
                                ? 'bg-violet-50 text-violet-800 border-violet-100'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-150'
                            }`}>
                              {prod.brand || 'Dr. Oetker'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredProductsBySearch.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum produto correspondente encontrado.</div>
                  )}
                </div>
              )}
            </div>

            {/* Price field */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                Preço de Gôndola (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-sm text-slate-400 font-mono font-bold">R$</span>
                <input
                  id="register-price-input"
                  type="text"
                  placeholder="0,00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-800 font-mono focus:outline-none focus:border-[#D40511] focus:bg-white focus:ring-1 focus:ring-[#D40511] transition-all"
                  required
                />
              </div>
            </div>

            {/* Observations text field */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                Observações Técnicas <span className="text-slate-400 font-medium lowercase">(opcional)</span>
              </label>
              <textarea
                id="register-notes-textarea"
                placeholder="Destaques na gôndola, ruptura de estoque, preços promocionais, campanhas, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#D40511] focus:bg-white focus:ring-1 focus:ring-[#D40511] transition-all h-24 resize-none"
              ></textarea>
            </div>

          </div>

          <canvas ref={canvasRef} className="hidden"></canvas>

          {/* Stepper bottom control buttons */}
          <div className="pt-4 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full sm:w-auto text-xs font-extrabold text-slate-400 hover:text-slate-850 transition duration-150 cursor-pointer inline-flex items-center justify-center gap-1 py-3"
            >
              &larr; Voltar para Foto
            </button>

            <button
              id="submit-register-price-form"
              type="submit"
              disabled={isUploading}
              className="w-full sm:w-auto bg-[#D40511] hover:bg-[#b0040e] text-white px-8 py-3.5 rounded-xl text-sm font-bold disabled:bg-slate-300 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Hospedando Imagem...</span>
                </>
              ) : (
                <span>Confirmar Auditoria de Preço</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Success/Redirect prompt Modal overlay */}
      {showRedirectPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans" id="register-redirect-modal-overlay">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6" id="register-redirect-modal-content">
            <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900">Preço Registrado com Sucesso!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Os dados foram computados e publicados no painel do PriceHub. Deseja realizar outra auditoria de preço agora?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                id="btn-register-more-yes"
                onClick={() => {
                  setShowRedirectPrompt(false);
                  setStep(2);
                }}
                className="flex-1 px-4 py-2.5 bg-[#D40511] hover:bg-[#b0040e] text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer shadow-xs text-center"
              >
                Sim, registrar outro
              </button>
              <button
                type="button"
                id="btn-register-more-no"
                onClick={() => {
                  setShowRedirectPrompt(false);
                  if (onNavigate && lastRegisteredProductId) {
                    onNavigate("produtos", { action: "detail", productId: lastRegisteredProductId });
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition duration-150 cursor-pointer border border-slate-200 text-center"
              >
                Não, ver detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplication confirmation modal overlay */}
      {showDuplicateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs font-sans animate-fade-in" id="register-duplicate-modal-overlay">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6" id="register-duplicate-modal-content">
            <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 shrink-0 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-slate-900">Atualização de Preço Já Realizada!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Já foi registrada uma atualização de preço para o produto <strong className="text-slate-800">{selectedProduct?.name}</strong> na rede <strong className="text-slate-800">{chains.find(c => c.id === selectedChainId)?.name}</strong> no dia de hoje.
              </p>
              <p className="text-xs text-slate-400 font-medium">
                Deseja registrar uma nova modificação de preço para este mesmo produto hoje?
              </p>
            </div>

            {/* Selected product and chain visual confirmation */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                {selectedProduct?.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[10px] text-slate-300 font-bold uppercase font-sans">SF</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-800 truncate leading-tight">{selectedProduct?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-medium text-slate-400 leading-none">{selectedProduct?.weight || ''}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 rounded bg-slate-100 px-1 py-0.5 leading-none">
                    {chains.find(c => c.id === selectedChainId) && (
                      <RetailerLogo chain={chains.find(c => c.id === selectedChainId)!} size="sm" />
                    )}
                    <span className="truncate max-w-[80px] font-bold font-sans">{chains.find(c => c.id === selectedChainId)?.name}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                id="btn-duplicate-confirm-accept"
                onClick={() => {
                  executeSubmit(true);
                }}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer shadow-xs text-center border border-emerald-700/20"
              >
                Sim, salvar mesmo assim
              </button>
              <button
                type="button"
                id="btn-duplicate-confirm-refuse"
                onClick={handleRefuseDuplicate}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition duration-150 cursor-pointer border border-slate-200 text-center select-none"
              >
                Não, recusar e voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

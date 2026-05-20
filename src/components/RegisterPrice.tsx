import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, Image, CheckCircle2, AlertTriangle, Sparkles, Sliders, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import { Product, Chain, PriceRecord, User } from '../types';
import { uploadToSupabaseStorage } from '../lib/supabase';


interface RegisterPriceProps {
  products: Product[];
  chains: Chain[];
  onSaveRecord: (newRecord: PriceRecord) => void;
  currentUser: User | null;
}

export function RegisterPrice({ products, chains, onSaveRecord, currentUser }: RegisterPriceProps) {
  // Inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedChainId, setSelectedChainId] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

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

  const handleProductSelect = (product: Product) => {
    setSelectedProductId(product.id);
    setProductSearch(product.name);
    setShowSearchDropdown(false);
  };

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      // Give fallback mock image if webcam is physically restricted
      setCameraStream(null);
      setErrorMsg('Câmera física indisponível no navegador. Gerando foto de prateleira simulada para gôndola.');
      
      // Seed a lovely preset retail photo to satisfy preview
      setTimeout(() => {
        const fallbackUrl = `data:image/svg+xml;utf8,<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="%23dfdfdf"/><text x="200" y="140" font-family="sans-serif" font-weight="bold" font-size="14" fill="%23D40511" text-anchor="middle">FOTO DE GÔNDOLA AUDITADA</text><text x="200" y="165" font-family="sans-serif" font-size="10" fill="%23555555" text-anchor="middle">Camera simulator fallback - RADAR Mobile v1.4</text></svg>`;
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setIsUploading(true);
    try {
      let finalImageUrl = '';
      if (imagePreview) {
        finalImageUrl = await uploadToSupabaseStorage(imagePreview, 'images');
      }

      const newRecord: PriceRecord = {
        id: `rec-usr-${Date.now()}`,
        productId: selectedProductId,
        chainId: selectedChainId,
        price: priceNum,
        date: new Date().toISOString().split('T')[0],
        imageUrl: finalImageUrl,
        notes: notes.trim() || undefined,
        userName: currentUser?.name || 'Vendedor Autônomo',
        userEmail: currentUser?.email || 'vendas@radar.com'
      };

      onSaveRecord(newRecord);

      // Show success feedback and clear form
      setSuccessMsg(true);
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
    <div className="max-w-2xl mx-auto space-y-6" id="register-price-view">
      {/* View Title */}
      <div className="border-b border-[#E0E0E0] pb-6" id="register-price-header">
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase font-mono">
          Painel do Colaborador em Campo
        </span>
        <h1 className="text-3xl font-black text-[#1A1A1A] font-sans">
          Registrar Preço Rápido
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Formulário leve otimizado para celulares. Pesquise o produto e registre fotos das gôndolas em tempo real.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3" id="register-success-box">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold font-sans">Auditoria salva com sucesso!</p>
            <p className="text-xs text-emerald-700 mt-0.5">O preço foi processado, otimizado e sincronizado no painel geral.</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3" id="register-error-box">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold font-sans">Atenção</p>
            <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-6 space-y-5" id="register-price-form">
        
        {/* Product selector search dropdown */}
        <div className="relative" id="product-search-combobox">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            Produto Auditado *
          </label>
          <div className="relative">
            <input
              id="register-product-search-input"
              type="text"
              placeholder="Digite o nome do produto..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-full px-3 py-2.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511]"
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
                className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Dynamic autocomplete dropdown list */}
          {showSearchDropdown && (
            <div className="absolute z-10 w-full left-0 mt-1 bg-white border border-[#E0E0E0] rounded-lg shadow-lg max-h-48 overflow-y-auto" id="autocomplete-list">
              {filteredProductsBySearch.map((prod) => (
                <div
                  id={`autocomplete-item-${prod.id}`}
                  key={prod.id}
                  onClick={() => handleProductSelect(prod)}
                  className="px-4 py-2.5 hover:bg-[#F5F5F5] text-xs text-[#1A1A1A] cursor-pointer flex items-center justify-between pointer-events-auto"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-medium font-sans text-xs text-[#1A1A1A] truncate">{prod.name}</span>
                    <span className="text-[9px] text-gray-400 font-sans mt-0.5">
                      {prod.category} {prod.subcategory ? `• ${prod.subcategory}` : ''} {prod.weight ? `• ${prod.weight}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {prod.isCompetitor ? (
                      <span className="text-[8px] font-extrabold bg-blue-50 text-blue-700 border border-blue-150 rounded px-1.5 py-0.5 whitespace-nowrap uppercase font-mono">
                        Concorrente: {prod.brand}
                      </span>
                    ) : (
                      <span className={`text-[8px] font-extrabold border rounded px-1.5 py-0.5 whitespace-nowrap uppercase font-mono ${
                        (prod.brand?.toLowerCase().includes('mavalerio') || prod.brand?.toLowerCase().includes('mavalério'))
                          ? 'bg-violet-50 text-violet-800 border-violet-150'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-150'
                      }`}>
                        Nossa Marca: {prod.brand || 'Dr. Oetker'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {filteredProductsBySearch.length === 0 && (
                <div className="p-3 text-center text-xs text-gray-400 italic">Nenhum produto correspondente ativo.</div>
              )}
            </div>
          )}
        </div>

        {/* Chain Selector and Price Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="chain-price-inputs">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Bandeira / Canal *
            </label>
            <select
              id="register-chain-select"
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
              required
            >
              <option value="">Selecione a rede do ponto de venda...</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Preço de Gôndola (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-gray-400 font-mono">R$</span>
              <input
                id="register-price-input"
                type="text"
                placeholder="0,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm text-[#1A1A1A] font-mono focus:outline-none focus:border-[#D40511]"
                required
              />
            </div>
          </div>
        </div>

        {/* Audit Verification Photo Upload Component (Required as proof) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            Foto Comprobatória de Gôndola (Opcional)
          </label>

          <div className="border-2 border-dashed border-[#E0E0E0] rounded-xl p-6 bg-[#F5F5F5]/40 text-center relative" id="photo-uploader-container">
            {useCamera ? (
              // Live camera feed simulator frame
              <div className="space-y-4" id="live-camera-feed-box">
                <video ref={videoRef} className="w-full rounded-lg mx-auto aspect-video max-h-48 object-cover bg-black" playsInline muted></video>
                <div className="flex justify-center gap-2">
                  <button
                    id="trigger-shutter-btn"
                    type="button"
                    onClick={captureFrame}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    Capturar Foto
                  </button>
                  <button
                    id="cancel-camera-btn"
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 bg-[#D40511] text-white rounded-md text-xs font-bold hover:bg-red-700 transition"
                  >
                    Fechar Câmera
                  </button>
                </div>
              </div>
            ) : imagePreview ? (
              // Uploaded/Captured Image Preview and Compression Metrics Banner
              <div className="space-y-4" id="uploaded-photo-preview-box">
                <div className="relative inline-block max-h-48 overflow-hidden rounded-lg border border-[#E0E0E0]">
                  <img src={imagePreview} alt="Comprovação de Gôndola" referrerPolicy="no-referrer" className="max-h-44 object-contain" />
                  <button
                    id="remove-uploaded-photo-btn"
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setAiAnalysisMessage('');
                      setIsAnalyzing(false);
                    }}
                    className="absolute -top-1 -right-1 bg-[#1A1A1A] text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                {/* Intelligent Compression Savings Tag */}
                <div className="bg-[#1A1A1A] text-white rounded-xl p-3 max-w-sm mx-auto text-xs grid grid-cols-3 divide-x divide-gray-700 text-center">
                  <div>
                    <span className="block text-[8px] text-gray-400 capitalize font-mono">Original</span>
                    <span className="font-mono text-xs">{originalSizeKB} KB</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-gray-400 capitalize font-mono">Comprimido</span>
                    <span className="font-mono text-emerald-400 text-xs font-semibold">{compressedSizeKB} KB</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-gray-400 capitalize font-mono">Economia</span>
                    <span className="font-mono text-emerald-400 text-xs font-bold"><Sparkles className="inline w-3 h-3 text-amber-400 -mt-0.5" /> -{compressionRatio}%</span>
                  </div>
                </div>

                {/* AI Scanner Analysis Box */}
                {isAnalyzing ? (
                  <div className="flex items-center justify-center gap-2 p-3 text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-xl animate-pulse max-w-sm mx-auto">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-600 shrink-0" />
                    <span className="font-semibold">Scanner Inteligente IA analisando preço e produto...</span>
                  </div>
                ) : aiAnalysisMessage ? (
                  <div className="p-3 text-xs bg-violet-50 text-violet-800 border border-violet-200 rounded-xl flex items-center justify-between gap-3 max-w-sm mx-auto text-left">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5 animate-pulse" />
                      <span className="leading-relaxed">{aiAnalysisMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => analyzeImage(imagePreview)}
                      className="shrink-0 flex items-center gap-1 text-[9px] bg-violet-600 text-white font-bold py-1.5 px-2.5 rounded hover:bg-violet-700 font-mono transition cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Reanalisar
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              // Empty selection prompt buttons
              <div className="space-y-3" id="uploader-idle-prompt">
                <div className="mx-auto w-10 h-10 bg-[#F5F5F5] rounded-full flex items-center justify-center text-gray-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-sans">
                    Arraste ou envie uma foto do preço legível na prateleira
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Formatos suportados: PNG, JPG, WEBP. O sistema comprimirá antes do upload para Supabase.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2" id="uploader-action-triggers">
                  {/* File Selector */}
                  <label className="px-4 py-2 bg-white border border-[#E0E0E0] hover:border-[#D40511] font-sans text-xs font-bold text-gray-700 rounded-lg shadow-sm hover:shadow duration-150 inline-flex items-center gap-1.5 cursor-pointer">
                    <Image className="w-3.5 h-3.5 text-gray-400" />
                    <span>Selecionar Galeria</span>
                    <input
                      id="register-photo-file-picker"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {/* Camera Launcher */}
                  <button
                    id="trigger-camera-launcher-btn"
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-[#D40511] text-white hover:bg-red-700 font-sans text-xs font-bold rounded-lg shadow-sm hover:shadow duration-150 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Abrir Câmera</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Observations Optional Comments */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            Observações Técnicas <span className="text-gray-400 normal-case">(Opcional)</span>
          </label>
          <textarea
            id="register-notes-textarea"
            placeholder="Destaques na gôndola, ruptura de estoque, preços promocionais, campanhas, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511] h-20 resize-none"
          ></textarea>
        </div>

        {/* Hidden Canvas reference for camera capture */}
        <canvas ref={canvasRef} className="hidden"></canvas>

        {/* Submit action */}
        <div className="pt-2">
          <button
            id="submit-register-price-form"
            type="submit"
            disabled={isUploading}
            className="w-full bg-[#D40511] text-white py-3 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-sm active:translate-y-0.5 inline-flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Hospedando Imagem no Supabase...</span>
              </>
            ) : (
              <span>Registrar Preço e Auditar</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

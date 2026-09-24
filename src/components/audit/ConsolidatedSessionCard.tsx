import React, { useState } from 'react';
import { Store, User, Clock, Calendar, AlertTriangle, CheckCircle2, PackageX, ExternalLink, Image as ImageIcon, ChevronRight, Trash2, Edit3 } from 'lucide-react';
import { ResearchSession, formatDateBR } from '../../lib/researchSessions';
import { Product, PriceRecord, Chain } from '../../types';

interface ConsolidatedSessionCardProps {
  key?: React.Key;
  session: ResearchSession;
  products: Product[];
  chains?: Chain[];
  onOpenDetails?: (session: ResearchSession) => void;
  onOpenDetail?: (session: ResearchSession) => void;
  onOpenOutOfStock: (session: ResearchSession) => void;
  onOpenRecordLightbox?: (recordId: string) => void;
  onPreviewImage?: (record: PriceRecord) => void;
  onPreviewProduct?: (product: Product) => void;
  onSelectRecord?: (recordId: string) => void;
  onDeleteSession?: (session: ResearchSession) => void;
  onEditRecord?: (record: PriceRecord) => void;
  isInitiallyExpanded?: boolean;
}

export function ConsolidatedSessionCard({
  session,
  products,
  onOpenDetails,
  onOpenDetail,
  onOpenOutOfStock,
  onOpenRecordLightbox,
  onPreviewImage,
  onPreviewProduct,
  onSelectRecord,
  onDeleteSession,
  onEditRecord,
}: ConsolidatedSessionCardProps) {
  const [showDeleteSessionConfirm, setShowDeleteSessionConfirm] = useState(false);

  const handleOpenDetail = () => {
    onOpenDetails?.(session);
    onOpenDetail?.(session);
  };
  // Map product names for thumbnails in the preview strip
  const productMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const previewRecords = session.consolidatedRecords.slice(0, 6);
  const remainingCount = Math.max(0, session.consolidatedRecords.length - 6);

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden flex flex-col group cursor-pointer"
      onClick={handleOpenDetail}
    >
      {/* Header with Chain branding & session info */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/40 group-hover:bg-slate-50/80 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-xs border border-black/5"
            style={{ backgroundColor: session.chainColor || '#475569' }}
          >
            {session.chainLogoUrl ? (
              <img
                src={session.chainLogoUrl}
                alt={session.chainName}
                className="w-full h-full object-cover rounded-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              session.chainName.substring(0, 2).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 group-hover:text-[#D40511] transition-colors truncate">
                {session.chainName}
              </h3>
              <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                {session.state}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
              <div className="flex items-center gap-1.5 text-slate-700">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-bold">{session.userName}</span>
                <span className="text-[10px] bg-slate-200/70 text-slate-600 font-semibold px-1.5 py-0.2 rounded-sm">
                  {session.userRole}
                </span>
              </div>

              <div className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{session.timeDisplay}</span>
              </div>

              <div className="flex items-center gap-1 text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatDateBR(session.date)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons: Delete Research Session + Arrow */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteSessionConfirm(true);
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all shadow-2xs cursor-pointer border border-transparent hover:border-rose-200"
            title="Excluir esta pesquisa por completo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail();
            }}
            className="p-2 rounded-xl bg-slate-100 group-hover:bg-[#D40511] text-slate-500 group-hover:text-white transition-all shadow-2xs cursor-pointer"
            title="Ver detalhes da pesquisa"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Badges strip: Queue status + Out-of-stock count + Total items */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-100/40 border-b border-slate-150 flex flex-wrap items-center gap-2">
        {/* Total verified items */}
        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{session.consolidatedRecords.length} {session.consolidatedRecords.length === 1 ? 'registro consolidado' : 'registros consolidados'}</span>
        </span>

        {/* Queue Completion Status / In-progress Status */}
        {!session.isConcluded ? (
          <span
            className="text-[11px] font-bold bg-sky-50 text-sky-900 border border-sky-300 px-2.5 py-0.5 rounded-full flex items-center gap-1"
            title="O usuário ainda está no processo de pesquisa e não clicou em Concluir Pesquisa"
          >
            <Clock className="w-3 h-3 text-sky-600 animate-pulse" />
            <span>Pesquisa em andamento: Usuário ainda não concluiu</span>
          </span>
        ) : session.completedEarly ? (
          <span
            className="text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300/80 px-2.5 py-0.5 rounded-full flex items-center gap-1"
            title={`O pesquisador encerrou a pesquisa antes de passar por toda a lista de produtos (${session.remainingQueueCount} itens restantes na fila)`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Fila Incompleta ({session.remainingQueueCount} restantes)</span>
          </span>
        ) : session.queueTotal > 0 ? (
          <span
            className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1"
            title="O pesquisador cobriu 100% da fila de produtos recomendada para esta rede"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Fila 100% Concluída</span>
          </span>
        ) : null}

        {/* Out of Stock ("Não tem") badge */}
        {session.outOfStockProductIds.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenOutOfStock(session);
            }}
            className="text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 transition cursor-pointer"
            title="Clique para ver os produtos marcados como ausentes nesta loja"
          >
            <PackageX className="w-3 h-3 text-rose-600" />
            <span>{session.outOfStockProductIds.length} sem estoque</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 font-medium px-2 py-0.5">
            Sem rupturas registradas
          </span>
        )}

        {/* Average price tag */}
        {session.averagePrice > 0 && (
          <span className="ml-auto text-[11px] text-slate-500 font-mono">
            Média: <strong className="text-slate-700">R$ {session.averagePrice.toFixed(2).replace('.', ',')}</strong>
          </span>
        )}
      </div>

      {/* Thumbnails preview strip */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-sans">
            Evidências da Pesquisa ({session.consolidatedRecords.length})
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {previewRecords.map((rec) => {
              const prod = productMap.get(rec.productId);
              return (
                <div
                  key={rec.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditRecord) {
                      onEditRecord(rec);
                    } else {
                      handleOpenDetail();
                    }
                  }}
                  className="group/thumb relative aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20 transition"
                  title={`${prod?.name || 'Produto'}: R$ ${rec.price.toFixed(2).replace('.', ',')} (Clique para alterar produto ou preço)`}
                >
                  {rec.imageUrl ? (
                    <img
                      src={rec.imageUrl}
                      alt={prod?.name || 'Evidência'}
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}

                  {/* Quick edit badge on hover */}
                  {onEditRecord && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover/thumb:opacity-100 transition duration-150">
                      <span className="p-1 bg-white/95 text-emerald-700 hover:text-emerald-900 rounded-md shadow-xs flex items-center justify-center">
                        <Edit3 className="w-3 h-3" />
                      </span>
                    </div>
                  )}

                  {/* Price overlay pill */}
                  <div className="absolute bottom-1 right-1 left-1 bg-black/70 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1 py-0.5 rounded text-center truncate">
                    R$ {rec.price.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              );
            })}

            {remainingCount > 0 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDetail();
                }}
                className="aspect-square rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-center p-1"
              >
                <span className="text-xs font-black">+{remainingCount}</span>
                <span className="text-[9px] font-medium leading-tight">mais fotos</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer with action bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">
            {session.hasExplicitSession ? 'Sessão de auditoria guiada' : 'Auditoria em lote'}
          </span>

          <span className="text-xs font-bold text-[#D40511] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
            Ver detalhes da pesquisa &rarr;
          </span>
        </div>
      </div>

      {/* Delete Research Session Confirmation Modal */}
      {showDeleteSessionConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight">
                  Excluir pesquisa por completo?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {session.chainName} ({session.state}) &bull; {session.userName}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-200/80">
              Todos os {session.consolidatedRecords.length} registros e evidências fotográficas desta pesquisa serão permanentemente excluídos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteSessionConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteSessionConfirm(false);
                  onDeleteSession?.(session);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer shadow-xs"
              >
                Sim, Excluir Pesquisa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

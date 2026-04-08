import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, ChevronDown, ChevronUp, Loader2, CheckCircle,
  AlertTriangle, Tag, RefreshCw, Globe, X,
} from 'lucide-react';
import { Station } from '../types';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_COLORS } from '../constants';
import {
  fetchStationKnowledge,
  classifyProduct,
  classifyAccount,
  ClassifyProductPayload,
} from '../services/knowledgeService';
import type { StationKnowledge, ProductType, KnowledgeProduct } from '../types';

interface KnowledgePanelSectionProps {
  stations: Station[];
  isAdmin: boolean;
}

interface ClassifyFormProps {
  stationId: string;
  rawCode: string;
  onDone: (stationId: string, code: string) => void;
}

const PRODUCT_TYPES: ProductType[] = ['FUEL', 'LUBRICANT', 'SHOP_ITEM', 'SERVICE'];

const ClassifyForm: React.FC<ClassifyFormProps> = ({ stationId, rawCode, onDone }) => {
  const [canonicalName,     setCanonicalName]     = useState('');
  const [productType,       setProductType]       = useState<ProductType>('FUEL');
  const [aliasesRaw,        setAliasesRaw]        = useState('');
  const [propagateGlobally, setPropagateGlobally] = useState(false);
  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [error,             setError]             = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canonicalName.trim()) { setError('El nombre canónico es requerido.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const aliases = aliasesRaw
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      const payload: ClassifyProductPayload = {
        stationId:         propagateGlobally ? 'ALL' : stationId,
        rawCode,
        canonicalName:     canonicalName.trim(),
        productType,
        aliases,
        propagateGlobally,
      };

      await classifyProduct(payload);
      onDone(stationId, rawCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al clasificar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const colorKey = PRODUCT_TYPE_COLORS[productType] ?? 'gray';

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2">
      <input
        type="text"
        value={canonicalName}
        onChange={e => setCanonicalName(e.target.value)}
        placeholder="Nombre canónico (ej: Gas Oil Premium)"
        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      />
      <div className="flex gap-1.5 flex-wrap">
        {PRODUCT_TYPES.map(pt => (
          <button
            key={pt}
            type="button"
            onClick={() => setProductType(pt)}
            className={`text-[10px] font-bold px-2 py-1 rounded-full transition-all ${
              productType === pt
                ? (() => {
                    const activeClasses: Record<string, string> = {
                      amber:   'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-400/40',
                      emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-400/40',
                      teal:    'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 ring-1 ring-teal-400/40',
                      blue:    'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-400/40',
                      sky:     'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 ring-1 ring-sky-400/40',
                      violet:  'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 ring-1 ring-violet-400/40',
                      rose:    'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 ring-1 ring-rose-400/40',
                      gray:    'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400 ring-1 ring-gray-400/40',
                    };
                    return activeClasses[colorKey] ?? activeClasses.gray;
                  })()
                : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {PRODUCT_TYPE_LABELS[pt]}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={aliasesRaw}
        onChange={e => setAliasesRaw(e.target.value)}
        placeholder="Alias (separados por coma, opcional)"
        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      />
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={propagateGlobally}
          onChange={e => setPropagateGlobally(e.target.checked)}
          className="w-3.5 h-3.5 accent-amber-500 rounded"
        />
        <Globe className="w-3 h-3 text-amber-500" />
        <span className="text-[10px] text-gray-500 dark:text-slate-400">
          Propagar a todas las estaciones (Inteligencia Colectiva)
        </span>
      </label>

      {error && (
        <p className="text-[10px] text-red-500">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {isSubmitting
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <CheckCircle className="w-3 h-3" />
          }
          Clasificar
        </button>
      </div>
    </form>
  );
};

const KnowledgePanelSection: React.FC<KnowledgePanelSectionProps> = ({ stations, isAdmin }) => {
  const [expanded,   setExpanded]   = useState(false);
  const [knowledge,  setKnowledge]  = useState<StationKnowledge[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState('');
  const [openForm,   setOpenForm]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchStationKnowledge();
      setKnowledge(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conocimiento');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && knowledge.length === 0) load();
  }, [expanded, knowledge.length, load]);

  const handleClassified = (stationId: string, code: string) => {
    setKnowledge(prev => prev.map(k =>
      k.stationId === stationId
        ? {
            ...k,
            knowledgeBlob: {
              ...k.knowledgeBlob,
              unknownProductCodes: k.knowledgeBlob.unknownProductCodes.filter(c => c !== code),
            },
          }
        : k
    ));
    setOpenForm(null);
  };

  const totalUnknown = knowledge.reduce(
    (sum, k) => sum + k.knowledgeBlob.unknownProductCodes.length, 0
  );
  const totalProducts = knowledge.reduce(
    (sum, k) => sum + Object.keys(k.knowledgeBlob.products).length, 0
  );

  const stationNameMap = Object.fromEntries(stations.map(s => [s.id, s.name]));

  return (
    <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-white/80 dark:border-white/8 overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)' }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-left">
            <p className="font-bold text-sm text-gray-900 dark:text-white">Conocimiento de Estación</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {isLoading ? 'Cargando...' : `${totalProducts} productos · ${totalUnknown} sin clasificar`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalUnknown > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400">
              {totalUnknown} pendiente{totalUnknown !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-50 dark:border-white/5 p-4 space-y-4">
          <div className="flex justify-end">
            <button
              onClick={load}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            </div>
          )}

          {!isLoading && knowledge.length === 0 && !error && (
            <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-4">
              Sin datos de conocimiento. Los códigos desconocidos aparecerán aquí cuando el edge agent procese archivos VE*.TXT.
            </p>
          )}

          {!isLoading && knowledge.map(k => {
            const stationName  = stationNameMap[k.stationId] ?? k.stationId;
            const unknownCodes = k.knowledgeBlob.unknownProductCodes;
            const products     = k.knowledgeBlob.products;

            return (
              <div key={k.stationId} className="rounded-xl border border-gray-100 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{stationName}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {Object.keys(products).length} clasificados
                    </span>
                    {unknownCodes.length > 0 && (
                      <span className="text-orange-600 dark:text-orange-400 font-semibold">
                        {unknownCodes.length} sin clasificar
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 space-y-2">
                  {unknownCodes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                        Códigos sin clasificar
                      </p>
                      {unknownCodes.map(code => {
                        const formKey = `${k.stationId}:${code}`;
                        const isOpen  = openForm === formKey;
                        return (
                          <div key={code}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />
                                <span className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200">{code}</span>
                              </div>
                              {isAdmin && (
                                <button
                                  onClick={() => setOpenForm(isOpen ? null : formKey)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                                >
                                  {isOpen ? <X className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                                  {isOpen ? 'Cancelar' : 'Clasificar'}
                                </button>
                              )}
                            </div>
                            {isOpen && (
                              <ClassifyForm
                                stationId={k.stationId}
                                rawCode={code}
                                onDone={handleClassified}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {Object.keys(products).length > 0 && (
                    <details className="group">
                      <summary className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                        {Object.keys(products).length} productos clasificados
                        <span className="ml-1 group-open:hidden">▸</span>
                        <span className="ml-1 hidden group-open:inline">▾</span>
                      </summary>
                      <div className="mt-2 space-y-1">
                        {Object.entries(products).map(([code, product]: [string, KnowledgeProduct]) => {
                          const color = PRODUCT_TYPE_COLORS[product.productType] ?? 'gray';
                          return (
                            <div key={code} className="flex items-center gap-2 text-[10px]">
                              <span className="font-mono text-gray-500 dark:text-slate-500 w-12 shrink-0">{code}</span>
                              <span className={`font-semibold text-${color}-600 dark:text-${color}-400`}>
                                {product.canonicalName}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-full bg-${color}-50 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 font-bold`}>
                                {PRODUCT_TYPE_LABELS[product.productType]}
                              </span>
                              {(product.occurrenceCount ?? 0) > 0 && (
                                <span className="text-gray-400 dark:text-slate-600">
                                  {product.occurrenceCount?.toLocaleString('es-AR')} ventas
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {unknownCodes.length === 0 && Object.keys(products).length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">
                      Sin datos aún para esta estación.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KnowledgePanelSection;

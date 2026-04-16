import { X, Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useState, useRef } from 'react';
import { graphPngUrl } from '../../services/api';

export default function GraphModal({ model, onClose }) {
  const [loaded,  setLoaded]  = useState(false);
  const [errored, setErrored] = useState(false);
  const [scale,   setScale]   = useState(1);
  const imgRef = useRef(null);

  const url = graphPngUrl(model.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sakura-lg w-full max-w-4xl mx-4 overflow-hidden flex flex-col"
           style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-sakura-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800 text-base">Knowledge graph</h2>
            <p className="text-xs text-gray-400 mt-0.5">{model.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
                    className="p-1.5 rounded-lg hover:bg-sakura-50 text-gray-500 hover:text-sakura-500 transition-colors">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                    className="p-1.5 rounded-lg hover:bg-sakura-50 text-gray-500 hover:text-sakura-500 transition-colors">
              <ZoomOut size={16} />
            </button>
            <button onClick={() => setScale(1)}
                    className="p-1.5 rounded-lg hover:bg-sakura-50 text-gray-500 hover:text-sakura-500 transition-colors">
              <RotateCcw size={16} />
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button onClick={onClose}
                    className="p-2 rounded-xl hover:bg-sakura-50 text-gray-400 hover:text-sakura-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-cloud-100 p-4 min-h-[400px]">
          {!loaded && !errored && (
            <div className="flex items-center gap-2 text-gray-400 animate-pulse">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Rendering graph…</span>
            </div>
          )}

          {errored && (
            <div className="flex flex-col items-center gap-3 text-red-500">
              <AlertCircle size={24} />
              <p className="text-sm">Could not load the knowledge graph.</p>
              <button onClick={() => { setErrored(false); setLoaded(false); }}
                      className="btn-ghost text-xs">Retry</button>
            </div>
          )}

          <img
            ref={imgRef}
            src={url}
            alt={`Knowledge graph for ${model.name}`}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
              display: errored ? 'none' : loaded ? 'block' : 'none',
              maxWidth: '100%',
              borderRadius: '12px',
            }}
          />
        </div>

        <div className="px-6 py-4 border-t border-sakura-100 flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-400">Zoom: {Math.round(scale * 100)}%</span>
          <button onClick={onClose} className="btn-ghost text-sm py-1.5">Close</button>
        </div>
      </div>
    </div>
  );
}

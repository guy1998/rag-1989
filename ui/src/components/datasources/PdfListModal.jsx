import { useEffect, useState } from 'react';
import { X, FileText, Loader2, AlertCircle } from 'lucide-react';
import { fetchModelPdfs } from '../../services/api';

export default function PdfListModal({ model, onClose }) {
  const [pdfs,    setPdfs]  = useState([]);
  const [loading, setLoad]  = useState(true);
  const [error,   setError] = useState('');

  useEffect(() => {
    fetchModelPdfs(model.name)
      .then(({ pdfs: p }) => { setPdfs(p || []); setLoad(false); })
      .catch((e) => { setError(e.message); setLoad(false); });
  }, [model.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sakura-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-sakura-100">
          <div>
            <h2 className="font-semibold text-gray-800 text-base">
              Source documents
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{model.name}</p>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl hover:bg-sakura-50 text-gray-400 hover:text-sakura-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 min-h-[120px]">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {!loading && !error && pdfs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No documents found.</p>
          )}

          {!loading && pdfs.length > 0 && (
            <ul className="flex flex-col gap-2">
              {pdfs.map((name, i) => (
                <li key={i} className="flex items-center gap-3 bg-sakura-50 rounded-xl px-4 py-3">
                  <FileText size={15} className="text-sakura-400 shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end">
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { trainModel, fetchTrainingProgress } from '../../services/api';

export default function CreateDataSourceModal({ onClose, onCreated }) {
  const [name, setName]     = useState('');
  const [files, setFiles]   = useState([]);
  const [dragging, setDrag] = useState(false);
  const [phase, setPhase]   = useState('idle'); // idle | training | done | error
  const [progress, setProg] = useState(0);
  const [errMsg, setErr]    = useState('');
  const fileRef             = useRef(null);
  const pollRef             = useRef(null);

  function addFiles(incoming) {
    const pdfs = [...incoming].filter((f) => f.name.endsWith('.pdf'));
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))];
    });
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const startPolling = useCallback((modelName) => {
    pollRef.current = setInterval(async () => {
      try {
        const { progress: p } = await fetchTrainingProgress(modelName);
        setProg(p);
        if (p >= 100) clearInterval(pollRef.current);
      } catch {
        // ignore
      }
    }, 1500);
  }, []);

  async function handleTrain() {
    const trimmed = name.trim();
    if (!trimmed || files.length === 0) return;

    setPhase('training');
    setProg(0);
    startPolling(trimmed);

    try {
      const res = await trainModel(trimmed, files);
      clearInterval(pollRef.current);
      if (res.success) {
        setProg(100);
        setPhase('done');
        setTimeout(() => { onCreated?.(); onClose(); }, 1200);
      } else {
        setErr(res.error || 'Training failed');
        setPhase('error');
      }
    } catch (e) {
      clearInterval(pollRef.current);
      setErr(e.message || 'Network error');
      setPhase('error');
    }
  }

  const isIdle = phase === 'idle';
  const isTraining = phase === 'training';
  const isDone = phase === 'done';
  const isError = phase === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sakura-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-sakura-100">
          <div>
            <h2 className="font-semibold text-gray-800 text-base">New data source</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload PDFs to train a GraphMeRT knowledge graph</p>
          </div>
          <button onClick={onClose} disabled={isTraining}
                  className="p-2 rounded-xl hover:bg-sakura-50 text-gray-400 hover:text-sakura-400 transition-colors disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))}
              placeholder="my-documents"
              disabled={!isIdle}
              className="w-full border border-sakura-200 rounded-xl px-3.5 py-2.5 text-sm
                         outline-none focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100
                         placeholder:text-gray-400 disabled:bg-gray-50 transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">No spaces — hyphens are fine.</p>
          </div>

          {/* Drop zone */}
          {isIdle && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">PDF documents</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-all
                  ${dragging ? 'border-sakura-400 bg-sakura-50' : 'border-sakura-200 hover:border-sakura-300 hover:bg-sakura-50/50'}`}
              >
                <div className="w-10 h-10 rounded-full bg-sakura-100 flex items-center justify-center">
                  <Upload size={18} className="text-sakura-400" />
                </div>
                <p className="text-sm text-gray-500 font-medium">Drop PDFs here or click to browse</p>
                <p className="text-xs text-gray-400">Only .pdf files are accepted</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && isIdle && (
            <ul className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 bg-sakura-50 rounded-xl px-3 py-2">
                  <FileText size={13} className="text-sakura-400 shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="shrink-0 text-gray-400 hover:text-sakura-400">
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Training state */}
          {isTraining && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-sky-600 font-medium">
                <Loader2 size={15} className="animate-spin" />
                Training GraphMeRT model…
              </div>
              <div className="w-full h-2 bg-sky-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-300 to-sky-400 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                This may take a few minutes. Please don't close this window.
              </p>
            </div>
          )}

          {isDone && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 rounded-xl px-4 py-3">
              <CheckCircle2 size={15} />
              Training complete! Closing…
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={isTraining} className="btn-ghost">
            Cancel
          </button>
          {isIdle && (
            <button
              onClick={handleTrain}
              disabled={!name.trim() || files.length === 0}
              className="btn-sakura"
            >
              Train data source
            </button>
          )}
          {isError && (
            <button onClick={() => setPhase('idle')} className="btn-sakura">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

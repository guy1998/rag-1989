import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, FileText, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchModelPdfs, retrainModel, fetchTrainingProgress } from '../../services/api';

export default function RetrainModal({ model, onClose, onRetrained }) {
  const [existingPdfs, setExisting] = useState([]);
  const [keptPdfs,     setKept]     = useState([]);
  const [newFiles,     setNew]      = useState([]);
  const [dragging,     setDrag]     = useState(false);
  const [phase,        setPhase]    = useState('loading'); // loading | idle | training | done | error
  const [progress,     setProg]     = useState(0);
  const [trainStatus,  setStat]     = useState('preparing'); // preparing | training
  const [errMsg,       setErr]      = useState('');
  const fileRef  = useRef(null);
  const pollRef  = useRef(null);

  useEffect(() => {
    fetchModelPdfs(model.name)
      .then(({ pdfs }) => {
        setExisting(pdfs || []);
        setKept(pdfs || []);
        setPhase('idle');
      })
      .catch(() => setPhase('idle'));
  }, [model.name]);

  function addFiles(incoming) {
    const pdfs = [...incoming].filter((f) => f.name.endsWith('.pdf'));
    setNew((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))];
    });
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer.files);
  }

  const startPolling = useCallback((modelName) => {
    pollRef.current = setInterval(async () => {
      try {
        const { progress: p, status: s } = await fetchTrainingProgress(modelName);
        setProg(p);
        setStat(s ?? 'preparing');
        if (p >= 100) clearInterval(pollRef.current);
      } catch {
        // ignore
      }
    }, 1500);
  }, []);

  async function handleRetrain() {
    setPhase('training');
    setProg(0);
    startPolling(model.name);

    try {
      const res = await retrainModel(model.name, keptPdfs, newFiles);
      clearInterval(pollRef.current);
      if (res.success) {
        setProg(100);
        setPhase('done');
        setTimeout(() => { onRetrained?.(); onClose(); }, 1200);
      } else {
        setErr(res.error || 'Retraining failed');
        setPhase('error');
      }
    } catch (e) {
      clearInterval(pollRef.current);
      setErr(e.message || 'Network error');
      setPhase('error');
    }
  }

  const isIdle     = phase === 'idle';
  const isLoading  = phase === 'loading';
  const isTraining = phase === 'training';
  const isDone     = phase === 'done';
  const isError    = phase === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sakura-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-sakura-100">
          <div>
            <h2 className="font-semibold text-gray-800 text-base">Retrain — {model.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage PDFs and rebuild the knowledge graph
            </p>
          </div>
          <button onClick={onClose} disabled={isTraining}
                  className="p-2 rounded-xl hover:bg-sakura-50 text-gray-400 hover:text-sakura-400 transition-colors disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading existing documents…</span>
            </div>
          )}

          {(isIdle || isError) && (
            <>
              {/* Existing PDFs */}
              {existingPdfs.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">
                    Current documents — uncheck to remove
                  </label>
                  <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {existingPdfs.map((name) => (
                      <li key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={keptPdfs.includes(name)}
                          onChange={(e) =>
                            setKept((prev) =>
                              e.target.checked ? [...prev, name] : prev.filter((n) => n !== name),
                            )
                          }
                          className="accent-sakura-400 w-3.5 h-3.5"
                        />
                        <FileText size={12} className="text-sakura-300 shrink-0" />
                        <span className="text-xs text-gray-700 truncate">{name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Drop zone */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Add new PDFs</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all
                    ${dragging ? 'border-sakura-400 bg-sakura-50' : 'border-sakura-200 hover:border-sakura-300 hover:bg-sakura-50/50'}`}
                >
                  <Upload size={16} className="text-sakura-400" />
                  <p className="text-xs text-gray-500">Drop more PDFs or click to browse</p>
                  <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden"
                         onChange={(e) => addFiles(e.target.files)} />
                </div>
              </div>

              {newFiles.length > 0 && (
                <ul className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {newFiles.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 bg-sakura-50 rounded-xl px-3 py-2">
                      <FileText size={12} className="text-sakura-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                      <button onClick={() => setNew((prev) => prev.filter((_, j) => j !== i))}
                              className="text-gray-400 hover:text-sakura-400">
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {isTraining && (
            <div className="flex flex-col gap-3">
              {trainStatus === 'preparing' ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sakura-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-sakura-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-sakura-500 animate-bounce" />
                  </div>
                  <p className="text-sm text-gray-600 font-medium">Thinking…</p>
                  <p className="text-xs text-gray-400">Encoding corpus and building knowledge graph</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-sky-600 font-medium">
                    <Loader2 size={15} className="animate-spin" />
                    Retraining model…
                  </div>
                  <div className="w-full h-2 bg-sky-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-300 to-sky-400 rounded-full transition-all duration-700"
                         style={{ width: `${progress}%` }} />
                  </div>
                </>
              )}
              <p className="text-xs text-gray-400">Please wait while the model rebuilds.</p>
            </div>
          )}

          {isDone && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 rounded-xl px-4 py-3">
              <CheckCircle2 size={15} />
              Retraining complete! Closing…
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {errMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={isTraining} className="btn-ghost">Cancel</button>
          {isIdle && (
            <button
              onClick={handleRetrain}
              disabled={keptPdfs.length === 0 && newFiles.length === 0}
              className="btn-sakura"
            >
              Retrain
            </button>
          )}
          {isError && (
            <button onClick={() => setPhase('idle')} className="btn-sakura">Try again</button>
          )}
        </div>
      </div>
    </div>
  );
}

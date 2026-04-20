import { FileText, RefreshCw, Network, Loader2, CheckCircle2, Plus } from 'lucide-react';
function StatusBadge({ progress }) {
  if (progress === 100) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                       bg-emerald-50 text-emerald-600 border border-emerald-200">
        <CheckCircle2 size={10} />
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-sky-50 text-sky-500 border border-sky-200">
      <Loader2 size={10} className="animate-spin" />
      Training {progress}%
    </span>
  );
}

/** Card for an existing data source */
export function DataSourceCard({ model, onRetrain, onViewPdfs }) {
  return (
    <div className="card p-5 flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm truncate">{model.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {model.pdfCount} source document{model.pdfCount !== 1 ? 's' : ''}
          </p>
        </div>
        <StatusBadge progress={model.progress} />
      </div>

      {/* Progress bar when training */}
      {model.progress !== 100 && (
        <div className="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-300 to-sky-400 rounded-full transition-all duration-500"
            style={{ width: `${model.progress}%` }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
        <button
          onClick={onViewPdfs}
          className="btn-ghost text-xs py-1.5 px-3"
        >
          <FileText size={12} />
          PDFs
        </button>
        <button
          onClick={() => window.open(`/graph/${encodeURIComponent(model.name)}`, '_blank')}
          className="btn-ghost text-xs py-1.5 px-3"
        >
          <Network size={12} />
          Graph
        </button>
        <button
          onClick={onRetrain}
          className="btn-ghost text-xs py-1.5 px-3 ml-auto"
        >
          <RefreshCw size={12} />
          Retrain
        </button>
      </div>
    </div>
  );
}

/** Special "create new" card */
export function NewDataSourceCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="card p-5 flex flex-col items-center justify-center gap-3
                 border-dashed border-sakura-200 hover:border-sakura-300
                 hover:bg-sakura-50/50 cursor-pointer
                 min-h-[160px] transition-all duration-200 animate-fade-in w-full"
    >
      <div className="w-10 h-10 rounded-full bg-sakura-100 flex items-center justify-center">
        <Plus size={20} className="text-sakura-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-sakura-500">New data source</p>
        <p className="text-xs text-gray-400 mt-0.5">Upload PDFs and train</p>
      </div>
    </button>
  );
}

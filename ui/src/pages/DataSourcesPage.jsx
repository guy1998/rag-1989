import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Database, Loader2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { DataSourceCard, NewDataSourceCard } from '../components/datasources/DataSourceCard';
import CreateDataSourceModal from '../components/datasources/CreateDataSourceModal';
import RetrainModal         from '../components/datasources/RetrainModal';
import PdfListModal         from '../components/datasources/PdfListModal';
import GraphModal           from '../components/datasources/GraphModal';
import { fetchModels }      from '../services/api';
import { useChats }         from '../hooks/useChats';

export default function DataSourcesPage() {
  const { chats, deleteChat } = useChats();

  const [models,   setModels]  = useState([]);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState('');

  // Modal state
  const [creating,    setCreating]    = useState(false);
  const [retraining,  setRetraining]  = useState(null); // model object
  const [viewingPdfs, setViewingPdfs] = useState(null); // model object
  const [viewingGraph,setViewingGraph]= useState(null); // model object

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchModels()
      .then(({ models: ms }) => { setModels(ms || []); setLoading(false); })
      .catch((e) => { setError(e.message || 'Failed to load data sources'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll progress for any in-training models
  useEffect(() => {
    const inProgress = models.filter((m) => m.progress < 100);
    if (!inProgress.length) return;

    const timer = setInterval(() => load(), 3000);
    return () => clearInterval(timer);
  }, [models, load]);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar chats={chats} onDeleteChat={deleteChat} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-sakura-100 bg-white/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sakura-100 to-sky-100 flex items-center justify-center">
              <Database size={16} className="text-sakura-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-800">Data Sources</h1>
              <p className="text-xs text-gray-400">
                {models.length} source{models.length !== 1 ? 's' : ''} trained
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-xl hover:bg-sakura-50 text-gray-400 hover:text-sakura-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setCreating(true)} className="btn-sakura">
              New data source
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {loading && !models.length && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Loading data sources…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-2xl px-5 py-4 border border-red-100 mb-6">
              {error}
            </div>
          )}

          {!loading && !error && models.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-5 py-24">
              {/* Decorative empty state */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sakura-50 to-sky-50 flex items-center justify-center border-2 border-dashed border-sakura-200">
                  <Database size={32} className="text-sakura-300" />
                </div>
                <span className="absolute -top-2 -right-2 text-2xl">🌸</span>
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-gray-700">No data sources yet</h3>
                <p className="text-sm text-gray-400 mt-1.5 max-w-xs leading-relaxed">
                  Upload your PDF documents and train a GraphMeRT knowledge graph to start chatting.
                </p>
              </div>
              <button onClick={() => setCreating(true)} className="btn-sakura">
                Create your first data source
              </button>
            </div>
          )}

          {models.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {models.map((model) => (
                <DataSourceCard
                  key={model.id}
                  model={model}
                  onRetrain={() => setRetraining(model)}
                  onViewPdfs={() => setViewingPdfs(model)}
                  onViewGraph={() => setViewingGraph(model)}
                />
              ))}
              <NewDataSourceCard onClick={() => setCreating(true)} />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {creating && (
        <CreateDataSourceModal
          onClose={() => setCreating(false)}
          onCreated={load}
        />
      )}
      {retraining && (
        <RetrainModal
          model={retraining}
          onClose={() => setRetraining(null)}
          onRetrained={load}
        />
      )}
      {viewingPdfs && (
        <PdfListModal
          model={viewingPdfs}
          onClose={() => setViewingPdfs(null)}
        />
      )}
      {viewingGraph && (
        <GraphModal
          model={viewingGraph}
          onClose={() => setViewingGraph(null)}
        />
      )}
    </div>
  );
}

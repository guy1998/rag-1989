import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Loader2, AlertCircle, RefreshCw, Network } from 'lucide-react';
import { fetchGraph } from '../services/api';

// ── helpers ────────────────────────────────────────────────────────────────

function toEChartsData(nodeLink) {
  // nodeLink: { nodes: [{id}], links: [{source, target, label}] }
  const nodes = (nodeLink.nodes || []).map((n) => ({
    id: String(n.id),
    name: String(n.id),
    symbolSize: 28,
    label: { show: true },
    itemStyle: {
      color: '#f9a8d4',   // sakura-300
      borderColor: '#f472b6', // sakura-400
      borderWidth: 1.5,
    },
    emphasis: {
      itemStyle: { color: '#f472b6', borderColor: '#ec4899', borderWidth: 2 },
      label: { fontWeight: 700 },
    },
  }));

  const edges = (nodeLink.links || []).map((l) => ({
    source: String(l.source),
    target: String(l.target),
    label: {
      show: true,
      formatter: l.label || '',
      fontSize: 10,
      color: '#94a3b8',
    },
    lineStyle: {
      color: '#cbd5e1',
      width: 1.5,
      curveness: 0.15,
    },
    emphasis: {
      lineStyle: { color: '#f472b6', width: 2 },
      label: { color: '#f472b6', fontWeight: 600 },
    },
  }));

  return { nodes, edges };
}

function buildOption(nodes, edges) {
  return {
    backgroundColor: '#fafafa',
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.dataType === 'node') {
          return `<b>${params.name}</b>`;
        }
        if (params.dataType === 'edge') {
          const rel = params.data?.label?.formatter || '';
          return `${params.data.source} <b style="color:#f472b6">${rel}</b> ${params.data.target}`;
        }
        return '';
      },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#fce7f3',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
    },
    animationDurationUpdate: 800,
    animationEasingUpdate: 'quinticInOut',
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        data: nodes,
        edges,
        force: {
          repulsion: 300,
          gravity: 0.05,
          edgeLength: [80, 180],
          layoutAnimation: true,
        },
        label: {
          show: true,
          position: 'bottom',
          fontSize: 11,
          color: '#374151',
          distance: 5,
          overflow: 'truncate',
          width: 90,
        },
        edgeLabel: { show: true },
        lineStyle: { opacity: 0.75 },
        emphasis: { focus: 'adjacency', blurScope: 'coordinateSystem' },
        scaleLimit: { min: 0.3, max: 4 },
      },
    ],
  };
}

// ── component ──────────────────────────────────────────────────────────────

export default function GraphPage() {
  const { modelName } = useParams();
  const chartRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [option, setOption]   = useState(null);
  const [stats, setStats]     = useState({ nodes: 0, edges: 0 });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchGraph(modelName)
      .then((data) => {
        const { nodes, edges } = toEChartsData(data);
        setStats({ nodes: nodes.length, edges: edges.length });
        setOption(buildOption(nodes, edges));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load graph');
        setLoading(false);
      });
  }, [modelName]);

  useEffect(() => { load(); }, [load]);

  function handleReset() {
    const instance = chartRef.current?.getEchartsInstance();
    if (instance) {
      instance.dispatchAction({ type: 'graphRoam' });
      // zoom back to fit
      instance.setOption({ series: [{ zoom: 1, center: undefined }] });
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-sakura-100 bg-white/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sakura-100 to-sky-100 flex items-center justify-center">
            <Network size={16} className="text-sakura-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800">Knowledge Graph</h1>
            <p className="text-xs text-gray-400">{modelName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!loading && !error && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
              {stats.nodes} nodes · {stats.edges} edges
            </span>
          )}
          <button
            onClick={load}
            className="p-2 rounded-xl hover:bg-sakura-50 text-gray-400 hover:text-sakura-500 transition-colors"
            title="Reload"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleReset}
            className="btn-ghost text-xs py-1.5 px-3"
            disabled={loading || !!error}
          >
            Reset view
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden relative bg-[#fafafa]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 z-10">
            <Loader2 size={24} className="animate-spin text-sakura-400" />
            <span className="text-sm">Loading knowledge graph…</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <div className="flex flex-col items-center gap-3 text-red-500">
              <AlertCircle size={28} />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={load} className="btn-sakura text-xs py-1.5 px-4">
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && option && (
          <>
            <div
              className="w-full h-full"
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => { if (e.target === e.currentTarget || e.button === 0) e.currentTarget.style.cursor = 'grabbing'; }}
              onMouseUp={(e) => { e.currentTarget.style.cursor = 'grab'; }}
              onMouseLeave={(e) => { e.currentTarget.style.cursor = 'grab'; }}
            >
              <ReactECharts
                ref={chartRef}
                option={option}
                style={{ width: '100%', height: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge
              />
            </div>
            <p className="absolute bottom-4 right-6 text-[11px] text-gray-300 pointer-events-none select-none">
              Drag empty space to pan · Scroll to zoom · Drag nodes to reposition · Click to highlight adjacency
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const BASE = '/api';

// ── Models / Data Sources ──────────────────────────────────────────────────

export async function fetchModels() {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json(); // { models: [{id, name, pdfCount, progress}] }
}

export async function fetchModelPdfs(modelName) {
  const res = await fetch(`${BASE}/model_pdfs/${encodeURIComponent(modelName)}`);
  if (!res.ok) throw new Error('Failed to fetch PDFs');
  return res.json(); // { success, pdfs: [filename] }
}

export async function fetchGraph(modelName) {
  const res = await fetch(`${BASE}/graph/${encodeURIComponent(modelName)}`);
  if (!res.ok) throw new Error('Failed to fetch graph');
  return res.json(); // NetworkX node-link: { nodes, links, directed, ... }
}

// ── Training ───────────────────────────────────────────────────────────────

/**
 * Train a new model.
 * @param {string} modelName
 * @param {File[]} files
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function trainModel(modelName, files) {
  const form = new FormData();
  form.append('model_name', modelName);
  files.forEach((f) => form.append('pdfs', f));

  const res = await fetch(`${BASE}/train`, { method: 'POST', body: form });
  return res.json();
}

/**
 * Retrain an existing model with a new PDF set.
 * @param {string} modelName
 * @param {string[]} currentPdfs  – filenames already on the server to keep
 * @param {File[]} newFiles       – new PDF files to add
 */
export async function retrainModel(modelName, currentPdfs, newFiles) {
  const form = new FormData();
  form.append('model_name', modelName);
  currentPdfs.forEach((name) => form.append('current-pdfs', name));
  newFiles.forEach((f) => form.append('pdfs', f));

  const res = await fetch(`${BASE}/re-train`, { method: 'POST', body: form });
  return res.json();
}

export async function fetchTrainingProgress(modelName) {
  const res = await fetch(`${BASE}/train/progress/${encodeURIComponent(modelName)}`);
  if (!res.ok) return { progress: 0, status: 'preparing' };
  return res.json(); // { progress: 0-100, status: 'preparing' | 'training' }
}

// ── Generate (streaming) ───────────────────────────────────────────────────

/**
 * Stream an answer from the backend.
 * onChunk is called with each decoded text chunk.
 * Returns a cleanup function that aborts the request.
 */
export function generateStream({ modelName, question, onChunk, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName, question }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onError?.(body.error || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(decoder.decode(value, { stream: true }));
      }

      onDone?.();
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err.message);
    }
  })();

  return () => controller.abort();
}

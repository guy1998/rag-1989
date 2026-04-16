from typing import List

import numpy as np
import nltk

nltk.download('punkt', quiet=True)

class RetrieverQA:
    """Simple retrieval-based QA: semantic search over sentences and return top-k supporting sentences."""
    def __init__(self, sentences: List[str], model):
        self.sentences = sentences
        self.model = model
        self.emb = self.model.encode(sentences, show_progress_bar=True)
        # normalize
        self.emb = self.emb / np.linalg.norm(self.emb, axis=1, keepdims=True)

    def query(self, q:str, top_k=3):
        q_emb = self.model.encode([q])[0]
        q_emb = q_emb / np.linalg.norm(q_emb)
        sims = (self.emb @ q_emb)
        idx = np.argsort(-sims)[:top_k]
        return [(self.sentences[i], float(sims[i])) for i in idx]
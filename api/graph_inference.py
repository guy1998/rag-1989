import re
from typing import List, Tuple, Optional

import numpy as np
import nltk

nltk.download('punkt', quiet=True)


class RetrieverQA:
    """
    Semantic retrieval over a sentence corpus with optional KG-augmented context expansion.

    At query time:
      1. SBERT cosine similarity selects the top-k supporting sentences.
      2. If the retriever was built with triples, entities from those sentences are
         matched against the KG and their 1-hop neighbourhood is appended to the
         context — giving the LLM structured relational facts alongside raw text.
    """

    def __init__(
        self,
        sentences: List[str],
        model,
        precomputed_emb=None,
        triples: Optional[List[Tuple[str, str, str]]] = None,
    ):
        self.sentences = sentences
        self.model = model

        # ── Embeddings ────────────────────────────────────────────────────────
        if precomputed_emb is not None:
            self.emb = precomputed_emb.copy()
        else:
            self.emb = self.model.encode(sentences, show_progress_bar=False)
        self.emb = self.emb / np.linalg.norm(self.emb, axis=1, keepdims=True)

        # ── KG adjacency index ────────────────────────────────────────────────
        # Maps lowercased entity → list of (relation, tail) for fast lookup.
        self._kg_adj: dict = {}
        for h, r, t in (triples or []):
            self._kg_adj.setdefault(h.lower(), []).append((r, t))
            self._kg_adj.setdefault(t.lower(), []).append((r, h))

        # Sort longest-first so multi-word entities are matched before their
        # substrings (e.g. "knowledge graph" before "graph").
        self._kg_entities: List[str] = sorted(
            self._kg_adj.keys(), key=len, reverse=True
        )

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def query(self, q: str, top_k: int = 3):
        q_emb = self.model.encode([q])[0]
        q_emb = q_emb / np.linalg.norm(q_emb)
        sims = self.emb @ q_emb
        idx = np.argsort(-sims)[:top_k]
        return [(self.sentences[i], float(sims[i])) for i in idx]

    # ── KG context expansion ──────────────────────────────────────────────────

    def get_kg_context(
        self, retrieved_sentences: List[str], max_facts: int = 10
    ) -> List[str]:
        """
        Given the sentences already retrieved by cosine similarity, find KG entities
        that appear in them (whole-word match) and return their 1-hop triples as
        human-readable fact strings.

        Returns an empty list when no KG was provided or no entities match.
        """
        if not self._kg_entities:
            return []

        combined = " ".join(retrieved_sentences).lower()

        # Collect matched entities — stop early once we have enough to fill max_facts.
        matched: List[str] = []
        seen_entities: set = set()
        for ent in self._kg_entities:
            if len(ent) <= 2:
                continue
            if ent in seen_entities:
                continue
            if re.search(r'\b' + re.escape(ent) + r'\b', combined):
                matched.append(ent)
                seen_entities.add(ent)
                # A single entity can contribute multiple facts; cap the scan early
                # once we have enough candidate entities.
                if len(matched) * 3 >= max_facts * 2:
                    break

        facts: List[str] = []
        seen_facts: set = set()
        for ent in matched:
            for rel, neighbour in self._kg_adj.get(ent, []):
                fact = f"{ent} --[{rel}]--> {neighbour}"
                if fact not in seen_facts:
                    seen_facts.add(fact)
                    facts.append(fact)
                if len(facts) >= max_facts:
                    return facts

        return facts

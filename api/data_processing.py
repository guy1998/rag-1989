import json
import random
from typing import List, Tuple, Dict

import torch
from torch.utils.data import Dataset

from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
import numpy as np
import pdfplumber
import nltk
import spacy

nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)
from nltk import sent_tokenize

# Loaded once at module import — reused across all requests
_nlp = spacy.load("en_core_web_sm")

class SeedKG:
    """Simple seed KG loader and vocabulary for head/relation/tail."""
    def __init__(self, triples: List[Tuple[str,str,str]] = None):
        # triples: list of (head, relation, tail)
        self.triples = triples or []
        self.entities = set()
        self.relations = set()
        for h,r,t in self.triples:
            self.entities.add(h); self.entities.add(t); self.relations.add(r)
        self.entities = sorted(list(self.entities))
        self.relations = sorted(list(self.relations))
        self.entity2id = {e:i for i,e in enumerate(self.entities)}
        self.rel2id = {r:i for i,r in enumerate(self.relations)}

    @classmethod
    def load_from_jsonl(cls, path):
        triples = []
        with open(path,'r') as f:
            for ln in f:
                obj = json.loads(ln)
                triples.append((obj['head'], obj['relation'], obj['tail']))
        return cls(triples)

    def sample_triple(self):
        return random.choice(self.triples) if self.triples else ("<HEAD>","related_to","<TAIL>")

# Build chain graphs from multiple PDFs

def extract_sentences_from_pdf(pdf_paths):
    all_sentences = []
    for p in pdf_paths:
        with pdfplumber.open(p) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ''
                sents = sent_tokenize(text)
                all_sentences.extend([s.strip() for s in sents if s.strip()])
    if not all_sentences:
        raise ValueError("No sentences extracted from given PDFs.")
    return all_sentences

def pdfs_to_chain_graphs(pdf_paths: List[str],
                         seq_len=5,
                         num_leaves=2,
                         embed_model_name='all-MiniLM-L6-v2',
                         target_dim=10,
                         seed_kg: SeedKG = None,
                         pca_reduce=True,
                         stride=None,
                         sbert_model=None) -> List[Dict]:
    """
    Extract sentences from multiple PDFs, encode with SentenceTransformer,
    reduce with PCA to target_dim, and construct chain graphs where each example
    is seq_len text nodes followed by num_leaves KG nodes (heads/relations/tails).
    """
    # 1) extract sentences
    all_sentences = extract_sentences_from_pdf(pdf_paths)

    # 2) sentence embedding — use pre-loaded model if provided, otherwise load once
    sbert = sbert_model if sbert_model is not None else SentenceTransformer(embed_model_name)
    embeddings = sbert.encode(all_sentences, show_progress_bar=True)
    original_dim = embeddings.shape[1]

    # 3) PCA reduction (optional)
    if pca_reduce:
        pca = PCA(n_components=target_dim)
        reduced = pca.fit_transform(embeddings)
    else:
        if target_dim != original_dim:
            raise ValueError('target_dim must equal original_dim when pca_reduce=False')
        reduced = embeddings

    # 4) build chain graphs
    stride = stride or seq_len
    graphs = []
    num_graphs = (len(reduced) + stride - 1)//stride
    for i in range(num_graphs):
        start = i*stride
        end = min(len(reduced), (i+1)*stride)
        text_chunk = reduced[start:end]
        # if chunk shorter, pad
        if text_chunk.shape[0] < seq_len:
            pad_amount = seq_len - text_chunk.shape[0]
            pad = np.zeros((pad_amount, target_dim), dtype=float)
            text_chunk = np.vstack([text_chunk, pad])
        else:
            text_chunk = text_chunk[:seq_len]

        # sample seed KG leaves
        leaves = []
        masked_leaf_positions = []
        leaf_labels = []
        for li in range(num_leaves):
            if seed_kg and seed_kg.triples:
                h,r,t = seed_kg.sample_triple()
            else:
                h,r,t = ("<HEAD>","related_to","<TAIL>")
            # represent head+relation as a vector (we'll embed these later using sbert or random)
            leaves.append({'head':h,'relation':r,'tail':t})
            # simulate a masked node for MNM training with probability
            if random.random() < 0.3:
                masked_leaf_positions.append(li)
                leaf_labels.append(t)
            else:
                leaf_labels.append(None)

        # Create features: concatenation of text nodes + leaf node placeholders (we'll later replace leaves with embeddings)
        features = np.vstack([text_chunk] + [np.zeros((1,target_dim)) for _ in range(num_leaves)])

        graphs.append({
            'sentences': all_sentences[start:start+seq_len],
            'features': features.tolist(),  # (seq_len + num_leaves, target_dim)
            'leaves': leaves,
            'masked_leaf_positions': masked_leaf_positions,
            'leaf_labels': leaf_labels
        })
    return graphs

# ---------- Dataset / DataLoader ----------

class GraphMERTDataset(Dataset):
    def __init__(self, graphs: List[Dict]):
        self.graphs = graphs

    def __len__(self):
        return len(self.graphs)

    def __getitem__(self, idx):
        g = self.graphs[idx]
        features = torch.tensor(g['features'], dtype=torch.float)  # (N, D)
        # build labels: for masked leaves, produce target string (we'll map to ids in collate)
        return {
            'features': features,
            'leaves': g['leaves'],
            'masked_leaf_positions': g['masked_leaf_positions'],
            'leaf_labels': g['leaf_labels'],
            'sentences': g['sentences']
        }
class AutoKGBuilder:
    def __init__(self):
        self.nlp = _nlp

    def extract_triples(self, sentence):
        doc = self.nlp(sentence)

        triples = []
        for token in doc:
            # Rule-based subject–verb–object extraction
            if token.dep_ == "ROOT" and token.pos_ == "VERB":
                subj = [w.text for w in token.lefts if w.dep_ in ("nsubj", "nsubjpass")]
                obj  = [w.text for w in token.rights if w.dep_ in ("dobj", "pobj")]

                if subj and obj:
                    triples.append((subj[0], token.lemma_, obj[0]))

        return triples

    def build_kg_from_sentences(self, sentences):
        triples = []
        for s in sentences:
            triples.extend(self.extract_triples(s))
        return triples

# collate to build batched tensors and label ids

def collate_fn(batch, seed_kg: SeedKG = None, sbert: SentenceTransformer = None, target_dim=10):
    # batch: list of dicts
    bs = len(batch)
    N = batch[0]['features'].shape[0]
    D = batch[0]['features'].shape[1]
    features = torch.stack([b['features'] for b in batch], dim=0)  # (B, N, D)

    # prepare leaf label ids
    label_ids = torch.full((bs, N), -100, dtype=torch.long)  # default ignore

    # if seed_kg present and sbert present, produce embeddings for leaves in features positions
    for i,b in enumerate(batch):
        # leaves are assumed placed after seq_len text tokens
        seq_len = len(b['sentences'])
        for li, leaf in enumerate(b['leaves']):
            pos = seq_len + li
            # create an embedding for head+relation (we will store into features tensor)
            if sbert is not None:
                hr = leaf['head'] + ' [REL] ' + leaf['relation']
                emb = sbert.encode([hr])[0]
                # reduce if needed
                if emb.shape[0] != D:
                    # naive truncate or pad
                    if emb.shape[0] > D:
                        emb = emb[:D]
                    else:
                        emb = np.pad(emb, (0, D-emb.shape[0]))
            else:
                emb = np.zeros((D,))
            features[i, pos] = torch.tensor(emb, dtype=torch.float)

            # if leaf has a masked label, map tail to an id (simple mapping via seed_kg if available)
            leaf_label = b['leaf_labels'][li]
            if leaf_label is not None:
                if seed_kg and leaf_label in seed_kg.entity2id:
                    label_ids[i, pos] = seed_kg.entity2id[leaf_label]
                else:
                    # fallback: hash to small vocab by modulo
                    label_ids[i, pos] = abs(hash(leaf_label)) % 1000

    return {
        'features': features,  # (B,N,D)
        'labels': label_ids,    # (B,N)
        'raw': batch
    }

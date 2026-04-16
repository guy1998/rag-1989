from typing import List

import torch.nn as nn
import nltk

nltk.download('punkt')
from hgat import HGTLayer


class GraphMERTModel(nn.Module):

    def __init__(self, input_dim, hidden_dim, n_heads, num_hgt_layers, rel_vocab_size=10, seq_len=5, num_leaves=2):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.n_heads = n_heads
        self.seq_len = seq_len
        self.num_leaves = num_leaves

        self.input_proj = nn.Linear(input_dim, hidden_dim)
        self.hgt_layers = nn.ModuleList([HGTLayer(hidden_dim, hidden_dim, n_heads, node_types=('text','leaf'), rel_vocab_size=rel_vocab_size) for _ in range(num_hgt_layers)])
        # follow with a TransformerEncoder block
        encoder_layer = nn.TransformerEncoderLayer(d_model=hidden_dim, nhead=n_heads, batch_first=True)
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=1)

        self.classifier = nn.Linear(hidden_dim, rel_vocab_size)

    def forward(self, x, node_types: List[str], rel_ids=None):
        # x: (B,N,input_dim)
        B,N,_ = x.shape
        h = self.input_proj(x)
        node_type_mask = node_types
        for hgt in self.hgt_layers:
            h = hgt(h, node_type_mask, rel_ids=rel_ids)
        h = self.transformer(h)
        logits = self.classifier(h)  # (B,N,vocab)
        return logits, h
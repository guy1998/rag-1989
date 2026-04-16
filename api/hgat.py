import torch
import torch.nn as nn
import nltk

nltk.download('punkt')

class HGTLayer(nn.Module):


    def __init__(self, in_dim, out_dim, n_heads=4, node_types=('text','leaf'), rel_vocab_size=10):
        super().__init__()
        self.in_dim = in_dim
        self.out_dim = out_dim
        self.n_heads = n_heads
        self.head_dim = out_dim // n_heads
        assert self.head_dim * n_heads == out_dim, 'out_dim must be divisible by n_heads'

        self.k_linears = nn.ModuleDict({nt: nn.Linear(in_dim, out_dim) for nt in node_types})
        self.q_linears = nn.ModuleDict({nt: nn.Linear(in_dim, out_dim) for nt in node_types})
        self.v_linears = nn.ModuleDict({nt: nn.Linear(in_dim, out_dim) for nt in node_types})

        self.relation_transforms = nn.Parameter(torch.randn(rel_vocab_size, out_dim))

        self.out_linear = nn.Linear(out_dim, out_dim)
        self.layer_norm = nn.LayerNorm(out_dim)

    def forward(self, h, node_type_mask, rel_ids=None):
        # h: (B, N, in_dim)
        # node_type_mask: list of string node types length N OR a batch of such lists
        B, N, _ = h.shape
        device = h.device

        if isinstance(node_type_mask, list):
            node_type_mask = [node_type_mask for _ in range(B)]

        qs = torch.zeros(B, N, self.out_dim, device=device)
        ks = torch.zeros(B, N, self.out_dim, device=device)
        vs = torch.zeros(B, N, self.out_dim, device=device)

        # Iterate over each node type string
        for t_name in self.q_linears.keys():
            mask = [[(nt == t_name) for nt in row] for row in node_type_mask]
            mask_tensor = torch.tensor(mask, dtype=torch.bool, device=device)

            if mask_tensor.any():
                idx = mask_tensor.nonzero(as_tuple=True)

                vals = h[idx]  # (#nodes_of_type, in_dim)
                qs[idx] = self.q_linears[t_name](vals)
                ks[idx] = self.k_linears[t_name](vals)
                vs[idx] = self.v_linears[t_name](vals)

        # relation transforms (if provided)
        if rel_ids is not None:
            # rel_ids: (B,N) int where each position maps to a relation id (or -1)
            rel_emb = torch.zeros(B,N,self.out_dim, device=device)
            valid = rel_ids >= 0
            if valid.any():
                rel_emb[valid] = self.relation_transforms[rel_ids[valid]]
            ks = ks + rel_emb

        # reshape to heads
        qs = qs.view(B,N,self.n_heads,self.head_dim).permute(0,2,1,3)  # (B,heads,N,hd)
        ks = ks.view(B,N,self.n_heads,self.head_dim).permute(0,2,1,3)
        vs = vs.view(B,N,self.n_heads,self.head_dim).permute(0,2,1,3)

        scores = torch.matmul(qs, ks.transpose(-2,-1)) / (self.head_dim**0.5)  # (B,heads,N,N)
        attn = torch.softmax(scores, dim=-1)
        out = torch.matmul(attn, vs)  # (B,heads,N,hd)
        out = out.permute(0,2,1,3).contiguous().view(B,N,self.out_dim)
        out = self.out_linear(out)
        out = self.layer_norm(out + h)
        return out
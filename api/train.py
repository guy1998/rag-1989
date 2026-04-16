import torch
import torch.nn as nn
from torch.utils.data import DataLoader

import nltk
from tqdm import tqdm

nltk.download('punkt')
from graph_mert import GraphMERTModel
from data_processing import SeedKG

training_progress = {}

def train(model, dataloader, seed_kg, optimizer, device, epochs=5, progress_key=None):
    model.to(device)
    model.train()
    criterion = nn.CrossEntropyLoss(ignore_index=-100)

    total_steps = epochs * len(dataloader)
    step = 0

    for ep in range(epochs):
        total_loss = 0.0
        for batch in tqdm(dataloader, desc=f"Epoch {ep+1}"):
            # ---- existing logic unchanged ----
            features = batch['features'].to(device)
            labels = batch['labels'].to(device)
            B, N, D = features.shape

            node_types = []
            rel_ids = torch.full((B, N), -1, dtype=torch.long, device=device)
            for i in range(B):
                seq_len_i = len(batch['raw'][i]['sentences'])
                num_leaves_i = len(batch['raw'][i]['leaves'])
                types = []
                for p in range(N):
                    if p < seq_len_i:
                        types.append('text')
                    else:
                        types.append('leaf')
                        leaf_idx = p - seq_len_i
                        if leaf_idx < num_leaves_i:
                            rel_name = batch['raw'][i]['leaves'][leaf_idx]['relation']
                            rel_ids[i, p] = abs(hash(rel_name)) % 10
                node_types.append(types)

            optimizer.zero_grad()
            logits, _ = model(features, node_types=node_types, rel_ids=rel_ids)
            loss = criterion(logits.view(-1, logits.size(-1)), labels.view(-1))
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

            step += 1
            if progress_key:
                training_progress[progress_key] = int((step / total_steps) * 100)

        print(f"Epoch {ep+1} avg loss: {total_loss/len(dataloader):.4f}")

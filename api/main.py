from flask import Flask, request, jsonify, Response, Blueprint
from flask_cors import CORS
from dotenv import load_dotenv
import os
import torch
from torch.utils.data import DataLoader
from werkzeug.utils import secure_filename
from graph_mert import GraphMERTModel
from data_processing import SeedKG, pdfs_to_chain_graphs, extract_sentences_from_pdf, AutoKGBuilder, GraphMERTDataset, collate_fn
from graph_inference import RetrieverQA
from train import train, training_progress
import networkx as nx
from sentence_transformers import SentenceTransformer
from openai import OpenAI

import matplotlib
matplotlib.use('Agg')  # non-interactive backend — no Tk, safe from background threads
import matplotlib.pyplot as plt
import io
from chat_service import ChatService

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
api_bp = Blueprint('api', __name__, url_prefix='/api')

CORS(api_bp, origins=["http://localhost:5173"])

UPLOAD_DIR = 'uploads'
MODEL_DIR = 'models'
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# Loaded once at startup — shared across all requests
emb_model = SentenceTransformer("all-MiniLM-L6-v2")
kg_builder = AutoKGBuilder()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL')  # optional, e.g. for local/proxy endpoints
MODEL_NAME = os.getenv('MODEL_NAME', 'gpt-4o-mini')

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable is required")

_openai_client = OpenAI(
    api_key=OPENAI_API_KEY,
    **({"base_url": OPENAI_BASE_URL} if OPENAI_BASE_URL else {}),
)

retrievers = {}

def load_all_retrievers():

    for filename in os.listdir(MODEL_DIR):
        if not filename.endswith("_kg.pt"):
            continue
        model_name = filename.replace("_kg.pt", "")
        kg_path = os.path.join(MODEL_DIR, filename)
        saved = torch.load(kg_path)
        sentences = saved["sentences"]
        retriever = RetrieverQA(sentences, emb_model)
        retrievers[model_name] = retriever
        print(f"Loaded retriever for model: {model_name}")


@api_bp.route('/train', methods=['POST'])
def train_model():
    model_name = request.form.get('model_name')
    if not model_name:
        return jsonify({'success': False, 'error': 'model_name required'}), 400

    model_folder = os.path.join(UPLOAD_DIR, model_name)
    os.makedirs(model_folder, exist_ok=True)
    pdf_files = request.files.getlist('pdfs')
    saved_paths = []
    for pdf in pdf_files:
        filename = secure_filename(pdf.filename)
        filepath = os.path.join(model_folder, filename)
        pdf.save(filepath)
        saved_paths.append(filepath)

    if not saved_paths:
        return jsonify({'success': False, 'error': 'No PDFs uploaded'}), 400

    seq_len = 5
    num_leaves = 2
    target_dim = 10

    corpus = extract_sentences_from_pdf(saved_paths)
    triples = kg_builder.build_kg_from_sentences(corpus)
    seed_kg = SeedKG(triples)

    graphs = pdfs_to_chain_graphs(saved_paths, seq_len=seq_len, num_leaves=num_leaves, target_dim=target_dim, seed_kg=seed_kg, sbert_model=emb_model)

    dataset = GraphMERTDataset(graphs)

    def collate_wrapper(batch):
        return collate_fn(batch, seed_kg=seed_kg, sbert=emb_model, target_dim=target_dim)

    dataloader = DataLoader(dataset, batch_size=2, shuffle=True, collate_fn=collate_wrapper)

    graph_model = GraphMERTModel(input_dim=target_dim, hidden_dim=64, n_heads=4, num_hgt_layers=2, rel_vocab_size=1000, seq_len=seq_len, num_leaves=num_leaves)
    optimizer = torch.optim.Adam(graph_model.parameters(), lr=1e-3)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    training_progress[model_name] = 0
    train(graph_model, dataloader, seed_kg, optimizer, device, epochs=3, progress_key=model_name)
    training_progress[model_name] = 100

    model_path = os.path.join(MODEL_DIR, f'{model_name}.pth')
    torch.save(graph_model.state_dict(), model_path)

    torch.save({'triples': triples, 'sentences': corpus}, os.path.join(MODEL_DIR, f'{model_name}_kg.pt'))
    retrievers[model_name] = RetrieverQA(corpus, emb_model)

    return jsonify({ 'success': True, 'message': 'Model trained and saved', 'model_path': model_path})

@api_bp.route('/re-train', methods=['POST'])
def re_train_model():
    model_name = request.form.get('model_name')
    if not model_name:
        return jsonify({'success': False, 'error': 'model_name required'}), 400

    model_folder = os.path.join(UPLOAD_DIR, model_name)

    pdf_files = request.files.getlist('pdfs')
    current_pdfs = request.form.getlist('current-pdfs')

    for already_on_server_pdf in os.listdir(model_folder):
        if already_on_server_pdf not in current_pdfs:
            os.remove(os.path.join(model_folder, already_on_server_pdf))

    saved_paths = [os.path.join(model_folder, current_pdf) for current_pdf in current_pdfs]

    for pdf in pdf_files:
        filename = secure_filename(pdf.filename)
        filepath = os.path.join(model_folder, filename)
        pdf.save(filepath)
        saved_paths.append(filepath)


    if not saved_paths:
        return jsonify({'success': False,'error': 'No PDFs uploaded'}), 400

    seq_len = 5
    num_leaves = 2
    target_dim = 10

    corpus = extract_sentences_from_pdf(saved_paths)
    triples = kg_builder.build_kg_from_sentences(corpus)
    seed_kg = SeedKG(triples)

    graphs = pdfs_to_chain_graphs(saved_paths, seq_len=seq_len, num_leaves=num_leaves, target_dim=target_dim, seed_kg=seed_kg, sbert_model=emb_model)

    dataset = GraphMERTDataset(graphs)

    def collate_wrapper(batch):
        return collate_fn(batch, seed_kg=seed_kg, sbert=emb_model, target_dim=target_dim)

    dataloader = DataLoader(dataset, batch_size=2, shuffle=True, collate_fn=collate_wrapper)

    graph_model = GraphMERTModel(input_dim=target_dim, hidden_dim=64, n_heads=4, num_hgt_layers=2, rel_vocab_size=1000, seq_len=seq_len, num_leaves=num_leaves)
    optimizer = torch.optim.Adam(graph_model.parameters(), lr=1e-3)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    training_progress[model_name] = 0
    train(graph_model, dataloader, seed_kg, optimizer, device, epochs=3, progress_key=model_name)
    training_progress[model_name] = 100

    model_path = os.path.join(MODEL_DIR, f'{model_name}.pth')
    torch.save(graph_model.state_dict(), model_path)

    torch.save({'triples': triples, 'sentences': corpus}, os.path.join(MODEL_DIR, f'{model_name}_kg.pt'))
    retrievers[model_name] = RetrieverQA(corpus, emb_model)

    return jsonify({'success': True,'message': 'Model trained and saved', 'model_path': model_path})


@api_bp.route('/train/progress/<model_name>', methods=['GET'])
def get_progress(model_name):
    return jsonify({
        'progress': training_progress.get(model_name, 0)
    })


@api_bp.route('/generate', methods=['POST'])
def generate_answer():
    data = request.json
    model_name = data.get('model_name')
    question = data.get('question')

    if not model_name or not question:
        return jsonify({'error': 'model_name and question required'}), 400

    kg_path = os.path.join(MODEL_DIR, f'{model_name}_kg.pt')
    if not os.path.exists(kg_path):
        return jsonify({'error': 'Model not found'}), 404

    retriever = retrievers[model_name]
    top_sents = retriever.query(question, top_k=3)
    context = "\n".join([s for s,_ in top_sents])

    prompt = f"Context:\n{context}\nQuestion: {question}\nAnswer:"

    def generate():
        try:
            stream = _openai_client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"Error: {str(e)}"

    return Response(generate(), mimetype='text/plain')


@api_bp.route('/models', methods=['GET'])
def list_models():
    names = [f.replace('.pth','') for f in os.listdir(MODEL_DIR) if f.endswith('.pth')]
    models = []
    for i in range(len(names)):
        pdf_folder_path = os.path.join(UPLOAD_DIR, names[i])
        pdf_count = len(os.listdir(pdf_folder_path))
        try:
            models.append({ "id": i+1, "name": names[i], "pdfCount": pdf_count, "progress": training_progress[names[i]] })
        except:
            models.append({ "id": i+1, "name": names[i], "pdfCount": pdf_count, "progress": 100 })
    return jsonify({'models': models})


@api_bp.route('/model_pdfs/<model_name>', methods=['GET'])
def list_pdfs(model_name):
    try:
        folder = os.path.join(UPLOAD_DIR, model_name)
        if not os.path.exists(folder):
            return jsonify({'error': 'model not found'}), 404

        pdfs = [f for f in os.listdir(folder) if f.endswith('.pdf')]
        return jsonify({
            "success": True,
            "message": "PDFs retrieved",
            'pdfs': pdfs
        })
    except:
        return jsonify({
            "success": False,
            "message": "Failed to retrieve pdfs",
            "pdfs": None
        })

@api_bp.route('/graph/<model_name>', methods=['GET'])
def get_graph(model_name):

    kg_path = os.path.join(MODEL_DIR, f"{model_name}_kg.pt")
    if not os.path.exists(kg_path):
        return jsonify({"error": "model not found"}), 404
    saved = torch.load(kg_path)
    triples = saved.get('triples', [])

    G = nx.DiGraph()
    for h, r, t in triples:
        G.add_node(h)
        G.add_node(t)
        G.add_edge(h, t, label=r)

    data = nx.readwrite.json_graph.node_link_data(G)
    return jsonify(data)


@api_bp.route('/graph/<model_name>/png', methods=['GET'])
def get_graph_png(model_name):

    kg_path = os.path.join(MODEL_DIR, f"{model_name}_kg.pt")
    if not os.path.exists(kg_path):
        return jsonify({"error": "model not found"}), 404

    saved = torch.load(kg_path)
    triples = saved.get('triples', [])

    # Build graph
    G = nx.DiGraph()
    for h, r, t in triples:
        G.add_node(h)
        G.add_node(t)
        G.add_edge(h, t, label=r)

    # Limit to 200 nodes — keep the highest-degree ones
    if len(G.nodes) > 100:
        top_nodes = sorted(G.nodes, key=lambda n: G.degree(n), reverse=True)[:100]
        G = G.subgraph(top_nodes).copy()

    plt.figure(figsize=(10, 10))
    pos = nx.spring_layout(G, k=0.5, seed=42)

    nx.draw(G, pos, with_labels=True, node_size=800, font_size=8, arrows=True)
    edge_labels = nx.get_edge_attributes(G, 'label')
    nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_size=6)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    plt.close()
    buf.seek(0)

    return Response(buf.getvalue(), mimetype='image/png')


@api_bp.route('/chat/list', methods=['GET'])
def list_chats():
    try:
        chats = ChatService.get_all_chats()
        returnable = [{ "id": chat.id, "title": chat.title, "lastMessage": chat.messages[len(chat.messages)-1], "timestamp": chat.created_at } for chat in chats]
        return jsonify({
            "success": True,
            "message": "Data retrieved!",
            "data": returnable if len(returnable) else []
        })
    except e:
        print(e)
        return jsonify({
            "success": False,
            "message": "Failed to retrieve data!",
            "data": None
        })


@api_bp.route('/chat/info/<chat_id>', methods=['GET'])
def get_chat(chat_id):
    try:
        chat = ChatService.get_chat(chat_id)
        return jsonify({
            "success": True,
            "message": "Data retrieved!",
            "data": chat
        })
    except:
        return jsonify({
            "success": False,
            "message": "Failed to retrieve data",
            "data": None
        })

app.register_blueprint(api_bp)

if __name__ == '__main__':
    load_all_retrievers()
    app.run(host='0.0.0.0', port=5000)

import os
import json
import re
import streamlit as st
from google import generativeai as genai
from supabase import create_client, Client

# Page layout configuration
st.set_page_config(
    page_title="AI Document Intelligence & Q&A Hub",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
    <style>
    .main {
        background-color: #0b091a;
        color: #f1f5f9;
    }
    .stApp {
        background: linear-gradient(135deg, #0b091a 0%, #120f2b 100%);
    }
    h1, h2, h3 {
        color: #ffffff !important;
        font-family: 'Inter', sans-serif;
    }
    .stButton>button {
        background: linear-gradient(90deg, #6366f1 0%, #4f46e5 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        font-weight: 600;
        transition: all 0.2s ease;
    }
    .stButton>button:hover {
        background: linear-gradient(90deg, #4f46e5 0%, #4338ca 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }
    .status-card {
        background-color: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
    }
    </style>
""", unsafe_allow_html=True)

# Helper to persist and load chat history
CHAT_HISTORY_FILE = "chat_history.json"

def load_chat_history():
    if os.path.exists(CHAT_HISTORY_FILE):
        try:
            with open(CHAT_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return [
        {
            "role": "assistant",
            "content": "Welcome, Nuclear Operator. I am your Rooppur NPP Unit 1 Safety & Technical Operations Assistant. I can answer operations questions with factual accuracy from the Safe Operation Technical Specifications. \n\nCitations like [Page 44] indicate referenced pages."
        }
    ]

def save_chat_history(messages):
    try:
        with open(CHAT_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(messages, f, indent=2)
    except Exception:
        pass

def render_flowchart_html(flowchart_content: str) -> str:
    # Clean up and split by ->
    clean_text = flowchart_content.strip()
    if not clean_text:
        return ""
    
    if "->" in clean_text:
        steps = [s.strip() for s in clean_text.split("->") if s.strip()]
    else:
        steps = [s.strip() for s in clean_text.split("\n") if s.strip()]
        
    # Generate HTML cards
    cards_html = []
    for idx, step in enumerate(steps):
        # Determine step types for background/border styling
        step_lower = step.lower()
        if idx == 0:
            border_color = "#6366f1" # indigo
            bg_color = "rgba(99, 102, 241, 0.15)"
            badge_text = "START"
            icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
        elif "trip" in step_lower or "scram" in step_lower or "shutdown" in step_lower or "emergency" in step_lower:
            border_color = "#ef4444" # red
            bg_color = "rgba(239, 68, 68, 0.15)"
            badge_text = "CRITICAL ACTION"
            icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
        elif "verify" in step_lower or "check" in step_lower or "?" in step_lower:
            border_color = "#f59e0b" # amber
            bg_color = "rgba(245, 158, 11, 0.15)"
            badge_text = "DECISION CHECK"
            icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
        elif idx == len(steps) - 1:
            border_color = "#10b981" # emerald
            bg_color = "rgba(16, 185, 129, 0.15)"
            badge_text = "SAFE STATE"
            icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        else:
            border_color = "#3b82f6" # blue
            bg_color = "rgba(59, 130, 246, 0.15)"
            badge_text = f"STEP {idx+1}"
            icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'

        # Connector arrow if not first step
        connector_html = ""
        if idx > 0:
            connector_html = """
            <div class="flow-connector">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" class="arrow-icon">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            </div>
            """

        card_html = f"""
        {connector_html}
        <div class="flow-card" style="border-color: {border_color}; background-color: {bg_color}; margin: 4px;">
            <div class="flow-badge" style="color: {border_color};">{badge_text}</div>
            <div class="flow-content-wrapper">
                <span class="flow-icon">{icon_svg}</span>
                <span class="flow-step-text">{step}</span>
            </div>
        </div>
        """
        cards_html.append(card_html)
        
    all_cards = "\n".join(cards_html)
    
    html_template = f"""
    <style>
    .flowchart-container {{
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        padding: 16px;
        background: #0d0b21;
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 12px;
        margin: 12px 0;
        font-family: 'Inter', sans-serif;
    }}
    .flow-card {{
        display: flex;
        flex-direction: column;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1.5px solid;
        min-width: 140px;
        max-width: 220px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }}
    .flow-card:hover {{
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.25);
    }}
    .flow-badge {{
        font-family: monospace;
        font-size: 9px;
        font-weight: bold;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
        text-transform: uppercase;
    }}
    .flow-content-wrapper {{
        display: flex;
        align-items: center;
        gap: 8px;
    }}
    .flow-icon {{
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }}
    .flow-step-text {{
        font-size: 12px;
        color: #f1f5f9;
        font-weight: 500;
        line-height: 1.3;
    }}
    .flow-connector {{
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
    }}
    @media (max-width: 640px) {{
        .flowchart-container {{
            flex-direction: column;
            align-items: stretch;
        }}
        .flow-card {{
            max-width: none;
        }}
        .flow-connector {{
            transform: rotate(90deg);
            padding: 8px 0;
        }}
    }}
    </style>
    <div class="flowchart-container">
        {all_cards}
    </div>
    """
    return html_template

def render_response_text(text: str):
    import re
    if not text:
        return
    
    # Locate all ```flowchart ... ``` blocks
    flowchart_pattern = re.compile(r"```flowchart([\s\S]*?)```", re.IGNORECASE)
    
    last_idx = 0
    for match in flowchart_pattern.finditer(text):
        # Render preceding markdown text
        start, end = match.span()
        if start > last_idx:
            st.markdown(text[last_idx:start])
        
        # Render flowchart HTML block
        flowchart_content = match.group(1)
        st.markdown(render_flowchart_html(flowchart_content), unsafe_allow_html=True)
        
        last_idx = end
        
    if last_idx < len(text):
        st.markdown(text[last_idx:])

# App Header
st.title("📄 AI Document Intelligence Dashboard")
st.subheader("Interactive OCR Parser & Knowledge Base Assistant")

# Sidebar Configuration
with st.sidebar:
    st.header("⚙️ System Status")
    
    # Load keys directly from environment (not exposed in the UI for security)
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    mistral_key = os.getenv("MISTRAL_API_KEY", "")
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_ANON_KEY", "")
    
    # Display configuration statuses
    active_providers = []
    if gemini_key: active_providers.append("Gemini")
    if groq_key: active_providers.append("Groq")
    if mistral_key: active_providers.append("Mistral")
    if openrouter_key: active_providers.append("OpenRouter")
    
    st.markdown("### 🤖 LLM Engine")
    if active_providers:
        st.success(f"Configured: {', '.join(active_providers)}")
    else:
        st.error("❌ No LLM providers configured! Add API keys in settings.")
        
    st.markdown("### 🗄️ Database")
    if supabase_url and supabase_key:
        st.success("✅ Supabase configured via environment.")
    else:
        st.warning("⚠️ Supabase not configured. Using local JSON fallback storage.")
    
    st.markdown("---")
    st.markdown("### Max Upload Configuration")
    # Streamlit default file upload limit can be customized in config.toml
    st.info("💡 To increase the file size limit to 50MB, configure Streamlit via `.streamlit/config.toml` or run with `--server.maxUploadSize 50`.")

# Initialize Clients
api_configured = any([gemini_key, groq_key, mistral_key, openrouter_key])
supabase_configured = False

if gemini_key:
    genai.configure(api_key=gemini_key)

if supabase_url and supabase_key:
    try:
        supabase_client: Client = create_client(supabase_url, supabase_key)
        supabase_configured = True
    except Exception as e:
        st.sidebar.error(f"Supabase connection failed: {e}")

# Helper for robust multi-provider fallback completion
def generate_text_with_fallback(system_instruction, history, query, gemini_key, groq_key, mistral_key, openrouter_key):
    import json
    import urllib.request
    
    errors = []
    
    # 1. Try Gemini
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            
            # Format history for Gemini
            contents = []
            for h in history:
                contents.append({
                    "role": "user" if h["role"] == "user" else "model",
                    "parts": [{"text": h["content"]}]
                })
            # Add current user query
            contents.append({
                "role": "user",
                "parts": [{"text": query}]
            })
            
            model = genai.GenerativeModel("gemini-3.5-flash", system_instruction=system_instruction)
            response = model.generate_content(contents)
            if response and response.text:
                return response.text, "Gemini", "gemini-3.5-flash"
        except Exception as e:
            errors.append(f"Gemini: {str(e)}")
            
    # OpenAI compatible structure
    messages = [{"role": "system", "content": system_instruction}]
    for h in history:
        messages.append({
            "role": "user" if h["role"] == "user" else "assistant",
            "content": h["content"]
        })
    messages.append({"role": "user", "content": query})
    
    # 2. Try Groq
    if groq_key:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {groq_key}"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": messages,
                "temperature": 0.1
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                text = data["choices"][0]["message"]["content"]
                if text:
                    return text, "Groq", "llama-3.3-70b-versatile"
        except Exception as e:
            errors.append(f"Groq: {str(e)}")
            
    # 3. Try Mistral
    if mistral_key:
        try:
            url = "https://api.mistral.ai/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {mistral_key}"
            }
            payload = {
                "model": "mistral-large-latest",
                "messages": messages,
                "temperature": 0.1
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                text = data["choices"][0]["message"]["content"]
                if text:
                    return text, "Mistral", "mistral-large-latest"
        except Exception as e:
            errors.append(f"Mistral: {str(e)}")
            
    # 4. Try OpenRouter
    if openrouter_key:
        try:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openrouter_key}",
                "HTTP-Referer": "https://ai.studio/build",
                "X-Title": "Nuclear Safety AI Hub"
            }
            payload = {
                "model": "meta-llama/llama-3-8b-instruct:free",
                "messages": messages,
                "temperature": 0.1
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                text = data["choices"][0]["message"]["content"]
                if text:
                    return text, "OpenRouter", "meta-llama/llama-3-8b-instruct:free"
        except Exception as e:
            errors.append(f"OpenRouter: {str(e)}")
            
    raise Exception(f"All LLM fallback providers failed.\nDetails:\n" + "\n".join(errors))

# Parse the 5 provided technical specification text files sequentially
def parse_specification_documents():
    import re
    pages = []
    files = [
        "doc_part1.txt",
        "doc_part2.txt",
        "doc_part3.txt",
        "doc_part4.txt",
        "doc_part5.txt",
    ]
    for filename in files:
        if not os.path.exists(filename):
            continue
        try:
            with open(filename, "r", encoding="utf-8") as f:
                file_content = f.read()
            # Find all [PAGE X] page markers
            matches = list(re.finditer(r"\[PAGE\s+(\d+)\]", file_content, re.IGNORECASE))
            if matches:
                for i, match in enumerate(matches):
                    start = match.start()
                    end = matches[i + 1].start() if i + 1 < len(matches) else len(file_content)
                    page_number = int(match.group(1))
                    page_text = file_content[start:end].strip()
                    pages.append({
                        "number": page_number,
                        "content": page_text,
                        "sourceFile": filename
                    })
            else:
                # Fallback: treat whole file as one page
                pages.append({
                    "number": 1,
                    "content": file_content.strip(),
                    "sourceFile": filename
                })
        except Exception:
            pass
    pages.sort(key=lambda p: p["number"])
    return pages

# Load local uploaded documents fallback storage
def load_uploaded_documents():
    local_path = "uploaded_docs.json"
    if os.path.exists(local_path):
        try:
            with open(local_path, "r", encoding="utf-8") as lf:
                return json.load(lf)
        except Exception:
            pass
    return []

# 2-Column Main Layout
col1, col2 = st.columns([1, 1.2])

with col1:
    st.header("📤 Document Upload")
    
    # Check configurations before allowing uploads
    if not api_configured:
        st.warning("⚠️ Please configure at least one API Key (like Gemini) in settings or environment to parse documents.")
    else:
        uploaded_file = st.file_uploader("Choose a PDF or Text document", type=["pdf", "txt"])
        
        if uploaded_file is not None:
            st.success(f"File loaded successfully: {uploaded_file.name}")
            
            is_pdf = uploaded_file.name.lower().endswith(".pdf")
            is_txt = uploaded_file.name.lower().endswith(".txt")
            
            if is_pdf:
                # Read pdf bytes
                pdf_bytes = uploaded_file.read()
                
                if st.button("🚀 Process PDF & Store"):
                    with st.spinner("Analyzing and Chunking PDF with Gemini OCR..."):
                        try:
                            # Split PDF into smaller chunks of 5 pages each using python libraries
                            import io
                            pdf_reader_lib = None
                            try:
                                from pypdf import PdfReader, PdfWriter
                                pdf_reader_lib = "pypdf"
                            except ImportError:
                                try:
                                    from PyPDF2 import PdfReader, PdfWriter
                                    pdf_reader_lib = "PyPDF2"
                                except ImportError:
                                    pdf_reader_lib = None

                            chunks = []
                            if pdf_reader_lib:
                                reader = PdfReader(io.BytesIO(pdf_bytes))
                                total_pages = len(reader.pages)
                                chunk_size = 5
                                for start_page in range(0, total_pages, chunk_size):
                                    end_page = min(start_page + chunk_size, total_pages)
                                    writer = PdfWriter()
                                    for page_idx in range(start_page, end_page):
                                        writer.add_page(reader.pages[page_idx])
                                    chunk_io = io.BytesIO()
                                    writer.write(chunk_io)
                                    chunks.append((start_page, chunk_io.getvalue()))
                            else:
                                chunks.append((0, pdf_bytes))

                            all_extracted_pages = []
                            model = genai.GenerativeModel("gemini-3.5-flash")

                            for start_page, chunk_data in chunks:
                                st.write(f"⏳ Processing page segment starting at page {start_page + 1}...")

                                prompt = (
                                    f"Perform complete OCR on this PDF segment representing pages {start_page + 1} onwards. Extract all pages. "
                                    "For each page, identify its number relative to this segment (starting from 1) and extract the text content exactly as-is. "
                                    "Return the response strictly as a JSON array of objects with the structure: "
                                    '[{"number": 1, "content": "..."}]. Do not summarize or omit text. Return only raw JSON.'
                                )

                                response = model.generate_content([
                                    {
                                        'mime_type': 'application/pdf',
                                        'data': chunk_data
                                    },
                                    prompt
                                ])

                                clean_text = response.text.strip()
                                if clean_text.startswith("```json"):
                                    clean_text = clean_text[7:]
                                if clean_text.endswith("```"):
                                    clean_text = clean_text[:-3]

                                try:
                                    chunk_pages = json.loads(clean_text)
                                    if isinstance(chunk_pages, list):
                                        chunk_pages.sort(key=lambda p: p.get("number", 0))
                                        for idx, p in enumerate(chunk_pages):
                                            absolute_page = start_page + 1 + idx
                                            all_extracted_pages.append({
                                                "number": absolute_page,
                                                "content": p.get("content", "")
                                            })
                                except Exception as parse_e:
                                    st.warning(f"Failed to parse chunk starting at page {start_page + 1}: {parse_e}")
                                    all_extracted_pages.append({
                                        "number": start_page + 1,
                                        "content": clean_text
                                    })

                            # Rearrange/sort final pages
                            all_extracted_pages.sort(key=lambda p: p["number"])
                            pages = all_extracted_pages
                            
                            st.info(f"Successfully extracted {len(pages)} pages using Gemini OCR!")
                            
                            # Store in Supabase or local fallback
                            if supabase_configured:
                                with st.spinner("Syncing OCR contents with Supabase database..."):
                                    records = []
                                    for page in pages:
                                        records.append({
                                            "filename": uploaded_file.name,
                                            "page_number": page.get("number", 1),
                                            "content": page.get("content", ""),
                                        })
                                    supabase_client.table("document_pages").insert(records).execute()
                                    st.success(f"✨ Successfully stored {len(records)} records in Supabase 'document_pages' table!")
                            else:
                                st.warning("⚠️ Supabase not configured. Saving locally to uploaded_docs.json...")
                                local_path = "uploaded_docs.json"
                                existing_pages = []
                                if os.path.exists(local_path):
                                    try:
                                        with open(local_path, "r", encoding="utf-8") as lf:
                                            existing_pages = json.load(lf)
                                    except Exception:
                                        pass
                                for page in pages:
                                    existing_pages.append({
                                        "filename": uploaded_file.name,
                                        "page_number": page.get("number", 1),
                                        "content": page.get("content", ""),
                                    })
                                with open(local_path, "w", encoding="utf-8") as lf:
                                    json.dump(existing_pages, lf, indent=2)
                                st.success("✨ Successfully saved uploaded document pages to local fallback!")
                        except Exception as err:
                            st.error(f"Processing failed: {err}")
            elif is_txt:
                txt_content = uploaded_file.read().decode("utf-8", errors="ignore")
                
                if st.button("🚀 Process Text & Store"):
                    with st.spinner("Parsing text content..."):
                        try:
                            import re
                            matches = list(re.finditer(r"\[PAGE\s+(\d+)\]", txt_content, re.IGNORECASE))
                            pages = []
                            if matches:
                                for i, match in enumerate(matches):
                                    start = match.start()
                                    end = matches[i + 1].start() if i + 1 < len(matches) else len(txt_content)
                                    page_number = int(match.group(1))
                                    page_text = txt_content[start:end].strip()
                                    pages.append({
                                        "number": page_number,
                                        "content": page_text
                                    })
                            else:
                                # Treat as a single block or chunk by size
                                if len(txt_content) > 3000:
                                    for idx, chunk_start in enumerate(range(0, len(txt_content), 1500)):
                                        pages.append({
                                            "number": idx + 1,
                                            "content": txt_content[chunk_start:chunk_start+1500]
                                        })
                                else:
                                    pages.append({
                                        "number": 1,
                                        "content": txt_content
                                    })
                            
                            st.info(f"Successfully parsed {len(pages)} chunks from the text file!")
                            
                            if supabase_configured:
                                with st.spinner("Syncing contents with Supabase database..."):
                                    records = []
                                    for page in pages:
                                        records.append({
                                            "filename": uploaded_file.name,
                                            "page_number": page.get("number", 1),
                                            "content": page.get("content", ""),
                                        })
                                    supabase_client.table("document_pages").insert(records).execute()
                                    st.success(f"✨ Successfully stored {len(records)} records in Supabase 'document_pages' table!")
                            else:
                                st.warning("⚠️ Supabase not configured. Saving locally to uploaded_docs.json...")
                                local_path = "uploaded_docs.json"
                                existing_pages = []
                                if os.path.exists(local_path):
                                    try:
                                        with open(local_path, "r", encoding="utf-8") as lf:
                                            existing_pages = json.load(lf)
                                    except Exception:
                                        pass
                                for page in pages:
                                    existing_pages.append({
                                        "filename": uploaded_file.name,
                                        "page_number": page.get("number", 1),
                                        "content": page.get("content", ""),
                                    })
                                with open(local_path, "w", encoding="utf-8") as lf:
                                    json.dump(existing_pages, lf, indent=2)
                                st.success("✨ Successfully saved uploaded document pages to local fallback!")
                        except Exception as err:
                            st.error(f"Processing failed: {err}")

with col2:
    col2_header, col2_clear = st.columns([3, 1])
    with col2_header:
        st.header("💬 Document Intelligence Q&A")
    with col2_clear:
        if st.button("🔄 Reset Chat", use_container_width=True):
            st.session_state.messages = [
                {
                    "role": "assistant",
                    "content": "Welcome, Nuclear Operator. I am your Rooppur NPP Unit 1 Safety & Technical Operations Assistant. I can answer operations questions with factual accuracy from the Safe Operation Technical Specifications. \n\nCitations like [Page 44] indicate referenced pages."
                }
            ]
            save_chat_history(st.session_state.messages)
            st.rerun()
 
    # Initialize chat history in session state
    if "messages" not in st.session_state:
        st.session_state.messages = load_chat_history()
 
    # Render previous messages
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            render_response_text(msg["content"])
            if "provider" in msg:
                st.caption(f"⚡ **Resolved by**: {msg['provider']} ({msg['model']})")
 
    # Accept new user question
    if user_query := st.chat_input("Ask about safe pressure limits, water levels, chemistry values..."):
        # Display user message in chat message container
        with st.chat_message("user"):
            st.markdown(user_query)
        
        # Append user message to state and save
        st.session_state.messages.append({"role": "user", "content": user_query})
        save_chat_history(st.session_state.messages)
        
        if not api_configured:
            with st.chat_message("assistant"):
                err_msg = "⚠️ Please configure at least one API Key in the sidebar (Gemini, Groq, Mistral, or OpenRouter)."
                st.error(err_msg)
                st.session_state.messages.append({"role": "assistant", "content": err_msg})
                save_chat_history(st.session_state.messages)
        else:
            with st.spinner("Searching document context & generating response..."):
                try:
                    context_passages = []
                    
                    # 1. Load the 5 provided specification documents
                    spec_pages = parse_specification_documents()
                    for p in spec_pages:
                        context_passages.append(f"Source: {p['sourceFile']} (Page {p['number']})\n{p['content']}")
                    
                    # 2. Fetch extra knowledge context from Supabase if configured
                    if supabase_configured:
                        try:
                            # Clean query to build list of valid search keywords (words > 3 chars)
                            search_words = [w.strip() for w in re.split(r'\W+', user_query) if len(w.strip()) > 3]
                            stop_words = {"what", "where", "when", "how", "with", "from", "that", "this", "their", "about", "which", "there"}
                            search_words = [w for w in search_words if w.lower() not in stop_words]
                            
                            fetched_rows = []
                            # Try Full-Text Search first if possible
                            try:
                                if search_words:
                                    ts_query = " | ".join(search_words)
                                    response = supabase_client.table("document_pages")\
                                        .select("content, filename, page_number")\
                                        .text_search("content", ts_query)\
                                        .limit(30)\
                                        .execute()
                                    fetched_rows = response.data or []
                            except Exception:
                                fetched_rows = []

                            # If no results from FTS, try simple ilike matching for first word
                            if not fetched_rows and search_words:
                                try:
                                    response = supabase_client.table("document_pages")\
                                        .select("content, filename, page_number")\
                                        .ilike("content", f"%{search_words[0]}%")\
                                        .limit(20)\
                                        .execute()
                                    fetched_rows = response.data or []
                                except Exception:
                                    pass

                            # If still no results, fetch recent entries up to 30 pages
                            if not fetched_rows:
                                try:
                                    response = supabase_client.table("document_pages")\
                                        .select("content, filename, page_number")\
                                        .limit(30)\
                                        .execute()
                                    fetched_rows = response.data or []
                                except Exception:
                                    pass

                            if fetched_rows:
                                for row in fetched_rows:
                                    context_passages.append(f"Source: {row['filename']} (Page {row['page_number']})\n{row['content']}")
                        except Exception as e:
                            st.warning(f"Could not load Supabase context: {e}")
                    else:
                        # 3. Load from local uploaded_docs.json fallback
                        uploaded_local = load_uploaded_documents()
                        for up in uploaded_local:
                            context_passages.append(f"Source: {up.get('filename', 'Uploaded Document')} (Page {up.get('page_number', 1)})\n{up.get('content', '')}")
                    
                    context_str = "\n\n---\n\n".join(context_passages) if context_passages else "No additional documents uploaded yet."
                    
                    system_instruction = f"""You are the Rooppur NPP Unit 1 Safety & Technical Operations AI Assistant. You have full access to the complete Technical Specification document of the NPP safe operation.
Your primary objective is to assist nuclear operators, engineers, and plant managers by answering questions with absolute factual accuracy based ONLY on the provided technical specification text below.

CRITICAL INSTRUCTIONS:
1. Answers MUST be strictly from within the provided documents.
2. If the requested information is not covered in the provided documents or is outside the documents, you MUST write "outside document" as your response. Do NOT use any external or pre-trained knowledge to answer. If it's not in the text, literally say "outside document".
3. DO NOT copy-paste blocks of text word-for-word. Instead, use your AI language capabilities to explain, rephrase, and format the answers so they are clear, structured, and easy to understand for a human operator, while remaining 100% factually accurate to the source.
4. You MUST ALWAYS include exact references and cite the specific documents and Page numbers in your answers. Format your page references exactly as "[Page X]" (e.g. "[Page 111]", "[Page 153]") and mention the source filename.
5. If an answer draws from multiple pages, include citations for each, for example: "[Page 111] and [Page 112]".
6. Reference tables specifically, e.g., "Table 4.1 on [Page 153]" or "Table 3.8 on [Page 54]".
7. Keep your tone professional, authoritative, conservative, and safety-focused.
8. CRITICAL: When describing step-by-step procedures, sequential operations, safety checks, or decision flow paths, you MUST also output an interactive flowchart of those steps using this markdown block format:
```flowchart
Step 1 Title -> Step 2 Title -> Step 3 Title -> Step 4 Title
```
Keep the step labels concise (2-5 words). The system will automatically compile this into an interactive, animated operational flowchart widget.

=== DOCUMENT CONTEXT ===
{context_str}
========================="""
 
                    # History is all messages except the newly added user query at the end
                    history_payload = st.session_state.messages[:-1]
 
                    answer_text, provider, model_name = generate_text_with_fallback(
                        system_instruction,
                        history_payload,
                        user_query,
                        gemini_key,
                        groq_key,
                        mistral_key,
                        openrouter_key
                    )
                    
                    # Display assistant response in chat message container
                    with st.chat_message("assistant"):
                        render_response_text(answer_text)
                        st.caption(f"⚡ **Resolved by**: {provider} ({model_name})")
                        
                    # Append assistant message to state and save
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": answer_text,
                        "provider": provider,
                        "model": model_name
                    })
                    save_chat_history(st.session_state.messages)
                    
                except Exception as err:
                    st.error(f"Generation failed: {err}")

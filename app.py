import os
import json
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

# App Header
st.title("📄 AI Document Intelligence Dashboard")
st.subheader("Interactive OCR Parser & Knowledge Base Assistant")

# Sidebar Configuration
with st.sidebar:
    st.header("🗄️ Database & Environment Settings")
    
    # Load keys directly from environment (not exposed in the UI for security)
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    mistral_key = os.getenv("MISTRAL_API_KEY", "")
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    
    env_sub_url = os.getenv("SUPABASE_URL", "")
    env_sub_key = os.getenv("SUPABASE_ANON_KEY", "")
    
    supabase_url = st.text_input("Supabase Project URL", value=env_sub_url)
    supabase_key = st.text_input("Supabase Anon Key", value=env_sub_key, type="password")
    
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
def generate_text_with_fallback(system_instruction, query, gemini_key, groq_key, mistral_key, openrouter_key):
    import json
    import urllib.request
    
    errors = []
    
    # 1. Try Gemini
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-3.5-flash")
            full_prompt = f"{system_instruction}\n\nQuestion: {query}"
            response = model.generate_content(full_prompt)
            if response and response.text:
                return response.text, "Gemini", "gemini-3.5-flash"
        except Exception as e:
            errors.append(f"Gemini: {str(e)}")
            
    # OpenAI compatible structure
    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": query}
    ]
    
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

# 2-Column Main Layout
col1, col2 = st.columns([1, 1.2])

with col1:
    st.header("📤 Reference PDF Upload")
    
    # Check configurations before allowing uploads
    if not api_configured:
        st.warning("⚠️ Please provide a valid Gemini API Key in the sidebar to perform OCR.")
    else:
        uploaded_file = st.file_uploader("Choose a PDF document", type=["pdf"])
        
        if uploaded_file is not None:
            st.success(f"File loaded successfully: {uploaded_file.name}")
            
            # Read pdf bytes
            pdf_bytes = uploaded_file.read()
            
            if st.button("🚀 Process PDF & Store in Supabase"):
                with st.spinner("Analyzing document with Gemini OCR & parsing pages..."):
                    try:
                        # Prepare Gemini inline data
                        model = genai.GenerativeModel("gemini-3.5-flash")
                        prompt = (
                            "Perform complete OCR on this PDF document. Extract all pages. "
                            "For each page, identify its number and extract the text content exactly as-is. "
                            "Return the response strictly as a JSON array of objects with the structure: "
                            '[{"number": 1, "content": "..."}]. Do not summarize or omit text. Return only raw JSON.'
                        )
                        
                        response = model.generate_content([
                            {
                                'mime_type': 'application/pdf',
                                'data': pdf_bytes
                            },
                            prompt
                        ])
                        
                        # Parse JSON results
                        clean_text = response.text.strip()
                        # Strip markdown blocks if returned
                        if clean_text.startswith("```json"):
                            clean_text = clean_text[7:]
                        if clean_text.endswith("```"):
                            clean_text = clean_text[:-3]
                            
                        pages = json.loads(clean_text)
                        
                        st.info(f"Successfully extracted {len(pages)} pages using Gemini OCR!")
                        
                        # Store in Supabase if configured
                        if supabase_configured:
                            with st.spinner("Syncing OCR contents with Supabase database..."):
                                records = []
                                for page in pages:
                                    records.append({
                                        "filename": uploaded_file.name,
                                        "page_number": page.get("number", 1),
                                        "content": page.get("content", ""),
                                    })
                                
                                result = supabase_client.table("document_pages").insert(records).execute()
                                st.success(f"✨ Successfully stored {len(records)} records in Supabase 'document_pages' table!")
                        else:
                            # Local fallback display
                            st.warning("⚠️ Supabase credentials not configured. Displaying OCR preview locally:")
                            st.json(pages[:2])  # Preview first two pages
                            
                    except Exception as err:
                        st.error(f"Processing failed: {err}")

with col2:
    st.header("💬 Document Intelligence Q&A")
    
    query = st.text_input("Ask a question about the document:")
    
    if query:
        if not api_configured:
            st.error("⚠️ Please configure at least one API Key in the sidebar (Gemini, Groq, Mistral, or OpenRouter).")
        else:
            with st.spinner("Searching document context & generating response..."):
                try:
                    context_passages = []
                    
                    # Fetch extra knowledge context from Supabase if configured
                    if supabase_configured:
                        try:
                            # Optional: Retrieve relevant document content based on keyword matching
                            # In a production setup, full-text-search or vector embeddings would be ideal.
                            response = supabase_client.table("document_pages").select("content, filename, page_number").limit(10).execute()
                            if response.data:
                                for row in response.data:
                                    context_passages.append(f"Source: {row['filename']} (Page {row['page_number']})\n{row['content']}")
                        except Exception as e:
                            st.warning(f"Could not load Supabase context: {e}")
                    
                    context_str = "\n\n---\n\n".join(context_passages) if context_passages else "No additional documents uploaded yet."
                    
                    system_instruction = f"""You are a helpful and precise assistant. Use the following parsed document pages as extra context to answer the user's question. If the information is not in the context, use your general knowledge, but prioritize the provided document facts.

=== DOCUMENT CONTEXT ===
{context_str}
========================"""

                    answer_text, provider, model_name = generate_text_with_fallback(
                        system_instruction,
                        query,
                        gemini_key,
                        groq_key,
                        mistral_key,
                        openrouter_key
                    )
                    
                    st.markdown("### Answer")
                    st.markdown(answer_text)
                    st.caption(f"⚡ **Resolved by**: {provider} ({model_name})")
                    
                except Exception as err:
                    st.error(f"Generation failed: {err}")

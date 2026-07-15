import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set payload limit to 50MB to support large PDF Base64 uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Structure for parsed document pages
interface Page {
  number: number;
  content: string;
  sourceFile: string;
}

let cachedPages: Page[] = [];
let fullDocumentText = "";

// Function to parse the five technical specification files
function parseSpecificationDocuments() {
  const pages: Page[] = [];
  const files = [
    "doc_part1.txt",
    "doc_part2.txt",
    "doc_part3.txt",
    "doc_part4.txt",
    "doc_part5.txt",
  ];

  console.log("Starting technical specification document ingestion...");

  for (const filename of files) {
    const filepath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filepath)) {
      console.warn(`Document chunk not found: ${filename}`);
      continue;
    }

    try {
      const fileContent = fs.readFileSync(filepath, "utf-8");
      // Find all [PAGE X] page markers
      const regex = /\[PAGE\s+(\d+)\]/gi;
      let match;
      const matches: { index: number; pageNumber: number }[] = [];

      while ((match = regex.exec(fileContent)) !== null) {
        matches.push({
          index: match.index,
          pageNumber: parseInt(match[1], 10),
        });
      }

      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        // End is the start of the next page marker or the end of the file
        const end =
          i + 1 < matches.length ? matches[i + 1].index : fileContent.length;

        const pageText = fileContent.substring(start, end).trim();
        pages.push({
          number: matches[i].pageNumber,
          content: pageText,
          sourceFile: filename,
        });
      }
      console.log(`Successfully ingested and parsed ${filename}`);
    } catch (err) {
      console.error(`Error reading or parsing ${filename}:`, err);
    }
  }

  // Sort pages sequentially by page number
  pages.sort((a, b) => a.number - b.number);
  cachedPages = pages;

  // Build the unified document string for Gemini context
  fullDocumentText = pages
    .map((p) => `[PAGE ${p.number}]\n${p.content}`)
    .join("\n\n---\n\n");

  console.log(
    `Ingestion complete. Total unique pages parsed: ${cachedPages.length}`
  );
}

// Dynamic loading of uploaded documents from local fallback or Supabase
async function loadUploadedDocuments() {
  const localPath = path.join(process.cwd(), "uploaded_docs.json");
  let uploadedPages: any[] = [];

  // Try loading from local fallback first
  if (fs.existsSync(localPath)) {
    try {
      uploadedPages = JSON.parse(fs.readFileSync(localPath, "utf-8"));
      console.log(`Loaded ${uploadedPages.length} pages from local uploaded_docs.json fallback.`);
    } catch (e) {
      console.error("Failed to parse local uploaded_docs.json:", e);
    }
  }

  // Try loading from Supabase if configured
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log("Fetching uploaded documents from Supabase...");
      const { data, error } = await supabase
        .from("document_pages")
        .select("filename, page_number, content")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading uploaded pages from Supabase:", error);
      } else if (data && data.length > 0) {
        console.log(`Loaded ${data.length} pages from Supabase.`);
        // Override or merge: pages loaded from Supabase take precedence if present
        uploadedPages = data.map((row: any) => ({
          number: row.page_number,
          content: row.content,
          sourceFile: row.filename
        }));
      }
    } catch (err) {
      console.error("Failed to fetch from Supabase:", err);
    }
  }

  // To prevent page number collision with the original 185-page document,
  // we re-map or append pages sequentially starting from page 186.
  let currentPageNum = 186;
  const pagesToAdd: Page[] = [];
  
  // Sort uploaded pages by filename first, then by original page number
  uploadedPages.sort((a, b) => {
    if (a.sourceFile !== b.sourceFile) {
      return a.sourceFile.localeCompare(b.sourceFile);
    }
    return a.number - b.number;
  });

  for (const up of uploadedPages) {
    pagesToAdd.push({
      number: currentPageNum++,
      content: up.content,
      sourceFile: up.sourceFile
    });
  }

  // Filter out any previously appended pages (pages with index >= 186) from cachedPages
  cachedPages = cachedPages.filter((p) => p.number <= 185);
  
  // Merge the new pages
  cachedPages = [...cachedPages, ...pagesToAdd];

  // Re-build the unified document string for Gemini context
  fullDocumentText = cachedPages
    .map((p) => `[PAGE ${p.number}]\n${p.content}`)
    .join("\n\n---\n\n");

  console.log(`Knowledge base updated. Total pages: ${cachedPages.length}`);
}

// Parse documents on startup
parseSpecificationDocuments();
loadUploadedDocuments();

// Shared Gemini client initialization (Server-side only)
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  console.log("Gemini Client successfully initialized on the server.");
} else {
  console.warn(
    "CRITICAL: GEMINI_API_KEY is not defined in the environment. AI features will fail."
  );
}

// --- API ENDPOINTS ---

// 0. PDF Upload & Gemini OCR Endpoint
app.post("/api/upload-pdf", async (req, res) => {
  const { filename, base64Data } = req.body;

  if (!filename || !base64Data) {
    return res.status(400).json({ error: "Parameters 'filename' and 'base64Data' are required." });
  }

  if (!aiClient) {
    return res.status(500).json({
      error: "The AI OCR engine is currently unavailable because the GEMINI_API_KEY is not configured.",
    });
  }

  try {
    console.log(`Starting Gemini OCR on uploaded PDF: ${filename}...`);

    // Remove base64 header if present (e.g., "data:application/pdf;base64,")
    const rawBase64 = base64Data.replace(/^data:application\/pdf;base64,/, "");

    // Request Gemini to parse pages and return structured JSON
    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: rawBase64,
          },
        },
        {
          text: "Perform complete OCR on this PDF document. Extract all pages. For each page, identify its number and extract the text content exactly as-is. Return the response strictly as a JSON array of objects. Do not summarize or omit text. Return only the JSON."
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              number: { type: Type.INTEGER, description: "The sequential page number starting from 1" },
              content: { type: Type.STRING, description: "The full text content of the page" }
            },
            required: ["number", "content"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No text output received from Gemini during OCR.");
    }

    const pages = JSON.parse(resultText.trim());
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("Invalid or empty page array returned by Gemini OCR.");
    }

    console.log(`Gemini OCR complete! Extracted ${pages.length} pages.`);

    // 1. Local storage fallback
    const localPath = path.join(process.cwd(), "uploaded_docs.json");
    let currentLocalDocs: any[] = [];
    if (fs.existsSync(localPath)) {
      try {
        currentLocalDocs = JSON.parse(fs.readFileSync(localPath, "utf-8"));
      } catch (e) {
        currentLocalDocs = [];
      }
    }

    // Add new pages
    for (const page of pages) {
      currentLocalDocs.push({
        number: page.number,
        content: page.content,
        sourceFile: filename
      });
    }
    fs.writeFileSync(localPath, JSON.stringify(currentLocalDocs, null, 2));
    console.log("Uploaded pages appended to local fallback storage.");

    // 2. Supabase storage (if configured)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        console.log(`Storing ${pages.length} pages in Supabase table 'document_pages'...`);
        const { error } = await supabase.from("document_pages").insert(
          pages.map((p: any) => ({
            filename: filename,
            page_number: p.number,
            content: p.content,
            created_at: new Date()
          }))
        );

        if (error) {
          console.error("Supabase insert error:", error);
          // Don't fail the whole request, since local fallback is active
        } else {
          console.log("Successfully stored pages in Supabase.");
        }
      } catch (sbErr) {
        console.error("Failed to store in Supabase:", sbErr);
      }
    }

    // 3. Hot-reload the knowledge base in memory
    await loadUploadedDocuments();

    res.json({
      success: true,
      filename,
      pagesParsed: pages.length,
      message: `Successfully processed and stored ${pages.length} pages.`
    });

  } catch (err: any) {
    console.error("Error during PDF OCR:", err);
    res.status(500).json({
      error: "Failed to perform OCR on the PDF document.",
      details: err.message
    });
  }
});

// 1. Get all pages for document browsing and search on the frontend
app.get("/api/document", (req, res) => {
  res.json({
    totalPages: cachedPages.length,
    pages: cachedPages.map((p) => ({
      number: p.number,
      source: p.sourceFile,
      preview: p.content.substring(0, 150) + "...",
    })),
  });
});

// 2. Get specific page content
app.get("/api/document/page/:number", (req, res) => {
  const pageNum = parseInt(req.params.number, 10);
  const page = cachedPages.find((p) => p.number === pageNum);

  if (!page) {
    return res.status(404).json({ error: `Page ${pageNum} not found.` });
  }

  res.json(page);
});

// 3. Search document for matching keywords
app.get("/api/document/search", (req, res) => {
  const query = (req.query.q as string || "").toLowerCase().trim();
  if (!query) {
    return res.json({ results: [] });
  }

  const results = cachedPages
    .filter((p) => p.content.toLowerCase().includes(query))
    .map((p) => {
      // Find a brief snippet around the match
      const contentLower = p.content.toLowerCase();
      const matchIndex = contentLower.indexOf(query);
      const start = Math.max(0, matchIndex - 60);
      const end = Math.min(p.content.length, matchIndex + query.length + 80);
      const snippet = p.content.substring(start, end).replace(/\n/g, " ").trim();

      return {
        pageNumber: p.number,
        source: p.sourceFile,
        snippet: `...${snippet}...`,
      };
    });

  res.json({ results });
});

// Robust Fallback LLM Completion Engine with seamless bypass
interface ChatMessage {
  role: string;
  content: string;
}

async function generateTextWithFallback(
  systemInstruction: string,
  history: ChatMessage[],
  currentQuestion: string
): Promise<{ text: string; provider: string; model: string }> {
  const errors: string[] = [];

  // 1. Try Gemini first (using @google/genai SDK)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && aiClient) {
    try {
      console.log("Attempting completion with Gemini...");
      const formattedContents = [];
      for (const msg of history) {
        formattedContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }
      formattedContents.push({
        role: "user",
        parts: [{ text: currentQuestion }],
      });

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1,
        },
      });

      if (response && response.text) {
        return {
          text: response.text,
          provider: "Gemini",
          model: "gemini-3.5-flash"
        };
      }
    } catch (err: any) {
      console.warn("Gemini execution failed. Attempting Groq fallback... Error:", err.message || err);
      errors.push(`Gemini: ${err.message || err}`);
    }
  } else {
    errors.push("Gemini: GEMINI_API_KEY not configured or client not initialized");
  }

  // Common messages structure for standard OpenAI-compatible endpoints
  const openAiMessages = [
    { role: "system", content: systemInstruction },
    ...history.map((h) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    })),
    { role: "user", content: currentQuestion },
  ];

  // 2. Try Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      console.log("Attempting completion with Groq...");
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: openAiMessages,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        return {
          text,
          provider: "Groq",
          model: "llama-3.3-70b-versatile"
        };
      }
    } catch (err: any) {
      console.warn("Groq execution failed. Attempting Mistral fallback... Error:", err.message || err);
      errors.push(`Groq: ${err.message || err}`);
    }
  } else {
    errors.push("Groq: GROQ_API_KEY not configured");
  }

  // 3. Try Mistral
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      console.log("Attempting completion with Mistral...");
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mistralKey}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: openAiMessages,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        return {
          text,
          provider: "Mistral",
          model: "mistral-large-latest"
        };
      }
    } catch (err: any) {
      console.warn("Mistral execution failed. Attempting OpenRouter fallback... Error:", err.message || err);
      errors.push(`Mistral: ${err.message || err}`);
    }
  } else {
    errors.push("Mistral: MISTRAL_API_KEY not configured");
  }

  // 4. Try OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      console.log("Attempting completion with OpenRouter...");
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://ai.studio/build",
          "X-Title": "Nuclear Safety AI Hub",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-8b-instruct:free",
          messages: openAiMessages,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        return {
          text,
          provider: "OpenRouter",
          model: "meta-llama/llama-3-8b-instruct:free"
        };
      }
    } catch (err: any) {
      console.warn("OpenRouter execution failed. Error:", err.message || err);
      errors.push(`OpenRouter: ${err.message || err}`);
    }
  } else {
    errors.push("OpenRouter: OPENROUTER_API_KEY not configured");
  }

  // If we got here, all providers failed
  throw new Error(`All LLM fallback providers failed.\nDetails:\n${errors.join("\n")}`);
}

// 4. Main Q&A Endpoint using robust fallback system
app.post("/api/ask", async (req, res) => {
  const { question, history = [] } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Question parameter is required." });
  }

  try {
    const systemInstruction = `You are the Rooppur NPP Unit 1 Safety & Technical Operations AI Assistant. You have full access to the complete Technical Specification document of the NPP safe operation.
Your primary objective is to assist nuclear operators, engineers, and plant managers by answering questions with absolute factual accuracy based ONLY on the provided technical specification text below.

CRITICAL INSTRUCTIONS:
1. Answers MUST be strictly from within the provided documents. If the requested information is not covered in the provided documents or is outside the documents, you MUST write "outside document" as your response. Do NOT use any external or pre-trained knowledge to answer.
2. DO NOT copy-paste blocks of text word-for-word. Instead, use your AI language capabilities to explain, synthesize, and format the answers so they are clear, structured, and easy to understand for a human operator, while remaining 100% factually accurate to the source.
3. You MUST ALWAYS include exact references to Page numbers and Table/Section names in your answers. Format your page references exactly as "[Page X]" (e.g. "[Page 111]", "[Page 153]"). This exact syntax is parsed by the client to render interactive clickable links that navigate directly to that page in the document viewer.
4. If an answer draws from multiple pages, include citations for each, for example: "[Page 111] and [Page 112]".
5. Reference tables specifically, e.g., "Table 4.1 on [Page 153]" or "Table 3.8 on [Page 54]".
6. Keep your tone professional, authoritative, conservative, and safety-focused.

Here is the complete Technical Specification of Safe Operation for Rooppur NPP Unit 1:
=========================================
${fullDocumentText}
=========================================`;

    const { text, provider, model } = await generateTextWithFallback(
      systemInstruction,
      history,
      question
    );

    res.json({ answer: text, provider, model });
  } catch (err: any) {
    console.error("Q&A Generation Error:", err);
    res.status(500).json({
      error: "An error occurred while generating the Q&A answer.",
      details: err.message,
    });
  }
});

// --- VITE MIDDLEWARE OR STATIC SERVER ---

if (process.env.NODE_ENV !== "production") {
  console.log("Setting up Vite development middleware...");
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);

    // Default 404 handler for API routes, let Vite handle assets/HTML
    app.use("*", (req, res, next) => {
      // If it looks like an API route, return 404
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ error: "API Endpoint not found" });
      }
      next();
    });
  });
} else {
  console.log("Setting up production static file serving...");
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server successfully booted and listening at http://localhost:${PORT}`);
});

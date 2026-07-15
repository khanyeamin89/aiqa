import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  User, 
  Send, 
  BookOpen, 
  ShieldAlert, 
  Activity, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  RotateCcw, 
  Compass, 
  HelpCircle, 
  ShieldCheck,
  ChevronRight,
  Maximize2
} from "lucide-react";
import { Message } from "./types";
import DocumentViewer from "./components/DocumentViewer";
import SafetyDashboard from "./components/SafetyDashboard";

const SUGGESTED_PROMPTS = [
  "What is the safety limit for core fuel element cladding temperature?",
  "What are the nominal parameters for pressurizer water level at 100% reactor power?",
  "What operations directives apply if the primary circuit pressure exceeds 16.5 MPa?",
  "What is the safety limit of the primary circuit pressure for coolant temperature < 140°C?"
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      role: "assistant",
      content: "Welcome, Nuclear Operator. I am your Rooppur NPP Unit 1 Safety & Technical Operations Assistant. I can answer operations questions with factual accuracy from the Safe Operation Technical Specifications. \n\nClick any suggested questions below, or type your own. Citations like [Page 44] are clickable and will automatically scroll the document browser to the exact page.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(4); // Default to Chapter 4 (usually where limits are)
  const [activeTab, setActiveTab] = useState<"document" | "validator">("document");
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle asking a question
  const handleAskQuestion = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Add user message
    const userMsgId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setIsAsking(true);
    setErrorMessage(null);

    try {
      // Build history payload matching schema
      const chatHistory = messages
        .filter(m => m.id !== "initial")
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: textToSend,
          history: chatHistory
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate answer");
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: data.provider,
        model: data.model
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Error communicating with AI endpoint:", err);
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsAsking(false);
    }
  };

  // Click handler to select and display referenced page
  const handlePageCitationClick = (pageNum: number) => {
    setCurrentPage(pageNum);
    setActiveTab("document"); // Bring document viewer to focus
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: "initial",
        role: "assistant",
        content: "Welcome, Nuclear Operator. I am your Rooppur NPP Unit 1 Safety & Technical Operations Assistant. I can answer operations questions with factual accuracy from the Safe Operation Technical Specifications. \n\nClick any suggested questions below, or type your own. Citations like [Page 44] are clickable and will automatically scroll the document browser to the exact page.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setErrorMessage(null);
  };

  // Parser to convert text into nodes with clickable page citation buttons
  const renderMessageContent = (text: string) => {
    if (!text) return null;

    // Capture [Page X] or [PAGE X] or [Page  X]
    const regex = /\[[pP]age\s+(\d+)\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const pageNum = parseInt(match[1], 10);

      // Add preceding plain text
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      // Add interactive citation link
      parts.push(
        <button
          key={matchIndex}
          onClick={() => handlePageCitationClick(pageNum)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-bold font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white border border-indigo-500/30 transition-all cursor-pointer shadow-xs"
          title={`Jump directly to Technical Specification Page ${pageNum}`}
        >
          <span>[Page {pageNum}]</span>
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return (
      <div className="whitespace-pre-wrap leading-relaxed text-sm text-slate-100 font-sans">
        {parts.length > 0 ? parts : text}
      </div>
    );
  };

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden font-sans text-slate-100 relative bg-[#0a071e]" style={{ background: "radial-gradient(circle at top left, #0e0a2d, #1a1742, #0b0821)" }}>
      {/* Background Mesh Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[35%] left-[25%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Primary Navigation & Control Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md border-b border-white/10 z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center border border-white/20 shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              Rooppur NPP Unit 1 Safety Assistant
              <span className="text-[9px] uppercase tracking-widest font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Operational Support
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Technical Specification Safe Operation Guidance System</p>
          </div>
        </div>

        {/* Global Stats indicators in margins */}
        <div className="flex items-center space-x-4">
          <div className="items-center space-x-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-slate-300 flex">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
            <span>Gemini Model Active</span>
          </div>
          <button 
            onClick={handleResetChat}
            className="p-1.5 rounded-lg hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-colors"
            title="Clear Conversational Session"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 lg:p-6 gap-6 z-10">
        
        {/* Left Column: Conversational AI Console */}
        <section className="flex-1 lg:max-w-[42%] flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative" id="qa-console">
          
          {/* Section Header */}
          <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Safety Guidance Console</h2>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Rev 2 • Doc Segmented Index
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" id="chat-scroller">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[90%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
              >
                {/* Profile Icon */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                  msg.role === "user" 
                    ? "bg-indigo-600/50 border-indigo-500/50 text-indigo-100" 
                    : "bg-white/10 border-white/10 text-indigo-300"
                }`}>
                  {msg.role === "user" ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
                </div>

                {/* Message Body */}
                <div className="flex flex-col gap-1">
                  <div className={`p-4 rounded-2xl border ${
                    msg.role === "user" 
                      ? "bg-indigo-600/75 rounded-tr-none border-white/10 text-white" 
                      : "bg-white/5 backdrop-blur-sm rounded-tl-none border-white/10"
                  }`}>
                    {msg.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap text-slate-100 font-sans">{msg.content}</p>
                    ) : (
                      renderMessageContent(msg.content)
                    )}
                  </div>
                  <div className={`flex items-center gap-2 mt-1 ${msg.role === "user" ? "justify-end mr-1" : "justify-between ml-1"}`}>
                    <span className="text-[9px] font-mono text-slate-400">
                      {msg.timestamp}
                    </span>
                    {msg.role === "assistant" && msg.provider && (
                      <span className="text-[8px] font-mono tracking-wider text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/25">
                        {msg.provider.toUpperCase()} ({msg.model})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* AI generating loader */}
            {isAsking && (
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 text-indigo-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl rounded-tl-none border border-white/10 text-slate-400 text-xs flex items-center gap-2">
                  <span>Synthesizing regulatory parameters against Tech Specs...</span>
                </div>
              </div>
            )}

            {/* Error Message notification */}
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 rounded-xl flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">System Directive Conflict</h4>
                  <p className="text-[11px] mt-0.5 text-red-200/90">{errorMessage}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Prompts Section */}
          <div className="p-4 bg-gradient-to-t from-white/5 to-transparent border-t border-white/10">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Operational Queries</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {SUGGESTED_PROMPTS.map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskQuestion(promptText)}
                  disabled={isAsking}
                  className="text-left text-[11px] px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1"
                >
                  <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{promptText}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Interface */}
          <div className="p-4 bg-white/5 border-t border-white/10 relative">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Ask about safe pressure limits, water levels, chemistry values..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isAsking) {
                    handleAskQuestion(input);
                  }
                }}
                disabled={isAsking}
                className="w-full bg-white/5 border border-white/15 focus:border-indigo-500 rounded-xl py-3 pl-4 pr-12 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/40 backdrop-blur-lg placeholder:text-slate-400"
                id="query-input-field"
              />
              <button
                onClick={() => handleAskQuestion(input)}
                disabled={!input.trim() || isAsking}
                className="absolute right-1.5 p-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-indigo-500 shadow-md shadow-indigo-500/20"
                title="Submit Operational Query"
                id="submit-query-btn"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-center text-slate-500 mt-2">
              Operational Assistant is grounded directly in Rooppur NPP Unit 1 Safe Operation Tech Specs. Always cross-verify critical safety thresholds.
            </p>
          </div>

        </section>

        {/* Right Column: Interactive Reference Viewer & Operational Dashboard */}
        <section className="flex-1 flex flex-col overflow-hidden">
          
          {/* Navigation Segments Tab Bar */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            {/* Tabs */}
            <div className="bg-white/5 p-1 rounded-xl flex gap-1 border border-white/10">
              <button
                onClick={() => setActiveTab("document")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "document"
                    ? "bg-indigo-600/70 border border-white/10 shadow text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Technical Specifications Browser</span>
              </button>
              
              <button
                onClick={() => setActiveTab("validator")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "validator"
                    ? "bg-indigo-600/70 border border-white/10 shadow text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Operations Parameter Validator</span>
              </button>
            </div>

            {/* Quick Context display */}
            <div className="text-[11px] font-mono text-slate-400 items-center gap-1.5 hidden md:flex bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Plant Safe State: Normal Power (Nnom)</span>
            </div>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === "document" ? (
              <DocumentViewer 
                currentPageNumber={currentPage} 
                onPageSelect={setCurrentPage} 
              />
            ) : (
              <div className="h-full overflow-y-auto pr-1">
                <SafetyDashboard />
              </div>
            )}
          </div>

        </section>

      </main>
    </div>
  );
}

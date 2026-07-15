import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Search, ChevronLeft, ChevronRight, FileText, HelpCircle, Loader2, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import { PagePreview, SearchResult, PageContent } from "../types";

interface DocumentViewerProps {
  currentPageNumber: number;
  onPageSelect: (pageNum: number) => void;
}

export default function DocumentViewer({ currentPageNumber, onPageSelect }: DocumentViewerProps) {
  const [totalPages, setTotalPages] = useState<number>(185);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // PDF Upload & OCR States
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "reading" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  // Fetch current documents and update total pages count
  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/document");
      if (response.ok) {
        const data = await response.json();
        setTotalPages(data.totalPages || 185);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Load the active page content whenever currentPageNumber changes
  useEffect(() => {
    async function fetchPage() {
      setIsLoadingPage(true);
      try {
        const response = await fetch(`/api/document/page/${currentPageNumber}`);
        if (response.ok) {
          const data = await response.json();
          setPageContent(data);
          // Scroll to top of page text
          if (pageContainerRef.current) {
            pageContainerRef.current.scrollTop = 0;
          }
        } else {
          console.error("Failed to load page content");
        }
      } catch (err) {
        console.error("Error loading page content:", err);
      } finally {
        setIsLoadingPage(false);
      }
    }
    fetchPage();
  }, [currentPageNumber]);

  // Handle keyword searching
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const response = await fetch(`/api/document/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // Debounce search calls

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handlePrevPage = () => {
    if (currentPageNumber > 1) {
      onPageSelect(currentPageNumber - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPageNumber < totalPages) {
      onPageSelect(currentPageNumber + 1);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (file.type !== "application/pdf") {
      setUploadStatus("error");
      setUploadMessage("Only PDF files are supported.");
      return;
    }

    setUploadStatus("reading");
    setUploadMessage(`Reading ${file.name}...`);
    setUploadedFile(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        setUploadStatus("uploading");
        setUploadMessage("Performing OCR via Gemini...");

        const response = await fetch("/api/upload-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            base64Data: base64Data
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "OCR upload failed");
        }

        const data = await response.json();
        setUploadStatus("success");
        setUploadMessage(`Parsed & indexed ${data.pagesParsed} pages!`);
        
        // Refresh total page count
        await fetchDocuments();
      } catch (err: any) {
        console.error(err);
        setUploadStatus("error");
        setUploadMessage(err.message || "Failed to process PDF.");
      }
    };
    
    reader.onerror = () => {
      setUploadStatus("error");
      setUploadMessage("Failed to read file.");
    };

    reader.readAsDataURL(file);
  };

  // Helper to render page text with search highlights suited for dark background
  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const regex = new RegExp(`(${escapeRegExp(search)})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-400/25 text-amber-200 px-0.5 rounded font-medium border-b border-amber-400">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden text-slate-100" id="document-viewer">
      {/* Header */}
      <div className="p-4 bg-white/5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">
            Technical Specification Browser
          </h2>
        </div>

        {/* Page Selector Controls */}
        <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-between sm:justify-start">
          <button
            onClick={handlePrevPage}
            disabled={currentPageNumber <= 1}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Previous Page"
            id="prev-page-btn"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-mono">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPageNumber}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= totalPages) {
                  onPageSelect(val);
                }
              }}
              className="w-12 text-center py-1 border border-white/15 bg-white/5 focus:border-indigo-500 rounded-md font-mono text-xs focus:ring-1 focus:ring-indigo-500/30 focus:outline-none text-white font-semibold"
              id="page-input"
            />
            <span className="text-xs text-slate-500 font-mono">/ {totalPages}</span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPageNumber >= totalPages}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Next Page"
            id="next-page-btn"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main split: Text on left, search sidebar on right (collapsible or side-by-side) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page Content Panel */}
        <div className="flex-1 flex flex-col p-5 overflow-y-auto" ref={pageContainerRef} id="page-content-pane">
          {isLoadingPage ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-sm font-medium text-slate-300">Retrieving technical specs page...</p>
            </div>
          ) : pageContent ? (
            <div className="prose prose-invert max-w-none">
              {/* Document Header Metadata */}
              <div className="border-b border-dashed border-white/10 pb-3 mb-4 flex justify-between items-center text-[10px] font-mono text-slate-400 tracking-wider uppercase">
                <span>Rooppur NPP Unit 1 Operation Spec</span>
                <span>Source: {pageContent.sourceFile}</span>
              </div>

              {/* Page text area with inner dark contrast styling */}
              <pre className="font-mono text-xs md:text-sm leading-relaxed whitespace-pre-wrap text-slate-200 font-normal bg-white/5 p-4 rounded-xl border border-white/5 shadow-inner select-text">
                {highlightText(pageContent.content, searchQuery)}
              </pre>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <FileText className="w-12 h-12 stroke-[1.2] text-slate-500" />
              <p className="text-sm font-medium">No page content loaded</p>
            </div>
          )}
        </div>

        {/* Search Sidebar */}
        <div className="w-72 border-l border-white/10 bg-white/5 backdrop-blur-md flex flex-col overflow-hidden" id="search-sidebar">
          {/* Search Input */}
          <div className="p-3 border-b border-white/10">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search technical text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/15 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-500 text-white font-sans"
                id="spec-search-input"
              />
            </div>
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto p-3" id="search-results-list">
            {searchQuery ? (
              isSearching ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span className="text-xs">Searching documents...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {searchResults.length} Match{searchResults.length > 1 ? "es" : ""} Found
                  </h3>
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => onPageSelect(res.pageNumber)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                        currentPageNumber === res.pageNumber
                          ? "bg-indigo-600/35 border-indigo-500 text-white"
                          : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded text-[10px]">
                          Page {res.pageNumber}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono uppercase">
                          {res.source.replace("doc_", "")}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11px] leading-relaxed italic text-slate-300/80">
                        {res.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
                  <p className="text-xs font-semibold text-slate-300">No results found</p>
                  <p className="text-[10px] text-slate-400 mt-1">Try keywords like 'boric', 'temperature', 'leak' or 'POSV'</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
                <HelpCircle className="w-8 h-8 text-slate-500 stroke-[1.2] mb-2" />
                <p className="text-xs font-semibold text-slate-300">Interactive Index Search</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Enter keywords to search the entire Technical Specification. Click any result to jump to that page.
                </p>
              </div>
            )}
          </div>

          {/* PDF Upload Section */}
          <div className="p-3 border-t border-white/10 bg-[#120f2b]/50 flex flex-col gap-2 shrink-0">
            <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Add PDF Reference (OCR)</span>
            </h3>
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative min-h-[90px] ${
                isDragging 
                  ? "border-indigo-500 bg-indigo-500/10 text-white" 
                  : "border-white/10 bg-white/5 hover:border-white/25 text-slate-400 hover:text-slate-300"
              }`}
              onClick={() => document.getElementById("pdf-file-input")?.click()}
            >
              <input 
                type="file" 
                id="pdf-file-input" 
                accept=".pdf" 
                onChange={handleFileSelect} 
                className="hidden" 
              />
              
              {uploadStatus === "idle" && (
                <>
                  <Upload className="w-5 h-5 text-indigo-400 mb-1" />
                  <p className="text-[10px] font-medium leading-tight">Drag & drop your PDF reference</p>
                  <p className="text-[8px] text-slate-500 mt-1">or click to browse</p>
                </>
              )}

              {uploadStatus === "reading" && (
                <>
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mb-1" />
                  <p className="text-[10px] font-medium leading-tight text-slate-300">{uploadMessage}</p>
                </>
              )}

              {uploadStatus === "uploading" && (
                <>
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin mb-1" />
                  <p className="text-[10px] font-medium leading-tight text-slate-300 text-purple-300">{uploadMessage}</p>
                  <p className="text-[8px] text-slate-500 mt-1">OCR processing in progress</p>
                </>
              )}

              {uploadStatus === "success" && (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400 mb-1" />
                  <p className="text-[10px] font-semibold leading-tight text-emerald-300">{uploadMessage}</p>
                  <p className="text-[8px] text-slate-500 mt-1">File: {uploadedFile}</p>
                </>
              )}

              {uploadStatus === "error" && (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-400 mb-1" />
                  <p className="text-[10px] font-semibold leading-tight text-red-300">{uploadMessage}</p>
                  <p className="text-[8px] text-slate-500 mt-1">Click to try again</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

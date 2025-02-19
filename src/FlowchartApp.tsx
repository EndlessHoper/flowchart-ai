// FlowchartApp.tsx
import React, { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import "./mermaid.css";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const FlowchartApp: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "You are a Mermaid.js flowchart generator. Generate only valid Mermaid.js flowchart code. Always start with 'flowchart TD'. Use proper syntax: nodes with square brackets [Node text], arrows with -->, and no extra text or formatting. If this is a follow-up request, modify the existing flowchart based on the user's request. Example format:\nflowchart TD\nA[Start] --> B[Process]\nB --> C[End]"
    }
  ]);
  const mermaidRef = useRef<HTMLDivElement>(null);

  // Initialize mermaid once when component mounts
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        diagramPadding: 8,
        rankSpacing: 30,
        nodeSpacing: 30
      }
    });
  }, []);

  // Render diagram whenever mermaidCode changes
  useEffect(() => {
    const renderDiagram = async () => {
      if (mermaidCode && mermaidRef.current) {
        try {
          mermaidRef.current.innerHTML = '';
          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid';
          wrapper.textContent = mermaidCode;
          mermaidRef.current.appendChild(wrapper);
          await mermaid.run({
            nodes: [wrapper]
          });

          // Add zoom controls after rendering
          const svg = wrapper.querySelector('svg');
          if (svg) {
            svg.style.transform = `scale(${scale})`;
            svg.style.transformOrigin = 'center';
            svg.style.transition = 'transform 0.2s';
          }
        } catch (err) {
          console.error('Mermaid render error:', err);
          setError('Failed to render diagram. Please check the syntax.');
        }
      }
    };

    renderDiagram();
  }, [mermaidCode, scale]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    // Add user's prompt to messages
    const updatedMessages: Message[] = [
      ...messages,
      { role: "user" as const, content: prompt }
    ];

    if (mermaidCode) {
      // If there's existing code, include it in the context
      updatedMessages.push({
        role: "assistant" as const,
        content: `Current flowchart code:\n${mermaidCode}\nPlease modify this based on the user's request.`
      });
    }

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: updatedMessages,
          temperature: 0.3,
          max_tokens: 500,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      let code = data.choices[0].message.content.trim();
      
      // Clean up the code
      code = code
        .replace(/```mermaid\n?/g, '')
        .replace(/```/g, '')
        .replace(/^graph /i, 'flowchart ')
        .trim();
      
      // Ensure it starts with flowchart TD and has proper newline
      if (!code.startsWith('flowchart TD\n')) {
        code = code.replace(/^flowchart TD\s*/, ''); // Remove any malformed flowchart TD
        code = `flowchart TD\n${code}`; // Add it back with proper newline
      }
      
      // Ensure no text immediately after flowchart TD
      code = code.replace(/^(flowchart TD)([^\n])/, '$1\n$2');
      
      // Update messages with the assistant's response
      setMessages([
        ...updatedMessages,
        { role: "assistant" as const, content: code }
      ]);
      
      setMermaidCode(code);
      setPrompt(""); // Clear the input after generating
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleZoom = (delta: number) => {
    setScale(prevScale => Math.max(0.1, Math.min(2, prevScale + delta)));
  };

  return (
    <div style={{ 
      padding: "1rem", 
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      backgroundColor: "#f8f9fa",
      minHeight: "100vh"
    }}>
      <h1 style={{ 
        textAlign: "center", 
        color: "#2c3e50",
        marginBottom: "2rem"
      }}>Flowchart.ai</h1>
      
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr",
        gap: "2rem",
        maxWidth: "1400px",
        margin: "0 auto",
        height: "calc(100vh - 150px)"
      }}>
        {/* Left Panel - Input */}
        <div style={{ 
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Add header section to match right panel */}
          <div style={{ 
            padding: "1rem",
            borderBottom: "1px solid #eee",
            display: "flex",
            gap: "0.5rem",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <span style={{ fontSize: "0.9rem", color: "#666" }}>
              Input
            </span>
          </div>
          <div style={{ padding: "1.5rem", flex: 1, display: "flex", flexDirection: "column" }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mermaidCode ? "Describe how you want to modify the flowchart..." : "Describe your flowchart..."}
              style={{
                width: "100%",
                flex: 1,
                padding: "1rem",
                fontSize: "1rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
                resize: "none",
                marginBottom: "1rem"
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: loading || !prompt.trim() ? "#6c757d" : "#4a90e2",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading || !prompt.trim() ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Generating..." : mermaidCode ? "Update Diagram" : "Generate Diagram"}
            </button>
            {error && <p style={{ color: "#dc3545", margin: "1rem 0 0 0" }}>{error}</p>}
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div style={{ 
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ 
            padding: "1rem",
            borderBottom: "1px solid #eee",
            display: "flex",
            gap: "0.5rem",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <button 
              onClick={() => handleZoom(-0.1)}
              style={{
                padding: "0.5rem",
                fontSize: "1rem",
                backgroundColor: "#f8f9fa",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              -
            </button>
            <span style={{ fontSize: "0.9rem", color: "#666" }}>
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={() => handleZoom(0.1)}
              style={{
                padding: "0.5rem",
                fontSize: "1rem",
                backgroundColor: "#f8f9fa",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              +
            </button>
          </div>
          <div style={{ 
            flex: 1,
            overflow: "auto",
            padding: "1.5rem"
          }}>
            <div 
              ref={mermaidRef} 
              style={{ 
                minHeight: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowchartApp;
import React, { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "../utils/chatbot/chatbotEngine";
import content from "../assets/content.json";
import "./PhysioChatbot.css";
import logo from "../assets/logos/logoNoName.png";

// Map exercise IDs to video keys (content.json uses lowercase keys for some)
const VIDEO_KEY_MAP = {
  squat: "squat", pushUp: "pushup", deadBug: "deadbug", bridge: "bridge",
  pullUp: "pullup", lateralExternalRotation: "lateralExternalRotation",
  muscleUp: "muscleup", plank: "plank", pilatesHundred: "pilatesHundred",
  lunge: "lunge", legRaise: "legRaise", toeTouch: "toeTouch",
  standingObliqueCrunch: "standingObliqueCrunch", treePose: "treePose",
  shoulderPress: "shoulderPress", shoulderRolls: "shoulderRolls",
  pushUpGame: "pushUpGame", squatGame: "squatGame",
};

const getExerciseInfo = (id) => {
  const videoKey = VIDEO_KEY_MAP[id];
  if (!videoKey) return null;
  const name = id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
  return {
    id,
    name,
    description: content.catalog[id] || "",
    video: content.instructionVideos[videoKey] || "",
  };
};

// Parse message text: split into text segments and {{exercise:id}} cards
const parseMessage = (text) => {
  const parts = [];
  const regex = /\{\{exercise:(\w+)\}\}/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const info = getExerciseInfo(match[1]);
    if (info) parts.push({ type: "exercise", value: info });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
};

const PhysioChatbot = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm the RehabOS Physio Assistant. Ask me about exercises, injuries, rehab plans, or how to use the app." },
  ]);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendChatMessage(updated);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

// Simple markdown rendering: bold, italic, bullets
const renderMarkdown = (text) => {
  if (!text.trim()) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Convert **bold** and *italic*
    let parts = [];
    let remaining = line;
    let key = 0;
    // Process bold first, then italic
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIdx = 0;
    let m;
    while ((m = boldRegex.exec(remaining)) !== null) {
      if (m.index > lastIdx) parts.push(<span key={key++}>{remaining.slice(lastIdx, m.index)}</span>);
      parts.push(<strong key={key++}>{m[1]}</strong>);
      lastIdx = boldRegex.lastIndex;
    }
    if (lastIdx < remaining.length) parts.push(<span key={key++}>{remaining.slice(lastIdx)}</span>);
    if (parts.length === 0) parts.push(<span key={0}>{remaining}</span>);

    const isBullet = /^\s*[*\-]\s/.test(line);
    return (
      <div key={i} className={isBullet ? "chatbot-md-bullet" : "chatbot-md-line"}>
        {isBullet && <span className="chatbot-bullet-dot">•</span>}
        <span>{parts}</span>
      </div>
    );
  });
};

  const renderBubble = (text) => {
    const parts = parseMessage(text);
    return parts.map((part, i) =>
      part.type === "text" ? (
        <div key={i} className="chatbot-text-block">{renderMarkdown(part.value)}</div>
      ) : (
        <div key={i} className="chatbot-exercise-card">
          <div className="chatbot-exercise-header">
            <span className="chatbot-exercise-icon">🏋️</span>
            <div>
              <div className="chatbot-exercise-name">{part.value.name}</div>
              <div className="chatbot-exercise-desc">{part.value.description}</div>
            </div>
          </div>
          {part.value.video && (
            <iframe
              src={part.value.video}
              title={part.value.name}
              allowFullScreen
              className="chatbot-exercise-video"
            />
          )}
        </div>
      )
    );
  };

  return (
    <>
      {/* Floating Button */}
      <div className="chatbot-fab" onClick={() => setOpen(!open)}>
        <img src={logo} alt="RehabOS Assistant" />
      </div>

      {/* Chat Window */}
      {open && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <img src={logo} alt="Logo" />
            <div className="chatbot-header-text">
              <span className="chatbot-header-title">Physio Assistant</span>
              <span className="chatbot-header-subtitle">Powered by Gemini 2.5 Pro</span>
            </div>
            <button onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Body */}
          <div className="chatbot-body" ref={bodyRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-msg ${msg.role}`}>
                {msg.role === "assistant" && (
                  <img src={logo} alt="" className="chatbot-avatar" />
                )}
                <div className="chatbot-bubble">
                  {msg.role === "assistant" ? renderBubble(msg.content) : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chatbot-msg assistant">
                <img src={logo} alt="" className="chatbot-avatar" />
                <div className="chatbot-bubble typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="chatbot-input">
            <input
              type="text"
              placeholder="Ask about exercises, injuries, rehab..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={loading}
            />
            <button onClick={handleSend} disabled={loading}>
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PhysioChatbot;

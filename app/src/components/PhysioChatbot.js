import React, { useState } from "react";
import { getExerciseRecommendation } from "../utils/chatbot/chatbotEngine";
import "./PhysioChatbot.css";
import chatbotLogo from "../assets/logos/chatbotLogo.png"; // add logo

const PhysioChatbot = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const result = await getExerciseRecommendation(input);
    setResponse(result);
    setLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <div className="chatbot-fab" onClick={() => setOpen(!open)}>
        <img src={chatbotLogo} alt="Physio Assistant" />
      </div>

      {/* Chat Window */}
      {open && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <img src={chatbotLogo} alt="Logo" />
            <span>Physio Assistant</span>
            <button onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Body */}
          <div className="chatbot-body">
            {!response && (
              <p className="chatbot-hint">
                Describe your injury or muscle pain to get exercise guidance.
              </p>
            )}

            {loading && <p className="chatbot-hint">Analyzing...</p>}

            {response?.found &&
              response.exercises.map((ex) => (
                <div key={ex.id} className="chatbot-card">
                  <h4>{ex.name}</h4>
                  <p>{ex.description}</p>
                  <iframe
                    src={ex.video}
                    title={ex.name}
                    allowFullScreen
                  />
                </div>
              ))}

            {response && !response.found && (
              <p className="chatbot-error">{response.message}</p>
            )}
          </div>

          {/* Input */}
          <div className="chatbot-input">
            <input
              type="text"
              placeholder="Describe injury or muscle pain..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            />
            <button onClick={handleAsk}>Send</button>
          </div>
        </div>
      )}
    </>
  );
};

export default PhysioChatbot;

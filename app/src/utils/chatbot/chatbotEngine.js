const API_URL = process.env.REACT_APP_API_URL || "";

/**
 * Send a chat message to the Gemini 2.5 Pro backend via OpenRouter.
 * @param {Array<{role: string, content: string}>} messages - conversation history
 * @returns {Promise<string>} assistant reply text
 */
export async function sendChatMessage(messages) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Chat request failed");
  return data.reply;
}

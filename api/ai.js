export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, model, messages, modalities, image_config } = req.body;
  console.log("Received request with model:", model, "and messages count:", Array.isArray(messages) ? messages.length : 0);

  if (!apiKey || !model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: apiKey, model, messages[]' });
  }

  try {
    const systemMessage = {
      role: 'system',
      content: [{ type: 'input_text', text: "You are HatGPT, an upbeat, concise guide for Hack Clubbers (teens in the community Hack Club, where thy code and get free stuff). Speak with warmth, curiosity, and a bias for action. Keep answers short, safe, and helpful. Use Markdown for clarity. Offer code or steps when useful; avoid fluff and unnecessary disclaimers. You are open source and your repo is at github.com/MatthiasLubbertsen/HatGPT" }],
    };

    const inputMessages = [systemMessage, ...messages];

    const requestBody = {
      model,
      input: inputMessages,
      stream: true,
    };

    if (modalities) requestBody.modalities = modalities;
    if (image_config) requestBody.image_config = image_config;

    const response = await fetch("https://ai.hackclub.com/proxy/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorJson = JSON.parse(errorText);
            return res.status(response.status).json(errorJson);
        } catch {
            return res.status(response.status).json({ error: errorText });
        }
    }

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      const sentImages = new Set();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
            
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            // Pass through upstream id if present
            if (data.id) {
              res.write(`data: ${JSON.stringify({ id: data.id })}\n\n`);
            }

            // Handle streaming event types from the Responses API
            if (data.type === 'response.output_text.delta' && typeof data.delta === 'string') {
              accumulatedText += data.delta;
              res.write(`data: ${JSON.stringify({ text: data.delta })}\n\n`);
            }

            if (data.type === 'response.output_image.generated') {
              const url = data.image_url?.url || data.url;
              if (url && !sentImages.has(url)) {
                sentImages.add(url);
                res.write(`data: ${JSON.stringify({ image: url })}\n\n`);
              }
            }

            // Fallback for completed payloads that include full output array
            const outputs = Array.isArray(data.output) ? data.output : Array.isArray(data.response?.output) ? data.response.output : [];
            for (const output of outputs) {
              const content = Array.isArray(output.content) ? output.content : [];
              for (const item of content) {
                if (item.type === 'output_text' && typeof item.text === 'string') {
                  let delta = item.text;
                  if (accumulatedText && item.text.startsWith(accumulatedText)) {
                    delta = item.text.slice(accumulatedText.length);
                  }
                  accumulatedText += delta;
                  if (delta) {
                    res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
                  }
                }

                if ((item.type === 'output_image' || item.type === 'output_image_url' || item.type === 'image_url') && (item.image_url?.url || item.url)) {
                  const url = item.image_url?.url || item.url;
                  if (url && !sentImages.has(url)) {
                    sentImages.add(url);
                    res.write(`data: ${JSON.stringify({ image: url })}\n\n`);
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error parsing upstream chunk', e);
          }
        }
      }
    }
    res.end();

  } catch (error) {
    console.error("AI API Error:", error);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to fetch AI response', details: error.message });
    } else {
        res.end();
    }
  }
}

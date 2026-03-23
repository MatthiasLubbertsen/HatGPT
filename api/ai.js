import 'dotenv/config';

// Convert internal message format to Chat Completions API format
function convertMessages(messages) {
  return messages.map(msg => {
    const { type, id, status, attachments, ...rest } = msg;

    if (Array.isArray(rest.content)) {
      rest.content = rest.content.map(block => {
        // Convert old Responses API formats to Chat Completions format
        if (block.type === 'input_text') return { type: 'text', text: block.text };
        if (block.type === 'output_text') return { type: 'text', text: block.text };
        if (block.type === 'input_image_url') {
          const url = typeof block.image_url === 'string' ? block.image_url : block.image_url?.url;
          return { type: 'image_url', image_url: { url } };
        }
        // Pass through chat completions format (text, image_url, file)
        return block;
      });

      // Simplify assistant messages to a plain string when there is only a text block
      if (rest.role === 'assistant' && rest.content.length === 1 && rest.content[0].type === 'text') {
        rest.content = rest.content[0].text;
      }
    }

    return rest;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { apiKey, model, messages, plugins } = req.body;
  // console.log("Received request with model:", model, "and messages count:", Array.isArray(messages) ? messages.length : 0);

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: model, messages[]' });
  }

  if (!apiKey) {
    apiKey = process.env.PUBLIC_API_KEY;
  }

  try {
    const systemMessage = {
      role: 'system',
      content: "You are HatGPT, an upbeat, concise AI bot. You will mainly talk to Hack Clubbers (teens in the community Hack Club, where thy code and get free stuff) but not always. Speak with warmth, curiosity, and a bias for action. Keep answers short, safe, and helpful. Use Markdown for clarity. Offer code or steps when useful; avoid fluff and unnecessary disclaimers. You are open source and your repo is at github.com/MatthiasLubbertsen/HatGPT. Only provide this if you are asked.",
    };

    const inputMessages = [systemMessage, ...convertMessages(messages)];

    const requestBody = {
      model,
      messages: inputMessages,
      stream: true,
    };

    if (plugins) requestBody.plugins = plugins;

    const response = await fetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
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

            // Chat Completions streaming: choices[0].delta.content
            const deltaContent = data.choices?.[0]?.delta?.content;
            if (typeof deltaContent === 'string') {
              res.write(`data: ${JSON.stringify({ text: deltaContent })}\n\n`);
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

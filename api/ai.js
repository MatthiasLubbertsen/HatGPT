
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, model, prompt, modalities, image_config } = req.body;
  console.log("Received request with model:", model, "and prompt:", prompt);

  if (!apiKey || !model || !prompt) {
    return res.status(400).json({ error: 'Missing required fields: apiKey, model, prompt' });
  }

  try {
    const requestBody = {
      model: model,
      messages: [
        { role: "user", content: prompt },
      ],
      stream: true,
    };

    if (modalities) requestBody.modalities = modalities;
    if (image_config) requestBody.image_config = image_config;

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
                if (trimmed.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        const delta = data.choices?.[0]?.delta;
                        const message = data.choices?.[0]?.message;
                        
                        if (delta?.content) {
                            res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
                        }
                        
                        const images = delta?.images || message?.images;
                        if (images && Array.isArray(images)) {
                             for (const img of images) {
                                if (img.type === 'image_url' && img.image_url?.url) {
                                    res.write(`data: ${JSON.stringify({ image: img.image_url.url })}\n\n`);
                                }
                             }
                        }
                    } catch (e) {
                        console.error('Error parsing upstream chunk', e);
                    }
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

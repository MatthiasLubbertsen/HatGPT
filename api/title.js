export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, prompt } = req.body;
  console.log("Received request with  prompt:", prompt);

  if (!apiKey || !prompt) {
    return res.status(400).json({ error: 'Missing required fields: apiKey, prompt' });
  }

  try {
    const requestBody = {
      model: "qwen/qwen3-next-80b-a3b-instruct",
      messages: [
        { role: "system", content: "You are a title generator. Your task is to create a short, 2-3 word title that summarizes the user's input. Do NOT reply to the user. Do NOT answer questions. Examples:\nInput: 'How do I bake a cake?' -> Title: Baking a Cake\nInput: 'Write a python script' -> Title: Python Script Generation\nInput: 'Hi' -> Title: User Greeting" },
        { role: "user", content: prompt },
      ],
      stream: true,
    };

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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            }
          } catch (e) {
            console.error('Error parsing chunk', e);
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

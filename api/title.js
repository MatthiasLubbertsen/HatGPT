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
        { role: "system", content: "You are a conversation title generator.\n\nTask:\nCreate exactly one concise title (2-3 words) that summarizes the user's message.\n\nRules:\n- Output title text only.\n- Do not answer the user, ask questions, explain, or add extra words.\n- No quotes, no emojis, no punctuation at the end.\n- Use title case when appropriate.\n- Keep important technical terms exactly as written (e.g., API, JavaScript, PDF).\n\nIf the input is vague (e.g., 'hi', 'hello', 'thanks'), return: User greeting.\n\nExamples:\nInput: How do I bake a cake?\nTitle: Baking a Cake\nInput: Write a Python script to sort JSON files\nTitle: Python Script Sorting\nInput: Hello\nTitle: User greeting" },
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

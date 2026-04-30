import 'dotenv/config';
import { enforceRateLimit } from './_rateLimit.js';

const AI_PUBLIC_KEY_LIMIT = Number(process.env.PUBLIC_KEY_RATE_LIMIT_AI || 10);
const AI_PUBLIC_KEY_WINDOW_MS = Number(process.env.PUBLIC_KEY_RATE_LIMIT_AI_WINDOW_MS || 60_000);

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

  let { apiKey, model, messages, plugins, modalities, image_config } = req.body;
  //console.log("Received request with model:", model, "modalities:", modalities, "image_config:", image_config);

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: model, messages[]' });
  }

  const userApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const publicApiKey = process.env.PUBLIC_API_KEY;
  const effectiveApiKey = userApiKey || publicApiKey;

  if (!effectiveApiKey) {
    return res.status(400).json({ error: 'Missing API key and PUBLIC_API_KEY is not configured' });
  }

  const usingPublicKey = !userApiKey || effectiveApiKey === publicApiKey;
  if (usingPublicKey) {
    const rate = enforceRateLimit(req, res, {
      routeKey: 'ai-public',
      limit: AI_PUBLIC_KEY_LIMIT,
      windowMs: AI_PUBLIC_KEY_WINDOW_MS,
    });

    res.setHeader('X-RateLimit-Limit', String(rate.limit));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    res.setHeader('X-RateLimit-Window-Ms', String(rate.windowMs));

    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: 'Rate limit exceeded for public key usage',
        retryAfterSec: rate.retryAfterSec,
      });
    }
  }

  try {
    const systemMessage = {
      role: 'system',
      content: `You are HatGPT, an upbeat, concise AI bot. You will mainly talk to Hack Clubbers (teens in the community Hack Club (https://hackclub.com), where they code and get free stuff) but not always. Speak with warmth, curiosity, and a bias for action. Keep answers short, safe, and helpful. Use Markdown for clarity. Offer code or steps when useful; avoid fluff and unnecessary disclaimers. You are open source and your repo is at github.com/MatthiasLubbertsen/HatGPT. Only provide this if you are asked. Current model: ${model}.`,
    };

    const inputMessages = [systemMessage, ...convertMessages(messages)];

    const requestBody = {
      model,
      messages: inputMessages,
      stream: true,
    };

    if (plugins) requestBody.plugins = plugins;
    if (modalities) requestBody.modalities = modalities;
    if (image_config) requestBody.image_config = image_config;

    //console.log("Sending request to OpenRouter with body:", JSON.stringify(requestBody).substring(0, 200));

    const response = await fetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${effectiveApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    //console.log("OpenRouter response status:", response.status, response.ok);

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

    if (!response.body) {
      console.error('[Server] OpenRouter response has no body!');
      res.write(`data: ${JSON.stringify({ error: 'OpenRouter response had no body' })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let firstRawChunk = true;
    let imageGenerationSignalSent = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
            
        const chunk = decoder.decode(value, { stream: true });
        if (firstRawChunk) {
          //console.log('[Server] First chunk received:', chunk.substring(0, 300));
          firstRawChunk = false;
        }
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) {
            if (trimmed && chunkCount === 0) console.log('[Server] Non-SSE line:', trimmed.substring(0, 100));
            continue;
          }

          try {
            const data = JSON.parse(trimmed.slice(6));
            chunkCount++;
            //console.log(`[Server SSE ${chunkCount}] Keys:`, Object.keys(data));

            // Pass through upstream id if present
            if (data.id) {
              res.write(`data: ${JSON.stringify({ id: data.id })}\n\n`);
            }

            // Chat Completions streaming: choices[0].delta.content
            const deltaContent = data.choices?.[0]?.delta?.content;
            if (typeof deltaContent === 'string') {
              res.write(`data: ${JSON.stringify({ text: deltaContent })}\n\n`);
            }

            // Handle images in streaming response
            const delta = data.choices?.[0]?.delta;
            
            // Try multiple possible image locations in the response
            let images = [];
            if (delta?.images && Array.isArray(delta.images)) {
              images = delta.images;
            } else if (delta?.image && !Array.isArray(delta.image)) {
              // Single image in delta.image
              images = [delta.image];
            } else if (data.choices?.[0]?.message?.images) {
              // Full message images in non-streaming style
              images = data.choices[0].message.images;
            }

            if (!imageGenerationSignalSent && images.length > 0) {
              imageGenerationSignalSent = true;
              res.write(`data: ${JSON.stringify({ image_generation_started: true })}\n\n`);
            }

            // Extract and send image URLs
            for (const image of images) {
              let imageUrl = null;
              if (typeof image === 'string') {
                // Direct string URL
                imageUrl = image;
              } else if (image.image_url) {
                // Object with image_url field
                imageUrl = typeof image.image_url === 'string' ? image.image_url : image.image_url.url;
              } else if (image.url) {
                // Object with url field
                imageUrl = image.url;
              }
              
              if (imageUrl) {
                //console.log(`[Server SSE ${chunkCount}] Found image`);
                res.write(`data: ${JSON.stringify({ image: imageUrl })}\n\n`);
              }
            }
          } catch (e) {
            console.error('Error parsing upstream chunk', e, 'line:', trimmed);
          }
        }
      }
      //console.log(`[Server] Stream complete, sent ${chunkCount} chunks`);
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

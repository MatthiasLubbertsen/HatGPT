document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.querySelector('.send-btn');
    const chatHistory = document.getElementById('chat-history');
    
    // UI Helpers
    const adjustHeight = () => {
        promptInput.style.height = 'auto';
        const lineHeight = 24; 
        const maxHeight = lineHeight * 5;
        const newHeight = Math.min(promptInput.scrollHeight, maxHeight);
        
        // Ensure minimum height
        if (newHeight > 0) {
            promptInput.style.height = `${newHeight}px`;
        }
        
        promptInput.style.overflowY = promptInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    const updateButtonState = () => {
        if (!promptInput.value.trim()) {
            sendBtn.disabled = true;
        } else {
            sendBtn.disabled = false;
        }
    };

    // Initialize UI behavior
    promptInput.addEventListener('input', () => {
        updateButtonState();
        adjustHeight();
    });

    // Start with disabled button
    updateButtonState();

    // Send Logic
    const handleSend = async () => {
        const text = promptInput.value.trim();
        if (!text) return;

        // Reset Input state
        promptInput.value = '';
        promptInput.style.height = 'auto'; 
        updateButtonState();

        // Switch UI to chat mode
        document.body.classList.add('chat-mode');

        // 1. Add User Message
        addMessage('user', text);

        // 2. Add AI Loading Placeholder
        const aiUi = addMessage('ai', '', true);

        // 3. API Call
        await fetchAIResponse(text, aiUi);
    };

    // Event Listeners
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    sendBtn.addEventListener('click', handleSend);

    // Markdown Configuration
    if (window.marked) {
        marked.setOptions({
            highlight: function(code, lang) {
                if (window.hljs) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                }
                return code;
            },
            breaks: true
        });
    }

    // Message Handling
    function addMessage(role, text, isLoading = false) {
        const row = document.createElement('div');
        row.className = `message-row ${role}-message-row`;
        
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role}-message`;
        if (role === 'ai') bubble.classList.add('markdown-content');
        
        if (role === 'ai') {
            if (isLoading) {
                bubble.innerHTML = `
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>`;
            } else {
                bubble.innerHTML = renderMarkdown(text);
            }
        } else {
            bubble.textContent = text;
        }

        row.appendChild(bubble);
        chatHistory.appendChild(row);
        
        // Auto scroll to bottom
        requestAnimationFrame(() => {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        });

        return { row, bubble };
    }

    function renderMarkdown(text) {
        if (!window.marked) return text;
        return marked.parse(text);
    }

    function renderMath(element) {
        if (window.renderMathInElement) {
            renderMathInElement(element, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
        }
    }

    async function fetchAIResponse(prompt, uiElements) {
        const { bubble, row } = uiElements;
        const apiKey = localStorage.getItem('apiKey');
        let model = 'openai/gpt-4o'; // Fallback
        
        // Determine model
        if (window.currentModel && window.currentModel.id) {
            model = window.currentModel.id;
        } else {
            // Try reading DOM
            const modelNameEl = document.querySelector('.model-name');
            if (modelNameEl) {
                // Try to map friendly name back to ID? 
                // For now, if we don't have the ID, we might default or try to get it from `availableModels` global in models-dropdown
                // Accessing global availableModels
                if (typeof availableModels !== 'undefined') {
                    const found = availableModels.find(m => m.name === modelNameEl.textContent.trim()); // heuristic match
                    if (found) model = found.id;
                }
            }
        }

        if (!apiKey) {
            bubble.textContent = 'Please set your API Key in Settings first.';
            return;
        }

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, model, prompt })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                bubble.textContent = `Error: ${err.error || response.statusText}`;
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let buffer = '';
            let firstChunk = true;

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
                            const data = JSON.parse(trimmed.substring(6));
                            if (data.text) {
                                if (firstChunk) {
                                    bubble.innerHTML = ''; // Remove typing indicator
                                    firstChunk = false;
                                }
                                fullText += data.text;
                                bubble.innerHTML = renderMarkdown(fullText);
                                renderMath(bubble);
                            }
                             if (data.image) {
                                if (firstChunk) { bubble.innerHTML = ''; firstChunk = false; }
                                const img = document.createElement('img');
                                img.src = data.image;
                                img.style.maxWidth = '100%';
                                bubble.appendChild(img);
                            }
                        } catch (e) {
                            console.error('SSE Parse Error', e);
                        }
                    }
                }
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }

            // Cleanup
            if (firstChunk) {
                bubble.textContent = "No response from AI.";
            }

            // Add actions
            addAiActions(row, prompt);

        } catch (error) {
            console.error(error);
            bubble.textContent = "Failed to connect to server.";
        }
    }

    function addAiActions(row, originalPrompt) {
        if (row.querySelector('.ai-actions')) return;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'ai-actions';
        
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'action-btn';
        refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
        refreshBtn.title = 'Regenerate response';
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showRefreshPopup(refreshBtn, originalPrompt);
        });
        
        actionsDiv.appendChild(refreshBtn);
        row.appendChild(actionsDiv);
    }

    function showRefreshPopup(btn, prompt) {
        document.querySelectorAll('.refresh-popup').forEach(p => p.remove());

        const popup = document.createElement('div');
        popup.className = 'refresh-popup';
        popup.innerHTML = `<div class="refresh-header">Ask to change response</div>`;

        const options = [
            { icon: 'fa-solid fa-arrows-rotate', text: 'Try again', suffix: '' },
            { icon: 'fa-solid fa-align-left', text: 'Add details', suffix: ' Please add more details.' },
            { icon: 'fa-solid fa-compress', text: 'More concise', suffix: ' Please be more concise.' },
            { icon: 'fa-solid fa-globe', text: 'Search the web', suffix: ' (Search the web)' },
            { icon: 'fa-regular fa-lightbulb', text: 'Think longer', suffix: ' (Think longer)' },
            { icon: 'fa-solid fa-microchip', text: 'Different model', suffix: '' } 
        ];

        options.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'refresh-option';
            div.innerHTML = `<i class="${opt.icon}"></i> ${opt.text}`;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                popup.remove();
                if (opt.text === 'Different model') {
                    document.querySelector('.model-dropdown')?.click();
                } else {
                    let newText = prompt;
                    if (opt.suffix) newText += opt.suffix;
                    promptInput.value = newText;
                    handleSend();
                }
            });
            popup.appendChild(div);
        });

        document.body.appendChild(popup);
        
        const rect = btn.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 6}px`;

        if (popup.getBoundingClientRect().right > window.innerWidth) {
            popup.style.left = 'auto';
            popup.style.right = '10px';
        }

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popup.contains(e.target) && e.target !== btn) {
                    popup.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    }
});

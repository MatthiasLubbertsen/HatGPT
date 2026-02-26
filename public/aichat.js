document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.querySelector('.send-btn');
    const chatHistory = document.getElementById('chat-history');
    const chatList = document.getElementById('chatList');
    const contentWrapper = document.querySelector('.content-wrapper');
    const chatInputContainer = document.querySelector('.chat-input-container');
    const newChatButton = document.querySelector('.nav-new-chat');
    const searchNavButton = document.getElementById('searchChatsNav');
    const searchModal = document.getElementById('search-modal');
    const searchCloseBtn = document.getElementById('searchClose');
    const searchClearBtn = document.getElementById('searchClear');
    const searchInput = document.getElementById('chatSearchModalInput');
    const searchResults = document.getElementById('chatSearchResults');

    const STORAGE_KEY = 'hatgpt_chats';
    const MAX_TITLE_LENGTH = 60;
    const pendingTitleRequests = new Set();
    const SCROLL_LOCK_THRESHOLD = 48;
    const PREVIOUS_LINE_OFFSET = 28;
    const SELECTION_MIN_CHARS = 5;
    const SELECTION_BTN_OFFSET = 6;
    const QUOTE_SYSTEM_PREFIX = "The user selected this part of your previous message, they want to react to this part:\n";

    let chats = [];
    let currentChatId = null;

    let chatHistoryState = []; // Global Chat history memory
    let chatSearchQuery = '';
    let isSearchOpen = false;
    let isBotBusy = false;
    let autoScroll = true;

    let scrollToBottomBtn = null;
    let selectionButton = null;
    let selectionPreview = null;
    let selectionPreviewBody = null;
    let selectionSnippet = '';
    let currentSelectionText = '';

    window.hatgptBotBusy = false;

    const safeParse = (value) => {
        try {
            return JSON.parse(value);
        } catch (err) {
            console.error('Failed to parse stored chats', err);
            return null;
        }
    };

    const loadSavedChats = () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = safeParse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(chat => chat && Array.isArray(chat.messages))
            .map(chat => ({
                ...chat,
                title: chat.title || 'New chat',
                createdAt: chat.createdAt || chat.updatedAt || Date.now(),
                updatedAt: chat.updatedAt || chat.createdAt || Date.now(),
            }));
    };

    const persistChats = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    };

    const getUsableChats = () => {
        const sorted = [...chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return sorted.filter(chat => Array.isArray(chat.messages) && chat.messages.length);
    };

    const findContentMatch = (chat, query) => {
        if (!query) return { snippet: '', role: '' };
        const q = query.toLowerCase();
        const messages = Array.isArray(chat.messages) ? chat.messages : [];
        for (const msg of messages) {
            const text = extractTextFromMessage(msg);
            if (!text) continue;
            const lower = text.toLowerCase();
            const idx = lower.indexOf(q);
            if (idx !== -1) {
                const start = Math.max(0, idx - 30);
                const end = Math.min(text.length, idx + q.length + 50);
                let snippet = text.slice(start, end);
                if (start > 0) snippet = `…${snippet}`;
                if (end < text.length) snippet = `${snippet}…`;
                return { snippet, role: msg.role || '' };
            }
        }
        return { snippet: '', role: '' };
    };

    const renderChatList = () => {
        if (!chatList) return;
        chatList.innerHTML = '';

        const usable = getUsableChats();

        if (!usable.length) {
            chatList.innerHTML = '<div class="chat-empty">No chats yet</div>';
            return;
        }

        usable.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-item';
            if (chat.id === currentChatId) item.classList.add('active');
            item.textContent = chat.title || 'New chat';
            const updatedTime = chat.updatedAt || chat.createdAt;
            if (updatedTime) {
                item.title = new Date(updatedTime).toLocaleString();
            }
            item.addEventListener('click', () => loadChat(chat.id));
            chatList.appendChild(item);
        });
    };

    const renderSearchResults = () => {
        if (!searchResults) return;
        searchResults.innerHTML = '';

        const usable = getUsableChats();
        if (!usable.length) {
            searchResults.innerHTML = '<div class="chat-empty">No chats yet</div>';
            return;
        }

        const query = chatSearchQuery.trim().toLowerCase();
        const filtered = usable.filter(chat => {
            if (!query) return true;
            const titleText = (chat.title || '').toLowerCase();
            const messages = Array.isArray(chat.messages) ? chat.messages : [];
            const messageText = messages
                .map(extractTextFromMessage)
                .join(' \n ')
                .toLowerCase();
            return titleText.includes(query) || messageText.includes(query);
        });

        if (!filtered.length) {
            searchResults.innerHTML = '<div class="chat-empty">No chats match your search</div>';
            return;
        }

        filtered.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'search-result-title';
            titleDiv.textContent = chat.title || 'New chat';

            const metaDiv = document.createElement('div');
            metaDiv.className = 'search-result-meta';
            const updatedTime = chat.updatedAt || chat.createdAt;
            metaDiv.textContent = updatedTime ? new Date(updatedTime).toLocaleString() : '';

            const { snippet, role } = findContentMatch(chat, query);
            let snippetDiv = null;
            if (snippet) {
                snippetDiv = document.createElement('div');
                snippetDiv.className = 'search-result-snippet';
                const roleSpan = document.createElement('span');
                roleSpan.className = 'snippet-role';
                roleSpan.textContent = role === 'assistant' ? 'AI' : 'User';
                const textSpan = document.createElement('span');
                textSpan.textContent = snippet;
                snippetDiv.appendChild(roleSpan);
                snippetDiv.appendChild(textSpan);
            }

            item.appendChild(titleDiv);
            item.appendChild(metaDiv);
            if (snippetDiv) item.appendChild(snippetDiv);

            item.addEventListener('click', () => {
                loadChat(chat.id);
                closeSearch({ clearValue: false });
            });

            searchResults.appendChild(item);
        });
    };

    const resetToNewChat = () => {
        currentChatId = null;
        chatHistoryState = [];
        if (chatHistory) {
            chatHistory.innerHTML = '';
        }
        document.body.classList.remove('chat-mode');
        autoScroll = true;
        renderChatList();
        promptInput?.focus();
    };

    const scrollToBottomWithOffset = (offset = 0) => {
        if (!chatHistory) return;
        const target = Math.max(0, chatHistory.scrollHeight - offset);
        chatHistory.scrollTop = target;
    };

    const isAtBottom = () => {
        if (!chatHistory) return true;
        const distance = chatHistory.scrollHeight - chatHistory.clientHeight - chatHistory.scrollTop;
        return distance <= SCROLL_LOCK_THRESHOLD;
    };

    const updateScrollButton = () => {
        if (!scrollToBottomBtn) return;
        const shouldShow = !isAtBottom() && chatHistory?.children.length > 0;
        scrollToBottomBtn.classList.toggle('visible', shouldShow);
    };

    const hideSelectionButton = () => {
        if (selectionButton) {
            selectionButton.classList.remove('visible');
        }
        currentSelectionText = '';
    };

    const syncAutoScroll = () => {
        autoScroll = isAtBottom();
        updateScrollButton();
        hideSelectionButton();
    };

    chatHistory?.addEventListener('scroll', syncAutoScroll);

    const ensureCurrentChat = () => {
        if (currentChatId) {
            return chats.find(c => c.id === currentChatId) || null;
        }
        const now = Date.now();
        const newChat = {
            id: `chat_${now}_${Math.random().toString(16).slice(2, 8)}`,
            title: 'New chat',
            createdAt: now,
            updatedAt: now,
            messages: [],
        };
        chats.push(newChat);
        currentChatId = newChat.id;
        renderChatList();
        return newChat;
    };

    const saveCurrentChat = () => {
        if (!currentChatId) return;
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;
        chat.messages = [...chatHistoryState];
        chat.updatedAt = Date.now();
        persistChats();
        renderChatList();
    };

    const extractTextFromMessage = (message) => {
        if (!message || !Array.isArray(message.content)) return '';
        const textBlock = message.content.find(c => typeof c.text === 'string');
        return textBlock?.text || '';
    };

    const findPreviousUserPrompt = (state, index) => {
        for (let i = index - 1; i >= 0; i -= 1) {
            if (state[i].role === 'user') {
                return extractTextFromMessage(state[i]);
            }
        }
        return '';
    };

    const loadChat = (chatId) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        currentChatId = chatId;
        chatHistoryState = Array.isArray(chat.messages) ? [...chat.messages] : [];

        if (chatHistory) {
            chatHistory.innerHTML = '';
        }

        if (chatHistoryState.length) {
            document.body.classList.add('chat-mode');
        } else {
            document.body.classList.remove('chat-mode');
        }

        chatHistoryState.forEach((message, idx) => {
            const role = message.role === 'assistant' ? 'ai' : 'user';
            const text = extractTextFromMessage(message);
            
            let displayText = text;
            let displayQuote = null;

            if (role === 'user' && text.startsWith(QUOTE_SYSTEM_PREFIX)) {
                // Attempt to parse out the quote
                // Format: PREFIX "quote" \n\nUser: text
                const splitIndex = text.indexOf('\n\nUser: ');
                if (splitIndex !== -1) {
                    const quoteSection = text.substring(QUOTE_SYSTEM_PREFIX.length, splitIndex);
                    // Remove surrounding double quotes if present
                    if (quoteSection.startsWith('"') && quoteSection.endsWith('"')) {
                        displayQuote = quoteSection.substring(1, quoteSection.length - 1);
                    } else {
                        displayQuote = quoteSection;
                    }
                    displayText = text.substring(splitIndex + '\n\nUser: '.length);
                }
            }

            const ui = addMessage(role, displayText, false, displayQuote);
            if (role === 'ai') {
                renderMath(ui.bubble);
                addAiActions(ui.row, findPreviousUserPrompt(chatHistoryState, idx));
            }
        });

        autoScroll = true;
        chatHistory.scrollTop = chatHistory.scrollHeight;
        renderChatList();
    };

    const sanitizeTitle = (titleText) => {
        const cleaned = (titleText || '').replace(/\s+/g, ' ').trim();
        if (cleaned.length > MAX_TITLE_LENGTH) {
            return `${cleaned.slice(0, MAX_TITLE_LENGTH)}...`;
        }
        return cleaned || 'New chat';
    };

    const generateTitleForChat = async (chatId, prompt) => {
        if (!prompt || pendingTitleRequests.has(chatId)) return;
        const apiKey = localStorage.getItem('apiKey');
        if (!apiKey) return;

        const chat = chats.find(c => c.id === chatId);
        if (!chat || (chat.title && chat.title !== 'New chat')) return;

        pendingTitleRequests.add(chatId);
        let assembled = '';
        try {
            const response = await fetch('/api/title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, prompt })
            });

            if (!response.ok || !response.body) {
                throw new Error('Title API request failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        if (data.text) {
                            assembled += data.text;
                        }
                    } catch (err) {
                        console.error('Title SSE parse error', err);
                    }
                }
            }
        } catch (err) {
            console.error('Title generation failed', err);
        } finally {
            pendingTitleRequests.delete(chatId);
        }

        const candidateTitle = assembled || prompt;
        if (candidateTitle) {
            chat.title = sanitizeTitle(candidateTitle);
            chat.updatedAt = Date.now();
            persistChats();
            renderChatList();
        }
    };

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
        const hasText = !!promptInput.value.trim();
        const hasLockedSnippet = !!selectionSnippet;
        const shouldDisable = isBotBusy || (!hasText && !hasLockedSnippet);
        sendBtn.disabled = shouldDisable;
        sendBtn.classList.toggle('is-busy', isBotBusy);
    };

    const ensureSelectionPreview = () => {
        if (selectionPreview || !chatInputContainer) return;
        selectionPreview = document.createElement('div');
        selectionPreview.className = 'selection-preview';

        const icon = document.createElement('i');
        icon.className = 'selection-preview-icon fa-solid fa-reply';

        selectionPreviewBody = document.createElement('div');
        selectionPreviewBody.className = 'selection-preview-body';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'selection-preview-remove';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.title = 'Remove snippet';
        removeBtn.addEventListener('click', () => {
            selectionSnippet = '';
            hideSelectionPreview();
            updateButtonState();
        });

        selectionPreview.appendChild(icon);
        selectionPreview.appendChild(selectionPreviewBody);
        selectionPreview.appendChild(removeBtn);

        // Always append to chatInputContainer, but position it via CSS
        if (chatInputContainer.firstChild) {
             chatInputContainer.insertBefore(selectionPreview, chatInputContainer.firstChild);
        } else {
             chatInputContainer.appendChild(selectionPreview);
        }
    };

    const showSelectionPreview = (text) => {
        ensureSelectionPreview();
        if (!selectionPreview || !selectionPreviewBody) return;
        selectionPreviewBody.textContent = text;
        selectionPreview.classList.add('visible');
    };

    const hideSelectionPreview = () => {
        if (selectionPreview) {
            selectionPreview.classList.remove('visible');
        }
        selectionSnippet = '';
    };

    if (contentWrapper) {
        scrollToBottomBtn = document.createElement('button');
        scrollToBottomBtn.className = 'scroll-to-bottom';
        scrollToBottomBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
        contentWrapper.appendChild(scrollToBottomBtn);
        scrollToBottomBtn.addEventListener('click', () => {
            scrollToBottomWithOffset();
            autoScroll = true;
            updateScrollButton();
        });
    }

    selectionButton = document.createElement('button');
    selectionButton.className = 'selection-action-btn';
    selectionButton.innerHTML = '<i class="fa-solid fa-quote-right"></i><span>Ask HatGPT (hold onto your hat)</span>';
    selectionButton.addEventListener('click', () => {
        if (!currentSelectionText) return;
        selectionSnippet = currentSelectionText;
        showSelectionPreview(currentSelectionText);
        adjustHeight();
        updateButtonState();
        promptInput.focus();
        hideSelectionButton();
    });
    document.body.appendChild(selectionButton);

    const maybeShowSelectionButton = () => {
        if (!selectionButton) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
            hideSelectionButton();
            return;
        }

        const text = sel.toString().trim();
        if (text.length < SELECTION_MIN_CHARS) {
            hideSelectionButton();
            return;
        }

        const range = sel.rangeCount ? sel.getRangeAt(0) : null;
        if (!range) {
            hideSelectionButton();
            return;
        }

        const container = range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement;
        const aiBubble = container?.closest('.ai-message');
        if (!aiBubble) {
            hideSelectionButton();
            return;
        }

        const rect = range.getBoundingClientRect();
        selectionButton.style.left = `${rect.left + window.scrollX}px`;
        selectionButton.style.top = `${rect.bottom + window.scrollY + SELECTION_BTN_OFFSET}px`;
        selectionButton.classList.add('visible');
        currentSelectionText = text;
    };

    document.addEventListener('selectionchange', maybeShowSelectionButton);
    window.addEventListener('scroll', hideSelectionButton);

    // Initialize UI behavior
    promptInput.addEventListener('input', () => {
        updateButtonState();
        adjustHeight();
    });

    // Start with disabled button
    updateButtonState();

    // Load stored chats and hydrate UI
    chats = loadSavedChats();
    renderChatList();
    updateScrollButton();

    const openSearch = () => {
        if (!searchModal) return;
        searchModal.style.display = 'flex';
        isSearchOpen = true;
        renderSearchResults();
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    };

    const closeSearch = ({clearValue = false} = {}) => {
        if (searchModal) {
            searchModal.style.display = 'none';
        }
        isSearchOpen = false;
        if (clearValue && searchInput) {
            searchInput.value = '';
            chatSearchQuery = '';
            renderSearchResults();
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            chatSearchQuery = searchInput.value.toLowerCase();
            renderSearchResults();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearch({ clearValue: true });
                promptInput?.focus();
            }
        });
    }

    searchClearBtn?.addEventListener('click', () => {
        closeSearch({ clearValue: true });
        searchInput?.focus();
    });

    searchCloseBtn?.addEventListener('click', () => closeSearch({ clearValue: false }));

    searchModal?.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            closeSearch({ clearValue: false });
        }
    });

    searchNavButton?.addEventListener('click', () => {
        if (isSearchOpen) {
            closeSearch({ clearValue: false });
        } else {
            openSearch();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (isSearchOpen && e.key === 'Escape') {
            closeSearch({ clearValue: false });
            promptInput?.focus();
        }
    });

    if (newChatButton) {
        newChatButton.addEventListener('click', (e) => {
            e.preventDefault();
            resetToNewChat();
        });
    }

    const setBotBusy = (busy) => {
        isBotBusy = !!busy;
        window.hatgptBotBusy = isBotBusy;
        sendBtn?.classList.toggle('is-busy', isBotBusy);
        promptInput?.classList.toggle('is-busy', isBotBusy);
        sendBtn.title = isBotBusy ? 'Waiting for the AI response' : '';
        updateButtonState();
    };

    // Send Logic
    const handleSend = async () => {
        if (isBotBusy) return;
        
        const userText = promptInput.value.trim();
        const currentSnippet = selectionSnippet; // Capture logic
        
        // This is what the AI sees
        let textForAI = userText;
        if (currentSnippet) {
            textForAI = `${QUOTE_SYSTEM_PREFIX}"${currentSnippet}"\n\nUser: ${userText}`;
        }
        
        if (!textForAI) return;

        setBotBusy(true);

        const chat = ensureCurrentChat();

        autoScroll = true;

        // Reset Input state
        promptInput.value = '';
        promptInput.style.height = 'auto'; 
        updateButtonState();
        hideSelectionPreview();

        // Switch UI to chat mode
        document.body.classList.add('chat-mode');

        // 1. Add User Message
        // Pass currentSnippet as the 4th argument (quote) so it renders above the bubble
        addMessage('user', userText, false, currentSnippet);

        chatHistoryState.push({ 
            type: 'message', 
            role: 'user', 
            content: [{ type: 'input_text', text: textForAI }] 
        });

        saveCurrentChat();
        if (chat) {
            generateTitleForChat(chat.id, textForAI);
        }

        // 2. Add AI Loading Placeholder
        const aiUi = addMessage('ai', '', true);

        // 3. API Call
        try {
            await fetchAIResponse(aiUi);
        } finally {
            setBotBusy(false);
            updateButtonState();
        }
    };

    // Event Listeners
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if (isBotBusy) return;
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
    function addMessage(role, text, isLoading = false, quote = null) {
        const row = document.createElement('div');
        row.className = `message-row ${role}-message-row`;
        
        if (quote) {
            const quoteEl = document.createElement('div');
            quoteEl.className = 'message-quote';
            quoteEl.innerHTML = `<i class="fa-solid fa-reply fa-flip-horizontal"></i> <span class="quote-text">${quote}</span>`; // No extra quotes if user requested removal, or maybe user meant input preview quotes removal?
            // "screenshot 2" shows input preview removal.
            // Screenshot 1 implies truncated text after arrow.
            row.appendChild(quoteEl);
        }

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role}-message`;
        if (role === 'ai') bubble.classList.add('markdown-content');
        
        if (role === 'ai') {
            if (isLoading) {
                bubble.innerHTML = `
                    <div class="typing-indicator">
                        <div class="typing-dot-single"></div>
                    </div>`;
            } else {
                bubble.innerHTML = renderMarkdown(text);
            }
        } else {
            bubble.textContent = text;
        }

        row.appendChild(bubble);
        chatHistory.appendChild(row);

        requestAnimationFrame(() => {
            if (autoScroll) {
                const offset = role === 'user' ? PREVIOUS_LINE_OFFSET : 0;
                scrollToBottomWithOffset(offset);
            }
            updateScrollButton();
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

    async function fetchAIResponse(uiElements) {
        const { bubble, row } = uiElements;
        const lastUserMsg = chatHistoryState[chatHistoryState.length - 1];
        const prompt = lastUserMsg.content[0].text;
        
        const apiKey = localStorage.getItem('apiKey');
        let model = 'openai/gpt-4o'; // Fallback
        
        // Determine model
        if (window.currentModel) {
            model = window.currentModel;
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
                body: JSON.stringify({ apiKey, model, messages: chatHistoryState })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                bubble.textContent = `Error: ${err.error || response.statusText}`;
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let messageId = null;
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
                            if (data.id) {
                                messageId = data.id;
                            }
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
                if (autoScroll) {
                    scrollToBottomWithOffset();
                }
            }

            // Cleanup
            if (firstChunk) {
                bubble.textContent = "No response from AI.";
            } else {
                chatHistoryState.push({
                   type: 'message',
                   role: 'assistant',
                   id: messageId || `msg_${Date.now()}`,
                   status: 'completed',
                   content: [{ type: 'output_text', text: fullText, annotations: [] }]
                });
                saveCurrentChat();
            }

            if (!autoScroll) {
                updateScrollButton();
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

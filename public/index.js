document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.querySelector('.send-btn');

    // Autofocus on load
    promptInput.focus();

    // Check service status
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            if (data.status !== 'up') {
                document.getElementById('service-status-modal').style.display = 'flex';
            }
        })
        .catch(error => {
            console.error('Error checking service status:', error);
            document.getElementById('service-status-modal').style.display = 'flex';
        });

    // Type to focus functionality
    document.addEventListener('keydown', (e) => {
        // Ignore if focus is already on an input, textarea, or contenteditable
        const activeTag = document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable) {
            return;
        }

        // Ignore special keys and modifiers
        if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) {
            return;
        }

        // Focus the input
        promptInput.focus();
    });

    // Initial state
    sendBtn.disabled = true;

    const updateButtonState = () => {
        if (promptInput.value.trim()) {
            sendBtn.disabled = false;
        } else {
            sendBtn.disabled = true;
        }
    };

    const adjustHeight = () => {
        promptInput.style.height = 'auto';
        
        const computedStyle = window.getComputedStyle(promptInput);
        const lineHeight = parseInt(computedStyle.lineHeight);
        // Fallback if lineHeight is 'normal' or NaN, though we set 1.5 in CSS
        const validLineHeight = isNaN(lineHeight) ? 24 : lineHeight;
        
        const maxHeight = validLineHeight * 4;
        
        if (promptInput.scrollHeight > maxHeight) {
            promptInput.style.overflowY = 'auto';
            promptInput.style.height = `${maxHeight}px`;
        } else {
            promptInput.style.overflowY = 'hidden';
            promptInput.style.height = `${promptInput.scrollHeight}px`;
        }
    };

    promptInput.addEventListener('input', () => {
        updateButtonState();
        adjustHeight();
    });
    
    // Keydown handler moved to aichat.js to centralize chat logic
    /*
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const query = promptInput.value;
            if (query.trim()) {
                console.log('User asked:', query);
                // Here we would trigger the search/chat
                promptInput.value = '';
                updateButtonState();
                adjustHeight();
            }
        }
    });
    */
});

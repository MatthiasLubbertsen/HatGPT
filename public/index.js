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

    promptInput.addEventListener('input', updateButtonState);
    
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = promptInput.value;
            if (query.trim()) {
                console.log('User asked:', query);
                // Here we would trigger the search/chat
                promptInput.value = '';
                updateButtonState();
            }
        }
    });
});

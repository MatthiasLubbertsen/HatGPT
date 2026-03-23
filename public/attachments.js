document.addEventListener('DOMContentLoaded', () => {
    const attachBtn = document.querySelector('.attach-btn');
    const chatInputContainer = document.querySelector('.chat-input-container');
    const sendBtn = document.querySelector('.send-btn');
    const sendArea = document.querySelector('.input-right-controls');

    if (!attachBtn || !chatInputContainer) return;

    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';

    document.body.appendChild(imageInput);
    document.body.appendChild(fileInput);

    let modal = null;
    let modalVisible = false;
    let previewEl = null;
    let popoverEl = null;
    let popoverTimeout = null;

    let state = {
        status: 'idle', // idle | uploading | ready | error
        name: '',
        size: 0,
        mimeType: '',
        kind: '', // image | pdf | text
        url: '',
        textContent: '',
        previewUrl: '',
        error: ''
    };

    let currentModelId = window.currentModel || localStorage.getItem('selected_model') || null;

    const formatSize = (size) => {
        if (!size) return '';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    const clearPopover = () => {
        if (popoverTimeout) {
            clearTimeout(popoverTimeout);
            popoverTimeout = null;
        }
        if (popoverEl) {
            popoverEl.remove();
            popoverEl = null;
        }
    };

    const showPopover = (message) => {
        clearPopover();
        if (!sendBtn) return;
        popoverEl = document.createElement('div');
        popoverEl.className = 'send-blocked-popover';
        popoverEl.textContent = message;
        document.body.appendChild(popoverEl);

        const rect = sendBtn.getBoundingClientRect();
        popoverEl.style.left = `${rect.left - 120}px`;
        popoverEl.style.top = `${rect.top - 10}px`;

        popoverTimeout = setTimeout(clearPopover, 2800);
    };

    const modelSupportsAttachments = () => {
        const models = window.hatAvailableModels || window.availableModels || [];
        const targetId = window.currentModel || currentModelId;
        const model = models.find(m => m.id === targetId);
        if (!model) return false;
        const modalities = model.modalities || model.capabilities || model.supported_modalities || model.supports;
        if (Array.isArray(modalities)) {
            const lowered = modalities.map(m => String(m).toLowerCase());
            if (lowered.includes('image') || lowered.includes('images') || lowered.includes('vision') || lowered.includes('multimodal')) {
                return true;
            }
        }
        if (typeof model.description === 'string' && /vision|image/i.test(model.description)) {
            return true;
        }
        return false;
    };

    const currentBlockReason = () => {
        if (state.status === 'uploading') return 'uploading';
        // Only images require a vision-capable model; PDFs and text files work with any model
        if (state.kind === 'image' && state.url && !modelSupportsAttachments()) return 'unsupported-model';
        if (state.status === 'error') return 'error';
        return '';
    };

    const broadcastState = () => {
        const blockReason = currentBlockReason();
        const snapshot = { ...state, blockReason, blocked: !!blockReason };
        window.hatAttachmentState = snapshot;
        window.getHatAttachmentState = () => ({ ...snapshot });
        window.clearHatAttachment = clearAttachment;
        window.dispatchEvent(new CustomEvent('hat-attachment-changed', { detail: snapshot }));

        if (sendBtn) {
            if (blockReason === 'unsupported-model') {
                sendBtn.title = 'This model cannot accept images. Pick a vision model.';
            } else if (blockReason === 'uploading') {
                sendBtn.title = 'Wait for the upload to finish.';
            } else if (blockReason === 'error') {
                sendBtn.title = state.error || 'Upload failed. Try again.';
            } else {
                sendBtn.title = '';
            }
        }
    };

    const clearAttachment = () => {
        if (state.previewUrl) {
            try { URL.revokeObjectURL(state.previewUrl); } catch (_) { /* noop */ }
        }
        state = {
            status: 'idle',
            name: '',
            size: 0,
            mimeType: '',
            kind: '',
            url: '',
            textContent: '',
            previewUrl: '',
            error: ''
        };
        if (previewEl) {
            previewEl.remove();
            previewEl = null;
        }
        broadcastState();
    };

    const ensurePreview = () => {
        if (previewEl) return previewEl;
        const el = document.createElement('div');
        el.className = 'attachment-preview';

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'attachment-thumb-wrap';
        el.appendChild(thumbWrap);

        const visual = document.createElement('div');
        visual.className = 'attachment-visual';
        thumbWrap.appendChild(visual);

        const overlay = document.createElement('div');
        overlay.className = 'attachment-overlay';
        overlay.innerHTML = '<div class="attachment-spinner"></div>';
        thumbWrap.appendChild(overlay);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'attachment-remove';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.title = 'Remove file';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clearAttachment();
        });
        thumbWrap.appendChild(removeBtn);

        chatInputContainer.insertBefore(el, chatInputContainer.firstChild);
        previewEl = el;
        return el;
    };

    const renderPreview = () => {
        if (!state.name) {
            if (previewEl) previewEl.remove();
            previewEl = null;
            return;
        }

        const el = ensurePreview();
        const visual = el.querySelector('.attachment-visual');
        const overlay = el.querySelector('.attachment-overlay');

        visual.innerHTML = '';
        if (state.kind === 'image' && state.previewUrl) {
            const img = document.createElement('img');
            img.src = state.previewUrl;
            img.alt = state.name;
            visual.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.className = 'attachment-icon';
            if (state.kind === 'pdf') {
                icon.innerHTML = '<i class="fa-regular fa-file-pdf"></i>';
            } else {
                icon.innerHTML = '<i class="fa-regular fa-file-code"></i>';
            }
            visual.appendChild(icon);
        }

        el.classList.toggle('uploading', state.status === 'uploading');
        overlay.classList.toggle('visible', state.status === 'uploading');
        el.classList.toggle('error', state.status === 'error');
    };

    const uploadToBucky = async (file) => {
        state.status = 'uploading';
        broadcastState();
        renderPreview();

        try {
            const form = new FormData();
            form.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: form
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Upload failed');
            }

            const url = data.url || data?.[0]?.url || data.raw;
            if (!url) {
                throw new Error('Upload succeeded but no URL returned');
            }

            state.url = url;
            state.status = 'ready';
            state.error = '';
        } catch (err) {
            state.status = 'error';
            state.error = err?.message || 'Upload failed';
            console.error('Upload error:', err);
        }

        broadcastState();
        renderPreview();
    };

    const getFileKind = (file, intent) => {
        if (intent === 'photo' || file.type?.startsWith('image/')) return 'image';
        if (file.type === 'application/pdf') return 'pdf';
        return 'text';
    };

    const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });

    const startUpload = async (file, intent) => {
        if (!file) return;
        clearAttachment();
        const kind = getFileKind(file, intent);
        state = {
            status: 'uploading',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            kind,
            url: '',
            textContent: '',
            previewUrl: kind === 'image' ? URL.createObjectURL(file) : '',
            error: ''
        };
        broadcastState();
        renderPreview();

        if (kind === 'image' || kind === 'pdf') {
            await uploadToBucky(file);
        } else {
            // Read file as plain text locally — no upload needed
            try {
                const text = await readFileAsText(file);
                state.textContent = text;
                state.status = 'ready';
                state.error = '';
            } catch (err) {
                state.status = 'error';
                state.error = err?.message || 'Failed to read file';
                console.error('File read error:', err);
            }
            broadcastState();
            renderPreview();
        }
    };

    const ensureModal = () => {
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'attach-modal';

        const photo = document.createElement('button');
        photo.className = 'attach-option';
        photo.innerHTML = '<i class="fa-regular fa-image"></i><span>Upload a photo</span>';
        photo.addEventListener('click', () => {
            modalVisible = false;
            modal.classList.remove('visible');
            imageInput.click();
        });

        const file = document.createElement('button');
        file.className = 'attach-option';
        file.innerHTML = '<i class="fa-regular fa-file"></i><span>Upload a file</span>';
        file.addEventListener('click', () => {
            modalVisible = false;
            modal.classList.remove('visible');
            fileInput.click();
        });

        modal.appendChild(photo);
        modal.appendChild(file);
        document.body.appendChild(modal);
        return modal;
    };

    const positionModal = () => {
        const target = attachBtn.getBoundingClientRect();
        const el = ensureModal();
        el.style.left = `${target.left}px`;
        el.style.top = `${target.top + target.height + 8}px`;
    };

    const toggleModal = () => {
        const el = ensureModal();
        modalVisible = !modalVisible;
        if (modalVisible) {
            positionModal();
            el.classList.add('visible');
        } else {
            el.classList.remove('visible');
        }
    };

    attachBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleModal();
    });

    document.addEventListener('click', (e) => {
        if (!modalVisible || !modal) return;
        if (modal.contains(e.target) || attachBtn.contains(e.target)) return;
        modalVisible = false;
        modal.classList.remove('visible');
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        imageInput.value = '';
        if (file) startUpload(file, 'photo');
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        fileInput.value = '';
        if (file) startUpload(file, 'file');
    });

    if (sendArea) {
        sendArea.addEventListener('click', (e) => {
            const snapshot = window.getHatAttachmentState ? window.getHatAttachmentState() : null;
            if (snapshot?.blockReason === 'unsupported-model') {
                e.preventDefault();
                e.stopPropagation();
                showPopover('Switch to a vision model to send this image.');
            } else if (snapshot?.blockReason === 'uploading') {
                e.preventDefault();
                e.stopPropagation();
                showPopover('Upload is still in progress.');
            }
        }, true);

        sendArea.addEventListener('mouseenter', () => {
            const snapshot = window.getHatAttachmentState ? window.getHatAttachmentState() : null;
            if (snapshot?.blockReason === 'unsupported-model' && !popoverEl) {
                showPopover('Switch to a vision model to send this image.');
            }
        });
    }

    window.addEventListener('hat-model-changed', (e) => {
        currentModelId = e.detail?.modelId || currentModelId;
        broadcastState();
    });

    window.addEventListener('hat-models-loaded', () => {
        broadcastState();
    });

    broadcastState();
});

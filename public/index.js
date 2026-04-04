document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.querySelector('.send-btn');
    const userStatus = document.querySelector('.user-status');
    const userNameEl = document.getElementById('userNameDisplay');
    const avatarEl = document.getElementById('userAvatar');
    const avatarWarning = document.getElementById('avatarWarning');
    const gravatarToggle = document.getElementById('useGravatarInput');

    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('openSettings');
    const closeSettingsBtn = document.getElementById('settingsClose');
    const cancelSettingsBtn = document.getElementById('settingsCancel');
    const settingsForm = document.getElementById('settingsForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const nameInput = document.getElementById('userNameInput');
    const avatarInput = document.getElementById('avatarInput');
    const avatarLabelText = document.getElementById('avatarLabelText');
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const MOBILE_BREAKPOINT = 768;
    let sidebarResizeDebounceTimeout;

    const isBotBusy = () => Boolean(window.hatgptBotBusy);
    const getAttachmentState = () => (typeof window.getHatAttachmentState === 'function'
        ? window.getHatAttachmentState()
        : null);

    let pendingAvatarUrl = localStorage.getItem('avatarUrl') || '';
    let pendingGravatarEmail = localStorage.getItem('gravatarEmail') || '';

    const loadProfile = () => ({
        apiKey: localStorage.getItem('apiKey') || '',
        name: localStorage.getItem('userName') || 'User',
        avatar: localStorage.getItem('avatarUrl') || '',
        useGravatar: localStorage.getItem('useGravatar') === 'true',
        gravatarEmail: localStorage.getItem('gravatarEmail') || ''
    });

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

    const isValidUrl = (value) => {
        if (!value) return false;
        try {
            const u = new URL(value);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (e) {
            return false;
        }
    };

    const uiAvatarSrc = (name) => {
        const safeName = encodeURIComponent(name || 'User');
        return `https://ui-avatars.com/api/?name=${safeName}&background=random&color=fff`;
    };

    const showAvatarWarning = (show) => {
        if (avatarWarning) {
            avatarWarning.classList.toggle('visible', !!show);
        }
    };

    const checkImageLoad = (url) => new Promise((resolve) => {
        if (!url) return resolve(false);
        const img = new Image();
        const timer = setTimeout(() => {
            img.src = '';
            resolve(false);
        }, 6000);
        img.onload = () => {
            clearTimeout(timer);
            resolve(true);
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };
        img.src = url;
    });

    const isValidDataImage = (value) => {
        if (!value || typeof value !== 'string') return false;
        if (!value.startsWith('data:image/')) return false;
        const commaIndex = value.indexOf(',');
        if (commaIndex === -1) return false;
        const base64Part = value.slice(commaIndex + 1);
        try {
            atob(base64Part);
            return true;
        } catch (e) {
            return false;
        }
    };

    const fetchGravatarUrl = async (email) => {
        if (!isValidEmail(email)) return '';
        try {
            const response = await fetch(`/api/pfp?email=${encodeURIComponent(email.trim())}`);
            if (!response.ok) return '';
            const data = await response.json();
            return typeof data?.url === 'string' ? data.url.trim() : '';
        } catch (e) {
            return '';
        }
    };

    const resolveAndApplyAvatar = async (profile) => {
        const name = profile.name || 'User';
        const fallback = uiAvatarSrc(name);
        const candidates = [];

        if (profile.useGravatar && isValidEmail(profile.gravatarEmail)) {
            const gravatarUrl = await fetchGravatarUrl(profile.gravatarEmail);
            if (gravatarUrl) {
                candidates.push(gravatarUrl);
            } else {
                showAvatarWarning(true);
            }
        } else if (profile.useGravatar && profile.gravatarEmail) {
            showAvatarWarning(true);
        }

        if (!profile.useGravatar && isValidDataImage(profile.avatar)) {
            candidates.push(profile.avatar.trim());
        } else if (!profile.useGravatar && isValidUrl(profile.avatar)) {
            candidates.push(profile.avatar.trim());
        } else if (!profile.useGravatar && profile.avatar) {
            showAvatarWarning(true);
        }

        candidates.push(fallback);

        let applied = false;
        for (const url of candidates) {
            const ok = await checkImageLoad(url);
            if (ok) {
                if (avatarEl) avatarEl.src = url;
                showAvatarWarning(url === fallback);
                applied = true;
                break;
            }
        }

        if (!applied && avatarEl) {
            avatarEl.src = fallback;
            showAvatarWarning(true);
        }
    };

    const applyProfile = async () => {
        const profile = loadProfile();
        if (userStatus) {
            userStatus.textContent = profile.apiKey ? 'API Key set' : 'No key set, limited';
            userStatus.style.color = profile.apiKey ? '' : '#ff6b6b';
        }
        if (userNameEl) userNameEl.textContent = profile.name || 'User';
        resolveAndApplyAvatar(profile);
        return profile;
    };

    const applyAvatarInputMode = (useGravatarChecked) => {
        if (!avatarInput) return;
        avatarInput.placeholder = useGravatarChecked
            ? 'you@example.com (Gravatar email)'
            : 'https://example.com/avatar.png';
        if (avatarLabelText) {
            avatarLabelText.textContent = useGravatarChecked
                ? 'Gravatar email'
                : 'Profile picture URL';
        }
        const profile = loadProfile();
        const value = useGravatarChecked
            ? (pendingGravatarEmail || profile.gravatarEmail || '')
            : (pendingAvatarUrl || profile.avatar || '');
        avatarInput.value = value;
    };

    const openSettings = () => {
        const profile = loadProfile();
        if (nameInput) nameInput.value = profile.name || '';
        if (avatarInput) avatarInput.value = profile.useGravatar ? (profile.gravatarEmail || '') : (profile.avatar || '');
        if (gravatarToggle) gravatarToggle.checked = !!profile.useGravatar;
        if (apiKeyInput) apiKeyInput.value = profile.apiKey || '';
        applyAvatarInputMode(profile.useGravatar);
        if (settingsModal) {
            settingsModal.style.display = 'flex';
        }
        if (nameInput) nameInput.focus();
    };

    const closeSettings = () => {
        if (settingsModal) settingsModal.style.display = 'none';
    };

    // Expose for any legacy calls
    window.configureApiKey = openSettings;

    openSettingsBtn?.addEventListener('click', openSettings);
    closeSettingsBtn?.addEventListener('click', closeSettings);
    cancelSettingsBtn?.addEventListener('click', closeSettings);
    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });

    gravatarToggle?.addEventListener('change', () => {
        if (gravatarToggle.checked) {
            pendingAvatarUrl = avatarInput?.value.trim() || pendingAvatarUrl;
        } else {
            pendingGravatarEmail = avatarInput?.value.trim() || pendingGravatarEmail;
        }
        applyAvatarInputMode(gravatarToggle.checked);
    });

    settingsForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameValue = nameInput?.value.trim() || 'User';
        const apiKeyValue = apiKeyInput?.value.trim();
        const useGravatarValue = gravatarToggle?.checked || false;
        const currentFieldValue = avatarInput?.value.trim() || '';

        let avatarValue = currentFieldValue;
        let gravatarEmailValue = '';

        if (useGravatarValue) {
            gravatarEmailValue = currentFieldValue;
            pendingGravatarEmail = gravatarEmailValue;
            avatarValue = pendingAvatarUrl || localStorage.getItem('avatarUrl') || '';
        } else {
            pendingAvatarUrl = currentFieldValue;
            gravatarEmailValue = pendingGravatarEmail || localStorage.getItem('gravatarEmail') || '';
        }

        localStorage.setItem('userName', nameValue);
        if (avatarValue) {
            localStorage.setItem('avatarUrl', avatarValue);
        } else {
            localStorage.removeItem('avatarUrl');
        }
        localStorage.setItem('useGravatar', useGravatarValue ? 'true' : 'false');
        if (useGravatarValue && gravatarEmailValue) {
            localStorage.setItem('gravatarEmail', gravatarEmailValue);
        } else {
            localStorage.removeItem('gravatarEmail');
        }
        if (apiKeyValue) {
            localStorage.setItem('apiKey', apiKeyValue);
        } else {
            localStorage.removeItem('apiKey');
        }

        applyProfile();
        closeSettings();
        promptInput?.focus();
    });

    applyProfile();

    // Autofocus on load
    promptInput?.focus();

    const closeMobileSidebar = () => {
        document.body.classList.remove('sidebar-open');
        document.body.setAttribute('aria-expanded', 'false');
        if (mobileSidebarToggle) {
            mobileSidebarToggle.setAttribute('aria-expanded', 'false');
        }
    };

    const toggleMobileSidebar = () => {
        document.body.classList.toggle('sidebar-open');
        document.body.setAttribute(
            'aria-expanded',
            document.body.classList.contains('sidebar-open') ? 'true' : 'false'
        );
        if (mobileSidebarToggle) {
            mobileSidebarToggle.setAttribute(
                'aria-expanded',
                document.body.classList.contains('sidebar-open') ? 'true' : 'false'
            );
        }
    };

    mobileSidebarToggle?.addEventListener('click', toggleMobileSidebar);

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (window.innerWidth > MOBILE_BREAKPOINT) return;
        if (target.closest('.sidebar') || target.closest('#mobileSidebarToggle')) return;
        if (document.body.classList.contains('sidebar-open')) {
            closeMobileSidebar();
        }
    });

    window.addEventListener('resize', () => {
        clearTimeout(sidebarResizeDebounceTimeout);
        sidebarResizeDebounceTimeout = setTimeout(() => {
            if (window.innerWidth > MOBILE_BREAKPOINT) {
                closeMobileSidebar();
            }
        }, 120);
    });

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
        const activeTag = document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable) {
            return;
        }

        if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) {
            return;
        }

        promptInput?.focus();
    });

    if (!sendBtn || !promptInput) return;

    // Initial state
    sendBtn.disabled = true;

    const updateButtonState = () => {
        const attachment = getAttachmentState();
        const hasAttachment = !!(attachment && (attachment.status === 'uploading' || attachment.url));
        const blocked = !!(attachment && attachment.blockReason);
        const shouldDisable = isBotBusy() || blocked || (!promptInput.value.trim() && !hasAttachment);
        sendBtn.disabled = shouldDisable;
        sendBtn.classList.toggle('is-busy', isBotBusy());
    };

    const adjustHeight = () => {
        promptInput.style.height = 'auto';

        const computedStyle = window.getComputedStyle(promptInput);
        const lineHeight = parseInt(computedStyle.lineHeight, 10);
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

    window.addEventListener('hat-attachment-changed', updateButtonState);
});

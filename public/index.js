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

    const isBotBusy = () => Boolean(window.hatgptBotBusy);

    let pendingAvatarUrl = localStorage.getItem('avatarUrl') || '';
    let pendingGravatarEmail = localStorage.getItem('gravatarEmail') || '';

    const loadProfile = () => ({
        apiKey: localStorage.getItem('apiKey') || '',
        name: localStorage.getItem('userName') || 'User',
        avatar: localStorage.getItem('avatarUrl') || '',
        useGravatar: localStorage.getItem('useGravatar') === 'true',
        gravatarEmail: localStorage.getItem('gravatarEmail') || ''
    });

    // Lightweight MD5 for Gravatar hashing
    const md5 = (str = '') => {
        const safe = str || '';
        const utf8 = unescape(encodeURIComponent(safe));
        const x = [];
        for (let i = 0; i < utf8.length; i += 1) {
            x[i >> 2] |= utf8.charCodeAt(i) << ((i % 4) * 8);
        }
        x[utf8.length >> 2] |= 0x80 << ((utf8.length % 4) * 8);
        x[(((utf8.length + 8) >> 6) * 16) + 14] = utf8.length * 8;

        const add = (a, b) => {
            const lsw = (a & 0xffff) + (b & 0xffff);
            const msw = (a >> 16) + (b >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xffff);
        };

        const rol = (num, cnt) => ((num << cnt) | (num >>> (32 - cnt)));

        const cmn = (q, a, b, xk, s, t) => add(rol(add(add(a, q), add(xk, t)), s), b);
        const ff = (a, b, c, d, xk, s, t) => cmn((b & c) | (~b & d), a, b, xk, s, t);
        const gg = (a, b, c, d, xk, s, t) => cmn((b & d) | (c & ~d), a, b, xk, s, t);
        const hh = (a, b, c, d, xk, s, t) => cmn(b ^ c ^ d, a, b, xk, s, t);
        const ii = (a, b, c, d, xk, s, t) => cmn(c ^ (b | ~d), a, b, xk, s, t);

        let a = 1732584193;
        let b = -271733879;
        let c = -1732584194;
        let d = 271733878;

        for (let i = 0; i < x.length; i += 16) {
            const [olda, oldb, oldc, oldd] = [a, b, c, d];

            a = ff(a, b, c, d, x[i + 0], 7, -680876936);
            d = ff(d, a, b, c, x[i + 1], 12, -389564586);
            c = ff(c, d, a, b, x[i + 2], 17, 606105819);
            b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
            a = ff(a, b, c, d, x[i + 4], 7, -176418897);
            d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
            c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
            b = ff(b, c, d, a, x[i + 7], 22, -45705983);
            a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
            d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
            c = ff(c, d, a, b, x[i + 10], 17, -42063);
            b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
            d = ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = ff(b, c, d, a, x[i + 15], 22, 1236535329);

            a = gg(a, b, c, d, x[i + 1], 5, -165796510);
            d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
            c = gg(c, d, a, b, x[i + 11], 14, 643717713);
            b = gg(b, c, d, a, x[i + 0], 20, -373897302);
            a = gg(a, b, c, d, x[i + 5], 5, -701558691);
            d = gg(d, a, b, c, x[i + 10], 9, 38016083);
            c = gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = gg(b, c, d, a, x[i + 4], 20, -405537848);
            a = gg(a, b, c, d, x[i + 9], 5, 568446438);
            d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
            c = gg(c, d, a, b, x[i + 3], 14, -187363961);
            b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
            a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
            d = gg(d, a, b, c, x[i + 2], 9, -51403784);
            c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
            b = gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = hh(a, b, c, d, x[i + 5], 4, -378558);
            d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
            c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
            b = hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
            d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
            c = hh(c, d, a, b, x[i + 7], 16, -155497632);
            b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = hh(a, b, c, d, x[i + 13], 4, 681279174);
            d = hh(d, a, b, c, x[i + 0], 11, -358537222);
            c = hh(c, d, a, b, x[i + 3], 16, -722521979);
            b = hh(b, c, d, a, x[i + 6], 23, 76029189);
            a = hh(a, b, c, d, x[i + 9], 4, -640364487);
            d = hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = hh(c, d, a, b, x[i + 15], 16, 530742520);
            b = hh(b, c, d, a, x[i + 2], 23, -995338651);

            a = ii(a, b, c, d, x[i + 0], 6, -198630844);
            d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
            c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = ii(b, c, d, a, x[i + 5], 21, -57434055);
            a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
            d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
            c = ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
            a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
            d = ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
            b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
            a = ii(a, b, c, d, x[i + 4], 6, -145523070);
            d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = ii(c, d, a, b, x[i + 2], 15, 718787259);
            b = ii(b, c, d, a, x[i + 9], 21, -343485551);

            a = add(a, olda);
            b = add(b, oldb);
            c = add(c, oldc);
            d = add(d, oldd);
        }

        const toHex = (num) => {
            let s = '';
            for (let j = 0; j <= 3; j += 1) {
                s += `0${((num >> (j * 8 + 4)) & 0x0f).toString(16)}`.slice(-1) +
                     `0${((num >> (j * 8)) & 0x0f).toString(16)}`.slice(-1);
            }
            return s;
        };

        return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
    };

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

    const resolveAndApplyAvatar = async (profile) => {
        const name = profile.name || 'User';
        const fallback = uiAvatarSrc(name);
        const candidates = [];

        if (profile.useGravatar && isValidEmail(profile.gravatarEmail)) {
            const hash = md5(profile.gravatarEmail.trim().toLowerCase());
            candidates.push(`https://www.gravatar.com/avatar/${hash}?s=128&d=404`);
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
            userStatus.textContent = profile.apiKey ? 'API Key set' : 'API Key missing';
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
        sendBtn.disabled = isBotBusy() || !promptInput.value.trim();
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
});

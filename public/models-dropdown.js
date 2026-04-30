
let availableModels = [];
window.currentModel = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/models');
        const json = await response.json();
        availableModels = json.data;
        window.hatAvailableModels = availableModels;
        window.availableModels = availableModels;
        window.dispatchEvent(new CustomEvent('hat-models-loaded', { detail: { models: availableModels } }));
        initModelDropdown();
    } catch (error) {
        console.error('Failed to load models:', error);
    }
});

function initModelDropdown() {
    const dropdown = document.querySelector('.model-dropdown');
    
    // Create dropdown menu container
    const menu = document.createElement('div');
    menu.className = 'model-options-menu';
    menu.style.display = 'none'; // hidden by default
    
    // Group models by provider
    const modelsByProvider = {};
    availableModels.forEach(model => {
        // Extract provider.
        let provider = 'Other';
        let friendlyName = model.name;
        
        if (model.name.includes(':')) {
           const parts = model.name.split(':');
           provider = parts[0].trim();
           friendlyName = parts.slice(1).join(':').trim();
        } else if (model.id.includes('/')) {
            const parts = model.id.split('/');
            provider = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }

        if (!modelsByProvider[provider]) {
            modelsByProvider[provider] = [];
        }
        modelsByProvider[provider].push({
            ...model,
            friendlyName: friendlyName
        });
    });

    // We need a shared timeout tracker to prevent overlapping submenus.
    let activeLeaveTimeout;

    // Generate HTML
    Object.keys(modelsByProvider).sort().forEach(provider => {
        // Skip provider groups that start with a tilde (~)
        if (provider && provider.charAt(0) === '~') return;
        const providerItem = document.createElement('div');
        providerItem.className = 'provider-item';
        providerItem.textContent = provider;
        
        const submenu = document.createElement('div');
        submenu.className = 'provider-submenu';
        submenu.style.display = 'none';
        
        modelsByProvider[provider].forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            modelItem.textContent = model.friendlyName;
            modelItem.addEventListener('click', (e) => {
                e.stopPropagation();
                selectModel(model, model.friendlyName);
                menu.style.display = 'none'; // Close main menu
                submenu.style.display = 'none'; // Close child submenu
                providerItem.classList.remove('active'); // Remove active state
                dropdown.classList.remove('active');
            });
            submenu.appendChild(modelItem);
        });

        // Append provider item to menu, but append the submenu outside
        // the scrollable menu so it isn't clipped. We'll append submenu
        // to the dropdown container and position it to align with the
        // provider item.
        menu.appendChild(providerItem);
        dropdown.appendChild(submenu);
        // Position submenu to vertically align with providerItem
        // We'll set left relative to the menu width so it appears to the right.
        const alignSubmenu = () => {
            // Position submenu relative to the dropdown container so it
            // aligns vertically with the provider item inside the scrollable menu.
            // Account for menu scroll position since providerItem.offsetTop is relative to the scrollable content.
            const top = (menu.offsetTop || 0) + providerItem.offsetTop - menu.scrollTop;
            const left = (menu.offsetLeft || 0) + menu.offsetWidth + 8;
            submenu.style.top = top + 'px';
            submenu.style.left = left + 'px';
        };
        // Initial align and on window resize, and menu scroll
        alignSubmenu();
        window.addEventListener('resize', alignSubmenu);
        menu.addEventListener('scroll', () => {
            if (submenu.style.display === 'block') {
                alignSubmenu();
            }
        });

        // Handle hover for submenu
        providerItem.addEventListener('mouseenter', () => {
             // 1. Cancel any pending close from *previous* provider
             if (activeLeaveTimeout) {
                clearTimeout(activeLeaveTimeout);
                activeLeaveTimeout = null;
             }
             
             // 2. Immediately close all *other* submenus to prevent stacking
             document.querySelectorAll('.provider-submenu').forEach(sub => {
                 if (sub !== submenu) {
                     sub.style.display = 'none';
                     // remove active class from corresponding provider if present
                     const maybeProvider = sub.__providerItemRef;
                     if (maybeProvider && maybeProvider.classList) maybeProvider.classList.remove('active');
                 }
             });

             // 3. Show current submenu (it's outside the scroll container)
             alignSubmenu();
             submenu.style.display = 'block';
             providerItem.classList.add('active');
        });

        providerItem.addEventListener('mouseleave', () => {
            // When leaving the item, start a grace period.
            // If user enters another provider, that provider's mouseenter will cancel this.
            // If user enters the gap -> submenu, submenu mouseenter will cancel this.
            activeLeaveTimeout = setTimeout(() => {
                submenu.style.display = 'none';
                providerItem.classList.remove('active');
            }, 200);
        });

        // Add listeners to submenu to keep it open when hovering effectively
        submenu.addEventListener('mouseenter', () => {
            if (activeLeaveTimeout) {
                clearTimeout(activeLeaveTimeout);
                activeLeaveTimeout = null;
            }
             alignSubmenu();
             submenu.style.display = 'block';
             providerItem.classList.add('active');
        });

        submenu.addEventListener('mouseleave', () => {
             activeLeaveTimeout = setTimeout(() => {
                submenu.style.display = 'none';
                providerItem.classList.remove('active');
            }, 200);
        });
        
        // keep a backreference so closing other submenus can remove provider active state
        submenu.__providerItemRef = providerItem;
    });
    
    dropdown.appendChild(menu);

    // Prevent scroll chaining / bounce on the main menu and submenus by
    // intercepting wheel events at their edges and stopping propagation.
    function preventBoundaryScroll(elem) {
        elem.addEventListener('wheel', (e) => {
            const delta = e.deltaY;
            const atTop = elem.scrollTop === 0;
            const atBottom = elem.scrollHeight - elem.clientHeight - elem.scrollTop <= 1;
            if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
    }

    preventBoundaryScroll(menu);
    document.querySelectorAll('.provider-submenu').forEach(s => preventBoundaryScroll(s));
    
    // Toggle main dropdown
    dropdown.addEventListener('click', (e) => {
        if (e.target.closest('.provider-submenu')) return; // Allow interaction within submenu
        
        // If clicking provider item (but not its submenu), ignore if it just triggers hover.
        // Actually, CSS hover logic is cleaner, but JS works too.
        // Let's just toggle visibility of main menu.
        if (menu.style.display === 'none') {
            menu.style.display = 'block';
            dropdown.classList.add('active');
        } else if (!e.target.closest('.model-options-menu')) {
            // Close if clicking the header while open
             menu.style.display = 'none';
             dropdown.classList.remove('active');
        }
    });

    // Auto close main dropdown on mouseleave
    let dropdownCloseTimeout;
    dropdown.addEventListener('mouseenter', () => {
        if (dropdownCloseTimeout) {
            clearTimeout(dropdownCloseTimeout);
            dropdownCloseTimeout = null;
        }
    });

    dropdown.addEventListener('mouseleave', () => {
        if (menu.style.display === 'block') {
            dropdownCloseTimeout = setTimeout(() => {
                menu.style.display = 'none';
                dropdown.classList.remove('active');
            }, 500); // 500ms auto close delay
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            menu.style.display = 'none';
            dropdown.classList.remove('active');
        }
    });

    // Local Storage & Initial Selection
    const savedModelId = localStorage.getItem('selected_model');
    let initialModel = null;
    let initialFriendlyName = '';

    if (savedModelId) {
        // Find saved model in grouping logic, or just search raw list
        const found = availableModels.find(m => m.id === savedModelId);
        if (found) {
             initialModel = found;
             // Re-derive friendly name simply
             if (found.name.includes(':')) {
                 initialFriendlyName = found.name.split(':').slice(1).join(':').trim();
             } else {
                 initialFriendlyName = found.name;
             }
        }
    }

    // Initialize with preferred default model for first-time users, then fallback to first available.
    if (!initialModel && availableModels.length > 0) {
        const preferredDefaultModelId = 'moonshotai/kimi-k2.5';
        const preferredModel = availableModels.find(m => m.id === preferredDefaultModelId);
        const firstModel = availableModels[0];

        initialModel = preferredModel || firstModel;
        initialFriendlyName = initialModel.name;
        if (initialFriendlyName.includes(':')) initialFriendlyName = initialFriendlyName.split(':').slice(1).join(':').trim();
    }

    if (initialModel) {
        selectModel(initialModel, initialFriendlyName);
    }
}

function selectModel(model, friendlyName) {
    window.currentModel = model.id;
    localStorage.setItem('selected_model', model.id);
    window.dispatchEvent(new CustomEvent('hat-model-changed', { detail: { modelId: model.id } }));
    const modelNameSpan = document.querySelector('.model-name');
    
    let displayText = friendlyName;
    if (displayText.length > 15) {
        displayText = displayText.substring(0, 15) + '...';
    }
    modelNameSpan.textContent = displayText;
    modelNameSpan.title = friendlyName;
}

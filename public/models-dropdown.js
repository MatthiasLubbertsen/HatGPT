
let availableModels = [];
window.currentModel = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/models');
        const json = await response.json();
        availableModels = json.data;
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
                dropdown.classList.remove('active');
            });
            submenu.appendChild(modelItem);
        });
        
        providerItem.appendChild(submenu);
        
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
                     if (sub.parentElement && sub.parentElement.classList.contains('provider-item')) {
                         sub.parentElement.classList.remove('active');
                     }
                 }
             });

             // 3. Show current
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
             submenu.style.display = 'block';
             providerItem.classList.add('active');
        });

        submenu.addEventListener('mouseleave', () => {
             activeLeaveTimeout = setTimeout(() => {
                submenu.style.display = 'none';
                providerItem.classList.remove('active');
            }, 200);
        });
        
        menu.appendChild(providerItem);
    });
    
    dropdown.appendChild(menu);
    
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
    const savedModelId = localStorage.getItem('hatgpt_selected_model');
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

    // Initialize with first available if random placeholder is there, or keep placeholder
    if (!initialModel && availableModels.length > 0) {
        // Try to respect current if it makes sense or pick first
        const firstModel = availableModels[0];
        initialModel = firstModel;
        initialFriendlyName = firstModel.name;
        if (initialFriendlyName.includes(':')) initialFriendlyName = initialFriendlyName.split(':').slice(1).join(':').trim();
    }

    if (initialModel) {
        selectModel(initialModel, initialFriendlyName);
    }
}

function selectModel(model, friendlyName) {
    window.currentModel = model.id;
    localStorage.setItem('hatgpt_selected_model', model.id);
    const modelNameSpan = document.querySelector('.model-name');
    
    let displayText = friendlyName;
    if (displayText.length > 15) {
        displayText = displayText.substring(0, 15) + '...';
    }
    modelNameSpan.textContent = displayText;
    modelNameSpan.title = friendlyName;
}

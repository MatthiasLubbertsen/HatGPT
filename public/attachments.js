document.addEventListener('DOMContentLoaded', () => {
    const attachBtn = document.querySelector('.attach-btn');

    if (!attachBtn) return;

    let popoverEl = null;
    let popoverTimeout = null;

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

    const positionPopover = () => {
        if (!popoverEl) return;
        const rect = attachBtn.getBoundingClientRect();
        const popoverRect = popoverEl.getBoundingClientRect();
        const left = Math.max(12, rect.left + (rect.width / 2) - (popoverRect.width / 2));
        const top = Math.max(12, rect.top - popoverRect.height - 10);
        popoverEl.style.left = `${left}px`;
        popoverEl.style.top = `${top}px`;
    };

    const showPopover = () => {
        clearPopover();

        popoverEl = document.createElement('div');
        popoverEl.className = 'send-blocked-popover';
        popoverEl.textContent = 'To be implemented.';
        popoverEl.style.position = 'fixed';
        popoverEl.style.visibility = 'hidden';

        document.body.appendChild(popoverEl);

        requestAnimationFrame(() => {
            positionPopover();
            if (popoverEl) {
                popoverEl.style.visibility = 'visible';
            }
        });

        popoverTimeout = setTimeout(clearPopover, 2200);
    };

    attachBtn.setAttribute('aria-disabled', 'true');
    attachBtn.setAttribute('title', '');

    attachBtn.addEventListener('mouseenter', showPopover);
    attachBtn.addEventListener('mouseleave', clearPopover);
    attachBtn.addEventListener('focus', showPopover);
    attachBtn.addEventListener('blur', clearPopover);
    attachBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPopover();
    });

    window.addEventListener('scroll', clearPopover, true);
    window.addEventListener('resize', clearPopover);
});

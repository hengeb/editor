let currentMenu = null;

function onOutside(event) {
    if (currentMenu && !currentMenu.contains(event.target)) {
        closeContextMenu();
    }
}

function onKeydown(event) {
    if (event.key === 'Escape') {
        closeContextMenu();
    }
}

export function closeContextMenu() {
    if (!currentMenu) {
        return;
    }
    currentMenu.remove();
    currentMenu = null;
    document.removeEventListener('pointerdown', onOutside, { capture: true });
    document.removeEventListener('keydown', onKeydown);
}

/**
 * @param {{label: string, icon?: string, onSelect: () => void}[]} items
 */
export function showContextMenu(x, y, items) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'context-menu-item';

        if (item.icon) {
            const icon = document.createElement('span');
            icon.className = 'context-menu-icon';
            icon.innerHTML = item.icon;
            button.appendChild(icon);
        }

        const label = document.createElement('span');
        label.textContent = item.label;
        button.appendChild(label);

        button.addEventListener('click', () => {
            closeContextMenu();
            item.onSelect();
        });

        menu.appendChild(button);
    }

    document.body.appendChild(menu);
    currentMenu = menu;

    const rect = menu.getBoundingClientRect();
    const overflowX = rect.right - window.innerWidth;
    const overflowY = rect.bottom - window.innerHeight;
    if (overflowX > 0) {
        menu.style.left = `${Math.max(0, x - overflowX - 8)}px`;
    }
    if (overflowY > 0) {
        menu.style.top = `${Math.max(0, y - overflowY - 8)}px`;
    }

    setTimeout(() => {
        document.addEventListener('pointerdown', onOutside, { capture: true });
        document.addEventListener('keydown', onKeydown);
    }, 0);
}

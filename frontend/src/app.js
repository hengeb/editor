import { FileTree } from './tree.js';
import { TabManager } from './tabs.js';
import { ui } from './icons.js';

function el(id) {
    return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', () => {
    const treeToggleBtn = el('tree-toggle');
    const saveBtn = el('save-button');
    const newFileBtn = el('new-file-btn');
    const newFolderBtn = el('new-folder-btn');
    const sidebar = el('sidebar');
    const sidebarOverlay = el('sidebar-overlay');
    const treeContainer = el('tree-container');
    const tabsBar = el('tabs-bar');
    const editorContainer = el('editor-container');
    const emptyState = editorContainer.querySelector('.empty-state');

    treeToggleBtn.innerHTML = ui.menu;
    saveBtn.innerHTML = ui.save;
    newFileBtn.innerHTML = ui.filePlus;
    newFolderBtn.innerHTML = ui.folderPlus;

    const tabs = new TabManager(tabsBar, editorContainer, {
        onActiveChange: (tab) => {
            emptyState.hidden = Boolean(tab);
        },
    });

    function closeSidebarOnMobile() {
        if (window.matchMedia('(max-width: 47.99rem)').matches) {
            sidebar.classList.remove('sidebar--open');
            sidebarOverlay.hidden = true;
        }
    }

    const tree = new FileTree(treeContainer, {
        onOpenFile: (node) => {
            tabs.openFile(node);
            closeSidebarOnMobile();
        },
        onDeletePath: (path) => tabs.deletePath(path),
        onRenamePath: (oldPath, newPath) => tabs.renamePath(oldPath, newPath),
    });

    tree.init().catch(() => {
        treeContainer.textContent = 'Dateibaum konnte nicht geladen werden.';
    });

    treeToggleBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('sidebar--open');
        sidebarOverlay.hidden = !isOpen;
    });

    sidebarOverlay.addEventListener('click', closeSidebarOnMobile);

    saveBtn.addEventListener('click', () => tabs.save());

    newFileBtn.addEventListener('click', () => tree.createEntry('file'));
    newFolderBtn.addEventListener('click', () => tree.createEntry('dir'));

    document.addEventListener('keydown', (event) => {
        const ctrlOrCmd = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (ctrlOrCmd && key === 's') {
            event.preventDefault();
            tabs.save();
        } else if (ctrlOrCmd && event.altKey && key === 'w') {
            // Strg+W selbst kann kein Browser abfangen (reserviert für "Tab schließen")
            event.preventDefault();
            tabs.close();
        }
    });
});

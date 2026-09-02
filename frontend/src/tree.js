import { api, ApiError } from './api.js';
import { ui, iconForFile } from './icons.js';
import { showContextMenu } from './context-menu.js';

const LONG_PRESS_MS = 450;
const MOVE_THRESHOLD_PX = 8;
const HOVER_EXPAND_MS = 700;

function dirOf(path) {
    const idx = path.lastIndexOf('/');
    return idx === -1 ? '' : path.slice(0, idx);
}

function joinPath(dir, name) {
    return dir === '' ? name : `${dir}/${name}`;
}

export class FileTree {
    constructor(container, { onOpenFile, onDeletePath, onRenamePath }) {
        this.container = container;
        this.onOpenFile = onOpenFile;
        this.onDeletePath = onDeletePath;
        this.onRenamePath = onRenamePath;

        this.nodesByPath = new Map();
        this.selectedDir = '';
        this.dragState = null;
        this.osDropState = { highlightEl: null, hoverDir: null, hoverTimer: null };
        this.osDropCounter = 0;

        this.root = { path: '', type: 'dir', name: '', children: null, expanded: true };
        this.nodesByPath.set('', this.root);

        this.rootEl = document.createElement('ul');
        this.rootEl.className = 'tree tree-root';
        this.container.appendChild(this.rootEl);

        this.attachOsDropZone();
    }

    async init() {
        const { entries } = await api.tree('', 2);
        this.root.children = this.toNodes(entries, this.root);
        this.renderChildren(this.root, this.rootEl);
    }

    toNodes(entries, parent) {
        return entries.map((entry) => ({
            name: entry.name,
            path: entry.path,
            type: entry.type,
            ext: entry.ext ?? null,
            parent,
            expanded: false,
            children: entry.type === 'dir' ? this.toNodesOrNull(entry.children) : undefined,
            el: null,
            childrenEl: null,
        }));
    }

    toNodesOrNull(children) {
        if (children === null || children === undefined) {
            return null;
        }
        return this.toNodes(children, null);
    }

    renderChildren(node, containerEl) {
        containerEl.replaceChildren();
        (node.children ?? []).forEach((child) => {
            child.parent = node;
            this.nodesByPath.set(child.path, child);
            containerEl.appendChild(this.renderNode(child));

            if (child.type === 'dir' && child.children) {
                child.children.forEach((grandchild) => {
                    grandchild.parent = child;
                    this.nodesByPath.set(grandchild.path, grandchild);
                });
            }
        });
    }

    renderNode(node) {
        const li = document.createElement('li');
        li.className = 'tree-item';
        li.dataset.path = node.path;
        node.el = li;

        const row = document.createElement('div');
        row.className = `tree-row tree-row--${node.type}`;
        row.tabIndex = 0;

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        if (node.type === 'dir') {
            toggle.innerHTML = ui.chevronRight;
        }
        row.appendChild(toggle);

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = node.type === 'dir' ? ui.folder : iconForFile(node.ext);
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        row.appendChild(name);

        li.appendChild(row);

        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.activateNode(node, row);
            }
        });

        row.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.cancelDrag();
            this.openContextMenu(node, event.clientX, event.clientY);
        });

        this.attachDragGestures(node, row);

        if (node.type === 'dir') {
            const childrenEl = document.createElement('ul');
            childrenEl.className = 'tree tree-children';
            childrenEl.hidden = true;
            node.childrenEl = childrenEl;
            li.appendChild(childrenEl);
        }

        return li;
    }

    attachDragGestures(node, row) {
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let timer = null;
        let mode = 'idle'; // idle | armed | dragging | scrolling

        const reset = () => {
            if (timer) {
                clearTimeout(timer);
            }
            timer = null;
            mode = 'idle';
            pointerId = null;
            row.classList.remove('tree-row--armed');
        };

        row.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) {
                return;
            }

            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            row.setPointerCapture(pointerId);

            if (event.pointerType === 'touch') {
                timer = setTimeout(() => {
                    mode = 'armed';
                    row.classList.add('tree-row--armed');
                }, LONG_PRESS_MS);
            }
        });

        row.addEventListener('pointermove', (event) => {
            if (event.pointerId !== pointerId) {
                return;
            }

            if (mode === 'dragging') {
                event.preventDefault();
                this.updateDrag(event.clientX, event.clientY);
                return;
            }

            const moved = Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_THRESHOLD_PX;
            if (!moved) {
                return;
            }

            if (event.pointerType === 'mouse') {
                mode = 'dragging';
                this.startDrag(node, event.clientX, event.clientY);
                event.preventDefault();
            } else if (mode === 'armed') {
                mode = 'dragging';
                row.classList.remove('tree-row--armed');
                this.startDrag(node, event.clientX, event.clientY);
                event.preventDefault();
            } else {
                // Bewegung vor Ablauf des Long-Press -> vermutlich Scrollen, Geste abbrechen
                if (timer) {
                    clearTimeout(timer);
                }
                mode = 'scrolling';
            }
        });

        row.addEventListener('pointerup', (event) => {
            if (event.pointerId !== pointerId) {
                return;
            }
            row.releasePointerCapture(pointerId);

            if (mode === 'dragging') {
                this.endDrag();
            } else if (mode === 'armed') {
                this.openContextMenu(node, event.clientX, event.clientY);
            } else if (mode === 'idle') {
                this.activateNode(node, row);
            }

            reset();
        });

        row.addEventListener('pointercancel', () => {
            this.cancelDrag();
            reset();
        });
    }

    activateNode(node, row) {
        this.select(node, row);

        if (node.type === 'dir') {
            this.toggle(node);
        } else {
            this.onOpenFile(node);
        }
    }

    select(node, row) {
        this.container.querySelectorAll('.tree-row--selected').forEach((el) => {
            el.classList.remove('tree-row--selected');
        });
        row.classList.add('tree-row--selected');
        this.selectedDir = node.type === 'dir' ? node.path : dirOf(node.path);
    }

    async toggle(node) {
        node.expanded = !node.expanded;
        node.childrenEl.hidden = !node.expanded;
        node.el.querySelector('.tree-toggle').innerHTML = node.expanded ? ui.chevronDown : ui.chevronRight;
        node.el.querySelector('.tree-icon').innerHTML = node.expanded ? ui.folderOpen : ui.folder;

        if (node.expanded && node.children === null) {
            const { entries } = await api.tree(node.path, 2);
            node.children = this.toNodes(entries, node);
        }

        if (node.expanded && node.childrenEl.childElementCount === 0 && node.children) {
            this.renderChildren(node, node.childrenEl);
        }
    }

    async createEntry(type) {
        const label = type === 'dir' ? 'Ordnername' : 'Dateiname';
        const name = window.prompt(label);
        if (!name) {
            return;
        }

        const parentNode = this.nodesByPath.get(this.selectedDir) ?? this.root;
        const path = joinPath(this.selectedDir, name);

        try {
            await api.createFile(path, type);
            await this.reloadDir(parentNode);
        } catch (error) {
            this.reportError(error);
        }
    }

    async reloadDir(node) {
        const { entries } = await api.tree(node.path, 2);
        node.children = this.toNodes(entries, node);

        if (node === this.root) {
            this.renderChildren(node, this.rootEl);
        } else {
            this.renderChildren(node, node.childrenEl);
            node.expanded = true;
            node.childrenEl.hidden = false;
        }
    }

    openContextMenu(node, x, y) {
        const items = [];

        if (node.type === 'file') {
            items.push({
                label: 'Download',
                icon: ui.download,
                onSelect: () => this.downloadNode(node),
            });
        }

        items.push(
            {
                label: 'Umbenennen',
                icon: ui.pencil,
                onSelect: () => this.startRename(node, node.el.querySelector('.tree-name')),
            },
            {
                label: 'Löschen',
                icon: ui.trash,
                onSelect: () => this.deleteNode(node),
            },
        );

        showContextMenu(x, y, items);
    }

    downloadNode(node) {
        const link = document.createElement('a');
        link.href = api.rawUrl(node.path);
        link.download = node.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    startRename(node, nameEl) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tree-rename-input';
        input.value = node.name;

        nameEl.replaceWith(input);
        input.focus();
        input.select();

        const commit = async () => {
            const newName = input.value.trim();
            input.replaceWith(nameEl);

            if (!newName || newName === node.name) {
                return;
            }

            const newPath = joinPath(dirOf(node.path), newName);

            try {
                await api.renameFile(node.path, newPath);
                const oldPath = node.path;
                node.name = newName;
                node.path = newPath;
                node.el.dataset.path = newPath;
                nameEl.textContent = newName;
                this.nodesByPath.delete(oldPath);
                this.nodesByPath.set(newPath, node);
                this.onRenamePath(oldPath, newPath);
            } catch (error) {
                this.reportError(error);
            }
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                input.blur();
            } else if (event.key === 'Escape') {
                input.value = node.name;
                input.blur();
            }
        });
        input.addEventListener('blur', commit, { once: true });
    }

    async deleteNode(node) {
        const label = node.type === 'dir' ? 'den Ordner' : 'die Datei';
        if (!window.confirm(`Soll ${label} "${node.name}" wirklich gelöscht werden?`)) {
            return;
        }

        try {
            await api.deleteFile(node.path);
            node.el.remove();
            this.nodesByPath.delete(node.path);
            const parentChildren = node.parent?.children;
            if (parentChildren) {
                const idx = parentChildren.indexOf(node);
                if (idx !== -1) {
                    parentChildren.splice(idx, 1);
                }
            }
            this.onDeletePath(node.path);
        } catch (error) {
            this.reportError(error);
        }
    }

    // --- Drag & Drop (Maus: sofort ab Schwellwert; Touch: nach Long-Press) ---

    startDrag(node, x, y) {
        if (node.path === '') {
            return;
        }

        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';

        const icon = document.createElement('span');
        icon.className = 'drag-ghost-icon';
        icon.innerHTML = node.type === 'dir' ? ui.folder : iconForFile(node.ext);
        ghost.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = node.name;
        ghost.appendChild(label);

        document.body.appendChild(ghost);

        this.dragState = {
            node,
            ghostEl: ghost,
            highlightEl: null,
            targetNode: null,
            hoverDir: null,
            hoverTimer: null,
        };
        node.el.classList.add('tree-item--dragging');
        this.positionGhost(x, y);
    }

    positionGhost(x, y) {
        if (!this.dragState) {
            return;
        }
        this.dragState.ghostEl.style.left = `${x + 12}px`;
        this.dragState.ghostEl.style.top = `${y + 12}px`;
    }

    resolveDropTarget(x, y) {
        const el = document.elementFromPoint(x, y);
        if (!el) {
            return null;
        }

        const item = el.closest('.tree-item');
        if (item) {
            const node = this.nodesByPath.get(item.dataset.path);
            if (!node) {
                return null;
            }
            return node.type === 'dir' ? node : (node.parent ?? this.root);
        }

        return this.container.contains(el) ? this.root : null;
    }

    isValidDropTarget(sourceNode, targetNode) {
        if (!targetNode || targetNode === sourceNode) {
            return false;
        }
        if (targetNode.path === (sourceNode.parent?.path ?? '')) {
            return false;
        }
        if (sourceNode.type === 'dir') {
            if (targetNode.path === sourceNode.path || targetNode.path.startsWith(`${sourceNode.path}/`)) {
                return false;
            }
        }
        return true;
    }

    updateDrag(x, y) {
        if (!this.dragState) {
            return;
        }

        this.positionGhost(x, y);

        const targetNode = this.resolveDropTarget(x, y);
        const valid = this.isValidDropTarget(this.dragState.node, targetNode);
        const newHighlightEl = valid
            ? (targetNode === this.root ? this.container : targetNode.el.querySelector(':scope > .tree-row'))
            : null;

        if (this.dragState.highlightEl !== newHighlightEl) {
            this.dragState.highlightEl?.classList.remove('drop-target');
            newHighlightEl?.classList.add('drop-target');
            this.dragState.highlightEl = newHighlightEl;
        }

        this.dragState.targetNode = valid ? targetNode : null;

        this.scheduleHoverExpand(this.dragState, targetNode);
    }

    /**
     * Klappt ein eingeklapptes Verzeichnis auf, wenn während eines Drags
     * (intern verschoben oder Datei/Ordner von außerhalb gezogen) kurz darauf
     * verweilt wird. `state` ist entweder this.dragState oder this.osDropState.
     */
    scheduleHoverExpand(state, targetNode) {
        const hoverDir = targetNode && targetNode !== this.root && targetNode.type === 'dir' ? targetNode : null;

        if (hoverDir === state.hoverDir) {
            return;
        }

        clearTimeout(state.hoverTimer);
        state.hoverDir = hoverDir;
        state.hoverTimer = hoverDir && !hoverDir.expanded
            ? setTimeout(() => {
                if (state.hoverDir === hoverDir && !hoverDir.expanded) {
                    this.toggle(hoverDir);
                }
            }, HOVER_EXPAND_MS)
            : null;
    }

    endDrag() {
        if (!this.dragState) {
            return;
        }

        const { node, targetNode, ghostEl, highlightEl, hoverTimer } = this.dragState;
        clearTimeout(hoverTimer);
        ghostEl.remove();
        highlightEl?.classList.remove('drop-target');
        node.el.classList.remove('tree-item--dragging');
        this.dragState = null;

        if (targetNode) {
            this.moveNode(node, targetNode);
        }
    }

    cancelDrag() {
        if (!this.dragState) {
            return;
        }
        clearTimeout(this.dragState.hoverTimer);
        this.dragState.ghostEl.remove();
        this.dragState.highlightEl?.classList.remove('drop-target');
        this.dragState.node.el.classList.remove('tree-item--dragging');
        this.dragState = null;
    }

    async moveNode(node, targetDirNode) {
        const newPath = joinPath(targetDirNode.path, node.name);
        const oldPath = node.path;
        const oldParent = node.parent ?? this.root;

        try {
            await api.renameFile(oldPath, newPath);
            this.onRenamePath(oldPath, newPath);
            await this.reloadDir(oldParent);
            if (targetDirNode !== oldParent && (targetDirNode === this.root || targetDirNode.children !== null)) {
                await this.reloadDir(targetDirNode);
            }
        } catch (error) {
            this.reportError(error);
        }
    }

    reportError(error) {
        const message = error instanceof ApiError ? error.message : 'Unerwarteter Fehler';
        window.alert(message);
    }

    // --- Datei-/Ordner-Upload per Drag & Drop vom Betriebssystem ---

    attachOsDropZone() {
        this.container.addEventListener('dragenter', (event) => {
            if (!event.dataTransfer?.types.includes('Files')) {
                return;
            }
            event.preventDefault();
            this.osDropCounter += 1;
            this.container.classList.add('tree-container--drag-active');
        });

        this.container.addEventListener('dragover', (event) => {
            if (!event.dataTransfer?.types.includes('Files')) {
                return;
            }
            event.preventDefault();

            const targetNode = this.resolveDropTarget(event.clientX, event.clientY) ?? this.root;
            const newHighlightEl = targetNode === this.root
                ? this.container
                : targetNode.el.querySelector(':scope > .tree-row');

            if (this.osDropState.highlightEl !== newHighlightEl) {
                this.osDropState.highlightEl?.classList.remove('drop-target');
                newHighlightEl?.classList.add('drop-target');
                this.osDropState.highlightEl = newHighlightEl;
            }

            this.scheduleHoverExpand(this.osDropState, targetNode);
        });

        this.container.addEventListener('dragleave', () => {
            this.osDropCounter = Math.max(0, this.osDropCounter - 1);
            if (this.osDropCounter === 0) {
                this.clearOsDropState();
            }
        });

        this.container.addEventListener('drop', (event) => {
            if (!event.dataTransfer?.types.includes('Files')) {
                return;
            }
            event.preventDefault();

            const targetNode = this.resolveDropTarget(event.clientX, event.clientY) ?? this.root;
            const items = [...event.dataTransfer.items];
            this.osDropCounter = 0;
            this.clearOsDropState();

            this.uploadDroppedItems(items, targetNode);
        });
    }

    clearOsDropState() {
        this.container.classList.remove('tree-container--drag-active');
        clearTimeout(this.osDropState.hoverTimer);
        this.osDropState.highlightEl?.classList.remove('drop-target');
        this.osDropState.highlightEl = null;
        this.osDropState.hoverDir = null;
        this.osDropState.hoverTimer = null;
    }

    /**
     * @param {DataTransferItem[]} items
     * @returns {Promise<{files: {relativePath: string, file: File}[], dirs: string[]}>}
     */
    async collectDroppedEntries(items) {
        const files = [];
        const dirs = [];

        const walk = (entry, prefix) => new Promise((resolve, reject) => {
            if (entry.isFile) {
                entry.file((file) => {
                    files.push({ relativePath: `${prefix}${entry.name}`, file });
                    resolve();
                }, reject);
            } else if (entry.isDirectory) {
                dirs.push(`${prefix}${entry.name}`);
                const reader = entry.createReader();
                const readBatch = () => {
                    reader.readEntries(async (batch) => {
                        if (batch.length === 0) {
                            resolve();
                            return;
                        }
                        await Promise.all(batch.map((child) => walk(child, `${prefix}${entry.name}/`)));
                        readBatch();
                    }, reject);
                };
                readBatch();
            } else {
                resolve();
            }
        });

        const tasks = [];
        for (const item of items) {
            const entry = item.webkitGetAsEntry?.();
            if (entry) {
                tasks.push(walk(entry, ''));
            } else {
                const file = item.getAsFile?.();
                if (file) {
                    files.push({ relativePath: file.name, file });
                }
            }
        }
        await Promise.all(tasks);

        return { files, dirs };
    }

    async uploadDroppedItems(items, targetDirNode) {
        const { files, dirs } = await this.collectDroppedEntries(items);
        await this.uploadFilesToDir(files, dirs, targetDirNode);
    }

    /**
     * Lädt über den Upload-Button ausgewählte Dateien (flach, ohne
     * Ordnerstruktur - das native Datei-Dialogfeld kennt keine Unterordner)
     * in das aktuell ausgewählte Verzeichnis hoch.
     * @param {FileList} fileList
     */
    async uploadFiles(fileList) {
        const targetDirNode = this.nodesByPath.get(this.selectedDir) ?? this.root;
        const files = [...fileList].map((file) => ({ relativePath: file.name, file }));
        await this.uploadFilesToDir(files, [], targetDirNode);
    }

    async uploadFilesToDir(files, dirs, targetDirNode) {
        if (files.length === 0 && dirs.length === 0) {
            return;
        }

        const dirsNeeded = new Set(dirs);
        for (const { relativePath } of files) {
            let dir = dirOf(relativePath);
            while (dir !== '') {
                dirsNeeded.add(dir);
                dir = dirOf(dir);
            }
        }

        const sortedDirs = [...dirsNeeded].sort((a, b) => a.split('/').length - b.split('/').length);

        for (const dir of sortedDirs) {
            try {
                await api.createFile(joinPath(targetDirNode.path, dir), 'dir');
            } catch (error) {
                if (!(error instanceof ApiError && error.status === 409)) {
                    this.reportError(error);
                    return;
                }
            }
        }

        for (const { relativePath, file } of files) {
            try {
                await api.uploadFile(joinPath(targetDirNode.path, relativePath), file);
            } catch (error) {
                this.reportError(error);
            }
        }

        await this.reloadDir(targetDirNode);
    }
}

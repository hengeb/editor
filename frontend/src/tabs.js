import { api, ApiError } from './api.js';
import { createEditor } from './editor.js';
import { ui, iconForFile } from './icons.js';

export class TabManager {
    constructor(tabsBarEl, editorContainerEl, { onActiveChange } = {}) {
        this.tabsBarEl = tabsBarEl;
        this.editorContainerEl = editorContainerEl;
        this.onActiveChange = onActiveChange ?? (() => {});
        this.tabs = new Map();
        this.activePath = null;
    }

    async openFile(node) {
        if (this.tabs.has(node.path)) {
            this.activate(node.path);
            return;
        }

        let data;
        try {
            data = await api.readFile(node.path);
        } catch (error) {
            this.reportError(error);
            return;
        }

        const tab = {
            path: node.path,
            name: node.name,
            ext: node.ext,
            mtime: data.mtime,
            binary: Boolean(data.binary),
            dirty: false,
            view: null,
        };

        tab.tabEl = this.buildTabButton(tab);
        tab.paneEl = this.buildPane(tab, data.content ?? '');

        this.tabsBarEl.appendChild(tab.tabEl);
        this.editorContainerEl.appendChild(tab.paneEl);
        this.tabs.set(node.path, tab);

        this.activate(node.path);
    }

    buildTabButton(tab) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'tab';
        el.dataset.path = tab.path;

        const icon = document.createElement('span');
        icon.className = 'tab-icon';
        icon.innerHTML = iconForFile(tab.ext);
        el.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tab-name';
        name.textContent = tab.name;
        el.appendChild(name);
        tab.nameEl = name;

        const dirtyDot = document.createElement('span');
        dirtyDot.className = 'tab-dirty';
        dirtyDot.hidden = true;
        el.appendChild(dirtyDot);
        tab.dirtyEl = dirtyDot;

        const close = document.createElement('span');
        close.className = 'tab-close';
        close.innerHTML = ui.close;
        close.title = 'Schließen';
        close.addEventListener('click', (event) => {
            event.stopPropagation();
            this.close(tab.path);
        });
        el.appendChild(close);

        el.addEventListener('click', () => this.activate(tab.path));

        return el;
    }

    buildPane(tab, content) {
        const pane = document.createElement('div');
        pane.className = 'editor-pane';
        pane.hidden = true;

        if (tab.binary) {
            const notice = document.createElement('div');
            notice.className = 'editor-notice';
            notice.innerHTML = `${ui.warning}<p>Diese Datei kann nicht bearbeitet werden (kein Textformat).</p>`;
            pane.appendChild(notice);
            return pane;
        }

        tab.originalContent = content;
        tab.view = createEditor({
            parent: pane,
            doc: content,
            ext: tab.ext,
            onChange: () => this.setDirty(tab, true),
        });

        return pane;
    }

    activate(path) {
        if (this.activePath === path) {
            return;
        }

        for (const tab of this.tabs.values()) {
            tab.tabEl.classList.toggle('tab--active', tab.path === path);
            tab.paneEl.hidden = tab.path !== path;
        }

        this.activePath = path;
        this.tabs.get(path)?.tabEl.scrollIntoView({ inline: 'nearest' });
        this.onActiveChange(this.tabs.get(path) ?? null);
    }

    setDirty(tab, dirty) {
        if (tab.dirty === dirty) {
            return;
        }
        tab.dirty = dirty;
        tab.dirtyEl.hidden = !dirty;
    }

    async save(path) {
        const tab = this.tabs.get(path ?? this.activePath);
        if (!tab || tab.binary || !tab.view) {
            return;
        }

        const content = tab.view.state.doc.toString();

        try {
            const result = await api.saveFile(tab.path, content, tab.mtime);
            tab.mtime = result.mtime;
            tab.originalContent = content;
            this.setDirty(tab, false);
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                window.alert('Die Datei wurde zwischenzeitlich anderweitig geändert. Bitte erneut laden, bevor gespeichert wird.');
            } else {
                this.reportError(error);
            }
        }
    }

    close(path) {
        const tab = this.tabs.get(path);
        if (!tab) {
            return;
        }

        if (tab.dirty && !window.confirm(`"${tab.name}" wurde nicht gespeichert. Trotzdem schließen?`)) {
            return;
        }

        tab.view?.destroy();
        tab.tabEl.remove();
        tab.paneEl.remove();
        this.tabs.delete(path);

        if (this.activePath === path) {
            this.activePath = null;
            const next = [...this.tabs.keys()].at(-1);
            if (next) {
                this.activate(next);
            } else {
                this.onActiveChange(null);
            }
        }
    }

    renamePath(oldPath, newPath) {
        const tab = this.tabs.get(oldPath);
        if (!tab) {
            return;
        }

        const name = newPath.slice(newPath.lastIndexOf('/') + 1);
        tab.path = newPath;
        tab.name = name;
        tab.nameEl.textContent = name;
        tab.tabEl.dataset.path = newPath;

        this.tabs.delete(oldPath);
        this.tabs.set(newPath, tab);

        if (this.activePath === oldPath) {
            this.activePath = newPath;
        }
    }

    deletePath(path) {
        if (this.tabs.has(path)) {
            const tab = this.tabs.get(path);
            tab.view?.destroy();
            tab.tabEl.remove();
            tab.paneEl.remove();
            this.tabs.delete(path);

            if (this.activePath === path) {
                this.activePath = null;
                const next = [...this.tabs.keys()].at(-1);
                if (next) {
                    this.activate(next);
                } else {
                    this.onActiveChange(null);
                }
            }
        }
    }

    reportError(error) {
        const message = error instanceof ApiError ? error.message : 'Unerwarteter Fehler';
        window.alert(message);
    }
}

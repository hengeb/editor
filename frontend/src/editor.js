import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
import { json } from '@codemirror/lang-json';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';

function languageForExtension(ext) {
    switch ((ext ?? '').toLowerCase()) {
        case 'yml':
        case 'yaml':
            return yaml();
        case 'md':
        case 'markdown':
            return markdown();
        case 'js':
        case 'mjs':
        case 'cjs':
            return javascript();
        case 'jsx':
            return javascript({ jsx: true });
        case 'ts':
            return javascript({ typescript: true });
        case 'tsx':
            return javascript({ jsx: true, typescript: true });
        case 'json':
            return json();
        case 'css':
        case 'scss':
        case 'less':
            return css();
        case 'html':
        case 'htm':
        case 'vue':
            return html();
        case 'xml':
        case 'svg':
            return xml();
        case 'php':
            return php();
        case 'sql':
            return sql();
        default:
            return null;
    }
}

export function createEditor({ parent, doc, ext, onChange }) {
    const language = languageForExtension(ext);

    const extensions = [
        basicSetup,
        keymap.of([indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                onChange(update.state.doc.toString());
            }
        }),
    ];

    if (language) {
        extensions.push(language);
    }

    const state = EditorState.create({ doc, extensions });

    return new EditorView({ state, parent });
}

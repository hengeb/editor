import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
import { json } from '@codemirror/lang-json';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';

// An das dunkle App-Layout angelehnte Farben (siehe public/assets/css/style.css)
const theme = EditorView.theme({
    '&': {
        color: '#e6edf3',
        backgroundColor: '#0d1117',
    },
    '.cm-content': {
        caretColor: '#4f8cff',
    },
    '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: '#4f8cff',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: '#264f78',
    },
    '.cm-gutters': {
        backgroundColor: '#0d1117',
        color: '#8b949e',
        border: 'none',
    },
    '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: '#1c232c',
    },
    '.cm-selectionMatch': {
        backgroundColor: '#264f7855',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
        backgroundColor: '#264f78',
        outline: 'none',
    },
}, { dark: true });

const highlightStyle = HighlightStyle.define([
    { tag: t.keyword, color: '#ff7b72' },
    { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#79c0ff' },
    { tag: [t.function(t.variableName), t.labelName], color: '#d2a8ff' },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#79c0ff' },
    { tag: [t.definition(t.name), t.separator], color: '#e6edf3' },
    { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#ffa657' },
    { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#79c0ff' },
    { tag: [t.meta, t.comment], color: '#8b949e', fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: '#79c0ff', textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: '#79c0ff' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#79c0ff' },
    { tag: [t.processingInstruction, t.string, t.inserted], color: '#a5d6ff' },
    { tag: t.invalid, color: '#f85149' },
    { tag: t.tagName, color: '#7ee787' },
    { tag: t.attributeName, color: '#79c0ff' },
]);

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
        theme,
        syntaxHighlighting(highlightStyle),
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

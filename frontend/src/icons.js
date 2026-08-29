import iconFile from '@tabler/icons/outline/file.svg';
import iconFolder from '@tabler/icons/outline/folder.svg';
import iconFolderOpen from '@tabler/icons/outline/folder-open.svg';
import iconChevronRight from '@tabler/icons/outline/chevron-right.svg';
import iconChevronDown from '@tabler/icons/outline/chevron-down.svg';
import iconFilePlus from '@tabler/icons/outline/file-plus.svg';
import iconFolderPlus from '@tabler/icons/outline/folder-plus.svg';
import iconTrash from '@tabler/icons/outline/trash.svg';
import iconPencil from '@tabler/icons/outline/pencil.svg';
import iconDeviceFloppy from '@tabler/icons/outline/device-floppy.svg';
import iconX from '@tabler/icons/outline/x.svg';
import iconMenu from '@tabler/icons/outline/menu.svg';
import iconFileCode from '@tabler/icons/outline/file-code.svg';
import iconFileTypeCss from '@tabler/icons/outline/file-type-css.svg';
import iconFileTypeHtml from '@tabler/icons/outline/file-type-html.svg';
import iconFileTypeJs from '@tabler/icons/outline/file-type-js.svg';
import iconFileTypeJsx from '@tabler/icons/outline/file-type-jsx.svg';
import iconFileTypeTs from '@tabler/icons/outline/file-type-ts.svg';
import iconFileTypeTsx from '@tabler/icons/outline/file-type-tsx.svg';
import iconFileTypeVue from '@tabler/icons/outline/file-type-vue.svg';
import iconFileTypePhp from '@tabler/icons/outline/file-type-php.svg';
import iconFileTypeSql from '@tabler/icons/outline/file-type-sql.svg';
import iconFileTypeXml from '@tabler/icons/outline/file-type-xml.svg';
import iconFileTypeCsv from '@tabler/icons/outline/file-type-csv.svg';
import iconFileTypeTxt from '@tabler/icons/outline/file-type-txt.svg';
import iconFileTypeDoc from '@tabler/icons/outline/file-type-doc.svg';
import iconFileTypeDocx from '@tabler/icons/outline/file-type-docx.svg';
import iconFileTypeXls from '@tabler/icons/outline/file-type-xls.svg';
import iconFileTypePpt from '@tabler/icons/outline/file-type-ppt.svg';
import iconFileTypePdf from '@tabler/icons/outline/file-type-pdf.svg';
import iconFileTypeZip from '@tabler/icons/outline/file-type-zip.svg';
import iconFileTypePng from '@tabler/icons/outline/file-type-png.svg';
import iconFileTypeJpg from '@tabler/icons/outline/file-type-jpg.svg';
import iconFileTypeSvg from '@tabler/icons/outline/file-type-svg.svg';
import iconFileTypeBmp from '@tabler/icons/outline/file-type-bmp.svg';
import iconPhoto from '@tabler/icons/outline/photo.svg';
import iconMarkdown from '@tabler/icons/outline/markdown.svg';
import iconJson from '@tabler/icons/outline/json.svg';
import iconFileTypeRs from '@tabler/icons/outline/file-type-rs.svg';
import iconAlertTriangle from '@tabler/icons/outline/alert-triangle.svg';

export const ui = {
    folder: iconFolder,
    folderOpen: iconFolderOpen,
    chevronRight: iconChevronRight,
    chevronDown: iconChevronDown,
    filePlus: iconFilePlus,
    folderPlus: iconFolderPlus,
    trash: iconTrash,
    pencil: iconPencil,
    save: iconDeviceFloppy,
    close: iconX,
    menu: iconMenu,
    warning: iconAlertTriangle,
};

const extensionIcons = {
    js: iconFileTypeJs,
    mjs: iconFileTypeJs,
    cjs: iconFileTypeJs,
    jsx: iconFileTypeJsx,
    ts: iconFileTypeTs,
    tsx: iconFileTypeTsx,
    vue: iconFileTypeVue,
    latte: iconFileTypeHtml,
    html: iconFileTypeHtml,
    htm: iconFileTypeHtml,
    css: iconFileTypeCss,
    scss: iconFileTypeCss,
    sass: iconFileTypeCss,
    less: iconFileTypeCss,
    json: iconJson,
    php: iconFileTypePhp,
    sql: iconFileTypeSql,
    yml: iconFileCode,
    yaml: iconFileCode,
    md: iconMarkdown,
    markdown: iconMarkdown,
    xml: iconFileTypeXml,
    csv: iconFileTypeCsv,
    txt: iconFileTypeTxt,
    doc: iconFileTypeDoc,
    docx: iconFileTypeDocx,
    xls: iconFileTypeXls,
    xlsx: iconFileTypeXls,
    ppt: iconFileTypePpt,
    pptx: iconFileTypePpt,
    pdf: iconFileTypePdf,
    zip: iconFileTypeZip,
    tar: iconFileTypeZip,
    gz: iconFileTypeZip,
    rar: iconFileTypeZip,
    '7z': iconFileTypeZip,
    png: iconFileTypePng,
    jpg: iconFileTypeJpg,
    jpeg: iconFileTypeJpg,
    gif: iconPhoto,
    webp: iconPhoto,
    svg: iconFileTypeSvg,
    bmp: iconFileTypeBmp,
    rs: iconFileTypeRs,
    sh: iconFileCode,
    bash: iconFileCode,
    py: iconFileCode,
    rb: iconFileCode,
    go: iconFileCode,
    java: iconFileCode,
    c: iconFileCode,
    cpp: iconFileCode,
    h: iconFileCode,
};

export function iconForFile(ext) {
    if (ext && extensionIcons[ext.toLowerCase()]) {
        return extensionIcons[ext.toLowerCase()];
    }

    return iconFile;
}

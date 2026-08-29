export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function request(method, url, body) {
    const options = { method, headers: {} };

    if (method !== 'GET') {
        options.headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    let data = null;

    try {
        data = await response.json();
    } catch {
        // Kein JSON-Body, z. B. bei Netzwerkfehlern gefangen durch fetch selbst
    }

    if (!response.ok) {
        throw new ApiError(data?.error ?? `Fehler ${response.status}`, response.status);
    }

    return data;
}

export const api = {
    tree(path = '', depth = 2) {
        const params = new URLSearchParams({ path, depth: String(depth) });
        return request('GET', `/api/tree?${params}`);
    },
    readFile(path) {
        const params = new URLSearchParams({ path });
        return request('GET', `/api/file?${params}`);
    },
    createFile(path, type) {
        return request('POST', '/api/file', { path, type });
    },
    saveFile(path, content, mtime) {
        return request('PUT', '/api/file', { path, content, mtime });
    },
    renameFile(path, newPath) {
        return request('PATCH', '/api/file', { path, newPath });
    },
    deleteFile(path) {
        const params = new URLSearchParams({ path });
        return request('DELETE', `/api/file?${params}`);
    },
};

import Busboy from 'busboy';

const BUCKY_URL = 'https://bucky.hackclub.com/';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB safety limit

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    return new Promise((resolve) => {
        const busboy = Busboy({
            headers: req.headers,
            limits: { fileSize: MAX_FILE_SIZE, files: 1 }
        });

        let fileChunks = [];
        let fileName = 'upload.bin';
        let mimeType = 'application/octet-stream';
        let receivedFile = false;
        let aborted = false;

        const abortWith = (status, message) => {
            if (!res.headersSent) {
                res.status(status).json({ error: message });
            }
            aborted = true;
            resolve();
        };

        busboy.on('file', (_name, file, info) => {
            receivedFile = true;
            fileName = info.filename || fileName;
            mimeType = info.mimeType || mimeType;

            file.on('data', (chunk) => {
                if (!aborted) fileChunks.push(chunk);
            });

            file.on('limit', () => {
                abortWith(413, 'File too large (max 20MB).');
                file.destroy();
            });
        });

        busboy.on('error', (err) => {
            console.error('Upload busboy error', err);
            abortWith(500, 'Failed to read upload.');
        });

        busboy.on('finish', async () => {
            if (aborted) return;
            if (!receivedFile || !fileChunks.length) {
                return abortWith(400, 'No file provided.');
            }

            const buffer = Buffer.concat(fileChunks);

            try {
                const form = new FormData();
                const blob = new Blob([buffer], { type: mimeType });
                form.append('file', blob, fileName);

                const upstream = await fetch(BUCKY_URL, {
                    method: 'POST',
                    body: form
                });

                const raw = await upstream.text();
                let parsed;
                try {
                    parsed = JSON.parse(raw);
                } catch (err) {
                    parsed = { raw };
                }

                if (!upstream.ok) {
                    res.status(upstream.status).json(parsed);
                } else {
                    res.status(200).json(parsed);
                }
            } catch (err) {
                console.error('Upload proxy error', err);
                abortWith(500, 'Failed to upload to Bucky.');
                return;
            }
            resolve();
        });

        req.on('aborted', () => {
            aborted = true;
            try { busboy.destroy(); } catch (_) { /* noop */ }
        });

        req.pipe(busboy);
    });
}

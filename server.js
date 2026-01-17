import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// 1. Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// 2. Dynamic API handling from /api folder
// This simulates serverless functions by mapping /api/filename to /api/filename.js
app.all(/^\/api\/(.*)/, async (req, res) => {
    const routePath = req.params[0]; // e.g., 'users' or 'auth/login'
    const filePath = path.join(__dirname, 'api', `${routePath}.js`);

    if (fs.existsSync(filePath)) {
        try {
            // Dynamic import for ESM
            // Adding timestamp to bypass cache for development hot-reloading simulation
            const moduleUrl = `file://${filePath}?update=${Date.now()}`;
            const module = await import(moduleUrl);
            
            const handler = module.default;
            
            // Check if the export is a function (standard serverless signature)
            if (typeof handler === 'function') {
                return await handler(req, res);
            }
        } catch (error) {
            console.error(`Error executing function ${routePath}:`, error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        // If no file matches, return 404
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
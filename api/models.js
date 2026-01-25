// import fs from 'fs/promises'; //
// import path from 'path'; //
// import { fileURLToPath } from 'url'; //

// const __filename = fileURLToPath(import.meta.url); //
// const __dirname = path.dirname(__filename); //

export default async function handler(req, res) {
    try {

        const response = await fetch('https://ai.hackclub.com/proxy/v1/models', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        // const filePath = path.join(__dirname, 'hackclubai_models.json'); //
        // const fileContent = await fs.readFile(filePath, 'utf8'); //
        // const data = JSON.parse(fileContent); //

        res.status(response.status).json(data);
        // res.status(200).json(data); //
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch models' });
        console.log('Models fetch error:', error);
    }
}
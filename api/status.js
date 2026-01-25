export default async function (req, res) {
    try {
        // const response = await fetch('https://ai.hackclub.com/up');
        // if (!response.ok) {
        //     throw new Error(`Upstream error: ${response.status}`);
        // }
        // const data = await response.json();
        const data = { "status": "up" }
        res.json(data);
    } catch (error) {
        console.error('Status check proxy error:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
}

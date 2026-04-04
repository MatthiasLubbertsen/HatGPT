import crypto from 'crypto';

export default function handler(req, res) {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email parameter is required' });
    }

    const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=identicon`;

    res.status(200).json({ url: gravatarUrl });
}
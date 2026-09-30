const API_ORIGIN = 'https://temporary-speedy-krypton-jpowuge.vercel.app';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export function proxyAuth(action) {
  return async function handler(req, res) {
    const headers = { 'content-type': 'application/json' };
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers.origin) headers.origin = req.headers.origin;

    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await readBody(req);

    try {
      const response = await fetch(`${API_ORIGIN}/api/auth/${action}`, init);
      const text = await response.text();
      res.status(response.status);
      res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
      res.send(text);
    } catch {
      res.status(502).json({
        success: false,
        error: { code: 'API_ERROR', message: 'The account service could not be reached', details: [] },
      });
    }
  };
}

const API_ORIGIN = 'https://temporary-speedy-krypton-jpowuge.vercel.app';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function apiPath(req) {
  const value = req.query?.path;
  if (Array.isArray(value)) return value.map(encodeURIComponent).join('/');
  return String(value || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

export default async function handler(req, res) {
  const path = apiPath(req);
  const requestUrl = new URL(req.url || '/', 'https://folio.local');
  requestUrl.searchParams.delete('path');
  const query = requestUrl.searchParams.toString();
  const target = `${API_ORIGIN}/api/${path}${query ? `?${query}` : ''}`;

  const headers = {};
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers.accept) headers.accept = req.headers.accept;

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await rawBody(req);

  try {
    const response = await fetch(target, init);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.status(response.status);
    const type = response.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    const disposition = response.headers.get('content-disposition');
    if (disposition) res.setHeader('content-disposition', disposition);
    res.send(buffer);
  } catch {
    res.status(502).json({
      success: false,
      error: { code: 'API_ERROR', message: 'The document service could not be reached', details: [] },
    });
  }
}

import serverless from 'serverless-http';
import app from '../src/app.js';

const handle = serverless(app);

// Vercel may hand us the body already parsed (object), as raw bytes (Buffer),
// as text, or leave it on the request stream. Turn all of those into one plain string.
async function readBody(req) {
  const parsed = req.body;
  if (typeof parsed === 'string' && parsed) return parsed;
  if (Buffer.isBuffer(parsed) && parsed.length) return parsed.toString('utf8');
  if (parsed && typeof parsed === 'object' && !Buffer.isBuffer(parsed) && Object.keys(parsed).length) {
    return JSON.stringify(parsed);
  }
  if (req.readable && !req.readableEnded) {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
  }
  return '';
}

// Vercel calls functions with (req, res); serverless-http expects a Lambda-style event.
// This small adapter translates one into the other.
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const body = await readBody(req);

  const result = await handle(
    {
      httpMethod: req.method,
      path: url.pathname,
      headers: req.headers,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body,
      isBase64Encoded: false,
      requestContext: {},
    },
    {}
  );

  for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value);
  res.status(result.statusCode).send(result.body);
}

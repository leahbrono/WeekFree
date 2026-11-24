import serverless from 'serverless-http';
import app from '../src/app.js';

const handle = serverless(app);

// Vercel calls functions with (req, res); serverless-http expects a Lambda-style event.
// This small adapter translates one into the other.
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const body = req.body == null ? null : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

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

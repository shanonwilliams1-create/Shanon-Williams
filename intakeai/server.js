import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://leadforge.onrender.com';

// Proxy all /api requests to the FastAPI backend on Render
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
}));

app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`IntakeAI running on port ${PORT}, proxying /api → ${BACKEND_URL}`));

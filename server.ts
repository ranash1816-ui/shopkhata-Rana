import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({limit: '10mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: 'Shopkhata BD',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/download-zip', (_req, res) => {
    const zipPath = path.resolve(__dirname, 'public', 'Shopkhata-BD-Project.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({error: 'Project ZIP archive not generated yet.'});
    }
    return res.download(zipPath, 'Shopkhata-BD-Project.zip');
  });

  // Server-side SMS Gateway Proxy (keeps gateway API keys off the browser URL/network logs when configured in .env)
  app.post('/api/sms/send', async (req, res) => {
    try {
      const {to, message, provider, apiUrl, apiKey, senderId} = req.body as {
        to?: string;
        message?: string;
        provider?: 'bulksmsbd' | 'sslwireless' | 'custom' | 'env';
        apiUrl?: string;
        apiKey?: string;
        senderId?: string;
      };

      if (!to || !message) {
        return res.status(400).json({success: false, error: 'Missing recipient phone or message body.'});
      }

      const cleanPhone = to.replace(/[^\d+]/g, '');
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({success: false, error: 'Invalid Bangladesh mobile number format.'});
      }

      const resolvedKey = apiKey || process.env.SMS_GATEWAY_API_KEY || '';
      const resolvedSender = senderId || process.env.SMS_GATEWAY_SENDER_ID || 'ShopkhataBD';
      const resolvedUrl = apiUrl || process.env.SMS_GATEWAY_URL || '';

      if (!resolvedKey && provider !== 'custom') {
        return res.status(422).json({
          success: false,
          fallbackToIntent: true,
          error: 'No SMS Gateway API key configured. Use device SMS Intent fallback.',
        });
      }

      let targetUrl = resolvedUrl;
      let fetchOptions: RequestInit = {method: 'POST'};

      if (provider === 'bulksmsbd') {
        const normalized = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone.replace(/^\+/, '')}`;
        const params = new URLSearchParams({
          api_key: resolvedKey,
          type: 'text',
          number: normalized,
          senderid: resolvedSender,
          message,
        });
        targetUrl = `https://bulksmsbd.net/api/smsapi?${params.toString()}`;
        fetchOptions = {method: 'GET'};
      } else if (provider === 'sslwireless') {
        targetUrl = resolvedUrl || 'https://smsplus.sslwireless.com/api/v3/send-sms';
        fetchOptions = {
          method: 'POST',
          headers: {'Content-Type': 'application/json', Accept: 'application/json'},
          body: JSON.stringify({
            api_token: resolvedKey,
            sid: resolvedSender,
            msisdn: cleanPhone.replace(/^\+/, ''),
            sms: message,
            csms_id: `SKBD_${Date.now()}`,
          }),
        };
      } else {
        if (!targetUrl) {
          return res.status(422).json({
            success: false,
            fallbackToIntent: true,
            error: 'Gateway endpoint URL is required for custom SMS provider.',
          });
        }
        fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resolvedKey ? {Authorization: `Bearer ${resolvedKey}`} : {}),
          },
          body: JSON.stringify({
            to: cleanPhone,
            sender_id: resolvedSender,
            message,
          }),
        };
      }

      const upstream = await fetch(targetUrl, fetchOptions);
      const rawText = await upstream.text();
      if (!upstream.ok) {
        return res.status(502).json({
          success: false,
          error: `Gateway returned HTTP ${upstream.status}`,
          details: rawText.slice(0, 300),
        });
      }

      return res.json({
        success: true,
        providerResponse: rawText.slice(0, 300),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SMS gateway dispatch error';
      return res.status(500).json({success: false, error: message});
    }
  });

  if (!isProduction) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shopkhata BD server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

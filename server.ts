import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Google Sheets Auth
const sanitizeEnv = (val?: string) => val?.replace(/^"(.*)"$/, '$1').trim();

const getGoogleAuth = () => {
  let privateKey = sanitizeEnv(process.env.GOOGLE_PRIVATE_KEY);
  const serviceAccountEmail = sanitizeEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  
  if (!privateKey || !serviceAccountEmail) {
    return null;
  }

  // 0. Check if it's a JSON string (sometimes users paste the whole JSON file)
  if (privateKey.trim().startsWith('{')) {
    try {
      const json = JSON.parse(privateKey);
      if (json.private_key) privateKey = json.private_key;
    } catch (e) { /* ignore */ }
  }

  // 1. Handle escaped newlines and quotes
  privateKey = privateKey.replace(/\\n/g, '\n');

  // 2. PEM Normalization: Ensure the key has proper newlines and structure
  // This fixes issues where the key might be a single line or have extra spaces
  const normalizePem = (key: string, header: string, footer: string) => {
    if (key.includes(header) && key.includes(footer)) {
      const body = key
        .split(header)[1]
        .split(footer)[0]
        .replace(/\s/g, ''); // Remove all whitespace/newlines from body
      const lines = body.match(/.{1,64}/g) || [];
      return `${header}\n${lines.join('\n')}\n${footer}\n`;
    }
    return key;
  };

  if (privateKey.includes('BEGIN PRIVATE KEY')) {
    privateKey = normalizePem(privateKey, '-----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----');
  } else if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    privateKey = normalizePem(privateKey, '-----BEGIN RSA PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----');
  }

  // 3. Ensure the key is trimmed
  privateKey = privateKey.trim();

  try {
    // Using the JWT constructor with an options object
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    return auth;
  } catch (error) {
    console.error("Error creating Google Auth JWT:", error);
    return null;
  }
};

const SPREADSHEET_ID = sanitizeEnv(process.env.GOOGLE_SHEET_ID);

const getSheetsClient = () => {
  const auth = getGoogleAuth();
  if (!auth) return null;
  return google.sheets({ version: 'v4', auth });
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/debug", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    if (!sheets) {
      throw new Error("Google Sheets client not initialized. Check environment variables.");
    }
    const test = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID! });
    res.json({
      auth: "success",
      title: test.data.properties?.title,
      sheets: test.data.sheets?.map(s => s.properties?.title),
      env: {
        hasSheetId: !!SPREADSHEET_ID,
        hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasKey: !!process.env.GOOGLE_PRIVATE_KEY,
      }
    });
  } catch (error: any) {
    res.status(500).json({
      auth: "failed",
      error: error.message,
      env: {
        hasSheetId: !!SPREADSHEET_ID,
        hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasKey: !!process.env.GOOGLE_PRIVATE_KEY,
      }
    });
  }
});

// Get Stats from Google Sheets
app.get("/api/stats", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    if (!sheets || !SPREADSHEET_ID) {
      console.warn("Google Sheets not configured, skipping stats fetch.");
      return res.json({});
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'dashboard_stats!A2:C',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({});
    }

    const stats: Record<string, any> = {};
    rows.forEach(row => {
      stats[row[0]] = row[1];
    });

    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching stats:", error.message);
    if (error.message.includes('DECODER routines::unsupported')) {
      console.error("CRITICAL: Google Private Key is in an unsupported format. Ensure it is a valid PEM (PKCS#8) key.");
    }
    res.status(500).json({ error: error.message });
  }
});

// Update Stats in Google Sheets
app.post("/api/stats", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    if (!sheets || !SPREADSHEET_ID) {
      return res.json({ success: false, message: "Google Sheets not configured" });
    }
    
    const stats = req.body;
    const values = Object.entries(stats).map(([key, value]) => [
      key,
      value,
      new Date().toISOString()
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'dashboard_stats!A2',
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating stats:", error.message);
    if (error.message.includes('DECODER routines::unsupported')) {
      console.error("CRITICAL: Google Private Key is in an unsupported format. Ensure it is a valid PEM (PKCS#8) key.");
    }
    res.status(500).json({ error: error.message });
  }
});

// Append Log to Google Sheets
app.post("/api/logs", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    if (!sheets || !SPREADSHEET_ID) {
      return res.json({ success: false, message: "Google Sheets not configured" });
    }
    
    const log = req.body;
    const values = [[
      log.id,
      log.user,
      log.details,
      log.network,
      log.value,
      log.date,
      log.type,
      log.status || 'مكتمل'
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'activity_log!A2',
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error appending log:", error.message);
    if (error.message.includes('DECODER routines::unsupported')) {
      console.error("CRITICAL: Google Private Key is in an unsupported format. Ensure it is a valid PEM (PKCS#8) key.");
    }
    res.status(500).json({ error: error.message });
  }
});

// Sync all data to backup sheets
app.post("/api/sync", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    if (!sheets || !SPREADSHEET_ID) {
      return res.json({ success: false, message: "Google Sheets not configured" });
    }
    
    const { type, data } = req.body;
    if (!type || !data || !Array.isArray(data)) {
      console.error(`Invalid sync request for ${type}:`, req.body);
      return res.status(400).json({ error: "Invalid data format" });
    }

    console.log(`Syncing ${type} with ${data.length} items`);
    
    let range = '';
    let values: any[][] = [];

    switch (type) {
      case 'users':
        range = 'users!A2';
        values = data.map((u: any) => [u.id, u.fullName, u.email || '', u.role, u.pointsBalance, u.isActive, u.createdAt]);
        break;
      case 'agents':
        range = 'agents!A2';
        values = data.map((a: any) => [a.id, a.fullName, a.networkName, a.profitPercentage, a.isActive]);
        break;
      case 'categories':
        range = 'categories!A2';
        values = data.map((c: any) => [c.id, c.agentId, c.name, c.pointsPrice, c.isActive]);
        break;
      case 'cards':
        range = 'cards!A2';
        values = data.map((c: any) => [c.id, c.categoryId, c.status, c.createdAt]);
        break;
      case 'orders':
        range = 'orders!A2';
        values = data.map((o: any) => [o.id, o.pointsUsed, o.masterProfit, o.agentEarnings, o.createdAt]);
        break;
      case 'points_requests':
        range = 'points_requests!A2';
        values = data.map((r: any) => [r.id, r.amount, r.status, r.createdAt]);
        break;
      case 'settlements':
        range = 'settlements!A2';
        values = data.map((s: any) => [s.id, s.agentEarnings, s.status, s.createdAt]);
        break;
      default:
        return res.status(400).json({ error: `Unknown sync type: ${type}` });
    }

    if (range && values.length > 0) {
      console.log(`Clearing and updating ${range}...`);
      // Clear existing data first
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${type}!A2:Z`,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
      console.log(`Sync for ${type} completed successfully`);
    } else {
      console.log(`No data to sync for ${type}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(`Error syncing ${req.body?.type}:`, error.message);
    if (error.message.includes('DECODER routines::unsupported')) {
      console.error("CRITICAL: Google Private Key is in an unsupported format. Ensure it is a valid PEM (PKCS#8) key.");
    }
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

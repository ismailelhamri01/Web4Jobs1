import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as XLSX from "xlsx";

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const parsePercentageValue = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const hasPercentSign = raw.includes("%");
  const normalized = raw
    .replace(/\s/g, "")
    .replace("%", "")
    .replace(",", ".");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  if (hasPercentSign) return parsed;
  if (parsed >= 0 && parsed <= 1) return parsed * 100;
  return parsed;
};

// 🔥 دالة جديدة لجلب أسماء كل التبويبات (Tabs) واختيار أحدث واحد تلقائياً
type SpreadsheetMetadata = {
  sheets?: Array<{
    properties?: {
      title?: string;
    };
  }>;
};

const getLatestSheetTabName = async (spreadsheetId: string, apiKey: string): Promise<string> => {
  const params = new URLSearchParams({
    key: apiKey,
    fields: "sheets.properties.title",
  });
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error("Unable to fetch spreadsheet metadata.") as Error & { status?: number; detail?: string };
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json() as SpreadsheetMetadata;
  const tabNames = payload.sheets
    ?.map((sheet) => sheet.properties?.title?.trim())
    .filter((name): name is string => Boolean(name)) || [];

  if (tabNames.length === 0) {
    throw new Error("No sheet tabs were found in the Google Spreadsheet.");
  }
  
  // اختيار التبويب الأخير (أحدث تاريخ فـ الجدول ديالك)
  return tabNames[tabNames.length - 1];
};

const toA1SheetRange = (sheetName: string, columns = "A:Z") => {
  const escapedSheetName = sheetName.replace(/'/g, "''");
  return `'${escapedSheetName}'!${columns}`;
};

const getSheetValues = async (spreadsheetId: string, apiKey: string, range: string) => {
  const params = new URLSearchParams({
    key: apiKey,
    majorDimension: "ROWS",
  });
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error("Unable to read Google Sheets data.") as Error & { status?: number; detail?: string };
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json() as { values?: unknown[][] };
  return payload.values || [];
};

const parseCsvRows = (csv: string) => {
  const workbook = XLSX.read(csv, { type: "string" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    blankrows: false,
    raw: false,
  }) as unknown[][];
};

const fetchPublicCsv = async (url: string) => {
  const response = await fetch(url);
  const csv = await response.text();
  const looksLikeHtml = csv.trim().startsWith("<!DOCTYPE html") || csv.trim().startsWith("<html");

  if (!response.ok || looksLikeHtml) {
    const error = new Error("Unable to read public Google Sheets CSV.") as Error & { status?: number; code?: string };
    error.status = response.status || 403;
    error.code = "publicAccessRequired";
    throw error;
  }

  return csv;
};

const getPublicSheetValues = async (spreadsheetId: string, gid: string) => {
  const params = new URLSearchParams({
    format: "csv",
  });

  if (gid) params.set("gid", gid);

  const exportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?${params}`;

  try {
    return parseCsvRows(await fetchPublicCsv(exportUrl));
  } catch (firstError) {
    const gvizParams = new URLSearchParams({
      tqx: "out:csv",
    });

    if (gid) gvizParams.set("gid", gid);

    const gvizUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?${gvizParams}`;

    try {
      return parseCsvRows(await fetchPublicCsv(gvizUrl));
    } catch {
      throw firstError;
    }
  }
};

const findHeaderIndex = (headers: unknown[], names: string[]) => {
  const normalizedNames = names.map(normalizeHeader);
  return headers.findIndex((header) => normalizedNames.some((name) => normalizeHeader(header).includes(name)));
};

const findSheetColumns = (rows: unknown[][], cityColumn: string, percentageColumn: string, requireCity = true) => {
  const cityCandidates = [cityColumn, "Centre", "City", "Ville"];
  const percentageCandidates = [
    percentageColumn,
    "Pourcentage de completion de la certification 1",
    "Pourcentage de complétion de la certification 1",
    "% Pourcentage de completion de la certification 1",
    "% Pourcentage de complétion de la certification 1",
    "Completion percentage",
    "Certification 1 progress",
    "Progress",
    "Avancement",
  ];

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const headers = rows[rowIndex] || [];
    const cityIndex = findHeaderIndex(headers, cityCandidates);
    const percentageIndex = findHeaderIndex(headers, percentageCandidates);

    if (percentageIndex !== -1 && (!requireCity || cityIndex !== -1)) {
      return { headerRowIndex: rowIndex, cityIndex, percentageIndex };
    }
  }

  return null;
};

const getSingleQueryValue = (value: unknown) => {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes
  app.get("/api/sheets/certification-1-average", async (_req, res) => {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    const cityColumn = process.env.GOOGLE_SHEETS_CITY_COLUMN || "Centre";
    const columnName = process.env.GOOGLE_SHEETS_PERCENTAGE_COLUMN
      || process.env.GOOGLE_SHEETS_CERTIFICATION_COLUMN
      || "Pourcentage de complétion de la certification 1";

    if (!spreadsheetId || !apiKey) {
      return res.status(503).json({
        code: "configMissing",
        error: "Google Sheets is not configured.",
      });
    }

    try {
      // 🔥 تحديث ديناميكي: كيجيب أحدث تبويب بوحدو
      const latestSheetName = await getLatestSheetTabName(spreadsheetId, apiKey);
      const rows = await getSheetValues(spreadsheetId, apiKey, toA1SheetRange(latestSheetName));
      const columns = findSheetColumns(rows, cityColumn, columnName);

      if (!columns) {
        return res.status(404).json({ error: `Columns "${cityColumn}" and "${columnName}" were not found in the Google Sheet.` });
      }

      const values = rows
        .slice(columns.headerRowIndex + 1)
        .map((row) => parsePercentageValue(row[columns.percentageIndex]))
        .filter((value): value is number => value !== null);

      if (values.length === 0) {
        return res.status(404).json({ error: `No numeric percentage values found in "${columnName}".` });
      }

      const average = values.reduce((sum, value) => sum + value, 0) / values.length;

      res.json({
        column: columnName,
        average,
        averageRounded: Math.round(average),
        count: values.length,
      });
    } catch (error) {
      console.error("Google Sheets average calculation failed", error);
      const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
      res.status(status || 500).json({ error: "Failed to calculate the Certification 1 average." });
    }
  });

  app.get("/api/sheets/city-progress", async (req, res) => {
    const querySpreadsheetId = getSingleQueryValue(req.query.spreadsheetId);
    const spreadsheetId = querySpreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    const gid = getSingleQueryValue(req.query.gid);
    const cityColumn = getSingleQueryValue(req.query.cityColumn) || process.env.GOOGLE_SHEETS_CITY_COLUMN || "Centre";
    const requestedCity = getSingleQueryValue(req.query.city);
    const percentageColumn = getSingleQueryValue(req.query.percentageColumn) || process.env.GOOGLE_SHEETS_PERCENTAGE_COLUMN
      || process.env.GOOGLE_SHEETS_CERTIFICATION_COLUMN
      || "Pourcentage de complétion de la certification 1";

    if (!spreadsheetId) {
      return res.status(503).json({
        code: "configMissing",
        error: "Google Sheets is not configured.",
      });
    }

    if (!querySpreadsheetId && !apiKey) {
      return res.status(503).json({
        code: "configMissing",
        error: "Google Sheets is not configured.",
      });
    }

    try {
      let rows: unknown[][] = [];
      
      if (querySpreadsheetId) {
        rows = await getPublicSheetValues(spreadsheetId, gid);
      } else {
        // 🔥 تحديث ديناميكي: كيجيب أحدث تاريخ أوتوماتيكياً فاش كتبرك على زر التزامن
        const latestSheetName = await getLatestSheetTabName(spreadsheetId, apiKey || "");
        rows = await getSheetValues(spreadsheetId, apiKey || "", toA1SheetRange(latestSheetName));
      }

      const columns = findSheetColumns(rows, cityColumn, percentageColumn, !requestedCity);

      if (!columns) {
        return res.status(404).json({
          code: "columnsMissing",
          error: `Columns "${cityColumn}" and "${percentageColumn}" were not found in the Google Sheet.`,
        });
      }

      const grouped = new Map<string, number[]>();

      rows.slice(columns.headerRowIndex + 1).forEach((row) => {
        const rowCity = columns.cityIndex === -1 ? "" : String(row[columns.cityIndex] ?? "").trim();
        if (requestedCity && rowCity && normalizeHeader(rowCity) !== normalizeHeader(requestedCity)) return;

        const city = requestedCity || rowCity;
        const progress = parsePercentageValue(row[columns.percentageIndex]);

        if (!city || progress === null) return;

        const values = grouped.get(city) || [];
        values.push(progress);
        grouped.set(city, values);
      });

      if (grouped.size === 0) {
        return res.status(404).json({
          code: "noProgressValues",
          error: `No numeric percentage values found in "${percentageColumn}".`,
        });
      }

      const cities = Array.from(grouped.entries()).map(([city, values]) => {
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const averageRounded = Math.round(average);

        return {
          city,
          average,
          averageRounded,
          progress: average / 100,
          count: values.length,
          status: average >= 70 ? "Terminé" : "En cours",
        };
      });

      res.json({
        cities,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Google Sheets city progress calculation failed", error);
      const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
      const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
      res.status(status || 500).json({
        code,
        error: "Failed to calculate city progress from Google Sheets.",
      });
    }
  });

  app.post("/api/contact", (req, res) => {
    const { email, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    console.log(`Sending email to i.eloutar@web4jobs.ma from ${email}: ${message}`);

    setTimeout(() => {
      res.json({ success: true, message: "Message envoyé avec succès" });
    }, 1000);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

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
  const exportParams = new URLSearchParams({ format: "csv" });
  if (gid) exportParams.set("gid", gid);

  const exportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?${exportParams}`;

  try {
    return parseCsvRows(await fetchPublicCsv(exportUrl));
  } catch (firstError) {
    const gvizParams = new URLSearchParams({ tqx: "out:csv" });
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

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const spreadsheetId = getSingleQueryValue(req.query.spreadsheetId);
  const gid = getSingleQueryValue(req.query.gid);
  const cityColumn = getSingleQueryValue(req.query.cityColumn) || "Centre";
  const requestedCity = getSingleQueryValue(req.query.city);
  const percentageColumn = getSingleQueryValue(req.query.percentageColumn)
    || "Pourcentage de complétion de la certification 1";

  if (!spreadsheetId) {
    return res.status(503).json({
      code: "configMissing",
      error: "Google Sheets is not configured.",
    });
  }

  try {
    const rows = await getPublicSheetValues(spreadsheetId, gid);
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
        status: average >= 70 ? "TerminÃ©" : "En cours",
      };
    });

    return res.status(200).json({
      cities,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
    const code = error instanceof Error && "code" in error ? String(error.code) : undefined;

    return res.status(status || 500).json({
      code,
      error: "Failed to calculate city progress from Google Sheets.",
    });
  }
}

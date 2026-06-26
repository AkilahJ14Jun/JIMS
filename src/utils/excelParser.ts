import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────
export interface JIMSBusinessRecord {
  // Core tracking
  inwardDate: string | null;
  invoiceDate: string | null;
  // Classification
  category: string;           // Bangle, Ring, Bracelet, etc.
  subCategory: string;        // Variety within category
  metalType: string;          // Gold, Silver, Diamond, Platinum, etc.
  weightRange: string;        // e.g., "5-10g", "10-15g"
  styleCode: string;          // Design identifier
  grossWeight: number;        // Total weight in grams
  diamondWeight: number;      // Diamond weight in carats (0 if none)
  // Additional fields often in jewelry data
  purity?: string;            // e.g., 22K, 18K, 925
  netWeight?: number;
  stoneWeight?: number;
  makingCharges?: number;
  amount?: number;
  // Derived
  daysInStock: number;        // computed from inward to invoice
  isSold: boolean;            // true if invoice date exists
  weightBucket: string;       // normalized weight bucket
}

export interface ParseResult {
  records: JIMSBusinessRecord[];
  totalRows: number;
  uniqueCategories: string[];
  uniqueSubCategories: string[];
  uniqueMetals: string[];
  uniqueWeightRanges: string[];
  uniqueStyleCodes: string[];
  earliestDate: string | null;
  latestDate: string | null;
  soldCount: number;
  inStockCount: number;
  errors: string[];
  columnMapping: Record<string, string>;
}

// ─── Column Name Detection ──────────────────────────────
// Fuzzy match column names - handles case/spacing variations
function findColumn(headers: string[], patterns: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[_\s-]+/g, ''));
  for (const pattern of patterns) {
    const p = pattern.toLowerCase().replace(/[_\s-]+/g, '');
    // Exact match first
    const exact = normalized.findIndex((h) => h === p);
    if (exact >= 0) return headers[exact];
    // Contains match
    const contains = normalized.findIndex((h) => h.includes(p) || p.includes(h));
    if (contains >= 0) return headers[contains];
  }
  return null;
}

// ─── Parse Date (Excel serial or string) ────────────────
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(value).trim();
  if (!str) return null;
  // Try parsing as ISO
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[,₹\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// ─── Weight Bucket Normalization ────────────────────────
function normalizeWeightBucket(weightRange: string, grossWeight: number): string {
  // Use explicit weight range if provided
  if (weightRange) return weightRange;
  // Otherwise bucket by gross weight
  if (grossWeight <= 0) return 'Unknown';
  if (grossWeight < 2) return '0-2g';
  if (grossWeight < 5) return '2-5g';
  if (grossWeight < 10) return '5-10g';
  if (grossWeight < 15) return '10-15g';
  if (grossWeight < 20) return '15-20g';
  if (grossWeight < 25) return '20-25g';
  if (grossWeight < 30) return '25-30g';
  if (grossWeight < 40) return '30-40g';
  if (grossWeight < 50) return '40-50g';
  if (grossWeight < 75) return '50-75g';
  if (grossWeight < 100) return '75-100g';
  return '100g+';
}

// ─── Main Parse Function ────────────────────────────────
export function parseExcelFile(data: ArrayBuffer | Uint8Array): ParseResult {
  const errors: string[] = [];
  const records: JIMSBusinessRecord[] = [];

  try {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

    // Get first non-empty sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        records: [],
        totalRows: 0,
        uniqueCategories: [],
        uniqueSubCategories: [],
        uniqueMetals: [],
        uniqueWeightRanges: [],
        uniqueStyleCodes: [],
        earliestDate: null,
        latestDate: null,
        soldCount: 0,
        inStockCount: 0,
        errors: ['No sheets found in workbook'],
        columnMapping: {},
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    if (rows.length === 0) {
      return {
        records: [],
        totalRows: 0,
        uniqueCategories: [],
        uniqueSubCategories: [],
        uniqueMetals: [],
        uniqueWeightRanges: [],
        uniqueStyleCodes: [],
        earliestDate: null,
        latestDate: null,
        soldCount: 0,
        inStockCount: 0,
        errors: ['Sheet is empty'],
        columnMapping: {},
      };
    }

    // Detect columns
    const headers = Object.keys(rows[0]);
    const columnMapping: Record<string, string> = {};

    const inwardCol = findColumn(headers, ['inward date', 'inwarddate', 'inward_date', 'date inward', 'received date', 'receipt date']);
    const invoiceCol = findColumn(headers, ['invoice date', 'invoicedate', 'invoice_date', 'sale date', 'saledate', 'date of sale', 'sold date']);
    const categoryCol = findColumn(headers, ['category', 'item type', 'itemtype', 'product type', 'type']);
    const subCategoryCol = findColumn(headers, ['sub category', 'subcategory', 'sub_category', 'variety', 'design', 'pattern']);
    const metalCol = findColumn(headers, ['metal type', 'metaltype', 'metal_type', 'metal', 'material']);
    const weightRangeCol = findColumn(headers, ['weight range', 'weightrange', 'weight_range', 'weight category']);
    const styleCodeCol = findColumn(headers, ['style code', 'stylecode', 'style_code', 'design code', 'code', 'sku']);
    const grossWeightCol = findColumn(headers, ['gross weight', 'grossweight', 'gross_weight', 'weight', 'total weight', 'wt']);
    const diamondWeightCol = findColumn(headers, ['diamond weight', 'diamondweight', 'diamond_weight', 'diamond wt', 'diamond']);
    const purityCol = findColumn(headers, ['purity', 'karat', 'kt', 'carat']);
    const netWeightCol = findColumn(headers, ['net weight', 'netweight', 'net_weight']);
    const stoneWeightCol = findColumn(headers, ['stone weight', 'stoneweight', 'stone_weight']);
    const makingChargesCol = findColumn(headers, ['making charges', 'makingcharges', 'making_charges', 'making']);
    const amountCol = findColumn(headers, ['amount', 'price', 'value', 'total amount', 'sale value']);

    columnMapping['Inward Date'] = inwardCol || 'Not Found';
    columnMapping['Invoice Date'] = invoiceCol || 'Not Found';
    columnMapping['Category'] = categoryCol || 'Not Found';
    columnMapping['Sub Category'] = subCategoryCol || 'Not Found';
    columnMapping['Metal Type'] = metalCol || 'Not Found';
    columnMapping['Weight Range'] = weightRangeCol || 'Not Found';
    columnMapping['Style Code'] = styleCodeCol || 'Not Found';
    columnMapping['Gross Weight'] = grossWeightCol || 'Not Found';
    columnMapping['Diamond Weight'] = diamondWeightCol || 'Not Found';

    if (!inwardCol) errors.push('⚠️ "Inward date" column not found');
    if (!categoryCol) errors.push('⚠️ "Category" column not found');
    if (!metalCol) errors.push('⚠️ "Metal type" column not found');

    // Track unique values
    const categoriesSet = new Set<string>();
    const subCategoriesSet = new Set<string>();
    const metalsSet = new Set<string>();
    const weightRangesSet = new Set<string>();
    const styleCodesSet = new Set<string>();
    let earliestDate: string | null = null;
    let latestDate: string | null = null;
    let soldCount = 0;
    let inStockCount = 0;

    // Parse rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const inwardDate = inwardCol ? parseDate(row[inwardCol]) : null;
        const invoiceDate = invoiceCol ? parseDate(row[invoiceCol]) : null;
        const category = categoryCol ? cleanString(row[categoryCol]) : '';
        const subCategory = subCategoryCol ? cleanString(row[subCategoryCol]) : '';
        const metalType = metalCol ? cleanString(row[metalCol]) : '';
        const weightRange = weightRangeCol ? cleanString(row[weightRangeCol]) : '';
        const styleCode = styleCodeCol ? cleanString(row[styleCodeCol]) : '';
        const grossWeight = grossWeightCol ? parseNumber(row[grossWeightCol]) : 0;
        const diamondWeight = diamondWeightCol ? parseNumber(row[diamondWeightCol]) : 0;
        const purity = purityCol ? cleanString(row[purityCol]) : '';
        const netWeight = netWeightCol ? parseNumber(row[netWeightCol]) : 0;
        const stoneWeight = stoneWeightCol ? parseNumber(row[stoneWeightCol]) : 0;
        const makingCharges = makingChargesCol ? parseNumber(row[makingChargesCol]) : 0;
        const amount = amountCol ? parseNumber(row[amountCol]) : 0;

        // Skip empty rows
        if (!category && !inwardDate && !metalType) continue;

        // Compute days in stock
        let daysInStock = 0;
        const isSold = !!invoiceDate;
        if (inwardDate) {
          const start = new Date(inwardDate);
          const end = invoiceDate ? new Date(invoiceDate) : new Date();
          daysInStock = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        }

        // Track unique values
        if (category) categoriesSet.add(category);
        if (subCategory) subCategoriesSet.add(subCategory);
        if (metalType) metalsSet.add(metalType);
        const bucket = normalizeWeightBucket(weightRange, grossWeight);
        if (bucket) weightRangesSet.add(bucket);
        if (styleCode) styleCodesSet.add(styleCode);

        if (inwardDate) {
          if (!earliestDate || inwardDate < earliestDate) earliestDate = inwardDate;
          if (!latestDate || inwardDate > latestDate) latestDate = inwardDate;
        }
        if (invoiceDate) {
          if (!earliestDate || invoiceDate < earliestDate) earliestDate = invoiceDate;
          if (!latestDate || invoiceDate > latestDate) latestDate = invoiceDate;
        }

        if (isSold) soldCount++;
        else if (inwardDate) inStockCount++;

        records.push({
          inwardDate,
          invoiceDate,
          category: category || 'Uncategorized',
          subCategory: subCategory || 'Standard',
          metalType: metalType || 'Unknown',
          weightRange: bucket,
          styleCode: styleCode || 'N/A',
          grossWeight,
          diamondWeight,
          purity,
          netWeight: netWeight || grossWeight,
          stoneWeight,
          makingCharges,
          amount,
          daysInStock,
          isSold,
          weightBucket: bucket,
        });
      } catch (err) {
        errors.push(`Row ${i + 2}: ${(err as Error).message}`);
      }
    }

    return {
      records,
      totalRows: rows.length,
      uniqueCategories: Array.from(categoriesSet).sort(),
      uniqueSubCategories: Array.from(subCategoriesSet).sort(),
      uniqueMetals: Array.from(metalsSet).sort(),
      uniqueWeightRanges: Array.from(weightRangesSet).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
      }),
      uniqueStyleCodes: Array.from(styleCodesSet).sort(),
      earliestDate,
      latestDate,
      soldCount,
      inStockCount,
      errors,
      columnMapping,
    };
  } catch (err) {
    return {
      records: [],
      totalRows: 0,
      uniqueCategories: [],
      uniqueSubCategories: [],
      uniqueMetals: [],
      uniqueWeightRanges: [],
      uniqueStyleCodes: [],
      earliestDate: null,
      latestDate: null,
      soldCount: 0,
      inStockCount: 0,
      errors: [`Parse error: ${(err as Error).message}`],
      columnMapping: {},
    };
  }
}

// ─── Fetch from GitHub ──────────────────────────────────
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/AkilahJ14Jun/JIMS/main/biz_plan.xlsx';

export async function fetchGitHubExcel(): Promise<ArrayBuffer> {
  const response = await fetch(GITHUB_RAW_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

export const EXCEL_SOURCE_URL = GITHUB_RAW_URL;

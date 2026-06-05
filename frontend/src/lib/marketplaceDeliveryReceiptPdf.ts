import jsPDF from "jspdf";
import type { DeliveryAddress, MarketplaceOrder } from "@/contexts/OrderContext";
import { formatDeliveryAddressLines } from "@/contexts/OrderContext";
import { VENDOR_THEME } from "@/lib/vendorTheme";
import { ICON_COLORS } from "@/lib/iconColors";

export type DeliveryReceiptSellerInfo = {
  shopName: string;
  sellerName: string;
  phone?: string;
  location?: string;
};

export type DeliveryReceiptItem = {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type DeliveryReceiptDraft = {
  orderId: string;
  orderDate: string;
  buyerName: string;
  items: DeliveryReceiptItem[];
  total: number;
  shippingFee: number;
  paymentMethod: string;
  paymentStatus: string;
  trackingId?: string;
  seller: DeliveryReceiptSellerInfo;
  delivery: DeliveryAddress;
};

export type DeliveryReceiptTheme = {
  primary: string;
  primaryDark: string;
};

const PAGE_WIDTH_MM = 250;
const MIN_PAGE_HEIGHT_MM = 100;
const MAX_PAGE_HEIGHT_MM = 210;
const FOOTER_H = 14;
const HEADER_H = 10;
const BODY_TOP = 12;
const COL_TITLE_H = 5;
const CONTENT_START_OFFSET = 8;
const COLUMNS_GAP = 4;
const TABLE_TOP_GAP = 2;
const PRODUCTS_TITLE_H = 5;
const TABLE_HEADER_GAP = 5;
const TABLE_HEADER_H = 6;
const ROW_H = 5;
const TOTALS_GAP = 2;
const TOTALS_ROW_H = 4;
const ADDRESS_LINE_H = 3.2;
const ML = 8;

const DEFAULT_THEME: DeliveryReceiptTheme = {
  primary: VENDOR_THEME.primary,
  primaryDark: VENDOR_THEME.primaryDark,
};

const ADMIN_THEME: DeliveryReceiptTheme = {
  primary: ICON_COLORS.farm,
  primaryDark: "#059669",
};

type FromField = { label: string; value: string; lines: string[] };

type ReceiptLayout = {
  page1Height: number;
  page2Needed: boolean;
  page2Height: number;
  columnsContentH: number;
  page1FromFields: FromField[];
  page1ToLines: string[];
  page2FromFields: FromField[];
  page2ToLines: string[];
  page1Products: DeliveryReceiptItem[];
  page2Products: DeliveryReceiptItem[];
  page1OverflowSummary: number;
  page2OverflowSummary: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function orderRef(orderId: string): string {
  return orderId.slice(0, 10).toUpperCase();
}

export function orderToDeliveryReceiptDraft(
  order: MarketplaceOrder,
  sellerInfo: DeliveryReceiptSellerInfo,
): DeliveryReceiptDraft {
  return {
    orderId: order.id,
    orderDate: order.date,
    buyerName: order.buyerName,
    items: order.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPrice: item.price,
      lineTotal: item.price * item.qty,
    })),
    total: order.total,
    shippingFee: order.shippingFee,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    trackingId: order.trackingId,
    seller: { ...sellerInfo },
    delivery: { ...order.deliveryAddress },
  };
}

function itemCount(draft: DeliveryReceiptDraft): number {
  return draft.items.reduce((s, i) => s + i.qty, 0);
}

/** ASCII-safe amounts for jsPDF Helvetica (no Unicode taka symbol). */
function formatReceiptPdfAmount(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `BDT ${n.toLocaleString("en-US")}`;
}

function paymentLine(draft: DeliveryReceiptDraft): string {
  const total = formatReceiptPdfAmount(draft.total);
  if (draft.paymentMethod === "cash_on_delivery") {
    return `Payment: Cash on Delivery - Collect ${total}`;
  }
  if (draft.paymentStatus === "paid") {
    return `Payment: Paid - Total ${total}`;
  }
  return `Payment: ${draft.paymentMethod.replace(/_/g, " ")} - Total ${total}`;
}

function createMeasureDoc(): jsPDF {
  return new jsPDF({ unit: "mm", format: [PAGE_WIDTH_MM, MIN_PAGE_HEIGHT_MM], orientation: "landscape" });
}

function colWidth(pw = PAGE_WIDTH_MM): number {
  return (pw - ML * 2 - 6) / 2;
}

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text.trim()) return ["-"];
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function buildFromFields(doc: jsPDF, draft: DeliveryReceiptDraft, maxWidth: number): FromField[] {
  const specs = [
    { label: "Shop", value: draft.seller.shopName },
    { label: "Seller", value: draft.seller.sellerName },
    { label: "Phone", value: draft.seller.phone || "-" },
    { label: "Pickup", value: draft.seller.location || "-" },
  ];
  return specs.map((s) => ({
    label: s.label,
    value: s.value,
    lines: wrapLines(doc, s.value, maxWidth),
  }));
}

function buildToFlatLines(doc: jsPDF, draft: DeliveryReceiptDraft, maxWidth: number): string[] {
  const parts = deliveryToParts(draft);
  const flat: string[] = [];
  for (const part of parts) {
    const lines = wrapLines(doc, part, maxWidth);
    flat.push(...lines);
  }
  return flat;
}

function measureFromFieldsHeight(fields: FromField[], count = fields.length): number {
  let y = 0;
  for (let i = 0; i < count; i += 1) {
    const field = fields[i];
    y += 2.8 + field.lines.length * ADDRESS_LINE_H + 0.5;
  }
  return y;
}

function measureToLinesHeight(lines: string[]): number {
  if (lines.length === 0) return 0;
  return lines.length * ADDRESS_LINE_H + 0.3;
}

function addressContentHeight(fromFields: FromField[], fromCount: number, toLines: string[]): number {
  return Math.max(measureFromFieldsHeight(fromFields, fromCount), measureToLinesHeight(toLines));
}

function totalsBlockHeight(shippingFee: number): number {
  const rows = 2 + (shippingFee > 0 ? 1 : 0);
  return TOTALS_GAP + rows * TOTALS_ROW_H + 3;
}

function productTableChromeHeight(rowCount: number, includeEmptyRow: boolean): number {
  let h = PRODUCTS_TITLE_H + TABLE_HEADER_GAP + TABLE_HEADER_H;
  h += rowCount * ROW_H;
  if (includeEmptyRow) h += ROW_H;
  return h;
}

function pageHeightFor(
  addressH: number,
  productRows: number,
  itemsEmpty: boolean,
  shippingFee: number,
  includeOverflowRow: boolean,
): number {
  const rowCount = productRows + (includeOverflowRow ? 1 : 0);
  const content =
    BODY_TOP +
    COL_TITLE_H +
    addressH +
    COLUMNS_GAP +
    TABLE_TOP_GAP +
    productTableChromeHeight(rowCount, itemsEmpty) +
    totalsBlockHeight(shippingFee) +
    FOOTER_H;
  return Math.max(MIN_PAGE_HEIGHT_MM, Math.ceil(content));
}

function fitAddressPrefix(
  fromFields: FromField[],
  toLines: string[],
  maxContentH: number,
): { fromCount: number; toCount: number; height: number } {
  let fromCount = fromFields.length;
  let toCount = toLines.length;

  while (fromCount > 0 || toCount > 0) {
    const height = addressContentHeight(fromFields, fromCount, toLines.slice(0, toCount));
    if (height <= maxContentH) return { fromCount, toCount, height };
    const fromH = measureFromFieldsHeight(fromFields, fromCount);
    const toH = measureToLinesHeight(toLines.slice(0, toCount));
    if (fromH >= toH && fromCount > 0) fromCount -= 1;
    else if (toCount > 0) toCount -= 1;
    else fromCount -= 1;
  }

  return { fromCount: 0, toCount: 0, height: 0 };
}

function computeReceiptLayout(draft: DeliveryReceiptDraft): ReceiptLayout {
  const doc = createMeasureDoc();
  const cw = colWidth() - 4;
  const fromFields = buildFromFields(doc, draft, cw);
  const allToLines = buildToFlatLines(doc, draft, cw);
  const fullAddressH = addressContentHeight(fromFields, fromFields.length, allToLines);

  const allProducts = draft.items;
  const itemsEmpty = allProducts.length === 0;

  const singlePageHeight = pageHeightFor(fullAddressH, allProducts.length, itemsEmpty, draft.shippingFee, false);

  if (singlePageHeight <= MAX_PAGE_HEIGHT_MM) {
    return {
      page1Height: singlePageHeight,
      page2Needed: false,
      page2Height: MIN_PAGE_HEIGHT_MM,
      columnsContentH: fullAddressH,
      page1FromFields: fromFields,
      page1ToLines: allToLines,
      page2FromFields: [],
      page2ToLines: [],
      page1Products: allProducts,
      page2Products: [],
      page1OverflowSummary: 0,
      page2OverflowSummary: 0,
    };
  }

  const fixedPage1 =
    BODY_TOP +
    COL_TITLE_H +
    COLUMNS_GAP +
    TABLE_TOP_GAP +
    PRODUCTS_TITLE_H +
    TABLE_HEADER_GAP +
    TABLE_HEADER_H +
    totalsBlockHeight(draft.shippingFee) +
    FOOTER_H;

  let addressBudget = MAX_PAGE_HEIGHT_MM - fixedPage1 - ROW_H;
  if (addressBudget < 10) addressBudget = 10;

  const addressFit = fitAddressPrefix(fromFields, allToLines, addressBudget);
  let page1From = fromFields.slice(0, addressFit.fromCount);
  let page1To = allToLines.slice(0, addressFit.toCount);
  let page2From = fromFields.slice(addressFit.fromCount);
  let page2To = allToLines.slice(addressFit.toCount);

  let page1AddressH = addressContentHeight(page1From, page1From.length, page1To);

  let productBudget =
    MAX_PAGE_HEIGHT_MM -
    BODY_TOP -
    COL_TITLE_H -
    page1AddressH -
    COLUMNS_GAP -
    TABLE_TOP_GAP -
    PRODUCTS_TITLE_H -
    TABLE_HEADER_GAP -
    TABLE_HEADER_H -
    totalsBlockHeight(draft.shippingFee) -
    FOOTER_H;

  let page1ProductSlots = Math.max(1, Math.floor(productBudget / ROW_H));
  if (allProducts.length === 0) page1ProductSlots = 0;

  let page1Products = allProducts.slice(0, page1ProductSlots);
  let page2Products = allProducts.slice(page1ProductSlots);
  let page1Overflow = 0;
  let page2Overflow = 0;

  if (page2Products.length > 0 && page1Products.length > 0) {
    page1Overflow = page2Products.length;
    page1Products = allProducts.slice(0, page1ProductSlots);
    page2Products = allProducts.slice(page1ProductSlots);
  } else if (page2Products.length > 0 && page1Products.length === 0 && allProducts.length > 0) {
    page1Products = [allProducts[0]];
    page2Products = allProducts.slice(1);
    page1Overflow = page2Products.length;
  }

  const page1Height = pageHeightFor(
    page1AddressH,
    page1Products.length,
    itemsEmpty,
    draft.shippingFee,
    page1Overflow > 0,
  );

  const page2AddressH =
    page2From.length > 0 || page2To.length > 0
      ? addressContentHeight(page2From, page2From.length, page2To) + 12
      : 12;

  const page2ProductRows = page2Products.length;
  const page2Chrome = page2ProductRows > 0 ? productTableChromeHeight(page2ProductRows, false) + 8 : 0;
  const page2Footer = 18;
  const page2Height = Math.max(
    MIN_PAGE_HEIGHT_MM,
    Math.min(MAX_PAGE_HEIGHT_MM, page2AddressH + page2Chrome + page2Footer),
  );

  return {
    page1Height: Math.min(MAX_PAGE_HEIGHT_MM, Math.ceil(page1Height)),
    page2Needed: page2From.length > 0 || page2To.length > 0 || page2Products.length > 0,
    page2Height,
    columnsContentH: page1AddressH,
    page1FromFields: page1From,
    page1ToLines: page1To,
    page2FromFields: page2From,
    page2ToLines: page2To,
    page1Products,
    page2Products,
    page1OverflowSummary: page1Overflow,
    page2OverflowSummary: 0,
  };
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = ADDRESS_LINE_H,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(33, 33, 33);
  const lines = wrapLines(doc, value, maxWidth);
  let cy = y + 2.8;
  for (const line of lines) {
    doc.text(line, x, cy);
    cy += lineHeight;
  }
  return cy + 0.5;
}

function drawFromFields(
  doc: jsPDF,
  fields: FromField[],
  x: number,
  y: number,
  maxWidth: number,
): number {
  let cy = y;
  for (const field of fields) {
    cy = drawLabelValue(doc, field.label, field.value, x, cy, maxWidth);
  }
  return cy;
}

function drawToLines(doc: jsPDF, lines: string[], x: number, y: number): number {
  let cy = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(33, 33, 33);
  for (const line of lines) {
    doc.text(line, x, cy);
    cy += ADDRESS_LINE_H;
  }
  return cy + 0.3;
}

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function deliveryToParts(draft: DeliveryReceiptDraft): string[] {
  const addr = draft.delivery;
  const addressLines = formatDeliveryAddressLines(addr);
  const landmarkAlreadyShown = addressLines.some((l) => l.startsWith("Landmark:"));
  return [
    addr.recipientName || draft.buyerName,
    `Phone: ${addr.phone || "-"}${addr.altPhone ? ` | Alt: ${addr.altPhone}` : ""}`,
    ...addressLines,
    !landmarkAlreadyShown && addr.landmark ? `Landmark: ${addr.landmark}` : "",
    addr.note ? `Note: ${addr.note}` : "",
  ].filter(Boolean);
}

/** Rows shown in UI preview (mirrors page-1 PDF layout). */
export function receiptProductRowsForDisplay(draft: DeliveryReceiptDraft): {
  rows: DeliveryReceiptItem[];
  overflowCount: number;
} {
  const layout = computeReceiptLayout(draft);
  const rows = layout.page1Products;
  const overflowCount = layout.page1OverflowSummary + layout.page2Products.length;
  return { rows, overflowCount };
}

type ProductCols = {
  num: number;
  product: number;
  qty: number;
  unitRight: number;
  totalRight: number;
};

function productCols(pw: number, mr: number): ProductCols {
  return {
    num: ML,
    product: ML + 8,
    qty: ML + 148,
    unitRight: ML + 186,
    totalRight: mr - 2,
  };
}

function drawProductTable(
  doc: jsPDF,
  draft: DeliveryReceiptDraft,
  theme: DeliveryReceiptTheme,
  layout: Pick<
    ReceiptLayout,
    "page1Products" | "page1OverflowSummary"
  >,
  tableTop: number,
  startIndex: number,
  options?: { showTitle?: boolean; products?: DeliveryReceiptItem[]; overflowCount?: number },
): number {
  const pw = doc.internal.pageSize.getWidth();
  const mr = pw - ML;
  const contentW = mr - ML;
  const [rd, gd, bd] = hexToRgb(theme.primaryDark);
  const products = options?.products ?? layout.page1Products;
  const overflowCount = options?.overflowCount ?? layout.page1OverflowSummary;
  const showTitle = options?.showTitle !== false;

  const cols = productCols(pw, mr);
  let y = tableTop;

  if (showTitle) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(rd, gd, bd);
    doc.text("Products", ML, y + 3);
    y += PRODUCTS_TITLE_H;
  }

  y += TABLE_HEADER_GAP - (showTitle ? 0 : PRODUCTS_TITLE_H);
  doc.setFillColor(rd, gd, bd);
  doc.rect(ML, y, contentW, TABLE_HEADER_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("#", cols.num + 1, y + 4);
  doc.text("Product", cols.product + 1, y + 4);
  doc.text("Qty", cols.qty + 1, y + 4);
  doc.text("Unit", cols.unitRight, y + 4, { align: "right" });
  doc.text("Total", cols.totalRight, y + 4, { align: "right" });
  y += TABLE_HEADER_H;

  const displayRowCount = products.length + (overflowCount > 0 ? 1 : 0);
  for (let i = 0; i < displayRowCount; i += 1) {
    if (i % 2 === 0) {
      doc.setFillColor(245, 248, 252);
      doc.rect(ML, y, contentW, ROW_H, "F");
    }
    const rowY = y + 3.5;
    doc.setFontSize(6);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");

    if (overflowCount > 0 && i === displayRowCount - 1) {
      doc.setFont("helvetica", "italic");
      doc.text("...", cols.num + 1, rowY);
      doc.text(`+${overflowCount} more item(s) - continued`, cols.product + 1, rowY);
    } else {
      const item = products[i];
      const rowNum = startIndex + i + 1;
      doc.text(`${rowNum}`, cols.num + 1, rowY);
      const nameLine = (wrapLines(doc, item.name, cols.qty - cols.product - 2)[0] || item.name) as string;
      doc.text(nameLine, cols.product + 1, rowY);
      doc.text(String(item.qty), cols.qty + 1, rowY);
      doc.text(formatReceiptPdfAmount(item.unitPrice), cols.unitRight, rowY, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(rd, gd, bd);
      doc.text(formatReceiptPdfAmount(item.lineTotal), cols.totalRight, rowY, { align: "right" });
      doc.setFont("helvetica", "normal");
    }
    y += ROW_H;
  }

  if (products.length === 0 && overflowCount === 0) {
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text("No line items", ML + 2, y + 3.5);
    y += ROW_H;
  }

  return y + TOTALS_GAP;
}

function drawTotals(
  doc: jsPDF,
  draft: DeliveryReceiptDraft,
  theme: DeliveryReceiptTheme,
  y: number,
): number {
  const pw = doc.internal.pageSize.getWidth();
  const mr = pw - ML;
  const [r, g, b] = hexToRgb(theme.primary);
  const [rd, gd, bd] = hexToRgb(theme.primaryDark);
  const subtotal = draft.items.reduce((s, i) => s + i.lineTotal, 0);
  const totalsX = mr - 62;
  const amountRight = mr - 2;
  const totalsRowCount = 2 + (draft.shippingFee > 0 ? 1 : 0);
  const totalsBoxH = totalsRowCount * TOTALS_ROW_H + 3;
  const totalsBoxTop = y - 1;

  doc.setFillColor(248, 251, 255);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX - 2, totalsBoxTop, mr - totalsX + 4, totalsBoxH, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(60, 60, 60);
  doc.text("Subtotal:", totalsX, y);
  doc.text(formatReceiptPdfAmount(subtotal), amountRight, y, { align: "right" });
  y += TOTALS_ROW_H;
  if (draft.shippingFee > 0) {
    doc.text("Shipping:", totalsX, y);
    doc.text(formatReceiptPdfAmount(draft.shippingFee), amountRight, y, { align: "right" });
    y += TOTALS_ROW_H;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(rd, gd, bd);
  doc.text("Grand total:", totalsX, y);
  doc.text(formatReceiptPdfAmount(draft.total), amountRight, y, { align: "right" });
  return y + 4;
}

function drawFooter(
  doc: jsPDF,
  draft: DeliveryReceiptDraft,
  theme: DeliveryReceiptTheme,
): void {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mr = pw - ML;
  const footerTop = ph - FOOTER_H;
  const [r, g, b] = hexToRgb(theme.primary);
  const [rd, gd, bd] = hexToRgb(theme.primaryDark);

  doc.setFillColor(245, 248, 252);
  doc.rect(0, footerTop, pw, FOOTER_H, "F");
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.4);
  doc.line(0, footerTop, pw, footerTop);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(rd, gd, bd);
  doc.text(paymentLine(draft), ML, footerTop + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 110, 120);
  doc.text("Hand to delivery partner - FarmBondhu marketplace token", ML, footerTop + 10);

  if (draft.trackingId) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(60, 60, 60);
    doc.text(`Tracking: ${draft.trackingId}`, mr, footerTop + 5, { align: "right" });
  }
}

function drawAddressColumns(
  doc: jsPDF,
  theme: DeliveryReceiptTheme,
  layout: Pick<ReceiptLayout, "page1FromFields" | "page1ToLines" | "columnsContentH">,
  bodyTop = BODY_TOP,
): number {
  const pw = doc.internal.pageSize.getWidth();
  const mr = pw - ML;
  const [rd, gd, bd] = hexToRgb(theme.primaryDark);
  const midX = pw / 2;
  const cw = colWidth(pw);
  const leftX = ML;
  const rightX = midX + 3;
  const columnsBottom = bodyTop + COL_TITLE_H + layout.columnsContentH + COLUMNS_GAP;

  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(midX, bodyTop, midX, columnsBottom);

  doc.setFillColor(rd, gd, bd);
  doc.rect(leftX, bodyTop, cw, COL_TITLE_H, "F");
  doc.rect(rightX, bodyTop, cw, COL_TITLE_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("FROM (Seller)", leftX + 2, bodyTop + 3.5);
  doc.text("DELIVER TO (Customer)", rightX + 2, bodyTop + 3.5);

  const contentY = bodyTop + CONTENT_START_OFFSET;
  drawFromFields(doc, layout.page1FromFields, leftX, contentY, cw - 4);
  drawToLines(doc, layout.page1ToLines, rightX, contentY);

  doc.setDrawColor(200, 210, 220);
  doc.line(ML, columnsBottom, mr, columnsBottom);
  return columnsBottom + TABLE_TOP_GAP;
}

function drawPageHeader(doc: jsPDF, draft: DeliveryReceiptDraft, theme: DeliveryReceiptTheme): void {
  const pw = doc.internal.pageSize.getWidth();
  const [r, g, b] = hexToRgb(theme.primary);
  const orderDate = formatOrderDate(draft.orderDate);

  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pw, HEADER_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DELIVERY HANDOVER RECEIPT", ML, 6.5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Order #${orderRef(draft.orderId)}`, pw - 72, 4.5);
  doc.text(`Date: ${orderDate}`, pw - 72, 8);
  doc.text(`Items: ${itemCount(draft)}`, pw - 28, 6.5, { align: "right" });
}

function addReceiptPage1(doc: jsPDF, draft: DeliveryReceiptDraft, theme: DeliveryReceiptTheme, layout: ReceiptLayout): void {
  drawPageHeader(doc, draft, theme);
  const tableTop = drawAddressColumns(doc, theme, layout);
  const afterProducts = drawProductTable(doc, draft, theme, layout, tableTop, 0);
  drawTotals(doc, draft, theme, afterProducts);
  drawFooter(doc, draft, theme);
}

function addReceiptPage2(doc: jsPDF, draft: DeliveryReceiptDraft, theme: DeliveryReceiptTheme, layout: ReceiptLayout): void {
  const pw = doc.internal.pageSize.getWidth();
  const [r, g, b] = hexToRgb(theme.primary);
  const [rd, gd, bd] = hexToRgb(theme.primaryDark);
  const cw = colWidth(pw);
  const leftX = ML;
  const rightX = pw / 2 + 3;
  let y = 10;

  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pw, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DELIVERY RECEIPT (continued)", ML, 5.5);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(`Order #${orderRef(draft.orderId)}`, pw - ML, 5.5, { align: "right" });

  y = 14;

  if (layout.page2FromFields.length > 0 || layout.page2ToLines.length > 0) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(rd, gd, bd);
    doc.text("Address (continued)", ML, y);
    y += 5;

    const midX = pw / 2;
    const contentY = y;
    if (layout.page2FromFields.length > 0) {
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text("FROM", leftX, y);
      y = drawFromFields(doc, layout.page2FromFields, leftX, y + 2, cw - 4);
    }
    let yRight = contentY;
    if (layout.page2ToLines.length > 0) {
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text("DELIVER TO", rightX, contentY);
      yRight = drawToLines(doc, layout.page2ToLines, rightX, contentY + 2);
    }
    y = Math.max(y, yRight) + 4;
    doc.setDrawColor(200, 210, 220);
    doc.line(ML, y, pw - ML, y);
    y += TABLE_TOP_GAP;
  }

  if (layout.page2Products.length > 0) {
    drawProductTable(doc, draft, theme, layout, y, layout.page1Products.length, {
      showTitle: true,
      products: layout.page2Products,
      overflowCount: 0,
    });
  }

  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 110, 120);
  doc.text(paymentLine(draft), ML, ph - 6);
}

export function buildDeliveryReceiptPdf(
  draft: DeliveryReceiptDraft,
  theme: DeliveryReceiptTheme = DEFAULT_THEME,
): jsPDF {
  const layout = computeReceiptLayout(draft);
  const doc = new jsPDF({
    unit: "mm",
    format: [PAGE_WIDTH_MM, layout.page1Height],
    orientation: "landscape",
  });
  addReceiptPage1(doc, draft, theme, layout);
  if (layout.page2Needed) {
    doc.addPage([PAGE_WIDTH_MM, layout.page2Height], "landscape");
    addReceiptPage2(doc, draft, theme, layout);
  }
  return doc;
}

export function downloadDeliveryReceiptPdf(
  draft: DeliveryReceiptDraft,
  variant: "seller" | "admin" = "seller",
): void {
  const theme = variant === "admin" ? ADMIN_THEME : DEFAULT_THEME;
  const doc = buildDeliveryReceiptPdf(draft, theme);
  doc.save(`Delivery_Receipt_${orderRef(draft.orderId)}.pdf`);
}

export function printDeliveryReceiptPdf(
  draft: DeliveryReceiptDraft,
  variant: "seller" | "admin" = "seller",
): void {
  const theme = variant === "admin" ? ADMIN_THEME : DEFAULT_THEME;
  const doc = buildDeliveryReceiptPdf(draft, theme);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const win = window.open(url);
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("Could not open print window. Allow pop-ups and try again.");
  }
  win.onload = () => {
    win.focus();
    win.print();
    URL.revokeObjectURL(url);
  };
}

export const DELIVERY_RECEIPT_ELIGIBLE_STATUSES = new Set([
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
]);

export function isDeliveryReceiptEligible(status: string): boolean {
  return DELIVERY_RECEIPT_ELIGIBLE_STATUSES.has(status);
}

/** Build delivery address lines for UI preview (same as PDF TO column). */
export function deliveryReceiptPreviewLines(draft: DeliveryReceiptDraft): {
  from: { label: string; value: string }[];
  to: string[];
  payment: string;
  products: { rows: DeliveryReceiptItem[]; overflowCount: number };
} {
  return {
    from: [
      { label: "Shop", value: draft.seller.shopName },
      { label: "Seller", value: draft.seller.sellerName },
      { label: "Phone", value: draft.seller.phone || "—" },
      { label: "Pickup", value: draft.seller.location || "—" },
    ],
    to: deliveryToParts(draft),
    payment: paymentLine(draft),
    products: receiptProductRowsForDisplay(draft),
  };
}

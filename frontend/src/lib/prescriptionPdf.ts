import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type PrescriptionSummary = {
  vet_name?: string | null;
  created_at?: string | null;
};

type PrescriptionDetail = Record<string, unknown> | null;
type PrescriptionItem = Record<string, unknown>;

const VETBONDHU_PDF = {
  brand: "#059669",
  brandDeep: "#047857",
  accent: "#10B981",
  watermark: "#ECFDF5",
  border: "#BBF7D0",
  panel: "#F0FDF4",
};

function text(value: unknown, fallback = "-") {
  const v = value == null ? "" : String(value).trim();
  return v || fallback;
}

function textOrNA(value: unknown) {
  return text(value, "N/A");
}

function formatPdfDate(value: unknown, fallback = "N/A") {
  const raw = text(value, "");
  if (!raw) return fallback;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString();
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function commonCareByAnimalType(animalTypeRaw: unknown) {
  const animalType = String(animalTypeRaw || "").toLowerCase();
  const poultry = [
    "পরিষ্কার পানি সবসময় দিন",
    "সুষম feed দিন",
    "অসুস্থ প্রাণী আলাদা রাখুন",
    "খামার শুকনা ও পরিষ্কার রাখুন",
    "prescribed medicine ঠিকমতো দিন",
    "অবস্থা খারাপ হলে দ্রুত vet-এর সাথে যোগাযোগ করুন",
  ];
  const defaultSet = [
    "পরিষ্কার পানি সবসময় দিন",
    "উপযুক্ত feed/ঘাস দিন",
    "অসুস্থ প্রাণী আলাদা রাখুন",
    "পরিবেশ পরিষ্কার ও শুকনা রাখুন",
    "prescribed medicine ঠিকমতো দিন",
    "অবস্থা খারাপ হলে দ্রুত vet-এর সাথে যোগাযোগ করুন",
  ];
  if (animalType.includes("poultry") || animalType.includes("chicken") || animalType.includes("duck")) {
    return poultry;
  }
  return defaultSet;
}

function toSixDigitPrescriptionId(rawId: string) {
  const digitsOnly = rawId.replace(/\D/g, "");
  if (digitsOnly.length >= 6) return digitsOnly.slice(-6);
  const padded = digitsOnly.padStart(6, "0");
  return padded.slice(-6);
}

function toBanglaDigits(input: string) {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return input.replace(/\d/g, (d) => map[Number(d)] || d);
}

function getPdfPrescriptionId(detail: PrescriptionDetail) {
  const code = text(detail?.prescription_code, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return code || toSixDigitPrescriptionId(text(detail?.id, "0"));
}

function mapFrequencyToDosePattern(frequencyRaw: unknown, isBangla: boolean) {
  const frequency = String(frequencyRaw || "").trim().toLowerCase();
  if (!frequency) return isBangla ? "দিনে ২ বার" : "twice daily";
  if (isBangla) {
    if (frequency.includes("once")) return "দিনে ১ বার";
    if (frequency.includes("twice")) return "দিনে ২ বার";
    if (frequency.includes("three")) return "দিনে ৩ বার";
    if (frequency.includes("weekly")) return "সপ্তাহে ১ বার";
    if (frequency.includes("needed")) return "প্রয়োজন হলে";
    return String(frequencyRaw || "দিনে ২ বার");
  }
  return String(frequencyRaw);
}

/** Fixed label width so colons align across header + owner blocks (same right column width). */
const PDF_KV_LABEL_PX = 152;
const PDF_PAGE_HEIGHT_PX = 1123;

/** Label + colon + value grid so colons align in the right column. */
function kvRow(label: string, value: string) {
  return `<div style="display:grid;grid-template-columns:${PDF_KV_LABEL_PX}px 10px 1fr;column-gap:2px;align-items:baseline;margin:3px 0;">
    <span style="text-align:right;font-weight:700;">${escapeHtml(label)}</span>
    <span style="text-align:center;">:</span>
    <span>${escapeHtml(value)}</span>
  </div>`;
}

function pdfInfoBlock(label: string, value: string, danger = false) {
  const border = danger ? "#dc2626" : VETBONDHU_PDF.border;
  const background = danger ? "#fef2f2" : VETBONDHU_PDF.panel;
  const color = danger ? "#991b1b" : "#1f2d38";
  return `<div style="border:1px solid ${border};background:${background};border-radius:6px;padding:7px 9px;margin-top:6px;color:${color};">
    <div style="font-weight:700;margin-bottom:2px;">${escapeHtml(label)}</div>
    <div style="white-space:pre-wrap;">${escapeHtml(value)}</div>
  </div>`;
}

export type PrescriptionPdfResult = { blob: Blob; filename: string };

/** Build prescription PDF for preview (iframe) or download. */
export async function buildPrescriptionPdfBlob(
  summary: PrescriptionSummary,
  detail: PrescriptionDetail,
  items: PrescriptionItem[]
): Promise<PrescriptionPdfResult> {
  const language = String(detail?.language || "en").toLowerCase() === "bn" ? "bn" : "en";
  const isBangla = language === "bn";
  const dateText = summary.created_at ? new Date(String(summary.created_at)).toLocaleDateString() : "-";
  const prescriptionId = getPdfPrescriptionId(detail);
  const followUpRows = [
    pdfInfoBlock(isBangla ? "ফলো-আপ প্রয়োজন" : "Follow-up required", detail?.follow_up_required ? (isBangla ? "হ্যাঁ" : "Yes") : "N/A"),
    pdfInfoBlock(isBangla ? "তারিখ" : "Date", formatPdfDate(detail?.follow_up_date)),
    pdfInfoBlock(isBangla ? "সতর্কতার লক্ষণ" : "Warning signs", textOrNA(detail?.warning_signs), true),
    pdfInfoBlock(isBangla ? "ফলো-আপ নোট" : "Follow-up notes", textOrNA(detail?.follow_up_notes)),
  ].join("");
  const diagnosis = text(detail?.diagnosis || detail?.condition, "-");
  const diagnosisDesc = text(detail?.symptoms || detail?.notes || detail?.body, "-");
  const advice = text(detail?.care_instructions || detail?.advice || detail?.notes, "-");
  const animalType = text(detail?.animal_type, "-");
  const careInstructionRows = [
    detail?.feeding_advice ? `${isBangla ? "খাদ্য" : "Feeding"}: ${text(detail.feeding_advice)}` : "",
    detail?.hydration_note ? `${isBangla ? "পানি" : "Hydration"}: ${text(detail.hydration_note)}` : "",
    detail?.isolation_advice ? `${isBangla ? "আইসোলেশন" : "Isolation"}: ${text(detail.isolation_advice)}` : "",
    detail?.care_instructions ? `${isBangla ? "ভেট পরামর্শ / সাধারণ পরিচর্যা" : "Vet advice / General care"}: ${text(detail.care_instructions)}` : "",
  ].filter(Boolean);
  const commonCareManual = toStringArray(detail?.common_care_instructions);
  const commonCare = careInstructionRows.length
    ? careInstructionRows
    : commonCareManual.length
      ? commonCareManual
      : commonCareByAnimalType(animalType);
  const safeItems = items.length ? items : [{ medicine_name: "-", dosage: "-", duration_days: "-", instructions: "-" }];
  const labels = isBangla
    ? {
        prescription: "প্রেসক্রিপশন",
        subtitle: "পেশাদার ভেটেরিনারি পরিচর্যা নথি",
        date: "তারিখ",
        prescriptionId: "প্রেসক্রিপশন আইডি",
        ownerAnimalInfo: "মালিক / প্রাণীর তথ্য",
        ownerName: "মালিকের নাম",
        animalType: "প্রাণীর ধরন",
        breed: "বংশ",
        gender: "লিঙ্গ",
        age: "বয়স",
        weight: "ওজন",
        farm: "খামার",
        shedPen: "শেড / পেন",
        batchId: "ব্যাচ আইডি",
        animalId: "প্রাণী আইডি",
        affectedCount: "আক্রান্ত সংখ্যা",
        diagnosis: "রোগ নির্ণয়",
        diseaseCondition: "রোগ / অবস্থা",
        shortDescription: "সংক্ষিপ্ত বিবরণ",
        clinicalFindings: "ক্লিনিক্যাল পর্যবেক্ষণ",
        severity: "তীব্রতা",
        medicines: "ঔষধ",
        vetAdvice: "ভেট পরামর্শ",
        commonCare: "সাধারণ পরিচর্যা নির্দেশনা",
        followUp: "ফলো-আপ",
        warningNote: "সতর্কতা",
        warningBody: "এই নির্দেশনা সাধারণ supportive care-এর জন্য। নির্দিষ্ট চিকিৎসার ক্ষেত্রে ভেটেরিনারিয়ানের পরামর্শই চূড়ান্ত।",
        signature: "এটি একটি ডিজিটাল স্বাক্ষর।",
      }
    : {
        prescription: "Prescription",
        subtitle: "Professional Veterinary Care Document",
        date: "Date",
        prescriptionId: "Prescription ID",
        ownerAnimalInfo: "Owner / Animal Info",
        ownerName: "Owner Name",
        animalType: "Animal Type",
        breed: "Breed",
        gender: "Gender",
        age: "Age",
        weight: "Weight",
        farm: "Farm",
        shedPen: "Shed / Pen",
        batchId: "Batch ID",
        animalId: "Animal ID",
        affectedCount: "Affected Count",
        diagnosis: "Diagnosis",
        diseaseCondition: "Disease / Condition",
        shortDescription: "Short Description",
        clinicalFindings: "Clinical Findings",
        severity: "Severity",
        medicines: "Medicines",
        vetAdvice: "Vet Advice",
        commonCare: "Common Care Instructions",
        followUp: "Follow-up",
        warningNote: "Warning Note",
        warningBody: "This guidance is for supportive care only. Veterinary advice remains final for treatment decisions.",
        signature: "This is a digital signature.",
      };
  const medicineRows = safeItems
    .slice(0, 6)
    .map((item, idx) => {
      const name = text(item.medicine_name || item.label, "-");
      const dose = text(item.dosage, "");
      const unit = text(item.dosage_unit, "");
      const medicineType = text(item.medicine_type, "");
      const pattern = isBangla
        ? text(item.dose_pattern || mapFrequencyToDosePattern(item.frequency, true), "১+০+১")
        : text(item.dose_pattern || mapFrequencyToDosePattern(item.frequency, false), "twice daily");

      const frequency = text(item.frequency, "");
      const route = text(item.route, "");
      const purpose = text(item.purpose, "");
      const notes = text(item.notes, "");

      const durationRaw = text(item.duration_days || item.duration, "");
      const durationDigits = durationRaw.replace(/[^\d]/g, "");
      const durationText = durationDigits
        ? isBangla
          ? `${toBanglaDigits(durationDigits)} দিন`
          : `${durationDigits} days`
        : isBangla
          ? "৫ দিন"
          : "5 days";

      const timing = text(item.timing || item.notes, isBangla ? "খাবারের পরে" : "after feed");
      const serial = isBangla ? toBanglaDigits(String(idx + 1)) : String(idx + 1);
      const typeText = medicineType && medicineType !== "-" ? ` (${escapeHtml(medicineType)})` : "";
      const firstLine = `${serial}. ${escapeHtml(name)}${typeText}${dose !== "-" ? ` ${escapeHtml(dose)}` : ""}${unit !== "-" && unit ? ` ${escapeHtml(unit)}` : ""}`;
      const secondLine = [pattern, frequency, timing, route, durationText].filter((part) => part && part !== "-").map(escapeHtml).join(", ");
      const thirdLine = [purpose, notes].filter((part) => part && part !== "-").map(escapeHtml).join(" | ");

      return `
      <div style="padding:6px 8px;border-bottom:1px solid #e7eff2;">
        <div style="font-weight:700;color:${VETBONDHU_PDF.brandDeep};margin-bottom:3px;">${firstLine}</div>
        <div>${secondLine}</div>
        ${thirdLine ? `<div style="font-size:11px;color:#5a6b74;margin-top:2px;">${thirdLine}</div>` : ""}
      </div>`;
    })
    .join("");

  const commonCareRows = commonCare
    .map((line, idx) => `<li style="margin:2px 0;">${isBangla ? toBanglaDigits(String(idx + 1)) : idx + 1}. ${escapeHtml(line)}</li>`)
    .join("");

  const ownerName = text(detail?.farmer_name || detail?.patient_name);
  const ageVal = text(detail?.animal_age || detail?.age, "optional");
  const weightVal = text(detail?.animal_weight || detail?.weight, "optional");
  const vetName = text(detail?.vet_name || summary.vet_name);
  const vetDegree = text(detail?.vet_degree || detail?.degree || detail?.qualification, "Veterinary Professional");
  const vetAddress = text(detail?.vet_address || detail?.address || detail?.clinic_name || detail?.organization || detail?.hospital || detail?.location, "");
  /** Same width for all right-side KV blocks so colons line up vertically. */
  const pdfKvRightCol = `flex:0 0 ${PDF_KV_LABEL_PX + 10 + 140}px;width:${PDF_KV_LABEL_PX + 10 + 140}px;max-width:100%;`;
  const pdfHeader = `
      <div style="background:${VETBONDHU_PDF.brand};min-height:76px;padding:12px 22px;display:flex;flex-flow:row nowrap;align-items:center;justify-content:space-between;gap:16px;color:#fff;box-shadow:inset 0 -1px 0 rgba(255,255,255,0.08);">
        <div style="display:flex;flex-flow:row nowrap;align-items:center;justify-content:center;gap:12px;flex:0 0 auto;min-width:220px;background:#ffffff;border-radius:9999px;overflow:hidden;padding:7px 22px 7px 8px;font-family:Arial,Helvetica,sans-serif;">
          <div style="flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:${VETBONDHU_PDF.brand};color:#ffffff;font-size:11px;font-weight:700;line-height:38px;text-align:center;letter-spacing:0.06em;">VB</div>
          <span style="display:inline-block;font-size:26px;font-weight:800;line-height:38px;color:${VETBONDHU_PDF.brand};letter-spacing:0.01em;white-space:nowrap;margin:0;padding:0;text-align:center;transform:translateY(-11px);">VetBondhu</span>
        </div>
        <div style="text-align:right;flex:1 1 auto;min-width:0;">
          <div style="font-size:22px;font-weight:700;line-height:1.15;letter-spacing:0.2px;">${labels.prescription}</div>
          <div style="font-size:11px;font-weight:400;line-height:1.35;margin-top:5px;opacity:0.95;">${labels.subtitle}</div>
        </div>
      </div>
      <div style="height:4px;background:${VETBONDHU_PDF.accent};"></div>`;

  const html = `
  <div style="width:794px;background:#ffffff;color:#1f2d38;font-family:Arial,'Noto Sans Bengali','Hind Siliguri','Kalpurush','Nikosh',sans-serif;">
    <div style="min-height:${PDF_PAGE_HEIGHT_PX}px;background:#ffffff;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <div style="font-size:88px;color:${VETBONDHU_PDF.watermark};transform:rotate(-30deg);font-weight:800;">VetBondhu</div>
      </div>
      <div style="position:relative;z-index:1;">
        ${pdfHeader}
        <div style="padding:15px 20px 0 20px;font-size:12px;line-height:1.45;">
        <div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;">${escapeHtml(vetName)}</div>
            <div>${escapeHtml(vetDegree)}</div>
            <div>${escapeHtml(text(detail?.specialization, ""))}</div>
            <div>${escapeHtml(vetAddress)}</div>
          </div>
          <div style="${pdfKvRightCol}">
            ${kvRow(labels.date, isBangla ? toBanglaDigits(text(dateText)) : text(dateText))}
            ${kvRow(labels.prescriptionId, isBangla ? toBanglaDigits(prescriptionId) : prescriptionId)}
          </div>
        </div>

        <div style="margin-top:14px;border-top:1px solid #cfdfe5;padding-top:12px;padding-bottom:18px;margin-bottom:4px;">
          <div style="font-weight:700;color:${VETBONDHU_PDF.brandDeep};margin-bottom:8px;">${labels.ownerAnimalInfo}</div>
          <div style="border:1px solid ${VETBONDHU_PDF.border};background:${VETBONDHU_PDF.panel};border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;gap:20px;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              ${kvRow(labels.ownerName, ownerName)}
              ${kvRow(labels.animalType, animalType)}
              ${detail?.breed ? kvRow(labels.breed, text(detail.breed)) : ""}
              ${detail?.animal_gender ? kvRow(labels.gender, text(detail.animal_gender)) : ""}
              ${detail?.farm_name ? kvRow(labels.farm, text(detail.farm_name)) : ""}
            </div>
            <div style="${pdfKvRightCol}">
              ${kvRow(labels.age, ageVal)}
              ${kvRow(labels.weight, weightVal)}
              ${detail?.shed_or_pen ? kvRow(labels.shedPen, text(detail.shed_or_pen)) : ""}
              ${detail?.batch_id ? kvRow(labels.batchId, text(detail.batch_id)) : ""}
              ${detail?.animal_id ? kvRow(labels.animalId, text(detail.animal_id)) : ""}
              ${detail?.affected_count ? kvRow(labels.affectedCount, text(detail.affected_count)) : ""}
            </div>
          </div>
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:12px;padding-bottom:20px;margin-bottom:6px;display:flex;gap:10px;align-items:stretch;">
          <div style="flex:0 0 41%;">
            <div style="font-weight:700;color:${VETBONDHU_PDF.brandDeep};margin-bottom:8px;">${labels.diagnosis}</div>
            <div style="border:1px solid ${VETBONDHU_PDF.border};background:${VETBONDHU_PDF.panel};border-radius:6px;padding:10px 12px;min-height:136px;">
              <div><b>${labels.diseaseCondition}:</b></div>
              <div style="margin-top:2px;">${escapeHtml(diagnosis)}</div>
              <div style="margin-top:8px;"><b>${labels.shortDescription}:</b></div>
              <div style="margin-top:2px;">${escapeHtml(diagnosisDesc)}</div>
              ${detail?.clinical_findings ? `<div style="margin-top:8px;"><b>${labels.clinicalFindings}:</b></div><div style="margin-top:2px;">${escapeHtml(text(detail.clinical_findings))}</div>` : ""}
              ${detail?.severity ? `<div style="margin-top:8px;"><b>${labels.severity}:</b> ${escapeHtml(text(detail.severity))}</div>` : ""}
            </div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;color:${VETBONDHU_PDF.brandDeep};margin-bottom:4px;">${labels.medicines}</div>
            <div style="border:1px solid ${VETBONDHU_PDF.border};background:${VETBONDHU_PDF.panel};border-radius:6px;min-height:136px;">
              ${medicineRows}
            </div>
          </div>
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:10px;">
          <div style="font-weight:700;color:${VETBONDHU_PDF.brandDeep};">${labels.vetAdvice}</div>
          <div style="margin-top:4px;">${escapeHtml(advice)}</div>
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:10px;">
          <div style="font-weight:700;color:${VETBONDHU_PDF.brandDeep};">${labels.commonCare}</div>
          <ul style="margin:6px 0 0 16px;padding:0;list-style:none;">
            ${commonCareRows}
          </ul>
        </div>
        </div>
      </div>
    </div>

    <div style="min-height:${PDF_PAGE_HEIGHT_PX}px;background:#ffffff;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <div style="font-size:88px;color:${VETBONDHU_PDF.watermark};transform:rotate(-30deg);font-weight:800;">VetBondhu</div>
      </div>
      <div style="position:relative;z-index:1;">
        ${pdfHeader}
        <div style="padding:15px 20px 0 20px;font-size:12px;line-height:1.45;">
        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:10px;">
          <div style="font-weight:700;color:${VETBONDHU_PDF.brandDeep};">${labels.followUp}</div>
          ${followUpRows}
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:10px;">
          <div style="font-weight:700;color:#a62828;">${labels.warningNote}</div>
          <div style="margin-top:6px;border:1px solid #efc0c0;background:#fff6f6;border-radius:6px;padding:8px 10px;">
            ${labels.warningBody}
          </div>
        </div>

        <div style="margin-top:26px;padding-top:14px;border-top:1px solid #cfdfe5;">
          <div style="max-width:320px;border-top:1px solid #9fb3ba;padding-top:10px;">
            <div style="font-weight:700;font-size:13px;">${escapeHtml(vetName)}</div>
            <div style="font-size:11px;color:#5a6b74;margin-top:2px;">${escapeHtml(vetDegree)}</div>
            <div style="margin-top:8px;font-size:10px;color:#7a8b96;font-style:italic;">${labels.signature}</div>
          </div>
        </div>

        <div style="margin-top:28px;padding-top:16px;padding-bottom:8px;text-align:center;font-size:10px;color:#7a8b96;border-top:1px solid #e2edf0;">
          Generated by VetBondhu - Veterinary Digital Prescription
        </div>
      </div>
    </div>
  </div>
  </div>`;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgProps = doc.getImageProperties(imgData);
    const ratio = imgProps.width / imgProps.height;
    const renderWidth = pageWidth;
    const renderHeight = renderWidth / ratio;
    if (renderHeight <= pageHeight) {
      doc.addImage(imgData, "PNG", 0, 0, renderWidth, renderHeight);
    } else {
      let heightLeft = renderHeight;
      let positionY = 0;
      doc.addImage(imgData, "PNG", 0, positionY, renderWidth, renderHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        positionY = heightLeft - renderHeight;
        doc.addPage();
        doc.addImage(imgData, "PNG", 0, positionY, renderWidth, renderHeight);
        heightLeft -= pageHeight;
      }
    }
    const blob = doc.output("blob");
    return { blob, filename: `prescription-${prescriptionId}.pdf` };
  } finally {
    document.body.removeChild(container);
  }
}

export async function downloadPrescriptionPdf(
  summary: PrescriptionSummary,
  detail: PrescriptionDetail,
  items: PrescriptionItem[]
) {
  const { blob, filename } = await buildPrescriptionPdfBlob(summary, detail, items);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || "").trim()).filter(Boolean);
}

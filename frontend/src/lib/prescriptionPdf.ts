import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type PrescriptionSummary = {
  vet_name?: string | null;
  created_at?: string | null;
};

type PrescriptionDetail = Record<string, unknown> | null;
type PrescriptionItem = Record<string, unknown>;

function text(value: unknown, fallback = "-") {
  const v = value == null ? "" : String(value).trim();
  return v || fallback;
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

/** Label + colon + value grid so colons align in the right column. */
function kvRow(label: string, value: string) {
  return `<div style="display:grid;grid-template-columns:${PDF_KV_LABEL_PX}px 10px 1fr;column-gap:2px;align-items:baseline;margin:3px 0;">
    <span style="text-align:right;font-weight:700;">${escapeHtml(label)}</span>
    <span style="text-align:center;">:</span>
    <span>${escapeHtml(value)}</span>
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
  const prescriptionId = toSixDigitPrescriptionId(text(detail?.id, "0"));
  const followUpRaw = text(detail?.follow_up_date || detail?.follow_up_notes || detail?.follow_up_required, "");
  const followUp = followUpRaw && followUpRaw !== "-" ? followUpRaw : "No follow-up needed";
  const diagnosis = text(detail?.diagnosis || detail?.condition, "-");
  const diagnosisDesc = text(detail?.symptoms || detail?.notes || detail?.body, "-");
  const advice = text(detail?.care_instructions || detail?.advice || detail?.notes, "-");
  const animalType = text(detail?.animal_type, "-");
  const commonCareManual = toStringArray(detail?.common_care_instructions);
  const commonCare = commonCareManual.length ? commonCareManual : commonCareByAnimalType(animalType);
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
        age: "বয়স",
        weight: "ওজন",
        diagnosis: "রোগ নির্ণয়",
        diseaseCondition: "রোগ / অবস্থা",
        shortDescription: "সংক্ষিপ্ত বিবরণ",
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
        age: "Age",
        weight: "Weight",
        diagnosis: "Diagnosis",
        diseaseCondition: "Disease / Condition",
        shortDescription: "Short Description",
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
      const pattern = isBangla
        ? text(item.dose_pattern || mapFrequencyToDosePattern(item.frequency, true), "১+০+১")
        : text(item.dose_pattern || mapFrequencyToDosePattern(item.frequency, false), "twice daily");

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
      const firstLine = `${serial}. ${escapeHtml(name)}${dose !== "-" ? ` ${escapeHtml(dose)}` : ""}${unit !== "-" && unit ? ` ${escapeHtml(unit)}` : ""}`;
      const secondLine = `${escapeHtml(pattern)}, ${escapeHtml(durationText)}, ${escapeHtml(timing)}`;

      return `
      <div style="padding:6px 8px;border-bottom:1px solid #e7eff2;">
        <div style="font-weight:700;color:#0b7282;margin-bottom:3px;">${firstLine}</div>
        <div>${secondLine}</div>
      </div>`;
    })
    .join("");

  const commonCareRows = commonCare
    .map((line, idx) => `<li style="margin:2px 0;">${isBangla ? toBanglaDigits(String(idx + 1)) : idx + 1}. ${escapeHtml(line)}</li>`)
    .join("");

  const ownerName = text(detail?.farmer_name || detail?.patient_name);
  const ageVal = text(detail?.age, "optional");
  const weightVal = text(detail?.weight, "optional");
  const vetName = text(detail?.vet_name || summary.vet_name);
  const vetDegree = text(detail?.vet_degree || detail?.qualification || detail?.degree);
  /** Same width for all right-side KV blocks so colons line up vertically. */
  const pdfKvRightCol = `flex:0 0 ${PDF_KV_LABEL_PX + 10 + 140}px;width:${PDF_KV_LABEL_PX + 10 + 140}px;max-width:100%;`;

  const html = `
  <div style="width:794px;background:#ffffff;color:#1f2d38;font-family:Arial,'Noto Sans Bengali','Hind Siliguri','Kalpurush','Nikosh',sans-serif;position:relative;padding-bottom:56px;">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
      <div style="font-size:72px;color:#eef6f8;transform:rotate(-30deg);font-weight:700;">MediBondhu</div>
    </div>
    <div style="position:relative;z-index:1;">
      <div style="background:#0a6b74;min-height:76px;padding:12px 22px;display:flex;flex-flow:row nowrap;align-items:center;justify-content:space-between;gap:16px;color:#fff;box-shadow:inset 0 -1px 0 rgba(255,255,255,0.08);">
        <div style="display:flex;flex-flow:row nowrap;align-items:center;gap:10px;flex:0 0 auto;width:max-content;min-width:max-content;background:#ffffff;border-radius:9999px;overflow:hidden;padding:6px 18px 6px 7px;font-family:Arial,Helvetica,sans-serif;">
          <div style="flex:0 0 auto;width:36px;height:36px;border-radius:50%;background:#0a6b74;color:#ffffff;font-size:11px;font-weight:700;line-height:36px;text-align:center;letter-spacing:0.06em;">MB</div>
          <div style="display:flex;align-items:center;justify-content:flex-start;height:36px;flex:0 0 auto;">
            <span style="display:inline-block;font-size:21px;font-weight:700;line-height:1;color:#0a6b74;letter-spacing:0.02em;white-space:nowrap;margin:0;padding:0;transform:translateY(-7px);">MediBondhu</span>
          </div>
        </div>
        <div style="text-align:right;flex:1 1 auto;min-width:0;">
          <div style="font-size:22px;font-weight:700;line-height:1.15;letter-spacing:0.2px;">${labels.prescription}</div>
          <div style="font-size:11px;font-weight:400;line-height:1.35;margin-top:5px;opacity:0.95;">${labels.subtitle}</div>
        </div>
      </div>
      <div style="height:4px;background:#12c2d6;"></div>

      <div style="padding:15px 20px 0 20px;font-size:12px;line-height:1.45;">
        <div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;">${escapeHtml(vetName)}</div>
            <div>${escapeHtml(vetDegree)}</div>
            <div>${escapeHtml(text(detail?.specialization))}</div>
            <div>${escapeHtml(text(detail?.clinic_name || detail?.organization || detail?.hospital))}</div>
          </div>
          <div style="${pdfKvRightCol}">
            ${kvRow(labels.date, isBangla ? toBanglaDigits(text(dateText)) : text(dateText))}
            ${kvRow(labels.prescriptionId, isBangla ? toBanglaDigits(prescriptionId) : prescriptionId)}
          </div>
        </div>

        <div style="margin-top:14px;border-top:1px solid #cfdfe5;padding-top:12px;padding-bottom:18px;margin-bottom:4px;">
          <div style="font-weight:700;color:#0b7282;margin-bottom:8px;">${labels.ownerAnimalInfo}</div>
          <div style="border:1px solid #c6ebf0;background:#f5fcfe;border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;gap:20px;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              ${kvRow(labels.ownerName, ownerName)}
              ${kvRow(labels.animalType, animalType)}
            </div>
            <div style="${pdfKvRightCol}">
              ${kvRow(labels.age, ageVal)}
              ${kvRow(labels.weight, weightVal)}
            </div>
          </div>
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:12px;padding-bottom:20px;margin-bottom:6px;display:flex;gap:10px;align-items:stretch;">
          <div style="flex:0 0 41%;">
            <div style="font-weight:700;color:#0b7282;margin-bottom:8px;">${labels.diagnosis}</div>
            <div style="border:1px solid #d3e8ec;background:#f8fcfd;border-radius:6px;padding:10px 12px;min-height:136px;">
              <div><b>${labels.diseaseCondition}:</b></div>
              <div style="margin-top:2px;">${escapeHtml(diagnosis)}</div>
              <div style="margin-top:8px;"><b>${labels.shortDescription}:</b></div>
              <div style="margin-top:2px;">${escapeHtml(diagnosisDesc)}</div>
            </div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;color:#0b7282;margin-bottom:4px;">${labels.medicines}</div>
            <div style="border:1px solid #d3e8ec;background:#f8fcfd;border-radius:6px;min-height:136px;">
              ${medicineRows}
            </div>
          </div>
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:10px;">
          <div style="font-weight:700;color:#0b7282;">${labels.vetAdvice}</div>
          <div style="margin-top:4px;">${escapeHtml(advice)}</div>
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:10px;">
          <div style="font-weight:700;color:#0b7282;">${labels.commonCare}</div>
          <ul style="margin:6px 0 0 16px;padding:0;list-style:none;">
            ${commonCareRows}
          </ul>
        </div>

        <div style="margin-top:12px;border-top:1px solid #cfdfe5;padding-top:10px;">
          <div style="font-weight:700;color:#0b7282;">${labels.followUp}</div>
          <div style="margin-top:4px;">${escapeHtml(followUp)}</div>
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
          Generated by MediBondhu - Veterinary Digital Prescription
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

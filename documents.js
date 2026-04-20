function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return d;
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

function assetUrl(file) {
  return new URL(file, window.location.href).href;
}

const LOGO_URL = assetUrl("logo.PNG");
const STAMP_URL = assetUrl("stamp.png");

function openPrintWindow(html) {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  if (isMobile) {
    window.open(url, "_blank");
    return true;
  }

  const w = window.open(url, "_blank", "width=1000,height=800");
  if (!w) return false;

  setTimeout(() => {
    try {
      w.print();
    } catch (_) {}
  }, 800);

  return true;
}

function amountWords(n) {
  n = Math.round(Number(n || 0));
  if (!n) return "ZERO";

  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  function two(x) {
    if (x < 20) return ones[x];
    return tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  }

  function three(x) {
    if (x < 100) return two(x);
    return ones[Math.floor(x / 100)] + " HUNDRED" + (x % 100 ? " " + two(x % 100) : "");
  }

  let out = [];
  if (n >= 10000000) {
    out.push(three(Math.floor(n / 10000000)) + " CRORE");
    n %= 10000000;
  }
  if (n >= 100000) {
    out.push(three(Math.floor(n / 100000)) + " LAKH");
    n %= 100000;
  }
  if (n >= 1000) {
    out.push(three(Math.floor(n / 1000)) + " THOUSAND");
    n %= 1000;
  }
  if (n > 0) out.push(three(n));
  return out.join(" ").trim();
}

function docCurrency(deal = {}) {
  return deal.document_currency || deal.currency || deal.base_currency || "AED";
}

function commonStyle() {
  return `
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, sans-serif; color:#111; font-size:12px; }
    .doc { width:100%; }
    .top { display:grid; grid-template-columns: 1.05fr .8fr 1.2fr; gap:12px; align-items:start; margin-bottom:10px; }
    .logoBox { text-align:center; padding-top:10px; }
    .logoBox img { max-width:150px; max-height:140px; object-fit:contain; }
    .docTitle { color:#2f9aa0; font-size:30px; font-weight:800; text-align:right; line-height:1; margin-bottom:10px; }
    .bar { background:#2f9aa0; color:#fff; font-weight:700; padding:4px 6px; font-size:12px; text-transform:uppercase; }
    .panel { min-height:120px; }
    .panelBody { padding:6px 2px 0; line-height:1.55; font-size:11px; }
    .smallGrid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
    .triple { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:10px; }
    table { width:100%; border-collapse:collapse; }
    th, td { border:2px solid #222; padding:5px 6px; vertical-align:top; }
    th { background:#2f9aa0; color:#fff; font-weight:700; font-size:11px; }
    .thin td, .thin th { border-width:1.5px; }
    .meta td { padding:3px 6px; }
    .right { text-align:right; }
    .center { text-align:center; }
    .box { border:2px solid #222; margin-top:8px; }
    .boxHead { background:#2f9aa0; color:#fff; padding:4px 6px; font-weight:700; text-transform:uppercase; }
    .boxBody { padding:8px; min-height:70px; }
    .footer { margin-top:18px; display:grid; grid-template-columns: 1.2fr .8fr .8fr; gap:16px; align-items:end; }
    .signLine { border-top:2px solid #222; padding-top:4px; font-size:11px; }
    .stamp { text-align:center; }
    .stamp img { width:115px; opacity:.9; }
    .note { text-align:center; font-size:11px; font-weight:700; margin-top:12px; }
    .red { color:#c62828; font-weight:700; }
    .tight { line-height:1.35; }
  </style>
  <div class="doc">
  `;
}

function shipperBlock(company = {}) {
  return `
    <div class="panel">
      <div class="bar">Shipper</div>
      <div class="panelBody tight">
        <div><b>${esc(company.name || "")}</b></div>
        <div>${esc(company.address || "")}</div>
        <div>Mobil ${esc(company.mobile || "+971524396170")}</div>
        <div>Email: ${esc(company.email || "info@jkpetrochem.com")}</div>
      </div>
    </div>
  `;
}

function rightHeader(title, docNo, customerId, date) {
  return `
    <div>
      <div class="docTitle">${title}</div>
      <table class="meta thin">
        <tr><td><b>Date</b></td><td class="center">${esc(fmtDate(date) || "")}</td></tr>
        <tr><td><b>${title === "PRO FORMA INVOICE" ? "Proforma Invoice #" : title === "PACKING LIST" ? "P.L.Invoice #" : "Invoice #"}</b></td><td class="center">${esc(docNo || "")}</td></tr>
        <tr><td><b>Customer ID</b></td><td class="center">${esc(customerId || "")}</td></tr>
      </table>
    </div>
  `;
}

function logoBlock() {
  return `
    <div class="logoBox">
      <img src="${LOGO_URL}" alt="JK Petrochem logo">
    </div>
  `;
}

function consigneeBlock(buyer = {}) {
  return `
    <div class="panel">
      <div class="bar">Consignee</div>
      <div class="panelBody tight">
        <div><b>${esc(buyer?.name || "—")}</b></div>
        <div>${esc(buyer?.address || "")}</div>
        <div>GST - ${esc(buyer?.gst || "—")}</div>
        <div>PAN - ${esc(buyer?.pan || "—")}</div>
        <div>IEC - ${esc(buyer?.iec || "—")}</div>
        <div>TEL: ${esc(buyer?.phone || "—")}</div>
      </div>
    </div>
  `;
}

function notifyBlock(buyer = {}) {
  return `
    <div class="panel">
      <div class="bar">Notify Party</div>
      <div class="panelBody tight">
        <div><b>${esc(buyer?.name || "—")}</b></div>
        <div>${esc(buyer?.address || "")}</div>
        <div>GST - ${esc(buyer?.gst || "—")}</div>
        <div>PAN - ${esc(buyer?.pan || "—")}</div>
        <div>IEC - ${esc(buyer?.iec || "—")}</div>
        <div>TEL: ${esc(buyer?.phone || "—")}</div>
      </div>
    </div>
  `;
}

function containerBlock(deal = {}) {
  const list = Array.isArray(deal.container_numbers)
    ? deal.container_numbers
    : String(deal.container_numbers || "")
        .split(/[,\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);

  const rows = [];
  for (let i = 0; i < Math.max(list.length, 10); i += 2) {
    rows.push([list[i] || "-", list[i + 1] || "-"]);
  }

  return `
    <div class="panel">
      <div class="bar">Container Nos:</div>
      <table class="thin">
        ${rows.map((r) => `<tr><td class="center">${esc(r[0])}</td><td class="center">${esc(r[1])}</td></tr>`).join("")}
      </table>
    </div>
  `;
}

function shippingBlock
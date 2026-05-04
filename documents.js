import { state } from "./state.js";

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
const SIGN_URL = assetUrl("signature.png");

export function openPrintWindow(html) {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

  if (isMobile) {
    const newDoc = document.open("text/html", "replace");
    newDoc.write(html);
    newDoc.close();
    return true;
  }

  const w = window.open("", "_blank");
  if (!w) return false;

  w.document.open();
  w.document.write(html);
  w.document.close();
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

export function buildShippingInstruction(si, buyer, supplier, deal, company = {}) {
  const date = new Date().toISOString();
  const shipper = company.shippers?.[si.shipper_index] || company;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(suggestFilename("SI", deal, buyer, company))}</title>
    ${commonStyle()}
    ${previewScript()}
  </head>
  <body>
    ${previewActions()}
    <div class="top">
      <div class="panel">
        <div class="bar">Shipper</div>
        <div class="panelBody tight">
          <div><b>${esc(shipper.name || company.name)}</b></div>
          <div>${esc(shipper.address || company.address)}</div>
          <div>Mobil ${esc(shipper.mobile || company.mobile)}</div>
          <div>Email: ${esc(shipper.email || company.email)}</div>
        </div>
      </div>
      ${logoBlock()}
      <div class="docTitle">SHIPPING INSTRUCTION</div>
    </div>

    <div class="triple">
      <div class="panel">
        <div class="bar">Buyer / Consignee</div>
        <div class="panelBody tight">
          <div><b>${esc(buyer?.name || "—")}</b></div>
          <div>${esc(buyer?.address || "")}</div>
          <div>GST: ${esc(buyer?.gst || "—")}</div>
        </div>
      </div>
      <div class="panel">
        <div class="bar">Supplier</div>
        <div class="panelBody tight">
          <div><b>${esc(supplier?.name || "—")}</b></div>
          <div>${esc(supplier?.company_name || "")}</div>
          <div>Country: ${esc(supplier?.country || "")}</div>
        </div>
      </div>
      <div class="panel">
        <div class="bar">Deal Info</div>
        <div class="panelBody tight">
          <div><b>Deal No:</b> ${esc(deal?.deal_no || "—")}</div>
          <div><b>Product:</b> ${esc(si.product || "—")}</div>
          <div><b>HSN:</b> ${esc(si.hsn_code || "—")}</div>
        </div>
      </div>
    </div>

    <div class="box" style="margin-top:20px">
      <div class="boxHead">Instruction Details</div>
      <div class="boxBody" style="font-size:12px; line-height:1.6">
        <p><b>Free Days:</b> ${esc(si.free_days_text || "21 FREE DAYS AT POD")}</p>
        <p><b>Detention:</b> ${esc(si.detention_text || "THEREAFTER USD 25/ DAY/TANK")}</p>
        <div style="margin-top:20px; white-space:pre-wrap"><b>Other Instructions:</b>\n${esc(si.other_instructions || "")}</div>
      </div>
    </div>

    ${footer(company, date)}
  </body>
  </html>`;
}

function docCurrency(deal = {}) {
  return deal.document_currency || deal.currency || deal.base_currency || "AED";
}

function previewScript() {
  return `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script>
      async function waitForImages(root) {
        const images = Array.from(root.querySelectorAll("img"));
        await Promise.all(images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));
      }

      async function downloadExactPdf() {
        const actions = document.querySelector(".previewActions");
        if (actions) actions.style.display = "none";
        
        // Reset state for capture
        document.body.classList.add("is-generating-pdf");
        window.scrollTo(0,0);
        
        const title = document.title || "document";
        const element = document.body;
        
        // Wait for images to load
        await waitForImages(element);

        const opt = {
          margin: 0, // Margin is handled by .doc padding
          filename: title + ".pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            windowWidth: 1200,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
        };

        html2pdf()
          .from(element)
          .set(opt)
          .save()
          .then(() => {
            document.body.classList.remove("is-generating-pdf");
            if (actions) actions.style.display = "flex";
          })
          .catch((err) => {
            console.error(err);
            document.body.classList.remove("is-generating-pdf");
            alert("Download failed. Please use 'Print / Save PDF' instead.");
            if (actions) actions.style.display = "flex";
          });
      }

    </script>
  `;
}

function commonStyle() {
  return `
  <style>
    @page { size: A4; margin: 5mm; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 100% !important; overflow: visible !important; background: white !important; }
      .doc { 
        padding: 10mm !important; 
        width: 190mm !important; 
        max-width: 190mm !important;
        margin: 0 auto !important; 
        border: none !important; 
        box-shadow: none !important;
        border-radius: 0 !important;
        overflow: visible !important;
        background: white !important;
      }
      .previewActions { display: none !important; }
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #e4e7eb; /* Soft desk-like background */
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
    }

    body {
      overflow-x: auto;
    }

    .doc {
      width: 190mm;
      min-width: 190mm;
      margin: 30px auto;
      padding: 10mm;
      background: white;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      border: 1px solid #cfd4da;
      border-radius: 4px;
      overflow: visible !important;
      box-sizing: border-box;
      position: relative;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    /* PDF Generation Fix */
    .is-generating-pdf {
      background: white !important;
      width: 1200px !important; /* Force a stable width for capture */
      overflow: visible !important;
    }
    .is-generating-pdf .doc {
      width: 190mm !important;
      min-width: 190mm !important;
      max-width: 190mm !important;
      margin: 0 auto !important;
      padding: 10mm !important;
      height: auto !important;
      overflow: visible !important;
      border: none !important;
      box-shadow: none !important;
    }
    .is-generating-pdf table {
      width: 100% !important;
      min-width: 100% !important;
    }
    .is-generating-pdf .previewActions {
      display: none !important;
    }

    .previewActions {
      position: sticky;
      top: 0;
      z-index: 9999;
      display: flex;
      gap: 8px;
      padding: 10px;
      background: #fff;
      border-bottom: 1px solid #ddd;
    }

    .previewActions button {
      padding: 12px 18px;
      border: none;
      background: #2f9aa0;
      color: #fff;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .top {
      display: grid;
      grid-template-columns: 1fr 0.62fr 1fr;
      gap: 8px;
      align-items: start;
      margin-bottom: 10px;
    }

    .logoBox {
      text-align: center;
      padding-top: 10px;
    }

    .logoBox img {
      width: 100px;
      max-width: 100px;
      object-fit: contain;
    }

    .docTitle {
      color: #3b9da2;
      font-size: 22px;
      font-weight: 800;
      text-align: right;
      line-height: 1;
      margin: 0 0 8px 0;
      letter-spacing: .2px;
    }

    .bar {
      background: #3b9da2;
      color: #fff;
      font-weight: 700;
      padding: 2px 5px;
      font-size: 11px;
      text-transform: uppercase;
      line-height: 1.1;
    }

    .panel {
      min-height: 118px;
    }

    .panelBody {
      padding: 4px 2px 0;
      line-height: 1.35;
      font-size: 10px;
      font-weight: 700;
    }

    .smallGrid {
      display: grid;
      gap: 12px;
    }

    .triple {
      display: grid;
      grid-template-columns: 1fr .95fr 1fr;
      gap: 8px;
      margin-bottom: 0;
      align-items: start;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      border: 2px solid #222;
      padding: 3px 5px;
      vertical-align: top;
    }

    th {
      background: #3b9da2;
      color: #fff;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      text-align: center;
    }

    .thin td, .thin th {
      border-width: 1.5px;
    }

    .meta td {
      padding: 3px 6px;
      font-size: 10px;
      font-weight: 700;
    }

    .meta td:first-child {
      width: 54%;
    }

    .right { text-align: right; }
    .center { text-align: center; }
    .tight { line-height: 1.35; }

    .box {
      border: 2px solid #222;
      margin-top: 0;
    }

    .boxHead {
      background: #3b9da2;
      color: #fff;
      padding: 2px 6px;
      font-weight: 700;
      text-transform: uppercase;
      line-height: 1.1;
      font-size: 11px;
    }

    .boxBody {
      padding: 4px 6px;
      min-height: 40px;
      font-size: 10px;
      font-weight: 700;
    }

    .footer {
      margin-top: 8px;
      display: grid;
      grid-template-columns: 1.2fr .8fr .8fr;
      gap: 16px;
      align-items: end;
    }

    .signLine {
      border-top: 2px solid #222;
      padding-top: 3px;
      font-size: 10px;
      font-weight: 700;
      min-height: 22px;
    }

    .stamp {
      text-align: center;
      transform: translateY(6px);
    }

    .stamp img {
      width: 100px;
      opacity: .9;
    }

    .note {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      margin-top: 6px;
    }

    .red {
      color: #c62828;
      font-weight: 700;
    }

    .plainTable td {
      border: none !important;
      padding: 1px 0 !important;
      font-size: 10px;
      font-weight: 700;
    }

    .descTable td {
      height: 90px;
    }

    @media print {
      .previewActions { display: none !important; }
      body { overflow: visible; }
      .doc {
        width: 190mm;
        min-width: 190mm;
      }
    }
  </style>
  <div class="doc">
  `;
}

function previewActions() {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

  return `
    <div class="previewActions">
      <button onclick="downloadExactPdf()">Download PDF</button>
      ${isMobile ? "" : `<button onclick="window.print()">Print / Save PDF</button>`}
      <button onclick="if(window.opener) { window.close(); } else { window.location.href = window.location.origin + window.location.pathname + window.location.hash; window.location.reload(); }">Back</button>
    </div>
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
  const label =
    title === "PRO FORMA INVOICE"
      ? "Proforma Invoice #"
      : title === "PACKING LIST"
        ? "P.L.Invoice #"
        : "Invoice #";

  return `
    <div>
      <div class="docTitle">${title}</div>
      <table class="meta thin">
        <tr>
          <td><b>Date</b></td>
          <td class="center">${esc(fmtDate(date) || "")}</td>
        </tr>
        <tr>
          <td><b>${label}</b></td>
          <td class="center">${esc(String(docNo || "").replace(/\s+/g, " ").trim())}</td>
        </tr>
        <tr>
          <td><b>Customer ID</b></td>
          <td class="center">${esc(customerId || "")}</td>
        </tr>
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
        <div>GST NO: ${esc(buyer?.gst || "—")}</div>
        <div>IEC NO: ${esc(buyer?.iec || "—")}</div>
        <div>PAN: ${esc(buyer?.pan || "—")}</div>
        ${buyer?.email ? `<div>Email:${esc(buyer.email)}</div>` : ``}
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
        <div>GST NO: ${esc(buyer?.gst || "—")}</div>
        <div>IEC NO: ${esc(buyer?.iec || "—")}</div>
        <div>PAN: ${esc(buyer?.pan || "—")}</div>
        ${buyer?.email ? `<div>Email:${esc(buyer.email)}</div>` : ``}
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

  const cleanList = list.map(x => String(x).replace(/[^A-Z0-9]/gi, "").toUpperCase());
  const minItems = 20;
  const totalItems = Math.max(minItems, cleanList.length);
  const evenTotal = totalItems % 2 === 0 ? totalItems : totalItems + 1;

  const normalized = [...cleanList];
  while (normalized.length < evenTotal) {
    normalized.push("-");
  }

  const rows = [];
  for (let i = 0; i < normalized.length; i += 2) {
    rows.push([normalized[i], normalized[i + 1]]);
  }

  return `
    <div class="panel" style="height:100%">
      <div class="bar">Container Nos:</div>
      <table class="thin" style="height:calc(100% - 18px)">
        ${rows.map((r) => `
          <tr style="height:22px">
            <td class="center">${esc(r[0] || "-")}</td>
            <td class="center">${esc(r[1] || "-")}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
}

function shippingBlock(deal = {}) {
  return `
    <div class="panel">
      <div class="bar">Shipping Details</div>
      <div class="panelBody tight">
        <table class="plainTable">
          <tr>
            <td style="width:95px;">Freight Type</td>
            <td>${esc(deal.freight_type || "BY SEA")}</td>
          </tr>
          <tr>
            <td>Shippment Date</td>
            <td>[--------------]</td>
          </tr>
          <tr>
            <td>Gross Weight</td>
            <td>[${esc(deal.gross_weight || "")}${deal.gross_weight ? " KGS" : ""}]</td>
          </tr>
          <tr>
            <td>Net Weight</td>
            <td>[${esc(deal.net_weight || "")}${deal.net_weight ? " KGS" : ""}]</td>
          </tr>
          <tr>
            <td>Total Packages</td>
            <td>${esc(deal.package_details || "20ft x 10 Containers")}</td>
          </tr>
        </table>
        <div class="red center" style="margin-top:4px">( Loaded on ${esc(deal.loaded_on || "ISO TANK")} )</div>
      </div>
    </div>
  `;
}

function suggestFilename(type, deal, buyer, company, extra = {}) {
  const docType = type.toUpperCase();
  const shipper = (company.name || "JK").split(/\s+/)[0].toUpperCase();
  
  // If we have a PO object instead of a deal
  if (type === "PO") {
    const po = deal; // first arg is po
    const poNo = String(po.po_no || "NOPO").replace(/[^A-Z0-9]/gi, "-");
    const supp = (extra.supplier?.name || "SUPP").split(/\s+/)[0].toUpperCase();
    return `PO-${poNo}-${shipper}-${supp}`;
  }

  const blNo = (deal?.bl_no || deal?.blNo || "NOBL").replace(/[^A-Z0-9]/gi, "");

  const product = (deal?.product_name || deal?.productName || "PRODUCT").toUpperCase();
  let productShort = product.split(/\s+/).filter(w => w.length > 0).map(w => w[0]).join("");
  if (product.includes("LUBRICATING OIL")) productShort = "LO";
  else if (product.includes("BASE OIL")) productShort = "BO";
  else if (product.includes("BITUMEN")) productShort = "BT";

  const consignee = (buyer?.name || "BUYER").split(/\s+/).filter(Boolean).slice(0, 2).join("-").toUpperCase();

  // Prioritize the number based on the document type
  let dNo = "";
  if (docType === "CI") dNo = deal?.ci_no;
  else if (docType === "PI") dNo = deal?.pi_no;
  else if (docType === "PL") dNo = deal?.pl_no;
  else if (docType === "COO") dNo = deal?.coo_no || deal?.ci_no;
  else if (docType === "COA") dNo = extra.coa?.cert_no || deal?.bl_no;

  // Fallback if the specific type number is missing
  const docNo = String(dNo || deal?.ci_no || deal?.pi_no || deal?.pl_no || deal?.dealNo || deal?.deal_no || "000").replace(/[^A-Z0-9\-\/]/gi, "").replace(/\//g, "-");

  const count = deal?.dealCount || 1;

  if (type.includes("STATEMENT") || type.includes("SETTLEMENT")) {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    return `${docType}-${consignee}-${date}`;
  }

  return `${docType}-${blNo}-${shipper}-${productShort}-${consignee}-${docNo}-${count}`;
}

function additionalDetailsBlock(deal, supplier, docLabel = "Packing list No. Date:", extraHtml = "", showDocNo = true) {
  const docNoRow = showDocNo ? `
          <tr>
            <td>${docLabel}</td>
            <td>${esc(String(deal.pl_no || deal.ci_no || deal.pi_no || deal.dealNo || "—").replace(/\s+/g, ""))}</td>
          </tr>` : "";

  return `
    <div class="box" style="margin-top:0;">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <table class="plainTable">
          <tr>
            <td style="width:140px;">Country of Origin</td>
            <td>${esc(deal.country_of_origin || supplier?.country || "UAE")}</td>
          </tr>
          ${docNoRow}
          <tr>
            <td>Port of Loading</td>
            <td>${esc(deal.loading_port || "—")}</td>
          </tr>
          <tr>
            <td>Port of Discharge</td>
            <td>${esc(deal.discharge_port || "—")}</td>
          </tr>
          <tr>
            <td>BL NO:</td>
            <td>${esc(deal.bl_no || "—")}</td>
          </tr>
          <tr>
            <td>Vessel / Voyage No.</td>
            <td>${esc(deal.vessel_voyage || deal.vessel || "—")}</td>
          </tr>
          <tr>
            <td>CFS:</td>
            <td>${esc(deal.cfs || "-")}</td>
          </tr>
        </table>
        ${extraHtml}
      </div>
    </div>
  `;
}

function footer(company = {}, date = "", showSignatory = false) {
  return `
    <div class="footer">
      <div style="position:relative; min-height:110px;">
        <div style="font-size: 10px; font-weight: 700; min-height: 18px;">
          FOR ${esc(company.name || "")}
        </div>
        ${showSignatory ? `
          <div style="position:relative; margin-top:5px; height:90px;">
            <img src="${SIGN_URL}" style="height:75px; position:absolute; left:20px; bottom:25px; z-index:3;" onerror="this.style.display='none'">
            <img src="${STAMP_URL}" style="height:90px; position:absolute; left:65px; bottom:15px; z-index:2; opacity:0.85;" onerror="this.style.display='none'">
            <div style="font-size:10px;font-weight:700; position:absolute; bottom:0; left:0; z-index:4; padding-top:5px;">Authorised Signatory</div>
          </div>
        ` : `
          <div style="position:relative; margin-top:5px; height:70px;">
            <img src="${STAMP_URL}" style="height:85px; position:absolute; left:20px; bottom:5px; z-index:2; opacity:0.85;" onerror="this.style.display='none'">
          </div>
        `}
      </div>
      <div><!-- Empty middle col --></div>
      <div>
        <div style="border-bottom: 2px solid #222; padding-bottom: 2px; font-size: 10px; font-weight: 700; min-height: 18px; text-align: center;">
          ${esc(fmtDate(date) || "")}
        </div>
        <div style="font-size:10px;font-weight:700;margin-top:2px; text-align: center;">Date</div>
      </div>
    </div>
    <div class="note">This is computer generated Document, No signature required</div>
  </div>
  `;
}

export function buildPI(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.created_at || new Date().toISOString();
  const total = Number(deal.totalAmount || 0);
  const roundedTotal = Math.round(total);
  const roundOff = roundedTotal - total;
  const currency = docCurrency(deal);
  const filename = suggestFilename("PI", deal, buyer, company);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(filename)}</title>
    ${commonStyle()}
    ${previewScript()}
  </head>
  <body>
    ${previewActions()}

    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("PRO FORMA INVOICE", String(deal.pi_no || deal.dealNo || "").replace(/^PI\s*/i, ""), buyer?.customer_id || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${notifyBlock(buyer)}
      ${shippingBlock(deal)}
    </div>

    <table class="descTable" style="margin-top:0;">
      <tr>
        <th style="width:45%">DESCRIPTION</th>
        <th style="width:10%">UNIT</th>
        <th style="width:8%">QTY</th>
        <th style="width:10%">(${esc(currency)})</th>
        <th style="width:5%">TAX</th>
        <th style="width:22%">TOTAL AMOUNT (${esc(currency)})</th>
      </tr>
      <tr style="height:138px">
        <td style="padding:0">
          <div style="display:flex; flex-direction:column; justify-content:space-between; height:138px; padding:4px 5px">
            <div>
              <b>${esc(deal.productName || "")}</b><br>
              HS CODE : : ${esc(deal.hsn_code || "—")}
            </div>
            <div style="margin-top:auto">
              ${esc(currency)} : ${esc(amountWords(total))} ONLY
            </div>
          </div>
        </td>
        <td class="center">${esc(deal.unit || "MTON")}</td>
        <td class="center">${esc(deal.quantity || "")}</td>
        <td class="center">${fmt(deal.docRate || deal.rate || 0)}</td>
        <td class="center">-</td>
        <td class="right">${fmt(total)}</td>
      </tr>
    </table>

    <div class="smallGrid" style="margin-top:0; align-items:stretch; grid-template-columns: 1.35fr .75fr;">
      <div class="box" style="height:100%">
        <div class="boxHead">Terms of Sale and Other Comments</div>
        <div class="boxBody tight" style="display:flex; flex-direction:column; justify-content:space-between; height:calc(100% - 20px)">
          <div>
            <div><b>Terms of Delivery / Payment :</b></div>
            <div style="margin-top:3px">
              ${esc(deal.terms_delivery || (deal.discharge_port ? `CFR ${deal.discharge_port},INDIA` : "CFR MUNDRA PORT,INDIA"))}
              / <span class="red">${esc(deal.payment_terms || "100% ADVANCE PAYMENT")}</span>
            </div>
          </div>

          <div>
            <div style="margin-top:8px"><b>Our Bank Details:-</b></div>
            <div>Account Name: ${esc(company.name || "")}</div>
            <div>Account Number (${esc(currency)}): ${esc(company.bankAccount || "")}</div>
            <div>IBAN: ${esc(company.bankIBAN || "")}</div>
            <div>SWIFT ID: ${esc(company.bankSWIFT || "")}</div>
            <div>Bank Name: ${esc(company.bankName || "")}${company.branchName ? ` / Branch: ${esc(company.branchName)}` : ""}</div>
          </div>

          <div><b>BANK TERMS:</b> ${esc(deal.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}</div>
        </div>
      </div>

      <table class="thin">
        <tr><td>Subtotal</td><td class="right">${fmt(total)}</td></tr>
        <tr><td>Taxable</td><td class="right">-</td></tr>
        <tr><td>Tax rate</td><td class="right">-</td></tr>
        <tr><td>Tax</td><td class="right">-</td></tr>
        <tr><td>Freight</td><td class="right">-</td></tr>
        <tr><td>Insurance</td><td class="right">-</td></tr>
        <tr><td>Legal/Consular</td><td class="right">-</td></tr>
        <tr><td>Inspection/Cert.</td><td class="right">-</td></tr>
        <tr><td>Round off (+/-)</td><td class="right">${roundOff !== 0 ? fmt(roundOff) : "-"}</td></tr>
        <tr><td><b>TOTAL</b></td><td class="right"><b>${fmt(roundedTotal)}</b></td></tr>
        <tr><td>Currency</td><td class="right">${esc(currency)}</td></tr>
      </table>
    </div>

    <div style="margin-top:10px; width:60%">
      <table class="plainTable">
        <tr>
          <td style="width:140px;">Country of Origin</td>
          <td>: ${esc(deal.country_of_origin || supplier?.country || "UAE")}</td>
        </tr>
        <tr>
          <td>Port of Loading</td>
          <td>: ${esc(deal.loading_port || "—")}</td>
        </tr>
        <tr>
          <td>Port of Discharge</td>
          <td>: ${esc(deal.discharge_port || "—")}</td>
        </tr>
      </table>
    </div>

    ${footer(company, date, true)}
  </body>
  </html>`;
}

function innerCI(deal, buyer, supplier, company, date, currency) {
  const roundedTotal = Math.round(deal.totalAmount || 0);
  const roundOff = roundedTotal - (deal.totalAmount || 0);

  return `
    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("COMMERCIAL INVOICE", deal.ci_no || deal.dealNo || "", buyer?.customer_id || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${notifyBlock(buyer)}
      ${shippingBlock(deal)}
    </div>

    <table>
      <tr>
        <th style="width:45%">DESCRIPTION</th>
        <th style="width:14%">UNIT</th>
        <th style="width:8%">QTY</th>
        <th style="width:10%">RATE<br>(${esc(currency)})</th>
        <th style="width:6%">TAX</th>
        <th style="width:17%">TOTAL AMOUNT (${esc(currency)})</th>
      </tr>
      <tr style="height:145px">
        <td style="padding:0">
          <div style="display:flex; flex-direction:column; justify-content:space-between; height:145px; padding:4px 5px">
            <div>
              <b>${esc(deal.productName || "")}</b><br>
              HS CODE : : ${esc(deal.hsn_code || "—")}
            </div>
            <div style="margin-top:auto">
              ${esc(currency)} : ${esc(amountWords(deal.totalAmount))} ONLY
            </div>
          </div>
        </td>
        <td class="center">${esc(deal.unit || "MTON")}</td>
        <td class="center">${esc(deal.quantity || "")}</td>
        <td class="center">${fmt(deal.docRate || deal.rate || 0)}</td>
        <td class="center">-</td>
        <td class="right">${fmt(deal.totalAmount)}</td>
      </tr>
    </table>

    <div style="display:grid;grid-template-columns:1.18fr .88fr .64fr;gap:4px;align-items:stretch;margin-top:6px;">
      <div class="box" style="height:100%">
        <div class="boxHead">Terms of Sale and Other Comments</div>
        <div class="boxBody tight" style="display:flex; flex-direction:column; justify-content:space-between; height:calc(100% - 20px)">
          <div>
            <div><b>Terms of Delivery / Payment :</b></div>
            <div>${esc(deal.terms_delivery || `CFR ${deal.discharge_port || "MUNDRA PORT"}`)} / <span class="red">${esc(deal.payment_terms || "100% ADVANCE PAYMENT")}</span></div>
          </div>

          <div>
            <div style="margin-top:8px"><b>Our Bank Details:-</b></div>
            <div>Account Name: ${esc(company.name || "")}</div>
            <div>Account Number (${esc(currency)}): ${esc(company.bankAccount || "")}</div>
            <div>IBAN: ${esc(company.bankIBAN || "")}</div>
            <div>SWIFT ID: ${esc(company.bankSWIFT || "")}</div>
            <div>Bank Name: ${esc(company.bankName || "")}</div>
          </div>

          <div><b>BANK TERMS:</b> ${esc(deal.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}</div>
        </div>
      </div>

      ${containerBlock(deal)}

      <table class="thin" style="font-size:10px;">
        <tr><td>Subtotal</td><td class="right">${fmt(deal.totalAmount)}</td></tr>
        <tr><td>Taxable</td><td class="right">-</td></tr>
        <tr><td>Tax rate</td><td class="right">-</td></tr>
        <tr><td>Tax</td><td class="right">-</td></tr>
        <tr><td>Insurance</td><td class="right">-</td></tr>
        <tr><td>Legal/Consular</td><td class="right">-</td></tr>
        <tr><td>Inspection/Cert.</td><td class="right">-</td></tr>
        <tr><td>Round off (+/-)</td><td class="right">${roundOff !== 0 ? fmt(roundOff) : "-"}</td></tr>
        <tr><td>Other (specify)</td><td class="right">-</td></tr>
        <tr><td><b>TOTAL</b></td><td class="right"><b>${fmt(roundedTotal)}</b></td></tr>
        <tr><td>Currency</td><td class="right">${esc(currency)}</td></tr>
      </table>
    </div>

    ${additionalDetailsBlock(deal, supplier, "", "", false)}

    ${footer(company, date)}`;
}

export function buildCI(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.shipment_out_date || new Date().toISOString();
  const currency = docCurrency(deal);
  const filename = suggestFilename("CI", deal, buyer, company);

  return `
  <!DOCTYPE html><html><head><title>${esc(filename)}</title>${commonStyle()}${previewScript()}</head><body>
    ${previewActions()}
    <div class="doc">${innerCI(deal, buyer, supplier, company, date, currency)}</div>
  </body></html>`;
}

function innerPL(deal, buyer, supplier, company, date) {
  return `
    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("PACKING LIST", deal.pl_no || deal.dealNo || "", buyer?.customer_id || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${containerBlock(deal)}
      ${shippingBlock(deal)}
    </div>

    <table class="descTable" style="margin-top:0;">
      <tr>
        <th style="width:60%">DESCRIPTION</th>
        <th style="width:14%">UNIT</th>
        <th style="width:26%">QTY</th>
      </tr>
      <tr style="height:122px">
        <td>
          <b>${esc(deal.productName || "")}</b><br>
          HS CODE : : ${esc(deal.hsn_code || "—")}
        </td>
        <td class="center">${esc(deal.unit || "MTON")}</td>
        <td class="center">${esc(deal.quantity || "")}</td>
      </tr>
    </table>

    <div class="box" style="margin-top:0;">
      <div class="boxHead">Terms of Sale and Other Comments</div>
      <div class="boxBody tight">
        <div><b>Terms of Delivery</b></div>
        <div style="margin-top:4px">${esc(deal.terms_delivery || `CFR ${deal.dischargePort || "MUNDRA PORT"}`)}</div>
      </div>
    </div>

    ${additionalDetailsBlock(deal, supplier, "", "", false)}

    ${footer(company, date, false)}`;
}

export function buildPL(deal, buyer, supplier, company = {}) {
  const date = deal.shipment_out_date || deal.invoice_date || new Date().toISOString();
  const filename = suggestFilename("PL", deal, buyer, company);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(filename)}</title>
    ${commonStyle()}
    ${previewScript()}
  </head>
  <body>
    ${previewActions()}
    <div class="doc">${innerPL(deal, buyer, supplier, company, date)}</div>
  </body>
  </html>`;
}

function innerCOO(deal, buyer, supplier, company, date) {
  return `
    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("CERTIFICATE OF ORIGIN", deal.coo_no || deal.dealNo || "", buyer?.customer_id || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${containerBlock(deal)}
      ${shippingBlock(deal)}
    </div>

    <div class="box" style="margin-top:0;">
      <div class="boxBody center" style="font-weight:700; min-height:auto; padding:18px 12px;">
        CERTIFY THAT THE GOODS SHIPPED ARE UNDER NON-NEGATIVE LIST OF IMPORT AND EXPORT POLICY 2015-2020.
      </div>
    </div>

    <div class="box" style="margin-top:0;">
      <div class="boxBody center" style="font-weight:700; min-height:auto; padding:14px 12px;">
        DESCRIPTION OF GOODS : ${esc(deal.productName || "—")}
      </div>
    </div>

    <div class="box" style="margin-top:0;">
      <div class="boxBody center" style="font-weight:800; font-size:18px; min-height:auto; padding:14px 12px;">
        QUANTITY (MTONS): ${esc(deal.quantity || "—")}
      </div>
    </div>

    ${additionalDetailsBlock(deal, supplier, "", `
        <div style="margin-top:14px">
          <b>DECLARATION:</b> GOODS PACKED IN EXPORT SEAWORTHY ${esc(deal.loaded_on || "ISO TANKS")}
        </div>
    `, false)}

    ${footer(company, date, false)}`;
}

export function buildCOO(deal, buyer, supplier, company = {}) {
  const date = deal.shipment_out_date || deal.invoice_date || new Date().toISOString();
  const filename = suggestFilename("COO", deal, buyer, company);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(filename)}</title>
    ${commonStyle()}
    ${previewScript()}
  </head>
  <body>
    ${previewActions()}
    <div class="doc">${innerCOO(deal, buyer, supplier, company, date)}</div>
  </body>
  </html>`;
}

export function buildDocumentSet(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.shipment_out_date || new Date().toISOString();
  const currency = docCurrency(deal);
  const blNo = (deal.bl_no || deal.blNo || "NOBL").replace(/[^A-Z0-9]/gi, "");
  const shipper = (company.name || "JK").split(/\s+/)[0].toUpperCase();
  const product = (deal.product_name || deal.productName || "PRODUCT").toUpperCase();
  let productShort = product.split(/\s+/).filter(w => w.length > 0).map(w => w[0]).join("");
  if (product.includes("LUBRICATING OIL")) productShort = "LO";
  else if (product.includes("BASE OIL")) productShort = "BO";
  else if (product.includes("BITUMEN")) productShort = "BT";
  const consignee = (buyer?.name || "BUYER").split(/\s+/).filter(Boolean).slice(0, 2).join(" ").toUpperCase();
  const docNo = String(deal.ci_no || deal.dealNo || deal.deal_no || "000").replace(/[^A-Z0-9\-\/]/gi, "");

  const filename = `SET-${blNo}-${shipper}-${productShort}-${consignee}-${docNo}`;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(filename)}</title>
    ${commonStyle()}
    ${previewScript()}
    <style>
      .doc { page-break-after: always !important; }
      .doc:last-child { page-break-after: auto !important; }
    </style>
  </head>
  <body>
    ${previewActions()}
    <div class="doc">${innerCI(deal, buyer, supplier, company, date, currency)}</div>
    <div class="doc">${innerPL(deal, buyer, supplier, company, date)}</div>
    <div class="doc">${innerCOO(deal, buyer, supplier, company, date)}</div>
  </body>
  </html>`;
}

export function buildSupplierStatement(deal, buyer, supplier, payments, company = {}) {
  const date = new Date().toISOString();
  const outPayments = payments.filter(p => p.direction === "out");
  const purchaseTotalUsd = Number(deal.purchase_total_usd || 0);
  const purchaseTotalAed = Number(deal.purchase_total_aed || 0);
  const conv = Number(deal.purchase_conversion_rate || deal.conversion_rate || 3.6725);

  let paidAed = 0;
  let paidUsd = 0;
  outPayments.forEach(p => {
    const amt = Number(p.amount || 0);
    if (p.currency === "AED") {
      paidAed += amt;
      paidUsd += (amt / conv);
    } else {
      paidUsd += amt;
      paidAed += (amt * conv);
    }
  });

  const balAed = purchaseTotalAed - paidAed;
  const balUsd = purchaseTotalUsd - paidUsd;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(suggestFilename("SUPPLIER-SETTLEMENT", deal, buyer, supplier, company))}</title>
    ${commonStyle()}
    ${previewScript()}
    <style>
      .doc { width: 210mm; padding: 10mm; }
      .statement-table th { background: #dce6f1; color: #333; border: 1px solid #999; font-size: 10px; }
      .statement-table td { border: 1px solid #ccc; padding: 4px; }
      .summary-box { border: 1px solid #3b9da2; padding: 10px; margin-top: 20px; background:#f9f9f9; }
      .bal-to-pay { background: #ffff00; font-weight: 800; padding: 4px; border: 1px solid #000; }
      .excel-header { background: #dce6f1; font-weight: bold; text-align: center; padding: 5px; border: 1px solid #999; text-transform: uppercase; }
    </style>
  </head>
  <body>
    ${previewActions()}
    
    <div style="margin-bottom: 20px; font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px;">
      SUPPLIER SETTLEMENT REPORT - ${esc(deal.deal_no)}
    </div>

    <div class="excel-header">PURCHASE (${esc(supplier?.name || "PRIME")})</div>
    <table class="statement-table thin">
      <tr>
        <th style="width:25%">MATERIAL</th>
        <th style="width:10%">QTY</th>
        <th style="width:10%">RATE</th>
        <th style="width:15%">Amount USD</th>
        <th style="width:15%">AED @${conv}</th>
        <th style="width:10%">DUE</th>
        <th style="width:15%">Due Amount USD</th>
      </tr>
      <tr>
        <td class="center">${esc(deal.product_name)}</td>
        <td class="center">${fmt(deal.quantity)}</td>
        <td class="center">${fmt(deal.docPurchaseRate || deal.purchase_rate)}</td>
        <td class="right">${fmt(purchaseTotalUsd)}</td>
        <td class="right">${fmt(purchaseTotalAed)}</td>
        <td class="center">100%</td>
        <td class="right">${fmt(purchaseTotalUsd)}</td>
      </tr>
      <tr style="background:#f2f2f2; font-weight:bold">
        <td colspan="3" class="right">TOTAL</td>
        <td class="right">${fmt(purchaseTotalUsd)}</td>
        <td class="right">${fmt(purchaseTotalAed)}</td>
        <td></td>
        <td class="right">${fmt(purchaseTotalUsd)}</td>
      </tr>
    </table>

    <div class="excel-header" style="margin-top:20px">PAYMENT</div>
    <table class="statement-table thin">
      <tr>
        <th style="width:20%">DATE</th>
        <th style="width:25%">AED</th>
        <th style="width:25%">USD</th>
        <th style="width:30%">METHOD / REF</th>
      </tr>
      ${outPayments.length ? outPayments.map(p => {
    const pUsd = p.currency === "USD" ? p.amount : p.amount / conv;
    const pAed = p.currency === "AED" ? p.amount : p.amount * conv;
    return `
        <tr>
          <td class="center">${fmtDate(p.payment_date)}</td>
          <td class="right">${fmt(pAed)}</td>
          <td class="right">${fmt(pUsd)}</td>
          <td>${esc(p.method)} ${p.ref ? `(${esc(p.ref)})` : ""}</td>
        </tr>`;
  }).join("") : `<tr><td colspan="4" class="center">No payments recorded</td></tr>`}
      <tr style="background:#f2f2f2; font-weight:bold">
        <td class="right">TOTAL PAID</td>
        <td class="right">${fmt(paidAed)}</td>
        <td class="right">${fmt(paidUsd)}</td>
        <td></td>
      </tr>
    </table>

    <div class="excel-header" style="margin-top:20px">FINAL SUMMARY</div>
    <div class="summary-box">
      <table class="plainTable" style="width:100%">
        <tr>
          <td style="width:200px; font-weight:bold">Due Amount</td>
          <td style="width:150px" class="right">AED ${fmt(purchaseTotalAed)}</td>
          <td style="width:150px" class="right">USD ${fmt(purchaseTotalUsd)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="font-weight:bold">Less Payment Done</td>
          <td class="right">AED ${fmt(paidAed)}</td>
          <td class="right">USD ${fmt(paidUsd)}</td>
          <td></td>
        </tr>
        <tr style="height:15px"><td></td><td></td><td></td><td></td></tr>
        <tr style="height:15px"><td></td><td></td><td></td><td></td></tr>
        <tr style="font-weight:800">
          <td>Total:</td>
          <td class="right"><span class="bal-to-pay">${fmt(balAed)}</span></td>
          <td class="right"><span class="bal-to-pay">${fmt(balUsd)}</span></td>
          <td style="padding-left:10px; font-size:10px">BAL TO PAY</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 30px; font-size: 10px; color: #666; text-align: right;">
      Generated on ${fmtDate(new Date())} · BL No: ${esc(deal.bl_no || "PENDING")}
    </div>
  </body>
  </html>`;
}

export function buildBuyerStatement(deal, buyer, supplier, payments, company = {}) {
  const date = new Date().toISOString();
  const inPayments = payments.filter(p => p.direction === "in");
  const saleTotalUsd = Number(deal.total_amount_usd || 0);
  const saleTotalAed = Number(deal.total_amount_aed || 0);
  const conv = Number(deal.sale_conversion_rate || deal.conversion_rate || 3.6725);

  let recAed = 0;
  let recUsd = 0;
  inPayments.forEach(p => {
    const amt = Number(p.amount || 0);
    if (p.currency === "AED") {
      recAed += amt;
      recUsd += (amt / conv);
    } else {
      recUsd += amt;
      recAed += (amt * conv);
    }
  });

  const balAed = saleTotalAed - recAed;
  const balUsd = saleTotalUsd - recUsd;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(suggestFilename("BUYER-SETTLEMENT", deal, buyer, supplier, company))}</title>
    ${commonStyle()}
    ${previewScript()}
    <style>
      .doc { width: 210mm; padding: 10mm; }
      .statement-table th { background: #dce6f1; color: #333; border: 1px solid #999; font-size: 10px; }
      .statement-table td { border: 1px solid #ccc; padding: 4px; }
      .summary-box { border: 1px solid #3b9da2; padding: 10px; margin-top: 20px; background:#f9f9f9; }
      .bal-to-rec { background: #ffff00; font-weight: 800; padding: 4px; border: 1px solid #000; }
      .excel-header { background: #dce6f1; font-weight: bold; text-align: center; padding: 5px; border: 1px solid #999; text-transform: uppercase; }
    </style>
  </head>
  <body>
    ${previewActions()}
    
    <div style="margin-bottom: 20px; font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px;">
      BUYER SETTLEMENT REPORT - ${esc(deal.deal_no)}
    </div>

    <div class="excel-header">SALE (${d.is_high_seas ? 'HIGH SEAS BUYER: ' + esc(buyer?.name || "DETAILS") : esc(buyer?.name || "DETAILS")})</div>
    <table class="statement-table thin">
      <tr>
        <th style="width:25%">MATERIAL</th>
        <th style="width:10%">QTY</th>
        <th style="width:10%">RATE</th>
        <th style="width:15%">Amount USD</th>
        <th style="width:15%">AED @${conv}</th>
        <th style="width:10%">DUE</th>
        <th style="width:15%">Due Amount USD</th>
      </tr>
      <tr>
        <td class="center">${esc(deal.product_name)}</td>
        <td class="center">${fmt(deal.quantity)}</td>
        <td class="center">${fmt(deal.docRate || deal.rate)}</td>
        <td class="right">${fmt(saleTotalUsd)}</td>
        <td class="right">${fmt(saleTotalAed)}</td>
        <td class="center">100%</td>
        <td class="right">${fmt(saleTotalUsd)}</td>
      </tr>
      <tr style="background:#f2f2f2; font-weight:bold">
        <td colspan="3" class="right">TOTAL</td>
        <td class="right">${fmt(saleTotalUsd)}</td>
        <td class="right">${fmt(saleTotalAed)}</td>
        <td></td>
        <td class="right">${fmt(saleTotalUsd)}</td>
      </tr>
    </table>

    <div class="excel-header" style="margin-top:20px">PAYMENTS RECEIVED</div>
    <table class="statement-table thin">
      <tr>
        <th style="width:20%">DATE</th>
        <th style="width:25%">AED</th>
        <th style="width:25%">USD</th>
        <th style="width:30%">METHOD / REF</th>
      </tr>
      ${inPayments.length ? inPayments.map(p => {
    const pUsd = p.currency === "USD" ? p.amount : p.amount / conv;
    const pAed = p.currency === "AED" ? p.amount : p.amount * conv;
    return `
        <tr>
          <td class="center">${fmtDate(p.payment_date)}</td>
          <td class="right">${fmt(pAed)}</td>
          <td class="right">${fmt(pUsd)}</td>
          <td>${esc(p.method)} ${p.ref ? `(${esc(p.ref)})` : ""}</td>
        </tr>`;
  }).join("") : `<tr><td colspan="4" class="center">No payments recorded</td></tr>`}
      <tr style="background:#f2f2f2; font-weight:bold">
        <td class="right">TOTAL RECEIVED</td>
        <td class="right">${fmt(recAed)}</td>
        <td class="right">${fmt(recUsd)}</td>
        <td></td>
      </tr>
    </table>

    <div class="excel-header" style="margin-top:20px">FINAL SUMMARY</div>
    <div class="summary-box">
      <table class="plainTable" style="width:100%">
        <tr>
          <td style="width:200px; font-weight:bold">Invoice Amount</td>
          <td style="width:150px" class="right">AED ${fmt(saleTotalAed)}</td>
          <td style="width:150px" class="right">USD ${fmt(saleTotalUsd)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="font-weight:bold">Less Payment Received</td>
          <td class="right">AED ${fmt(recAed)}</td>
          <td class="right">USD ${fmt(recUsd)}</td>
          <td></td>
        </tr>
        <tr style="height:15px"><td></td><td></td><td></td><td></td></tr>
        <tr style="height:15px"><td></td><td></td><td></td><td></td></tr>
        <tr style="font-weight:800">
          <td>Total:</td>
          <td class="right"><span class="bal-to-rec">${fmt(balAed)}</span></td>
          <td class="right"><span class="bal-to-rec">${fmt(balUsd)}</span></td>
          <td style="padding-left:10px; font-size:10px">BAL RECEIVABLE</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 30px; font-size: 10px; color: #666; text-align: right;">
      Generated on ${fmtDate(new Date())} · BL No: ${esc(deal.bl_no || "—")}
    </div>
  </body>
  </html>`;
}

export function buildSupplierMasterStatement(supplier, deals, allPayments, company = {}) {
  const date = new Date().toISOString();

  let totalDueAed = 0;
  let totalDueUsd = 0;
  let totalPaidAed = 0;
  let totalPaidUsd = 0;

  const dealRows = deals.map(d => {
    const qty = Number(d.quantity || 0);
    const rate = Number(d.purchase_rate || 0);
    const conv = Number(d.purchase_conversion_rate || d.conversion_rate || 3.6725);
    const amtUsd = qty * rate;
    const amtAed = amtUsd * conv;

    totalDueUsd += amtUsd;
    totalDueAed += amtAed;

    return { ...d, amtUsd, amtAed, conv };
  });

  const paymentRows = allPayments.filter(p => p.direction === "out").map(p => {
    const deal = deals.find(d => String(d.id) === String(p.deal_id)) || {};
    const dealConv = Number(deal.purchase_conversion_rate || deal.conversion_rate || 3.6725);
    const conv = (Number(p.conversion_rate) && Number(p.conversion_rate) !== 1) ? Number(p.conversion_rate) : dealConv;
    const amt = Number(p.amount || 0);
    let pUsd = 0, pAed = 0;

    if (p.currency === "AED") {
      pAed = amt;
      pUsd = amt / conv;
    } else {
      pUsd = amt;
      pAed = amt * conv;
    }

    totalPaidAed += pAed;
    totalPaidUsd += pUsd;

    return { ...p, pAed, pUsd };
  });

  const balAed = totalDueAed - totalPaidAed;
  const balUsd = totalDueUsd - totalPaidUsd;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(suggestFilename("SUPPLIER-MASTER-SETTLEMENT", { dealCount: deals.length }, supplier, company))}</title>
    ${commonStyle()}
    ${previewScript()}
    <style>
      .statement-table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: auto; }
      .statement-table th { background: #3b9da2; color: white; border: 1px solid #2a7a7d; font-size: 8px; padding: 4px 2px; text-transform: uppercase; }
      .statement-table td { border: 1px solid #ccc; padding: 3px 2px; font-size: 8px; word-break: break-word; }
      .summary-box { border: 2px solid #3b9da2; padding: 15px; margin-top: 30px; background:#f9fdfe; border-radius: 8px; }
      .bal-to-pay { background: #ffff00; font-weight: 800; padding: 2px 6px; border: 1px solid #000; border-radius: 4px; }
      .excel-header { background: #2a7a7d; color:white; font-weight: bold; text-align: center; padding: 8px; border: 1px solid #333; text-transform: uppercase; margin-top: 20px; border-radius: 4px 4px 0 0; font-size: 14px; }
    </style>
  </head>
  <body>
    ${previewActions()}
    <div class="doc">
      <div style="margin-bottom: 25px; font-size: 18px; font-weight: bold; border-bottom: 4px solid #3b9da2; padding-bottom: 10px; display:flex; justify-content:space-between; align-items: flex-end;">
        <span style="color:#2a7a7d">MASTER SETTLEMENT REPORT</span>
        <span style="font-size: 14px; color: #666;">SUPPLIER: ${esc(supplier.name)}</span>
      </div>

      <div class="excel-header">PURCHASE TRANSACTIONS (ALL DEALS)</div>
      <table class="statement-table">
        <thead>
          <tr>
            <th style="width: 50px;">DEAL NO</th>
            <th style="width: 55px;">DATE</th>
            <th style="width: 65px;">BL NO</th>
            <th>BUYER</th>
            <th style="width: 80px;">MATERIAL</th>
            <th style="width: 45px;">QTY</th>
            <th style="width: 45px;">RATE</th>
            <th style="width: 70px;">AMOUNT USD</th>
            <th style="width: 75px;">AMOUNT AED</th>
          </tr>
        </thead>
        <tbody>
          ${dealRows.map(r => `
            <tr>
              <td class="center" style="font-weight:bold">${esc(r.deal_no)}</td>
              <td class="center">${new Date(r.invoice_date || r.created_at).toLocaleDateString()}</td>
              <td class="center">${esc(r.bl_no || "—")}</td>
              <td>
                ${esc((state.buyers.find(b => String(b.id) === String(r.buyer_id)) || {}).name || "—")}
                ${r.is_high_seas ? `<br><small style="color:var(--info)">HSS: ${esc((state.buyers.find(b => String(b.id) === String(r.high_seas_buyer_id)) || {}).name || "—")}</small>` : ""}
              </td>
              <td>${esc(r.product_name)}</td>
              <td class="right">${Number(r.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(r.purchase_rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(r.amtUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(r.amtAed).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr style="background:#f2f2f2; font-weight:bold">
            <td colspan="7" class="right">TOTAL PAYABLE</td>
            <td class="right">${totalDueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="right">${totalDueAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>

      <div class="excel-header">PAYMENTS SENT</div>
      <table class="statement-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>DEAL REF</th>
            <th>AED</th>
            <th>USD</th>
            <th>METHOD / NOTE</th>
          </tr>
        </thead>
        <tbody>
          ${paymentRows.length ? paymentRows.map(p => `
            <tr>
              <td class="center">${new Date(p.payment_date).toLocaleDateString()}</td>
              <td class="center">${esc(deals.find(d => String(d.id) === String(p.deal_id))?.deal_no || "—")}</td>
              <td class="right">${Number(p.pAed).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(p.pUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td>${esc(p.method)} ${p.ref ? `(${esc(p.ref)})` : ""}</td>
            </tr>
          `).join("") : `<tr><td colspan="5" class="center">No payments recorded</td></tr>`}
        </tbody>
        <tfoot>
          <tr style="background:#f2f2f2; font-weight:bold">
            <td colspan="2" class="right">TOTAL PAID</td>
            <td class="right">${totalPaidAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="right">${totalPaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div class="excel-header">CONSOLIDATED SUMMARY</div>
      <div class="summary-box">
        <table style="width:100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; font-weight:bold">Total Invoice Amount (All Deals)</td>
            <td style="padding: 10px;" class="right">AED ${totalDueAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="padding: 10px;" class="right">USD ${totalDueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; font-weight:bold">Total Payment Sent</td>
            <td style="padding: 10px;" class="right">AED ${totalPaidAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="padding: 10px;" class="right">USD ${totalPaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding: 15px 10px; font-weight:800; font-size:16px; color:#2a7a7d">NET OUTSTANDING TO PAY:</td>
            <td style="padding: 15px 10px;" class="right"><span class="bal-to-pay">${balAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
            <td style="padding: 15px 10px;" class="right"><span class="bal-to-pay">${balUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 50px; font-size: 11px; color: #999; text-align: right; border-top: 1px solid #eee; padding-top: 10px;">
        Generated on ${new Date().toLocaleString()} · JK Trade Manager
      </div>
    </div>
  </body>
  </html>`;
}

export function buildBuyerMasterStatement(buyer, deals, allPayments, company = {}) {
  const date = new Date().toISOString();

  let totalDueAed = 0;
  let totalDueUsd = 0;
  let totalRecAed = 0;
  let totalRecUsd = 0;

  const dealRows = deals.map(d => {
    const qty = Number(d.quantity || 0);
    const rate = Number(d.rate || 0);
    const conv = Number(d.sale_conversion_rate || d.conversion_rate || 3.6725);
    const amtUsd = qty * rate;
    const amtAed = amtUsd * conv;

    totalDueUsd += amtUsd;
    totalDueAed += amtAed;

    return { ...d, amtUsd, amtAed, conv };
  });

  const paymentRows = allPayments.filter(p => p.direction === "in").map(p => {
    const deal = deals.find(d => String(d.id) === String(p.deal_id)) || {};
    const dealConv = Number(deal.sale_conversion_rate || deal.conversion_rate || 3.6725);
    const conv = (Number(p.conversion_rate) && Number(p.conversion_rate) !== 1) ? Number(p.conversion_rate) : dealConv;
    const amt = Number(p.amount || 0);
    let pUsd = 0, pAed = 0;

    if (p.currency === "AED") {
      pAed = amt;
      pUsd = amt / conv;
    } else {
      pUsd = amt;
      pAed = amt * conv;
    }

    totalRecAed += pAed;
    totalRecUsd += pUsd;

    return { ...p, pAed, pUsd };
  });

  const balAed = totalDueAed - totalRecAed;
  const balUsd = totalDueUsd - totalRecUsd;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(suggestFilename("BUYER-MASTER-SETTLEMENT", { dealCount: deals.length }, buyer, company))}</title>
    ${commonStyle()}
    ${previewScript()}
    <style>
      .statement-table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: auto; }
      .statement-table th { background: #3b9da2; color: white; border: 1px solid #2a7a7d; font-size: 8px; padding: 4px 2px; text-transform: uppercase; }
      .statement-table td { border: 1px solid #ccc; padding: 3px 2px; font-size: 8px; word-break: break-word; }
      .summary-box { border: 2px solid #3b9da2; padding: 15px; margin-top: 30px; background:#f9fdfe; border-radius: 8px; }
      .bal-to-rec { background: #ffff00; font-weight: 800; padding: 2px 6px; border: 1px solid #000; border-radius: 4px; }
      .excel-header { background: #2a7a7d; color:white; font-weight: bold; text-align: center; padding: 8px; border: 1px solid #333; text-transform: uppercase; margin-top: 20px; border-radius: 4px 4px 0 0; font-size: 14px; }
    </style>
  </head>
  <body>
    ${previewActions()}
    <div class="doc">
      <div style="margin-bottom: 25px; font-size: 18px; font-weight: bold; border-bottom: 4px solid #3b9da2; padding-bottom: 10px; display:flex; justify-content:space-between; align-items: flex-end;">
        <span style="color:#2a7a7d">MASTER SETTLEMENT REPORT</span>
        <span style="font-size: 14px; color: #666;">BUYER: ${esc(buyer.name)}</span>
      </div>

      <div class="excel-header">SALE TRANSACTIONS (ALL DEALS)</div>
      <table class="statement-table">
        <thead>
          <tr>
            <th style="width: 50px;">DEAL NO</th>
            <th style="width: 55px;">DATE</th>
            <th style="width: 65px;">BL NO</th>
            <th>SUPPLIER</th>
            <th style="width: 80px;">MATERIAL</th>
            <th style="width: 45px;">QTY</th>
            <th style="width: 45px;">RATE</th>
            <th style="width: 70px;">AMOUNT USD</th>
            <th style="width: 75px;">AMOUNT AED</th>
          </tr>
        </thead>
        <tbody>
          ${dealRows.map(r => `
            <tr>
              <td class="center" style="font-weight:bold">${esc(r.deal_no)}</td>
              <td class="center">${new Date(r.invoice_date || r.created_at).toLocaleDateString()}</td>
              <td class="center">${esc(r.bl_no || "—")}</td>
              <td>${esc((state.suppliers.find(s => String(s.id) === String(r.supplier_id)) || {}).name || "—")}</td>
              <td>${esc(r.product_name)}</td>
              <td class="right">${Number(r.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(r.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(r.amtUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(r.amtAed).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr style="background:#f2f2f2; font-weight:bold">
            <td colspan="7" class="right">TOTAL RECEIVABLE</td>
            <td class="right">${totalDueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="right">${totalDueAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>

      <div class="excel-header">PAYMENTS RECEIVED</div>
      <table class="statement-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>DEAL REF</th>
            <th>AED</th>
            <th>USD</th>
            <th>METHOD / NOTE</th>
          </tr>
        </thead>
        <tbody>
          ${paymentRows.length ? paymentRows.map(p => `
            <tr>
              <td class="center">${new Date(p.payment_date).toLocaleDateString()}</td>
              <td class="center">${esc(deals.find(d => String(d.id) === String(p.deal_id))?.deal_no || "—")}</td>
              <td class="right">${Number(p.pAed).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(p.pUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td>${esc(p.method)} ${p.ref ? `(${esc(p.ref)})` : ""}</td>
            </tr>
          `).join("") : `<tr><td colspan="5" class="center">No payments received</td></tr>`}
        </tbody>
        <tfoot>
          <tr style="background:#f2f2f2; font-weight:bold">
            <td colspan="2" class="right">TOTAL RECEIVED</td>
            <td class="right">${totalRecAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="right">${totalRecUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div class="excel-header">CONSOLIDATED SUMMARY</div>
      <div class="summary-box">
        <table style="width:100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; font-weight:bold">Total Invoice Amount (All Deals)</td>
            <td style="padding: 10px;" class="right">AED ${totalDueAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="padding: 10px;" class="right">USD ${totalDueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; font-weight:bold">Total Payment Received</td>
            <td style="padding: 10px;" class="right">AED ${totalRecAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="padding: 10px;" class="right">USD ${totalRecUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding: 15px 10px; font-weight:800; font-size:16px; color:#2a7a7d">NET OUTSTANDING TO RECEIVE:</td>
            <td style="padding: 15px 10px;" class="right"><span class="bal-to-rec">${balAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
            <td style="padding: 15px 10px;" class="right"><span class="bal-to-rec">${balUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 50px; font-size: 11px; color: #999; text-align: right; border-top: 1px solid #eee; padding-top: 10px;">
        Generated on ${new Date().toLocaleString()} · JK Trade Manager
      </div>
    </div>
  </body>
  </html>`;
}

export function buildAgentStatement(agent, deals, company = {}, payments = []) {
  const date = new Date().toLocaleDateString();
  let totalCommUsd = 0;
  let totalCommAed = 0;

  const rows = deals.map(d => {
    const amt = Number(d.commission_total || 0);
    const curr = d.commission_currency || "USD";
    const conv = Number(d.conversion_rate || 3.6725);
    let aUsd = 0, aAed = 0;
    if (curr === "AED") { aAed = amt; aUsd = amt / conv; }
    else { aUsd = amt; aAed = amt * conv; }
    totalCommUsd += aUsd;
    totalCommAed += aAed;
    return { ...d, aUsd, aAed, curr };
  });

  let totalPaidUsd = 0;
  let totalPaidAed = 0;
  const pRows = payments.map(p => {
    const amt = Number(p.amount || 0);
    const curr = p.currency || "AED";
    const conv = 3.6725; // Default for agent payments
    let pUsd = 0, pAed = 0;
    if (curr === "AED") { pAed = amt; pUsd = amt / conv; }
    else { pUsd = amt; pAed = amt * conv; }

    if (p.type === "out") { totalPaidUsd += pUsd; totalPaidAed += pAed; }
    else { totalPaidUsd -= pUsd; totalPaidAed -= pAed; }
    return { ...p, pUsd, pAed };
  });

  const balUsd = totalCommUsd - totalPaidUsd;
  const balAed = totalCommAed - totalPaidAed;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Agent Statement - ${esc(agent.name)}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.4; }
      .doc { width: 210mm; margin: auto; border: 1px solid #eee; padding: 15mm; }
      .header { display: flex; justify-content: space-between; border-bottom: 2px solid #d4af37; padding-bottom: 10px; margin-bottom: 15px; }
      .company-name { font-size: 18px; font-weight: 800; color: #d4af37; }
      .title { font-size: 20px; font-weight: 800; text-align: center; margin: 15px 0; color: #222; text-transform: uppercase; }
      .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .table th { background: #f8f8f8; border: 1px solid #ddd; padding: 8px; font-size: 10px; text-transform: uppercase; text-align: left; }
      .table td { border: 1px solid #ddd; padding: 8px; font-size: 11px; }
      .total-row { font-weight: 800; background: #f9f9f9; }
      .bal-box { background: #ffff00; font-weight: 800; padding: 5px 10px; border: 1px solid #000; display: inline-block; }
      .right { text-align: right; }
      .section-title { font-weight: 800; font-size: 12px; margin-top: 20px; margin-bottom: 5px; color: #d4af37; border-bottom: 1px solid #eee; padding-bottom: 3px; }
      @media print { .no-print { display: none; } }
    </style>
  </head>
  <body>
    <div class="doc">
      <button class="no-print" onclick="window.print()" style="margin-bottom:15px; padding:6px 12px; background:#d4af37; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Print Report</button>
      
      <div class="header">
        <div>
          <div class="company-name">${esc(company.name)}</div>
          <div style="font-size:11px; margin-top:3px; white-space:pre-wrap;">${esc(company.address)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700; font-size:12px">DATE: ${date}</div>
          <div style="font-size:11px">COMMISSION ACCOUNT STATEMENT</div>
        </div>
      </div>

      <div class="title">Agent Account Statement</div>

      <div style="margin-bottom:15px">
        <div style="font-weight:700; font-size:12px">AGENT: ${esc(agent.name)}</div>
        <div style="font-size:11px; color:#666">${esc(agent.country || "—")} | ${esc(agent.phone || "—")}</div>
      </div>

      <div class="section-title">COMMISSION TRANSACTIONS (FROM DEALS)</div>
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Deal No</th>
            <th>Material</th>
            <th>Qty</th>
            <th>Rate</th>
            <th class="right">USD</th>
            <th class="right">AED</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${new Date(r.invoice_date || r.created_at).toLocaleDateString()}</td>
              <td style="font-weight:700">${esc(r.deal_no)}</td>
              <td>${esc(r.product_name)}</td>
              <td>${Number(r.quantity || 0).toLocaleString()} ${esc(r.unit || "MT")}</td>
              <td>${Number(r.commission_rate || 0).toFixed(2)}</td>
              <td class="right">${Number(r.aUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${Number(r.aAed).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5" class="right">GROSS COMMISSION EARNED</td>
            <td class="right">${totalCommUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="right">${totalCommAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>

      <div class="section-title">PAYMENTS MADE TO AGENT</div>
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Mode</th>
            <th>Ref / Note</th>
            <th>Type</th>
            <th class="right">USD</th>
            <th class="right">AED</th>
          </tr>
        </thead>
        <tbody>
          ${pRows.map(p => `
            <tr>
              <td>${new Date(p.payment_date).toLocaleDateString()}</td>
              <td>${esc(p.mode)}</td>
              <td>${esc(p.ref || "—")}</td>
              <td style="color:${p.type === "out" ? "inherit" : "var(--success)"}">${p.type.toUpperCase()}</td>
              <td class="right">${p.type === "out" ? "" : "+"}${Number(p.pUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${p.type === "out" ? "" : "+"}${Number(p.pAed).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")}
          ${!pRows.length ? '<tr><td colspan="6" style="text-align:center; opacity:0.5">No payment history found.</td></tr>' : ''}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="4" class="right">TOTAL PAYMENTS SENT</td>
            <td class="right">${totalPaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="right">${totalPaidAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:25px; border:2px solid #000; padding:15px; display:flex; justify-content:space-between; align-items:center; background:#fcfcfc">
        <div>
           <div style="font-weight:800; font-size:14px; text-transform:uppercase">Net Outstanding Balance:</div>
           <div style="font-size:11px; color:#666">Remaining commission amount to be paid to agent.</div>
        </div>
        <div style="text-align:right">
           <div class="bal-box" style="font-size:18px">USD ${balUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><br>
           <div class="bal-box" style="margin-top:5px">AED ${balAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      </div>
    </div>
  </body>
  </html>`;
}

export function buildCOA(coa, deal, company = {}) {
  const date = coa.date || new Date().toISOString();
  const blNo = coa.bl_no || deal.bl_no || "—";
  const grade = coa.grade || deal.product_name || "—";
  const certNo = coa.cert_no || `COA/${String(grade).substring(0, 2).toUpperCase()}/${blNo}/${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`;
  const tests = coa.tests || [];

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(suggestFilename("COA", deal, (state.buyers.find(b => String(b.id) === String(deal?.buyer_id)) || {}), company, { coa }))}</title>
    ${commonStyle()}
    ${previewScript()}
    <style>
      .coa-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      .coa-table th, .coa-table td { border: 1px solid #000; padding: 8px 12px; font-size: 11px; color: #000; }
      .coa-table th { background: #dcdcdc; color: #000; font-weight: 800; text-align: left; text-transform: uppercase; }
      .coa-header-info { margin-top: 20px; font-size: 12px; line-height: 1.6; font-weight: bold; color: #000; }
      .coa-title { text-align: center; text-decoration: underline; font-size: 18px; font-weight: 800; margin: 20px 0; color: #000; }
      .sub-header { background: #f0f0f0; font-weight: bold; text-align: center !important; color: #000; }
    </style>
  </head>
  <body>
    ${previewActions()}
    <div class="doc">
      <!-- EXACT IMAGE HEADER START -->
      <div style="display:flex; align-items:center; gap:15px; border-bottom:1px solid #000; padding-bottom:10px;">
        <div style="width:15%">
          <img src="${LOGO_URL}" style="width:100%; max-width:140px;">
        </div>
        <div style="width:85%; text-align:center;">
          <div style="font-size:28px; font-weight:bold; color:#00529b; margin-bottom:2px; white-space:nowrap;">جيه كيه بتروكيم انترناشيونال م م ح</div>
          <div style="font-size:24px; font-weight:800; color:#00529b; margin-bottom:5px; white-space:nowrap;">JK Petrochem International FZE</div>
          <div style="font-size:11px; font-weight:600;">P6-ELOB, Office No. E2-110G-02, Hamriyah Free Zone, Sharjah, United Arab Emirates</div>
          <div style="font-size:11px; font-weight:600;">Phone: +971524 306 170, Email: info@jkpetrochem.com</div>
        </div>
      </div>

      <div style="text-align:center; font-size:24px; font-weight:800; text-decoration:underline; margin:25px 0;">Certificate Of Analysis</div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:15px;">
        <div style="font-size:14px; font-weight:bold;">
          <div style="margin-bottom:8px;">BL No.: ${esc(blNo)}</div>
          <div style="margin-bottom:8px;">Grade/Description : ${esc(grade)}</div>
          <div>Certificate no.: ${esc(certNo)}</div>
        </div>
        <div style="font-size:14px; font-weight:bold;">
          Date.: ${esc(fmtDate(date))}
        </div>
      </div>
      <!-- EXACT IMAGE HEADER END -->

    <table class="coa-table">
      <thead>
        <tr>
          <th style="width:35%">Test Parameters</th>
          <th style="width:25%">Method</th>
          <th style="width:15%">Unit</th>
          <th style="width:25%">Result</th>
        </tr>
      </thead>
      <tbody>
        ${tests.map(t => {
    if (t.isHeader) {
      return `<tr><td colspan="4" class="sub-header">${esc(t.parameter)}</td></tr>`;
    }
    return `
            <tr>
              <td>${esc(t.parameter)}</td>
              <td>${esc(t.method)}</td>
              <td>${esc(t.unit)}</td>
              <td>${esc(t.result)}</td>
            </tr>
          `;
  }).join("")}
        ${!tests.length ? '<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5">No test parameters entered</td></tr>' : ''}
      </tbody>
    </table>
    ${footer(company, date, true)}
    </div> <!-- end .doc -->
  </body>
  </html>`;
}

export function buildPO(po, supplier, company = {}) {
  const date = po.po_date;
  const specs = Array.isArray(po.specifications) ? po.specifications : [];
  const terms = Array.isArray(po.commercial_terms) ? po.commercial_terms : [];

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${esc(suggestFilename("PO", po, {}, company, { supplier }))}</title>
    ${commonStyle()}
    ${previewScript()}
    <style>
      .po-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed; }
      .po-table th, .po-table td { border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 11px; color: #000; word-break: break-word; }
      .po-table th { background: #dcdcdc; color: #000; font-weight: 800; text-transform: uppercase; }
      .po-section { margin-bottom: 20px; line-height: 1.6; color: #000; }
      .po-section h3 { font-size: 15px; margin-bottom: 5px; text-decoration: underline; font-weight: 800; }
      .po-section p { margin: 0; font-size: 14px; font-weight: bold; }
      .po-meta { font-weight: 800; font-size: 15px; color: #000; }
    </style>
  </head>
  <body>
    ${previewActions()}
    <div class="doc">
      <!-- EXACT IMAGE HEADER START -->
      <div style="display:flex; align-items:center; gap:15px; border-bottom:1px solid #000; padding-bottom:10px;">
        <div style="width:15%">
          <img src="${LOGO_URL}" style="width:100%; max-width:140px;">
        </div>
        <div style="width:85%; text-align:center;">
          <div style="font-size:28px; font-weight:bold; color:#00529b; margin-bottom:2px; white-space:nowrap;">جيه كيه بتروكيم انترناشيونال م م ح</div>
          <div style="font-size:24px; font-weight:800; color:#00529b; margin-bottom:5px; white-space:nowrap;">JK Petrochem International FZE</div>
          <div style="font-size:11px; font-weight:600;">P6-ELOB, Office No. E2-110G-02, Hamriyah Free Zone, Sharjah, United Arab Emirates</div>
          <div style="font-size:11px; font-weight:600;">Phone: +971524 306 170, Email: info@jkpetrochem.com</div>
        </div>
      </div>

      <div style="text-align:center; font-size:24px; font-weight:800; text-decoration:underline; margin:25px 0;">PURCHASE ORDER</div>

      <div class="po-meta" style="margin-bottom:20px">
        <div>PONo.: ${esc(po.po_no)}</div>
        <div>PODate: ${esc(fmtDate(date))}</div>
      </div>

      <div style="margin-bottom: 25px; line-height: 1.4; color: #000; max-width: 400px;">
        <div style="font-size: 16px; font-weight: 800; text-decoration: underline; margin-bottom:5px">Supplier:</div>
        <div style="font-size: 15px; font-weight: bold;">${esc(supplier?.name || "—")}</div>
        <div style="font-size: 14px;">${esc(supplier?.company_name || "")}</div>
        <div style="font-size: 14px; overflow-wrap: break-word; width: 100%; max-width: 380px;">${esc(supplier?.address || "—")}</div>
        <div style="font-size: 14px;">Email: ${esc(supplier?.email || "—")}</div>
        <div style="font-size: 14px;">Website: ${esc(supplier?.website || "—")}</div>
      </div>

      <table class="po-table">
        <thead>
          <tr>
            <th style="width:5%"></th>
            <th style="width:25%">Product Name</th>
            <th style="width:15%">HSN Code</th>
            <th style="width:10%">Packing</th>
            <th style="width:10%">Quantity</th>
            <th style="width:15%">Weight</th>
            <th style="width:10%">Price</th>
            <th style="width:10%">Incoterm</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><b>${esc(po.product_name)}</b></td>
            <td>${esc(po.hsn_code)}</td>
            <td>${esc(po.packing)}</td>
            <td>${esc(po.quantity)}</td>
            <td>${esc(po.weight)}</td>
            <td>${esc(po.price)}</td>
            <td>${esc(po.incoterm)}</td>
          </tr>
        </tbody>
      </table>

      ${specs.length ? `
        <div class="po-section">
          <h3>Specifications:</h3>
          ${specs.map(s => `<p>${esc(s)}</p>`).join("")}
        </div>
      ` : ""}

      ${terms.length ? `
        <div class="po-section">
          <h3>Commercial Terms:</h3>
          ${terms.map(t => `<p>${esc(t)}</p>`).join("")}
        </div>
      ` : ""}

      <div style="margin-top: 40px;">
        ${footer(company, date, true)}
      </div>
    </div>
  </body>
  </html>`;
}

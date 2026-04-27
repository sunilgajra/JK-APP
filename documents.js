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
    <title>Shipping Instruction</title>
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
        if (typeof html2pdf === "undefined") {
          alert("PDF library not loaded");
          return;
        }

        const actions = document.querySelector(".previewActions");
        if (actions) actions.style.display = "none";

        const element = document.querySelector(".doc");
        const title = document.title || "document";

        await waitForImages(element);
        await new Promise((r) => setTimeout(r, 500));

        const opt = {
          margin: [0, 0, 0, 0],
          filename: title + ".pdf",
          image: { type: "jpeg", quality: 1 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait"
          }
        };

        html2pdf()
          .from(element)
          .set(opt)
          .save()
          .then(() => {
            if (actions) actions.style.display = "flex";
          })
          .catch((err) => {
            console.error(err);
            if (actions) actions.style.display = "flex";
            alert("Failed to generate PDF");
          });
      }
    </script>
  `;
}

function commonStyle() {
  return `
  <style>
    @page { size: A4; margin: 8mm; }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
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
      margin: 0 auto;
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

function suggestFilename(type, deal, buyer, company) {
  const docType = type.toUpperCase();
  const blNo = (deal.bl_no || deal.blNo || "NOBL").replace(/[^A-Z0-9]/gi, "");
  const shipper = (company.name || "JK").split(/\s+/)[0].toUpperCase();
  
  const product = (deal.product_name || deal.productName || "PRODUCT").toUpperCase();
  let productShort = product.split(/\s+/).filter(w => w.length > 0).map(w => w[0]).join("");
  if (product.includes("LUBRICATING OIL")) productShort = "LO";
  else if (product.includes("BASE OIL")) productShort = "BO";
  else if (product.includes("BITUMEN")) productShort = "BT";
  
  const consignee = (buyer?.name || "BUYER").split(/\s+/).filter(Boolean).slice(0, 2).join(" ").toUpperCase();
  
  // Prioritize the number based on the document type
  let dNo = "";
  if (docType === "CI") dNo = deal.ci_no;
  else if (docType === "PI") dNo = deal.pi_no;
  else if (docType === "PL") dNo = deal.pl_no;
  else if (docType === "COO") dNo = deal.coo_no || deal.ci_no;
  
  // Fallback if the specific type number is missing
  const docNo = String(dNo || deal.ci_no || deal.pi_no || deal.pl_no || deal.dealNo || deal.deal_no || "000").replace(/[^A-Z0-9]/gi, "");
  
  const count = deal.dealCount || 1;
  
  return `${docType}-${blNo}-${shipper}-${productShort}-${consignee}-${docNo}-${count}`;
}

function additionalDetailsBlock(deal, supplier, docLabel = "Packing list No. Date:", extraHtml = "") {
  return `
    <div class="box" style="margin-top:0;">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <table class="plainTable">
          <tr>
            <td style="width:140px;">Country of Origin</td>
            <td>${esc(deal.country_of_origin || supplier?.country || "UAE")}</td>
          </tr>
          <tr>
            <td>${docLabel}</td>
            <td>${esc(String(deal.pl_no || deal.ci_no || deal.pi_no || deal.dealNo || "—").replace(/\s+/g, ""))}</td>
          </tr>
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
      <div>
        <div style="border-bottom: 2px solid #222; padding-bottom: 2px; font-size: 10px; font-weight: 700; min-height: 18px;">
          FOR ${esc(company.name || "")}
        </div>
        ${showSignatory ? `<div style="font-size:10px;font-weight:700;margin-top:4px;">Authorised Signatory</div>` : ``}
      </div>
      <div class="stamp"><img src="${STAMP_URL}" alt="stamp"></div>
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

    ${additionalDetailsBlock(deal, supplier, "Packing list No. Date:")}

    ${footer(company, date, true)}
  </body>
  </html>`;
}

export function buildCI(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.shipment_out_date || new Date().toISOString();
  const total = Number(deal.totalAmount || 0);
  const roundedTotal = Math.round(total);
  const roundOff = roundedTotal - total;
  const currency = docCurrency(deal);
  const filename = suggestFilename("CI", deal, buyer, company);

  return `
  <!DOCTYPE html><html><head><title>${esc(filename)}</title>${commonStyle()}${previewScript()}</head><body>
    ${previewActions()}
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
        <tr><td>Subtotal</td><td class="right">${fmt(total)}</td></tr>
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

    ${additionalDetailsBlock(deal, supplier, "Packing list No. Date:")}

    ${footer(company, date)}
  </body></html>`;
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

    ${additionalDetailsBlock(deal, supplier, "Packing list No. Date:")}

    ${footer(company, date, false)}
  </body>
  </html>`;
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

    ${additionalDetailsBlock(deal, supplier, "Invoice No. Date:", `
        <div style="margin-top:14px">
          <b>DECLARATION:</b> GOODS PACKED IN EXPORT SEAWORTHY ${esc(deal.loaded_on || "ISO TANKS")}
        </div>
    `)}

    ${footer(company, date, false)}
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
    <title>Supplier Statement - ${esc(deal.deal_no)}</title>
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
    <title>Buyer Statement - ${esc(deal.deal_no)}</title>
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

    <div class="excel-header">SALE (${esc(buyer?.name || "DETAILS")})</div>
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

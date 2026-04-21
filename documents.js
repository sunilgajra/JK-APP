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
      width: 194mm;
      min-width: 194mm;
      margin: 0 auto;
      padding: 0 2mm;
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
      padding: 8px 12px;
      border: none;
      background: #2f9aa0;
      color: #fff;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .top {
      display: grid;
      grid-template-columns: 1.05fr 0.72fr 1.05fr;
      gap: 10px;
      align-items: start;
      margin-bottom: 12px;
    }

    .logoBox {
      text-align: center;
      padding-top: 12px;
    }

    .logoBox img {
      width: 118px;
      max-width: 118px;
      object-fit: contain;
    }

    .docTitle {
      color: #3b9da2;
      font-size: 28px;
      font-weight: 800;
      text-align: right;
      line-height: 1;
      margin: 0 0 8px 0;
      letter-spacing: .3px;
    }

    .bar {
      background: #3b9da2;
      color: #fff;
      font-weight: 700;
      padding: 3px 6px;
      font-size: 11px;
      text-transform: uppercase;
      line-height: 1.1;
    }

    .panel {
      min-height: 110px;
    }

    .panelBody {
      padding: 5px 2px 0;
      line-height: 1.5;
      font-size: 10px;
      font-weight: 700;
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
      padding: 4px 5px;
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
      padding: 3px 6px;
      font-weight: 700;
      text-transform: uppercase;
      line-height: 1.1;
      font-size: 11px;
    }

    .boxBody {
      padding: 6px 8px;
      min-height: 60px;
      font-size: 10px;
      font-weight: 700;
    }

    .footer {
      margin-top: 14px;
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
      margin-top: 10px;
    }

    .red {
      color: #c62828;
      font-weight: 700;
    }

    .plainTable td {
      border: none !important;
      padding: 2px 0 !important;
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
        width: 194mm;
        min-width: 194mm;
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
      <button onclick="history.back()">Back</button>
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

function shippingBlock(deal = {}) {
  return `
    <div class="panel">
      <div class="bar">Shipping Details</div>
      <div class="panelBody tight">
        <div><b>Freight Type</b> &nbsp;&nbsp;&nbsp;&nbsp; ${esc(deal.freight_type || "BY SEA")}</div>
        <div><b>Shippment Date</b> &nbsp;&nbsp; [--------------]</div>
        <div><b>Gross Weight</b> &nbsp;&nbsp; [${esc(deal.gross_weight || "")}${deal.gross_weight ? " KGS" : ""}]</div>
        <div><b>Net Weight</b> &nbsp;&nbsp;&nbsp;&nbsp; [${esc(deal.net_weight || "")}${deal.net_weight ? " KGS" : ""}]</div>
        <div><b>Total Packages</b> &nbsp; ${esc(deal.package_details || "20ft x 10 Containers")}</div>
        <div class="red center" style="margin-top:6px">( Loaded on ${esc(deal.loaded_on || "ISO TANK")} )</div>
      </div>
    </div>
  `;
}

function footer(company = {}, date = "", showSignatory = false) {
  return `
    <div class="footer">
      <div>
        <div class="signLine">FOR ${esc(company.name || "")}</div>
        ${showSignatory ? `<div style="font-size:10px;font-weight:700;margin-top:4px;">Authorised Signatory</div>` : ``}
      </div>
      <div class="stamp"><img src="${STAMP_URL}" alt="stamp"></div>
      <div>
        <div class="signLine">${esc(fmtDate(date) || "")}</div>
        <div style="font-size:10px;font-weight:700;margin-top:4px;">Date</div>
      </div>
    </div>
    <div class="note">This is computer generated Document, No signature required</div>
  </div>
  `;
}
function buildPI(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.created_at || new Date().toISOString();
  const total = Number(deal.totalAmount || 0);
  const currency = docCurrency(deal);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>PI ${esc(deal.dealNo || "")}</title>
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
        <td>
          <b>${esc(deal.productName || "")}</b><br>
          HS CODE : : ${esc(deal.hsn || "—")}<br><br><br><br>
          ${esc(currency)} : ${esc(amountWords(total))} ONLY
        </td>
        <td class="center">${esc(deal.unit || "MTON")}</td>
        <td class="center">${esc(deal.quantity || "")}</td>
        <td class="right">${fmt(deal.rate || 0)}</td>
        <td class="center">-</td>
        <td class="right">${fmt(total)}</td>
      </tr>
    </table>

    <div class="smallGrid" style="margin-top:0; align-items:start; grid-template-columns: 1.35fr .75fr;">
      <div class="box">
        <div class="boxHead">Terms of Sale and Other Comments</div>
        <div class="boxBody tight">
          <div><b>Terms of Delivery / Payment :</b></div>
          <div style="margin-top:3px">
            ${esc(deal.terms_delivery || (deal.dischargePort ? `CFR ${deal.dischargePort},INDIA` : "CFR MUNDRA PORT,INDIA"))}
            / <span class="red">${esc(deal.payment_terms || "100% ADVANCE PAYMENT")}</span>
          </div>

          <div style="margin-top:8px"><b>BANK TERMS:</b> ${esc(deal.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}</div>

          <div style="margin-top:8px"><b>Our Bank Details:-</b></div>
          <div>Account Name: ${esc(company.name || "")}</div>
          <div>Account Number (${esc(currency)}): ${esc(company.bankAccount || "")}</div>
          <div>IBAN: ${esc(company.bankIBAN || "")}</div>
          <div>SWIFT ID: ${esc(company.bankSWIFT || "")}</div>
          <div>Bank Name: ${esc(company.bankName || "")}${company.branchName ? ` / Branch: ${esc(company.branchName)}` : ""}</div>

          <div style="margin-top:8px"><b>BANK TERMS:</b> ${esc(deal.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}</div>
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
        <tr><td>Other (specify)</td><td class="right">-</td></tr>
        <tr><td>Other (specify)</td><td class="right">-</td></tr>
        <tr><td><b>TOTAL</b></td><td class="right"><b>${fmt(total)}</b></td></tr>
        <tr><td>Currency</td><td class="right">${esc(currency)}</td></tr>
      </table>
    </div>

    <div class="box" style="margin-top:0;">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <table class="plainTable">
          <tr>
            <td style="width:150px;">Country of Origin</td>
            <td>${esc(deal.country_of_origin || supplier?.country || "")}</td>
          </tr>
          <tr>
            <td>Port of Loading</td>
            <td>${esc(deal.loadingPort || "")}</td>
          </tr>
          <tr>
            <td>Port of Discharge</td>
            <td>${esc(deal.dischargePort || "")}</td>
          </tr>
        </table>
      </div>
    </div>

    ${footer(company, date, true)}
  </body>
  </html>`;
}

function buildCI(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.shipment_out_date || new Date().toISOString();
  const total = Number(deal.totalAmount || 0);
  const currency = docCurrency(deal);

  return `
  <!DOCTYPE html><html><head><title>CI ${esc(deal.dealNo || "")}</title>${commonStyle()}${previewScript()}</head><body>
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
      <tr style="height:130px">
        <td>
          <b>${esc(deal.productName || "")}</b><br>
          HS CODE : : ${esc(deal.hsn || "—")}<br><br>
          ${esc(currency)} : ${esc(amountWords(total))} ONLY
        </td>
        <td class="center">${esc(deal.unit || "MTON")}</td>
        <td class="center">${esc(deal.quantity || "")}</td>
        <td class="right">${fmt(deal.rate || 0)}</td>
        <td class="center">-</td>
        <td class="right">${fmt(total)}</td>
      </tr>
    </table>

    <div class="smallGrid" style="margin-top:8px; align-items:start; grid-template-columns: 1.15fr .9fr .7fr;">
      <div class="box">
        <div class="boxHead">Terms of Sale and Other Comments</div>
        <div class="boxBody tight">
          <div><b>Terms of Delivery / Payment :</b></div>
          <div>${esc(deal.terms_delivery || `CFR ${deal.dischargePort || "MUNDRA PORT"}`)} / <span class="red">${esc(deal.payment_terms || "100% ADVANCE PAYMENT")}</span></div>
          <div style="margin-top:8px"><b>Our Bank Details:-</b></div>
          <div>Account Name: ${esc(company.name || "")}</div>
          <div>Account Number (${esc(currency)}): ${esc(company.bankAccount || "")}</div>
          <div>IBAN: ${esc(company.bankIBAN || "")}</div>
          <div>SWIFT ID: ${esc(company.bankSWIFT || "")}</div>
          <div>Bank Name: ${esc(company.bankName || "")}</div>
          <div style="margin-top:8px"><b>BANK TERMS:</b> ${esc(deal.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}</div>
        </div>
      </div>

      ${containerBlock(deal)}

      <table class="thin">
        <tr><td>Subtotal</td><td class="right">${fmt(total)}</td></tr>
        <tr><td>Taxable</td><td class="right">-</td></tr>
        <tr><td>Tax rate</td><td class="right">-</td></tr>
        <tr><td>Tax</td><td class="right">-</td></tr>
        <tr><td>Insurance</td><td class="right">-</td></tr>
        <tr><td>Legal/Consular</td><td class="right">-</td></tr>
        <tr><td>Inspection/Cert.</td><td class="right">-</td></tr>
        <tr><td>Rounded off:</td><td class="right">-</td></tr>
        <tr><td>Other (specify)</td><td class="right">-</td></tr>
        <tr><td><b>TOTAL</b></td><td class="right"><b>${fmt(total)}</b></td></tr>
        <tr><td>Currency</td><td class="right">${esc(currency)}</td></tr>
      </table>
    </div>

    <div class="box">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <div>Country of Origin ${esc(deal.country_of_origin || supplier?.country || "UAE")}</div>
        <div>Packing list No. Date: ${esc(String(deal.pl_no || "—").replace(/\s+/g, ""))}</div>
        <div>Port of Loading ${esc(deal.loadingPort || "—")}</div>
        <div>Port of Discharge ${esc(deal.dischargePort || "—")}</div>
        <div>BL NO: ${esc(deal.bl_no || "—")}</div>
        <div>Vessel / Voyage No. ${esc(deal.vessel_voyage || deal.vessel || "—")}</div>
        <div>CFS: ${esc(deal.cfs || "-")}</div>
      </div>
    </div>

    ${footer(company, date)}
  </body></html>`;
}

function buildPL(deal, buyer, supplier, company = {}) {
  const date = deal.shipment_out_date || deal.invoice_date || new Date().toISOString();

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>PL ${esc(deal.dealNo || "")}</title>
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
          HS CODE : : ${esc(deal.hsn || "—")}
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

    <div class="box" style="margin-top:0;">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <table class="plainTable">
          <tr>
            <td style="width:140px;">Country of Origin</td>
            <td>${esc(deal.country_of_origin || supplier?.country || "UAE")}</td>
          </tr>
          <tr>
            <td>Delivery Order No. Date:</td>
            <td>${esc(String(deal.pl_no || "—").replace(/\s+/g, ""))}</td>
          </tr>
          <tr>
            <td>Port of Loading</td>
            <td>${esc(deal.loadingPort || "—")}</td>
          </tr>
          <tr>
            <td>Port of Discharge</td>
            <td>${esc(deal.dischargePort || "—")}</td>
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
      </div>
    </div>

    ${footer(company, date, false)}
  </body>
  </html>`;
}

function buildCOO(deal, buyer, supplier, company = {}) {
  const date = deal.shipment_out_date || deal.invoice_date || new Date().toISOString();

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>COO ${esc(deal.dealNo || "")}</title>
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

    <div class="box" style="margin-top:0;">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <table class="plainTable">
          <tr>
            <td style="width:160px;">Country of Origin</td>
            <td>${esc(deal.country_of_origin || supplier?.country || "UAE")}</td>
          </tr>
          <tr>
            <td>Invoice No. Date:</td>
            <td>${esc(String(deal.ci_no || deal.dealNo || "—").replace(/^CI\s*/i, "").replace(/\s+/g, ""))}</td>
          </tr>
          <tr>
            <td>Port of Loading</td>
            <td>${esc(deal.loadingPort || "—")}</td>
          </tr>
          <tr>
            <td>Port of Discharge</td>
            <td>${esc(deal.dischargePort || "—")}</td>
          </tr>
          <tr>
            <td>BL NO:</td>
            <td>${esc(deal.bl_no || "—")}</td>
          </tr>
          <tr>
            <td>Vessel / Voyage No</td>
            <td>${esc(deal.vessel_voyage || deal.vessel || "—")}</td>
          </tr>
        </table>

        <div style="margin-top:14px">
          <b>DECLARATION:</b> GOODS PACKED IN EXPORT SEAWORTHY ${esc(deal.loaded_on || "ISO TANKS")}
        </div>
      </div>
    </div>

    ${footer(company, date, false)}
  </body>
  </html>`;
}

export { openPrintWindow, buildPI, buildCI, buildPL, buildCOO };
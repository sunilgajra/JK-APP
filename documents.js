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

const LOGO_URL = assetUrl("logo.png");
const STAMP_URL = assetUrl("stamp.png");

function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
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
        ${rows.map(r => `<tr><td class="center">${esc(r[0])}</td><td class="center">${esc(r[1])}</td></tr>`).join("")}
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
        <div><b>Shippment Date</b> &nbsp;&nbsp; [ ${esc(fmtDate(deal.shipment_out_date || "") || "--------------")} ]</div>
        <div><b>Gross Weight</b> &nbsp;&nbsp; [${esc(deal.gross_weight || "")}${deal.gross_weight ? " KGS" : ""}]</div>
        <div><b>Net Weight</b> &nbsp;&nbsp;&nbsp;&nbsp; [${esc(deal.net_weight || "")}${deal.net_weight ? " KGS" : ""}]</div>
        <div><b>Total Packages</b> &nbsp; ${esc(deal.package_details || "20ft x 10 Containers")}</div>
        <div class="red center" style="margin-top:6px">( Loaded on ${esc(deal.loaded_on || "ISO TANK")} )</div>
      </div>
    </div>
  `;
}

function footer(company = {}, date = "") {
  return `
    <div class="footer">
      <div class="signLine">FOR ${esc(company.name || "")}</div>
      <div class="stamp"><img src="${STAMP_URL}" alt="stamp"></div>
      <div class="signLine">${esc(fmtDate(date) || "")}<br>Date</div>
    </div>
    <div class="note">This is computer generated Document, No signature required</div>
  </div>
  `;
}

function buildPI(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.created_at || new Date().toISOString();
  const total = Number(deal.totalAmount || 0);

  return `
  <!DOCTYPE html><html><head><title>PI ${esc(deal.dealNo || "")}</title>${commonStyle()}</head><body>
    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("PRO FORMA INVOICE", deal.pi_no || deal.dealNo || "", buyer?.customer_id || buyer?.cid || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${notifyBlock(buyer)}
      ${shippingBlock(deal)}
    </div>

    <table>
      <tr>
        <th style="width:45%">Description</th>
        <th style="width:9%">Unit</th>
        <th style="width:8%">Qty</th>
        <th style="width:10%">(AED)</th>
        <th style="width:5%">Tax</th>
        <th style="width:23%">Total Amount (AED)</th>
      </tr>
      <tr style="height:150px">
        <td>
          <b>${esc(deal.productName || "")}</b><br>
          HS CODE : ${esc(deal.hsn || "—")}<br><br><br><br><br>
          AED : ${esc(amountWords(total))} ONLY
        </td>
        <td class="center">${esc(deal.unit || "MTON")}</td>
        <td class="center">${esc(deal.quantity || "")}</td>
        <td class="right">${fmt(deal.rate || 0)}</td>
        <td class="center">-</td>
        <td class="right">${fmt(total)}</td>
      </tr>
    </table>

    <div class="smallGrid" style="margin-top:8px; align-items:start;">
      <div class="box">
        <div class="boxHead">Terms of Sale and Other Comments</div>
        <div class="boxBody tight">
          <div><b>Terms of Delivery / Payment :</b></div>
          <div>${esc(deal.terms_delivery || (deal.dischargePort ? `CFR ${deal.dischargePort}` : "CFR MUNDRA PORT,INDIA"))} / <span class="red">${esc(deal.payment_terms || "PART/FULL ADVANCE ON PI")}</span></div>
          <div style="margin-top:8px"><b>BANK TERMS:</b> ${esc(deal.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}</div>
          <div style="margin-top:8px"><b>Our Bank Details:-</b></div>
          <div>Account Name: ${esc(company.name || "")}</div>
          <div>Account Number (AED): ${esc(company.bankAccount || "")}</div>
          <div>IBAN: ${esc(company.bankIBAN || "")}</div>
          <div>SWIFT ID: ${esc(company.bankSWIFT || "")}</div>
          <div>Bank Name: ${esc(company.bankName || "")}</div>
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
        <tr><td>Currency</td><td class="right">${esc(deal.currency || "AED")}</td></tr>
      </table>
    </div>

    <div class="box">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <div>Country of Origin: ${esc(deal.country_of_origin || deal.origin || supplier?.country || "—")}</div>
        <div>Port of Loading: ${esc(deal.loadingPort || "—")}</div>
        <div>Port of Discharge: ${esc(deal.dischargePort || "—")}</div>
      </div>
    </div>

    ${footer(company, date)}
  </body></html>`;
}

function buildCI(deal, buyer, supplier, company = {}) {
  const date = deal.invoice_date || deal.shipment_out_date || new Date().toISOString();
  const total = Number(deal.totalAmount || 0);

  return `
  <!DOCTYPE html><html><head><title>CI ${esc(deal.dealNo || "")}</title>${commonStyle()}</head><body>
    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("COMMERCIAL INVOICE", deal.ci_no || deal.dealNo || "", buyer?.customer_id || buyer?.cid || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${notifyBlock(buyer)}
      ${shippingBlock(deal)}
    </div>

    <table>
      <tr>
        <th style="width:45%">Description</th>
        <th style="width:14%">Unit</th>
        <th style="width:8%">Qty</th>
        <th style="width:10%">Rate (AED)</th>
        <th style="width:6%">Tax</th>
        <th style="width:17%">Total Amount (AED)</th>
      </tr>
      <tr style="height:130px">
        <td>
          <b>${esc(deal.productName || "")}</b><br>
          HS CODE : ${esc(deal.hsn || "—")}<br><br>
          AED : ${esc(amountWords(total))} ONLY
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
          <div>${esc(deal.terms_delivery || `CFR ${deal.dischargePort || "MUNDRA PORT"}`)} / <span class="red">${esc(deal.payment_terms || "100% PAYMENT ON BL")}</span></div>
          <div style="margin-top:8px"><b>Our Bank Details:-</b></div>
          <div>Account Name: ${esc(company.name || "")}</div>
          <div>Account Number (AED): ${esc(company.bankAccount || "")}</div>
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
        <tr><td>Rounded off</td><td class="right">-</td></tr>
        <tr><td>Other (specify)</td><td class="right">-</td></tr>
        <tr><td><b>TOTAL</b></td><td class="right"><b>${fmt(total)}</b></td></tr>
        <tr><td>Currency</td><td class="right">${esc(deal.currency || "AED")}</td></tr>
      </table>
    </div>

    <div class="box">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <div>Country of Origin ${esc(deal.country_of_origin || deal.origin || supplier?.country || "—")}</div>
        <div>Packing list No. Date: ${esc(deal.pl_no || "—")}</div>
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
  const date = deal.shipment_out_date || new Date().toISOString();

  return `
  <!DOCTYPE html><html><head><title>PL ${esc(deal.dealNo || "")}</title>${commonStyle()}</head><body>
    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("PACKING LIST", deal.pl_no || deal.dealNo || "", buyer?.customer_id || buyer?.cid || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${containerBlock(deal)}
      ${shippingBlock(deal)}
    </div>

    <table>
      <tr>
        <th style="width:60%">Description</th>
        <th style="width:14%">Unit</th>
        <th style="width:26%">Qty</th>
      </tr>
      <tr style="height:120px">
        <td>
          <b>${esc(deal.productName || "")}</b><br>
          HS CODE : ${esc(deal.hsn || "—")}
        </td>
        <td class="center">${esc(deal.unit || "MTON")}</td>
        <td class="center">${esc(deal.quantity || "")}</td>
      </tr>
    </table>

    <div class="box">
      <div class="boxHead">Terms of Sale and Other Comments</div>
      <div class="boxBody tight">
        <div><b>Terms of Delivery</b></div>
        <div>${esc(deal.terms_delivery || `CFR ${deal.dischargePort || ""}`)}</div>
      </div>
    </div>

    <div class="box">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <div>Country of Origin &nbsp;&nbsp; ${esc(deal.country_of_origin || deal.origin || supplier?.country || "—")}</div>
        <div>Delivery Order No. Date: &nbsp;&nbsp; ${esc(deal.pl_no || "—")}</div>
        <div>Port of Loading &nbsp;&nbsp; ${esc(deal.loadingPort || "—")}</div>
        <div>Port of Discharge &nbsp;&nbsp; ${esc(deal.dischargePort || "—")}</div>
        <div>BL NO: &nbsp;&nbsp; ${esc(deal.bl_no || "—")}</div>
        <div>Vessel / Voyage No. &nbsp;&nbsp; ${esc(deal.vessel_voyage || deal.vessel || "—")}</div>
        <div>CFS: &nbsp;&nbsp; ${esc(deal.cfs || "-")}</div>
      </div>
    </div>

    ${footer(company, date)}
  </body></html>`;
}

function buildCOO(deal, buyer, supplier, company = {}) {
  const date = deal.shipment_out_date || new Date().toISOString();

  return `
  <!DOCTYPE html><html><head><title>COO ${esc(deal.dealNo || "")}</title>${commonStyle()}</head><body>
    <div class="top">
      ${shipperBlock(company)}
      ${logoBlock()}
      ${rightHeader("CERTIFICATE OF ORIGIN", deal.coo_no || deal.dealNo || "", buyer?.customer_id || buyer?.cid || "", date)}
    </div>

    <div class="triple">
      ${consigneeBlock(buyer)}
      ${containerBlock(deal)}
      ${shippingBlock(deal)}
    </div>

    <div class="box">
      <div class="boxBody center" style="font-weight:700; min-height:auto;">
        CERTIFY THAT THE GOODS SHIPPED ARE UNDER NON-NEGATIVE LIST OF IMPORT AND EXPORT POLICY 2015-2020.
      </div>
    </div>

    <div class="box">
      <div class="boxBody center" style="font-weight:700; min-height:auto;">
        DESCRIPTION OF GOODS : ${esc(deal.productName || "—")}
      </div>
    </div>

    <div class="box">
      <div class="boxBody center" style="font-weight:800; font-size:18px; min-height:auto;">
        QUANTITY (MTONS): ${esc(deal.quantity || "—")}
      </div>
    </div>

    <div class="box">
      <div class="boxHead">Additional Details</div>
      <div class="boxBody tight">
        <div>Country of Origin &nbsp;&nbsp; ${esc(deal.country_of_origin || deal.origin || supplier?.country || "—")}</div>
        <div>Invoice No. Date: &nbsp;&nbsp; ${esc(deal.ci_no || deal.dealNo || "—")}</div>
        <div>Port of Loading &nbsp;&nbsp; ${esc(deal.loadingPort || "—")}</div>
        <div>Port of Discharge &nbsp;&nbsp; ${esc(deal.dischargePort || "—")}</div>
        <div>BL NO: &nbsp;&nbsp; ${esc(deal.bl_no || "—")}</div>
        <div>Vessel / Voyage No &nbsp;&nbsp; ${esc(deal.vessel_voyage || deal.vessel || "—")}</div>
        <div style="margin-top:10px"><b>DECLARATION:</b> GOODS PACKED IN EXPORT SEAWORTHY ${esc(deal.loaded_on || "ISO TANKS")}</div>
      </div>
    </div>

    ${footer(company, date)}
  </body></html>`;
}

export { openPrintWindow, buildPI, buildCI, buildPL, buildCOO };
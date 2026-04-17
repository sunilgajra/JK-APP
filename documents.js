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

function pageStyle() {
  return `
    <style>
      @page{size:A4;margin:10mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:12px;line-height:1.4}
      .doc{padding:8px}
      .head{text-align:center;font-size:20px;font-weight:700;margin-bottom:4px}
      .sub{text-align:center;font-size:11px;color:#444;margin-bottom:18px}
      .doc-title{text-align:center;font-size:15px;font-weight:700;margin:14px 0 18px}
      .row{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}
      .box{border:1px solid #222;padding:10px;flex:1}
      .box-title{font-weight:700;margin-bottom:8px;text-transform:uppercase;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      th,td{border:1px solid #222;padding:8px;text-align:left;vertical-align:top}
      th{background:#f4f4f4}
      .mt{margin-top:16px}
      .bank{margin-top:16px;border:1px solid #222;padding:10px}
      .sign{margin-top:30px;text-align:right;font-weight:700}
      .muted{color:#555}
    </style>
  `;
}

function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
  return true;
}

function companyBlock(company = {}) {
  return `
    <div class="head">${esc(company.name || "Company")}</div>
    <div class="sub">${esc(company.address || "")}</div>
  `;
}

function bankBlock(company = {}) {
  return `
    <div class="bank">
      <div class="box-title">Company Bank Details</div>
      <div><b>Bank:</b> ${esc(company.bankName || "")}</div>
      <div><b>Account:</b> ${esc(company.bankAccount || "")}</div>
      <div><b>IBAN:</b> ${esc(company.bankIBAN || "")}</div>
      <div><b>SWIFT:</b> ${esc(company.bankSWIFT || "")}</div>
    </div>
  `;
}

function supplierBlock(supplier = {}) {
  return `
    <div class="bank">
      <div class="box-title">Supplier Details</div>
      <div><b>Name:</b> ${esc(supplier.name || "")}</div>
      <div><b>Company:</b> ${esc(supplier.companyName || "")}</div>
      <div><b>Email:</b> ${esc(supplier.email || "")}</div>
      <div><b>Address:</b> ${esc(supplier.address || "")}</div>
      <div><b>Bank:</b> ${esc(supplier.bankName || "")}</div>
      <div><b>Account:</b> ${esc(supplier.bankAccount || "")}</div>
      <div><b>IBAN:</b> ${esc(supplier.bankIBAN || "")}</div>
      <div><b>SWIFT:</b> ${esc(supplier.bankSWIFT || "")}</div>
    </div>
  `;
}

function buildPI(deal, buyer, supplier, company = {}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PI ${esc(deal.dealNo)}</title>
      ${pageStyle()}
    </head>
    <body>
      <div class="doc">
        ${companyBlock(company)}
        <div class="doc-title">PROFORMA INVOICE</div>

        <div class="row">
          <div class="box">
            <div class="box-title">Buyer</div>
            <div>${esc(buyer?.name || "—")}</div>
            <div class="muted">${esc(buyer?.address || "")}</div>
          </div>
          <div class="box">
            <div class="box-title">Deal Details</div>
            <div><b>Deal No:</b> ${esc(deal.dealNo)}</div>
            <div><b>Date:</b> ${fmtDate(new Date().toISOString())}</div>
            <div><b>Status:</b> ${esc(deal.status || "active")}</div>
            <div><b>Type:</b> ${esc(deal.type || "sell")}</div>
          </div>
        </div>

        <table>
          <tr>
            <th>Product</th>
            <th>Route</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Total</th>
          </tr>
          <tr>
            <td>${esc(deal.productName)}</td>
            <td>${esc(deal.loadingPort || "—")} → ${esc(deal.dischargePort || "—")}</td>
            <td>${esc(deal.quantity || 0)}</td>
            <td>${esc(deal.currency || "AED")} ${fmt(deal.rate)}</td>
            <td>${esc(deal.currency || "AED")} ${fmt(deal.totalAmount)}</td>
          </tr>
        </table>

        ${bankBlock(company)}
        ${supplierBlock(supplier)}

        <div class="sign">For ${esc(company.name || "Company")}</div>
      </div>
    </body>
    </html>
  `;
}

function buildCI(deal, buyer, supplier, company = {}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CI ${esc(deal.dealNo)}</title>
      ${pageStyle()}
    </head>
    <body>
      <div class="doc">
        ${companyBlock(company)}
        <div class="doc-title">COMMERCIAL INVOICE</div>

        <div class="row">
          <div class="box">
            <div class="box-title">Buyer</div>
            <div>${esc(buyer?.name || "—")}</div>
            <div class="muted">${esc(buyer?.address || "")}</div>
          </div>
          <div class="box">
            <div class="box-title">Supplier</div>
            <div>${esc(supplier?.name || "—")}</div>
            <div>${esc(supplier?.companyName || "")}</div>
            <div class="muted">${esc(supplier?.country || "")}</div>
            <div class="muted">${esc(supplier?.email || "")}</div>
          </div>
        </div>

        <table>
          <tr>
            <th>Deal No</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Currency</th>
            <th>Total</th>
          </tr>
          <tr>
            <td>${esc(deal.dealNo)}</td>
            <td>${esc(deal.productName)}</td>
            <td>${esc(deal.quantity || 0)}</td>
            <td>${esc(deal.currency || "AED")}</td>
            <td>${fmt(deal.totalAmount)}</td>
          </tr>
        </table>

        ${bankBlock(company)}
        ${supplierBlock(supplier)}

        <div class="sign">For ${esc(company.name || "Company")}</div>
      </div>
    </body>
    </html>
  `;
}

function buildPL(deal, buyer, supplier, company = {}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PL ${esc(deal.dealNo)}</title>
      ${pageStyle()}
    </head>
    <body>
      <div class="doc">
        ${companyBlock(company)}
        <div class="doc-title">PACKING LIST</div>

        <table>
          <tr><th>Deal No</th><td>${esc(deal.dealNo)}</td></tr>
          <tr><th>Product</th><td>${esc(deal.productName)}</td></tr>
          <tr><th>Quantity</th><td>${esc(deal.quantity || 0)}</td></tr>
          <tr><th>Loading Port</th><td>${esc(deal.loadingPort || "—")}</td></tr>
          <tr><th>Discharge Port</th><td>${esc(deal.dischargePort || "—")}</td></tr>
          <tr><th>Status</th><td>${esc(deal.status || "active")}</td></tr>
          <tr><th>Buyer</th><td>${esc(buyer?.name || "—")}</td></tr>
          <tr><th>Supplier</th><td>${esc(supplier?.name || "—")} / ${esc(supplier?.companyName || "")}</td></tr>
        </table>

        ${supplierBlock(supplier)}

        <div class="sign">For ${esc(company.name || "Company")}</div>
      </div>
    </body>
    </html>
  `;
}

function buildCOO(deal, buyer, supplier, company = {}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>COO ${esc(deal.dealNo)}</title>
      ${pageStyle()}
    </head>
    <body>
      <div class="doc">
        ${companyBlock(company)}
        <div class="doc-title">CERTIFICATE OF ORIGIN</div>

        <div class="box">
          <div><b>Deal No:</b> ${esc(deal.dealNo)}</div>
          <div><b>Buyer:</b> ${esc(buyer?.name || "—")}</div>
          <div><b>Supplier:</b> ${esc(supplier?.name || "—")} ${supplier?.companyName ? `(${esc(supplier.companyName)})` : ""}</div>
          <div><b>Product:</b> ${esc(deal.productName || "—")}</div>
          <div><b>Route:</b> ${esc(deal.loadingPort || "—")} → ${esc(deal.dischargePort || "—")}</div>
          <div class="mt">This is to certify that the goods described above are supplied/exported as stated.</div>
        </div>

        ${supplierBlock(supplier)}

        <div class="sign">For ${esc(company.name || "Company")}</div>
      </div>
    </body>
    </html>
  `;
}

export { openPrintWindow, buildPI, buildCI, buildPL, buildCOO };
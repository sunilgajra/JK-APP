import { state } from "./state.js";
import { esc } from "./utils.js";

export function suppliersView() {
  const q = state.supplierSearch.trim().toLowerCase();
  const filteredSuppliers = state.suppliers.filter((s) => {
    if (!q) return true;
    const text = [
      s.name,
      s.company_name,
      s.country,
      s.email,
      s.address,
      s.bank_name,
      s.bank_account,
      s.bank_iban,
      s.bank_swift
    ].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 mb-12 flex-wrap">
        <div class="title mb-0">Suppliers</div>
        <button id="show-supplier-form" class="btn-primary">Add Supplier</button>
      </div>

      <div class="mb-12">
        <input id="supplier-search" value="${esc(state.supplierSearch || "")}" placeholder="Search suppliers by name, company, email, country..." />
      </div>

      <div id="supplier-form-wrap"></div>

      <div class="list mt-12">
        ${
          filteredSuppliers.length
            ? filteredSuppliers.map((s) => `
          <div class="item">
            <div class="item-title">${esc(s.name || "—")}</div>
            <div class="item-sub">Company: ${esc(s.company_name || "—")}</div>
            <div class="item-sub">Country: ${esc(s.country || "—")}</div>
            <div class="item-sub">Email: ${esc(s.email || "—")}</div>
            <div class="item-sub">Address: ${esc(s.address || "—")}</div>
            <div class="item-sub">Bank: ${esc(s.bank_name || "—")} · A/C: ${esc(s.bank_account || "—")}</div>
            <div class="item-sub">IBAN: ${esc(s.bank_iban || "—")} · SWIFT: ${esc(s.bank_swift || "—")}</div>

            <div class="mt-8 flex gap-8">
              <button data-edit-supplier="${s.id}">Edit</button>
              <button data-delete-supplier="${s.id}">Delete</button>
              <button data-show-supplier-docs="${s.id}">Documents</button>
              <button data-show-supplier-master-deals="${s.id}" class="btn-info">Master Settlement</button>
            </div>
            <div id="supplier-master-deals-wrap-${s.id}" class="mt-10" style="display:none; background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid rgba(59,157,162,0.3)">
              <div class="item-title mb-8" style="font-size:14px; color:var(--accent-primary)">Select Deals for Master Settlement</div>
              <div class="table-responsive" style="max-height:200px; overflow-y:auto; border: 1px solid var(--border); border-radius: 6px; background: rgba(0,0,0,0.2);">
                <table class="report-table" style="margin-top:0; width:100%; font-size: 12px;">
                  <thead style="position: sticky; top: 0; z-index: 10; background: rgba(15, 23, 42, 0.95);">
                    <tr>
                      <th style="width: 40px; text-align: center; padding: 8px;">
                        <input type="checkbox" checked onclick="document.querySelectorAll('input[name=\\'master_deal_ids_${s.id}\\']').forEach(cb => cb.checked = this.checked)">
                      </th>
                      <th style="padding: 8px;">Deal No</th>
                      <th style="padding: 8px;">Product</th>
                      <th style="padding: 8px;">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.deals.filter(d => String(d.supplier_id) === String(s.id)).map(d => `
                      <tr>
                        <td style="text-align: center; padding: 8px;">
                          <input type="checkbox" name="master_deal_ids_${s.id}" value="${d.id}" checked>
                        </td>
                        <td class="font-bold" style="padding: 8px; color: var(--text);">${esc(d.deal_no)}</td>
                        <td style="padding: 8px;">${esc(d.product_name)}</td>
                        <td class="opacity-60" style="padding: 8px;">${new Date(d.invoice_date || d.created_at).toLocaleDateString()}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
                ${state.deals.filter(d => String(d.supplier_id) === String(s.id)).length === 0 ? '<div style="padding:10px; text-align:center; opacity:0.5; font-size:12px;">No deals found.</div>' : ''}
              </div>
              <div class="mt-8 flex gap-8">
                <button data-print-supplier-master-selected="${s.id}" class="btn-primary btn-xs">Generate Settlement</button>
                <button onclick="document.getElementById('supplier-master-deals-wrap-${s.id}').style.display='none'" class="btn-xs">Cancel</button>
              </div>
            </div>
            <div id="supplier-edit-wrap-${s.id}" class="mt-10"></div>
            <div id="supplier-docs-wrap-${s.id}" class="mt-10" style="display:none; background:rgba(255,255,255,0.02); padding:10px; border-radius:8px">
              <div class="item-title mb-8">Supplier Documents</div>
              <form data-supplier-doc-upload="${s.id}" class="grid gap-10">
                <input type="text" name="docType" placeholder="Document Type (e.g. Master PI, Agreement)" required>
                <input type="file" name="file" required>
                <button type="submit" class="btn-primary btn-xs">Upload</button>
              </form>
              <div class="list mt-10">
                ${(state.documentsBySupplier[s.id] || []).length 
                  ? state.documentsBySupplier[s.id].map(doc => `
                    <div class="item" style="padding:6px; background:rgba(0,0,0,0.2)">
                      <div class="flex flex-between flex-center">
                        <div>
                          <div class="text-xs font-bold">${esc(doc.doc_type || "Document")}</div>
                          <div class="text-xs opacity-60">${esc(doc.file_name)}</div>
                        </div>
                        <div class="flex gap-8">
                          <a href="${doc.file_url}" target="_blank" class="text-xs">View</a>
                          <button data-delete-supplier-doc="${s.id}:${doc.id}" class="text-xs text-danger">Delete</button>
                        </div>
                      </div>
                    </div>
                  `).join("")
                  : `<div class="text-xs opacity-50">No documents uploaded.</div>`
                }
              </div>
            </div>
          </div>
        `).join("")
            : `<div class="empty">No matching suppliers found.</div>`
        }
      </div>
    </div>
  `;
}

export function supplierFormHtml(s = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `supplier-edit-form-${id}` : "supplier-form"}" class="item mb-12">
      <div class="form-header">${edit ? "Edit Supplier" : "New Supplier"}</div>
      <div class="grid gap-10">

        <div>
          <label class="form-label">Supplier Name</label>
          <input name="name" value="${esc(s.name || "")}" placeholder="Supplier name" required>
        </div>

        <div>
          <label class="form-label">Company Name</label>
          <input name="company_name" value="${esc(s.company_name || "")}" placeholder="Company name">
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Country</label>
            <input name="country" value="${esc(s.country || "")}" placeholder="Country" required>
          </div>
          <div>
            <label class="form-label">Email</label>
            <input name="email" value="${esc(s.email || "")}" placeholder="Email">
          </div>
        </div>

        <div>
          <label class="form-label">Address</label>
          <textarea name="address" placeholder="Address" class="min-h-80">${esc(s.address || "")}</textarea>
        </div>

        <div>
          <label class="form-label">Bank Name</label>
          <input name="bank_name" value="${esc(s.bank_name || "")}" placeholder="Bank name">
        </div>

        <div>
          <label class="form-label">Bank Account</label>
          <input name="bank_account" value="${esc(s.bank_account || "")}" placeholder="Bank account">
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">IBAN</label>
            <input name="bank_iban" value="${esc(s.bank_iban || "")}" placeholder="IBAN">
          </div>
          <div>
            <label class="form-label">SWIFT</label>
            <input name="bank_swift" value="${esc(s.bank_swift || "")}" placeholder="SWIFT">
          </div>
        </div>

        <div class="flex gap-10">
          <button type="submit" class="btn-primary">${edit ? "Update Supplier" : "Save Supplier"}</button>
          <button type="button" id="${edit ? `cancel-supplier-edit-${id}` : "cancel-supplier-form"}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}

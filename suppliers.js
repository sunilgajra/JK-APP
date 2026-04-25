import { state } from "./state.js";
import { esc } from "./utils.js";

export function suppliersView() {
  const q = state.supplierSearch.trim().toLowerCase();
  const filteredSuppliers = state.suppliers.filter((s) => {
    if (!q) return true;
    const text = [s.name, s.company_name, s.email, s.address, s.bank_name].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-24">
        <h1 style="font-size: 24px; font-weight: 800;">Suppliers & Vendors</h1>
        <button id="show-supplier-form" class="btn btn-primary">+ Add New Supplier</button>
      </div>

      <div class="search-container">
        <span style="position: absolute; left: 16px; top: 14px; opacity: 0.5;">🔍</span>
        <input id="supplier-search" class="search-input" value="${esc(state.supplierSearch || "")}" placeholder="Search suppliers by name, bank, or email..." />
      </div>

      <div id="supplier-form-wrap"></div>

      <div class="grid grid-2">
        ${filteredSuppliers.length ? filteredSuppliers.map((s) => `
          <div class="card item">
            <div class="flex justify-between items-start">
              <div style="flex: 1; min-width: 0;">
                <div class="item-title" style="font-size: 16px; color: var(--primary);">${esc(s.name || "—")}</div>
                <div class="item-sub" style="font-weight: 600; color: var(--text-main);">${esc(s.company_name || "—")}</div>
                <div class="item-sub" style="font-size: 13px; margin-top: 4px;">${esc(s.address || "—")}</div>
                
                <div class="grid grid-2 mt-12 gap-8">
                  <div class="col-span-2" style="grid-column: span 2; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    <span class="stat-label" style="font-size: 9px;">Bank Details</span>
                    <div class="item-sub" style="color: var(--text-main); font-weight: 700;">${esc(s.bank_name || "—")}</div>
                    <div class="item-sub" style="font-size: 11px;">A/C: ${esc(s.bank_account || "—")}</div>
                    <div class="item-sub" style="font-size: 11px;">IBAN: ${esc(s.bank_iban || "—")} · SWIFT: ${esc(s.bank_swift || "—")}</div>
                  </div>
                  <div>
                    <span class="stat-label" style="font-size: 9px;">Contact</span>
                    <div class="item-sub" style="color: var(--text-main)">${esc(s.email || "—")}</div>
                  </div>
                  <div>
                    <span class="stat-label" style="font-size: 9px;">Country</span>
                    <div class="item-sub" style="color: var(--text-main)">${esc(s.country || "—")}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="mt-16 flex gap-8 pt-16" style="border-top: 1px solid var(--border);">
              <button data-edit-supplier="${s.id}" class="btn btn-outline btn-small w-full">Edit Details</button>
              <button data-delete-supplier="${s.id}" class="btn btn-logout btn-small">Delete</button>
            </div>
            <div id="supplier-edit-wrap-${s.id}" class="mt-10"></div>
          </div>
        `).join("") : `<div class="empty card">No matching suppliers found.</div>`}
      </div>
    </div>
  `;
}

export function supplierFormHtml(s = {}, edit = false, id = "") {
  return `
    <div class="card mb-24 fade-in" style="border: 1px solid var(--primary);">
      <h3 class="section-title">${edit ? "Edit Supplier Profile" : "Create New Supplier"}</h3>
      <form id="${edit ? `supplier-edit-form-${id}` : "supplier-form"}" class="grid gap-16">
        
        <div class="grid grid-2 gap-16">
          <div class="form-group mb-0">
            <label>Contact Person</label>
            <input name="name" value="${esc(s.name || "")}" placeholder="Full name" required>
          </div>
          <div class="form-group mb-0">
            <label>Company Name</label>
            <input name="company_name" value="${esc(s.company_name || "")}" placeholder="Legal entity name" required>
          </div>
        </div>

        <div class="grid grid-2 gap-16">
          <div class="form-group mb-0">
            <label>Email Address</label>
            <input name="email" type="email" value="${esc(s.email || "")}" placeholder="sales@supplier.com">
          </div>
          <div class="form-group mb-0">
            <label>Country</label>
            <input name="country" value="${esc(s.country || "")}" placeholder="Country of origin">
          </div>
        </div>

        <div class="form-group mb-0">
          <label>Office Address</label>
          <textarea name="address" placeholder="Full address" class="min-h-80">${esc(s.address || "")}</textarea>
        </div>

        <div class="card" style="background: rgba(0,0,0,0.1);">
          <h4 class="item-title mb-12">🏦 Banking Information</h4>
          <div class="grid grid-2 gap-16">
            <div class="form-group mb-0">
              <label>Bank Name</label>
              <input name="bank_name" value="${esc(s.bank_name || "")}" placeholder="Beneficiary Bank">
            </div>
            <div class="form-group mb-0">
              <label>Account Number</label>
              <input name="bank_account" value="${esc(s.bank_account || "")}" placeholder="A/C No">
            </div>
            <div class="form-group mb-0">
              <label>IBAN Number</label>
              <input name="bank_iban" value="${esc(s.bank_iban || "")}" placeholder="International Bank A/C No">
            </div>
            <div class="form-group mb-0">
              <label>SWIFT / BIC</label>
              <input name="bank_swift" value="${esc(s.bank_swift || "")}" placeholder="Swift Code">
            </div>
          </div>
        </div>

        <div class="flex gap-12 mt-8">
          <button type="submit" class="btn btn-primary">${edit ? "Update Profile" : "Save Supplier"}</button>
          <button type="button" class="btn btn-outline" id="${edit ? `cancel-supplier-edit-${id}` : "cancel-supplier-form"}">Discard</button>
        </div>
      </form>
    </div>
  `;
}

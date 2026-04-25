import { state } from "./state.js";
import { esc } from "./utils.js";

export function suppliersView() {
  const q = (state.supplierSearch || "").toLowerCase();
  const filtered = state.suppliers.filter(s => {
    const text = `${s.name} ${s.company_name} ${s.bank_name}`.toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="grid">
      <div class="flex-between flex-center">
        <h2 class="title">SUPPLIERS & VENDORS</h2>
        <button id="show-supplier-form" class="btn-primary">+ NEW SUPPLIER</button>
      </div>

      <div id="supplier-form-wrap"></div>

      <input id="supplier-search" value="${esc(state.supplierSearch || "")}" placeholder="Search suppliers...">

      <div class="list">
        ${filtered.map(s => `
          <div class="item">
            <div class="flex-between">
              <div>
                <div class="item-title">${esc(s.name)} (${esc(s.company_name || "N/A")})</div>
                <div class="item-sub">${esc(s.bank_name || "No bank listed")} / ${esc(s.country || "No country")}</div>
              </div>
              <div class="flex gap-10">
                <button data-edit-supplier="${s.id}" class="btn-outline btn-small">EDIT</button>
                <button data-delete-supplier="${s.id}" class="btn-danger btn-small">DELETE</button>
              </div>
            </div>
            <div id="supplier-edit-wrap-${s.id}"></div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function supplierFormHtml(s = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `supplier-edit-form-${id}` : "supplier-form"}" class="item mb-12">
      <div class="form-header">${edit ? "EDIT SUPPLIER" : "NEW SUPPLIER"}</div>
      <div class="grid gap-12">
        <div class="grid grid-2 gap-10">
          <input name="name" value="${esc(s.name || "")}" placeholder="Contact Name" required>
          <input name="company_name" value="${esc(s.company_name || "")}" placeholder="Company Name" required>
        </div>
        <textarea name="address" placeholder="Address">${esc(s.address || "")}</textarea>
        <div class="grid grid-2 gap-10">
          <input name="email" type="email" value="${esc(s.email || "")}" placeholder="Email">
          <input name="country" value="${esc(s.country || "")}" placeholder="Country">
        </div>
        <div class="grid grid-2 gap-10">
          <input name="bank_name" value="${esc(s.bank_name || "")}" placeholder="Bank Name">
          <input name="bank_account" value="${esc(s.bank_account || "")}" placeholder="A/C No">
        </div>
        <div class="grid grid-2 gap-10">
          <input name="bank_iban" value="${esc(s.bank_iban || "")}" placeholder="IBAN">
          <input name="bank_swift" value="${esc(s.bank_swift || "")}" placeholder="SWIFT">
        </div>
        <div class="flex gap-10">
          <button type="submit" class="btn-primary">${edit ? "UPDATE" : "SAVE"}</button>
          <button type="button" id="${edit ? `cancel-supplier-edit-${id}` : "cancel-supplier-form"}">CANCEL</button>
        </div>
      </div>
    </form>
  `;
}

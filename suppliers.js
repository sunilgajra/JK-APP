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
            </div>
            <div id="supplier-edit-wrap-${s.id}" class="mt-10"></div>
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

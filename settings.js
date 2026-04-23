import { state } from "./state.js";
import { esc } from "./utils.js";

export function settingsView() {
  const c = state.company;

  return `
    <div class="card">
      <div class="title">Company Settings</div>

      <form id="company-settings-form" class="item mt-12">
        <div class="grid gap-10">
          <div>
            <label class="form-label">Company Name</label>
            <input name="name" value="${esc(c.name || "")}" placeholder="Company name">
          </div>

          <div>
            <label class="form-label">Address</label>
            <textarea name="address" placeholder="Address" class="min-h-90">${esc(c.address || "")}</textarea>
          </div>

          <div>
            <div class="form-header">Bank Accounts</div>

            <div id="bank-list" class="grid gap-10">
              ${(c.bankAccounts || []).map((b, i) => `
                <div class="item mb-0">
                  <div class="grid grid-2 gap-10">
                    <div>
                      <label class="form-label">Bank Name</label>
                      <input value="${esc(b.bankName || "")}" data-bank-field="bankName" data-bank-index="${i}" placeholder="Bank name">
                    </div>
                    <div>
                      <label class="form-label">Account Number</label>
                      <input value="${esc(b.account || "")}" data-bank-field="account" data-bank-index="${i}" placeholder="Account number">
                    </div>
                    <div>
                      <label class="form-label">IBAN</label>
                      <input value="${esc(b.iban || "")}" data-bank-field="iban" data-bank-index="${i}" placeholder="IBAN">
                    </div>
                    <div>
                      <label class="form-label">SWIFT</label>
                      <input value="${esc(b.swift || "")}" data-bank-field="swift" data-bank-index="${i}" placeholder="SWIFT">
                    </div>
                  </div>

                  <button type="button" data-delete-bank="${i}" class="mt-10">Delete</button>
                </div>
              `).join("")}
            </div>

            <button type="button" id="add-bank-btn" class="mt-10">+ Add Bank</button>
          </div>

          <div>
            <div class="form-header">Saved Shippers</div>

            <div id="shipper-list" class="grid gap-10">
              ${(c.shippers || []).map((s, i) => `
                <div class="item mb-0">
                  <div class="grid grid-2 gap-10">
                    <div>
                      <label class="form-label">Shipper Name</label>
                      <input value="${esc(s.name || "")}" data-shipper-field="name" data-shipper-index="${i}" placeholder="Shipper name">
                    </div>
                    <div>
                      <label class="form-label">Mobile</label>
                      <input value="${esc(s.mobile || "")}" data-shipper-field="mobile" data-shipper-index="${i}" placeholder="Mobile">
                    </div>
                    <div style="grid-column:1 / -1">
                      <label class="form-label">Address</label>
                      <textarea data-shipper-field="address" data-shipper-index="${i}" placeholder="Address" class="min-h-80">${esc(s.address || "")}</textarea>
                    </div>
                    <div style="grid-column:1 / -1">
                      <label class="form-label">Email</label>
                      <input value="${esc(s.email || "")}" data-shipper-field="email" data-shipper-index="${i}" placeholder="Email">
                    </div>
                  </div>

                  <button type="button" data-delete-shipper="${i}" class="mt-10">Delete</button>
                </div>
              `).join("")}
            </div>

            <button type="button" id="add-shipper-btn" class="mt-10">+ Add Shipper</button>
          </div>

          <button type="submit" class="btn-primary">Save Settings</button>
        </div>
      </form>
    </div>
  `;
}

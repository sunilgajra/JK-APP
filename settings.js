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

          <div>
            <div class="form-header">AI Settings</div>
            <div class="grid gap-10">
              <div>
                <label class="form-label">Google Gemini API Key (for Smart Scan)</label>
                <input name="gemini_api_key" type="password" value="${esc(c.gemini_api_key || "")}" placeholder="Paste your API key here">
              </div>
              <div>
                <label class="form-label">Gemini Model</label>
                <select name="gemini_model">
                  <option value="gemini-2.5-flash" ${c.gemini_model === "gemini-2.5-flash" ? "selected" : ""}>Gemini 2.5 Flash (Stable)</option>
                  <option value="gemini-3.1-flash-lite-preview" ${c.gemini_model === "gemini-3.1-flash-lite-preview" ? "selected" : ""}>Gemini 3.1 Flash-Lite</option>
                  <option value="gemini-3-pro" ${c.gemini_model === "gemini-3-pro" ? "selected" : ""}>Gemini 3 Pro</option>
                </select>
              </div>
            </div>
            <div class="item-sub mt-4">Required for scanning documents automatically.</div>
            <button type="button" id="check-ai-btn" class="mt-8" style="background:#4f46e5; color:white">Check AI Connection</button>
          </div>

          <div class="mt-20">
            <div class="form-header">My Documents (Licenses, Agreements, etc.)</div>
            <div class="item" style="background:rgba(255,255,255,0.02); padding:15px; border-radius:8px">
              <form data-company-doc-upload="1" class="grid gap-10">
                <div class="grid grid-2 gap-10">
                  <input type="text" name="docType" placeholder="Document Type (e.g. Trade Licence, Lease)" required>
                  <input type="date" name="expiryDate" title="Expiry Date">
                </div>
                <input type="file" name="file" required>
                <button type="submit" class="btn-primary btn-xs">Upload</button>
              </form>
              
              <div class="list mt-15" style="max-height:400px; overflow:auto">
                ${state.documentsByCompany.length 
                  ? state.documentsByCompany.map(doc => `
                    <div class="item" style="padding:10px; background:rgba(0,0,0,0.2)">
                      <div class="flex flex-between flex-center">
                        <div>
                          <div class="font-bold" style="font-size:14px">${esc(doc.doc_type || "Document")} ${doc.expiry_date ? `<span class="text-danger" style="margin-left:5px">(Exp: ${doc.expiry_date})</span>` : ""}</div>
                          <div class="text-xs opacity-60">${esc(doc.file_name)}</div>
                        </div>
                        <div class="flex gap-10">
                          <button data-ai-expiry-scan="${doc.id}" class="btn-xs" title="Scan Expiry Date" style="color:var(--accent-primary)">AI</button>
                          <a href="${doc.file_url}" target="_blank" class="btn-xs">View</a>
                          <button data-share-whatsapp-doc="${doc.id}" class="btn-xs" style="color:#25D366">WhatsApp</button>
                          <button data-delete-company-doc="${doc.id}" class="btn-xs text-danger">Delete</button>
                        </div>
                      </div>
                    </div>
                  `).join("")
                  : `<div class="empty" style="padding:20px; font-size:12px">No company documents uploaded.</div>`
                }
              </div>
            </div>
          </div>

          <button type="submit" class="btn-primary mt-20">Save Settings</button>
        </div>
      </form>
    </div>
  `;
}

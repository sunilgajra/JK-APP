import { state } from "./state.js";
import { esc } from "./utils.js";

export function settingsView() {
  const c = state.company;
  return `
    <div class="grid">
      <h2 class="title">COMPANY SETTINGS</h2>
      
      <div class="card">
        <form id="company-settings-form" class="grid gap-12">
          <input name="name" value="${esc(c.name)}" placeholder="Company Name" required>
          <textarea name="address" placeholder="Address">${esc(c.address)}</textarea>
          <input name="mobile" value="${esc(c.mobile)}" placeholder="Mobile">
          <input name="email" value="${esc(c.email)}" placeholder="Email">
          
          <div class="title mt-10">AI INTEGRATION</div>
          <input name="gemini_api_key" value="${esc(c.gemini_api_key)}" placeholder="Gemini API Key" type="password">
          <button id="check-ai-btn" type="button" class="btn-outline btn-small">CHECK CONNECTION</button>

          <button type="submit" class="btn-primary mt-12">SAVE SETTINGS</button>
        </form>
      </div>

      <div class="card">
        <div class="flex-between mb-12">
          <div class="title">BANK ACCOUNTS</div>
          <button id="add-bank-btn" class="btn-primary btn-small">+ ADD</button>
        </div>
        <div class="list">
          ${c.bankAccounts.map((b, i) => `
            <div class="item">
              <div class="flex-between">
                <div class="item-title">${esc(b.name)}</div>
                <button data-delete-bank="${i}" class="btn-danger btn-small">X</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

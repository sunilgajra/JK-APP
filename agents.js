import { state } from "./state.js";
import { esc } from "./utils.js";

export function agentsView() {
  const q = state.agentSearch.trim().toLowerCase();
  const filteredAgents = state.agents.filter((a) => {
    if (!q) return true;
    const text = [a.name, a.phone, a.country, a.bank_details].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 mb-12 flex-wrap">
        <div class="title mb-0">Commission Agents</div>
        <button id="show-agent-form" class="btn-primary">Add Agent</button>
      </div>

      <div class="mb-12">
        <input id="agent-search" value="${esc(state.agentSearch || "")}" placeholder="Search agents by name, country, phone..." />
      </div>

      <div id="agent-form-wrap"></div>

      <div class="list mt-12">
        ${
          filteredAgents.length
            ? filteredAgents.map((a) => `
          <div class="item">
            <div class="item-title">${esc(a.name || "—")}</div>
            <div class="item-sub">Country: ${esc(a.country || "—")} · Phone: ${esc(a.phone || "—")}</div>
            <div class="item-sub" style="white-space: pre-wrap; font-size: 12px; opacity: 0.8;">Bank Details:\n${esc(a.bank_details || "—")}</div>
            <div class="mt-12 flex gap-8">
              <button data-edit-agent="${a.id}">Edit</button>
              <button data-delete-agent="${a.id}">Delete</button>
              <button data-agent-statement="${a.id}" class="btn-info">Account Statement</button>
            </div>
            <div id="agent-edit-wrap-${a.id}" class="mt-10"></div>
          </div>
        `).join("")
            : `<div class="empty">No matching agents found.</div>`
        }
      </div>
    </div>
  `;
}

export function agentFormHtml(a = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `agent-edit-form-${id}` : "agent-form"}" class="item mb-12">
      <div class="form-header">${edit ? "Edit Agent" : "New Agent"}</div>
      <div class="grid gap-10">
        <div>
          <label class="form-label">Agent Name</label>
          <input name="name" value="${esc(a.name || "")}" placeholder="Agent name" required>
        </div>
        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Country</label>
            <input name="country" value="${esc(a.country || "")}" placeholder="Country">
          </div>
          <div>
            <label class="form-label">Phone No</label>
            <input name="phone" value="${esc(a.phone || "")}" placeholder="Phone No">
          </div>
        </div>
        <div>
          <label class="form-label">Bank Details</label>
          <textarea name="bank_details" placeholder="Bank Name, Account, IBAN, SWIFT..." style="min-height:100px">${esc(a.bank_details || "")}</textarea>
        </div>
        <div class="flex gap-10 mt-8">
          <button type="submit" class="btn-primary">${edit ? "Update Agent" : "Save Agent"}</button>
          <button type="button" id="${edit ? `cancel-agent-edit-${id}` : "cancel-agent-form"}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}

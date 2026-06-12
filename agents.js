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
            <div class="mt-12 flex gap-8 flex-wrap">
              <button data-edit-agent="${a.id}">Edit</button>
              <button data-delete-agent="${a.id}">Delete</button>
              <button data-show-agent-payments="${a.id}" class="btn-outline">Payments</button>
              <button data-show-agent-statement-deals="${a.id}" class="btn-info">Account Statement</button>
            </div>
            
            <div id="agent-statement-deals-wrap-${a.id}" class="mt-12" style="display:none; background:rgba(255,255,255,0.01); border:1px solid var(--border); border-radius:8px; padding:12px">
               <div class="item-title mb-8" style="font-size:14px">Select Deals for Statement</div>
               <div class="table-responsive" style="max-height:250px; overflow:auto">
                 <table class="report-table" style="font-size:11px">
                   <thead>
                     <tr>
                       <th width="30"><input type="checkbox" data-select-all-agent-deals="${a.id}" checked></th>
                       <th>Deal No</th>
                       <th>Buyer</th>
                       <th>Product</th>
                       <th class="right">Commission</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${state.deals.filter(d => d.commission_name && d.commission_name.toLowerCase().includes(a.name.toLowerCase())).map(d => `
                       <tr>
                         <td><input type="checkbox" name="agent_deal_ids_${a.id}" value="${d.id}" checked></td>
                         <td style="font-weight:700">${esc(d.deal_no)}</td>
                         <td>${esc((state.buyers.find(b => String(b.id) === String(d.buyer_id)) || {}).name || "—")}</td>
                         <td>${esc(d.product_name)}</td>
                         <td class="right">${esc(d.commission_currency)} ${Number(d.commission_total).toLocaleString()}</td>
                       </tr>
                     `).join("")}
                   </tbody>
                 </table>
               </div>
               <div class="mt-10 flex flex-between flex-center flex-wrap gap-8">
                  <div class="opacity-50" style="font-size:10px">Note: All recorded payments will be included.</div>
                  <button data-print-agent-statement-selected="${a.id}" class="btn-info btn-xs">Generate Statement</button>
               </div>
            </div>
            
            <div id="agent-payments-wrap-${a.id}" class="mt-12" style="display:none; background:rgba(255,255,255,0.01); border:1px solid var(--border); border-radius:8px; padding:12px">
               <div class="flex flex-between flex-center mb-8">
                 <div class="item-title" style="font-size:14px">Payments history</div>
                 <button data-add-agent-payment="${a.id}" class="btn-primary btn-xs">+ Add Payment</button>
               </div>
               <div id="agent-payment-form-inner-${a.id}"></div>
               <div class="table-responsive mt-8" style="max-height:250px; overflow:auto">
                 <table class="report-table" style="font-size:11px">
                   <thead>
                     <tr>
                       <th>Date</th>
                       <th>Type</th>
                       <th>Amt</th>
                       <th>Mode</th>
                       <th>Ref</th>
                       <th></th>
                     </tr>
                   </thead>
                   <tbody>
                     ${(state.agentPaymentsByAgent[a.id] || []).map(p => `
                       <tr>
                         <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                         <td style="color:${p.type === "out" ? "var(--danger)" : "var(--success)"}">${p.type.toUpperCase()}</td>
                         <td>${p.currency} ${Number(p.amount).toLocaleString()}</td>
                         <td>${p.mode}</td>
                         <td>${esc(p.ref || "—")}</td>
                         <td class="right">
                           <button data-edit-agent-payment="${a.id}:${p.id}" class="btn-xs">Edit</button>
                           <button data-delete-agent-payment="${p.id}" class="btn-xs" style="color:var(--danger)">×</button>
                         </td>
                       </tr>
                     `).join("")}
                     ${!(state.agentPaymentsByAgent[a.id] || []).length ? "<tr><td colspan='6' class='center opacity-50'>No payments yet</td></tr>" : ""}
                   </tbody>
                 </table>
               </div>
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

export function agentPaymentFormHtml(agentId, p = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `agent-payment-edit-form-${id}` : "agent-payment-form"}" class="mt-10 p-10" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px">
      <div class="item-title mb-8" style="font-size:14px; color:var(--accent-primary)">${edit ? "Edit Payment" : "New Payment"}</div>
      <input type="hidden" name="agent_id" value="${agentId}">
      <div class="grid grid-3 gap-8">
        <div>
          <label class="form-label">Amount</label>
          <input name="amount" type="number" step="0.01" value="${esc(p.amount || "")}" required>
        </div>
        <div>
          <label class="form-label">Currency</label>
          <select name="currency">
            <option value="USD" ${p.currency === "USD" ? "selected" : ""}>USD</option>
            <option value="AED" ${(p.currency || "AED") === "AED" ? "selected" : ""}>AED</option>
          </select>
        </div>
        <div>
          <label class="form-label">Date</label>
          <input name="payment_date" type="date" value="${p.payment_date || new Date().toISOString().split("T")[0]}" required>
        </div>
      </div>
      <div class="grid grid-2 gap-8 mt-8">
        <div>
          <label class="form-label">Transaction Type</label>
          <select name="type">
            <option value="out" ${(p.type || "out") === "out" ? "selected" : ""}>OUT (We Pay Agent)</option>
            <option value="in" ${p.type === "in" ? "selected" : ""}>IN (Refund/Other)</option>
          </select>
        </div>
        <div>
          <label class="form-label">Mode</label>
          <select name="mode">
            <option value="BANK" ${p.mode === "BANK" ? "selected" : ""}>BANK</option>
            <option value="TOKEN" ${p.mode === "TOKEN" ? "selected" : ""}>TOKEN</option>
            <option value="CASH" ${p.mode === "CASH" ? "selected" : ""}>CASH</option>
            <option value="OTHERS" ${p.mode === "OTHERS" ? "selected" : ""}>OTHERS</option>
          </select>
        </div>
      </div>
      <div class="mt-8">
        <label class="form-label">Reference / Note</label>
        <input name="ref" value="${esc(p.ref || "")}" placeholder="Cheque No, Transfer Ref, etc.">
      </div>
      <div class="mt-10 flex gap-8">
        <button type="submit" class="btn-primary btn-xs">${edit ? "Update" : "Save Payment"}</button>
        <button type="button" class="btn-xs" id="${edit ? `cancel-agent-payment-edit-${id}` : "cancel-agent-payment-form"}">Cancel</button>
      </div>
    </form>
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

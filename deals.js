import { state, buyerName, supplierName, paymentSummary, documentsForDeal } from "./state.js";
import { esc, nextDealNo, fmtMoney } from "./utils.js";

export function dealsView() {
  const q = (state.dealSearch || "").toLowerCase();
  const filtered = state.deals.filter(d => {
    const text = `${d.deal_no} ${d.product_name} ${buyerName(d.buyer_id)} ${supplierName(d.supplier_id)}`.toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="grid">
      <div class="flex-between flex-center">
        <h2 class="title">TRADE DEALS</h2>
        <button id="show-deal-form" class="btn-primary">+ NEW DEAL</button>
      </div>

      <div id="deal-form-wrap"></div>

      <input id="deal-search" value="${esc(state.dealSearch || "")}" placeholder="Search deals...">

      <div class="list">
        ${filtered.map(d => {
          const s = paymentSummary(d.id, d.total_amount_usd, d.purchase_total_usd);
          return `
            <div class="item">
              <div class="flex-between">
                <div>
                  <div class="item-title">${esc(d.deal_no)}: ${esc(d.product_name)}</div>
                  <div class="item-sub">${esc(buyerName(d.buyer_id))} / ${esc(supplierName(d.supplier_id))}</div>
                </div>
                <div style="text-align:right">
                  <div class="stat-label">Margin</div>
                  <div style="font-weight:800; color:var(--success)">${(s.sale > 0 ? ((s.sale - s.purchase)/s.sale)*100 : 0).toFixed(1)}%</div>
                </div>
              </div>
              
              <div class="grid grid-2 gap-10 mt-10">
                <div>
                  <div class="stat-label">Receivable</div>
                  <div class="item-title">$ ${fmtMoney(s.receivable)}</div>
                </div>
                <div>
                  <div class="stat-label">Payable</div>
                  <div class="item-title">$ ${fmtMoney(s.payable)}</div>
                </div>
              </div>

              <div class="flex gap-10 mt-12">
                <button data-open-deal="${d.id}" class="btn-info btn-small">DASHBOARD</button>
                <button data-edit-deal="${d.id}" class="btn-outline btn-small">EDIT</button>
                <button data-delete-deal="${d.id}" class="btn-danger btn-small">DELETE</button>
              </div>
              <div id="deal-edit-wrap-${d.id}"></div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

export function dealFormHtml(d = {}, edit = false, id = "") {
  const suffix = id ? `-${id}` : "";
  return `
    <form id="${edit ? `deal-edit-form-${id}` : "deal-form"}" class="item mb-12">
      <div class="form-header">${edit ? "EDIT DEAL" : "NEW DEAL"}</div>
      <div class="grid gap-12">
        <div class="grid grid-2 gap-10">
          <input name="deal_no" value="${esc(d.deal_no || nextDealNo())}" placeholder="Deal No" required>
          <select name="status">
            <option value="active" ${d.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="shipped" ${d.status === 'shipped' ? 'selected' : ''}>Shipped</option>
            <option value="completed" ${d.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
        
        <input name="product_name" value="${esc(d.product_name || "")}" placeholder="Product Name" required>
        
        <div class="grid grid-3 gap-10">
          <input name="quantity" id="quantity${suffix}" type="number" step="0.001" value="${d.quantity || ""}" placeholder="Qty" required>
          <input name="rate" id="rate${suffix}" type="number" step="0.01" value="${d.rate || ""}" placeholder="Sale Rate" required>
          <input name="purchase_rate" id="purchase-rate${suffix}" type="number" step="0.01" value="${d.purchase_rate || ""}" placeholder="Pur. Rate">
        </div>

        <div class="grid grid-2 gap-10">
          <input id="total${suffix}" readonly placeholder="Sale Total USD">
          <input name="conversion_rate" id="conversion-rate${suffix}" type="number" step="0.01" value="${d.conversion_rate || 3.6725}" placeholder="Conv. Rate">
        </div>

        <div class="grid grid-2 gap-10">
          <select name="buyer_id" required>
            <option value="">Select Buyer</option>
            ${state.buyers.map(b => `<option value="${b.id}" ${d.buyer_id == b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join("")}
          </select>
          <select name="supplier_id" required>
            <option value="">Select Supplier</option>
            ${state.suppliers.map(s => `<option value="${s.id}" ${d.supplier_id == s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join("")}
          </select>
        </div>

        <div class="grid grid-2 gap-10">
          <input name="loading_port" value="${esc(d.loading_port || "")}" placeholder="Loading Port">
          <input name="discharge_port" value="${esc(d.discharge_port || "")}" placeholder="Discharge Port">
        </div>

        <div class="grid grid-2 gap-10">
          <input name="vessel" value="${esc(d.vessel || "")}" placeholder="Vessel">
          <input name="bl_no" value="${esc(d.bl_no || "")}" placeholder="BL No">
        </div>

        <textarea name="container_numbers" placeholder="Container Numbers (One per line)">${Array.isArray(d.container_numbers) ? d.container_numbers.join("\n") : esc(d.container_numbers || "")}</textarea>

        <div class="flex gap-10">
          <button type="submit" class="btn-primary">${edit ? "UPDATE" : "SAVE"}</button>
          <button type="button" id="${edit ? `cancel-deal-edit-${id}` : "cancel-deal-form"}">CANCEL</button>
        </div>
      </div>
    </form>
  `;
}

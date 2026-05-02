import { state, paymentSummary, paymentsForDeal } from "./state.js";
import { esc, fmtMoney } from "./utils.js";

export function dashboardView() {
  let totalSaleAed = 0;
  let totalPurchaseAed = 0;
  let totalReceivableAed = 0;
  let totalPayableAed = 0;
  let totalReceivedAed = 0;
  let totalSentAed = 0;

  const receivablesBreakdown = [];
  const payablesBreakdown = [];
  const profitBreakdown = [];

  state.deals.forEach(d => {
    // Determine conversion rates with fallbacks
    const sConv = Number(d.sale_conversion_rate || d.conversion_rate || 3.67);
    const pConv = Number(d.purchase_conversion_rate || d.conversion_rate || 3.67);
    
    const s = paymentSummary(d.id, d.total_amount_usd, d.purchase_total_usd, "USD");
    
    // Convert USD balances to AED for the dashboard overview
    const saleAed = s.sale * sConv;
    const purchaseAed = s.purchase * pConv;
    const receivableAed = s.receivable * sConv;
    const payableAed = s.payable * pConv;
    const receivedAed = s.received * sConv;
    const sentAed = s.sent * pConv;

    totalSaleAed += saleAed;
    totalPurchaseAed += purchaseAed;
    totalReceivableAed += receivableAed;
    totalPayableAed += payableAed;
    totalReceivedAed += receivedAed;
    totalSentAed += sentAed;

    if (receivableAed !== 0) {
      receivablesBreakdown.push({
        deal_no: d.deal_no,
        product: d.product_name,
        total_usd: s.sale,
        received_usd: s.received,
        balance_usd: s.receivable,
        conv: sConv,
        balance_aed: receivableAed
      });
    }

    if (payableAed !== 0) {
      payablesBreakdown.push({
        deal_no: d.deal_no,
        product: d.product_name,
        total_usd: s.purchase,
        sent_usd: s.sent,
        balance_usd: s.payable,
        conv: pConv,
        balance_aed: payableAed
      });
    }

    profitBreakdown.push({
      deal_no: d.deal_no,
      product: d.product_name,
      sale_aed: saleAed,
      purchase_aed: purchaseAed,
      profit_aed: saleAed - purchaseAed
    });
  });

  // Store breakdown in global state for the Working button to access
  state._lastDashboardBreakdown = {
    receivables: receivablesBreakdown,
    payables: payablesBreakdown,
    profit: profitBreakdown
  };

  const totalProfitAed = totalSaleAed - totalPurchaseAed;
  const profitMargin = totalSaleAed > 0 ? (totalProfitAed / totalSaleAed) * 100 : 0;
  const recentDeals = [...state.deals].slice(0, 5);

  return `
    <div class="grid grid-3 mb-12">
      <div class="card" style="border-left: 4px solid var(--success); position: relative;">
        <button class="working-btn" data-breakdown="receivables" title="Show Working">Working</button>
        <div class="stat-label">Total Receivables</div>
        <div class="stat-value" style="color:var(--success)">AED ${fmtMoney(totalReceivableAed)}</div>
        <div class="item-sub">Outstanding from Buyers</div>
      </div>

      <div class="card" style="border-left: 4px solid var(--danger); position: relative;">
        <button class="working-btn" data-breakdown="payables" title="Show Working">Working</button>
        <div class="stat-label">Total Payables</div>
        <div class="stat-value" style="color:var(--danger)">AED ${fmtMoney(totalPayableAed)}</div>
        <div class="item-sub">Outstanding to Suppliers</div>
      </div>

      <div class="card" style="border-left: 4px solid var(--primary); position: relative;">
        <button class="working-btn" data-breakdown="profit" title="Show Working">Working</button>
        <div class="stat-label">Expected Profit</div>
        <div class="stat-value" style="color:var(--primary)">AED ${fmtMoney(totalProfitAed)}</div>
        <div class="item-sub">Avg Margin: ${profitMargin.toFixed(1)}%</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="stat-label">Network</div>
        <div class="stat-value" style="font-size:20px">${state.buyers.length + state.suppliers.length}</div>
        <div class="item-sub">${state.buyers.length} buyers · ${state.suppliers.length} suppliers</div>
      </div>
    </div>

    <div id="working-modal" class="modal" style="display:none">
      <div class="modal-content" style="max-width: 900px;">
        <div class="flex flex-between flex-center mb-14">
          <div class="title mb-0" id="working-title">Calculation Breakdown</div>
          <button class="btn-close" id="close-working-modal">&times;</button>
        </div>
        <div id="working-body" class="scroll-y" style="max-height: 70vh;"></div>
      </div>
    </div>

    <div class="card mt-14">
      <div class="flex flex-between flex-center gap-12 flex-wrap">
        <div class="title mb-0">Recent Deals</div>
        <button id="open-company-settings">Company Settings</button>
      </div>

      <div class="list mt-14">
        ${
          recentDeals.length
            ? recentDeals.map((d) => {
                const dealCurrency = d.document_currency || d.currency || d.base_currency || "AED";
                const displayTotal =
                  dealCurrency === "USD"
                    ? Number(d.total_amount_usd || d.total_amount || 0)
                    : Number(d.total_amount_aed || d.total_amount || 0);

                const payments = paymentsForDeal(d.id);
                const dealConv = Number(d.conversion_rate || 3.67);

                const received = payments.reduce((acc, p) => {
                  if (p.direction !== "in") return acc;
                  
                  const hasConverted = p.converted_amount !== null && p.converted_amount !== undefined;
                  const pAmt = Number(p.amount || 0);
                  const pCurr = p.currency || "AED";
                  
                  // SELF-HEALING
                  const isSuspicious = hasConverted && Number(p.converted_amount) === pAmt && pCurr !== dealCurrency;
                  
                  let val = 0;
                  if (hasConverted && !isSuspicious) {
                    val = Number(p.converted_amount);
                  } else {
                    if (pCurr === dealCurrency) val = pAmt;
                    else if (pCurr === "AED" && dealCurrency === "USD") val = pAmt / dealConv;
                    else if (pCurr === "USD" && dealCurrency === "AED") val = pAmt * dealConv;
                    else val = pAmt;
                  }
                  return acc + val;
                }, 0);
                

                return `
              <div class="item" style="padding:14px">
                <div class="flex flex-between gap-12 flex-wrap" style="align-items:flex-start">
                  <div style="min-width:0;flex:1">
                    <div class="item-title">${esc(d.deal_no || "—")} · ${esc(d.product_name || "—")}</div>
                    <div class="item-sub">HSN: ${esc(d.hsn_code || "—")}</div>
                    <div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div>
                    <div class="item-sub">${esc(d.type || "sell")} · ${esc(d.status || "active")}</div>
                  </div>
                  <div style="text-align:right;min-width:150px">
                    <div style="font-size:15px;font-weight:800;color:#d4a646">${esc(dealCurrency)} ${fmtMoney(displayTotal)}</div>
                    <div class="item-sub">Received: ${esc(dealCurrency)} ${fmtMoney(received)}</div>
                  </div>
                </div>
              </div>
            `;
              }).join("")
            : `<div class="empty">No deals available.</div>`
        }
      </div>
    </div>
  `;
}

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

    <div class="card mt-14" style="overflow:hidden; border-top: 4px solid #f1c40f">
      <div class="flex flex-between flex-center mb-12 flex-wrap gap-12">
        <div class="title mb-0">Surrender & Payment Summary</div>
        <div class="flex gap-8 flex-wrap">
          <select id="dashboard-party-filter" style="width:160px; padding:6px 10px; font-size:12px">
            <option value="">Filter Buyer</option>
            ${state.buyers.map(b => `<option value="${b.id}" ${String(state.dashboardPartyFilter) === String(b.id) ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
          </select>
          <select id="dashboard-supplier-filter" style="width:160px; padding:6px 10px; font-size:12px">
            <option value="">Filter Supplier</option>
            ${state.suppliers.map(s => `<option value="${s.id}" ${String(state.dashboardSupplierFilter) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
          </select>
          <button id="export-surrender-csv" class="btn-small">Export CSV</button>
          <button id="export-surrender-pdf" class="btn-small btn-info">Export PDF</button>
        </div>
      </div>
      
      <div class="table-responsive">
        <table id="surrender-summary-table" class="report-table" style="font-size:12px; width:100%">
          <thead>
            <tr>
              <th rowspan="2" style="background:var(--card-bg); text-align:left">PARTY NAME</th>
              <th rowspan="2">TOTAL FCL</th>
              <th rowspan="2">QTY (MT)</th>
              <th rowspan="2">PURCHASE TOTAL (AED)</th>
              <th rowspan="2">PAID SUPP (AED)</th>
              <th rowspan="2">PURCHASE BAL (AED)</th>
              <th colspan="2" style="background:rgba(59,157,162,0.2)">SURRENDER GIVEN</th>
              <th colspan="3" style="background:rgba(241,196,15,0.2); color:#000">FURTHER SURRENDER PENDING</th>
            </tr>
            <tr>
              <th style="background:rgba(59,157,162,0.1)">QTY (MT)</th>
              <th style="background:rgba(59,157,162,0.1)">FCL NO.</th>
              <th style="background:rgba(241,196,15,0.1); color:#000">QTY (MT)</th>
              <th style="background:rgba(241,196,15,0.1); color:#000">FCL NO.</th>
              <th style="background:rgba(241,196,15,0.1); color:#000">BAL AMT</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const summary = {};
              let filteredDeals = state.deals;

              if (state.dashboardPartyFilter) {
                filteredDeals = filteredDeals.filter(d => String(d.buyer_id) === String(state.dashboardPartyFilter));
              }
              if (state.dashboardSupplierFilter) {
                filteredDeals = filteredDeals.filter(d => String(d.supplier_id) === String(state.dashboardSupplierFilter));
              }

              filteredDeals.forEach(d => {
                const b = state.buyers.find(x => String(x.id) === String(d.buyer_id));
                const name = b?.name || "Unknown Buyer";
                if (!summary[name]) {
                  summary[name] = { fcl:0, qty:0, total:0, rec:0, bal:0, pTotal:0, pPaid:0, pBal:0, sQty:0, sFcl:0 };
                }
                
                const curr = d.document_currency || d.currency || "AED";
                const sConv = Number(d.sale_conversion_rate || d.conversion_rate || 3.67);
                const pConv = Number(d.purchase_conversion_rate || d.conversion_rate || 3.67);
                
                const s = paymentSummary(d.id, d.total_amount_usd, d.purchase_total_usd, "USD");
                
                // Use fcl_count if available, otherwise fall back to container numbers count
                const fcl = Number(d.fcl_count) || (Array.isArray(d.container_numbers) ? d.container_numbers.length : 0);
                const qty = Number(d.quantity || 0);
                
                const totalAed = s.sale * sConv;
                const recAed = s.received * sConv;
                const balAed = s.receivable * sConv;
                
                const pTotalAed = s.purchase * pConv;
                const pPaidAed = s.sent * pConv;
                const pBalAed = s.payable * pConv;
                
                summary[name].fcl += fcl;
                summary[name].qty += qty;
                summary[name].total += totalAed;
                summary[name].rec += recAed;
                summary[name].bal += balAed;
                
                summary[name].pTotal += pTotalAed;
                summary[name].pPaid += pPaidAed;
                summary[name].pBal += pBalAed;
                
                // If BL is surrendered, all qty and containers are "Given"
                if (d.is_bl_surrendered) {
                  summary[name].sQty += qty;
                  summary[name].sFcl += fcl;
                }
              });
              
              const sorted = Object.entries(summary).sort((a,b) => b[1].total - a[1].total);
              
              let tFcl=0, tQty=0, tTot=0, tRec=0, tBal=0, tpTot=0, tpPaid=0, tpBal=0, tsQty=0, tsFcl=0;
              
              const rows = sorted.map(([name, v]) => {
                const pQty = v.qty - v.sQty;
                const pFcl = v.fcl - v.sFcl;
                
                tFcl += v.fcl; tQty += v.qty; tTot += v.total; tRec += v.rec; tBal += v.bal;
                tpTot += v.pTotal; tpPaid += v.pPaid; tpBal += v.pBal;
                tsQty += v.sQty; tsFcl += v.sFcl;
                
                return `
                  <tr>
                    <td style="font-weight:700; text-align:left">${esc(name)}</td>
                    <td class="center">${v.fcl}</td>
                    <td class="right">${v.qty.toFixed(2)}</td>
                    
                    <td class="right" style="background:rgba(255,255,255,0.02)">${fmtMoney(v.pTotal)}</td>
                    <td class="right" style="background:rgba(255,255,255,0.02); color:var(--danger)">${fmtMoney(v.pPaid)}</td>
                    <td class="right" style="background:rgba(255,255,255,0.02); font-weight:700">${fmtMoney(v.pBal)}</td>

                    <td class="right" style="background:rgba(255,255,255,0.02)">${v.sQty.toFixed(2)}</td>
                    <td class="center" style="background:rgba(255,255,255,0.02)">${v.sFcl}</td>
                    <td class="right" style="background:rgba(241,196,15,0.05)">${pQty.toFixed(2)}</td>
                    <td class="center" style="background:rgba(241,196,15,0.05)">${pFcl}</td>
                    <td class="right" style="background:rgba(241,196,15,0.05); font-weight:700">${fmtMoney(v.pBal)}</td>
                  </tr>
                `;
              }).join("");

              if (!rows) return `<tr><td colspan="11" class="empty">No deals found for the selected filters.</td></tr>`;

              return rows + `
                <tr style="background:rgba(255,255,255,0.05); font-weight:800; border-top: 2px solid var(--border)">
                  <td style="text-align:left">TOTAL</td>
                  <td class="center">${tFcl}</td>
                  <td class="right">${tQty.toFixed(2)}</td>
                  
                  <td class="right">${fmtMoney(tpTot)}</td>
                  <td class="right">${fmtMoney(tpPaid)}</td>
                  <td class="right">${fmtMoney(tpBal)}</td>

                  <td class="right">${tsQty.toFixed(2)}</td>
                  <td class="center">${tsFcl}</td>
                  <td class="right">${(tQty - tsQty).toFixed(2)}</td>
                  <td class="center">${tFcl - tsFcl}</td>
                  <td class="right">${fmtMoney(tpBal)}</td>
                </tr>
              `;
            })()}
          </tbody>
        </table>
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

import { state, paymentSummary, paymentsForDeal } from "./state.js";
import { esc, fmtMoney } from "./utils.js";

export function dashboardView() {
  let totalSaleAed = 0;
  let totalPurchaseAed = 0;
  let totalReceivableAed = 0;
  let totalPayableAed = 0;
  let totalReceivedAed = 0;
  let totalSentAed = 0;

  state.deals.forEach(d => {
    const conv = Number(d.conversion_rate || 3.67);
    const s = paymentSummary(d.id, d.total_amount_usd, d.purchase_total_usd);
    
    // Convert USD balances to AED for the dashboard overview
    totalSaleAed += (s.sale * conv);
    totalPurchaseAed += (s.purchase * conv);
    totalReceivableAed += (s.receivable * conv);
    totalPayableAed += (s.payable * conv);
    totalReceivedAed += (s.received * conv);
    totalSentAed += (s.sent * conv);
  });

  const totalProfitAed = totalSaleAed - totalPurchaseAed;
  const recentDeals = [...state.deals].slice(0, 5);

  return `
    <div class="fade-in">
      
      <!-- Welcome Header -->
      <div class="mb-24">
        <h1 style="font-size: 24px; font-weight: 800;">Welcome back, ${esc(state.authUser?.email?.split('@')[0] || 'User')}</h1>
        <p class="text-muted">Here is what's happening with your trade operations today.</p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-4 mb-24">
        <div class="card stat-card" style="border-top: 3px solid var(--success)">
          <span class="stat-label">Receivables</span>
          <span class="stat-value" style="color: var(--success)">AED ${fmtMoney(totalReceivableAed)}</span>
          <span class="item-sub">Outstanding from Buyers</span>
        </div>

        <div class="card stat-card" style="border-top: 3px solid var(--danger)">
          <span class="stat-label">Payables</span>
          <span class="stat-value" style="color: var(--danger)">AED ${fmtMoney(totalPayableAed)}</span>
          <span class="item-sub">Outstanding to Suppliers</span>
        </div>

        <div class="card stat-card" style="border-top: 3px solid var(--primary)">
          <span class="stat-label">Expected Profit</span>
          <span class="stat-value">AED ${fmtMoney(totalProfitAed)}</span>
          <span class="item-sub">Gross margin projection</span>
        </div>

        <div class="card stat-card" style="border-top: 3px solid var(--info)">
          <span class="stat-label">Active Network</span>
          <span class="stat-value" style="color: var(--info)">${state.buyers.length + state.suppliers.length}</span>
          <span class="item-sub">${state.buyers.length} Buyers · ${state.suppliers.length} Suppliers</span>
        </div>
      </div>

      <div class="grid grid-2">
        
        <!-- Left: Recent Deals -->
        <div class="card">
          <div class="flex justify-between items-center mb-16">
            <h3 class="section-title mb-0">Recent Deals</h3>
            <a href="#/deals" class="btn btn-outline btn-small">View All</a>
          </div>

          <div class="list">
            ${recentDeals.length ? recentDeals.map((d) => {
              const dealCurrency = d.document_currency || d.currency || d.base_currency || "AED";
              const displayTotal = dealCurrency === "USD" 
                ? Number(d.total_amount_usd || d.total_amount || 0) 
                : Number(d.total_amount_aed || d.total_amount || 0);

              return `
                <div class="item flex justify-between items-center" data-open-deal="${d.id}" style="cursor: pointer;">
                  <div>
                    <div class="item-title">${esc(d.deal_no)}</div>
                    <div class="item-sub">${esc(d.product_name)}</div>
                    <div class="item-sub" style="font-size: 10px;">${esc(d.loading_port)} → ${esc(d.discharge_port)}</div>
                  </div>
                  <div style="text-align: right">
                    <div style="font-weight: 800; color: var(--primary);">${esc(dealCurrency)} ${fmtMoney(displayTotal)}</div>
                    <div class="item-sub">${esc(d.status).toUpperCase()}</div>
                  </div>
                </div>
              `;
            }).join("") : `<div class="empty">No recent deals found.</div>`}
          </div>
        </div>

        <!-- Right: Quick Actions -->
        <div class="grid gap-24">
          <div class="card">
            <h3 class="section-title">Quick Actions</h3>
            <div class="grid grid-2 gap-12">
              <button id="show-deal-form" class="btn btn-primary btn-small">New Trade Deal</button>
              <button id="show-buyer-form" class="btn btn-outline btn-small">Add Buyer</button>
              <button id="show-supplier-form" class="btn btn-outline btn-small">Add Supplier</button>
              <button id="export-deals-csv" class="btn btn-outline btn-small">Export Records</button>
            </div>
          </div>

          <div class="card" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%);">
             <h3 class="section-title" style="color: var(--info);">System Status</h3>
             <div class="flex items-center gap-12">
                <div style="width: 10px; height: 10px; background: var(--success); border-radius: 50%;"></div>
                <span class="item-title">Database Connected</span>
             </div>
             <div class="item-sub mt-8">All systems operational. Data is synchronized with Cloud Supabase.</div>
          </div>
        </div>

      </div>
    </div>
  `;
}

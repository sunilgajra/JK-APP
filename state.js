console.log("STATE.JS INITIALIZING");
export const state = {
  authUser: null,
  page: "dashboard",
  buyers: [],
  suppliers: [],
  shippingInstructions: [],
  products: [],
  deals: [],
  dealSearch: "",
  buyerSearch: "",
  supplierSearch: "",
  paymentsByDeal: {},
  documentsByDeal: {},
  auditLogsByEntity: {},
  selectedDealId: null,
  company: {
    id: 1,
    name: "JK PETROCHEM INTERNATIONAL FZE",
    address: "OFFICE NO:E2-110G-02, HAMARIYA FREE ZONE, SHARJAH, UAE",
    bankAccounts: [],
    shippers: [],
    mobile: "+971524396170",
    email: "info@jkpetrochem.com",
    gemini_api_key: "",
    gemini_model: "gemini-3-flash"
  },
  error: "",
  ready: false
};

export function buyerName(id) {
  return state.buyers.find((b) => String(b.id) === String(id))?.name || "—";
}

export function supplierName(id) {
  return state.suppliers.find((s) => String(s.id) === String(id))?.name || "—";
}

export function paymentsForDeal(dealId) {
  return state.paymentsByDeal[String(dealId)] || [];
}

export function documentsForDeal(dealId) {
  return state.documentsByDeal[String(dealId)] || [];
}

export function paymentSummary(dealId, saleTotal, purchaseTotal) {
  const list = paymentsForDeal(dealId);
  let received = 0;
  let sent = 0;

  list.forEach((p) => {
    const val = Number(p.converted_amount !== undefined ? p.converted_amount : p.amount || 0);
    if (p.direction === "out") sent += val;
    else received += val;
  });

  const sale = Number(saleTotal || 0);
  const purchase = Number(purchaseTotal || 0);
  
  const receivable = sale - received;
  const payable = purchase - sent;

  return { received, sent, receivable, payable, sale, purchase };
}

export function getSelectedDeal() {
  return state.deals.find((d) => String(d.id) === String(state.selectedDealId)) || null;
}

export function dealAuditLogs(dealId) {
  return state.auditLogsByEntity[`deals:${dealId}`] || [];
}

export function getShipperOptions() {
  return state.company.shippers || [];
}

export function getBuyerById(id) {
  return state.buyers.find((b) => String(b.id) === String(id)) || null;
}

export function getDealById(id) {
  return state.deals.find((d) => String(d.id) === String(id)) || null;
}

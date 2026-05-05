import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { handleRoute } from "./router.js";

export async function loadSupabaseData() {
  try {
    const [buyersRes, suppliersRes, agentsRes, dealsRes, paymentsRes, agentPaymentsRes, documentsRes, auditRes] = await Promise.all([
      supabase.from("buyers").select("*").order("id", { ascending: false }),
      supabase.from("suppliers").select("*").order("id", { ascending: false }),
      supabase.from("commission_agents").select("*").order("id", { ascending: false }),
      supabase.from("deals").select("*").order("id", { ascending: false }),
      supabase.from("payments").select("*").order("id", { ascending: false }),
      supabase.from("agent_payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("deal_documents").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false })
    ]);

    if (buyersRes.error) throw buyersRes.error;
    if (suppliersRes.error) throw suppliersRes.error;
    if (agentsRes.error && agentsRes.error.code !== "PGRST116") {
       console.warn("Agents table might not exist yet:", agentsRes.error);
    }
    if (dealsRes.error) throw dealsRes.error;

    state.buyers = buyersRes.data || [];
    state.suppliers = suppliersRes.data || [];
    state.agents = agentsRes.data || [];
    state.deals = dealsRes.data || [];

    const groupedPayments = {};
    (paymentsRes.data || []).forEach(p => {
      const k = String(p.deal_id);
      if (!groupedPayments[k]) groupedPayments[k] = [];
      groupedPayments[k].push(p);
    });
    state.paymentsByDeal = groupedPayments;

    const groupedAgentPayments = {};
    (agentPaymentsRes.data || []).forEach(p => {
      const k = String(p.agent_id);
      if (!groupedAgentPayments[k]) groupedAgentPayments[k] = [];
      groupedAgentPayments[k].push(p);
    });
    state.agentPaymentsByAgent = groupedAgentPayments;

    const groupedDocs = {};
    const groupedSupplierDocs = {};
    const groupedBuyerDocs = {};
    const companyDocs = [];

    (documentsRes.data || []).forEach(doc => {
      if (doc.deal_id) {
        const k = String(doc.deal_id);
        if (!groupedDocs[k]) groupedDocs[k] = [];
        groupedDocs[k].push(doc);
      }
      if (doc.supplier_id) {
        const k = String(doc.supplier_id);
        if (!groupedSupplierDocs[k]) groupedSupplierDocs[k] = [];
        groupedSupplierDocs[k].push(doc);
      }
      if (doc.buyer_id) {
        const k = String(doc.buyer_id);
        if (!groupedBuyerDocs[k]) groupedBuyerDocs[k] = [];
        groupedBuyerDocs[k].push(doc);
      }
      if (!doc.deal_id && !doc.supplier_id && !doc.buyer_id) {
        companyDocs.push(doc);
      }
    });

    state.documentsByDeal = groupedDocs;
    state.documentsBySupplier = groupedSupplierDocs;
    state.documentsByBuyer = groupedBuyerDocs;
    state.documentsByCompany = companyDocs;

    const groupedAudit = {};
    (auditRes.data || []).forEach(log => {
      const k = `${log.entity_type}:${log.entity_id}`;
      if (!groupedAudit[k]) groupedAudit[k] = [];
      groupedAudit[k].push(log);
    });
    state.auditLogsByEntity = groupedAudit;

    await loadCompanySettings();
    await loadProducts();
    await loadShippingInstructions();
    await loadPurchaseOrders();

    state.ready = true;
  } catch (err) {
    console.error("Load failed:", err);
  }
  handleRoute();
}

export async function loadPurchaseOrders() {
  const { data } = await supabase.from("purchase_orders").select("*").order("id", { ascending: false });
  if (data) state.purchaseOrders = data;
}

export async function loadCompanySettings() {
  const { data } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
  if (data) {
    state.company = {
      ...state.company,
      id: data.id,
      name: data.name || state.company.name,
      address: data.address || state.company.address,
      mobile: data.mobile || state.company.mobile,
      email: data.email || state.company.email,
      gemini_api_key: data.gemini_api_key || localStorage.getItem("gemini_api_key") || "",
      gemini_model: data.gemini_model || localStorage.getItem("gemini_model") || "gemini-2.5-flash",
      bankAccounts: Array.isArray(data.bank_accounts) ? data.bank_accounts : [],
      shippers: Array.isArray(data.shippers) ? data.shippers : []
    };
  }
}

export async function loadProducts() {
  const { data } = await supabase.from("products").select("*").order("name", { ascending: true });
  if (data) state.products = data;
}

export async function loadShippingInstructions() {
  const { data } = await supabase.from("shipping_instructions").select("*").order("id", { ascending: false });
  if (data) state.shippingInstructions = data;
}

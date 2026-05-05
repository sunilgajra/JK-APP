import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { loadSupabaseData } from "./data.js";
import { render } from "./ui.js";

export async function loginUser(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email")).trim(),
    password: String(fd.get("password")).trim()
  });
  if (error) return alert(error.message);
  state.authUser = data.user;
  await loadSupabaseData();
}

export async function logoutUser() {
  await supabase.auth.signOut();
  state.authUser = null;
  render();
}

export async function loadSession() {
  const { data } = await supabase.auth.getSession();
  state.authUser = data.session?.user || null;
  if (state.authUser) await loadSupabaseData();
  else render();
}

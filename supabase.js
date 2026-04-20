import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://rihqzycormftfxwefihx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaHF6eWNvcm1mdGZ4d2VmaWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDE0NjcsImV4cCI6MjA5MTk3NzQ2N30._2OFp9Sa0rJ3gV6HVQDayDIb0ZhNDN00D3IoehcT5TI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
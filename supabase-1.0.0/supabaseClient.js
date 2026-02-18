import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://kkeevzkktpmkyxzcxrfl.supabase.co",
  "YOUR_ANON_KEY"
);

const { data, error } = await supabase.from("users").select("*");

console.log(data);
console.log(error);

export default supabase;

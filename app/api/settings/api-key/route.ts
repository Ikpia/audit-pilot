import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptApiKey } from "@/lib/security/apiKeyCrypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const saveKeySchema = z.object({
  apiKey: z.string().min(20)
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    return NextResponse.json({ signedIn: false, hasApiKey: false });
  }

  const { data } = await supabase
    .from("api_keys")
    .select("id")
    .eq("user_id", userResult.user.id)
    .maybeSingle();

  return NextResponse.json({ signedIn: true, hasApiKey: Boolean(data) });
}

export async function POST(request: Request) {
  const parsed = saveKeySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid OpenAI API key." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    return NextResponse.json({ error: "Sign in before saving an API key." }, { status: 401 });
  }

  const encryptedKey = encryptApiKey(parsed.data.apiKey);
  const { error } = await supabase.from("api_keys").upsert(
    {
      user_id: userResult.user.id,
      encrypted_key: encryptedKey
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    return NextResponse.json({ error: "Sign in before removing an API key." }, { status: 401 });
  }

  const { error } = await supabase.from("api_keys").delete().eq("user_id", userResult.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
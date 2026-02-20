import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  // Delete in order: games → profile → auth user
  // Auth user deletion must be last — it revokes the token used for this request.
  // If auth deletion fails after the others, the user still has a valid account and can retry.
  const { error: gamesErr } = await supabase.from("games").delete().eq("user_id", userId);
  if (gamesErr) {
    console.error("DELETE /api/account — games delete error:", gamesErr.message);
    return NextResponse.json({ error: "Failed to delete game history" }, { status: 500 });
  }

  const { error: profileErr } = await supabase.from("profiles").delete().eq("id", userId);
  if (profileErr) {
    console.error("DELETE /api/account — profile delete error:", profileErr.message);
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }

  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error("DELETE /api/account — auth delete error:", authErr.message);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

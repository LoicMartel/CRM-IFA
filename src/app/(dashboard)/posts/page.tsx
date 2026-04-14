import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { PostsView } from "@/components/posts/posts-view";

export const metadata = { title: "Fil d'Actualité" };

export default async function PostsPage() {
  const supabase = await createClient();

  const [
    { data: posts },
    { data: teamMembers },
    { data: contacts },
    { data: companies },
    { data: deals },
    { data: orders },
    { data: projectTags },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "*, team_members!posts_author_id_fkey(id, first_name, last_name), post_attachments(*), post_comments(id), post_reactions(id, team_member_id, emoji)"
      )
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name"),
    supabase.from("contacts").select("id, first_name, last_name").order("first_name"),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("deals").select("id, name").order("name"),
    supabase.from("orders").select("id, contact_id, contacts!orders_contact_id_fkey(first_name, last_name)").order("created_at", { ascending: false }),
    supabase.from("post_project_tags").select("id, name, is_active").order("name"),
  ]);

  return (
    <>
      <Header title="Fil d'Actualité" />
      <div className="p-6">
        <PostsView
          posts={posts ?? []}
          teamMembers={teamMembers ?? []}
          contacts={contacts ?? []}
          companies={companies ?? []}
          deals={deals ?? []}
          orders={orders ?? []}
          projectTags={projectTags ?? []}
        />
      </div>
    </>
  );
}

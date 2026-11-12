/**
 * Fills one organizer's dashboard with fake invitations, guests, RSVPs and
 * view counts, so the dashboard and stats can be looked at without real use.
 *
 *   npx tsx scripts/seed-demo.ts seed  <organizer email>
 *   npx tsx scripts/seed-demo.ts clean <organizer email>
 *
 * Talks to whatever Supabase project .env.local points at, with the
 * service-role key. Every row it makes hangs off an event whose slug starts
 * with "demo-", and "clean" deletes exactly those events (guests, RSVPs and
 * views go with them by cascade). Running "seed" again first cleans.
 *
 * Live invitations count toward the 5-per-organizer limit, so it only makes
 * as many live ones as there is room for; the rest are created already
 * expired (still inside the cleanup grace period, so they show as expired).
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";

process.loadEnvFile(join(__dirname, "..", ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public";
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema },
});

const MAX_LIVE = 5;
const DAY = 86_400_000;

type DemoEvent = {
  slug: string; // fixed, so the links in the README keep working after a reseed
  event_type: string;
  template_id: string;
  name: string;
  inDays: number; // event date relative to today
  event_time: string;
  location: string;
  description: string;
  guests: [string, string, string | null][];
  walkIns: string[]; // RSVPs from people who are not named guests
  // Cover, one of each kind the app supports between them: a photo (normally
  // an upload; here a stock photo link), extra slider photos, or a built-in
  // drawn background (theme.cover + theme.icon), placed top, bottom or full.
  cover: {
    layout: "top" | "bottom" | "full";
    photo?: string;
    gallery?: string[];
    builtIn?: { cover: string; icon: string };
  };
};

// Unsplash photos, cropped and sized by Unsplash's own image service.
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

const EVENTS: DemoEvent[] = [
  {
    slug: "demo-wedding",
    cover: {
      layout: "full",
      photo: photo("1519741497674-611481863552"),
      gallery: [photo("1465495976277-4387d4b0b4c6"), photo("1511795409834-ef04bbd61622")],
    },
    event_type: "wedding",
    template_id: "elegant-gold",
    name: "Батболд & Сарнай",
    inDays: 12,
    event_time: "17:00",
    location: "Шангри-Ла зочид буудал, Улаанбаатар",
    description: "Бидний хуримын баярт хүрэлцэн ирж, баярыг маань хуваалцана уу.",
    guests: [
      ["Тэмүүлэн", "Ганбаатар", "temuulen.demo@example.com"],
      ["Номин", "Бат-Эрдэнэ", "nomin.demo@example.com"],
      ["Энхжин", "Дорж", null],
      ["Билгүүн", "Мөнх", "bilguun.demo@example.com"],
      ["Анужин", "Сүхбаатар", null],
      ["Мөнхзул", "Оюун", "munkhzul.demo@example.com"],
      ["Хонгор", "Төмөр", null],
      ["Уянга", "Цэрэн", null],
    ],
    walkIns: ["Ариунаа", "Ганзориг", "Solongo"],
  },
  {
    slug: "demo-birthday",
    cover: {
      layout: "top",
      photo: photo("1464349095431-e9a21285b5f3"),
      gallery: [photo("1530103862676-de8c9debad1d"), photo("1513151233558-d860c5398176")],
    },
    event_type: "birthday",
    template_id: "playful-pastel",
    name: "Анудари 30 нас",
    inDays: 5,
    event_time: "19:30",
    location: "Rosewood Kitchen + Bar",
    description: "Гучин насны төрсөн өдрөө хамтдаа тэмдэглэе!",
    guests: [
      ["Saraa", "B.", "saraa.demo@example.com"],
      ["Tuguldur", "E.", null],
      ["Oyuka", "G.", "oyuka.demo@example.com"],
      ["Zolboo", "N.", null],
      ["Michid", "T.", null],
    ],
    walkIns: ["Dulmaa", "Erdene"],
  },
  {
    slug: "demo-first-birthday",
    cover: { layout: "full", builtIn: { cover: "sky", icon: "🧸" } },
    event_type: "kids_first_birthday",
    template_id: "mint",
    name: "Бяцхан Тэнүүн 1 нас",
    inDays: 20,
    event_time: "12:00",
    location: "Kids Land, Хан-Уул дүүрэг",
    description: "Манай бяцхан хүүгийн анхны төрсөн өдөрт урьж байна.",
    guests: [
      ["Эмээ", "Цэцэг", null],
      ["Өвөө", "Баяр", null],
      ["Нандин", "Ган", "nandin.demo@example.com"],
      ["Төгс", "Бямба", null],
    ],
    walkIns: ["Оюунаа"],
  },
  {
    slug: "demo-team-dinner",
    cover: {
      layout: "bottom",
      photo: photo("1414235077428-338989a2e8c0"),
      gallery: [photo("1527529482837-4698179dc6ce"), photo("1517248135467-4c7edcad34c4")],
    },
    event_type: "corporate",
    template_id: "charcoal",
    name: "Year-end Team Dinner 2026",
    inDays: 30,
    event_time: "18:30",
    location: "Blue Sky Tower, 23rd floor",
    description: "Thanks for a great year. Dinner, awards and a few surprises.",
    guests: [
      ["Anand", "Ch.", "anand.demo@example.com"],
      ["Bolor", "D.", "bolor.demo@example.com"],
      ["Gerel", "S.", "gerel.demo@example.com"],
      ["Khulan", "M.", null],
      ["Odbayar", "P.", null],
      ["Tsogt", "L.", null],
    ],
    walkIns: [],
  },
  {
    slug: "demo-graduation",
    cover: { layout: "full", builtIn: { cover: "night", icon: "🎓" } },
    event_type: "graduation",
    template_id: "graduation-navy",
    name: "Graduation party — Class of 2026",
    inDays: -9,
    event_time: "16:00",
    location: "МУИС-ийн I байр",
    description: "Бид төгслөө! Хамтдаа баярлацгаая.",
    guests: [
      ["Батзаяа", "О.", null],
      ["Мишээл", "Д.", null],
      ["Тэнгис", "Б.", null],
    ],
    walkIns: ["Сондор", "Ичинноров"],
  },
];

const STATUSES = ["yes", "yes", "yes", "maybe", "no"] as const;
const pick = <T,>(xs: readonly T[], i: number) => xs[i % xs.length];
const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const ago = (maxDays: number) => new Date(Date.now() - Math.random() * maxDays * DAY).toISOString();

async function findOrganizer(email: string): Promise<string> {
  const { data, error } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No profile with that email. Sign in to the app once with it first.`);
  return data.id;
}

// Fake supporters for the list on /tip: paid, public tips with a name and a
// message (the page never shows the amount). Tips belong to no account, so
// they are marked with DEMO_TIP_REF instead, and only those are removed.
const DEMO_TIP_REF = "demo-seed";
const DEMO_TIPS: { name: string; message: string | null; amount: number; daysAgo: number }[] = [
  { name: "Сарнай", message: "Хуримын урилгаа хоёр минутад хийлээ. Маш их баярлалаа!", amount: 10000, daysAgo: 1 },
  { name: "Тэмүүлэн Г.", message: "Зочид маань RSVP-гээ шууд өгсөн нь их гоё байлаа.", amount: 5000, daysAgo: 2 },
  { name: "Oyuka", message: "Beautiful templates, and free. Keep it up!", amount: 20000, daysAgo: 4 },
  { name: "Анудари", message: "Төрсөн өдрийн урилга маань их хөөрхөн болсон 🎂", amount: 3000, daysAgo: 6 },
  { name: "Bolor D.", message: "Used it for our team dinner. Everyone opened it on Messenger.", amount: 15000, daysAgo: 9 },
  { name: "Нандин", message: null, amount: 2000, daysAgo: 12 },
  { name: "Ганзориг", message: "Цагаан сарын урилга явуулахад их хэрэг болсон. Амжилт!", amount: 5000, daysAgo: 20 },
];

async function cleanTips() {
  const { data, error } = await db.from("tips").delete().eq("provider_ref", DEMO_TIP_REF).select("id");
  if (error) throw error;
  console.log(`Removed ${data.length} demo supporter(s).`);
}

async function seedTips() {
  await cleanTips();
  const rows = DEMO_TIPS.map((tip) => {
    const at = new Date(Date.now() - tip.daysAgo * DAY - Math.random() * 6 * 3_600_000).toISOString();
    return {
      amount: tip.amount,
      display_name: tip.name,
      message: tip.message,
      is_public: true,
      status: "paid",
      provider: "mock",
      provider_ref: DEMO_TIP_REF,
      created_at: at,
      paid_at: at,
    };
  });
  const { error } = await db.from("tips").insert(rows);
  if (error) throw error;
  console.log(`Added ${rows.length} demo supporters to /tip.`);
}

async function clean(organizerId: string) {
  const { data, error } = await db
    .from("events")
    .delete()
    .eq("organizer_id", organizerId)
    .like("slug", "demo-%")
    .select("id");
  if (error) throw error;
  console.log(`Removed ${data.length} demo invitation(s) and everything attached to them.`);
  await cleanTips();
}

async function seed(organizerId: string) {
  await clean(organizerId);

  const { count, error: countError } = await db
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", organizerId)
    .eq("is_paid", false)
    .gt("expires_at", new Date().toISOString());
  if (countError) throw countError;
  let liveRoom = Math.max(0, MAX_LIVE - (count ?? 0));

  for (const [i, e] of EVENTS.entries()) {
    // Past events and anything beyond the free room are created expired.
    const live = e.inDays >= 0 && liveRoom > 0;
    if (live) liveRoom--;
    const createdDaysAgo = live ? 3 + i : 10;
    const expiresAt = live ? new Date(Date.now() + 14 * DAY) : new Date(Date.now() - 2 * DAY);

    const { data: ev, error } = await db
      .from("events")
      .insert({
        organizer_id: organizerId,
        event_type: e.event_type,
        template_id: e.template_id,
        name: e.name,
        event_date: isoDate(e.inDays),
        event_time: e.event_time,
        location: e.location,
        description: e.description,
        map_link: `https://maps.google.com/?q=${encodeURIComponent(e.location)}`,
        countdown_enabled: e.inDays > 0,
        slug: e.slug,
        cover_layout: e.cover.layout,
        photo_url: e.cover.photo ?? null,
        gallery_urls: e.cover.gallery ?? [],
        theme: e.cover.builtIn ?? {},
        created_at: new Date(Date.now() - createdDaysAgo * DAY).toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select("id, slug")
      .single();
    if (error) throw error;

    const { data: guests, error: gErr } = await db
      .from("named_guests")
      .insert(
        e.guests.map(([first, last, email], gi) => ({
          event_id: ev.id,
          first_name: first,
          last_name: last,
          email,
          // The first guest gets a fixed personal link (?to=<slug>-guest) for the README.
          guest_token: gi === 0 ? `${e.slug}-guest` : randomBytes(9).toString("hex"),
          email_sent_at: email && Math.random() < 0.6 ? ago(createdDaysAgo) : null,
        })),
      )
      .select("id, first_name, last_name");
    if (gErr) throw gErr;

    // About three quarters of named guests answer; walk-ins always do.
    const rsvps = [
      ...guests
        .filter((_, gi) => gi % 4 !== 3)
        .map((g, gi) => ({
          named_guest_id: g.id,
          display_name: `${g.first_name} ${g.last_name}`,
          status: pick(STATUSES, gi + i),
          party_size: gi % 3 === 0 ? 2 : 1,
        })),
      ...e.walkIns.map((name, wi) => ({
        named_guest_id: null,
        display_name: name,
        status: pick(STATUSES, wi + 1),
        party_size: wi % 2 === 0 ? 1 : 3,
      })),
    ].map((r) => {
      const at = ago(createdDaysAgo);
      return { ...r, event_id: ev.id, device_guest_id: randomUUID(), created_at: at, updated_at: at };
    });
    if (rsvps.length) {
      const { error: rErr } = await db.from("rsvps").insert(rsvps);
      if (rErr) throw rErr;
    }

    // Every responder's device viewed it, plus some who looked and never answered.
    const lookers = Array.from({ length: 4 + i * 2 }, () => randomUUID());
    const views = [...rsvps.map((r) => r.device_guest_id), ...lookers].map((device_id, vi) => {
      const first = ago(createdDaysAgo);
      return {
        event_id: ev.id,
        device_id,
        views: 1 + (vi % 4),
        map_clicks: vi % 3 === 0 ? 1 : 0,
        calendar_clicks: vi % 5 === 0 ? 1 : 0,
        first_seen_at: first,
        last_seen_at: first,
      };
    });
    const { error: vErr } = await db.from("event_views").insert(views);
    if (vErr) throw vErr;

    console.log(
      `${live ? "live   " : "expired"}  /i/${ev.slug}  ${e.name}  (${guests.length} guests, ${rsvps.length} RSVPs, ${views.length} devices)`,
    );
  }

  await seedTips();
}

async function main() {
  const [mode, email] = process.argv.slice(2);
  if (!["seed", "clean"].includes(mode) || !email) {
    console.error("Usage: npx tsx scripts/seed-demo.ts <seed|clean> <organizer email>");
    process.exit(1);
  }
  const organizerId = await findOrganizer(email);
  if (mode === "clean") await clean(organizerId);
  else await seed(organizerId);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

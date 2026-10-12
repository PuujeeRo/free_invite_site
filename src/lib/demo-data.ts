import type { EventType } from "@/lib/supabase/types";

export interface SampleEvent {
  id: string;
  eventType: EventType;
  name: string;
  location: string;
  description: string;
  defaultTemplateId: string;
  photoEmoji: string;
  photoColors: [string, string];
}

// No database yet at /demo -- this is fully static, illustrative data only.
export const SAMPLE_EVENTS: SampleEvent[] = [
  {
    id: "wedding",
    eventType: "wedding",
    name: "Бат & Сараа",
    location: "Улаанбаатар, Blue Sky Tower",
    description: "Бидний тусгай өдрийг тэмдэглэхэд бидэнтэй нэгдээрэй.",
    defaultTemplateId: "elegant-gold",
    photoEmoji: "💍",
    photoColors: ["#fde68a", "#fdba74"],
  },
  {
    id: "birthday",
    eventType: "kids_first_birthday",
    name: "Төгөлдөрийн 1 нас",
    location: "Улаанбаатар, Naadamchid center",
    description: "Манай гэрэлт хүүгийн анхны төрсөн өдөрт ирж баярыг хуваалцаарай!",
    defaultTemplateId: "playful-pastel",
    photoEmoji: "🎂",
    photoColors: ["#bae6fd", "#fbcfe8"],
  },
  {
    id: "graduation",
    eventType: "graduation",
    name: "Төгсөлтийн баяр 2026",
    location: "Улаанбаатар, Их сургууль",
    description: "Дөрвөн жилийн хүчин чармайлт өнөөдөр үр дүнгээ өглөө. Бидэнтэй хамт баярлацгаая.",
    defaultTemplateId: "graduation-navy",
    photoEmoji: "🎓",
    photoColors: ["#1e3a8a", "#0f172a"],
  },
  // Append only: the landing page hero uses the first two entries by index.
  // Names below are people/occasions only, never the category word itself --
  // the greeting already appends the category label after the name.
  {
    id: "hair_cutting",
    eventType: "hair_cutting",
    name: "Тэмүүлэн",
    location: "Улаанбаатар, Зайсан",
    description: "Манай хүүгийн даахийг үргээх өдөр ирж, хайч барин ерөөлөө хайрлаарай.",
    defaultTemplateId: "classic",
    photoEmoji: "✂️",
    photoColors: ["#f6ead0", "#e8cf9a"],
  },
  {
    id: "baby_shower",
    eventType: "baby_shower",
    name: "Мишээл",
    location: "Улаанбаатар, Хан-Уул дүүрэг",
    description: "Манай гэр бүлд шинэ хүн мэндэллээ. Бяцхан охинтой маань танилцахаар ирээрэй.",
    defaultTemplateId: "playful-pastel",
    photoEmoji: "🍼",
    photoColors: ["#fdf1ee", "#f3d5dc"],
  },
  {
    id: "engagement",
    eventType: "engagement",
    name: "Тэмүүжин & Номин",
    location: "Улаанбаатар, Тэрэлж",
    description: "Хоёр гэр бүл нэгдэх энэ өдрийг ойр дотны хүмүүстэйгээ хамт тэмдэглэнэ.",
    defaultTemplateId: "botanical",
    photoEmoji: "💐",
    photoColors: ["#eef1e3", "#cfdab5"],
  },
  {
    id: "anniversary",
    eventType: "anniversary",
    name: "Дорж & Оюунаа · 25 жил",
    location: "Улаанбаатар, Сүхбаатар дүүрэг",
    description: "Хамтдаа туулсан хорин таван жилийн ойгоо та бүхэнтэй хамт тэмдэглэнэ.",
    defaultTemplateId: "elegant-gold",
    photoEmoji: "🥂",
    photoColors: ["#fbf4e3", "#e6cf93"],
  },
  {
    id: "reunion",
    eventType: "reunion",
    name: "11А анги · 2016 оны төгсөгчид",
    location: "Дархан, 1-р сургууль",
    description: "Арван жилийн дараа дахин нэг ангид сууцгаая. Бүгдээрээ ирээрэй!",
    defaultTemplateId: "midnight",
    photoEmoji: "🏫",
    photoColors: ["#1c2238", "#0c0e18"],
  },
  {
    id: "housewarming",
    eventType: "housewarming",
    name: "Болд & Цэцэг",
    location: "Улаанбаатар, Яармаг",
    description: "Шинэ гэртээ орлоо. Цай ууж, гэр орныг маань үзэхээр ирээрэй.",
    defaultTemplateId: "botanical",
    photoEmoji: "🏡",
    photoColors: ["#f5f6ee", "#d9e0c6"],
  },
  {
    id: "corporate",
    eventType: "corporate",
    name: "Компанийн 10 жилийн ой",
    location: "Улаанбаатар, Шангри-Ла",
    description: "Арван жилийн замналаа хамт олон, түншүүдтэйгээ тэмдэглэнэ.",
    defaultTemplateId: "graduation-navy",
    photoEmoji: "🏢",
    photoColors: ["#16203a", "#0a0f1c"],
  },
  {
    id: "new_year",
    eventType: "new_year",
    name: "Шинэ жилийн үдэшлэг 2027",
    location: "Улаанбаатар, Шангри-Ла",
    description: "Жилийн ажлаа дүгнэж, хамт олноороо шинэ жилээ угтацгаая.",
    defaultTemplateId: "midnight",
    photoEmoji: "🎄",
    photoColors: ["#1d3b5c", "#0f2a22"],
  },
  {
    id: "tsagaan_sar",
    eventType: "tsagaan_sar",
    name: "Сар шинийн золголт",
    location: "Улаанбаатар, Баянзүрх дүүрэг",
    description: "Сар шинэдээ сайхан шинэлээрэй. Манайд ирж золгож, цай уугаарай.",
    defaultTemplateId: "saffron",
    photoEmoji: "🥟",
    photoColors: ["#fbf1d2", "#e9c988"],
  },
];

export function demoPhotoDataUri(emoji: string, [from, to]: [string, string]): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="480" height="360" fill="url(#g)"/>
    <text x="50%" y="54%" font-size="130" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Portrait sample cover for a card that uses its image as the whole
// background: the emoji sits in the top third, clear of the text that the
// "full" layout pins to the bottom of the card.
export function demoTallCoverDataUri(
  emoji: string,
  [from, to]: [string, string],
  // Where the emoji's centre sits and how big it is, in the 600x800 canvas. A
  // card with more text under it (countdown, buttons) needs it higher and
  // smaller to stay clear of the first line.
  { y = 25, size = 170 }: { y?: number; size?: number } = {}
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="600" height="800" fill="url(#g)"/>
    <text x="50%" y="${y}%" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SAMPLE_COVER_EMOJI: Record<EventType, string> = {
  birthday: "🎂",
  wedding: "💍",
  kids_first_birthday: "🎈",
  hair_cutting: "✂️",
  baby_shower: "🍼",
  engagement: "💐",
  anniversary: "🥂",
  graduation: "🎓",
  reunion: "🏫",
  housewarming: "🏡",
  corporate: "🏢",
  new_year: "🎄",
  tsagaan_sar: "🥟",
  other: "✉️",
};

// The emoji a built-in cover carries for each occasion (lib/cover-backgrounds.ts).
export function sampleCoverEmoji(eventType: EventType): string {
  return SAMPLE_COVER_EMOJI[eventType];
}

// A date that's always "coming up" relative to whenever the demo is viewed,
// so the countdown timer preview never shows a stale or past date.
export function demoEventDate(daysFromNow: number): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return { date: d.toISOString().slice(0, 10), time: "18:00" };
}

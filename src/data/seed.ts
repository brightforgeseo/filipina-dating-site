// Seed data for Tala — profiles, chats, testimonials.

export type Profile = {
  id: number;
  name: string;
  city: string;
  region: string;
  age: number;
  bg: string;
  fg: string;
  tags: string[];
  online: boolean;
  verified: boolean;
  premium: boolean;
  height: string;
  job: string;
  education: string;
  religion: string;
  kids: string;
  languages: string[];
  bio: string;
  lookingFor: string;
  prompts: [string, string][];
  lastActive: string;
};

const FIRST_NAMES = ["Mariel","Angeline","Krisha","Jasmine","Liza","Nicole","Althea","Camille","Rhea","Diana","Sophia","Bianca"];
const CITIES: [string,string][] = [
  ["Cebu City","Central Visayas"],["Manila","Metro Manila"],["Davao City","Davao Region"],
  ["Iloilo City","Western Visayas"],["Quezon City","Metro Manila"],["Baguio","Cordillera"],
  ["Bacolod","Negros Occidental"],["Dumaguete","Negros Oriental"],["Tagaytay","Cavite"],
  ["Angeles","Pampanga"],["Puerto Princesa","Palawan"],["Tacloban","Eastern Visayas"],
];

export const PROMPTS: [string, string][] = [
  ["A perfect Sunday looks like","Mass with my family in the morning, then slow coffee and a long walk by the sea at sunset. Simple is everything."],
  ["I'm looking for someone who","leads with kindness, laughs at the small things, and wants to build a home — not just a relationship."],
  ["My family means","the reason I work hard. Sunday lunch at lola's house is non-negotiable."],
  ["Two truths and a lie","I've climbed Mt. Pulag at sunrise. I can cook adobo better than my mom. I hate mangoes."],
  ["If we went on a trip, I'd take you to","El Nido at golden hour, in a bangka, with lumpia and cold halo-halo waiting back at the villa."],
  ["A cultural thing I'd share with you","Noche Buena — midnight feast on Christmas Eve. You'd meet everyone. It's loud, it's warm, you'll love it."],
];

const INTERESTS = ["Family-first","Catholic","Marriage-minded","Loves cooking","Baking","Adobo lover","Beach person","Hiking","Karaoke","Reading","Tagalog & English","Cebuano","Ilonggo","Teacher","Nurse","Entrepreneur","Student","Volunteer","Coffee person","Long walks","Dancing","Movies","Traveling"];

const PALETTE: [string,string][] = [
  ["#F4D4C1","#E86B4A"],["#D8C7A3","#B8924A"],["#CAD6C7","#2A4E3E"],
  ["#E8CFBE","#D9884B"],["#D4C1C8","#9B5B6A"],["#C7CAD6","#4A5F7A"],
  ["#E8DFC9","#8F7A3C"],["#C8D6CA","#4A7A5F"],["#F1D6C4","#C16A4A"],
  ["#D6C4C8","#8F4A5A"],["#C4D6D0","#4A7A6A"],["#DCD0C0","#7A6A4A"],
];

function seed(i: number): Profile {
  const name = FIRST_NAMES[i % FIRST_NAMES.length];
  const [city, region] = CITIES[i % CITIES.length];
  const age = 24 + (i * 3) % 12;
  const [bg, fg] = PALETTE[i % PALETTE.length];
  const tags: string[] = [];
  for (let k = 0; k < 4; k++) tags.push(INTERESTS[(i*3 + k*7) % INTERESTS.length]);
  return {
    id: i, name, city, region, age, bg, fg, tags,
    online: i % 3 === 0,
    verified: i % 4 !== 0,
    premium: i % 5 === 0,
    height: `5'${2 + (i%5)}"`,
    job: ["Teacher","Nurse","Graphic Designer","Student","Marketing Assoc.","Entrepreneur","Chef","HR Specialist"][i%8],
    education: ["University of the Philippines","Ateneo de Manila","De La Salle","San Carlos University","UP Cebu","UST"][i%6],
    religion: ["Catholic","Christian","Catholic","Spiritual","Catholic"][i%5],
    kids: ["Wants kids","Wants kids","Someday","Has one, wants more","Open to kids"][i%5],
    languages: [["Tagalog","English"],["Cebuano","Tagalog","English"],["Ilonggo","Tagalog","English"],["Tagalog","English","a little Spanish"]][i%4],
    bio: [
      "Teacher by day, baker on weekends. I believe in slow love, honest talk, and lots of merienda.",
      "Nurse on the wards, at home on the beach. Looking for someone steady, kind, a little goofy.",
      "I grew up with a big noisy family and I wouldn't want it any other way. Faith, family, and adobo.",
      "Traveling is my thing but the Philippines always pulls me back. Would love to show you why.",
      "I love a good book, long conversations, and a partner who actually listens. Ready for the real thing.",
    ][i%5],
    lookingFor: ["serious relationship","marriage","long-term partner","marriage","serious relationship"][i%5],
    prompts: [PROMPTS[i%PROMPTS.length], PROMPTS[(i+2)%PROMPTS.length], PROMPTS[(i+4)%PROMPTS.length]],
    lastActive: ["now","2m ago","18m ago","1h ago","3h ago","yesterday"][i%6],
  };
}

export const PROFILES: Profile[] = Array.from({length: 18}, (_, i) => seed(i));

export type ChatMsg = { from: "me" | "them"; t: string; text: string; tr: string | null };
export type Chat = { id: number; profileId: number; unread: number; time: string; preview: string; messages: ChatMsg[] };

export const CHATS: Chat[] = [
  { id: 0, profileId: 0, unread: 2, time: "12:04", preview: "Looking forward to it 🌅", messages: [
    { from:"them", t:"10:21", text:"Good morning! Saw you just joined Tala. Welcome 😊", tr:null },
    { from:"them", t:"10:21", text:"Kumain ka na ba?", tr:"(have you eaten yet?)" },
    { from:"me", t:"10:44", text:"Hi Mariel! Yes, just had breakfast. How about you?", tr:null },
    { from:"them", t:"10:46", text:"Just finished. I'm a morning person 🌞", tr:null },
    { from:"me", t:"11:58", text:"Same. I'd love to hear about Cebu — never been but I've always wanted to go.", tr:null },
    { from:"them", t:"12:03", text:"Then let me be your tour guide one day. I'll take you to Kawasan Falls.", tr:null },
    { from:"them", t:"12:04", text:"Looking forward to it 🌅", tr:null },
  ]},
  { id: 1, profileId: 2, unread: 0, time: "yesterday", preview: "That sounds perfect. Good night!", messages: [
    { from:"me", t:"yesterday 9:20pm", text:"Today was a long one. How was yours?", tr:null },
    { from:"them", t:"yesterday 9:45pm", text:"Okay lang! Worked a double shift but I'm home now.", tr:"(it was okay!)" },
    { from:"me", t:"yesterday 9:50pm", text:"What's your weekend plan?", tr:null },
    { from:"them", t:"yesterday 10:12pm", text:"Church in the morning, then lunch with the whole clan at my Lola's.", tr:null },
    { from:"me", t:"yesterday 10:14pm", text:"That sounds perfect. Good night!", tr:null },
  ]},
  { id: 2, profileId: 4, unread: 1, time: "Mon", preview: "Would love to video call this weekend?", messages: [
    { from:"them", t:"Mon 4:12pm", text:"Would love to video call this weekend?", tr:null },
  ]},
  { id: 3, profileId: 5, unread: 0, time: "Mar 18", preview: "Haha okay you win — adobo it is", messages: [
    { from:"them", t:"Mar 18", text:"Haha okay you win — adobo it is", tr:null },
  ]},
];

export const TESTIMONIALS = [
  { quote: "We met on Tala in 2024. By the end of that year, I was flying to Cebu to meet her family. We got married this spring.", name: "David & Mariel", meta: "Austin, TX ↔ Cebu City", color: "#F4D4C1" },
  { quote: "What I loved was how seriously Tala takes verification. Every profile I matched with was real. No time wasted.", name: "Marcus & Angeline", meta: "London ↔ Davao", color: "#D8C7A3" },
  { quote: "The translation feature gave me the confidence to say things I couldn't have said in English. Small thing, huge difference.", name: "Tom & Rhea", meta: "Vancouver ↔ Iloilo", color: "#CAD6C7" },
];

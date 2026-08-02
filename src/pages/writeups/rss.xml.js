import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const writeups = (await getCollection("writeups"))
    .filter((item) => !item.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: "Mateus Reis Bastos · Write-ups",
    description: "Resoluções técnicas de CTFs e laboratórios controlados.",
    site: context.site,
    items: writeups.map((item) => ({
      title: item.data.title,
      description: item.data.summary,
      pubDate: item.data.date,
      link: `/writeups/${item.id}/`,
    })),
  });
}

import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const [writeups, articles] = await Promise.all([
    getCollection("writeups"),
    getCollection("articles"),
  ]);
  const items = [
    ...writeups.filter((item) => !item.data.draft).map((item) => ({ ...item, section: "writeups" })),
    ...articles.filter((item) => !item.data.draft).map((item) => ({ ...item, section: "artigos" })),
  ].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: "Mateus Reis Bastos · Segurança da Informação",
    description: "Write-ups de CTF e artigos técnicos.",
    site: context.site,
    items: items.map((item) => ({
      title: item.data.title,
      description: item.data.summary,
      pubDate: item.data.date,
      link: `/${item.section}/${item.id}/`,
    })),
  });
}

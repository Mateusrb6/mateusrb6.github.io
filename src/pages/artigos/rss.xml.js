import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const articles = (await getCollection("articles"))
    .filter((item) => !item.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: "Mateus Reis Bastos · Artigos",
    description: "Artigos e notas sobre segurança da informação.",
    site: context.site,
    items: articles.map((item) => ({
      title: item.data.title,
      description: item.data.summary,
      pubDate: item.data.date,
      link: `/artigos/${item.id}/`,
    })),
  });
}

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const writeups = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/writeups" }),
  schema: z.object({
    title: z.string().trim().min(1).max(120),
    date: z.coerce.date(),
    summary: z.string().trim().min(1).max(280),
    platform: z.enum(["TryHackMe", "Hack The Box", "Outro"]),
    difficulty: z.enum(["Fácil", "Média", "Difícil", "Insana"]),
    os: z.enum(["Linux", "Windows", "Outro"]),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    draft: z.boolean().default(false),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string().trim().min(1).max(120),
    date: z.coerce.date(),
    summary: z.string().trim().min(1).max(280),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writeups, articles };

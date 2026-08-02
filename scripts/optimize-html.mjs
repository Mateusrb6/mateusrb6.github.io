import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDirectory = join(root, "public");
const dist = join(root, "dist");
const metadataCache = new Map();
const variantCache = new Map();
const targetWidths = [640, 960, 1280];

const htmlFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
};

const getMetadata = async (relativePath) => {
  if (!metadataCache.has(relativePath)) {
    metadataCache.set(relativePath, sharp(join(publicDirectory, relativePath)).metadata());
  }
  return metadataCache.get(relativePath);
};

const createVariants = async (sourceUrl) => {
  const sourcePath = decodeURIComponent(sourceUrl).replace(/^\//, "");
  if (variantCache.has(sourcePath)) return variantCache.get(sourcePath);

  const work = (async () => {
    const { width, height } = await getMetadata(sourcePath);
    if (!width || !height) return { width, height, variants: [] };

    const source = join(publicDirectory, sourcePath);
    const { dir, name } = parse(sourcePath);
    const widths = [...new Set(targetWidths.map((value) => Math.min(value, width)))];
    const variants = await Promise.all(widths.map(async (variantWidth) => {
      const relativePath = join(dir, `${name}-${variantWidth}.webp`);
      const output = join(dist, relativePath);
      await mkdir(dirname(output), { recursive: true });
      await sharp(source)
        .resize({ width: variantWidth, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(output);
      return { url: encodeURI(`/${relativePath}`), width: variantWidth };
    }));
    return { width, height, variants };
  })();

  variantCache.set(sourcePath, work);
  return work;
};

for (const file of await htmlFiles(dist)) {
  const source = await readFile(file, "utf8");
  const matches = [...source.matchAll(/<img\s+([^>]*?)src="(\/images\/writeups\/[^"?#]+)"([^>]*)>/g)];
  if (matches.length === 0) continue;

  let output = source;
  for (const match of matches) {
    const [, before, src, after] = match;
    const { width, height, variants } = await createVariants(src);
    const dimensions = width && height ? ` width="${width}" height="${height}"` : "";
    const fallback = `<img ${before}src="${src}"${after}${dimensions} loading="lazy" decoding="async">`;
    const replacement = variants.length === 0
      ? fallback
      : `<picture><source type="image/webp" srcset="${variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ")}" sizes="(max-width: 680px) calc(100vw - 2rem), min(72ch, calc(100vw - 3rem))">${fallback}</picture>`;
    output = output.replace(match[0], replacement);
  }
  await writeFile(file, output);
}

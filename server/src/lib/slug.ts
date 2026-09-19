/** Turn a name into a URL-safe, unique-ish slug (with a short random suffix). */
export function slugify(input: string): string {
  const base =
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

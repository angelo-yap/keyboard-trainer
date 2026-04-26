#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [, , inputPath, outputPath = "src/core/test/providers/localPassages.txt"] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/import-passages.mjs <authorized-export.json|html|txt> [output.txt]");
  process.exit(1);
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function sanitizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEntry(entry, index) {
  const text = sanitizeText(entry.text ?? entry.quote ?? entry.content ?? entry.body);
  if (text.length < 80 || text.length > 900) return null;

  const author = sanitizeText(entry.author ?? entry.by ?? entry.writer ?? "Unknown");
  const source = sanitizeText(entry.source ?? entry.title ?? entry.work ?? "Authorized Text Export");
  const id = sanitizeText(entry.id ?? `authorized-${index + 1}`);

  return { id, text, author, source };
}

function parseJson(raw) {
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed.texts ?? parsed.quotes ?? parsed.passages ?? [];
  return rows.map(normalizeEntry).filter(Boolean);
}

function parseHtml(raw) {
  const decoded = decodeEntities(raw);
  const rowMatches = decoded.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const rows = rowMatches.flatMap((row) => {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => sanitizeText(match[1]));
    if (cells.length < 2) return [];
    const [source, , , text] = cells.length >= 4 ? cells : [cells[0], "", "", cells[cells.length - 1]];
    return [{ text, source, author: "Unknown" }];
  });
  return rows.map(normalizeEntry).filter(Boolean);
}

function parseText(raw) {
  return raw
    .split(/\n{2,}/)
    .map((text, index) => normalizeEntry({ text, source: "Authorized Text Export" }, index))
    .filter(Boolean);
}

const raw = fs.readFileSync(inputPath, "utf8");
const ext = path.extname(inputPath).toLowerCase();
const passages = ext === ".json" ? parseJson(raw) : ext === ".html" || ext === ".htm" ? parseHtml(raw) : parseText(raw);

if (passages.length === 0) {
  console.error("No usable passages found. Expected entries with 80-900 characters of text.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const textFile = passages
  .map((passage) => `:: ${passage.id} | ${passage.author} | ${passage.source}\n${passage.text}`)
  .join("\n\n");
fs.writeFileSync(outputPath, `${textFile}\n`);
console.log(`Wrote ${passages.length} passages to ${outputPath}`);

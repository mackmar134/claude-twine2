import * as cheerio from "cheerio";
import type { TwineStory, TwinePassage } from "./types";

export function extractLinks(text: string): string[] {
  const links: string[] = [];
  const re = /\[\[(.*?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const inner = m[1];
    const arrow = inner.indexOf("->");
    const pipe = inner.indexOf("|");
    if (arrow !== -1) {
      links.push(inner.slice(arrow + 2).trim());
    } else if (pipe !== -1) {
      links.push(inner.slice(pipe + 1).trim());
    } else {
      links.push(inner.trim());
    }
  }
  return links;
}

export function parseHtml(html: string): TwineStory {
  const $ = cheerio.load(html);
  const storyEl = $("tw-storydata");

  const story: TwineStory = {
    name: storyEl.attr("name") || "Untitled",
    ifid: storyEl.attr("ifid"),
    format: storyEl.attr("format"),
    formatVersion: storyEl.attr("format-version"),
    startPassage: undefined,
    passages: [],
  };

  const startPid = storyEl.attr("startnode");

  const styleEl = $("tw-storydata style[type='text/twine-css']");
  if (styleEl.length) story.stylesheet = styleEl.text();
  const scriptEl = $("tw-storydata script[type='text/twine-javascript']");
  if (scriptEl.length) story.script = scriptEl.text();

  $("tw-passagedata").each((_i, el) => {
    const $el = $(el);
    const pid = parseInt($el.attr("pid") || "0", 10);
    const name = $el.attr("name") || "";
    const tagsStr = $el.attr("tags") || "";
    const posStr = $el.attr("position") || "";
    const sizeStr = $el.attr("size") || "";
    const text = $el.text();

    const passage: TwinePassage = {
      name,
      pid,
      tags: tagsStr ? tagsStr.split(/\s+/) : [],
      text,
      links: extractLinks(text),
    };

    if (posStr) {
      const [x, y] = posStr.split(",").map(Number);
      passage.position = { x, y };
    }
    if (sizeStr) {
      const [width, height] = sizeStr.split(",").map(Number);
      passage.size = { width, height };
    }

    if (String(pid) === startPid) {
      story.startPassage = name;
    }

    story.passages.push(passage);
  });

  return story;
}

export function storyToTwee(story: TwineStory): string {
  const lines: string[] = [];

  lines.push(":: StoryData");
  lines.push(JSON.stringify(
    {
      ifid: story.ifid || generateIfid(),
      format: story.format || "Harlowe",
      "format-version": story.formatVersion || "3.3.9",
      start: story.startPassage || story.passages[0]?.name || "Start",
    },
    null,
    2
  ));
  lines.push("");

  lines.push(":: StoryTitle");
  lines.push(story.name);
  lines.push("");

  if (story.stylesheet) {
    lines.push(":: UserStylesheet [stylesheet]");
    lines.push(story.stylesheet);
    lines.push("");
  }

  if (story.script) {
    lines.push(":: UserScript [script]");
    lines.push(story.script);
    lines.push("");
  }

  for (const p of story.passages) {
    let header = `:: ${p.name}`;
    if (p.tags && p.tags.length > 0) {
      header += ` [${p.tags.join(" ")}]`;
    }
    if (p.position) {
      header += ` {"position":"${p.position.x},${p.position.y}"}`;
    }
    lines.push(header);
    lines.push(p.text);
    lines.push("");
  }

  return lines.join("\n");
}

export function parseTwee(twee: string): TwineStory {
  const story: TwineStory = {
    name: "Untitled",
    passages: [],
  };

  const headerRe = /^:: (.+)$/gm;
  const headers: { name: string; tags: string[]; meta: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headerRe.exec(twee)) !== null) {
    const full = match[1];
    const tagMatch = full.match(/\[([^\]]*)\]/);
    const tags = tagMatch ? tagMatch[1].split(/\s+/).filter(Boolean) : [];
    const metaMatch = full.match(/\{([^}]*)\}/);
    const meta = metaMatch ? metaMatch[0] : "";
    const name = full.replace(/\s*\[.*/, "").replace(/\s*\{.*/, "").trim();

    headers.push({ name, tags, meta, index: match.index + match[0].length });
  }

  let pid = 1;
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length
      ? twee.lastIndexOf("\n:: ", headers[i + 1].index) !== -1
        ? twee.indexOf("\n:: " + headers[i + 1].name, start)
        : headers[i + 1].index - headers[i + 1].name.length - 4
      : twee.length;
    const text = twee.slice(start, end).replace(/^\n+/, "").replace(/\n+$/, "");
    const h = headers[i];

    if (h.name === "StoryTitle") {
      story.name = text.trim();
      continue;
    }
    if (h.name === "StoryData") {
      try {
        const data = JSON.parse(text);
        story.ifid = data.ifid;
        story.format = data.format;
        story.formatVersion = data["format-version"];
        story.startPassage = data.start;
      } catch { /* ignore parse errors */ }
      continue;
    }
    if (h.tags.includes("stylesheet")) {
      story.stylesheet = text;
      continue;
    }
    if (h.tags.includes("script")) {
      story.script = text;
      continue;
    }

    const passage: TwinePassage = {
      name: h.name,
      pid: pid++,
      tags: h.tags,
      text,
      links: extractLinks(text),
    };

    if (h.meta) {
      try {
        const meta = JSON.parse(h.meta);
        if (meta.position) {
          const [x, y] = String(meta.position).split(",").map(Number);
          passage.position = { x, y };
        }
      } catch { /* ignore */ }
    }

    story.passages.push(passage);
  }

  return story;
}

export function storyToHtml(story: TwineStory): string {
  const ifid = story.ifid || generateIfid();
  const startPid = story.passages.find((p) => p.name === story.startPassage)?.pid || 1;
  const format = story.format || "Harlowe";
  const formatVersion = story.formatVersion || "3.3.9";

  let html = `<tw-storydata name="${escapeAttr(story.name)}" startnode="${startPid}" creator="claude-twine-bridge" creator-version="0.1.0" format="${escapeAttr(format)}" format-version="${escapeAttr(formatVersion)}" ifid="${escapeAttr(ifid)}" options="" tags="" zoom="1" hidden>\n`;

  if (story.stylesheet) {
    html += `  <style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">${story.stylesheet}</style>\n`;
  }
  if (story.script) {
    html += `  <script role="script" id="twine-user-script" type="text/twine-javascript">${story.script}</script>\n`;
  }

  for (const p of story.passages) {
    const tags = p.tags?.join(" ") || "";
    const pos = p.position ? `${p.position.x},${p.position.y}` : "0,0";
    const size = p.size ? `${p.size.width},${p.size.height}` : "100,100";
    html += `  <tw-passagedata pid="${p.pid}" name="${escapeAttr(p.name)}" tags="${escapeAttr(tags)}" position="${pos}" size="${size}">${escapeHtml(p.text)}</tw-passagedata>\n`;
  }

  html += `</tw-storydata>`;
  return html;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateIfid(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0").toUpperCase();
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}

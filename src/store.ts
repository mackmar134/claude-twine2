import * as fs from "fs";
import * as path from "path";
import type { TwineStory, TwinePassage } from "./types";
import { generateIfid } from "./twine-parser";

const SAVE_DIR = path.join(
  process.env.TWINE_SAVE_DIR || path.join(__dirname, "..", "stories")
);

class StoryStore {
  private stories: Map<string, TwineStory> = new Map();

  constructor() {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    this.loadAll();
  }

  private savePath(name: string): string {
    const safe = name.replace(/[<>:"/\\|?*]/g, "_");
    return path.join(SAVE_DIR, `${safe}.json`);
  }

  private persist(name: string): void {
    const story = this.stories.get(name);
    if (story) {
      fs.writeFileSync(this.savePath(name), JSON.stringify(story, null, 2), "utf-8");
    }
  }

  private loadAll(): void {
    if (!fs.existsSync(SAVE_DIR)) return;
    for (const file of fs.readdirSync(SAVE_DIR)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(SAVE_DIR, file), "utf-8");
        const story: TwineStory = JSON.parse(raw);
        if (story.name) this.stories.set(story.name, story);
      } catch { /* skip corrupt files */ }
    }
  }

  create(name: string, format?: string): TwineStory {
    const story: TwineStory = {
      name,
      ifid: generateIfid(),
      format: format || "Harlowe",
      formatVersion: format === "SugarCube" ? "2.37.3" : "3.3.9",
      startPassage: undefined,
      passages: [],
    };
    this.stories.set(name, story);
    this.persist(name);
    return story;
  }

  get(name: string): TwineStory | undefined {
    return this.stories.get(name);
  }

  list(): string[] {
    return Array.from(this.stories.keys());
  }

  set(name: string, story: TwineStory): void {
    this.stories.set(name, story);
    this.persist(name);
  }

  delete(name: string): boolean {
    const result = this.stories.delete(name);
    if (result) {
      const fp = this.savePath(name);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    return result;
  }

  addPassage(storyName: string, passage: Omit<TwinePassage, "pid">): TwinePassage {
    const story = this.stories.get(storyName);
    if (!story) throw new Error(`Story "${storyName}" not found`);

    const pid = story.passages.length > 0
      ? Math.max(...story.passages.map((p) => p.pid || 0)) + 1
      : 1;

    const full: TwinePassage = { ...passage, pid };
    if (!full.position) {
      const cols = 5;
      const idx = story.passages.length;
      full.position = { x: (idx % cols) * 250, y: Math.floor(idx / cols) * 250 };
    }
    story.passages.push(full);

    if (!story.startPassage) {
      story.startPassage = full.name;
    }

    this.persist(storyName);
    return full;
  }

  getPassage(storyName: string, passageName: string): TwinePassage | undefined {
    const story = this.stories.get(storyName);
    return story?.passages.find((p) => p.name === passageName);
  }

  updatePassage(storyName: string, passageName: string, updates: Partial<TwinePassage>): TwinePassage {
    const story = this.stories.get(storyName);
    if (!story) throw new Error(`Story "${storyName}" not found`);
    const idx = story.passages.findIndex((p) => p.name === passageName);
    if (idx === -1) throw new Error(`Passage "${passageName}" not found in "${storyName}"`);

    if (updates.name && updates.name !== passageName) {
      for (const p of story.passages) {
        if (p.links?.includes(passageName)) {
          p.links = p.links.map((l) => l === passageName ? updates.name! : l);
        }
      }
      if (story.startPassage === passageName) {
        story.startPassage = updates.name;
      }
    }

    story.passages[idx] = { ...story.passages[idx], ...updates };
    this.persist(storyName);
    return story.passages[idx];
  }

  deletePassage(storyName: string, passageName: string): boolean {
    const story = this.stories.get(storyName);
    if (!story) return false;
    const idx = story.passages.findIndex((p) => p.name === passageName);
    if (idx === -1) return false;
    story.passages.splice(idx, 1);
    if (story.startPassage === passageName) {
      story.startPassage = story.passages[0]?.name;
    }
    this.persist(storyName);
    return true;
  }


}

export const store = new StoryStore();

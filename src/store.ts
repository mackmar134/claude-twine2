import type { TwineStory, TwinePassage } from "./types";

class StoryStore {
  private stories: Map<string, TwineStory> = new Map();

  create(name: string, format?: string): TwineStory {
    const story: TwineStory = {
      name,
      ifid: this.generateIfid(),
      format: format || "Harlowe",
      formatVersion: format === "SugarCube" ? "2.37.3" : "3.3.9",
      startPassage: undefined,
      passages: [],
    };
    this.stories.set(name, story);
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
  }

  delete(name: string): boolean {
    return this.stories.delete(name);
  }

  addPassage(storyName: string, passage: Omit<TwinePassage, "pid">): TwinePassage {
    const story = this.stories.get(storyName);
    if (!story) throw new Error(`Story "${storyName}" not found`);

    const pid = story.passages.length > 0
      ? Math.max(...story.passages.map((p) => p.pid || 0)) + 1
      : 1;

    const full: TwinePassage = { ...passage, pid };
    story.passages.push(full);

    if (!story.startPassage) {
      story.startPassage = full.name;
    }

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
    return true;
  }

  private generateIfid(): string {
    const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0").toUpperCase();
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
  }
}

export const store = new StoryStore();

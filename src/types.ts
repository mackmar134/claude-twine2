export interface TwinePassage {
  name: string;
  pid?: number;
  tags?: string[];
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  text: string;
  links?: string[];
}

export interface TwineStory {
  name: string;
  ifid?: string;
  format?: string;
  formatVersion?: string;
  startPassage?: string;
  passages: TwinePassage[];
  stylesheet?: string;
  script?: string;
}

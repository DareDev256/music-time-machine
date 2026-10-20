// The share line: a contrast between what you were playing and what the world was playing.
// "SPRING 2012 · I WAS ON CHIEF KEEF · THE WORLD WAS ON GOTYE"

const SEASONS = ["WINTER", "WINTER", "SPRING", "SPRING", "SPRING", "SUMMER", "SUMMER", "SUMMER", "FALL", "FALL", "FALL", "WINTER"];

export interface CardLine { season: string; me: string; world: string }

// Features always go; "&", "x" and commas are often part of a name (Earth, Wind & Fire;
// Tyler, The Creator), so a short credit is kept whole and only a long one is cut to its lead.
const FEATURE = /\s+(?:featuring|feat\.?|ft\.?|with)\s+.*$/i;
const COLLAB = /\s+(?:x|&|and)\s+/i;
const MAX_CREDIT = 24;

function credit(artist: string): string {
  const main = artist.replace(FEATURE, "").trim();
  return (main.length <= MAX_CREDIT ? main : main.split(COLLAB)[0]).toUpperCase();
}

function leadKey(artist: string): string {
  return artist.replace(FEATURE, "").split(COLLAB)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function seasonOf(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  // December belongs to the winter that runs into the next year's January.
  return `${SEASONS[m - 1]} ${m === 12 ? y + 1 : y}`;
}

export function cardLine(input: {
  song?: string | null;
  artist?: string | null;
  date: string;
  numberOne: { song: string; artist: string } | null;
}): CardLine {
  const season = seasonOf(input.date);
  const worldArtist = input.numberOne ? credit(input.numberOne.artist) : null;
  if (input.song && input.artist) {
    const same = input.numberOne && leadKey(input.numberOne.artist) === leadKey(input.artist);
    const world = !worldArtist ? "" : same ? "SO WAS EVERYONE" : `THE WORLD WAS ON ${worldArtist}`;
    return { season, me: `I WAS ON ${credit(input.artist)}`, world };
  }
  if (input.numberOne) {
    return { season, me: `THE #1 WAS ${input.numberOne.song.toUpperCase()} BY ${worldArtist}`, world: "" };
  }
  return { season, me: "", world: "" };
}

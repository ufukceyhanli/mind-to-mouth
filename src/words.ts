/**
 * Prompt words for impromptu speaking. A mix of concrete objects, everyday
 * situations, abstract ideas and a few oddballs so no two days feel alike.
 */
export const WORDS: string[] = [
  // Concrete objects
  'umbrella', 'bridge', 'candle', 'compass', 'ladder', 'mirror', 'anchor', 'kite',
  'lantern', 'key', 'suitcase', 'hammock', 'telescope', 'bicycle', 'hourglass',
  'backpack', 'window', 'fence', 'notebook', 'kettle', 'staircase', 'balloon',
  'mailbox', 'pillow', 'raincoat', 'bookshelf', 'shovel', 'scarf', 'saddle',
  'chalk', 'rope', 'lighthouse', 'passport', 'blanket', 'trampoline', 'tent',
  'wheel', 'map', 'clock', 'seed', 'bell', 'engine', 'paperclip', 'thermometer',
  // Nature
  'ocean', 'volcano', 'glacier', 'desert', 'forest', 'thunder', 'river', 'moon',
  'fog', 'sunrise', 'island', 'meadow', 'cave', 'waterfall', 'storm', 'tide',
  'canyon', 'orchard', 'comet', 'horizon', 'avalanche', 'harvest', 'dawn',
  // Animals
  'octopus', 'penguin', 'elephant', 'hummingbird', 'tortoise', 'wolf', 'jellyfish',
  'owl', 'ant', 'dolphin', 'chameleon', 'beaver', 'crow', 'salmon', 'giraffe',
  // Food and drink
  'breakfast', 'coffee', 'bread', 'lemon', 'chocolate', 'soup', 'picnic', 'spice',
  'honey', 'garlic', 'watermelon', 'recipe', 'feast', 'popcorn', 'pancake',
  // Everyday life
  'traffic', 'alarm', 'queue', 'commute', 'laundry', 'neighbour', 'birthday',
  'weekend', 'grocery', 'elevator', 'parking', 'invoice', 'password', 'meeting',
  'deadline', 'headphones', 'roommate', 'garden', 'hobby', 'homework', 'receipt',
  'subway', 'airport', 'hospital', 'library', 'kitchen', 'balcony', 'basement',
  // People and roles
  'teacher', 'stranger', 'mentor', 'pirate', 'detective', 'astronaut', 'grandmother',
  'referee', 'chef', 'tourist', 'inventor', 'gardener', 'librarian', 'volunteer',
  // Abstract ideas
  'patience', 'risk', 'curiosity', 'silence', 'trust', 'habit', 'failure', 'luck',
  'courage', 'boredom', 'freedom', 'ambition', 'memory', 'nostalgia', 'balance',
  'chaos', 'momentum', 'gratitude', 'regret', 'loyalty', 'discipline', 'wonder',
  'jealousy', 'kindness', 'pressure', 'tradition', 'rebellion', 'comfort',
  'distraction', 'humility', 'progress', 'friction', 'clarity', 'doubt', 'joy',
  'privacy', 'legacy', 'adventure', 'routine', 'growth', 'honesty', 'timing',
  // Verbs and actions (spoken as topics)
  'waiting', 'listening', 'negotiating', 'wandering', 'forgiving', 'improvising',
  'apologising', 'competing', 'daydreaming', 'teaching', 'packing', 'quitting',
  // Society and technology
  'money', 'internet', 'robot', 'election', 'newspaper', 'city', 'village',
  'satellite', 'battery', 'algorithm', 'museum', 'marathon', 'festival', 'currency',
  'headline', 'rumour', 'contract', 'lottery', 'podcast', 'telephone', 'calendar',
  // Oddballs
  'time travel', 'invisible', 'upside down', 'lost sock', 'secret door', 'last slice',
  'empty room', 'wrong number', 'plan B', 'second chance', 'blank page', 'shortcut',
  'red button', 'wild card', 'first impression', 'perfect day', 'worst advice',
];

/** Pick a random word, avoiding anything in `recent` when possible. */
export function pickWord(recent: string[] = []): string {
  const recentSet = new Set(recent.map((w) => w.toLowerCase()));
  const pool = WORDS.filter((w) => !recentSet.has(w.toLowerCase()));
  const source = pool.length > 0 ? pool : WORDS;
  return source[Math.floor(Math.random() * source.length)];
}

// Short, varied achievement copy using evidence-informed feedback principles:
// acknowledge progress, competence and persistence without comparing players or shaming hints.
// These lines are design hypotheses, not individually validated scientific claims.
const STEADY = [
  'Clean connections. Questionable levels of competence.',
  'Your brain just did a tidy little backflip.',
  'That board never stood a chance. Respectfully.',
  'Pattern recognition has entered the chat.',
  'Another level filed under: handled.',
  'You and that grid have reached an understanding.',
  'The dots are connected. The vibes are immaculate.',
  'A very respectable use of your neurons.',
  'You made that look suspiciously intentional.',
  'Grid sorted. Brain still under warranty.',
  'That was some premium problem-solving.',
  'One small puzzle for you, one giant L for the grid.',
  'You found the flow. The flow has filed no complaints.',
  'Logic: deployed. Chaos: politely declined.',
  'That solution had excellent administrative efficiency.',
  'Your spatial reasoning would like a tiny promotion.',
  'A neat little victory for the thinking department.',
  'The puzzle has left the building.',
  'Every cell accounted for. No meetings required.',
  'You absolutely understood the assignment. The assignment was squares.',
];
const QUICK = [
  'Speedrun energy. Touch grass later; the grid is done now.',
  'That was quick. Did you pre-read the universe?',
  'The puzzle barely had time to load emotionally.',
  'Efficient. Somewhere, a spreadsheet just nodded.',
  'You solved that before the grid could develop lore.',
  'Fast hands, thoughtful brain. Suspicious combo.',
  'The grid blinked and missed its own defeat.',
  'That solution arrived express delivery.',
  'Absolutely no business being that efficient.',
  'You made short work of a very square problem.',
  'A clean solve with minimal plot development.',
  'That board got speed-dated by logic.',
  'The neurons were clearly on fibre broadband.',
  'A rapid little masterclass in connecting dots.',
  'That was less puzzle, more brief appointment.',
  'Efficiency so crisp it needs a lint roller.',
  'The grid has requested a rematch and a lawyer.',
  'You took the scenic route for approximately zero seconds.',
  'The solution was already halfway out the door.',
  'Quick solve. Please allow the squares time to recover.',
];
const GRIT = [
  'You stayed with it. That is the actual skill.',
  'A few detours, same destination. Nicely done.',
  'Persistence: undefeated. Grid: completed.',
  'Hints are tools, not a character flaw. You got it.',
  'You worked through the tricky bit. That counts.',
  'Progress is progress, even when the brain buffers.',
  'You adjusted, tried again, and solved it. Solid.',
  'Not effortless. Still yours. That is a win.',
  'The route got weird; you got there anyway.',
  'A puzzle solved is a puzzle solved. Case closed.',
  'Your first idea did not need to be your last idea.',
  'You made a plan, revised the plan, beat the plan.',
  'Plot twist: persistence worked.',
  'The grid tested you. You kept thinking.',
  'That took some patience. You brought enough.',
  'A proper little comeback arc for those squares.',
  'You used the tools available and finished strong.',
  'A detour is just the solution with extra lore.',
  'You kept experimenting until it clicked.',
  'Not every win is a speedrun. This one is still a win.',
];

export function getAchievementMessage({ score = 60, hints = 0, resets = 0, backtracks = 0, random = Math.random } = {}) {
  const pool = score >= 82 && hints === 0 && resets === 0 && backtracks < 4
    ? QUICK
    : score < 42 || hints > 0 || resets > 0 || backtracks >= 4
      ? GRIT
      : STEADY;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index];
}

export const ACHIEVEMENT_MESSAGE_COUNT = STEADY.length + QUICK.length + GRIT.length;

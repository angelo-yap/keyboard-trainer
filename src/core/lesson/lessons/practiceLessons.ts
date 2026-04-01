export type PracticeLesson = {
  id: number;
  name: string;
  keys: string[];
  fingers: number[];
  desc: string;
  hint: string;
  text: string;
};

export const PRACTICE_LESSONS: PracticeLesson[] = [
  { id: 1, name: "Home Row Left", keys: ["a", "s", "d", "f"], fingers: [0, 1, 2, 3], desc: "Place left hand on A S D F — this is home base.", hint: "Keep fingers curved, wrists floating. Never look down.", text: "asd fad dad sad add ask ads lass fads flask falls dads adds asks salsa" },
  { id: 2, name: "Home Row Right", keys: ["j", "k", "l", ";"], fingers: [4, 5, 6, 7], desc: "Right hand on J K L ; — mirror your left.", hint: "Index on J, middle on K, ring on L, pinky on ;", text: "jkl; jkl lll kkk jjj lark jell kill loll skill flask skull krill jalks" },
  { id: 3, name: "Full Home Row", keys: ["a", "s", "d", "f", "j", "k", "l", ";"], fingers: [0, 1, 2, 3, 4, 5, 6, 7], desc: "Both hands together on the home row.", hint: "Space bar with right thumb. Return fingers after each keystroke.", text: "as ask fall add skill flask dad jell lads kills fads dark lake flash glad" },
  { id: 4, name: "E and I", keys: ["e", "i"], fingers: [2, 5], desc: "Middle fingers reach up to E and I.", hint: "Reach with middle finger only — don't move your whole hand.", text: "idle file aide idea like silk else fleet insideaille diesel inside kite" },
  { id: 5, name: "T and N", keys: ["t", "n"], fingers: [3, 4], desc: "Both index fingers reach up. T is left, N is right.", hint: "Index fingers are your strongest — these should feel natural.", text: "tan tent intend dent nit tin indent finalist intent tenantantine tinsel" },
  { id: 6, name: "O and R", keys: ["o", "r"], fingers: [6, 3], desc: "Ring finger up for O, left index stretches to R.", hint: "Don't curl your whole hand when reaching for R.", text: "road roar forest order for floor door rod role rotate origin roller road" },
  { id: 7, name: "H and C", keys: ["h", "c"], fingers: [4, 2], desc: "Right index down to H, left middle down to C.", hint: "Small downward reach. Anchor on home row before pressing.", text: "each chair check ranch hatch coach church child chord ache cache chance" },
  { id: 8, name: "U and M", keys: ["u", "m"], fingers: [4, 5], desc: "Right index up to U, right middle down to M.", hint: "Two different directions for the same hand — take it slow.", text: "must sum mud drum autumn slum museum murmur immune minute mutual autumn" },
  { id: 9, name: "W B V", keys: ["w", "b", "v"], fingers: [1, 3, 3], desc: "Left hand expansion — ring up, index stretches both ways.", hint: "B and V both use left index. Practice alternating between them.", text: "wave brave above verb vibrant bowl web vivid brave wave vibrate verbose" },
  { id: 10, name: "P G Y", keys: ["p", "g", "y"], fingers: [7, 3, 4], desc: "Pinky reaches for P, left index for G, right index for Y.", hint: "Pinky on P is a big stretch — practice slowly.", text: "page grape grip plug gap gaping peg plug page gray play yogurt yell glory" },
  { id: 11, name: "Q X Z", keys: ["q", "x", "z"], fingers: [0, 1, 0], desc: "Bottom row left — pinky and ring finger reach down.", hint: "These are rare letters. Keep wrist stable on the reach.", text: "quiz exact zero fox taxi exact quartz oxide axle maze zinc query pixie" },
  { id: 12, name: "All Letters", keys: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"], fingers: [0, 3, 2, 2, 2, 3, 3, 4, 5, 4, 5, 6, 5, 4, 6, 7, 0, 3, 1, 3, 4, 3, 1, 1, 4, 0], desc: "The full alphabet. Combine everything you've learned.", hint: "Speed comes after accuracy. Focus on correct fingers first.", text: "the quick brown fox jumps over the lazy dog pack my box with five dozen liquor jugs" },
];

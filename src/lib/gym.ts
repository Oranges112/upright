import type { Anim, FrontPose, Key, SidePose } from "./gymAnim";

export type GymGroup = "back" | "neck" | "mobility" | "core";

export const GROUPS: Record<GymGroup, { name: string; emoji: string }> = {
  back: { name: "Upper back", emoji: "💪" },
  neck: { name: "Neck", emoji: "🦒" },
  mobility: { name: "Stretch & mobility", emoji: "🧘" },
  core: { name: "Core & hips", emoji: "🔥" },
};

export interface GymExercise {
  id: string;
  name: string;
  tagline: string;
  group: GymGroup;
  equipment: string;
  targets: string;
  /** default prescription */
  sets: number;
  reps: string;
  /** seconds per set for timed holds (stretches, holds) */
  hold?: number;
  perSide?: boolean;
  rest: number;
  steps: string[];
  /** one short cue shown while you work */
  cue: string;
  why: string;
  feel: string;
  tips: string[];
  mistakes: string[];
  easier: string;
  harder: string;
  anim: Anim;
}

const side = (keys: Key<SidePose>[]) => keys;
const front = (keys: Key<FrontPose>[]) => keys;

/* Shared bodies (see gymAnim.ts for the angle conventions). */
const INCLINE = { x: 82, y: 128, t: 55, foot: [24, 178] as [number, number], foot2: [32, 178] as [number, number], kd: 1 };
const ON_BACK = { x: 150, y: 166, t: -90 };

export const GYM: Record<string, GymExercise> = {
  "seated-row": {
    id: "seated-row",
    name: "Seated Cable Row",
    tagline: "The backbone of a posture workout",
    group: "back",
    equipment: "Cable row machine (or a resistance band)",
    targets: "Mid back: rhomboids, mid traps, lats",
    sets: 3,
    reps: "10–12",
    rest: 75,
    steps: [
      "Sit tall with your feet on the plate and knees slightly bent. Grab the handle.",
      "Start with your arms long and your shoulder blades gently reaching forward.",
      "Pull the handle to your belly button. Lead with your elbows and keep them close to your sides.",
      "Squeeze your shoulder blades together and pause for 1 second.",
      "Let the weight pull your arms long again, slowly, over about 2 seconds.",
    ],
    cue: "Chest up, elbows back, squeeze and pause.",
    why: "Years of sitting and phone use leave the muscles between your shoulder blades long and weak, so your shoulders drift forward. Rowing strengthens exactly those muscles, which is what lets your shoulders sit back on their own without you thinking about it.",
    feel: "Between and around your shoulder blades. Not your lower back, not your biceps.",
    tips: [
      "Pause 1 second with your shoulder blades squeezed. The pause is where most of the posture benefit comes from.",
      "Keep your chest proud and chin slightly tucked the whole time.",
      "Pick a weight you can control for every rep. If you need to swing, it's too heavy.",
      "Think 'elbows to back pockets', not 'hands to chest'.",
    ],
    mistakes: [
      "Rocking your whole body back and forth to move the weight.",
      "Shrugging your shoulders up toward your ears as you pull.",
      "Poking your head forward at the end of the pull.",
      "Rounding your lower back when your arms go long.",
    ],
    easier: "Use a light weight or a resistance band looped around a post or your feet.",
    harder: "Add weight slowly, or do it one arm at a time to fix side-to-side imbalance.",
    anim: {
      view: "side",
      scene: "row",
      keys: side([
        { label: "Arms long", move: 1.4, hold: 0.4, pose: { x: 90, y: 136, t: 8, foot: [165, 150], kd: 1, hand: [158, 96], ed: -1 } },
        { label: "Pull & squeeze", move: 1.1, hold: 0.8, pose: { x: 90, y: 136, t: -4, foot: [165, 150], kd: 1, hand: [98, 108], ed: -1 } },
      ]),
    },
  },

  "face-pull": {
    id: "face-pull",
    name: "Face Pulls",
    tagline: "The best single exercise for rounded shoulders",
    group: "back",
    equipment: "Cable machine with a rope (or a band)",
    targets: "Rear shoulders, mid traps, rotator cuff",
    sets: 3,
    reps: "15",
    rest: 60,
    steps: [
      "Set the cable at about eye level with a rope attachment. Hold the ends with thumbs pointing back toward you.",
      "Step back until your arms are straight and stand tall, with a slight lean back.",
      "Pull the rope toward your face. Elbows go high and wide, hands finish beside your ears.",
      "At the end, rotate so your knuckles point to the ceiling (like a 'double biceps' pose). Hold 1 second.",
      "Return slowly.",
    ],
    cue: "Elbows high, hands to your ears, hold.",
    why: "Forward head posture usually comes with shoulders that roll inward. Face pulls train the small muscles at the back of the shoulder that rotate it outward and pull it back. Physios and coaches use them as a staple fix for desk posture.",
    feel: "The back of your shoulders and between your shoulder blades.",
    tips: [
      "Go light. This is a precision exercise, not a strength test.",
      "Keep your ribs down and don't lean back more as you get tired.",
      "Pull the rope apart as you bring it in, so your hands end wider than your face.",
      "Slow 2-second return every rep.",
    ],
    mistakes: [
      "Using so much weight that you lean back and yank it with your body.",
      "Letting your elbows drop low, which turns it into a row.",
      "Shrugging your shoulders up.",
      "Pushing your head forward to meet the rope.",
    ],
    easier: "Use a resistance band tied to a door or pole at face height.",
    harder: "Add a 2-second hold at the end of every rep instead of adding weight.",
    anim: {
      view: "side",
      scene: "face-pull",
      keys: side([
        { label: "Arms long", move: 1.3, hold: 0.3, pose: { x: 96, y: 98, t: -3, foot: [104, 178], foot2: [84, 178], s: 112, e: 0, ua: 1 } },
        { label: "Pull to ears", move: 1.0, hold: 0.9, pose: { x: 96, y: 98, t: -3, foot: [104, 178], foot2: [84, 178], s: 107, e: 90, ua: 0.45 } },
      ]),
    },
  },

  "chest-row": {
    id: "chest-row",
    name: "Chest-Supported Row",
    tagline: "Rowing with zero lower-back cheating",
    group: "back",
    equipment: "Incline bench (about 30–45°) and two dumbbells",
    targets: "Mid back, rear shoulders",
    sets: 3,
    reps: "10",
    rest: 75,
    steps: [
      "Set a bench to a low incline. Lie face down with your chest on the pad and feet on the floor.",
      "Let the dumbbells hang straight down with your arms long.",
      "Row both dumbbells up toward your hips, driving your elbows to the ceiling.",
      "Squeeze your shoulder blades together at the top for 1 second.",
      "Lower slowly until your arms are long again.",
    ],
    cue: "Chest stays on the pad. Elbows to the ceiling.",
    why: "With your chest on the bench, you can't swing or use your lower back, so every rep goes to the upper-back muscles that hold your shoulders back. It's one of the most direct ways to build them.",
    feel: "Between your shoulder blades and the back of your shoulders.",
    tips: [
      "Keep your chin tucked and your neck in line with your back. Look at the floor, not the mirror.",
      "Keep your chest glued to the pad the whole time.",
      "Let your shoulder blades spread at the bottom, then squeeze them together at the top.",
    ],
    mistakes: [
      "Lifting your chest off the pad to heave the weight.",
      "Cranking your head up to look forward.",
      "Rushing the lowering part.",
    ],
    easier: "Use lighter dumbbells, or do it one arm at a time.",
    harder: "Hold the top for 2–3 seconds on every rep.",
    anim: {
      view: "side",
      scene: "incline-db",
      keys: side([
        { label: "Arms long", move: 1.3, hold: 0.4, pose: { ...INCLINE, hand: [125, 155], ed: -1 } },
        { label: "Row & squeeze", move: 1.0, hold: 0.7, pose: { ...INCLINE, hand: [100, 136], ed: -1 } },
      ]),
    },
  },

  "lat-pulldown": {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    tagline: "Strong back, shoulders down and away from your ears",
    group: "back",
    equipment: "Lat pulldown machine (or a band over a door)",
    targets: "Lats, lower traps",
    sets: 3,
    reps: "10",
    rest: 75,
    steps: [
      "Sit with your thighs snug under the pads and take the bar a little wider than shoulder width.",
      "Lean back slightly and lift your chest.",
      "Start by pulling your shoulders down away from your ears, then pull the bar to your upper chest.",
      "Squeeze briefly with your elbows pointing down at the floor.",
      "Let the bar rise slowly until your arms are straight.",
    ],
    cue: "Shoulders down first, then pull to your chest.",
    why: "Tight, overworked upper traps pull your shoulders up and forward. The lats and lower traps pull them down and back. Training them balances out the shrugged, tense look many desk workers have.",
    feel: "The sides of your back, below your armpits.",
    tips: [
      "Pull to your upper chest, never behind your neck.",
      "Keep your chin tucked. Don't push your face toward the bar.",
      "Control the way up. It shouldn't yank you.",
    ],
    mistakes: [
      "Pulling the bar behind your head.",
      "Leaning far back and turning it into a row.",
      "Shrugging up at the top of each rep.",
      "Jutting your chin forward as the bar comes down.",
    ],
    easier: "Use less weight, or do a band pulldown kneeling.",
    harder: "Assisted or full pull-ups.",
    anim: {
      view: "side",
      scene: "pulldown",
      keys: side([
        { label: "Arms up", move: 1.4, hold: 0.3, pose: { x: 95, y: 128, t: -10, foot: [138, 178], kd: 1, hand: [97, 21], ed: -1 } },
        { label: "Pull to chest", move: 1.0, hold: 0.6, pose: { x: 95, y: 128, t: -10, foot: [138, 178], kd: 1, hand: [101, 80], ed: -1 } },
      ]),
    },
  },

  "pull-apart": {
    id: "pull-apart",
    name: "Band Pull-Apart",
    tagline: "Rear shoulders, anywhere",
    group: "back",
    equipment: "Light resistance band",
    targets: "Rear shoulders, mid traps",
    sets: 3,
    reps: "15",
    rest: 45,
    steps: [
      "Stand tall holding a band in front of you at shoulder height, hands shoulder-width apart, arms straight.",
      "Pull the band apart by moving your hands out to your sides.",
      "Finish with the band touching your chest and your shoulder blades squeezed together.",
      "Return slowly. Don't let the band snap back.",
    ],
    cue: "Wide and slow. Squeeze at the end.",
    why: "It's the same job as a reverse fly: training the muscles that pull your shoulders back. It's easy enough to do daily, even at home or at the office, and makes a great warm-up before rows.",
    feel: "The back of your shoulders and between your shoulder blades.",
    tips: [
      "Keep your arms almost straight, with a soft elbow.",
      "Keep your ribs down. Don't arch your lower back to finish.",
      "A lighter band done slowly beats a heavy one done fast.",
    ],
    mistakes: [
      "Shrugging your shoulders up.",
      "Bending your elbows a lot, which turns it into a row.",
      "Poking your head forward.",
    ],
    easier: "Use a lighter band or hold it wider.",
    harder: "Use a stronger band, hold it narrower, or hold 2 seconds at the end.",
    anim: {
      view: "front",
      scene: "band",
      keys: front([
        { label: "Arms forward", move: 1.2, hold: 0.3, pose: { la: 38, ra: 38, f: 0.3, le: 0, re: 0 } },
        { label: "Pull apart", move: 1.0, hold: 0.8, pose: { la: 86, ra: 86, f: 1, le: 4, re: 4 } },
      ]),
    },
  },

  "y-raise": {
    id: "y-raise",
    name: "Incline Y-Raise",
    tagline: "Lower traps: the forgotten posture muscle",
    group: "back",
    equipment: "Incline bench and very light dumbbells (1–4 kg)",
    targets: "Lower traps, rear shoulders",
    sets: 2,
    reps: "12",
    rest: 60,
    steps: [
      "Lie face down on an incline bench with light dumbbells, arms hanging, thumbs pointing up.",
      "Raise your arms up and forward into a 'Y' shape, in line with your body.",
      "Lift only as high as you can without shrugging. Pause for 1 second.",
      "Lower slowly.",
    ],
    cue: "Thumbs up, arms in a Y, shoulders down.",
    why: "The lower traps pull your shoulder blades down and flat against your ribcage. They're often the weakest link in rounded shoulders, and most gym programmes never train them directly.",
    feel: "Low between your shoulder blades. Not on the top of your shoulders.",
    tips: [
      "Use far less weight than you think. Even an empty hand works at first.",
      "Keep your neck long and look at the floor.",
      "If you feel it in your neck, lower the weight and the height.",
    ],
    mistakes: ["Shrugging up toward your ears.", "Swinging the weights.", "Lifting your head to look forward."],
    easier: "Do it with no weight, or lying face down on the floor.",
    harder: "Add a 3-second hold at the top.",
    anim: {
      view: "side",
      scene: "incline-db-light",
      keys: side([
        { label: "Arms hanging", move: 1.5, hold: 0.3, pose: { ...INCLINE, s: 55, e: 0 } },
        { label: "Raise to a Y", move: 1.2, hold: 1.0, pose: { ...INCLINE, s: 172, e: 0 } },
      ]),
    },
  },

  "head-lift": {
    id: "head-lift",
    name: "Chin-Tuck Head Lift",
    tagline: "Strength for the muscles that hold your head back",
    group: "neck",
    equipment: "Bench or mat",
    targets: "Deep neck flexors",
    sets: 3,
    reps: "8 × 5–10 s hold",
    rest: 45,
    steps: [
      "Lie on your back on a bench or mat, knees bent.",
      "Gently tuck your chin, like making a double chin, and keep it tucked.",
      "Lift your head 2–3 cm off the surface, nothing more.",
      "Hold 5–10 seconds while you breathe, then lower slowly.",
    ],
    cue: "Tuck first, then a tiny lift. Breathe.",
    why: "The deep neck flexors are small muscles at the front of your neck that hold your head back over your shoulders. In forward head posture they're weak and the big muscles take over. This is the gym version of the chin tuck, working against gravity, so it builds them faster.",
    feel: "Deep at the front of your neck, under your chin. Not big strain in the sides of your neck.",
    tips: [
      "Keep the tuck the whole time. If your chin pokes up, the hold is over.",
      "Start with 5-second holds and build to 10.",
      "Keep your jaw and tongue relaxed.",
    ],
    mistakes: [
      "Lifting your head high instead of tucking (that's a crunch for your neck).",
      "Holding your breath.",
      "Letting your chin jut toward the ceiling as you tire.",
    ],
    easier: "Just do the tuck with your head resting, without lifting.",
    harder: "Longer holds, up to 20–30 seconds.",
    anim: {
      view: "side",
      scene: "mat",
      keys: side([
        { label: "Rest", move: 1.2, hold: 0.8, pose: { ...ON_BACK, n: 0, s: 0, e: 0, foot: [198, 178], kd: 1 } },
        { label: "Tuck & lift", move: 1.0, hold: 2.5, pose: { ...ON_BACK, n: 22, s: 0, e: 0, foot: [198, 178], kd: 1 } },
      ]),
    },
  },

  "chest-stretch": {
    id: "chest-stretch",
    name: "Doorway Chest Stretch",
    tagline: "Undo the hunch",
    group: "mobility",
    equipment: "A doorway, rack or cable station upright",
    targets: "Chest (pecs), front of the shoulders",
    sets: 2,
    reps: "30 s",
    hold: 30,
    perSide: true,
    rest: 15,
    steps: [
      "Put your forearm on a door frame or upright, elbow at shoulder height and bent to 90°.",
      "Step forward with the same-side foot until you feel a stretch across your chest.",
      "Keep your chest up and chin tucked. Breathe slowly for 30 seconds.",
      "Switch sides.",
    ],
    cue: "Step through gently. Breathe into your chest.",
    why: "When your shoulders round forward for hours, your chest muscles shorten and pull them further forward. Stretching them lets your shoulders settle back so the strength work can hold them there.",
    feel: "Across your chest and the front of your shoulder. Never a pinch in the shoulder joint, and no tingling in your arm.",
    tips: [
      "Try the elbow a little higher or lower to stretch different parts of the chest.",
      "Breathe out slowly and let the stretch deepen.",
      "Do it after your workout, and at your desk breaks too.",
    ],
    mistakes: [
      "Leaning so hard you feel it in the front of the shoulder joint.",
      "Arching your lower back instead of stepping through.",
      "Holding your breath.",
    ],
    easier: "Put your hand lower on the frame and step less.",
    harder: "Hold longer (up to 45 seconds), or use both arms in a doorway.",
    anim: {
      view: "side",
      scene: "door",
      keys: side([
        { label: "Arm on frame", move: 1.2, hold: 0.6, pose: { x: 98, y: 98, t: 0, foot: [100, 178], foot2: [94, 178], kd: 1, hand: [80, 22], ed: 1, ua: 0.45, s2: 0, e2: 12, ua2: 1 } },
        { label: "Step through", move: 1.6, hold: 2.6, pose: { x: 112, y: 100, t: 4, foot: [128, 178], foot2: [94, 178], kd: 1, hand: [80, 22], ed: 1, ua: 0.8, s2: 0, e2: 12, ua2: 1 } },
      ]),
    },
  },

  "foam-roller": {
    id: "foam-roller",
    name: "Foam Roller Back Extension",
    tagline: "Open up a stiff upper back",
    group: "mobility",
    equipment: "Foam roller",
    targets: "Upper back (thoracic spine)",
    sets: 1,
    reps: "60 s",
    hold: 60,
    rest: 15,
    steps: [
      "Lie on your back with a foam roller across your upper back, under your shoulder blades. Knees bent, feet flat.",
      "Support your head with your hands, elbows pointing up.",
      "Keep your hips down and gently arch your upper back over the roller. Breathe out.",
      "Come back up, move the roller a few centimetres, and repeat.",
    ],
    cue: "Hips down. Arch over the roller. Breathe out.",
    why: "A stiff, rounded upper back pushes your head forward: if the base is bent, the top has to tip forward to look straight ahead. Getting movement back into the upper back makes an upright head position much easier to hold.",
    feel: "A gentle stretch and opening through your upper back and chest.",
    tips: [
      "Stay on your upper back. Don't roll your lower back or neck this way.",
      "Small movements, slow breaths.",
      "Great as a warm-up before rows and face pulls.",
    ],
    mistakes: [
      "Lifting your hips and arching your lower back instead.",
      "Pulling on your head with your hands.",
      "Rolling fast over the spine.",
    ],
    easier: "Use a rolled-up towel instead of a roller.",
    harder: "Arms reaching overhead as you arch.",
    anim: {
      view: "side",
      scene: "roller",
      keys: side([
        { label: "Rest on roller", move: 1.4, hold: 0.5, pose: { x: 165, y: 166, t: -72.8, b: 0, n: 0, hand: "head", ed: -1, foot: [212, 178], kd: 1 } },
        { label: "Arch over", move: 1.6, hold: 2.0, pose: { x: 165, y: 166, t: -72.8, b: -25, n: 0, hand: "head", ed: -1, foot: [212, 178], kd: 1 } },
      ]),
    },
  },

  "glute-bridge": {
    id: "glute-bridge",
    name: "Glute Bridge / Hip Thrust",
    tagline: "Fix the lower half of your posture",
    group: "core",
    equipment: "Mat (or bench + barbell for hip thrusts)",
    targets: "Glutes, hamstrings",
    sets: 3,
    reps: "12",
    rest: 60,
    steps: [
      "Lie on your back with your knees bent and feet flat, hip-width apart.",
      "Gently flatten your lower back by tucking your tailbone a little.",
      "Push through your heels and lift your hips until your body is a straight line from knees to shoulders.",
      "Squeeze your glutes hard at the top for 1–2 seconds.",
      "Lower slowly.",
    ],
    cue: "Push through your heels. Squeeze at the top.",
    why: "Sitting all day switches off your glutes and tightens your hip flexors. That tips your pelvis forward, arches your lower back and pushes your belly out. The upper body then compensates with a rounded back and forward head. Strong glutes help level the pelvis, which is the base your whole spine stacks on.",
    feel: "Your glutes (bum). Not your lower back. If you feel your hamstrings cramping, bring your feet closer.",
    tips: [
      "Ribs down at the top. Your lower back shouldn't arch.",
      "Pause at the top. That squeeze is the exercise.",
      "Once 15 easy reps feel easy, move to hip thrusts with a weight.",
    ],
    mistakes: ["Over-arching your lower back at the top.", "Pushing through your toes.", "Dropping down fast."],
    easier: "Smaller lift, or both feet on the floor with arms flat for balance.",
    harder: "Single-leg bridge, or barbell hip thrust with your shoulders on a bench.",
    anim: {
      view: "side",
      scene: "mat",
      keys: side([
        { label: "Down", move: 1.2, hold: 0.5, pose: { ...ON_BACK, n: 0, hand: [150, 177], ed: -1, foot: [190, 178], kd: 1 } },
        { label: "Squeeze up", move: 1.0, hold: 1.5, pose: { x: 135.8, y: 128, t: -130.9, n: 40.9, hand: [150, 177], ed: -1, foot: [190, 178], kd: 1 } },
      ]),
    },
  },

  "dead-bug": {
    id: "dead-bug",
    name: "Dead Bug",
    tagline: "Core control without loading your neck",
    group: "core",
    equipment: "Mat",
    targets: "Deep core (abs that support your spine)",
    sets: 3,
    reps: "8 per side",
    perSide: false,
    rest: 45,
    steps: [
      "Lie on your back with your arms pointing at the ceiling and knees bent at 90° above your hips.",
      "Press your lower back gently into the floor and keep it there.",
      "Slowly reach one arm overhead while straightening the opposite leg, hovering just above the floor.",
      "Come back to the start and switch sides.",
    ],
    cue: "Lower back stays down. Slow and controlled.",
    why: "A weak core lets your pelvis tip and your lower back sway, which the upper back and neck then make up for. The dead bug trains your core to keep your spine steady while your limbs move, with zero strain on your neck (unlike crunches).",
    feel: "Your deep abs working to keep your lower back flat.",
    tips: [
      "Breathe out as you reach.",
      "Only lower your arm and leg as far as you can while your lower back stays flat.",
      "Slower is harder and better.",
    ],
    mistakes: ["Your lower back arching off the floor.", "Rushing.", "Lifting your head and straining your neck."],
    easier: "Move only the legs, one at a time, with a bent knee.",
    harder: "Hold a light weight in your hands, or pause 3 seconds at full reach.",
    anim: {
      view: "side",
      scene: "mat",
      keys: side([
        { label: "Tabletop", move: 1.4, hold: 0.4, pose: { ...ON_BACK, s: 90, e: 0, s2: 90, e2: 0, h: 90, k: 90, h2: 90, k2: 90 } },
        { label: "Reach & extend", move: 1.4, hold: 0.8, pose: { ...ON_BACK, s: 165, e: 0, s2: 90, e2: 0, h: 90, k: 90, h2: 10, k2: 0 } },
        { label: "Tabletop", move: 1.4, hold: 0.4, pose: { ...ON_BACK, s: 90, e: 0, s2: 90, e2: 0, h: 90, k: 90, h2: 90, k2: 90 } },
        { label: "Other side", move: 1.4, hold: 0.8, pose: { ...ON_BACK, s: 90, e: 0, s2: 165, e2: 0, h: 10, k: 0, h2: 90, k2: 90 } },
      ]),
    },
  },

  "hip-flexor": {
    id: "hip-flexor",
    name: "Kneeling Hip Flexor Stretch",
    tagline: "Undo hours of sitting",
    group: "mobility",
    equipment: "Mat or a folded towel under your knee",
    targets: "Hip flexors (front of the hip)",
    sets: 2,
    reps: "30 s",
    hold: 30,
    perSide: true,
    rest: 15,
    steps: [
      "Kneel on one knee with the other foot flat in front of you (half-kneeling).",
      "Stand tall and tuck your tailbone under, as if zipping up tight jeans.",
      "Gently shift your hips forward until you feel a stretch at the front of the back hip.",
      "Hold 30 seconds, breathing slowly, then switch sides.",
    ],
    cue: "Tuck your tailbone, then shift forward.",
    why: "Your hip flexors sit shortened whenever you sit. When they're tight they tip your pelvis forward, creating the arched lower back and pushed-out belly common in desk workers, which the upper back and neck then compensate for.",
    feel: "Front of the hip and top of the thigh on the kneeling side. Not in the lower back.",
    tips: [
      "The tailbone tuck matters more than how far you lean.",
      "Squeeze the glute of the kneeling leg to deepen it.",
      "Reach the same-side arm overhead for an extra stretch.",
    ],
    mistakes: [
      "Arching your lower back and leaning forward (no stretch, just a sway).",
      "Letting the front knee cave inward.",
      "Kneeling on a hard floor with no padding.",
    ],
    easier: "Smaller shift forward, holding onto something for balance.",
    harder: "Reach the arm overhead and lean slightly away from the kneeling side.",
    anim: {
      view: "side",
      scene: "kneel",
      keys: side([
        { label: "Kneel tall", move: 1.2, hold: 0.6, pose: { x: 98, y: 136, t: 0, h: 0, k: 90, ft: -90, foot2: [142, 178], kd2: 1, hand: "hip", ed: -1 } },
        { label: "Tuck & shift forward", move: 1.6, hold: 2.6, pose: { x: 118, y: 141.4, t: -2, h: -32, k: 60, ft: -90, foot2: [142, 178], kd2: 1, hand: "hip", ed: -1 } },
      ]),
    },
  },
};

/* ---------------- workout plans ---------------- */

export interface PlanItem {
  id: string;
  sets?: number;
  reps?: string;
  rest?: number;
}

export interface GymPlan {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  minutes: number;
  gradient: [string, string];
  items: PlanItem[];
}

export const GYM_PLANS: GymPlan[] = [
  {
    id: "gym-a",
    name: "Posture A: Upper back",
    emoji: "💪",
    blurb: "Rows, face pulls and your deep neck muscles. The core posture session.",
    minutes: 35,
    gradient: ["#38bdf8", "#6366f1"],
    items: [
      { id: "foam-roller" },
      { id: "seated-row" },
      { id: "face-pull" },
      { id: "chest-row" },
      { id: "y-raise" },
      { id: "head-lift" },
      { id: "chest-stretch" },
    ],
  },
  {
    id: "gym-b",
    name: "Posture B: Back, core & hips",
    emoji: "🔥",
    blurb: "Pulldowns plus the core and hip work that fixes the lower half of your posture.",
    minutes: 35,
    gradient: ["#fb923c", "#f43f5e"],
    items: [
      { id: "pull-apart", sets: 2 },
      { id: "lat-pulldown" },
      { id: "face-pull" },
      { id: "glute-bridge" },
      { id: "dead-bug" },
      { id: "hip-flexor" },
      { id: "chest-stretch", sets: 1 },
    ],
  },
  {
    id: "gym-quick",
    name: "Quick 20",
    emoji: "⚡",
    blurb: "Short on time? The four moves that matter most.",
    minutes: 20,
    gradient: ["#34d399", "#14b8a6"],
    items: [{ id: "seated-row" }, { id: "face-pull" }, { id: "head-lift", sets: 2 }, { id: "chest-stretch", sets: 1 }],
  },
];

export function getPlan(id: string) {
  return GYM_PLANS.find((p) => p.id === id);
}

export function isGymPlan(id: string) {
  return id.startsWith("gym-");
}

/** Plan item with the exercise defaults filled in. */
export function planItem(it: PlanItem) {
  const ex = GYM[it.id];
  return { ex, sets: it.sets ?? ex.sets, reps: it.reps ?? ex.reps, rest: it.rest ?? ex.rest };
}

export function planSets(p: GymPlan) {
  return p.items.reduce((a, it) => a + planItem(it).sets, 0);
}

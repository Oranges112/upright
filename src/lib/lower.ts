/**
 * Desk exercises for the lower half: calves, hamstrings, hips, glutes and the lower back.
 *
 * Sitting for hours tightens the calves and hamstrings, shortens the hip flexors (the front of
 * the hip) and switches the glutes off. That tips the pelvis, loads the lower back, and the
 * upper back and neck end up compensating. These are drawn with the full-body figure
 * (see gymAnim.ts for the pose numbers).
 */
import type { SidePose } from "./gymAnim";
import type { Exercise } from "./types";
import type { Coaching } from "./coaching";

/** Sitting on a chair. `t` leans forward from the hips; the thighs stay level on the seat. */
function seat(t = 0, extra: Partial<SidePose> = {}): SidePose {
  return { x: 100, y: 138, t, h: 90 + t, k: 90, hand: [127, 134], ed: -1, ...extra };
}
/** Standing tall (legs stay vertical when the torso leans). */
function stand(t = 0, extra: Partial<SidePose> = {}): SidePose {
  return { x: 118, y: 98, t, h: t, k: 0, ...extra };
}
/** Standing at a desk with both hands on it. */
const DESK_HANDS = { hand: [146, 92] as [number, number], ed: -1 };

export const LOWER_EXERCISES: Record<string, Exercise> = {
  "ankle-pumps": {
    id: "ankle-pumps",
    name: "Ankle Pumps",
    tagline: "Get the blood moving in your calves",
    view: "side",
    body: { scene: "chair" },
    howTo: ["Sit tall with your feet a little in front of you.", "Pull your toes up toward your shins.", "Then point them down, like pressing a pedal. Keep it smooth."],
    cue: "Toes up, toes down. Nice and smooth.",
    sides: false,
    reps: 12,
    cycle: [
      { label: "Toes up", sec: 1.5, pose: {}, body: seat(0, { k: 65, ft: 160, ft2: 160 }) },
      { label: "Toes down", sec: 1.5, pose: {}, body: seat(0, { k: 65, ft: 50, ft2: 50 }) },
    ],
    discreet: true,
    targets: "Calves & ankles",
    areas: ["legs"],
  },
  "calf-raise": {
    id: "calf-raise",
    name: "Calf Raises",
    tagline: "Wake up the muscles that pump blood back up",
    view: "side",
    body: { scene: "desk" },
    howTo: ["Stand tall, hands resting on your desk for balance.", "Rise up onto the balls of your feet, as high as you can.", "Lower slowly until your heels touch down."],
    cue: "Up tall on your toes. Lower slowly.",
    sides: false,
    reps: 10,
    cycle: [
      { label: "Rise", sec: 1.5, pose: {}, body: stand(0, { y: 90, ft: 50, ft2: 50, ...DESK_HANDS }) },
      { label: "Down", sec: 1.5, pose: {}, body: stand(0, DESK_HANDS) },
    ],
    discreet: false,
    targets: "Calves",
    areas: ["legs"],
    easier: "ankle-pumps",
  },
  "calf-stretch": {
    id: "calf-stretch",
    name: "Desk Calf Stretch",
    tagline: "Loosen tight calves",
    view: "side",
    body: { scene: "desk" },
    howTo: [
      "Hands on your desk, step one foot back.",
      "Keep the back leg straight and press its heel into the floor.",
      "Bend the front knee and lean in until you feel the back calf stretch.",
    ],
    cue: "Back heel down. Lean in gently.",
    sides: true,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: {}, body: { x: 124, y: 108, t: 18, foot: [84, 178], kd: 1, foot2: [140, 178], kd2: 1, ...DESK_HANDS } }],
    discreet: false,
    targets: "Calves (gastrocnemius)",
    areas: ["legs"],
    easier: "ankle-pumps",
  },
  "seated-hamstring": {
    id: "seated-hamstring",
    name: "Seated Hamstring Stretch",
    tagline: "The back of your thigh, without standing up",
    view: "side",
    body: { scene: "chair" },
    howTo: [
      "Sit near the front of your chair.",
      "Straighten one leg out in front, heel on the floor, toes up.",
      "Sit tall, then lean forward from your hips (not your back) until you feel the back of the thigh.",
    ],
    cue: "Chest proud. Hinge from the hips.",
    sides: true,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: {}, body: { ...seat(30, { foot: [172, 176], kd: 1, hand: [150, 150] }), h2: 120, k2: 90 } }],
    discreet: true,
    targets: "Hamstrings",
    areas: ["legs", "lower-back"],
    easier: "ankle-pumps",
  },
  "standing-hip-flexor": {
    id: "standing-hip-flexor",
    name: "Standing Hip Flexor Stretch",
    tagline: "Undo hours of sitting",
    view: "side",
    body: { scene: "stand" },
    howTo: [
      "Stand in a split stance: one foot forward, one back.",
      "Tuck your tailbone under, like zipping up tight jeans.",
      "Shift your hips forward until you feel the front of the back hip stretch.",
    ],
    cue: "Tuck your tailbone, then shift forward.",
    sides: true,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: {}, body: { x: 124, y: 110, t: -4, hand: "hip", ed: -1, foot: [80, 178], kd: -1, foot2: [150, 178], kd2: 1 } }],
    discreet: false,
    targets: "Hip flexors (front of the hip)",
    areas: ["hips", "lower-back"],
    easier: "glute-squeeze",
  },
  "figure-4": {
    id: "figure-4",
    name: "Seated Figure-4",
    tagline: "Release tight hips and glutes",
    view: "side",
    body: { scene: "chair" },
    howTo: [
      "Sit tall and cross one ankle over the other knee.",
      "Let the crossed knee drop out to the side.",
      "Keeping your back long, lean forward a little until you feel it in the hip and buttock.",
    ],
    cue: "Long back. Lean, don't slump.",
    sides: true,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: {}, body: { ...seat(20, { foot: [134, 131], kd: 1, hand: [138, 124] }), h2: 110, k2: 90 } }],
    discreet: true,
    targets: "Glutes & deep hip muscles (piriformis)",
    areas: ["hips", "lower-back"],
    easier: "glute-squeeze",
  },
  "glute-squeeze": {
    id: "glute-squeeze",
    name: "Glute Squeezes",
    tagline: "Switch your glutes back on",
    view: "side",
    body: { scene: "chair" },
    howTo: ["Sit tall with both feet flat.", "Squeeze your buttocks together hard for a few seconds.", "Let go completely, then repeat."],
    cue: "Squeeze hard. Then let go.",
    sides: false,
    reps: 8,
    cycle: [
      { label: "Squeeze", sec: 3, pose: {}, body: seat(0, { y: 135 }) },
      { label: "Release", sec: 2, pose: {}, body: seat(0) },
    ],
    discreet: true,
    targets: "Glutes",
    areas: ["hips", "lower-back"],
  },
  "seated-pelvic-tilt": {
    id: "seated-pelvic-tilt",
    name: "Seated Pelvic Tilts",
    tagline: "Oil a stiff lower back",
    view: "side",
    body: { scene: "chair" },
    howTo: [
      "Sit near the front of your chair, hands on your thighs.",
      "Roll your pelvis forward to arch your lower back and lift your chest.",
      "Then roll it back to round your lower back. Move slowly between the two.",
    ],
    cue: "Slow waves through your lower back.",
    sides: false,
    reps: 6,
    cycle: [
      { label: "Arch", sec: 3, pose: {}, body: seat(-4, { b: -14, n: -8 }) },
      { label: "Round", sec: 3, pose: {}, body: seat(8, { b: 22, n: 18 }) },
    ],
    discreet: true,
    targets: "Lower back mobility",
    areas: ["lower-back", "hips"],
  },
  "standing-back-extension": {
    id: "standing-back-extension",
    name: "Standing Back Bend",
    tagline: "The opposite of sitting",
    view: "side",
    body: { scene: "stand" },
    howTo: ["Stand tall with your hands on your lower back.", "Gently lean back, pushing your hips a little forward.", "Come back up slowly. Only go as far as feels good."],
    cue: "Hands on your lower back. Lean back gently.",
    sides: false,
    reps: 4,
    cycle: [
      { label: "Lean back", sec: 3, pose: {}, body: stand(-14, { x: 122, b: -10, n: -6, hand: "hip", ed: -1 }) },
      { label: "Return", sec: 2, pose: {}, body: stand(0, { hand: "hip", ed: -1 }) },
    ],
    discreet: false,
    targets: "Lower back",
    areas: ["lower-back"],
    easier: "seated-pelvic-tilt",
  },
  "reach-up": {
    id: "reach-up",
    name: "Reach Up Tall",
    tagline: "Stretch out the whole front of your body",
    view: "side",
    body: { scene: "stand" },
    howTo: ["Stand up tall.", "Reach both arms up over your head, as high as you can.", "Breathe in deeply, then let your arms float down."],
    cue: "Reach for the ceiling. Big breath in.",
    sides: false,
    reps: 2,
    cycle: [
      { label: "Reach up", sec: 5, pose: {}, body: stand(0, { y: 96, s: 172, e: 4 }) },
      { label: "Release", sec: 2, pose: {}, body: stand(0) },
    ],
    discreet: false,
    targets: "Shoulders, chest & spine",
    areas: ["upper-back"],
  },
};

export const LOWER_KIND: Record<string, "strength" | "stretch" | "mobility"> = {
  "ankle-pumps": "mobility",
  "calf-raise": "strength",
  "calf-stretch": "stretch",
  "seated-hamstring": "stretch",
  "standing-hip-flexor": "stretch",
  "figure-4": "stretch",
  "glute-squeeze": "strength",
  "seated-pelvic-tilt": "mobility",
  "standing-back-extension": "mobility",
  "reach-up": "mobility",
};

export const LOWER_COACHING: Record<string, Coaching> = {
  "ankle-pumps": {
    why: "Sitting still lets blood pool in your lower legs, which is a big reason calves feel tight, heavy or achy by the afternoon. Your calf muscles are a pump: every contraction pushes blood back up toward your heart.",
    feel: "Your calves and shins working, and a little warmth in your lower legs.",
    tips: ["Move through the full range: all the way up, all the way down.", "Keep it smooth and steady, not jerky.", "Do these any time you've been sitting a while. Nobody will notice."],
    avoid: "Don't rush. Slow, full movements pump more blood than fast little twitches.",
  },
  "calf-raise": {
    why: "Strong, regularly used calves keep blood flowing and stop the tightness that builds up from sitting. Rising up also gets you off the chair, which is half the point.",
    feel: "The back of your lower legs working, especially at the top.",
    tips: ["Go as high as you can onto the balls of your feet.", "Lower slowly. The way down is where the strength is built.", "Keep your weight over your big toes, ankles straight."],
    avoid: "Don't bounce. Rise and lower under control.",
  },
  "calf-stretch": {
    why: "Calves tighten when your feet sit tucked under a chair for hours. Tight calves can pull on the knees and change how you stand, which travels all the way up your back.",
    feel: "A stretch in the middle of the calf of the straight back leg.",
    tips: ["Back heel stays pressed into the floor.", "Toes of both feet point straight ahead.", "Bend the back knee a little to move the stretch lower, toward your ankle."],
    avoid: "Don't let the back heel lift. If it lifts, the stretch is gone.",
  },
  "seated-hamstring": {
    why: "Hamstrings shorten when you sit with your knees bent all day. Tight hamstrings pull your pelvis under, flatten your lower back and make you slump, which pushes your head forward too.",
    feel: "Along the back of the thigh of the straight leg. Not behind the knee and not in your lower back.",
    tips: ["Lean from your hips, as if showing off your chest.", "Keep your back long. Rounding over doesn't stretch the hamstrings.", "A slight bend in the knee is fine if you feel it behind the knee."],
    avoid: "Don't round your back to reach further. Small and straight beats big and slumped.",
  },
  "standing-hip-flexor": {
    why: "Your hip flexors (front of the hip) sit shortened whenever you sit. Tight hip flexors tip your pelvis forward and pull on your lower back. This is the muscle group doctors most often blame for desk-worker back ache.",
    feel: "The front of the hip and top of the thigh of the back leg. Not in your lower back.",
    tips: ["The tailbone tuck matters more than how far you move.", "Squeeze the glute of the back leg to deepen it.", "Reach the same-side arm up overhead for a little extra."],
    avoid: "Don't arch your lower back and lean forward. That's a sway, not a stretch.",
  },
  "figure-4": {
    why: "Sitting squashes and tightens the deep hip muscles. When they're tight they can pull on your lower back and even press on the sciatic nerve. This loosens them without getting off your chair.",
    feel: "Deep in the buttock and outer hip of the crossed leg.",
    tips: ["Flex the foot of the crossed leg to protect your knee.", "Lean forward from your hips with a long back.", "Breathe out and let the hip relax a bit more each breath."],
    avoid: "Don't push down on the knee hard, and stop if your knee hurts.",
  },
  "glute-squeeze": {
    why: "Sitting all day switches your glutes off ('desk bum'). Weak glutes leave your lower back to hold you up, so it gets tired and sore. Squeezing them reminds them to work.",
    feel: "Both buttocks tightening. You'll rise very slightly in your seat.",
    tips: ["Squeeze as hard as you can, then let go completely.", "Keep your stomach and legs relaxed. Only the glutes work.", "Breathe normally while you squeeze."],
    avoid: "Don't hold your breath or clench your jaw.",
  },
  "seated-pelvic-tilt": {
    why: "Your lower back stiffens when it stays in one shape for hours. Rolling the pelvis forward and back moves every joint in the lower back gently, and teaches you where 'neutral' is.",
    feel: "Gentle movement in your lower back, and your stomach and back muscles taking turns.",
    tips: ["The movement starts at your pelvis, not your shoulders.", "Go slowly and only as far as is comfortable.", "Finish in the middle: that's how you want to sit."],
    avoid: "Don't force either end. It's a gentle wave, not a stretch.",
  },
  "standing-back-extension": {
    why: "Sitting bends you forward for hours. Leaning back gently does the opposite, relieving the discs and joints of the lower back. It's one of the most recommended moves for desk-related back ache.",
    feel: "A gentle arch through your lower back, and maybe a stretch across your stomach.",
    tips: ["Push your hips forward a little as you lean back.", "Keep your knees straight but not locked.", "Breathe out as you lean back."],
    avoid: "Don't drop your head back. Keep your eyes forward or slightly up.",
  },
  "reach-up": {
    why: "Hours hunched at a keyboard round your shoulders and squash your chest. Reaching up tall stretches the whole front of your body and lets your spine lengthen.",
    feel: "Along your sides, under your arms and through your chest.",
    tips: ["Reach for the ceiling with your fingertips.", "Take one big breath in while you're up there.", "Let your shoulders come down away from your ears as you lower."],
    avoid: "Don't arch your lower back to reach higher. Ribs stay down.",
  },
};

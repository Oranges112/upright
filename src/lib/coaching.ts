/**
 * Coaching for each exercise: why it helps, where you should feel it, the form tips that
 * make it actually work, and the most common mistake. Shown and spoken during a session.
 *
 * General guidance, not medical advice. Keep every stretch gentle (around 4/10) and pain-free.
 */
export interface Coaching {
  /** what it does for tech neck, in plain words */
  why: string;
  /** where you should feel it, so you know you're doing it right */
  feel: string;
  /** the form cues that matter most */
  tips: string[];
  /** the #1 mistake */
  avoid: string;
}

export const COACHING: Record<string, Coaching> = {
  "chin-tuck": {
    why: "Tech neck weakens the deep muscles at the front of your neck and overloads the ones at the back. Chin tucks retrain those deep stabilisers so your head naturally sits back over your shoulders.",
    feel: "A gentle stretch at the base of your skull, and light work at the front of your neck.",
    tips: [
      "Eyes stay level, like a laser pointing at the horizon.",
      "Glide straight back, like a drawer closing. Not down.",
      "Imagine a string lifting the crown of your head.",
      "Jaw loose, teeth slightly apart.",
      "Shoulders stay down and relaxed.",
    ],
    avoid: "Don't nod your chin down toward your chest. The head moves backward, not down.",
  },
  "side-tilt": {
    why: "Screen time keeps the muscles on the side of your neck short and tight. A slow, relaxed hold lets them lengthen and eases that tight band from your neck to your shoulder.",
    feel: "A stretch along the side of your neck, on the side opposite the tilt.",
    tips: [
      "Let the opposite shoulder sink toward the floor.",
      "Ear goes toward shoulder, not shoulder toward ear.",
      "Nose keeps pointing forward. Don't twist.",
      "Breathe out slowly and let the stretch deepen.",
      "Aim for a 4 out of 10 stretch, never pain.",
    ],
    avoid: "Don't hike the shoulder up to meet your ear.",
  },
  turn: {
    why: "Turning your head is usually the first movement to stiffen when you stare at one screen all day. Regular turns keep the joints moving freely.",
    feel: "Easy movement, with maybe a light stretch at the end of each turn.",
    tips: [
      "Chin stays level, as if your head is on a turntable.",
      "Turn your head, not your shoulders.",
      "Slow and smooth. No bouncing at the end.",
      "Breathe out as you turn.",
      "Only go as far as feels comfortable.",
    ],
    avoid: "Don't force the end of the turn or jerk your head.",
  },
  levator: {
    why: "The levator scapulae runs from your neck to your shoulder blade and causes that classic knot where neck meets shoulder. This angle reaches it better than a plain side tilt.",
    feel: "A stretch at the back and side of your neck, down toward the top of your shoulder blade.",
    tips: [
      "Turn about 45°, then look down toward your armpit.",
      "Keep the opposite shoulder down and relaxed.",
      "If you use your hand, let it rest. Don't pull.",
      "Stay sitting tall. Don't slump into it.",
      "Breathe slowly into the tight spot.",
    ],
    avoid: "Don't round your whole upper back to go lower.",
  },
  "upper-trap": {
    why: "Your upper traps tense up all day to hold a forward head and raised shoulders. A gentle assisted stretch helps them switch off, easing shoulder tension and tension headaches.",
    feel: "A stretch from the side of your neck across the top of your shoulder.",
    tips: [
      "The weight of your hand is enough. It's not a pull.",
      "Opposite shoulder heavy, reaching for the floor.",
      "Face forward, ear toward shoulder.",
      "Relax your jaw.",
      "When the hold ends, come up slowly.",
    ],
    avoid: "Never yank your head with your hand.",
  },
  nod: {
    why: "Holding your head still for hours stiffens the neck joints. Slow nods move them through their full range and break up the frozen screen stare.",
    feel: "Smooth, easy movement, with a light stretch at the front looking up and at the back looking down.",
    tips: [
      "Slow: about 3 seconds each way.",
      "Keep your mouth closed when you look up.",
      "Shoulders stay still and relaxed.",
      "Stay in a pain-free range.",
      "Breathe in looking up, out looking down.",
    ],
    avoid: "Don't tip your head far back if it makes you dizzy.",
  },
  squeeze: {
    why: "Rounded shoulders happen when weak upper-back muscles lose to a tight chest. Squeezing your shoulder blades strengthens the muscles that hold your shoulders back, which takes load off your neck.",
    feel: "Muscle work between your shoulder blades.",
    tips: [
      "Back and DOWN, like sliding your blades into your back pockets.",
      "Keep your neck long, chin gently tucked.",
      "Don't arch your lower back to cheat.",
      "Hold the squeeze for the whole count.",
      "Relax fully between reps.",
    ],
    avoid: "Don't shrug your shoulders up toward your ears.",
  },
  rolls: {
    why: "Shoulder rolls get blood flowing through tight shoulder and neck muscles and remind them to let go after sitting still.",
    feel: "Loosening and warmth around your shoulders.",
    tips: [
      "Make the circles as big as you can.",
      "Put the effort into the back-and-down part.",
      "Arms stay heavy and relaxed.",
      "Keep your head still and tall.",
      "Breathe steadily.",
    ],
    avoid: "Don't rush. Slow circles do more than fast ones.",
  },
  "chest-opener": {
    why: "Sitting hunched shortens your chest muscles, which pull your shoulders and head forward. Opening your chest restores that length, so sitting tall takes less effort.",
    feel: "A stretch across the front of your chest and shoulders.",
    tips: [
      "Lift your chest toward the ceiling.",
      "Chin gently tucked, not poking forward.",
      "Ribs down. Don't arch your lower back.",
      "Breathe deep into your chest.",
      "Shoulders back and down.",
    ],
    avoid: "Don't let your head jut forward as your chest opens.",
  },
  "w-to-y": {
    why: "The lower traps pull your shoulder blades down and back, and they're usually the weakest link in tech neck. Strengthening them gives the longest-lasting posture improvement.",
    feel: "Work between and below your shoulder blades.",
    tips: [
      "Squeeze your shoulder blades together before you lift.",
      "Lift from your back, not your neck.",
      "Ribs down, chin tucked.",
      "Keep your arms slightly behind your body.",
      "Lower slowly, with control.",
    ],
    avoid: "Don't shrug toward your ears as you reach up.",
  },
  thoracic: {
    why: "A stiff, rounded upper back forces your neck to bend further to see the screen. Opening up your upper back means your neck doesn't have to compensate.",
    feel: "Opening and gentle pressure across your upper back.",
    tips: [
      "Bend back over the chair at your upper back, not your lower back.",
      "Support your head with your hands, elbows wide.",
      "Breathe in as you lean back.",
      "Keep your bottom on the seat.",
      "Return to upright slowly.",
    ],
    avoid: "Don't crank your neck back. Let your upper back do the work.",
  },
  "tuck-hold": {
    why: "Your deep neck muscles need endurance, not just strength, to hold your head up all day. Longer holds build that stamina. It's what the neck endurance test in Progress measures.",
    feel: "Steady, light effort at the front of your neck.",
    tips: [
      "Eyes level, chin glides back.",
      "Gentle: about 30% effort is plenty.",
      "Keep breathing. Don't hold your breath.",
      "Relax your jaw and shoulders.",
      "If you start to shake, ease off a little.",
    ],
    avoid: "Don't push so hard that your neck strains or shakes.",
  },
};

/** Everything to rotate through while you work: why it helps, where to feel it, the tips, then the mistake to avoid. */
export function workTips(id: string): { icon: string; text: string }[] {
  const c = COACHING[id];
  if (!c) return [];
  return [
    { icon: "💡", text: `Why it helps: ${c.why}` },
    { icon: "🎯", text: `Feel it: ${c.feel}` },
    ...c.tips.map((t) => ({ icon: "✅", text: t })),
    { icon: "⚠️", text: c.avoid },
  ];
}

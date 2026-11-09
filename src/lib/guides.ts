export interface GuideSection {
  h?: string;
  p?: string;
  list?: string[];
}

export interface Guide {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  minutes: number;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    id: "tech-neck",
    emoji: "🦒",
    title: "What tech neck actually is",
    blurb: "Why your head drifts forward, and why it matters.",
    minutes: 2,
    sections: [
      {
        p: "Your head weighs about 5 kg, roughly a bowling ball. When it sits straight over your shoulders, your neck barely has to work to hold it up.",
      },
      {
        h: "What happens when it drifts forward",
        p: "Every few centimetres your head moves forward, the muscles at the back of your neck and upper back have to work harder to stop it dropping. One well-known modelling study estimated the load on the neck rises to around 12 kg at a 15° tilt and around 27 kg at 60°, like looking down at a phone.",
      },
      {
        h: "How it builds up",
        list: [
          "Hours looking down at a phone or a low laptop screen.",
          "The muscles at the front of the neck (deep neck flexors) get weak from never being used.",
          "The chest and front of the shoulders get tight from sitting rounded.",
          "The upper back muscles get long and weak, so the shoulders roll forward.",
          "Over months, this becomes your body's normal resting position.",
        ],
      },
      {
        h: "What it can lead to",
        list: ["Neck and shoulder stiffness", "Tension headaches", "Upper-back ache between the shoulder blades", "Reduced neck movement"],
      },
      {
        h: "The good news",
        p: "It's mostly habit plus muscle imbalance, and both respond well to training. Most people feel a difference within a few weeks.",
      },
    ],
  },
  {
    id: "habit-vs-exercise",
    emoji: "⚖️",
    title: "Posture habits vs exercise: you need both",
    blurb: "Why fixing how you sit isn't enough on its own.",
    minutes: 2,
    sections: [
      {
        p: "You spend 8–10 hours a day sitting and on your phone. A few minutes of exercise can't cancel that out, but the daytime habit also can't stick if your muscles are fighting against it.",
      },
      {
        h: "What each one does",
        list: [
          "Habit (sitting and standing well, Guard mode): takes the strain off your neck right now. It's the biggest single factor.",
          "Exercise: loosens the tight muscles and strengthens the weak ones, so good posture becomes your body's natural resting position rather than something you have to force.",
        ],
      },
      {
        h: "What happens if you only do one",
        list: [
          "Habit only: you feel better, but it's a constant battle and you slump back when tired.",
          "Exercise only: you get stronger, but 8 hours of slouching outweighs 5 minutes of work.",
          "Both: this is what actually changes your posture for good.",
        ],
      },
      {
        h: "The easy version",
        p: "Keep Guard mode on while you work, do a 2–3 minute desk routine once or twice a day, and if you go to the gym, do one of the posture plans 2–3 times a week.",
      },
    ],
  },
  {
    id: "desk-setup",
    emoji: "🖥️",
    title: "Set up your desk and screens",
    blurb: "Small changes that remove the reason to slouch.",
    minutes: 3,
    sections: [
      {
        h: "Screen",
        list: [
          "Top of the screen at or slightly below eye level, so you look straight ahead or a little down with your eyes, not your head.",
          "About an arm's length away.",
          "Laptop? Raise it on a stand or a stack of books and use a separate keyboard and mouse. A laptop on a desk is the #1 cause of tech neck.",
        ],
      },
      {
        h: "Two screens",
        list: [
          "If you use both equally, put the join between them right in front of you.",
          "If one is your main screen, put it straight in front and the second one to the side, angled toward you.",
          "Run Guard's second-screen calibration so turning to it doesn't count as slouching.",
        ],
      },
      {
        h: "Chair",
        list: [
          "Sit all the way back so the chair supports your lower back. A small cushion or rolled towel helps.",
          "Feet flat on the floor (or a footrest), knees at about hip height.",
          "Elbows at about 90°, close to your sides, shoulders relaxed.",
        ],
      },
      {
        h: "Move often",
        p: "The best posture is your next posture. Even a perfect setup gets stiff if you don't move. Get up or change position at least every 30–60 minutes.",
      },
    ],
  },
  {
    id: "phone",
    emoji: "📱",
    title: "Phone posture",
    blurb: "Where most of the forward-head time comes from.",
    minutes: 1,
    sections: [
      {
        list: [
          "Lift the phone toward eye level instead of dropping your head to it. Rest your elbow on your other arm or a table.",
          "Look down with your eyes, not your whole head.",
          "Use landscape mode and voice messages to cut down long reading sessions.",
          "Lying on your side with your phone? Keep your head supported on the pillow, not propped on your hand.",
          "Every 20 minutes, look 6 metres away for 20 seconds. It rests your eyes and makes you lift your head.",
        ],
      },
    ],
  },
  {
    id: "sleep",
    emoji: "😴",
    title: "Sleep and pillows",
    blurb: "Don't undo your progress overnight.",
    minutes: 2,
    sections: [
      {
        p: "A pillow doesn't hurt your posture. The wrong height of pillow can, because you spend 7–8 hours in that position. The goal is to keep your head and neck in line with your spine, as if you were standing up straight.",
      },
      {
        h: "By sleeping position",
        list: [
          "On your back: a fairly thin pillow. A thick one or a stack pushes your chin to your chest, which is forward head posture all night.",
          "On your side: a thicker, firmer pillow that fills the gap between your ear and the mattress. Your nose should line up with the middle of your chest.",
          "On your stomach: hardest on the neck, because your head is turned to one side for hours. Use a very thin pillow or none, and try to move toward side sleeping.",
        ],
      },
      {
        h: "Signs your pillow is wrong",
        list: ["You wake up with a stiff neck or a headache.", "You keep folding or bunching your pillow.", "It's flat and lumpy (most last 1–2 years)."],
      },
      { h: "Also avoid", p: "Reading or scrolling in bed propped up with your chin on your chest. That's extra hours of forward head every day." },
    ],
  },
  {
    id: "standing",
    emoji: "🧍",
    title: "Standing posture and your lower back",
    blurb: "Locked knees, hips forward and a swayed back.",
    minutes: 2,
    sections: [
      {
        p: "Neck posture starts from the ground up. A very common pattern in desk workers: knees locked, hips pushed forward, lower back arched, belly out, upper back rounded, head forward. Each part makes up for the one below it.",
      },
      {
        h: "Quick standing check",
        list: [
          "Soft knees, not locked back.",
          "Weight spread over your whole foot, not sitting on your heels.",
          "Tuck your tailbone very slightly, like zipping up tight jeans.",
          "Ribs stacked over your hips, not flared up.",
          "Shoulders relaxed down, ears over your shoulders.",
        ],
      },
      {
        h: "What helps",
        p: "Glute bridges, dead bugs and the kneeling hip flexor stretch (in the Gym section) target exactly this pattern.",
      },
    ],
  },
  {
    id: "gym-rules",
    emoji: "🏋️",
    title: "Gym rules for better posture",
    blurb: "Pull more than you push, and protect your neck while you lift.",
    minutes: 2,
    sections: [
      {
        h: "1. Pull more than you push",
        p: "Most people train chest and front shoulders a lot, which pulls the shoulders further forward. Aim for about 2 pulling sets (rows, face pulls, pulldowns) for every 1 pushing set (bench press, push-ups, shoulder press).",
      },
      {
        h: "2. Watch your head while you lift",
        list: [
          "Keep your chin gently tucked on every exercise.",
          "Look at the floor a little ahead of you, not up at the mirror.",
          "If your head pokes forward on the last reps, the set is over.",
        ],
      },
      {
        h: "3. Go easy on these",
        list: ["Lots of bench press without matching rows.", "Heavy shrugs.", "Crunches that yank on your neck (use dead bugs instead)."],
      },
      {
        h: "4. How often",
        p: "2–3 sessions a week. Even 20–30 minutes focused on posture work is enough. Add weight slowly, only when every rep looks clean.",
      },
      {
        h: "5. Stretch the tight front",
        p: "Finish with a chest stretch and, if you sit a lot, a hip flexor stretch.",
      },
    ],
  },
  {
    id: "timeline",
    emoji: "📅",
    title: "How long does it take?",
    blurb: "What to expect week by week.",
    minutes: 1,
    sections: [
      {
        list: [
          "2–4 weeks: less neck and shoulder stiffness. Sitting up straight feels easier.",
          "6–12 weeks: your shoulders sit further back on their own. Your side-photo angle starts dropping.",
          "3–6 months: a clear difference in photos. Good posture becomes your default.",
          "6+ months: it sticks, as long as you keep some upper-back work and good desk habits.",
        ],
      },
      {
        p: "Strength training at the gym roughly halves the time compared with doing nothing, because muscles adapt much faster with resistance. Retake your side photo once a month in the same spot so you can see real numbers.",
      },
    ],
  },
  {
    id: "photo",
    emoji: "📸",
    title: "Taking your posture photo right",
    blurb: "So your monthly numbers mean something.",
    minutes: 1,
    sections: [
      {
        list: [
          "Don't take a mirror selfie: holding the phone up lifts your arm and twists your shoulder, which throws the reading off.",
          "Prop the phone at shoulder height and use the timer, or ask someone.",
          "Stand fully side-on, arms relaxed by your sides, in your normal relaxed posture. Don't correct it.",
          "Wear a fitted top or none, and tie long hair back, so your ear and shoulder are visible.",
          "Same spot, same time of day, same clothes each month.",
        ],
      },
    ],
  },
  {
    id: "pain",
    emoji: "🩺",
    title: "Soreness, pain, and when to see a physio",
    blurb: "What's normal and what isn't.",
    minutes: 2,
    sections: [
      {
        h: "Normal",
        list: [
          "Mild muscle tiredness or soreness a day or two after new exercises.",
          "A gentle stretching feeling during stretches.",
          "Feeling 'worked' between your shoulder blades.",
        ],
      },
      {
        h: "Stop the exercise if you feel",
        list: ["Sharp or pinching pain.", "Pain that gets worse as you continue.", "Dizziness or feeling faint."],
      },
      {
        h: "See a doctor or physio if you have",
        list: [
          "Numbness, tingling or weakness in your arms or hands.",
          "Neck pain after a fall, accident or injury.",
          "Severe or worsening headaches.",
          "Pain that wakes you at night or doesn't ease with rest.",
          "Problems with balance, coordination or your vision.",
          "Pain that hasn't improved after a few weeks.",
        ],
      },
      {
        p: "Upright is a habit and exercise coach, not a medical device. A physio can assess you in person and tailor the plan.",
      },
    ],
  },
  {
    id: "breathing",
    emoji: "🌬️",
    title: "Breathing, stress and tight shoulders",
    blurb: "Why your traps are always tight.",
    minutes: 1,
    sections: [
      {
        p: "When you're stressed or focused, breathing gets shallow and moves into the upper chest. That uses the neck and upper trap muscles to lift your ribs thousands of times a day, which keeps them tight.",
      },
      {
        h: "Try this a few times a day",
        list: [
          "Sit tall, one hand on your belly.",
          "Breathe in slowly through your nose so your belly and lower ribs expand, not your shoulders.",
          "Breathe out slowly, a little longer than the in-breath.",
          "5 breaths. Let your shoulders drop on every out-breath.",
        ],
      },
    ],
  },
];

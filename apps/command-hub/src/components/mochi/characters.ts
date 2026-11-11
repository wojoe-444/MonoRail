// The mochi crew: one character per agent role (see docs/mochi-crew.md).
// Each role is a stack of SVG layers on a 256x256 canvas, drawn only with the
// flavor's CSS variables (--t0 --t1 tile, --b0 --b1 dough, --acc deep accent,
// --pop bright accent, --onacc ink on the accent) plus a few fixed colors for
// props that stop reading in other colors (hard hats, laurel, cape).
// `url(#D)` is the dough gradient; MochiAvatar swaps in a per-instance id.
// Eyes and the body come from BODIES / eye kinds in MochiAvatar.

export type MochiBody = 'gumdrop' | 'tall' | 'squat'
export type MochiEyes = 'dots' | 'wide' | 'focus' | 'content' | 'sleepy' | 'none'

export interface MochiRole {
  label: string
  /** One line on what the character is doing. */
  story: string
  /** Default flavor name (see flavors.ts). */
  flavor: string
  body: MochiBody
  eyes: MochiEyes
  /** Where the eyes look, in canvas units. */
  eyeOffset?: [number, number]
  /** Behind the character; dropped at small sizes. */
  tile?: string
  /** Headwear, drawn over the eyes. */
  head?: string
  /** Held props and hands. */
  front?: string
}

export const MOCHI_ROLE_IDS = ["coordinator", "strategist", "planner", "forecaster", "researcher", "learner", "scout", "analyst", "builder", "coder", "automator", "integrator", "optimizer", "tester", "debugger", "reviewer", "security", "scheduler", "writer", "reporter", "designer", "communicator", "assistant", "translator", "journaler", "dreamer", "agent"] as const

export type MochiRoleId = (typeof MOCHI_ROLE_IDS)[number]

export const MOCHI_ROLES: Record<MochiRoleId, MochiRole> = {
  coordinator: {
    label: "Coordinator",
    story: "Keeps the loop turning",
    flavor: "Classic",
    body: "gumdrop",
    eyes: "dots",
    tile: "<g transform=\"rotate(-14 128 146)\"><path d=\"M26 146a102 32 0 0 1 204 0\" fill=\"none\" stroke=\"#fbf6e8\" stroke-opacity=\".55\" stroke-width=\"10\" stroke-linecap=\"round\"/></g>",
    front: "<g transform=\"rotate(-14 128 146)\"><path d=\"M26 146a102 32 0 0 0 204 0\" fill=\"none\" stroke=\"#fbf6e8\" stroke-width=\"10\" stroke-linecap=\"round\"/><circle cx=\"200\" cy=\"168\" r=\"13\" fill=\"#ffcf7a\"/></g>",
  },
  strategist: {
    label: "Strategist",
    story: "Plans ahead, balances trade-offs",
    flavor: "Shiso",
    body: "gumdrop",
    eyes: "dots",
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    head: "<path d=\"M65.6 175.0L57.6 155.7L56.4 135.1L62.2 115.2L74.5 97.8L92.0 84.8\" fill=\"none\" stroke=\"#d9a63c\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"59.6\" cy=\"178.5\" rx=\"9\" ry=\"4.2\" transform=\"rotate(210 59.6 178.5)\" fill=\"#d9a63c\"/><ellipse cx=\"71.7\" cy=\"171.5\" rx=\"9\" ry=\"4.2\" transform=\"rotate(270 71.7 171.5)\" fill=\"#d9a63c\"/><ellipse cx=\"50.7\" cy=\"157.2\" rx=\"9\" ry=\"4.2\" transform=\"rotate(228 50.7 157.2)\" fill=\"#d9a63c\"/><ellipse cx=\"64.4\" cy=\"154.3\" rx=\"9\" ry=\"4.2\" transform=\"rotate(288 64.4 154.3)\" fill=\"#d9a63c\"/><ellipse cx=\"49.4\" cy=\"134.4\" rx=\"9\" ry=\"4.2\" transform=\"rotate(246 49.4 134.4)\" fill=\"#d9a63c\"/><ellipse cx=\"63.4\" cy=\"135.8\" rx=\"9\" ry=\"4.2\" transform=\"rotate(306 63.4 135.8)\" fill=\"#d9a63c\"/><ellipse cx=\"55.8\" cy=\"112.3\" rx=\"9\" ry=\"4.2\" transform=\"rotate(264 55.8 112.3)\" fill=\"#d9a63c\"/><ellipse cx=\"68.6\" cy=\"118.0\" rx=\"9\" ry=\"4.2\" transform=\"rotate(324 68.6 118.0)\" fill=\"#d9a63c\"/><ellipse cx=\"69.3\" cy=\"93.2\" rx=\"9\" ry=\"4.2\" transform=\"rotate(282 69.3 93.2)\" fill=\"#d9a63c\"/><ellipse cx=\"79.7\" cy=\"102.5\" rx=\"9\" ry=\"4.2\" transform=\"rotate(342 79.7 102.5)\" fill=\"#d9a63c\"/><ellipse cx=\"88.5\" cy=\"78.8\" rx=\"9\" ry=\"4.2\" transform=\"rotate(300 88.5 78.8)\" fill=\"#d9a63c\"/><ellipse cx=\"95.5\" cy=\"90.9\" rx=\"9\" ry=\"4.2\" transform=\"rotate(360 95.5 90.9)\" fill=\"#d9a63c\"/><path d=\"M190.4 175.0L198.4 155.7L199.6 135.1L193.8 115.2L181.5 97.8L164.0 84.8\" fill=\"none\" stroke=\"#d9a63c\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"196.4\" cy=\"178.5\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-30 196.4 178.5)\" fill=\"#d9a63c\"/><ellipse cx=\"184.3\" cy=\"171.5\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-90 184.3 171.5)\" fill=\"#d9a63c\"/><ellipse cx=\"205.3\" cy=\"157.2\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-48 205.3 157.2)\" fill=\"#d9a63c\"/><ellipse cx=\"191.6\" cy=\"154.3\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-108 191.6 154.3)\" fill=\"#d9a63c\"/><ellipse cx=\"206.6\" cy=\"134.4\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-66 206.6 134.4)\" fill=\"#d9a63c\"/><ellipse cx=\"192.6\" cy=\"135.8\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-126 192.6 135.8)\" fill=\"#d9a63c\"/><ellipse cx=\"200.2\" cy=\"112.3\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-84 200.2 112.3)\" fill=\"#d9a63c\"/><ellipse cx=\"187.4\" cy=\"118.0\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-144 187.4 118.0)\" fill=\"#d9a63c\"/><ellipse cx=\"186.7\" cy=\"93.2\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-102 186.7 93.2)\" fill=\"#d9a63c\"/><ellipse cx=\"176.3\" cy=\"102.5\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-162 176.3 102.5)\" fill=\"#d9a63c\"/><ellipse cx=\"167.5\" cy=\"78.8\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-120 167.5 78.8)\" fill=\"#d9a63c\"/><ellipse cx=\"160.5\" cy=\"90.9\" rx=\"9\" ry=\"4.2\" transform=\"rotate(-180 160.5 90.9)\" fill=\"#d9a63c\"/>",
    front: "<path d=\"M72 160c-6 18-22 30-38 36 30 6 64 2 86-6-20-4-38-14-48-30z\" fill=\"#c4553a\"/><path d=\"M60 182c10 4 24 4 36 2\" stroke=\"#fff\" stroke-opacity=\".2\" stroke-width=\"3\" fill=\"none\"/><circle cx=\"78\" cy=\"166\" r=\"7\" fill=\"#d9a63c\"/>",
  },
  planner: {
    label: "Planner",
    story: "Maps the route, plants milestones",
    flavor: "Kinako",
    body: "gumdrop",
    eyes: "dots",
    head: "<path d=\"M150 84V36\" stroke=\"#132a1f\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M152 36l34 11-34 12z\" style=\"fill:var(--pop)\"/>",
    front: "<path d=\"M82 152l30 6 32-6 30 6v36l-30-6-32 6-30-6z\" fill=\"#fffaf0\" stroke=\"#132a1f\" stroke-opacity=\".2\" stroke-width=\"2\"/><path d=\"M112 158v36M144 152v36\" stroke=\"#132a1f\" stroke-opacity=\".15\" stroke-width=\"2\"/><path d=\"M92 184q20-24 40-8t32-16\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"4\" stroke-dasharray=\"2 7\" stroke-linecap=\"round\"/><path d=\"M158 158l8 8m0-8l-8 8\" style=\"stroke:var(--acc)\" stroke-width=\"4\" stroke-linecap=\"round\"/><ellipse cx=\"82\" cy=\"170\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"174\" cy=\"170\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  forecaster: {
    label: "Forecaster",
    story: "Anticipates outcomes and what's next",
    flavor: "Ramune",
    body: "squat",
    eyes: "dots",
    eyeOffset: [4, 0],
    tile: "<path d=\"M40 96Q100 30 196 64\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".7\" stroke-width=\"2.5\" stroke-dasharray=\"1 7\" stroke-linecap=\"round\"/><circle cx=\"40\" cy=\"96\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"78\" cy=\"58\" r=\"3\" fill=\"#fff\"/><circle cx=\"118\" cy=\"46\" r=\"4\" fill=\"#fff\"/><circle cx=\"196\" cy=\"64\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"172\" cy=\"74\" r=\"2.5\" fill=\"#fff\"/><path d=\"M166 30a14 14 0 1 0 14 22a11 11 0 1 1-14-22z\" fill=\"#fff\"/>",
    front: "<path d=\"M190 148l-14 44M190 148l4 46M190 148l18 40\" stroke=\"#7a5532\" stroke-width=\"5\" stroke-linecap=\"round\"/><g transform=\"rotate(-28 170 140)\"><rect x=\"140\" y=\"130\" width=\"76\" height=\"20\" rx=\"6\" style=\"fill:var(--pop)\"/><rect x=\"206\" y=\"126\" width=\"16\" height=\"28\" rx=\"5\" style=\"fill:var(--pop)\"/><rect x=\"132\" y=\"133\" width=\"12\" height=\"14\" rx=\"4\" style=\"fill:var(--acc)\"/><rect x=\"170\" y=\"130\" width=\"6\" height=\"20\" style=\"fill:var(--acc)\" opacity=\".5\"/></g>",
  },
  researcher: {
    label: "Researcher",
    story: "Peers closer, stacks sources",
    flavor: "Yuki",
    body: "gumdrop",
    eyes: "none",
    eyeOffset: [4, 0],
    front: "<ellipse cx=\"114\" cy=\"134\" rx=\"6.5\" ry=\"8.5\" fill=\"#132a1f\"/><rect x=\"40\" y=\"178\" width=\"60\" height=\"14\" rx=\"3\" style=\"fill:var(--acc)\"/><rect x=\"46\" y=\"164\" width=\"52\" height=\"14\" rx=\"3\" style=\"fill:var(--pop)\"/><path d=\"M52 171h40\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"2\"/><path d=\"M171 154l25 32\" stroke=\"#132a1f\" stroke-width=\"10\" stroke-linecap=\"round\"/><circle cx=\"154\" cy=\"134\" r=\"25\" fill=\"#fff\" fill-opacity=\".35\" stroke=\"#132a1f\" stroke-width=\"7\"/><ellipse cx=\"154\" cy=\"134\" rx=\"10\" ry=\"13\" fill=\"#132a1f\"/><circle cx=\"150\" cy=\"128\" r=\"3.5\" fill=\"#fff\"/><ellipse cx=\"192\" cy=\"180\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  learner: {
    label: "Learner",
    story: "Studies, experiments, brings back insights",
    flavor: "Kuri",
    body: "gumdrop",
    eyes: "dots",
    head: "<g fill=\"none\" stroke=\"#132a1f\" stroke-width=\"4.5\"><circle cx=\"110\" cy=\"134\" r=\"15\"/><circle cx=\"146\" cy=\"134\" r=\"15\"/><path d=\"M125 131q3-4 6 0M95 132l-12-3M161 132l12-3\" stroke-linecap=\"round\"/></g>",
    front: "<path d=\"M122 170l32-8v36l-32 8z\" style=\"fill:var(--acc)\"/><path d=\"M154 162l32 6v36l-32-6z\" style=\"fill:var(--acc)\"/><path d=\"M127 172l26-6v30l-26 6zM155 166l26 5v30l-26-5z\" fill=\"#fffaf0\"/><path d=\"M154 164v36\" stroke=\"#132a1f\" stroke-opacity=\".3\" stroke-width=\"2\"/><ellipse cx=\"122\" cy=\"186\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"188\" cy=\"190\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  scout: {
    label: "Scout",
    story: "Explores options, spots opportunities",
    flavor: "Sea salt",
    body: "gumdrop",
    eyes: "dots",
    eyeOffset: [-8, 0],
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    front: "<g transform=\"translate(0 0)\"><rect x=\"150\" y=\"128\" width=\"64\" height=\"18\" rx=\"8\" fill=\"#132a1f\"/><circle cx=\"168\" cy=\"146\" r=\"17\" fill=\"#132a1f\"/><circle cx=\"202\" cy=\"146\" r=\"17\" fill=\"#132a1f\"/><circle cx=\"168\" cy=\"146\" r=\"10\" fill=\"#bcd6ea\"/><circle cx=\"202\" cy=\"146\" r=\"10\" fill=\"#bcd6ea\"/><circle cx=\"165\" cy=\"142\" r=\"3\" fill=\"#fff\"/><circle cx=\"199\" cy=\"142\" r=\"3\" fill=\"#fff\"/></g><ellipse cx=\"160\" cy=\"168\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"194\" cy=\"170\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  analyst: {
    label: "Analyst",
    story: "Finds patterns, turns data into direction",
    flavor: "Honey",
    body: "gumdrop",
    eyes: "dots",
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    front: "<rect x=\"80\" y=\"146\" width=\"104\" height=\"56\" rx=\"6\" style=\"fill:var(--acc)\"/><rect x=\"98\" y=\"182\" width=\"12\" height=\"10\" rx=\"2\" style=\"fill:var(--pop)\"/><rect x=\"118\" y=\"172\" width=\"12\" height=\"20\" rx=\"2\" fill=\"#fffaf0\"/><rect x=\"138\" y=\"162\" width=\"12\" height=\"30\" rx=\"2\" fill=\"#fffaf0\"/><rect x=\"158\" y=\"154\" width=\"12\" height=\"38\" rx=\"2\" fill=\"#fffaf0\"/><path d=\"M92 176l18-12 12 6 22-16\" fill=\"none\" style=\"stroke:var(--pop)\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"90\" cy=\"148\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"174\" cy=\"148\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  builder: {
    label: "Builder",
    story: "Turns ideas into working solutions",
    flavor: "Soda",
    body: "gumdrop",
    eyes: "dots",
    eyeOffset: [-6, 6],
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    head: "<path d=\"M78 112c0-34 22-54 50-54s50 20 50 54z\" fill=\"#f2c230\"/><rect x=\"68\" y=\"106\" width=\"128\" height=\"13\" rx=\"6.5\" fill=\"#e0ad1c\"/><path d=\"M128 60v46\" stroke=\"#fff\" stroke-opacity=\".35\" stroke-width=\"8\"/>",
    front: "<g transform=\"rotate(-48 186 168)\"><rect x=\"150\" y=\"158\" width=\"72\" height=\"22\" rx=\"11\" fill=\"#dbe9f5\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"2\"/><ellipse cx=\"222\" cy=\"169\" rx=\"6\" ry=\"11\" fill=\"#fff\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"2\"/><path d=\"M164 166h40\" stroke=\"#7aa6cc\" stroke-width=\"2\"/></g><ellipse cx=\"172\" cy=\"182\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  coder: {
    label: "Coder",
    story: "Headphones on, deep in it",
    flavor: "Blueberry",
    body: "gumdrop",
    eyes: "focus",
    tile: "<text x=\"30\" y=\"70\" font-family=\"JetBrains Mono,monospace\" font-size=\"38\" font-weight=\"700\" style=\"fill:var(--pop)\" opacity=\".8\">{ }</text>",
    head: "<path d=\"M70 132C68 58 188 58 186 132\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"9\" stroke-linecap=\"round\"/><rect x=\"58\" y=\"114\" width=\"20\" height=\"36\" rx=\"9\" style=\"fill:var(--acc)\"/><rect x=\"178\" y=\"114\" width=\"20\" height=\"36\" rx=\"9\" style=\"fill:var(--acc)\"/>",
    front: "<ellipse cx=\"128\" cy=\"146\" rx=\"40\" ry=\"10\" style=\"fill:var(--pop)\" opacity=\".25\"/><rect x=\"88\" y=\"150\" width=\"80\" height=\"42\" rx=\"8\" style=\"fill:var(--acc)\"/><circle cx=\"128\" cy=\"171\" r=\"6\" style=\"fill:var(--pop)\"/><rect x=\"76\" y=\"190\" width=\"104\" height=\"9\" rx=\"4.5\" style=\"fill:var(--acc)\" opacity=\".8\"/>",
  },
  automator: {
    label: "Automator",
    story: "Runs the same jobs on repeat, happily",
    flavor: "Black sesame",
    body: "gumdrop",
    eyes: "content",
    tile: "<path d=\"M206 116a40 40 0 1 1-12-46\" fill=\"none\" style=\"stroke:var(--pop)\" stroke-width=\"8\" stroke-linecap=\"round\" opacity=\".9\"/><path d=\"M186 58l14 8-12 12\" fill=\"none\" style=\"stroke:var(--pop)\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/><g style=\"fill:var(--pop)\"><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(0 54 64)\"/><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(45 54 64)\"/><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(90 54 64)\"/><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(135 54 64)\"/><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(180 54 64)\"/><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(225 54 64)\"/><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(270 54 64)\"/><rect x=\"49\" y=\"44\" width=\"10\" height=\"12\" rx=\"2\" transform=\"rotate(315 54 64)\"/><circle cx=\"54\" cy=\"64\" r=\"14\"/></g><circle cx=\"54\" cy=\"64\" r=\"5.88\" fill=\"#132a1f\" opacity=\".55\"/><path d=\"M32 40a30 30 0 0 1 22-8M78 88a30 30 0 0 1-22 8\" fill=\"none\" style=\"stroke:var(--pop)\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\".6\"/>",
    front: "<rect x=\"60\" y=\"182\" width=\"140\" height=\"14\" rx=\"7\" fill=\"#3a4046\"/><circle cx=\"72\" cy=\"189\" r=\"4\" fill=\"#8a949d\"/><circle cx=\"100\" cy=\"189\" r=\"4\" fill=\"#8a949d\"/><circle cx=\"128\" cy=\"189\" r=\"4\" fill=\"#8a949d\"/><circle cx=\"156\" cy=\"189\" r=\"4\" fill=\"#8a949d\"/><circle cx=\"184\" cy=\"189\" r=\"4\" fill=\"#8a949d\"/><rect x=\"46\" y=\"160\" width=\"22\" height=\"22\" rx=\"4\" style=\"fill:var(--pop)\"/><path d=\"M46 171h22\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"2\"/><rect x=\"188\" y=\"164\" width=\"18\" height=\"18\" rx=\"4\" style=\"fill:var(--pop)\" opacity=\".8\"/><path d=\"M168 150l14-12\" stroke=\"#3a4046\" stroke-width=\"6\" stroke-linecap=\"round\"/><circle cx=\"184\" cy=\"136\" r=\"7\" style=\"fill:var(--pop)\"/><ellipse cx=\"166\" cy=\"154\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  integrator: {
    label: "Integrator",
    story: "Brings pieces together across tools and teams",
    flavor: "Ube",
    body: "squat",
    eyes: "dots",
    tile: "<ellipse cx=\"128\" cy=\"74\" rx=\"70\" ry=\"30\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".7\" stroke-width=\"5\"/><path d=\"M62 58l18 9.9-18 9.9-18-9.9z\" fill=\"#8fc3e8\"/><path d=\"M62 58l18 9.9-18 9.9-18-9.9z\" fill=\"#fff\" opacity=\".35\"/><path d=\"M44 67.9l18 9.9v19.8l-18-9.9z\" fill=\"#8fc3e8\"/><path d=\"M62 77.8l18-9.9v19.8l-18 9.9z\" fill=\"#8fc3e8\"/><path d=\"M62 77.8l18-9.9v19.8l-18 9.9z\" fill=\"#132a1f\" opacity=\".18\"/><path d=\"M128 30l18 9.9-18 9.9-18-9.9z\" fill=\"#f4a7b4\"/><path d=\"M128 30l18 9.9-18 9.9-18-9.9z\" fill=\"#fff\" opacity=\".35\"/><path d=\"M110 39.9l18 9.9v19.8l-18-9.9z\" fill=\"#f4a7b4\"/><path d=\"M128 49.8l18-9.9v19.8l-18 9.9z\" fill=\"#f4a7b4\"/><path d=\"M128 49.8l18-9.9v19.8l-18 9.9z\" fill=\"#132a1f\" opacity=\".18\"/><path d=\"M194 58l18 9.9-18 9.9-18-9.9z\" fill=\"#f5c64f\"/><path d=\"M194 58l18 9.9-18 9.9-18-9.9z\" fill=\"#fff\" opacity=\".35\"/><path d=\"M176 67.9l18 9.9v19.8l-18-9.9z\" fill=\"#f5c64f\"/><path d=\"M194 77.8l18-9.9v19.8l-18 9.9z\" fill=\"#f5c64f\"/><path d=\"M194 77.8l18-9.9v19.8l-18 9.9z\" fill=\"#132a1f\" opacity=\".18\"/>",
  },
  optimizer: {
    label: "Optimizer",
    story: "Finds the best approach, improves results",
    flavor: "Watermelon",
    body: "gumdrop",
    eyes: "dots",
    eyeOffset: [0, 6],
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    head: "<path d=\"M76 116c0-34 22-54 50-54s52 20 52 54z\" fill=\"#f2a43a\"/><rect x=\"66\" y=\"110\" width=\"128\" height=\"13\" rx=\"6.5\" fill=\"#df8f22\"/><path d=\"M126 64v46\" stroke=\"#fff\" stroke-opacity=\".35\" stroke-width=\"8\"/>",
    front: "<g transform=\"rotate(-35 196 160)\"><rect x=\"190\" y=\"132\" width=\"12\" height=\"60\" rx=\"5\" fill=\"#d9dde2\" stroke=\"#132a1f\" stroke-width=\"3\"/><path d=\"M181 118a15 15 0 1 0 30 0l-8 0 0 8-14 0 0-8z\" fill=\"#d9dde2\" stroke=\"#132a1f\" stroke-width=\"3\"/></g><ellipse cx=\"196\" cy=\"172\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  tester: {
    label: "Tester",
    story: "Goggles down, watching it fizz",
    flavor: "Raspberry",
    body: "gumdrop",
    eyes: "wide",
    tile: "<circle cx=\"212\" cy=\"92\" r=\"7\" style=\"fill:var(--pop)\" opacity=\".8\"/><circle cx=\"198\" cy=\"66\" r=\"5\" style=\"fill:var(--pop)\" opacity=\".7\"/><circle cx=\"216\" cy=\"48\" r=\"3.5\" style=\"fill:var(--pop)\" opacity=\".6\"/>",
    head: "<path d=\"M70 112Q128 90 186 112\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"8\"/><circle cx=\"111\" cy=\"100\" r=\"14\" style=\"fill:var(--pop)\" stroke=\"#132a1f\" stroke-width=\"4\"/><circle cx=\"145\" cy=\"100\" r=\"14\" style=\"fill:var(--pop)\" stroke=\"#132a1f\" stroke-width=\"4\"/><circle cx=\"107\" cy=\"96\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"141\" cy=\"96\" r=\"3.5\" fill=\"#fff\"/>",
    front: "<g transform=\"rotate(12 188 166)\"><path d=\"M181 132h14v20l15 30a6 6 0 0 1-5 9h-34a6 6 0 0 1-5-9l15-30z\" fill=\"#fff\" fill-opacity=\".9\" stroke=\"#132a1f\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M172 172h32l5 10a6 6 0 0 1-5 9h-32a6 6 0 0 1-5-9z\" style=\"fill:var(--acc)\"/><rect x=\"177\" y=\"127\" width=\"22\" height=\"7\" rx=\"3.5\" fill=\"#132a1f\"/></g><ellipse cx=\"170\" cy=\"180\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  debugger: {
    label: "Debugger",
    story: "Net up, spotted one",
    flavor: "Hibiscus",
    body: "gumdrop",
    eyes: "dots",
    eyeOffset: [4, -5],
    tile: "<g transform=\"translate(212 104)\"><ellipse rx=\"11\" ry=\"9\" style=\"fill:var(--acc)\"/><path d=\"M0 -9V9\" stroke=\"#fffaf0\" stroke-width=\"2\"/><circle cx=\"-4\" cy=\"-1\" r=\"2\" fill=\"#fffaf0\"/><circle cx=\"4\" cy=\"3\" r=\"2\" fill=\"#fffaf0\"/><path d=\"M-6 -8l-4-6M6 -8l4-6\" stroke=\"#132a1f\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></g>",
    front: "<path d=\"M186 188L170 74\" stroke=\"#132a1f\" stroke-width=\"6\" stroke-linecap=\"round\"/><circle cx=\"166\" cy=\"56\" r=\"22\" fill=\"#fff\" fill-opacity=\".3\" stroke=\"#fffaf0\" stroke-width=\"5\"/><path d=\"M150 46l32 20M150 66l32-20M166 34v44\" stroke=\"#fffaf0\" stroke-opacity=\".6\" stroke-width=\"2\"/><ellipse cx=\"180\" cy=\"160\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  reviewer: {
    label: "Reviewer",
    story: "Checks quality, keeps things on track",
    flavor: "Earl grey",
    body: "squat",
    eyes: "none",
    tile: "<g transform=\"rotate(4 186 80)\"><rect x=\"150\" y=\"34\" width=\"70\" height=\"90\" rx=\"5\" fill=\"#fffaf0\"/><path d=\"M158 52l4 4 7-8\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M176 52h34\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M158 68l4 4 7-8\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M176 68h34\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M158 84l4 4 7-8\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M176 84h34\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M158 100l4 4 7-8\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M176 100h34\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M158 116l4 4 7-8\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M176 116h34\" stroke=\"#132a1f\" stroke-opacity=\".25\" stroke-width=\"3.5\" stroke-linecap=\"round\"/></g>",
    front: "<circle cx=\"108\" cy=\"150\" r=\"15\" fill=\"#fff\" fill-opacity=\".3\" stroke=\"#132a1f\" stroke-width=\"4.5\"/><path d=\"M93 148l-14-4\" stroke=\"#132a1f\" stroke-width=\"4.5\" stroke-linecap=\"round\"/><ellipse cx=\"108\" cy=\"150\" rx=\"6.5\" ry=\"8.5\" fill=\"#132a1f\"/><path d=\"M163 168l26 28\" stroke=\"#b5863a\" stroke-width=\"11\" stroke-linecap=\"round\"/><circle cx=\"150\" cy=\"150\" r=\"24\" fill=\"#fff\" fill-opacity=\".35\" stroke=\"#132a1f\" stroke-width=\"7\"/><path d=\"M123 148h3\" stroke=\"#132a1f\" stroke-width=\"4.5\"/><ellipse cx=\"150\" cy=\"150\" rx=\"10\" ry=\"13\" fill=\"#132a1f\"/><circle cx=\"146\" cy=\"144\" r=\"3.5\" fill=\"#fff\"/>",
  },
  security: {
    label: "Security",
    story: "Stands guard with a shield",
    flavor: "Cassis",
    body: "tall",
    eyes: "dots",
    front: "<path d=\"M128 140l38 12v18c0 20-16 32-38 40-22-8-38-20-38-40v-18z\" style=\"fill:var(--acc)\" stroke=\"#fffaf0\" stroke-width=\"4\"/><circle cx=\"128\" cy=\"168\" r=\"7\" style=\"fill:var(--pop)\"/><path d=\"M125 172h6l2 14h-10z\" style=\"fill:var(--pop)\"/><ellipse cx=\"90\" cy=\"168\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"166\" cy=\"168\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  scheduler: {
    label: "Scheduler",
    story: "Nightcap on, alarm set",
    flavor: "Apricot",
    body: "gumdrop",
    eyes: "content",
    head: "<path d=\"M86 96Q120 54 168 84l-4 14Q124 74 92 104z\" style=\"fill:var(--acc)\"/><circle cx=\"172\" cy=\"80\" r=\"8\" fill=\"#fffaf0\"/>",
    front: "<circle cx=\"190\" cy=\"172\" r=\"22\" fill=\"#fffaf0\" stroke=\"#132a1f\" stroke-width=\"4\"/><path d=\"M190 172v-12M190 172l9 5\" stroke=\"#132a1f\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M172 150a10 10 0 0 1 12-6M208 150a10 10 0 0 0-12-6\" style=\"stroke:var(--acc)\" stroke-width=\"6\" stroke-linecap=\"round\"/><ellipse cx=\"170\" cy=\"186\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  writer: {
    label: "Writer",
    story: "Daydreams, then drafts with a quill",
    flavor: "Lavender",
    body: "gumdrop",
    eyes: "content",
    front: "<path d=\"M58 168h56v28H58z\" fill=\"#fffaf0\" stroke=\"#132a1f\" stroke-opacity=\".2\" stroke-width=\"2\"/><path d=\"M64 176h40M64 183h44M64 190h28\" stroke=\"#132a1f\" stroke-opacity=\".3\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M206 92c-26 8-38 40-34 82 18-20 34-50 34-82z\" style=\"fill:var(--pop)\" stroke=\"#132a1f\" stroke-opacity=\".3\" stroke-width=\"2\"/><path d=\"M204 96L172 178\" stroke=\"#132a1f\" stroke-opacity=\".45\" stroke-width=\"2.5\"/><ellipse cx=\"176\" cy=\"170\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  reporter: {
    label: "Reporter",
    story: "Turns results into clear, concise updates",
    flavor: "Peach",
    body: "gumdrop",
    eyes: "dots",
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    front: "<path d=\"M78 150h100v48H78z\" fill=\"#fffaf0\" stroke=\"#132a1f\" stroke-opacity=\".2\" stroke-width=\"2\"/><path d=\"M128 150v48\" stroke=\"#132a1f\" stroke-opacity=\".18\" stroke-width=\"2\"/><rect x=\"86\" y=\"157\" width=\"34\" height=\"7\" rx=\"2\" style=\"fill:var(--acc)\"/><rect x=\"86\" y=\"168\" width=\"16\" height=\"18\" rx=\"2\" style=\"fill:var(--pop)\"/><path d=\"M106 170h14M136 158h34\" stroke=\"#132a1f\" stroke-opacity=\".3\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M106 176h14M136 164h34\" stroke=\"#132a1f\" stroke-opacity=\".3\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M106 182h14M136 170h34\" stroke=\"#132a1f\" stroke-opacity=\".3\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><rect x=\"150\" y=\"176\" width=\"20\" height=\"14\" rx=\"2\" style=\"fill:var(--pop)\"/><path d=\"M136 180h10M136 186h10\" stroke=\"#132a1f\" stroke-opacity=\".3\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><ellipse cx=\"80\" cy=\"152\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"176\" cy=\"152\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  designer: {
    label: "Designer",
    story: "Shapes clear, useful, delightful outputs",
    flavor: "Sakura",
    body: "gumdrop",
    eyes: "dots",
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    head: "<g transform=\"rotate(-14 120 84)\" style=\"fill:var(--acc)\"><ellipse cx=\"118\" cy=\"88\" rx=\"48\" ry=\"15\"/><path d=\"M76 86q42-36 84 0z\"/><rect x=\"115\" y=\"56\" width=\"6\" height=\"11\" rx=\"3\"/></g>",
    front: "<path d=\"M150 182c0-18 20-28 40-25 18 3 20 14 12 20-6 4 2 12-8 16-18 7-44 6-44-11z\" fill=\"#fffaf0\" stroke=\"#132a1f\" stroke-opacity=\".2\" stroke-width=\"2\"/><circle cx=\"166\" cy=\"176\" r=\"5.5\" style=\"fill:var(--acc)\"/><circle cx=\"182\" cy=\"168\" r=\"5.5\" style=\"fill:var(--pop)\"/><circle cx=\"168\" cy=\"190\" r=\"5.5\" style=\"fill:var(--t1)\"/><circle cx=\"186\" cy=\"186\" r=\"4.5\" fill=\"#132a1f\" opacity=\".7\"/><path d=\"M196 112l-22 52\" style=\"stroke:var(--acc)\" stroke-width=\"6\" stroke-linecap=\"round\"/><path d=\"M198 108l5-16-1 18z\" style=\"fill:var(--pop)\" stroke=\"#132a1f\" stroke-width=\"3\" stroke-linejoin=\"round\"/><ellipse cx=\"156\" cy=\"186\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"176\" cy=\"160\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  communicator: {
    label: "Communicator",
    story: "Shares updates, keeps everyone aligned",
    flavor: "Edamame",
    body: "gumdrop",
    eyes: "dots",
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    head: "<path d=\"M68 136C66 62 190 62 188 136\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"7\" stroke-linecap=\"round\"/><rect x=\"56\" y=\"116\" width=\"24\" height=\"40\" rx=\"11\" style=\"fill:var(--acc)\"/><rect x=\"62\" y=\"124\" width=\"10\" height=\"24\" rx=\"5\" style=\"fill:var(--pop)\" opacity=\".8\"/><rect x=\"182\" y=\"120\" width=\"14\" height=\"32\" rx=\"7\" style=\"fill:var(--acc)\"/>",
    front: "<path d=\"M190 150c4 22-8 30-30 28\" fill=\"none\" style=\"stroke:var(--acc)\" stroke-width=\"5\" stroke-linecap=\"round\"/><circle cx=\"158\" cy=\"178\" r=\"8\" style=\"fill:var(--acc)\"/>",
  },
  assistant: {
    label: "Assistant",
    story: "Handles the details so you can focus higher",
    flavor: "Yuzu",
    body: "gumdrop",
    eyes: "dots",
    tile: "<path d=\"M168 30h44a14 14 0 0 1 14 14v14a14 14 0 0 1-14 14h-26l-14 12v-12h-4a14 14 0 0 1-14-14V44a14 14 0 0 1 14-14z\" fill=\"#fffaf0\"/><circle cx=\"174\" cy=\"51\" r=\"5\" fill=\"#132a1f\"/><circle cx=\"190\" cy=\"51\" r=\"5\" fill=\"#132a1f\"/><circle cx=\"206\" cy=\"51\" r=\"5\" fill=\"#132a1f\"/>",
    head: "<path d=\"M68 136C66 62 190 62 188 136\" fill=\"none\" stroke=\"#3a4046\" stroke-width=\"7\" stroke-linecap=\"round\"/><rect x=\"56\" y=\"116\" width=\"24\" height=\"40\" rx=\"11\" fill=\"#3a4046\"/><rect x=\"178\" y=\"116\" width=\"24\" height=\"40\" rx=\"11\" fill=\"#3a4046\"/>",
    front: "<path d=\"M194 152c4 22-8 30-30 28\" fill=\"none\" stroke=\"#3a4046\" stroke-width=\"5\" stroke-linecap=\"round\"/><circle cx=\"162\" cy=\"180\" r=\"7\" fill=\"#3a4046\"/>",
  },
  translator: {
    label: "Translator",
    story: "Talks both ways",
    flavor: "Mango",
    body: "gumdrop",
    eyes: "dots",
    eyeOffset: [-3, 0],
    tile: "<path d=\"M24 34h52a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H44l-12 12v-12h-8a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8z\" fill=\"#fffaf0\"/><text x=\"50\" y=\"66\" text-anchor=\"middle\" font-family=\"Inter,sans-serif\" font-weight=\"700\" font-size=\"28\" style=\"fill:var(--acc)\">A</text><path d=\"M232 44h-52a8 8 0 0 0-8 8v26a8 8 0 0 0 8 8h32l12 12v-12h8a8 8 0 0 0 8-8V52a8 8 0 0 0-8-8z\" style=\"fill:var(--acc)\"/><text x=\"206\" y=\"76\" text-anchor=\"middle\" font-family=\"Inter,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#fffaf0\">Б</text>",
  },
  journaler: {
    label: "Journaler",
    story: "Captures progress, learnings and takeaways",
    flavor: "Mint",
    body: "gumdrop",
    eyes: "dots",
    eyeOffset: [-8, -4],
    tile: "<path d=\"M186 34l5 15M207 40l-7 13M222 58l-13 6\" style=\"stroke:var(--pop)\" stroke-width=\"7\" stroke-linecap=\"round\"/>",
    front: "<rect x=\"108\" y=\"138\" width=\"68\" height=\"58\" rx=\"7\" style=\"fill:var(--acc)\"/><rect x=\"170\" y=\"142\" width=\"6\" height=\"50\" fill=\"#fffaf0\" opacity=\".85\"/><rect x=\"152\" y=\"138\" width=\"7\" height=\"58\" style=\"fill:var(--pop)\"/><rect x=\"118\" y=\"152\" width=\"26\" height=\"6\" rx=\"3\" fill=\"#fffaf0\" opacity=\".5\"/><rect x=\"186\" y=\"124\" width=\"12\" height=\"66\" rx=\"3\" style=\"fill:var(--acc)\" opacity=\".85\"/><path d=\"M186 124l6-14 6 14z\" style=\"fill:var(--pop)\"/><rect x=\"186\" y=\"182\" width=\"12\" height=\"8\" rx=\"2\" fill=\"#fffaf0\" opacity=\".6\"/><ellipse cx=\"108\" cy=\"174\" rx=\"11\" ry=\"9.35\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/><ellipse cx=\"184\" cy=\"178\" rx=\"9\" ry=\"7.6499999999999995\" fill=\"url(#D)\" stroke=\"#132a1f\" stroke-opacity=\".12\" stroke-width=\"2\"/>",
  },
  dreamer: {
    label: "Dreamer",
    story: "Explores bold ideas and what's possible",
    flavor: "Taro",
    body: "gumdrop",
    eyes: "sleepy",
    eyeOffset: [0, -4],
    tile: "<path d=\"M196 30a24 24 0 1 0 24 36a19 19 0 1 1-24-36z\" style=\"fill:var(--pop)\"/><path d=\"M60.0 39.0L62.9 46.0L70.5 46.6L64.7 51.5L66.5 58.9L60.0 55.0L53.5 58.9L55.3 51.5L49.5 46.6L57.1 46.0z\" style=\"fill:var(--pop)\"/><path d=\"M40.0 88.0L42.1 93.1L47.6 93.5L43.4 97.1L44.7 102.5L40.0 99.6L35.3 102.5L36.6 97.1L32.4 93.5L37.9 93.1z\" style=\"fill:var(--pop)\"/><path d=\"M218.0 96.0L220.1 101.1L225.6 101.5L221.4 105.1L222.7 110.5L218.0 107.6L213.3 110.5L214.6 105.1L210.4 101.5L215.9 101.1z\" style=\"fill:var(--pop)\"/><path d=\"M150.0 30.0L151.6 33.8L155.7 34.1L152.6 36.8L153.5 40.9L150.0 38.7L146.5 40.9L147.4 36.8L144.3 34.1L148.4 33.8z\" style=\"fill:var(--pop)\"/>",
    front: "<g opacity=\".18\" transform=\"translate(0 6)\"><circle cx=\"64\" cy=\"184\" r=\"22\" fill=\"#132a1f\"/><circle cx=\"96\" cy=\"174\" r=\"28\" fill=\"#132a1f\"/><circle cx=\"132\" cy=\"170\" r=\"30\" fill=\"#132a1f\"/><circle cx=\"166\" cy=\"176\" r=\"26\" fill=\"#132a1f\"/><circle cx=\"196\" cy=\"186\" r=\"20\" fill=\"#132a1f\"/><circle cx=\"128\" cy=\"196\" r=\"30\" fill=\"#132a1f\"/><circle cx=\"84\" cy=\"196\" r=\"22\" fill=\"#132a1f\"/><circle cx=\"176\" cy=\"198\" r=\"20\" fill=\"#132a1f\"/></g><circle cx=\"64\" cy=\"184\" r=\"22\" fill=\"#fff\"/><circle cx=\"96\" cy=\"174\" r=\"28\" fill=\"#fff\"/><circle cx=\"132\" cy=\"170\" r=\"30\" fill=\"#fff\"/><circle cx=\"166\" cy=\"176\" r=\"26\" fill=\"#fff\"/><circle cx=\"196\" cy=\"186\" r=\"20\" fill=\"#fff\"/><circle cx=\"128\" cy=\"196\" r=\"30\" fill=\"#fff\"/><circle cx=\"84\" cy=\"196\" r=\"22\" fill=\"#fff\"/><circle cx=\"176\" cy=\"198\" r=\"20\" fill=\"#fff\"/>",
  },
  agent: {
    label: "Agent",
    story: "Any agent without a clearer role",
    flavor: "Matcha",
    body: "gumdrop",
    eyes: "dots",
  },
}

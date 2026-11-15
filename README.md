# Schoolrun

**BSO-vervoer, elke middag rond.** Every afternoon children have to get from
their school to their BSO (*buitenschoolse opvang*, after-school care).
Schools are out at different times, there are several BSO locations, a few
vans and one big bus that only a colleague with a bus licence may drive, and
some pickups need a caretaker on board. Schoolrun lays out that puzzle for
each weekday, solves it in the browser, and plays the afternoon back on a map.

A static web app: no server, no accounts. Everything runs and is stored in the
browser. Dutch by default, English with one click.

## What's in it

- **Planning**: the day's numbers, today's crew (tap a colleague to call them
  in sick, tap a vehicle to take it off the road, and watch the plan change),
  the problems (*knelpunten*), a grey street map with a km grid and the routes
  (drag with any mouse button; click a location for its card and *Verplaatsen*
  to move it),
  a clock you can play or scrub, who is where right now (names on board,
  children still waiting, arrivals per BSO), the afternoon as a timeline, and
  per vehicle its runs with every child's name: the driver's sheet.
- **Kinderen**: every child in three columns, grouped by school (a coloured
  block) and within it by BSO. Rename, set the *groep* and contract days, call
  a child off for today, drag them to another BSO or school, or paste a class
  list. The dot before each name shows where the child is at the clock's time.
- **Opzet**: BSO locations, schools (out time per weekday; *ophalen uit de
  klas* when a caretaker has to go in), vehicles (seats; above 8 passengers a
  bus licence, D), staff (licence, days, hours), colleagues who need a lift
  (*meerijden*), and the rules the solver plays by.

The default week is set in Berkel en Rodenrijs: 2 BSOs near the centre, 7
schools all around the village, 86 children with Dutch names (5 to 20 per
school, some schools split over both BSOs). Henk is the
only one with a bus licence and doesn't work Wednesday and Friday, so on those
days the bus stays put. Call him in sick on a Monday to see what that does.

### The model, briefly

- A **job** is some children of one school for one BSO, or one colleague's
  lift. Children can't board before their school is out; a lift has a window.
- A vehicle drives **runs**: from where it is, to each pickup in order,
  letting people off whenever it passes their destination, then dropping the
  rest at their BSOs in the best order. The next run starts where it ended.
- **Drivers** are assigned per day: a fixed driver if they're in, else the
  bus first (bus licence only), each from its own BSO first.
- A run with a **classroom pickup** takes a caretaker from the BSO it leaves
  from; they take a seat and boarding takes longer. When nobody is free, it's
  a problem.
- **Distances** are straight lines × a detour factor at an average speed. No
  road routing, on purpose: the map is a backdrop.
- The **solver** starts greedy (pickups by time, each where it adds least),
  then improves with simulated annealing on: child-minutes waiting, person-
  minutes riding, vehicle-minutes driving, and heavy penalties for full
  vehicles, waits past the limit, missing caretakers, late lifts and overtime.
  Seeded, a few milliseconds per frame, warm-started from the last plan.

## Saving

- Everything is saved in the browser (localStorage) as you go; undo with
  Ctrl+Z.
- **Bestand** (File): keep named versions, export/import a JSON file, or copy
  a link that carries the whole setup gzipped in the URL `#hash`. That link
  never touches a server, but it does contain the children's names.

## Develop

Needs [Bun](https://bun.sh).

```sh
bun install
bun run dev          # vite dev server
bun test             # the model: solver, schedule, storage
bun run check        # typescript
bun run build        # static site in dist/
bun run ci           # all three

bun tools/solve.ts [day]   # solve the sample week in the terminal
bun tools/shot.ts http://localhost:4173/ out.png 1440 900 plan light nl 0   # screenshot (system Chrome)
```

`src/model/` is the pure part (no DOM, tested): `types.ts`, `day.ts` (one
weekday's puzzle and its crew), `schedule.ts` (timing a plan), `solver.ts`,
`sim.ts` (the afternoon at a moment), `sample.ts`, `check.ts` (making stored
or imported data sound). `src/ui/` is Lit components; `src/store.ts` holds the
state and the saving; `src/i18n.ts` has both languages.

## Host

The build is plain static files with relative paths (`base: "./"`), so it runs
from any folder on any static host.

**GitHub Pages**: `.github/workflows/pages.yml` type-checks, tests, builds and
deploys on every push to `main`. Turn it on once under *Settings → Pages →
Source: GitHub Actions*. Pages needs the repository to be public, or a paid
plan for a private one.

The map tiles come from OpenStreetMap (`tile.openstreetmap.org`, greyed out
with a CSS filter) under their [tile usage
policy](https://operations.osmfoundation.org/policies/tiles/): fine for a
small tool like this, not for heavy traffic. Address search uses
[Nominatim](https://nominatim.org/) and only runs when you search.

---

Grown out of SCHOOLRUN, an experimental app in the Net (`laza`, ticket T-39).

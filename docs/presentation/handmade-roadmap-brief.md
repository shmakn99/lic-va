# Handmade diagram brief — slide 3

Status: the supplied handmade graphic has been integrated unchanged as `assets/road-to-production.png`. Its five branches converge directly on Pilot. The original brief below is retained for reference; the delivered artwork takes precedence.

Draw **a branching roadmap with five workstreams converging on a launch gate**. This matches the story: the five areas can be developed in parallel, but all must be ready before rollout.

Use plain white paper in landscape, roughly **1.8:1 width to height**. Black/dark green lettering and one green accent will match slides 1–2. Photograph or scan it straight on, with even lighting and generous margins. Aim for at least 2,000 pixels wide. Use large labels; avoid paragraphs.

## Exact layout and words

1. Top centre: a rounded box labelled **Hosted MVP**. Beneath it, write **4–5 users tried together***.
2. Draw a short line down to a horizontal branch feeding five equally spaced boxes. Number the boxes **01–05**. They are parallel workstreams, not five completed milestones.
3. Across the middle, left to right, draw these boxes with the exact labels below. A small document stack, group of people, shield, lock and pulse line can sit above the corresponding titles if you like.

| Box | Main label | First small line | Second small line |
| --- | --- | --- | --- |
| 01 | Documents | Many docs / policy | Version + approve |
| 02 | Capacity | App + AI quotas | Measure + load test |
| 03 | Access | Open public chat | Protected APIs |
| 04 | Privacy | Minimise data | Verify retention |
| 05 | Trust + ops | Evaluate + monitor | Recover + roll back |

4. Bring a line down from every box and join the five lines into one horizontal collector. From its centre draw an arrow down to a larger box labelled **Readiness gate**. Under that label write **Quality · load · privacy · recovery**.
5. Draw an arrow from the gate to a box on the lower right labelled **Measured pilot**. Beneath it write **Then widen rollout**.
6. Add a tiny footnote along the bottom: **\*Demo observation; capacity not yet established.**

Do not use completed checkmarks: these are future work. Keep the arrow direction clear from MVP, through all five workstreams, to gate, to pilot.

## What stays outside your drawing

The slide already supplies its title, five explanatory notes, the traffic-assumption line and three capacity labels: **~1,000 initial planning target / 5,000 busy scenario / 10,000 stress test**. Those numbers mean active chats and are not proven capacity. Leave them out of the illustration so the drawing stays readable and the estimates can be revised independently.

## Integration once the drawing arrives

Save the supplied image as `docs/presentation/assets/road-to-production.png`. Replace the temporary SVG and its draft caption in slide 3 with an image in a `.diagram.zoomable` button, matching slides 1–2; retain the capacity strip below it in the left column. Use accessible alt text describing the five branches, readiness gate and pilot. The existing build embeds hyphenated PNG asset filenames automatically; run `npm run build:presentation`. Verify fit, click-to-enlarge, keyboard navigation, offline opening and landscape print. No generated imitation of the handmade art is needed.

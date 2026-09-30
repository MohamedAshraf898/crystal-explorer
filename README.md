# Crystal Alamein — Interactive Building Explorer

This is a real-estate explorer built on the project's **real renders** and **real architectural floor plans**. It uses plain HTML, CSS and JavaScript, with no framework, no npm and no build step. The only library is GSAP (animation), which loads from a CDN.

## Run it

- **macOS:** double-click `start.command`. It starts a tiny local server with the Python that ships with macOS and opens the site. The first time, macOS may block it: right-click → *Open* → *Open*.
- **Any system:** run `python3 -m http.server 8080` in this folder and open http://localhost:8080
- **Online:** upload the folder to any static host (GitHub Pages, Netlify, cPanel).

You can't just double-click `index.html`, because browsers block JavaScript modules loaded from local files.

## How it works

1. **Building:** the real render fills the screen. Each of the 6 residential floors is an invisible band traced on the photo. Hovering (or tapping) a floor darkens everything else through an SVG mask, so the highlight is the real facade. The main photo is the night render (03.jpg); switch to **Day** for the same view in daylight.
2. **Click a floor:** the camera zooms into that floor on the photo, then the architect's plan for that floor appears.
3. **Floor plan:** every apartment is outlined on the real drawing. Hover or tap to see the number, size and status. The side list offers the same actions.
4. **Click an apartment:** the plan zooms into it and the details panel opens. It shows a sharp crop of that apartment's plan, size, bedrooms, bathrooms, guest toilet, terraces, private garden / pool, the full room schedule (every room with its dimensions, read from the architect's plans), status, price, and a request-information form.
5. **Filter:** the **Filter** button (top bar) opens the apartment finder. Price and area each have their own switch, so you can filter by price only, area only, or both together. Matching apartments are listed (click one to open it), the floor list shows how many match on each floor, and non-matching apartments fade out on the plans.
6. **Compare:** tick **Add to compare** in an apartment's details (or the box beside a Filter result) for up to 3 apartments. A tray appears at the bottom; **Compare** opens a side-by-side table (plan, price, price per m², area, bedrooms, bathrooms, terraces, garden, pool, floor, status) with the best value in each row marked.
7. **Payment plans:** every apartment's details show a payment plan with 10 / 8 / 6-year options: the down payment, monthly and yearly installments, a per-year breakdown and the full installment list with dates. The pattern comes from the developer's sample sheet and is set in **`js/data/paymentPlans.js`** (edit the percentages there). It's scaled so each plan adds up to 100% of the apartment's price.
5. **Back:** use the back button, `Esc`, the breadcrumb, or a click on empty plan space.

**On phones:** tap once to preview, tap again (or tap the button) to open. The photo and the plan can be swiped sideways, and the details panel becomes a bottom sheet you can drag down to close.

## Set statuses and prices

Edit **`js/data/apartments.js`**:

```js
export const unitOverrides = {
  '1-3':  { status: 'sold' },
  '4-17': { status: 'reserved', price: 18500000 },
  '6-12': { price: 9750000 },
};
```

The key is `'<floor>-<apartment number>'`. Status can be `available`, `reserved` or `sold`. Sold apartments are cross-hatched on the plan and can't be selected. Reserved ones are hatched. Anything not listed shows as **Available** with an **estimated price**. An override `price` is shown as the real price (no "estimated" label); `price: null` shows "On request".

Estimated prices come from the `pricing` model in the same file: built-up area × `perM2` × a floor factor, plus the private garden, roof terrace and pool. Change `perM2` (default EGP 115,000/m²) or any factor and every estimate updates.

Room counts and dimensions per apartment live in **`js/data/layouts.js`** (generated from the plan labels; fix any value there by hand).

To send inquiries to your CRM or email, replace `submitInquiry()` in `js/lib/api.js` with a real `fetch(...)` call.

## Where the data comes from

| What | Source | File |
|---|---|---|
| Building photos | `03.jpg` (night, main), `13.jpg` (day, same camera), `3` (street view in the apartment panel) | `assets/renders/` |
| Floor plans | `Floor Plans Updated (3).pdf`: First, Second & Third, Fourth, Fifth & Sixth | `assets/plans/` |
| Apartment numbers, sizes and outlines | Read from the plans (the red "Apartment N · XX m²" labels). Outlines were traced from the plan walls. | `js/data/plans.js` |
| Apartment plan crops | Cut from the full-resolution plans | `assets/units/` |
| Logos, hotline, website | `Crystal Brochure.pdf` | `assets/brand/`, `js/data/project.js` |

Floors 2 & 3 share one plan, and floors 5 & 6 share another, as in the PDF. That gives 146 apartments in total: 28 + 29 + 29 + 20 + 20 + 20.

## Customise

- **Project name, hotline, website, delivery year:** `js/data/project.js`
- **Floor positions on each photo:** the `views` list in `js/data/project.js`. Each view has one traced polygon per floor (`floorBands`, in image pixels), following the slabs and the stepped facade. Add `?debug` to the URL to see the traced bands and apartment outlines in red.
- **Add a photo:** add it to `assets/renders/` and a new entry to `views`.
- **Colours and fonts:** the variables at the top of `styles.css`.

## Files

```
index.html            page + import map (GSAP)
styles.css            all styling
start.command         macOS double-click launcher
assets/               renders, plans, apartment crops, logos (WebP/PNG, web-optimised)
js/
  main.js             entry: wires data → state → views → UI
  state.js            central state + every action (selectFloor, selectApartment, back…)
  director.js         all animations / transitions in one place
  data/               project.js (edit), apartments.js (edit: status, prices), layouts.js (rooms per apartment), plans.js (generated geometry)
  views/              buildingView.js (photo + floor bands), planView.js (plan + apartments)
  ui/                 top bar, floor list, view switch, tooltip, floor panel, details, form
  lib/                small DOM / format / API helpers
```

## Publish on GitHub Pages

1. Create an empty repository at https://github.com/new (don't add a README).
2. In this folder, run:
   ```bash
   git init -b main && git add -A && git commit -m "Crystal Alamein explorer"
   git remote add origin https://github.com/<your-user>/<repo>.git && git push -u origin main
   ```
3. On GitHub, open **Settings → Pages**. Choose **Deploy from a branch**, then **main** / **(root)**, and click **Save**. The site is live after about a minute.

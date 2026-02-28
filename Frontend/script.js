const subscriptionKey = "YOUR_AZURE_KEY";

let lastSource = null;
let lastDestination = null;

let primaryRouteObj = null;
let altRouteObj = null;

let isDay = true;
let isWomenModeOn = false;

const map = new atlas.Map("myMap", {
  center: [80.2707, 13.0827],
  zoom: 10,
  authOptions: { authType: "subscriptionKey", subscriptionKey }
});

const routeDS = new atlas.source.DataSource();
const markerDS = new atlas.source.DataSource();
const popup = new atlas.Popup({ pixelOffset: [0, -10] });

map.events.add("ready", () => {
  map.sources.add(routeDS);
  map.sources.add(markerDS);

  map.layers.add(new atlas.layer.LineLayer(routeDS, "originalRoute", {
    strokeColor: ["get", "color"],
    strokeWidth: 6,
    filter: ["==", ["get", "routeKind"], "original"]
  }));

  map.layers.add(new atlas.layer.LineLayer(routeDS, "altRoute", {
    strokeColor: ["get", "color"],
    strokeWidth: 4,
    strokeDashArray: [2, 2],
    filter: ["==", ["get", "routeKind"], "alternate"]
  }));

  map.layers.add(new atlas.layer.SymbolLayer(markerDS, "markerLayer", {
    iconOptions: { image: "pin-round-darkblue", anchor: "bottom" },
    textOptions: { textField: ["get", "title"], offset: [0, 1.2] }
  }));

  map.events.add("mousemove", ["originalRoute", "altRoute"], (e) => {
    if (e.shapes && e.shapes.length) {
      const p = e.shapes[0].getProperties();
      popup.setOptions({
        content: `
          <b>Safety:</b> ${p.level || "Safe"}<br>
          <b>Incidents:</b> ${p.incidentCount ?? 0}
        `,
        position: e.position
      });
      popup.open(map);
    }
  });

  map.events.add("mouseout", ["originalRoute", "altRoute"], () => popup.close());
});

function colorByLevel(l) {
  if (l === "Unsafe") return "#E74C3C";
  if (l === "Moderate") return "#F1C40F";
  return "#2ECC71";
}

async function getCoords(place) {
  const r = await fetch(
    `https://atlas.microsoft.com/search/address/json?api-version=1.0&subscription-key=${subscriptionKey}&query=${encodeURIComponent(place)}`
  );
  const d = await r.json();
  return d.results?.[0]?.position || null;
}

async function predictPoint(lat, lon) {
  const r = await fetch("http://127.0.0.1:5001/predict_route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon })
  });
  if (!r.ok) return {};
  return await r.json();
}

async function fetchRoutes(src, dst, maxAlternatives = 0) {
  const url =
    `https://atlas.microsoft.com/route/directions/json?api-version=1.0&subscription-key=${subscriptionKey}` +
    `&query=${src.lat},${src.lon}:${dst.lat},${dst.lon}` +
    `&travelMode=car&routeType=fastest&maxAlternatives=${maxAlternatives}` +
    `&alternativeRouteType=anyRoute`;

  const r = await fetch(url);
  const d = await r.json();
  return d.routes || [];
}

async function fetchRouteVia(src, via, dst) {
  const url =
    `https://atlas.microsoft.com/route/directions/json?api-version=1.0&subscription-key=${subscriptionKey}` +
    `&query=${src.lat},${src.lon}:${via.lat},${via.lon}:${dst.lat},${dst.lon}`;

  const r = await fetch(url);
  const d = await r.json();
  return d.routes?.[0] || null;
}

function buildDetourVias(routeObj) {
  const pts = routeObj.legs[0].points.map(p => [p.longitude, p.latitude]);
  const mid = pts[Math.floor(pts.length / 2)];
  const d = 0.025;

  return [
    { lat: mid[1] + d, lon: mid[0] },
    { lat: mid[1] - d, lon: mid[0] },
    { lat: mid[1], lon: mid[0] + d },
    { lat: mid[1], lon: mid[0] - d }
  ];
}

async function drawRoute(routeObj, routeKind) {
  const pts = routeObj.legs[0].points.map(p => [p.longitude, p.latitude]);

  for (let i = 0; i < pts.length - 1; i++) {
    let level = "Safe";
    let inc = 0;

    if (isWomenModeOn) {
      const out = await predictPoint(pts[i][1], pts[i][0]);
      level = out.res || "Safe";
      inc = out.incident_count ?? 0;
    }

    const color = isWomenModeOn
      ? colorByLevel(level)
      : (routeKind === "original" ? "#1565C0" : "#6A1B9A");

    routeDS.add(new atlas.data.Feature(
      new atlas.data.LineString([pts[i], pts[i + 1]]),
      {
        color,
        level,
        incidentCount: inc,
        routeKind
      }
    ));
  }

  return pts;
}

async function renderRoutes() {
  routeDS.clear();
  markerDS.clear();

  const pts = await drawRoute(primaryRouteObj, "original");

  if (altRouteObj) {
    await drawRoute(altRouteObj, "alternate");
  }

  markerDS.add(new atlas.data.Feature(
    new atlas.data.Point([lastSource.lon, lastSource.lat]),
    { title: sourceInput.value }
  ));

  markerDS.add(new atlas.data.Feature(
    new atlas.data.Point([lastDestination.lon, lastDestination.lat]),
    { title: destinationInput.value }
  ));

  map.setCamera({ center: pts[Math.floor(pts.length / 2)] });
}

async function getRoute(src, dst) {
  const routes = await fetchRoutes(src, dst, 0);
  if (!routes.length) return alert("No route found");

  primaryRouteObj = routes[0];
  altRouteObj = null;
  await renderRoutes();
}

async function getAlternate(src, dst) {
  const az = await fetchRoutes(src, dst, 2);
  let candidates = az.slice(1);

  const vias = buildDetourVias(primaryRouteObj);
  for (const via of vias) {
    const detour = await fetchRouteVia(src, via, dst);
    if (detour) candidates.push(detour);
  }

  if (!candidates.length) return;

  altRouteObj = candidates[0]; // just show first available
  await renderRoutes();
}

routeBtn.onclick = async () => {
  const s = await getCoords(sourceInput.value);
  const d = await getCoords(destinationInput.value);
  if (!s || !d) return alert("Invalid location");

  lastSource = s;
  lastDestination = d;
  await getRoute(s, d);
};

alternateRouteBtn.onclick = async () => {
  if (!lastSource || !lastDestination) return alert("Generate route first");
  await getAlternate(lastSource, lastDestination);
};

dayNightBtn.onclick = async () => {
  isDay = !isDay;
  document.body.classList.toggle("night-ui", !isDay);
  dayNightBtn.textContent = isDay ? "Switch to Night Mode" : "Switch to Day Mode";
  if (primaryRouteObj) await renderRoutes();
};

womenModeToggle.onchange = async () => {
  isWomenModeOn = womenModeToggle.checked;
  if (primaryRouteObj) await renderRoutes();
};
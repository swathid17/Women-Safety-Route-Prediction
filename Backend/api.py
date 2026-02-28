from flask import Flask, request, jsonify
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.cluster import KMeans
from flask_cors import CORS

import numpy as np
from math import radians, cos, sin, asin, sqrt
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

app = Flask(__name__)
CORS(app)

CSV_FILE = "new_crime_dataset.csv"
RADIUS_KM = 2
MIN_NEARBY_POINTS = 3

# -----------------------------
# HAVERSINE DISTANCE (km)
# -----------------------------
def haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * asin(sqrt(a)) * 6371

# -----------------------------
# LOAD DATA
# -----------------------------
df = pd.read_csv(CSV_FILE)


required_cols = {
    "latitude", "longitude", "time_of_day", "area_type",
    "street_lighting", "cctv_nearby",
    "police_distance_km", "safety_level"
}

if not required_cols.issubset(df.columns):
    raise ValueError("CSV columns do not match required schema")

# -----------------------------
# TRAIN ML MODEL
# -----------------------------
X = df.drop("safety_level", axis=1)
y = df["safety_level"]

categorical = ["time_of_day", "area_type"]
numerical = [
    "latitude", "longitude",
    "street_lighting", "cctv_nearby",
    "police_distance_km"
]

preprocessor = ColumnTransformer([
    ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
    ("num", "passthrough", numerical)
])

model = Pipeline([
    ("prep", preprocessor),
    ("clf", RandomForestClassifier(
        n_estimators=300,
        random_state=42
    ))
])

model.fit(X, y)


def predict_safety(lat, lon, time_of_day, area_type,
                   street_lighting, cctv_nearby,
                   police_distance_km,
                   radius_km=RADIUS_KM):

    nearby = df.copy()
    nearby["distance"] = nearby.apply(
        lambda r: haversine(lat, lon, r.latitude, r.longitude),
        axis=1
    )

    nearby = nearby[nearby["distance"] <= radius_km]

    # -------- Fallback to ML if not enough neighbors
    if len(nearby) < MIN_NEARBY_POINTS:
        input_df = pd.DataFrame([{
            "latitude": lat,
            "longitude": lon,
            "time_of_day": time_of_day,
            "area_type": area_type,
            "street_lighting": street_lighting,
            "cctv_nearby": cctv_nearby,
            "police_distance_km": police_distance_km
        }])
        return model.predict(input_df)[0]

    # -------- Distance weighted voting
    weights = 1 / (nearby["distance"] + 0.001)

    scores = {}
    for label in nearby["safety_level"].unique():
        scores[label] = weights[nearby["safety_level"] == label].sum()

    return max(scores, key=scores.get)







# Define routes FIRST
@app.route("/", methods=["GET"])
def home():
    return "Hello from Flask API"

@app.route("/dd", methods=["GET"])
def dd_route(): # Renamed to avoid conflict
    return "Hello from /dd endpoint"

@app.route("/predict_route", methods=["POST"])
def predict_route():
    data = request.get_json(force=True)

    lat = data.get("lat")
    lon = data.get("lon")

    results = []


    prediction = predict_safety(
        lat=lat,
        lon=lon,
        time_of_day="Evening",
        area_type="Commercial",
        street_lighting=1,
        cctv_nearby=0,
        police_distance_km=0.86
    )


    resp = {
        "res": prediction
    }

    return jsonify(resp)

# Start the server LAST
if __name__ == "__main__":
    # Remove the early app.run(port=5001) from the top



    app.run(port=5001, debug=True)

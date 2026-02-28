# Women-Safety-Route-Prediction

Route safety prediction system using risk scoring + ML to recommend safer paths.

## Project Overview

The Women Safety Route Prediction System is a web-based application that analyzes crime data and predicts the safety level of a selected route.
The system helps users choose safer travel paths by evaluating crime density, historical incidents, and machine learning predictions.

## Objectives

1. Provide safer route recommendations.
2. Analyze crime data using Machine Learning.
3. Display safety levels in real-time.
4. Assist women in making informed travel decisions.

## How It Works

1. User selects start and destination location.
2. Route coordinates are generated.
3. Crime data within a 2 km radius is analyzed.
4. ML model predicts safety level.
5. Route is marked as:
   - Low Risk
   - Medium Risk
   - High Risk

## System Architecture

1. Frontend (Azure Maps UI)
2. Flask API Backend
3. Decision Engine
4. Machine Learning Model (Decision Tree)
5. Safety Prediction Output

## Tech Stack

**Frontend**

• HTML
• CSS
• JavaScript
• Azure Maps API

**Backend**

• Python
• Flask
• Pandas
• Scikit-learn
• Joblib

**Machine Learning**

• Decision Tree Classifier
• Crime dataset preprocessing
• Encoders for categorical features


## Dataset Used

1. Tamil Nadu Women Crime Dataset

2. Synthetic crime data for training

3. Preprocessed and labeled dataset

## Security Note

API keys are not stored in the repository.
Use environment variables for secure key handling.

## Future Improvements

- Real-time crime data integration
- Mobile application version
- SOS alert system
- Heatmap visualization
- Route alternative suggestions




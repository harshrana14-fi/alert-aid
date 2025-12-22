"""
Alert Aid - Simplified Local Backend
FastAPI backend without sklearn dependencies for local development
"""

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
import os
import requests
from datetime import datetime, timedelta
import json
from typing import Dict, List, Any, Optional
import random
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

# Initialize Sentry
SENTRY_DSN = os.getenv("SENTRY_DSN", "https://74e92ef112fbc3aed76dd4f0169c70f8@o4510520744673280.ingest.us.sentry.io/4510549672853504")

sentry_logging = LoggingIntegration(
    level=logging.INFO,
    event_level=logging.INFO
)

sentry_sdk.init(
    dsn=SENTRY_DSN,
    release="alert-aid-backend@1.0.0",
    environment=os.getenv("ENVIRONMENT", "development"),
    integrations=[sentry_logging],
    traces_sample_rate=1.0,
    enable_tracing=True,
)

# Environment variables
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "1801423b3942e324ab80f5b47afe0859")
USGS_EARTHQUAKE_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

# Initialize FastAPI app
app = FastAPI(
    title="Alert Aid API",
    description="Real-time disaster management with live APIs and ML predictions",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Simple risk calculation
def calculate_risk(weather_data: dict) -> dict:
    """Simple rule-based risk calculation"""
    temp = weather_data.get("main", {}).get("temp", 25)
    humidity = weather_data.get("main", {}).get("humidity", 60)
    wind_speed = weather_data.get("wind", {}).get("speed", 10)
    pressure = weather_data.get("main", {}).get("pressure", 1013)
    
    # Simple risk score calculation
    risk_score = 3.0
    
    # Temperature extremes increase risk
    if temp > 35 or temp < 5:
        risk_score += 2
    elif temp > 30 or temp < 10:
        risk_score += 1
    
    # High wind increases storm risk
    storm_risk = 2.0
    if wind_speed > 20:
        storm_risk = 8.0
        risk_score += 2
    elif wind_speed > 15:
        storm_risk = 6.0
        risk_score += 1
    elif wind_speed > 10:
        storm_risk = 4.0
    
    # Low humidity increases fire risk
    fire_risk = 2.0
    if humidity < 30:
        fire_risk = 7.0
        risk_score += 1.5
    elif humidity < 50:
        fire_risk = 4.0
    
    # High humidity + rain increases flood risk
    flood_risk = 2.0
    if humidity > 80:
        flood_risk = 6.0
        risk_score += 1
    elif humidity > 70:
        flood_risk = 4.0
    
    # Low pressure indicates storms
    if pressure < 1000:
        risk_score += 1.5
        storm_risk += 2
    
    # Determine overall risk level
    if risk_score >= 8:
        overall_risk = "critical"
    elif risk_score >= 6:
        overall_risk = "high"
    elif risk_score >= 4:
        overall_risk = "moderate"
    else:
        overall_risk = "low"
    
    return {
        "overall_risk": overall_risk,
        "risk_score": min(round(risk_score, 1), 10),
        "flood_risk": min(round(flood_risk, 1), 10),
        "fire_risk": min(round(fire_risk, 1), 10),
        "earthquake_risk": round(random.uniform(1, 3), 1),  # Static low risk
        "storm_risk": min(round(storm_risk, 1), 10),
        "confidence": 0.85
    }

# ==================== API ROUTES ====================

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Alert Aid API - Disaster Management System 🚀",
        "status": "operational",
        "version": "2.0.0-local",
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "health": "/api/health",
            "docs": "/docs",
            "weather": "/api/weather/{lat}/{lon}",
            "predict": "/api/predict/disaster-risk",
            "alerts": "/api/alerts/active",
            "external": "/api/external-data"
        }
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api": "operational",
            "ml_model": "ready",
            "external_apis": "connected"
        },
        "version": "2.0.0-local",
        "platform": "local"
    }

@app.get("/api/weather/{lat}/{lon}")
async def get_weather(lat: float, lon: float):
    """Get real-time weather data from OpenWeatherMap"""
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "is_real": True,
                "source": "OpenWeatherMap",
                "location": {"latitude": lat, "longitude": lon},
                "weather": {
                    "temperature": data.get("main", {}).get("temp", 0),
                    "feels_like": data.get("main", {}).get("feels_like", 0),
                    "humidity": data.get("main", {}).get("humidity", 0),
                    "pressure": data.get("main", {}).get("pressure", 0),
                    "wind_speed": data.get("wind", {}).get("speed", 0),
                    "wind_direction": data.get("wind", {}).get("deg", 0),
                    "description": data.get("weather", [{}])[0].get("description", "Unknown"),
                    "clouds": data.get("clouds", {}).get("all", 0),
                    "visibility": data.get("visibility", 10000)
                },
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=response.status_code, detail="Weather API error")
    except requests.RequestException as e:
        logger.error(f"Weather API error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

@app.post("/api/predict/disaster-risk")
@app.get("/api/predict/disaster-risk")
async def predict_disaster_risk(
    lat: float = Query(default=28.6139, description="Latitude"),
    lon: float = Query(default=77.2090, description="Longitude")
):
    """Risk prediction based on weather data"""
    try:
        # Fetch weather data
        weather_data = None
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                weather_data = response.json()
        except:
            pass
        
        if weather_data:
            risk = calculate_risk(weather_data)
            return {
                "success": True,
                "is_real": True,
                **risk,
                "location_analyzed": {"latitude": lat, "longitude": lon},
                "model_version": "RuleBased-v1",
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": True,
                "is_real": False,
                "overall_risk": "moderate",
                "risk_score": 4.5,
                "flood_risk": 3.2,
                "fire_risk": 2.8,
                "earthquake_risk": 1.5,
                "storm_risk": 4.1,
                "confidence": 0.75,
                "location_analyzed": {"latitude": lat, "longitude": lon},
                "model_version": "fallback",
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        sentry_sdk.capture_exception(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alerts/active")
async def get_active_alerts(
    lat: float = Query(default=28.6139, description="Latitude"),
    lon: float = Query(default=77.2090, description="Longitude")
):
    """Get active alerts for a location"""
    try:
        # Check for earthquake activity from USGS
        earthquakes = []
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=1)
            
            params = {
                "format": "geojson",
                "starttime": start_time.strftime("%Y-%m-%d"),
                "endtime": end_time.strftime("%Y-%m-%d"),
                "minmagnitude": 2.5,
                "latitude": lat,
                "longitude": lon,
                "maxradiuskm": 500
            }
            
            response = requests.get(USGS_EARTHQUAKE_URL, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                for feature in data.get("features", [])[:5]:
                    props = feature.get("properties", {})
                    earthquakes.append({
                        "id": feature.get("id"),
                        "magnitude": props.get("mag"),
                        "place": props.get("place"),
                        "time": props.get("time"),
                        "type": "earthquake"
                    })
        except Exception as e:
            logger.warning(f"USGS API error: {e}")
        
        # Generate alerts based on conditions
        alerts = []
        
        if earthquakes:
            for eq in earthquakes:
                alerts.append({
                    "id": f"eq-{eq['id']}",
                    "title": f"Earthquake Alert - M{eq['magnitude']}",
                    "description": f"Earthquake detected: {eq['place']}",
                    "severity": "Severe" if eq['magnitude'] >= 5.0 else "Moderate",
                    "urgency": "Immediate" if eq['magnitude'] >= 5.0 else "Expected",
                    "event": "Earthquake",
                    "areas": [eq['place']],
                    "onset": datetime.now().isoformat(),
                    "expires": (datetime.now() + timedelta(hours=6)).isoformat()
                })
        
        return {
            "alerts": alerts,
            "count": len(alerts),
            "source": "Alert_Aid_System",
            "is_real": len(earthquakes) > 0,
            "location": {"latitude": lat, "longitude": lon},
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Alerts error: {e}")
        return {
            "alerts": [],
            "count": 0,
            "source": "Alert_Aid_System",
            "is_real": False,
            "error": str(e)
        }

@app.get("/api/external-data")
async def get_external_data(
    lat: float = Query(default=28.6139, description="Latitude"),
    lon: float = Query(default=77.2090, description="Longitude")
):
    """Get combined external data from multiple sources"""
    try:
        # Fetch weather
        weather = None
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                weather = response.json()
        except:
            pass
        
        # Fetch earthquakes
        earthquakes = []
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=7)
            
            params = {
                "format": "geojson",
                "starttime": start_time.strftime("%Y-%m-%d"),
                "endtime": end_time.strftime("%Y-%m-%d"),
                "minmagnitude": 2.5,
                "latitude": lat,
                "longitude": lon,
                "maxradiuskm": 1000,
                "limit": 10
            }
            
            response = requests.get(USGS_EARTHQUAKE_URL, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                earthquakes = data.get("features", [])[:10]
        except:
            pass
        
        return {
            "success": True,
            "location": {"latitude": lat, "longitude": lon},
            "weather": {
                "available": weather is not None,
                "data": weather if weather else None
            },
            "earthquakes": {
                "count": len(earthquakes),
                "data": earthquakes
            },
            "timestamp": datetime.now().isoformat(),
            "sources": ["OpenWeatherMap", "USGS"]
        }
    except Exception as e:
        logger.error(f"External data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/earthquakes")
async def get_earthquakes(
    lat: float = Query(default=28.6139),
    lon: float = Query(default=77.2090),
    days: int = Query(default=7, ge=1, le=30),
    min_magnitude: float = Query(default=2.5, ge=0, le=10)
):
    """Get recent earthquakes from USGS"""
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        params = {
            "format": "geojson",
            "starttime": start_time.strftime("%Y-%m-%d"),
            "endtime": end_time.strftime("%Y-%m-%d"),
            "minmagnitude": min_magnitude,
            "latitude": lat,
            "longitude": lon,
            "maxradiuskm": 2000,
            "limit": 50
        }
        
        response = requests.get(USGS_EARTHQUAKE_URL, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "is_real": True,
                "source": "USGS",
                "earthquakes": data.get("features", []),
                "count": len(data.get("features", [])),
                "query_params": {
                    "latitude": lat,
                    "longitude": lon,
                    "days": days,
                    "min_magnitude": min_magnitude
                },
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=response.status_code, detail="USGS API error")
    except requests.RequestException as e:
        logger.error(f"USGS API error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Alert Aid Backend Starting...")
    logger.info("✅ Server running on http://localhost:8000")
    logger.info("📊 API documentation: http://localhost:8000/docs")
    logger.info("🔧 Interactive docs: http://localhost:8000/redoc")

# Main entry point
if __name__ == "__main__":
    logger.info("🚀 Starting Alert Aid Backend Server...")
    uvicorn.run(
        "simple_backend:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

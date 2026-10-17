
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Connect frontend API requests to the Render backend
ARG VITE_API_URL=https://iiwhms-backend.onrender.com
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build


# Stage 2: FastAPI backend
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./

# Copy legacy frontend assets, if used by FastAPI
COPY frontend/legacy_vanilla/ ./static/legacy_vanilla/

# Copy compiled React frontend
COPY --from=frontend-build /app/frontend/dist/ ./static/

EXPOSE 8001

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]

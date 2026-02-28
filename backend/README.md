# FastAPI Backend

A simple FastAPI backend with CORS enabled.

## Setup

1. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Server

Run the server with auto-reload on port 8080:

```bash
uvicorn main:app --reload --port 8080
```

Or run directly with Python:

```bash
python main.py
```

## Testing the Endpoints

With the server running, open a new terminal and run the test script:

```bash
python test_endpoints.py
```

## API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check endpoint
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

## CORS

CORS is configured to allow all origins, methods, and headers. For production, you should restrict these settings.


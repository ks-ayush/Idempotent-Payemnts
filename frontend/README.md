## AI Payment Risk Manager

PaySafe is an AI-powered payment risk management system.

The system combines an idempotent payment architecture with an ML-based fraud-risk engine that evaluates a transaction using behavioral and transaction-level signals before the payment is sent to the gateway.

Instead of treating every payment equally, PaySafe produces:

* a **risk score** from 0–100
* a **risk level**: LOW, MEDIUM, or HIGH
* human-readable **risk factors**
* a cost-aware operating threshold
* a payment decision integrated directly into the payment flow

---

## Demo Flow

```text
User enters payment
        │
        ▼
Next.js payment API
        │
        ├── Idempotency check
        │
        ├── Customer transaction history
        │
        ▼
FastAPI Risk Engine
        │
        ├── Feature engineering
        ├── XGBoost model
        └── Risk explanation
        │
        ▼
Risk result
        │
        ├── LOW
        ├── MEDIUM
        └── HIGH
        │
        ▼
Razorpay Checkout
        │
        ▼
Payment lifecycle
```

The important design goal is that fraud detection is part of the **payment flow itself**, rather than being an offline analysis performed after payments have already happened.

---

# Features

## AI Fraud Risk Scoring

Every payment is evaluated by an XGBoost classifier trained on a labeled fraud dataset.


The score is derived from the model's predicted fraud probability:



## Explainable Risk Factors

PaySafe does not only return a numeric score.

It also generates human-readable explanations such as:

```text
Amount is 81.8x this customer's average
Transaction occurred late at night
Multiple payment attempts detected
High transaction velocity in the last hour
```

This allows the payment UI to show **why** a transaction was flagged rather than presenting a black-box prediction.

---

# Idempotent Payments

The payment system also protects against duplicate payment creation.

Each payment request contains an:

```text
Idempotency-Key
```

The backend uses a Redis-based locking and idempotency mechanism.

Conceptually:

```text
Request 1
   │
   ├── acquire lock
   ├── create payment
   └── store result

Request 2
   │
   └── same Idempotency-Key
            │
            ▼
       existing result
            │
            ▼
      reused: true
```

This prevents accidental duplicate payment creation when a client retries the same request.

---

# Machine Learning Pipeline

## Training Data

The project was initially developed with a synthetic time-ordered fraud dataset to validate the complete pipeline.

After the pipeline was working, the training process was moved to the **PaySim** fraud dataset.

PaySim provides labeled transactions containing transaction type, amount, balances, and time information.

---


# Model

The main production classifier is:

```text
XGBoost
```

Configuration currently uses histogram-based training for faster processing on the PaySim dataset.

The project also supports evaluation of a logistic regression baseline.

---

# Architecture

```text
                         ┌─────────────────────┐
                         │      Next.js UI     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ /api/payments       │
                         │                     │
                         │ Idempotency         │
                         │ Redis lock          │
                         └──────────┬──────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
             Supabase History              FastAPI Risk Engine
                     │                             │
                     │                    ┌────────┴────────┐
                     │                    │                 │
                     │             Feature Engineering   XGBoost
                     │                    │                 │
                     │                    └────────┬────────┘
                     │                             │
                     │                       Risk Result
                     │                             │
                     └─────────────────────────────┘
                                                   │
                                                   ▼
                                            Razorpay Checkout
```

---

# Project Structure

```text
Idempotent-Payemnts/
│
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── payments/
│   │   │   │   └── route.ts
│   │   │   └── payments/
│   │   │       └── history/
│   │   │           └── route.ts
│   │   │
│   │   └── page.tsx
│   │
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── razorpay.ts
│   │   ├── idempotency.ts    
│   │   ├── risk.ts   
|   |   ├── redis.ts 
│   │   └── customer-history.ts
│   │   
│   ├── package.json
│   └── .env.local
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── features.py
│   │   ├── train.py
│   │   └── main.py
│   │
│   ├── models/
│   │   └── fraud_model.joblib
│   │
│   ├── data/
│   │   └── PaySim dataset
│   │
│   ├── requirements.txt
│   └── .gitignore
│
└── README.md
```

---

# Backend Setup

Move into the backend:

```bash
cd backend
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Or:

```bash
pip install pandas numpy scikit-learn xgboost joblib fastapi uvicorn
```

---

# Train the Model

Place the PaySim dataset inside:

```text
backend/data/
```

Then run:

```bash
python -m app.train
```

The training process:

```text
Load dataset
    ↓
Sort chronologically
    ↓
Build features
    ↓
Time-based train/test split
    ↓
Train XGBoost
    ↓
Evaluate
    ↓
Optimize threshold
    ↓
Save model
```

The resulting model is saved as:

```text
backend/models/fraud_model.joblib
```

---

# Run the FastAPI Risk Engine

From `backend/`:

```bash
uvicorn app.main:app --reload --port 8001
```

The API will be available at:

```text
http://127.0.0.1:8001
```

Health check:

```text
GET /health
```

Swagger documentation:

```text
http://127.0.0.1:8001/docs
```

---

# Risk API

## POST `/score`

Example request:

```json
{
  "transaction": {
    "amount": 45000,
    "payment_method": "CARD",
    "created_at": "2026-08-24T02:30:00Z",
    "retry_count": 2
  },
  "customer_history": [
    {
      "amount": 500,
      "created_at": "2026-08-20T10:00:00Z",
      "payment_method": "CARD"
    },
    {
      "amount": 550,
      "created_at": "2026-08-21T11:00:00Z",
      "payment_method": "CARD"
    }
  ]
}
```

Example response:

```json
{
  "risk_score": 91,
  "risk_probability": 0.91,
  "risk_level": "HIGH",
  "risk_factors": [
    "Amount is 87.1x this customer's average",
    "Transaction occurred late at night",
    "Multiple payment attempts detected"
  ],
  "threshold": 0.37
}
```

The exact score depends on the trained model and the transaction data.


# Next.js Setup

Move into:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
RISK_SERVICE_URL=http://127.0.0.1:8001
```

Start the frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```


# Risk Levels

The current application uses three levels:

```text
LOW
MEDIUM
HIGH
```

These represent the model's risk assessment.



# Environment Variables

## Next.js

```env
RISK_SERVICE_URL=http://127.0.0.1:8001

SUPABASE_URL=...

SUPABASE_ANON_KEY=...

RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```


# Deployment

## Frontend

The Next.js application can be deployed to:

```text
Vercel
```

Set:

```env
RISK_SERVICE_URL=https://your-fastapi-service.onrender.com
```

in the Vercel environment variables.

---

## FastAPI

The FastAPI risk engine can be deployed as a Render Web Service.

Recommended settings:

```text
Root Directory:
backend
```

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

After deployment, test:

```text
https://your-fastapi-service.onrender.com/health
```

and:

```text
https://your-fastapi-service.onrender.com/docs
```

---


# Security Considerations

The project follows a defense-oriented design.

Important principles:

* Risk scoring is performed server-side.
* API secrets are not exposed to the browser.
* Idempotency keys protect against duplicate payment creation.
* FastAPI is called from the Next.js server rather than directly from the browser.
* The model is not allowed to directly modify payment credentials or gateway configuration.
* Risk explanations are generated separately from the numeric model prediction.



# Final Note

This repository demonstrates a complete working fraud-risk pipeline from:

```text
transaction
    ↓
feature engineering
    ↓
machine learning
    ↓
risk explanation
    ↓
payment integration
```

The focus is not only on training a classifier, but on showing how an ML risk engine can operate as a component of a real payment system.

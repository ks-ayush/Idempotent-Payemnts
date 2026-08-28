import joblib

from fastapi import FastAPI
from pydantic import BaseModel

from app.features import (
    build_live_features,
    get_risk_factors,
)


app = FastAPI(
    title="PaySafe Risk Engine",
)



artifact = joblib.load(
    "models/fraud_model.joblib"
)

model = artifact["model"]

threshold = artifact["threshold"]

feature_names = artifact[
    "feature_names"
]



class HistoryTransaction(BaseModel):

    amount: float

    created_at: str

    payment_method: str = "CARD"


class Transaction(BaseModel):

    amount: float

    payment_method: str = "CARD"

    created_at: str

    retry_count: int = 0


class ScoreRequest(BaseModel):

    transaction: Transaction

    customer_history: list[
        HistoryTransaction
    ] = []



@app.get("/health")
def health():

    return {
        "status": "ok"
    }


@app.post("/score")
def score(
    request: ScoreRequest
):

    transaction = (
        request.transaction
        .model_dump()
    )

    history = [

        item.model_dump()

        for item
        in request.customer_history
    ]

    # -----------------------------------------------------
    # Build EXACT production features
    # -----------------------------------------------------

    features = build_live_features(
        transaction=transaction,
        customer_history=history,
    )


    features = features[
        feature_names
    ]

    # -----------------------------------------------------
    # Predict
    # -----------------------------------------------------

    probability = float(
        model.predict_proba(
            features
        )[0][1]
    )

    risk_score = round(
        probability * 100
    )

    # -----------------------------------------------------
    # Risk level
    # -----------------------------------------------------

    if probability >= threshold:

        risk_level = "HIGH"

    elif probability >= (
        threshold * 0.5
    ):

        risk_level = "MEDIUM"

    else:

        risk_level = "LOW"

    # -----------------------------------------------------
    # Explainability
    # -----------------------------------------------------

    risk_factors = (
        get_risk_factors(
            transaction,
            history,
        )
    )

    return {

        "risk_score":
            risk_score,

        "risk_probability":
            round(
                probability,
                4,
            ),

        "risk_level":
            risk_level,

        "risk_factors":
            risk_factors,

        "threshold":
            threshold,
    }


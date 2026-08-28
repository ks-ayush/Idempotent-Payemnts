from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd


FEATURE_NAMES = [
    "amount",
    "amount_log",
    "balance_error",
    "old_balance_ratio",
    "new_balance_ratio",
    "is_transfer",
    "is_cash_out",
    "is_debit",
    "hour",
    "is_night",
    "retry_count",
    "new_customer",
    "payment_method",
]


PAYMENT_METHOD_MAP = {
    "CARD": 0,
    "UPI": 1,
    "NETBANKING": 2,
    "WALLET": 3,
    "OTHER": 4,
}


def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(
        value.replace("Z", "+00:00")
    )


def encode_payment_method(
    payment_method: str | None,
) -> int:
    if not payment_method:
        return PAYMENT_METHOD_MAP["OTHER"]

    return PAYMENT_METHOD_MAP.get(
        payment_method.upper(),
        PAYMENT_METHOD_MAP["OTHER"],
    )


def build_live_features(
    transaction: dict[str, Any],
    customer_history: list[dict[str, Any]],
) -> pd.DataFrame:

    amount = float(
        transaction.get("amount", 0)
    )

    created_at = parse_datetime(
        transaction["created_at"]
    )

    retry_count = int(
        transaction.get("retry_count", 0)
    )

    payment_method = encode_payment_method(
        transaction.get("payment_method")
    )

    amounts = [
        float(x["amount"])
        for x in customer_history
        if x.get("amount") is not None
    ]

    if amounts:
        average_amount = float(np.mean(amounts))
        std_amount = float(np.std(amounts))
    else:
        average_amount = amount
        std_amount = 0.0

    amount_vs_average = (
        amount / max(average_amount, 1.0)
    )

    if std_amount > 0:
        z_score = (
            amount - average_amount
        ) / std_amount
    else:
        z_score = 0.0

    one_hour_ago = (
        created_at - timedelta(hours=1)
    )

    one_day_ago = (
        created_at - timedelta(days=1)
    )

    velocity_1h = 0
    velocity_24h = 0

    for item in customer_history:

        item_time = parse_datetime(
            item["created_at"]
        )

        if one_hour_ago <= item_time <= created_at:
            velocity_1h += 1

        if one_day_ago <= item_time <= created_at:
            velocity_24h += 1

    is_night = int(
        created_at.hour < 6
        or created_at.hour >= 22
    )

    new_customer = int(
        len(customer_history) == 0
    )

    row = {
        "amount": amount,
        "amount_log": np.log1p(amount),
        "balance_error": 0.0,
        "old_balance_ratio": 1.0,
        "new_balance_ratio": 0.0,
        "is_transfer": 0,
        "is_cash_out": 0,
        "is_debit": 0,
        "hour": created_at.hour,
        "is_night": is_night,
        "retry_count": retry_count,
        "new_customer": new_customer,
        "payment_method": payment_method,
    }

    return pd.DataFrame(
        [row],
        columns=FEATURE_NAMES,
    )



def build_training_features(
    df: pd.DataFrame,
) -> pd.DataFrame:

    data = df.copy()

    result = pd.DataFrame(
        index=data.index
    )

   

    amount = data["amount"].astype(float)

    result["amount"] = amount

    result["amount_log"] = np.log1p(
        amount
    )

   
    
    result["balance_error"] = (
        data["oldbalanceOrg"]
        - amount
        - data["newbalanceOrig"]
    )

    

    result["old_balance_ratio"] = (
        data["oldbalanceOrg"]
        /
        (amount + 1.0)
    )

    result["new_balance_ratio"] = (
        data["newbalanceOrig"]
        /
        (amount + 1.0)
    )

    

    transaction_type = (
        data["type"]
        .astype(str)
    )

    result["is_transfer"] = (
        transaction_type == "TRANSFER"
    ).astype(int)

    result["is_cash_out"] = (
        transaction_type == "CASH_OUT"
    ).astype(int)

    result["is_debit"] = (
        transaction_type == "DEBIT"
    ).astype(int)

   

    hour = (
        data["step"] % 24
    )

    result["hour"] = hour

    result["is_night"] = (
        (
            (hour < 6)
            |
            (hour >= 22)
        )
        .astype(int)
    )

    

   
    result["retry_count"] = 0

    result["new_customer"] = 0

    
    result["payment_method"] = (
        transaction_type
        .map(
            {
                "PAYMENT": 0,
                "TRANSFER": 1,
                "CASH_OUT": 2,
                "DEBIT": 3,
                "CASH_IN": 4,
            }
        )
        .fillna(4)
        .astype(int)
    )

    return result[
        FEATURE_NAMES
    ]

def get_risk_factors(
    transaction: dict,
    customer_history: list[dict],
) -> list[str]:

    factors = []

    amount = float(
        transaction.get("amount", 0)
    )

    retry_count = int(
        transaction.get("retry_count", 0)
    )

    created_at = parse_datetime(
        transaction["created_at"]
    )

  
    amounts = [
        float(item["amount"])
        for item in customer_history
        if item.get("amount") is not None
    ]

    if amounts:

        average_amount = sum(amounts) / len(amounts)

        if average_amount > 0:

            ratio = (
                amount / average_amount
            )

            if ratio >= 5:

                factors.append(
                    f"Amount is {ratio:.1f}x "
                    "this customer's average"
                )

            elif ratio >= 2:

                factors.append(
                    "Amount is significantly "
                    "above this customer's average"
                )

   
    if (
        created_at.hour < 6
        or created_at.hour >= 22
    ):

        factors.append(
            "Transaction occurred late at night"
        )

    if retry_count >= 2:

        factors.append(
            "Multiple payment attempts detected"
        )

  

    one_hour_ago = (
        created_at - timedelta(hours=1)
    )

    one_day_ago = (
        created_at - timedelta(days=1)
    )

    velocity_1h = 0
    velocity_24h = 0

    for item in customer_history:

        item_time = parse_datetime(
            item["created_at"]
        )

        if (
            one_hour_ago
            <= item_time
            <= created_at
        ):
            velocity_1h += 1

        if (
            one_day_ago
            <= item_time
            <= created_at
        ):
            velocity_24h += 1

    if velocity_1h >= 3:

        factors.append(
            "High transaction velocity "
            "in the last hour"
        )

    if velocity_24h >= 10:

        factors.append(
            "High transaction velocity "
            "in the last 24 hours"
        )

   
    if not customer_history:

        factors.append(
            "No previous transaction history available"
        )

    return factors
import argparse

import joblib
import pandas as pd

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_score,
    recall_score,
)

from xgboost import XGBClassifier

from app.features import (
    FEATURE_NAMES,
    build_training_features,
)


def find_best_threshold(
    y_true,
    probabilities,
    fp_cost=1,
    fn_cost=8,
):

    best_threshold = 0.5
    best_cost = float("inf")

    for threshold in [
        i / 100
        for i in range(1, 100)
    ]:

        predictions = (
            probabilities >= threshold
        ).astype(int)

        tn, fp, fn, tp = (
            confusion_matrix(
                y_true,
                predictions,
            ).ravel()
        )

        cost = (
            fp_cost * fp
            + fn_cost * fn
        )

        if cost < best_cost:
            best_cost = cost
            best_threshold = threshold

    return best_threshold, best_cost


def evaluate(
    model,
    X_test,
    y_test,
):

    probabilities = (
        model.predict_proba(X_test)[:, 1]
    )

    pr_auc = average_precision_score(
        y_test,
        probabilities,
    )

    threshold, cost = find_best_threshold(
        y_test,
        probabilities,
    )

    predictions = (
        probabilities >= threshold
    ).astype(int)

    precision = precision_score(
        y_test,
        predictions,
        zero_division=0,
    )

    recall = recall_score(
        y_test,
        predictions,
        zero_division=0,
    )

    matrix = confusion_matrix(
        y_test,
        predictions,
    )

    print("\n========== RESULTS ==========")
    print(f"PR-AUC:    {pr_auc:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"Threshold: {threshold:.2f}")
    print(f"Cost:      {cost}")

    print("\nConfusion Matrix:")
    print(matrix)

    return {
        "pr_auc": pr_auc,
        "precision": precision,
        "recall": recall,
        "threshold": threshold,
        "cost": cost,
    }


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--data",
        default=(
            "data/"
            "PS_20174392719_1491204439457_log.csv.zip"
        ),
    )

    parser.add_argument(
        "--model-out",
        default="models/fraud_model.joblib",
    )

    args = parser.parse_args()

    print("Loading dataset...")

    df = pd.read_csv(
        args.data
    )

    print(
        "Rows:",
        len(df)
    )

    # -----------------------------------------------------
    # Keep chronological order
    # -----------------------------------------------------

    df = df.sort_values(
        "step"
    ).reset_index(
        drop=True
    )

    # -----------------------------------------------------
    # Features
    # -----------------------------------------------------

    print("Building features...")

    X = build_training_features(
        df
    )

    y = (
        df["isFraud"]
        .astype(int)
    )

    print(
        "Feature matrix:",
        X.shape
    )

    # -----------------------------------------------------
    # Time split
    # -----------------------------------------------------

    split = int(
        len(df) * 0.80
    )

    X_train = X.iloc[
        :split
    ]

    X_test = X.iloc[
        split:
    ]

    y_train = y.iloc[
        :split
    ]

    y_test = y.iloc[
        split:
    ]

    print(
        "Training rows:",
        len(X_train)
    )

    print(
        "Testing rows:",
        len(X_test)
    )

    print(
        "Fraud training:",
        int(y_train.sum())
    )

    print(
        "Fraud testing:",
        int(y_test.sum())
    )

    # -----------------------------------------------------
    # Class imbalance
    # -----------------------------------------------------

    fraud_count = int(
        y_train.sum()
    )

    normal_count = (
        len(y_train)
        - fraud_count
    )

    scale_pos_weight = (
        normal_count
        /
        max(fraud_count, 1)
    )

    print(
        "scale_pos_weight:",
        scale_pos_weight
    )

    # -----------------------------------------------------
    # XGBoost
    # -----------------------------------------------------

    model = XGBClassifier(

        n_estimators=100,

        max_depth=4,

        learning_rate=0.10,

        subsample=0.8,

        colsample_bytree=0.8,

        objective="binary:logistic",

        eval_metric="aucpr",

        scale_pos_weight=scale_pos_weight,

        tree_method="hist",

        n_jobs=-1,

        random_state=42,
    )

    print(
        "\nTraining XGBoost..."
    )

    model.fit(
        X_train,
        y_train,
    )

    metrics = evaluate(
        model,
        X_test,
        y_test,
    )

    # -----------------------------------------------------
    # Save
    # -----------------------------------------------------

    artifact = {

        "model":
            model,

        "threshold":
            metrics["threshold"],

        "feature_names":
            FEATURE_NAMES,

        "metrics": {

            "pr_auc":
                metrics["pr_auc"],

            "precision":
                metrics["precision"],

            "recall":
                metrics["recall"],

            "cost":
                metrics["cost"],
        },
    }

    joblib.dump(
        artifact,
        args.model_out,
    )

    print(
        "\nModel saved to:",
        args.model_out
    )


if __name__ == "__main__":
    main()
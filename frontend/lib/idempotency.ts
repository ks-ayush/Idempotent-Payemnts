import { randomUUID } from "crypto";

import redis from "./redis";
import { supabase } from "./supabase";

export async function acquireLock(key: string) {
  const redisKey = `idempotency:${key}`;
  const token = randomUUID();

  const result = await redis.set(
    redisKey,
    token,
    "EX",
    50,
    "NX"
  );

  if (result !== "OK") {
    return null;
  }

  return token;
}

export async function getIdempotencyRecord(key: string) {
  const { data, error } = await supabase
    .from("idempotency_keys")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error(
      "Failed to read idempotency record:",
      error
    );

    throw error;
  }

  return data;
}

export async function createIdempotencyRecord(
  key: string
) {
  const { data, error } = await supabase
    .from("idempotency_keys")
    .insert({
      key,
      status: "PROCESSING",
    })
    .select()
    .single();

  if (error) {
    console.error(
      "Failed to create idempotency record:",
      error
    );

    throw error;
  }

  return data;
}

export async function completeIdempotencyRecord(
  key: string,
  response: unknown
) {
  const { error } = await supabase
    .from("idempotency_keys")
    .update({
      status: "COMPLETED",
      response,
      completed_at: new Date().toISOString(),
    })
    .eq("key", key);

  if (error) {
    console.error(
      "Failed to complete idempotency record:",
      error
    );

    throw error;
  }
}

export async function releaseLock(
  key: string,
  token: string
) {
  const redisKey = `idempotency:${key}`;

  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  await redis.eval(
    script,
    1,
    redisKey,
    token
  );
}


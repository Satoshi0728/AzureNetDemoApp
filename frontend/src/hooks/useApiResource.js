import { useCallback, useEffect, useRef, useState } from "react";
import { isBodylessHttpStatus } from "../../../shared/http-status-catalog.mjs";

const shouldParseJson = (response) => {
  if (!response) return false;
  const status = response.status ?? null;
  if (status != null && isBodylessHttpStatus(status)) {
    return false;
  }

  const contentLengthHeader = response.headers?.get?.("content-length");
  if (contentLengthHeader != null && Number(contentLengthHeader) === 0) {
    return false;
  }

  const contentType = response.headers?.get?.("content-type") || "";
  return contentType.toLowerCase().includes("application/json");
};

const safeParseJson = async (response) => {
  if (!response || typeof response.json !== "function") {
    return null;
  }

  try {
    return await response.json();
  } catch (error) {
    if (error?.name === "SyntaxError") {
      return null;
    }
    throw error;
  }
};

const buildFriendlyErrorMessage = (endpoint, status, err) => {
  if (status != null) {
    return `Failed to fetch ${endpoint}: ${status}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "データ取得に失敗しました";
};

export const useApiResource = (endpoint, { immediate = true, acceptErrorPayload = true } = {}) => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(immediate ? "loading" : "idle");
  const [error, setError] = useState(null);
  const [httpStatus, setHttpStatus] = useState(null);
  const [isBodyless, setIsBodyless] = useState(false);
  const [responseMeta, setResponseMeta] = useState(null);
  const controllerRef = useRef(null);

  const resetState = useCallback(() => {
    setStatus("loading");
    setError(null);
    setData(null);
    setHttpStatus(null);
    setIsBodyless(false);
    setResponseMeta(null);
  }, []);

  const clearState = useCallback(() => {
    setStatus("idle");
    setError(null);
    setData(null);
    setHttpStatus(null);
    setIsBodyless(false);
    setResponseMeta(null);
  }, []);

  const load = useCallback(async () => {
    if (!endpoint) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    resetState();

    let responseStatus = null;
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      responseStatus = response.status;
      setHttpStatus(responseStatus);
      setIsBodyless(responseStatus != null && isBodylessHttpStatus(responseStatus));
      setResponseMeta({
        generatedAt: response.headers?.get?.("x-generated-at") ?? null,
        statusText: response.headers?.get?.("x-status-text") ?? null,
      });

      const parseJson = shouldParseJson(response);
      const payload = parseJson ? await safeParseJson(response) : null;

      if (parseJson && payload === null) {
        throw new Error(`Failed to parse JSON from ${endpoint}`);
      }

      const expectsBody = responseStatus != null && !isBodylessHttpStatus(responseStatus);
      if (response.ok && expectsBody && !parseJson) {
        const contentType = response.headers?.get?.("content-type") || "unknown content type";
        responseStatus = 500;
        setHttpStatus(500);
        throw new Error(`Unexpected response from ${endpoint}: ${contentType}`);
      }

      if (!response.ok) {
        if (!acceptErrorPayload) {
          throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
        }
        setData(payload);
        const message =
          payload?.error?.message ?? payload?.message ?? `Failed to fetch ${endpoint}: ${response.status}`;
        setError(message);
        setStatus("error");
        return;
      }

      setData(payload);
      setStatus("success");
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(buildFriendlyErrorMessage(endpoint, responseStatus, err));
      setStatus("error");
    }
  }, [acceptErrorPayload, endpoint]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearState();
  }, [clearState]);

  useEffect(() => {
    if (immediate) {
      load();
    }
    return () => controllerRef.current?.abort();
  }, [immediate, load]);

  return { data, status, error, httpStatus, isBodyless, responseMeta, reload: load, cancel };
};
